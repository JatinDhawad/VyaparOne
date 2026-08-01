from decimal import Decimal
from datetime import date
import uuid
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.models.ledger import LedgerAccount, LedgerEntry, AccountType


async def get_or_create_system_account(
    db: AsyncSession,
    account_name: str,
    account_type: str
) -> LedgerAccount:
    """
    Fetches or creates a system-wide general ledger account (e.g. Purchases, Sales, Freight Expense).
    """
    result = await db.execute(
        select(LedgerAccount).where(
            LedgerAccount.account_name == account_name,
            LedgerAccount.party_id.is_(None)
        )
    )
    account = result.scalars().first()
    if not account:
        account = LedgerAccount(
            account_name=account_name,
            account_type=account_type,
            current_balance=Decimal("0.00")
        )
        db.add(account)
        await db.flush()
    return account


async def get_party_ledger_account(
    db: AsyncSession,
    party_id: uuid.UUID
) -> LedgerAccount:
    """
    Fetches the ledger account associated with a specific Party.
    """
    result = await db.execute(
        select(LedgerAccount).where(LedgerAccount.party_id == party_id)
    )
    account = result.scalars().first()
    if not account:
        raise ValueError(f"No ledger account found for party_id={party_id}")
    return account


async def post_purchase_ledger(
    db: AsyncSession,
    purchase_invoice_id: uuid.UUID,
    supplier_id: uuid.UUID,
    goods_amount: Decimal,
    freight_amount: Decimal,
    grand_total: Decimal,
    invoice_date: date,
    created_by: Optional[uuid.UUID] = None
):
    """
    Double-entry posting for Purchase Invoice:
    - Debit: Purchase Account (goods_amount)
    - Debit: Freight Expense Account (freight_amount, if > 0)
    - Credit: Supplier Ledger Account (grand_total)
    """
    purchase_account = await get_or_create_system_account(db, "Purchase Account", AccountType.EXPENSE.value)
    supplier_account = await get_party_ledger_account(db, supplier_id)

    # 1. Debit Purchase Account, Credit Supplier Account for Goods
    if goods_amount > 0:
        entry_goods = LedgerEntry(
            transaction_date=invoice_date,
            voucher_type="PURCHASE",
            reference_id=purchase_invoice_id,
            debit_account_id=purchase_account.id,
            credit_account_id=supplier_account.id,
            amount=goods_amount,
            narration=f"Purchase invoice goods amount",
            created_by=created_by
        )
        db.add(entry_goods)
        purchase_account.current_balance = Decimal(str(purchase_account.current_balance or 0)) + goods_amount
        supplier_account.current_balance = Decimal(str(supplier_account.current_balance or 0)) + goods_amount

    # 2. Debit Freight Account, Credit Supplier Account for Freight
    if freight_amount > 0:
        freight_account = await get_or_create_system_account(db, "Freight & Transport Expense", AccountType.EXPENSE.value)
        entry_freight = LedgerEntry(
            transaction_date=invoice_date,
            voucher_type="PURCHASE",
            reference_id=purchase_invoice_id,
            debit_account_id=freight_account.id,
            credit_account_id=supplier_account.id,
            amount=freight_amount,
            narration=f"Freight charges on purchase invoice",
            created_by=created_by
        )
        db.add(entry_freight)
        freight_account.current_balance = Decimal(str(freight_account.current_balance or 0)) + freight_amount
        supplier_account.current_balance = Decimal(str(supplier_account.current_balance or 0)) + freight_amount


