from pydantic import BaseModel, Field
from typing import Optional
import uuid
from datetime import datetime, date
from decimal import Decimal

from app.schemas.party import PartyResponse


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
    party: Optional[PartyResponse] = None
    amount: Decimal
    payment_mode: str
    reference_number: Optional[str] = None
    payment_date: date
    remarks: Optional[str] = None
    created_by: Optional[uuid.UUID] = None
    created_at: datetime

    class Config:
        from_attributes = True


class PaymentSyncResult(BaseModel):
    status: str
    synced_sales_receipts: int
    synced_purchase_payments: int
    synced_ledger_payments: int
    total_synced: int
    message: str
