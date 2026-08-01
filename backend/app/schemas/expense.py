from pydantic import BaseModel, Field
from typing import Optional
import uuid
from datetime import datetime, date
from decimal import Decimal


class ExpenseCreate(BaseModel):
    category: str
    amount: Decimal = Field(..., gt=0)
    payment_mode: str = "CASH"  # CASH, BANK, UPI, CHEQUE
    expense_date: date
    paid_to: Optional[str] = None
    remarks: Optional[str] = None

class ExpenseResponse(BaseModel):
    id: uuid.UUID
    category: str
    amount: Decimal
    payment_mode: str
    expense_date: date
    paid_to: Optional[str] = None
    remarks: Optional[str] = None
    created_by: Optional[uuid.UUID] = None
    created_at: datetime

    class Config:
        from_attributes = True
