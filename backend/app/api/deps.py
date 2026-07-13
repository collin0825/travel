"""FastAPI dependencies that need database access: the request-scoped session,
user lookups, and the current-user resolver used to guard endpoints."""

from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.security import decode_token
from app.db import models
from app.db.session import get_db

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login", auto_error=False)


def get_user_by_id(db: Session, user_id: int) -> Optional[models.User]:
    return db.query(models.User).filter(models.User.id == user_id).first()


def get_user_by_email(db: Session, email: str) -> Optional[models.User]:
    return db.query(models.User).filter(models.User.email == email).first()


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> models.User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_exception

    user_id = decode_token(token)
    if user_id is None:
        raise credentials_exception

    user = get_user_by_id(db, user_id=int(user_id))
    if user is None:
        raise credentials_exception
    return user


def verify_token_websocket(token: str, db: Session) -> Optional[models.User]:
    """Verify a token supplied via WebSocket query param; return the user or None."""
    user_id = decode_token(token)
    if user_id is None:
        return None
    return get_user_by_id(db, user_id=int(user_id))
