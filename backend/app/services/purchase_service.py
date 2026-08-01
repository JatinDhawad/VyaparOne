from decimal import Decimal
import uuid
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.models.transactions import PurchaseInvoice, PurchaseItem
from app.models.party import Party
from app.models.company import Product, GodownStock
from app.schemas.transactions import PurchaseInvoiceCreate
from app.services.inventory_service import add_purchase_stock
from app.services.ledger_service import post_purchase_ledger


async def create_purchase_invoice(
    db: AsyncSession,
    invoice_in: PurchaseInvoiceCreate,
    created_by: Optional[uuid.UUID] = None
) -> PurchaseInvoice:
    """
    Creates a purchase invoice with automatic product creation & stock update:
    1. For each item: finds product by ID or HSN/SAC code + name.
       - If product does not exist, creates new Product & GodownStock.
       - If product exists, uses existing Product ID.
    2. Calculates billed subtotal, GST tax amount, billed freight, grand_total, unbilled_nongst_amount, and total_payable_amount.
    3. Saves PurchaseInvoice & PurchaseItem records.
    4. Automatically updates GodownStock (increments quantity & recalculates moving average landed cost).
    5. Posts double-entry ledger records.
    """
    # 1. Check supplier exists
    s_res = await db.execute(select(Party).where(Party.id == invoice_in.supplier_id))
    supplier = s_res.scalars().first()
    if not supplier:
        raise ValueError(f"Supplier with ID {invoice_in.supplier_id} not found.")

    subtotal = Decimal("0.00")
    total_discount = Decimal("0.00")
    total_tax = Decimal("0.00")
    freight_charges = Decimal(str(invoice_in.additional_expenses or 0))
    unbilled_nongst = Decimal(str(invoice_in.unbilled_nongst_amount or 0))

    db_items = []

    for item_in in invoice_in.items:
        product_id = item_in.product_id

        # Automatic Product Upsert: Find or Create Product
        if not product_id:
            # Search by HSN Code or Name
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
                # Create New Product Catalog Entry
                new_prod_name = item_in.product_name or f"Product {item_in.hsn_code}"
                new_hsn = item_in.hsn_code or "21069030"
                new_unit = item_in.unit or "BAG"
                
                new_product = Product(
                    name=new_prod_name,
                    hsn_code=new_hsn,
                    sku=f"{new_hsn}-{uuid.uuid4().hex[:4]}",
                    unit=new_unit,
                    default_purchase_price=Decimal(str(item_in.unit_purchase_price)),
                    default_selling_price=Decimal(str(item_in.unit_purchase_price * Decimal("1.25"))),
                    gst_rate=Decimal(str(item_in.gst_rate or 0)),
                    min_stock_alert=0
                )
                db.add(new_product)
                await db.flush()
                product_id = new_product.id

                # Initialize Stock Record
                new_stock = GodownStock(product_id=product_id, current_stock=Decimal("0.00"))
                db.add(new_stock)
                await db.flush()

        billed_qty = Decimal(str(item_in.billed_quantity))
        free_qty = Decimal(str(item_in.free_quantity or 0))
        unit_price = Decimal(str(item_in.unit_purchase_price))
        disc_amt = Decimal(str(item_in.discount_amount or 0))
        gst_rate = Decimal(str(item_in.gst_rate or 0))

        total_qty = billed_qty + free_qty
        line_subtotal = (billed_qty * unit_price) - disc_amt

        if total_qty > 0:
            effective_unit_cost = line_subtotal / total_qty
        else:
            effective_unit_cost = unit_price

        gst_amount = line_subtotal * (gst_rate / Decimal("100.00"))
        line_total = line_subtotal + gst_amount

        subtotal += (billed_qty * unit_price)
        total_discount += disc_amt
        total_tax += gst_amount

        db_item = PurchaseItem(
            product_id=product_id,
            billed_quantity=billed_qty,
            free_quantity=free_qty,
            unit_purchase_price=unit_price,
            discount_amount=disc_amt,
            gst_rate=gst_rate,
            gst_amount=gst_amount,
            allocated_additional_cost=Decimal("0.00"),
            effective_unit_landed_cost=round(effective_unit_cost, 2),
            line_total=round(line_total, 2)
        )
        db_items.append((db_item, product_id, total_qty, round(effective_unit_cost, 2)))

    net_subtotal = subtotal - total_discount
    grand_total = net_subtotal + total_tax + freight_charges  # Billed Tax Invoice Total
    total_payable = grand_total + unbilled_nongst  # Total Payable = Billed Total + Unbilled Non-GST

    # 2. Save Purchase Invoice
    db_invoice = PurchaseInvoice(
        invoice_number=invoice_in.invoice_number,
        supplier_id=invoice_in.supplier_id,
        invoice_date=invoice_in.invoice_date,
        billing_mode=invoice_in.billing_mode,
        subtotal=round(subtotal, 2),
        discount_amount=round(total_discount, 2),
        tax_amount=round(total_tax, 2),
        additional_expenses=round(freight_charges, 2),
        grand_total=round(grand_total, 2),
        unbilled_nongst_amount=round(unbilled_nongst, 2),
        total_payable_amount=round(total_payable, 2),
        notes=invoice_in.notes,
        created_by=created_by
    )
    db.add(db_invoice)
    await db.flush()

    # 3. Associate items and update inventory stock directly
    for db_item, prod_id, total_qty, unit_cost in db_items:
        db_item.purchase_invoice_id = db_invoice.id
        db.add(db_item)
        await add_purchase_stock(db, prod_id, total_qty, unit_cost)

    # 4. Post Double-Entry Ledger Entries
    await post_purchase_ledger(
        db=db,
        purchase_invoice_id=db_invoice.id,
        supplier_id=invoice_in.supplier_id,
        goods_amount=round(net_subtotal + total_tax, 2),
        freight_amount=round(freight_charges + unbilled_nongst, 2),
        grand_total=round(total_payable, 2),
        invoice_date=invoice_in.invoice_date,
        created_by=created_by
    )

    await db.commit()

    # Fetch with items loaded
    result = await db.execute(
        select(PurchaseInvoice)
        .options(selectinload(PurchaseInvoice.items))
        .where(PurchaseInvoice.id == db_invoice.id)
    )
    return result.scalars().first()
