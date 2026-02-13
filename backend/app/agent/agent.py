import uuid
from datetime import datetime, timezone

import anthropic
from sqlalchemy.ext.asyncio import AsyncSession

from app.agent.system_prompt import SYSTEM_PROMPT
from app.agent.tools import TOOLS
from app.models.file import File
from app.services import file_service
from app.filestore.base import StorageBackend
from app.websocket.manager import ConnectionManager


class PlainerAgent:
    def __init__(
        self,
        db: AsyncSession,
        storage: StorageBackend,
        ws_manager: ConnectionManager,
        workspace_id: uuid.UUID,
        workspace_name: str,
        conversation_id: uuid.UUID,
        owner_id: uuid.UUID,
        anthropic_api_key: str = "",
    ):
        self.client = anthropic.AsyncAnthropic(api_key=anthropic_api_key)
        self.db = db
        self.storage = storage
        self.ws_manager = ws_manager
        self.workspace_id = workspace_id
        self.owner_id = owner_id
        self.workspace_name = workspace_name
        self.conversation_id = conversation_id

    async def _build_system_prompt(self) -> str:
        all_files = await file_service.list_all_workspace_files(self.db, self.workspace_id)
        data_files = [f for f in all_files if f.file_type != "view"]
        view_files = [f for f in all_files if f.file_type == "view"]

        parts = []
        if data_files:
            parts.append("My Files/\n" + "\n".join(
                f"  - {f.name} (ID: {f.id}, type: {f.file_type})" for f in data_files
            ))
        if view_files:
            parts.append("My Files/Views/\n" + "\n".join(
                f"  - {f.name} (ID: {f.id})" for f in view_files
            ))
        listing = "\n\n".join(parts) if parts else "(no files yet)"

        return SYSTEM_PROMPT.format(
            workspace_name=self.workspace_name,
            file_listing=listing,
        )

    async def _ws_send(self, event_type: str, payload: dict):
        await self.ws_manager.send_to_workspace(
            self.workspace_id,
            {"type": event_type, "payload": {
                "conversation_id": str(self.conversation_id),
                **payload,
            }},
        )

    async def run(self, messages: list[dict], attachments: list[dict] | None = None) -> str:
        # If the last user message has image attachments, upgrade it to multimodal
        if attachments and messages and messages[-1]["role"] == "user":
            last_msg = messages[-1]
            text = last_msg["content"] if isinstance(last_msg["content"], str) else ""
            content_blocks: list[dict] = []
            for att in attachments:
                if att.get("type") == "image":
                    content_blocks.append({
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": att.get("media_type", "image/png"),
                            "data": att["data"],
                        },
                    })
            content_blocks.append({"type": "text", "text": text})
            messages[-1] = {"role": "user", "content": content_blocks}

        all_text_parts: list[str] = []  # Collect text from every iteration
        iteration = 0
        max_iterations = 25  # Safety limit

        while iteration < max_iterations:
            iteration += 1

            # Rebuild system prompt each iteration so agent sees newly created files
            system_prompt = await self._build_system_prompt()

            # Stream the response
            collected_text = ""
            response = None

            async with self.client.messages.stream(
                model="claude-opus-4-6",
                max_tokens=8192,
                system=system_prompt,
                messages=messages,
                tools=TOOLS,
            ) as stream:
                async for event in stream:
                    if event.type == "content_block_delta":
                        if hasattr(event.delta, "text"):
                            collected_text += event.delta.text
                            await self._ws_send("agent.stream_delta", {
                                "delta": event.delta.text,
                            })

                response = await stream.get_final_message()

            if collected_text:
                all_text_parts.append(collected_text)

            # Check for tool use
            tool_use_blocks = [
                block for block in response.content if block.type == "tool_use"
            ]

            if not tool_use_blocks:
                # No tool calls — done. Send full accumulated text.
                full_text = "\n\n".join(all_text_parts)
                await self._ws_send("agent.stream_end", {"content": full_text})
                return full_text

            # Execute tool calls — serialize content blocks
            assistant_content = []
            for b in response.content:
                if b.type == "text":
                    assistant_content.append({"type": "text", "text": b.text})
                elif b.type == "tool_use":
                    assistant_content.append({
                        "type": "tool_use",
                        "id": b.id,
                        "name": b.name,
                        "input": b.input,
                    })
            messages.append({"role": "assistant", "content": assistant_content})

            tool_results = []
            for tool_block in tool_use_blocks:
                # Extract a human-readable label for the tool call
                tool_label = self._tool_label(tool_block.name, tool_block.input)

                await self._ws_send("agent.tool_use", {
                    "tool_name": tool_block.name,
                    "label": tool_label,
                    "status": "started",
                })

                result = await self._execute_tool(tool_block.name, tool_block.input)

                await self._ws_send("agent.tool_use", {
                    "tool_name": tool_block.name,
                    "label": tool_label,
                    "result": result,
                    "status": "completed",
                })

                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": tool_block.id,
                    "content": result,
                })

            messages.append({"role": "user", "content": tool_results})
            # Loop continues — Claude processes tool results

        # Safety: hit max iterations
        full_text = "\n\n".join(all_text_parts)
        await self._ws_send("agent.stream_end", {"content": full_text})
        return full_text

    @staticmethod
    def _tool_label(tool_name: str, tool_input: dict) -> str:
        if tool_name == "create_file":
            return f"Creating {tool_input.get('name', 'file')}"
        elif tool_name == "edit_file":
            return "Editing file"
        elif tool_name == "read_file":
            return "Reading file"
        elif tool_name == "list_files":
            return "Listing files"
        elif tool_name == "delete_file":
            return "Deleting file"
        elif tool_name == "link_view":
            return f"Linking view: {tool_input.get('label', 'view')}"
        elif tool_name == "toggle_favorite":
            return "Toggling favorite"
        return tool_name

    async def _execute_tool(self, tool_name: str, tool_input: dict) -> str:
        if tool_name == "create_file":
            # Determine target folder: Views folder for .html view files, Files folder for data files
            views_folder, files_folder = await file_service.ensure_system_folders(
                self.db, self.workspace_id, self.owner_id
            )
            name = tool_input["name"]
            is_view = name.lower().endswith((".html", ".htm"))
            target_folder = views_folder if is_view else files_folder

            file = await file_service.create_file_from_content(
                db=self.db,
                storage=self.storage,
                workspace_id=self.workspace_id,
                name=name,
                content=tool_input["content"],
                owner_id=self.owner_id,
                folder_id=target_folder.id,
                created_by_agent=True,
            )
            await self.db.commit()

            # Broadcast file creation
            await self.ws_manager.send_to_workspace(
                self.workspace_id,
                {
                    "type": "file.created",
                    "payload": {
                        "file_id": str(file.id),
                        "workspace_id": str(file.workspace_id),
                        "folder_id": str(file.folder_id) if file.folder_id else None,
                        "name": file.name,
                        "mime_type": file.mime_type,
                        "size_bytes": file.size_bytes,
                        "file_type": file.file_type,
                        "is_vibe_file": True,
                        "created_by_agent": True,
                    },
                },
            )
            return f"File '{file.name}' created successfully (ID: {file.id})"

        elif tool_name == "read_file":
            content = await file_service.get_file_content(
                db=self.db,
                storage=self.storage,
                file_id=uuid.UUID(tool_input["file_id"]),
            )
            if content is None:
                return "Error: File not found"
            return content

        elif tool_name == "list_files":
            all_files = await file_service.list_all_workspace_files(self.db, self.workspace_id)
            if not all_files:
                return "No files in workspace"
            data = [f for f in all_files if f.file_type != "view"]
            views = [f for f in all_files if f.file_type == "view"]
            parts = []
            if data:
                parts.append("My Files/\n" + "\n".join(
                    f"  - {f.name} (ID: {f.id}, type: {f.file_type}, size: {f.size_bytes}b)"
                    for f in data
                ))
            if views:
                parts.append("My Files/Views/\n" + "\n".join(
                    f"  - {f.name} (ID: {f.id}, size: {f.size_bytes}b)"
                    for f in views
                ))
            return "\n\n".join(parts)

        elif tool_name == "edit_file":
            file = await file_service.get_file_by_id(
                self.db, uuid.UUID(tool_input["file_id"])
            )
            if file is None:
                return "Error: File not found"

            # Update content
            new_content = tool_input["new_content"]
            content_bytes = new_content.encode("utf-8")
            new_key = f"{self.workspace_id}/{uuid.uuid4()}/{file.name}"
            await self.storage.put(new_key, content_bytes)

            file.storage_key = new_key
            file.size_bytes = len(content_bytes)
            file.content_text = new_content
            file.updated_at = datetime.now(timezone.utc)

            # Create version
            from app.models.file import FileVersion
            from sqlalchemy import func, select

            max_ver = await self.db.execute(
                select(func.max(FileVersion.version_number)).where(
                    FileVersion.file_id == file.id
                )
            )
            next_version = (max_ver.scalar() or 0) + 1

            version = FileVersion(
                file_id=file.id,
                version_number=next_version,
                storage_key=new_key,
                size_bytes=len(content_bytes),
                content_text=new_content,
                change_summary=tool_input.get("change_summary"),
                created_by_agent=True,
                created_at=datetime.now(timezone.utc),
            )
            self.db.add(version)
            await self.db.commit()

            await self.ws_manager.send_to_workspace(
                self.workspace_id,
                {
                    "type": "file.updated",
                    "payload": {
                        "file_id": str(file.id),
                        "name": file.name,
                        "size_bytes": file.size_bytes,
                    },
                },
            )
            return f"File '{file.name}' updated (version {next_version})"

        elif tool_name == "delete_file":
            file = await file_service.get_file_by_id(
                self.db, uuid.UUID(tool_input["file_id"])
            )
            if file is None:
                return "Error: File not found"
            file.deleted_at = datetime.now(timezone.utc)
            await self.db.commit()

            await self.ws_manager.send_to_workspace(
                self.workspace_id,
                {
                    "type": "file.deleted",
                    "payload": {"file_id": str(file.id), "name": file.name},
                },
            )
            return f"File '{file.name}' deleted"

        elif tool_name == "link_view":
            file_view = await file_service.link_view_to_file(
                self.db,
                file_id=uuid.UUID(tool_input["file_id"]),
                view_file_id=uuid.UUID(tool_input["view_file_id"]),
                label=tool_input["label"],
            )
            await self.db.commit()

            await self.ws_manager.send_to_workspace(
                self.workspace_id,
                {
                    "type": "file.updated",
                    "payload": {
                        "file_id": tool_input["file_id"],
                        "linked_view": True,
                    },
                },
            )
            return f"View linked as '{tool_input['label']}' tab (link ID: {file_view.id})"

        elif tool_name == "toggle_favorite":
            file = await file_service.toggle_file_favorite(
                self.db,
                file_id=uuid.UUID(tool_input["file_id"]),
                user_id=self.owner_id,
            )
            await self.db.commit()

            await self.ws_manager.send_to_workspace(
                self.workspace_id,
                {
                    "type": "file.updated",
                    "payload": {
                        "file_id": str(file.id),
                        "name": file.name,
                        "is_favorite": file.is_favorite,
                    },
                },
            )
            status = "starred" if file.is_favorite else "unstarred"
            return f"File '{file.name}' {status}"

        return f"Unknown tool: {tool_name}"
