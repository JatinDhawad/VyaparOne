from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
import uuid
from decimal import Decimal

from app.core.database import get_db
from app.models.transactions import Payment
from app.models.user import RoleName, User
from app.schemas.payment import PaymentCreate, PaymentResponse
from app.services.ledger_service import post_payment_ledger
from app.api.deps import get_current_active_user

router = APIRouter(prefix="/payments", tags=["Payments & Receipts"])


@router.post("", response_model=PaymentResponse, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=PaymentResponse, status_code=status.HTTP_201_CREATED)
async def create_payment(
    payment_in: PaymentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Record a Payment (to supplier) or Receipt (from customer).
    Automatically posts to double-entry ledger and updates account balances.
    """
    if payment_in.payment_type.upper() not in ["RECEIPT", "PAYMENT"]:
        raise HTTPException(status_code=400, detail="payment_type must be RECEIPT or PAYMENT")

    existing = await db.execute(select(Payment).where(Payment.voucher_number == payment_in.voucher_number))
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="Voucher number already exists.")

    db_payment = Payment(
        voucher_number=payment_in.voucher_number,
        payment_type=payment_in.payment_type.upper(),
        party_id=payment_in.party_id,
        amount=Decimal(str(payment_in.amount)),
        payment_mode=payment_in.payment_mode.upper(),
        reference_number=payment_in.reference_number,
        payment_date=payment_in.payment_date,
        remarks=payment_in.remarks,
        created_by=current_user.id
    )
    db.add(db_payment)
    await db.flush()

    # Post double-entry ledger
    await post_payment_ledger(
        db=db,
        payment_id=db_payment.id,
        payment_type=payment_in.payment_type,
        party_id=payment_in.party_id,
        amount=Decimal(str(payment_in.amount)),
        payment_mode=payment_in.payment_mode,
        payment_date=payment_in.payment_date,
        created_by=current_user.id
    )

    await db.commit()
    await db.refresh(db_payment)
    return db_payment


@router.get("", response_model=List[PaymentResponse])
@router.get("/", response_model=List[PaymentResponse])
async def list_payments(
    skip: int = 0,
    limit: int = 100,
    party_id: Optional[uuid.UUID] = Query(None),
    payment_type: Optional[str] = Query(None, description="RECEIPT or PAYMENT"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """List payments with optional party or type filter."""
    query = select(Payment)
    if party_id:
        query = query.where(Payment.party_id == party_id)
    if payment_type:
        query = query.where(Payment.payment_type == payment_type.upper())
    result = await db.execute(query.order_by(Payment.created_at.desc()).offset(skip).limit(limit))
    return result.scalars().all()
