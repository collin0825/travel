import datetime

from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Table
from sqlalchemy.orm import relationship

from app.db.base import Base

# Junction table: which users belong to which itineraries, and with what role.
# The trip creator (itineraries.created_by) is the implicit owner regardless of
# this row's role.
itinerary_members = Table(
    "itinerary_members",
    Base.metadata,
    Column("itinerary_id", Integer, ForeignKey("itineraries.id", ondelete="CASCADE"), primary_key=True),
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("role", String(20), nullable=False, server_default="editor"),  # 'editor' | 'viewer'
)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    display_name = Column(String(255), nullable=False)
    avatar_url = Column(String(500), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    created_itineraries = relationship("Itinerary", back_populates="creator")
    itineraries = relationship("Itinerary", secondary=itinerary_members, back_populates="members")
    paid_expenses = relationship("Expense", back_populates="payer")
    notes = relationship("Note", back_populates="creator")
