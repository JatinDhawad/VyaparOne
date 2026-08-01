from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
import uuid

from app.core.database import get_db
from app.models.transactions import SalesInvoice
from app.models.user import RoleName, User
from app.schemas.transactions import SalesInvoiceCreate, SalesInvoiceResponse
from app.services.sales_service import create_sales_invoice
from app.api.deps import get_current_active_user, require_role

router = APIRouter(prefix="/sales", tags=["Sales"])


@router.post("/", response_model=SalesInvoiceResponse, status_code=status.HTTP_201_CREATED)
async def create_sales(
    invoice_in: SalesInvoiceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Create a new sales invoice.
    All authenticated users can create sales bills.
    """
    try:
        invoice = await create_sales_invoice(db, invoice_in, created_by=current_user.id)
        return invoice
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/", response_model=List[SalesInvoiceResponse])
async def list_sales(
    skip: int = 0,
    limit: int = 100,
    customer_id: Optional[uuid.UUID] = Query(None),
    salesman_id: Optional[uuid.UUID] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """List sales invoices with optional customer/salesman filter."""
    query = select(SalesInvoice).options(selectinload(SalesInvoice.items))
    if customer_id:
        query = query.where(SalesInvoice.customer_id == customer_id)
    if salesman_id:
        query = query.where(SalesInvoice.salesman_id == salesman_id)
    result = await db.execute(query.order_by(SalesInvoice.created_at.desc()).offset(skip).limit(limit))
    return result.scalars().all()


@router.get("/{sales_id}", response_model=SalesInvoiceResponse)
async def get_sales(
    sales_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Get a single sales invoice with items."""
    result = await db.execute(
        select(SalesInvoice)
        .options(selectinload(SalesInvoice.items))
        .where(SalesInvoice.id == sales_id)
    )
    invoice = result.scalars().first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Sales invoice not found.")
    return invoice
