from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from decimal import Decimal
import uuid

from app.core.database import get_db
from app.models.transactions import PurchaseInvoice, PurchaseItem
from app.models.company import Product
from app.models.user import User
from app.schemas.transactions import PurchaseInvoiceCreate, PurchaseInvoiceResponse
from app.services.purchase_service import create_purchase_invoice
from app.api.deps import get_current_active_user


router = APIRouter(prefix="/purchases", tags=["Purchases"])


# ── helpers ────────────────────────────────────────────────────────────────────

async def _fetch_invoice(db: AsyncSession, purchase_id: uuid.UUID) -> PurchaseInvoice:
    result = await db.execute(
        select(PurchaseInvoice)
        .options(
            selectinload(PurchaseInvoice.items).selectinload(PurchaseItem.product).selectinload(Product.stock),
            selectinload(PurchaseInvoice.supplier)
        )
        .where(PurchaseInvoice.id == purchase_id)
    )
    invoice = result.scalars().first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Purchase invoice not found.")
    return invoice


# ── Create ─────────────────────────────────────────────────────────────────────

@router.post("", response_model=PurchaseInvoiceResponse, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=PurchaseInvoiceResponse, status_code=status.HTTP_201_CREATED)
async def create_purchase(
    invoice_in: PurchaseInvoiceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Create a new purchase invoice. All authenticated users."""
    try:
        invoice = await create_purchase_invoice(db, invoice_in, created_by=current_user.id)
        return await _fetch_invoice(db, invoice.id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# ── List ───────────────────────────────────────────────────────────────────────

@router.get("", response_model=List[PurchaseInvoiceResponse])
@router.get("/", response_model=List[PurchaseInvoiceResponse])
async def list_purchases(
    skip: int = 0,
    limit: int = 100,
    supplier_id: Optional[uuid.UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """List purchase invoices with optional supplier filter."""
    query = select(PurchaseInvoice).options(
        selectinload(PurchaseInvoice.items).selectinload(PurchaseItem.product).selectinload(Product.stock),
        selectinload(PurchaseInvoice.supplier)
    )
    if supplier_id:
        query = query.where(PurchaseInvoice.supplier_id == supplier_id)
    result = await db.execute(query.order_by(PurchaseInvoice.created_at.desc()).offset(skip).limit(limit))
    return result.scalars().all()


# ── Get Single ─────────────────────────────────────────────────────────────────

@router.get("/{purchase_id}", response_model=PurchaseInvoiceResponse)
async def get_purchase(
    purchase_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Get a single purchase invoice with items."""
    return await _fetch_invoice(db, purchase_id)


# ── Edit Purchase Bill (header-level fields only, no item re-processing) ────────

class PurchaseInvoiceEdit(BaseModel):
    """
    Editable fields on an existing purchase invoice.
    Items and stock records are NOT re-processed to preserve data integrity.
    Only financial adjustment fields and payment tracking are editable.
    """
    supplier_id: Optional[uuid.UUID] = None
    invoice_date: Optional[str] = None
    lr_charges: Optional[Decimal] = None
    local_freight: Optional[Decimal] = None
    salesman_expense: Optional[Decimal] = None
    scheme_money: Optional[Decimal] = None
    discount_deduction: Optional[Decimal] = None
    unbilled_nongst_amount: Optional[Decimal] = None
    amount_paid: Optional[Decimal] = None
    notes: Optional[str] = None


@router.patch("/{purchase_id}", response_model=PurchaseInvoiceResponse)
async def edit_purchase(
    purchase_id: uuid.UUID,
    edits: PurchaseInvoiceEdit,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Edit header-level fields of an existing purchase invoice.
    Stock levels and ledger entries are NOT recalculated — only financial
    adjustment fields (LR, freight, scheme, payment) are updated.
    """
    result = await db.execute(
        select(PurchaseInvoice).where(PurchaseInvoice.id == purchase_id)
    )
    invoice = result.scalars().first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Purchase invoice not found.")

    update_data = edits.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(invoice, field, value)

    # Recalculate total_payable_amount and pending_amount from current field values
    from decimal import Decimal as D
    subtotal = D(str(invoice.subtotal or 0))
    tax = D(str(invoice.tax_amount or 0))
    lr = D(str(invoice.lr_charges or 0))
    lf = D(str(invoice.local_freight or 0))
    se = D(str(invoice.salesman_expense or 0))
    sm = D(str(invoice.scheme_money or 0))
    dd = D(str(invoice.discount_deduction or 0))
    unbilled = D(str(invoice.unbilled_nongst_amount or 0))
    paid = D(str(invoice.amount_paid or 0))

    grand = subtotal + tax
    deductions = lr + lf + se + sm + dd
    total_payable = grand - deductions + unbilled
    pending = total_payable - paid

    invoice.total_payable_amount = round(total_payable, 2)
    invoice.pending_amount = round(pending, 2)

    await db.commit()
    return await _fetch_invoice(db, purchase_id)
