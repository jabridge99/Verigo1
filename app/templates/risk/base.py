"""
Risk Assessment Library — Base dataclasses and default category weights.

Each industry module returns a RiskLibrary dataclass.
The seeding function converts it into DB records.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional


@dataclass
class LibraryFactor:
    ref: str                      # e.g. "CUST-001"
    category_type: str            # matches RiskCategoryType enum
    name: str
    description: str
    suggested_likelihood: int     # 1-5 hint
    suggested_consequence: int    # 1-5 hint
    rationale: str
    mitigation_examples: List[str] = field(default_factory=list)
    is_tranche1_only: bool = False


@dataclass
class RiskLibrary:
    industry: str
    description: str
    category_weights: Dict[str, float]   # category_type → weight (must sum to 1.0)
    factors: List[LibraryFactor] = field(default_factory=list)


# ── Default category weights (balanced baseline) ──────────────────────────────

DEFAULT_WEIGHTS: Dict[str, float] = {
    "customer":    0.25,
    "product":     0.15,
    "service":     0.10,
    "geographic":  0.15,
    "channel":     0.10,
    "transaction": 0.15,
    "regulatory":  0.10,
}
