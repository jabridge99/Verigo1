"""
Benchmark Service

Two responsibilities:
  1. capture_org_snapshot()     — compute and store one org's current metrics
  2. compute_industry_benchmarks() — aggregate snapshots → percentile distributions
  3. get_org_benchmark_dashboard() — org's metrics vs industry benchmarks with percentile

Data flow:
  Scheduler calls capture_org_snapshot() weekly for every org
    → OrgMetricsSnapshot rows accumulate
  Scheduler calls compute_industry_benchmarks() after snapshots
    → IndustryBenchmark rows with p25/median/p75 per metric/industry/period
  MLRO calls GET /benchmarks/dashboard
    → get_org_benchmark_dashboard() returns own metrics + industry position
"""

from __future__ import annotations

import logging
import statistics
from datetime import date, timedelta
from typing import Optional

from sqlalchemy.orm import Session

from app.models.benchmark import (
    METRIC_META,
    MIN_ORG_COUNT_FOR_BENCHMARK,
    BenchmarkMetric,
    IndustryBenchmark,
    OrgMetricsSnapshot,
    SnapshotPeriod,
)
from app.models.organisation import Organisation

log = logging.getLogger("tvg.benchmark")


# ══════════════════════════════════════════════════════════════════════════════
# SNAPSHOT CAPTURE
# ══════════════════════════════════════════════════════════════════════════════


def capture_org_snapshot(
    db: Session,
    org_id: str,
    period: SnapshotPeriod = SnapshotPeriod.weekly,
    captured_by: str = "system",
) -> OrgMetricsSnapshot:
    org = db.query(Organisation).filter_by(id=org_id).first()
    if not org:
        raise ValueError(f"Organisation not found: {org_id}")

    today = date.today()
    period_start, period_end, period_label = _period_bounds(today, period)

    # Upsert — replace snapshot for same org/period if it already exists
    existing = (
        db.query(OrgMetricsSnapshot)
        .filter_by(org_id=org_id, period_label=period_label)
        .first()
    )
    if existing:
        db.delete(existing)
        db.flush()

    metrics = _compute_org_metrics(db, org_id, period_start, period_end)

    snap = OrgMetricsSnapshot(
        org_id=org_id,
        industry=org.industry_type.value if org.industry_type else "other",
        period=period,
        period_label=period_label,
        period_start=period_start,
        period_end=period_end,
        captured_by=captured_by,
        **metrics,
    )
    db.add(snap)
    db.commit()
    db.refresh(snap)
    return snap


def capture_all_org_snapshots(
    db: Session,
    period: SnapshotPeriod = SnapshotPeriod.weekly,
) -> dict:
    orgs = db.query(Organisation).filter_by(status="active").all()
    success = 0
    errors = []
    for org in orgs:
        try:
            capture_org_snapshot(db, org.id, period)
            success += 1
        except Exception as exc:
            log.error("Snapshot failed for org %s: %s", org.id, exc)
            errors.append({"org_id": org.id, "error": str(exc)})
    return {"orgs_captured": success, "errors": errors}


# ══════════════════════════════════════════════════════════════════════════════
# BENCHMARK COMPUTATION
# ══════════════════════════════════════════════════════════════════════════════


