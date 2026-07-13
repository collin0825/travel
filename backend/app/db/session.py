"""Database engine and session factory.

The connection string comes from `settings.DATABASE_URL` (loaded from .env).
Point it at your Supabase Postgres "Session pooler" string for production;
it falls back to local SQLite when unset.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

DATABASE_URL = settings.DATABASE_URL

# Normalize the legacy postgres:// scheme (Render/Heroku/Supabase legacy URIs).
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# SQLite needs check_same_thread=False when used with FastAPI's threadpool.
connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    # Supabase's Supavisor pooler recycles idle connections; pre-ping avoids
    # "server closed the connection unexpectedly" errors on reused connections.
    pool_pre_ping=True,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
