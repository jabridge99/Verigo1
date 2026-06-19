"""
Shared tenant-isolation helpers.

Two scoping dimensions coexist during the Phase B rollout:
 - industry_id (legacy): a string discriminator tied to an IndustryTenant
   compliance pack. Still set on every record.
 - organisation_id (Phase B): an FK to a real customer Organisation.
   Populated going forward; NULL on pre-existing records.

A record is visible to a non-admin, non-super-admin user if:
 - the user belongs to an organisation and the record's organisation_id
   matches it, OR
 - the record has no organisation_id yet (legacy data) and its
   industry_id matches the user's industry_id.

Global admins (`UserRole.admin`) and `is_super_admin` users bypass all
scoping, exactly as before.
"""

from typing import Optional

from sqlalchemy import or_
from sqlalchemy.orm import Query

from app.models.user import User, UserRole


def is_unscoped(user: User) -> bool:
    return user.role == UserRole.admin or bool(getattr(user, "is_super_admin", False))


def assert_tenant(
    user: User, record_organisation_id: Optional[str], record_industry_id: Optional[str]
) -> None:
    from fastapi import HTTPException

    if is_unscoped(user):
        return

    user_org_id = getattr(user, "primary_organisation_id", None)
    if user_org_id and record_organisation_id is not None:
        if record_organisation_id != user_org_id:
            raise HTTPException(403, "Cross-tenant access denied")
        return

    if record_industry_id and record_industry_id != user.industry_id:
        raise HTTPException(403, "Cross-tenant access denied")


def scope_query(query: Query, model, user: User) -> Query:
    if is_unscoped(user):
        return query

    user_org_id = getattr(user, "primary_organisation_id", None)
    if user_org_id:
        return query.filter(
            or_(
                model.organisation_id == user_org_id,
                (model.organisation_id.is_(None))
                & (model.industry_id == user.industry_id),
            )
        )
    return query.filter(model.industry_id == user.industry_id)


def scope_fields(user: User) -> dict:
    """Fields to stamp onto a newly-created record for the current user."""
    if is_unscoped(user):
        return {}
    return {
        "industry_id": user.industry_id,
        "organisation_id": getattr(user, "primary_organisation_id", None),
    }
