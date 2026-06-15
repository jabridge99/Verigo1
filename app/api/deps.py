"""
Shared FastAPI dependencies — authentication, authorisation, org-scoping.

Every route that touches org data must use these dependencies.
Tenant isolation: all DB queries MUST filter by org_id = current_user.org_id
(admin users may pass ?org_id= to cross-scope).
"""
from __future__ import annotations

from functools import lru_cache
from typing import Callable, Optional, Set

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.user import User, UserRole
from app.services.auth_service import TOKEN_BLACKLIST, decode_token


# ── Token extraction ──────────────────────────────────────────────────────────

def _extract_token(authorization: Optional[str] = Header(None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or malformed Authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return authorization.split(" ", 1)[1]


# ── Current user ──────────────────────────────────────────────────────────────

def get_current_user(
    token: str = Depends(_extract_token),
    db: Session = Depends(get_db),
) -> User:
    """
    Validates JWT, checks blacklist, loads and returns the User ORM object.
    Raises 401 on any failure — never leaks why the token was rejected.
    """
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    jti = payload.get("jti")
    if jti and jti in TOKEN_BLACKLIST:
        raise HTTPException(status_code=401, detail="Token has been revoked")

    if payload.get("mfa_pending"):
        raise HTTPException(status_code=401, detail="MFA challenge incomplete")

    user_id: Optional[str] = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token claims")

    user = db.query(User).filter(User.id == user_id, User.status == "active").first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found or inactive")

    return user


# ── Role enforcement ──────────────────────────────────────────────────────────

def require_roles(*roles: UserRole) -> Callable:
    """
    Dependency factory. Returns a dependency that asserts the current user
    has one of the specified roles.

    Usage:
        @router.post("/", dependencies=[Depends(require_roles(UserRole.mlro, UserRole.admin))])
        def create_policy(...): ...

    Or as a typed dependency:
        current_user: User = Depends(require_roles(UserRole.admin))
    """
    role_set: Set[UserRole] = set(roles)

    def _check(user: User = Depends(get_current_user)) -> User:
        if user.role not in role_set:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Required role: {', '.join(r.value for r in role_set)}",
            )
        return user

    return _check


# Common role bundles
def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != UserRole.admin:
        raise HTTPException(403, "Admin access required")
    return user


def require_mlro_or_above(user: User = Depends(get_current_user)) -> User:
    if user.role not in {UserRole.admin, UserRole.mlro}:
        raise HTTPException(403, "MLRO or Admin access required")
    return user


def require_compliance_or_above(user: User = Depends(get_current_user)) -> User:
    if user.role not in {UserRole.admin, UserRole.mlro, UserRole.compliance}:
        raise HTTPException(403, "Compliance role or above required")
    return user


def require_analyst_or_above(user: User = Depends(get_current_user)) -> User:
    if user.role not in {UserRole.admin, UserRole.mlro, UserRole.compliance, UserRole.analyst}:
        raise HTTPException(403, "Analyst role or above required")
    return user


# ── Org-scoped DB access ──────────────────────────────────────────────────────

def org_id_for(user: User) -> str:
    """Return the org_id to scope all queries to for this user."""
    if not user.org_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User is not associated with an organisation",
        )
    return user.org_id


# ── Pagination ────────────────────────────────────────────────────────────────

class Pagination:
    def __init__(self, page: int = 1, page_size: int = 25):
        if page < 1:
            raise HTTPException(400, "page must be ≥ 1")
        if page_size < 1 or page_size > 200:
            raise HTTPException(400, "page_size must be between 1 and 200")
        self.page = page
        self.page_size = page_size
        self.offset = (page - 1) * page_size

    def apply(self, query):
        return query.offset(self.offset).limit(self.page_size)
