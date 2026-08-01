from pydantic import BaseModel
from typing import Optional, List
import uuid
from datetime import datetime, date
from decimal import Decimal


# ── LedgerAccount ─────────────────────────────────────────────────────────────

class LedgerAccountBase(BaseModel):
    account_name: str
    account_type: str  # ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE
    party_id: Optional[uuid.UUID] = None

class LedgerAccountCreate(LedgerAccountBase):
    pass

class LedgerAccountResponse(LedgerAccountBase):
    id: uuid.UUID
    current_balance: Decimal
    created_at: datetime

    class Config:
        from_attributes = True


# ── LedgerEntry ───────────────────────────────────────────────────────────────

class LedgerEntryResponse(BaseModel):
    id: uuid.UUID
    transaction_date: date
    voucher_type: str
    reference_id: Optional[uuid.UUID] = None
    debit_account_id: uuid.UUID
    credit_account_id: uuid.UUID
    amount: Decimal
    narration: Optional[str] = None
    created_by: Optional[uuid.UUID] = None
    created_at: datetime

    class Config:
        from_attributes = True
