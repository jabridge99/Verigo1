"""
Phase B — Organisation / membership / role / permission service layer.
"""

from typing import Optional
from uuid import uuid4

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.organisation import (
    IndustryType,
    MembershipStatus,
    Organisation,
    OrganisationUser,
    Permission,
    Role,
)
from app.models.risk_matrix import OrgApprovalQuestion, QuestionContext
from app.models.user import User

# ── Default pre-approval checklist questions (AML/CTF brief examples) ──────────
# Seeded once per new org as a starting point; compliance/MLRO/admin may edit,
# add, or deactivate them afterwards via /org/approval-questions.

DEFAULT_TRANSACTION_QUESTIONS: list[str] = [
    "Have you verified the source of funds for this transaction?",
    "Is the transaction consistent with the customer's stated business or income profile?",
    "Is the counterparty a known business contact on file?",
    "Does the transaction amount fall within expected thresholds for this customer?",
    "Have any third-party payment instructions been verified?",
]

DEFAULT_CUSTOMER_QUESTIONS: list[str] = [
    "Has the customer's identity been independently verified?",
    "Has a PEP and sanctions screening been completed with no unresolved matches?",
    "Has the source of wealth been assessed as consistent with the customer's profile?",
    "Has beneficial ownership been identified and verified (where applicable)?",
    "Has adverse media screening been completed with no unresolved findings?",
]


def _seed_default_approval_questions(db: Session, org_id: str) -> None:
    rows = [
        (DEFAULT_TRANSACTION_QUESTIONS, QuestionContext.transaction),
        (DEFAULT_CUSTOMER_QUESTIONS, QuestionContext.customer),
    ]
    for questions, context in rows:
        for i, text in enumerate(questions, start=1):
            db.add(
                OrgApprovalQuestion(
                    id=f"oaq_{uuid4().hex[:10]}",
                    org_id=org_id,
                    question_text=text,
                    question_order=i,
                    context=context,
                    is_system=True,
                )
            )

# ── Permission catalog (seeded once, idempotent) ────────────────────────────

PERMISSION_CATALOG: dict[str, str] = {
    "customers:read": "View customer records",
    "customers:write": "Create/edit customer records",
    "kyc:read": "View KYC records",
    "kyc:write": "Create/edit KYC records",
    "transactions:read": "View transactions",
    "reports:read": "View compliance reports",
    "reports:write": "Create/edit compliance reports",
    "reports:approve": "Approve and submit compliance reports",
    "audit:read": "View audit trail",
    "cases:read": "View MLRO/monitoring cases",
    "cases:write": "Create/edit cases",
    "cases:close": "Close cases",
    "ecdd:read": "View enhanced due diligence records",
    "ecdd:write": "Create/edit enhanced due diligence records",
    "org:manage": "Manage organisation settings, members, and roles",
}

# System roles available to every organisation. "*" expands to every
# permission in the catalog at seed time.
SYSTEM_ROLE_TEMPLATES: dict[str, tuple[str, set[str]]] = {
    "owner": ("Owner", {"*"}),
    "admin": ("Admin", {"*"}),
    "compliance_officer": (
        "Compliance Officer",
        {
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
    ),
    "mlro": (
        "MLRO",
        {
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
        },
    ),
    "director": (
        "Director",
        {
            "customers:read",
            "kyc:read",
            "transactions:read",
            "reports:read",
            "reports:approve",
            "audit:read",
            "cases:read",
            "ecdd:read",
        },
    ),
    "staff": (
        "Staff",
        {
            "customers:read",
            "kyc:read",
            "transactions:read",
            "reports:read",
            "cases:read",
            "ecdd:read",
        },
    ),
    "viewer": (
        "Viewer",
        {"customers:read", "transactions:read", "reports:read", "audit:read"},
    ),
}


def seed_permission_catalog_and_roles(db: Session) -> None:
    existing_codes = {p.code for p in db.query(Permission).all()}
    for code, desc in PERMISSION_CATALOG.items():
        if code not in existing_codes:
            db.add(Permission(code=code, description=desc))
    try:
        db.commit()
    except IntegrityError:
        # Another worker won the race to insert these permissions first.
        db.rollback()

    all_permissions = {p.code: p for p in db.query(Permission).all()}
    existing_roles = {
        r.role_id for r in db.query(Role).filter(Role.organisation_id.is_(None))
    }

    for role_key, (name, perm_codes) in SYSTEM_ROLE_TEMPLATES.items():
        role_id = f"ROLE-SYS-{role_key.upper()}"
        if role_id in existing_roles:
            continue
        codes = set(all_permissions.keys()) if "*" in perm_codes else perm_codes
        role = Role(
            role_id=role_id,
            organisation_id=None,
            name=name,
            description=f"System role: {name}",
            is_system=True,
        )
        role.permissions = [all_permissions[c] for c in codes if c in all_permissions]
        db.add(role)
    try:
        db.commit()
    except IntegrityError:
        # Another worker won the race to insert these system roles first.
        db.rollback()


def get_system_role(db: Session, role_key: str) -> Optional[Role]:
    return db.query(Role).filter(Role.role_id == f"ROLE-SYS-{role_key.upper()}").first()


def create_organisation(
    db: Session, name: str, owner: User, industry_id: Optional[str] = None
) -> Organisation:
    org = Organisation(
        name=name, industry_id=industry_id, industry_type=IndustryType.other
    )
    db.add(org)
    db.commit()
    db.refresh(org)

    owner_role = get_system_role(db, "owner")
    db.add(
        OrganisationUser(
            organisation_id=org.id,
            user_id=owner.id,
            role_id=owner_role.id,
            status=MembershipStatus.active,
        )
    )
    if not owner.primary_organisation_id:
        owner.primary_organisation_id = org.id

    _seed_default_approval_questions(db, org.id)
    db.commit()
    return org


def add_user_to_organisation(
    db: Session, org: Organisation, user: User, role_key: str = "staff"
) -> OrganisationUser:
    existing = (
        db.query(OrganisationUser)
        .filter(
            OrganisationUser.organisation_id == org.id,
            OrganisationUser.user_id == user.id,
        )
        .first()
    )
    if existing:
        return existing

    role = get_system_role(db, role_key)
    if not role:
        raise ValueError(f"Unknown role: {role_key}")

    membership = OrganisationUser(
        organisation_id=org.id,
        user_id=user.id,
        role_id=role.id,
        status=MembershipStatus.active,
    )
    db.add(membership)
    if not user.primary_organisation_id:
        user.primary_organisation_id = org.id
    db.commit()
    db.refresh(membership)
    return membership


def get_membership(
    db: Session, org_id: str, user_id: str
) -> Optional[OrganisationUser]:
    return (
        db.query(OrganisationUser)
        .filter(
            OrganisationUser.organisation_id == org_id,
            OrganisationUser.user_id == user_id,
        )
        .first()
    )


def get_user_organisations(db: Session, user: User) -> list[Organisation]:
    return (
        db.query(Organisation)
        .join(OrganisationUser, OrganisationUser.organisation_id == Organisation.id)
        .filter(OrganisationUser.user_id == user.id)
        .all()
    )


def has_org_permission(db: Session, user: User, org_id: str, permission: str) -> bool:
    if getattr(user, "is_super_admin", False):
        return True
    membership = get_membership(db, org_id, user.id)
    if not membership or membership.status != MembershipStatus.active:
        return False
    role = db.query(Role).filter(Role.id == membership.role_id).first()
    if not role:
        return False
    return any(p.code == permission for p in role.permissions)
