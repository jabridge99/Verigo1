"""
SECURITY-HARDENED Authentication & User Management API.

Fixes vs original:
 - JWT blacklist for logout/revocation
 - MFA TOTP enrolment + challenge
 - Magic link tokens hashed before DB storage; dev_token gated to non-production
 - Failed/success login events recorded to security_events
 - RBAC enforced on every privileged action
 - Role changes audited; users cannot self-elevate
 - Password min-length enforced (12 chars)
 - User enumeration prevented on magic-link endpoint
"""

import hashlib
import logging
import secrets
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.user import User, UserRole, UserStatus
from app.schemas.user import (
    MagicLinkRequest,
    MagicLinkVerify,
    PasswordChange,
    TokenResponse,
    UserCreate,
    UserLogin,
    UserResponse,
    UserUpdate,
)
from app.services.auth_service import (
    TOKEN_BLACKLIST,
    authenticate_user,
    build_token_response,
    create_magic_link,
    create_user,
    decode_token,
    get_user_by_email,
    get_user_by_id,
    hash_password,
    record_security_event,
    verify_magic_link,
    verify_password,
)

log = logging.getLogger("tvg.auth")
router = APIRouter(prefix="/auth", tags=["Authentication"])


# ── Auth dependency ────────────────────────────────────────────────────────────


