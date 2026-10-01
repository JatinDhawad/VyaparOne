from typing import List, Optional
from datetime import date, datetime
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
from app.schemas.transactions import PurchaseInvoiceCreate, PurchaseInvoiceResponse, PurchaseItemCreate
from app.services.purchase_service import create_purchase_invoice
from app.api.deps import get_current_active_user


router = APIRouter(prefix="/purchases", tags=["Purchases"])


# ── Supplier-Level Lump-Sum Payment ───────────────────────────────────────────

class SupplierPaymentIn(BaseModel):
    amount: Decimal
    payment_mode: str = "CASH"   # CASH, BANK, UPI, CHEQUE, NEFT
    payment_date: Optional[date] = None
    reference_number: Optional[str] = None
    remarks: Optional[str] = None


class SupplierPaymentResult(BaseModel):
    supplier_id: str
    total_paid: float
    bills_settled: int
    bills_partially_settled: int
    remaining_amount: float   # any excess after all bills are cleared
    updated_invoices: List[PurchaseInvoiceResponse]


@router.post(
    "/supplier/{supplier_id}/pay",
    response_model=SupplierPaymentResult,
    status_code=status.HTTP_200_OK,
)
async def pay_supplier_lump_sum(
    supplier_id: uuid.UUID,
    payment_in: SupplierPaymentIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Record a lump-sum payment to a supplier without tying it to any specific bill.
    The amount is automatically distributed across the supplier's oldest pending
    bills in FIFO order (oldest invoice date first).

    - Ledger entries are posted for every bill that gets settled (full or partial).
    - Supplier ledger balance is updated accordingly.
    - Any payment in excess of all outstanding dues is recorded but not applied.
    """
    pay_amt = Decimal(str(payment_in.amount or 0))
    if pay_amt <= Decimal("0.00"):
        raise HTTPException(status_code=400, detail="Payment amount must be greater than zero.")

    # Fetch all pending bills for this supplier, oldest first (FIFO)
    result = await db.execute(
        select(PurchaseInvoice)
        .options(
            selectinload(PurchaseInvoice.items).selectinload(PurchaseItem.product).selectinload(Product.stock),
            selectinload(PurchaseInvoice.supplier),
        )
        .where(
            PurchaseInvoice.supplier_id == supplier_id,
            PurchaseInvoice.pending_amount > 0,
        )
        .order_by(PurchaseInvoice.invoice_date.asc(), PurchaseInvoice.created_at.asc())
    )
    pending_invoices = result.scalars().all()

    if not pending_invoices:
        raise HTTPException(
            status_code=400,
            detail="This supplier has no pending bills. All dues are already settled.",
        )

    # Ledger helpers
    from app.services.ledger_service import get_party_ledger_account, get_or_create_system_account
    from app.models.ledger import LedgerEntry, AccountType

    supplier_account = await get_party_ledger_account(db, supplier_id)
    mode_str = (payment_in.payment_mode or "CASH").upper()
    mode_acct_name = "Bank Account" if mode_str in ["BANK", "UPI", "CHEQUE", "NEFT"] else "Cash In Hand"
    cash_account = await get_or_create_system_account(db, mode_acct_name, AccountType.ASSET.value)

    tx_date = payment_in.payment_date or date.today()

    remaining = pay_amt
    bills_settled = 0
    bills_partial = 0
    updated_invoices = []

    for invoice in pending_invoices:
        if remaining <= Decimal("0.00"):
            break

        old_pending = Decimal(str(invoice.pending_amount or 0))
        old_paid = Decimal(str(invoice.amount_paid or 0))

        if old_pending <= Decimal("0.00"):
            continue

        # How much of this bill can we pay?
        applied = min(remaining, old_pending)
        new_paid = old_paid + applied
        new_pending = max(Decimal("0.00"), old_pending - applied)

        invoice.amount_paid = round(new_paid, 2)
        invoice.pending_amount = round(new_pending, 2)

        # Count statistics
        if new_pending <= Decimal("0.00"):
            bills_settled += 1
        else:
            bills_partial += 1

        # Build narration
        narration = (
            f"Supplier payment (lump-sum) for Bill #{invoice.invoice_number} "
            f"via {mode_str}"
        )
        if payment_in.reference_number:
            narration += f" [Ref: {payment_in.reference_number}]"
        if payment_in.remarks:
            narration += f" - {payment_in.remarks}"

        # Post ledger entry
        entry = LedgerEntry(
            transaction_date=tx_date,
            voucher_type="PAYMENT",
            reference_id=invoice.id,
            debit_account_id=supplier_account.id,
            credit_account_id=cash_account.id,
            amount=applied,
            narration=narration,
            created_by=current_user.id,
        )
        db.add(entry)

        # Update ledger running balances
        supplier_account.current_balance = Decimal(str(supplier_account.current_balance or 0)) - applied
        cash_account.current_balance = Decimal(str(cash_account.current_balance or 0)) - applied

        remaining -= applied
        updated_invoices.append(invoice)

    await db.commit()

    # Re-fetch updated invoices to return fresh data
    updated_ids = [inv.id for inv in updated_invoices]
    refreshed = []
    for inv_id in updated_ids:
        r = await db.execute(
            select(PurchaseInvoice)
            .options(
                selectinload(PurchaseInvoice.items).selectinload(PurchaseItem.product).selectinload(Product.stock),
                selectinload(PurchaseInvoice.supplier),
            )
            .where(PurchaseInvoice.id == inv_id)
        )
        refreshed.append(r.scalars().first())

    total_applied = pay_amt - remaining

    return SupplierPaymentResult(
        supplier_id=str(supplier_id),
        total_paid=float(total_applied),
        bills_settled=bills_settled,
        bills_partially_settled=bills_partial,
        remaining_amount=float(remaining),
        updated_invoices=[inv for inv in refreshed if inv],
    )


@router.get("/supplier/{supplier_id}/summary")
async def get_supplier_summary(
    supplier_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Get total pending payables for a specific supplier."""
    result = await db.execute(
        select(PurchaseInvoice)
        .where(PurchaseInvoice.supplier_id == supplier_id)
        .order_by(PurchaseInvoice.invoice_date.asc())
    )
    invoices = result.scalars().all()

    total_payable = sum(float(inv.total_payable_amount or 0) for inv in invoices)
    total_paid = sum(float(inv.amount_paid or 0) for inv in invoices)
    total_pending = sum(float(inv.pending_amount or 0) for inv in invoices)
    pending_bills = [inv for inv in invoices if float(inv.pending_amount or 0) > 0]

    return {
        "supplier_id": str(supplier_id),
        "total_invoices": len(invoices),
        "total_payable": round(total_payable, 2),
        "total_paid": round(total_paid, 2),
        "total_pending": round(total_pending, 2),
        "pending_bills_count": len(pending_bills),
        "pending_bills": [
            {
                "id": str(inv.id),
                "invoice_number": inv.invoice_number,
                "invoice_date": str(inv.invoice_date),
                "total_payable_amount": float(inv.total_payable_amount or 0),
                "amount_paid": float(inv.amount_paid or 0),
                "pending_amount": float(inv.pending_amount or 0),
            }
            for inv in pending_bills
        ],
    }


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


# ── Edit Purchase Bill & Stock Adjustment ──────────────────────────────────────

class PurchaseInvoiceEdit(BaseModel):
    """
    Editable fields on an existing purchase invoice.
    Can edit financial adjustments and optionally replace items / reconcile stock.
    """
    supplier_id: Optional[uuid.UUID] = None
    invoice_date: Optional[date] = None
    lr_charges: Optional[Decimal] = None
    local_freight: Optional[Decimal] = None
    salesman_expense: Optional[Decimal] = None
    scheme_money: Optional[Decimal] = None
    discount_deduction: Optional[Decimal] = None
    unbilled_nongst_amount: Optional[Decimal] = None
    amount_paid: Optional[Decimal] = None
    notes: Optional[str] = None
    items: Optional[List[PurchaseItemCreate]] = None


@router.patch("/{purchase_id}", response_model=PurchaseInvoiceResponse)
async def edit_purchase(
    purchase_id: uuid.UUID,
    edits: PurchaseInvoiceEdit,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Edit header-level fields and/or stock items on an existing purchase invoice.
    If items are provided:
    1. Reverses previous stock contributions for this bill.
    2. Deletes previous PurchaseItem records.
    3. Creates new PurchaseItem records and updates GodownStock (with bag-to-packet conversion).
    4. Recalculates official billed grand total, deductions, total payable (floored at ₹0),
       and distributes any excess credit to other pending bills (FIFO).
    """
    from decimal import Decimal as D
    from app.services.inventory_service import add_purchase_stock
    from app.models.company import GodownStock

    result = await db.execute(
        select(PurchaseInvoice).where(PurchaseInvoice.id == purchase_id)
    )
    invoice = result.scalars().first()
    if not invoice:
        raise HTTPException(status_code=404, detail="Purchase invoice not found.")

    # ── Item & Stock Re-processing (if items provided) ─────────────────────────
    if edits.items is not None:
        if not edits.items:
            raise HTTPException(status_code=400, detail="At least one item is required.")

        # 1. Reverse stock for existing items
        existing_items_result = await db.execute(
            select(PurchaseItem).where(PurchaseItem.purchase_invoice_id == purchase_id)
        )
        existing_items = existing_items_result.scalars().all()

        for old_item in existing_items:
            stock_result = await db.execute(
                select(GodownStock).where(GodownStock.product_id == old_item.product_id)
            )
            stock = stock_result.scalars().first()
            if stock:
                prod_result = await db.execute(
                    select(Product).where(Product.id == old_item.product_id)
                )
                prod = prod_result.scalars().first()
                ppb = D(str(prod.packets_per_bag or 0)) if prod else D("0")

                billed_qty = D(str(old_item.billed_quantity or 0))
                free_qty = D(str(old_item.free_quantity or 0))
                total_qty = billed_qty + free_qty

                stock_qty_to_reverse = (total_qty * ppb) if ppb > 1 else total_qty
                stock.current_stock = max(
                    D("0.00"),
                    D(str(stock.current_stock or 0)) - stock_qty_to_reverse
                )

            await db.delete(old_item)

        await db.flush()

        # 2. Add new items and increment stock
        subtotal = D("0.00")
        total_tax = D("0.00")
        total_discount = D("0.00")

        for item_in in edits.items:
            product_id = item_in.product_id

            if not product_id:
                p_query = select(Product)
                if item_in.hsn_code:
                    p_query = p_query.where(Product.hsn_code == item_in.hsn_code)
                if item_in.product_name:
                    p_query = p_query.where(Product.name == item_in.product_name)
                p_res = await db.execute(p_query)
                existing_prod = p_res.scalars().first()
                if existing_prod:
                    product_id = existing_prod.id
                else:
                    new_product = Product(
                        name=item_in.product_name or f"Product {item_in.hsn_code}",
                        hsn_code=item_in.hsn_code or "21069030",
                        sku=f"{item_in.hsn_code or 'UNK'}-{uuid.uuid4().hex[:4]}",
                        unit=item_in.unit or "BAG",
                        default_purchase_price=D(str(item_in.unit_purchase_price)),
                        default_selling_price=D(str(item_in.unit_purchase_price)) * D("1.25"),
                        gst_rate=D(str(item_in.gst_rate or 0)),
                        min_stock_alert=0
                    )
                    db.add(new_product)
                    await db.flush()
                    product_id = new_product.id
                    new_stock = GodownStock(product_id=product_id, current_stock=D("0.00"))
                    db.add(new_stock)
                    await db.flush()

            billed_qty = D(str(item_in.billed_quantity))
            free_qty = D(str(item_in.free_quantity or 0))
            unit_price = D(str(item_in.unit_purchase_price))
            disc_amt = D(str(item_in.discount_amount or 0))
            gst_rate = D(str(item_in.gst_rate or 0))

            total_qty = billed_qty + free_qty
            line_subtotal = (billed_qty * unit_price) - disc_amt
            effective_unit_cost = line_subtotal / total_qty if total_qty > 0 else unit_price
            gst_amount = line_subtotal * (gst_rate / D("100.00"))
            line_total = line_subtotal + gst_amount

            subtotal += (billed_qty * unit_price)
            total_discount += disc_amt
            total_tax += gst_amount

            new_item = PurchaseItem(
                purchase_invoice_id=purchase_id,
                product_id=product_id,
                billed_quantity=billed_qty,
                free_quantity=free_qty,
                unit_purchase_price=unit_price,
                discount_amount=disc_amt,
                gst_rate=gst_rate,
                gst_amount=gst_amount,
                allocated_additional_cost=D("0.00"),
                effective_unit_landed_cost=round(effective_unit_cost, 2),
                line_total=round(line_total, 2),
            )
            db.add(new_item)

            # Add stock with bag-to-packet conversion
            prod_result = await db.execute(select(Product).where(Product.id == product_id))
            prod = prod_result.scalars().first()
            ppb = D(str(prod.packets_per_bag or 0)) if prod else D("0")

            if ppb > 1:
                stock_qty = total_qty * ppb
                stock_cost = effective_unit_cost / ppb
            else:
                stock_qty = total_qty
                stock_cost = effective_unit_cost

            await add_purchase_stock(db, product_id, stock_qty, round(stock_cost, 2))

        net_subtotal = subtotal - total_discount
        invoice.subtotal = round(net_subtotal, 2)
        invoice.tax_amount = round(total_tax, 2)
        invoice.grand_total = round(net_subtotal + total_tax, 2)

    # ── Update header fields if provided ──────────────────────────────────────
    update_data = edits.model_dump(exclude_unset=True, exclude={"items"})
    for field, value in update_data.items():
        setattr(invoice, field, value)

    # ── Recalculate totals with floor at 0 and FIFO distribution ──────────────
    subtotal_val = D(str(invoice.subtotal or 0))
    tax_val = D(str(invoice.tax_amount or 0))
    lr = D(str(invoice.lr_charges or 0))
    lf = D(str(invoice.local_freight or 0))
    se = D(str(invoice.salesman_expense or 0))
    sm = D(str(invoice.scheme_money or 0))
    dd = D(str(invoice.discount_deduction or 0))
    unbilled = D(str(invoice.unbilled_nongst_amount or 0))
    paid = D(str(invoice.amount_paid or 0))

    grand = subtotal_val + tax_val
    deductions = lr + lf + se + sm + dd
    total_payable_raw = grand - deductions + unbilled

    excess_credit = D("0.00")
    if total_payable_raw < D("0.00"):
        excess_credit = abs(total_payable_raw)
        total_payable_raw = D("0.00")

    total_payable = total_payable_raw
    pending = max(D("0.00"), total_payable - paid)

    invoice.total_payable_amount = round(total_payable, 2)
    invoice.pending_amount = round(pending, 2)

    # ── Distribute excess credit to other pending bills (FIFO) ─────────────────
    if excess_credit > D("0.00"):
        from app.services.ledger_service import get_party_ledger_account, get_or_create_system_account
        from app.models.ledger import LedgerEntry, AccountType

        other_bills_result = await db.execute(
            select(PurchaseInvoice)
            .where(
                PurchaseInvoice.supplier_id == invoice.supplier_id,
                PurchaseInvoice.id != invoice.id,
                PurchaseInvoice.pending_amount > 0,
            )
            .order_by(PurchaseInvoice.invoice_date.asc(), PurchaseInvoice.created_at.asc())
        )
        other_bills = other_bills_result.scalars().all()

        if other_bills:
            supplier_account = await get_party_ledger_account(db, invoice.supplier_id)
            cash_account = await get_or_create_system_account(db, "Cash In Hand", AccountType.ASSET.value)
            remaining_credit = excess_credit

            for other_inv in other_bills:
                if remaining_credit <= D("0.00"):
                    break
                other_pending = D(str(other_inv.pending_amount or 0))
                if other_pending <= D("0.00"):
                    continue

                applied = min(remaining_credit, other_pending)
                other_inv.amount_paid = round(D(str(other_inv.amount_paid or 0)) + applied, 2)
                other_inv.pending_amount = round(max(D("0.00"), other_pending - applied), 2)

                ledger_entry = LedgerEntry(
                    transaction_date=date.today(),
                    voucher_type="PAYMENT",
                    reference_id=other_inv.id,
                    debit_account_id=supplier_account.id,
                    credit_account_id=cash_account.id,
                    amount=applied,
                    narration=(
                        f"Credit from excess deduction on Bill #{invoice.invoice_number} "
                        f"applied to Bill #{other_inv.invoice_number}"
                    ),
                    created_by=current_user.id,
                )
                db.add(ledger_entry)
                supplier_account.current_balance = D(str(supplier_account.current_balance or 0)) - applied
                cash_account.current_balance = D(str(cash_account.current_balance or 0)) - applied
                remaining_credit -= applied

    await db.commit()
    return await _fetch_invoice(db, purchase_id)


class AdjustItemsPayload(BaseModel):
    items: List[PurchaseItemCreate]


@router.post("/{purchase_id}/adjust-items", response_model=PurchaseInvoiceResponse)
async def adjust_purchase_items(
    purchase_id: uuid.UUID,
    payload: AdjustItemsPayload,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Convenience endpoint to adjust items and stock on an existing purchase bill."""
    return await edit_purchase(
        purchase_id=purchase_id,
        edits=PurchaseInvoiceEdit(items=payload.items),
        db=db,
        current_user=current_user,
    )



class PurchasePaymentIn(BaseModel):
    amount: Decimal
    payment_mode: str = "CASH"  # CASH, BANK, UPI, CHEQUE, NEFT
    payment_date: Optional[date] = None
    reference_number: Optional[str] = None
    remarks: Optional[str] = None


@router.post("/{purchase_id}/pay", response_model=PurchaseInvoiceResponse)
async def record_purchase_payment(
    purchase_id: uuid.UUID,
    payment_in: PurchasePaymentIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Record a part or full payment against a purchase bill.
    Automatically updates amount_paid, pending_amount, posts a double-entry PAYMENT ledger entry,
    and updates the supplier's ledger balance.
    """
    invoice = await _fetch_invoice(db, purchase_id)

    pay_amt = Decimal(str(payment_in.amount or 0))
    if pay_amt <= Decimal("0.00"):
        raise HTTPException(status_code=400, detail="Payment amount must be greater than zero.")

    old_paid = Decimal(str(invoice.amount_paid or 0))
    payable = Decimal(str(invoice.total_payable_amount or invoice.grand_total or 0))

    new_paid = old_paid + pay_amt
    new_pending = max(Decimal("0.00"), payable - new_paid)

    invoice.amount_paid = round(new_paid, 2)
    invoice.pending_amount = round(new_pending, 2)

    # Post double-entry PAYMENT ledger entry
    from app.services.ledger_service import get_party_ledger_account, get_or_create_system_account
    from app.models.ledger import LedgerEntry, AccountType

    supplier_account = await get_party_ledger_account(db, invoice.supplier_id)
    mode_str = (payment_in.payment_mode or "CASH").upper()
    mode_acct_name = "Bank Account" if mode_str in ["BANK", "UPI", "CHEQUE", "NEFT"] else "Cash In Hand"
    cash_account = await get_or_create_system_account(db, mode_acct_name, AccountType.ASSET.value)

    tx_date = payment_in.payment_date or date.today()
    narration = f"Payment to supplier for Bill #{invoice.invoice_number} ({mode_str})"
    if payment_in.reference_number:
        narration += f" [Ref: {payment_in.reference_number}]"
    if payment_in.remarks:
        narration += f" - {payment_in.remarks}"

    entry_payment = LedgerEntry(
        transaction_date=tx_date,
        voucher_type="PAYMENT",
        reference_id=invoice.id,
        debit_account_id=supplier_account.id,
        credit_account_id=cash_account.id,
        amount=pay_amt,
        narration=narration,
        created_by=current_user.id
    )
    db.add(entry_payment)

    # Update ledger balances
    supplier_account.current_balance = Decimal(str(supplier_account.current_balance or 0)) - pay_amt
    cash_account.current_balance = Decimal(str(cash_account.current_balance or 0)) - pay_amt

    await db.commit()
    return await _fetch_invoice(db, purchase_id)
