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

    # Accounting policy: the app does not track GST returns (a CA handles them), so GST paid
    # on purchases is treated as part of the cost of goods. Set INPUT_GST_CLAIMED_AS_ITC=true
    # only if purchase GST is claimed back and should be left out of cost.
    INPUT_GST_CLAIMED_AS_ITC: bool = False

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
    # Exact origins only (no wildcards). Override in production with a JSON list, e.g.
    # CORS_ORIGINS='["https://your-app.vercel.app","https://your-custom-domain.com"]'
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://vyapar-one-beta.vercel.app",
    ]

    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
