"""Role-based authorization helpers for itinerary routes.

Roles: the trip creator (itineraries.created_by) is the implicit 'owner';
other members carry 'editor' or 'viewer' on their itinerary_members row.
"""

from typing import Optional

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import models
from app.db.models.user import itinerary_members


def get_role(db: Session, itinerary: models.Itinerary, user: models.User) -> Optional[str]:
    """Returns 'owner' | 'editor' | 'viewer', or None for non-members."""
    row = db.execute(
        select(itinerary_members.c.role).where(
            itinerary_members.c.itinerary_id == itinerary.id,
            itinerary_members.c.user_id == user.id,
        )
    ).first()
    if row is None:
        return None
    if itinerary.created_by == user.id:
        return "owner"
    # Legacy fallback: if the creator account was deleted (created_by SET NULL),
    # editors act as owners so the trip stays manageable.
    if itinerary.created_by is None and row.role == "editor":
        return "owner"
    return row.role


def _get_itinerary_with_role(
    db: Session, itinerary_id: int, user: models.User
) -> tuple[models.Itinerary, Optional[str]]:
    itinerary = db.query(models.Itinerary).filter(models.Itinerary.id == itinerary_id).first()
    if not itinerary:
        raise HTTPException(status_code=403, detail="Unauthorized")
    return itinerary, get_role(db, itinerary, user)


def require_member(db: Session, itinerary_id: int, user: models.User) -> models.Itinerary:
    itinerary, role = _get_itinerary_with_role(db, itinerary_id, user)
    if role is None:
        raise HTTPException(status_code=403, detail="Unauthorized")
    return itinerary


def require_editor(db: Session, itinerary_id: int, user: models.User) -> models.Itinerary:
    itinerary, role = _get_itinerary_with_role(db, itinerary_id, user)
    if role not in ("owner", "editor"):
        raise HTTPException(status_code=403, detail="Viewer role cannot modify this itinerary")
    return itinerary


def require_owner(db: Session, itinerary_id: int, user: models.User) -> models.Itinerary:
    itinerary, role = _get_itinerary_with_role(db, itinerary_id, user)
    if role != "owner":
        raise HTTPException(status_code=403, detail="Only the trip creator can do this")
    return itinerary
