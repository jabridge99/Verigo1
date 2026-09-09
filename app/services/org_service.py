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


def attach_owner(db: Session, org: Organisation, owner: User) -> None:
    """
    Give `owner` an active "owner" membership on `org`, and — only if they
    don't already have a default org — make it their default (User.org_id/
    industry_id/primary_organisation_id all point at the same org; these
    three fields exist for historically different reasons but a single
    freshly-created org should be the answer to all three, or every
    scoping convention in the codebase that reads a different one of them
    silently treats the owner as belonging to no organisation at all).
    Seeds the org's default approval questions, its AML/CTF Solution
    (Solution + Program + Risk Framework — see _seed_aml_solution_and_risk_framework),
    and its starter transaction monitoring rules (see
    _seed_default_monitoring_rules). Caller commits.
    """
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
        owner.org_id = owner.org_id or org.id
        owner.industry_id = owner.industry_id or org.id

    _seed_default_approval_questions(db, org.id)
    _seed_aml_solution_and_risk_framework(db, org, owner)
    _seed_default_monitoring_rules(db, org.id, owner.id)


# ── Default transaction monitoring rules (Stage 8) ──────────────────────────
# Starter, org-editable rules covering each indicator type named in the
# staged plan's Stage 8 brief. Every org starts with zero MonitoringRule
# rows otherwise (score-based behaviour-signal alerting still runs, but
# the configurable rule layer -- the actual "Support configurable rules"
# requirement -- had nothing seeded to configure). Marked is_system_rule
# so they can't be deleted, only disabled/edited via /monitoring/rules.

_HIGH_RISK_COUNTRIES = ["KP", "IR", "MM", "RU", "BY", "SY", "CU", "SD"]


def _seed_default_monitoring_rules(db: Session, org_id: str, created_by: str) -> None:
    from app.models.monitoring import (
        AlertCategory,
        AlertSeverity,
        MonitoringRule,
        RuleCondition,
        RuleConditionGroup,
        RuleConditionOperator,
        RuleStatus,
    )

    if db.query(MonitoringRule).filter(MonitoringRule.org_id == org_id).first():
        return

    def _rule(
        ref: str,
        name: str,
        description: str,
        category: "AlertCategory",
        severity: "AlertSeverity",
        groups: list[list[tuple[str, "RuleConditionOperator", object]]],
    ) -> None:
        rule = MonitoringRule(
            org_id=org_id,
            name=name,
            description=description,
            rule_ref=ref,
            category=category,
            status=RuleStatus.active,
            is_system_rule=True,
            alert_severity=severity,
            created_by=created_by,
        )
        db.add(rule)
        db.flush()
        for g_idx, conditions in enumerate(groups):
            group = RuleConditionGroup(rule_id=rule.id, group_order=g_idx)
            db.add(group)
            db.flush()
            for c_idx, (field_path, operator, value) in enumerate(conditions):
                db.add(
                    RuleCondition(
                        group_id=group.id,
                        condition_order=c_idx,
                        field_path=field_path,
                        operator=operator,
                        value=value,
                    )
                )

    _rule(
        "RULE-TM-001",
        "Large or unusual transaction amount",
        "Transaction value at or above AUD 50,000 in a single transaction.",
        AlertCategory.high_value,
        AlertSeverity.high,
        [[("amount_aud", RuleConditionOperator.greater_or_equal, 50000)]],
    )
    _rule(
        "RULE-TM-002",
        "Rapid movement of funds",
        "Behaviour engine's velocity score (burst/volume of transactions in a "
        "short window) is elevated.",
        AlertCategory.rapid_movement,
        AlertSeverity.high,
        [
            [
                (
                    "behaviour_signals.velocity_score",
                    RuleConditionOperator.greater_or_equal,
                    60,
                )
            ]
        ],
    )
    _rule(
        "RULE-TM-003",
        "Structuring indicators",
        "Transaction flagged as a possible attempt to avoid a reporting "
        "threshold (near-threshold and/or round-number amount pattern).",
        AlertCategory.structuring,
        AlertSeverity.critical,
        [
            [("is_structuring_suspect", RuleConditionOperator.is_true, None)],
            [
                ("is_near_threshold", RuleConditionOperator.is_true, None),
                ("is_round_number", RuleConditionOperator.is_true, None),
            ],
        ],
    )
    _rule(
        "RULE-TM-004",
        "Frequency anomaly",
        "Behaviour engine's frequency score (transaction count vs. the "
        "customer's own baseline) is elevated.",
        AlertCategory.frequency_anomaly,
        AlertSeverity.medium,
        [
            [
                (
                    "behaviour_signals.frequency_score",
                    RuleConditionOperator.greater_or_equal,
                    60,
                )
            ]
        ],
    )
    _rule(
        "RULE-TM-005",
        "High-risk jurisdiction",
        "Transaction sent to or received from a FATF blacklisted or "
        "internationally sanctioned country.",
        AlertCategory.high_risk_country,
        AlertSeverity.high,
        [
            [
                (
                    "destination_country",
                    RuleConditionOperator.in_list,
                    _HIGH_RISK_COUNTRIES,
                )
            ],
            [("source_country", RuleConditionOperator.in_list, _HIGH_RISK_COUNTRIES)],
        ],
    )
    _rule(
        "RULE-TM-006",
        "High-risk customer",
        "Customer is a Politically Exposed Person or independently rated high risk.",
        AlertCategory.pep_exposure,
        AlertSeverity.high,
        [
            [("customer.is_pep", RuleConditionOperator.is_true, None)],
            [("customer.risk_level", RuleConditionOperator.equals, "high")],
        ],
    )


