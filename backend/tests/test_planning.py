"""Run with python -m unittest discover -s tests. Uses only a temporary SQLite DB."""
import atexit
import os
import subprocess
import sys
import tempfile
import unittest
from datetime import date, datetime, timezone
from types import SimpleNamespace
from unittest.mock import patch

_tmp = tempfile.TemporaryDirectory(prefix="tripco-planning-tests-")
atexit.register(_tmp.cleanup)
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp.name}/test.db"
os.environ["SECRET_KEY"] = "isolated-tests-only-secret-123456789012345"
os.environ["GOOGLE_MAPS_ENABLED"] = "false"
os.environ["GOOGLE_ROUTES_ENABLED"] = "false"
os.environ["GOOGLE_MAPS_API_KEY"] = ""

from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from app.main import app
from app.core.security import create_access_token, get_password_hash
from app.core.config import settings
from app.db import models
from app.db.session import SessionLocal, engine
from app.schemas.planning import DaySettings, ItemAssistance, Place, PlanningData, RouteRequest, Stay
from app.services.planning import day_context, optimize_order, path_cost, preview
from app.services import places
from app.api.routes.planning import _requests

command.upgrade(Config("alembic.ini"), "head")


def point(name, x):
    return {"name": name, "address": name, "latitude": 35.0, "longitude": 139 + x / 100}


def item(ident, x, order):
    return SimpleNamespace(id=ident, name=f"stop-{ident}", address="", latitude=35.0, longitude=139 + x / 100,
                           day_number=1, sort_order=order, time=None)


class PlanningTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app)
        cls.db = SessionLocal()
        for label in ("owner", "viewer", "outsider"):
            user = models.User(email=f"{label}@example.com", display_name=label, hashed_password=get_password_hash("tests-only-123"))
            cls.db.add(user); cls.db.commit(); cls.db.refresh(user)
            setattr(cls, label, user)
            setattr(cls, label + "_headers", {"Authorization": "Bearer " + create_access_token({"sub": str(user.id)})})

    @classmethod
    def tearDownClass(cls):
        cls.client.close()
        cls.db.close()
        engine.dispose()

    def setUp(self):
        _requests.clear()
        response = self.client.post("/api/itineraries", headers=self.owner_headers, json={"title": "Existing trip", "start_date": "2026-10-18", "end_date": "2026-10-20"})
        self.assertEqual(response.status_code, 200, response.text)
        self.trip = response.json()
        self.base = f"/api/itineraries/{self.trip['id']}"
        for index, x in enumerate((3, 1, 2)):
            response = self.client.post(self.base + "/items", headers=self.owner_headers, json={"day_number": 1, **point(f"Stop {x}", x)})
            self.assertEqual(response.status_code, 200, response.text)
        self.items = self.client.get(self.base, headers=self.owner_headers).json()["items"]

    def tearDown(self):
        self.client.delete(self.base, headers=self.owner_headers)

    def planning(self):
        response = self.client.get(self.base + "/planning", headers=self.owner_headers)
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def save(self, data, revision=0):
        return self.client.put(self.base + "/planning", headers=self.owner_headers, json={"revision": revision, "data": data})

    def route(self, **kwargs):
        payload = {"day_number": 1, "road_routing": False, "client_timezone": "Asia/Tokyo", **kwargs}
        result = self.client.post(self.base + "/route-preview", headers=self.owner_headers, json=payload)
        self.assertEqual(result.status_code, 200, result.text)
        return result.json()

    def test_existing_trip_needs_no_flight_or_stay(self):
        response = self.planning()
        self.assertEqual(response["revision"], 0)
        self.assertEqual(response["data"]["flights"], [])
        self.assertEqual(response["data"]["stays"], [])
        self.assertFalse(response["live_maps"])
        self.assertFalse(response["live_routes"])
        self.assertEqual(self.save(response["data"]).status_code, 200)
        self.assertEqual(len(self.client.get(self.base, headers=self.owner_headers).json()["items"]), 3)

    def test_planning_revision_conflict(self):
        data = self.planning()["data"]
        data["timezone"] = "Asia/Tokyo"
        self.assertEqual(self.save(data).status_code, 200)
        self.assertEqual(self.save(data).status_code, 409)

    def test_permissions(self):
        self.client.post("/api/itineraries/join", headers=self.viewer_headers, json={"invite_code": self.trip["invite_code"]})
        self.client.put(self.base + f"/members/{self.viewer.id}", headers=self.owner_headers, json={"role": "viewer"})
        self.assertEqual(self.client.get(self.base + "/planning", headers=self.viewer_headers).status_code, 200)
        self.assertEqual(self.client.put(self.base + "/planning", headers=self.viewer_headers, json={"revision": 0, "data": {}}).status_code, 403)
        self.assertEqual(self.client.get(self.base + "/planning", headers=self.outsider_headers).status_code, 403)
        self.assertEqual(self.client.get(self.base + "/planning").status_code, 401)
        route = self.route()
        payload = {"day_number": 1, "signature": route["signature"], "item_ids": route["item_ids"]}
        self.assertEqual(self.client.post(self.base + "/route-apply", headers=self.viewer_headers, json=payload).status_code, 403)

    def test_optional_stays_and_reject_overlap(self):
        data = self.planning()["data"]
        data["stays"] = [{"id": "a", "first_night": 1, "last_night": 1, "location": point("Hotel A", 0)}, {"id": "b", "first_night": 2, "last_night": 2, "location": point("Hotel B", 4)}]
        self.assertEqual(self.save(data).status_code, 200)
        context = day_context(SimpleNamespace(start_date=date(2026, 10, 18)), PlanningData.model_validate(data), RouteRequest(day_number=2, client_timezone="Asia/Tokyo"))
        self.assertEqual(context["start"]["name"], "Hotel A")
        self.assertEqual(context["end"]["name"], "Hotel B")
        self.assertIsNone(context["clock"])
        first_day = day_context(SimpleNamespace(start_date=date(2026, 10, 18)), PlanningData.model_validate(data), RouteRequest(day_number=1))
        self.assertEqual(first_day["start"]["name"], "Hotel A")
        data["stays"][1]["first_night"] = 1
        self.assertEqual(self.save(data, 1).status_code, 422)

    def test_timezone_and_naive_clock(self):
        now = datetime(2026, 10, 18, 1, 30, tzinfo=timezone.utc)
        trip = SimpleNamespace(start_date=date(2026, 10, 18))
        request = RouteRequest(day_number=1, client_timezone="Asia/Tokyo")
        context = day_context(trip, PlanningData(), request, now)
        self.assertEqual(context["clock"].hour, 10)
        self.assertEqual(context["basis"], "now")
        future = day_context(trip, PlanningData(), RouteRequest(day_number=2), now)
        self.assertIsNone(future["clock"])
        data = PlanningData(days={"1": DaySettings(start_time="08:30")})
        no_dates = day_context(SimpleNamespace(start_date=None), data, request, now)
        self.assertEqual(no_dates["clock"].hour, 8)
        self.assertEqual(no_dates["clock"].minute, 30)

    def test_flights_across_timezones(self):
        data = self.planning()["data"]
        data["flights"] = [{"id": "flight", "label": "Overnight", "kind": "arrival", "origin": point("TPE", 0), "destination": point("HND", 1), "departure_at": "2026-10-17T23:00", "departure_timezone": "Asia/Taipei", "arrival_at": "2026-10-18T03:00", "arrival_timezone": "Asia/Tokyo"}]
        self.assertEqual(self.save(data).status_code, 200)
        context = day_context(SimpleNamespace(start_date=date(2026, 10, 18)), PlanningData.model_validate(data), RouteRequest(day_number=1, client_timezone="Asia/Tokyo"), datetime(2026, 10, 17, 15, tzinfo=timezone.utc))
        self.assertEqual(context["start"]["name"], "HND")
        self.assertEqual(context["clock"].hour, 3)
        data["flights"][0]["arrival_at"] = "2026-10-16T03:00"
        self.assertEqual(self.save(data, 1).status_code, 422)

    def test_flight_dates_can_be_saved_without_inventing_times(self):
        data = self.planning()["data"]
        data["flights"] = [{"id": "outbound", "label": "IT200", "kind": "arrival", "departure_date": "2026-10-18", "arrival_date": "2026-10-19"}]
        self.assertEqual(self.save(data).status_code, 200)
        current = self.planning()["data"]
        flight = current["flights"][0]
        self.assertEqual(flight["departure_date"], "2026-10-18")
        self.assertEqual(flight["arrival_date"], "2026-10-19")
        self.assertIsNone(flight["departure_at"])
        self.assertIsNone(flight["arrival_at"])
        context = day_context(SimpleNamespace(start_date=date(2026, 10, 18)), PlanningData.model_validate(current), RouteRequest(day_number=1), datetime(2026, 10, 17, tzinfo=timezone.utc))
        self.assertIsNone(context["clock"])
        self.assertIsNone(context["latest"])
        current["flights"][0]["departure_date"] = "2026-02-30"
        self.assertEqual(self.save(current, 1).status_code, 422)

    def test_airport_start_matches_saved_preview_before_time_is_filled(self):
        data = self.planning()["data"]
        data["timezone"] = "Asia/Tokyo"
        data["stays"] = [{"id": "hotel", "first_night": 1, "last_night": 2, "location": point("Hotel", 0)}]
        data["flights"] = [{"id": "outbound", "label": "IT200", "kind": "arrival", "arrival_date": "2026-10-18", "destination": point("NRT", 5)}]
        response = self.save(data)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["day_anchors"]["1"]["start"]["name"], "NRT")
        self.assertEqual(self.planning()["day_anchors"]["1"]["start"]["name"], "NRT")
        route = self.route(mode="transit")
        self.assertEqual(route["start"]["name"], "NRT")
        self.assertEqual(route["end"]["name"], "Hotel")
        self.assertEqual(self.planning()["day_anchors"]["2"]["start"]["name"], "Hotel")
        current = self.planning()["data"]
        current["days"] = {"1": {"start": point("Manual start", 2)}}
        self.assertEqual(self.save(current, 1).json()["day_anchors"]["1"]["start"]["name"], "Manual start")
        self.assertEqual(self.route(mode="transit")["start"]["name"], "Manual start")

    def test_date_only_airport_follows_arrival_day_without_fake_clock(self):
        trip = SimpleNamespace(start_date=date(2026, 10, 18))
        data = PlanningData.model_validate({"stays": [{"id": "hotel", "first_night": 1, "last_night": 2, "location": point("Hotel", 0)}],
            "flights": [{"id": "overnight", "label": "Overnight", "kind": "arrival", "arrival_date": "2026-10-19", "destination": point("NRT", 5)}]})
        now = datetime(2026, 10, 17, tzinfo=timezone.utc)
        first = day_context(trip, data, RouteRequest(day_number=1), now)
        second = day_context(trip, data, RouteRequest(day_number=2), now)
        self.assertEqual(first["start"]["name"], "Hotel")
        self.assertEqual(second["start"]["name"], "NRT")
        self.assertIsNone(second["clock"])
        self.assertIsNone(second["latest"])

    def test_date_only_return_airport_has_no_invented_deadline(self):
        data = PlanningData.model_validate({"flights": [{"id": "return", "label": "IT201", "kind": "departure", "departure_date": "2026-10-20", "origin": point("NRT", 5)}]})
        context = day_context(SimpleNamespace(start_date=date(2026, 10, 18)), data, RouteRequest(day_number=3), datetime(2026, 10, 17, tzinfo=timezone.utc))
        self.assertEqual(context["end"]["name"], "NRT")
        self.assertIsNone(context["latest"])

    def test_undated_trip_can_start_at_optional_arrival_airport(self):
        data = PlanningData.model_validate({"flights": [{"id": "outbound", "label": "IT200", "kind": "arrival", "destination": point("NRT", 5)}]})
        context = day_context(SimpleNamespace(start_date=None), data, RouteRequest(day_number=1))
        self.assertEqual(context["start"]["name"], "NRT")
        live = day_context(SimpleNamespace(start_date=None), data, RouteRequest(day_number=1, current_location=Place(**point("Current location", 1))))
        self.assertEqual(live["start"]["name"], "Current location")

    def test_invalid_display_timezone_does_not_save_planning(self):
        response = self.client.put(self.base + "/planning?client_timezone=invalid", headers=self.owner_headers, json={"revision": 0, "data": {}})
        self.assertEqual(response.status_code, 422)
        self.assertEqual(self.planning()["revision"], 0)

    def test_previews_do_not_write_order_and_apply_detects_changes(self):
        route = self.route(optimize=True)
        self.assertEqual([i["id"] for i in self.client.get(self.base, headers=self.owner_headers).json()["items"]], [i["id"] for i in self.items])
        self.client.post(self.base + "/items", headers=self.owner_headers, json={"day_number": 1, "name": "Added later"})
        self.assertEqual(self.client.post(self.base + "/route-apply", headers=self.owner_headers, json={"day_number": 1, "signature": route["signature"], "item_ids": route["item_ids"]}).status_code, 409)

    def test_apply_order_progress_and_lock(self):
        data = self.planning()["data"]
        first, second, third = [i["id"] for i in self.items]
        data["items"] = {str(first): {"progress": "done"}, str(second): {"locked": True}}
        self.assertEqual(self.save(data).status_code, 200)
        route = self.route(optimize=True)
        self.assertEqual(set(route["item_ids"]), {second, third})
        invalid = {"day_number": 1, "signature": route["signature"], "item_ids": [third, second]}
        self.assertEqual(self.client.post(self.base + "/route-apply", headers=self.owner_headers, json=invalid).status_code, 422)
        invalid["item_ids"] = [second, third]
        self.assertEqual(self.client.post(self.base + "/route-apply", headers=self.owner_headers, json=invalid).status_code, 200)
        ids = [i["id"] for i in self.client.get(self.base, headers=self.owner_headers).json()["items"]]
        self.assertEqual(ids, [first, second, third])

    def test_item_from_other_trip_and_bad_urls_rejected(self):
        self.assertEqual(self.save({"items": {"99999999": {}}}).status_code, 422)
        self.assertEqual(self.save({"items": {str(self.items[0]['id']): {"ticket_url": "javascript:alert(1)"}}}).status_code, 422)
        self.assertEqual(self.save({"timezone": "not/a-timezone"}).status_code, 422)

    def test_missing_coordinates_never_invent_times(self):
        objects = [item(1, 1, 0), item(2, 2, 1)]
        objects[1].latitude = objects[1].longitude = None
        result = preview(SimpleNamespace(start_date=None), objects, PlanningData(), 0, RouteRequest(day_number=1, optimize=True, mode="transit"))
        self.assertEqual(result["item_ids"], [1, 2])
        self.assertIsNone(result["legs"][0]["seconds"])
        self.assertIsNone(result["stops"][1]["arrival_at"])

    def test_directed_optimization_respects_fixed_slots_and_never_worsens(self):
        costs = [[0, 9, 1, 8, 1], [1, 0, 8, 2, 2], [8, 1, 0, 3, 3], [2, 3, 4, 0, 4], [1, 1, 1, 1, 0]]
        order = optimize_order([0, 1, 2, 3], costs, {2}, start_index=4)
        self.assertEqual(order[2], 2)
        self.assertEqual(set(order), {0, 1, 2, 3})
        self.assertLessEqual(path_cost(order, costs, 4), path_cost([0, 1, 2, 3], costs, 4))

    def test_missing_google_transit_times_fall_back_to_geographic_order(self):
        objects = [item(1, 3, 0), item(2, 1, 1), item(3, 2, 2)]
        data = PlanningData(days={"1": DaySettings(start=Place(**point("Hotel", 0)), start_time="09:00")})
        with patch.object(places, "routes_enabled", return_value=True), patch.object(places, "google_request", return_value=[]), patch.object(places, "route_leg", side_effect=places.ProviderUnavailable("日本大眾運輸不支援")):
            result = preview(SimpleNamespace(start_date=None), objects, data, 0, RouteRequest(day_number=1, mode="transit", optimize=True))
        self.assertEqual(result["metric"], "distance")
        self.assertEqual(result["item_ids"], [2, 3, 1])
        self.assertTrue(result["changed"])
        self.assertGreater(result["saving"], 0)
        self.assertTrue(any("地理位置" in warning for warning in result["warnings"]))
        self.assertTrue(all(leg["seconds"] is None for leg in result["legs"]))
        self.assertTrue(all(stop["arrival_at"] is None for stop in result["stops"]))

    def test_partially_missing_google_matrix_cannot_claim_time_comparison(self):
        rows = [{"originIndex": a, "destinationIndex": b, "condition": "ROUTE_EXISTS", "duration": "60s"}
                for a in range(2) for b in range(2) if (a, b) != (1, 0)]
        with patch.object(places, "google_request", return_value=rows):
            with self.assertRaises(places.ProviderUnavailable):
                places.matrix([point("A", 0), point("B", 1)], "transit")

    def test_places_only_keeps_restaurants_and_geographic_routing(self):
        rows = [{**point("Restaurant", 1), "source": "Google Maps"}]
        with patch.object(settings, "GOOGLE_MAPS_ENABLED", True), patch.object(settings, "GOOGLE_MAPS_API_KEY", "test-key"), patch.object(settings, "GOOGLE_ROUTES_ENABLED", False), patch.object(places, "search_google", return_value=rows) as search, patch.object(places, "matrix") as matrix, patch.object(places, "route_leg") as route_leg:
            envelope = self.planning()
            self.assertTrue(envelope["live_maps"])
            self.assertFalse(envelope["live_routes"])
            result = self.route(optimize=True, mode="transit")
            self.assertEqual(result["metric"], "distance")
            self.assertTrue(all(leg["seconds"] is None for leg in result["legs"]))
            response = self.client.post(self.base + "/places-search", headers=self.owner_headers, json={"query": "restaurant", "restaurants_only": True, "center": point("Hotel", 0), "mode": "transit"})
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["source"], "Google Maps")
            self.assertEqual(response.json()["places"][0]["name"], "Restaurant")
            self.assertIn("直線距離", response.json()["notice"])
            search.assert_called_once()
            matrix.assert_not_called()
            route_leg.assert_not_called()

    def test_disabled_routes_block_network_but_keep_places_requests(self):
        with patch.object(settings, "GOOGLE_MAPS_ENABLED", True), patch.object(settings, "GOOGLE_MAPS_API_KEY", "test-key"), patch.object(settings, "GOOGLE_ROUTES_ENABLED", False), patch.object(places, "fetch_json", return_value={"places": []}) as fetch:
            self.assertEqual(places.search_google("Tokyo"), [])
            self.assertEqual(fetch.call_count, 1)
            with self.assertRaises(places.ProviderUnavailable):
                places.matrix([point("A", 0), point("B", 1)], "walk")
            with self.assertRaises(places.ProviderUnavailable):
                places.route_leg(point("A", 0), point("B", 1), "walk", "fewer_transfers")
            self.assertEqual(fetch.call_count, 1)

    def test_places_only_can_use_free_walking_roads(self):
        leg = {"seconds": 60, "distance_meters": 100, "source": "OSRM / OpenStreetMap", "instructions": [], "fare": None}
        with patch.object(settings, "GOOGLE_MAPS_ENABLED", True), patch.object(settings, "GOOGLE_MAPS_API_KEY", "test-key"), patch.object(settings, "GOOGLE_ROUTES_ENABLED", False), patch.object(places, "road_legs", return_value=[leg]) as road, patch.object(places, "route_leg") as google_route:
            result = preview(SimpleNamespace(start_date=None), [item(1, 0, 0), item(2, 1, 1)], PlanningData(), 0, RouteRequest(day_number=1, mode="walk"))
            self.assertEqual(result["legs"][0]["source"], "OSRM / OpenStreetMap")
            road.assert_called_once()
            google_route.assert_not_called()

    def test_complete_google_matrix_uses_time_instead_of_geography(self):
        costs = [[0, 10, 1000, 1000], [1000, 0, 10, 1000], [1000, 1000, 0, 1000], [10, 1000, 1000, 0]]
        rows = [{"originIndex": a, "destinationIndex": b, "condition": "ROUTE_EXISTS", "duration": f"{costs[a][b]}s"}
                for a in range(4) for b in range(4)]
        objects = [item(1, 3, 0), item(2, 1, 1), item(3, 2, 2)]
        data = PlanningData(days={"1": DaySettings(start=Place(**point("Hotel", 0)), start_time="09:00")})
        leg = {"seconds": 10, "distance_meters": 100, "source": "Google Maps", "instructions": [], "fare": None}
        with patch.object(places, "routes_enabled", return_value=True), patch.object(places, "google_request", return_value=rows), patch.object(places, "route_leg", return_value=leg):
            result = preview(SimpleNamespace(start_date=None), objects, data, 0, RouteRequest(day_number=1, mode="transit", optimize=True))
        self.assertEqual(result["metric"], "travel_time")
        self.assertEqual(result["item_ids"], [1, 2, 3])
        self.assertTrue(all(stop["arrival_at"] is not None for stop in result["stops"]))

    def test_real_road_duration_and_arrival_from_provider(self):
        road = [{"seconds": 600, "distance_meters": 800, "instructions": ["Road A"], "source": "OSRM / OpenStreetMap", "fare": None}]
        with patch.object(places, "road_legs", return_value=road):
            result = preview(SimpleNamespace(start_date=date(2026, 10, 18)), [item(1, 0, 0), item(2, 1, 1)], PlanningData(days={"1": DaySettings(start_time="09:00")}), 0,
                             RouteRequest(day_number=1, mode="walk", client_timezone="Asia/Tokyo"))
        self.assertEqual(result["legs"][0]["seconds"], 600)
        self.assertTrue(result["stops"][1]["arrival_at"].endswith("10:10:00+09:00"))
        self.assertEqual(result["legs"][0]["source"], "OSRM / OpenStreetMap")

    def test_road_failure_gracefully_falls_back(self):
        with patch.object(places, "road_matrix", side_effect=places.ProviderUnavailable("offline")):
            result = preview(SimpleNamespace(start_date=None), [item(1, 3, 0), item(2, 1, 1), item(3, 2, 2)], PlanningData(), 0, RouteRequest(day_number=1, mode="walk", optimize=True))
        self.assertEqual(result["metric"], "distance")
        self.assertTrue(all(l["seconds"] is None for l in result["legs"]))
        self.assertIn("offline", result["warnings"])

    def test_deleted_item_metadata_is_pruned(self):
        ident = self.items[0]['id']
        data = {'items': {str(ident): {'ticket_status': 'required'}}}
        self.assertEqual(self.save(data).status_code, 200)
        self.assertEqual(self.client.delete(f'/api/itineraries/items/{ident}', headers=self.owner_headers).status_code, 200)
        current = self.planning()
        self.assertNotIn(str(ident), current['data']['items'])
        self.assertEqual(self.save(current['data'], current['revision']).status_code, 200)

    def test_midnight_does_not_move_appointment_to_tomorrow(self):
        road = [{'seconds': 7200, 'distance_meters': 1000, 'instructions': [], 'source': 'OSRM / OpenStreetMap', 'fare': None}]
        data = PlanningData(days={'1': DaySettings(start_time='23:00')}, items={'1': ItemAssistance(duration_minutes=0), '2': ItemAssistance(appointment_time='23:30')})
        with patch.object(places, 'road_legs', return_value=road):
            result = preview(SimpleNamespace(start_date=date(2026, 10, 18)), [item(1, 0, 0), item(2, 1, 1)], data, 0, RouteRequest(day_number=1, mode='walk'))
        self.assertFalse(result['can_apply'])
        self.assertTrue(result['conflicts'])

    def test_restaurant_candidates_use_road_times_without_claiming_availability(self):
        rows = [{**point('Near geographically', 1), 'source': 'OpenStreetMap'}, {**point('Faster by road', 2), 'source': 'OpenStreetMap'}]
        costs = [[0, 900, 300, 600], [900, 0, 600, 300], [300, 600, 0, 400], [600, 300, 400, 0]]
        with patch.object(places, 'search_osm_restaurants', return_value=rows), patch.object(places, 'road_matrix', return_value=costs):
            response = self.client.post(self.base + '/places-search', headers=self.owner_headers, json={'query': 'restaurant', 'restaurants_only': True, 'center': point('Before', 0), 'next_stop': point('After', 3), 'rank_by': 'nearest', 'mode': 'walk'})
        self.assertEqual(response.status_code, 200, response.text)
        result = response.json()
        self.assertEqual(result['places'][0]['name'], 'Faster by road')
        self.assertEqual(result['places'][0]['travel_seconds'], 300)
        self.assertIn('不代表指定時段有空位', result['notice'])

    def test_place_service_failure_is_safe(self):
        with patch.object(places, 'search_osm_places', side_effect=places.ProviderUnavailable('temporarily unavailable')):
            response = self.client.post(self.base + '/places-search', headers=self.owner_headers, json={'query': 'station'})
        self.assertEqual(response.status_code, 503)
        self.assertNotIn('API_KEY', response.text)

    def test_websocket_planning_refresh(self):
        token = self.owner_headers["Authorization"].removeprefix("Bearer ")
        with self.client.websocket_connect(f"/ws/itineraries/{self.trip['id']}?token={token}") as socket:
            self.assertEqual(socket.receive_json()["type"], "presence")
            self.assertEqual(self.save({}).status_code, 200)
            self.assertEqual(socket.receive_json()["type"], "refresh_planning")


class DatabaseDriverTests(unittest.TestCase):
    def test_application_starts_with_each_supported_postgres_url(self):
        # Import the real application in a fresh process, without connecting to
        # a database, to catch missing DBAPI modules before deployment.
        for scheme, driver in [("postgresql", "psycopg"), ("postgresql+psycopg", "psycopg"),
                               ("postgresql+psycopg2", "psycopg2"), ("postgres", "psycopg")]:
            with self.subTest(scheme=scheme):
                env = {**os.environ, "DATABASE_URL": f"{scheme}://test:placeholder@localhost/travel"}
                result = subprocess.run([sys.executable, "-c", "from app.main import app; from app.db.session import engine; print(engine.dialect.driver); engine.dispose()"],
                                        env=env, capture_output=True, text=True, timeout=20)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual(result.stdout.strip(), driver)


if __name__ == "__main__":
    unittest.main()
