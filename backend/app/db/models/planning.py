from sqlalchemy import Column, ForeignKey, Integer, JSON
from app.db.base import Base


class ItineraryPlanning(Base):
    __tablename__ = "itinerary_planning"
    itinerary_id = Column(Integer, ForeignKey("itineraries.id", ondelete="CASCADE"), primary_key=True)
    revision = Column(Integer, nullable=False, default=0)
    data = Column(JSON, nullable=False, default=dict)
