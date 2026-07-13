from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import schemas
from app.api.deps import get_current_user
from app.db import models
from app.db.session import get_db
from app.services.debts import calculate_settlements
from app.websocket import manager

router = APIRouter(prefix="/api/itineraries", tags=["expenses"])


def _require_membership(db: Session, itinerary_id: int, user: models.User) -> models.Itinerary:
    itinerary = db.query(models.Itinerary).filter(models.Itinerary.id == itinerary_id).first()
    if not itinerary or user not in itinerary.members:
        raise HTTPException(status_code=403, detail="Unauthorized")
    return itinerary


@router.post("/{itinerary_id}/expenses", response_model=schemas.ExpenseResponse)
async def create_expense(
    itinerary_id: int,
    expense_in: schemas.ExpenseCreate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _require_membership(db, itinerary_id, current_user)

    new_expense = models.Expense(
        itinerary_id=itinerary_id,
        description=expense_in.description,
        amount=expense_in.amount,
        paid_by=expense_in.paid_by,
    )
    db.add(new_expense)
    db.commit()
    db.refresh(new_expense)

    # Attach participants who share this expense.
    splits = db.query(models.User).filter(models.User.id.in_(expense_in.split_user_ids)).all()
    new_expense.splits.extend(splits)
    db.commit()
    db.refresh(new_expense)

    await manager.broadcast_to_room(itinerary_id, {"type": "refresh_expenses"})

    return {
        "id": new_expense.id,
        "itinerary_id": new_expense.itinerary_id,
        "description": new_expense.description,
        "amount": new_expense.amount,
        "paid_by": new_expense.paid_by,
        "split_user_ids": [u.id for u in new_expense.splits],
        "created_at": new_expense.created_at,
    }


@router.put("/expenses/{expense_id}", response_model=schemas.ExpenseResponse)
async def update_expense(
    expense_id: int,
    expense_in: schemas.ExpenseUpdate,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    expense = db.query(models.Expense).filter(models.Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")

    itinerary = _require_membership(db, expense.itinerary_id, current_user)

    expense.description = expense_in.description
    expense.amount = expense_in.amount
    expense.paid_by = expense_in.paid_by

    # Replace participants who share this expense.
    splits = db.query(models.User).filter(models.User.id.in_(expense_in.split_user_ids)).all()
    expense.splits = splits
    db.commit()
    db.refresh(expense)

    await manager.broadcast_to_room(itinerary.id, {"type": "refresh_expenses"})

    return {
        "id": expense.id,
        "itinerary_id": expense.itinerary_id,
        "description": expense.description,
        "amount": expense.amount,
        "paid_by": expense.paid_by,
        "split_user_ids": [u.id for u in expense.splits],
        "created_at": expense.created_at,
    }


@router.delete("/expenses/{expense_id}")
async def delete_expense(
    expense_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    expense = db.query(models.Expense).filter(models.Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")

    itinerary = _require_membership(db, expense.itinerary_id, current_user)

    db.delete(expense)
    db.commit()

    await manager.broadcast_to_room(itinerary.id, {"type": "refresh_expenses"})
    return {"status": "success"}


@router.get("/{itinerary_id}/debts", response_model=List[schemas.DebtCalculation])
def get_debts(
    itinerary_id: int,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    itinerary = _require_membership(db, itinerary_id, current_user)

    expenses = (
        db.query(models.Expense).filter(models.Expense.itinerary_id == itinerary_id).all()
    )
    return calculate_settlements(expenses, itinerary.members)
