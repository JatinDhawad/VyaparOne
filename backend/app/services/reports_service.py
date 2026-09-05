from decimal import Decimal
from datetime import date, timedelta
from dateutil.relativedelta import relativedelta
import uuid
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func, or_, and_
from sqlalchemy.orm import selectinload
from fastapi import HTTPException, status

from app.models.ledger import LedgerAccount, LedgerEntry, AccountType
from app.models.party import Party
from app.models.company import Product, GodownStock
from app.models.transactions import PurchaseInvoice, SalesInvoice, SalesItem, Expense
from app.schemas.reports import (
    LedgerStatementResponse, LedgerStatementLine,
    ReceivablesReportResponse, PayablesReportResponse, OutstandingPartyItem,
    PartyProfitabilityResponse, PartyProfitabilityItem,
    ProductProfitabilityResponse, ProductProfitabilityItem,
    GSTSummaryResponse, DashboardSummaryResponse
)


async def get_ledger_statement(
    db: AsyncSession,
    account_id: uuid.UUID,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None
) -> LedgerStatementResponse:
    acct_res = await db.execute(select(LedgerAccount).where(LedgerAccount.id == account_id))
    account = acct_res.scalars().first()
    if not account:
        raise HTTPException(status_code=404, detail="Ledger account not found.")

    # 1. Opening balance calculation if start_date provided
    opening_balance = Decimal("0.00")
    if start_date:
        past_entries = await db.execute(
            select(LedgerEntry).where(
                or_(LedgerEntry.debit_account_id == account_id, LedgerEntry.credit_account_id == account_id),
                LedgerEntry.transaction_date < start_date
            )
        )
        for entry in past_entries.scalars().all():
            amt = Decimal(str(entry.amount))
            if account.account_type in [AccountType.ASSET.value, AccountType.EXPENSE.value]:
                if entry.debit_account_id == account_id:
                    opening_balance += amt
                else:
                    opening_balance -= amt
            else:
                if entry.credit_account_id == account_id:
                    opening_balance += amt
                else:
                    opening_balance -= amt

    # 2. Query period entries
    query = select(LedgerEntry).where(
        or_(LedgerEntry.debit_account_id == account_id, LedgerEntry.credit_account_id == account_id)
    )
    if start_date:
        query = query.where(LedgerEntry.transaction_date >= start_date)
    if end_date:
        query = query.where(LedgerEntry.transaction_date <= end_date)

    query = query.order_by(LedgerEntry.transaction_date.asc(), LedgerEntry.created_at.asc())
    entries_res = await db.execute(query)
    entries = entries_res.scalars().all()

    running_bal = opening_balance
    total_debits = Decimal("0.00")
    total_credits = Decimal("0.00")
    lines = []

    for entry in entries:
        amt = Decimal(str(entry.amount))
        if entry.debit_account_id == account_id:
            debit = amt
            credit = Decimal("0.00")
            total_debits += amt
            if account.account_type in [AccountType.ASSET.value, AccountType.EXPENSE.value]:
                running_bal += amt
            else:
                running_bal -= amt
        else:
            debit = Decimal("0.00")
            credit = amt
            total_credits += amt
            if account.account_type in [AccountType.ASSET.value, AccountType.EXPENSE.value]:
                running_bal -= amt
            else:
                running_bal += amt

        lines.append(
            LedgerStatementLine(
                id=entry.id,
                transaction_date=entry.transaction_date,
                voucher_type=entry.voucher_type,
                reference_id=entry.reference_id,
                debit_amount=debit,
                credit_amount=credit,
                running_balance=round(running_bal, 2),
                narration=entry.narration
            )
        )

    return LedgerStatementResponse(
        account_id=account.id,
        account_name=account.account_name,
        account_type=account.account_type,
        opening_balance=round(opening_balance, 2),
        total_debits=round(total_debits, 2),
        total_credits=round(total_credits, 2),
        closing_balance=round(running_bal, 2),
        lines=lines
    )


