"""Authenticated optional planning, preview and explicit apply operations."""
from collections import defaultdict, deque
import math
from datetime import datetime, timezone
from threading import Lock
from time import monotonic

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.api.permissions import require_editor, require_member
from app.db import models
from app.db.session import get_db
from app.schemas.planning import ApplyRoute, ItemAssistance, PlaceSearch, PlanningData, PlanningUpdate, RouteRequest, valid_zone
from app.services import places
from app.services.planning import assistance, appointment, day_context, preview, signature
from app.websocket import manager

router = APIRouter(prefix="/api/itineraries", tags=["planning"])
_requests = defaultdict(deque)
_rate_lock = Lock()


def rate_limit(user_id, operation, maximum):
    now = monotonic()
    with _rate_lock:
        key = (user_id, operation)
        queue = _requests[key]
        while queue and now - queue[0] > 60:
            queue.popleft()
        if len(queue) >= maximum:
            raise HTTPException(429, "查詢次數較多，請稍候一分鐘再試。")
        queue.append(now)
        if len(_requests) > 2048:
            for old in list(_requests):
                if not _requests[old] or now - _requests[old][-1] > 60:
                    del _requests[old]


def read_planning(db, itinerary_id):
    try:
        row = db.get(models.ItineraryPlanning, itinerary_id)
    except SQLAlchemyError:
        db.rollback()
        raise HTTPException(503, "旅程輔助資料暫時無法讀取，請稍後再試。") from None
    data = PlanningData.model_validate(row.data if row else {})
    # Deleted attractions must not leave obsolete IDs that prevent later edits.
    existing = {str(i.id) for i in db.query(models.ItineraryItem.id).filter_by(itinerary_id=itinerary_id)}
    data.items = {key: value for key, value in data.items.items() if key in existing}
    return row, data


def client_zone(client_timezone: str = "UTC"):
    try:
        return valid_zone(client_timezone)
    except ValueError:
        raise HTTPException(422, "不支援的時區。") from None


def result(row, data, trip, client_timezone):
    count = min(366, max(1, (trip.end_date - trip.start_date).days + 1)) if trip.start_date and trip.end_date else 1
    anchors = {}
    for day in range(1, count + 1):
        context = day_context(trip, data, RouteRequest(day_number=day, client_timezone=client_timezone))
        anchors[str(day)] = {"start": context["start"], "end": context["end"]}
    return {"revision": row.revision if row else 0, "data": data.model_dump(mode="json"),
            "live_maps": places.enabled(), "live_routes": places.routes_enabled(), "day_anchors": anchors}


def day_items(db, itinerary_id, day_number):
    return db.query(models.ItineraryItem).filter_by(itinerary_id=itinerary_id, day_number=day_number).order_by(
        models.ItineraryItem.sort_order, models.ItineraryItem.id).all()


@router.get("/{itinerary_id}/planning")
def get_planning(itinerary_id: int, user=Depends(get_current_user), db: Session = Depends(get_db), client_timezone=Depends(client_zone)):
    trip = require_member(db, itinerary_id, user)
    row, data = read_planning(db, itinerary_id)
    return result(row, data, trip, client_timezone)


@router.put("/{itinerary_id}/planning")
async def save_planning(itinerary_id: int, payload: PlanningUpdate, user=Depends(get_current_user), db: Session = Depends(get_db), client_timezone=Depends(client_zone)):
    trip = require_editor(db, itinerary_id, user)
    db.query(models.Itinerary).filter_by(id=itinerary_id).with_for_update().one()
    row, _ = read_planning(db, itinerary_id)
    if payload.revision != (row.revision if row else 0):
        raise HTTPException(409, "其他成員已更新輔助資料，請重新載入後再儲存。")
    ids = {str(i.id) for i in db.query(models.ItineraryItem).filter_by(itinerary_id=itinerary_id)}
    if set(payload.data.items) - ids:
        raise HTTPException(422, "部分景點已被移除，請重新載入後再儲存。")
    if row is None:
        row = models.ItineraryPlanning(itinerary_id=itinerary_id, revision=0)
        db.add(row)
    row.data = payload.data.model_dump(mode="json")
    row.revision += 1
    db.commit()
    await manager.broadcast_to_room(itinerary_id, {"type": "refresh_planning"})
    return result(row, payload.data, trip, client_timezone)


@router.post("/{itinerary_id}/route-preview")
def route_preview(itinerary_id: int, payload: RouteRequest, user=Depends(get_current_user), db: Session = Depends(get_db)):
    trip = require_member(db, itinerary_id, user)
    rate_limit(user.id, "route", 6)
    row, data = read_planning(db, itinerary_id)
    items = day_items(db, itinerary_id, payload.day_number)
    try:
        return preview(trip, items, data, row.revision if row else 0, payload)
    except ValueError as error:
        raise HTTPException(422, str(error)) from None


