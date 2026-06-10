"""Authentication service — password hashing, JWT, magic links."""

import uuid
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.config import settings
from app.models.user import User, MagicLinkToken, UserStatus

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

MAGIC_LINK_EXPIRY_MINUTES = 15
ACCESS_TOKEN_EXPIRY_MINUTES = 60 * 8   # 8 hours


# ─── Password ────────────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    return pwd_ctx.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_ctx.verify(plain, hashed)


# ─── JWT ─────────────────────────────────────────────────────────────────────

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRY_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except JWTError:
        return None


# ─── User CRUD ────────────────────────────────────────────────────────────────

def create_user(db: Session, email: str, full_name: str, password: str, role: str = "analyst",
                industry_id: str = None, tenant_id: str = None) -> User:
    user = User(
        user_id=f"USR-{uuid.uuid4().hex[:10].upper()}",
        email=email,
        full_name=full_name,
        hashed_password=hash_password(password),
        role=role,
        industry_id=industry_id,
        tenant_id=tenant_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.query(User).filter(User.email == email).first()


def get_user_by_id(db: Session, user_id: str) -> Optional[User]:
    return db.query(User).filter(User.user_id == user_id).first()


def authenticate_user(db: Session, email: str, password: str) -> Optional[User]:
    user = get_user_by_email(db, email)
    if not user or not user.hashed_password:
        return None
    if not verify_password(password, user.hashed_password):
        return None
    if user.status != UserStatus.active:
        return None
    return user


def build_token_response(user: User) -> dict:
    token = create_access_token({
        "sub": user.user_id,
        "email": user.email,
        "role": user.role.value if hasattr(user.role, "value") else user.role,
        "industry_id": user.industry_id,
    })
    return {
        "access_token": token,
        "token_type": "bearer",
        "user_id": user.user_id,
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role.value if hasattr(user.role, "value") else user.role,
        "industry_id": user.industry_id,
    }


# ─── Magic links ─────────────────────────────────────────────────────────────

def create_magic_link(db: Session, email: str) -> str:
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=MAGIC_LINK_EXPIRY_MINUTES)
    ml = MagicLinkToken(token=token, email=email, expires_at=expires_at)
    db.add(ml)
    db.commit()
    return token


def verify_magic_link(db: Session, token: str) -> Optional[str]:
    ml = db.query(MagicLinkToken).filter(
        MagicLinkToken.token == token,
        MagicLinkToken.used == False,
    ).first()
    if not ml:
        return None
    if ml.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        return None
    ml.used = True
    db.commit()
    return ml.email


# ─── RBAC helpers ─────────────────────────────────────────────────────────────

ROLE_PERMISSIONS: dict[str, set[str]] = {
    "admin":      {"*"},
    "mlro":       {"customers:read", "customers:write", "kyc:read", "kyc:write",
                   "transactions:read", "reports:read", "reports:write", "reports:approve",
                   "audit:read", "cases:read", "cases:write", "cases:close",
                   "ecdd:read", "ecdd:write", "tenants:read"},
    "compliance": {"customers:read", "customers:write", "kyc:read", "kyc:write",
                   "transactions:read", "reports:read", "reports:write",
                   "audit:read", "cases:read", "cases:write", "ecdd:read", "ecdd:write"},
    "analyst":    {"customers:read", "kyc:read", "transactions:read",
                   "reports:read", "audit:read", "cases:read", "ecdd:read"},
    "viewer":     {"customers:read", "transactions:read", "reports:read", "audit:read"},
}


def has_permission(role: str, permission: str) -> bool:
    perms = ROLE_PERMISSIONS.get(role, set())
    return "*" in perms or permission in perms
