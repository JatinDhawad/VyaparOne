"""
One-time fix: Post the missing RECEIPT ledger entry for the POS invoice 
where amount_paid=70480 was saved to sales_invoices but never credited 
against the customer's ledger account.

After this script runs:
  - Customer ledger balance = pending_amount = 9180 (correct)
  - RECEIPT entry of 70480 will appear in the ledger
"""
import asyncio
import logging
from decimal import Decimal
from sqlalchemy.future import select
from sqlalchemy import update

from app.core.database import engine, AsyncSessionLocal
from app.models.transactions import SalesInvoice
from app.models.ledger import LedgerAccount, LedgerEntry, AccountType
from app.services.ledger_service import get_party_ledger_account, get_or_create_system_account

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def fix_missing_receipt():
    async with AsyncSessionLocal() as db:
        # 1. Find the invoice with grand_total=79660 and amount_paid=70480
        result = await db.execute(
            select(SalesInvoice).where(
                SalesInvoice.grand_total == 79660,
                SalesInvoice.amount_paid == 70480
            )
        )
        invoice = result.scalars().first()

        if not invoice:
            logger.error("Invoice not found! Trying broader search...")
            # Try by pending_amount
            result2 = await db.execute(
                select(SalesInvoice).where(SalesInvoice.pending_amount == 9180)
            )
            invoice = result2.scalars().first()

        if not invoice:
            logger.error("Could not find the invoice. Aborting.")
            return

        logger.info(f"Found invoice: {invoice.invoice_number} | grand_total={invoice.grand_total} | amount_paid={invoice.amount_paid} | pending={invoice.pending_amount}")

        # 2. Check if a RECEIPT entry already exists for this invoice
        existing_receipt = await db.execute(
            select(LedgerEntry).where(
                LedgerEntry.reference_id == invoice.id,
                LedgerEntry.voucher_type == "RECEIPT"
            )
        )
        if existing_receipt.scalars().first():
            logger.info("RECEIPT entry already exists for this invoice. Nothing to fix.")
            return

        # 3. Get customer ledger account
        customer_account = await get_party_ledger_account(db, invoice.customer_id)
        logger.info(f"Customer ledger current_balance BEFORE fix: {customer_account.current_balance}")

        # 4. Get cash account (payment was CASH mode assumed, or check payment_mode)
        payment_mode = getattr(invoice, 'payment_mode', 'CASH') or 'CASH'
        mode_acct_name = "Bank Account" if payment_mode.upper() in ["BANK", "UPI", "CHEQUE", "NEFT"] else "Cash In Hand"
        cash_account = await get_or_create_system_account(db, mode_acct_name, AccountType.ASSET.value)

        amount_paid = Decimal(str(invoice.amount_paid or 0))

        # 5. Post the missing RECEIPT entry
        receipt_entry = LedgerEntry(
            transaction_date=invoice.invoice_date,
            voucher_type="RECEIPT",
            reference_id=invoice.id,
            debit_account_id=cash_account.id,
            credit_account_id=customer_account.id,
            amount=amount_paid,
            narration=f"[BACKFILL] POS payment received ({payment_mode}) — correcting missing receipt for invoice {invoice.invoice_number}",
        )
        db.add(receipt_entry)

        # 6. Update balances
        customer_account.current_balance = Decimal(str(customer_account.current_balance or 0)) - amount_paid
        cash_account.current_balance = Decimal(str(cash_account.current_balance or 0)) + amount_paid

        await db.commit()

        logger.info(f"✅ RECEIPT entry of ₹{amount_paid} posted successfully.")
        logger.info(f"Customer ledger balance AFTER fix: {customer_account.current_balance}")
        logger.info(f"This should now equal pending_amount = {invoice.pending_amount}")


if __name__ == "__main__":
    asyncio.run(fix_missing_receipt())
