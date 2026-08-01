from pydantic import BaseModel, Field
from typing import Optional, List
import uuid
from datetime import datetime, date
from decimal import Decimal


# ── Purchase Items ────────────────────────────────────────────────────────────

class PurchaseItemCreate(BaseModel):
    product_id: uuid.UUID
    billed_quantity: Decimal = Field(..., gt=0)
    free_quantity: Decimal = Decimal("0.00")
    unit_purchase_price: Decimal = Field(..., ge=0)
    discount_amount: Decimal = Decimal("0.00")
    gst_rate: Decimal = Decimal("0.00")

class PurchaseItemResponse(BaseModel):
    id: uuid.UUID
    product_id: uuid.UUID
    billed_quantity: Decimal
    free_quantity: Decimal
    unit_purchase_price: Decimal
    discount_amount: Decimal
    gst_rate: Decimal
    gst_amount: Decimal
    allocated_additional_cost: Decimal
    effective_unit_landed_cost: Decimal
    line_total: Decimal

    class Config:
        from_attributes = True


# ── Purchase Invoice ──────────────────────────────────────────────────────────

class PurchaseInvoiceCreate(BaseModel):
    invoice_number: str
    supplier_id: uuid.UUID
    invoice_date: date
    billing_mode: str = "TAX_INVOICE"
    additional_expenses: Decimal = Decimal("0.00")
    notes: Optional[str] = None
    items: List[PurchaseItemCreate]

class PurchaseInvoiceResponse(BaseModel):
    id: uuid.UUID
    invoice_number: str
    supplier_id: uuid.UUID
    invoice_date: date
    billing_mode: str
    subtotal: Decimal
    discount_amount: Decimal
    tax_amount: Decimal
    additional_expenses: Decimal
    grand_total: Decimal
    notes: Optional[str] = None
    created_by: Optional[uuid.UUID] = None
    created_at: datetime
    items: List[PurchaseItemResponse] = []

    class Config:
        from_attributes = True


# ── Sales Items ───────────────────────────────────────────────────────────────

class SalesItemCreate(BaseModel):
    product_id: uuid.UUID
    quantity: Decimal = Field(..., gt=0)
    unit_selling_price: Decimal = Field(..., ge=0)
    discount_amount: Decimal = Decimal("0.00")
    gst_rate: Decimal = Decimal("0.00")

class SalesItemResponse(BaseModel):
    id: uuid.UUID
    product_id: uuid.UUID
    quantity: Decimal
    unit_selling_price: Decimal
    unit_landed_cost: Decimal
    discount_amount: Decimal
    gst_rate: Decimal
    gst_amount: Decimal
    line_total: Decimal
    line_profit: Decimal

    class Config:
        from_attributes = True


# ── Sales Invoice ─────────────────────────────────────────────────────────────

class SalesInvoiceCreate(BaseModel):
    invoice_number: str
    customer_id: uuid.UUID
    salesman_id: Optional[uuid.UUID] = None
    invoice_date: date
    billing_mode: str = "TAX_INVOICE"
    delivery_charges: Decimal = Decimal("0.00")
    salesman_commission: Decimal = Decimal("0.00")
    notes: Optional[str] = None
    items: List[SalesItemCreate]

class SalesInvoiceResponse(BaseModel):
    id: uuid.UUID
    invoice_number: str
    customer_id: uuid.UUID
    salesman_id: Optional[uuid.UUID] = None
    invoice_date: date
    billing_mode: str
    subtotal: Decimal
    discount_amount: Decimal
    tax_amount: Decimal
    delivery_charges: Decimal
    salesman_commission: Decimal
    grand_total: Decimal
    total_cost_of_goods: Decimal
    net_profit: Decimal
    notes: Optional[str] = None
    created_by: Optional[uuid.UUID] = None
    created_at: datetime
    items: List[SalesItemResponse] = []

    class Config:
        from_attributes = True
