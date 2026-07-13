from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class NoteBase(BaseModel):
    title: str
    content: Optional[str] = None


class NoteCreate(NoteBase):
    pass


class NoteUpdate(NoteBase):
    pass


class NoteResponse(NoteBase):
    id: int
    itinerary_id: int
    created_by: Optional[int] = None
    updated_at: datetime

    class Config:
        from_attributes = True
