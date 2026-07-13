import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import schemas
from app.api.deps import get_current_user
from app.db import models
from app.db.session import get_db
from app.websocket import manager

router = APIRouter(prefix="/api/itineraries", tags=["notes"])


def _require_membership(db: Session, itinerary_id: int, user: models.User) -> models.Itinerary:
    itinerary = db.query(models.Itinerary).filter(models.Itinerary.id == itinerary_id).first()
    if not itinerary or user not in itinerary.members:
        raise HTTPException(status_code=403, detail="Unauthorized")
    return itinerary


@router.post("/{itinerary_id}/notes", response_model=schemas.NoteResponse)
async def create_note(
    itinerary_id: int,
    note_in: schemas.NoteCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_membership(db, itinerary_id, current_user)

    new_note = models.Note(
        itinerary_id=itinerary_id,
        title=note_in.title,
        content=note_in.content,
        created_by=current_user.id,
    )
    db.add(new_note)
    db.commit()
    db.refresh(new_note)

    await manager.broadcast_to_room(itinerary_id, {"type": "refresh_notes"})
    return new_note


@router.put("/notes/{note_id}", response_model=schemas.NoteResponse)
async def update_note(
    note_id: int,
    note_in: schemas.NoteUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    note = db.query(models.Note).filter(models.Note.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    itinerary = _require_membership(db, note.itinerary_id, current_user)

    note.title = note_in.title
    note.content = note_in.content
    note.updated_at = datetime.datetime.utcnow()

    db.commit()
    db.refresh(note)

    # Broadcast so other clients update note content live.
    await manager.broadcast_to_room(
        itinerary.id,
        {
            "type": "note_content_update",
            "note_id": note.id,
            "title": note.title,
            "content": note.content,
        },
    )
    return note


@router.delete("/notes/{note_id}")
async def delete_note(
    note_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    note = db.query(models.Note).filter(models.Note.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    itinerary = _require_membership(db, note.itinerary_id, current_user)

    db.delete(note)
    db.commit()

    await manager.broadcast_to_room(itinerary.id, {"type": "refresh_notes"})
    return {"status": "success"}
