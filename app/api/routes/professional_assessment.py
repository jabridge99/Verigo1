"""
Professional Services AML Assessment API.

Supports AML risk documentation for:
  Accountants, Tax Advisers, Lawyers, Conveyancers,
  Trust & Company Service Providers, Real Estate Professionals.

Roles:
  GET endpoints            — analyst+
  Create / Update          — compliance+
  Complete / Escalate      — compliance+
  Checklist templates      — compliance+

DISCLAIMER: This module assists in documenting compliance considerations.
The platform does not determine legality, tax obligations, or investment
legitimacy. All decisions remain with the reporting entity.
"""
from datetime import datetime, timezone
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.api.deps import Pagination, org_id_for, require_analyst_or_above, require_compliance_or_above
from app.db.database import get_db
from app.models.customer import Customer
from app.models.professional_assessment import (
    AssessmentRiskRating,
    AssessmentStatus,
    ChecklistType,
    DEFAULT_CHECKLISTS,
    InvestmentLegitimacyAssessment,
    OrgProfessionalChecklistTemplate,
    ProfessionalAssessment,
    ProfessionalJudgmentChecklist,
    ProfessionalServiceType,
    ReviewOutcome,
    SOFAssessment,
    SOFSourceType,
    SOWAssessment,
    SOWSourceType,
    TaxRiskAssessment,
    TransactionPurposeAssessment,
    TransactionPurposeType,
)
from app.models.transaction import Transaction
from app.models.user import User
from app.services.professional_assessment_service import (
    DISCLAIMER,
    compute_assessment_risk_rating,
    generate_assessment_recommendations,
)

router = APIRouter(prefix="/professional-assessments", tags=["Professional Assessments"])

ORG_CHECKLIST_DISCLAIMER = (
    "Checklists are compliance workflow tools only. "
    "Completing a checklist does not constitute a compliance determination. "
    "All decisions remain with the reporting entity."
)


# ── Schemas ───────────────────────────────────────────────────────────────────

class AssessmentCreate(BaseModel):
    customer_id:                str
    professional_service_type:  ProfessionalServiceType
    transaction_id:             Optional[str] = None
    case_id:                    Optional[str] = None
    matter_description:         Optional[str] = Field(None, max_length=2000)
    assigned_to:                Optional[str] = None


class AssessmentUpdate(BaseModel):
    matter_description:     Optional[str] = Field(None, max_length=2000)
    assigned_to:            Optional[str] = None
    overall_risk_rating:    Optional[AssessmentRiskRating] = None
    risk_summary:           Optional[str] = None
    smr_consideration_noted: Optional[bool] = None


class SOFUpsert(BaseModel):
    primary_source_type:        SOFSourceType
    additional_source_types:    list[str] = Field(default_factory=list)
    source_description:         Optional[str] = None
    evidence_uploaded:          bool = False
    evidence_reviewed:          bool = False
    evidence_sufficient:        bool = False
    additional_info_required:   bool = False
    evidence_refs:              list[str] = Field(default_factory=list)
    evidence_types:             list[str] = Field(default_factory=list)
    review_outcome:             ReviewOutcome = ReviewOutcome.not_reviewed
    review_notes:               Optional[str] = None


class SOWUpsert(BaseModel):
    primary_source_type:            SOWSourceType
    additional_source_types:        list[str] = Field(default_factory=list)
    wealth_narrative:               Optional[str] = None
    wealth_explanation_provided:    bool = False
    evidence_reviewed:              bool = False
    wealth_profile_consistent:      bool = False
    additional_review_required:     bool = False
    evidence_refs:                  list[str] = Field(default_factory=list)
    review_notes:                   Optional[str] = None
    risk_assessment:                Optional[str] = None
    review_outcome:                 ReviewOutcome = ReviewOutcome.not_reviewed


class PurposeUpsert(BaseModel):
    purpose_type:                       TransactionPurposeType
    purpose_description:                Optional[str] = None
    purpose_documented:                 bool = False
    purpose_verified:                   bool = False
    supporting_evidence_reviewed:       bool = False
    purpose_consistent_with_profile:    bool = False
    evidence_refs:                      list[str] = Field(default_factory=list)
    review_notes:                       Optional[str] = None
    review_outcome:                     ReviewOutcome = ReviewOutcome.not_reviewed


