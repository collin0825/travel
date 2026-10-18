"""Location-first planning with explicit, optional time estimates."""
import hashlib
import json
import math
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from app.schemas.planning import ItemAssistance, PlanningData
from app.services import places


def item_place(item):
    return {"name": item.name, "address": item.address or "", "latitude": item.latitude, "longitude": item.longitude}


def assistance(data, item):
    return data.items.get(str(item.id), ItemAssistance())


def signature(data, items, revision):
    value = {"revision": revision, "data": data.model_dump(mode="json"), "items": [
        {"id": i.id, "day": i.day_number, "order": i.sort_order, "time": i.time, **item_place(i)} for i in items]}
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


def day_date(trip, day):
    return trip.start_date + timedelta(days=day - 1) if trip.start_date else None


def local_datetime(value, zone):
    return value.replace(tzinfo=ZoneInfo(zone)) if value.tzinfo is None else value


def day_context(trip, data, request, now=None):
    tz = ZoneInfo(data.timezone or request.client_timezone)
    now = (now or datetime.now(timezone.utc)).astimezone(tz)
    target = day_date(trip, request.day_number)
    day = data.days.get(str(request.day_number))
    start = day.start.model_dump() if day and day.start else None
    end = day.end.model_dump() if day and day.end else None
    for stay in data.stays:
        if start is None and stay.first_night <= request.day_number - 1 <= stay.last_night:
            start = stay.location.model_dump()
        if end is None and stay.first_night <= request.day_number <= stay.last_night:
            end = stay.location.model_dump()
    if start is None and request.day_number == 1:
        start = end
    departures, arrivals = [], []
    for flight in data.flights:
        if flight.kind == "arrival":
            at = local_datetime(flight.arrival_at, flight.arrival_timezone).astimezone(tz) if flight.arrival_at else None
            arrival_date = at.date() if at else flight.arrival_date
            if (target is not None and arrival_date == target) or (request.day_number == 1 and (target is None or arrival_date is None)):
                arrivals.append((flight, at))
        if flight.kind == "departure":
            at = local_datetime(flight.departure_at, flight.departure_timezone).astimezone(tz) if flight.departure_at else None
            departure_date = at.date() if at else flight.departure_date
            if target is not None and departure_date == target:
                departures.append((flight, at - timedelta(minutes=flight.airport_buffer_minutes) if at else None))
    earliest = max((at for _, at in arrivals if at is not None), default=None)
    latest = min((at for _, at in departures if at is not None), default=None)
    if arrivals and (not day or not day.start):
        airports = [(flight, at) for flight, at in arrivals if flight.destination]
        if airports:
            arrival = max(airports, key=lambda entry: entry[1] or datetime.min.replace(tzinfo=tz))[0]
            start = arrival.destination.model_dump()
    if departures and (not day or not day.end):
        airports = [(flight, at) for flight, at in departures if flight.origin]
        if airports:
            departure = min(airports, key=lambda entry: entry[1] or datetime.max.replace(tzinfo=tz))[0]
            end = departure.origin.model_dump()
    clock, basis = None, "location_only"
    if request.use_current_time or (not (day and day.start_time) and (target is None or target == now.date())):
        clock, basis = now, "now"
    elif day and day.start_time:
        clock = datetime.combine(target or now.date(), datetime.strptime(day.start_time, "%H:%M").time(), tzinfo=tz)
        basis = "specified"
    if request.use_current_time and target and target != now.date():
        earliest, latest = None, None
    if earliest and (clock is None or clock < earliest):
        clock, basis = earliest, "flight_arrival"
    if request.current_location:
        start = request.current_location.model_dump()
    warnings = []
    if data.timezone is None:
        warnings.append(f"時間依 {tz.key} 顯示，可在航班與住宿設定目的地時區。")
    if clock is None:
        warnings.append("未指定出發時間，先依地點排序；交通時間若可查詢，僅作查詢當下的參考。")
    return {"start": start, "end": end, "clock": clock, "latest": latest, "date": target,
            "schedule_date": now.date() if request.use_current_time else target or now.date(),
            "basis": basis, "timezone": tz.key, "warnings": warnings}


def path_cost(order, costs, start_index=None, end_index=None):
    path = ([start_index] if start_index is not None else []) + order + ([end_index] if end_index is not None else [])
    return sum(costs[a][b] for a, b in zip(path, path[1:]))


