"""
AML/CTF Governance — No-Code Customisation Framework

Allows organisations to extend the governance platform without developer involvement:
  - Custom policy types and categories
  - Custom control categories and risk areas
  - Custom training programs and courses
  - Custom workflow stages and approval routing
  - Custom scoring methodologies (effectiveness thresholds, SLA days)
  - Custom fields on any governance entity
  - Custom dashboard metrics

Architecture:
  GovernanceCustomField      — custom field definitions per entity type
  GovernanceCustomWorkflow   — custom workflow stage definitions
  GovernanceCustomList       — custom list values (risk areas, categories, etc.)
  GovernanceCustomScoring    — override scoring thresholds and SLA values
  GovernanceApprovalMatrix   — approval routing rules per policy type / risk level
  GovernanceDashboardMetric  — custom dashboard metric definitions

DISCLAIMER: This module is a governance tooling aid only.
"""

from __future__ import annotations

import enum
from uuid import uuid4

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    DateTime,
    Enum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)

from app.db.database import Base

# ══════════════════════════════════════════════════════════════════════════════
# ENUMS
# ══════════════════════════════════════════════════════════════════════════════


class EntityType(str, enum.Enum):
    """Governance entities that support custom fields."""

    policy = "policy"
    control = "control"
    control_test = "control_test"
    training_record = "training_record"
    training_course = "training_course"
    risk_assessment_run = "risk_assessment_run"
    remediation_action = "remediation_action"


class CustomFieldType(str, enum.Enum):
    text = "text"
    number = "number"
    date = "date"
    boolean = "boolean"
    select = "select"  # single select from options list
    multi_select = "multi_select"  # multi select from options list
    user = "user"  # user picker (FK to users table)
    document = "document"  # document upload
    url = "url"
    rich_text = "rich_text"  # Markdown / rich text


class ApprovalRole(str, enum.Enum):
    document_owner = "document_owner"
    internal_reviewer = "internal_reviewer"
    compliance_reviewer = "compliance_reviewer"  # 2L / MLRO
    approver = "approver"  # 3L / Board
    any_admin = "any_admin"
    specific_user = "specific_user"  # specific user_id in config


class ListCategory(str, enum.Enum):
    """
    Categories of custom list values organisations can extend.
    Platform enforces base values; custom values are additive.
    """

    risk_area = "risk_area"
    control_category = "control_category"
    business_unit = "business_unit"
    policy_type = "policy_type"
    training_type = "training_type"
    evidence_type = "evidence_type"
    root_cause_category = "root_cause_category"


# ══════════════════════════════════════════════════════════════════════════════
# CUSTOM FIELD DEFINITION
# ══════════════════════════════════════════════════════════════════════════════