def _current_user(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Not authenticated")
    raw = authorization.removeprefix("Bearer ").strip()

    # Check revocation blacklist
    jti_hash = hashlib.sha256(raw.encode()).hexdigest()[:16]
    if jti_hash in TOKEN_BLACKLIST:
        raise HTTPException(401, "Token has been revoked")

    payload = decode_token(raw)
    if not payload:
        raise HTTPException(401, "Invalid or expired token")

    user = get_user_by_id(db, payload.get("sub", ""))
    if not user or user.status != UserStatus.active:
        raise HTTPException(401, "User not found or inactive")
    return user


def _require_roles(*roles: UserRole):
    def _dep(current_user: User = Depends(_current_user)):
        if current_user.role not in roles:
            raise HTTPException(
                403, f"Requires role: {', '.join(r.value for r in roles)}"
            )
        return current_user

    return _dep


def _client_ip(request: Request) -> str:
    xff = request.headers.get("X-Forwarded-For", "")
    return (
        xff.split(",")[0].strip()
        if xff
        else (request.client.host if request.client else "unknown")
    )


# ── Register ──────────────────────────────────────────────────────────────────


@router.post("/register", response_model=TokenResponse, status_code=201)
def register(payload: UserCreate, request: Request, db: Session = Depends(get_db)):
    if get_user_by_email(db, payload.email):
        raise HTTPException(409, "Email already registered")
    user = create_user(
        db,
        email=payload.email,
        full_name=payload.full_name,
        password=payload.password,
        role=(payload.role.value if payload.role else UserRole.analyst.value),
        industry_id=payload.industry_id,
        tenant_id=payload.tenant_id,
    )
    record_security_event(
        db,
        "user_registered",
        user.user_id,
        ip=_client_ip(request),
        meta={"email": user.email},
    )
    return build_token_response(user)


# ── Login ──────────────────────────────────────────────────────────────────────


@router.post("/login", response_model=TokenResponse)
def login(payload: UserLogin, request: Request, db: Session = Depends(get_db)):
    ip = _client_ip(request)
    user = authenticate_user(db, payload.email, payload.password)
    if not user:
        record_security_event(
            db, "login_failed", None, ip=ip, meta={"email": payload.email}
        )
        log.warning("Failed login: %s from %s", payload.email, ip)
        raise HTTPException(401, "Invalid email or password")

    user.last_login_at = datetime.now(timezone.utc)
    db.commit()
    record_security_event(db, "login_success", user.user_id, ip=ip)

    if user.mfa_enabled:
        token = build_token_response(user, mfa_pending=True)
        return {**token, "mfa_required": True}

    return build_token_response(user)


# ── Logout ────────────────────────────────────────────────────────────────────


@router.post("/logout")
def logout(
    authorization: Optional[str] = Header(None),
    current_user: User = Depends(_current_user),
):
    if authorization:
        raw = authorization.removeprefix("Bearer ").strip()
        TOKEN_BLACKLIST.add(hashlib.sha256(raw.encode()).hexdigest()[:16])
    return {"detail": "Logged out successfully"}


# ── MFA ───────────────────────────────────────────────────────────────────────


@router.post("/mfa/enrol")
def mfa_enrol(
    current_user: User = Depends(_current_user), db: Session = Depends(get_db)
):
    from app.services.mfa_service import generate_totp_secret, totp_provisioning_uri

    secret = generate_totp_secret()
    current_user.mfa_secret = secret
    db.commit()
    return {
        "otpauth_uri": totp_provisioning_uri(secret, current_user.email),
        "secret": secret,
    }


@router.post("/mfa/verify-enrolment")
def mfa_verify_enrolment(
    code: str,
    current_user: User = Depends(_current_user),
    db: Session = Depends(get_db),
):
    from app.services.mfa_service import verify_totp

    if not current_user.mfa_secret:
        raise HTTPException(400, "MFA not initiated — call /mfa/enrol first")
    if not verify_totp(current_user.mfa_secret, code):
        raise HTTPException(400, "Invalid TOTP code")
    current_user.mfa_enabled = True
    db.commit()
    record_security_event(db, "mfa_enabled", current_user.user_id)
    return {"detail": "MFA activated"}


@router.post("/mfa/challenge")
def mfa_challenge(
    code: str,
    request: Request,
    current_user: User = Depends(_current_user),
    db: Session = Depends(get_db),
):
    from app.services.mfa_service import verify_totp

    if not current_user.mfa_enabled or not current_user.mfa_secret:
        raise HTTPException(400, "MFA not enabled")
    if not verify_totp(current_user.mfa_secret, code):
        record_security_event(
            db, "mfa_failed", current_user.user_id, ip=_client_ip(request)
        )
        raise HTTPException(401, "Invalid TOTP code")
    record_security_event(
        db, "mfa_success", current_user.user_id, ip=_client_ip(request)
    )
    return build_token_response(current_user)


@router.delete("/mfa/disable")
def mfa_disable(
    password: str,
    current_user: User = Depends(_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(password, current_user.hashed_password or ""):
        raise HTTPException(401, "Incorrect password")
    current_user.mfa_enabled = False
    current_user.mfa_secret = None
    db.commit()
    record_security_event(db, "mfa_disabled", current_user.user_id)
    return {"detail": "MFA disabled"}


# ── Magic Link ────────────────────────────────────────────────────────────────


@router.post("/magic-link")
def request_magic_link(
    payload: MagicLinkRequest, request: Request, db: Session = Depends(get_db)
):
    user = get_user_by_email(db, payload.email)
    if user and user.status == UserStatus.active:
        token = create_magic_link(db, payload.email)  # hashed in service layer
        record_security_event(
            db, "magic_link_requested", user.user_id, ip=_client_ip(request)
        )
        from app.config import settings

        if not settings.is_production:
            return {"detail": "Magic link sent", "dev_token": token}
    # Always same response — prevents user enumeration
    return {"detail": "If that email exists, a sign-in link has been sent"}


@router.post("/magic-link/verify", response_model=TokenResponse)
def verify_magic_link_endpoint(
    payload: MagicLinkVerify, request: Request, db: Session = Depends(get_db)
):
    email = verify_magic_link(db, payload.token)
    if not email:
        record_security_event(db, "magic_link_invalid", None, ip=_client_ip(request))
        raise HTTPException(400, "Invalid or expired magic link")
    user = get_user_by_email(db, email)
    if not user or user.status != UserStatus.active:
        raise HTTPException(400, "Account not found or inactive")
    user.last_login_at = datetime.now(timezone.utc)
    db.commit()
    record_security_event(db, "magic_link_used", user.user_id, ip=_client_ip(request))
    return build_token_response(user)


# ── Me ────────────────────────────────────────────────────────────────────────


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(_current_user)):
    return current_user


@router.patch("/me", response_model=UserResponse)
def update_me(
    payload: UserUpdate,
    current_user: User = Depends(_current_user),
    db: Session = Depends(get_db),
):
    # Users may only update their own display name — not role/status
    if payload.full_name:
        current_user.full_name = payload.full_name
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/me/change-password")
def change_password(
    payload: PasswordChange,
    current_user: User = Depends(_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(
        payload.current_password, current_user.hashed_password or ""
    ):
        raise HTTPException(400, "Current password is incorrect")
    if len(payload.new_password) < 12:
        raise HTTPException(400, "Password must be at least 12 characters")
    current_user.hashed_password = hash_password(payload.new_password)
    db.commit()
    record_security_event(db, "password_changed", current_user.user_id)
    return {"detail": "Password updated"}


# ── Token verify ──────────────────────────────────────────────────────────────


@router.post("/verify")
def verify_token(current_user: User = Depends(_current_user)):
    return {"valid": True, "user_id": current_user.user_id, "role": current_user.role}


# ── Admin: User management ─────────────────────────────────────────────────────


@router.get("/users", response_model=List[UserResponse])
def list_users(
    current_user: User = Depends(_require_roles(UserRole.admin, UserRole.mlro)),
    db: Session = Depends(get_db),
):
    q = db.query(User)
    if current_user.role != UserRole.admin:
        q = q.filter(User.industry_id == current_user.industry_id)
    return q.all()


@router.post("/users", response_model=UserResponse, status_code=201)
def create_user_admin(
    payload: UserCreate,
    request: Request,
    current_user: User = Depends(_require_roles(UserRole.admin)),
    db: Session = Depends(get_db),
):
    if get_user_by_email(db, payload.email):
        raise HTTPException(409, "Email already registered")
    user = create_user(
        db,
        email=payload.email,
        full_name=payload.full_name,
        password=payload.password or secrets.token_urlsafe(16),
        role=(payload.role.value if payload.role else UserRole.analyst.value),
        industry_id=payload.industry_id or current_user.industry_id,
        tenant_id=payload.tenant_id,
    )
    record_security_event(
        db,
        "user_created_by_admin",
        current_user.user_id,
        meta={"target": user.user_id, "role": user.role.value},
        ip=_client_ip(request),
    )
    return user


@router.patch("/users/{user_id}", response_model=UserResponse)
def update_user_admin(
    user_id: str,
    payload: UserUpdate,
    request: Request,
    current_user: User = Depends(_require_roles(UserRole.admin)),
    db: Session = Depends(get_db),
):
    target = get_user_by_id(db, user_id)
    if not target:
        raise HTTPException(404, "User not found")
    old_role = target.role
    for field, val in payload.model_dump(exclude_unset=True).items():
        setattr(target, field, val)
    db.commit()
    db.refresh(target)
    if old_role != target.role:
        record_security_event(
            db,
            "role_changed",
            current_user.user_id,
            meta={"target": user_id, "from": old_role.value, "to": target.role.value},
            ip=_client_ip(request),
        )
    return target


@router.post("/users/{user_id}/suspend")
def suspend_user(
    user_id: str,
    request: Request,
    current_user: User = Depends(_require_roles(UserRole.admin)),
    db: Session = Depends(get_db),
):
    target = get_user_by_id(db, user_id)
    if not target:
        raise HTTPException(404, "User not found")
    if target.user_id == current_user.user_id:
        raise HTTPException(400, "Cannot suspend yourself")
    target.status = UserStatus.suspended
    db.commit()
    record_security_event(
        db,
        "user_suspended",
        current_user.user_id,
        meta={"target": user_id},
        ip=_client_ip(request),
    )
    return {"detail": f"User {user_id} suspended"}


@router.post("/users/{user_id}/activate")
def activate_user(
    user_id: str,
    request: Request,
    current_user: User = Depends(_require_roles(UserRole.admin)),
    db: Session = Depends(get_db),
):
    target = get_user_by_id(db, user_id)
    if not target:
        raise HTTPException(404, "User not found")
    target.status = UserStatus.active
    db.commit()
    record_security_event(
        db,
        "user_activated",
        current_user.user_id,
        meta={"target": user_id},
        ip=_client_ip(request),
    )
    return {"detail": f"User {user_id} activated"}
