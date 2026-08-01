from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import date
import uuid

from app.core.database import get_db
from app.models.user import User
from app.api.deps import get_current_active_user
from app.schemas.reports import (
    LedgerStatementResponse,
    ReceivablesReportResponse, PayablesReportResponse,
    PartyProfitabilityResponse, ProductProfitabilityResponse,
    GSTSummaryResponse, DashboardSummaryResponse
)
from app.services.reports_service import (
    get_ledger_statement, get_receivables_report, get_payables_report,
    get_party_profitability, get_product_profitability,
    get_gst_summary, get_dashboard_summary
)

router = APIRouter(prefix="/reports", tags=["Reports & Analytics"])


@router.get("/ledger/{account_id}", response_model=LedgerStatementResponse)
async def ledger_statement_report(
    account_id: uuid.UUID,
    start_date: Optional[date] = Query(None, description="Start date filter (YYYY-MM-DD)"),
    end_date: Optional[date] = Query(None, description="End date filter (YYYY-MM-DD)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Get running ledger statement for any account (Party, Cash, Bank, Expense, Sales, Purchase).
    """
    return await get_ledger_statement(db, account_id, start_date, end_date)


@router.get("/receivables", response_model=ReceivablesReportResponse)
async def receivables_report(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Get Accounts Receivable aging report for customers owing money.
    """
    return await get_receivables_report(db)


@router.get("/payables", response_model=PayablesReportResponse)
async def payables_report(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Get Accounts Payable aging report for suppliers owed money.
    """
    return await get_payables_report(db)


@router.get("/profitability/parties", response_model=PartyProfitabilityResponse)
async def party_profitability_report(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Get Customer & Party profitability analytics (Revenue, COGS, Net Profit, Margin %).
    """
    return await get_party_profitability(db, start_date, end_date)


@router.get("/profitability/products", response_model=ProductProfitabilityResponse)
async def product_profitability_report(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Get Product SKU performance and margin analytics (Quantity Sold, Revenue, COGS, Line Profit).
    """
    return await get_product_profitability(db, start_date, end_date)


@router.get("/gst-summary", response_model=GSTSummaryResponse)
async def gst_summary_report(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Get GST Return Summary (Output GST vs Input Tax Credit & Net Payable).
    """
    return await get_gst_summary(db, start_date, end_date)


@router.get("/dashboard-summary", response_model=DashboardSummaryResponse)
async def dashboard_summary_report(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Get high-level Executive Dashboard KPIs (Sales, Purchases, Profits, Expenses, Receivables, Payables, Low Stock Count).
    """
    return await get_dashboard_summary(db)
