import asyncio
import json
import os
from collections import defaultdict

import boto3
from fastapi import WebSocket

from core.redis_client import redis_client

CONN_TTL_SECONDS = 60 * 60 * 2  # 2 hours


def _ws_endpoint_url() -> str | None:
    api_id = os.getenv("WS_API_ID")

    if not api_id:
        return None

    region = os.getenv("AWS_REGION", "ap-south-1")
    stage = os.getenv("WS_API_STAGE", "prod")
    return f"https://{api_id}.execute-api.{region}.amazonaws.com/{stage}"


class ConnectionManager:
    """
    Dual-mode WebSocket connection registry.

    Local dev (uvicorn running main:app directly): the native
    FastAPI @app.websocket route in main.py works normally, and this
    class holds live WebSocket objects in memory exactly like before.

    Production (Lambda + API Gateway WebSocket API): Lambda has no
    persistent memory across invocations, so a live WebSocket object
    can't be held here the way it can locally. Instead, a separate
    Lambda (ws_lambda_handler.py) handles the $connect/$disconnect
    events and writes/deletes a client_id -> connectionId mapping in
    Redis. send() then pushes data via the API Gateway Management
    API (post_to_connection) instead of writing directly to a socket.
    """

    def __init__(self):
        self.connections: dict[str, set[WebSocket]] = defaultdict(set)
        self.loop: asyncio.AbstractEventLoop | None = None

    def set_loop(self, loop: asyncio.AbstractEventLoop) -> None:
        self.loop = loop

    # ---- local dev: native FastAPI websocket route ----

    async def connect(self, client_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self.connections[client_id].add(websocket)

    def disconnect(self, client_id: str, websocket: WebSocket) -> None:
        if client_id in self.connections:
            self.connections[client_id].discard(websocket)
            if not self.connections[client_id]:
                del self.connections[client_id]

    # ---- production: API Gateway WebSocket API + Lambda ----

    def _client_key(self, client_id: str) -> str:
        return f"ws:conn:{client_id}"

    def register(self, client_id: str, connection_id: str) -> None:
        redis_client.set(self._client_key(client_id), connection_id, ex=CONN_TTL_SECONDS)
        redis_client.set(f"ws:client:{connection_id}", client_id, ex=CONN_TTL_SECONDS)

    def unregister_by_connection(self, connection_id: str) -> None:
        client_id = redis_client.get(f"ws:client:{connection_id}")
        if client_id:
            redis_client.delete(self._client_key(client_id))
        redis_client.delete(f"ws:client:{connection_id}")

    # ---- send: transparently supports both modes above ----

    async def send(self, client_id: str, payload: dict) -> None:
        if client_id in self.connections:
            dead = []
            for websocket in self.connections[client_id]:
                try:
                    await websocket.send_json(payload)
                except Exception:
                    dead.append(websocket)
            for websocket in dead:
                self.disconnect(client_id, websocket)
            return

        endpoint = _ws_endpoint_url()
        if not endpoint:
            return

        connection_id = redis_client.get(self._client_key(client_id))
        if not connection_id:
            return

        client = boto3.client("apigatewaymanagementapi", endpoint_url=endpoint)
        try:
            client.post_to_connection(
                ConnectionId=connection_id,
                Data=json.dumps(payload).encode("utf-8"),
            )
        except client.exceptions.GoneException:
            redis_client.delete(self._client_key(client_id))
        except Exception:
            pass


manager = ConnectionManager()