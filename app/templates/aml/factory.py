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
    AMLService, AMLSolution, Control, ControlStatus, AMLProgram,
    Policy, PolicyStatus, ProgramStatus, RiskAppetite, ServiceType,
    ServiceStatus, SolutionStatus,
)
from app.models.organisation import Organisation
from app.templates.aml.base import AMLTemplateBase
from app.templates.aml.risk_overlay import apply_overlay

log = logging.getLogger("verigo.templates.aml")

# ── Industry → template module mapping ───────────────────────────────────────

def _get_industry_template(industry: str, risk_level: str) -> AMLTemplateBase:
    from app.models.organisation import IndustryType

    mapping = {
        IndustryType.remittance:            "remittance",
        IndustryType.designated_remittance: "remittance",
        IndustryType.cryptocurrency:        "vasp",
        IndustryType.banking:               "banking",
        IndustryType.fintech:               "fintech",
        IndustryType.real_estate:           "real_estate",
        IndustryType.insurance:             "other",
        IndustryType.other:                 "other",
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
        org.id, org.industry_type, risk_level,
    )

    tmpl = _get_industry_template(org.industry_type, risk_level)

    # ── 1. AMLSolution ────────────────────────────────────────────────────────
    solution = AMLSolution(
        org_id=org.id,
        status=SolutionStatus.active,
        template_industry=str(org.industry_type),
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
    policies_data = getattr(tmpl, "_policies", [])
    for i, p in enumerate(policies_data):
        policy = Policy(
            solution_id=solution.id,
            org_id=org.id,
            title=p["title"],
            policy_type=p["policy_type"],
            version="1.0",
            status=PolicyStatus.draft,
            effective_date=date.today(),
            review_due_date=date.today().replace(year=date.today().year + 1),
            created_by=created_by,
        )
        db.add(policy)

    # ── 4. Controls ───────────────────────────────────────────────────────────
    controls_data = getattr(tmpl, "_controls", [])
    for c in controls_data:
        control = Control(
            solution_id=solution.id,
            org_id=org.id,
            control_ref=c["control_ref"],
            title=c["title"],
            control_type=c.get("control_type", "preventive"),
            risk_area=c.get("risk_area", ""),
            status=ControlStatus.not_tested,
            next_test_date=date.today() + timedelta(days=90),
            created_by=created_by,
        )
        db.add(control)

    # ── 5. Premium Services — pre-create relevant ones ────────────────────────
    # AUSTRAC Registration Assistance (time-sensitive — pre-July 2026)
    db.add(AMLService(
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
            "Deadline: Registration must be completed before providing designated services. "
            "For Tranche 2 entities, the reform commenced 31 March 2026."
        ),
        deadline=date(2026, 7, 1),
        requested_by=created_by,
        invoiced=False,
    ))

    # Annual Compliance Report (EOFY)
    db.add(AMLService(
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
    ))

    log.info(
        "AML Solution seeded: solution_id=%s program=%s policies=%d controls=%d",
        solution.id, program.id, len(policies_data), len(controls_data),
    )

    return solution


# ── Helpers ───────────────────────────────────────────────────────────────────

def _now():
    from datetime import datetime, timezone
    return datetime.now(timezone.utc)
