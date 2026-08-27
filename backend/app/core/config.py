from pydantic_settings import BaseSettings
from pydantic import validator
from typing import List, Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "VyaparOne ERP"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Security & Auth
    # No default value — must be set via environment variable (SECRET_KEY).
    # The application will refuse to start if this is missing.
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 Days

    @validator("SECRET_KEY")
    def secret_key_must_be_set(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError(
                "SECRET_KEY must be set via the SECRET_KEY environment variable. "
                "Generate a strong random key (e.g. `openssl rand -hex 32`) and set it "
                "before starting the application. Do not use a hardcoded or empty value."
            )
        return v
    
    # Database Configuration
    DATABASE_URL: str = "sqlite+aiosqlite:///./vyaparone.db" # Default fallback for local dev

    @property
    def ASYNC_DATABASE_URL(self) -> str:
        url = self.DATABASE_URL.strip()
        if url.startswith("postgres://"):
            return url.replace("postgres://", "postgresql+asyncpg://", 1)
        elif url.startswith("postgresql://") and not url.startswith("postgresql+asyncpg://"):
            return url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return url
    
    # CORS Configuration
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://*.vercel.app",
    ]

    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
