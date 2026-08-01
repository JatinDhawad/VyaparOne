import asyncio
from app.core.database import engine, Base
from app.models import *

async def main():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    print("Database tables recreated cleanly!")

if __name__ == "__main__":
    asyncio.run(main())
