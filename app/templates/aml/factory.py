"""
AML Solution template factory.

Usage:
    from app.templates.aml.factory import seed_aml_solution

    await seed_aml_solution(
        db=db,
        org=organisation,
        created_by=user.id,
        risk_level="medium",   # low | medium | high
    )

This creates an AMLSolution with a pre-populated AMLProgram, default Policies,
and default Controls — all tailored to the organisation's industry type.
"""

from __future__ import annotations

import logging
from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.models.aml_solution import (
    AMLProgram,
    AMLService,
    AMLSolution,
    ProgramStatus,
    RiskAppetite,
    ServiceStatus,
    ServiceType,
    SolutionStatus,
)
from app.models.governance import (
    POLICY_NUMBER_PREFIX,
    Policy,
    PolicyLifecycleStatus,
    PolicyType,
)
from app.models.governance_controls import (
    CONTROL_REF_PREFIX,
    ControlMethod,
    ControlRiskArea,
    ControlStatus,
    ControlType,
    GovernanceControl,
)
from app.models.organisation import IndustryType, Organisation
from app.templates.aml.base import AMLTemplateBase
from app.templates.aml.risk_overlay import apply_overlay

log = logging.getLogger("verigo.templates.aml")

# ── Template free-text → governance-enum mapping ─────────────────────────────
# BASE_POLICIES/BASE_CONTROLS and each industry's extra_policies/extra_controls
# (app/templates/aml/base.py, app/templates/aml/industries/*.py) use free-text
# policy_type/risk_area labels. GovernanceControl.risk_area and Policy.policy_type
# are closed enums (P7/P11: seeding used to target the legacy, unused
# Control/AMLPolicy models — see PARKING_LOT.md). Values with no precise enum
# equivalent go to ControlRiskArea.custom (paired with risk_area_custom, which
# preserves the original label) or PolicyType.other — never force-mapped to an
# imprecise category.
_POLICY_TYPE_MAP: dict[str, PolicyType] = {
    "risk_assessment": PolicyType.risk_assessment_methodology,
    "kyc": PolicyType.cdd_policy,
    "source_of_funds": PolicyType.edd_policy,
    "transaction_monitoring": PolicyType.transaction_monitoring_policy,
    "reporting": PolicyType.reporting_policy,
    "ifti": PolicyType.reporting_policy,  # reporting_policy covers SMR/TTR/IFTI
    "record_keeping": PolicyType.record_keeping_policy,
    "staff_training": PolicyType.training_policy,
    "sanctions": PolicyType.sanctions_screening_policy,
    "pep": PolicyType.pep_policy,
    "independent_review": PolicyType.independent_review_policy,
    "travel_rule": PolicyType.travel_rule_policy,
    "third_party": PolicyType.outsourcing_policy,
    "agent_oversight": PolicyType.outsourcing_policy,
    # No dedicated category — genuinely industry-specific, mapped to "other"
    # rather than forced into an imprecise category:
    "trust_accounts": PolicyType.other,
    "corporate_structures": PolicyType.other,
    "correspondent_banking": PolicyType.other,
    "virtual_asset": PolicyType.other,
}

_RISK_AREA_MAP: dict[str, ControlRiskArea] = {
    "customer_identity": ControlRiskArea.cdd,
    "customer_risk": ControlRiskArea.cdd,
    "kyc": ControlRiskArea.cdd,
    "source_of_funds": ControlRiskArea.edd,
    "sanctions": ControlRiskArea.sanctions_screening,
    "pep": ControlRiskArea.pep_screening,
    "transaction_monitoring": ControlRiskArea.transaction_monitoring,
    "reporting": ControlRiskArea.smr_reporting,
    "staff_training": ControlRiskArea.training,
    "record_keeping": ControlRiskArea.record_keeping,
    "governance": ControlRiskArea.governance,
    "ifti_reporting": ControlRiskArea.ifti_reporting,
    "ttr_reporting": ControlRiskArea.ttr_reporting,
    "travel_rule": ControlRiskArea.travel_rule,
    "beneficial_ownership": ControlRiskArea.beneficial_ownership,
    # No dedicated risk area — genuinely industry-specific, mapped to "custom"
    # (with risk_area_custom preserving the original label) rather than forced
    # into an imprecise category:
    "trust_accounts": ControlRiskArea.custom,
    "corporate_structures": ControlRiskArea.custom,
    "correspondent_banking": ControlRiskArea.custom,
    "high_value_transactions": ControlRiskArea.custom,
    "product_risk": ControlRiskArea.custom,
    "third_party": ControlRiskArea.custom,
    "agent_oversight": ControlRiskArea.custom,
}

# Starter controls are seeded unconfigured, before any org customisation —
# manual_review is a safe, universally-applicable placeholder method; the
# compliance officer sets the real testing method when they configure each
# control (mirrors what a human creating a control via POST /governance/
# controls without picking a method would otherwise be forced to choose).
_DEFAULT_CONTROL_METHOD = ControlMethod.manual_review

