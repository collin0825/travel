from typing import List, Union

from typing_extensions import Annotated
from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings, loaded from the backend/.env file (see .env.example)."""

    # Database — Supabase Postgres connection string (Session pooler recommended).
    # Falls back to local SQLite so the app still boots without a .env during dev.
    DATABASE_URL: str = "sqlite:///./travel.db"

    # Auth / JWT
    SECRET_KEY: str = "change-me-in-env"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_DAYS: int = 30

    # CORS — list of allowed frontend origins. NoDecode disables pydantic-settings'
    # built-in JSON parsing so the validator below can accept a comma-separated
    # string in .env (e.g. CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173).
    CORS_ORIGINS: Annotated[List[str], NoDecode] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def _split_cors_origins(cls, value: Union[str, List[str]]) -> Union[str, List[str]]:
        if isinstance(value, str) and not value.strip().startswith("["):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value


settings = Settings()
