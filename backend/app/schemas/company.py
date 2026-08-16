from pydantic import BaseModel, Field
from typing import Optional, List
import uuid
from datetime import datetime
from decimal import Decimal


# ── Company ──────────────────────────────────────────────────────────────────

class CompanyBase(BaseModel):
    name: str
    code: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    is_active: bool = True

class CompanyCreate(CompanyBase):
    pass

class CompanyUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None

class CompanyResponse(CompanyBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


# ── Category ─────────────────────────────────────────────────────────────────

class CategoryBase(BaseModel):
    name: str
    description: Optional[str] = None

class CategoryCreate(CategoryBase):
    pass

class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class CategoryResponse(CategoryBase):
    id: int

    class Config:
        from_attributes = True


# ── GodownStock ───────────────────────────────────────────────────────────────

class GodownStockResponse(BaseModel):
    product_id: uuid.UUID
    current_stock: Decimal
    damaged_stock: Decimal
    average_landed_cost: Decimal
    updated_at: datetime

    class Config:
        from_attributes = True


# ── Product ───────────────────────────────────────────────────────────────────

class ProductBase(BaseModel):
    name: str
    hsn_code: str
    sku: Optional[str] = None
    company_id: Optional[int] = None
    category_id: Optional[int] = None
    gst_rate: Decimal = Decimal("0.00")
    unit: str = "BAG"
    packets_per_bag: int = 0
    default_purchase_price: Decimal = Decimal("0.00")
    default_selling_price: Decimal = Decimal("0.00")
    min_stock_alert: int = 0
    is_active: bool = True

class ProductCreate(ProductBase):
    pass

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    hsn_code: Optional[str] = None
    sku: Optional[str] = None
    company_id: Optional[int] = None
    category_id: Optional[int] = None
    gst_rate: Optional[Decimal] = None
    unit: Optional[str] = None
    packets_per_bag: Optional[int] = None
    default_purchase_price: Optional[Decimal] = None
    default_selling_price: Optional[Decimal] = None
    min_stock_alert: Optional[int] = None
    is_active: Optional[bool] = None

class ProductResponse(ProductBase):
    id: uuid.UUID
    created_at: datetime
    stock: Optional[GodownStockResponse] = None

    class Config:
        from_attributes = True
