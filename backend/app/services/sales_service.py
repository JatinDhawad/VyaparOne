from decimal import Decimal
import uuid
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.models.transactions import SalesInvoice, SalesItem
from app.models.party import Party
from app.models.company import GodownStock
from app.schemas.transactions import SalesInvoiceCreate
from app.services.inventory_service import deduct_sales_stock
from app.services.ledger_service import post_sales_ledger


async def create_sales_invoice(
    db: AsyncSession,
    invoice_in: SalesInvoiceCreate,
    created_by: Optional[uuid.UUID] = None
) -> SalesInvoice:
    """
    Creates a sales invoice:
    1. Checks stock availability for all items.
    2. Fetches average landed cost per product to calculate line profit and total cost of goods.
    3. Deducts stock from GodownStock.
    4. Calculates line totals, invoice grand total, salesman commission, net profit.
    5. Saves SalesInvoice & SalesItem records.
    6. Posts double-entry ledger records (Debit Customer Account, Credit Sales Account).
    """
    # 1. Check customer exists
    c_res = await db.execute(select(Party).where(Party.id == invoice_in.customer_id))
    customer = c_res.scalars().first()
    if not customer:
        raise ValueError(f"Customer with ID {invoice_in.customer_id} not found.")

    subtotal = Decimal("0.00")
    total_discount = Decimal("0.00")
    total_tax = Decimal("0.00")
    total_cost_of_goods = Decimal("0.00")
    delivery_charges = Decimal(str(invoice_in.delivery_charges or 0))
    salesman_commission = Decimal(str(invoice_in.salesman_commission or 0))

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
        # Selling prices are GST-inclusive — do NOT add GST on top.
        # gst_amount is stored as 0 for reference only.
        gst_amount = Decimal("0.00")
        line_total = line_subtotal

        line_cogs = qty * unit_cost
        line_profit = line_subtotal - line_cogs

        subtotal += (qty * unit_price)
        total_discount += disc_amt
        total_tax += gst_amount  # always 0
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

    net_subtotal = subtotal - total_discount
    # Prices are GST-inclusive: grand_total = net_subtotal + delivery_charges only.
    grand_total = net_subtotal + delivery_charges
    net_profit = (net_subtotal - total_cost_of_goods) - salesman_commission

    # 2. Save Sales Invoice
    db_invoice = SalesInvoice(
        invoice_number=invoice_in.invoice_number,
        customer_id=invoice_in.customer_id,
        salesman_id=invoice_in.salesman_id,
        invoice_date=invoice_in.invoice_date,
        billing_mode=invoice_in.billing_mode,
        subtotal=round(subtotal, 2),
        discount_amount=round(total_discount, 2),
        tax_amount=round(total_tax, 2),
        delivery_charges=round(delivery_charges, 2),
        salesman_commission=round(salesman_commission, 2),
        grand_total=round(grand_total, 2),
        total_cost_of_goods=round(total_cost_of_goods, 2),
        net_profit=round(net_profit, 2),
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
        sales_amount=round(net_subtotal + total_tax, 2),
        grand_total=round(grand_total, 2),
        invoice_date=invoice_in.invoice_date,
        created_by=created_by
    )

    await db.commit()

    # Fetch with items loaded
    result = await db.execute(
        select(SalesInvoice)
        .options(selectinload(SalesInvoice.items))
        .where(SalesInvoice.id == db_invoice.id)
    )
    return result.scalars().first()
