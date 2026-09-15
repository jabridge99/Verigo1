"""
AML/CTF Risk Assessment Scoring Engine — the single ISO 31000-style source of
truth for risk rating boundaries and the AUD statutory reporting threshold,
used across the risk-scoring modules in this package (see risk_rating_pct()
and TTR_CTR_THRESHOLD_AUD below).

Scoring Methodology:
  Inherent Risk  = Likelihood (1-5) × Consequence (1-5)  → 1-25
  CEF            = {1: 0.20, 2: 0.40, 3: 0.60, 4: 0.80, 5: 1.00}
  Residual Risk  = Inherent Risk × CEF(ControlEffectiveness)

Risk Rating Thresholds (residual, native 1-25 scale):
  ≤ 5   → Low
  ≤ 12  → Medium
  ≤ 19  → High
  > 19  → Critical

The same four-tier boundaries, expressed as a percentage of the 1-25 scale
(5/25=20%, 12/25=48%, 19/25=76%), are the canonical thresholds every other
percentage/point-based risk score in this codebase should rate against —
see risk_rating_pct(). Before this module took on that role, several
independent scoring modules each hardcoded their own threshold numbers with
no shared source, which meant the same customer could be rated differently
depending which code path scored them (see STRUCTURE_REVIEW.md §C3).

GOVERNANCE DISCLAIMER: This engine is a calculation tool only. Final risk ratings
and conclusions remain the sole responsibility of the reporting entity.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional

# ── Scoring constants ─────────────────────────────────────────────────────────

CEF_MAP: Dict[int, float] = {
    1: 0.20,  # Very Strong — controls highly effective
    2: 0.40,  # Strong
    3: 0.60,  # Moderate
    4: 0.80,  # Weak
    5: 1.00,  # No controls / ineffective
}

RISK_THRESHOLDS = [
    (5, "low"),
    (12, "medium"),
    (19, "high"),
]

# The same boundaries as RISK_THRESHOLDS, expressed as a percentage of the
# 1-25 native scale (5/25, 12/25, 19/25). Any risk-scoring module that
# produces a 0-100 (or 0-1) score should rate it via risk_rating_pct() below
# rather than inventing its own cut points.
RISK_THRESHOLDS_PCT = [
    (20.0, "low"),
    (48.0, "medium"),
    (76.0, "high"),
]

# AML/CTF Act 2006 statutory threshold (AUD) that triggers a Threshold
# Transaction Report, and the reference figure IFTI/CTR reporting logic
# checks against. A fixed legal figure, not a judgment call — every
# threshold-check in the codebase should reference this constant rather
# than repeating the literal number.
TTR_CTR_THRESHOLD_AUD = 10_000


# ── Core scoring functions ────────────────────────────────────────────────────


def inherent_risk(likelihood: int, consequence: int) -> float:
    """Compute inherent risk score. Both inputs must be 1-5."""
    l = max(1, min(5, likelihood))
    c = max(1, min(5, consequence))
    return float(l * c)


def control_effectiveness_factor(ce_score: int) -> float:
    """Return CEF multiplier for a control effectiveness score (1-5)."""
    return CEF_MAP.get(max(1, min(5, ce_score)), 1.0)


def residual_risk(inherent: float, ce_score: int) -> float:
    """Compute residual risk: inherent × CEF."""
    return round(inherent * control_effectiveness_factor(ce_score), 4)


def risk_rating(score: float) -> str:
    """Return 'low' | 'medium' | 'high' | 'critical' for a native 1-25 score."""
    for threshold, rating in RISK_THRESHOLDS:
        if score <= threshold:
            return rating
    return "critical"


def risk_rating_pct(score: float, max_score: float = 100.0) -> str:
    """
    Return 'low' | 'medium' | 'high' | 'critical' for any score expressed as
    a fraction of max_score (default 0-100), using the same ISO 31000-derived
    boundaries as risk_rating() — the single rating function every
    percentage/point-based risk-scoring module in this codebase should call.
    """
    pct = 0.0 if max_score <= 0 else max(0.0, min(100.0, score / max_score * 100.0))
    for threshold, rating in RISK_THRESHOLDS_PCT:
        if pct <= threshold:
            return rating
    return "critical"


# ── Factor-level result ───────────────────────────────────────────────────────


@dataclass
class FactorResult:
    factor_id: str
    factor_ref: str
    name: str
    likelihood: int
    consequence: int
    ce_score: int
    inherent_score: float
    residual_score: float
    residual_rating: str
    override_residual: Optional[float] = None
    override_justification: Optional[str] = None

    @property
    def effective_residual(self) -> float:
        return (
            self.override_residual
            if self.override_residual is not None
            else self.residual_score
        )

    @property
    def effective_rating(self) -> str:
        return risk_rating(self.effective_residual)


def score_factor(
    factor_id: str,
    factor_ref: str,
    name: str,
    likelihood: int,
    consequence: int,
    ce_score: int,
    override_residual: Optional[float] = None,
    override_justification: Optional[str] = None,
) -> FactorResult:
    inh = inherent_risk(likelihood, consequence)
    res = residual_risk(inh, ce_score)
    return FactorResult(
        factor_id=factor_id,
        factor_ref=factor_ref,
        name=name,
        likelihood=likelihood,
        consequence=consequence,
        ce_score=ce_score,
        inherent_score=inh,
        residual_score=res,
        residual_rating=risk_rating(res),
        override_residual=override_residual,
        override_justification=override_justification,
    )


# ── Category-level result ─────────────────────────────────────────────────────


@dataclass
class CategoryResult:
    category_id: str
    category_type: str
    name: str
    weight: float
    factors: List[FactorResult] = field(default_factory=list)

    @property
    def avg_inherent_score(self) -> float:
        if not self.factors:
            return 0.0
        return round(sum(f.inherent_score for f in self.factors) / len(self.factors), 4)

    @property
    def avg_residual_score(self) -> float:
        if not self.factors:
            return 0.0
        return round(
            sum(f.effective_residual for f in self.factors) / len(self.factors), 4
        )

    @property
    def residual_rating(self) -> str:
        return risk_rating(self.avg_residual_score)

    @property
    def highest_residual_score(self) -> float:
        if not self.factors:
            return 0.0
        return max(f.effective_residual for f in self.factors)


# ── Overall assessment result ─────────────────────────────────────────────────


@dataclass
class AssessmentResult:
    categories: List[CategoryResult] = field(default_factory=list)

    @property
    def overall_inherent_score(self) -> float:
        """Weighted average inherent score across categories."""
        total_weight = sum(c.weight for c in self.categories if c.factors)
        if total_weight == 0:
            return 0.0
        weighted_sum = sum(
            c.avg_inherent_score * c.weight for c in self.categories if c.factors
        )
        return round(weighted_sum / total_weight, 4)

    @property
    def overall_residual_score(self) -> float:
        """Weighted average residual score across categories."""
        total_weight = sum(c.weight for c in self.categories if c.factors)
        if total_weight == 0:
            return 0.0
        weighted_sum = sum(
            c.avg_residual_score * c.weight for c in self.categories if c.factors
        )
        return round(weighted_sum / total_weight, 4)

    @property
    def overall_inherent_rating(self) -> str:
        return risk_rating(self.overall_inherent_score)

    @property
    def overall_residual_rating(self) -> str:
        return risk_rating(self.overall_residual_score)

    def category_scores_json(self) -> dict:
        """Serialisable dict for storage in RiskAssessmentRun.category_scores."""
        return {
            c.category_type: {
                "category_id": c.category_id,
                "name": c.name,
                "weight": c.weight,
                "avg_inherent": c.avg_inherent_score,
                "avg_residual": c.avg_residual_score,
                "rating": c.residual_rating,
                "highest_residual": c.highest_residual_score,
                "factor_count": len(c.factors),
            }
            for c in self.categories
        }


# ── Heat map ──────────────────────────────────────────────────────────────────


def build_heat_map(factors: List[FactorResult]) -> List[List[List[str]]]:
    """
    Returns a 5×5 grid (row=Consequence 5→1, col=Likelihood 1→5).
    Each cell contains a list of factor_ref strings plotted there.
    """
    grid: List[List[List[str]]] = [[[] for _ in range(5)] for _ in range(5)]
    for f in factors:
        row = 5 - max(1, min(5, f.consequence))
        col = max(1, min(5, f.likelihood)) - 1
        grid[row][col].append(f.factor_ref)
    return grid


def cell_rating(likelihood: int, consequence: int) -> str:
    """Return the rating for a heat map cell based on inherent score."""
    return risk_rating(likelihood * consequence)


# ── Executive summary builder ─────────────────────────────────────────────────


def build_executive_summary(result: AssessmentResult, org_name: str) -> str:
    high_critical = [
        c for c in result.categories if c.residual_rating in ("high", "critical")
    ]
    top_factors = sorted(
        [f for c in result.categories for f in c.factors],
        key=lambda f: f.effective_residual,
        reverse=True,
    )[:5]

    lines = [
        "ML/TF Risk Assessment — Executive Summary",
        f"Organisation: {org_name}",
        "",
        f"Overall Inherent Risk:  {result.overall_inherent_score:.2f} ({result.overall_inherent_rating.upper()})",
        f"Overall Residual Risk:  {result.overall_residual_score:.2f} ({result.overall_residual_rating.upper()})",
        "",
        "Risk Category Breakdown:",
    ]
    for c in result.categories:
        lines.append(
            f"  {c.name}: Inherent {c.avg_inherent_score:.1f} → Residual {c.avg_residual_score:.1f} ({c.residual_rating.upper()})"
        )

    if high_critical:
        lines += ["", "Elevated Risk Areas:"]
        for c in high_critical:
            lines.append(
                f"  • {c.name} ({c.residual_rating.upper()}) — {len(c.factors)} factors assessed"
            )

    if top_factors:
        lines += ["", "Top 5 Highest Residual Risk Factors:"]
        for i, f in enumerate(top_factors, 1):
            lines.append(
                f"  {i}. [{f.factor_ref}] {f.name} — {f.effective_residual:.1f} ({f.effective_rating.upper()})"
            )

    lines += [
        "",
        "GOVERNANCE DISCLAIMER: This risk assessment framework is a configurable tool only.",
        "Risk ratings, scoring assumptions, and conclusions are the sole responsibility of",
        "the reporting entity and its MLRO/compliance officer. This platform does not",
        "constitute legal or compliance advice.",
    ]
    return "\n".join(lines)


# ── Mitigation register helper ────────────────────────────────────────────────


def priority_order(factors: List[FactorResult]) -> List[FactorResult]:
    """Return factors sorted by effective residual score descending (for mitigation triage)."""
    return sorted(factors, key=lambda f: f.effective_residual, reverse=True)
