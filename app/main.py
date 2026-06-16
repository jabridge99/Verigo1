from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse

import app.models.api_key  # noqa: F401
import app.models.audit  # noqa: F401
import app.models.billing  # noqa: F401
import app.models.connector  # noqa: F401

# Register all models so SQLAlchemy creates their tables at startup
import app.models.customer  # noqa: F401
import app.models.document  # noqa: F401
import app.models.ifti  # noqa: F401
import app.models.kyc  # noqa: F401
import app.models.notification  # noqa: F401
import app.models.onboarding  # noqa: F401
import app.models.report  # noqa: F401
import app.models.retention  # noqa: F401
import app.models.security_event  # noqa: F401
import app.models.tenant  # noqa: F401
import app.models.transaction  # noqa: F401
import app.models.monitoring  # noqa: F401
import app.models.case  # noqa: F401
import app.models.user  # noqa: F401
import app.models.audit_log  # noqa: F401
import app.models.ifti_receipt  # noqa: F401
import app.models.compliance_calendar  # noqa: F401
import app.models.regulatory_recommendation  # noqa: F401
import app.models.risk_matrix  # noqa: F401
import app.models.professional_assessment  # noqa: F401
import app.models.risk_matrix_config  # noqa: F401
import app.models.integration  # noqa: F401
import app.models.automation_rule  # noqa: F401
import app.models.screening  # noqa: F401
import app.models.aml_solution  # noqa: F401
from app.api.routes import (
    analytics,
    api_keys,
    audit,
    auth,
    billing,
    branding,
    connectors,
    customers,
    documents,
    ifti,
    kyc,
    notifications,
    onboarding,
    reports,
    retention,
    sanctions,
    security_monitor,
    tenants,
    transactions,
)
from app.api.routes.monitoring import router as monitoring_router
from app.api.routes.alerts import router as alerts_router
from app.api.routes.cases import router as cases_router
from app.api.routes.customer_workflow import router as customer_workflow_router
from app.api.routes.risk_assessment import router as risk_assessment_router
from app.api.routes.governance.policies import router as governance_policies_router
from app.api.routes.governance.controls import router as governance_controls_router
from app.api.routes.ifti_receipts import router as ifti_receipts_router
from app.api.routes.compliance_calendar import router as compliance_calendar_router
from app.api.routes.recommendations import router as recommendations_router
from app.api.routes.org_config import router as org_config_router
from app.api.routes.professional_assessment import router as professional_assessment_router
from app.api.routes.dashboard import router as dashboard_router
from app.api.routes.risk_matrix_config import router as risk_matrix_config_router
from app.api.routes.integrations import router as integrations_router
from app.api.routes.rule_builder import router as rule_builder_router
from app.api.routes.screening import router as screening_router
from app.api.routes.aml_program import router as aml_program_router
import app.models.governance  # noqa: F401
import app.models.governance_controls  # noqa: F401
import app.models.governance_training  # noqa: F401
import app.models.governance_customisation  # noqa: F401
import app.models.customer_workflow  # noqa: F401
import app.models.risk_engine  # noqa: F401
from app.config import settings
from app.db.database import Base, SessionLocal, engine
from app.logging_config import setup_logging
from app.middleware import (
    RateLimitMiddleware,
    RequestLoggingMiddleware,
    SecurityHeadersMiddleware,
)

setup_logging()


@asynccontextmanager
async def lifespan(app: FastAPI):
    import logging

    log = logging.getLogger("tvg.startup")
    log.info(
        "Starting %s v%s [%s]",
        settings.app_name,
        settings.version,
        settings.environment,
    )

    Base.metadata.create_all(bind=engine)
    log.info("Database tables verified")

    try:
        from app.services.pack_engine import seed_all_packs

        db = SessionLocal()
        try:
            seeded = seed_all_packs(db)
            if seeded:
                log.info("Seeded %d compliance packs", seeded)
        finally:
            db.close()
    except ImportError:
        log.debug("pack_engine not available — skipping pack seeding")

    yield
    log.info("Shutdown complete")


# Disable Swagger/ReDoc in production
_docs_url = None if settings.is_production else "/docs"
_redoc_url = None if settings.is_production else "/redoc"
_openapi_url = None if settings.is_production else "/openapi.json"

app = FastAPI(
    title=settings.app_name,
    description=(
        "Verigo — Australian-first Compliance Operating System.\n\n"
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
    import logging
    import traceback

    logging.getLogger("tvg").error(
        "Unhandled exception: %s\n%s", exc, traceback.format_exc()
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "An internal error occurred. Our team has been notified."},
    )


# ── Routers ───────────────────────────────────────────────────────────────────

app.include_router(onboarding.router, prefix="/api/v1")
app.include_router(customers.router, prefix="/api/v1")
app.include_router(kyc.router, prefix="/api/v1")
app.include_router(transactions.router, prefix="/api/v1")
app.include_router(reports.router, prefix="/api/v1")
app.include_router(sanctions.router, prefix="/api/v1")
app.include_router(audit.router, prefix="/api/v1")
app.include_router(tenants.router, prefix="/api/v1")
app.include_router(auth.router, prefix="/api/v1")
app.include_router(notifications.router, prefix="/api/v1")
app.include_router(api_keys.router, prefix="/api/v1")
app.include_router(analytics.router, prefix="/api/v1")
app.include_router(documents.router, prefix="/api/v1")
app.include_router(branding.router, prefix="/api/v1")
app.include_router(billing.router, prefix="/api/v1")
app.include_router(connectors.router, prefix="/api/v1")
app.include_router(retention.router, prefix="/api/v1")
app.include_router(security_monitor.router, prefix="/api/v1")
app.include_router(ifti.router, prefix="/api/v1")
app.include_router(monitoring_router, prefix="/api/v1")
app.include_router(alerts_router, prefix="/api/v1")
app.include_router(cases_router, prefix="/api/v1")
app.include_router(customer_workflow_router, prefix="/api/v1")
app.include_router(risk_assessment_router, prefix="/api/v1")
app.include_router(governance_policies_router, prefix="/api/v1")
app.include_router(governance_controls_router, prefix="/api/v1")
app.include_router(ifti_receipts_router, prefix="/api/v1")
app.include_router(compliance_calendar_router, prefix="/api/v1")
app.include_router(recommendations_router, prefix="/api/v1")
app.include_router(org_config_router, prefix="/api/v1")
app.include_router(professional_assessment_router, prefix="/api/v1")
app.include_router(dashboard_router, prefix="/api/v1")
app.include_router(risk_matrix_config_router, prefix="/api/v1")
app.include_router(integrations_router, prefix="/api/v1")
app.include_router(rule_builder_router, prefix="/api/v1")
app.include_router(screening_router, prefix="/api/v1")
app.include_router(aml_program_router, prefix="/api/v1")


# ── System endpoints ──────────────────────────────────────────────────────────


@app.get("/", include_in_schema=False)
def root():
    return {"system": settings.app_name, "version": settings.version}


@app.get("/health", tags=["system"])
def health():
    """Basic liveness probe — returns immediately."""
    return {
        "status": "ok",
        "version": settings.version,
        "environment": settings.environment,
    }


@app.get("/health/ready", tags=["system"])
def readiness():
    """
    Readiness probe — verifies DB connectivity.
    Returns 503 if the database is unreachable.
    """
    from fastapi import HTTPException
    from sqlalchemy import text

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
