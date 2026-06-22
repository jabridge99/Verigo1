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

import logging
import secrets
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.config import settings
from app.db.database import get_db
from app.models.user import User, UserRole, UserStatus
from app.schemas.user import (
    EmailVerificationConfirm,
    EmailVerificationRequest,
    MagicLinkRequest,
    MagicLinkVerify,
    PasswordChange,
    PasswordResetConfirm,
    PasswordResetRequest,
    TokenResponse,
    UserCreate,
    UserLogin,
    UserResponse,
    UserUpdate,
)
from app.services import audit_service
from app.services.auth_service import (
    TOKEN_BLACKLIST,
    authenticate_user,
    build_token_response,
    clear_session_cookie,
    consume_email_action_token,
    create_email_action_token,
    create_magic_link,
    create_user,
    decode_token,
    get_user_by_email,
    get_user_by_id,
    hash_password,
    record_security_event,
    set_session_cookie,
    verify_magic_link,
    verify_password,
)
from app.services.oauth_service import (
    build_authorize_url,
    exchange_code_for_profile,
    get_provider,
    new_state,
)

log = logging.getLogger("tvg.auth")
router = APIRouter(prefix="/auth", tags=["Authentication"])


# ── Auth dependency ────────────────────────────────────────────────────────────


def _decode_current_user(
    request: Request,
    authorization: Optional[str],
    db: Session,
    *,
    allow_mfa_pending: bool,
) -> User:
    raw: Optional[str] = None
    if authorization and authorization.startswith("Bearer "):
        raw = authorization.removeprefix("Bearer ").strip()
    elif settings.session_cookie_name in request.cookies:
        raw = request.cookies[settings.session_cookie_name]
    if not raw:
        raise HTTPException(401, "Not authenticated")

    payload = decode_token(raw)
    if not payload:
        raise HTTPException(401, "Invalid or expired token")

    # Check revocation blacklist by jti — must match the claim
    # app.api.deps.get_current_user checks, since logout blacklists by jti.
    jti = payload.get("jti")
    if jti and jti in TOKEN_BLACKLIST:
        raise HTTPException(401, "Token has been revoked")

    if payload.get("mfa_pending") and not allow_mfa_pending:
        raise HTTPException(401, "MFA challenge incomplete")

    user = get_user_by_id(db, payload.get("sub", ""))
    if not user or user.status != UserStatus.active:
        raise HTTPException(401, "User not found or inactive")
    return user


def _current_user(
    request: Request,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
) -> User:
    return _decode_current_user(
        request, authorization, db, allow_mfa_pending=False
    )


def _current_user_mfa_pending(
    request: Request,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db),
) -> User:
    """Like _current_user but also accepts a token still awaiting MFA completion.

    Only use this for the endpoint that resolves the MFA challenge itself
    (/mfa/challenge) — every other route must reject mfa_pending tokens.
    """
    return _decode_current_user(
        request, authorization, db, allow_mfa_pending=True
    )


def _require_roles(*roles: UserRole):
    def _dep(current_user: User = Depends(_current_user)):
        if current_user.role not in roles:
            raise HTTPException(
                403, f"Requires role: {', '.join(r.value for r in roles)}"
            )
        return current_user

    return _dep


def _client_ip(request: Request) -> str:
    if settings.trust_proxy_headers:
        xff = request.headers.get("X-Forwarded-For", "")
        if xff:
            return xff.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


# ── Register ──────────────────────────────────────────────────────────────────


