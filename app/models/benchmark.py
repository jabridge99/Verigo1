"""
Analytics & Benchmarking Data Models

Architecture:
  OrgMetricsSnapshot  — periodic (weekly) snapshot of an org's compliance KPIs
  IndustryBenchmark   — computed percentile distribution per metric/industry/period
                        (min / p25 / median / p75 / max / mean across all orgs in industry)

Privacy design:
  - OrgMetricsSnapshot.org_id is stored (it's the org's own data)
  - IndustryBenchmark contains ONLY aggregated stats — no org_id, no way to
    back-calculate individual org values
  - Minimum 3 orgs required per industry before a benchmark is published
    (MIN_ORG_COUNT_FOR_BENCHMARK) — protects single-org industries

Network effect:
  Every org that joins VeriGo improves the accuracy of industry benchmarks
  for all other orgs in the same industry. This is the data moat — no
  standalone compliance tool can replicate it without the same user base.

Benchmark metric glossary:
  smr_rate_per_1k         SMRs filed per 1,000 customers in the period
  ifti_volume             Total IFTIs filed in the period
  alert_to_smr_pct        % of closed alerts that resulted in an SMR
  training_completion_pct % of mandatory training assignments completed
  high_risk_customer_pct  % of customers rated HIGH or CRITICAL
  edd_escalation_pct      % of customers on EDD (Enhanced Due Diligence)
  cdd_completion_pct      % of customers with completed CDD verification
  open_alert_pct          % of monitoring alerts still open (lower = better)
  policy_review_on_time_pct % of policy reviews completed by due date
  control_effectiveness_pct % of controls rated Effective or above
  avg_case_days           Average days to resolve a case (lower = better)
  pep_customer_pct        % of customers flagged as PEP
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
    func,
)

from app.db.database import Base

# Minimum orgs needed per industry before a benchmark is published
MIN_ORG_COUNT_FOR_BENCHMARK = 3


class SnapshotPeriod(str, enum.Enum):
    weekly = "weekly"
    monthly = "monthly"


class BenchmarkMetric(str, enum.Enum):
    smr_rate_per_1k = "smr_rate_per_1k"
    ifti_volume = "ifti_volume"
    ttr_volume = "ttr_volume"
    alert_to_smr_pct = "alert_to_smr_pct"
    training_completion_pct = "training_completion_pct"
    training_overdue_pct = "training_overdue_pct"
    high_risk_customer_pct = "high_risk_customer_pct"
    edd_escalation_pct = "edd_escalation_pct"
    cdd_completion_pct = "cdd_completion_pct"
    open_alert_pct = "open_alert_pct"
    policy_review_on_time_pct = "policy_review_on_time_pct"
    control_effectiveness_pct = "control_effectiveness_pct"
    avg_case_days = "avg_case_days"
    pep_customer_pct = "pep_customer_pct"
    sanctions_match_pct = "sanctions_match_pct"
    total_customers = "total_customers"


# Metrics where a HIGHER value is better (for percentile display)
HIGHER_IS_BETTER = {
    BenchmarkMetric.training_completion_pct,
    BenchmarkMetric.cdd_completion_pct,
    BenchmarkMetric.policy_review_on_time_pct,
    BenchmarkMetric.control_effectiveness_pct,
}

# Human-readable labels and descriptions
METRIC_META = {
    "smr_rate_per_1k": {
        "label": "SMR Rate (per 1,000 customers)",
        "unit": "per 1k",
        "higher_is_better": False,
    },
    "ifti_volume": {"label": "IFTI Volume", "unit": "count", "higher_is_better": None},
    "ttr_volume": {"label": "TTR Volume", "unit": "count", "higher_is_better": None},
    "alert_to_smr_pct": {
        "label": "Alert → SMR Conversion",
        "unit": "%",
        "higher_is_better": None,
    },
    "training_completion_pct": {
        "label": "Training Completion Rate",
        "unit": "%",
        "higher_is_better": True,
    },
    "training_overdue_pct": {
        "label": "Training Overdue Rate",
        "unit": "%",
        "higher_is_better": False,
    },
    "high_risk_customer_pct": {
        "label": "High/Critical Risk Customers",
        "unit": "%",
        "higher_is_better": False,
    },
    "edd_escalation_pct": {
        "label": "EDD Escalation Rate",
        "unit": "%",
        "higher_is_better": None,
    },
    "cdd_completion_pct": {
        "label": "CDD Completion Rate",
        "unit": "%",
        "higher_is_better": True,
    },
    "open_alert_pct": {
        "label": "Open Alert Rate",
        "unit": "%",
        "higher_is_better": False,
    },
    "policy_review_on_time_pct": {
        "label": "Policy Review On-Time Rate",
        "unit": "%",
        "higher_is_better": True,
    },
    "control_effectiveness_pct": {
        "label": "Control Effectiveness Rate",
        "unit": "%",
        "higher_is_better": True,
    },
    "avg_case_days": {
        "label": "Avg Case Resolution Time",
        "unit": "days",
        "higher_is_better": False,
    },
    "pep_customer_pct": {
        "label": "PEP Customer Rate",
        "unit": "%",
        "higher_is_better": None,
    },
    "sanctions_match_pct": {
        "label": "Sanctions Match Rate",
        "unit": "%",
        "higher_is_better": None,
    },
    "total_customers": {
        "label": "Total Customers",
        "unit": "count",
        "higher_is_better": None,
    },
}


class OrgMetricsSnapshot(Base):
    """
    Weekly/monthly snapshot of a single org's compliance KPIs.
    Each row = one org, one period.

    Captured by: POST /api/v1/benchmarks/capture-snapshot
    (called by scheduler, or manually by admin)

    Values are org-level actuals — not anonymised at storage.
    Anonymisation happens at query time in IndustryBenchmark computation.
    """

    __tablename__ = "org_metrics_snapshots"

    id = Column(String, primary_key=True, default=lambda: f"oms_{uuid4().hex[:12]}")
    org_id = Column(
        String,
        ForeignKey("organisations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    industry = Column(String(50), nullable=False, index=True)
    period = Column(Enum(SnapshotPeriod), default=SnapshotPeriod.weekly, nullable=False)
    period_label = Column(String(20), nullable=False, index=True)
    # e.g. "2026-W24" (weekly) or "2026-06" (monthly)
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)

    # ── Reporting metrics ─────────────────────────────────────────────────────
    smr_count = Column(Integer, default=0)
    ifti_count = Column(Integer, default=0)
    ttr_count = Column(Integer, default=0)
    smr_rate_per_1k = Column(Float)
    ifti_volume = Column(Float)
    ttr_volume = Column(Float)
    alert_to_smr_pct = Column(Float)

    # ── Customer risk metrics ─────────────────────────────────────────────────
    total_customers = Column(Integer, default=0)
    high_risk_customer_pct = Column(Float)
    edd_escalation_pct = Column(Float)
    cdd_completion_pct = Column(Float)
    pep_customer_pct = Column(Float)
    sanctions_match_pct = Column(Float)

    # ── Monitoring metrics ────────────────────────────────────────────────────
    total_alerts = Column(Integer, default=0)
    open_alert_pct = Column(Float)

    # ── Training metrics ──────────────────────────────────────────────────────
    training_completion_pct = Column(Float)
    training_overdue_pct = Column(Float)

    # ── Governance metrics ────────────────────────────────────────────────────
    policy_review_on_time_pct = Column(Float)
    control_effectiveness_pct = Column(Float)
    avg_case_days = Column(Float)

    # ── Raw counts for transparency ───────────────────────────────────────────
    raw_counts = Column(JSON, default=dict)

    captured_at = Column(DateTime(timezone=True), server_default=func.now())
    captured_by = Column(String, default="system")


class IndustryBenchmark(Base):
    """
    Aggregated percentile distribution per metric, per industry, per period.
    Contains NO org identifiers — purely statistical.

    Computed by: benchmark_service.compute_industry_benchmarks()

    Percentile interpretation for display:
      "Your training completion (94%) is at the 87th percentile for remittance providers"
      "Industry median: 71% | Your score: 94% | You are above 87% of peers"

    Published only if org_count >= MIN_ORG_COUNT_FOR_BENCHMARK (privacy floor).
    """

    __tablename__ = "industry_benchmarks"

    id = Column(String, primary_key=True, default=lambda: f"ib_{uuid4().hex[:12]}")
    industry = Column(String(50), nullable=False, index=True)
    metric = Column(Enum(BenchmarkMetric), nullable=False, index=True)
    period_label = Column(String(20), nullable=False, index=True)
    period_start = Column(Date, nullable=False)
    period_end = Column(Date, nullable=False)

    # ── Aggregate statistics ──────────────────────────────────────────────────
    org_count = Column(Integer, nullable=False)
    mean = Column(Float)
    std_dev = Column(Float)
    minimum = Column(Float)
    p25 = Column(Float)
    median = Column(Float)
    p75 = Column(Float)
    maximum = Column(Float)

    is_published = Column(Boolean, default=False)
    # False if org_count < MIN_ORG_COUNT_FOR_BENCHMARK

    computed_at = Column(DateTime(timezone=True), server_default=func.now())
