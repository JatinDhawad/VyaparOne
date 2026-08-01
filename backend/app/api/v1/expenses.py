from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
import uuid
from decimal import Decimal

from app.core.database import get_db
from app.models.transactions import Expense
from app.models.user import RoleName, User
from app.schemas.expense import ExpenseCreate, ExpenseResponse
from app.services.ledger_service import post_expense_ledger
from app.api.deps import get_current_active_user

router = APIRouter(prefix="/expenses", tags=["Operational Expenses"])


@router.post("/", response_model=ExpenseResponse, status_code=status.HTTP_201_CREATED)
async def create_expense(
    expense_in: ExpenseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Record an operational expense (e.g., Rent, Fuel, Salaries, Maintenance).
    Automatically posts to double-entry ledger.
    """
    db_expense = Expense(
        category=expense_in.category,
        amount=Decimal(str(expense_in.amount)),
        payment_mode=expense_in.payment_mode.upper(),
        expense_date=expense_in.expense_date,
        paid_to=expense_in.paid_to,
        remarks=expense_in.remarks,
        created_by=current_user.id
    )
    db.add(db_expense)
    await db.flush()

    # Post double-entry ledger
    await post_expense_ledger(
        db=db,
        expense_id=db_expense.id,
        category=expense_in.category,
        amount=Decimal(str(expense_in.amount)),
        payment_mode=expense_in.payment_mode,
        expense_date=expense_in.expense_date,
        created_by=current_user.id
    )

    await db.commit()
    await db.refresh(db_expense)
    return db_expense


@router.get("/", response_model=List[ExpenseResponse])
async def list_expenses(
    skip: int = 0,
    limit: int = 100,
    category: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """List operational expenses with optional category filter."""
    query = select(Expense)
    if category:
        query = query.where(Expense.category == category)
    result = await db.execute(query.order_by(Expense.created_at.desc()).offset(skip).limit(limit))
    return result.scalars().all()