def compute_industry_benchmarks(
    db: Session,
    period_label: Optional[str] = None,
) -> dict:
    """
    Aggregate OrgMetricsSnapshot rows by industry → compute percentile stats.
    Call after capture_all_org_snapshots().
    """
    if not period_label:
        today = date.today()
        _, _, period_label = _period_bounds(today, SnapshotPeriod.weekly)

    snapshots = db.query(OrgMetricsSnapshot).filter_by(period_label=period_label).all()
    if not snapshots:
        return {"period_label": period_label, "benchmarks_computed": 0}

    # Group by industry
    by_industry: dict[str, list[OrgMetricsSnapshot]] = {}
    for snap in snapshots:
        by_industry.setdefault(snap.industry, []).append(snap)

    total = 0
    for industry, snaps in by_industry.items():
        for metric in BenchmarkMetric:
            values = [
                getattr(s, metric.value)
                for s in snaps
                if getattr(s, metric.value, None) is not None
            ]
            if not values:
                continue

            published = len(values) >= MIN_ORG_COUNT_FOR_BENCHMARK
            sorted_vals = sorted(values)
            n = len(sorted_vals)

            def pct(p: float) -> float:
                idx = (p / 100) * (n - 1)
                lo, hi = int(idx), min(int(idx) + 1, n - 1)
                return sorted_vals[lo] + (sorted_vals[hi] - sorted_vals[lo]) * (
                    idx - lo
                )

            # Upsert
            existing = (
                db.query(IndustryBenchmark)
                .filter_by(industry=industry, metric=metric, period_label=period_label)
                .first()
            )
            if existing:
                db.delete(existing)
                db.flush()

            bm = IndustryBenchmark(
                industry=industry,
                metric=metric,
                period_label=period_label,
                period_start=snaps[0].period_start,
                period_end=snaps[0].period_end,
                org_count=n,
                mean=round(statistics.mean(values), 2),
                std_dev=round(statistics.stdev(values), 2) if n > 1 else 0.0,
                minimum=round(min(values), 2),
                p25=round(pct(25), 2),
                median=round(pct(50), 2),
                p75=round(pct(75), 2),
                maximum=round(max(values), 2),
                is_published=published,
            )
            db.add(bm)
            total += 1

    db.commit()
    return {
        "period_label": period_label,
        "benchmarks_computed": total,
        "industries": list(by_industry.keys()),
    }


# ══════════════════════════════════════════════════════════════════════════════
# ORG BENCHMARK DASHBOARD
# ══════════════════════════════════════════════════════════════════════════════