async def get_receivables_report(db: AsyncSession) -> ReceivablesReportResponse:
    from app.models.transactions import SalesInvoice
    from sqlalchemy import func

    # Get all customers
    cust_res = await db.execute(
        select(Party)
        .where(Party.party_type.in_(["CUSTOMER", "BOTH"]))
    )
    customers = cust_res.scalars().all()

    total_rec = Decimal("0.00")
    party_items = []

    for party in customers:
        # Sum pending_amount from sales invoices for this customer
        pending_res = await db.execute(
            select(func.coalesce(func.sum(SalesInvoice.pending_amount), 0))
            .where(SalesInvoice.customer_id == party.id)
        )
        pending = Decimal(str(pending_res.scalar()))

        if pending > Decimal("0.00"):
            total_rec += pending
            party_items.append(
                OutstandingPartyItem(
                    party_id=party.id,
                    party_name=party.name,
                    party_type=party.party_type,
                    phone=party.phone,
                    city=party.city,
                    credit_limit=Decimal(str(party.credit_limit or 0)),
                    credit_days=party.credit_days or 30,
                    current_balance=round(pending, 2),
                    is_overdue=False
                )
            )

    # Sort customers by highest outstanding balance first
    party_items.sort(key=lambda p: p.current_balance, reverse=True)

    return ReceivablesReportResponse(
        total_receivables=round(total_rec, 2),
        total_parties=len(party_items),
        parties=party_items
    )


async def get_payables_report(db: AsyncSession) -> PayablesReportResponse:
    from app.models.transactions import PurchaseInvoice
    from sqlalchemy import func

    # Get all suppliers
    sup_res = await db.execute(
        select(Party)
        .where(Party.party_type.in_(["SUPPLIER", "BOTH"]))
    )
    suppliers = sup_res.scalars().all()

    total_pay = Decimal("0.00")
    party_items = []

    for party in suppliers:
        # Sum pending_amount from purchase invoices for this supplier
        pending_res = await db.execute(
            select(func.coalesce(func.sum(PurchaseInvoice.pending_amount), 0))
            .where(PurchaseInvoice.supplier_id == party.id)
        )
        pending = Decimal(str(pending_res.scalar()))

        if pending > Decimal("0.00"):
            total_pay += pending
            party_items.append(
                OutstandingPartyItem(
                    party_id=party.id,
                    party_name=party.name,
                    party_type=party.party_type,
                    phone=party.phone,
                    city=party.city,
                    credit_limit=Decimal(str(party.credit_limit or 0)),
                    credit_days=party.credit_days or 30,
                    current_balance=round(pending, 2),
                    is_overdue=False
                )
            )

    party_items.sort(key=lambda p: p.current_balance, reverse=True)

    return PayablesReportResponse(
        total_payables=round(total_pay, 2),
        total_parties=len(party_items),
        parties=party_items
    )


async def get_party_profitability(
    db: AsyncSession,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None
) -> PartyProfitabilityResponse:
    query = select(SalesInvoice).options(selectinload(SalesInvoice.items))
    if start_date:
        query = query.where(SalesInvoice.invoice_date >= start_date)
    if end_date:
        query = query.where(SalesInvoice.invoice_date <= end_date)

    res = await db.execute(query)
    invoices = res.scalars().all()

    party_map = {}
    for inv in invoices:
        pid = inv.customer_id
        if pid not in party_map:
            party_map[pid] = {
                "invoices": 0,
                "revenue": Decimal("0.00"),
                "cogs": Decimal("0.00"),
                "net_profit": Decimal("0.00")
            }
        
        rev = Decimal(str(inv.subtotal or 0)) - Decimal(str(inv.discount_amount or 0))
        cogs = Decimal(str(inv.total_cost_of_goods or 0))
        np = Decimal(str(inv.net_profit or 0))

        party_map[pid]["invoices"] += 1
        party_map[pid]["revenue"] += rev
        party_map[pid]["cogs"] += cogs
        party_map[pid]["net_profit"] += np

    total_rev = Decimal("0.00")
    total_prof = Decimal("0.00")
    items = []

    for pid, data in party_map.items():
        p_res = await db.execute(select(Party).where(Party.id == pid))
        party = p_res.scalars().first()
        pname = party.name if party else "Unknown Customer"

        rev = data["revenue"]
        cogs = data["cogs"]
        gross_p = rev - cogs
        net_p = data["net_profit"]
        margin = (net_p / rev * Decimal("100.00")) if rev > 0 else Decimal("0.00")

        total_rev += rev
        total_prof += net_p

        items.append(
            PartyProfitabilityItem(
                party_id=pid,
                party_name=pname,
                total_invoices=data["invoices"],
                total_revenue=round(rev, 2),
                total_cogs=round(cogs, 2),
                gross_profit=round(gross_p, 2),
                net_profit=round(net_p, 2),
                profit_margin_percent=round(margin, 2)
            )
        )

    return PartyProfitabilityResponse(
        total_revenue=round(total_rev, 2),
        total_profit=round(total_prof, 2),
        parties=items
    )


