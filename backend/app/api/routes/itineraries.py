import random
import string
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import schemas
from app.api.deps import get_current_user
from app.api.permissions import get_role, require_editor, require_owner
from app.db import models
from app.db.models.user import itinerary_members
from app.db.session import get_db
from app.websocket import manager

router = APIRouter(prefix="/api/itineraries", tags=["itineraries"])


def generate_invite_code(length: int = 6) -> str:
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=length))


def _member_roles(db: Session, itinerary_id: int) -> Dict[int, str]:
    """Raw junction-row roles for a trip, keyed by user id."""
    rows = db.execute(
        select(itinerary_members.c.user_id, itinerary_members.c.role).where(
            itinerary_members.c.itinerary_id == itinerary_id
        )
    ).all()
    return {row.user_id: row.role for row in rows}


def _effective_role(itinerary: models.Itinerary, user_id: int, role_map: Dict[int, str]) -> Optional[str]:
    """Same rules as permissions.get_role, computed from a prefetched role map."""
    row_role = role_map.get(user_id)
    if row_role is None:
        return None
    if itinerary.created_by == user_id:
        return "owner"
    if itinerary.created_by is None and row_role == "editor":
        return "owner"
    return row_role


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
    # One query for the user's junction rows so each card knows my_role.
    rows = db.execute(
        select(itinerary_members.c.itinerary_id, itinerary_members.c.role).where(
            itinerary_members.c.user_id == current_user.id
        )
    ).all()
    my_roles = {row.itinerary_id: row.role for row in rows}

    result = []
    for itinerary in current_user.itineraries:
        payload = schemas.ItineraryResponse.model_validate(itinerary)
        payload.my_role = _effective_role(
            itinerary, current_user.id, {current_user.id: my_roles.get(itinerary.id)}
        )
        result.append(payload)
    return result


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

    # The creator leaving would orphan the trip with no one able to delete it.
    if itinerary.created_by == current_user.id and len(itinerary.members) > 1:
        raise HTTPException(
            status_code=400,
            detail="建立者無法退出仍有其他成員的行程，請改用刪除行程或先移除其他成員",
        )

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

    role_map = _member_roles(db, itinerary_id)
    my_role = _effective_role(itinerary, current_user.id, role_map)
    if my_role is None:
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

    members_payload = []
    for member in itinerary.members:
        role = _effective_role(itinerary, member.id, role_map) or "editor"
        members_payload.append(
            schemas.MemberResponse(
                **schemas.UserResponse.model_validate(member).model_dump(),
                role=role,
                is_owner=role == "owner",
            )
        )

    return {
        "id": itinerary.id,
        "title": itinerary.title,
        "description": itinerary.description,
        "start_date": itinerary.start_date,
        "end_date": itinerary.end_date,
        "invite_code": itinerary.invite_code,
        "created_by": itinerary.created_by,
        "my_role": my_role,
        "members": members_payload,
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
    itinerary = require_editor(db, itinerary_id, current_user)

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
    itinerary = require_owner(db, itinerary_id, current_user)

    # Items / expenses / notes and membership rows cascade-delete via the model
    # relationships and FK ondelete rules.
    db.delete(itinerary)
    db.commit()
    return {"status": "success"}


@router.put("/{itinerary_id}/members/{user_id}")
async def update_member_role(
    itinerary_id: int,
    user_id: int,
    payload: schemas.MemberRoleUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    itinerary = require_owner(db, itinerary_id, current_user)

    if payload.role not in ("editor", "viewer"):
        raise HTTPException(status_code=400, detail="Role must be 'editor' or 'viewer'")
    if user_id == current_user.id or user_id == itinerary.created_by:
        raise HTTPException(status_code=400, detail="Cannot change the creator's role")

    result = db.execute(
        itinerary_members.update()
        .where(
            itinerary_members.c.itinerary_id == itinerary_id,
            itinerary_members.c.user_id == user_id,
        )
        .values(role=payload.role)
    )
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Member not found")
    db.commit()

    await manager.broadcast_to_room(itinerary_id, {"type": "refresh_itinerary"})
    return {"status": "success"}


@router.delete("/{itinerary_id}/members/{user_id}")
async def remove_member(
    itinerary_id: int,
    user_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    itinerary = require_owner(db, itinerary_id, current_user)

    if user_id == current_user.id or user_id == itinerary.created_by:
        raise HTTPException(status_code=400, detail="Cannot remove the creator")

    member = next((m for m in itinerary.members if m.id == user_id), None)
    if member is None:
        raise HTTPException(status_code=404, detail="Member not found")

    itinerary.members.remove(member)
    db.commit()

    await manager.broadcast_to_room(itinerary_id, {"type": "refresh_itinerary"})
    return {"status": "success"}
