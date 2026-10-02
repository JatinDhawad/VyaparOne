from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
import uuid
from decimal import Decimal

from app.core.database import get_db
from app.models.transactions import Payment
from app.models.user import RoleName, User
from app.schemas.payment import PaymentCreate, PaymentResponse, PaymentSyncResult
from app.services.ledger_service import post_payment_ledger
from app.services.payment_sync_service import sync_all_payments
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
    refreshed = await db.execute(
        select(Payment).options(selectinload(Payment.party)).where(Payment.id == db_payment.id)
    )
    return refreshed.scalars().first()


@router.post("/sync", response_model=PaymentSyncResult)
async def trigger_sync_payments(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Synchronize all payments done (to suppliers/purchases)
    and received (from customers/sales) into the Payment table.
    """
    result = await sync_all_payments(db)
    return PaymentSyncResult(**result)


@router.get("", response_model=List[PaymentResponse])
@router.get("/", response_model=List[PaymentResponse])
async def list_payments(
    skip: int = 0,
    limit: int = 200,
    party_id: Optional[uuid.UUID] = Query(None),
    payment_type: Optional[str] = Query(None, description="RECEIPT or PAYMENT"),
    search: Optional[str] = Query(None),
    auto_sync: bool = Query(True, description="Auto-sync payments and receipts from sales/purchases"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    List payments with optional party, type, or search filter.
    Includes party relationship and auto-syncs with latest sales and purchases.
    """
    if auto_sync:
        try:
            await sync_all_payments(db)
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"Auto-sync payments warning: {e}")

    query = select(Payment).options(selectinload(Payment.party))
    if party_id:
        query = query.where(Payment.party_id == party_id)
    if payment_type:
        query = query.where(Payment.payment_type == payment_type.upper())
    if search:
        s = f"%{search.strip()}%"
        query = query.where(
            (Payment.voucher_number.ilike(s)) |
            (Payment.remarks.ilike(s)) |
            (Payment.reference_number.ilike(s))
        )
    result = await db.execute(
        query.order_by(Payment.payment_date.desc(), Payment.created_at.desc()).offset(skip).limit(limit)
    )
    return result.scalars().all()
