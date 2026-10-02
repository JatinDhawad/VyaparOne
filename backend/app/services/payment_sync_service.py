import uuid
from decimal import Decimal
from typing import Dict, Any
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.transactions import Payment, SalesInvoice, PurchaseInvoice
from app.models.ledger import LedgerEntry, LedgerAccount


async def sync_all_payments(db: AsyncSession) -> Dict[str, Any]:
    """
    Synchronizes all historical and active payments done (to suppliers/purchases)
    and received (from customers/sales) into the Payment table.
    Ensures idempotency using deterministic voucher numbers and reference_numbers.
    """
    synced_sales = 0
    synced_purchases = 0
    synced_ledger = 0

    # ── 1. Sync Receipts from SalesInvoices with amount_paid > 0 ──────────────
    sales_result = await db.execute(
        select(SalesInvoice).where(SalesInvoice.amount_paid > 0)
    )
    sales = sales_result.scalars().all()

    for sale in sales:
        ref_str = str(sale.id)
        # Check by reference_number or voucher_number
        existing_res = await db.execute(
            select(Payment).where(
                (Payment.reference_number == ref_str) |
                (Payment.voucher_number == f"REC-{sale.invoice_number}")
            )
        )
        existing = existing_res.scalars().first()

        pm = (sale.payment_mode or "CASH").upper()
        amt = Decimal(str(sale.amount_paid))

        if existing:
            # Update in case amount, date, or party changed
            updated = False
            if existing.amount != amt:
                existing.amount = amt
                updated = True
            if existing.party_id != sale.customer_id:
                existing.party_id = sale.customer_id
                updated = True
            if existing.payment_date != sale.invoice_date:
                existing.payment_date = sale.invoice_date
                updated = True
            if existing.payment_mode != pm:
                existing.payment_mode = pm
                updated = True
            if updated:
                synced_sales += 1
        else:
            db_pay = Payment(
                voucher_number=f"REC-{sale.invoice_number}",
                payment_type="RECEIPT",
                party_id=sale.customer_id,
                amount=amt,
                payment_mode=pm,
                reference_number=ref_str,
                payment_date=sale.invoice_date,
                remarks=f"Payment received for Sale Invoice #{sale.invoice_number}",
                created_by=sale.created_by,
            )
            db.add(db_pay)
            synced_sales += 1

    await db.flush()

    # ── 2. Sync Payments from LedgerEntry (PAYMENT voucher_type) ──────────────
    le_pay_result = await db.execute(
        select(LedgerEntry).where(LedgerEntry.voucher_type == "PAYMENT")
    )
    le_payments = le_pay_result.scalars().all()

    for le in le_payments:
        # If this ledger entry was created for an existing manual Payment, skip
        if le.reference_id:
            chk_pay = await db.execute(
                select(Payment.id).where(Payment.id == le.reference_id)
            )
            if chk_pay.scalars().first():
                continue

        # Check if already synced by reference_number == str(le.id)
        existing_le_res = await db.execute(
            select(Payment).where(Payment.reference_number == str(le.id))
        )
        if existing_le_res.scalars().first():
            continue

        # Determine party and details
        supplier_id = None
        inv_num = None
        if le.reference_id:
            pur_res = await db.execute(
                select(PurchaseInvoice).where(PurchaseInvoice.id == le.reference_id)
            )
            pur = pur_res.scalars().first()
            if pur:
                supplier_id = pur.supplier_id
                inv_num = pur.invoice_number

        if not supplier_id:
            # Debit account on a PAYMENT entry is the supplier's LedgerAccount
            debit_acct_res = await db.execute(
                select(LedgerAccount).where(LedgerAccount.id == le.debit_account_id)
            )
            debit_acct = debit_acct_res.scalars().first()
            if debit_acct and debit_acct.party_id:
                supplier_id = debit_acct.party_id

        # Determine payment mode from narration if possible
        narr = le.narration or ""
        pm = "CASH"
        for mode in ["UPI", "BANK", "CHEQUE", "NEFT", "RTGS", "CASH"]:
            if mode in narr.upper():
                pm = mode
                break

        v_num = f"PAY-{inv_num or 'BILL'}-{le.id.hex[:6].upper()}"
        existing_v = await db.execute(select(Payment.id).where(Payment.voucher_number == v_num))
        if existing_v.scalars().first():
            v_num = f"PAY-{le.id.hex[:8].upper()}"

        rem = narr if narr else (f"Payment to supplier for Bill #{inv_num}" if inv_num else "Supplier payment")

        db_pay = Payment(
            voucher_number=v_num,
            payment_type="PAYMENT",
            party_id=supplier_id,
            amount=Decimal(str(le.amount)),
            payment_mode=pm,
            reference_number=str(le.id),
            payment_date=le.transaction_date,
            remarks=rem,
            created_by=le.created_by,
        )
        db.add(db_pay)
        synced_ledger += 1

    await db.flush()

    # ── 3. Check any PurchaseInvoice with amount_paid > 0 not captured ────────
    pur_result = await db.execute(
        select(PurchaseInvoice).where(PurchaseInvoice.amount_paid > 0)
    )
    purchases = pur_result.scalars().all()

    for pur in purchases:
        has_pay = await db.execute(
            select(Payment.id).where(
                (Payment.reference_number == str(pur.id)) |
                (Payment.remarks.ilike(f"%{pur.invoice_number}%"))
            )
        )
        if not has_pay.scalars().first():
            amt = Decimal(str(pur.amount_paid))
            v_num = f"PAY-{pur.invoice_number}"
            existing_v = await db.execute(select(Payment.id).where(Payment.voucher_number == v_num))
            if existing_v.scalars().first():
                v_num = f"PAY-{pur.invoice_number}-{uuid.uuid4().hex[:4].upper()}"

            db_pay = Payment(
                voucher_number=v_num,
                payment_type="PAYMENT",
                party_id=pur.supplier_id,
                amount=amt,
                payment_mode="CASH",
                reference_number=str(pur.id),
                payment_date=pur.invoice_date,
                remarks=f"Payment for Purchase Bill #{pur.invoice_number}",
                created_by=pur.created_by,
            )
            db.add(db_pay)
            synced_purchases += 1

    # ── 4. Sync any unlinked LedgerEntry with voucher_type == 'RECEIPT' ───────
    le_rec_result = await db.execute(
        select(LedgerEntry).where(LedgerEntry.voucher_type == "RECEIPT")
    )
    le_receipts = le_rec_result.scalars().all()

    for le in le_receipts:
        # Check if already manual payment or synced
        if le.reference_id:
            chk_pay = await db.execute(select(Payment.id).where(Payment.id == le.reference_id))
            if chk_pay.scalars().first():
                continue
            chk_sale = await db.execute(select(Payment.id).where(Payment.reference_number == str(le.reference_id)))
            if chk_sale.scalars().first():
                continue

        existing_rec = await db.execute(select(Payment.id).where(Payment.reference_number == str(le.id)))
        if existing_rec.scalars().first():
            continue

        # Look up customer party from credit account
        acct_res = await db.execute(select(LedgerAccount).where(LedgerAccount.id == le.credit_account_id))
        acct = acct_res.scalars().first()
        cust_id = acct.party_id if acct else None

        narr = le.narration or ""
        pm = "CASH"
        for mode in ["UPI", "BANK", "CHEQUE", "NEFT", "RTGS", "CASH"]:
            if mode in narr.upper():
                pm = mode
                break

        v_num = f"REC-{le.id.hex[:8].upper()}"
        db_pay = Payment(
            voucher_number=v_num,
            payment_type="RECEIPT",
            party_id=cust_id,
            amount=Decimal(str(le.amount)),
            payment_mode=pm,
            reference_number=str(le.id),
            payment_date=le.transaction_date,
            remarks=narr or "Customer payment receipt",
            created_by=le.created_by,
        )
        db.add(db_pay)
        synced_ledger += 1

    await db.commit()

    total = synced_sales + synced_purchases + synced_ledger
    return {
        "status": "success",
        "synced_sales_receipts": synced_sales,
        "synced_purchase_payments": synced_purchases,
        "synced_ledger_payments": synced_ledger,
        "total_synced": total,
        "message": f"Successfully synchronized {total} payments and receipts!"
    }
