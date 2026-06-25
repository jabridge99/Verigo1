"""
AML/CTF Program Management — Phase 5.

Manages the organisation's formal AML/CTF Program and associated risk assessments.

Under the AML/CTF Act 2006 (Cth) (as amended by the 2024 reforms effective 31 March 2026),
reporting entities must:
  - Maintain a written, risk-based AML/CTF Program
  - Conduct Enterprise-Wide Risk Assessments (EWRA) at least annually
  - Review the program on material change or AUSTRAC direction
  - Obtain AML/CTF Compliance Officer or Board approval

The 2026 reform replaces the legacy Part A/Part B structure with a single
consolidated program. Legacy Part A/B programs remain valid for entities
enrolled before 31 March 2026 until next review.

Roles:
  GET  — analyst+
  Create / Update Program     — compliance+
  Activate / Approve          — mlro+
  Annual Review               — mlro+

DISCLAIMER: This module provides program document management only.
The platform does not draft or approve AML/CTF Programs on behalf of the
reporting entity. All program content, assessments, and approvals remain the
sole responsibility of the reporting entity and its AML/CTF Compliance Officer.
"""

from datetime import date, datetime, timezone
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.api.deps import (
    Pagination,
    org_id_for,
    require_analyst_or_above,
    require_compliance_or_above,
    require_mlro_or_above,
)
from app.db.database import get_db
from app.models.aml_solution import (
    AMLProgram,
    AMLSolution,
    AssessmentStatus,
    ProgramStatus,
    RiskAppetite,
    RiskAssessment,
)
from app.models.user import User

router = APIRouter(prefix="/aml-program", tags=["AML/CTF Program"])

DISCLAIMER = (
    "This module provides AML/CTF Program document management only. "
    "The platform does not draft or approve programs on behalf of the reporting entity. "
    "All program content, risk assessments, and approvals remain the sole responsibility "
    "of the reporting entity and its AML/CTF Compliance Officer."
)

# AUSTRAC-mandated program sections (2026 reform — single program structure)
REQUIRED_SECTIONS = [
    "1. Overview and scope of the program",
    "2. ML/TF/PF Enterprise-Wide Risk Assessment (EWRA)",
    "3. Customer due diligence (CDD) procedures — individuals",
    "4. Customer due diligence (CDD) procedures — companies and trusts",
    "5. Enhanced CDD (ECDD) triggers and procedures",
    "6. Ongoing CDD and transaction monitoring",
    "7. Beneficial ownership identification and verification",
    "8. Politically Exposed Persons (PEP) procedures",
    "9. Targeted Financial Sanctions (TFS) screening and asset freezing",
    "10. Travel Rule obligations (virtual assets and remittances)",
    "11. Suspicious Matter Report (SMR) procedures",
    "12. Threshold Transaction Report (TTR) procedures",
    "13. International Funds Transfer Instruction (IFTI) reporting",
    "14. Annual AML/CTF Compliance Report to AUSTRAC",
    "15. Employee due diligence",
    "16. AML/CTF training program",
    "17. Record keeping (7-year retention)",
    "18. Independent review program",
]


# ── Schemas ───────────────────────────────────────────────────────────────────


class ProgramCreate(BaseModel):
    version: str = Field(..., min_length=1, max_length=20, description="e.g. 1.0, 2.1")
    risk_appetite: RiskAppetite = RiskAppetite.medium
    overview: Optional[str] = None
    scope: Optional[str] = None
    designated_services: Optional[str] = None
    compliance_officer_name: Optional[str] = None
    compliance_officer_role: Optional[str] = None
    effective_date: Optional[date] = None
    review_due_date: Optional[date] = None
    is_legacy_part_ab: bool = False