def get_org_benchmark_dashboard(
    db: Session,
    org_id: str,
    period_label: Optional[str] = None,
) -> dict:
    """
    Returns org's own metrics with industry percentile position for each metric.

    Output per metric:
      {
        "metric": "training_completion_pct",
        "label": "Training Completion Rate",
        "unit": "%",
        "your_value": 94.2,
        "industry": "remittance",
        "industry_median": 71.0,
        "industry_p25": 58.0,
        "industry_p75": 82.0,
        "your_percentile": 87,
        "vs_median": "+23.2%",
        "rating": "top_quartile",   # top_quartile | above_median | below_median | bottom_quartile
        "higher_is_better": true,
        "org_count": 12,
      }
    """
    org = db.query(Organisation).filter_by(id=org_id).first()
    if not org:
        raise ValueError("Organisation not found")
    industry = org.industry_type.value if org.industry_type else "other"

    if not period_label:
        today = date.today()
        _, _, period_label = _period_bounds(today, SnapshotPeriod.weekly)

    snap = (
        db.query(OrgMetricsSnapshot)
        .filter_by(org_id=org_id, period_label=period_label)
        .first()
    )

    # Fall back to most recent snapshot if current period not yet captured
    if not snap:
        snap = (
            db.query(OrgMetricsSnapshot)
            .filter_by(org_id=org_id)
            .order_by(OrgMetricsSnapshot.captured_at.desc())
            .first()
        )

    own_metrics = _snapshot_to_metrics_dict(snap) if snap else {}

    # Load industry benchmarks for this period (or nearest)
    benchmarks = (
        db.query(IndustryBenchmark)
        .filter_by(
            industry=industry,
            period_label=period_label,
            is_published=True,
        )
        .all()
    )

    # Fall back to most recent benchmarks if current period not computed
    if not benchmarks:
        latest_bm = (
            db.query(IndustryBenchmark)
            .filter_by(industry=industry, is_published=True)
            .order_by(IndustryBenchmark.computed_at.desc())
            .first()
        )
        if latest_bm:
            benchmarks = (
                db.query(IndustryBenchmark)
                .filter_by(
                    industry=industry,
                    period_label=latest_bm.period_label,
                    is_published=True,
                )
                .all()
            )

    bm_by_metric = {bm.metric.value: bm for bm in benchmarks}

    comparisons = []
    for metric in BenchmarkMetric:
        own_val = own_metrics.get(metric.value)
        bm = bm_by_metric.get(metric.value)
        meta = METRIC_META.get(metric.value, {})
        higher_is_better = meta.get("higher_is_better")

        entry = {
            "metric": metric.value,
            "label": meta.get("label", metric.value),
            "unit": meta.get("unit", ""),
            "your_value": own_val,
            "higher_is_better": higher_is_better,
        }

        if bm and own_val is not None:
            percentile = _compute_percentile_position(own_val, bm)
            vs_median = own_val - bm.median if bm.median is not None else None
            rating = _percentile_to_rating(percentile, higher_is_better)

            entry.update(
                {
                    "industry_median": bm.median,
                    "industry_p25": bm.p25,
                    "industry_p75": bm.p75,
                    "industry_mean": bm.mean,
                    "industry_min": bm.minimum,
                    "industry_max": bm.maximum,
                    "industry_std_dev": bm.std_dev,
                    "your_percentile": percentile,
                    "vs_median": round(vs_median, 2) if vs_median is not None else None,
                    "vs_median_pct": (
                        f"+{vs_median:.1f}"
                        if vs_median and vs_median > 0
                        else f"{vs_median:.1f}"
                        if vs_median is not None
                        else None
                    ),
                    "rating": rating,
                    "org_count": bm.org_count,
                }
            )
        else:
            entry.update(
                {
                    "industry_median": None,
                    "your_percentile": None,
                    "rating": "no_benchmark",
                    "org_count": bm.org_count if bm else 0,
                }
            )

        comparisons.append(entry)

    # Headline scores
    top_quartile = [c for c in comparisons if c.get("rating") == "top_quartile"]
    below_median = [
        c for c in comparisons if c.get("rating") in ("below_median", "bottom_quartile")
    ]
    needs_attention = [
        c
        for c in comparisons
        if c.get("rating") in ("below_median", "bottom_quartile")
        and c["higher_is_better"] is not False
    ]

    return {
        "org_id": org_id,
        "industry": industry,
        "period_label": period_label if snap else (snap.period_label if snap else None),
        "snapshot_captured_at": snap.captured_at.isoformat() if snap else None,
        "headline": {
            "metrics_in_top_quartile": len(top_quartile),
            "metrics_below_median": len(below_median),
            "metrics_needing_attention": len(needs_attention),
            "overall_rating": _overall_rating(comparisons),
        },
        "metrics": comparisons,
        "attention_items": [
            {
                "metric": c["metric"],
                "label": c["label"],
                "your_value": c["your_value"],
                "industry_median": c.get("industry_median"),
                "rating": c["rating"],
            }
            for c in needs_attention
        ],
    }


def get_industry_overview(
    db: Session,
    industry: str,
    period_label: Optional[str] = None,
) -> dict:
    """
    Anonymised industry-wide benchmark data.
    No org identifiers — purely statistical aggregates.
    """
    if not period_label:
        today = date.today()
        _, _, period_label = _period_bounds(today, SnapshotPeriod.weekly)

    benchmarks = (
        db.query(IndustryBenchmark)
        .filter_by(industry=industry, period_label=period_label, is_published=True)
        .all()
    )

    if not benchmarks:
        # Most recent available
        latest = (
            db.query(IndustryBenchmark)
            .filter_by(industry=industry, is_published=True)
            .order_by(IndustryBenchmark.computed_at.desc())
            .first()
        )
        if latest:
            benchmarks = (
                db.query(IndustryBenchmark)
                .filter_by(
                    industry=industry,
                    period_label=latest.period_label,
                    is_published=True,
                )
                .all()
            )

    org_count = max((b.org_count for b in benchmarks), default=0)

    return {
        "industry": industry,
        "period_label": benchmarks[0].period_label if benchmarks else period_label,
        "org_count": org_count,
        "is_published": org_count >= MIN_ORG_COUNT_FOR_BENCHMARK,
        "metrics": [
            {
                "metric": bm.metric.value,
                "label": METRIC_META.get(bm.metric.value, {}).get(
                    "label", bm.metric.value
                ),
                "unit": METRIC_META.get(bm.metric.value, {}).get("unit", ""),
                "org_count": bm.org_count,
                "mean": bm.mean,
                "std_dev": bm.std_dev,
                "minimum": bm.minimum,
                "p25": bm.p25,
                "median": bm.median,
                "p75": bm.p75,
                "maximum": bm.maximum,
                "computed_at": bm.computed_at.isoformat() if bm.computed_at else None,
            }
            for bm in sorted(benchmarks, key=lambda b: b.metric.value)
        ],
    }