def optimize_order(indices, costs, locked, start_index=None, end_index=None):
    """Keep fixed appointments in their slots; improve only the free segments."""
    result = list(indices)
    boundaries = [-1] + [i for i, node in enumerate(indices) if node in locked] + [len(indices)]
    for left, right in zip(boundaries, boundaries[1:]):
        segment = result[left + 1:right]
        before = result[left] if left >= 0 else start_index
        after = result[right] if right < len(result) else end_index
        remaining, ordered = set(segment), []
        previous = before
        # With no start, try every first stop; never treat the first item as fixed.
        candidates = [before] if before is not None else segment[:]
        best, best_cost = segment, path_cost(segment, costs, before, after)
        for candidate in candidates:
            remaining, ordered = set(segment), []
            previous = candidate
            if before is None and candidate is not None:
                ordered.append(candidate)
                remaining.remove(candidate)
            while remaining:
                chosen = min(remaining, key=lambda x: (costs[previous][x] if previous is not None else 0, indices.index(x)))
                ordered.append(chosen)
                remaining.remove(chosen)
                previous = chosen
            # 2-opt is checked against the full directed cost, including boundaries.
            improved = True
            while improved:
                improved = False
                base = path_cost(ordered, costs, before, after)
                for a in range(len(ordered)):
                    for b in range(a + 1, len(ordered)):
                        alternative = ordered[:a] + list(reversed(ordered[a:b + 1])) + ordered[b + 1:]
                        if path_cost(alternative, costs, before, after) + 0.01 < base:
                            ordered, improved = alternative, True
                            break
                    if improved:
                        break
            score = path_cost(ordered, costs, before, after)
            if score < best_cost:
                best, best_cost = ordered, score
        result[left + 1:right] = best
    return result


def appointment(item, extra):
    return extra.appointment_time or (item.time if extra.locked or extra.reservation_status == "booked" else None)


def fixed_datetime(at, context):
    return datetime.combine(context["schedule_date"], datetime.strptime(at, "%H:%M").time(), tzinfo=ZoneInfo(context["timezone"]))


def appointment_conflicts(order, index_to_item, data, costs, context, start_index):
    clock, previous, count = context["clock"], start_index, 0
    for index in order:
        item = index_to_item[index]
        extra = assistance(data, item)
        if clock and previous is not None:
            seconds = costs[previous][index]
            if not math.isfinite(seconds):
                return math.inf
            clock += timedelta(seconds=seconds)
        at = appointment(item, extra)
        if clock and at:
            scheduled = fixed_datetime(at, context)
            if clock > scheduled + timedelta(minutes=1):
                count += 1
            clock = max(clock, scheduled)
        if clock:
            clock += timedelta(minutes=extra.duration_minutes)
        previous = index
    return count