class ProgramUpdate(BaseModel):
    risk_appetite: Optional[RiskAppetite] = None
    overview: Optional[str] = None
    scope: Optional[str] = None
    designated_services: Optional[str] = None
    compliance_officer_name: Optional[str] = None
    compliance_officer_role: Optional[str] = None
    # Section fields — free-text narrative
    ewra_summary: Optional[str] = None
    risk_factors_customer: Optional[str] = None
    risk_factors_product: Optional[str] = None
    risk_factors_channel: Optional[str] = None
    risk_factors_geography: Optional[str] = None
    risk_factors_proliferation: Optional[str] = None
    cdd_individuals: Optional[str] = None
    cdd_companies: Optional[str] = None
    cdd_trusts: Optional[str] = None
    cdd_simplified_procedures: Optional[str] = None
    cdd_enhanced_procedures: Optional[str] = None
    ongoing_cdd: Optional[str] = None
    transaction_monitoring: Optional[str] = None
    beneficial_ownership_procedures: Optional[str] = None
    pep_procedures: Optional[str] = None
    sanctions_procedures: Optional[str] = None
    travel_rule_procedures: Optional[str] = None
    smr_procedures: Optional[str] = None
    ttr_procedures: Optional[str] = None
    ifti_procedures: Optional[str] = None
    annual_compliance_report: Optional[str] = None
    employee_due_diligence: Optional[str] = None
    training_program_summary: Optional[str] = None
    record_keeping: Optional[str] = None
    independent_review: Optional[str] = None
    effective_date: Optional[date] = None
    review_due_date: Optional[date] = None


class ProgramReview(BaseModel):
    review_notes: str = Field(..., min_length=20)
    next_review_date: Optional[date] = None
    changes_required: bool = False


class RiskAssessmentCreate(BaseModel):
    title: str = Field(..., min_length=5, max_length=255)
    assessment_date: date
    customer_risk_rating: Optional[str] = None
    product_risk_rating: Optional[str] = None
    channel_risk_rating: Optional[str] = None
    geography_risk_rating: Optional[str] = None
    inherent_risk_score: Optional[float] = Field(None, ge=0, le=25)
    control_effectiveness_score: Optional[float] = Field(None, ge=0, le=5)
    residual_risk_score: Optional[float] = Field(None, ge=0, le=25)
    findings: Optional[str] = None
    recommendations: Optional[str] = None
    action_items: Optional[str] = None
    next_review_date: Optional[date] = None


class RiskAssessmentUpdate(BaseModel):
    customer_risk_rating: Optional[str] = None
    product_risk_rating: Optional[str] = None
    channel_risk_rating: Optional[str] = None
    geography_risk_rating: Optional[str] = None
    inherent_risk_score: Optional[float] = Field(None, ge=0, le=25)
    control_effectiveness_score: Optional[float] = Field(None, ge=0, le=5)
    residual_risk_score: Optional[float] = Field(None, ge=0, le=25)
    findings: Optional[str] = None
    recommendations: Optional[str] = None
    action_items: Optional[str] = None
    next_review_date: Optional[date] = None


# ── Helpers ───────────────────────────────────────────────────────────────────


def _get_solution(org_id: str, db: Session) -> AMLSolution:
    solution = db.query(AMLSolution).filter(AMLSolution.org_id == org_id).first()
    if not solution:
        raise HTTPException(
            404,
            "No AML/CTF Solution found for this organisation. "
            "Complete onboarding and industry selection first.",
        )
    return solution


def _get_program(program_id: str, org_id: str, db: Session) -> AMLProgram:
    program = (
        db.query(AMLProgram)
        .filter(
            AMLProgram.id == program_id,
            AMLProgram.org_id == org_id,
        )
        .first()
    )
    if not program:
        raise HTTPException(404, "AML Program not found.")
    return program


def _section_completion(p: AMLProgram) -> dict:
    """Returns completion status per section for the program document."""
    sections = {
        "overview": bool(p.overview),
        "scope": bool(p.scope),
        "designated_services": bool(p.designated_services),
        "ewra_summary": bool(p.ewra_summary),
        "risk_factors_customer": bool(p.risk_factors_customer),
        "risk_factors_product": bool(p.risk_factors_product),
        "risk_factors_channel": bool(p.risk_factors_channel),
        "risk_factors_geography": bool(p.risk_factors_geography),
        "cdd_individuals": bool(p.cdd_individuals),
        "cdd_companies": bool(p.cdd_companies),
        "ongoing_cdd": bool(p.ongoing_cdd),
        "transaction_monitoring": bool(p.transaction_monitoring),
        "beneficial_ownership_procedures": bool(p.beneficial_ownership_procedures),
        "pep_procedures": bool(p.pep_procedures),
        "sanctions_procedures": bool(p.sanctions_procedures),
        "smr_procedures": bool(p.smr_procedures),
        "ttr_procedures": bool(p.ttr_procedures),
        "ifti_procedures": bool(p.ifti_procedures),
        "employee_due_diligence": bool(p.employee_due_diligence),
        "training_program_summary": bool(p.training_program_summary),
        "record_keeping": bool(p.record_keeping),
        "independent_review": bool(p.independent_review),
    }
    completed = sum(1 for v in sections.values() if v)
    total = len(sections)
    return {
        "sections": sections,
        "completed": completed,
        "total": total,
        "completion_pct": round(completed / total * 100),
    }