class TaxRiskUpsert(BaseModel):
    indicator_unexplained_cash:         bool = False
    indicator_complex_ownership:        bool = False
    indicator_offshore_no_purpose:      bool = False
    indicator_income_inconsistency:     bool = False
    indicator_related_party_movements:  bool = False
    indicator_unusual_trust:            bool = False
    indicator_unexplained_wealth:       bool = False
    indicator_artificial_structuring:   bool = False
    indicator_lack_documentation:       bool = False
    indicator_reluctance_records:       bool = False
    custom_indicators:                  list[dict] = Field(default_factory=list)
    supporting_evidence:                Optional[str] = None
    reviewer_notes:                     Optional[str] = None
    risk_rating:                        AssessmentRiskRating = AssessmentRiskRating.not_rated


class InvestmentUpsert(BaseModel):
    investment_type:                    Optional[str] = Field(None, max_length=200)
    investment_purpose:                 Optional[str] = None
    purpose_documented:                 bool = False
    counterparty_identified:            bool = False
    documentation_reviewed:             bool = False
    funds_destination_verified:         bool = False
    commercial_rationale_understood:    bool = False
    regulatory_registration_verified:   bool = False
    beneficial_ownership_verified:      bool = False
    high_risk_jurisdiction_involved:    bool = False
    supporting_documentation:           list[str] = Field(default_factory=list)
    review_outcome:                     Optional[str] = None
    review_outcome_status:              ReviewOutcome = ReviewOutcome.not_reviewed
    review_notes:                       Optional[str] = None


class ChecklistItemUpdate(BaseModel):
    key:        str
    checked:    bool
    notes:      Optional[str] = None


class ChecklistSubmit(BaseModel):
    items: list[ChecklistItemUpdate]


class ChecklistTemplateUpsert(BaseModel):
    items: list[dict] = Field(
        ...,
        description="List of {key, label, is_required} dicts",
        min_length=1,
        max_length=20,
    )


class EscalateRequest(BaseModel):
    escalated_to:       str
    escalation_reason:  str = Field(..., min_length=10)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_or_404(assessment_id: str, org_id: str, db: Session) -> ProfessionalAssessment:
    pa = db.query(ProfessionalAssessment).filter(
        ProfessionalAssessment.id == assessment_id,
        ProfessionalAssessment.org_id == org_id,
    ).first()
    if not pa:
        raise HTTPException(404, "Assessment not found.")
    return pa


def _assessment_ref(db: Session, org_id: str) -> str:
    count = db.query(ProfessionalAssessment).filter(
        ProfessionalAssessment.org_id == org_id
    ).count()
    return f"PSA-{count + 1:05d}"


def _pa_dict(pa: ProfessionalAssessment, include_sections: bool = False) -> dict:
    d: dict = {
        "id": pa.id,
        "assessment_ref": pa.assessment_ref,
        "org_id": pa.org_id,
        "customer_id": pa.customer_id,
        "transaction_id": pa.transaction_id,
        "case_id": pa.case_id,
        "professional_service_type": pa.professional_service_type.value,
        "matter_description": pa.matter_description,
        "status": pa.status.value,
        "overall_risk_rating": pa.overall_risk_rating.value if pa.overall_risk_rating else None,
        "risk_summary": pa.risk_summary,
        "created_by": pa.created_by,
        "assigned_to": pa.assigned_to,
        "completed_by": pa.completed_by,
        "completed_at": pa.completed_at,
        "reviewed_by": pa.reviewed_by,
        "reviewed_at": pa.reviewed_at,
        "is_escalated": pa.is_escalated,
        "escalated_to": pa.escalated_to,
        "escalation_reason": pa.escalation_reason,
        "smr_consideration_noted": pa.smr_consideration_noted,
        "created_at": pa.created_at,
        "updated_at": pa.updated_at,
        "sections_complete": {
            "sof": pa.sof_assessment is not None,
            "sow": pa.sow_assessment is not None,
            "purpose": pa.purpose_assessment is not None,
            "tax_risk": pa.tax_risk_assessment is not None,
            "investment": pa.investment_assessment is not None,
            "checklist": pa.checklist is not None and (pa.checklist.is_complete if pa.checklist else False),
        },
        "disclaimer": DISCLAIMER,
    }
    if include_sections:
        d["sof"] = _sof_dict(pa.sof_assessment) if pa.sof_assessment else None
        d["sow"] = _sow_dict(pa.sow_assessment) if pa.sow_assessment else None
        d["purpose"] = _purpose_dict(pa.purpose_assessment) if pa.purpose_assessment else None
        d["tax_risk"] = _tax_dict(pa.tax_risk_assessment) if pa.tax_risk_assessment else None
        d["investment"] = _inv_dict(pa.investment_assessment) if pa.investment_assessment else None
        d["checklist"] = _checklist_dict(pa.checklist) if pa.checklist else None
    return d


