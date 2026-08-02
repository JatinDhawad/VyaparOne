from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
import uuid

from app.core.database import get_db
from app.models.transactions import PurchaseInvoice, PurchaseItem
from app.models.company import Product
from app.models.user import User
from app.schemas.transactions import PurchaseInvoiceCreate, PurchaseInvoiceResponse
from app.services.purchase_service import create_purchase_invoice
from app.api.deps import get_current_active_user

router = APIRouter(prefix="/purchases", tags=["Purchases"])

@router.delete("/wipe_all", status_code=200)
async def wipe_all_data(db: AsyncSession = Depends(get_db)):
    from sqlalchemy import text
    try:
        await db.execute(text("DELETE FROM purchase_items;"))
        await db.execute(text("DELETE FROM purchase_invoices;"))
        await db.execute(text("DELETE FROM sales_items;"))
        await db.execute(text("DELETE FROM sales_invoices;"))
        await db.execute(text("DELETE FROM payments;"))
        await db.execute(text("DELETE FROM expenses;"))
        await db.execute(text("DELETE FROM ledger_entries;"))
        await db.execute(text("UPDATE godown_stock SET current_stock = 0;"))
        await db.commit()
        return {"status": "Wiped successfully"}
    except Exception as e:
        await db.rollback()
        return {"error": str(e)}


@router.post("", response_model=PurchaseInvoiceResponse, status_code=status.HTTP_201_CREATED)
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
        # Fetch eagerly loaded invoice
        res = await db.execute(
            select(PurchaseInvoice)
            .options(
                selectinload(PurchaseInvoice.items).selectinload(PurchaseItem.product).selectinload(Product.stock),
                selectinload(PurchaseInvoice.supplier)
            )
            .where(PurchaseInvoice.id == invoice.id)
        )
        return res.scalars().first()
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


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


@router.get("/{purchase_id}", response_model=PurchaseInvoiceResponse)
async def get_purchase(
    purchase_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Get a single purchase invoice with items."""
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
