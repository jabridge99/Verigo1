from typing import Optional

from pydantic import BaseModel

from app.models.reporting_group import GroupMemberRole, GroupType, ReportingGroupStatus


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
