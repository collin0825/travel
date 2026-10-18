"""Optional trip assistance; existing itinerary fields remain unchanged."""

from datetime import date, datetime, time
from typing import Literal
from urllib.parse import urlsplit
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class Place(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    name: str = Field(min_length=1, max_length=255)
    address: str = Field(default="", max_length=1000)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    place_id: str | None = Field(default=None, max_length=255)

    @model_validator(mode="after")
    def coordinates_pair(self):
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("Latitude and longitude must be supplied together")
        return self


def valid_zone(value):
    if value is not None:
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError):
            raise ValueError("Unknown timezone") from None
    return value


def valid_time(value):
    if value:
        time.fromisoformat(value)
        if len(value) != 5:
            raise ValueError("Use HH:MM")
    return value or None


class Flight(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    id: str = Field(min_length=1, max_length=80)
    label: str = Field(min_length=1, max_length=255)
    kind: Literal["arrival", "departure", "connection"] = "arrival"
    origin: Place | None = None
    destination: Place | None = None
    departure_date: date | None = None
    arrival_date: date | None = None
    departure_at: datetime | None = None
    arrival_at: datetime | None = None
    departure_timezone: str = "UTC"
    arrival_timezone: str = "UTC"
    airport_buffer_minutes: int = Field(default=120, ge=0, le=480)

    _zones = field_validator("departure_timezone", "arrival_timezone")(valid_zone)

    @model_validator(mode="after")
    def chronological(self):
        if self.departure_at and self.arrival_at:
            dep = self.departure_at
            arr = self.arrival_at
            dep = dep.replace(tzinfo=ZoneInfo(self.departure_timezone)) if dep.tzinfo is None else dep
            arr = arr.replace(tzinfo=ZoneInfo(self.arrival_timezone)) if arr.tzinfo is None else arr
            if arr < dep:
                raise ValueError("Arrival cannot precede departure")
        return self


class Stay(BaseModel):
    id: str = Field(min_length=1, max_length=80)
    location: Place
    first_night: int = Field(ge=0, le=365)
    last_night: int = Field(ge=0, le=365)

    @model_validator(mode="after")
    def ordered_range(self):
        if self.last_night < self.first_night:
            raise ValueError("Invalid night range")
        return self


class DaySettings(BaseModel):
    start: Place | None = None
    end: Place | None = None
    start_time: str | None = None
    _time = field_validator("start_time")(valid_time)


class ItemAssistance(BaseModel):
    duration_minutes: int = Field(default=60, ge=0, le=1440)
    progress: Literal["planned", "done", "skipped"] = "planned"
    locked: bool = False
    appointment_time: str | None = None
    ticket_status: Literal["unknown", "none", "required", "reserved", "purchased"] = "unknown"
    ticket_url: str = Field(default="", max_length=2000)
    ticket_deadline: datetime | None = None
    reservation_status: Literal["none", "todo", "booked", "walk_in", "unavailable"] = "none"
    reservation_url: str = Field(default="", max_length=2000)
    reservation_phone: str = Field(default="", max_length=80)
    party_size: int | None = Field(default=None, ge=1, le=100)
    booking_notes: str = Field(default="", max_length=3000)
    _time = field_validator("appointment_time")(valid_time)

    @field_validator("ticket_url", "reservation_url")
    @classmethod
    def safe_link(cls, value):
        if value and (urlsplit(value).scheme not in {"https", "http"} or not urlsplit(value).netloc):
            raise ValueError("Use an http(s) URL")
        return value

    @field_validator("ticket_deadline")
    @classmethod
    def aware_deadline(cls, value):
        if value and value.tzinfo is None:
            raise ValueError("Ticket deadline must include a timezone offset")
        return value


class PlanningData(BaseModel):
    timezone: str | None = None
    flights: list[Flight] = Field(default_factory=list, max_length=40)
    stays: list[Stay] = Field(default_factory=list, max_length=366)
    days: dict[str, DaySettings] = Field(default_factory=dict, max_length=366)
    items: dict[str, ItemAssistance] = Field(default_factory=dict, max_length=2000)
    _zone = field_validator("timezone")(valid_zone)

    @model_validator(mode="after")
    def unique_ranges(self):
        for collection in (self.flights, self.stays):
            if len({x.id for x in collection}) != len(collection):
                raise ValueError("Duplicate entry IDs")
        nights = set()
        for stay in self.stays:
            occupied = set(range(stay.first_night, stay.last_night + 1))
            if occupied & nights:
                raise ValueError("A night cannot have two accommodations")
            nights |= occupied
        if any(not k.isdigit() or not 1 <= int(k) <= 366 for k in self.days):
            raise ValueError("Invalid day number")
        if any(not k.isdigit() or int(k) <= 0 for k in self.items):
            raise ValueError("Invalid item ID")
        return self


class PlanningUpdate(BaseModel):
    revision: int = Field(ge=0)
    data: PlanningData


class RouteRequest(BaseModel):
    day_number: int = Field(ge=1, le=366)
    optimize: bool = False
    road_routing: bool = True
    mode: Literal["transit", "walk", "drive"] = "transit"
    preference: Literal["fewer_transfers", "less_walking"] = "fewer_transfers"
    current_location: Place | None = None
    use_current_time: bool = False
    client_timezone: str = "UTC"
    _zone = field_validator("client_timezone")(valid_zone)


class ApplyRoute(BaseModel):
    day_number: int = Field(ge=1, le=366)
    signature: str = Field(min_length=64, max_length=64)
    item_ids: list[int] = Field(max_length=30)


class PlaceSearch(BaseModel):
    query: str = Field(min_length=1, max_length=200)
    center: Place | None = None
    next_stop: Place | None = None
    restaurants_only: bool = False
    rank_by: Literal["nearest", "on_route"] = "on_route"
    mode: Literal["transit", "walk", "drive"] = "transit"
