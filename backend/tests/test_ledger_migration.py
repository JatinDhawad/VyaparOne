"""Migration 0002: merge duplicate per-party ledger accounts, then add UNIQUE(party_id)."""
import importlib.util
import os
import subprocess
import sys

import pytest
import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations

BACKEND = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MIG = os.path.join(BACKEND, "alembic", "versions", "0002_ledger_party_unique.py")

OLD_SCHEMA = [
    """CREATE TABLE ledger_accounts (
        id CHAR(32) PRIMARY KEY, account_name VARCHAR(150), account_type VARCHAR(50),
        party_id CHAR(32), current_balance NUMERIC(12,2), created_at DATETIME)""",
    """CREATE TABLE ledger_entries (
        id CHAR(32) PRIMARY KEY, debit_account_id CHAR(32), credit_account_id CHAR(32),
        amount NUMERIC(12,2))""",
]


def _load():
    spec = importlib.util.spec_from_file_location("mig0002", MIG)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _make_db(path):
    eng = sa.create_engine(f"sqlite:///{path}")
    with eng.begin() as c:
        for ddl in OLD_SCHEMA:
            c.execute(sa.text(ddl))
        acct = "INSERT INTO ledger_accounts VALUES (:id,:n,:t,:p,:b,:c)"
        rows = [
            ("a1", "Rajesh", "ASSET", "p1", 100, "2026-01-01"),   # oldest -> keeper
            ("a2", "Rajesh", "ASSET", "p1", 40, "2026-02-01"),
            ("a3", "Rajesh", "ASSET", "p1", -10, "2026-03-01"),
            ("b1", "Solo", "LIABILITY", "p2", 7, "2026-01-01"),
            ("c1", "Cash", "ASSET", None, 5, "2026-01-01"),
            ("c2", "Bank", "ASSET", None, 6, "2026-01-01"),        # NULL party_id must stay allowed
        ]
        for r in rows:
            c.execute(sa.text(acct), dict(zip("id n t p b c".split(), r)))
        c.execute(sa.text("INSERT INTO ledger_entries VALUES ('e1','a2','b1',10)"))
        c.execute(sa.text("INSERT INTO ledger_entries VALUES ('e2','b1','a3',20)"))
    return eng


def _upgrade(eng):
    mod = _load()
    with eng.begin() as conn:
        with Operations.context(MigrationContext.configure(conn)):
            mod.upgrade()


def test_merges_duplicates_and_adds_unique_constraint(tmp_path):
    eng = _make_db(tmp_path / "t.db")
    _upgrade(eng)
    with eng.connect() as c:
        accts = c.execute(sa.text(
            "SELECT id, current_balance FROM ledger_accounts WHERE party_id='p1'")).fetchall()
        assert [(a.id, float(a.current_balance)) for a in accts] == [("a1", 130.0)]
        # entries repointed to the surviving account
        e = {r.id: (r.debit_account_id, r.credit_account_id) for r in
             c.execute(sa.text("SELECT * FROM ledger_entries"))}
        assert e["e1"] == ("a1", "b1")
        assert e["e2"] == ("b1", "a1")
        # NULL party accounts untouched
        assert c.execute(sa.text(
            "SELECT COUNT(*) FROM ledger_accounts WHERE party_id IS NULL")).scalar() == 2
        names = {u["name"] for u in sa.inspect(c).get_unique_constraints("ledger_accounts")}
        assert "uq_ledger_accounts_party_id" in names

    with pytest.raises(sa.exc.IntegrityError):
        with eng.begin() as c:
            c.execute(sa.text("INSERT INTO ledger_accounts VALUES ('x','Dup','ASSET','p2',0,'2026-04-01')"))


def test_second_run_is_a_noop(tmp_path):
    eng = _make_db(tmp_path / "t.db")
    _upgrade(eng)
    _upgrade(eng)
    with eng.connect() as c:
        assert c.execute(sa.text("SELECT COUNT(*) FROM ledger_accounts")).scalar() == 4


def test_refuses_to_merge_mixed_account_types(tmp_path):
    eng = _make_db(tmp_path / "t.db")
    with eng.begin() as c:
        c.execute(sa.text("UPDATE ledger_accounts SET account_type='LIABILITY' WHERE id='a2'"))
    with pytest.raises(RuntimeError, match="different types"):
        _upgrade(eng)
    with eng.connect() as c:  # nothing changed
        assert c.execute(sa.text(
            "SELECT COUNT(*) FROM ledger_accounts WHERE party_id='p1'")).scalar() == 3


def test_alembic_cli_upgrade_head_end_to_end(tmp_path):
    path = tmp_path / "cli.db"
    _make_db(path)
    env = dict(os.environ, SECRET_KEY="x", DATABASE_URL=f"sqlite+aiosqlite:///{path}")
    r = subprocess.run([sys.executable, "-m", "alembic", "upgrade", "head"],
                       cwd=BACKEND, env=env, capture_output=True, text=True)
    assert r.returncode == 0, r.stderr
    eng = sa.create_engine(f"sqlite:///{path}")
    with eng.connect() as c:
        assert c.execute(sa.text("SELECT version_num FROM alembic_version")).scalar() == "0002_ledger_party_unique"
        assert c.execute(sa.text(
            "SELECT COUNT(*) FROM ledger_accounts WHERE party_id='p1'")).scalar() == 1
