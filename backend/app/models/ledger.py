import enum
from sqlalchemy import String, ForeignKey, DateTime, Numeric, Date, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime, date
from typing import Optional

from app.core.database import Base

class AccountType(str, enum.Enum):
    ASSET = "ASSET"          # Cash, Bank, Receivables, Inventory
    LIABILITY = "LIABILITY"  # Payables (Suppliers), Loans
    EQUITY = "EQUITY"        # Capital Account
    REVENUE = "REVENUE"      # Sales Revenue, Incentives
    EXPENSE = "EXPENSE"      # Freight, Fuel, Rent, Salaries, Godown

class LedgerAccount(Base):
    """
    Chart of Accounts Table.
    Every Party (Supplier/Customer), Cash, Bank, and Operational Expense gets an account.
    """
    __tablename__ = "ledger_accounts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True
    )
    account_name: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    account_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True) # ASSET, LIABILITY, etc.
    party_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUID(as_uuid=True), ForeignKey("parties.id"), nullable=True
    )
    current_balance: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

class LedgerEntry(Base):
    """
    Double-Entry General Ledger Transaction Log.
    Every financial transaction creates paired Debit and Credit entries.
    """
    __tablename__ = "ledger_entries"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True
    )
    transaction_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    voucher_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True) # PURCHASE, SALES, PAYMENT, RECEIPT, EXPENSE
    reference_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), nullable=True)
    
    debit_account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ledger_accounts.id"), nullable=False
    )
    credit_account_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("ledger_accounts.id"), nullable=False
    )
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    narration: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    created_by: Mapped[Optional[uuid.UUID]] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
