from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from pydantic import BaseModel
from decimal import Decimal
import uuid

from app.core.database import get_db
from app.models.company import Product, GodownStock
from app.models.user import RoleName, User
from app.schemas.company import ProductCreate, ProductUpdate, ProductResponse, GodownStockResponse
from app.api.deps import get_current_active_user, require_role

router = APIRouter(prefix="/products", tags=["Products"])


@router.post("", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
async def create_product(
    product_in: ProductCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([RoleName.ADMIN])),
):
    """Create a new product SKU. ADMIN only."""
    product_data = product_in.model_dump()
    if not product_data.get("sku"):
        product_data["sku"] = product_data.get("hsn_code")

    db_product = Product(**product_data)
    db.add(db_product)
    await db.flush()  # flush to get the product ID

    # Auto-create GodownStock entry
    stock = GodownStock(product_id=db_product.id)
    db.add(stock)

    await db.commit()

    result = await db.execute(
        select(Product).options(selectinload(Product.stock)).where(Product.id == db_product.id)
    )
    return result.scalars().first()


@router.get("", response_model=List[ProductResponse])
@router.get("/", response_model=List[ProductResponse])
async def list_products(
    skip: int = 0,
    limit: int = 100,
    active_only: bool = True,
    company_id: Optional[int] = Query(None),
    category_id: Optional[int] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """List products with optional filters. All authenticated users."""
    query = select(Product).options(selectinload(Product.stock))
    if active_only:
        query = query.where(Product.is_active == True)
    if company_id is not None:
        query = query.where(Product.company_id == company_id)
    if category_id is not None:
        query = query.where(Product.category_id == category_id)
    result = await db.execute(query.offset(skip).limit(limit))
    return result.scalars().all()


@router.get("/{product_id}", response_model=ProductResponse)
async def get_product(
    product_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Get a single product with its stock level."""
    result = await db.execute(
        select(Product).options(selectinload(Product.stock)).where(Product.id == product_id)
    )
    product = result.scalars().first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found.")
    return product


@router.put("/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: uuid.UUID,
    product_in: ProductUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([RoleName.ADMIN])),
):
    """Update product details. ADMIN only."""
    result = await db.execute(
        select(Product).options(selectinload(Product.stock)).where(Product.id == product_id)
    )
    product = result.scalars().first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found.")

    for field, value in product_in.model_dump(exclude_unset=True).items():
        setattr(product, field, value)

    await db.commit()
    await db.refresh(product)
    return product


@router.get("/{product_id}/stock", response_model=GodownStockResponse)
async def get_product_stock(
    product_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Get real-time stock level for a product."""
    result = await db.execute(select(GodownStock).where(GodownStock.product_id == product_id))
    stock = result.scalars().first()
    if not stock:
        raise HTTPException(status_code=404, detail="Stock record not found for this product.")
    return stock


# ── Bags-to-Packets Breakdown ──────────────────────────────────────────────────

class UnpackBagsRequest(BaseModel):
    bags_to_unpack: Decimal
    packets_per_bag: int                        # e.g. 480, 300, 240
    packet_product_id: Optional[uuid.UUID] = None  # if unpacking into a SEPARATE packet SKU


class UnpackBagsResponse(BaseModel):
    message: str
    bags_deducted: Decimal
    packets_added: Decimal
    new_bag_stock: Decimal
    packet_unit_landed_cost: Decimal


@router.post("/{product_id}/unpack", response_model=UnpackBagsResponse)
async def unpack_bags_to_packets(
    product_id: uuid.UUID,
    body: UnpackBagsRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Breaks down bags into loose packets for a product.

    Logic:
      1. Deducts `bags_to_unpack` from the BAG product stock.
      2. Computes packet_unit_landed_cost = bag_avg_landed_cost / packets_per_bag
      3. If packet_product_id is provided, adds packets to that SKU with the new cost.
         Otherwise, converts the same product in-place (unit stays as PKT or the stock 
         is re-added as packet qty).
    """
    bags_to_unpack = Decimal(str(body.bags_to_unpack))
    pkts_per_bag = int(body.packets_per_bag)

    if bags_to_unpack <= 0:
        raise HTTPException(status_code=400, detail="bags_to_unpack must be greater than 0.")
    if pkts_per_bag <= 0:
        raise HTTPException(status_code=400, detail="packets_per_bag must be at least 1.")

    # 1. Get bag product stock
    bag_stock_res = await db.execute(select(GodownStock).where(GodownStock.product_id == product_id))
    bag_stock = bag_stock_res.scalars().first()
    if not bag_stock:
        raise HTTPException(status_code=404, detail="Stock record not found for the bag product.")
    if bag_stock.current_stock < bags_to_unpack:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient bag stock. Available: {bag_stock.current_stock}, Requested: {bags_to_unpack}"
        )

    bag_cost = Decimal(str(bag_stock.average_landed_cost or 0))
    packet_unit_cost = (bag_cost / pkts_per_bag) if pkts_per_bag > 0 else Decimal("0.00")
    total_packets = bags_to_unpack * pkts_per_bag

    # 2. Deduct bags
    bag_stock.current_stock = bag_stock.current_stock - bags_to_unpack

    # 3. Add packets to target SKU
    target_product_id = body.packet_product_id or product_id

    pkt_stock_res = await db.execute(select(GodownStock).where(GodownStock.product_id == target_product_id))
    pkt_stock = pkt_stock_res.scalars().first()

    if not pkt_stock:
        # Create stock record if it doesn't exist
        pkt_stock = GodownStock(product_id=target_product_id, current_stock=Decimal("0.00"), average_landed_cost=Decimal("0.00"))
        db.add(pkt_stock)
        await db.flush()

    # Weighted average update for packet stock
    existing_pkt_qty = Decimal(str(pkt_stock.current_stock or 0))
    existing_pkt_cost = Decimal(str(pkt_stock.average_landed_cost or 0))

    if existing_pkt_qty > 0:
        new_avg = ((existing_pkt_qty * existing_pkt_cost) + (total_packets * packet_unit_cost)) / (existing_pkt_qty + total_packets)
    else:
        new_avg = packet_unit_cost

    pkt_stock.current_stock = existing_pkt_qty + total_packets
    pkt_stock.average_landed_cost = round(new_avg, 4)

    await db.commit()

    return UnpackBagsResponse(
        message=f"Successfully unpacked {bags_to_unpack} bag(s) → {total_packets} packets.",
        bags_deducted=bags_to_unpack,
        packets_added=total_packets,
        new_bag_stock=bag_stock.current_stock,
        packet_unit_landed_cost=round(packet_unit_cost, 4),
    )


# ── Manual Stock Correction ────────────────────────────────────────────────────

class StockCorrectionRequest(BaseModel):
    current_stock: Decimal
    average_landed_cost: Optional[Decimal] = None
    reason: Optional[str] = "Manual stock correction"


@router.patch("/{product_id}/adjust-stock")
async def adjust_stock(
    product_id: uuid.UUID,
    body: StockCorrectionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([RoleName.ADMIN])),
):
    """
    Directly override a product's GodownStock current_stock (and optionally
    average_landed_cost). Used to correct errors like unpack with wrong packets_per_bag.
    ADMIN only.
    """
    stock_res = await db.execute(select(GodownStock).where(GodownStock.product_id == product_id))
    stock = stock_res.scalars().first()
    if not stock:
        raise HTTPException(status_code=404, detail="Stock record not found.")

    old_stock = stock.current_stock
    old_cost  = stock.average_landed_cost

    stock.current_stock = Decimal(str(body.current_stock))
    if body.average_landed_cost is not None:
        stock.average_landed_cost = Decimal(str(body.average_landed_cost))

    await db.commit()

    return {
        "message": f"Stock corrected. Reason: {body.reason}",
        "old_stock": str(old_stock),
        "new_stock": str(stock.current_stock),
        "old_avg_cost": str(old_cost),
        "new_avg_cost": str(stock.average_landed_cost),
    }
