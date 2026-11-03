"""One ledger account per party: merge duplicates, then add a unique constraint.

Some parties ended up with several ledger_accounts rows, which split their balance
across duplicates. This migration:
  1. For each party with duplicates, keeps the oldest account, repoints every ledger
     entry (debit and credit side) from the duplicates to it, sets its balance to the
     sum of the duplicates' balances, and deletes the duplicates.
  2. Adds UNIQUE (party_id). NULL party_id (cash, bank, expense accounts) is unaffected.

It refuses to guess: if a party's duplicate accounts have different account types,
it stops with an error so you can fix that by hand.

Safe to run twice (skips work that is already done). Test on a COPY of production first.

Revision ID: 0002_ledger_party_unique
Revises: 0001_baseline
"""
from decimal import Decimal

from alembic import op
import sqlalchemy as sa

revision = "0002_ledger_party_unique"
down_revision = "0001_baseline"
branch_labels = None
depends_on = None

CONSTRAINT = "uq_ledger_accounts_party_id"


def upgrade() -> None:
    conn = op.get_bind()

    dup_parties = conn.execute(sa.text(
        "SELECT party_id FROM ledger_accounts WHERE party_id IS NOT NULL "
        "GROUP BY party_id HAVING COUNT(*) > 1"
    )).fetchall()

    for (party_id,) in dup_parties:
        rows = conn.execute(
            sa.text(
                "SELECT id, account_type, current_balance FROM ledger_accounts "
                "WHERE party_id = :p ORDER BY created_at, id"
            ),
            {"p": party_id},
        ).fetchall()

        types = {r.account_type for r in rows}
        if len(types) > 1:
            raise RuntimeError(
                f"Party {party_id} has duplicate ledger accounts of different types {sorted(types)}; "
                "merge them manually before running this migration."
            )

        keeper = rows[0].id
        total = sum((Decimal(str(r.current_balance or 0)) for r in rows), Decimal("0"))

        for dup in rows[1:]:
            conn.execute(sa.text(
                "UPDATE ledger_entries SET debit_account_id = :k WHERE debit_account_id = :d"
            ), {"k": keeper, "d": dup.id})
            conn.execute(sa.text(
                "UPDATE ledger_entries SET credit_account_id = :k WHERE credit_account_id = :d"
            ), {"k": keeper, "d": dup.id})
            conn.execute(sa.text("DELETE FROM ledger_accounts WHERE id = :d"), {"d": dup.id})

        conn.execute(
            sa.text("UPDATE ledger_accounts SET current_balance = :t WHERE id = :k")
            .bindparams(sa.bindparam("t", type_=sa.Numeric(12, 2))),
            {"t": total, "k": keeper},
        )

    existing = {c["name"] for c in sa.inspect(conn).get_unique_constraints("ledger_accounts")}
    if CONSTRAINT not in existing:
        with op.batch_alter_table("ledger_accounts") as batch:
            batch.create_unique_constraint(CONSTRAINT, ["party_id"])


def downgrade() -> None:
    # Removes the constraint only. Merged duplicate accounts are not restored.
    with op.batch_alter_table("ledger_accounts") as batch:
        batch.drop_constraint(CONSTRAINT, type_="unique")
