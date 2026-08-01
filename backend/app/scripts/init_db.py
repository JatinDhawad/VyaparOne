import asyncio
import logging
from sqlalchemy.future import select

# To ensure all models are imported before creating tables
from app.models import * 
from app.core.database import engine, AsyncSessionLocal, Base
from app.models.user import Role, User, RoleName
from app.core.security import get_password_hash

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def init_db():
    logger.info("Creating database tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Tables created successfully.")

async def seed_data():
    async with AsyncSessionLocal() as session:
        # 1. Create Roles
        logger.info("Seeding roles...")
        for role_name in RoleName:
            result = await session.execute(select(Role).where(Role.name == role_name.value))
            role = result.scalars().first()
            if not role:
                new_role = Role(name=role_name.value, description=f"{role_name.value} role")
                session.add(new_role)
        
        await session.commit()
        logger.info("Roles seeded.")

        # 2. Create or Update Default Admin User
        admin_email = "admin@vyaparone.com"
        logger.info(f"Ensuring default admin user ({admin_email})...")
        
        result = await session.execute(select(User).where(User.email == admin_email))
        admin_user = result.scalars().first()
        
        role_result = await session.execute(select(Role).where(Role.name == RoleName.ADMIN.value))
        admin_role = role_result.scalars().first()

        if not admin_user:
            if admin_role:
                new_admin = User(
                    email=admin_email,
                    full_name="System Admin",
                    password_hash=get_password_hash("adminpassword"),
                    role_id=admin_role.id,
                    is_active=True
                )
                session.add(new_admin)
                await session.commit()
                logger.info("Default admin user created.")
        else:
            admin_user.password_hash = get_password_hash("adminpassword")
            admin_user.is_active = True
            await session.commit()
            logger.info("Default admin user password updated to adminpassword.")

async def main():
    logger.info("Starting database initialization...")
    await init_db()
    await seed_data()
    logger.info("Database initialization completed.")

if __name__ == "__main__":
    asyncio.run(main())
