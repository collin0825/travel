"""FastAPI application entry point.

Run from the backend/ directory:  uvicorn app.main:app --reload

Tables are managed by Alembic (see backend/migrations); this module only wires
together configuration, CORS and the API/WebSocket routers.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.routes import api_router
from app.api.routes.ws import router as ws_router

app = FastAPI(title="Travel Itinerary Planner API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    # Allow LAN devices (e.g. a phone on the same Wi-Fi) reaching the dev frontend
    # via a private-network IP. Port is left open because the Vite dev server may
    # pick a different port (5174, ...). WebSocket handshakes bypass CORS entirely.
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router)
app.include_router(ws_router)


@app.get("/health", tags=["health"])
def health_check():
    return {"status": "ok"}
