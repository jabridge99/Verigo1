"""
P37: app/models/aml_solution.py's Control.status and
app/models/governance_controls.py's GovernanceControl.status each declared
their own, differently-valued ControlStatus enum, but neither column gave
it an explicit Postgres type name -- so both silently shared one
underlying `controlstatus` type. On a database built from this repo's
migration chain, aml_solution.py's four values (effective/
partially_effective/ineffective/not_tested) won the type, which doesn't
include "active" -- the one value org_service.py's
_seed_aml_solution_and_risk_framework() always writes when seeding a new
org's governance controls. Every real new-org registration's
GovernanceControl insert was failing with
psycopg2.errors.InvalidTextRepresentation wherever a database was
actually built from this migration chain (confirmed live against a fresh
PostgreSQL 16 database in this session: POST /api/v1/auth/register 500s
before this fix, 201s after, with 9 real GovernanceControl rows seeded).

This repo's own test suite runs on SQLite (tests/conftest.py), which has
no shared named Postgres enum types at all -- Enum() is emulated per
column as a local CHECK constraint -- so the collision itself can't be
reproduced by a normal pytest DB test here. These tests instead guard the
two things that actually prevent it: the model columns now carry
explicit, distinct type names, and the migration's hardcoded value lists
stay in sync with the real model enums (SQLite is unaffected, so a
regular pytest test is the right level -- the actual Postgres DDL was
verified live, not just here).
"""

import importlib.util
import os

from app.models.aml_solution import Control
from app.models.aml_solution import ControlStatus as LegacyControlStatus
from app.models.governance_controls import ControlStatus as GovernanceControlStatus
from app.models.governance_controls import GovernanceControl

_MIGRATION_PATH = os.path.join(
    os.path.dirname(__file__),
    "..",
    "alembic",
    "versions",
    "96e0b54fc153_split_controlstatus_enum_type.py",
)
_spec = importlib.util.spec_from_file_location("p37_migration", _MIGRATION_PATH)
migration = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(migration)


def test_governance_control_status_column_has_its_own_explicit_type_name():
    col = GovernanceControl.__table__.columns["status"]
    assert col.type.name == "governance_control_status"


def test_legacy_control_status_column_has_its_own_explicit_type_name():
    col = Control.__table__.columns["status"]
    assert col.type.name == "legacy_control_status"


def test_the_two_type_names_no_longer_collide():
    governance_name = GovernanceControl.__table__.columns["status"].type.name
    legacy_name = Control.__table__.columns["status"].type.name
    assert governance_name != legacy_name


def test_migration_value_lists_match_the_real_model_enums():
    # Guards against the migration's hardcoded tuples silently drifting
    # from the model if either ControlStatus enum is ever extended.
    assert set(migration.GOVERNANCE_CONTROL_STATUS_VALUES) == {
        member.value for member in GovernanceControlStatus
    }
    assert set(migration.LEGACY_CONTROL_STATUS_VALUES) == {
        member.value for member in LegacyControlStatus
    }


def test_the_two_control_status_enums_still_have_no_value_overlap():
    # Documents *why* the collision was a real bug, not a cosmetic one --
    # if the two model enums ever come to share a value, a stale
    # `controlstatus`-shaped database wouldn't have failed loudly.
    governance_values = {member.value for member in GovernanceControlStatus}
    legacy_values = {member.value for member in LegacyControlStatus}
    assert governance_values.isdisjoint(legacy_values)
