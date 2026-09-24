"""
Screening Hub — Phase 5.

Unified workflow for sanctions, PEP, watchlist, adverse media, and crypto wallet screening.

Roles:
  GET (records, alerts, dashboard)  — analyst+
  Create screening / review alerts  — compliance+
  Escalate to MLRO                  — compliance+
  Bulk batch screen                 — compliance+

Design:
  ScreeningRecord is append-only — re-screening creates a new record.
  ScreeningAlert is mutable (status transitions only).
  Crypto wallet screening is a separate endpoint (blockchain-specific data).
  Adverse media results have article-level detail.

DISCLAIMER: Screening results are data inputs to the compliance workflow.
The platform does not determine whether a match constitutes a sanctions violation
or regulatory breach. All decisions remain with the reporting entity.

This package was split out of a single 1570-line screening.py; see
_shared.py, quick_screen.py, records.py, dashboard.py, alerts.py, batch.py,
crypto_wallet.py, adverse_media.py and customer_summary.py.

Route registration order: records.py's GET /{record_id} is a single-segment
path-parameter route, so dashboard.py (GET /dashboard) and alerts.py
(GET /alerts) — both literal single-segment paths — must be registered
before records.py, exactly as the original file did (in declaration order).

The prefix is applied per include_router() call rather than on this
package's own APIRouter(): records.py's list_screening_records is
GET "" (the bare /screening path), and FastAPI's include_router() rejects
an empty combined prefix + empty route path outright (it can't see that
this router's own prefix will fill the gap) -- passing prefix="/screening"
explicitly on every call sidesteps that check while resolving to the exact
same final paths.
"""

from fastapi import APIRouter

from . import (
    adverse_media,
    alerts,
    batch,
    crypto_wallet,
    customer_summary,
    dashboard,
    quick_screen,
    records,
)

router = APIRouter(tags=["Screening Hub"])

router.include_router(quick_screen.router, prefix="/screening")
router.include_router(dashboard.router, prefix="/screening")
router.include_router(alerts.router, prefix="/screening")
router.include_router(records.router, prefix="/screening")
router.include_router(batch.router, prefix="/screening")
router.include_router(crypto_wallet.router, prefix="/screening")
router.include_router(adverse_media.router, prefix="/screening")
router.include_router(customer_summary.router, prefix="/screening")
