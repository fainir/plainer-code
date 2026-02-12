import json
import uuid
from collections import defaultdict

from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        # workspace_id -> set of WebSocket connections
        self._connections: dict[uuid.UUID, set[WebSocket]] = defaultdict(set)
        # websocket -> (workspace_id, user_id)
        self._ws_info: dict[WebSocket, tuple[uuid.UUID, uuid.UUID]] = {}

    async def connect(
        self, ws: WebSocket, workspace_id: uuid.UUID, user_id: uuid.UUID
    ):
        await ws.accept()
        self._connections[workspace_id].add(ws)
        self._ws_info[ws] = (workspace_id, user_id)

    def disconnect(self, ws: WebSocket):
        info = self._ws_info.pop(ws, None)
        if info:
            workspace_id, _ = info
            self._connections[workspace_id].discard(ws)
            if not self._connections[workspace_id]:
                del self._connections[workspace_id]

    async def broadcast_to_workspace(
        self, workspace_id: uuid.UUID, data: dict, exclude: WebSocket | None = None
    ):
        message = json.dumps(data, default=str)
        dead = []
        for ws in self._connections.get(workspace_id, set()):
            if ws is exclude:
                continue
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)

    async def send_to_workspace(self, workspace_id: uuid.UUID, data: dict):
        """Send to all connections in a workspace including sender."""
        await self.broadcast_to_workspace(workspace_id, data)

    def get_online_users(self, workspace_id: uuid.UUID) -> set[uuid.UUID]:
        users = set()
        for ws in self._connections.get(workspace_id, set()):
            info = self._ws_info.get(ws)
            if info:
                users.add(info[1])
        return users


ws_manager = ConnectionManager()
