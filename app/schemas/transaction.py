from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime
from app.models.transaction import TransactionType, TransactionStatus, AlertType, AlertStatus, AlertSeverity


class TransactionCreate(BaseModel):
    customer_id: int
    transaction_type: TransactionType
    amount: float
    currency: str = "AUD"
    amount_aud: Optional[float] = None
    counterparty_name: Optional[str] = None
    counterparty_account: Optional[str] = None
    counterparty_country: Optional[str] = None
    counterparty_bank: Optional[str] = None
    is_cross_border: bool = False
    description: Optional[str] = None
    reference: Optional[str] = None
    channel: Optional[str] = None
    industry_id: Optional[str] = None
    transaction_date: datetime


class TransactionResponse(BaseModel):
    id: int
    transaction_id: str
    customer_id: int
    transaction_type: str
    amount: float
    currency: str
    amount_aud: Optional[float]
    counterparty_name: Optional[str]
    counterparty_country: Optional[str]
    is_cross_border: Optional[bool]
    status: str
    risk_score: float
    is_suspicious: int
    alert_type: Optional[str]
    alert_details: Optional[str]
    industry_id: Optional[str]
    transaction_date: datetime
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class AlertResponse(BaseModel):
    id: int
    alert_id: str
    transaction_id: int
    customer_id: Optional[int]
    industry_id: Optional[str]
    alert_type: str
    severity: str
    status: str
    description: str
    rule_id: Optional[str]
    rule_name: Optional[str]
    action_taken: Optional[str]
    notes: Optional[str]
    assigned_to: Optional[str]
    is_resolved: int
    resolved_by: Optional[str]
    resolution_notes: Optional[str]
    created_at: Optional[datetime]
    resolved_at: Optional[datetime]

    class Config:
        from_attributes = True


class AlertUpdate(BaseModel):
    status: Optional[AlertStatus] = None
    notes: Optional[str] = None
    action_taken: Optional[str] = None
    assigned_to: Optional[str] = None
    escalated_to: Optional[str] = None
    resolved_by: Optional[str] = None
    resolution_notes: Optional[str] = None


class CaseCreate(BaseModel):
    customer_id: int
    industry_id: Optional[str] = None
    title: str
    description: Optional[str] = None
    severity: AlertSeverity = AlertSeverity.medium
    alert_ids: list[str] = []
    assigned_to: Optional[str] = None
    created_by: Optional[str] = None


class CaseResponse(BaseModel):
    id: int
    case_id: str
    customer_id: int
    industry_id: Optional[str]
    title: str
    description: Optional[str]
    severity: str
    status: str
    assigned_to: Optional[str]
    alert_ids: Optional[list]
    created_at: Optional[datetime]

    class Config:
        from_attributes = True


class MonitoringStats(BaseModel):
    total_alerts: int
    open_alerts: int
    by_severity: dict
    by_type: dict
    by_status: dict
    total_transactions: int
    flagged_transactions: int