async def post_sales_ledger(
    db: AsyncSession,
    sales_invoice_id: uuid.UUID,
    customer_id: uuid.UUID,
    sales_amount: Decimal,
    grand_total: Decimal,
    invoice_date: date,
    created_by: Optional[uuid.UUID] = None
):
    """
    Double-entry posting for Sales Invoice:
    - Debit: Customer Ledger Account (grand_total)
    - Credit: Sales Account (sales_amount)
    """
    sales_account = await get_or_create_system_account(db, "Sales Account", AccountType.REVENUE.value)
    customer_account = await get_party_ledger_account(db, customer_id)

    entry = LedgerEntry(
        transaction_date=invoice_date,
        voucher_type="SALES",
        reference_id=sales_invoice_id,
        debit_account_id=customer_account.id,
        credit_account_id=sales_account.id,
        amount=grand_total,
        narration="Sales invoice billing",
        created_by=created_by
    )
    db.add(entry)
    customer_account.current_balance = Decimal(str(customer_account.current_balance or 0)) + grand_total
    sales_account.current_balance = Decimal(str(sales_account.current_balance or 0)) + grand_total


async def post_payment_ledger(
    db: AsyncSession,
    payment_id: uuid.UUID,
    payment_type: str,  # RECEIPT or PAYMENT
    party_id: Optional[uuid.UUID],
    amount: Decimal,
    payment_mode: str,
    payment_date: date,
    created_by: Optional[uuid.UUID] = None
):
    """
    Double-entry posting for Payment/Receipt:
    - RECEIPT (Customer pays us): Debit Cash/Bank Account, Credit Customer Account
    - PAYMENT (We pay Supplier): Debit Supplier Account, Credit Cash/Bank Account
    """
    mode_acct_name = "Bank Account" if payment_mode.upper() in ["BANK", "UPI", "CHEQUE", "NEFT"] else "Cash In Hand"
    cash_bank_account = await get_or_create_system_account(db, mode_acct_name, AccountType.ASSET.value)

    if party_id:
        party_account = await get_party_ledger_account(db, party_id)

    if payment_type.upper() == "RECEIPT":
        # Customer pays us
        debit_id = cash_bank_account.id
        credit_id = party_account.id if party_id else cash_bank_account.id
        narration = f"Customer payment receipt ({payment_mode})"
    else:
        # We pay supplier
        debit_id = party_account.id if party_id else cash_bank_account.id
        credit_id = cash_bank_account.id
        narration = f"Supplier payment ({payment_mode})"

    entry = LedgerEntry(
        transaction_date=payment_date,
        voucher_type=payment_type.upper(),
        reference_id=payment_id,
        debit_account_id=debit_id,
        credit_account_id=credit_id,
        amount=amount,
        narration=narration,
        created_by=created_by
    )
    db.add(entry)

    # Update balances
    if payment_type.upper() == "RECEIPT":
        cash_bank_account.current_balance = Decimal(str(cash_bank_account.current_balance or 0)) + amount
        if party_id:
            party_account.current_balance = Decimal(str(party_account.current_balance or 0)) - amount
    else:
        if party_id:
            party_account.current_balance = Decimal(str(party_account.current_balance or 0)) - amount
        cash_bank_account.current_balance = Decimal(str(cash_bank_account.current_balance or 0)) - amount


async def post_expense_ledger(
    db: AsyncSession,
    expense_id: uuid.UUID,
    category: str,
    amount: Decimal,
    payment_mode: str,
    expense_date: date,
    created_by: Optional[uuid.UUID] = None
):
    """
    Double-entry posting for Operational Expense:
    - Debit: Operational Expense Account (specific category)
    - Credit: Cash/Bank Account
    """
    expense_account = await get_or_create_system_account(db, f"Expense - {category}", AccountType.EXPENSE.value)
    mode_acct_name = "Bank Account" if payment_mode.upper() in ["BANK", "UPI", "CHEQUE"] else "Cash In Hand"
    cash_bank_account = await get_or_create_system_account(db, mode_acct_name, AccountType.ASSET.value)

    entry = LedgerEntry(
        transaction_date=expense_date,
        voucher_type="EXPENSE",
        reference_id=expense_id,
        debit_account_id=expense_account.id,
        credit_account_id=cash_bank_account.id,
        amount=amount,
        narration=f"Operational expense: {category}",
        created_by=created_by
    )
    db.add(entry)
    expense_account.current_balance = Decimal(str(expense_account.current_balance or 0)) + amount
    cash_bank_account.current_balance = Decimal(str(cash_bank_account.current_balance or 0)) - amount