async def get_product_profitability(
    db: AsyncSession,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None
) -> ProductProfitabilityResponse:
    from app.models.transactions import PurchaseItem

    # ── Step 1: Build per-product purchase cost from ACTUAL invoices ──────────
    # For each product, sum the total actual money paid (billed line_total + proportional unbilled)
    # across ALL purchase invoices (not filtered by date — cost base is all-time)
    pur_items_res = await db.execute(
        select(PurchaseItem, PurchaseInvoice)
        .join(PurchaseInvoice, PurchaseInvoice.id == PurchaseItem.purchase_invoice_id)
    )
    pur_rows = pur_items_res.all()

    # Build: product_id -> {total_bags, total_billed_cost, invoice_id set}
    # Also need unbilled amount per invoice to allocate to products on that invoice
    prod_purchase = {}   # product_id -> {bags, billed_cost, inv_ids: {inv_id}}
    inv_billed = {}      # invoice_id -> total billed line_total for that invoice

    for pitem, pinv in pur_rows:
        pid = pitem.product_id
        inv_id = pinv.id
        bags = Decimal(str(pitem.billed_quantity or 0)) + Decimal(str(pitem.free_quantity or 0))
        billed_cost = Decimal(str(pitem.line_total or 0))  # includes GST + additional costs

        if pid not in prod_purchase:
            prod_purchase[pid] = {"bags": Decimal("0"), "billed_cost": Decimal("0"), "inv_product_cost": {}}
        prod_purchase[pid]["bags"] += bags
        prod_purchase[pid]["billed_cost"] += billed_cost

        # Track per-invoice billed cost per product for unbilled allocation
        inv_id_str = str(inv_id)
        if inv_id_str not in prod_purchase[pid]["inv_product_cost"]:
            prod_purchase[pid]["inv_product_cost"][inv_id_str] = Decimal("0")
        prod_purchase[pid]["inv_product_cost"][inv_id_str] += billed_cost

        if inv_id_str not in inv_billed:
            inv_billed[inv_id_str] = {"total_billed": Decimal("0"), "unbilled": Decimal(str(pinv.unbilled_nongst_amount or 0))}
        inv_billed[inv_id_str]["total_billed"] += billed_cost

    # Add proportional share of unbilled_nongst_amount per product per invoice
    for pid, pdata in prod_purchase.items():
        unbilled_share = Decimal("0")
        for inv_id_str, product_billed in pdata["inv_product_cost"].items():
            inv_data = inv_billed.get(inv_id_str, {})
            inv_total_billed = inv_data.get("total_billed", Decimal("1"))
            inv_unbilled = inv_data.get("unbilled", Decimal("0"))
            if inv_total_billed > 0:
                share = (product_billed / inv_total_billed) * inv_unbilled
                unbilled_share += share
        pdata["total_actual_cost"] = pdata["billed_cost"] + unbilled_share

    # ── Step 2: Get packets_per_bag for each product ───────────────────────────
    prod_res = await db.execute(select(Product).options())
    all_products = {str(p.id): p for p in prod_res.scalars().all()}

    # ── Step 3: Compute actual cost per PACKET for each product ───────────────
    # cost_per_pkt = total_actual_cost / (bags × packets_per_bag)
    prod_cost_per_pkt = {}
    for pid_str, pdata in prod_purchase.items():
        prod = all_products.get(pid_str)
        pkts_per_bag = int(prod.packets_per_bag) if prod and prod.packets_per_bag else 1
        total_pkts = pdata["bags"] * pkts_per_bag  # if 0, treat as 1 bag=1 unit
        if total_pkts <= 0:
            total_pkts = pdata["bags"]  # bag-level product, no unpack
        prod_cost_per_pkt[pid_str] = pdata["total_actual_cost"] / total_pkts if total_pkts > 0 else Decimal("0")

    # ── Step 4: Sum sales revenue and qty sold per product ────────────────────
    sal_query = select(SalesItem, SalesInvoice).join(SalesInvoice, SalesInvoice.id == SalesItem.sales_invoice_id)
    if start_date:
        sal_query = sal_query.where(SalesInvoice.invoice_date >= start_date)
    if end_date:
        sal_query = sal_query.where(SalesInvoice.invoice_date <= end_date)

    sal_res = await db.execute(sal_query)
    sal_rows = sal_res.all()

    prod_sales = {}
    for sitem, sinv in sal_rows:
        pid = sitem.product_id
        pid_str = str(pid)
        if pid_str not in prod_sales:
            prod_sales[pid_str] = {"qty": Decimal("0"), "revenue": Decimal("0")}
        qty = Decimal(str(sitem.quantity or 0))
        # Revenue = packets × rate (excluding GST — it's informational)
        revenue = Decimal(str(sitem.line_total or 0)) - Decimal(str(sitem.gst_amount or 0))
        prod_sales[pid_str]["qty"] += qty
        prod_sales[pid_str]["revenue"] += revenue

    # ── Step 5: Build result ───────────────────────────────────────────────────
    total_qty = Decimal("0")
    total_rev = Decimal("0")
    total_prof = Decimal("0")
    items = []

    for pid_str, sdata in prod_sales.items():
        prod = all_products.get(pid_str)
        pname = prod.name if prod else "Unknown Product"
        sku = prod.sku if prod else ""
        unit = "PKT" if (prod and prod.packets_per_bag and prod.packets_per_bag > 0) else (prod.unit if prod else "BAG")

        qty = sdata["qty"]
        rev = sdata["revenue"]

        # COGS = actual cost per packet × packets sold
        cost_per_pkt = prod_cost_per_pkt.get(pid_str, Decimal("0"))
        cogs = cost_per_pkt * qty
        profit = rev - cogs
        margin = (profit / rev * Decimal("100")) if rev > 0 else Decimal("0")

        total_qty += qty
        total_rev += rev
        total_prof += profit

        items.append(
            ProductProfitabilityItem(
                product_id=uuid.UUID(pid_str),
                product_name=pname,
                sku=sku,
                unit=unit,
                quantity_sold=round(qty, 2),
                total_revenue=round(rev, 2),
                average_landed_cost=round(cost_per_pkt, 4),
                total_cogs=round(cogs, 2),
                total_line_profit=round(profit, 2),
                profit_margin_percent=round(margin, 2)
            )
        )

    return ProductProfitabilityResponse(
        total_quantity_sold=round(total_qty, 2),
        total_revenue=round(total_rev, 2),
        total_profit=round(total_prof, 2),
        products=items
    )