class GovernanceCustomField(Base):
    """
    Custom field definition for any governance entity.
    Enables orgs to add their own fields without developer involvement.

    Field values are stored in the entity's `custom_fields` JSON column.
    Example:
      field: {"name": "regulatory_ref", "label": "Internal Reference", "type": "text"}
      stored in policy.custom_fields = {"regulatory_ref": "INT-2026-001"}
    """

    __tablename__ = "governance_custom_fields"

    id = Column(String, primary_key=True, default=lambda: f"gcf_{uuid4().hex[:12]}")
    org_id = Column(
        String,
        ForeignKey("organisations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ── Identity ──────────────────────────────────────────────────────────────
    entity_type = Column(Enum(EntityType), nullable=False, index=True)
    field_name = Column(String(50), nullable=False)
    # internal key used in custom_fields JSON; snake_case; unique per entity_type + org
    label = Column(String(100), nullable=False)
    # display label shown on UI
    description = Column(Text)
    placeholder = Column(String(255))

    # ── Field type ────────────────────────────────────────────────────────────
    field_type = Column(Enum(CustomFieldType), nullable=False)
    options = Column(JSON, default=list)
    # [{"value": "...", "label": "..."}] — for select / multi_select types

    # ── Validation ────────────────────────────────────────────────────────────
    is_required = Column(Boolean, default=False)
    validation_regex = Column(String(255))  # optional regex constraint
    min_value = Column(Float)  # for number fields
    max_value = Column(Float)

    # ── Display ───────────────────────────────────────────────────────────────
    sort_order = Column(Integer, default=0)
    is_visible_in_list = Column(Boolean, default=False)  # show in table/register view
    is_searchable = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)

    created_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


# ══════════════════════════════════════════════════════════════════════════════
# CUSTOM LIST VALUES (extensible reference data)
# ══════════════════════════════════════════════════════════════════════════════


class GovernanceCustomList(Base):
    """
    Organisation-specific custom list values that extend platform enum sets.

    Organisations can add:
      - New risk areas (e.g. "FX Risk", "Crypto Custody Risk")
      - New control categories (e.g. "Regulatory Capital Control")
      - New business units
      - New policy types
      - New training types
      - New evidence types
      - New root cause categories

    Platform base values (from enums) are always available.
    Custom values are additive — they appear alongside base values in dropdowns.
    """

    __tablename__ = "governance_custom_lists"

    id = Column(String, primary_key=True, default=lambda: f"gcl_{uuid4().hex[:12]}")
    org_id = Column(
        String,
        ForeignKey("organisations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    category = Column(Enum(ListCategory), nullable=False, index=True)
    value = Column(String(100), nullable=False)  # internal enum-style key
    label = Column(String(255), nullable=False)  # display label
    description = Column(Text)
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    colour = Column(String(7))  # #RRGGBB — optional UI colour tag

    created_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())


# ══════════════════════════════════════════════════════════════════════════════
# CUSTOM WORKFLOW STAGE
# ══════════════════════════════════════════════════════════════════════════════


class GovernanceCustomWorkflow(Base):
    """
    Custom workflow stage definitions for policy approval and control review.

    Organisations can:
      - Insert additional approval stages (e.g. "Risk Committee Review")
      - Define stage-specific approvers (role or specific user)
      - Set SLA days per stage
      - Mark stages as optional/conditional

    The workflow engine evaluates stages in sort_order. Mandatory stages
    block progression; optional stages can be skipped with a reason.
    """

    __tablename__ = "governance_custom_workflows"

    id = Column(String, primary_key=True, default=lambda: f"gcw_{uuid4().hex[:12]}")
    org_id = Column(
        String,
        ForeignKey("organisations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ── Scope ─────────────────────────────────────────────────────────────────
    workflow_type = Column(String(50), nullable=False)
    # "policy_approval" | "control_review" | "training_sign_off"
    applies_to = Column(JSON, default=list)
    # e.g. for policy_approval: ["aml_ctf_program", "cdd_policy"] (policy_type values)
    # empty list = applies to all

    # ── Stage definition ──────────────────────────────────────────────────────
    stage_name = Column(String(100), nullable=False)
    stage_key = Column(String(50), nullable=False)  # snake_case internal key
    description = Column(Text)
    sort_order = Column(Integer, nullable=False)

    # ── Approver routing ──────────────────────────────────────────────────────
    approver_role = Column(Enum(ApprovalRole), nullable=False)
    specific_user_id = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    # used when approver_role = specific_user

    # ── SLA ───────────────────────────────────────────────────────────────────
    sla_days = Column(Integer, default=5)
    escalation_days = Column(Integer, default=10)
    # escalate to supervisor if not actioned within escalation_days

    # ── Options ───────────────────────────────────────────────────────────────
    is_mandatory = Column(Boolean, default=True)
    requires_comment = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)

    created_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())


# ══════════════════════════════════════════════════════════════════════════════
# CUSTOM SCORING CONFIGURATION
# ══════════════════════════════════════════════════════════════════════════════


class GovernanceCustomScoring(Base):
    """
    Organisation-specific overrides for scoring thresholds and SLA defaults.

    Enables orgs to tune:
      - Control effectiveness thresholds (e.g. raise 'effective' bar to 95%)
      - Finding severity deduction points
      - Remediation SLA days by severity
      - Training health score weightings
      - Policy health score weightings
      - Overall governance health score weightings

    If no override exists for an org, platform defaults are used.
    All formulas remain formula-driven — no hardcoded logic.
    """

    __tablename__ = "governance_custom_scoring"

    id = Column(String, primary_key=True, default=lambda: f"gcs_{uuid4().hex[:12]}")
    org_id = Column(
        String,
        ForeignKey("organisations.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )

    # ── Control effectiveness thresholds (0-100 score → rating) ──────────────
    effectiveness_thresholds = Column(JSON, default=dict)
    # {
    #   "effective": 90.0,           ← score >= this → effective
    #   "largely_effective": 75.0,   ← score >= this → largely_effective
    #   "partially_effective": 50.0, ← score >= this → partially_effective
    #                                ← below → ineffective
    # }

    # ── Finding severity deductions (points deducted per finding) ─────────────
    severity_deductions = Column(JSON, default=dict)
    # {"critical": 50.0, "high": 25.0, "moderate": 10.0, "low": 3.0, "advisory": 0.0}

    # ── Remediation SLA in calendar days by severity ──────────────────────────
    remediation_sla_days = Column(JSON, default=dict)
    # {"critical": 14, "high": 30, "moderate": 60, "low": 90, "advisory": 180}

    # ── Training health score weights (must sum to 1.0) ───────────────────────
    training_health_weights = Column(JSON, default=dict)
    # {"completion_pct": 0.40, "not_overdue_pct": 0.30,
    #  "not_expiry_risk_pct": 0.20, "attestation_pct": 0.10}

    # ── Policy health score weights ────────────────────────────────────────────
    policy_health_weights = Column(JSON, default=dict)
    # {"not_overdue_review_pct": 0.40, "published_pct": 0.30,
    #  "attested_pct": 0.20, "version_current_pct": 0.10}

    # ── Control health score weights ───────────────────────────────────────────
    control_health_weights = Column(JSON, default=dict)
    # {"effective_pct": 0.40, "tested_pct": 0.30,
    #  "no_critical_findings_pct": 0.20, "remediation_current_pct": 0.10}

    # ── Overall governance health weights ──────────────────────────────────────
    governance_health_weights = Column(JSON, default=dict)
    # {"policy_health": 0.30, "control_health": 0.40, "training_health": 0.30}

    updated_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"))
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    created_at = Column(DateTime(timezone=True), server_default=func.now())


# ══════════════════════════════════════════════════════════════════════════════
# APPROVAL MATRIX
# ══════════════════════════════════════════════════════════════════════════════


class GovernanceApprovalMatrix(Base):
    """
    Approval routing matrix — defines who must approve what, based on:
      - Policy type
      - Policy category
      - Risk level (low / medium / high / critical)

    Provides a no-code way for orgs to configure:
      - Board sign-off for high/critical risk policies
      - MLRO approval for all AML/CTF program documents
      - Manager approval for procedural-level changes

    Matrix rows are evaluated in priority order; the first matching row wins.
    """

    __tablename__ = "governance_approval_matrix"

    id = Column(String, primary_key=True, default=lambda: f"gam_{uuid4().hex[:12]}")
    org_id = Column(
        String,
        ForeignKey("organisations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ── Match criteria (null = match all) ─────────────────────────────────────
    policy_type = Column(String(100))  # null = all policy types
    policy_category = Column(String(50))  # null = all categories
    risk_level = Column(String(20))  # null = all risk levels

    # ── Required approvers (evaluated in order) ────────────────────────────────
    required_approver_roles = Column(JSON, default=list)
    # ["compliance_reviewer", "approver"] — all roles must complete their stage

    specific_approver_ids = Column(JSON, default=list)
    # [user_id] — specific users who must approve (in addition to roles)

    # ── SLA ───────────────────────────────────────────────────────────────────
    approval_sla_days = Column(Integer, default=5)
    escalation_sla_days = Column(Integer, default=10)

    # ── Notes ─────────────────────────────────────────────────────────────────
    description = Column(Text)
    priority = Column(Integer, default=0)  # lower = evaluated first
    is_active = Column(Boolean, default=True)

    created_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())


# ══════════════════════════════════════════════════════════════════════════════
# CUSTOM DASHBOARD METRIC
# ══════════════════════════════════════════════════════════════════════════════


class GovernanceDashboardMetric(Base):
    """
    Custom dashboard metric definition.

    Organisations can add their own governance KPIs to the executive dashboard.
    Each metric has a query_formula (JSON-encoded description of the calculation)
    executed by governance_metrics.py.

    Platform standard metrics are seeded and not stored here.
    This table only holds org-specific additions.

    Example custom metric:
      name: "Correspondent Bank Reviews Overdue"
      formula_type: "count"
      entity_type: "control"
      filter: {"risk_area": "outsourcing", "status": "overdue"}
      display_format: "number"
      alert_threshold: 1   (show red if > 1)
    """

    __tablename__ = "governance_dashboard_metrics"

    id = Column(String, primary_key=True, default=lambda: f"gdm_{uuid4().hex[:12]}")
    org_id = Column(
        String,
        ForeignKey("organisations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ── Identity ──────────────────────────────────────────────────────────────
    name = Column(String(100), nullable=False)
    description = Column(Text)
    section = Column(String(50))  # dashboard section to display in

    # ── Formula ───────────────────────────────────────────────────────────────
    formula_type = Column(String(20))  # count | percentage | sum | avg | score
    entity_type = Column(String(50))  # policy | control | training_record | etc.
    filter_config = Column(JSON, default=dict)
    # e.g. {"status": ["overdue", "expired"], "risk_area": "sanctions_screening"}
    numerator_filter = Column(JSON, default=dict)  # for percentage metrics
    denominator_filter = Column(JSON, default=dict)

    # ── Display ───────────────────────────────────────────────────────────────
    display_format = Column(String(20))  # number | percentage | score | boolean
    display_unit = Column(String(20))  # "days", "%", "" etc.
    sort_order = Column(Integer, default=0)

    # ── Thresholds (drive RAG status) ──────────────────────────────────────────
    green_threshold = Column(Float)  # value ≤ this → green
    amber_threshold = Column(Float)  # value ≤ this → amber; above → red
    higher_is_better = Column(Boolean, default=True)
    # True: green when high (e.g. completion %); False: green when low (e.g. overdue count)

    is_active = Column(Boolean, default=True)
    created_by = Column(String, ForeignKey("users.id", ondelete="SET NULL"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
