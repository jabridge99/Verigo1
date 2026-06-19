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
    _engine_kwargs["pool_pre_ping"] = True
    _engine_kwargs["pool_size"] = 10
    _engine_kwargs["max_overflow"] = 20
else:
    # Generic Postgres
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