async def get_gst_summary(
    db: AsyncSession,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None
) -> GSTSummaryResponse:
    # 1. Output GST (Sales)
    s_query = select(SalesInvoice)
    if start_date:
        s_query = s_query.where(SalesInvoice.invoice_date >= start_date)
    if end_date:
        s_query = s_query.where(SalesInvoice.invoice_date <= end_date)
    
    s_res = await db.execute(s_query)
    sales_invs = s_res.scalars().all()

    sales_taxable = sum((Decimal(str(i.subtotal or 0)) - Decimal(str(i.discount_amount or 0))) for i in sales_invs)
    output_gst = sum(Decimal(str(i.tax_amount or 0)) for i in sales_invs)

    # 2. Input GST (Purchases)
    p_query = select(PurchaseInvoice)
    if start_date:
        p_query = p_query.where(PurchaseInvoice.invoice_date >= start_date)
    if end_date:
        p_query = p_query.where(PurchaseInvoice.invoice_date <= end_date)

    p_res = await db.execute(p_query)
    pur_invs = p_res.scalars().all()

    purchase_taxable = sum((Decimal(str(i.subtotal or 0)) - Decimal(str(i.discount_amount or 0))) for i in pur_invs)
    input_gst = sum(Decimal(str(i.tax_amount or 0)) for i in pur_invs)

    net_payable = output_gst - input_gst

    return GSTSummaryResponse(
        sales_taxable_amount=round(sales_taxable, 2),
        output_gst_amount=round(output_gst, 2),
        purchase_taxable_amount=round(purchase_taxable, 2),
        input_gst_amount=round(input_gst, 2),
        net_gst_payable=round(net_payable, 2)
    )


