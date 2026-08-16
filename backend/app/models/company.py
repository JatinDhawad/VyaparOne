from sqlalchemy import String, Integer, Boolean, ForeignKey, DateTime, Numeric, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime
from typing import Optional, List

from app.core.database import Base

class Company(Base):
    """
    Company / Brand Model (e.g. Raja Supari, Everest Masala, Pan Parag).
    Stores supplier manufacturers from whom products are sourced.
    """
    __tablename__ = "companies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    code: Mapped[Optional[str]] = mapped_column(String(50), unique=True, nullable=True)
    contact_person: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    products: Mapped[List["Product"]] = relationship("Product", back_populates="company")

class Category(Base):
    """
    Product Category Model (e.g., Mouth Freshener, Supari, Food Masala, Spices).
    """
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # Relationships
    products: Mapped[List["Product"]] = relationship("Product", back_populates="category")

class Product(Base):
    """
    Product Model representing traded goods SKU catalog.
    Uses Numeric(12, 2) for exact financial precision without floating point inaccuracies.
    """
    __tablename__ = "products"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True
    )
    company_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("companies.id"), nullable=True)
    category_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("categories.id"), nullable=True)
    
    sku: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    hsn_code: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    gst_rate: Mapped[float] = mapped_column(Numeric(5, 2), default=0.00) # e.g. 5.00, 12.00, 18.00
    unit: Mapped[str] = mapped_column(String(20), default="BAG") # BAG, BOX, KG, PKT
    packets_per_bag: Mapped[int] = mapped_column(Integer, default=0)  # 0 = not a bag product
    
    default_purchase_price: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00)
    default_selling_price: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00)
    min_stock_alert: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relationships
    company: Mapped[Optional["Company"]] = relationship("Company", back_populates="products")
    category: Mapped[Optional["Category"]] = relationship("Category", back_populates="products")
    stock: Mapped[Optional["GodownStock"]] = relationship("GodownStock", back_populates="product", uselist=False)

class GodownStock(Base):
    """
    Single Godown Inventory Stock Model.
    Tracks real-time stock balance, damaged items, and average purchase cost per product.
    """
    __tablename__ = "godown_stock"

    product_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("products.id"), primary_key=True
    )
    current_stock: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00)
    damaged_stock: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00)
    average_landed_cost: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationship
    product: Mapped["Product"] = relationship("Product", back_populates="stock")
