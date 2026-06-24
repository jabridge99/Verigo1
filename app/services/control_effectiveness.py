"""
Conversion between the two control-effectiveness scales in the codebase:

- app.models.governance_controls.ControlEffectiveness — %-based string rating
  (effective / largely_effective / partially_effective / ineffective / not_tested),
  calculated by governance_metrics.py from ControlTest results. This is the
  evidence-backed, tested rating.

- app.models.risk_engine.ControlEffectivenessScore — numeric 1-5 scale used as
  direct input to the inherent/residual risk formula in risk_engine.py.

A RiskFactorScore may link to a tested GovernanceControl via source_control_id.
When linked, control_effectiveness should be derived here instead of entered
manually.
"""

from app.models.governance_controls import ControlEffectiveness
from app.models.risk_engine import ControlEffectivenessScore

_RATING_TO_SCORE = {
    ControlEffectiveness.effective: ControlEffectivenessScore.strong,
    ControlEffectiveness.largely_effective: ControlEffectivenessScore.effective,
    ControlEffectiveness.partially_effective: ControlEffectivenessScore.moderate,
    ControlEffectiveness.ineffective: ControlEffectivenessScore.ineffective,
    ControlEffectiveness.not_tested: ControlEffectivenessScore.weak,
}


def governance_rating_to_score(rating: ControlEffectiveness) -> int:
    """Map a tested GovernanceControl rating to the 1-5 risk-engine scale."""
    return int(_RATING_TO_SCORE[rating])