def get_org_metric_history(
    db: Session,
    org_id: str,
    metric: str,
    periods: int = 12,
) -> dict:
    """Returns an org's own metric history over time — trend line data."""
    snaps = (
        db.query(OrgMetricsSnapshot)
        .filter_by(org_id=org_id)
        .order_by(OrgMetricsSnapshot.period_start.desc())
        .limit(periods)
        .all()
    )

    meta = METRIC_META.get(metric, {})
    points = []
    for s in reversed(snaps):
        val = getattr(s, metric, None)
        points.append(
            {
                "period_label": s.period_label,
                "period_start": s.period_start.isoformat(),
                "value": val,
            }
        )

    # Trend direction
    values = [p["value"] for p in points if p["value"] is not None]
    trend = "insufficient_data"
    if len(values) >= 2:
        recent_avg = statistics.mean(values[-3:]) if len(values) >= 3 else values[-1]
        older_avg = statistics.mean(values[:3]) if len(values) >= 3 else values[0]
        diff = recent_avg - older_avg
        threshold = abs(older_avg) * 0.05 if older_avg else 1
        if diff > threshold:
            trend = "improving" if meta.get("higher_is_better") else "worsening"
        elif diff < -threshold:
            trend = "worsening" if meta.get("higher_is_better") else "improving"
        else:
            trend = "stable"

    return {
        "org_id": org_id,
        "metric": metric,
        "label": meta.get("label", metric),
        "unit": meta.get("unit", ""),
        "higher_is_better": meta.get("higher_is_better"),
        "trend": trend,
        "data_points": points,
        "current_value": values[-1] if values else None,
        "periods_available": len(snaps),
    }


# ══════════════════════════════════════════════════════════════════════════════
# INTERNAL HELPERS
# ══════════════════════════════════════════════════════════════════════════════


