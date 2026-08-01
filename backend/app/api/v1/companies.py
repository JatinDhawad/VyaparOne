from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.database import get_db
from app.models.company import Company
from app.models.user import RoleName, User
from app.schemas.company import CompanyCreate, CompanyUpdate, CompanyResponse
from app.api.deps import get_current_active_user, require_role

router = APIRouter(prefix="/companies", tags=["Companies"])


@router.post("/", response_model=CompanyResponse, status_code=status.HTTP_201_CREATED)
async def create_company(
    company_in: CompanyCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([RoleName.ADMIN])),
):
    """Create a new company/brand. ADMIN only."""
    if company_in.code:
        existing = await db.execute(select(Company).where(Company.code == company_in.code))
        if existing.scalars().first():
            raise HTTPException(status_code=400, detail="Company code already exists.")

    db_company = Company(**company_in.model_dump())
    db.add(db_company)
    await db.commit()
    await db.refresh(db_company)
    return db_company


@router.get("/", response_model=List[CompanyResponse])
async def list_companies(
    skip: int = 0,
    limit: int = 100,
    active_only: bool = True,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """List all companies. All authenticated users."""
    query = select(Company)
    if active_only:
        query = query.where(Company.is_active == True)
    result = await db.execute(query.offset(skip).limit(limit))
    return result.scalars().all()


@router.get("/{company_id}", response_model=CompanyResponse)
async def get_company(
    company_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Get a single company by ID."""
    result = await db.execute(select(Company).where(Company.id == company_id))
    company = result.scalars().first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found.")
    return company


@router.put("/{company_id}", response_model=CompanyResponse)
async def update_company(
    company_id: int,
    company_in: CompanyUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([RoleName.ADMIN])),
):
    """Update a company. ADMIN only."""
    result = await db.execute(select(Company).where(Company.id == company_id))
    company = result.scalars().first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found.")

    for field, value in company_in.model_dump(exclude_unset=True).items():
        setattr(company, field, value)

    await db.commit()
    await db.refresh(company)
    return company
