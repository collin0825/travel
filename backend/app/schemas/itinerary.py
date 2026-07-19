from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel

from app.schemas.user import UserResponse


# --- Itinerary Item Schemas ---
class ItineraryItemBase(BaseModel):
    day_number: int
    name: str
    description: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    time: Optional[str] = None  # "HH:MM"
    transport_mode: Optional[str] = None
    transport_note: Optional[str] = None
    cost: float = 0.0
    sort_order: int = 0


class ItineraryItemCreate(ItineraryItemBase):
    pass


class ItineraryItemUpdate(ItineraryItemBase):
    pass


class ItineraryItemResponse(ItineraryItemBase):
    id: int
    itinerary_id: int
    created_at: datetime

    class Config:
        from_attributes = True


class DayOrder(BaseModel):
    day_number: int
    item_ids: List[int]


class ItemsReorderRequest(BaseModel):
    days: List[DayOrder]


# --- Member Schemas ---
class MemberResponse(UserResponse):
    role: str  # 'owner' | 'editor' | 'viewer'
    is_owner: bool = False


class MemberRoleUpdate(BaseModel):
    role: str  # 'editor' | 'viewer'


# --- Itinerary Schemas ---
class ItineraryCreate(BaseModel):
    title: str
    description: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None


class ItineraryUpdate(BaseModel):
    title: str
    description: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None


class ItineraryResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    invite_code: str
    created_by: Optional[int] = None
    created_at: datetime
    members: List[UserResponse] = []
    # Current user's role in this trip ('owner' | 'editor' | 'viewer');
    # populated by the endpoints, not the ORM.
    my_role: Optional[str] = None

    class Config:
        from_attributes = True
