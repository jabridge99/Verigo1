"""split_p47_duplicate_enum_types

P47: fixing P37's `ControlStatus` collision surfaced the same bug pattern
8 more times across the model layer -- a Python enum class name reused
across two (AssessmentStatus: three) unrelated model files, neither
column giving its Postgres type an explicit name, so each group silently
shared one underlying type. Confirmed live (via the same fresh-Postgres
reproduction used for P37) that the shared type only ever carries ONE
side's values -- whichever table SQLAlchemy's metadata-sorted
`create_all()` processes first. `CustomerType` was confirmed as a second
live, active bug: `customer.py`'s 7 values won the shared `customertype`
type, so `onboarding.py`'s `"business"` value -- written by every
business-entity (as opposed to individual) onboarding session -- has been
failing to insert.

The 8 splits, each independently idempotent for the same reason as P37's:

  old shared type       -> split into
  --------------------     -----------------------------------------------
  alertstatus           -> transaction_alert_status, screening_alert_status
  assessmentstatus       -> legacy_risk_assessment_status,
                             professional_assessment_status,
                             risk_assessment_run_status
  customertype           -> master_customer_type, onboarding_customer_type
  notetype                -> case_note_type, customer_note_type
  recommendationpriority -> review_recommendation_priority,
                             regulatory_recommendation_priority
  recommendationstatus   -> review_recommendation_status,
                             regulatory_recommendation_status
  reviewoutcome           -> customer_review_outcome,
                             professional_review_outcome
  trainingstatus          -> legacy_training_status,
                             governance_training_status

Same idempotency shape as P37's 96e0b54fc153: on a database that already
has the old shared type, upgrade() splits it. On a database built fresh
*after* this fix, the baseline migration's `Base.metadata.create_all()`
reads the now-fixed models directly and creates the split types itself --
there's no shared type to find, so that group's split is a no-op.
downgrade() mirrors the same check in reverse, per group.

Revision ID: 0d8a1fc0b65b
Revises: 96e0b54fc153
Create Date: 2026-09-11
"""

import sqlalchemy as sa

from alembic import op

revision = "0d8a1fc0b65b"
down_revision = "96e0b54fc153"
branch_labels = None
depends_on = None

