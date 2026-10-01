"""
Stage 16 (Testing): CI has provisioned a real Postgres 16 service
container since this project's CI was first written, but nothing ever
actually used it -- the rest of this suite runs entirely on SQLite (see
tests/conftest.py), and the real Alembic migration chain has only ever
been verified by manually spinning up a local Postgres instance during
specific bug-fix sessions (see PARKING_LOT.md's P10/P37/P47 entries) --
never as a repeatable, automated check. That gap is exactly how P37's
enum-collision bug and P10's customer_ref uniqueness bug both went
unnoticed for as long as they did: SQLite's DDL is far more permissive
than Postgres's (no real ENUM type, FK constraints not enforced by
default, no genuine constraint-name collisions), so a broken migration or
a schema-level correctness bug can pass a SQLite-only test suite cleanly
and still fail -- or silently misbehave -- against the real production
database engine.

This module closes that gap: it runs the actual Alembic migration chain
(upgrade head from empty, downgrade one step, re-upgrade) against CI's
already-provisioned Postgres service, using DATABASE_URL exactly as
alembic/env.py already does for a real `alembic upgrade head` invocation.
It does NOT touch tests/conftest.py's SQLite-backed `engine`/`client`
fixtures that the rest of this suite uses -- a separate connection, a
separate concern.

Skipped entirely (not failed) when no real DATABASE_URL is configured --
i.e. a normal local `pytest tests/` run, which stays SQLite-only and fast.
"""

import os

import pytest
import sqlalchemy as sa
from alembic import command
from alembic.config import Config

pytestmark = pytest.mark.skipif(
    not os.environ.get("DATABASE_URL")
    or os.environ["DATABASE_URL"].startswith("sqlite"),
    reason="No real DATABASE_URL configured -- migration-chain test needs "
    "a real Postgres instance (CI provisions one; set DATABASE_URL "
    "locally to opt in).",
)


def _alembic_config() -> Config:
    cfg = Config(os.path.join(os.path.dirname(__file__), "..", "alembic.ini"))
    cfg.set_main_option(
        "script_location", os.path.join(os.path.dirname(__file__), "..", "alembic")
    )
    return cfg


@pytest.fixture
def clean_postgres_schema():
    """Reset to a genuinely empty schema before and after, so this test
    is safe to (re-)run against a shared CI database without leaking
    state into or out of anything else that might use it."""
    engine = sa.create_engine(os.environ["DATABASE_URL"])
    with engine.begin() as conn:
        conn.execute(sa.text("DROP SCHEMA public CASCADE"))
        conn.execute(sa.text("CREATE SCHEMA public"))
    yield engine
    with engine.begin() as conn:
        conn.execute(sa.text("DROP SCHEMA public CASCADE"))
        conn.execute(sa.text("CREATE SCHEMA public"))
    engine.dispose()


def test_migration_chain_upgrades_cleanly_from_empty(clean_postgres_schema):
    cfg = _alembic_config()
    command.upgrade(cfg, "head")

    inspector = sa.inspect(clean_postgres_schema)
    tables = set(inspector.get_table_names())
    # Spot-check tables from early, middle, and the most recent migration
    # in the chain -- proof the whole sequence actually ran, not just that
    # alembic exited 0.
    assert "organisations" in tables
    assert "mitigation_library_items" in tables
    assert "customers" in tables

    customer_unique_constraints = {
        uc["name"] for uc in inspector.get_unique_constraints("customers")
    }
    assert "uq_customer_org_ref" in customer_unique_constraints


def test_migration_chain_downgrades_and_reupgrades_cleanly(clean_postgres_schema):
    cfg = _alembic_config()
    command.upgrade(cfg, "head")
    command.downgrade(cfg, "-1")
    command.upgrade(cfg, "head")

    inspector = sa.inspect(clean_postgres_schema)
    assert "customers" in set(inspector.get_table_names())
