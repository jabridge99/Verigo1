"""
SECURITY-HARDENED Authentication Service.

Changes vs original:
 - TOKEN_BLACKLIST: Redis-backed JWT revocation (see app.services.token_blacklist)
 - record_security_event(): writes to security_events table
 - create_magic_link(): tokens now SHA-256 hashed before DB storage
 - verify_magic_link(): compares hash, not plaintext
 - build_token_response(): accepts mfa_pending flag
 - Access token expiry reduced to 4 hours from 8 in production
"""

import hashlib
import json
import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import settings
from app.models.user import EmailActionToken, MagicLinkToken, User, UserStatus
from app.services.token_blacklist import (
    TOKEN_BLACKLIST,  # noqa: F401 — re-exported for callers
)

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

MAGIC_LINK_EXPIRY_MINUTES = 15
ACCESS_TOKEN_EXPIRY_MINUTES = 60 * 4 if settings.is_production else 60 * 8


# ── Password ──────────────────────────────────────────────────────────────────


def hash_password(plain: str) -> str:
    return pwd_ctx.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return pwd_ctx.verify(plain, hashed)
    except Exception:
        return False


# ── JWT ───────────────────────────────────────────────────────────────────────


def create_access_token(
    data: dict, expires_delta: Optional[timedelta] = None, mfa_pending: bool = False
) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRY_MINUTES)
    )
    # mfa_pending tokens have short 10-minute expiry
    if mfa_pending:
        expire = datetime.now(timezone.utc) + timedelta(minutes=10)
    to_encode.update(
        {"exp": expire, "jti": uuid.uuid4().hex, "mfa_pending": mfa_pending}
    )
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def decode_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except JWTError:
        return None


# ── User CRUD ─────────────────────────────────────────────────────────────────


def create_user(
    db: Session,
    email: str,
    full_name: str,
    password: str,
    role: str = "analyst",
    org_id: Optional[str] = None,
) -> User:
    user = User(
        email=email.lower().strip(),
        full_name=full_name,
        hashed_password=hash_password(password),
        role=role,
        org_id=org_id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def seed_master_admin(db: Session) -> Optional[User]:
    """
    Idempotently ensure a global super-admin account exists, from
    settings.master_admin_email / master_admin_password. No-op if either
    is unset. If a user with that email already exists, it's promoted to
    super-admin if it isn't already, and its password is resynced to
    master_admin_password if it doesn't already match (the env var is the
    source of truth for this account, not whatever hash was set at
    creation time).
    """
    email = settings.master_admin_email.strip().lower()
    if not email or not settings.master_admin_password:
        return None

    user = get_user_by_email(db, email)
    if user:
        changed = False
        if not user.is_super_admin or user.role != "admin":
            user.is_super_admin = True
            user.role = "admin"
            changed = True
        # Resync password to MASTER_ADMIN_PASSWORD on every boot — this is an
        # env-var-controlled admin account, so the env var is the source of
        # truth, not whatever hash happened to be set on first creation.
        if not verify_password(settings.master_admin_password, user.hashed_password):
            user.hashed_password = hash_password(settings.master_admin_password)
            changed = True
        if changed:
            db.commit()
            db.refresh(user)
        return user

    user = User(
        email=email,
        full_name="Master Admin",
        hashed_password=hash_password(settings.master_admin_password),
        role="admin",
        status=UserStatus.active,
        email_verified=True,
        is_super_admin=True,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        # Another worker process won the race to insert this row first
        # (multiple uvicorn workers run lifespan/seeding concurrently).
        db.rollback()
        return get_user_by_email(db, email)
    db.refresh(user)
    return user


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    return db.query(User).filter(User.email == email.lower().strip()).first()


def get_user_by_id(db: Session, user_id: str) -> Optional[User]:
    return db.query(User).filter(User.id == user_id).first()


def authenticate_user(db: Session, email: str, password: str) -> Optional[User]:
    user = get_user_by_email(db, email)
    if not user or not user.hashed_password:
        # Perform dummy verify to prevent timing attacks
        pwd_ctx.dummy_verify()
        return None
    if not verify_password(password, user.hashed_password):
        return None
    if user.status != UserStatus.active:
        return None
    return user


def build_token_response(user: User, mfa_pending: bool = False) -> dict:
    token = create_access_token(
        {
            "sub": user.id,
            "email": user.email,
            "role": user.role.value if hasattr(user.role, "value") else user.role,
            "org_id": user.org_id,
        },
        mfa_pending=mfa_pending,
    )
    return {
        "access_token": token,
        "token_type": "bearer",
        "user_id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "role": user.role.value if hasattr(user.role, "value") else user.role,
        "org_id": user.org_id,
        "mfa_required": mfa_pending,
        "is_super_admin": bool(user.is_super_admin),
    }


# ── Magic links (token hashed in DB) ─────────────────────────────────────────


def _hash_ml_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def create_magic_link(db: Session, email: str) -> str:
    plain = secrets.token_urlsafe(32)
    hashed = _hash_ml_token(plain)
    expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=MAGIC_LINK_EXPIRY_MINUTES
    )
    # Invalidate previous unused tokens for this email
    db.query(MagicLinkToken).filter(
        MagicLinkToken.email == email.lower(),
        MagicLinkToken.used.is_(False),
    ).update({"used": True})
    ml = MagicLinkToken(token_hash=hashed, email=email.lower(), expires_at=expires_at)
    db.add(ml)
    db.commit()
    return plain  # only the plaintext is returned (sent via email, never stored)


def verify_magic_link(db: Session, plain_token: str) -> Optional[str]:
    hashed = _hash_ml_token(plain_token)
    ml = (
        db.query(MagicLinkToken)
        .filter(
            MagicLinkToken.token_hash == hashed,
            MagicLinkToken.used.is_(False),
        )
        .first()
    )
    if not ml:
        return None
    if ml.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        return None
    ml.used = True
    db.commit()
    return ml.email


# ── Email verification & password reset (hashed, single-use tokens) ──────────

EMAIL_ACTION_EXPIRY_MINUTES = {"verify_email": 60 * 24, "password_reset": 30}


def _hash_action_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def create_email_action_token(db: Session, email: str, purpose: str) -> str:
    plain = secrets.token_urlsafe(32)
    hashed = _hash_action_token(plain)
    expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=EMAIL_ACTION_EXPIRY_MINUTES[purpose]
    )
    db.query(EmailActionToken).filter(
        EmailActionToken.email == email.lower(),
        EmailActionToken.purpose == purpose,
        EmailActionToken.used.is_(False),
    ).update({"used": True})
    rec = EmailActionToken(
        token=hashed, email=email.lower(), purpose=purpose, expires_at=expires_at
    )
    db.add(rec)
    db.commit()
    return plain


