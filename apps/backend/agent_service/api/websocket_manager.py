import asyncio
from collections import defaultdict
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self.connections: dict[str, set[WebSocket]] = defaultdict(set)
        # Phase 5 fix: reuse FastAPI's running event loop instead of
        # spinning up a brand new one (asyncio.run) for every single
        # progress/token event. Set once on app startup via set_loop().
        self.loop: asyncio.AbstractEventLoop | None = None

    def set_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self.loop = loop

    async def connect(
        self,
        client_id: str,
        websocket: WebSocket,
    ) -> None:
        await websocket.accept()
        self.connections[client_id].add(websocket)

    def disconnect(
        self,
        client_id: str,
        websocket: WebSocket,
    ) -> None:
        if client_id in self.connections:
            self.connections[client_id].discard(websocket)

            if not self.connections[client_id]:
                del self.connections[client_id]

    async def send(
        self,
        client_id: str,
        payload: dict,
    ) -> None:
        if client_id not in self.connections:
            return

        dead = []

        for websocket in self.connections[client_id]:
            try:
                await websocket.send_json(payload)
            except Exception:
                dead.append(websocket)

        for websocket in dead:
            self.disconnect(client_id, websocket)


manager = ConnectionManager()