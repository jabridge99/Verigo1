"""Authentication & User Management API."""

from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime, timezone

from app.db.database import get_db
from app.models.user import User, UserRole, UserStatus
from app.schemas.user import (
    UserCreate, UserUpdate, UserLogin, UserResponse,
    TokenResponse, MagicLinkRequest, MagicLinkVerify, PasswordChange,
)
from app.services.auth_service import (
    create_user, get_user_by_email, get_user_by_id, authenticate_user,
    build_token_response, create_magic_link, verify_magic_link,
    decode_token, hash_password, verify_password,
)

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _current_user(authorization: Optional[str] = Header(None), db: Session = Depends(get_db)) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Not authenticated")
    payload = decode_token(authorization.removeprefix("Bearer ").strip())
    if not payload:
        raise HTTPException(401, "Invalid or expired token")
    user = get_user_by_id(db, payload.get("sub", ""))
    if not user or user.status != UserStatus.active:
        raise HTTPException(401, "User not found or inactive")
    return user


# ─── Register ────────────────────────────────────────────────────────────────

@router.post("/register", response_model=TokenResponse, status_code=201)
def register(payload: UserCreate, db: Session = Depends(get_db)):
    if get_user_by_email(db, payload.email):
        raise HTTPException(409, "Email already registered")
    user = create_user(
        db,
        email=payload.email,
        full_name=payload.full_name,
        password=payload.password,
        role=payload.role.value,
        industry_id=payload.industry_id,
        tenant_id=payload.tenant_id,
    )
    return build_token_response(user)


# ─── Login ───────────────────────────────────────────────────────────────────

@router.post("/login", response_model=TokenResponse)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    user = authenticate_user(db, payload.email, payload.password)
    if not user:
        raise HTTPException(401, "Invalid email or password")
    user.last_login_at = datetime.now(timezone.utc)
    db.commit()
    return build_token_response(user)


# ─── Magic link ──────────────────────────────────────────────────────────────

@router.post("/magic-link")
def request_magic_link(payload: MagicLinkRequest, db: Session = Depends(get_db)):
    token = create_magic_link(db, payload.email)
    # In production: send email with token
    # For dev: return token directly
    return {
        "message": "Magic link created. In production this would be emailed.",
        "dev_token": token,
        "expires_in_minutes": 15,
    }


@router.post("/magic-link/verify", response_model=TokenResponse)
def verify_magic_link_endpoint(payload: MagicLinkVerify, db: Session = Depends(get_db)):
    email = verify_magic_link(db, payload.token)
    if not email:
        raise HTTPException(400, "Invalid or expired magic link")
    user = get_user_by_email(db, email)
    if not user:
        raise HTTPException(404, "No account found for this email. Please register first.")
    if user.status != UserStatus.active:
        raise HTTPException(403, "Account is suspended or inactive")
    user.last_login_at = datetime.now(timezone.utc)
    db.commit()
    return build_token_response(user)


# ─── Me / profile ────────────────────────────────────────────────────────────

@router.get("/me", response_model=UserResponse)
def get_me(user: User = Depends(_current_user)):
    return user


@router.patch("/me", response_model=UserResponse)
def update_me(payload: UserUpdate, user: User = Depends(_current_user), db: Session = Depends(get_db)):
    for k, v in payload.model_dump(exclude_none=True).items():
        if k not in ("role", "status"):  # users can't change own role/status
            setattr(user, k, v)
    db.commit()
    db.refresh(user)
    return user


@router.post("/me/change-password")
def change_password(payload: PasswordChange, user: User = Depends(_current_user), db: Session = Depends(get_db)):
    if not user.hashed_password or not verify_password(payload.current_password, user.hashed_password):
        raise HTTPException(400, "Current password is incorrect")
    user.hashed_password = hash_password(payload.new_password)
    db.commit()
    return {"message": "Password changed successfully"}


# ─── Admin: user management ──────────────────────────────────────────────────

@router.get("/users", response_model=List[UserResponse])
def list_users(user: User = Depends(_current_user), db: Session = Depends(get_db)):
    if user.role not in (UserRole.admin, UserRole.mlro):
        raise HTTPException(403, "Insufficient permissions")
    return db.query(User).order_by(User.created_at.desc()).all()


@router.post("/users", response_model=UserResponse, status_code=201)
def create_user_admin(payload: UserCreate, user: User = Depends(_current_user), db: Session = Depends(get_db)):
    if user.role != UserRole.admin:
        raise HTTPException(403, "Admin role required")
    if get_user_by_email(db, payload.email):
        raise HTTPException(409, "Email already registered")
    return create_user(
        db,
        email=payload.email,
        full_name=payload.full_name,
        password=payload.password,
        role=payload.role.value,
        industry_id=payload.industry_id,
        tenant_id=payload.tenant_id,
    )


@router.patch("/users/{user_id}", response_model=UserResponse)
def update_user_admin(user_id: str, payload: UserUpdate, actor: User = Depends(_current_user), db: Session = Depends(get_db)):
    if actor.role != UserRole.admin:
        raise HTTPException(403, "Admin role required")
    target = get_user_by_id(db, user_id)
    if not target:
        raise HTTPException(404, "User not found")
    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(target, k, v)
    db.commit()
    db.refresh(target)
    return target


@router.post("/users/{user_id}/suspend", response_model=UserResponse)
def suspend_user(user_id: str, actor: User = Depends(_current_user), db: Session = Depends(get_db)):
    if actor.role != UserRole.admin:
        raise HTTPException(403, "Admin role required")
    target = get_user_by_id(db, user_id)
    if not target:
        raise HTTPException(404, "User not found")
    target.status = UserStatus.suspended
    db.commit()
    db.refresh(target)
    return target


# ─── Token verify (for frontend middleware) ──────────────────────────────────

@router.post("/verify")
def verify_token(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Not authenticated")
    payload = decode_token(authorization.removeprefix("Bearer ").strip())
    if not payload:
        raise HTTPException(401, "Invalid or expired token")
    return {"valid": True, "user_id": payload.get("sub"), "role": payload.get("role"), "email": payload.get("email")}
