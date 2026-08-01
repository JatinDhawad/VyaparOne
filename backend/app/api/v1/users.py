from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_password_hash
from app.models.user import User, RoleName, Role
from app.schemas.user import UserCreate, UserResponse
from app.api.deps import get_current_active_user, require_role

router = APIRouter(prefix="/users", tags=["Users"])

@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_in: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([RoleName.ADMIN])),
):
    """
    Create a new user. Only available to ADMIN role.
    """
    # Check if user already exists
    result = await db.execute(select(User).where(User.email == user_in.email))
    if result.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email already exists.",
        )
    
    # Check if role exists
    role_result = await db.execute(select(Role).where(Role.id == user_in.role_id))
    role = role_result.scalars().first()
    if not role:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid role_id.",
        )

    # Create new user
    db_user = User(
        email=user_in.email,
        full_name=user_in.full_name,
        phone=user_in.phone,
        password_hash=get_password_hash(user_in.password),
        role_id=user_in.role_id,
        is_active=user_in.is_active,
    )
    db.add(db_user)
    await db.commit()
    await db.refresh(db_user)
    
    # Eager load role for the response
    user_with_role = await db.execute(
        select(User).options(selectinload(User.role)).where(User.id == db_user.id)
    )
    return user_with_role.scalars().first()

@router.get("/me", response_model=UserResponse)
async def read_users_me(
    current_user: User = Depends(get_current_active_user),
):
    """
    Get current user profile.
    """
    return current_user

@router.get("/", response_model=List[UserResponse])
async def read_users(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([RoleName.ADMIN])),
):
    """
    Retrieve users. Only available to ADMIN role.
    """
    result = await db.execute(
        select(User).options(selectinload(User.role)).offset(skip).limit(limit)
    )
    return result.scalars().all()