@router.post("/{itinerary_id}/route-apply")
async def apply_route(itinerary_id: int, payload: ApplyRoute, user=Depends(get_current_user), db: Session = Depends(get_db)):
    require_editor(db, itinerary_id, user)
    db.query(models.Itinerary).filter_by(id=itinerary_id).with_for_update().one()
    row, data = read_planning(db, itinerary_id)
    items = day_items(db, itinerary_id, payload.day_number)
    if signature(data, items, row.revision if row else 0) != payload.signature:
        raise HTTPException(409, "行程已變更，請重新產生路線建議。")
    active = [i for i in items if assistance(data, i).progress == "planned"]
    if len(payload.item_ids) != len(set(payload.item_ids)) or set(payload.item_ids) != {i.id for i in active}:
        raise HTTPException(422, "路線景點不完整，請重新計算。")
    for pos, item in enumerate(active):
        extra = assistance(data, item)
        if (extra.locked or appointment(item, extra)) and payload.item_ids[pos] != item.id:
            raise HTTPException(422, "固定預約的位置不能變更。")
    next_id = iter(payload.item_ids)
    positions = {i.id: i for i in items}
    for index, item in enumerate(items):
        target = positions[next(next_id)] if assistance(data, item).progress == "planned" else item
        target.sort_order = index
    db.commit()
    await manager.broadcast_to_room(itinerary_id, {"type": "refresh_itinerary"})
    return {"status": "success"}


@router.post("/{itinerary_id}/places-search")
def search_places(itinerary_id: int, payload: PlaceSearch, user=Depends(get_current_user), db: Session = Depends(get_db)):
    require_member(db, itinerary_id, user)
    rate_limit(user.id, "places", 10)
    center = payload.center.model_dump() if payload.center else None
    after = payload.next_stop.model_dump() if payload.next_stop else None
    try:
        if places.enabled():
            rows = places.search_google(payload.query, center, payload.restaurants_only)
        elif payload.restaurants_only:
            rows = places.search_osm_restaurants(payload.query, center)
        else:
            rows = places.search_osm_places(payload.query)
    except places.ProviderUnavailable as error:
        raise HTTPException(503, str(error)) from None
    for place in rows:
        place["distance_meters"] = places.distance(center, place) if center else None
        onward = places.distance(place, after) if after else None
        direct = places.distance(center, after) if center and after else None
        place["detour_meters"] = max(0, place["distance_meters"] + onward - direct) if None not in (place["distance_meters"], onward, direct) else None
        place["ranking_basis"] = "straight_line"
    sort_key = "distance_meters" if payload.rank_by == "nearest" or after is None else "detour_meters"
    rows.sort(key=lambda p: p.get(sort_key) if p.get(sort_key) is not None else float("inf"))
    rows = [p for p in rows if p.get("business_status") not in {"CLOSED_PERMANENTLY", "CLOSED_TEMPORARILY"}][:8]
    ranking_notice = "依直線距離比較。"
    if payload.restaurants_only and center and rows:
        points = [center, *rows, *([after] if after else [])]
        try:
            if places.routes_enabled():
                costs = places.matrix(points, payload.mode)
            elif payload.mode in {"walk", "drive"} and all(places.coordinates(p) for p in points):
                costs = places.road_matrix(points, payload.mode)
            else:
                costs = None
            if costs:
                for index, place in enumerate(rows, 1):
                    seconds = costs[0][index]
                    place["travel_seconds"] = seconds if math.isfinite(seconds) else None
                    delta = seconds + costs[index][-1] - costs[0][-1] if after else None
                    place["detour_seconds"] = max(0, delta) if delta is not None and math.isfinite(delta) else None
                    place["ranking_basis"] = "travel_time"
                key = "travel_seconds" if payload.rank_by == "nearest" or after is None else "detour_seconds"
                rows.sort(key=lambda p: p[key] if p[key] is not None else math.inf)
                ranking_notice = "候選店家依交通時間估算比較，不含即時路況。"
        except places.ProviderUnavailable:
            ranking_notice = "交通時間暫無法比較，改依直線距離排序。"
    # Restaurant candidates are geographic suggestions, not claims of availability.
    return {"places": rows[:8], "checked_at": datetime.now(timezone.utc).isoformat(),
            "source": "Google Maps" if places.enabled() else "OpenStreetMap",
            "notice": ranking_notice + "營業與訂位方式請以店家官網確認，不代表指定時段有空位。" if payload.restaurants_only else "請確認選取的是正確分店或入口。"}
