from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db.database import Base, engine, SessionLocal
from app.api.routes import customers, kyc, transactions, reports, sanctions
from app.api.routes import packs, rules
from app.api.routes import onboarding

import app.models.customer      # noqa: F401
import app.models.kyc           # noqa: F401
import app.models.transaction   # noqa: F401
import app.models.report        # noqa: F401
import app.models.pack          # noqa: F401
import app.models.rule_builder  # noqa: F401
import app.models.onboarding    # noqa: F401


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


@app.get("/")
def root():
    return {
        "system": settings.app_name,
        "version": "1.0.0",
        "phases_complete": ["Phase 1", "Phase 2", "Phase 3", "Phase 4", "Phase 5"],
        "docs": "/docs",
    }


@app.get("/health")
def health():
    return {"status": "healthy"}
