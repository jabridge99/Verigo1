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

### C4 — Naming cleanups
**Status:** Parked — low priority, no functional risk.
**What:** `app/models/governance.py` actually only contains the policy domain (misleading next to `governance_controls.py`/`governance_training.py`/`governance_customisation.py`); `identity_verification.py` vs `identity_verification_service.py` are two different live scoring systems distinguished only by a suffix.
**Why parked:** Purely cosmetic — can wait indefinitely without cost.
**Detail:** `STRUCTURE_REVIEW.md`, section C4.

---

## Resolved (moved out of the active parking lot, kept here for the full-process history)

### C3 — Risk-threshold consolidation
**Parked:** 2026-09-08. **Resolved:** 2026-09-08 (same session), per your explicit direction to standardise on ISO 31000 style.
**What it was:** Two genuinely live, overlapping "customer risk score" engines (`customer_risk_engine.py` vs `risk_matrix_service.py`), plus a third undocumented ad hoc scale in a `/rescore` endpoint, each with different threshold boundaries — the same customer could get a different risk level depending which code path last touched them. Separately, the AUD $10,000 statutory TTR/CTR threshold was duplicated across ~20 sites.
**What was done:** `risk_engine.py`'s ISO 31000 methodology is now the single source of truth for both — a shared `risk_rating_pct()` function every scoring module rates against, and one `TTR_CTR_THRESHOLD_AUD` constant every threshold check references. Professional assessment scoring combined into the same rating function (with a documented, bump-able ceiling for future indicators). A real pre-existing bug surfaced and fixed along the way: a sanctions match forced the EDD workflow but not the numeric score to critical — now it does, verified live end-to-end.
**Real behavioural changes to be aware of:** customer risk classification boundaries are now stricter in some cases (a score that was "medium" can now be "high"); professional assessment classification is now more lenient in some cases (needs a relatively higher point total to reach "critical"). Existing stored risk levels aren't retroactively recomputed — this affects new scoring and rescoring going forward.
**Detail:** `STRUCTURE_REVIEW.md`, section C3.