# Each entry: (old shared type name, [(new type name, values, [(table, column), ...]), ...])
SPLITS = [
    (
        "alertstatus",
        [
            (
                "transaction_alert_status",
                (
                    "generated",
                    "assigned",
                    "under_review",
                    "escalated",
                    "dismissed",
                    "resolved",
                    "smr_candidate",
                ),
                [("transaction_alerts", "status")],
            ),
            (
                "screening_alert_status",
                (
                    "open",
                    "under_review",
                    "dismissed",
                    "escalated",
                    "smr_filed",
                    "closed",
                ),
                [
                    ("screening_alerts", "status"),
                    ("adverse_media_results", "review_status"),
                ],
            ),
        ],
    ),
    (
        "assessmentstatus",
        [
            (
                "legacy_risk_assessment_status",
                ("draft", "in_progress", "completed", "approved"),
                [("risk_assessments", "status")],
            ),
            (
                "professional_assessment_status",
                ("draft", "in_progress", "pending_review", "completed", "escalated"),
                [("professional_assessments", "status")],
            ),
            (
                "risk_assessment_run_status",
                ("draft", "in_progress", "completed", "approved", "archived"),
                [("risk_assessment_runs", "status")],
            ),
        ],
    ),
    (
        "customertype",
        [
            (
                "master_customer_type",
                (
                    "individual",
                    "sole_trader",
                    "company",
                    "trust",
                    "partnership",
                    "association",
                    "government",
                ),
                [("customers", "customer_type")],
            ),
            (
                "onboarding_customer_type",
                ("individual", "business"),
                [("onboarding_sessions", "customer_type")],
            ),
        ],
    ),
    (
        "notetype",
        [
            (
                "case_note_type",
                (
                    "investigation_note",
                    "evidence_summary",
                    "escalation_note",
                    "mlro_decision",
                    "legal_advice",
                    "customer_contact",
                    "third_party_information",
                    "smr_consideration",
                    "closure_note",
                    "general",
                ),
                [("case_notes", "note_type")],
            ),
            (
                "customer_note_type",
                (
                    "general",
                    "compliance",
                    "edd_justification",
                    "review_outcome",
                    "escalation",
                    "alert_disposition",
                ),
                [("customer_notes", "note_type")],
            ),
        ],
    ),
    (
        "recommendationpriority",
        [
            (
                "review_recommendation_priority",
                ("immediate", "short_term", "medium_term", "long_term"),
                [("review_recommendations", "priority")],
            ),
            (
                "regulatory_recommendation_priority",
                ("low", "normal", "high", "urgent"),
                [("regulatory_recommendations", "priority")],
            ),
        ],
    ),
    (
        "recommendationstatus",
        [
            (
                "review_recommendation_status",
                ("open", "accepted", "rejected", "in_progress", "completed", "overdue"),
                [("review_recommendations", "status")],
            ),
            (
                "regulatory_recommendation_status",
                ("pending", "actioned", "dismissed", "superseded"),
                [("regulatory_recommendations", "status")],
            ),
        ],
    ),
    (
        "reviewoutcome",
        [
            (
                "customer_review_outcome",
                (
                    "no_change",
                    "risk_upgraded",
                    "risk_downgraded",
                    "edd_triggered",
                    "relationship_exited",
                    "smr_filed",
                ),
                [("customer_reviews", "outcome")],
            ),
            (
                "professional_review_outcome",
                (
                    "satisfactory",
                    "satisfactory_with_notes",
                    "further_info_required",
                    "unsatisfactory",
                    "escalated",
                    "not_reviewed",
                ),
                [
                    ("sof_assessments", "review_outcome"),
                    ("sow_assessments", "review_outcome"),
                    ("transaction_purpose_assessments", "review_outcome"),
                    ("investment_legitimacy_assessments", "review_outcome_status"),
                ],
            ),
        ],
    ),
    (
        "trainingstatus",
        [
            (
                "legacy_training_status",
                ("not_started", "in_progress", "completed", "overdue"),
                [("training_records", "status")],
            ),
            (
                "governance_training_status",
                (
                    "assigned",
                    "in_progress",
                    "completed",
                    "expired",
                    "overdue",
                    "exempt",
                ),
                [("governance_training_records", "status")],
            ),
        ],
    ),
]


def _pg_type_exists(bind, name: str) -> bool:
    return (
        bind.execute(
            sa.text("SELECT 1 FROM pg_type WHERE typname = :name"), {"name": name}
        ).first()
        is not None
    )


def _create_enum_type(name: str, values: tuple[str, ...]) -> None:
    op.execute(f"CREATE TYPE {name} AS ENUM ({', '.join(repr(v) for v in values)})")


def _retype_column(table: str, column: str, new_type: str) -> None:
    op.execute(
        f"ALTER TABLE {table} ALTER COLUMN {column} TYPE {new_type} "
        f"USING {column}::text::{new_type}"
    )


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        # SQLite (and this repo's test suite) has no shared named enum
        # types -- Enum() is emulated per-column as a CHECK constraint, so
        # there's nothing to split there.
        return

    for old_type, targets in SPLITS:
        if not _pg_type_exists(bind, old_type):
            # Nothing to split: a fresh database built after this fix
            # already gets the split types straight from the baseline
            # migration's create_all() reading the current (fixed) models.
            continue

        for new_type, values, columns in targets:
            _create_enum_type(new_type, values)
            for table, column in columns:
                _retype_column(table, column, new_type)

        op.execute(f"DROP TYPE {old_type}")


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name != "postgresql":
        return

    for old_type, targets in SPLITS:
        if _pg_type_exists(bind, old_type):
            # upgrade() was a no-op for this group (fresh-baseline path).
            continue
        if not all(_pg_type_exists(bind, new_type) for new_type, _, _ in targets):
            # Neither split state nor pre-split state -- unexpected, skip.
            continue

        all_values: list[str] = []
        for _, values, _ in targets:
            for v in values:
                if v not in all_values:
                    all_values.append(v)
        _create_enum_type(old_type, tuple(all_values))

        for new_type, _, columns in targets:
            for table, column in columns:
                _retype_column(table, column, old_type)
            op.execute(f"DROP TYPE {new_type}")
