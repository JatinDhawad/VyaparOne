from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
import uuid

from app.core.database import get_db
from app.models.transactions import PurchaseInvoice
from app.models.user import RoleName, User
from app.schemas.transactions import PurchaseInvoiceCreate, PurchaseInvoiceResponse
from app.services.purchase_service import create_purchase_invoice
from app.api.deps import get_current_active_user, require_role

router = APIRouter(prefix="/purchases", tags=["Purchases"])


@router.post("/", response_model=PurchaseInvoiceResponse, status_code=status.HTTP_201_CREATED)
async def create_purchase(
    invoice_in: PurchaseInvoiceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Create a new purchase invoice.
    All authenticated users can create purchase bills.
    """
    try:
        invoice = await create_purchase_invoice(db, invoice_in, created_by=current_user.id)
        return invoice
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/", response_model=List[PurchaseInvoiceResponse])
async def list_purchases(
    skip: int = 0,
    limit: int = 100,
    supplier_id: Optional[uuid.UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """List purchase invoices with optional supplier filter."""
    query = select(PurchaseInvoice).options(selectinload(PurchaseInvoice.items))
    if supplier_id:
        query = query.where(PurchaseInvoice.supplier_id == supplier_id)
    result = await db.execute(query.order_by(PurchaseInvoice.created_at.desc()).offset(skip).limit(limit))
    return result.scalars().all()


@router.get("/{purchase_id}", response_model=PurchaseInvoiceResponse)
async def get_purchase(
    purchase_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Get a single purchase invoice with items."""
    result = await db.execute(
        select(PurchaseInvoice)
        .options(selectinload(PurchaseInvoice.items))
        .where(PurchaseInvoice.id == purchase_id)
    )
    invoice = result.scalars().first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Purchase invoice not found.")
    return invoice
