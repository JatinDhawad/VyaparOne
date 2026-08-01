import enum
from sqlalchemy import String, Integer, Boolean, DateTime, Numeric, func
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime
from typing import Optional

from app.core.database import Base

class PartyType(str, enum.Enum):
    SUPPLIER = "SUPPLIER"
    CUSTOMER = "CUSTOMER"
    BOTH = "BOTH"

class Party(Base):
    """
    Party Model representing both Suppliers (vendors) and Customers (buyers).
    Stores GSTIN, Credit Limits, Credit Days, and Outstanding Balance.
    """
    __tablename__ = "parties"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True
    )
    party_type: Mapped[str] = mapped_column(String(20), nullable=False, index=True) # SUPPLIER, CUSTOMER, BOTH
    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    gstin: Mapped[Optional[str]] = mapped_column(String(15), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(20), nullable=True, index=True)
    email: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    address: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    state: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    
    credit_limit: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00)
    credit_days: Mapped[int] = mapped_column(Integer, default=30)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    def __repr__(self) -> str:
        return f"<Party(id={self.id}, name='{self.name}', type='{self.party_type}')>"
