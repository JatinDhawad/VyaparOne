import asyncio
import logging
from app.core.database import engine, Base
from app.models import *

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def main():
    # SAFE TABLE INITIALIZATION: Zero data deletion (drop_all disabled)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables initialized safely. User data preserved 100%.")

if __name__ == "__main__":
    asyncio.run(main())
