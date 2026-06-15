"""
Governance Control Register & Testing Framework API.

Control lifecycle:
  Register → Schedule → Test → Record findings → Remediate → Re-test

Effectiveness is CALCULATED (never set manually):
  formula: base_score(passed/total × 100) − Σseverity_deductions → effectiveness tier
  This runs every time a test is finalised or a finding is added.

Three Lines of Defence:
  1L control_owner — operates the control day-to-day
  2L reviewer_id  — MLRO/compliance periodic review
  3L auditor_id   — internal/independent annual audit
"""
import logging
from datetime import date, datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import (
    Pagination, get_current_user, org_id_for,
    require_analyst_or_above, require_compliance_or_above, require_mlro_or_above,
)
from app.db.database import get_db
from app.models.audit_log import AuditLog
from app.models.governance_controls import (
    ControlEffectiveness, ControlRemediationAction, ControlStatus,
    ControlTest, ControlTestFinding, ControlEvidenceItem,
    FindingSeverity, GovernanceControl, RemediationStatus, TestResult,
    CONTROL_REF_PREFIX, DEFAULT_EFFECTIVENESS_THRESHOLDS,
    DEFAULT_REMEDIATION_SLA_DAYS, DEFAULT_SEVERITY_DEDUCTIONS,
)
from app.models.user import User
from app.schemas.governance import (
    ControlCreate, ControlResponse, ControlTestCreate, ControlTestResponse,
    ControlUpdate, FindingCreate, RemediationCreate, RemediationUpdate, RemediationResponse,
)

log = logging.getLogger("verigo.api.governance.controls")
router = APIRouter(prefix="/governance/controls", tags=["Governance — Controls"])


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_control(control_id: str, org_id: str, db: Session) -> GovernanceControl:
    c = db.query(GovernanceControl).filter(
        GovernanceControl.id == control_id,
        GovernanceControl.org_id == org_id,
    ).first()
    if not c:
        raise HTTPException(404, "Control not found")
    return c


def _get_test(test_id: str, control_id: str, db: Session) -> ControlTest:
    t = db.query(ControlTest).filter(
        ControlTest.id == test_id,
        ControlTest.control_id == control_id,
    ).first()
    if not t:
        raise HTTPException(404, "Control test not found")
    return t


def _next_control_ref(risk_area: str, org_id: str, db: Session) -> str:
    prefix = CONTROL_REF_PREFIX.get(risk_area, "CTL-GOV")
    count = db.query(GovernanceControl).filter(
        GovernanceControl.org_id == org_id,
        GovernanceControl.risk_area == risk_area,
    ).count()
    return f"{prefix}-{str(count + 1).zfill(3)}"


def _calculate_effectiveness(
    passed: int,
    total: int,
    findings: List[ControlTestFinding],
    thresholds: Optional[dict] = None,
    deductions: Optional[dict] = None,
) -> tuple[ControlEffectiveness, float]:
    """
    Formula:
      base_score = (passed / total) × 100
      deduction  = Σ DEFAULT_SEVERITY_DEDUCTIONS[finding.severity]
      final      = max(0, base_score − deduction)
      rating     = tier based on thresholds
    """
    thresh = thresholds or DEFAULT_EFFECTIVENESS_THRESHOLDS
    ded = deductions or DEFAULT_SEVERITY_DEDUCTIONS

    if total == 0:
        return ControlEffectiveness.not_tested, 0.0

    base = (passed / total) * 100.0
    deduction = sum(ded.get(f.severity.value, 0) for f in findings)
    score = max(0.0, base - deduction)

    if score >= thresh["effective"]:
        rating = ControlEffectiveness.effective
    elif score >= thresh["largely_effective"]:
        rating = ControlEffectiveness.largely_effective
    elif score >= thresh["partially_effective"]:
        rating = ControlEffectiveness.partially_effective
    else:
        rating = ControlEffectiveness.ineffective

    # Any critical finding overrides to ineffective
    if any(f.severity == FindingSeverity.critical for f in findings):
        rating = ControlEffectiveness.ineffective

    return rating, round(score, 2)


def _refresh_control_effectiveness(control: GovernanceControl, db: Session) -> None:
    """Re-calculate effectiveness from the latest finalised test."""
    latest = db.query(ControlTest).filter(
        ControlTest.control_id == control.id,
        ControlTest.is_finalised == True,
    ).order_by(ControlTest.test_date.desc()).first()

    if not latest:
        control.effectiveness = ControlEffectiveness.not_tested
        return

    findings = db.query(ControlTestFinding).filter(
        ControlTestFinding.test_id == latest.id
    ).all()
    rating, score = _calculate_effectiveness(
        latest.passed_samples or 0,
        latest.sample_size or 0,
        findings,
    )
    control.effectiveness = rating
    control.last_tested_date = latest.test_date

    # If failing, push status to remediation
    if rating == ControlEffectiveness.ineffective and control.status == ControlStatus.active:
        control.status = ControlStatus.remediation


