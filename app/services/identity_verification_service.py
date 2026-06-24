"""
Identity Verification Composite Score — Australia "100-point ID check" style aggregation.

Aggregates the six checks that already exist as independent rows in the
codebase (OCR confidence, manual reviewer sign-off, PEP, sanctions, adverse
media, company/business screening) into a single 0-100 score and a
Pass / ECDD-required / Fail decision. Reads from the existing
ScreeningRecord and CustomerIdentityDocument tables — no new model.

Weighting: even split across the six categories (per product decision).
Thresholds: score >= 80 -> pass, 50-79 -> ecdd_required, < 50 -> fail.
A confirmed PEP or sanctions match forces at least ecdd_required regardless
of the numeric score.
"""
from typing import Optional

from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.models.kyc import CustomerIdentityDocument
from app.models.screening import ScreeningRecord, ScreeningStatus, ScreeningType

CATEGORIES = ["ocr", "manual", "pep", "sanctions", "adverse_media", "company"]
WEIGHT = 1 / len(CATEGORIES)

PASS_THRESHOLD = 80
ECDD_THRESHOLD = 50

_HARD_FAIL_STATUSES = {ScreeningStatus.confirmed_match}
_HARD_ECDD_STATUSES = {ScreeningStatus.potential_match, ScreeningStatus.requires_edd}


def _latest_screening(db: Session, customer_id: str, screening_type: ScreeningType) -> Optional[ScreeningRecord]:
    return (
        db.query(ScreeningRecord)
        .filter(
            ScreeningRecord.customer_id == customer_id,
            ScreeningRecord.screening_type == screening_type,
        )
        .order_by(desc(ScreeningRecord.screened_at))
        .first()
    )


def _score_from_record(record: Optional[ScreeningRecord]) -> tuple[float, str]:
    """Returns (category_score_0_100, status_label). No record = not yet run."""
    if record is None:
        return 0.0, "pending"
    if record.status == ScreeningStatus.confirmed_match:
        return 0.0, "confirmed_match"
    if record.status in _HARD_ECDD_STATUSES:
        # A flagged-but-unresolved match scores low but not zero — reviewer can clear it.
        score = 100 - (record.match_score or 50)
        return max(score, 0.0), record.status.value
    if record.status == ScreeningStatus.clear:
        return 100.0, "clear"
    if record.status == ScreeningStatus.false_positive:
        return 100.0, "false_positive"
    return 0.0, record.status.value


def compute_identity_score(db: Session, customer_id: str, is_business: bool = False) -> dict:
    """Compute the composite identity-verification score for a customer.

    Returns a breakdown per category plus the overall score and decision,
    suitable for direct use as an API response body.
    """
    breakdown: dict[str, dict] = {}

    # OCR — most recent identity document's extraction confidence.
    doc = (
        db.query(CustomerIdentityDocument)
        .filter(CustomerIdentityDocument.customer_id == customer_id)
        .order_by(desc(CustomerIdentityDocument.created_at))
        .first()
    )
    ocr_score = doc.confidence_score if doc and doc.confidence_score is not None else 0.0
    breakdown["ocr"] = {"score": ocr_score, "status": "verified" if doc else "pending", "label": "ID document OCR"}

    # Manual reviewer sign-off — most recent manual_review screening record.
    manual_record = _latest_screening(db, customer_id, ScreeningType.manual_review)
    manual_score, manual_status = _score_from_record(manual_record)
    breakdown["manual"] = {"score": manual_score, "status": manual_status, "label": "Manual document review"}

    # PEP
    pep_record = _latest_screening(db, customer_id, ScreeningType.pep)
    pep_score, pep_status = _score_from_record(pep_record)
    breakdown["pep"] = {"score": pep_score, "status": pep_status, "label": "PEP screening"}

    # Sanctions
    sanctions_record = _latest_screening(db, customer_id, ScreeningType.sanctions)
    sanctions_score, sanctions_status = _score_from_record(sanctions_record)
    breakdown["sanctions"] = {"score": sanctions_score, "status": sanctions_status, "label": "Sanctions screening"}

    # Adverse media
    media_record = _latest_screening(db, customer_id, ScreeningType.adverse_media)
    media_score, media_status = _score_from_record(media_record)
    breakdown["adverse_media"] = {"score": media_score, "status": media_status, "label": "Adverse media screening"}

    # Company / business screening — only applicable to business customers.
    # Individuals get full marks for this category rather than a meaningless N/A weight gap.
    if is_business:
        company_record = _latest_screening(db, customer_id, ScreeningType.regulatory)
        company_score, company_status = _score_from_record(company_record)
    else:
        company_score, company_status = 100.0, "not_applicable"
    breakdown["company"] = {"score": company_score, "status": company_status, "label": "Company / UBO screening"}

    composite = sum(breakdown[c]["score"] * WEIGHT for c in CATEGORIES)

    hard_override = any(
        breakdown[c]["status"] == "confirmed_match" for c in ("pep", "sanctions")
    )

    if hard_override:
        decision = "fail" if composite < ECDD_THRESHOLD else "ecdd_required"
    elif composite >= PASS_THRESHOLD:
        decision = "pass"
    elif composite >= ECDD_THRESHOLD:
        decision = "ecdd_required"
    else:
        decision = "fail"

    return {
        "customer_id": customer_id,
        "composite_score": round(composite, 1),
        "decision": decision,
        "breakdown": breakdown,
        "weight_per_category": round(WEIGHT, 4),
    }
