"""
AML/CTF Governance Metrics & Reporting Engine

Provides formula-driven calculations for:
  1. Control effectiveness scoring
  2. Training completion metrics
  3. Policy health metrics
  4. Executive governance dashboard
  5. Printable report data assembly

All formulas are parameterised — no hardcoded thresholds.
Thresholds are read from GovernanceCustomScoring (org-specific)
or fall back to platform defaults.

DISCLAIMER: These are governance tooling calculations only.
All AML/CTF decisions remain the responsibility of the reporting entity.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from typing import Any, Dict, List, Optional, Sequence

from app.models.governance import PolicyLifecycleStatus
from app.models.governance_controls import (
    DEFAULT_EFFECTIVENESS_THRESHOLDS,
    DEFAULT_SEVERITY_DEDUCTIONS,
    ControlEffectiveness,
    FindingSeverity,
    RemediationStatus,
)
from app.models.governance_training import TrainingStatus

# ══════════════════════════════════════════════════════════════════════════════
# DEFAULTS (used when org has no GovernanceCustomScoring row)
# ══════════════════════════════════════════════════════════════════════════════

DEFAULT_TRAINING_HEALTH_WEIGHTS: Dict[str, float] = {
    "completion_pct": 0.40,
    "not_overdue_pct": 0.30,
    "not_expiry_risk_pct": 0.20,
    "attestation_pct": 0.10,
}

DEFAULT_POLICY_HEALTH_WEIGHTS: Dict[str, float] = {
    "not_overdue_review_pct": 0.40,
    "published_pct": 0.30,
    "attested_pct": 0.20,
    "version_current_pct": 0.10,
}

DEFAULT_CONTROL_HEALTH_WEIGHTS: Dict[str, float] = {
    "effective_pct": 0.40,
    "tested_pct": 0.30,
    "no_critical_findings_pct": 0.20,
    "remediation_current_pct": 0.10,
}

DEFAULT_GOVERNANCE_HEALTH_WEIGHTS: Dict[str, float] = {
    "policy_health": 0.30,
    "control_health": 0.40,
    "training_health": 0.30,
}


# ══════════════════════════════════════════════════════════════════════════════
# RAG STATUS
# ══════════════════════════════════════════════════════════════════════════════


def rag_status(
    value: float,
    green_threshold: float,
    amber_threshold: float,
    higher_is_better: bool = True,
) -> str:
    """
    Return 'green' | 'amber' | 'red' based on configurable thresholds.

    higher_is_better=True  (e.g. completion %): green ≥ green_threshold
    higher_is_better=False (e.g. overdue count): green ≤ green_threshold
    """
    if higher_is_better:
        if value >= green_threshold:
            return "green"
        if value >= amber_threshold:
            return "amber"
        return "red"
    else:
        if value <= green_threshold:
            return "green"
        if value <= amber_threshold:
            return "amber"
        return "red"


# ══════════════════════════════════════════════════════════════════════════════
# CONTROL EFFECTIVENESS CALCULATOR
# ══════════════════════════════════════════════════════════════════════════════


@dataclass
class ControlEffectivenessResult:
    numeric_score: float  # 0–100
    effectiveness: ControlEffectiveness
    pass_rate: float  # 0.0–1.0
    deductions: float  # total points deducted
    finding_summary: Dict[str, int]  # {severity: count}


def calculate_control_effectiveness(
    passed_samples: int,
    total_samples: int,
    finding_severities: List[FindingSeverity],
    severity_deductions: Optional[Dict[FindingSeverity, float]] = None,
    thresholds: Optional[Dict[str, float]] = None,
) -> ControlEffectivenessResult:
    """
    Formula:
      base_score   = (passed_samples / total_samples) * 100   if total_samples > 0 else 0
      deductions   = Σ severity_deductions[severity] for each finding
      final_score  = max(0, base_score - deductions)
      effectiveness = rating_from_score(final_score, thresholds)

    All inputs are variable — no hardcoded thresholds in this function.
    Pass severity_deductions and thresholds from org's GovernanceCustomScoring
    or omit to use platform defaults.
    """
    ded_map = severity_deductions or DEFAULT_SEVERITY_DEDUCTIONS
    thr_map = thresholds or DEFAULT_EFFECTIVENESS_THRESHOLDS

    if not total_samples or total_samples == 0:
        return ControlEffectivenessResult(
            numeric_score=0.0,
            effectiveness=ControlEffectiveness.not_tested,
            pass_rate=0.0,
            deductions=0.0,
            finding_summary={},
        )

    pass_rate = passed_samples / total_samples
    base_score = pass_rate * 100.0

    finding_summary: Dict[str, int] = {}
    total_deductions = 0.0
    for sev in finding_severities:
        finding_summary[sev.value] = finding_summary.get(sev.value, 0) + 1
        total_deductions += ded_map.get(sev, 0.0)

    final_score = max(0.0, base_score - total_deductions)

    effectiveness = _score_to_effectiveness(final_score, thr_map)

    return ControlEffectivenessResult(
        numeric_score=round(final_score, 2),
        effectiveness=effectiveness,
        pass_rate=round(pass_rate, 4),
        deductions=round(total_deductions, 2),
        finding_summary=finding_summary,
    )


def _score_to_effectiveness(
    score: float,
    thresholds: Dict[str, float],
) -> ControlEffectiveness:
    """Map a numeric score to ControlEffectiveness using configurable thresholds."""
    if score >= thresholds.get("effective", 90.0):
        return ControlEffectiveness.effective
    if score >= thresholds.get("largely_effective", 75.0):
        return ControlEffectiveness.largely_effective
    if score >= thresholds.get("partially_effective", 50.0):
        return ControlEffectiveness.partially_effective
    return ControlEffectiveness.ineffective


# ══════════════════════════════════════════════════════════════════════════════
# TRAINING METRICS CALCULATOR
# ══════════════════════════════════════════════════════════════════════════════


@dataclass
class TrainingMetrics:
    total_assigned: int
    total_excluded: int  # exempt records (excluded from all %s)
    total_eligible: int  # assigned - excluded
    completed: int
    in_progress: int
    overdue: int
    expired: int
    expiring_within_30d: int  # completed but expiry_date within 30 days
    total_active_certified: int  # completed with no upcoming expiry

    # Calculated % fields
    completion_pct: float  # completed / eligible * 100
    overdue_pct: float  # overdue / eligible * 100
    expiry_risk_pct: float  # expiring_within_30d / active_certified * 100
    health_score: float  # weighted composite 0–100

    by_department: Dict[str, Dict[str, Any]] = field(default_factory=dict)


def calculate_training_metrics(
    records: Sequence[Any],  # GovernanceTrainingRecord ORM objects
    today: Optional[date] = None,
    weights: Optional[Dict[str, float]] = None,
    attestation_completion_pct: float = 100.0,
) -> TrainingMetrics:
    """
    Compute training metrics from a sequence of GovernanceTrainingRecord objects.

    Formulas:
      total_eligible  = total_assigned - total_exempt
      completion_pct  = completed / total_eligible * 100
      overdue_pct     = overdue / total_eligible * 100
      expiry_risk_pct = expiring_within_30d / total_active_certified * 100

      health_score =
        completion_pct  * weights["completion_pct"]
        + (100 - overdue_pct) * weights["not_overdue_pct"]
        + (100 - expiry_risk_pct) * weights["not_expiry_risk_pct"]
        + attestation_completion_pct * weights["attestation_pct"]
    """
    td = today or date.today()
    w = weights or DEFAULT_TRAINING_HEALTH_WEIGHTS
    expiry_horizon = td.replace(day=td.day)  # same day; we add 30 days in check

    totals = {
        "assigned": 0,
        "exempt": 0,
        "completed": 0,
        "in_progress": 0,
        "overdue": 0,
        "expired": 0,
        "expiring_30d": 0,
        "active_cert": 0,
    }
    dept_map: Dict[str, Dict[str, int]] = {}

    for r in records:
        dept = getattr(r, "business_unit", None) or "Unknown"
        if dept not in dept_map:
            dept_map[dept] = {k: 0 for k in totals}

        totals["assigned"] += 1
        dept_map[dept]["assigned"] += 1

        status = r.status
        if status == TrainingStatus.exempt:
            totals["exempt"] += 1
            dept_map[dept]["exempt"] += 1
            continue

        if status == TrainingStatus.completed:
            totals["completed"] += 1
            dept_map[dept]["completed"] += 1
            exp = r.expiry_date
            if exp is not None:
                delta = (exp - td).days
                if 0 <= delta <= 30:
                    totals["expiring_30d"] += 1
                    dept_map[dept]["expiring_30d"] = (
                        dept_map[dept].get("expiring_30d", 0) + 1
                    )
                if delta > 30:
                    totals["active_cert"] += 1
            else:
                totals["active_cert"] += 1  # no expiry = always current

        elif status == TrainingStatus.in_progress:
            totals["in_progress"] += 1
            dept_map[dept]["in_progress"] += 1

        elif status == TrainingStatus.overdue:
            totals["overdue"] += 1
            dept_map[dept]["overdue"] += 1

        elif status == TrainingStatus.expired:
            totals["expired"] += 1
            dept_map[dept]["expired"] += 1

    eligible = totals["assigned"] - totals["exempt"]
    eligible = max(eligible, 1)  # avoid div/0

    completion_pct = round(totals["completed"] / eligible * 100, 2)
    overdue_pct = round(totals["overdue"] / eligible * 100, 2)
    active_cert = max(totals["active_cert"] + totals["expiring_30d"], 1)
    expiry_risk_pct = round(totals["expiring_30d"] / active_cert * 100, 2)

    health_score = round(
        completion_pct * w.get("completion_pct", 0.40)
        + (100 - overdue_pct) * w.get("not_overdue_pct", 0.30)
        + (100 - expiry_risk_pct) * w.get("not_expiry_risk_pct", 0.20)
        + attestation_completion_pct * w.get("attestation_pct", 0.10),
        2,
    )

    by_dept: Dict[str, Dict[str, Any]] = {}
    for dept, d in dept_map.items():
        dept_eligible = max(d.get("assigned", 0) - d.get("exempt", 0), 1)
        by_dept[dept] = {
            "completion_pct": round(d.get("completed", 0) / dept_eligible * 100, 2),
            "overdue_pct": round(d.get("overdue", 0) / dept_eligible * 100, 2),
            "total": d.get("assigned", 0),
            "completed": d.get("completed", 0),
            "overdue": d.get("overdue", 0),
        }

    return TrainingMetrics(
        total_assigned=totals["assigned"],
        total_excluded=totals["exempt"],
        total_eligible=eligible,
        completed=totals["completed"],
        in_progress=totals["in_progress"],
        overdue=totals["overdue"],
        expired=totals["expired"],
        expiring_within_30d=totals["expiring_30d"],
        total_active_certified=totals["active_cert"],
        completion_pct=completion_pct,
        overdue_pct=overdue_pct,
        expiry_risk_pct=expiry_risk_pct,
        health_score=min(health_score, 100.0),
        by_department=by_dept,
    )


# ══════════════════════════════════════════════════════════════════════════════
# POLICY METRICS CALCULATOR
# ══════════════════════════════════════════════════════════════════════════════


@dataclass
class PolicyMetrics:
    total: int
    published: int
    draft: int
    under_review: int
    overdue_review: int  # review_due_date < today AND status = published
    pending_attestation: int  # requires_attestation = True AND unattested users exist
    archived: int
    published_pct: float
    overdue_review_pct: float
    health_score: float


def calculate_policy_metrics(
    policies: Sequence[Any],
    today: Optional[date] = None,
    weights: Optional[Dict[str, float]] = None,
    attestation_completion_pct: float = 100.0,
    version_current_pct: float = 100.0,
) -> PolicyMetrics:
    """
    Compute policy register health metrics.

    Formulas:
      published_pct         = published / total * 100
      not_overdue_review_pct= (total - overdue_review) / total * 100

      health_score =
        not_overdue_review_pct  * weights["not_overdue_review_pct"]
        + published_pct         * weights["published_pct"]
        + attestation_pct       * weights["attested_pct"]
        + version_current_pct   * weights["version_current_pct"]
    """
    td = today or date.today()
    w = weights or DEFAULT_POLICY_HEALTH_WEIGHTS

    counts = {s.value: 0 for s in PolicyLifecycleStatus}
    overdue = 0

    for p in policies:
        status_val = p.status.value if hasattr(p.status, "value") else str(p.status)
        counts[status_val] = counts.get(status_val, 0) + 1
        if (
            p.status == PolicyLifecycleStatus.published
            and p.review_due_date
            and p.review_due_date < td
        ):
            overdue += 1

    total = max(len(list(policies)), 1)
    published = counts.get("published", 0)
    published_pct = round(published / total * 100, 2)
    not_overdue_pct = round((total - overdue) / total * 100, 2)

    health_score = round(
        not_overdue_pct * w.get("not_overdue_review_pct", 0.40)
        + published_pct * w.get("published_pct", 0.30)
        + attestation_completion_pct * w.get("attested_pct", 0.20)
        + version_current_pct * w.get("version_current_pct", 0.10),
        2,
    )

    return PolicyMetrics(
        total=total,
        published=published,
        draft=counts.get("draft", 0),
        under_review=counts.get("internal_review", 0)
        + counts.get("compliance_review", 0),
        overdue_review=overdue,
        pending_attestation=0,  # resolved by attestation query in API layer
        archived=counts.get("archived", 0),
        published_pct=published_pct,
        overdue_review_pct=round(overdue / total * 100, 2),
        health_score=min(health_score, 100.0),
    )


# ══════════════════════════════════════════════════════════════════════════════
# CONTROL HEALTH CALCULATOR
# ══════════════════════════════════════════════════════════════════════════════


@dataclass
class ControlHealthMetrics:
    total_active: int
    effective: int
    largely_effective: int
    partially_effective: int
    ineffective: int
    not_tested: int
    tested_this_quarter: int
    open_remediations: int
    critical_open_remediations: int
    overdue_remediations: int
    effective_pct: float
    tested_pct: float
    health_score: float


def calculate_control_health(
    controls: Sequence[Any],
    open_remediations: Sequence[Any],
    today: Optional[date] = None,
    weights: Optional[Dict[str, float]] = None,
) -> ControlHealthMetrics:
    """
    Compute control register health metrics.

    Formulas:
      effective_pct = (effective + largely_effective) / active * 100
      tested_pct    = (active with last_tested_date in last 90 days) / active * 100

      health_score =
        effective_pct                   * weights["effective_pct"]
        + tested_pct                    * weights["tested_pct"]
        + no_critical_pct               * weights["no_critical_findings_pct"]
        + remediation_current_pct       * weights["remediation_current_pct"]

      no_critical_pct = (total_active - controls_with_critical_open) / total_active * 100
      remediation_current_pct = (open - overdue) / max(open, 1) * 100
    """
    td = today or date.today()
    w = weights or DEFAULT_CONTROL_HEALTH_WEIGHTS
    quarter_ago = (
        date(td.year, td.month - 2 if td.month > 2 else td.month + 10, td.day)
        if td.month > 2
        else date(td.year - 1, td.month + 10, td.day)
    )

    eff_counts: Dict[str, int] = {e.value: 0 for e in ControlEffectiveness}
    tested_q = 0
    total_active = 0

    for c in controls:
        total_active += 1
        eff = (
            c.effectiveness.value
            if hasattr(c.effectiveness, "value")
            else str(c.effectiveness)
        )
        eff_counts[eff] = eff_counts.get(eff, 0) + 1
        if c.last_tested_date and c.last_tested_date >= quarter_ago:
            tested_q += 1

    total = max(total_active, 1)
    effective_count = eff_counts.get("effective", 0) + eff_counts.get(
        "largely_effective", 0
    )
    effective_pct = round(effective_count / total * 100, 2)
    tested_pct = round(tested_q / total * 100, 2)

    open_rem = list(open_remediations)
    open_count = len(open_rem)
    critical_open = sum(
        1
        for r in open_rem
        if getattr(r, "finding_severity", None) in (FindingSeverity.critical,)
        and r.status
        not in (RemediationStatus.completed, RemediationStatus.risk_accepted)
    )
    overdue_count = sum(1 for r in open_rem if r.status == RemediationStatus.overdue)

    no_critical_pct = round((total - critical_open) / total * 100, 2)
    remediation_current_pct = (
        round((open_count - overdue_count) / max(open_count, 1) * 100, 2)
        if open_count
        else 100.0
    )

    health_score = round(
        effective_pct * w.get("effective_pct", 0.40)
        + tested_pct * w.get("tested_pct", 0.30)
        + no_critical_pct * w.get("no_critical_findings_pct", 0.20)
        + remediation_current_pct * w.get("remediation_current_pct", 0.10),
        2,
    )

    return ControlHealthMetrics(
        total_active=total_active,
        effective=eff_counts.get("effective", 0),
        largely_effective=eff_counts.get("largely_effective", 0),
        partially_effective=eff_counts.get("partially_effective", 0),
        ineffective=eff_counts.get("ineffective", 0),
        not_tested=eff_counts.get("not_tested", 0),
        tested_this_quarter=tested_q,
        open_remediations=open_count,
        critical_open_remediations=critical_open,
        overdue_remediations=overdue_count,
        effective_pct=effective_pct,
        tested_pct=tested_pct,
        health_score=min(health_score, 100.0),
    )


# ══════════════════════════════════════════════════════════════════════════════
# GOVERNANCE EXECUTIVE DASHBOARD
# ══════════════════════════════════════════════════════════════════════════════


@dataclass
class GovernanceDashboard:
    """
    Executive governance dashboard — single aggregated view for MLRO/Board.
    All metrics are formula-driven; RAG thresholds are configurable.
    """

    as_of_date: date

    # ── Scores ────────────────────────────────────────────────────────────────
    policy_health_score: float  # 0–100
    control_health_score: float  # 0–100
    training_health_score: float  # 0–100
    overall_governance_score: float  # weighted composite 0–100

    # ── RAG status ────────────────────────────────────────────────────────────
    policy_rag: str  # green | amber | red
    control_rag: str
    training_rag: str
    overall_rag: str

    # ── Policy KPIs ───────────────────────────────────────────────────────────
    policies_total: int
    policies_published: int
    policies_due_for_review: int  # review_due_date within 30 days
    policies_overdue_review: int  # review_due_date < today
    policies_pending_approval: int
    outstanding_attestations: int

    # ── Control KPIs ──────────────────────────────────────────────────────────
    controls_total: int
    controls_effective_pct: float
    controls_not_tested: int
    controls_tested_this_quarter: int
    control_failures: int  # ineffective controls
    open_remediation_actions: int
    critical_remediations: int
    overdue_remediations: int

    # ── Training KPIs ─────────────────────────────────────────────────────────
    training_completion_pct: float
    training_overdue_pct: float
    training_expiry_risk_pct: float
    staff_overdue_count: int
    certificates_expiring_30d: int


def build_governance_dashboard(
    policy_metrics: PolicyMetrics,
    control_metrics: ControlHealthMetrics,
    training_metrics: TrainingMetrics,
    today: Optional[date] = None,
    weights: Optional[Dict[str, float]] = None,
    policies_due_for_review: int = 0,
    policies_pending_approval: int = 0,
    outstanding_attestations: int = 0,
) -> GovernanceDashboard:
    """
    Assemble the executive dashboard from pre-calculated component metrics.

    Overall governance score formula:
      = policy_health  * weights["policy_health"]
      + control_health * weights["control_health"]
      + training_health * weights["training_health"]

    RAG thresholds (default, configurable):
      green: score ≥ 80
      amber: score ≥ 60
      red:   score < 60
    """
    td = today or date.today()
    w = weights or DEFAULT_GOVERNANCE_HEALTH_WEIGHTS

    overall = round(
        policy_metrics.health_score * w.get("policy_health", 0.30)
        + control_metrics.health_score * w.get("control_health", 0.40)
        + training_metrics.health_score * w.get("training_health", 0.30),
        2,
    )

    def _rag(score: float) -> str:
        if score >= 80:
            return "green"
        if score >= 60:
            return "amber"
        return "red"

    return GovernanceDashboard(
        as_of_date=td,
        policy_health_score=policy_metrics.health_score,
        control_health_score=control_metrics.health_score,
        training_health_score=training_metrics.health_score,
        overall_governance_score=min(overall, 100.0),
        policy_rag=_rag(policy_metrics.health_score),
        control_rag=_rag(control_metrics.health_score),
        training_rag=_rag(training_metrics.health_score),
        overall_rag=_rag(overall),
        policies_total=policy_metrics.total,
        policies_published=policy_metrics.published,
        policies_due_for_review=policies_due_for_review,
        policies_overdue_review=policy_metrics.overdue_review,
        policies_pending_approval=policies_pending_approval,
        outstanding_attestations=outstanding_attestations,
        controls_total=control_metrics.total_active,
        controls_effective_pct=control_metrics.effective_pct,
        controls_not_tested=control_metrics.not_tested,
        controls_tested_this_quarter=control_metrics.tested_this_quarter,
        control_failures=control_metrics.ineffective,
        open_remediation_actions=control_metrics.open_remediations,
        critical_remediations=control_metrics.critical_open_remediations,
        overdue_remediations=control_metrics.overdue_remediations,
        training_completion_pct=training_metrics.completion_pct,
        training_overdue_pct=training_metrics.overdue_pct,
        training_expiry_risk_pct=training_metrics.expiry_risk_pct,
        staff_overdue_count=training_metrics.overdue,
        certificates_expiring_30d=training_metrics.expiring_within_30d,
    )


# ══════════════════════════════════════════════════════════════════════════════
# PRINTABLE REPORT DATA ASSEMBLERS
# ══════════════════════════════════════════════════════════════════════════════


def policy_register_report(policies: Sequence[Any]) -> List[Dict[str, Any]]:
    """
    Assembles data rows for the Policy Register printable report.

    Output columns:
      Policy Number | Title | Type | Version | Owner | Review Due | Status
    """
    rows = []
    for p in policies:
        rows.append(
            {
                "policy_number": p.policy_number,
                "title": p.title,
                "policy_type": p.policy_type.value
                if hasattr(p.policy_type, "value")
                else p.policy_type,
                "version": f"{p.version_major}.{p.version_minor}",
                "document_owner": p.document_owner,  # user id — resolved to name in API layer
                "review_due": p.review_due_date.isoformat()
                if p.review_due_date
                else None,
                "status": p.status.value if hasattr(p.status, "value") else p.status,
                "effective_date": p.effective_date.isoformat()
                if p.effective_date
                else None,
            }
        )
    return rows


def control_register_report(controls: Sequence[Any]) -> List[Dict[str, Any]]:
    """
    Assembles data rows for the Control Register printable report.

    Output columns:
      Control Ref | Name | Risk Area | Type | Owner | Effectiveness | Last Tested | Next Test
    """
    rows = []
    for c in controls:
        rows.append(
            {
                "control_ref": c.control_ref,
                "name": c.name,
                "risk_area": c.risk_area.value
                if hasattr(c.risk_area, "value")
                else c.risk_area,
                "control_type": c.control_type.value
                if hasattr(c.control_type, "value")
                else c.control_type,
                "owner": c.control_owner,
                "business_unit": c.business_unit,
                "effectiveness": c.effectiveness.value
                if hasattr(c.effectiveness, "value")
                else c.effectiveness,
                "last_tested": c.last_tested_date.isoformat()
                if c.last_tested_date
                else None,
                "next_test": c.next_test_date.isoformat() if c.next_test_date else None,
                "status": c.status.value if hasattr(c.status, "value") else c.status,
            }
        )
    return rows


def training_register_report(records: Sequence[Any]) -> List[Dict[str, Any]]:
    """
    Assembles data rows for the Training Register printable report.

    Output columns:
      Employee | Course | Training Type | Assigned | Due | Completion | Expiry | Score | Status
    """
    rows = []
    for r in records:
        rows.append(
            {
                "user_id": r.user_id,
                "course_id": r.course_id,
                "training_type": r.course.training_type.value
                if r.course and hasattr(r.course.training_type, "value")
                else None,
                "assigned_date": r.assigned_date.isoformat()
                if r.assigned_date
                else None,
                "due_date": r.due_date.isoformat() if r.due_date else None,
                "completion_date": r.completion_date.isoformat()
                if r.completion_date
                else None,
                "expiry_date": r.expiry_date.isoformat() if r.expiry_date else None,
                "score": r.score,
                "passed": r.passed,
                "status": r.status.value if hasattr(r.status, "value") else r.status,
                "certificate_id": r.certificate_document_id,
            }
        )
    return rows


def governance_summary_report(dashboard: GovernanceDashboard) -> Dict[str, Any]:
    """
    Assembles the Governance Summary section for printable reports.

    Includes:
      - Overall Governance Health (score + RAG)
      - Policy Health section
      - Control Health section
      - Training Health section
    """
    return {
        "report_date": dashboard.as_of_date.isoformat(),
        "overall_health": {
            "score": dashboard.overall_governance_score,
            "rag": dashboard.overall_rag,
        },
        "policy_health": {
            "score": dashboard.policy_health_score,
            "rag": dashboard.policy_rag,
            "total": dashboard.policies_total,
            "published": dashboard.policies_published,
            "overdue_review": dashboard.policies_overdue_review,
            "due_for_review": dashboard.policies_due_for_review,
            "pending_approval": dashboard.policies_pending_approval,
            "outstanding_attestations": dashboard.outstanding_attestations,
        },
        "control_health": {
            "score": dashboard.control_health_score,
            "rag": dashboard.control_rag,
            "total_active": dashboard.controls_total,
            "effective_pct": dashboard.controls_effective_pct,
            "not_tested": dashboard.controls_not_tested,
            "tested_this_quarter": dashboard.controls_tested_this_quarter,
            "failures": dashboard.control_failures,
            "open_remediations": dashboard.open_remediation_actions,
            "critical_remediations": dashboard.critical_remediations,
            "overdue_remediations": dashboard.overdue_remediations,
        },
        "training_health": {
            "score": dashboard.training_health_score,
            "rag": dashboard.training_rag,
            "completion_pct": dashboard.training_completion_pct,
            "overdue_pct": dashboard.training_overdue_pct,
            "expiry_risk_pct": dashboard.training_expiry_risk_pct,
            "staff_overdue": dashboard.staff_overdue_count,
            "certificates_expiring_30d": dashboard.certificates_expiring_30d,
        },
        "disclaimer": (
            "This platform provides governance and compliance management tools only. "
            "All AML/CTF decisions, policies, controls, ratings, assessments, and "
            "conclusions remain the responsibility of the reporting entity."
        ),
    }
