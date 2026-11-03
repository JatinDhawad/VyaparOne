"""Audit trail for financial documents.

record_audit() writes one AuditLog row (who, what, when, before/after) in the same
database transaction as the change it describes. It is best-effort: it runs inside a
savepoint and swallows its own errors, so a logging problem can never block or roll
back an invoice operation.
"""
import json
import logging
import uuid
from typing import Any, Iterable, Optional

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.transactions import AuditLog

logger = logging.getLogger(__name__)

SALES_AUDIT_FIELDS = (
    "invoice_number", "customer_id", "invoice_date", "billing_mode", "subtotal",
    "grand_total", "amount_paid", "pending_amount", "salesman_commission",
    "total_cost_of_goods", "net_profit",
)

PURCHASE_AUDIT_FIELDS = (
    "invoice_number", "supplier_id", "invoice_date", "billing_mode", "subtotal",
    "tax_amount", "grand_total", "unbilled_nongst_amount", "total_payable_amount",
    "amount_paid", "pending_amount",
)


def snapshot(obj: Any, fields: Iterable[str]) -> dict:
    """Plain, JSON-safe copy of selected attributes (Decimals, dates and UUIDs become strings)."""
    raw = {f: getattr(obj, f, None) for f in fields}
    return json.loads(json.dumps(raw, default=str))


async def record_audit(
    db: AsyncSession,
    *,
    user_id: Optional[uuid.UUID],
    action: str,
    table_name: str,
    record_id: uuid.UUID,
    old_data: Optional[dict] = None,
    new_data: Optional[dict] = None,
) -> None:
    try:
        async with db.begin_nested():
            db.add(AuditLog(
                user_id=user_id,
                action=action,
                table_name=table_name,
                record_id=record_id,
                old_data=old_data,
                new_data=new_data,
            ))
            await db.flush()
    except Exception:
        logger.warning("Audit log write failed for %s %s", action, record_id, exc_info=True)
