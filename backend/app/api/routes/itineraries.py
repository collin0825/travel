import random
import string
from typing import Dict, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import schemas
from app.api.deps import get_current_user
from app.db import models
from app.db.session import get_db
from app.websocket import manager

router = APIRouter(prefix="/api/itineraries", tags=["itineraries"])


def generate_invite_code(length: int = 6) -> str:
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=length))


@router.post("", response_model=schemas.ItineraryResponse)
def create_itinerary(
    itinerary_in: schemas.ItineraryCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    invite_code = generate_invite_code()
    while db.query(models.Itinerary).filter(models.Itinerary.invite_code == invite_code).first():
        invite_code = generate_invite_code()

    new_itinerary = models.Itinerary(
        title=itinerary_in.title,
        description=itinerary_in.description,
        start_date=itinerary_in.start_date,
        end_date=itinerary_in.end_date,
        invite_code=invite_code,
        created_by=current_user.id,
    )
    db.add(new_itinerary)
    db.commit()
    db.refresh(new_itinerary)

    # Add the creator as the first member.
    new_itinerary.members.append(current_user)
    db.commit()
    db.refresh(new_itinerary)
    return new_itinerary


@router.get("", response_model=List[schemas.ItineraryResponse])
def get_my_itineraries(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return current_user.itineraries


@router.post("/join", response_model=schemas.ItineraryResponse)
def join_itinerary(
    payload: Dict[str, str],
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    invite_code = payload.get("invite_code")
    if not invite_code:
        raise HTTPException(status_code=400, detail="Invite code is required")

    itinerary = (
        db.query(models.Itinerary)
        .filter(models.Itinerary.invite_code == invite_code.upper())
        .first()
    )
    if not itinerary:
        raise HTTPException(status_code=404, detail="Itinerary not found with this code")

    if current_user in itinerary.members:
        return itinerary

    itinerary.members.append(current_user)
    db.commit()
    db.refresh(itinerary)
    return itinerary


@router.post("/{itinerary_id}/leave")
async def leave_itinerary(
    itinerary_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Removes the current user from the trip's member list without deleting it.

    Their past expenses stay for the remaining members' records; the settlement
    calculation only balances current members. The trip itself is only deleted
    when the last member leaves.
    """
    itinerary = db.query(models.Itinerary).filter(models.Itinerary.id == itinerary_id).first()
    if not itinerary or current_user not in itinerary.members:
        raise HTTPException(status_code=403, detail="Unauthorized")

    itinerary.members.remove(current_user)
    deleted = not itinerary.members
    if deleted:
        db.delete(itinerary)
    db.commit()

    if not deleted:
        await manager.broadcast_to_room(itinerary_id, {"type": "refresh_itinerary"})
    return {"status": "success"}


@router.get("/{itinerary_id}")
def get_itinerary_detail(
    itinerary_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    itinerary = db.query(models.Itinerary).filter(models.Itinerary.id == itinerary_id).first()
    if not itinerary:
        raise HTTPException(status_code=404, detail="Itinerary not found")

    if current_user not in itinerary.members:
        raise HTTPException(status_code=403, detail="You do not have access to this itinerary")

    # Build the full detail payload with ordered items, expenses and notes.
    items = (
        db.query(models.ItineraryItem)
        .filter(models.ItineraryItem.itinerary_id == itinerary_id)
        .order_by(models.ItineraryItem.day_number, models.ItineraryItem.sort_order)
        .all()
    )

    expenses = (
        db.query(models.Expense)
        .filter(models.Expense.itinerary_id == itinerary_id)
        .order_by(models.Expense.created_at.desc())
        .all()
    )
    expenses_payload = [
        {
            "id": exp.id,
            "itinerary_id": exp.itinerary_id,
            "description": exp.description,
            "amount": exp.amount,
            "paid_by": exp.paid_by,
            "split_user_ids": [u.id for u in exp.splits],
            "created_at": exp.created_at,
        }
        for exp in expenses
    ]

    notes = (
        db.query(models.Note)
        .filter(models.Note.itinerary_id == itinerary_id)
        .order_by(models.Note.updated_at.desc())
        .all()
    )

    return {
        "id": itinerary.id,
        "title": itinerary.title,
        "description": itinerary.description,
        "start_date": itinerary.start_date,
        "end_date": itinerary.end_date,
        "invite_code": itinerary.invite_code,
        "created_by": itinerary.created_by,
        "members": [schemas.UserResponse.model_validate(m) for m in itinerary.members],
        "items": [schemas.ItineraryItemResponse.model_validate(item) for item in items],
        "expenses": expenses_payload,
        "notes": [schemas.NoteResponse.model_validate(note) for note in notes],
    }


@router.put("/{itinerary_id}", response_model=schemas.ItineraryResponse)
async def update_itinerary(
    itinerary_id: int,
    itinerary_in: schemas.ItineraryUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    itinerary = db.query(models.Itinerary).filter(models.Itinerary.id == itinerary_id).first()
    if not itinerary or current_user not in itinerary.members:
        raise HTTPException(status_code=403, detail="Unauthorized")

    itinerary.title = itinerary_in.title
    itinerary.description = itinerary_in.description
    itinerary.start_date = itinerary_in.start_date
    itinerary.end_date = itinerary_in.end_date

    db.commit()
    db.refresh(itinerary)

    # Let other members viewing this trip pick up the change live.
    await manager.broadcast_to_room(itinerary_id, {"type": "refresh_itinerary"})
    return itinerary


@router.delete("/{itinerary_id}")
def delete_itinerary(
    itinerary_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    itinerary = db.query(models.Itinerary).filter(models.Itinerary.id == itinerary_id).first()
    if not itinerary or current_user not in itinerary.members:
        raise HTTPException(status_code=403, detail="Unauthorized")

    # Items / expenses / notes and membership rows cascade-delete via the model
    # relationships and FK ondelete rules.
    db.delete(itinerary)
    db.commit()
    return {"status": "success"}
