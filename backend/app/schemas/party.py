from pydantic import BaseModel
from typing import Optional
import uuid
from datetime import datetime
from decimal import Decimal


class PartyBase(BaseModel):
    name: str
    party_type: str  # SUPPLIER, CUSTOMER, BOTH
    gstin: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    credit_limit: Optional[Decimal] = Decimal("0.00")
    credit_days: Optional[int] = 30
    is_active: bool = True

class PartyCreate(PartyBase):
    pass

class PartyUpdate(BaseModel):
    name: Optional[str] = None
    party_type: Optional[str] = None
    gstin: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    credit_limit: Optional[Decimal] = None
    credit_days: Optional[int] = None
    is_active: Optional[bool] = None

class PartyResponse(PartyBase):
    id: uuid.UUID
    created_at: datetime
    ledger_balance: Optional[Decimal] = None  # Positive = we receive; Negative = we owe (for supplier)

    class Config:
        from_attributes = True
