"""
AML/CTF Governance — Control Register & Control Testing Framework

Aligned with:
  - FATF Recommendations (R.1, R.15, R.20)
  - AUSTRAC AML/CTF Rules 2025
  - APRA CPS 230 Operational Risk Management
  - ISO 31000 Risk Management
  - Three Lines of Defence model

Architecture:
  GovernanceControl          — master control register entry
  ControlTest                — individual test execution record
  ControlTestFinding         — specific findings per test (granular)
  ControlRemediationAction   — remediation actions arising from test findings
  ControlEvidenceItem        — evidence records attached to controls / tests

DISCLAIMER: This is a governance tooling aid only. The reporting entity and its
MLRO/Board remain solely responsible for all AML/CTF control assessments and
decisions. Verigo does not provide legal or compliance advice.
"""

from __future__ import annotations

import enum
from uuid import uuid4

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    Date,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import relationship

from app.db.database import Base

# ══════════════════════════════════════════════════════════════════════════════
# ENUMS
# ══════════════════════════════════════════════════════════════════════════════


class ControlType(str, enum.Enum):
    """
    Dual-axis classification: operational purpose + automation level.
    A control may have multiple types (e.g. Automated + Detective).
    Primary type stored here; secondary type in control_type_secondary.
    """

    preventive = "preventive"  # Prevents the risk event from occurring
    detective = "detective"  # Identifies when risk event has occurred
    corrective = "corrective"  # Remedies the impact of a risk event
    compensating = "compensating"  # Substitutes for a primary control gap
    automated = "automated"  # System-executed, no manual intervention
    manual = "manual"  # Human-executed
    hybrid = "hybrid"  # Combination of automated + manual


class ControlRiskArea(str, enum.Enum):
    """
    AML/CTF risk areas covered by controls.
    Aligned to AUSTRAC obligations and FATF risk categories.
    Organisations may add custom risk areas via GovernanceCustomisation.
    """

    cdd = "cdd"
    edd = "edd"
    pep_screening = "pep_screening"
    sanctions_screening = "sanctions_screening"
    transaction_monitoring = "transaction_monitoring"
    ifti_reporting = "ifti_reporting"
    smr_reporting = "smr_reporting"
    ttr_reporting = "ttr_reporting"
    travel_rule = "travel_rule"
    record_keeping = "record_keeping"
    training = "training"
    governance = "governance"
    beneficial_ownership = "beneficial_ownership"
    outsourcing = "outsourcing"
    custom = "custom"  # value stored in risk_area_custom


class ControlFrequency(str, enum.Enum):
    continuous = "continuous"  # real-time / always-on (automated)
    daily = "daily"
    weekly = "weekly"
    monthly = "monthly"
    quarterly = "quarterly"
    semi_annual = "semi_annual"
    annual = "annual"
    ad_hoc = "ad_hoc"  # triggered by event / on-demand
    transaction = "per_transaction"  # executed on each transaction


class ControlMethod(str, enum.Enum):
    system_generated = "system_generated"  # automated system rule
    automated_alert = "automated_alert"  # alert-driven review
    dual_control = "dual_control"  # two-person authorisation
    manual_review = "manual_review"  # human review process
    management_sign_off = "management_sign_off"  # manager/MLRO approval
    reconciliation = "reconciliation"  # data reconciliation check
    sampling = "sampling"  # sample-based testing
    walkthrough = "walkthrough"  # process walkthrough
    inquiry = "inquiry"  # staff inquiry / interview
    observation = "observation"  # direct observation
    re_performance = "re_performance"  # independently re-executing
    analytical = "analytical"  # data analytics / ratio analysis


class ControlStatus(str, enum.Enum):
    active = "active"
    inactive = "inactive"  # deactivated / retired
    under_review = "under_review"  # currently being assessed
    remediation = "remediation"  # failing; remediation in progress
    suspended = "suspended"  # temporarily not operating


class ControlEffectiveness(str, enum.Enum):
    """
    Effectiveness ratings — formula-driven, never hardcoded.
    Rating is calculated by ControlEffectivenessCalculator in governance_metrics.py
    based on test results, sample sizes, and finding severity.
    """

    effective = "effective"  # ≥ 90% test pass rate, no critical findings
    largely_effective = "largely_effective"  # 75–89% pass rate, minor findings only
    partially_effective = (
        "partially_effective"  # 50–74% pass rate, or ≥1 moderate finding
    )
    ineffective = "ineffective"  # < 50% pass rate, or any critical finding
    not_tested = "not_tested"  # no completed tests on record


