from pydantic_settings import BaseSettings
from typing import List, Optional

class Settings(BaseSettings):
    PROJECT_NAME: str = "VyaparOne ERP"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Security & Auth
    SECRET_KEY: str = "SUPER_SECRET_CHANGE_THIS_IN_PRODUCTION_KEY_1234567890"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 Days
    
    # Database Configuration
    DATABASE_URL: str = "sqlite+aiosqlite:///./vyaparone.db" # Default fallback for local dev
    
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
