from logging.config import fileConfig
from sqlalchemy import create_engine, pool
from alembic import context
import os, sys

# Put project root on the path so `app.*` imports resolve
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.config import settings
from app.db.database import Base

# Import all domain models so Alembic can detect schema changes
import app.models  # noqa — __init__.py imports everything

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Override sqlalchemy.url from app settings (respects .env / env vars)
# configparser treats % as interpolation syntax, so escape literal % chars
# (e.g. from a URL-encoded password like %40) before handing off the URL.
# Use the direct (non-pooled) connection for migrations when configured —
# see migration_database_url in app/config.py for why.
_migration_url = settings.migration_database_url or settings.database_url
config.set_main_option("sqlalchemy.url", _migration_url.replace("%", "%%"))

from urllib.parse import urlsplit  # noqa: E402

_parsed = urlsplit(_migration_url)
print(
    f"alembic: connecting to {_parsed.hostname}:{_parsed.port} "
    f"(using {'MIGRATION_DATABASE_URL' if settings.migration_database_url else 'DATABASE_URL'})",
    flush=True,
)
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    # connect_timeout prevents an indefinite hang if the DB is briefly
    # unreachable (TCP/SSL handshake has no default timeout otherwise).
    connectable = create_engine(
        config.get_main_option("sqlalchemy.url"),
        poolclass=pool.NullPool,
        connect_args={"connect_timeout": 10},
    )
    with connectable.connect() as connection:
        # Diagnostic: confirm the connection itself is alive (vs. PgBouncer
        # accepting a socket but never handing off a real backend) before
        # Alembic's own migration logic runs.
        connection.exec_driver_sql("SELECT 1")
        print("alembic: SELECT 1 succeeded — connection is live", flush=True)
        # exec_driver_sql() autobegins a transaction on the connection; without
        # ending it here, context.begin_transaction() below sees a transaction
        # already in progress, assumes an external caller owns it, and never
        # commits — migrations silently appear to succeed but nothing persists.
        connection.commit()
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