def _program_dict(p: AMLProgram, include_sections: bool = False) -> dict:
    d = {
        "id": p.id,
        "org_id": p.org_id,
        "solution_id": p.solution_id,
        "version": p.version,
        "status": p.status.value,
        "risk_appetite": p.risk_appetite.value if p.risk_appetite else None,
        "is_legacy_part_ab": p.is_legacy_part_ab,
        "compliance_officer_name": p.compliance_officer_name,
        "compliance_officer_role": p.compliance_officer_role,
        "effective_date": p.effective_date,
        "review_due_date": p.review_due_date,
        "last_reviewed_at": p.last_reviewed_at,
        "reviewed_by": p.reviewed_by,
        "approved_by": p.approved_by,
        "approved_at": p.approved_at,
        "created_by": p.created_by,
        "created_at": p.created_at,
        "updated_at": p.updated_at,
        "section_completion": _section_completion(p),
        "austrac_enrolment_date": p.austrac_enrolment_date,
        "austrac_registration_date": p.austrac_registration_date,
        "austrac_registration_expiry": p.austrac_registration_expiry,
    }
    if include_sections:
        d["sections"] = {
            "overview": p.overview,
            "scope": p.scope,
            "designated_services": p.designated_services,
            "ewra_summary": p.ewra_summary,
            "risk_factors_customer": p.risk_factors_customer,
            "risk_factors_product": p.risk_factors_product,
            "risk_factors_channel": p.risk_factors_channel,
            "risk_factors_geography": p.risk_factors_geography,
            "risk_factors_proliferation": p.risk_factors_proliferation,
            "cdd_individuals": p.cdd_individuals,
            "cdd_companies": p.cdd_companies,
            "cdd_trusts": p.cdd_trusts,
            "cdd_simplified_procedures": p.cdd_simplified_procedures,
            "cdd_enhanced_procedures": p.cdd_enhanced_procedures,
            "ongoing_cdd": p.ongoing_cdd,
            "transaction_monitoring": p.transaction_monitoring,
            "beneficial_ownership_procedures": p.beneficial_ownership_procedures,
            "pep_procedures": p.pep_procedures,
            "sanctions_procedures": p.sanctions_procedures,
            "travel_rule_procedures": p.travel_rule_procedures,
            "smr_procedures": p.smr_procedures,
            "ttr_procedures": p.ttr_procedures,
            "ifti_procedures": p.ifti_procedures,
            "annual_compliance_report": p.annual_compliance_report,
            "employee_due_diligence": p.employee_due_diligence,
            "training_program_summary": p.training_program_summary,
            "record_keeping": p.record_keeping,
            "independent_review": p.independent_review,
        }
    return d


def _assessment_dict(a: RiskAssessment) -> dict:
    return {
        "id": a.id,
        "org_id": a.org_id,
        "solution_id": a.solution_id,
        "title": a.title,
        "assessment_date": a.assessment_date,
        "status": a.status.value,
        "inherent_risk_score": a.inherent_risk_score,
        "control_effectiveness_score": a.control_effectiveness_score,
        "residual_risk_score": a.residual_risk_score,
        "customer_risk_rating": a.customer_risk_rating,
        "product_risk_rating": a.product_risk_rating,
        "channel_risk_rating": a.channel_risk_rating,
        "geography_risk_rating": a.geography_risk_rating,
        "findings": a.findings,
        "recommendations": a.recommendations,
        "action_items": a.action_items,
        "next_review_date": a.next_review_date,
        "conducted_by": a.conducted_by,
        "approved_by": a.approved_by,
        "approved_at": a.approved_at,
        "created_at": a.created_at,
        "updated_at": a.updated_at,
    }


# ── Program CRUD ──────────────────────────────────────────────────────────────


