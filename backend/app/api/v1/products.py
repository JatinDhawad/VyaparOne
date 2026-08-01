from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
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
