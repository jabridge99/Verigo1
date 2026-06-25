from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.config import settings

_is_sqlite = settings.database_url.startswith("sqlite")
_is_supabase = "supabase.com" in settings.database_url

_connect_args: dict = {}
_engine_kwargs: dict = {}

if _is_sqlite:
    _connect_args["check_same_thread"] = False
elif _is_supabase:
    # Supabase uses PgBouncer (transaction mode) — needs pool config
    _connect_args["options"] = "-c statement_timeout=30000"
    _connect_args["connect_timeout"] = 10
    _engine_kwargs["pool_pre_ping"] = True
    # Supabase's pooler backs onto a fixed number of Postgres connections
    # (visible in Database > Settings > Connection pooling — currently 15).
    # With --workers 2, each worker's pool_size + max_overflow must leave
    # room for the other worker: 5 + 2 = 7 per worker, 14 total, under 15.
    _engine_kwargs["pool_size"] = 5
    _engine_kwargs["max_overflow"] = 2
else:
    # Generic Postgres
    _connect_args["connect_timeout"] = 10
    _engine_kwargs["pool_pre_ping"] = True

engine = create_engine(
    settings.database_url,
    connect_args=_connect_args,
    **_engine_kwargs,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
