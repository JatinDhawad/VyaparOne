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

        # The seed password must be supplied via the ADMIN_SEED_PASSWORD
        # environment variable. This script will abort if it is not set,
        # rather than silently using a hardcoded insecure value.
        import os as _os
        _seed_password = _os.environ.get("ADMIN_SEED_PASSWORD", "").strip()
        if not _seed_password:
            raise ValueError(
                "ADMIN_SEED_PASSWORD environment variable is not set. "
                "Set it before running the seed script, e.g.: "
                "ADMIN_SEED_PASSWORD=<strong-password> python -m app.scripts.init_db"
            )

        result = await session.execute(select(User).where(User.email == admin_email))
        admin_user = result.scalars().first()
        
        role_result = await session.execute(select(Role).where(Role.name == RoleName.ADMIN.value))
        admin_role = role_result.scalars().first()

        if not admin_user:
            if admin_role:
                new_admin = User(
                    email=admin_email,
                    full_name="System Admin",
                    password_hash=get_password_hash(_seed_password),
                    role_id=admin_role.id,
                    is_active=True
                )
                session.add(new_admin)
                await session.commit()
                logger.info("Default admin user created.")
        else:
            admin_user.password_hash = get_password_hash(_seed_password)
            admin_user.is_active = True
            await session.commit()
            logger.info("Default admin user password updated via ADMIN_SEED_PASSWORD.")

        # 3. Auto-backfill missing POS payment receipts & reconcile ledger balances
        try:
            from decimal import Decimal
            from app.models.transactions import SalesInvoice
            from app.models.ledger import LedgerAccount, LedgerEntry, AccountType
            from app.services.ledger_service import get_party_ledger_account, get_or_create_system_account
            from sqlalchemy import func

            # Check sales invoices with amount_paid > 0
            sales_res = await session.execute(
                select(SalesInvoice).where(SalesInvoice.amount_paid > 0)
            )
            invoices_with_payment = sales_res.scalars().all()

            for inv in invoices_with_payment:
                # Check if RECEIPT entry exists
                receipt_check = await session.execute(
                    select(LedgerEntry).where(
                        LedgerEntry.reference_id == inv.id,
                        LedgerEntry.voucher_type == "RECEIPT"
                    )
                )
                if not receipt_check.scalars().first():
                    pm = getattr(inv, 'payment_mode', 'CASH') or 'CASH'
                    mode_acct_name = "Bank Account" if pm.upper() in ["BANK", "UPI", "CHEQUE", "NEFT"] else "Cash In Hand"
                    cash_acct = await get_or_create_system_account(session, mode_acct_name, AccountType.ASSET.value)
                    cust_acct = await get_party_ledger_account(session, inv.customer_id)

                    paid_amt = Decimal(str(inv.amount_paid))
                    entry = LedgerEntry(
                        transaction_date=inv.invoice_date,
                        voucher_type="RECEIPT",
                        reference_id=inv.id,
                        debit_account_id=cash_acct.id,
                        credit_account_id=cust_acct.id,
                        amount=paid_amt,
                        narration=f"POS payment received ({pm})",
                        created_by=inv.created_by
                    )
                    session.add(entry)
                    logger.info(f"Backfilled missing RECEIPT of ₹{paid_amt} for invoice {inv.invoice_number}")

            await session.commit()

            # Reconcile all ledger balances based on actual entries
            acct_res = await session.execute(select(LedgerAccount))
            accounts = acct_res.scalars().all()
            for acct in accounts:
                dr_res = await session.execute(
                    select(func.coalesce(func.sum(LedgerEntry.amount), 0))
                    .where(LedgerEntry.debit_account_id == acct.id)
                )
                total_dr = Decimal(str(dr_res.scalar()))

                cr_res = await session.execute(
                    select(func.coalesce(func.sum(LedgerEntry.amount), 0))
                    .where(LedgerEntry.credit_account_id == acct.id)
                )
                total_cr = Decimal(str(cr_res.scalar()))

                if acct.account_type in [AccountType.LIABILITY.value, AccountType.REVENUE.value]:
                    acct.current_balance = total_cr - total_dr
                else:
                    acct.current_balance = total_dr - total_cr

            await session.commit()
            logger.info("Ledger balances reconciled successfully.")

            # 4. Clean up demo products, normalize product names, and sync real inventory stock dynamically
            from app.models.company import Product, GodownStock
            from app.models.transactions import PurchaseItem, SalesItem
            from sqlalchemy.orm import selectinload

            prods_res = await session.execute(select(Product).options(selectinload(Product.stock)))
            for p in prods_res.scalars().all():
                # Delete demo products if they still exist
                if "Everest Spices" in p.name or "Raja Sweet Supari" in p.name:
                    if p.stock:
                        await session.delete(p.stock)
                    await session.delete(p)
                    continue

                # Clean product names (remove brackets/nicknames)
                if "Special Gold" in p.name:
                    p.name = "Mouth Freshener @ 5"
                elif "Silver Mint" in p.name:
                    p.name = "Mouth Freshener @ 1"
                elif "Royal Diamond" in p.name:
                    p.name = "Sweet Supari @ 1"

                # Dynamic stock sync from actual purchase and sales items
                ppb = p.packets_per_bag or 1
                if ppb > 1:
                    p.unit = "PKT"

                p_items_res = await session.execute(select(PurchaseItem).where(PurchaseItem.product_id == p.id))
                p_items = p_items_res.scalars().all()
                total_purchased_units = sum(Decimal(str(it.billed_quantity or 0)) + Decimal(str(it.free_quantity or 0)) for it in p_items)
                total_purchased_cost = sum(Decimal(str(it.line_total or 0)) for it in p_items)

                s_items_res = await session.execute(select(SalesItem).where(SalesItem.product_id == p.id))
                s_items = s_items_res.scalars().all()
                total_sold_pkts = sum(Decimal(str(it.quantity or 0)) for it in s_items)

                total_pkts = total_purchased_units * Decimal(str(ppb))
                cost_per_pkt = (total_purchased_cost / total_pkts) if total_pkts > 0 else Decimal("0")
                new_stock_qty = max(Decimal("0"), total_pkts - total_sold_pkts)

                if p.stock:
                    p.stock.current_stock = new_stock_qty
                    p.stock.average_landed_cost = round(cost_per_pkt, 4)

            await session.commit()
            logger.info("Stock and product names synced dynamically from actual transactions.")
        except Exception as e:
            logger.error(f"Auto-backfill/reconciliation warning: {e}")

async def main():
    logger.info("Starting database initialization...")
    await init_db()
    await seed_data()
    logger.info("Database initialization completed.")

if __name__ == "__main__":
    asyncio.run(main())
