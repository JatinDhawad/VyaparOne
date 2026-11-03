"""Baseline: the schema as it existed when Alembic was adopted.

Intentionally empty. Existing databases already have these tables (created by
app/scripts/init_db.py via create_all), so this revision just marks the starting
point. All future schema changes should be written as new migrations.

Revision ID: 0001_baseline
Revises:
"""
from alembic import op  # noqa: F401
import sqlalchemy as sa  # noqa: F401

revision = "0001_baseline"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
