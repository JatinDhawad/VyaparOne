import asyncio
import logging
import httpx
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.v1.router import api_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def keep_alive_ping():
    """Background task that pings the Render backend every 4 minutes to prevent cloud spin-down."""
    await asyncio.sleep(10)  # Wait 10s after server startup
    target_url = "https://vyaparone-backend.onrender.com/health"
    while True:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(target_url)
                logger.info(f"Keep-alive ping sent to {target_url} - Status: {resp.status_code}")
        except Exception as err:
            logger.warning(f"Keep-alive ping note: {err}")
        
        # Ping every 4 minutes (240s) so Render server stays awake 24/7 with zero spin-down delays
        await asyncio.sleep(240)

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        from app.scripts.init_db import init_db, seed_data
        await init_db()
        await seed_data()
    except Exception as e:
        logger.error(f"Startup DB init error: {e}")
    
    # Launch 24/7 keep-alive background ping
    ping_task = asyncio.create_task(keep_alive_ping())
    try:
        yield
    finally:
        ping_task.cancel()

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
    redirect_slashes=False,
)

# Include v1 Router
app.include_router(api_router, prefix=settings.API_V1_STR)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {
        "status": "online",
        "app": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "docs": "/docs",
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
