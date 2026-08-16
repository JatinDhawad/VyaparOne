from decimal import Decimal
import uuid
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.models.transactions import SalesInvoice, SalesItem
from app.models.party import Party
from app.schemas.transactions import SalesInvoiceCreate
from app.services.inventory_service import deduct_sales_stock
from app.services.ledger_service import post_sales_ledger


async def create_sales_invoice(
    db: AsyncSession,
    invoice_in: SalesInvoiceCreate,
    created_by: Optional[uuid.UUID] = None
) -> SalesInvoice:
    """
    Creates a sales invoice.

    Calculation logic:
      - Selling prices are ALREADY GST-inclusive — no extra GST is added.
      - Gross Goods Amount = Σ (qty × unit_price)
      - Grand Total = Gross Goods Amount - Total Deductions
        where Total Deductions = LR charges + Local freight + Salesman commission + Scheme money
      - Pending Amount = Grand Total - Amount Paid
      - gst_billed_amount / without_gst_amount are informational split records only.
    """
    # 1. Verify customer exists
    c_res = await db.execute(select(Party).where(Party.id == invoice_in.customer_id))
    customer = c_res.scalars().first()
    if not customer:
        raise ValueError(f"Customer with ID {invoice_in.customer_id} not found.")

    # --- Line-item calculations ---
    subtotal = Decimal("0.00")
    total_discount = Decimal("0.00")
    total_cost_of_goods = Decimal("0.00")

    db_items = []

    for item_in in invoice_in.items:
        qty = Decimal(str(item_in.quantity))
        unit_price = Decimal(str(item_in.unit_selling_price))
        disc_amt = Decimal(str(item_in.discount_amount or 0))
        gst_rate = Decimal(str(item_in.gst_rate or 0))

        # Deduct stock & get current average landed cost
        stock = await deduct_sales_stock(db, item_in.product_id, qty)
        unit_cost = Decimal(str(stock.average_landed_cost or 0))

        line_subtotal = (qty * unit_price) - disc_amt
        # Prices are GST-inclusive — do NOT re-add tax
        gst_amount = Decimal("0.00")
        line_total = line_subtotal

        line_cogs = qty * unit_cost
        line_profit = line_subtotal - line_cogs

        subtotal += (qty * unit_price)
        total_discount += disc_amt
        total_cost_of_goods += line_cogs

        db_item = SalesItem(
            product_id=item_in.product_id,
            quantity=qty,
            unit_selling_price=unit_price,
            unit_landed_cost=unit_cost,
            discount_amount=disc_amt,
            gst_rate=gst_rate,
            gst_amount=gst_amount,
            line_total=round(line_total, 2),
            line_profit=round(line_profit, 2)
        )
        db_items.append(db_item)

    # --- Invoice-level deductions (all reduce the amount the buyer owes) ---
    net_subtotal = subtotal - total_discount
    delivery_charges = Decimal(str(invoice_in.delivery_charges or 0))
    salesman_commission = Decimal(str(invoice_in.salesman_commission or 0))
    lr_charges = Decimal(str(invoice_in.lr_charges or 0))
    local_freight = Decimal(str(invoice_in.local_freight or 0))
    scheme_money = Decimal(str(invoice_in.scheme_money or 0))

    total_deductions = delivery_charges + salesman_commission + lr_charges + local_freight + scheme_money

    # Grand total = gross goods amount minus all deductions
    grand_total = net_subtotal - total_deductions
    net_profit = (net_subtotal - total_cost_of_goods) - salesman_commission

    # Payment tracking
    amount_paid = Decimal(str(invoice_in.amount_paid or 0))
    pending_amount = grand_total - amount_paid

    # Auto-generate invoice number if not provided
    invoice_number = invoice_in.invoice_number
    if not invoice_number or invoice_number.strip() == "":
        invoice_number = f"INV-{uuid.uuid4().hex[:8].upper()}"

    # Informational GST split (stored for reference only)
    gst_billed_amount = Decimal(str(invoice_in.gst_billed_amount or 0))
    without_gst_amount = Decimal(str(invoice_in.without_gst_amount or 0))

    # 2. Save Sales Invoice
    db_invoice = SalesInvoice(
        invoice_number=invoice_number,
        customer_id=invoice_in.customer_id,
        salesman_id=invoice_in.salesman_id,
        invoice_date=invoice_in.invoice_date,
        billing_mode=invoice_in.billing_mode,
        location=invoice_in.location,
        subtotal=round(subtotal, 2),
        discount_amount=round(total_discount, 2),
        tax_amount=Decimal("0.00"),          # no re-added tax
        gst_billed_amount=round(gst_billed_amount, 2),
        without_gst_amount=round(without_gst_amount, 2),
        delivery_charges=round(delivery_charges, 2),
        salesman_commission=round(salesman_commission, 2),
        lr_charges=round(lr_charges, 2),
        local_freight=round(local_freight, 2),
        scheme_money=round(scheme_money, 2),
        grand_total=round(grand_total, 2),
        total_cost_of_goods=round(total_cost_of_goods, 2),
        net_profit=round(net_profit, 2),
        amount_paid=round(amount_paid, 2),
        pending_amount=round(pending_amount, 2),
        payment_mode=invoice_in.payment_mode or "CASH",
        notes=invoice_in.notes,
        created_by=created_by
    )
    db.add(db_invoice)
    await db.flush()

    for db_item in db_items:
        db_item.sales_invoice_id = db_invoice.id
        db.add(db_item)

    # 3. Post Ledger Entry
    await post_sales_ledger(
        db=db,
        sales_invoice_id=db_invoice.id,
        customer_id=invoice_in.customer_id,
        sales_amount=round(net_subtotal, 2),
        grand_total=round(grand_total, 2),
        invoice_date=invoice_in.invoice_date,
        created_by=created_by
    )

    await db.commit()

    # Fetch with relationships loaded
    result = await db.execute(
        select(SalesInvoice)
        .options(
            selectinload(SalesInvoice.items),
            selectinload(SalesInvoice.customer)
        )
        .where(SalesInvoice.id == db_invoice.id)
    )
    return result.scalars().first()
