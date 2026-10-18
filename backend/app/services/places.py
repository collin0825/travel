"""Server-side map providers. No keys or provider errors are returned to clients."""
import json
import math
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, urlopen

from app.core.config import settings


class ProviderUnavailable(Exception):
    pass


def fetch_json(url, payload, headers=None, *, form=False):
    data = urlencode(payload).encode() if form else json.dumps(payload).encode()
    request = Request(url, data=data, headers={
        "Content-Type": "application/x-www-form-urlencoded" if form else "application/json",
        "User-Agent": "TripCo-ItineraryPlanner/1.0", **(headers or {}),
    })
    try:
        with urlopen(request, timeout=12) as response:
            return json.loads(response.read(2_000_000))
    except (HTTPError, URLError, TimeoutError, ValueError, OSError):
        raise ProviderUnavailable("地圖服務暫時無法查詢，請稍後再試或使用導航連結。") from None


def google_request(service, payload, mask):
    if urlsplit(service).hostname == "routes.googleapis.com":
        if not routes_enabled():
            raise ProviderUnavailable("Google 交通查詢未啟用，可使用地理排序與導航連結。")
    elif not enabled():
        raise ProviderUnavailable("Google 地點查詢未啟用，可先手動填寫地點。")
    return fetch_json(service, payload, {"X-Goog-Api-Key": settings.GOOGLE_MAPS_API_KEY, "X-Goog-FieldMask": mask})


def coordinates(place):
    return place.get("latitude") is not None and place.get("longitude") is not None


def distance(a, b):
    if not coordinates(a) or not coordinates(b):
        return None
    lat1, lat2 = math.radians(a["latitude"]), math.radians(b["latitude"])
    delta = math.radians(b["longitude"] - a["longitude"])
    dlat = lat2 - lat1
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(delta / 2) ** 2
    return 6371000 * 2 * math.asin(min(1, math.sqrt(h)))


def waypoint(place):
    if place.get("place_id") and not place["place_id"].startswith("osm:"):
        return {"placeId": place["place_id"]}
    if coordinates(place):
        return {"location": {"latLng": {"latitude": place["latitude"], "longitude": place["longitude"]}}}
    return {"address": place.get("address") or place["name"]}


def maps_link(a, b, mode="transit"):
    def label(p):
        return f"{p['latitude']},{p['longitude']}" if coordinates(p) else p.get("address") or p["name"]
    return "https://www.google.com/maps/dir/?" + urlencode({"api": 1, "origin": label(a), "destination": label(b), "travelmode": {"walk": "walking", "drive": "driving"}.get(mode, "transit")})


def duration_seconds(value):
    return float(value.removesuffix("s")) if value else None


