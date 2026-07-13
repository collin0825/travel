from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr


class UserBase(BaseModel):
    email: EmailStr
    display_name: str
    avatar_url: Optional[str] = None


class UserCreate(UserBase):
    password: str


class UserResponse(UserBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class PasswordResetRequest(BaseModel):
    """No-email reset: the display name doubles as the verification answer."""

    email: EmailStr
    display_name: str
    new_password: str
