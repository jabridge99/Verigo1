"""
Smoke test for Critical #11 (scoped): most FKs referencing organisations.id
and users.id had no ondelete= clause, defaulting to Postgres's
NO ACTION/RESTRICT — deleting an org or user blocked on any referencing row.
SQLite ignores FK constraints by default so this can't be caught by an
end-to-end delete test in this suite; instead it asserts the ondelete=
attribute is actually set on the SQLAlchemy ForeignKey objects, mirroring
the corresponding Alembic migration
(c7d8e9f0a1b2_org_scoped_fk_ondelete.py).
"""

import app.models  # noqa: F401 ensures all models are registered
from app.db.database import Base


def _ondelete_map():
    mapping = {}
    for table in Base.metadata.sorted_tables:
        for col in table.columns:
            for fk in col.foreign_keys:
                target = str(fk.column.table.name)
                if target in ("organisations", "users"):
                    mapping[(table.name, col.name)] = fk.ondelete
    return mapping


def test_organisations_fks_cascade_on_delete():
    mapping = _ondelete_map()
    samples = [
        ("aml_programs", "org_id"),
        ("control_remediation_actions", "org_id"),
        ("governance_policies", "org_id"),
        ("documents", "organisation_id"),
        ("users", "org_id"),
        ("training_courses", "org_id"),
    ]
    for table, col in samples:
        assert mapping[(table, col)] == "CASCADE", f"{table}.{col} should CASCADE"


def test_nullable_actor_fks_set_null_on_delete():
    mapping = _ondelete_map()
    samples = [
        ("governance_controls", "reviewer_id"),
        ("governance_controls", "auditor_id"),
        ("control_remediation_actions", "closed_by"),
        ("governance_policies", "approver"),
        ("users", "primary_organisation_id"),
        ("training_courses", "created_by"),
    ]
    for table, col in samples:
        assert mapping[(table, col)] == "SET NULL", f"{table}.{col} should SET NULL"
