import datetime

from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Table
from sqlalchemy.orm import relationship

from app.db.base import Base

# Junction table: which users share (split) a given expense.
expense_splits = Table(
    "expense_splits",
    Base.metadata,
    Column("expense_id", Integer, ForeignKey("expenses.id", ondelete="CASCADE"), primary_key=True),
    Column("user_id", Integer, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
)


class Expense(Base):
    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True, index=True)
    itinerary_id = Column(Integer, ForeignKey("itineraries.id", ondelete="CASCADE"), nullable=False)
    description = Column(String(255), nullable=False)
    amount = Column(Float, nullable=False)
    paid_by = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationships
    itinerary = relationship("Itinerary", back_populates="expenses")
    payer = relationship("User", back_populates="paid_expenses")
    splits = relationship("User", secondary=expense_splits)