def _seed_aml_solution_and_risk_framework(
    db: Session, org: Organisation, owner: User
) -> None:
    """
    Bootstrap the AML/CTF Solution (Solution + Program document + Risk
    Framework) every org needs before any of the AML program, governance,
    or risk-assessment endpoints will work — they all 404 with "Complete
    onboarding and industry selection first" against an org with no
    AMLSolution row. seed_aml_solution()/seed_risk_framework() have existed
    since Stage 3/6 but were never actually called from any real code path
    (only referenced in their own docstrings) — every organisation ever
    created through real registration or POST /organisations has had this
    entire half of the product permanently unreachable. Guarded on
    AMLSolution's unique org_id constraint so this is safe to no-op if
    attach_owner() is ever called twice for the same org.
    """
    from app.models.aml_solution import AMLSolution
    from app.templates.aml.factory import seed_aml_solution
    from app.templates.risk.factory import seed_risk_framework

    if db.query(AMLSolution).filter(AMLSolution.org_id == org.id).first():
        return

    solution = seed_aml_solution(db, org, owner.id)
    db.flush()
    seed_risk_framework(db, org, solution.id, owner.id)


class IndustryLockedError(ValueError):
    """Raised when an org's industry can't be changed anymore (Program active/reviewed,
    or a risk assessment has already been started)."""


def select_industry(
    db: Session, org: Organisation, industry_type: IndustryType, actor_id: str
) -> Organisation:
    """
    Stage 7: let a business actually pick its real AUSTRAC industry —
    every org is created as IndustryType.other (attach_owner() has no way
    to know the real one yet), so this is the first point a user can
    correct it. Re-seeds the org's AML Solution (Program + Risk Framework)
    from the correct industry template, since the "other" seed it got at
    signup is the wrong Compliance Pack for it.

    Only allowed while the org's AML Program is still in its untouched
    initial state (draft, version "1.0") and no risk assessment run has
    been started — once a compliance officer has begun customising or
    approving anything, silently wiping and re-seeding it would destroy
    real work. Callers should present that as "contact support" rather
    than a self-service action.
    """
    from app.models.aml_solution import (
        AMLPolicy,
        AMLProgram,
        AMLService,
        AMLSolution,
        Control,
        ProgramStatus,
        RiskAssessment,
        TrainingRecord,
    )
    from app.models.risk_engine import RiskAssessmentRun, RiskFramework
    from app.templates.aml.factory import seed_aml_solution
    from app.templates.risk.factory import seed_risk_framework

    if org.industry_type == industry_type:
        return org

    solution = db.query(AMLSolution).filter(AMLSolution.org_id == org.id).first()
    if solution:
        program = (
            db.query(AMLProgram).filter(AMLProgram.solution_id == solution.id).first()
        )
        if program and (
            program.status != ProgramStatus.draft or program.version != "1.0"
        ):
            raise IndustryLockedError(
                "Industry can't be changed after the AML/CTF Program has been "
                "activated or reviewed"
            )

        framework = (
            db.query(RiskFramework)
            .filter(RiskFramework.solution_id == solution.id)
            .first()
        )
        if framework and (
            db.query(RiskAssessmentRun)
            .filter(RiskAssessmentRun.framework_id == framework.id)
            .count()
            > 0
        ):
            raise IndustryLockedError(
                "Industry can't be changed after a risk assessment has been started"
            )

        # Safe to wipe and reseed — nothing has progressed past the initial
        # seed. RiskFramework.categories cascades (relationship-level
        # delete-orphan) to RiskCategory/RiskFactor; the rest are deleted
        # explicitly since they're plain FKs, not ORM cascade relationships.
        if framework:
            db.delete(framework)
        db.query(AMLProgram).filter(AMLProgram.solution_id == solution.id).delete()
        db.query(AMLPolicy).filter(AMLPolicy.solution_id == solution.id).delete()
        db.query(Control).filter(Control.solution_id == solution.id).delete()
        db.query(TrainingRecord).filter(
            TrainingRecord.solution_id == solution.id
        ).delete()
        db.query(AMLService).filter(AMLService.solution_id == solution.id).delete()
        db.query(RiskAssessment).filter(
            RiskAssessment.solution_id == solution.id
        ).delete()
        db.delete(solution)
        db.flush()

    org.industry_type = industry_type
    db.flush()

    new_solution = seed_aml_solution(db, org, actor_id)
    db.flush()
    seed_risk_framework(db, org, new_solution.id, actor_id)
    return org


def create_organisation(
    db: Session, name: str, owner: User, industry_id: Optional[str] = None
) -> Organisation:
    org = Organisation(
        name=name, industry_id=industry_id, industry_type=IndustryType.other
    )
    db.add(org)
    db.commit()
    db.refresh(org)

    attach_owner(db, org, owner)
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
