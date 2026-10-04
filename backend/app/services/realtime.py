import asyncio
from datetime import datetime, timezone
from threading import RLock
from uuid import uuid4

from fastapi import WebSocket


class RealtimeHub:
    def __init__(self) -> None:
        self._connections: dict[int, set[WebSocket]] = {}
        self._lock = RLock()

    async def connect(self, company_id: int, websocket: WebSocket) -> None:
        await websocket.accept(subprotocol="salesia")
        with self._lock:
            self._connections.setdefault(company_id, set()).add(websocket)

    def disconnect(self, company_id: int, websocket: WebSocket) -> None:
        with self._lock:
            connections = self._connections.get(company_id)
            if connections is None:
                return
            connections.discard(websocket)
            if not connections:
                self._connections.pop(company_id, None)

    async def _send_event(self, websocket: WebSocket, event: dict[str, object]) -> WebSocket | None:
        try:
            await asyncio.wait_for(websocket.send_json(event), timeout=2)
        except Exception:
            return websocket
        return None

    async def broadcast(self, company_id: int, event: dict[str, object]) -> None:
        with self._lock:
            connections = tuple(self._connections.get(company_id, ()))

        disconnected = await asyncio.gather(*(
            self._send_event(websocket, event) for websocket in connections
        ))
        for websocket in disconnected:
            if websocket is not None:
                self.disconnect(company_id, websocket)

    async def publish_change(
        self,
        company_id: int,
        resource: str,
        operation: str,
        status_code: int,
    ) -> None:
        await self.broadcast(company_id, {
            "type": "data_changed",
            "event_id": str(uuid4()),
            "resource": resource,
            "operation": operation,
            "status_code": status_code,
            "occurred_at": datetime.now(timezone.utc).isoformat(),
        })


realtime_hub = RealtimeHub()