@router.get("")
def get_active_program(
    include_sections: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    """
    Get the currently active AML/CTF Program.

    Returns document structure with section completion tracker.
    Set include_sections=true to retrieve all narrative content.

    DISCLAIMER: The platform provides program document management only.
    """
    org_id = org_id_for(current_user)
    program = (
        db.query(AMLProgram)
        .filter(
            AMLProgram.org_id == org_id,
            AMLProgram.status == ProgramStatus.active,
        )
        .order_by(desc(AMLProgram.created_at))
        .first()
    )

    if not program:
        return {
            "active_program": None,
            "message": "No active AML/CTF Program. Create a draft program to get started.",
            "required_sections": REQUIRED_SECTIONS,
            "disclaimer": DISCLAIMER,
        }

    return {
        "active_program": _program_dict(program, include_sections),
        "required_sections": REQUIRED_SECTIONS,
        "disclaimer": DISCLAIMER,
    }


@router.get("/versions")
def list_program_versions(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
    page: Pagination = Depends(),
):
    """List all program versions for audit trail."""
    org_id = org_id_for(current_user)
    programs = (
        db.query(AMLProgram)
        .filter(
            AMLProgram.org_id == org_id,
        )
        .order_by(desc(AMLProgram.created_at))
        .offset(page.offset)
        .limit(page.limit)
        .all()
    )
    return {"versions": [_program_dict(p) for p in programs], "count": len(programs)}


@router.post("", status_code=201)
def create_program(
    payload: ProgramCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """
    Create a new AML/CTF Program draft.

    Programs start as drafts. The active program is not affected until
    the new version is explicitly activated by the MLRO.

    DISCLAIMER: The platform does not draft program content on your behalf.
    """
    org_id = org_id_for(current_user)
    solution = _get_solution(org_id, db)

    existing = (
        db.query(AMLProgram)
        .filter(
            AMLProgram.org_id == org_id,
            AMLProgram.version == payload.version,
        )
        .first()
    )
    if existing:
        raise HTTPException(409, f"Program version '{payload.version}' already exists.")

    program = AMLProgram(
        id=f"aml_{uuid4().hex[:12]}",
        solution_id=solution.id,
        org_id=org_id,
        version=payload.version,
        status=ProgramStatus.draft,
        risk_appetite=payload.risk_appetite,
        is_legacy_part_ab=payload.is_legacy_part_ab,
        overview=payload.overview,
        scope=payload.scope,
        designated_services=payload.designated_services,
        compliance_officer_name=payload.compliance_officer_name,
        compliance_officer_role=payload.compliance_officer_role,
        effective_date=payload.effective_date,
        review_due_date=payload.review_due_date,
        created_by=current_user.id,
    )
    db.add(program)
    db.commit()
    db.refresh(program)
    return {
        "program": _program_dict(program),
        "required_sections": REQUIRED_SECTIONS,
        "disclaimer": DISCLAIMER,
    }


@router.get("/{program_id}")
def get_program(
    program_id: str,
    include_sections: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    """Get a specific program version."""
    org_id = org_id_for(current_user)
    program = _get_program(program_id, org_id, db)
    return {
        "program": _program_dict(program, include_sections),
        "disclaimer": DISCLAIMER,
    }


@router.patch("/{program_id}")
def update_program(
    program_id: str,
    payload: ProgramUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """
    Update an AML/CTF Program draft.

    Only draft or under_review programs can be updated.
    Active programs are immutable — create a new version to make changes.
    """
    org_id = org_id_for(current_user)
    program = _get_program(program_id, org_id, db)

    if program.status not in (ProgramStatus.draft, ProgramStatus.under_review):
        raise HTTPException(
            409,
            f"Program is '{program.status.value}' and cannot be updated. "
            "Active programs are immutable — create a new version.",
        )

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(program, field, value)

    db.commit()
    db.refresh(program)
    return {
        "program": _program_dict(program, True),
        "disclaimer": DISCLAIMER,
    }


@router.post("/{program_id}/submit-for-review")
def submit_for_review(
    program_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """Submit a draft program for MLRO review and approval."""
    org_id = org_id_for(current_user)
    program = _get_program(program_id, org_id, db)
    if program.status != ProgramStatus.draft:
        raise HTTPException(409, "Only draft programs can be submitted for review.")
    program.status = ProgramStatus.under_review
    db.commit()
    return {
        "program_id": program.id,
        "version": program.version,
        "status": program.status.value,
        "message": "Program submitted for MLRO review and approval.",
    }


@router.post("/{program_id}/activate")
def activate_program(
    program_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_mlro_or_above),
):
    """
    Activate an AML/CTF Program (MLRO+ only).

    Supersedes the currently active program. Activation constitutes formal
    AML/CTF Compliance Officer or Board approval of this program version.

    DISCLAIMER: Activation does not constitute notification to AUSTRAC.
    Reporting entities must manage their own regulatory filing obligations.
    """
    org_id = org_id_for(current_user)
    program = _get_program(program_id, org_id, db)

    if program.status not in (ProgramStatus.draft, ProgramStatus.under_review):
        raise HTTPException(
            409, f"Cannot activate a program with status '{program.status.value}'."
        )

    db.query(AMLProgram).filter(
        AMLProgram.org_id == org_id,
        AMLProgram.status == ProgramStatus.active,
    ).update({"status": ProgramStatus.superseded})

    now = datetime.now(timezone.utc)
    program.status = ProgramStatus.active
    program.approved_by = current_user.id
    program.approved_at = now

    db.commit()
    db.refresh(program)
    return {
        "program": _program_dict(program),
        "message": f"Program v{program.version} activated. Previous version superseded.",
        "disclaimer": DISCLAIMER,
    }


@router.post("/{program_id}/record-review")
def record_annual_review(
    program_id: str,
    payload: ProgramReview,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_mlro_or_above),
):
    """
    Record an annual program review (MLRO+ only).

    AUSTRAC expects programs to be reviewed at least annually or on material change.
    If changes are required, status is set to under_review so the MLRO can
    update and re-activate.
    """
    org_id = org_id_for(current_user)
    program = _get_program(program_id, org_id, db)
    if program.status != ProgramStatus.active:
        raise HTTPException(409, "Only the active program can be reviewed.")

    now = datetime.now(timezone.utc)
    program.last_reviewed_at = now
    program.reviewed_by = current_user.id
    if payload.next_review_date:
        program.review_due_date = payload.next_review_date
    if payload.changes_required:
        program.status = ProgramStatus.under_review

    db.commit()
    db.refresh(program)
    return {
        "program_id": program.id,
        "version": program.version,
        "reviewed_at": now,
        "reviewed_by": current_user.id,
        "changes_required": payload.changes_required,
        "status": program.status.value,
        "message": (
            "Annual review recorded. Program set to 'under_review' — update and re-activate."
            if payload.changes_required
            else "Annual review recorded. Program remains active."
        ),
    }


# ── AUSTRAC Registration ──────────────────────────────────────────────────────


class AustracDetails(BaseModel):
    austrac_enrolment_date: Optional[date] = None
    austrac_registration_date: Optional[date] = None
    austrac_registration_expiry: Optional[date] = None
    designated_business_group: Optional[str] = None


@router.patch("/{program_id}/austrac")
def update_austrac_details(
    program_id: str,
    payload: AustracDetails,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """Update AUSTRAC enrolment and registration details on a program."""
    org_id = org_id_for(current_user)
    program = _get_program(program_id, org_id, db)

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(program, field, value)

    db.commit()
    db.refresh(program)
    return {
        "program_id": program.id,
        "austrac_enrolment_date": program.austrac_enrolment_date,
        "austrac_registration_date": program.austrac_registration_date,
        "austrac_registration_expiry": program.austrac_registration_expiry,
        "designated_business_group": program.designated_business_group,
    }


# ── Risk Assessments (EWRA) ───────────────────────────────────────────────────


@router.get("/risk-assessments")
def list_risk_assessments(
    status: Optional[AssessmentStatus] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
    page: Pagination = Depends(),
):
    """List all Enterprise-Wide Risk Assessments (EWRA) for this org."""
    org_id = org_id_for(current_user)
    q = db.query(RiskAssessment).filter(RiskAssessment.org_id == org_id)
    if status:
        q = q.filter(RiskAssessment.status == status)
    assessments = (
        q.order_by(desc(RiskAssessment.assessment_date))
        .offset(page.offset)
        .limit(page.limit)
        .all()
    )
    return {
        "assessments": [_assessment_dict(a) for a in assessments],
        "count": len(assessments),
        "disclaimer": DISCLAIMER,
    }


@router.post("/risk-assessments", status_code=201)
def create_risk_assessment(
    payload: RiskAssessmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """
    Create a new Enterprise-Wide Risk Assessment (EWRA) draft.

    DISCLAIMER: Risk scores and ratings must be determined by the reporting entity.
    The platform calculates formulas based on user-entered values only.
    """
    org_id = org_id_for(current_user)
    solution = _get_solution(org_id, db)

    assessment = RiskAssessment(
        id=f"ewra_{uuid4().hex[:12]}",
        solution_id=solution.id,
        org_id=org_id,
        title=payload.title,
        assessment_date=payload.assessment_date,
        status=AssessmentStatus.draft,
        inherent_risk_score=payload.inherent_risk_score,
        control_effectiveness_score=payload.control_effectiveness_score,
        residual_risk_score=payload.residual_risk_score,
        customer_risk_rating=payload.customer_risk_rating,
        product_risk_rating=payload.product_risk_rating,
        channel_risk_rating=payload.channel_risk_rating,
        geography_risk_rating=payload.geography_risk_rating,
        findings=payload.findings,
        recommendations=payload.recommendations,
        action_items=payload.action_items,
        next_review_date=payload.next_review_date,
        conducted_by=current_user.id,
    )
    db.add(assessment)
    db.commit()
    db.refresh(assessment)
    return {
        "assessment": _assessment_dict(assessment),
        "disclaimer": DISCLAIMER,
    }


@router.get("/risk-assessments/{assessment_id}")
def get_risk_assessment(
    assessment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    """Get a specific EWRA."""
    org_id = org_id_for(current_user)
    assessment = (
        db.query(RiskAssessment)
        .filter(
            RiskAssessment.id == assessment_id,
            RiskAssessment.org_id == org_id,
        )
        .first()
    )
    if not assessment:
        raise HTTPException(404, "Risk assessment not found.")
    return {"assessment": _assessment_dict(assessment), "disclaimer": DISCLAIMER}


@router.patch("/risk-assessments/{assessment_id}")
def update_risk_assessment(
    assessment_id: str,
    payload: RiskAssessmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """Update a risk assessment (draft or in_progress only)."""
    org_id = org_id_for(current_user)
    assessment = (
        db.query(RiskAssessment)
        .filter(
            RiskAssessment.id == assessment_id,
            RiskAssessment.org_id == org_id,
        )
        .first()
    )
    if not assessment:
        raise HTTPException(404, "Risk assessment not found.")
    if assessment.status == AssessmentStatus.approved:
        raise HTTPException(409, "Approved assessments cannot be modified.")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(assessment, field, value)
    if assessment.status == AssessmentStatus.draft:
        assessment.status = AssessmentStatus.in_progress

    db.commit()
    db.refresh(assessment)
    return {"assessment": _assessment_dict(assessment), "disclaimer": DISCLAIMER}


@router.post("/risk-assessments/{assessment_id}/complete")
def complete_risk_assessment(
    assessment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """Mark an EWRA as completed — ready for MLRO approval."""
    org_id = org_id_for(current_user)
    assessment = (
        db.query(RiskAssessment)
        .filter(
            RiskAssessment.id == assessment_id,
            RiskAssessment.org_id == org_id,
        )
        .first()
    )
    if not assessment:
        raise HTTPException(404, "Risk assessment not found.")
    if assessment.status == AssessmentStatus.approved:
        raise HTTPException(409, "Assessment is already approved.")
    assessment.status = AssessmentStatus.completed
    db.commit()
    return {
        "assessment_id": assessment.id,
        "status": assessment.status.value,
        "message": "Risk assessment marked complete. Awaiting MLRO approval.",
    }


@router.post("/risk-assessments/{assessment_id}/approve")
def approve_risk_assessment(
    assessment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_mlro_or_above),
):
    """
    Approve a completed EWRA (MLRO+ only).

    DISCLAIMER: Approval constitutes the MLRO's formal sign-off.
    The platform does not validate whether risk ratings are appropriate.
    """
    org_id = org_id_for(current_user)
    assessment = (
        db.query(RiskAssessment)
        .filter(
            RiskAssessment.id == assessment_id,
            RiskAssessment.org_id == org_id,
        )
        .first()
    )
    if not assessment:
        raise HTTPException(404, "Risk assessment not found.")
    if assessment.status != AssessmentStatus.completed:
        raise HTTPException(409, "Only completed assessments can be approved.")

    now = datetime.now(timezone.utc)
    assessment.status = AssessmentStatus.approved
    assessment.approved_by = current_user.id
    assessment.approved_at = now
    db.commit()
    db.refresh(assessment)
    return {"assessment": _assessment_dict(assessment), "disclaimer": DISCLAIMER}


# ── Program Compliance Status ─────────────────────────────────────────────────


@router.get("/compliance-status")
def program_compliance_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    """
    AML/CTF Program compliance status — traffic light overview.

    Checks: active program exists, section completion, EWRA currency, AUSTRAC registration.
    """
    org_id = org_id_for(current_user)
    now = datetime.now(timezone.utc)
    today = now.date()

    active_program = (
        db.query(AMLProgram)
        .filter(
            AMLProgram.org_id == org_id,
            AMLProgram.status == ProgramStatus.active,
        )
        .order_by(desc(AMLProgram.created_at))
        .first()
    )

    latest_ewra = (
        db.query(RiskAssessment)
        .filter(
            RiskAssessment.org_id == org_id,
            RiskAssessment.status == AssessmentStatus.approved,
        )
        .order_by(desc(RiskAssessment.assessment_date))
        .first()
    )

    pending_ewra_count = (
        db.query(RiskAssessment)
        .filter(
            RiskAssessment.org_id == org_id,
            RiskAssessment.status.in_(
                [AssessmentStatus.draft, AssessmentStatus.in_progress]
            ),
        )
        .count()
    )

    def _light(bad, warn=False):
        if bad:
            return "red"
        if warn:
            return "amber"
        return "green"

    # Program review overdue?
    review_days_remaining = None
    review_overdue = False
    if active_program and active_program.review_due_date:
        review_days_remaining = (active_program.review_due_date - today).days
        review_overdue = review_days_remaining < 0

    # EWRA overdue?
    ewra_age_days = None
    ewra_overdue = False
    if latest_ewra:
        ewra_age_days = (today - latest_ewra.assessment_date).days
        ewra_overdue = ewra_age_days > 365

    # AUSTRAC registration expiry
    reg_expiry_days = None
    reg_expired = False
    if active_program and active_program.austrac_registration_expiry:
        reg_expiry_days = (active_program.austrac_registration_expiry - today).days
        reg_expired = reg_expiry_days < 0

    # Section completion
    completion = _section_completion(active_program) if active_program else None

    return {
        "program": {
            "exists": active_program is not None,
            "version": active_program.version if active_program else None,
            "approved_at": active_program.approved_at if active_program else None,
            "review_due_date": active_program.review_due_date
            if active_program
            else None,
            "review_days_remaining": review_days_remaining,
            "review_overdue": review_overdue,
            "section_completion": completion,
            "traffic_light": _light(
                not active_program,
                review_days_remaining is not None and 0 <= review_days_remaining < 60,
            ),
        },
        "ewra": {
            "latest_approved_date": latest_ewra.assessment_date
            if latest_ewra
            else None,
            "age_days": ewra_age_days,
            "overdue": ewra_overdue,
            "pending_count": pending_ewra_count,
            "traffic_light": _light(
                not latest_ewra or ewra_overdue,
                ewra_age_days is not None and ewra_age_days > 300,
            ),
        },
        "austrac_registration": {
            "expiry_date": active_program.austrac_registration_expiry
            if active_program
            else None,
            "expiry_days_remaining": reg_expiry_days,
            "expired": reg_expired,
            "traffic_light": _light(
                reg_expired,
                reg_expiry_days is not None and 0 <= reg_expiry_days < 90,
            ),
        },
        "overall_traffic_light": _light(
            not active_program or ewra_overdue or review_overdue or reg_expired,
            (review_days_remaining is not None and 0 <= review_days_remaining < 60)
            or (ewra_age_days is not None and ewra_age_days > 300)
            or (reg_expiry_days is not None and 0 <= reg_expiry_days < 90),
        ),
        "disclaimer": DISCLAIMER,
    }