# ── Control Register CRUD ──────────────────────────────────────────────────────

@router.post("", response_model=ControlResponse, status_code=201)
def create_control(
    payload: ControlCreate,
    current_user: User = Depends(require_compliance_or_above),
    db: Session = Depends(get_db),
):
    oid = org_id_for(current_user)
    sol = db.query(__import__("app.models.aml_solution", fromlist=["AMLSolution"]).AMLSolution).filter_by(org_id=oid).first()
    if not sol:
        raise HTTPException(404, "AML Solution not found — complete onboarding first")

    control = GovernanceControl(
        org_id=oid,
        solution_id=sol.id,
        control_ref=_next_control_ref(payload.risk_area.value, oid, db),
        name=payload.name,
        description=payload.description,
        objective=payload.objective,
        control_type=payload.control_type,
        control_type_secondary=payload.control_type_secondary,
        risk_area=payload.risk_area,
        risk_area_custom=payload.risk_area_custom,
        linked_policy_id=payload.linked_policy_id,
        control_owner=payload.control_owner,
        business_unit=payload.business_unit,
        reviewer_id=payload.reviewer_id,
        frequency=payload.frequency,
        control_method=payload.control_method,
        is_key_control=payload.is_key_control,
        evidence_required=payload.evidence_required,
        regulatory_references=payload.regulatory_references,
        test_frequency=payload.test_frequency,
        next_test_date=payload.next_test_date,
        effectiveness=ControlEffectiveness.not_tested,
        status=ControlStatus.active,
        created_by=current_user.id,
    )
    db.add(control)
    db.add(AuditLog(
        org_id=oid,
        actor_id=current_user.id,
        action="governance.control.create",
        entity_type="GovernanceControl",
        entity_id=control.id,
        detail={"ref": control.control_ref, "risk_area": payload.risk_area.value},
    ))
    db.commit()
    db.refresh(control)
    log.info("Control created: %s org=%s", control.control_ref, oid)
    return control