class TestResult(str, enum.Enum):
    pass_full = "pass"  # all samples passed
    pass_minor = "pass_with_observations"  # passed with non-critical observations
    fail_partial = "partial_fail"  # some samples failed
    fail_full = "fail"  # control failed / not operating as designed
    inconclusive = "inconclusive"  # insufficient evidence to conclude


class FindingSeverity(str, enum.Enum):
    critical = "critical"  # immediate escalation; control not operating
    high = "high"  # significant gap; remediation within 30 days
    moderate = "moderate"  # material gap; remediation within 60 days
    low = "low"  # minor observation; remediation within 90 days
    advisory = "advisory"  # best-practice recommendation; no mandatory action


class RemediationStatus(str, enum.Enum):
    open = "open"
    in_progress = "in_progress"
    completed = "completed"
    overdue = "overdue"
    risk_accepted = (
        "risk_accepted"  # MLRO/Board accepted residual risk; closed without fix
    )
    not_required = "not_required"


# ══════════════════════════════════════════════════════════════════════════════
# GOVERNANCE CONTROL (master register)
# ══════════════════════════════════════════════════════════════════════════════


class GovernanceControl(Base):
    """
    Bank-grade AML/CTF control register entry.

    Supports full control lifecycle:
      - Control design and documentation
      - Evidence requirements specification
      - Testing schedule and frequency
      - Effectiveness rating (formula-driven from ControlTest results)
      - Remediation action tracking
      - Three Lines of Defence ownership mapping
      - Custom risk areas and control categories (no-code extensible)

    Three Lines of Defence:
      1L — control_owner:  business unit operating the control day-to-day
      2L — reviewer_id:    MLRO / compliance function periodic review
      3L — auditor_id:     Internal / independent audit testing (annual)
    """

    __tablename__ = "governance_controls"

    id = Column(String, primary_key=True, default=lambda: f"gc_{uuid4().hex[:12]}")

    # ── Organisational linkage ────────────────────────────────────────────────
    org_id = Column(
        String,
        ForeignKey("organisations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    solution_id = Column(
        String,
        ForeignKey("aml_solutions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ── Identity ──────────────────────────────────────────────────────────────
    control_ref = Column(String(30), nullable=False)
    # e.g. CTL-CDD-001, CTL-TM-002; generated on creation; unique per org
    name = Column(String(255), nullable=False)
    description = Column(Text)
    objective = Column(Text)
    # what risk event this control is designed to prevent/detect/remediate

    # ── Classification ────────────────────────────────────────────────────────
    control_type = Column(Enum(ControlType), nullable=False)
    control_type_secondary = Column(Enum(ControlType))
    # dual-type: e.g. primary=detective, secondary=automated

    risk_area = Column(Enum(ControlRiskArea), nullable=False, index=True)
    risk_area_custom = Column(String(100))
    # populated when risk_area = ControlRiskArea.custom

    linked_policy_id = Column(
        String, ForeignKey("governance_policies.id"), nullable=True
    )
    # which governance policy this control gives effect to

    regulatory_references = Column(JSON, default=list)
    # e.g. ["AML/CTF Act s.84", "AML/CTF Rules 2025 r.8.1", "FATF R.10"]

    # ── Ownership (3LoD) ─────────────────────────────────────────────────────
    control_owner = Column(String, ForeignKey("users.id"), nullable=False)
    # 1L — business unit owner
    business_unit = Column(String(100))
    reviewer_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"))
    # 2L — MLRO / compliance reviewer
    auditor_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"))
    # 3L — internal audit / independent reviewer

    # ── Operating characteristics ─────────────────────────────────────────────
    frequency = Column(
        Enum(ControlFrequency), nullable=False, default=ControlFrequency.continuous
    )
    control_method = Column(Enum(ControlMethod), nullable=False)
    is_key_control = Column(Boolean, default=False)
    # key controls are tested more frequently and tracked on the exec dashboard

    # ── Evidence requirements ──────────────────────────────────────────────────
    evidence_required = Column(JSON, default=list)
    # e.g. ["System-generated transaction log", "Dual sign-off checklist", "Alert disposition record"]
    evidence_retention_years = Column(Integer, default=7)
    # AUSTRAC: minimum 7 years

    # ── Status & effectiveness ────────────────────────────────────────────────
    status = Column(
        Enum(ControlStatus), default=ControlStatus.active, nullable=False, index=True
    )
    effectiveness = Column(
        Enum(ControlEffectiveness),
        default=ControlEffectiveness.not_tested,
        nullable=False,
    )
    # CALCULATED by governance_metrics.py from test results — never set manually

    # ── Test schedule ─────────────────────────────────────────────────────────
    last_tested_date = Column(Date)
    next_test_date = Column(Date)
    test_frequency = Column(Enum(ControlFrequency))
    # may differ from operational frequency (e.g. control runs daily, tested quarterly)

    # ── Custom fields (no-code extensibility) ────────────────────────────────
    custom_fields = Column(JSON, default=dict)
    # {"field_name": value} — populated from GovernanceCustomField definitions

    # Optional link to the reusable mitigation catalogue (see mitigation_library.py)
    library_item_id = Column(
        String, ForeignKey("mitigation_library_items.id"), nullable=True, index=True
    )

    # ── Audit ─────────────────────────────────────────────────────────────────
    created_by = Column(String, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # ── Relationships ─────────────────────────────────────────────────────────
    tests = relationship(
        "ControlTest",
        back_populates="control",
        cascade="all, delete-orphan",
        order_by="ControlTest.test_date.desc()",
    )
    evidence = relationship(
        "ControlEvidenceItem", back_populates="control", cascade="all, delete-orphan"
    )
    linked_policy = relationship("Policy", foreign_keys=[linked_policy_id])


# ══════════════════════════════════════════════════════════════════════════════
# CONTROL TEST (testing framework execution record)
# ══════════════════════════════════════════════════════════════════════════════


class ControlTest(Base):
    """
    Individual control test execution record.

    Test methodologies (per control_method on the parent control):
      - Sampling: review N transactions/records for compliance
      - Walkthrough: trace one transaction end-to-end
      - Inquiry: interview control operators
      - Re-performance: independently re-execute the control
      - Analytical: compare data patterns against expected results

    Effectiveness rating is CALCULATED by governance_metrics.py:
      calculated_effectiveness = effectiveness_formula(
          pass_rate = passed_samples / total_samples,
          finding_severity_scores = [f.severity for f in findings],
          retest_count = prior_retest_count,
      )

    Formula (configurable, not hardcoded):
      Base score  = (passed_samples / total_samples) * 100
      Deductions  = sum(SEVERITY_DEDUCTIONS[f.severity] for f in critical/high findings)
      Final score = max(0, base_score - deductions)
      Rating map  = score ≥ 90 → effective | 75-89 → largely_effective |
                    50-74 → partially_effective | < 50 → ineffective
    """

    __tablename__ = "control_tests"

    id = Column(String, primary_key=True, default=lambda: f"ct_{uuid4().hex[:12]}")
    control_id = Column(
        String,
        ForeignKey("governance_controls.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    org_id = Column(
        String, ForeignKey("organisations.id", ondelete="CASCADE"), nullable=False
    )

    # ── Test execution ────────────────────────────────────────────────────────
    test_date = Column(Date, nullable=False)
    test_period_start = Column(Date)
    test_period_end = Column(Date)
    tester_id = Column(String, ForeignKey("users.id"), nullable=False)
    test_method = Column(Enum(ControlMethod))
    # may differ from control's default method if tester chose different approach

    # ── Sample ────────────────────────────────────────────────────────────────
    population_size = Column(Integer)  # total population available for testing
    sample_size = Column(Integer)  # number of items selected
    passed_samples = Column(Integer)  # items that passed
    failed_samples = Column(Integer)  # items that failed
    exceptions_noted = Column(Integer)  # exceptions (not necessarily failures)
    sampling_method = Column(String(50))  # random | judgement | statistical | haphazard

    # ── Result ────────────────────────────────────────────────────────────────
    result = Column(Enum(TestResult), nullable=False)
    calculated_effectiveness = Column(Enum(ControlEffectiveness))
    # Populated by scoring engine — NEVER set manually

    effectiveness_score = Column(Float)
    # Numeric score 0-100 from which calculated_effectiveness is derived

    # ── Narrative ─────────────────────────────────────────────────────────────
    test_approach = Column(Text)  # how the test was conducted
    findings_summary = Column(Text)  # overall findings narrative
    action_required = Column(Boolean, default=False)
    # set True if any finding requires remediation

    # ── Reviewer sign-off (2L) ────────────────────────────────────────────────
    reviewed_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"))
    reviewed_at = Column(DateTime(timezone=True))
    reviewer_comments = Column(Text)
    is_finalised = Column(Boolean, default=False)

    # ── Retest ────────────────────────────────────────────────────────────────
    retest_required = Column(Boolean, default=False)
    retest_date = Column(Date)
    retest_of_id = Column(String, ForeignKey("control_tests.id"), nullable=True)
    # links to the original test this is retesting

    # ── Attachments ──────────────────────────────────────────────────────────
    evidence_document_ids = Column(JSON, default=list)  # [document.id]

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    control = relationship("GovernanceControl", back_populates="tests")
    findings = relationship(
        "ControlTestFinding", back_populates="test", cascade="all, delete-orphan"
    )
    remediations = relationship(
        "ControlRemediationAction", back_populates="test", cascade="all, delete-orphan"
    )
    retest_of = relationship("ControlTest", foreign_keys=[retest_of_id], uselist=False)

    @property
    def pass_rate(self) -> float | None:
        """Pass rate as decimal 0.0 – 1.0. Returns None if sample_size is 0/null."""
        if not self.sample_size:
            return None
        passed = self.passed_samples or 0
        return passed / self.sample_size


# ══════════════════════════════════════════════════════════════════════════════
# CONTROL TEST FINDING (granular finding per test)
# ══════════════════════════════════════════════════════════════════════════════


class ControlTestFinding(Base):
    """
    Individual finding identified during a control test.
    One test may produce zero or many findings.

    Finding severity drives the effectiveness score deduction:
      Critical  → -50 points
      High      → -25 points
      Moderate  → -10 points
      Low       → -3  points
      Advisory  →  0  points (no deduction; recommendation only)

    Scoring deductions are configurable via GovernanceCustomisation.
    """

    __tablename__ = "control_test_findings"

    id = Column(String, primary_key=True, default=lambda: f"ctf_{uuid4().hex[:12]}")
    test_id = Column(
        String,
        ForeignKey("control_tests.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    org_id = Column(
        String, ForeignKey("organisations.id", ondelete="CASCADE"), nullable=False
    )

    # ── Finding detail ────────────────────────────────────────────────────────
    finding_ref = Column(String(20))  # e.g. F-001, F-002
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    severity = Column(Enum(FindingSeverity), nullable=False, index=True)

    # ── Root cause ────────────────────────────────────────────────────────────
    root_cause = Column(Text)
    root_cause_category = Column(String(50))
    # e.g. "people", "process", "technology", "policy_gap"

    # ── Impact ────────────────────────────────────────────────────────────────
    potential_impact = Column(Text)
    regulatory_breach = Column(Boolean, default=False)
    # flag if finding represents a potential regulatory breach

    # ── Affected samples ──────────────────────────────────────────────────────
    affected_sample_count = Column(Integer, default=0)
    affected_sample_refs = Column(JSON, default=list)
    # [str] — reference numbers of the failing sample items

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    test = relationship("ControlTest", back_populates="findings")
    remediations = relationship(
        "ControlRemediationAction",
        back_populates="finding",
        cascade="all, delete-orphan",
    )


# ══════════════════════════════════════════════════════════════════════════════
# CONTROL REMEDIATION ACTION
# ══════════════════════════════════════════════════════════════════════════════


class ControlRemediationAction(Base):
    """
    Remediation action arising from a control test finding.
    Tracked through to closure with ownership, due dates, and evidence.

    Due date SLAs by finding severity (configurable):
      Critical  → 14 calendar days
      High      → 30 calendar days
      Moderate  → 60 calendar days
      Low       → 90 calendar days
      Advisory  → no mandatory SLA

    Status computed by governance_metrics.py — never set manually:
      open       → created, owner assigned
      in_progress → owner has confirmed work started
      completed   → closure evidence uploaded, reviewer signed off
      overdue     → due_date passed with status not completed
      risk_accepted → MLRO/Board accepted residual risk
    """

    __tablename__ = "control_remediation_actions"

    id = Column(String, primary_key=True, default=lambda: f"cra_{uuid4().hex[:12]}")
    test_id = Column(
        String,
        ForeignKey("control_tests.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    finding_id = Column(String, ForeignKey("control_test_findings.id"), nullable=True)
    org_id = Column(
        String, ForeignKey("organisations.id", ondelete="CASCADE"), nullable=False
    )

    # ── Action detail ─────────────────────────────────────────────────────────
    action_ref = Column(String(20))  # e.g. REM-001
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    finding_severity = Column(Enum(FindingSeverity))
    # denormalised from finding for dashboard queries

    # ── Ownership ─────────────────────────────────────────────────────────────
    owner_id = Column(String, ForeignKey("users.id"), nullable=False)
    escalation_owner_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"))
    # escalation owner if primary owner doesn't close in time

    # ── Dates ─────────────────────────────────────────────────────────────────
    due_date = Column(Date, nullable=False)
    completed_date = Column(Date)
    extended_due_date = Column(Date)
    extension_reason = Column(Text)

    # ── Status ────────────────────────────────────────────────────────────────
    status = Column(
        Enum(RemediationStatus),
        default=RemediationStatus.open,
        nullable=False,
        index=True,
    )

    # ── Closure ───────────────────────────────────────────────────────────────
    closure_evidence = Column(JSON, default=list)  # [document.id]
    closure_notes = Column(Text)
    closed_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"))
    closed_at = Column(DateTime(timezone=True))
    risk_acceptance_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"))
    # MLRO/Board user id if risk accepted without full remediation
    risk_acceptance_note = Column(Text)

    # ── Progress tracking ─────────────────────────────────────────────────────
    progress_updates = Column(JSON, default=list)
    # [{"date": "ISO", "user_id": "...", "update": "text"}]

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    test = relationship("ControlTest", back_populates="remediations")
    finding = relationship("ControlTestFinding", back_populates="remediations")


# ══════════════════════════════════════════════════════════════════════════════
# CONTROL EVIDENCE ITEM
# ══════════════════════════════════════════════════════════════════════════════


class ControlEvidenceItem(Base):
    """
    Evidence record attached to a control (ongoing operational evidence).

    Distinct from test evidence (ControlTest.evidence_document_ids) — this
    captures continuous/scheduled evidence that the control is operating
    (e.g. monthly system reports, dual-sign-off logs, alert reports).
    """

    __tablename__ = "control_evidence_items"

    id = Column(String, primary_key=True, default=lambda: f"cei_{uuid4().hex[:12]}")
    control_id = Column(
        String,
        ForeignKey("governance_controls.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    org_id = Column(
        String, ForeignKey("organisations.id", ondelete="CASCADE"), nullable=False
    )

    title = Column(String(255), nullable=False)
    description = Column(Text)
    evidence_date = Column(Date, nullable=False)
    document_id = Column(String)  # polymorphic: Document.id
    evidence_type = Column(String(50))
    # e.g. "system_report", "sign_off_log", "alert_summary", "management_attestation"

    uploaded_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"))
    uploaded_at = Column(DateTime(timezone=True), server_default=func.now())

    control = relationship("GovernanceControl", back_populates="evidence")


# ══════════════════════════════════════════════════════════════════════════════
# SCORING CONSTANTS (configurable via GovernanceCustomisation)
# ══════════════════════════════════════════════════════════════════════════════

# Default effectiveness score deductions per finding severity
# Configurable per org via GovernanceCustomisation.scoring_config
DEFAULT_SEVERITY_DEDUCTIONS: dict[FindingSeverity, float] = {
    FindingSeverity.critical: 50.0,
    FindingSeverity.high: 25.0,
    FindingSeverity.moderate: 10.0,
    FindingSeverity.low: 3.0,
    FindingSeverity.advisory: 0.0,
}

# Default effectiveness rating thresholds (score out of 100)
# Configurable per org via GovernanceCustomisation.scoring_config
DEFAULT_EFFECTIVENESS_THRESHOLDS: dict[str, float] = {
    "effective": 90.0,
    "largely_effective": 75.0,
    "partially_effective": 50.0,
    # below 50.0 → ineffective
}

# Default remediation SLA in calendar days by severity
DEFAULT_REMEDIATION_SLA_DAYS: dict[FindingSeverity, int] = {
    FindingSeverity.critical: 14,
    FindingSeverity.high: 30,
    FindingSeverity.moderate: 60,
    FindingSeverity.low: 90,
    FindingSeverity.advisory: 180,
}

# Control reference prefix per risk area
CONTROL_REF_PREFIX: dict[ControlRiskArea, str] = {
    ControlRiskArea.cdd: "CTL-CDD",
    ControlRiskArea.edd: "CTL-EDD",
    ControlRiskArea.pep_screening: "CTL-PEP",
    ControlRiskArea.sanctions_screening: "CTL-SANC",
    ControlRiskArea.transaction_monitoring: "CTL-TM",
    ControlRiskArea.ifti_reporting: "CTL-IFTI",
    ControlRiskArea.smr_reporting: "CTL-SMR",
    ControlRiskArea.ttr_reporting: "CTL-TTR",
    ControlRiskArea.travel_rule: "CTL-TRVL",
    ControlRiskArea.record_keeping: "CTL-RK",
    ControlRiskArea.training: "CTL-TRN",
    ControlRiskArea.governance: "CTL-GOV",
    ControlRiskArea.beneficial_ownership: "CTL-UBO",
    ControlRiskArea.outsourcing: "CTL-OUT",
    ControlRiskArea.custom: "CTL-CST",
}
