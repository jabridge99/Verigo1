"""
Reporting Group Service — Phase 9

Supports multi-entity group structures aligned with AUSTRAC group reporting
reforms (AML/CTF Act s.229C — group reporting obligations).
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.case import Case, CaseStatus
from app.models.customer import Customer
from app.models.monitoring import AlertStatus, TransactionAlert
from app.models.organisation import Organisation
from app.models.reporting_group import (
    GroupMemberRole,
    ReportingGroup,
    ReportingGroupMember,
)


def create_group(
    db: Session,
    name: str,
    group_type: str,
    holding_org_id: str,
    austrac_group_id: Optional[str],
    shared_aml_program_id: Optional[str],
    created_by: str,
) -> ReportingGroup:
    holding_org = db.query(Organisation).filter_by(id=holding_org_id).first()
    if not holding_org:
        raise HTTPException(404, "Holding organisation not found")

    group = ReportingGroup(
        name=name,
        group_type=group_type,
        holding_org_id=holding_org_id,
        austrac_group_id=austrac_group_id,
        shared_aml_program_id=shared_aml_program_id,
        created_by=created_by,
    )
    db.add(group)
    db.flush()

    # Auto-add the holding org as a member
    member = ReportingGroupMember(
        group_id=group.id,
        org_id=holding_org_id,
        member_role=GroupMemberRole.holding_company,
        jurisdiction=holding_org.country or "AU",
    )
    db.add(member)
    db.commit()
    db.refresh(group)
    return group


def add_member(
    db: Session,
    group_id: str,
    org_id: str,
    member_role: str,
    jurisdiction: Optional[str],
    requesting_org_id: str,
) -> ReportingGroupMember:
    group = _get_group(db, group_id, requesting_org_id)

    org = db.query(Organisation).filter_by(id=org_id).first()
    if not org:
        raise HTTPException(404, "Organisation not found")

    existing = (
        db.query(ReportingGroupMember)
        .filter_by(group_id=group_id, org_id=org_id, is_active=True)
        .first()
    )
    if existing:
        raise HTTPException(
            409, "Organisation is already an active member of this group"
        )

    member = ReportingGroupMember(
        group_id=group_id,
        org_id=org_id,
        member_role=member_role,
        jurisdiction=jurisdiction or org.country or "AU",
    )
    db.add(member)
    db.commit()
    db.refresh(member)
    return member


def remove_member(
    db: Session, group_id: str, org_id: str, requesting_org_id: str
) -> dict:
    group = _get_group(db, group_id, requesting_org_id)

    if group.holding_org_id == org_id:
        raise HTTPException(
            422, "Cannot remove the holding organisation from its own group"
        )

    member = (
        db.query(ReportingGroupMember)
        .filter_by(group_id=group_id, org_id=org_id, is_active=True)
        .first()
    )
    if not member:
        raise HTTPException(404, "Active membership not found")

    member.is_active = False
    member.left_at = datetime.now(timezone.utc)
    db.commit()
    return {"removed": True, "org_id": org_id, "group_id": group_id}


def get_group_dashboard(db: Session, group_id: str, requesting_org_id: str) -> dict:
    group = _get_group(db, group_id, requesting_org_id)
    active_members = (
        db.query(ReportingGroupMember)
        .filter_by(group_id=group_id, is_active=True)
        .all()
    )
    member_org_ids = [m.org_id for m in active_members]

    customers = db.query(Customer).filter(Customer.org_id.in_(member_org_ids)).all()
    open_cases = (
        db.query(Case)
        .filter(
            Case.org_id.in_(member_org_ids),
            Case.status.notin_([CaseStatus.closed, CaseStatus.withdrawn]),
        )
        .count()
    )
    open_alerts = (
        db.query(TransactionAlert)
        .filter(
            TransactionAlert.org_id.in_(member_org_ids),
            TransactionAlert.status == AlertStatus.open,
        )
        .count()
    )

    risk_breakdown = {"low": 0, "medium": 0, "high": 0, "critical": 0}
    for c in customers:
        lvl = (
            c.risk_level.value
            if hasattr(c.risk_level, "value")
            else str(c.risk_level or "low")
        ).lower()
        if lvl in risk_breakdown:
            risk_breakdown[lvl] += 1

    member_summaries = []
    for m in active_members:
        org = db.query(Organisation).filter_by(id=m.org_id).first()
        org_customers = [c for c in customers if c.org_id == m.org_id]
        member_summaries.append(
            {
                "org_id": m.org_id,
                "org_name": org.name if org else m.org_id,
                "member_role": m.member_role.value
                if hasattr(m.member_role, "value")
                else m.member_role,
                "jurisdiction": m.jurisdiction,
                "customer_count": len(org_customers),
                "is_active": m.is_active,
            }
        )

    return {
        "group_id": group.id,
        "group_name": group.name,
        "group_type": group.group_type,
        "status": group.status,
        "member_count": len(active_members),
        "total_customers": len(customers),
        "customer_risk_breakdown": risk_breakdown,
        "open_cases": open_cases,
        "open_alerts": open_alerts,
        "shared_aml_program_id": group.shared_aml_program_id,
        "austrac_group_id": group.austrac_group_id,
        "members": member_summaries,
    }


def list_groups(db: Session, org_id: str) -> list:
    memberships = (
        db.query(ReportingGroupMember).filter_by(org_id=org_id, is_active=True).all()
    )
    group_ids = {m.group_id for m in memberships}

    held = db.query(ReportingGroup).filter_by(holding_org_id=org_id).all()
    for g in held:
        group_ids.add(g.id)

    if not group_ids:
        return []

    groups = db.query(ReportingGroup).filter(ReportingGroup.id.in_(group_ids)).all()
    result = []
    for g in groups:
        member_count = (
            db.query(ReportingGroupMember)
            .filter_by(group_id=g.id, is_active=True)
            .count()
        )
        result.append(
            {
                "id": g.id,
                "name": g.name,
                "group_type": g.group_type,
                "status": g.status,
                "member_count": member_count,
                "austrac_group_id": g.austrac_group_id,
                "is_holding_org": g.holding_org_id == org_id,
            }
        )
    return result


def validate_group_access(db: Session, group_id: str, org_id: str) -> ReportingGroup:
    return _get_group(db, group_id, org_id)


def _get_group(db: Session, group_id: str, requesting_org_id: str) -> ReportingGroup:
    group = db.query(ReportingGroup).filter_by(id=group_id).first()
    if not group:
        raise HTTPException(404, "Reporting group not found")

    is_member = (
        db.query(ReportingGroupMember)
        .filter_by(group_id=group_id, org_id=requesting_org_id, is_active=True)
        .first()
    )
    if not is_member and group.holding_org_id != requesting_org_id:
        raise HTTPException(403, "Your organisation is not a member of this group")

    return group