def _period_to_start_date(period: Optional[str]) -> Optional[date]:
    """Convert period string to a start date."""
    if not period or period == 'all':
        return None
    today = date.today()
    if period == '30d':
        return today - timedelta(days=30)
    elif period == '90d':
        return today - timedelta(days=90)
    elif period == '6m':
        return today - relativedelta(months=6)
    elif period == '1y':
        return today - relativedelta(years=1)
    return None


async def get_dashboard_summary(db: AsyncSession, period: Optional[str] = None) -> DashboardSummaryResponse:
    start_date = _period_to_start_date(period)

    # 1. Sales & Profit
    s_query = select(SalesInvoice)
    if start_date:
        s_query = s_query.where(SalesInvoice.invoice_date >= start_date)
    s_res = await db.execute(s_query)
    sales_invs = s_res.scalars().all()

    tot_sales = sum(Decimal(str(i.subtotal or 0)) for i in sales_invs)  # gross goods amount before deductions

    # ── Recalculate profit using ACTUAL purchase cost vs actual sale revenue ──
    # Same method as product profitability: don't use stored net_profit (stale average cost)
    from app.models.transactions import PurchaseItem, SalesItem

    # Build per-product actual cost from ALL purchases (all-time, regardless of period)
    pur_rows_res = await db.execute(
        select(PurchaseItem, PurchaseInvoice)
        .join(PurchaseInvoice, PurchaseInvoice.id == PurchaseItem.purchase_invoice_id)
    )
    pur_rows = pur_rows_res.all()

    prod_purchase = {}
    inv_billed = {}
    for pitem, pinv in pur_rows:
        pid = str(pitem.product_id)
        inv_id = str(pinv.id)
        bags = Decimal(str(pitem.billed_quantity or 0)) + Decimal(str(pitem.free_quantity or 0))
        billed_cost = Decimal(str(pitem.line_total or 0))
        if pid not in prod_purchase:
            prod_purchase[pid] = {"bags": Decimal("0"), "billed_cost": Decimal("0"), "inv_product_cost": {}}
        prod_purchase[pid]["bags"] += bags
        prod_purchase[pid]["billed_cost"] += billed_cost
        if inv_id not in prod_purchase[pid]["inv_product_cost"]:
            prod_purchase[pid]["inv_product_cost"][inv_id] = Decimal("0")
        prod_purchase[pid]["inv_product_cost"][inv_id] += billed_cost
        if inv_id not in inv_billed:
            inv_billed[inv_id] = {"total_billed": Decimal("0"), "unbilled": Decimal(str(pinv.unbilled_nongst_amount or 0))}
        inv_billed[inv_id]["total_billed"] += billed_cost

    # Add proportional unbilled share
    for pid, pdata in prod_purchase.items():
        unbilled_share = Decimal("0")
        for inv_id, product_billed in pdata["inv_product_cost"].items():
            inv_data = inv_billed.get(inv_id, {})
            inv_total = inv_data.get("total_billed", Decimal("1"))
            inv_unbilled = inv_data.get("unbilled", Decimal("0"))
            if inv_total > 0:
                unbilled_share += (product_billed / inv_total) * inv_unbilled
        pdata["total_actual_cost"] = pdata["billed_cost"] + unbilled_share

    # Get packets_per_bag for each product
    prod_res_all = await db.execute(select(Product))
    all_products = {str(p.id): p for p in prod_res_all.scalars().all()}

    prod_cost_per_pkt = {}
    for pid, pdata in prod_purchase.items():
        prod = all_products.get(pid)
        pkts_per_bag = int(prod.packets_per_bag) if prod and prod.packets_per_bag else 1
        total_pkts = pdata["bags"] * pkts_per_bag
        if total_pkts <= 0:
            total_pkts = pdata["bags"]
        prod_cost_per_pkt[pid] = pdata["total_actual_cost"] / total_pkts if total_pkts > 0 else Decimal("0")

    # Sum sales items for the period
    si_query = select(SalesItem, SalesInvoice).join(SalesInvoice, SalesInvoice.id == SalesItem.sales_invoice_id)
    if start_date:
        si_query = si_query.where(SalesInvoice.invoice_date >= start_date)
    si_res = await db.execute(si_query)
    si_rows = si_res.all()

    tot_revenue = Decimal("0")
    tot_cogs = Decimal("0")
    for sitem, sinv in si_rows:
        pid = str(sitem.product_id)
        qty = Decimal(str(sitem.quantity or 0))
        rev = Decimal(str(sitem.line_total or 0)) - Decimal(str(sitem.gst_amount or 0))
        cogs = prod_cost_per_pkt.get(pid, Decimal("0")) * qty
        tot_revenue += rev
        tot_cogs += cogs

    tot_net_profit = tot_revenue - tot_cogs
    tot_gross_profit = tot_net_profit  # before expenses


    # 2. Purchases — billed (grand_total) + unbilled (unbilled_nongst_amount)
    p_query = select(PurchaseInvoice)
    if start_date:
        p_query = p_query.where(PurchaseInvoice.invoice_date >= start_date)
    p_res = await db.execute(p_query)
    pur_invs = p_res.scalars().all()

    tot_billed_purchases = sum(Decimal(str(i.grand_total or 0)) for i in pur_invs)
    tot_unbilled_purchases = sum(Decimal(str(i.unbilled_nongst_amount or 0)) for i in pur_invs)
    tot_purchases = tot_billed_purchases + tot_unbilled_purchases

    # 3. Expenses
    e_query = select(Expense)
    if start_date:
        e_query = e_query.where(Expense.expense_date >= start_date)
    e_res = await db.execute(e_query)
    expenses = e_res.scalars().all()
    tot_expenses = sum(Decimal(str(e.amount or 0)) for e in expenses)

    overall_net_profit = tot_net_profit - tot_expenses

    # 4. Receivables & Payables (always all-time — reflects current outstanding)
    rec_rep = await get_receivables_report(db)
    pay_rep = await get_payables_report(db)

    # 5. Out of stock count
    stk_res = await db.execute(
        select(GodownStock, Product)
        .join(Product, Product.id == GodownStock.product_id)
        .where(GodownStock.current_stock <= 0)
    )
    low_stock_count = len(stk_res.all())

    # 6. Customers & Suppliers count
    c_res = await db.execute(select(func.count(Party.id)).where(Party.is_active == True, Party.party_type.in_(["CUSTOMER", "BOTH"])))
    c_count = c_res.scalar() or 0

    sup_res = await db.execute(select(func.count(Party.id)).where(Party.is_active == True, Party.party_type.in_(["SUPPLIER", "BOTH"])))
    s_count = sup_res.scalar() or 0

    return DashboardSummaryResponse(
        total_sales=round(tot_sales, 2),
        total_purchases=round(tot_purchases, 2),
        total_billed_purchases=round(tot_billed_purchases, 2),
        total_unbilled_purchases=round(tot_unbilled_purchases, 2),
        gross_profit=round(tot_gross_profit, 2),
        net_profit=round(overall_net_profit, 2),
        total_operational_expenses=round(tot_expenses, 2),
        total_receivables=round(rec_rep.total_receivables, 2),
        total_payables=round(pay_rep.total_payables, 2),
        low_stock_items_count=low_stock_count,
        active_customers_count=c_count,
        active_suppliers_count=s_count
    )
