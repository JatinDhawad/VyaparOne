from sqlalchemy import String, Integer, Float, Boolean, ForeignKey, DateTime, func, Enum, JSON, Numeric, Date
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime, date
from typing import Optional, List

from app.core.database import Base

class PurchaseInvoice(Base):
    __tablename__ = "purchase_invoices"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True
    )
    invoice_number: Mapped[str] = mapped_column(String(100), nullable=False)
    supplier_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("parties.id"), nullable=False)
    invoice_date: Mapped[date] = mapped_column(Date, nullable=False)
    billing_mode: Mapped[str] = mapped_column(String(20), default="TAX_INVOICE") # TAX_INVOICE, CASH_CHALLAN
    
    subtotal: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00)
    discount_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00)
    tax_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00)
    additional_expenses: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00) # Billed logistics/freight
    lr_charges: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00)
    local_freight: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00)
    salesman_expense: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00)
    scheme_money: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00)
    discount_deduction: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00)
    grand_total: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00) # Official GST Billed Invoice Total
    unbilled_nongst_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00) # Separate unbilled payment
    total_payable_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00) # grand_total + unbilled_nongst_amount
    amount_paid: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00) # Money paid to supplier
    pending_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00) # Remaining balance owed
    
    notes: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    items: Mapped[List["PurchaseItem"]] = relationship("PurchaseItem", back_populates="purchase_invoice", cascade="all, delete-orphan")
    supplier: Mapped["Party"] = relationship("Party")


class PurchaseItem(Base):
    __tablename__ = "purchase_items"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True
    )
    purchase_invoice_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("purchase_invoices.id", ondelete="CASCADE")
    )
    product_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("products.id"))
    
    billed_quantity: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    free_quantity: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00)
    unit_purchase_price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    discount_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00)
    
    gst_rate: Mapped[float] = mapped_column(Numeric(5, 2), default=0.00)
    gst_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00)
    allocated_additional_cost: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00)
    
    effective_unit_landed_cost: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    line_total: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)

    purchase_invoice: Mapped["PurchaseInvoice"] = relationship("PurchaseInvoice", back_populates="items")
    product: Mapped["Product"] = relationship("Product")


class SalesInvoice(Base):
    __tablename__ = "sales_invoices"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True
    )
    invoice_number: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    customer_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("parties.id"))
    salesman_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    invoice_date: Mapped[date] = mapped_column(Date, nullable=False)
    billing_mode: Mapped[str] = mapped_column(String(20), default="TAX_INVOICE")
    
    subtotal: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00)
    discount_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00)
    tax_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00)
    # GST split (informational only — prices are GST-inclusive)
    gst_billed_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00)
    without_gst_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00)
    # Deductions
    delivery_charges: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00)
    salesman_commission: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00)
    lr_charges: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00)
    local_freight: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00)
    scheme_money: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00)
    # Totals
    grand_total: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00)
    total_cost_of_goods: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00)
    net_profit: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00)
    # Payment
    amount_paid: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00)
    pending_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00)
    payment_mode: Mapped[Optional[str]] = mapped_column(String(30), default="CASH")
    location: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    
    notes: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    items: Mapped[List["SalesItem"]] = relationship("SalesItem", back_populates="sales_invoice", cascade="all, delete-orphan")
    customer: Mapped[Optional["Party"]] = relationship("Party", foreign_keys=[customer_id], lazy="select")


class SalesItem(Base):
    __tablename__ = "sales_items"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True
    )
    sales_invoice_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sales_invoices.id", ondelete="CASCADE")
    )
    product_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("products.id"))
    
    quantity: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    unit_selling_price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    unit_landed_cost: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    
    discount_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00)
    gst_rate: Mapped[float] = mapped_column(Numeric(5, 2), default=0.00)
    gst_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00)
    
    line_total: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    line_profit: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)

    sales_invoice: Mapped["SalesInvoice"] = relationship("SalesInvoice", back_populates="items")


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True
    )
    voucher_number: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    payment_type: Mapped[str] = mapped_column(String(20), nullable=False) # RECEIPT, PAYMENT
    party_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("parties.id"), nullable=True)
    
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    payment_mode: Mapped[str] = mapped_column(String(30), nullable=False)
    reference_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    payment_date: Mapped[date] = mapped_column(Date, nullable=False)
    
    remarks: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class Expense(Base):
    __tablename__ = "expenses"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True
    )
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    payment_mode: Mapped[str] = mapped_column(String(30), default="CASH")
    expense_date: Mapped[date] = mapped_column(Date, nullable=False)
    paid_to: Mapped[Optional[str]] = mapped_column(String(150), nullable=True)
    
    remarks: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True
    )
    user_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    table_name: Mapped[str] = mapped_column(String(50), nullable=False)
    record_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    
    old_data = mapped_column(JSON, nullable=True)
    new_data = mapped_column(JSON, nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(45), nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