@router.post("/register", response_model=TokenResponse, status_code=201)
def register(
    payload: UserCreate,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    if get_user_by_email(db, payload.email):
        raise HTTPException(409, "Email already registered")
    # Public, unauthenticated endpoint — payload.org_id / payload.role must
    # never be trusted. Without an admin/invite check, honoring a caller-
    # supplied org_id+role would let anyone register as "admin" inside an
    # arbitrary existing organisation. Self-serve signup always creates a
    # brand-new org and the lowest-privilege role; joining an existing org
    # requires the authenticated admin-only POST /auth/users flow instead.
    from app.models.organisation import IndustryType, Organisation

    org = Organisation(
        name=f"{payload.full_name}'s Organisation", industry_type=IndustryType.other
    )
    db.add(org)
    db.flush()
    org_id = org.id
    user = create_user(
        db,
        email=payload.email,
        full_name=payload.full_name,
        password=payload.password,
        role=UserRole.analyst.value,
        org_id=org_id,
    )
    record_security_event(
        db,
        "user_registered",
        user.id,
        ip=_client_ip(request),
        meta={"email": user.email},
    )
    if payload.organisation_name:
        from app.services.org_service import create_organisation

        create_organisation(
            db, payload.organisation_name, user, industry_id=payload.industry_id
        )

    verify_token = create_email_action_token(db, user.email, "verify_email")
    record_security_event(db, "email_verification_requested", user.id)
    token = build_token_response(user)
    set_session_cookie(response, token["access_token"])
    if not settings.is_production:
        token["dev_verify_email_token"] = verify_token
    return token


# ── Login ──────────────────────────────────────────────────────────────────────


@router.post("/login", response_model=TokenResponse)
def login(
    payload: UserLogin,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
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
    record_security_event(db, "login_success", user.id, ip=ip)
    audit_service.log_action(
        db,
        action="user_logged_in",
        entity_type="user",
        entity_id=user.id,
        actor=user.email,
        actor_role=user.role.value if user.role else None,
        industry_id=user.industry_id,
        organisation_id=user.primary_organisation_id,
        ip_address=ip,
    )

    if user.mfa_enabled:
        token = build_token_response(user, mfa_pending=True)
        set_session_cookie(response, token["access_token"])
        return {**token, "mfa_required": True}

    token = build_token_response(user)
    set_session_cookie(response, token["access_token"])
    return token


# ── Logout ────────────────────────────────────────────────────────────────────


@router.post("/logout")
def logout(
    response: Response,
    request: Request,
    authorization: Optional[str] = Header(None),
    current_user: User = Depends(_current_user),
):
    raw = None
    if authorization and authorization.startswith("Bearer "):
        raw = authorization.removeprefix("Bearer ").strip()
    elif settings.session_cookie_name in request.cookies:
        raw = request.cookies[settings.session_cookie_name]

    if raw:
        from app.services.auth_service import ACCESS_TOKEN_EXPIRY_MINUTES

        payload = decode_token(raw)
        # Blacklist by jti — the same claim app.api.deps.get_current_user
        # (used by nearly every other router) checks. The sha256(raw token)
        # key used here previously was never checked by deps.py, so logout
        # never actually revoked a token for any non-auth.py-guarded route.
        jti = payload.get("jti") if payload else None
        if jti:
            TOKEN_BLACKLIST.add(jti, ttl_seconds=ACCESS_TOKEN_EXPIRY_MINUTES * 60)
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
    record_security_event(db, "mfa_enabled", current_user.id)
    return {"detail": "MFA activated"}


@router.post("/mfa/challenge")
def mfa_challenge(
    code: str,
    request: Request,
    response: Response,
    current_user: User = Depends(_current_user_mfa_pending),
    db: Session = Depends(get_db),
):
    from app.services.mfa_service import verify_totp

    if not current_user.mfa_enabled or not current_user.mfa_secret:
        raise HTTPException(400, "MFA not enabled")
    if not verify_totp(current_user.mfa_secret, code):
        record_security_event(db, "mfa_failed", current_user.id, ip=_client_ip(request))
        raise HTTPException(401, "Invalid TOTP code")
    record_security_event(db, "mfa_success", current_user.id, ip=_client_ip(request))
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
    record_security_event(db, "mfa_disabled", current_user.id)
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
            db, "magic_link_requested", user.id, ip=_client_ip(request)
        )
        from app.config import settings

        if not settings.is_production:
            return {"detail": "Magic link sent", "dev_token": token}
    # Always same response — prevents user enumeration
    return {"detail": "If that email exists, a sign-in link has been sent"}


@router.post("/magic-link/verify", response_model=TokenResponse)
def verify_magic_link_endpoint(
    payload: MagicLinkVerify,
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
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
    record_security_event(db, "magic_link_used", user.id, ip=_client_ip(request))
    return build_token_response(user)


# ── Email verification ──────────────────────────────────────────────────────


@router.post("/email/verify/request")
def request_email_verification(
    payload: EmailVerificationRequest, request: Request, db: Session = Depends(get_db)
):
    user = get_user_by_email(db, payload.email)
    if user and not user.email_verified:
        token = create_email_action_token(db, user.email, "verify_email")
        record_security_event(
            db, "email_verification_requested", user.id, ip=_client_ip(request)
        )
        from app.services.email_service import send_email_verification

        send_email_verification(user.email, user.full_name, token)
        if not settings.is_production:
            return {"detail": "Verification email sent", "dev_token": token}
    # Always same response — prevents user enumeration
    return {
        "detail": "If that email exists and is unverified, a verification link has been sent"
    }


@router.post("/email/verify/confirm")
def confirm_email_verification(
    payload: EmailVerificationConfirm, request: Request, db: Session = Depends(get_db)
):
    email = consume_email_action_token(db, payload.token, "verify_email")
    if not email:
        raise HTTPException(400, "Invalid or expired verification link")
    user = get_user_by_email(db, email)
    if not user:
        raise HTTPException(400, "Account not found")
    user.email_verified = True
    db.commit()
    record_security_event(db, "email_verified", user.id, ip=_client_ip(request))
    return {"detail": "Email verified"}


# ── Password reset ───────────────────────────────────────────────────────────


@router.post("/password-reset/request")
def request_password_reset(
    payload: PasswordResetRequest, request: Request, db: Session = Depends(get_db)
):
    user = get_user_by_email(db, payload.email)
    if user and user.status == UserStatus.active and user.hashed_password:
        token = create_email_action_token(db, user.email, "password_reset")
        record_security_event(
            db, "password_reset_requested", user.id, ip=_client_ip(request)
        )
        from app.services.email_service import send_password_reset

        send_password_reset(user.email, user.full_name, token)
        if not settings.is_production:
            return {"detail": "Password reset email sent", "dev_token": token}
    # Always same response — prevents user enumeration
    return {"detail": "If that email exists, a password reset link has been sent"}


@router.post("/password-reset/confirm")
def confirm_password_reset(
    payload: PasswordResetConfirm, request: Request, db: Session = Depends(get_db)
):
    if len(payload.new_password) < 12:
        raise HTTPException(400, "Password must be at least 12 characters")
    email = consume_email_action_token(db, payload.token, "password_reset")
    if not email:
        raise HTTPException(400, "Invalid or expired reset link")
    user = get_user_by_email(db, email)
    if not user:
        raise HTTPException(400, "Account not found")
    user.hashed_password = hash_password(payload.new_password)
    db.commit()
    record_security_event(
        db, "password_reset_completed", user.id, ip=_client_ip(request)
    )
    return {"detail": "Password updated"}


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
    record_security_event(db, "password_changed", current_user.id)
    return {"detail": "Password updated"}


# ── Token verify ──────────────────────────────────────────────────────────────


@router.post("/verify")
def verify_token(current_user: User = Depends(_current_user)):
    return {"valid": True, "user_id": current_user.id, "role": current_user.role}


# ── Admin: User management ─────────────────────────────────────────────────────
#
# Org-scoped admins (role=admin, is_super_admin=False) must only ever see or
# modify users in their own org_id — only is_super_admin (the global,
# non-tenant-scoped account, see app/models/user.py) bypasses that. This
# mirrors the _require_member pattern in app/api/routes/organisations.py and
# the _require_super_admin gate in app/api/routes/tenants.py.


def _get_org_scoped_user(db: Session, current_user: User, user_id: str) -> User:
    target = get_user_by_id(db, user_id)
    if not target:
        raise HTTPException(404, "User not found")
    if not current_user.is_super_admin and target.org_id != current_user.org_id:
        raise HTTPException(404, "User not found")
    return target


@router.get("/users", response_model=List[UserResponse])
def list_users(
    current_user: User = Depends(_require_roles(UserRole.admin, UserRole.mlro)),
    db: Session = Depends(get_db),
):
    q = db.query(User)
    if not current_user.is_super_admin:
        q = q.filter(User.org_id == current_user.org_id)
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
    if payload.org_id and not current_user.is_super_admin:
        if payload.org_id != current_user.org_id:
            raise HTTPException(403, "Cannot create a user in another organisation")
    user = create_user(
        db,
        email=payload.email,
        full_name=payload.full_name,
        password=payload.password or secrets.token_urlsafe(16),
        role=(payload.role.value if payload.role else UserRole.analyst.value),
        org_id=payload.org_id or current_user.org_id,
    )
    record_security_event(
        db,
        "user_created_by_admin",
        current_user.id,
        meta={"target": user.id, "role": user.role.value},
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
    target = _get_org_scoped_user(db, current_user, user_id)
    old_role = target.role
    for field, val in payload.model_dump(exclude_unset=True).items():
        setattr(target, field, val)
    db.commit()
    db.refresh(target)
    if old_role != target.role:
        record_security_event(
            db,
            "role_changed",
            current_user.id,
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
    target = _get_org_scoped_user(db, current_user, user_id)
    if target.id == current_user.id:
        raise HTTPException(400, "Cannot suspend yourself")
    target.status = UserStatus.suspended
    db.commit()
    record_security_event(
        db,
        "user_suspended",
        current_user.id,
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
    target = _get_org_scoped_user(db, current_user, user_id)
    target.status = UserStatus.active
    db.commit()
    record_security_event(
        db,
        "user_activated",
        current_user.id,
        meta={"target": user_id},
        ip=_client_ip(request),
    )
    return {"detail": f"User {user_id} activated"}
