from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context
import os, sys

# Put project root on the path so `app.*` imports resolve
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.config import settings
from app.db.database import Base

# Import every model so Alembic can detect schema changes
import app.models.customer        # noqa
import app.models.kyc             # noqa
import app.models.transaction     # noqa
import app.models.report          # noqa
import app.models.onboarding      # noqa
import app.models.audit           # noqa
import app.models.tenant          # noqa
import app.models.user            # noqa
import app.models.notification    # noqa
import app.models.api_key         # noqa
import app.models.document        # noqa
import app.models.billing         # noqa
import app.models.security_event  # noqa
import app.models.connector       # noqa
import app.models.retention       # noqa
import app.models.ifti            # noqa

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Override sqlalchemy.url from app settings (respects .env / env vars)
config.set_main_option("sqlalchemy.url", settings.database_url)
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
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
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
