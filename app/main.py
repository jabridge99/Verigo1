from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.logging_config import setup_logging
from app.middleware import SecurityHeadersMiddleware, RequestLoggingMiddleware, RateLimitMiddleware
from app.db.database import Base, engine, SessionLocal

from app.api.routes import customers, kyc, transactions, reports, sanctions
from app.api.routes import packs, rules
from app.api.routes import onboarding
from app.api.routes import audit
from app.api.routes import tenants
from app.api.routes import auth
from app.api.routes import notifications
from app.api.routes import api_keys
from app.api.routes import analytics
from app.api.routes import documents
from app.api.routes import branding
from app.api.routes import billing
from app.api.routes import connectors
from app.api.routes import retention
from app.api.routes import security_monitor

# Register all models so SQLAlchemy creates their tables at startup
import app.models.customer      # noqa: F401
import app.models.kyc           # noqa: F401
import app.models.transaction   # noqa: F401
import app.models.report        # noqa: F401
import app.models.pack          # noqa: F401
import app.models.rule_builder  # noqa: F401
import app.models.onboarding    # noqa: F401
import app.models.audit         # noqa: F401
import app.models.tenant        # noqa: F401
import app.models.user          # noqa: F401
import app.models.notification  # noqa: F401
import app.models.api_key       # noqa: F401
import app.models.document      # noqa: F401
import app.models.billing       # noqa: F401
import app.models.security_event  # noqa: F401
import app.models.connector      # noqa: F401
import app.models.retention      # noqa: F401

setup_logging()


@asynccontextmanager
async def lifespan(app: FastAPI):
    import logging
    log = logging.getLogger("tvg.startup")
    log.info("Starting %s v%s [%s]", settings.app_name, settings.version, settings.environment)

    Base.metadata.create_all(bind=engine)
    log.info("Database tables verified")

    from app.services.pack_engine import seed_all_packs
    db = SessionLocal()
    try:
        seeded = seed_all_packs(db)
        if seeded:
            log.info("Seeded %d compliance packs", seeded)
    finally:
        db.close()

    yield
    log.info("Shutdown complete")


# Disable Swagger/ReDoc in production
_docs_url    = None if settings.is_production else "/docs"
_redoc_url   = None if settings.is_production else "/redoc"
_openapi_url = None if settings.is_production else "/openapi.json"

app = FastAPI(
    title=settings.app_name,
    description=(
        "Trust Verify Go — Australian-first Compliance Operating System.\n\n"
        "Workflow: Industry selection → Compliance pack loading → Customer onboarding "
        "→ KYC/KYB → Transaction monitoring → AML alerts → Regulatory reporting → ECDD"
    ),
    version=settings.version,
    lifespan=lifespan,
    docs_url=_docs_url,
    redoc_url=_redoc_url,
    openapi_url=_openapi_url,
)

# ── Middleware (order matters — outermost executes first on request, last on response) ──

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestLoggingMiddleware)

if settings.rate_limit_enabled:
    app.add_middleware(RateLimitMiddleware, requests_per_minute=200)

app.add_middleware(GZipMiddleware, minimum_size=1000)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-TVG-Signature", "X-TVG-Event"],
    expose_headers=["X-Request-ID"],
)


# ── Global exception handler ──────────────────────────────────────────────────

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import logging, traceback
    logging.getLogger("tvg").error("Unhandled exception: %s\n%s", exc, traceback.format_exc())
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal error occurred. Our team has been notified."},
    )


# ── Routers ───────────────────────────────────────────────────────────────────

app.include_router(packs.router,         prefix="/api/v1")
app.include_router(rules.router,         prefix="/api/v1")
app.include_router(onboarding.router,    prefix="/api/v1")
app.include_router(customers.router,     prefix="/api/v1")
app.include_router(kyc.router,           prefix="/api/v1")
app.include_router(transactions.router,  prefix="/api/v1")
app.include_router(reports.router,       prefix="/api/v1")
app.include_router(sanctions.router,     prefix="/api/v1")
app.include_router(audit.router,         prefix="/api/v1")
app.include_router(tenants.router,       prefix="/api/v1")
app.include_router(auth.router,          prefix="/api/v1")
app.include_router(notifications.router, prefix="/api/v1")
app.include_router(api_keys.router,      prefix="/api/v1")
app.include_router(analytics.router,     prefix="/api/v1")
app.include_router(documents.router,     prefix="/api/v1")
app.include_router(branding.router,      prefix="/api/v1")
app.include_router(billing.router,          prefix="/api/v1")
app.include_router(connectors.router,       prefix="/api/v1")
app.include_router(retention.router,        prefix="/api/v1")
app.include_router(security_monitor.router, prefix="/api/v1")


# ── System endpoints ──────────────────────────────────────────────────────────

@app.get("/", include_in_schema=False)
def root():
    return {"system": settings.app_name, "version": settings.version}


@app.get("/health", tags=["system"])
def health():
    """Basic liveness probe — returns immediately."""
    return {"status": "ok", "version": settings.version, "environment": settings.environment}


@app.get("/health/ready", tags=["system"])
def readiness():
    """
    Readiness probe — verifies DB connectivity.
    Returns 503 if the database is unreachable.
    """
    from sqlalchemy import text
    from fastapi import HTTPException
    db = SessionLocal()
    try:
        db.execute(text("SELECT 1"))
        db_ok = True
    except Exception as e:
        db_ok = False
        import logging
        logging.getLogger("tvg").error("Readiness check DB failure: %s", e)
    finally:
        db.close()

    if not db_ok:
        raise HTTPException(status_code=503, detail="Database not ready")

    return {
        "status": "ready",
        "version": settings.version,
        "environment": settings.environment,
        "database": "ok",
    }
