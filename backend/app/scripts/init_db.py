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
        
    # Auto-migrate new columns safely in a SEPARATE transaction
    # PostgreSQL aborts the entire transaction if a query fails, 
    # so catching the exception in Python doesn't prevent the rollback!
    from sqlalchemy import text

    # Existing column
    try:
        async with engine.begin() as conn:
            await conn.execute(text("ALTER TABLE purchase_invoices ADD COLUMN discount_deduction NUMERIC(15, 2) DEFAULT 0.00;"))
            logger.info("Added discount_deduction column.")
    except Exception:
        pass

    # New POS fields for sales_invoices
    new_sales_columns = [
        ("gst_billed_amount",   "NUMERIC(12, 2) DEFAULT 0.00"),
        ("without_gst_amount",  "NUMERIC(12, 2) DEFAULT 0.00"),
        ("lr_charges",          "NUMERIC(12, 2) DEFAULT 0.00"),
        ("local_freight",       "NUMERIC(12, 2) DEFAULT 0.00"),
        ("scheme_money",        "NUMERIC(12, 2) DEFAULT 0.00"),
        ("amount_paid",         "NUMERIC(12, 2) DEFAULT 0.00"),
        ("pending_amount",      "NUMERIC(12, 2) DEFAULT 0.00"),
        ("payment_mode",        "VARCHAR(30) DEFAULT 'CASH'"),
        ("location",            "VARCHAR(150)"),
    ]
    for col_name, col_def in new_sales_columns:
        try:
            async with engine.begin() as conn:
                await conn.execute(text(f"ALTER TABLE sales_invoices ADD COLUMN {col_name} {col_def};"))
                logger.info(f"Added sales_invoices.{col_name} column.")
        except Exception:
            pass  # Column already exists

    # New field on products table
    try:
        async with engine.begin() as conn:
            await conn.execute(text("ALTER TABLE products ADD COLUMN packets_per_bag INTEGER DEFAULT 0;"))
            logger.info("Added products.packets_per_bag column.")
    except Exception:
        pass  # Already exists

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
