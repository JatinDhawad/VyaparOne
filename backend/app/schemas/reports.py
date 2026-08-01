from pydantic import BaseModel
from typing import Optional, List
import uuid
from datetime import date, datetime
from decimal import Decimal


# ── Ledger Statement ─────────────────────────────────────────────────────────

class LedgerStatementLine(BaseModel):
    id: uuid.UUID
    transaction_date: date
    voucher_type: str
    reference_id: Optional[uuid.UUID] = None
    debit_amount: Decimal
    credit_amount: Decimal
    running_balance: Decimal
    narration: Optional[str] = None

class LedgerStatementResponse(BaseModel):
    account_id: uuid.UUID
    account_name: str
    account_type: str
    opening_balance: Decimal
    total_debits: Decimal
    total_credits: Decimal
    closing_balance: Decimal
    lines: List[LedgerStatementLine]


# ── Receivables & Payables ───────────────────────────────────────────────────

class OutstandingPartyItem(BaseModel):
    party_id: uuid.UUID
    party_name: str
    party_type: str
    phone: Optional[str] = None
    city: Optional[str] = None
    credit_limit: Decimal
    credit_days: int
    current_balance: Decimal
    is_overdue: bool

class ReceivablesReportResponse(BaseModel):
    total_receivables: Decimal
    total_parties: int
    parties: List[OutstandingPartyItem]

class PayablesReportResponse(BaseModel):
    total_payables: Decimal
    total_parties: int
    parties: List[OutstandingPartyItem]


# ── Party Profitability ──────────────────────────────────────────────────────

class PartyProfitabilityItem(BaseModel):
    party_id: uuid.UUID
    party_name: str
    total_invoices: int
    total_revenue: Decimal
    total_cogs: Decimal
    gross_profit: Decimal
    net_profit: Decimal
    profit_margin_percent: Decimal

class PartyProfitabilityResponse(BaseModel):
    total_revenue: Decimal
    total_profit: Decimal
    parties: List[PartyProfitabilityItem]


# ── Product Profitability ────────────────────────────────────────────────────

class ProductProfitabilityItem(BaseModel):
    product_id: uuid.UUID
    product_name: str
    sku: str
    unit: str
    quantity_sold: Decimal
    total_revenue: Decimal
    average_landed_cost: Decimal
    total_cogs: Decimal
    total_line_profit: Decimal
    profit_margin_percent: Decimal

class ProductProfitabilityResponse(BaseModel):
    total_quantity_sold: Decimal
    total_revenue: Decimal
    total_profit: Decimal
    products: List[ProductProfitabilityItem]


# ── GST Summary ──────────────────────────────────────────────────────────────

class GSTSummaryResponse(BaseModel):
    sales_taxable_amount: Decimal
    output_gst_amount: Decimal
    purchase_taxable_amount: Decimal
    input_gst_amount: Decimal
    net_gst_payable: Decimal


# ── Dashboard Summary ────────────────────────────────────────────────────────

class DashboardSummaryResponse(BaseModel):
    total_sales: Decimal
    total_purchases: Decimal
    gross_profit: Decimal
    net_profit: Decimal
    total_operational_expenses: Decimal
    total_receivables: Decimal
    total_payables: Decimal
    low_stock_items_count: int
    active_customers_count: int
    active_suppliers_count: int