def _compute_org_metrics(db: Session, org_id: str, start: date, end: date) -> dict:
    from datetime import datetime as dt

    start_dt = dt.combine(start, dt.min.time())
    end_dt = dt.combine(end, dt.max.time())

    m: dict = {}

    # ── Customers ─────────────────────────────────────────────────────────────
    try:
        from app.models.customer import Customer

        customers = db.query(Customer).filter_by(org_id=org_id).all()
        total = len(customers)
        m["total_customers"] = total
        if total > 0:
            high_risk = sum(
                1
                for c in customers
                if c.risk_level and c.risk_level.value in ("high", "critical")
            )
            m["high_risk_customer_pct"] = round(high_risk / total * 100, 2)
            m["pep_customer_pct"] = round(
                sum(1 for c in customers if getattr(c, "is_pep", False)) / total * 100,
                2,
            )
            m["sanctions_match_pct"] = round(
                sum(1 for c in customers if getattr(c, "is_sanctions_match", False))
                / total
                * 100,
                2,
            )
            edd = sum(
                1 for c in customers if c.cdd_level and c.cdd_level.value == "edd"
            )
            m["edd_escalation_pct"] = round(edd / total * 100, 2)
            # CDD completion: customers not in draft/pending = have completed initial CDD
            cdd_complete = sum(
                1
                for c in customers
                if c.status and c.status.value not in ("draft", "pending")
            )
            m["cdd_completion_pct"] = round(cdd_complete / total * 100, 2)
    except Exception as exc:
        log.debug("Customer metrics failed: %s", exc)

    # ── Reports ───────────────────────────────────────────────────────────────
    try:
        from app.models.report import IFTIReport, SMRReport, TTRReport

        smrs = (
            db.query(SMRReport)
            .filter(
                SMRReport.org_id == org_id,
                SMRReport.created_at.between(start_dt, end_dt),
            )
            .count()
        )
        iftis = (
            db.query(IFTIReport)
            .filter(
                IFTIReport.org_id == org_id,
                IFTIReport.created_at.between(start_dt, end_dt),
            )
            .count()
        )
        ttrs = (
            db.query(TTRReport)
            .filter(
                TTRReport.org_id == org_id,
                TTRReport.created_at.between(start_dt, end_dt),
            )
            .count()
        )
        m["smr_count"] = smrs
        m["ifti_count"] = iftis
        m["ttr_count"] = ttrs
        m["ifti_volume"] = float(iftis)
        m["ttr_volume"] = float(ttrs)
        total_customers = m.get("total_customers", 0)
        m["smr_rate_per_1k"] = (
            round(smrs / total_customers * 1000, 3) if total_customers else 0.0
        )
    except Exception as exc:
        log.debug("Report metrics failed: %s", exc)

    # ── Monitoring alerts ─────────────────────────────────────────────────────
    try:
        from app.models.monitoring import AlertStatus, TransactionAlert

        alerts_in_period = (
            db.query(TransactionAlert)
            .filter(
                TransactionAlert.org_id == org_id,
                TransactionAlert.created_at.between(start_dt, end_dt),
            )
            .all()
        )
        total_alerts = len(alerts_in_period)
        m["total_alerts"] = total_alerts
        if total_alerts > 0:
            open_alerts = sum(
                1 for a in alerts_in_period if a.status == AlertStatus.open
            )
            m["open_alert_pct"] = round(open_alerts / total_alerts * 100, 2)
            # Alert → SMR conversion: alerts where result = smr_filed / total closed
            smr_filed_alerts = sum(
                1
                for a in alerts_in_period
                if getattr(a, "result", None)
                and str(getattr(a, "result", "")).lower() in ("smr_filed", "smr filed")
            )
            closed = total_alerts - open_alerts
            m["alert_to_smr_pct"] = (
                round(smr_filed_alerts / closed * 100, 2) if closed else 0.0
            )
    except Exception as exc:
        log.debug("Alert metrics failed: %s", exc)

    # ── Training ──────────────────────────────────────────────────────────────
    try:
        from app.models.governance_training import (
            GovernanceTrainingRecord,
            TrainingStatus,
        )

        records = db.query(GovernanceTrainingRecord).filter_by(org_id=org_id).all()
        non_exempt = [r for r in records if r.status != TrainingStatus.exempt]
        if non_exempt:
            completed = sum(
                1 for r in non_exempt if r.status == TrainingStatus.completed
            )
            overdue = sum(1 for r in non_exempt if r.status == TrainingStatus.overdue)
            m["training_completion_pct"] = round(completed / len(non_exempt) * 100, 2)
            m["training_overdue_pct"] = round(overdue / len(non_exempt) * 100, 2)
    except Exception as exc:
        log.debug("Training metrics failed: %s", exc)

    # ── Governance ────────────────────────────────────────────────────────────
    try:
        from app.models.governance import Policy

        today = date.today()
        all_policies = db.query(Policy).filter_by(org_id=org_id).all()
        policies_with_due = [
            p for p in all_policies if getattr(p, "review_due_date", None)
        ]
        if policies_with_due:
            on_time = sum(1 for p in policies_with_due if p.review_due_date >= today)
            m["policy_review_on_time_pct"] = round(
                on_time / len(policies_with_due) * 100, 2
            )
    except Exception as exc:
        log.debug("Policy metrics failed: %s", exc)

    try:
        from app.models.governance_controls import (
            GovernanceControl,
        )

        controls = (
            db.query(GovernanceControl).filter_by(org_id=org_id, is_active=True).all()
        )
        if controls:
            effective = sum(
                1
                for c in controls
                if getattr(c, "effectiveness", None)
                and str(getattr(c, "effectiveness", "")).lower()
                in ("effective", "highly_effective", "largely_effective")
            )
            m["control_effectiveness_pct"] = round(effective / len(controls) * 100, 2)
    except Exception as exc:
        log.debug("Control metrics failed: %s", exc)

    try:
        from app.models.case import Case, CaseStatus

        closed_cases = (
            db.query(Case)
            .filter(
                Case.org_id == org_id,
                Case.status == CaseStatus.closed,
                Case.closed_at.isnot(None),
                Case.created_at.between(start_dt, end_dt),
            )
            .all()
        )
        if closed_cases:
            days_list = [
                (c.closed_at - c.created_at).days
                for c in closed_cases
                if c.closed_at and c.created_at
            ]
            if days_list:
                m["avg_case_days"] = round(statistics.mean(days_list), 1)
    except Exception as exc:
        log.debug("Case metrics failed: %s", exc)

    m["raw_counts"] = {
        "total_customers": m.get("total_customers", 0),
        "smr_count": m.get("smr_count", 0),
        "ifti_count": m.get("ifti_count", 0),
        "ttr_count": m.get("ttr_count", 0),
        "total_alerts": m.get("total_alerts", 0),
    }
    return m


