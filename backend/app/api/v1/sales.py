from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
import uuid

from app.core.database import get_db
from app.models.transactions import SalesInvoice
from app.models.user import RoleName, User
from app.schemas.transactions import SalesInvoiceCreate, SalesInvoiceResponse, SalesInvoiceEdit
from app.services.sales_service import create_sales_invoice
from app.api.deps import get_current_active_user, require_role

router = APIRouter(prefix="/sales", tags=["Sales"])


@router.post("", response_model=SalesInvoiceResponse, status_code=status.HTTP_201_CREATED)
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


@router.get("", response_model=List[SalesInvoiceResponse])
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
    query = select(SalesInvoice).options(
        selectinload(SalesInvoice.items),
        selectinload(SalesInvoice.customer),
    )
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
        .options(
            selectinload(SalesInvoice.items),
            selectinload(SalesInvoice.customer),
        )
        .where(SalesInvoice.id == sales_id)
    )
    invoice = result.scalars().first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Sales invoice not found.")
    return invoice


@router.patch("/{sales_id}", response_model=SalesInvoiceResponse)
async def edit_sales(
    sales_id: uuid.UUID,
    edits: SalesInvoiceEdit,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Edit header-level and financial adjustment fields of an existing sales invoice.
    Stock levels and item rows are preserved to protect inventory records.
    """
    result = await db.execute(
        select(SalesInvoice).where(SalesInvoice.id == sales_id)
    )
    invoice = result.scalars().first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Sales invoice not found.")

    update_data = edits.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(invoice, field, value)

    # Recalculate totals
    from decimal import Decimal as D
    subtotal = D(str(invoice.subtotal or 0))
    discount = D(str(invoice.discount_amount or 0))
    net_subtotal = subtotal - discount

    lr = D(str(invoice.lr_charges or 0))
    lf = D(str(invoice.local_freight or 0))
    sc = D(str(invoice.salesman_commission or 0))
    sm = D(str(invoice.scheme_money or 0))
    dc = D(str(invoice.delivery_charges or 0))
    total_deductions = lr + lf + sc + sm + dc

    grand_total = max(D("0.00"), net_subtotal - total_deductions)
    total_cogs = D(str(invoice.total_cost_of_goods or 0))
    net_profit = (net_subtotal - total_cogs) - sc

    amount_paid = D(str(invoice.amount_paid or 0))
    pending = grand_total - amount_paid

    invoice.grand_total = round(grand_total, 2)
    invoice.net_profit = round(net_profit, 2)
    invoice.pending_amount = round(pending, 2)

    # Sync ledger entries
    try:
        from app.models.ledger import LedgerEntry, AccountType
        from app.services.ledger_service import get_party_ledger_account, get_or_create_system_account
        from sqlalchemy import func

        cust_acct = await get_party_ledger_account(db, invoice.customer_id)

        # 1. SALES ledger entry
        sales_entry_res = await db.execute(
            select(LedgerEntry).where(
                LedgerEntry.reference_id == sales_id,
                LedgerEntry.voucher_type == "SALES"
            )
        )
        sales_entry = sales_entry_res.scalars().first()
        if sales_entry:
            sales_entry.transaction_date = invoice.invoice_date
            sales_entry.amount = invoice.grand_total
            sales_entry.debit_account_id = cust_acct.id

        # 2. RECEIPT ledger entry
        receipt_entry_res = await db.execute(
            select(LedgerEntry).where(
                LedgerEntry.reference_id == sales_id,
                LedgerEntry.voucher_type == "RECEIPT"
            )
        )
        receipt_entry = receipt_entry_res.scalars().first()
        pm = getattr(invoice, 'payment_mode', 'CASH') or 'CASH'
        mode_acct_name = "Bank Account" if pm.upper() in ["BANK", "UPI", "CHEQUE", "NEFT"] else "Cash In Hand"
        cash_acct = await get_or_create_system_account(db, mode_acct_name, AccountType.ASSET.value)

        if amount_paid > 0:
            if receipt_entry:
                receipt_entry.transaction_date = invoice.invoice_date
                receipt_entry.amount = amount_paid
                receipt_entry.credit_account_id = cust_acct.id
                receipt_entry.debit_account_id = cash_acct.id
                receipt_entry.narration = f"POS payment received ({pm})"
            else:
                new_receipt = LedgerEntry(
                    transaction_date=invoice.invoice_date,
                    voucher_type="RECEIPT",
                    reference_id=sales_id,
                    debit_account_id=cash_acct.id,
                    credit_account_id=cust_acct.id,
                    amount=amount_paid,
                    narration=f"POS payment received ({pm})",
                    created_by=current_user.id
                )
                db.add(new_receipt)
        elif receipt_entry:
            await db.delete(receipt_entry)

        # Reconcile customer ledger account balance
        dr_res = await db.execute(
            select(func.coalesce(func.sum(LedgerEntry.amount), 0)).where(LedgerEntry.debit_account_id == cust_acct.id)
        )
        cr_res = await db.execute(
            select(func.coalesce(func.sum(LedgerEntry.amount), 0)).where(LedgerEntry.credit_account_id == cust_acct.id)
        )
        cust_acct.current_balance = D(str(dr_res.scalar())) - D(str(cr_res.scalar()))
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning(f"Ledger sync warning on sales edit: {e}")

    await db.commit()

    # Return refreshed invoice
    ref_res = await db.execute(
        select(SalesInvoice)
        .options(
            selectinload(SalesInvoice.items),
            selectinload(SalesInvoice.customer),
        )
        .where(SalesInvoice.id == sales_id)
    )
    return ref_res.scalars().first()

