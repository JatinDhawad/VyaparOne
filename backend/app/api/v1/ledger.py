from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
import uuid

from app.core.database import get_db
from app.models.ledger import LedgerAccount, LedgerEntry
from app.models.user import RoleName, User
from app.schemas.ledger import LedgerAccountCreate, LedgerAccountResponse, LedgerEntryResponse
from app.api.deps import get_current_active_user, require_role

router = APIRouter(prefix="/ledger", tags=["Ledger"])


@router.post("/accounts/", response_model=LedgerAccountResponse, status_code=status.HTTP_201_CREATED)
async def create_ledger_account(
    account_in: LedgerAccountCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([RoleName.ADMIN])),
):
    """Create a new ledger account (Chart of Accounts). ADMIN only."""
    valid_types = {"ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"}
    if account_in.account_type not in valid_types:
        raise HTTPException(status_code=400, detail=f"account_type must be one of {valid_types}")

    db_account = LedgerAccount(**account_in.model_dump())
    db.add(db_account)
    await db.commit()
    await db.refresh(db_account)
    return db_account


@router.get("/accounts/", response_model=List[LedgerAccountResponse])
async def list_ledger_accounts(
    skip: int = 0,
    limit: int = 100,
    account_type: str = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """List all ledger accounts with optional type filter. All authenticated users."""
    query = select(LedgerAccount)
    if account_type:
        query = query.where(LedgerAccount.account_type == account_type.upper())
    result = await db.execute(query.offset(skip).limit(limit))
    return result.scalars().all()


@router.get("/accounts/{account_id}", response_model=LedgerAccountResponse)
async def get_ledger_account(
    account_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Get a single ledger account by ID."""
    result = await db.execute(select(LedgerAccount).where(LedgerAccount.id == account_id))
    account = result.scalars().first()
    if not account:
        raise HTTPException(status_code=404, detail="Ledger account not found.")
    return account


@router.get("/accounts/{account_id}/entries", response_model=List[LedgerEntryResponse])
async def get_ledger_account_entries(
    account_id: uuid.UUID,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Get all journal entries for a ledger account (debit or credit side)."""
    result = await db.execute(
        select(LedgerEntry)
        .where(
            (LedgerEntry.debit_account_id == account_id) |
            (LedgerEntry.credit_account_id == account_id)
        )
        .order_by(LedgerEntry.transaction_date.desc())
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()
