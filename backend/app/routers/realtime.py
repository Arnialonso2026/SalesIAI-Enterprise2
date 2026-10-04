from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect

from app.core.config import settings
from app.database import SessionLocal
from app.deps import authenticate_token
from app.services.realtime import realtime_hub

router = APIRouter(tags=["Tiempo real"])


@router.websocket("/realtime/ws")
async def realtime_events(websocket: WebSocket) -> None:
    origin = websocket.headers.get("origin")
    if origin and origin not in settings.allowed_origins:
        await websocket.close(code=4403)
        return

    token = next((
        protocol.removeprefix("bearer.")
        for protocol in websocket.scope.get("subprotocols", [])
        if protocol.startswith("bearer.")
    ), None)
    if not token:
        await websocket.close(code=4401)
        return

    try:
        with SessionLocal() as db:
            user, _ = authenticate_token(token, db)
            company_id = user.company_id
    except HTTPException:
        await websocket.close(code=4401)
        return

    await realtime_hub.connect(company_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        realtime_hub.disconnect(company_id, websocket)