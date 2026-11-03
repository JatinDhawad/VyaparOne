from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.core.database import get_db
from app.core.security import verify_password, create_access_token, get_password_hash
from app.models.user import User
from app.schemas.auth import LoginRequest, TokenResponse, ChangePasswordRequest, MessageResponse
from app.api.deps import get_current_active_user
from app.core.login_throttle import ip_account_throttle, account_throttle, client_ip

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/login", response_model=TokenResponse)
@router.post("/login/", response_model=TokenResponse)
async def login(request: Request, credentials: LoginRequest, db: AsyncSession = Depends(get_db)):
    """
    Authenticate user via email and password, returning a JWT Access Token.
    """
    email_key = credentials.email.strip().lower()
    ip_key = f"{client_ip(request)}|{email_key}"

    wait = max(ip_account_throttle.retry_after(ip_key), account_throttle.retry_after(email_key))
    if wait:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many failed login attempts. Please try again later.",
            headers={"Retry-After": str(wait)},
        )

    result = await db.execute(select(User).where(User.email == credentials.email))
    user = result.scalars().first()
    
    if not user or not verify_password(credentials.password, user.password_hash):
        ip_account_throttle.record(ip_key)
        account_throttle.record(email_key)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is deactivated",
        )
        
    ip_account_throttle.clear(ip_key)
    access_token = create_access_token(subject=user.id)
    return TokenResponse(access_token=access_token, token_type="bearer")


@router.patch("/change-password", response_model=MessageResponse)
async def change_password(
    payload: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Change the current user's password.
    Requires the correct current_password before accepting a new one.
    new_password must be at least 8 characters (validated in the schema).
    """
    # Verify the user knows their existing password before allowing any change.
    if not verify_password(payload.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect.",
        )

    # Reject if new password is the same as the current one (already hashed comparison
    # is not reliable; do a plain-text check via verify instead).
    if verify_password(payload.new_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from the current password.",
        )

    # Re-fetch the user within this session to get a mutable instance,
    # then update and commit.
    result = await db.execute(select(User).where(User.id == current_user.id))
    user_row = result.scalars().first()
    user_row.password_hash = get_password_hash(payload.new_password)
    await db.commit()

    return MessageResponse(message="Password updated successfully.")
