"""Application configuration loaded from environment variables (.env)."""

from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    # --- Application ---
    APP_NAME: str = "Linear Health HMS"
    APP_ENV: str = "development"
    DEBUG: bool = True
    SECRET_KEY: str = "change-me"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    # --- PostgreSQL ---
    POSTGRES_USER: str = "linearhealth"
    POSTGRES_PASSWORD: str = "linearhealth_secret"
    POSTGRES_DB: str = "hospital_management"
    POSTGRES_HOST: str = "postgres"
    POSTGRES_PORT: int = 5432
    DATABASE_URL: str = "postgresql+asyncpg://linearhealth:linearhealth_secret@postgres:5432/hospital_management"

    # --- Redis ---
    REDIS_URL: str = "redis://redis:6379/0"
    CELERY_BROKER_URL: str = "redis://redis:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://redis:6379/1"

    # --- Groq API ---
    GROQ_API_KEY: str = ""

    # --- LiveKit ---
    LIVEKIT_URL: str = ""
    LIVEKIT_API_KEY: str = ""
    LIVEKIT_API_SECRET: str = ""

    # --- Admin Credentials ---
    ADMIN_EMAIL: str = "admin@example.com"
    ADMIN_PASSWORD: str = "change_me_in_production"

    # --- CORS ---
    CORS_ORIGINS: str = "http://localhost:3000,http://frontend:3000"

    @property
    def cors_origins_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",")]

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()
