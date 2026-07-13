"""Aggregates all ORM models so importing this package registers every table
on `Base.metadata` (needed by Alembic autogenerate)."""

from app.db.models.user import User, itinerary_members
from app.db.models.itinerary import Itinerary, ItineraryItem
from app.db.models.expense import Expense, expense_splits
from app.db.models.note import Note

__all__ = [
    "User",
    "Itinerary",
    "ItineraryItem",
    "Expense",
    "Note",
    "itinerary_members",
    "expense_splits",
]
