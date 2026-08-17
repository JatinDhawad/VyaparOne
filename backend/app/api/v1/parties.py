from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
import uuid

from app.core.database import get_db
from app.models.party import Party
from app.models.ledger import LedgerAccount
from app.models.user import RoleName, User
from app.schemas.party import PartyCreate, PartyUpdate, PartyResponse
from app.api.deps import get_current_active_user, require_role

router = APIRouter(prefix="/parties", tags=["Parties"])


def _get_account_type_for_party(party_type: str) -> str:
    """Determine ledger account type based on party type."""
    if party_type == "SUPPLIER":
        return "LIABILITY"  # We owe suppliers
    elif party_type == "CUSTOMER":
        return "ASSET"  # Customers owe us
    return "ASSET"  # Default for BOTH


@router.post("", response_model=PartyResponse, status_code=status.HTTP_201_CREATED)
@router.post("/", response_model=PartyResponse, status_code=status.HTTP_201_CREATED)
async def create_party(
    party_in: PartyCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([RoleName.ADMIN])),
):
    """Create a new party (supplier/customer). ADMIN only.
    Auto-creates a LedgerAccount for the party."""
    valid_types = {"SUPPLIER", "CUSTOMER", "BOTH"}
    if party_in.party_type not in valid_types:
        raise HTTPException(status_code=400, detail=f"party_type must be one of {valid_types}")

    db_party = Party(**party_in.model_dump())
    db.add(db_party)
    await db.flush()  # get the party ID

    # Auto-create ledger account for the party
    account_type = _get_account_type_for_party(party_in.party_type)
    ledger_account = LedgerAccount(
        account_name=f"{party_in.name} A/c",
        account_type=account_type,
        party_id=db_party.id,
    )
    db.add(ledger_account)
    await db.commit()
    await db.refresh(db_party)
    return db_party


@router.get("", response_model=List[PartyResponse])
@router.get("/", response_model=List[PartyResponse])
async def list_parties(
    skip: int = 0,
    limit: int = 100,
    party_type: Optional[str] = Query(None, description="Filter by SUPPLIER, CUSTOMER, or BOTH"),
    active_only: bool = True,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """List parties with optional type filter. All authenticated users."""
    from decimal import Decimal
    from app.models.transactions import PurchaseInvoice, SalesInvoice
    from sqlalchemy import func

    query = select(Party)
    if active_only:
        query = query.where(Party.is_active == True)
    if party_type:
        query = query.where(Party.party_type == party_type.upper())
    result = await db.execute(query.offset(skip).limit(limit))
    parties = result.scalars().all()

    enriched = []
    for party in parties:
        bal = Decimal("0.00")

        if party.party_type in ("SUPPLIER", "BOTH"):
            # Supplier: what we still owe them = SUM of pending_amount on purchase invoices
            pur_res = await db.execute(
                select(func.coalesce(func.sum(PurchaseInvoice.pending_amount), 0))
                .where(PurchaseInvoice.supplier_id == party.id)
            )
            bal = Decimal(str(pur_res.scalar()))

        if party.party_type in ("CUSTOMER", "BOTH"):
            # Customer: what they still owe us = SUM of pending_amount on sales invoices
            sal_res = await db.execute(
                select(func.coalesce(func.sum(SalesInvoice.pending_amount), 0))
                .where(SalesInvoice.customer_id == party.id)
            )
            cust_bal = Decimal(str(sal_res.scalar()))
            # For BOTH: net = customer receivable - supplier payable
            bal = cust_bal - bal if party.party_type == "BOTH" else cust_bal

        party_dict = {
            "id": party.id,
            "name": party.name,
            "party_type": party.party_type,
            "gstin": party.gstin,
            "phone": party.phone,
            "email": party.email,
            "address": party.address,
            "city": party.city,
            "state": party.state,
            "credit_limit": party.credit_limit,
            "credit_days": party.credit_days,
            "is_active": party.is_active,
            "created_at": party.created_at,
            "ledger_balance": bal,
        }
        enriched.append(party_dict)

    return enriched


@router.get("/{party_id}", response_model=PartyResponse)
async def get_party(
    party_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Get a single party by ID."""
    result = await db.execute(select(Party).where(Party.id == party_id))
    party = result.scalars().first()
    if not party:
        raise HTTPException(status_code=404, detail="Party not found.")
    return party


@router.put("/{party_id}", response_model=PartyResponse)
async def update_party(
    party_id: uuid.UUID,
    party_in: PartyUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([RoleName.ADMIN])),
):
    """Update a party. ADMIN only."""
    result = await db.execute(select(Party).where(Party.id == party_id))
    party = result.scalars().first()
    if not party:
        raise HTTPException(status_code=404, detail="Party not found.")

    for field, value in party_in.model_dump(exclude_unset=True).items():
        setattr(party, field, value)

    await db.commit()
    await db.refresh(party)
    return party


@router.delete("/{party_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_party(
    party_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([RoleName.ADMIN])),
):
    """Soft-delete a party by setting is_active=False. ADMIN only."""
    result = await db.execute(select(Party).where(Party.id == party_id))
    party = result.scalars().first()
    if not party:
        raise HTTPException(status_code=404, detail="Party not found.")

    party.is_active = False
    await db.commit()