@router.get("", response_model=List[ControlResponse])
def list_controls(
    risk_area: Optional[str] = Query(None),
    status: Optional[ControlStatus] = Query(None),
    effectiveness: Optional[ControlEffectiveness] = Query(None),
    is_key_control: Optional[bool] = Query(None),
    due_for_test: bool = Query(False, description="next_test_date within 30 days"),
    pagination: Pagination = Depends(),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    oid = org_id_for(current_user)
    q = db.query(GovernanceControl).filter(GovernanceControl.org_id == oid)
    if risk_area:
        q = q.filter(GovernanceControl.risk_area == risk_area)
    if status:
        q = q.filter(GovernanceControl.status == status)
    if effectiveness:
        q = q.filter(GovernanceControl.effectiveness == effectiveness)
    if is_key_control is not None:
        q = q.filter(GovernanceControl.is_key_control == is_key_control)
    if due_for_test:
        from datetime import timedelta
        cutoff = date.today() + timedelta(days=30)
        q = q.filter(GovernanceControl.next_test_date <= cutoff)
    return pagination.apply(q.order_by(GovernanceControl.control_ref)).all()


@router.get("/{control_id}", response_model=ControlResponse)
def get_control(
    control_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _get_control(control_id, org_id_for(current_user), db)


@router.patch("/{control_id}", response_model=ControlResponse)
def update_control(
    control_id: str,
    payload: ControlUpdate,
    current_user: User = Depends(require_compliance_or_above),
    db: Session = Depends(get_db),
):
    control = _get_control(control_id, org_id_for(current_user), db)

    # effectiveness is never user-settable
    updates = payload.model_dump(exclude_none=True)
    updates.pop("effectiveness", None)

    for field, value in updates.items():
        setattr(control, field, value)

    db.add(AuditLog(
        org_id=control.org_id,
        actor_id=current_user.id,
        action="governance.control.update",
        entity_type="GovernanceControl",
        entity_id=control.id,
        detail={"fields": list(updates.keys())},
    ))
    db.commit()
    db.refresh(control)
    return control


# ── Control Tests ─────────────────────────────────────────────────────────────

@router.post("/{control_id}/tests", response_model=ControlTestResponse, status_code=201)
def create_test(
    control_id: str,
    payload: ControlTestCreate,
    current_user: User = Depends(require_compliance_or_above),
    db: Session = Depends(get_db),
):
    control = _get_control(control_id, org_id_for(current_user), db)

    if payload.passed_samples + payload.failed_samples > payload.sample_size:
        raise HTTPException(422, "passed_samples + failed_samples cannot exceed sample_size")

    test = ControlTest(
        control_id=control.id,
        org_id=control.org_id,
        tester_id=current_user.id,
        test_date=payload.test_date,
        test_period_start=payload.test_period_start,
        test_period_end=payload.test_period_end,
        test_method=payload.test_method,
        population_size=payload.population_size,
        sample_size=payload.sample_size,
        passed_samples=payload.passed_samples,
        failed_samples=payload.failed_samples,
        exceptions_noted=payload.exceptions_noted,
        sampling_method=payload.sampling_method,
        result=payload.result,
        test_approach=payload.test_approach,
        findings_summary=payload.findings_summary,
        evidence_document_ids=payload.evidence_document_ids,
        retest_required=payload.retest_required,
        retest_date=payload.retest_date,
        is_finalised=False,
    )
    db.add(test)
    db.commit()
    db.refresh(test)
    return test


@router.get("/{control_id}/tests", response_model=List[ControlTestResponse])
def list_tests(
    control_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _get_control(control_id, org_id_for(current_user), db)
    return db.query(ControlTest).filter(
        ControlTest.control_id == control_id
    ).order_by(ControlTest.test_date.desc()).all()


@router.get("/{control_id}/tests/{test_id}", response_model=ControlTestResponse)
def get_test(
    control_id: str,
    test_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _get_control(control_id, org_id_for(current_user), db)
    return _get_test(test_id, control_id, db)


@router.post("/{control_id}/tests/{test_id}/finalise", response_model=ControlTestResponse)
def finalise_test(
    control_id: str,
    test_id: str,
    current_user: User = Depends(require_compliance_or_above),
    db: Session = Depends(get_db),
):
    """
    Finalise a test — locks it from edits, recalculates control effectiveness,
    updates next_test_date, auto-creates remediation SLA records for critical/high findings.
    """
    control = _get_control(control_id, org_id_for(current_user), db)
    test = _get_test(test_id, control_id, db)

    if test.is_finalised:
        raise HTTPException(409, "Test already finalised")

    findings = db.query(ControlTestFinding).filter(
        ControlTestFinding.test_id == test_id
    ).all()

    rating, eff_score = _calculate_effectiveness(
        test.passed_samples or 0,
        test.sample_size or 0,
        findings,
    )

    test.calculated_effectiveness = rating
    test.effectiveness_score = eff_score
    test.action_required = rating in (ControlEffectiveness.ineffective, ControlEffectiveness.partially_effective)
    test.is_finalised = True
    test.finalised_by = current_user.id
    test.finalised_at = datetime.now(timezone.utc)

    _refresh_control_effectiveness(control, db)

    # Auto-create remediation records for critical/high findings without existing remediation
    from datetime import timedelta
    for finding in findings:
        if finding.severity in (FindingSeverity.critical, FindingSeverity.high):
            sla_days = DEFAULT_REMEDIATION_SLA_DAYS.get(finding.severity.value, 30)
            existing = db.query(ControlRemediationAction).filter(
                ControlRemediationAction.test_id == test_id,
                ControlRemediationAction.finding_id == finding.id,
            ).first()
            if not existing:
                db.add(ControlRemediationAction(
                    test_id=test_id,
                    control_id=control_id,
                    org_id=control.org_id,
                    finding_id=finding.id,
                    title=f"Remediation: {finding.title or finding.severity.value} finding",
                    description=f"Auto-created from {finding.severity.value} finding on test {test_id}",
                    owner_id=control.control_owner,
                    due_date=date.today() + timedelta(days=sla_days),
                    finding_severity=finding.severity,
                    status=RemediationStatus.open,
                    created_by=current_user.id,
                ))

    db.add(AuditLog(
        org_id=control.org_id,
        actor_id=current_user.id,
        action="governance.control.test.finalised",
        entity_type="ControlTest",
        entity_id=test_id,
        detail={"effectiveness": rating.value, "score": eff_score},
    ))
    db.commit()
    db.refresh(test)
    return test


# ── Findings ──────────────────────────────────────────────────────────────────

@router.post("/{control_id}/tests/{test_id}/findings", status_code=201)
def add_finding(
    control_id: str,
    test_id: str,
    payload: FindingCreate,
    current_user: User = Depends(require_compliance_or_above),
    db: Session = Depends(get_db),
):
    _get_control(control_id, org_id_for(current_user), db)
    test = _get_test(test_id, control_id, db)

    if test.is_finalised:
        raise HTTPException(409, "Cannot add findings to a finalised test")

    finding = ControlTestFinding(
        test_id=test_id,
        org_id=test.org_id,
        title=payload.title,
        description=payload.description,
        severity=payload.severity,
        root_cause=payload.root_cause,
        root_cause_category=payload.root_cause_category,
        potential_impact=payload.potential_impact,
        regulatory_breach=payload.regulatory_breach,
        affected_sample_count=payload.affected_sample_count,
        affected_sample_refs=payload.affected_sample_refs,
        created_by=current_user.id,
    )
    db.add(finding)
    db.commit()
    db.refresh(finding)
    return finding


@router.get("/{control_id}/tests/{test_id}/findings")
def list_findings(
    control_id: str,
    test_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _get_control(control_id, org_id_for(current_user), db)
    _get_test(test_id, control_id, db)
    return db.query(ControlTestFinding).filter(
        ControlTestFinding.test_id == test_id
    ).all()


# ── Remediations ──────────────────────────────────────────────────────────────

@router.get("/{control_id}/remediations", response_model=List[RemediationResponse])
def list_remediations(
    control_id: str,
    status: Optional[RemediationStatus] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _get_control(control_id, org_id_for(current_user), db)
    q = db.query(ControlRemediationAction).filter(
        ControlRemediationAction.control_id == control_id
    )
    if status:
        q = q.filter(ControlRemediationAction.status == status)
    return q.order_by(ControlRemediationAction.due_date).all()


@router.post("/{control_id}/remediations", response_model=RemediationResponse, status_code=201)
def create_remediation(
    control_id: str,
    payload: RemediationCreate,
    current_user: User = Depends(require_compliance_or_above),
    db: Session = Depends(get_db),
):
    control = _get_control(control_id, org_id_for(current_user), db)
    rem = ControlRemediationAction(
        control_id=control_id,
        org_id=control.org_id,
        title=payload.title,
        description=payload.description,
        owner_id=payload.owner_id,
        due_date=payload.due_date,
        finding_severity=payload.finding_severity,
        status=RemediationStatus.open,
        created_by=current_user.id,
    )
    db.add(rem)
    db.commit()
    db.refresh(rem)
    return rem


@router.patch("/{control_id}/remediations/{rem_id}", response_model=RemediationResponse)
def update_remediation(
    control_id: str,
    rem_id: str,
    payload: RemediationUpdate,
    current_user: User = Depends(require_compliance_or_above),
    db: Session = Depends(get_db),
):
    control = _get_control(control_id, org_id_for(current_user), db)
    rem = db.query(ControlRemediationAction).filter(
        ControlRemediationAction.id == rem_id,
        ControlRemediationAction.control_id == control_id,
    ).first()
    if not rem:
        raise HTTPException(404, "Remediation action not found")

    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(rem, field, value)

    # If completing, require closure notes and auto-recalculate control effectiveness
    if payload.status == RemediationStatus.completed:
        if not (payload.closure_notes or rem.closure_notes):
            raise HTTPException(422, "closure_notes required when completing remediation")
        if not payload.completed_date:
            rem.completed_date = date.today()
        _refresh_control_effectiveness(control, db)

    if payload.status == RemediationStatus.risk_accepted:
        if current_user.role.value not in ("admin", "mlro"):
            raise HTTPException(403, "Only MLRO or Admin can accept residual risk")

    db.commit()
    db.refresh(rem)
    return rem


# ── Open remediations (org-wide dashboard view) ────────────────────────────────

@router.get("/remediations/open", response_model=List[RemediationResponse])
def list_open_remediations(
    severity: Optional[FindingSeverity] = Query(None),
    overdue_only: bool = Query(False),
    pagination: Pagination = Depends(),
    current_user: User = Depends(require_compliance_or_above),
    db: Session = Depends(get_db),
):
    """All open remediation actions across all controls for this org."""
    oid = org_id_for(current_user)
    q = db.query(ControlRemediationAction).filter(
        ControlRemediationAction.org_id == oid,
        ControlRemediationAction.status.in_([RemediationStatus.open, RemediationStatus.in_progress]),
    )
    if severity:
        q = q.filter(ControlRemediationAction.finding_severity == severity)
    if overdue_only:
        q = q.filter(ControlRemediationAction.due_date < date.today())
    return pagination.apply(q.order_by(ControlRemediationAction.due_date)).all()
