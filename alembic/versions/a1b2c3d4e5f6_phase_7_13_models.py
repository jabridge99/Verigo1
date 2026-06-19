"""Phase 7-13: reporting_groups, customer_portal, training_triggers,
examination_packs, benchmarks, board_reports, independent_reviews

Revision ID: a1b2c3d4e5f6
Revises: 2f7497ed4d5b
Create Date: 2026-06-16 00:00:00.000000
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, None] = "2f7497ed4d5b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Reporting Groups ──────────────────────────────────────────────────────
    op.create_table(
        "reporting_groups",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("org_id", sa.String(), sa.ForeignKey("organisations.id"), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("status", sa.String(30), nullable=False, server_default="active"),
        sa.Column("group_type", sa.String(50), nullable=False),
        sa.Column("holding_org_id", sa.String(), sa.ForeignKey("organisations.id"), nullable=True),
        sa.Column("shared_aml_program_id", sa.String(), nullable=True),
        sa.Column("austrac_group_id", sa.String(100), nullable=True),
        sa.Column("created_by", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_reporting_groups_org_id", "reporting_groups", ["org_id"])

    op.create_table(
        "reporting_group_members",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("group_id", sa.String(), sa.ForeignKey("reporting_groups.id"), nullable=False),
        sa.Column("org_id", sa.String(), sa.ForeignKey("organisations.id"), nullable=False),
        sa.Column("member_role", sa.String(50), nullable=False),
        sa.Column("jurisdiction", sa.String(10), nullable=True),
        sa.Column("joined_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("left_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_rgm_group_id", "reporting_group_members", ["group_id"])
    op.create_index("ix_rgm_org_id", "reporting_group_members", ["org_id"])

    # ── Customer Portal ───────────────────────────────────────────────────────
    op.create_table(
        "customer_portal_sessions",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("org_id", sa.String(), sa.ForeignKey("organisations.id"), nullable=False),
        sa.Column("customer_id", sa.String(), nullable=True),
        sa.Column("token_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("invited_by", sa.String(), nullable=True),
        sa.Column("status", sa.String(30), nullable=False, server_default="pending"),
        sa.Column("portal_type", sa.String(20), nullable=False, server_default="cdd"),
        sa.Column("required_documents", sa.JSON(), nullable=True),
        sa.Column("required_questionnaire_sections", sa.JSON(), nullable=True),
        sa.Column("customer_email", sa.String(254), nullable=True),
        sa.Column("customer_name", sa.String(200), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_activity_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_portal_sessions_org_id", "customer_portal_sessions", ["org_id"])
    op.create_index("ix_portal_sessions_token_hash", "customer_portal_sessions", ["token_hash"], unique=True)
    op.create_index("ix_portal_sessions_customer_id", "customer_portal_sessions", ["customer_id"])

    op.create_table(
        "customer_portal_documents",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("session_id", sa.String(), sa.ForeignKey("customer_portal_sessions.id"), nullable=False),
        sa.Column("document_category", sa.String(100), nullable=False),
        sa.Column("original_filename", sa.String(500), nullable=True),
        sa.Column("stored_path", sa.String(1000), nullable=True),
        sa.Column("mime_type", sa.String(100), nullable=True),
        sa.Column("file_size_bytes", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(30), nullable=False, server_default="pending"),
        sa.Column("uploaded_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reviewed_by", sa.String(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("rejection_reason", sa.String(500), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_portal_docs_session_id", "customer_portal_documents", ["session_id"])

    op.create_table(
        "customer_portal_questionnaire_responses",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("session_id", sa.String(), sa.ForeignKey("customer_portal_sessions.id"), nullable=False),
        sa.Column("section_key", sa.String(100), nullable=False),
        sa.Column("responses", sa.JSON(), nullable=True),
        sa.Column("completed", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("submitted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("session_id", "section_key", name="uq_portal_qr_session_section"),
    )
    op.create_index("ix_portal_qr_session_id", "customer_portal_questionnaire_responses", ["session_id"])

    # ── Training Triggers ─────────────────────────────────────────────────────
    op.create_table(
        "training_trigger_rules",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("org_id", sa.String(), sa.ForeignKey("organisations.id"), nullable=False),
        sa.Column("solution_id", sa.String(), nullable=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("description", sa.String(1000), nullable=True),
        sa.Column("event_type", sa.String(60), nullable=False),
        sa.Column("condition_filter", sa.JSON(), nullable=True),
        sa.Column("course_id", sa.String(200), nullable=True),
        sa.Column("course_name", sa.String(200), nullable=True),
        sa.Column("target_type", sa.String(50), nullable=False),
        sa.Column("target_users", sa.JSON(), nullable=True),
        sa.Column("due_days", sa.Integer(), nullable=False, server_default="14"),
        sa.Column("cooldown_days", sa.Integer(), nullable=False, server_default="90"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("is_system", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("override_system", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_by", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ttr_org_id", "training_trigger_rules", ["org_id"])
    op.create_index("ix_ttr_event_type", "training_trigger_rules", ["event_type"])

    op.create_table(
        "training_trigger_logs",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("org_id", sa.String(), sa.ForeignKey("organisations.id"), nullable=False),
        sa.Column("rule_id", sa.String(), sa.ForeignKey("training_trigger_rules.id"), nullable=False),
        sa.Column("event_type", sa.String(60), nullable=False),
        sa.Column("entity_type", sa.String(100), nullable=True),
        sa.Column("entity_id", sa.String(), nullable=True),
        sa.Column("entity_snapshot", sa.JSON(), nullable=True),
        sa.Column("handled_by_user_id", sa.String(), nullable=True),
        sa.Column("fired_by", sa.String(), nullable=True),
        sa.Column("assignments_created", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("users_assigned", sa.JSON(), nullable=True),
        sa.Column("skipped_users", sa.JSON(), nullable=True),
        sa.Column("fired_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ttl_org_id", "training_trigger_logs", ["org_id"])
    op.create_index("ix_ttl_rule_id", "training_trigger_logs", ["rule_id"])

    op.create_table(
        "regulatory_update_events",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("org_id", sa.String(), sa.ForeignKey("organisations.id"), nullable=False),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("summary", sa.String(2000), nullable=True),
        sa.Column("issuing_body", sa.String(100), nullable=True),
        sa.Column("update_type", sa.String(100), nullable=True),
        sa.Column("affected_industries", sa.JSON(), nullable=True),
        sa.Column("affected_roles", sa.JSON(), nullable=True),
        sa.Column("linked_course_id", sa.String(200), nullable=True),
        sa.Column("auto_assign_training", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("is_urgent", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("compliance_deadline", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(30), nullable=False, server_default="draft"),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("published_by", sa.String(), nullable=True),
        sa.Column("created_by", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_rue_org_id", "regulatory_update_events", ["org_id"])

    op.create_table(
        "assessment_outcome_flags",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("org_id", sa.String(), sa.ForeignKey("organisations.id"), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("assessment_type", sa.String(100), nullable=False),
        sa.Column("assessment_id", sa.String(), nullable=True),
        sa.Column("outcome", sa.String(50), nullable=False),
        sa.Column("linked_entity_type", sa.String(100), nullable=True),
        sa.Column("linked_entity_id", sa.String(), nullable=True),
        sa.Column("flag_reason", sa.String(500), nullable=True),
        sa.Column("requires_oversight", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("oversight_user_id", sa.String(), nullable=True),
        sa.Column("oversight_note", sa.String(1000), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(30), nullable=False, server_default="open"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_aof_org_id", "assessment_outcome_flags", ["org_id"])
    op.create_index("ix_aof_user_id", "assessment_outcome_flags", ["user_id"])

    # ── Examination Packs ─────────────────────────────────────────────────────
    op.create_table(
        "examination_packs",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("org_id", sa.String(), sa.ForeignKey("organisations.id"), nullable=False),
        sa.Column("pack_ref", sa.String(50), nullable=False),
        sa.Column("period_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("period_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column("sections", sa.JSON(), nullable=True),
        sa.Column("examiner_name", sa.String(200), nullable=True),
        sa.Column("examiner_agency", sa.String(200), nullable=True),
        sa.Column("examination_ref", sa.String(100), nullable=True),
        sa.Column("status", sa.String(30), nullable=False, server_default="draft"),
        sa.Column("requested_by", sa.String(), nullable=True),
        sa.Column("generated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("delivered_by", sa.String(), nullable=True),
        sa.Column("delivery_notes", sa.String(1000), nullable=True),
        sa.Column("snapshot_data", sa.JSON(), nullable=True),
        sa.Column("summary_metrics", sa.JSON(), nullable=True),
        sa.Column("generation_errors", sa.JSON(), nullable=True),
        sa.Column("is_confidential", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("version", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_exam_packs_org_id", "examination_packs", ["org_id"])
    op.create_index("ix_exam_packs_pack_ref", "examination_packs", ["pack_ref"])

    # ── Benchmarking ──────────────────────────────────────────────────────────
    op.create_table(
        "org_metrics_snapshots",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("org_id", sa.String(), sa.ForeignKey("organisations.id"), nullable=False),
        sa.Column("industry", sa.String(100), nullable=True),
        sa.Column("period", sa.String(20), nullable=False),
        sa.Column("period_label", sa.String(20), nullable=False),
        sa.Column("period_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("period_end", sa.DateTime(timezone=True), nullable=False),
        # Metric columns
        sa.Column("total_customers", sa.Integer(), nullable=True),
        sa.Column("smr_rate_per_1k", sa.Float(), nullable=True),
        sa.Column("ifti_volume", sa.Integer(), nullable=True),
        sa.Column("ttr_volume", sa.Integer(), nullable=True),
        sa.Column("alert_to_smr_pct", sa.Float(), nullable=True),
        sa.Column("training_completion_pct", sa.Float(), nullable=True),
        sa.Column("training_overdue_pct", sa.Float(), nullable=True),
        sa.Column("high_risk_customer_pct", sa.Float(), nullable=True),
        sa.Column("edd_escalation_pct", sa.Float(), nullable=True),
        sa.Column("cdd_completion_pct", sa.Float(), nullable=True),
        sa.Column("open_alert_pct", sa.Float(), nullable=True),
        sa.Column("policy_review_on_time_pct", sa.Float(), nullable=True),
        sa.Column("control_effectiveness_pct", sa.Float(), nullable=True),
        sa.Column("avg_case_days", sa.Float(), nullable=True),
        sa.Column("pep_customer_pct", sa.Float(), nullable=True),
        sa.Column("sanctions_match_pct", sa.Float(), nullable=True),
        sa.Column("raw_counts", sa.JSON(), nullable=True),
        sa.Column("captured_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("captured_by", sa.String(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_oms_org_id", "org_metrics_snapshots", ["org_id"])
    op.create_index("ix_oms_period_label", "org_metrics_snapshots", ["org_id", "period_label"])

    op.create_table(
        "industry_benchmarks",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("industry", sa.String(100), nullable=False),
        sa.Column("metric", sa.String(100), nullable=False),
        sa.Column("period_label", sa.String(20), nullable=False),
        sa.Column("period_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("period_end", sa.DateTime(timezone=True), nullable=False),
        sa.Column("org_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("mean", sa.Float(), nullable=True),
        sa.Column("std_dev", sa.Float(), nullable=True),
        sa.Column("minimum", sa.Float(), nullable=True),
        sa.Column("p25", sa.Float(), nullable=True),
        sa.Column("median", sa.Float(), nullable=True),
        sa.Column("p75", sa.Float(), nullable=True),
        sa.Column("maximum", sa.Float(), nullable=True),
        sa.Column("is_published", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("computed_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("industry", "metric", "period_label", name="uq_benchmark_industry_metric_period"),
    )
    op.create_index("ix_ib_industry_period", "industry_benchmarks", ["industry", "period_label"])

    # ── Board Reports ─────────────────────────────────────────────────────────
    op.create_table(
        "board_reports",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("org_id", sa.String(), sa.ForeignKey("organisations.id"), nullable=False),
        sa.Column("report_ref", sa.String(50), nullable=True),
        sa.Column("report_type", sa.String(50), nullable=False),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("period_start", sa.DateTime(timezone=True), nullable=True),
        sa.Column("period_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("period_label", sa.String(100), nullable=True),
        sa.Column("status", sa.String(30), nullable=False, server_default="draft"),
        sa.Column("sections", sa.JSON(), nullable=True),
        sa.Column("executive_summary", sa.String(5000), nullable=True),
        sa.Column("key_metrics", sa.JSON(), nullable=True),
        sa.Column("risk_highlights", sa.JSON(), nullable=True),
        sa.Column("recommendations", sa.JSON(), nullable=True),
        sa.Column("prepared_by", sa.String(), nullable=True),
        sa.Column("reviewed_by", sa.String(), nullable=True),
        sa.Column("approved_by", sa.String(), nullable=True),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("presented_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("board_minutes_ref", sa.String(200), nullable=True),
        sa.Column("is_confidential", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_board_reports_org_id", "board_reports", ["org_id"])

    # ── Independent Review ────────────────────────────────────────────────────
    op.create_table(
        "independent_reviews",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("org_id", sa.String(), sa.ForeignKey("organisations.id"), nullable=False),
        sa.Column("review_ref", sa.String(50), nullable=True),
        sa.Column("review_type", sa.String(50), nullable=False),
        sa.Column("scope", sa.String(50), nullable=True),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("period_start", sa.DateTime(timezone=True), nullable=True),
        sa.Column("period_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(30), nullable=False, server_default="planning"),
        sa.Column("overall_rating", sa.String(30), nullable=True),
        sa.Column("reviewer_name", sa.String(200), nullable=True),
        sa.Column("reviewer_firm", sa.String(200), nullable=True),
        sa.Column("reviewer_credentials", sa.String(500), nullable=True),
        sa.Column("commissioned_by", sa.String(), nullable=True),
        sa.Column("scope_narrative", sa.String(5000), nullable=True),
        sa.Column("methodology", sa.String(5000), nullable=True),
        sa.Column("executive_summary", sa.String(10000), nullable=True),
        sa.Column("management_response", sa.String(5000), nullable=True),
        sa.Column("commenced_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("fieldwork_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("draft_issued_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("final_issued_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("next_review_due", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_confidential", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ir_org_id", "independent_reviews", ["org_id"])

    op.create_table(
        "review_findings",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("review_id", sa.String(), sa.ForeignKey("independent_reviews.id"), nullable=False),
        sa.Column("org_id", sa.String(), nullable=False),
        sa.Column("finding_ref", sa.String(30), nullable=True),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("description", sa.String(5000), nullable=True),
        sa.Column("finding_risk", sa.String(30), nullable=True),
        sa.Column("category", sa.String(50), nullable=True),
        sa.Column("status", sa.String(30), nullable=False, server_default="open"),
        sa.Column("regulatory_reference", sa.String(500), nullable=True),
        sa.Column("evidence", sa.String(5000), nullable=True),
        sa.Column("management_response", sa.String(2000), nullable=True),
        sa.Column("target_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_rf_review_id", "review_findings", ["review_id"])

    op.create_table(
        "review_recommendations",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("review_id", sa.String(), sa.ForeignKey("independent_reviews.id"), nullable=False),
        sa.Column("finding_id", sa.String(), sa.ForeignKey("review_findings.id"), nullable=True),
        sa.Column("org_id", sa.String(), nullable=False),
        sa.Column("recommendation_ref", sa.String(30), nullable=True),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("description", sa.String(3000), nullable=True),
        sa.Column("priority", sa.String(30), nullable=True),
        sa.Column("status", sa.String(30), nullable=False, server_default="open"),
        sa.Column("assigned_to", sa.String(), nullable=True),
        sa.Column("target_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_rr_review_id", "review_recommendations", ["review_id"])

    op.create_table(
        "review_actions",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("review_id", sa.String(), sa.ForeignKey("independent_reviews.id"), nullable=False),
        sa.Column("recommendation_id", sa.String(), sa.ForeignKey("review_recommendations.id"), nullable=True),
        sa.Column("org_id", sa.String(), nullable=False),
        sa.Column("action_type", sa.String(50), nullable=True),
        sa.Column("description", sa.String(2000), nullable=False),
        sa.Column("assigned_to", sa.String(), nullable=True),
        sa.Column("status", sa.String(30), nullable=False, server_default="pending"),
        sa.Column("due_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completion_note", sa.String(1000), nullable=True),
        sa.Column("verified_by", sa.String(), nullable=True),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ra_review_id", "review_actions", ["review_id"])

    # ── Task Management ───────────────────────────────────────────────────────
    op.create_table(
        "tasks",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("org_id", sa.String(), sa.ForeignKey("organisations.id"), nullable=False),
        sa.Column("task_type", sa.String(50), nullable=False),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("description", sa.String(3000), nullable=True),
        sa.Column("status", sa.String(30), nullable=False, server_default="open"),
        sa.Column("priority", sa.String(20), nullable=False, server_default="medium"),
        sa.Column("assigned_to", sa.String(), nullable=True),
        sa.Column("assigned_by", sa.String(), nullable=True),
        sa.Column("due_date", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("object_type", sa.String(100), nullable=True),
        sa.Column("object_id", sa.String(), nullable=True),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_tasks_org_id", "tasks", ["org_id"])
    op.create_index("ix_tasks_assigned_to", "tasks", ["assigned_to"])

    op.create_table(
        "task_events",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("task_id", sa.String(), sa.ForeignKey("tasks.id"), nullable=False),
        sa.Column("org_id", sa.String(), nullable=False),
        sa.Column("event_type", sa.String(50), nullable=False),
        sa.Column("actor_id", sa.String(), nullable=True),
        sa.Column("note", sa.String(2000), nullable=True),
        sa.Column("old_value", sa.JSON(), nullable=True),
        sa.Column("new_value", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_task_events_task_id", "task_events", ["task_id"])

    # ── Documents ─────────────────────────────────────────────────────────────
    op.create_table(
        "documents",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("org_id", sa.String(), sa.ForeignKey("organisations.id"), nullable=False),
        sa.Column("category", sa.String(100), nullable=False),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("description", sa.String(1000), nullable=True),
        sa.Column("status", sa.String(30), nullable=False, server_default="active"),
        sa.Column("original_filename", sa.String(500), nullable=True),
        sa.Column("stored_path", sa.String(1000), nullable=True),
        sa.Column("mime_type", sa.String(100), nullable=True),
        sa.Column("file_size_bytes", sa.Integer(), nullable=True),
        sa.Column("checksum", sa.String(64), nullable=True),
        sa.Column("object_type", sa.String(100), nullable=True),
        sa.Column("object_id", sa.String(), nullable=True),
        sa.Column("uploaded_by", sa.String(), nullable=True),
        sa.Column("retention_category", sa.String(50), nullable=True),
        sa.Column("retain_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_by", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), onupdate=sa.func.now()),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_documents_org_id", "documents", ["org_id"])
    op.create_index("ix_documents_object", "documents", ["object_type", "object_id"])


def downgrade() -> None:
    op.drop_table("task_events")
    op.drop_table("tasks")
    op.drop_table("documents")
    op.drop_table("review_actions")
    op.drop_table("review_recommendations")
    op.drop_table("review_findings")
    op.drop_table("independent_reviews")
    op.drop_table("board_reports")
    op.drop_table("industry_benchmarks")
    op.drop_table("org_metrics_snapshots")
    op.drop_table("examination_packs")
    op.drop_table("assessment_outcome_flags")
    op.drop_table("regulatory_update_events")
    op.drop_table("training_trigger_logs")
    op.drop_table("training_trigger_rules")
    op.drop_table("customer_portal_questionnaire_responses")
    op.drop_table("customer_portal_documents")
    op.drop_table("customer_portal_sessions")
    op.drop_table("reporting_group_members")
    op.drop_table("reporting_groups")
