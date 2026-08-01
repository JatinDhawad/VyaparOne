from decimal import Decimal
from datetime import date
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
    res = await db.execute(
        select(Party, LedgerAccount)
        .join(LedgerAccount, LedgerAccount.party_id == Party.id)
        .where(
            Party.is_active == True,
            Party.party_type.in_(["CUSTOMER", "BOTH"])
        )
    )
    rows = res.all()
    total_rec = Decimal("0.00")
    party_items = []

    for party, account in rows:
        bal = Decimal(str(account.current_balance or 0))
        if bal > Decimal("0.00"):
            total_rec += bal
            party_items.append(
                OutstandingPartyItem(
                    party_id=party.id,
                    party_name=party.name,
                    party_type=party.party_type,
                    phone=party.phone,
                    city=party.city,
                    credit_limit=Decimal(str(party.credit_limit or 0)),
                    credit_days=party.credit_days or 30,
                    current_balance=bal,
                    is_overdue=False  # can be extended based on invoice dates
                )
            )

    return ReceivablesReportResponse(
        total_receivables=round(total_rec, 2),
        total_parties=len(party_items),
        parties=party_items
    )


async def get_payables_report(db: AsyncSession) -> PayablesReportResponse:
    res = await db.execute(
        select(Party, LedgerAccount)
        .join(LedgerAccount, LedgerAccount.party_id == Party.id)
        .where(
            Party.is_active == True,
            Party.party_type.in_(["SUPPLIER", "BOTH"])
        )
    )
    rows = res.all()
    total_pay = Decimal("0.00")
    party_items = []

    for party, account in rows:
        bal = Decimal(str(account.current_balance or 0))
        if bal > Decimal("0.00"):
            total_pay += bal
            party_items.append(
                OutstandingPartyItem(
                    party_id=party.id,
                    party_name=party.name,
                    party_type=party.party_type,
                    phone=party.phone,
                    city=party.city,
                    credit_limit=Decimal(str(party.credit_limit or 0)),
                    credit_days=party.credit_days or 30,
                    current_balance=bal,
                    is_overdue=False
                )
            )

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
    query = select(SalesItem, SalesInvoice).join(SalesInvoice, SalesInvoice.id == SalesItem.sales_invoice_id)
    if start_date:
        query = query.where(SalesInvoice.invoice_date >= start_date)
    if end_date:
        query = query.where(SalesInvoice.invoice_date <= end_date)

    res = await db.execute(query)
    rows = res.all()

    prod_map = {}
    for item, inv in rows:
        pid = item.product_id
        if pid not in prod_map:
            prod_map[pid] = {
                "qty": Decimal("0.00"),
                "revenue": Decimal("0.00"),
                "cogs": Decimal("0.00"),
                "profit": Decimal("0.00")
            }

        qty = Decimal(str(item.quantity or 0))
        rev = Decimal(str(item.line_total or 0)) - Decimal(str(item.gst_amount or 0))
        cogs = qty * Decimal(str(item.unit_landed_cost or 0))
        profit = Decimal(str(item.line_profit or 0))

        prod_map[pid]["qty"] += qty
        prod_map[pid]["revenue"] += rev
        prod_map[pid]["cogs"] += cogs
        prod_map[pid]["profit"] += profit

    total_qty = Decimal("0.00")
    total_rev = Decimal("0.00")
    total_prof = Decimal("0.00")
    items = []

    for pid, data in prod_map.items():
        p_res = await db.execute(select(Product, GodownStock).join(GodownStock, GodownStock.product_id == Product.id).where(Product.id == pid))
        p_row = p_res.first()
        prod = p_row[0] if p_row else None
        stock = p_row[1] if p_row else None

        pname = prod.name if prod else "Unknown Product"
        sku = prod.sku if prod else ""
        unit = prod.unit if prod else "BOX"
        avg_cost = Decimal(str(stock.average_landed_cost or 0)) if stock else Decimal("0.00")

        qty = data["qty"]
        rev = data["revenue"]
        cogs = data["cogs"]
        prof = data["profit"]
        margin = (prof / rev * Decimal("100.00")) if rev > 0 else Decimal("0.00")

        total_qty += qty
        total_rev += rev
        total_prof += prof

        items.append(
            ProductProfitabilityItem(
                product_id=pid,
                product_name=pname,
                sku=sku,
                unit=unit,
                quantity_sold=round(qty, 2),
                total_revenue=round(rev, 2),
                average_landed_cost=round(avg_cost, 2),
                total_cogs=round(cogs, 2),
                total_line_profit=round(prof, 2),
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


async def get_dashboard_summary(db: AsyncSession) -> DashboardSummaryResponse:
    # 1. Sales & Profit
    s_res = await db.execute(select(SalesInvoice))
    sales_invs = s_res.scalars().all()

    tot_sales = sum(Decimal(str(i.grand_total or 0)) for i in sales_invs)
    tot_cogs = sum(Decimal(str(i.total_cost_of_goods or 0)) for i in sales_invs)
    tot_net_profit = sum(Decimal(str(i.net_profit or 0)) for i in sales_invs)
    tot_gross_profit = sum((Decimal(str(i.subtotal or 0)) - Decimal(str(i.discount_amount or 0)) - Decimal(str(i.total_cost_of_goods or 0))) for i in sales_invs)

    # 2. Purchases (Total Amount to be Paid)
    p_res = await db.execute(select(PurchaseInvoice))
    pur_invs = p_res.scalars().all()
    tot_purchases = sum(Decimal(str(i.total_payable_amount or i.grand_total or 0)) for i in pur_invs)

    # 3. Expenses
    e_res = await db.execute(select(Expense))
    expenses = e_res.scalars().all()
    tot_expenses = sum(Decimal(str(e.amount or 0)) for e in expenses)

    overall_net_profit = tot_net_profit - tot_expenses

    # 4. Receivables & Payables
    rec_rep = await get_receivables_report(db)
    pay_rep = await get_payables_report(db)

    # 5. Out of stock count (min threshold feature disabled)
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
        gross_profit=round(tot_gross_profit, 2),
        net_profit=round(overall_net_profit, 2),
        total_operational_expenses=round(tot_expenses, 2),
        total_receivables=round(rec_rep.total_receivables, 2),
        total_payables=round(pay_rep.total_payables, 2),
        low_stock_items_count=low_stock_count,
        active_customers_count=c_count,
        active_suppliers_count=s_count
    )
