"""
Analytics & Benchmarking Dashboard

Answers the question every MLRO wants answered:
  "How do we compare to other compliance teams in our industry?"

Cross-org data is anonymised — org names and IDs are never exposed in
benchmark responses. Only aggregate statistics (p25/median/p75) are shown.

Privacy floor: industry benchmarks are only published when ≥ 3 orgs
have contributed data for that metric/period (MIN_ORG_COUNT_FOR_BENCHMARK).

Network effect: every org that joins VeriGo improves benchmark accuracy
for all other orgs in the same industry.
"""
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import (
    get_current_user, require_admin, require_mlro_or_above,
    require_compliance_or_above, require_analyst_or_above, get_db,
)
from app.models.user import User
from app.models.benchmark import (
    BenchmarkMetric, SnapshotPeriod, METRIC_META,
    MIN_ORG_COUNT_FOR_BENCHMARK, OrgMetricsSnapshot, IndustryBenchmark,
)
from app.services import benchmark_service as svc

router = APIRouter(prefix="/benchmarks", tags=["Analytics & Benchmarking"])


# ══════════════════════════════════════════════════════════════════════════════
# ORG BENCHMARK DASHBOARD
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/dashboard",
            summary="Your organisation's metrics vs industry benchmarks with percentile position")
def get_dashboard(
    period_label: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    """
    Returns your org's current metrics alongside industry benchmark distributions.

    Each metric shows:
      - your_value: your actual metric value
      - industry_median: median across all orgs in your industry
      - your_percentile: where you rank (0-99th)
      - rating: top_quartile | above_median | below_median | bottom_quartile
      - vs_median: your value minus the industry median

    Requires at least one captured snapshot. If no current-period snapshot
    exists, falls back to the most recent available period.
    """
    try:
        return svc.get_org_benchmark_dashboard(db, current_user.org_id, period_label)
    except ValueError as exc:
        raise HTTPException(404, str(exc))


@router.get("/dashboard/history/{metric}",
            summary="Your metric trend over time — chart data for a single metric")
def get_metric_history(
    metric: str,
    periods: int = 12,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    """
    Returns time-series data for a single metric — use for trend charts.

    Also returns trend direction: improving | worsening | stable | insufficient_data
    """
    if metric not in METRIC_META:
        raise HTTPException(422, f"Unknown metric '{metric}'. Valid metrics: {list(METRIC_META.keys())}")
    return svc.get_org_metric_history(db, current_user.org_id, metric, min(periods, 52))


@router.get("/dashboard/snapshots",
            summary="List all metric snapshots captured for your org")
def list_snapshots(
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    snaps = db.query(OrgMetricsSnapshot).filter_by(
        org_id=current_user.org_id
    ).order_by(OrgMetricsSnapshot.captured_at.desc()).limit(limit).all()
    return [
        {
            "id": s.id,
            "period_label": s.period_label,
            "period_start": s.period_start.isoformat(),
            "period_end": s.period_end.isoformat(),
            "total_customers": s.total_customers,
            "training_completion_pct": s.training_completion_pct,
            "high_risk_customer_pct": s.high_risk_customer_pct,
            "smr_rate_per_1k": s.smr_rate_per_1k,
            "open_alert_pct": s.open_alert_pct,
            "captured_at": s.captured_at.isoformat() if s.captured_at else None,
        }
        for s in snaps
    ]


# ══════════════════════════════════════════════════════════════════════════════
# INDUSTRY BENCHMARKS (anonymised)
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/industry/{industry}",
            summary="Industry-wide benchmark data — anonymised aggregate stats only")
def get_industry_benchmark(
    industry: str,
    period_label: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    """
    Returns anonymised statistical distributions for the specified industry.

    No org identifiers are included — only min/p25/median/p75/max/mean.
    Only published when ≥ 3 orgs have contributed data (privacy floor).

    Available industries match AUSTRAC IndustryType values:
      remittance, vasp, legal_professionals, real_estate, accountants,
      conveyancers, bullion_dealers, pubs_clubs, precious_metals, etc.
    """
    return svc.get_industry_overview(db, industry, period_label)


@router.get("/industry",
            summary="List all industries with available benchmark data")
def list_industries_with_benchmarks(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    industries = db.query(IndustryBenchmark.industry).filter_by(
        is_published=True
    ).distinct().all()
    return {
        "industries": [r[0] for r in industries],
        "note": f"Benchmarks require a minimum of {MIN_ORG_COUNT_FOR_BENCHMARK} organisations per industry.",
    }


@router.get("/industry/{industry}/periods",
            summary="List available benchmark periods for an industry")
def list_benchmark_periods(
    industry: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    periods = db.query(
        IndustryBenchmark.period_label,
        IndustryBenchmark.period_start,
        IndustryBenchmark.period_end,
    ).filter_by(industry=industry, is_published=True).distinct(
        IndustryBenchmark.period_label
    ).order_by(IndustryBenchmark.period_start.desc()).limit(52).all()

    return {
        "industry": industry,
        "periods": [
            {"period_label": p[0], "period_start": p[1].isoformat(), "period_end": p[2].isoformat()}
            for p in periods
        ],
    }


# ══════════════════════════════════════════════════════════════════════════════
# SNAPSHOT CAPTURE & BENCHMARK COMPUTATION (admin / scheduler)
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/capture-snapshot",
             summary="Capture a metrics snapshot for this org (also called by scheduler)")
def capture_snapshot(
    period: SnapshotPeriod = SnapshotPeriod.weekly,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_mlro_or_above),
):
    """
    Computes and stores current metrics for your organisation.
    Called automatically by the weekly scheduler — use this to trigger manually.
    """
    snap = svc.capture_org_snapshot(db, current_user.org_id, period, current_user.id)
    return {
        "id": snap.id,
        "period_label": snap.period_label,
        "period_start": snap.period_start.isoformat(),
        "period_end": snap.period_end.isoformat(),
        "training_completion_pct": snap.training_completion_pct,
        "high_risk_customer_pct": snap.high_risk_customer_pct,
        "smr_rate_per_1k": snap.smr_rate_per_1k,
        "total_customers": snap.total_customers,
        "captured_at": snap.captured_at.isoformat() if snap.captured_at else None,
        "message": "Snapshot captured. Run /benchmarks/compute-benchmarks to update industry comparisons.",
    }


@router.post("/capture-all-snapshots",
             summary="Capture snapshots for ALL active organisations (admin — run from scheduler)")
def capture_all_snapshots(
    period: SnapshotPeriod = SnapshotPeriod.weekly,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """
    Captures metrics snapshots for all active organisations.
    Run this first, then run /compute-benchmarks.
    Typically triggered by a weekly cron job.
    """
    return svc.capture_all_org_snapshots(db, period)


@router.post("/compute-benchmarks",
             summary="Compute industry benchmark distributions from captured snapshots (admin — run after capture)")
def compute_benchmarks(
    period_label: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """
    Aggregates all org snapshots for the specified period into industry percentile
    distributions. Run after /capture-all-snapshots.

    Only publishes benchmarks where org_count >= 3 (privacy floor).
    """
    return svc.compute_industry_benchmarks(db, period_label)


# ══════════════════════════════════════════════════════════════════════════════
# METADATA
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/metrics",
            summary="List all benchmark metrics with labels, units, and interpretation")
def list_metrics():
    return {
        "metrics": [
            {
                "metric": k,
                **v,
            }
            for k, v in METRIC_META.items()
        ],
        "min_orgs_for_benchmark": MIN_ORG_COUNT_FOR_BENCHMARK,
        "ratings": {
            "top_quartile": "Your value is in the top 25% of your industry peers",
            "above_median": "Your value is above the industry median (50th percentile)",
            "below_median": "Your value is below the industry median — improvement opportunity",
            "bottom_quartile": "Your value is in the bottom 25% — requires attention",
            "informational": "This metric has no directional interpretation (volume data)",
            "no_benchmark": "Insufficient data to compute industry benchmark for this metric/period",
        },
    }


@router.get("/enums/values", summary="Enum values for dropdowns")
def get_enums():
    return {
        "metrics": [e.value for e in BenchmarkMetric],
        "periods": [e.value for e in SnapshotPeriod],
    }
