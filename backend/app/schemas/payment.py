from pydantic import BaseModel, Field
from typing import Optional
import uuid
from datetime import datetime, date
from decimal import Decimal


class PaymentCreate(BaseModel):
    voucher_number: str
    payment_type: str = Field(..., description="RECEIPT or PAYMENT")
    party_id: Optional[uuid.UUID] = None
    amount: Decimal = Field(..., gt=0)
    payment_mode: str = "CASH"  # CASH, BANK, UPI, CHEQUE, NEFT
    reference_number: Optional[str] = None
    payment_date: date
    remarks: Optional[str] = None

class PaymentResponse(BaseModel):
    id: uuid.UUID
    voucher_number: str
    payment_type: str
    party_id: Optional[uuid.UUID] = None
    amount: Decimal
    payment_mode: str
    reference_number: Optional[str] = None
    payment_date: date
    remarks: Optional[str] = None
    created_by: Optional[uuid.UUID] = None
    created_at: datetime

    class Config:
        from_attributes = True