def _sof_dict(s: SOFAssessment) -> dict:
    return {
        "id": s.id,
        "primary_source_type": s.primary_source_type.value,
        "additional_source_types": s.additional_source_types or [],
        "source_description": s.source_description,
        "evidence_uploaded": s.evidence_uploaded,
        "evidence_reviewed": s.evidence_reviewed,
        "evidence_sufficient": s.evidence_sufficient,
        "additional_info_required": s.additional_info_required,
        "evidence_refs": s.evidence_refs or [],
        "evidence_types": s.evidence_types or [],
        "review_outcome": s.review_outcome.value if s.review_outcome else None,
        "reviewer_id": s.reviewer_id,
        "review_date": s.review_date,
        "review_notes": s.review_notes,
    }


def _sow_dict(s: SOWAssessment) -> dict:
    return {
        "id": s.id,
        "primary_source_type": s.primary_source_type.value,
        "additional_source_types": s.additional_source_types or [],
        "wealth_narrative": s.wealth_narrative,
        "wealth_explanation_provided": s.wealth_explanation_provided,
        "evidence_reviewed": s.evidence_reviewed,
        "wealth_profile_consistent": s.wealth_profile_consistent,
        "additional_review_required": s.additional_review_required,
        "evidence_refs": s.evidence_refs or [],
        "review_notes": s.review_notes,
        "risk_assessment": s.risk_assessment,
        "review_outcome": s.review_outcome.value if s.review_outcome else None,
        "reviewer_id": s.reviewer_id,
        "review_date": s.review_date,
    }


def _purpose_dict(p: TransactionPurposeAssessment) -> dict:
    return {
        "id": p.id,
        "purpose_type": p.purpose_type.value,
        "purpose_description": p.purpose_description,
        "purpose_documented": p.purpose_documented,
        "purpose_verified": p.purpose_verified,
        "supporting_evidence_reviewed": p.supporting_evidence_reviewed,
        "purpose_consistent_with_profile": p.purpose_consistent_with_profile,
        "evidence_refs": p.evidence_refs or [],
        "review_notes": p.review_notes,
        "review_outcome": p.review_outcome.value if p.review_outcome else None,
        "reviewer_id": p.reviewer_id,
        "review_date": p.review_date,
    }


def _tax_dict(t: TaxRiskAssessment) -> dict:
    indicators = {
        "unexplained_cash":         t.indicator_unexplained_cash,
        "complex_ownership":        t.indicator_complex_ownership,
        "offshore_no_purpose":      t.indicator_offshore_no_purpose,
        "income_inconsistency":     t.indicator_income_inconsistency,
        "related_party_movements":  t.indicator_related_party_movements,
        "unusual_trust":            t.indicator_unusual_trust,
        "unexplained_wealth":       t.indicator_unexplained_wealth,
        "artificial_structuring":   t.indicator_artificial_structuring,
        "lack_documentation":       t.indicator_lack_documentation,
        "reluctance_records":       t.indicator_reluctance_records,
    }
    return {
        "id": t.id,
        "indicators": indicators,
        "indicator_count": t.indicator_count or sum(1 for v in indicators.values() if v),
        "custom_indicators": t.custom_indicators or [],
        "supporting_evidence": t.supporting_evidence,
        "reviewer_notes": t.reviewer_notes,
        "risk_rating": t.risk_rating.value if t.risk_rating else None,
        "reviewer_id": t.reviewer_id,
        "review_date": t.review_date,
        "disclaimer": (
            "Tax risk indicators are compliance workflow prompts only. "
            "The platform does not determine tax evasion or provide tax advice."
        ),
    }


def _inv_dict(i: InvestmentLegitimacyAssessment) -> dict:
    return {
        "id": i.id,
        "investment_type": i.investment_type,
        "investment_purpose": i.investment_purpose,
        "checklist": {
            "purpose_documented":               i.purpose_documented,
            "counterparty_identified":          i.counterparty_identified,
            "documentation_reviewed":           i.documentation_reviewed,
            "funds_destination_verified":       i.funds_destination_verified,
            "commercial_rationale_understood":  i.commercial_rationale_understood,
            "regulatory_registration_verified": i.regulatory_registration_verified,
            "beneficial_ownership_verified":    i.beneficial_ownership_verified,
            "high_risk_jurisdiction_involved":  i.high_risk_jurisdiction_involved,
        },
        "supporting_documentation": i.supporting_documentation or [],
        "review_outcome": i.review_outcome,
        "review_outcome_status": i.review_outcome_status.value if i.review_outcome_status else None,
        "reviewer_id": i.reviewer_id,
        "review_date": i.review_date,
        "review_notes": i.review_notes,
        "disclaimer": (
            "Investment legitimacy review is a compliance workflow tool only. "
            "The platform does not provide investment advice."
        ),
    }