def matrix(points, mode, departure=None):
    """Google limits transit matrices to 100 elements; batch origins accordingly."""
    n = len(points)
    costs = [[math.inf] * n for _ in points]
    for i in range(n):
        costs[i][i] = 0
    step = max(1, 100 // n)
    for offset in range(0, n, step):
        body = {
            "origins": [{"waypoint": waypoint(p)} for p in points[offset:offset + step]],
            "destinations": [{"waypoint": waypoint(p)} for p in points],
            "travelMode": {"walk": "WALK", "drive": "DRIVE"}.get(mode, "TRANSIT"),
        }
        if departure:
            body["departureTime"] = departure.isoformat()
        rows = google_request("https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix", body,
                              "originIndex,destinationIndex,status,condition,duration")
        if not isinstance(rows, list):
            raise ProviderUnavailable("暫時無法比較交通時間。")
        for row in rows:
            if row.get("condition") == "ROUTE_EXISTS" and not row.get("status", {}).get("code"):
                seconds = duration_seconds(row.get("duration"))
                if seconds is not None:
                    costs[offset + row["originIndex"]][row["destinationIndex"]] = seconds
    if any(not math.isfinite(value) for row in costs for value in row):
        raise ProviderUnavailable("Google 未提供所有地點間的可用交通時間，本次無法依交通時間排序，改以地理位置提供建議。")
    return costs


def route_leg(a, b, mode, preference, departure=None):
    body = {"origin": waypoint(a), "destination": waypoint(b),
            "travelMode": {"walk": "WALK", "drive": "DRIVE"}.get(mode, "TRANSIT"), "languageCode": "zh-TW"}
    if departure:
        body["departureTime"] = departure.isoformat()
    if mode == "transit":
        body["transitPreferences"] = {"routingPreference": "LESS_WALKING" if preference == "less_walking" else "FEWER_TRANSFERS"}
    result = google_request("https://routes.googleapis.com/directions/v2:computeRoutes", body,
                           "routes.duration,routes.distanceMeters,routes.legs.steps.navigationInstruction,routes.legs.steps.transitDetails,routes.travelAdvisory.transitFare")
    routes = result.get("routes", [])
    if not routes:
        if mode == "transit":
            raise ProviderUnavailable("Google API 查無這段大眾運輸路線。若地點位於日本，Google Routes API 不提供當地大眾運輸資料；請開啟 Google Maps 導航確認班次。")
        raise ProviderUnavailable("Google API 在這些地點與時間查無路線，可能受資料覆蓋或班次限制；請開啟 Google Maps 導航確認。")
    selected = routes[0]
    instructions = []
    for leg in selected.get("legs", []):
        for step in leg.get("steps", []):
            detail = step.get("transitDetails")
            if detail:
                line = detail.get("transitLine", {})
                stops = detail.get("stopDetails", {})
                instructions.append(" · ".join(filter(None, [line.get("nameShort") or line.get("name"),
                    stops.get("departureStop", {}).get("name"), "→", stops.get("arrivalStop", {}).get("name")])))
            elif step.get("navigationInstruction", {}).get("instructions"):
                instructions.append(step["navigationInstruction"]["instructions"])
    fare = selected.get("travelAdvisory", {}).get("transitFare")
    return {"seconds": duration_seconds(selected.get("duration")), "distance_meters": selected.get("distanceMeters"),
            "instructions": instructions, "fare": fare, "source": "Google Maps"}


def safe_url(value):
    return value if value and urlsplit(value).scheme in {"https", "http"} else ""


def search_google(query, center=None, restaurants=False):
    body = {"textQuery": query, "languageCode": "zh-TW", "pageSize": 8}
    if restaurants:
        body["includedType"] = "restaurant"
    if center and coordinates(center):
        body["locationBias"] = {"circle": {"center": {"latitude": center["latitude"], "longitude": center["longitude"]}, "radius": 4000}}
    mask = "places.id,places.displayName,places.formattedAddress,places.location,places.googleMapsUri,places.businessStatus"
    if restaurants:
        mask += ",places.websiteUri,places.nationalPhoneNumber,places.regularOpeningHours,places.reservable,places.priceLevel"
    response = google_request("https://places.googleapis.com/v1/places:searchText", body, mask)
    return [{"name": p.get("displayName", {}).get("text", ""), "address": p.get("formattedAddress", ""),
             "latitude": p.get("location", {}).get("latitude"), "longitude": p.get("location", {}).get("longitude"),
             "place_id": p["id"], "website": safe_url(p.get("websiteUri")), "phone": p.get("nationalPhoneNumber", ""),
             "maps_url": safe_url(p.get("googleMapsUri")), "hours": p.get("regularOpeningHours", {}).get("weekdayDescriptions", []),
             "reservable": p.get("reservable"), "business_status": p.get("businessStatus"), "price_level": p.get("priceLevel"),
             "source": "Google Maps"} for p in response.get("places", [])]


def search_osm_restaurants(query, center):
    if not center or not coordinates(center):
        raise ProviderUnavailable("請先選擇一個有定位的景點，才能查詢附近餐廳。")
    lat, lng = center["latitude"], center["longitude"]
    q = f'[out:json][timeout:10];nwr(around:3000,{lat},{lng})["amenity"~"restaurant|cafe|fast_food"];out center 100;'
    response = fetch_json("https://overpass-api.de/api/interpreter", {"data": q}, form=True)
    keyword = query.casefold().strip()
    generic = keyword in {"", "餐廳", "附近餐廳", "午餐", "晚餐", "restaurant", "restaurants"}
    found = []
    for entry in response.get("elements", []):
        tags = entry.get("tags", {})
        name = tags.get("name:zh") or tags.get("name") or tags.get("brand")
        if not name:
            continue
        if not generic and keyword not in " ".join(str(v) for v in tags.values()).casefold():
            continue
        location = entry.get("center", entry)
        if location.get("lat") is None or location.get("lon") is None:
            continue
        branch = tags.get("branch", "")
        website = safe_url(tags.get("website") or tags.get("contact:website"))
        found.append({"name": f"{name} {branch}".strip(), "address": " ".join(filter(None, [tags.get("addr:city"), tags.get("addr:street"), tags.get("addr:housenumber")])),
            "latitude": location["lat"], "longitude": location["lon"], "place_id": f"osm:{entry['type']}:{entry['id']}",
            "website": website, "phone": tags.get("phone") or tags.get("contact:phone", ""),
            "booking_url": safe_url(tags.get("reservation:website")), "hours": [tags["opening_hours"]] if tags.get("opening_hours") else [],
            "reservable": {"yes": True, "no": False}.get(tags.get("reservation")),
            "maps_url": f"https://www.openstreetmap.org/{entry['type']}/{entry['id']}", "source": "OpenStreetMap", "cuisine": tags.get("cuisine", "")})
    return found


def enabled():
    return bool(settings.GOOGLE_MAPS_ENABLED and settings.GOOGLE_MAPS_API_KEY)


def routes_enabled():
    return bool(enabled() and settings.GOOGLE_ROUTES_ENABLED)


def search_osm_places(query):
    # Explicit search only, never autocomplete. Respect the shared public endpoint.
    import threading
    import time
    if not hasattr(search_osm_places, "lock"):
        search_osm_places.lock = threading.Lock()
        search_osm_places.last = 0
    with search_osm_places.lock:
        if time.monotonic() - search_osm_places.last < 1:
            raise ProviderUnavailable("請稍候一秒再搜尋地點。")
        search_osm_places.last = time.monotonic()
    url = "https://nominatim.openstreetmap.org/search?" + urlencode({"q": query, "format": "json", "limit": 6, "accept-language": "zh-TW,en"})
    try:
        with urlopen(Request(url, headers={"User-Agent": "TripCo-ItineraryPlanner/1.0"}), timeout=10) as response:
            rows = json.loads(response.read(500_000))
    except (HTTPError, URLError, TimeoutError, ValueError, OSError):
        raise ProviderUnavailable("地點搜尋暫時無法使用，可先手動填寫地址。") from None
    return [{"name": p["display_name"].split(",")[0], "address": p["display_name"],
             "latitude": float(p["lat"]), "longitude": float(p["lon"]), "place_id": f"osm:{p['osm_type']}:{p['osm_id']}",
             "source": "OpenStreetMap"} for p in rows]


# The public FOSSGIS service permits light usage, at most one request/second.
# Batch a whole day's legs instead of sending one request per attraction.
import threading
import time
_road_lock = threading.Lock()
_road_last = 0.0
_road_cache = {}


def road_request(points, mode, service):
    global _road_last
    if mode not in {"walk", "drive"} or not all(coordinates(p) for p in points):
        raise ProviderUnavailable("道路路線需要每個地點的定位，且僅支援步行／開車。")
    coords = ";".join(f"{p['longitude']:.6f},{p['latitude']:.6f}" for p in points)
    host_profile = "foot" if mode == "walk" else "car"
    params = {"overview": "false", "steps": "true"} if service == "route" else {"annotations": "duration"}
    url = f"https://routing.openstreetmap.de/routed-{host_profile}/{service}/v1/driving/{coords}?{urlencode(params)}"
    with _road_lock:
        now = time.monotonic()
        cached = _road_cache.get(url)
        if cached and now - cached[0] < 120:
            return cached[1]
        delay = 1.05 - (now - _road_last)
        if delay > 0:
            time.sleep(delay)
        _road_last = time.monotonic()
        try:
            with urlopen(Request(url, headers={"User-Agent": "TripCo-ItineraryPlanner/1.0"}), timeout=10) as response:
                data = json.loads(response.read(2_000_000))
        except (HTTPError, URLError, TimeoutError, ValueError, OSError):
            raise ProviderUnavailable("道路服務暫時無法查詢，改顯示地理建議，請用導航確認。") from None
        if data.get("code") != "Ok":
            raise ProviderUnavailable("部分地點之間沒有可用道路，請確認定位或改用導航。")
        for p, snapped in zip(points, data.get("waypoints", data.get("sources", []))):
            if snapped.get("distance", 0) > 500:
                raise ProviderUnavailable("地點距離可用道路超過 500 公尺，請重新確認入口位置。")
        if len(_road_cache) > 64:
            _road_cache.clear()
        _road_cache[url] = (time.monotonic(), data)
        return data


def road_matrix(points, mode):
    response = road_request(points, mode, "table")
    rows = response.get("durations", [])
    if len(rows) != len(points) or any(len(row) != len(points) for row in rows):
        raise ProviderUnavailable("道路比較資料不完整。")
    return [[v if v is not None else math.inf for v in row] for row in rows]


def road_legs(points, mode):
    response = road_request(points, mode, "route")
    routes = response.get("routes", [])
    if not routes or len(routes[0].get("legs", [])) != len(points) - 1:
        raise ProviderUnavailable("道路路線資料不完整。")
    result = []
    for leg in routes[0]["legs"]:
        names = list(dict.fromkeys(step.get("name") for step in leg.get("steps", []) if step.get("name")))
        result.append({"seconds": leg.get("duration"), "distance_meters": leg.get("distance"),
                       "instructions": ["途經：" + " → ".join(names[:8])] if names else [],
                       "source": "OSRM / OpenStreetMap", "fare": None})
    return result
