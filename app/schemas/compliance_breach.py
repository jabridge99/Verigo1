from datetime import date
from typing import Optional

from pydantic import BaseModel

from app.models.compliance_breach import BreachSeverity, BreachStatus


class BreachCreate(BaseModel):
    title: str
    description: str
    severity: BreachSeverity
    identified_date: date
    source_review_id: Optional[str] = None
    source_control_test_id: Optional[str] = None
    reported_to_austrac: bool = False
    austrac_reference: Optional[str] = None


class BreachUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    severity: Optional[BreachSeverity] = None
    reported_to_austrac: Optional[bool] = None
    austrac_reference: Optional[str] = None
    remediation_notes: Optional[str] = None


class RemediateRequest(BaseModel):
    remediation_notes: str
    remediated_date: Optional[date] = None


class CloseRequest(BaseModel):
    status: BreachStatus  # closed | risk_accepted
    notes: Optional[str] = None
