# VeriGo — Parking Lot

Items identified during the staged review that are real, but deliberately not being acted on right now — either deferred by explicit choice, or waiting on a decision from you. Tracked here so nothing gets lost, and to be summarized in full at the end of the whole staged process.

Each entry: what it is, why it's parked, where the full detail lives.

---

## Parked from Stage 2 (Repository Structure & Clean-up)

### C2 — Real refactoring backlog
**Status:** Parked — deferred to a dedicated future pass, by your choice (2026-09-08).
**What:** No central frontend API client (~35+ pages redeclare it); `web/components/ui/` has only 2 shared primitives, so every table/modal/form is hand-built per page; 13 of 56 backend route files define Pydantic schemas inline instead of in `app/schemas/`; several route files (`customers.py` 2365 lines, `reports.py` 1590, etc.) bundle ~15-20 sub-resources into one file; a few minor API-organization issues (`api_keys.py` silently serving webhooks too, confusingly-close `/organisations` vs `/org` prefixes).
**Why parked:** Real refactoring work, moderate effort and risk each — better done as its own dedicated, incrementally-verified pass than folded into a broader review.
**Detail:** `STRUCTURE_REVIEW.md`, section C2.

### C3 — Risk-threshold consolidation
**Status:** On hold — you're reviewing before any code changes (2026-09-08).
**What:** Two genuinely live, overlapping "customer risk score" engines (`customer_risk_engine.py` vs `risk_matrix_service.py`) — same 0-100 scale, nearly identical dimensions, different threshold boundaries, used by different parts of the app (onboarding vs. everywhere else) — meaning the same customer could get a different risk level depending which code path last touched them. Separately, the AUD $10,000 statutory TTR/CTR threshold is duplicated across ~15 sites (7 named constants, 8 bare literals).
**Why parked:** The risk-engine question needs a compliance decision (which engine is authoritative, or are they intentionally answering different questions) that isn't mine to make. The $10,000 threshold is lower-ambiguity but still needs care across 15 sites.
**Detail:** `STRUCTURE_REVIEW.md`, section C3; expanded with concrete code comparison in chat during Stage 2 wrap-up.

### C4 — Naming cleanups
**Status:** Parked — low priority, no functional risk.
**What:** `app/models/governance.py` actually only contains the policy domain (misleading next to `governance_controls.py`/`governance_training.py`/`governance_customisation.py`); `identity_verification.py` vs `identity_verification_service.py` are two different live scoring systems distinguished only by a suffix.
**Why parked:** Purely cosmetic — can wait indefinitely without cost.
**Detail:** `STRUCTURE_REVIEW.md`, section C4.
