import datetime

from sqlalchemy import Column, Integer, String, Float, Date, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship

from app.db.base import Base
from app.db.models.user import itinerary_members


class Itinerary(Base):
    __tablename__ = "itineraries"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)
    invite_code = Column(String(100), unique=True, index=True, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    creator = relationship("User", back_populates="created_itineraries")
    members = relationship("User", secondary=itinerary_members, back_populates="itineraries")
    items = relationship("ItineraryItem", back_populates="itinerary", cascade="all, delete-orphan")
    expenses = relationship("Expense", back_populates="itinerary", cascade="all, delete-orphan")
    notes = relationship("Note", back_populates="itinerary", cascade="all, delete-orphan")


class ItineraryItem(Base):
    __tablename__ = "itinerary_items"

    id = Column(Integer, primary_key=True, index=True)
    itinerary_id = Column(Integer, ForeignKey("itineraries.id", ondelete="CASCADE"), nullable=False)
    day_number = Column(Integer, nullable=False)  # e.g. 1, 2, 3...
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    address = Column(String(500), nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    time = Column(String(10), nullable=True)  # "HH:MM"
    transport_mode = Column(String(20), nullable=True)  # walk/transit/bus/train/car/taxi/bike/flight/other
    transport_note = Column(String(255), nullable=True)  # e.g. "約20分鐘" / "搭 JR 山手線"
    cost = Column(Float, default=0.0)
    sort_order = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    itinerary = relationship("Itinerary", back_populates="items")
