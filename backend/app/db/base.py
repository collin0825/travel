"""Declarative base and model registry.

`Base.metadata` must know about every ORM model for `create_all` and, more
importantly, for Alembic autogenerate. Importing the models package here (which
re-exports all models) guarantees they are registered on the metadata whenever
this module is imported.
"""

from sqlalchemy.orm import declarative_base

Base = declarative_base()

# Import all models so they register against Base.metadata.
# Placed after Base is defined to avoid a circular import.
from app.db import models  # noqa: E402,F401
