from pydantic import BaseModel, EmailStr, Field
from typing import Optional
import uuid
from datetime import datetime

class UserBase(BaseModel):
    email: str  # Use str for response serialization; EmailStr is used in UserCreate
    full_name: str
    phone: Optional[str] = None
    is_active: bool = True

class UserCreate(UserBase):
    password: str = Field(..., min_length=8)
    role_id: int

class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    full_name: Optional[str] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None
    password: Optional[str] = Field(None, min_length=8)
    role_id: Optional[int] = None

class RoleResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None

    class Config:
        from_attributes = True

class UserResponse(UserBase):
    id: uuid.UUID
    role_id: int
    created_at: datetime
    role: Optional[RoleResponse] = None

    class Config:
        from_attributes = True
