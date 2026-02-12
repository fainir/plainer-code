import asyncio
import json
import logging
import traceback
import uuid
from contextlib import asynccontextmanager

import jwt as pyjwt
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select

logger = logging.getLogger(__name__)

from app.api.router import api_router
from app.config import settings
from app.database import async_session, engine
from app.models.user import User
from app.models.workspace import Workspace
from app.agent.agent import PlainerAgent
from app.services import chat_service, file_service
from app.dependencies import get_storage_backend
from app.websocket.manager import ws_manager

# Active agent tasks keyed by conversation_id
_agent_tasks: dict[str, asyncio.Task] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await engine.dispose()


app = FastAPI(title="Plainer", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)


@app.get("/health")
async def health():
    return {"status": "ok"}


async def _run_agent(
    drive_id: uuid.UUID,
    drive_name: str,
    conversation_id: uuid.UUID,
    user_id: uuid.UUID,
    api_key: str,
    anthropic_messages: list[dict],
    attachments: list[dict] | None = None,
):
    """Run the agent in a background task so the WS loop stays free."""
    conv_key = str(conversation_id)
    try:
        async with async_session() as db:
            storage = get_storage_backend()
            agent = PlainerAgent(
                db=db,
                storage=storage,
                ws_manager=ws_manager,
                workspace_id=drive_id,
                workspace_name=drive_name,
                conversation_id=conversation_id,
                owner_id=user_id,
                anthropic_api_key=api_key,
            )

            logger.info("Running agent for conversation=%s", conversation_id)
            response_text = await agent.run(anthropic_messages, attachments=attachments)
            logger.info("Agent completed, saving response")

            await chat_service.add_message(
                db, conversation_id, "assistant", response_text
            )
            await db.commit()

    except asyncio.CancelledError:
        logger.info("Agent cancelled for conversation=%s", conversation_id)
        # Notify frontend that agent was stopped
        await ws_manager.send_to_workspace(
            drive_id,
            {
                "type": "agent.stream_end",
                "payload": {
                    "conversation_id": str(conversation_id),
                    "content": "(Stopped)",
                    "stopped": True,
                },
            },
        )
    except Exception as e:
        logger.error("Agent error: %s\n%s", e, traceback.format_exc())
        await ws_manager.send_to_workspace(
            drive_id,
            {
                "type": "error",
                "payload": {
                    "message": f"Agent error: {str(e)}",
                },
            },
        )
    finally:
        _agent_tasks.pop(conv_key, None)


@app.websocket("/api/v1/ws/drive")
async def websocket_endpoint(websocket: WebSocket):
    # Authenticate via query param
    token = websocket.query_params.get("token")
    if not token:
        await websocket.close(code=4001, reason="Missing token")
        return

    try:
        payload = pyjwt.decode(
            token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm]
        )
        user_id = uuid.UUID(payload["sub"])
    except Exception:
        await websocket.close(code=4001, reason="Invalid token")
        return

    # Get user and their drive
    async with async_session() as db:
        user = await db.execute(select(User).where(User.id == user_id))
        user_obj = user.scalar_one_or_none()
        if user_obj is None:
            await websocket.close(code=4001, reason="User not found")
            return

        drive = await file_service.get_user_drive(db, user_id)
        drive_id = drive.id
        drive_name = drive.name
        user_display_name = user_obj.display_name

    await ws_manager.connect(websocket, drive_id, user_id)
    logger.info("WebSocket connected: user=%s drive=%s", user_id, drive_id)

    try:
        while True:
            raw = await websocket.receive_text()
            data = json.loads(raw)
            event_type = data.get("type")

            # Heartbeat — respond immediately, don't log
            if event_type == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))
                continue

            logger.info("WebSocket event: %s", event_type)

            if event_type == "chat.message":
                payload = data.get("payload", {})
                conversation_id = uuid.UUID(payload["conversation_id"])
                content = payload["content"]

                async with async_session() as db:
                    message = await chat_service.add_message(
                        db, conversation_id, "user", content, sender_id=user_id
                    )
                    await db.commit()

                    await ws_manager.broadcast_to_workspace(
                        drive_id,
                        {
                            "type": "chat.message",
                            "payload": {
                                "id": str(message.id),
                                "conversation_id": str(conversation_id),
                                "sender_type": "user",
                                "sender_id": str(user_id),
                                "sender_name": user_display_name,
                                "content": content,
                                "created_at": message.created_at.isoformat(),
                            },
                        },
                        exclude=websocket,
                    )

            elif event_type == "agent.invoke":
                payload = data.get("payload", {})
                conversation_id = uuid.UUID(payload["conversation_id"])
                user_message = payload["message"]
                attachments = payload.get("attachments")  # optional image/file attachments

                async with async_session() as db:
                    await chat_service.add_message(
                        db, conversation_id, "user", user_message, sender_id=user_id
                    )
                    await db.commit()

                # Broadcast user message to OTHER connections (sender already has it)
                await ws_manager.broadcast_to_workspace(
                    drive_id,
                    {
                        "type": "chat.message",
                        "payload": {
                            "conversation_id": str(conversation_id),
                            "sender_type": "user",
                            "sender_id": str(user_id),
                            "sender_name": user_display_name,
                            "content": user_message,
                        },
                    },
                    exclude=websocket,
                )

                # Check user has API key
                async with async_session() as db:
                    user_result = await db.execute(
                        select(User).where(User.id == user_id)
                    )
                    fresh_user = user_result.scalar_one()

                if not fresh_user.anthropic_api_key:
                    await ws_manager.send_to_workspace(
                        drive_id,
                        {
                            "type": "error",
                            "payload": {
                                "message": "Please add your Anthropic API key in Settings before using the AI chat.",
                            },
                        },
                    )
                    continue

                # Build messages
                async with async_session() as db:
                    messages = await chat_service.get_conversation_messages(
                        db, conversation_id
                    )
                    anthropic_messages = []
                    for msg in messages:
                        role = "user" if msg.sender_type == "user" else "assistant"
                        anthropic_messages.append(
                            {"role": role, "content": msg.content}
                        )

                # Cancel any existing agent task for this conversation
                conv_key = str(conversation_id)
                existing = _agent_tasks.get(conv_key)
                if existing and not existing.done():
                    existing.cancel()
                    await asyncio.sleep(0.1)

                # Run agent as background task so WS loop stays responsive
                task = asyncio.create_task(
                    _run_agent(
                        drive_id=drive_id,
                        drive_name=drive_name,
                        conversation_id=conversation_id,
                        user_id=user_id,
                        api_key=fresh_user.anthropic_api_key,
                        anthropic_messages=anthropic_messages,
                        attachments=attachments,
                    )
                )
                _agent_tasks[conv_key] = task

            elif event_type == "agent.stop":
                payload = data.get("payload", {})
                conversation_id = payload.get("conversation_id", "")
                conv_key = str(conversation_id)
                task = _agent_tasks.get(conv_key)
                if task and not task.done():
                    logger.info("Stopping agent for conversation=%s", conversation_id)
                    task.cancel()

            elif event_type == "chat.typing":
                payload = data.get("payload", {})
                await ws_manager.broadcast_to_workspace(
                    drive_id,
                    {
                        "type": "chat.typing",
                        "payload": {
                            "user_id": str(user_id),
                            "display_name": user_display_name,
                            "is_typing": payload.get("is_typing", False),
                        },
                    },
                    exclude=websocket,
                )

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected: user=%s", user_id)
        ws_manager.disconnect(websocket)
    except Exception:
        logger.error("WebSocket error for user=%s:\n%s", user_id, traceback.format_exc())
        ws_manager.disconnect(websocket)
