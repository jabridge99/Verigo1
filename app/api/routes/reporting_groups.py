"""
Phase 9 — Reporting Groups

Multi-entity group structure aligned with AUSTRAC group reporting reforms.
Holding companies can manage subsidiaries, branches, and business units
under a single group with an optional shared AML program.

All routes require the requesting user's org to be a group member.
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import (
    get_current_user, require_admin, require_mlro_or_above,
    require_compliance_or_above, require_analyst_or_above, get_db,
)
from app.models.user import User
from app.models.reporting_group import (
    ReportingGroup, ReportingGroupMember,
    ReportingGroupStatus, GroupType, GroupMemberRole,
)
from app.services import reporting_group_service

router = APIRouter(prefix="/reporting-groups", tags=["Reporting Groups"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class CreateGroupRequest(BaseModel):
    name: str
    group_type: GroupType = GroupType.holding_company
    austrac_group_id: Optional[str] = None
    shared_aml_program_id: Optional[str] = None


class AddMemberRequest(BaseModel):
    org_id: str
    member_role: GroupMemberRole = GroupMemberRole.subsidiary
    jurisdiction: Optional[str] = None


class UpdateGroupRequest(BaseModel):
    name: Optional[str] = None
    status: Optional[ReportingGroupStatus] = None
    austrac_group_id: Optional[str] = None
    shared_aml_program_id: Optional[str] = None


class AssignAMLProgramRequest(BaseModel):
    shared_aml_program_id: str


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/", summary="Create a reporting group")
def create_group(
    body: CreateGroupRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_mlro_or_above),
):
    group = reporting_group_service.create_group(
        db=db,
        name=body.name,
        group_type=body.group_type,
        holding_org_id=current_user.org_id,
        austrac_group_id=body.austrac_group_id,
        shared_aml_program_id=body.shared_aml_program_id,
        created_by=current_user.id,
    )
    return {"id": group.id, "name": group.name, "status": group.status, "holding_org_id": group.holding_org_id}


@router.get("/", summary="List reporting groups for current org")
def list_groups(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    return reporting_group_service.list_groups(db, current_user.org_id)


@router.get("/{group_id}", summary="Get group detail and member list")
def get_group(
    group_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    group = reporting_group_service.validate_group_access(db, group_id, current_user.org_id)
    members = db.query(ReportingGroupMember).filter_by(group_id=group_id, is_active=True).all()
    return {
        "id": group.id,
        "name": group.name,
        "group_type": group.group_type,
        "status": group.status,
        "holding_org_id": group.holding_org_id,
        "austrac_group_id": group.austrac_group_id,
        "shared_aml_program_id": group.shared_aml_program_id,
        "created_at": group.created_at.isoformat() if group.created_at else None,
        "members": [
            {
                "id": m.id,
                "org_id": m.org_id,
                "member_role": m.member_role,
                "jurisdiction": m.jurisdiction,
                "joined_at": m.joined_at.isoformat() if m.joined_at else None,
            }
            for m in members
        ],
    }


@router.patch("/{group_id}", summary="Update group details")
def update_group(
    group_id: str,
    body: UpdateGroupRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_mlro_or_above),
):
    group = reporting_group_service.validate_group_access(db, group_id, current_user.org_id)
    if group.holding_org_id != current_user.org_id:
        raise HTTPException(403, "Only the holding organisation can update group details")

    if body.name is not None:
        group.name = body.name
    if body.status is not None:
        group.status = body.status
    if body.austrac_group_id is not None:
        group.austrac_group_id = body.austrac_group_id
    if body.shared_aml_program_id is not None:
        group.shared_aml_program_id = body.shared_aml_program_id

    db.commit()
    db.refresh(group)
    return {"id": group.id, "name": group.name, "status": group.status}


@router.post("/{group_id}/members", summary="Add a subsidiary organisation to the group")
def add_member(
    group_id: str,
    body: AddMemberRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_mlro_or_above),
):
    member = reporting_group_service.add_member(
        db=db,
        group_id=group_id,
        org_id=body.org_id,
        member_role=body.member_role,
        jurisdiction=body.jurisdiction,
        requesting_org_id=current_user.org_id,
    )
    return {
        "id": member.id,
        "group_id": member.group_id,
        "org_id": member.org_id,
        "member_role": member.member_role,
        "jurisdiction": member.jurisdiction,
    }


@router.delete("/{group_id}/members/{org_id}", summary="Remove a member organisation from the group")
def remove_member(
    group_id: str,
    org_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_mlro_or_above),
):
    return reporting_group_service.remove_member(db, group_id, org_id, current_user.org_id)


@router.get("/{group_id}/dashboard", summary="Group-level aggregated dashboard")
def group_dashboard(
    group_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_analyst_or_above),
):
    return reporting_group_service.get_group_dashboard(db, group_id, current_user.org_id)


@router.put("/{group_id}/aml-program", summary="Assign or update the shared AML program for this group")
def assign_aml_program(
    group_id: str,
    body: AssignAMLProgramRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_mlro_or_above),
):
    group = reporting_group_service.validate_group_access(db, group_id, current_user.org_id)
    if group.holding_org_id != current_user.org_id:
        raise HTTPException(403, "Only the holding organisation can assign the shared AML program")
    group.shared_aml_program_id = body.shared_aml_program_id
    db.commit()
    return {"group_id": group.id, "shared_aml_program_id": group.shared_aml_program_id}


@router.get("/{group_id}/aml-program", summary="Get the shared AML program for this group")
def get_aml_program(
    group_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_compliance_or_above),
):
    group = reporting_group_service.validate_group_access(db, group_id, current_user.org_id)
    return {
        "group_id": group.id,
        "shared_aml_program_id": group.shared_aml_program_id,
    }


@router.get("/enums/values", summary="Enum values for dropdowns")
def get_enums():
    return {
        "group_types": [e.value for e in GroupType],
        "member_roles": [e.value for e in GroupMemberRole],
        "statuses": [e.value for e in ReportingGroupStatus],
    }
