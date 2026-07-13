"""Aggregates every route module into a single router mounted by main.py."""

from fastapi import APIRouter

from app.api.routes import auth, itineraries, items, expenses, notes

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(itineraries.router)
api_router.include_router(items.router)
api_router.include_router(expenses.router)
api_router.include_router(notes.router)