def consume_email_action_token(
    db: Session, plain_token: str, purpose: str
) -> Optional[str]:
    hashed = _hash_action_token(plain_token)
    rec = (
        db.query(EmailActionToken)
        .filter(
            EmailActionToken.token == hashed,
            EmailActionToken.purpose == purpose,
            EmailActionToken.used.is_(False),
        )
        .first()
    )
    if not rec:
        return None
    if rec.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        return None
    rec.used = True
    db.commit()
    return rec.email


# ── Session cookie helpers ───────────────────────────────────────────────────


# In production the frontend (Vercel) and API (Railway) are on different
# domains, so this is a cross-site request from the browser's point of view.
# SameSite=Lax cookies are withheld by the browser on cross-site fetch/XHR —
# only top-level navigations get them — so the session cookie would never
# reach the API after login, silently logging every user back out on their
# very next request. SameSite=None (paired with Secure, required by spec)
# is needed whenever frontend and API are on different origins.
def _session_cookie_samesite() -> str:
    return "none" if settings.is_production else "lax"


def set_session_cookie(response, token: str) -> None:
    response.set_cookie(
        key=settings.session_cookie_name,
        value=token,
        httponly=True,
        secure=settings.is_production,
        samesite=_session_cookie_samesite(),
        max_age=ACCESS_TOKEN_EXPIRY_MINUTES * 60,
        path="/",
    )


def clear_session_cookie(response) -> None:
    response.delete_cookie(
        key=settings.session_cookie_name,
        path="/",
        secure=settings.is_production,
        samesite=_session_cookie_samesite(),
    )


# ── Security event logging ────────────────────────────────────────────────────


def record_security_event(
    db: Session,
    event_type: str,
    user_id: Optional[str],
    ip: str = "unknown",
    meta: Optional[dict] = None,
) -> None:
    """Write to security_events table; silently swallows errors to never block auth flows."""
    try:
        from app.models.security_event import SecurityEvent

        ev = SecurityEvent(
            event_id=f"SEC-{uuid.uuid4().hex[:12].upper()}",
            event_type=event_type,
            user_id=user_id,
            ip_address=ip,
            metadata=json.dumps(meta or {}),
        )
        db.add(ev)
        db.commit()
    except Exception as e:
        import logging

        logging.getLogger("tvg.security").warning(
            "Failed to record security event: %s", e
        )


# ── RBAC helpers ──────────────────────────────────────────────────────────────

ROLE_PERMISSIONS: dict[str, set[str]] = {
    "admin": {"*"},
    "mlro": {
        "customers:read",
        "customers:write",
        "kyc:read",
        "kyc:write",
        "transactions:read",
        "reports:read",
        "reports:write",
        "reports:approve",
        "audit:read",
        "cases:read",
        "cases:write",
        "cases:close",
        "ecdd:read",
        "ecdd:write",
        "tenants:read",
    },
    "compliance": {
        "customers:read",
        "customers:write",
        "kyc:read",
        "kyc:write",
        "transactions:read",
        "reports:read",
        "reports:write",
        "audit:read",
        "cases:read",
        "cases:write",
        "ecdd:read",
        "ecdd:write",
    },
    "analyst": {
        "customers:read",
        "kyc:read",
        "transactions:read",
        "reports:read",
        "audit:read",
        "cases:read",
        "ecdd:read",
    },
    "viewer": {"customers:read", "transactions:read", "reports:read", "audit:read"},
}


def has_permission(role: str, permission: str) -> bool:
    perms = ROLE_PERMISSIONS.get(role, set())
    return "*" in perms or permission in perms