# ── Industry → template module mapping ───────────────────────────────────────


def _get_industry_template(industry: IndustryType, risk_level: str) -> AMLTemplateBase:
    from app.models.organisation import IndustryType

    mapping = {
        # Tranche 1
        IndustryType.remittance: "remittance",
        IndustryType.vasp: "vasp",
        IndustryType.bullion_dealers: "dpms",
        # Tranche 2
        IndustryType.accountants: "accounting",
        IndustryType.conveyancers: "real_estate",  # shares real_estate template
        IndustryType.legal_professionals: "legal",
        IndustryType.real_estate: "real_estate",
        IndustryType.precious_metals: "dpms",
        IndustryType.pubs_clubs: "other",
        # Custom-package industries — should not normally reach here
        IndustryType.banking: "banking",
        IndustryType.bookmakers_betting: "other",
        IndustryType.casinos: "other",
        IndustryType.financial_services: "fintech",
        IndustryType.superannuation: "other",
        IndustryType.other: "other",
    }

    module_name = mapping.get(industry, "other")

    # Dynamically import the industry module
    import importlib

    mod = importlib.import_module(f"app.templates.aml.industries.{module_name}")
    template = mod.get_template(risk_level=risk_level)

    # Apply risk level overlay on top
    return apply_overlay(template, risk_level)


# ── Public seeding function ───────────────────────────────────────────────────


