import re
from datetime import datetime, date


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
        if _normalize(document.extracted_dob) != _normalize(customer.date_of_birth):
            score -= 25
            issues.append("Date of birth mismatch")
    if document.extracted_expiry:
        try:
            expiry_date = datetime.strptime(document.extracted_expiry, "%Y-%m-%d").date()
            if expiry_date < date.today():
                score -= 40
                issues.append("Document is expired")
        except ValueError:
            pass
    if document.extracted_id_number and customer.id_number:
        if _normalize(document.extracted_id_number) != _normalize(customer.id_number):
            score -= 20
            issues.append("ID number mismatch")
    score = max(score, 0.0)
    result = "valid" if score >= 70 else ("invalid" if score < 40 else "review_required")
    return {"confidence_score": score, "verification_result": result, "issues": issues}


def compute_kyc_identity_score(documents: list) -> float:
    if not documents:
        return 0.0
    scores = [d.confidence_score for d in documents if d.confidence_score is not None]
    return sum(scores) / len(scores) if scores else 0.0
