"""
Monitoring Rule Management API — no-code rule engine administration.

Roles:
  GET  /monitoring/rules — analyst+
  POST /monitoring/rules — admin only
  GET  /monitoring/rules/{id} — analyst+
  PUT  /monitoring/rules/{id} — compliance+ (non-system), admin (system)
  DELETE /monitoring/rules/{id} — admin only (non-system rules only)
  PATCH /monitoring/rules/{id}/status — compliance+
"""

from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import (
    Pagination,
    org_id_for,
    require_admin,
    require_analyst_or_above,
    require_compliance_or_above,
)
from app.db.database import get_db
from app.models.monitoring import (
    AlertCategory,
    MonitoringRule,
    RuleCondition,
    RuleConditionGroup,
    RuleStatus,
)
from app.models.user import User
from app.schemas.monitoring import (
    MonitoringRuleCreate,
    MonitoringRuleListOut,
    MonitoringRuleOut,
    MonitoringRuleUpdate,
)

router = APIRouter(prefix="/monitoring", tags=["Monitoring Rules"])


def _get_rule_or_404(rule_id: str, org_id: str, db: Session) -> MonitoringRule:
    rule = (
        db.query(MonitoringRule)
        .filter(
            MonitoringRule.id == rule_id,
            MonitoringRule.org_id == org_id,
        )
        .first()
    )
    if not rule:
        raise HTTPException(status_code=404, detail="Monitoring rule not found.")
    return rule


@router.get("/rules", response_model=list[MonitoringRuleListOut])
def list_rules(
    category: AlertCategory = Query(None),
    rule_status: RuleStatus = Query(None),
    pagination: Pagination = Depends(),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    org_id = org_id_for(current_user)
    q = db.query(MonitoringRule).filter(MonitoringRule.org_id == org_id)
    if category:
        q = q.filter(MonitoringRule.category == category)
    if rule_status:
        q = q.filter(MonitoringRule.status == rule_status)
    q = q.order_by(MonitoringRule.created_at.desc())
    return pagination.apply(q).all()


@router.post(
    "/rules", response_model=MonitoringRuleOut, status_code=status.HTTP_201_CREATED
)
def create_rule(
    payload: MonitoringRuleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    org_id = org_id_for(current_user)

    rule_id = f"rule_{uuid4().hex[:10]}"
    rule = MonitoringRule(
        id=rule_id,
        org_id=org_id,
        created_by=current_user.id,
        name=payload.name,
        description=payload.description,
        rule_ref=payload.rule_ref,
        category=payload.category,
        alert_type=payload.alert_type,
        alert_severity=payload.alert_severity,
        alert_score=payload.alert_score,
        alert_title_template=payload.alert_title_template,
        lookback_days=payload.lookback_days,
        lookback_count=payload.lookback_count,
        tags=payload.tags,
        applicable_customer_types=payload.applicable_customer_types,
        applicable_payment_methods=payload.applicable_payment_methods,
        is_system_rule=False,
    )
    db.add(rule)

    for g_payload in payload.condition_groups:
        group_id = f"rcg_{uuid4().hex[:10]}"
        group = RuleConditionGroup(
            id=group_id,
            rule_id=rule_id,
            group_order=g_payload.group_order,
            description=g_payload.description,
        )
        db.add(group)

        for c_payload in g_payload.conditions:
            condition = RuleCondition(
                id=f"rc_{uuid4().hex[:10]}",
                group_id=group_id,
                condition_order=c_payload.condition_order,
                field_path=c_payload.field_path,
                operator=c_payload.operator,
                value=c_payload.value,
                value_label=c_payload.value_label,
            )
            db.add(condition)

    db.commit()
    db.refresh(rule)
    return rule


@router.get("/rules/{rule_id}", response_model=MonitoringRuleOut)
def get_rule(
    rule_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    return _get_rule_or_404(rule_id, org_id_for(current_user), db)


@router.put("/rules/{rule_id}", response_model=MonitoringRuleOut)
def update_rule(
    rule_id: str,
    payload: MonitoringRuleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    org_id = org_id_for(current_user)
    rule = _get_rule_or_404(rule_id, org_id, db)

    if rule.is_system_rule:
        from app.models.user import UserRole

        if current_user.role != UserRole.admin:
            raise HTTPException(
                status_code=403,
                detail="System rules can only be modified by administrators.",
            )

    for k, v in payload.model_dump(exclude_none=True).items():
        setattr(rule, k, v)

    rule.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(rule)
    return rule


@router.patch("/rules/{rule_id}/status", response_model=MonitoringRuleOut)
def set_rule_status(
    rule_id: str,
    new_status: RuleStatus,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    org_id = org_id_for(current_user)
    rule = _get_rule_or_404(rule_id, org_id, db)

    if rule.is_system_rule and new_status == RuleStatus.archived:
        raise HTTPException(
            status_code=400,
            detail="System rules cannot be archived — set to inactive instead.",
        )

    rule.status = new_status
    rule.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(rule)
    return rule


@router.delete("/rules/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_rule(
    rule_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    org_id = org_id_for(current_user)
    rule = _get_rule_or_404(rule_id, org_id, db)

    if rule.is_system_rule:
        raise HTTPException(
            status_code=400,
            detail="System rules cannot be deleted. Set status to inactive to disable.",
        )

    db.delete(rule)
    db.commit()