def _checklist_dict(c: ProfessionalJudgmentChecklist) -> dict:
    return {
        "id": c.id,
        "checklist_type": c.checklist_type.value,
        "items": c.items or [],
        "total_items": c.total_items,
        "checked_items": c.checked_items,
        "is_complete": c.is_complete,
        "completed_by": c.completed_by,
        "completed_at": c.completed_at,
    }


def _get_checklist_template(
    org_id: str,
    checklist_type: str,
    db: Session,
) -> list[dict]:
    """Return org-custom template or fall back to DEFAULT_CHECKLISTS."""
    custom = db.query(OrgProfessionalChecklistTemplate).filter(
        OrgProfessionalChecklistTemplate.org_id == org_id,
        OrgProfessionalChecklistTemplate.checklist_type == checklist_type,
    ).first()
    if custom:
        return custom.items or []
    return DEFAULT_CHECKLISTS.get(checklist_type, [])


# ── Assessment CRUD ───────────────────────────────────────────────────────────

@router.post("", status_code=201)
def create_assessment(
    payload: AssessmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """
    Create a new professional services AML assessment for a customer/matter.

    DISCLAIMER: Assessments document risk-based compliance considerations.
    The platform does not determine legality. All decisions remain with
    the reporting entity.
    """
    org_id = org_id_for(current_user)

    customer = db.query(Customer).filter(
        Customer.id == payload.customer_id,
        Customer.org_id == org_id,
    ).first()
    if not customer:
        raise HTTPException(404, "Customer not found.")

    if payload.transaction_id:
        txn = db.query(Transaction).filter(
            Transaction.id == payload.transaction_id,
            Transaction.org_id == org_id,
        ).first()
        if not txn:
            raise HTTPException(404, "Transaction not found.")

    pa = ProfessionalAssessment(
        id=f"pa_{uuid4().hex[:12]}",
        assessment_ref=_assessment_ref(db, org_id),
        org_id=org_id,
        customer_id=payload.customer_id,
        transaction_id=payload.transaction_id,
        case_id=payload.case_id,
        professional_service_type=payload.professional_service_type,
        matter_description=payload.matter_description,
        assigned_to=payload.assigned_to,
        status=AssessmentStatus.draft,
        created_by=current_user.id,
    )
    db.add(pa)
    db.commit()
    db.refresh(pa)
    return _pa_dict(pa)


@router.get("")
def list_assessments(
    customer_id: Optional[str] = Query(None),
    professional_service_type: Optional[ProfessionalServiceType] = Query(None),
    status: Optional[AssessmentStatus] = Query(None),
    risk_rating: Optional[AssessmentRiskRating] = Query(None),
    assigned_to: Optional[str] = Query(None),
    pagination: Pagination = Depends(),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    org_id = org_id_for(current_user)
    q = db.query(ProfessionalAssessment).filter(
        ProfessionalAssessment.org_id == org_id
    )
    if customer_id:
        q = q.filter(ProfessionalAssessment.customer_id == customer_id)
    if professional_service_type:
        q = q.filter(ProfessionalAssessment.professional_service_type == professional_service_type)
    if status:
        q = q.filter(ProfessionalAssessment.status == status)
    if risk_rating:
        q = q.filter(ProfessionalAssessment.overall_risk_rating == risk_rating)
    if assigned_to:
        q = q.filter(ProfessionalAssessment.assigned_to == assigned_to)
    q = q.order_by(ProfessionalAssessment.created_at.desc())
    return [_pa_dict(pa) for pa in pagination.apply(q).all()]


@router.get("/dashboard")
def assessment_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    """Summary counts for the professional assessments dashboard."""
    org_id = org_id_for(current_user)
    q = db.query(ProfessionalAssessment).filter(ProfessionalAssessment.org_id == org_id)

    total = q.count()
    by_status = {s.value: q.filter(ProfessionalAssessment.status == s).count() for s in AssessmentStatus}
    by_type = {t.value: q.filter(ProfessionalAssessment.professional_service_type == t).count() for t in ProfessionalServiceType}
    by_risk = {r.value: q.filter(ProfessionalAssessment.overall_risk_rating == r).count() for r in AssessmentRiskRating}
    escalated = q.filter(ProfessionalAssessment.is_escalated == True).count()

    return {
        "total": total,
        "escalated": escalated,
        "by_status": by_status,
        "by_type": by_type,
        "by_risk_rating": by_risk,
        "disclaimer": DISCLAIMER,
    }


@router.get("/{assessment_id}")
def get_assessment(
    assessment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    """Full assessment detail including all completed sections."""
    pa = _get_or_404(assessment_id, org_id_for(current_user), db)
    return _pa_dict(pa, include_sections=True)


@router.patch("/{assessment_id}")
def update_assessment(
    assessment_id: str,
    payload: AssessmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """Update top-level assessment fields (description, assignment, risk rating, summary)."""
    pa = _get_or_404(assessment_id, org_id_for(current_user), db)
    if pa.status == AssessmentStatus.completed:
        raise HTTPException(409, "Completed assessments cannot be modified.")

    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(pa, k, v)
    db.commit()
    db.refresh(pa)
    return _pa_dict(pa)


@router.post("/{assessment_id}/complete")
def complete_assessment(
    assessment_id: str,
    risk_rating: AssessmentRiskRating,
    risk_summary: str = "",
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """
    Mark assessment as completed with a final risk rating and summary.
    Suggest an auto-computed risk rating is available via GET /recommendations.
    """
    pa = _get_or_404(assessment_id, org_id_for(current_user), db)
    if pa.status == AssessmentStatus.completed:
        raise HTTPException(409, "Assessment is already completed.")

    pa.status = AssessmentStatus.completed
    pa.overall_risk_rating = risk_rating
    pa.risk_summary = risk_summary
    pa.completed_by = current_user.id
    pa.completed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(pa)
    return _pa_dict(pa, include_sections=True)


@router.post("/{assessment_id}/escalate")
def escalate_assessment(
    assessment_id: str,
    payload: EscalateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """Escalate to a compliance officer or MLRO for review."""
    pa = _get_or_404(assessment_id, org_id_for(current_user), db)
    pa.is_escalated = True
    pa.escalated_to = payload.escalated_to
    pa.escalated_at = datetime.now(timezone.utc)
    pa.escalation_reason = payload.escalation_reason
    pa.status = AssessmentStatus.escalated
    db.commit()
    db.refresh(pa)
    return _pa_dict(pa)


# ── SOF Section ───────────────────────────────────────────────────────────────

@router.put("/{assessment_id}/sof")
def upsert_sof(
    assessment_id: str,
    payload: SOFUpsert,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """
    Create or update the Source of Funds section.

    Evidence lifecycle:
      evidence_uploaded  → evidence_reviewed  → evidence_sufficient
      If not sufficient: additional_info_required = True
    """
    pa = _get_or_404(assessment_id, org_id_for(current_user), db)
    now = datetime.now(timezone.utc)

    if pa.sof_assessment:
        sof = pa.sof_assessment
        for k, v in payload.model_dump().items():
            setattr(sof, k, v)
    else:
        sof = SOFAssessment(
            id=f"sof_{uuid4().hex[:10]}",
            assessment_id=pa.id,
            org_id=pa.org_id,
            **payload.model_dump(),
        )
        db.add(sof)

    if payload.evidence_reviewed:
        sof.reviewer_id = current_user.id
        sof.review_date = now

    if pa.status == AssessmentStatus.draft:
        pa.status = AssessmentStatus.in_progress

    db.commit()
    db.refresh(pa)
    return _sof_dict(pa.sof_assessment)


@router.get("/{assessment_id}/sof")
def get_sof(
    assessment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    pa = _get_or_404(assessment_id, org_id_for(current_user), db)
    if not pa.sof_assessment:
        raise HTTPException(404, "SOF assessment not yet completed for this assessment.")
    return _sof_dict(pa.sof_assessment)


# ── SOW Section ───────────────────────────────────────────────────────────────

@router.put("/{assessment_id}/sow")
def upsert_sow(
    assessment_id: str,
    payload: SOWUpsert,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """
    Create or update the Source of Wealth section.

    Required for PEP customers, high/critical risk customers,
    and any matter involving significant wealth transfers.
    """
    pa = _get_or_404(assessment_id, org_id_for(current_user), db)
    now = datetime.now(timezone.utc)

    if pa.sow_assessment:
        sow = pa.sow_assessment
        for k, v in payload.model_dump().items():
            setattr(sow, k, v)
    else:
        sow = SOWAssessment(
            id=f"sow_{uuid4().hex[:10]}",
            assessment_id=pa.id,
            org_id=pa.org_id,
            **payload.model_dump(),
        )
        db.add(sow)

    if payload.evidence_reviewed:
        sow.reviewer_id = current_user.id
        sow.review_date = now

    if pa.status == AssessmentStatus.draft:
        pa.status = AssessmentStatus.in_progress

    db.commit()
    db.refresh(pa)
    return _sow_dict(pa.sow_assessment)


@router.get("/{assessment_id}/sow")
def get_sow(
    assessment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    pa = _get_or_404(assessment_id, org_id_for(current_user), db)
    if not pa.sow_assessment:
        raise HTTPException(404, "SOW assessment not yet completed for this assessment.")
    return _sow_dict(pa.sow_assessment)


# ── Purpose of Transaction Section ────────────────────────────────────────────

@router.put("/{assessment_id}/purpose")
def upsert_purpose(
    assessment_id: str,
    payload: PurposeUpsert,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """Create or update the economic purpose of transaction assessment."""
    pa = _get_or_404(assessment_id, org_id_for(current_user), db)
    now = datetime.now(timezone.utc)

    if pa.purpose_assessment:
        p = pa.purpose_assessment
        for k, v in payload.model_dump().items():
            setattr(p, k, v)
    else:
        p = TransactionPurposeAssessment(
            id=f"tpa_{uuid4().hex[:10]}",
            assessment_id=pa.id,
            org_id=pa.org_id,
            **payload.model_dump(),
        )
        db.add(p)

    if payload.purpose_verified:
        p.reviewer_id = current_user.id
        p.review_date = now

    if pa.status == AssessmentStatus.draft:
        pa.status = AssessmentStatus.in_progress

    db.commit()
    db.refresh(pa)
    return _purpose_dict(pa.purpose_assessment)


@router.get("/{assessment_id}/purpose")
def get_purpose(
    assessment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    pa = _get_or_404(assessment_id, org_id_for(current_user), db)
    if not pa.purpose_assessment:
        raise HTTPException(404, "Purpose assessment not yet completed.")
    return _purpose_dict(pa.purpose_assessment)


# ── Tax Risk Indicators Section ───────────────────────────────────────────────

@router.put("/{assessment_id}/tax-risk")
def upsert_tax_risk(
    assessment_id: str,
    payload: TaxRiskUpsert,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """
    Create or update the tax evasion risk indicator assessment.

    DISCLAIMER: This section identifies risk indicators only.
    The platform does not determine tax evasion or provide tax advice.
    """
    pa = _get_or_404(assessment_id, org_id_for(current_user), db)
    now = datetime.now(timezone.utc)

    data = payload.model_dump()

    # Compute indicator count
    standard_indicators = [
        data["indicator_unexplained_cash"],
        data["indicator_complex_ownership"],
        data["indicator_offshore_no_purpose"],
        data["indicator_income_inconsistency"],
        data["indicator_related_party_movements"],
        data["indicator_unusual_trust"],
        data["indicator_unexplained_wealth"],
        data["indicator_artificial_structuring"],
        data["indicator_lack_documentation"],
        data["indicator_reluctance_records"],
    ]
    custom_count = sum(1 for c in (data.get("custom_indicators") or []) if c.get("present"))
    indicator_count = sum(1 for v in standard_indicators if v) + custom_count

    if pa.tax_risk_assessment:
        t = pa.tax_risk_assessment
        for k, v in data.items():
            setattr(t, k, v)
        t.indicator_count = indicator_count
        t.reviewer_id = current_user.id
        t.review_date = now
    else:
        t = TaxRiskAssessment(
            id=f"tra_{uuid4().hex[:10]}",
            assessment_id=pa.id,
            org_id=pa.org_id,
            indicator_count=indicator_count,
            reviewer_id=current_user.id,
            review_date=now,
            **data,
        )
        db.add(t)

    if pa.status == AssessmentStatus.draft:
        pa.status = AssessmentStatus.in_progress

    db.commit()
    db.refresh(pa)
    return _tax_dict(pa.tax_risk_assessment)


@router.get("/{assessment_id}/tax-risk")
def get_tax_risk(
    assessment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    pa = _get_or_404(assessment_id, org_id_for(current_user), db)
    if not pa.tax_risk_assessment:
        raise HTTPException(404, "Tax risk assessment not yet completed.")
    return _tax_dict(pa.tax_risk_assessment)


# ── Investment Legitimacy Section ─────────────────────────────────────────────

@router.put("/{assessment_id}/investment")
def upsert_investment(
    assessment_id: str,
    payload: InvestmentUpsert,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """
    Create or update the investment legitimacy documentation review.

    DISCLAIMER: This section documents a review process only.
    The platform does not provide investment advice.
    """
    pa = _get_or_404(assessment_id, org_id_for(current_user), db)
    now = datetime.now(timezone.utc)

    if pa.investment_assessment:
        i = pa.investment_assessment
        for k, v in payload.model_dump().items():
            setattr(i, k, v)
        i.reviewer_id = current_user.id
        i.review_date = now
    else:
        i = InvestmentLegitimacyAssessment(
            id=f"ila_{uuid4().hex[:10]}",
            assessment_id=pa.id,
            org_id=pa.org_id,
            reviewer_id=current_user.id,
            review_date=now,
            **payload.model_dump(),
        )
        db.add(i)

    if pa.status == AssessmentStatus.draft:
        pa.status = AssessmentStatus.in_progress

    db.commit()
    db.refresh(pa)
    return _inv_dict(pa.investment_assessment)


@router.get("/{assessment_id}/investment")
def get_investment(
    assessment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    pa = _get_or_404(assessment_id, org_id_for(current_user), db)
    if not pa.investment_assessment:
        raise HTTPException(404, "Investment assessment not yet completed.")
    return _inv_dict(pa.investment_assessment)


# ── Professional Judgment Checklist ───────────────────────────────────────────

@router.get("/{assessment_id}/checklist")
def get_checklist(
    assessment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    """
    Return the checklist for this assessment.
    If not yet initialised, returns the default template for the professional service type.
    """
    pa = _get_or_404(assessment_id, org_id_for(current_user), db)

    if pa.checklist:
        return _checklist_dict(pa.checklist)

    # Return default template (not yet persisted)
    ctype = pa.professional_service_type.value
    template_items = _get_checklist_template(pa.org_id, ctype, db)
    return {
        "id": None,
        "checklist_type": ctype,
        "items": [
            {"key": it["key"], "label": it["label"], "checked": False,
             "checked_by": None, "checked_at": None, "notes": None}
            for it in template_items
        ],
        "total_items": len(template_items),
        "checked_items": 0,
        "is_complete": False,
        "completed_by": None,
        "completed_at": None,
        "note": "Checklist not yet initialised. Submit answers via PUT to create it.",
        "disclaimer": ORG_CHECKLIST_DISCLAIMER,
    }


@router.put("/{assessment_id}/checklist")
def submit_checklist(
    assessment_id: str,
    payload: ChecklistSubmit,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """
    Submit or update checklist item answers.

    Each item in the request is matched by key and updated with the
    checked state. Items not in the request retain their previous state.

    DISCLAIMER: Completing a checklist does not constitute a compliance
    determination. All decisions remain with the reporting entity.
    """
    pa = _get_or_404(assessment_id, org_id_for(current_user), db)
    now = datetime.now(timezone.utc)
    ctype = pa.professional_service_type.value
    template_items = _get_checklist_template(pa.org_id, ctype, db)

    update_map = {item.key: item for item in payload.items}

    if pa.checklist:
        c = pa.checklist
        existing = {it["key"]: it for it in (c.items or [])}
        # Merge updates into existing
        for it in template_items:
            key = it["key"]
            if key not in existing:
                existing[key] = {"key": key, "label": it["label"],
                                  "checked": False, "checked_by": None,
                                  "checked_at": None, "notes": None}
            if key in update_map:
                upd = update_map[key]
                existing[key]["checked"] = upd.checked
                existing[key]["notes"] = upd.notes
                if upd.checked:
                    existing[key]["checked_by"] = current_user.id
                    existing[key]["checked_at"] = now.isoformat()
        c.items = list(existing.values())
    else:
        # Build full item list from template + submitted answers
        items_list = []
        for it in template_items:
            key = it["key"]
            upd = update_map.get(key)
            items_list.append({
                "key": key,
                "label": it["label"],
                "checked": upd.checked if upd else False,
                "checked_by": current_user.id if (upd and upd.checked) else None,
                "checked_at": now.isoformat() if (upd and upd.checked) else None,
                "notes": upd.notes if upd else None,
            })
        c = ProfessionalJudgmentChecklist(
            id=f"pjc_{uuid4().hex[:10]}",
            assessment_id=pa.id,
            org_id=pa.org_id,
            checklist_type=ctype,
            items=items_list,
        )
        db.add(c)
        pa.checklist = c

    # Recompute completion stats
    all_items = c.items or []
    c.total_items = len(all_items)
    c.checked_items = sum(1 for it in all_items if it.get("checked"))
    c.is_complete = c.total_items > 0 and c.checked_items == c.total_items
    if c.is_complete and not c.completed_at:
        c.completed_by = current_user.id
        c.completed_at = now

    if pa.status == AssessmentStatus.draft:
        pa.status = AssessmentStatus.in_progress

    db.commit()
    db.refresh(pa)
    return _checklist_dict(pa.checklist)


# ── Compliance Assistant Recommendations ──────────────────────────────────────

@router.get("/{assessment_id}/recommendations")
def get_recommendations(
    assessment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    """
    Generate compliance assistant recommendations based on:
      - Completed assessment sections and their outcomes
      - Customer risk profile (PEP status, risk level)
      - Linked transaction signals (if any)

    Also returns a suggested overall_risk_rating derived from completed sections.

    DISCLAIMER: Recommendations are compliance workflow guidance only.
    The platform does not make compliance decisions. All decisions remain
    with the reporting entity.
    """
    pa = _get_or_404(assessment_id, org_id_for(current_user), db)

    customer = db.query(Customer).filter(Customer.id == pa.customer_id).first()
    transaction = None
    if pa.transaction_id:
        transaction = db.query(Transaction).filter(
            Transaction.id == pa.transaction_id
        ).first()

    recs = generate_assessment_recommendations(pa, customer, transaction)
    suggested_rating = compute_assessment_risk_rating(pa)

    return {
        "assessment_id": assessment_id,
        "assessment_ref": pa.assessment_ref,
        "suggested_risk_rating": suggested_rating,
        "recommendation_count": len(recs),
        "recommendations": [
            {
                "action": r.action,
                "rationale": r.rationale,
                "priority": r.priority,
                "category": r.category,
                "regulatory_basis": r.regulatory_basis,
            }
            for r in recs
        ],
        "disclaimer": DISCLAIMER,
    }


# ── Org Checklist Template Management ────────────────────────────────────────

@router.get("/templates/checklists")
def list_checklist_templates(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """
    Return all checklist templates for this org.
    Falls back to DEFAULT_CHECKLISTS for types without a custom template.
    """
    org_id = org_id_for(current_user)
    custom = {
        t.checklist_type: t
        for t in db.query(OrgProfessionalChecklistTemplate).filter(
            OrgProfessionalChecklistTemplate.org_id == org_id
        ).all()
    }
    result = {}
    for ctype in ChecklistType:
        if ctype == ChecklistType.custom:
            continue
        cval = ctype.value
        if ctype in custom:
            result[cval] = {"source": "custom", "items": custom[ctype].items}
        else:
            result[cval] = {"source": "default", "items": DEFAULT_CHECKLISTS.get(cval, [])}
    return {"templates": result, "disclaimer": ORG_CHECKLIST_DISCLAIMER}


@router.put("/templates/checklists/{checklist_type}")
def upsert_checklist_template(
    checklist_type: ChecklistType,
    payload: ChecklistTemplateUpsert,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    """
    Create or replace a customised checklist template for a professional service type.

    Each item must have: key (unique identifier), label (display text).
    Optional: is_required (default true).

    This template is used for all new assessments of this type.
    Existing completed checklists are not affected.
    """
    org_id = org_id_for(current_user)
    existing = db.query(OrgProfessionalChecklistTemplate).filter(
        OrgProfessionalChecklistTemplate.org_id == org_id,
        OrgProfessionalChecklistTemplate.checklist_type == checklist_type,
    ).first()

    if existing:
        existing.items = payload.items
        existing.updated_by = current_user.id
    else:
        existing = OrgProfessionalChecklistTemplate(
            id=f"oct_{uuid4().hex[:10]}",
            org_id=org_id,
            checklist_type=checklist_type,
            items=payload.items,
            updated_by=current_user.id,
        )
        db.add(existing)

    db.commit()
    return {
        "checklist_type": checklist_type.value,
        "item_count": len(payload.items),
        "items": payload.items,
        "disclaimer": ORG_CHECKLIST_DISCLAIMER,
    }
