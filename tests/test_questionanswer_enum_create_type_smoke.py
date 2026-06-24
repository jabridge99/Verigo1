"""
Smoke test: migration c8d9e0f1a2b3 crash-looped production with
psycopg2.errors.DuplicateObject: type "questionanswer" already exists.

create_type=False has no effect when passed to the generic sa.Enum — that
flag is only defined on the postgres-dialect sqlalchemy.dialects.postgresql
ENUM class. Passing it to sa.Enum is silently absorbed as an unused kwarg,
so op.create_table() still emits CREATE TYPE for an enum that already
exists in the DB (created earlier from risk_matrix.py's QuestionAnswer
model). Fixed by using postgresql.ENUM explicitly, where create_type=False
is honoured via ENUM._check_for_name_in_memos() short-circuiting table-create
enum emission.
"""
import importlib.util
import os

from sqlalchemy.dialects import postgresql

_MIGRATION_PATH = os.path.join(
    os.path.dirname(__file__),
    "..",
    "alembic",
    "versions",
    "c8d9e0f1a2b3_question_library_customer_context.py",
)
_spec = importlib.util.spec_from_file_location("c8d9e0f1a2b3_migration", _MIGRATION_PATH)
migration = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(migration)


def test_question_answer_enum_is_postgres_dialect_enum_with_create_type_false():
    enum = migration.question_answer_enum
    assert isinstance(enum, postgresql.ENUM)
    assert enum.create_type is False


def test_question_answer_enum_skips_create_during_table_create():
    enum = migration.question_answer_enum
    # Mirrors the table-create dispatch guard in
    # postgresql.named_types.ENUM._on_table_create(): when this returns
    # True, no CREATE TYPE is emitted regardless of checkfirst.
    assert enum._check_for_name_in_memos(False, {}) is True
