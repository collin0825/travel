from datetime import datetime
from typing import List

from pydantic import BaseModel

from app.schemas.user import UserResponse


class ExpenseCreate(BaseModel):
    description: str
    amount: float
    paid_by: int
    split_user_ids: List[int]  # IDs of users sharing the expense


class ExpenseUpdate(ExpenseCreate):
    pass


class ExpenseResponse(BaseModel):
    id: int
    itinerary_id: int
    description: str
    amount: float
    paid_by: int
    split_user_ids: List[int]
    created_at: datetime

    class Config:
        from_attributes = True


# Debt / Splitwise settlement result (computed, not persisted).
class DebtCalculation(BaseModel):
    from_user: UserResponse
    to_user: UserResponse
    amount: float