def seed_aml_solution(
    db: Session,
    org: Organisation,
    created_by: str,
    risk_level: str = "medium",
) -> AMLSolution:
    """
    Create and persist a fully pre-populated AMLSolution for an Organisation.
    Called on Organisation signup / activation.

    Returns the created AMLSolution (already added to session, not yet committed).
    """
    risk_level = risk_level.lower()
    if risk_level not in ("low", "medium", "high"):
        risk_level = "medium"

    log.info(
        "Seeding AML Solution for org=%s industry=%s risk=%s",
        org.id,
        org.industry_type,
        risk_level,
    )

    tmpl = _get_industry_template(org.industry_type, risk_level)

    # ── 1. AMLSolution ────────────────────────────────────────────────────────
    solution = AMLSolution(
        org_id=org.id,
        status=SolutionStatus.active,
        template_industry=org.industry_type.value
        if hasattr(org.industry_type, "value")
        else str(org.industry_type),
        activated_at=_now(),
        created_by=created_by,
    )
    db.add(solution)
    db.flush()  # get solution.id

    # ── 2. AMLProgram ─────────────────────────────────────────────────────────
    risk_appetite_map = {
        "low": RiskAppetite.low,
        "medium": RiskAppetite.medium,
        "high": RiskAppetite.high,
    }

    program = AMLProgram(
        solution_id=solution.id,
        org_id=org.id,
        version="1.0",
        status=ProgramStatus.draft,
        risk_appetite=risk_appetite_map[risk_level],
        is_legacy_part_ab=False,
        # Section 1
        overview=tmpl.overview,
        scope=tmpl.scope,
        designated_services=tmpl.designated_services,
        # Section 2 — Risk Assessment
        ewra_summary=tmpl.ewra_summary,
        risk_factors_customer=tmpl.risk_factors_customer,
        risk_factors_product=tmpl.risk_factors_product,
        risk_factors_channel=tmpl.risk_factors_channel,
        risk_factors_geography=tmpl.risk_factors_geography,
        risk_factors_proliferation=tmpl.risk_factors_proliferation,
        # Section 3 — CDD
        cdd_individuals=tmpl.cdd_individuals,
        cdd_companies=tmpl.cdd_companies,
        cdd_trusts=tmpl.cdd_trusts,
        cdd_partnerships=tmpl.cdd_partnerships,
        cdd_government_bodies=tmpl.cdd_government_bodies,
        cdd_simplified_procedures=tmpl.cdd_simplified_procedures,
        cdd_enhanced_procedures=tmpl.cdd_enhanced_procedures,
        # Section 4
        ongoing_cdd=tmpl.ongoing_cdd,
        transaction_monitoring=tmpl.transaction_monitoring,
        # Sections 5-8
        beneficial_ownership_procedures=tmpl.beneficial_ownership_procedures,
        pep_procedures=tmpl.pep_procedures,
        sanctions_procedures=tmpl.sanctions_procedures,
        travel_rule_procedures=tmpl.travel_rule_procedures,
        # Section 9 — Reporting
        smr_procedures=tmpl.smr_procedures,
        ttr_procedures=tmpl.ttr_procedures,
        ifti_procedures=tmpl.ifti_procedures,
        annual_compliance_report=tmpl.annual_compliance_report,
        # Sections 10-14
        employee_due_diligence=tmpl.employee_due_diligence,
        training_program_summary=tmpl.training_program_summary,
        record_keeping=tmpl.record_keeping,
        independent_review=tmpl.independent_review,
        # Lifecycle
        effective_date=date.today(),
        review_due_date=date.today().replace(year=date.today().year + 1),
        created_by=created_by,
    )
    db.add(program)

    # ── 3. Policies ───────────────────────────────────────────────────────────
    # Seeded directly into the governance module (GovernanceControl/Policy) —
    # the actively-developed system behind GET/POST /governance/controls and
    # /governance/policies — rather than the legacy, UI-disconnected
    # Control/AMLPolicy models (see PARKING_LOT.md P7/P11).
    policies_data = getattr(tmpl, "_policies", [])
    policy_type_counts: dict[PolicyType, int] = {}
    for p in policies_data:
        policy_type = _POLICY_TYPE_MAP.get(p["policy_type"], PolicyType.other)
        if policy_type not in policy_type_counts:
            policy_type_counts[policy_type] = (
                db.query(Policy)
                .filter(Policy.org_id == org.id, Policy.policy_type == policy_type)
                .count()
            )
        policy_type_counts[policy_type] += 1
        policy_number = (
            f"{POLICY_NUMBER_PREFIX.get(policy_type, 'GOV')}"
            f"-{str(policy_type_counts[policy_type]).zfill(3)}"
        )

        policy = Policy(
            solution_id=solution.id,
            org_id=org.id,
            policy_number=policy_number,
            title=p["title"],
            policy_type=policy_type,
            status=PolicyLifecycleStatus.draft,
            version_major=1,
            version_minor=0,
            effective_date=date.today(),
            review_due_date=date.today().replace(year=date.today().year + 1),
            document_owner=created_by,
            created_by=created_by,
        )
        db.add(policy)

    # ── 4. Controls ───────────────────────────────────────────────────────────
    controls_data = getattr(tmpl, "_controls", [])
    risk_area_counts: dict[ControlRiskArea, int] = {}
    for c in controls_data:
        risk_area_key = c.get("risk_area", "")
        risk_area = _RISK_AREA_MAP.get(risk_area_key, ControlRiskArea.custom)
        if risk_area not in risk_area_counts:
            risk_area_counts[risk_area] = (
                db.query(GovernanceControl)
                .filter(
                    GovernanceControl.org_id == org.id,
                    GovernanceControl.risk_area == risk_area,
                )
                .count()
            )
        risk_area_counts[risk_area] += 1
        control_ref = (
            f"{CONTROL_REF_PREFIX.get(risk_area, 'CTL-GOV')}"
            f"-{str(risk_area_counts[risk_area]).zfill(3)}"
        )

        control = GovernanceControl(
            solution_id=solution.id,
            org_id=org.id,
            control_ref=control_ref,
            name=c["title"],
            control_type=ControlType(c.get("control_type", "preventive")),
            risk_area=risk_area,
            risk_area_custom=risk_area_key
            if risk_area == ControlRiskArea.custom
            else None,
            control_owner=created_by,
            control_method=_DEFAULT_CONTROL_METHOD,
            status=ControlStatus.active,
            next_test_date=date.today() + timedelta(days=90),
            created_by=created_by,
        )
        db.add(control)

    # ── 5. Premium Services — pre-create relevant ones ────────────────────────
    # AUSTRAC Registration Assistance (time-sensitive — pre-July 2026)
    db.add(
        AMLService(
            solution_id=solution.id,
            org_id=org.id,
            service_type=ServiceType.austrac_registration,
            status=ServiceStatus.pending,
            title="AUSTRAC Enrolment & Registration Assistance",
            description=(
                "Verigo can assist your organisation with AUSTRAC online enrolment "
                "and registration as a reporting entity under the AML/CTF Act. "
                "This includes reviewing your registration details, designated services "
                "declaration, and compliance officer appointment notification.\n\n"
                "Deadline: Tranche 2 entities must enrol with AUSTRAC by 31 March 2026, "
                "and have a compliant AML/CTF Program operational before the reform's "
                "full obligations commence on 1 July 2026."
            ),
            deadline=date(2026, 7, 1),
            requested_by=created_by,
            invoiced=False,
        )
    )

    # Annual Compliance Report (EOFY)
    db.add(
        AMLService(
            solution_id=solution.id,
            org_id=org.id,
            service_type=ServiceType.annual_compliance_report,
            status=ServiceStatus.pending,
            title="Annual AML/CTF Compliance Report (FY2026)",
            description=(
                "Verigo can assist your organisation prepare and lodge the annual "
                "AML/CTF Compliance Report with AUSTRAC within 3 months of 30 June 2026.\n\n"
                "The report must cover compliance with AML/CTF obligations during the "
                "financial year, changes to risk profile, training delivered, and any "
                "program updates made during the year."
            ),
            target_date=date(2026, 9, 30),  # 3 months after EOFY
            deadline=date(2026, 9, 30),
            requested_by=created_by,
            invoiced=False,
        )
    )

    log.info(
        "AML Solution seeded: solution_id=%s program=%s policies=%d controls=%d",
        solution.id,
        program.id,
        len(policies_data),
        len(controls_data),
    )

    return solution


# ── Helpers ───────────────────────────────────────────────────────────────────


def _now():
    from datetime import datetime, timezone

    return datetime.now(timezone.utc)
