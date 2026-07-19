from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import schemas
from app.api.deps import get_current_user, get_user_by_email
from app.core.security import create_access_token, get_password_hash, verify_password
from app.db import models
from app.db.session import get_db

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=schemas.UserResponse)
def register(user_in: schemas.UserCreate, db: Session = Depends(get_db)):
    if get_user_by_email(db, email=user_in.email):
        raise HTTPException(status_code=400, detail="Email already registered")

    new_user = models.User(
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        display_name=user_in.display_name,
        avatar_url=user_in.avatar_url
        or f"https://api.dicebear.com/7.x/adventurer/svg?seed={user_in.display_name}",
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@router.post("/login", response_model=schemas.Token)
def login(user_in: schemas.UserCreate, db: Session = Depends(get_db)):
    # user_in reuses UserCreate for convenience; only email + password are checked.
    db_user = get_user_by_email(db, email=user_in.email)
    if not db_user or not verify_password(user_in.password, db_user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")

    access_token = create_access_token(data={"sub": str(db_user.id)})
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/reset-password")
def reset_password(payload: schemas.PasswordResetRequest, db: Session = Depends(get_db)):
    """No-email password reset: verifies the account's display name instead.

    A single generic error avoids revealing whether the email exists.
    """
    db_user = get_user_by_email(db, email=payload.email)
    if not db_user or db_user.display_name != payload.display_name:
        raise HTTPException(status_code=400, detail="Email or display name is incorrect")
    if len(payload.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    db_user.hashed_password = get_password_hash(payload.new_password)
    db.commit()
    return {"status": "success"}


@router.post("/change-password")
def change_password(
    payload: schemas.ChangePasswordRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(payload.old_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect current password")
    if len(payload.new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    current_user.hashed_password = get_password_hash(payload.new_password)
    db.commit()
    return {"status": "success"}


@router.get("/me", response_model=schemas.UserResponse)
def get_me(current_user: models.User = Depends(get_current_user)):
    return current_user
