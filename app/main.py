from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
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

# Register all models so SQLAlchemy creates their tables
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
import app.models.api_key      # noqa: F401


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    from app.services.pack_engine import seed_all_packs
    db = SessionLocal()
    try:
        seeded = seed_all_packs(db)
        if seeded:
            print(f"[startup] Seeded {seeded} compliance packs.")
    finally:
        db.close()
    yield


app = FastAPI(
    title=settings.app_name,
    description=(
        "Trust Verify Go — Australian-first Compliance Operating System.\n\n"
        "Workflow: Industry selection → Compliance pack loading → Customer onboarding "
        "→ KYC/KYB → Transaction monitoring → AML alerts → Regulatory reporting → ECDD"
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(packs.router,        prefix="/api/v1")
app.include_router(rules.router,        prefix="/api/v1")
app.include_router(onboarding.router,   prefix="/api/v1")
app.include_router(customers.router,    prefix="/api/v1")
app.include_router(kyc.router,          prefix="/api/v1")
app.include_router(transactions.router, prefix="/api/v1")
app.include_router(reports.router,      prefix="/api/v1")
app.include_router(sanctions.router,    prefix="/api/v1")
app.include_router(audit.router,        prefix="/api/v1")
app.include_router(tenants.router,      prefix="/api/v1")
app.include_router(auth.router,          prefix="/api/v1")
app.include_router(notifications.router, prefix="/api/v1")
app.include_router(api_keys.router,     prefix="/api/v1")
app.include_router(analytics.router,   prefix="/api/v1")


@app.get("/")
def root():
    return {
        "system": settings.app_name,
        "version": "1.0.0",
        "docs": "/docs",
    }


@app.get("/health")
def health():
    return {"status": "healthy"}
