import sys, os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from contextlib import asynccontextmanager
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.v1.router import api_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    import traceback
    try:
        from app.scripts.init_db import init_db, seed_data
        await init_db()
        await seed_data()
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")
        traceback.print_exc()
    yield

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

from fastapi import Request
from fastapi.responses import JSONResponse

# Global Exception Handlers
@app.exception_handler(ValueError)
async def value_error_handler(request: Request, exc: ValueError):
    return JSONResponse(
        status_code=400,
        content={"detail": str(exc)},
    )

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Global unhandled error: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc) or "Internal server error"},
    )

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/v1/health")
async def health_check():
    import traceback
    try:
        from app.scripts.init_db import engine
        from sqlalchemy import text
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
        return {"status": "ok", "database": "connected"}
    except Exception as e:
        return {"status": "error", "database": str(e), "traceback": traceback.format_exc()}

@app.get("/api/v1/debug_init_db")
async def debug_init_db():
    import traceback
    import io
    import sys
    
    old_stderr = sys.stderr
    new_stderr = io.StringIO()
    sys.stderr = new_stderr
    
    try:
        from app.scripts.init_db import init_db, seed_data
        from app.core.database import Base
        tables = list(Base.metadata.tables.keys())
        await init_db()
        await seed_data()
        output = new_stderr.getvalue()
        sys.stderr = old_stderr
        return {"status": "ok", "message": "Database initialized successfully", "tables": tables, "stderr": output}
    except Exception as e:
        import os
        from app.core.database import Base
        tables = list(Base.metadata.tables.keys())
        db_url = os.getenv("DATABASE_URL", "NOT_SET")
        output = new_stderr.getvalue()
        sys.stderr = old_stderr
        return {"status": "error", "message": str(e), "traceback": traceback.format_exc(), "tables": tables, "stderr": output, "db_url": db_url}

@app.get("/api/v1/debug_tables")
async def debug_tables():
    try:
        from app.scripts.init_db import engine
        from sqlalchemy import text
        async with engine.connect() as conn:
            result = await conn.execute(text("SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = 'public'"))
            tables_in_db = [row[0] for row in result.fetchall()]
        return {"status": "ok", "tables_in_db": tables_in_db}
    except Exception as e:
        import traceback
        return {"status": "error", "message": str(e), "traceback": traceback.format_exc()}

@app.post("/api/v1/admin/reconcile_balances")
async def reconcile_balances():
    """
    Recomputes all LedgerAccount current_balances from actual LedgerEntries.
    Fixes stale balances caused by partial wipes (invoices deleted but ledger entries kept).
    """
    import traceback
    try:
        from app.scripts.init_db import engine, AsyncSessionLocal
        from app.models.ledger import LedgerAccount, LedgerEntry
        from sqlalchemy.future import select
        from sqlalchemy import func
        from decimal import Decimal

        async with AsyncSessionLocal() as session:
            # Get all accounts
            acct_res = await session.execute(select(LedgerAccount))
            accounts = acct_res.scalars().all()

            updated = []
            for acct in accounts:
                # Sum debits
                dr_res = await session.execute(
                    select(func.coalesce(func.sum(LedgerEntry.amount), 0))
                    .where(LedgerEntry.debit_account_id == acct.id)
                )
                total_debits = Decimal(str(dr_res.scalar()))

                # Sum credits
                cr_res = await session.execute(
                    select(func.coalesce(func.sum(LedgerEntry.amount), 0))
                    .where(LedgerEntry.credit_account_id == acct.id)
                )
                total_credits = Decimal(str(cr_res.scalar()))

                # For LIABILITY accounts (suppliers): balance = credits - debits
                # For ASSET/EXPENSE accounts: balance = debits - credits
                from app.models.ledger import AccountType
                if acct.account_type in [AccountType.LIABILITY.value, AccountType.REVENUE.value]:
                    new_balance = total_credits - total_debits
                else:
                    new_balance = total_debits - total_credits

                old_balance = Decimal(str(acct.current_balance or 0))
                acct.current_balance = new_balance
                updated.append({
                    "account": acct.account_name,
                    "old_balance": str(old_balance),
                    "new_balance": str(new_balance)
                })

            await session.commit()

        return {"status": "ok", "reconciled": updated}
    except Exception as e:
        return {"status": "error", "message": str(e), "traceback": traceback.format_exc()}

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