def preview(trip, items, data: PlanningData, revision, request, now=None):
    context = day_context(trip, data, request, now)
    warnings = context["warnings"][:]
    active = [i for i in items if assistance(data, i).progress == "planned"]
    if len(active) > 18:
        raise ValueError("單次可比較最多 18 個尚未完成的景點，請先分天安排。")
    points = [item_place(i) for i in active]
    indices = list(range(len(active)))
    start_index = len(points) if context["start"] else None
    if context["start"]:
        points.append(context["start"])
    end_index = len(points) if context["end"] else None
    if context["end"]:
        points.append(context["end"])
    costs, metric, matrix_live = None, "distance", False
    if request.optimize and len(points) > 1 and places.routes_enabled():
        try:
            costs = places.matrix(points, request.mode, context["clock"])
            matrix_live, metric = True, "travel_time"
        except places.ProviderUnavailable as error:
            warnings.append(str(error))
    road_available = request.road_routing and not places.routes_enabled() and request.mode in {"walk", "drive"} and all(places.coordinates(p) for p in points)
    if request.optimize and len(points) > 1 and road_available:
        try:
            costs = places.road_matrix(points, request.mode)
            matrix_live, metric = True, "travel_time"
        except places.ProviderUnavailable as error:
            warnings.append(str(error))
            road_available = False
    if costs is None:
        if all(places.coordinates(p) for p in points):
            costs = [[places.distance(a, b) for b in points] for a in points]
        else:
            warnings.append("部分地點尚未定位，先保留原順序。請搜尋並選取正確位置後再比較。")
    locked = {idx for idx, item in enumerate(active) if assistance(data, item).locked or appointment(item, assistance(data, item))}
    if context["clock"] is None and any(appointment(item, assistance(data, item)) for item in active):
        warnings.append("未設定出發時間，暫時無法檢查預約是否趕得上；固定預約的順序仍會保留。")
    order = indices
    if request.optimize and costs is not None:
        order = optimize_order(indices, costs, locked, start_index, end_index)
        if matrix_live and appointment_conflicts(order, dict(enumerate(active)), data, costs, context, start_index) > appointment_conflicts(indices, dict(enumerate(active)), data, costs, context, start_index):
            order = indices
            warnings.append("順路重排會增加固定預約的時間衝突，因此保留原順序。")
    if not matrix_live and request.optimize:
        warnings.append("此建議依直線距離減少折返，尚未納入道路、班次與轉乘；可開啟各段導航確認。")
    if not places.routes_enabled() and request.mode == "transit":
        warnings.append("大眾運輸目前只提供地理排序與導航入口，尚無班次或轉乘時間。")
    ordered = [active[i] for i in order]
    sequence = []
    if context["start"]:
        sequence.append((None, context["start"]))
    sequence.extend((i, item_place(i)) for i in ordered)
    if context["end"]:
        sequence.append((None, context["end"]))
    road_legs = None
    if road_available and len(sequence) > 1:
        try:
            road_legs = places.road_legs([p for _, p in sequence], request.mode)
            warnings.append("交通時間由 OSRM 依實際道路估算，不含即時路況；請依現場與導航確認。")
        except places.ProviderUnavailable as error:
            warnings.append(str(error))
    legs, stops, conflicts = [], [], []
    clock = context["clock"]
    live_available = bool(places.routes_enabled())
    for pos, (item, point) in enumerate(sequence):
        if pos:
            previous = sequence[pos - 1][1]
            leg = {"from_name": previous["name"], "to_name": point["name"], "to_item_id": item.id if item else None,
                   "navigation_url": places.maps_link(previous, point, request.mode), "seconds": None, "distance_meters": places.distance(previous, point),
                   "instructions": [], "source": "straight_line", "fare": None}
            if live_available:
                try:
                    leg.update(places.route_leg(previous, point, request.mode, request.preference, clock))
                except places.ProviderUnavailable as error:
                    warnings.append(str(error))
                    live_available = False
            elif road_legs:
                leg.update(road_legs[pos - 1])
            legs.append(leg)
            if clock and leg["seconds"] is not None:
                clock += timedelta(seconds=leg["seconds"])
            else:
                clock = None
        if item:
            extra = assistance(data, item)
            at = appointment(item, extra)
            if at and clock:
                fixed = fixed_datetime(at, context)
                if clock > fixed + timedelta(minutes=1):
                    conflicts.append(f"{item.name} 預估抵達晚於預約時間 {at}。")
                else:
                    clock = fixed
            stops.append({"item_id": item.id, "name": item.name, "arrival_at": clock.isoformat() if clock else None,
                          "duration_minutes": extra.duration_minutes, "fixed_time": at})
            if clock:
                clock += timedelta(minutes=extra.duration_minutes)
    if context["latest"]:
        warnings.append(f"航班建議最晚 {context['latest'].strftime('%H:%M')} 抵達機場。")
        if clock and clock > context["latest"]:
            conflicts.append("依目前估算，無法在建議時間前抵達機場，請減少景點或提早出發。")
    old_cost = path_cost(indices, costs, start_index, end_index) if costs is not None else None
    new_cost = path_cost(order, costs, start_index, end_index) if costs is not None else None
    saving = max(0, old_cost - new_cost) if old_cost is not None and math.isfinite(old_cost) and math.isfinite(new_cost) else None
    return {"signature": signature(data, items, revision), "day_number": request.day_number,
            "original_ids": [i.id for i in active], "item_ids": [i.id for i in ordered], "changed": order != indices,
            "start": context["start"], "end": context["end"], "clock_basis": context["basis"], "timezone": context["timezone"],
            "departure_at": context["clock"].isoformat() if context["clock"] else None,
            "metric": metric, "saving": saving, "legs": legs, "stops": stops, "warnings": list(dict.fromkeys(warnings)),
            "conflicts": conflicts, "can_apply": not conflicts}
