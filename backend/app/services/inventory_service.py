from decimal import Decimal
import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from fastapi import HTTPException, status

from app.models.company import GodownStock, Product


async def add_purchase_stock(
    db: AsyncSession,
    product_id: uuid.UUID,
    quantity: Decimal,
    effective_unit_cost: Decimal
) -> GodownStock:
    """
    Increases current stock and recalculates moving weighted average landed cost.
    New Avg Cost = [(Current Stock * Old Avg Cost) + (Purchased Qty * Effective Unit Cost)] / (Current Stock + Purchased Qty)
    """
    result = await db.execute(select(GodownStock).where(GodownStock.product_id == product_id))
    stock = result.scalars().first()

    if not stock:
        stock = GodownStock(
            product_id=product_id,
            current_stock=Decimal("0.00"),
            damaged_stock=Decimal("0.00"),
            average_landed_cost=Decimal("0.00")
        )
        db.add(stock)
        await db.flush()

    current_qty = Decimal(str(stock.current_stock or 0))
    current_avg_cost = Decimal(str(stock.average_landed_cost or 0))
    add_qty = Decimal(str(quantity))
    add_cost = Decimal(str(effective_unit_cost))

    new_total_qty = current_qty + add_qty

    if new_total_qty > 0:
        new_avg_cost = ((current_qty * current_avg_cost) + (add_qty * add_cost)) / new_total_qty
    else:
        new_avg_cost = add_cost

    stock.current_stock = new_total_qty
    stock.average_landed_cost = round(new_avg_cost, 2)

    return stock


async def deduct_sales_stock(
    db: AsyncSession,
    product_id: uuid.UUID,
    quantity: Decimal
) -> GodownStock:
    """
    Verifies stock availability and decrements current stock.
    Raises 400 Bad Request if requested_quantity > current_stock.
    """
    result = await db.execute(select(GodownStock).where(GodownStock.product_id == product_id))
    stock = result.scalars().first()

    current_qty = Decimal(str(stock.current_stock or 0)) if stock else Decimal("0.00")
    deduct_qty = Decimal(str(quantity))

    if current_qty < deduct_qty:
        # Get product name for clear error message
        p_res = await db.execute(select(Product).where(Product.id == product_id))
        product = p_res.scalars().first()
        prod_name = product.name if product else str(product_id)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Insufficient stock for '{prod_name}'. Available: {current_qty}, Requested: {deduct_qty}"
        )

    stock.current_stock = current_qty - deduct_qty
    return stock


async def restore_sales_stock(
    db: AsyncSession,
    product_id: uuid.UUID,
    quantity: Decimal
) -> GodownStock:
    """
    Restores deducted quantity back to current stock when a sales invoice is deleted or cancelled.
    """
    result = await db.execute(select(GodownStock).where(GodownStock.product_id == product_id))
    stock = result.scalars().first()

    if not stock:
        stock = GodownStock(
            product_id=product_id,
            current_stock=Decimal("0.00"),
            damaged_stock=Decimal("0.00"),
            average_landed_cost=Decimal("0.00")
        )
        db.add(stock)
        await db.flush()

    current_qty = Decimal(str(stock.current_stock or 0))
    restore_qty = Decimal(str(quantity))
    stock.current_stock = current_qty + restore_qty
    return stock

