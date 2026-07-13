import json

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, status
from sqlalchemy.orm import Session

from app.api.deps import verify_token_websocket
from app.db import models
from app.db.session import get_db
from app.websocket import manager

router = APIRouter(tags=["ws"])


@router.websocket("/ws/itineraries/{itinerary_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    itinerary_id: int,
    token: str,
    db: Session = Depends(get_db),
):
    # Accept the connection immediately to avoid race conditions with quick disconnects
    await websocket.accept()

    # Authenticate the user from the query-string token.
    user = verify_token_websocket(token, db)
    if not user:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    # Only members of the itinerary may join the room.
    itinerary = db.query(models.Itinerary).filter(models.Itinerary.id == itinerary_id).first()
    if not itinerary or user not in itinerary.members:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    user_info = {
        "id": user.id,
        "display_name": user.display_name,
        "email": user.email,
        "avatar_url": user.avatar_url,
    }

    await manager.connect(websocket, itinerary_id, user_info)

    try:
        while True:
            data = await websocket.receive_text()
            try:
                msg = json.loads(data)
                # Relay live cursor / typing indicators to the rest of the room.
                if msg.get("type") in ["typing", "cursor"]:
                    msg["user_id"] = user.id
                    msg["display_name"] = user.display_name
                    await manager.broadcast_to_room(itinerary_id, msg)
            except Exception:
                pass
    except WebSocketDisconnect:
        await manager.disconnect(websocket, itinerary_id)