def _snapshot_to_metrics_dict(snap: OrgMetricsSnapshot) -> dict:
    return {m.value: getattr(snap, m.value, None) for m in BenchmarkMetric}


def _compute_percentile_position(value: float, bm: IndustryBenchmark) -> int:
    """
    Estimate what percentile rank `value` sits at given the benchmark distribution.
    Uses linear interpolation between known percentile points.
    """
    if bm.median is None:
        return 50

    points = [
        (0, bm.minimum or 0),
        (25, bm.p25 or 0),
        (50, bm.median),
        (75, bm.p75 or 0),
        (100, bm.maximum or 0),
    ]
    # Find the two surrounding points
    for i in range(len(points) - 1):
        p_lo, v_lo = points[i]
        p_hi, v_hi = points[i + 1]
        if v_lo <= value <= v_hi:
            if v_hi == v_lo:
                return int((p_lo + p_hi) / 2)
            frac = (value - v_lo) / (v_hi - v_lo)
            return min(99, max(1, int(p_lo + frac * (p_hi - p_lo))))

    if value <= (bm.minimum or 0):
        return 1
    if value >= (bm.maximum or 0):
        return 99
    return 50


def _percentile_to_rating(percentile: int, higher_is_better: Optional[bool]) -> str:
    if higher_is_better is None:
        return "informational"
    if higher_is_better:
        if percentile >= 75:
            return "top_quartile"
        if percentile >= 50:
            return "above_median"
        if percentile >= 25:
            return "below_median"
        return "bottom_quartile"
    else:
        # Lower is better — invert
        if percentile <= 25:
            return "top_quartile"
        if percentile <= 50:
            return "above_median"
        if percentile <= 75:
            return "below_median"
        return "bottom_quartile"


def _overall_rating(comparisons: list) -> str:
    rated = [
        c
        for c in comparisons
        if c.get("rating") not in ("no_benchmark", "informational")
    ]
    if not rated:
        return "no_data"
    top = sum(1 for c in rated if c["rating"] == "top_quartile")
    below = sum(1 for c in rated if c["rating"] in ("below_median", "bottom_quartile"))
    pct_top = top / len(rated)
    pct_below = below / len(rated)
    if pct_top >= 0.5:
        return "strong"
    if pct_below >= 0.5:
        return "needs_improvement"
    return "adequate"


def _period_bounds(ref_date: date, period: SnapshotPeriod) -> tuple[date, date, str]:
    if period == SnapshotPeriod.weekly:
        # ISO week: Monday to Sunday
        monday = ref_date - timedelta(days=ref_date.weekday())
        sunday = monday + timedelta(days=6)
        year, week, _ = ref_date.isocalendar()
        label = f"{year}-W{str(week).zfill(2)}"
        return monday, sunday, label
    else:
        # Monthly
        start = ref_date.replace(day=1)
        next_month = (
            start.replace(month=start.month % 12 + 1, day=1)
            if start.month < 12
            else start.replace(year=start.year + 1, month=1, day=1)
        )
        end = next_month - timedelta(days=1)
        label = start.strftime("%Y-%m")
        return start, end, label
