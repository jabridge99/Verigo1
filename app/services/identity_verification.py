import re
from datetime import date


def _normalize(text: str) -> str:
    return re.sub(r"\s+", " ", text.lower().strip()) if text else ""


def verify_document(customer, document) -> dict:
    score = 100.0
    issues = []
    if document.extracted_name:
        cust_parts = set(_normalize(customer.full_name).split())
        doc_parts = set(_normalize(document.extracted_name).split())
        overlap = len(cust_parts & doc_parts) / max(len(cust_parts), 1)
        if overlap < 0.5:
            score -= 30
            issues.append("Name on document does not match customer record")
    if document.extracted_dob and customer.date_of_birth:
        if document.extracted_dob != customer.date_of_birth:
            score -= 25
            issues.append("Date of birth mismatch")
    if document.expiry_date:
        if document.expiry_date < date.today():
            score -= 40
            issues.append("Document is expired")
    score = max(score, 0.0)
    result = (
        "valid" if score >= 70 else ("invalid" if score < 40 else "review_required")
    )
    return {"confidence_score": score, "verification_result": result, "issues": issues}


def compute_kyc_identity_score(documents: list) -> float:
    if not documents:
        return 0.0
    scores = [d.confidence_score for d in documents if d.confidence_score is not None]
    return sum(scores) / len(scores) if scores else 0.0
