"""Dashboard profit with a hand-checked scenario.

1 bag (10 packets) bought: taxable 1000 + 5% GST 50 = line_total 1050.
10 packets sold: line_total 1575 incl. 75 GST -> revenue ex-GST 1500. Commission 50.

ITC claimed:     COGS 1000, gross 500, net 450, margin 30.00%
ITC not claimed: COGS 1050, gross 450, net 400, margin 26.67%
"""
import uuid
from datetime import date
from decimal import Decimal

import pytest

from app.core.config import settings
from app.models.company import Product
from app.models.party import Party
from app.models.transactions import (
    Expense, PurchaseInvoice, PurchaseItem, SalesInvoice, SalesItem,
)
from app.services.reports_service import get_dashboard_summary


async def _seed(db, expense=Decimal("0"), unbilled=0, deductions=0):
    supplier = Party(id=uuid.uuid4(), party_type="SUPPLIER", name="Supplier")
    customer = Party(id=uuid.uuid4(), party_type="CUSTOMER", name="Customer")
    product = Product(id=uuid.uuid4(), name="Mouth Freshener", hsn_code="2106", packets_per_bag=10)
    db.add_all([supplier, customer, product])
    await db.flush()

    pinv = PurchaseInvoice(
        id=uuid.uuid4(), invoice_number="P1", supplier_id=supplier.id,
        invoice_date=date.today(), grand_total=1050, tax_amount=50,
        unbilled_nongst_amount=unbilled,
        total_payable_amount=1050 + unbilled - deductions,
    )
    db.add(pinv)
    await db.flush()
    db.add(PurchaseItem(
        purchase_invoice_id=pinv.id, product_id=product.id,
        billed_quantity=1, free_quantity=0, unit_purchase_price=1000,
        gst_rate=5, gst_amount=50, effective_unit_landed_cost=1000, line_total=1050,
    ))

    sinv = SalesInvoice(
        id=uuid.uuid4(), invoice_number="S1", customer_id=customer.id,
        invoice_date=date.today(), subtotal=1575, salesman_commission=50, grand_total=1575,
    )
    db.add(sinv)
    await db.flush()
    db.add(SalesItem(
        sales_invoice_id=sinv.id, product_id=product.id, quantity=10,
        unit_selling_price=157.5, unit_landed_cost=100,
        gst_rate=5, gst_amount=75, line_total=1575, line_profit=0,
    ))
    if expense:
        db.add(Expense(category="Rent", amount=expense, expense_date=date.today()))
    await db.commit()


async def test_itc_claimed(db, monkeypatch):
    monkeypatch.setattr(settings, "INPUT_GST_CLAIMED_AS_ITC", True)
    await _seed(db)
    s = await get_dashboard_summary(db)
    assert s.gross_profit == Decimal("500.00")
    assert s.net_profit == Decimal("450.00")
    assert s.profit_margin == Decimal("30.00")


async def test_itc_not_claimed_counts_gst_as_cost(db, monkeypatch):
    monkeypatch.setattr(settings, "INPUT_GST_CLAIMED_AS_ITC", False)
    await _seed(db)
    s = await get_dashboard_summary(db)
    assert s.gross_profit == Decimal("450.00")
    assert s.net_profit == Decimal("400.00")
    assert s.profit_margin == Decimal("26.67")


async def test_expenses_reduce_net_profit_not_gross(db, monkeypatch):
    monkeypatch.setattr(settings, "INPUT_GST_CLAIMED_AS_ITC", True)
    await _seed(db, expense=Decimal("150"))
    s = await get_dashboard_summary(db)
    assert s.gross_profit == Decimal("500.00")
    assert s.net_profit == Decimal("300.00")
    assert s.profit_margin == Decimal("20.00")


async def test_unbilled_cash_and_deductions_change_cost(db, monkeypatch):
    """Bill 1050 + unbilled cash 500 - scheme/discount deductions 200 = 1350 really paid."""
    monkeypatch.setattr(settings, "INPUT_GST_CLAIMED_AS_ITC", False)
    await _seed(db, unbilled=500, deductions=200)
    s = await get_dashboard_summary(db)
    assert s.gross_profit == Decimal("150.00")   # 1500 - 1350
    assert s.net_profit == Decimal("100.00")     # minus 50 commission
    assert s.profit_margin == Decimal("6.67")


async def test_default_treats_purchase_gst_as_cost(db):
    assert settings.INPUT_GST_CLAIMED_AS_ITC is False


async def test_customer_report_agrees_with_dashboard(db, monkeypatch):
    from app.services.reports_service import get_party_profitability
    monkeypatch.setattr(settings, "INPUT_GST_CLAIMED_AS_ITC", False)
    await _seed(db, unbilled=500, deductions=200)
    dash = await get_dashboard_summary(db)
    parties = await get_party_profitability(db)
    assert parties.total_profit == dash.net_profit == Decimal("100.00")


async def test_empty_database_has_zero_margin(db):
    s = await get_dashboard_summary(db)
    assert s.net_profit == Decimal("0.00")
    assert s.profit_margin == Decimal("0.00")
