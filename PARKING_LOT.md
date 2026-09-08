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

## Parked from the mypy CI-gate fix (2026-09-08)

Making CI's mypy check actually block the build (fix-now item, see resolved section below) meant triaging all 184 pre-existing errors it had been silently ignoring. Most were either genuine bugs (fixed, see below) or annotation gaps (fixed). A handful of things surfaced along the way that need a decision or more scope than a type-checker fix, rather than a guess:

### P1 — Independent review "due" notifications have no date to key off
**Status:** Parked — needs a product decision, not a mechanical fix.
**What:** `check_independent_review_due()` (`app/services/notification_scheduler.py`) filters on `IndependentReview.target_completion` — a column that doesn't exist anywhere on that model. The schema has `report_date` (when the report was issued, i.e. after the fact), `management_response_due` (the response window after findings are issued), but nothing representing "this review is scheduled/planned to complete by X" up front. Fixed the enum-typo bug next to it (`ReviewStatus.cancelled` → `.archived`), but this second bug means the function has never actually found anything to notify about — it just quietly returns 0.
**Why parked:** Needs someone to decide what should drive this — a new column on `IndependentReview` set when a review is planned, or deriving it from a fixed cadence (e.g. AUSTRAC's "at least every 3 years" independent-review interval, tracked at the AML Program level instead of per-review) — not something to guess at inside a type-checker cleanup.
**Detail:** `tests/test_enum_member_mismatch_smoke.py`'s docstring and `test_check_independent_review_due_does_not_crash`.

### P2 — Retention purge report only covers 1 of 5 KYC verification tables
**Status:** Parked — deliberately scoped narrow rather than guessed wide.
**What:** `generate_purge_report()` (`app/services/retention_service.py`) crashed outright (`from app.models.kyc import KYCRecord` — no such class). Fixed using `CustomerIdentityDocument`, the most fundamental of the five real KYC verification tables (identity document, selfie, address, phone, email) — but the other four aren't included in the purge-eligibility sweep.
**Why parked:** A full five-table sweep is a well-defined, bounded piece of work, but expanding it wasn't part of the crash fix and risked overstating what "purge report" now actually covers.
**Detail:** `app/services/retention_service.py`, `generate_purge_report()`; `tests/test_retention_purge_report_crash_smoke.py`.

### P4 — "Under review" policy status was mapped to three real sub-stages (judgment call, worth confirming)
**Status:** Parked for awareness, not blocking — a reasonable reading was applied, flagging it rather than presenting it as unquestionably correct.
**What:** `board_reporting_service.py`'s `_policies_section()` used `PolicyLifecycleStatus.under_review`/`.approved`, neither of which exist (real lifecycle: draft → internal_review → compliance_review → pending_approval → published → periodic_review → superseded → archived). Fixed `.approved` → `.published` (clear match, per the enum's own comment). For `.under_review`, mapped it to the three real intermediate stages (`internal_review`, `compliance_review`, `pending_approval`) grouped together, since the board report's "under review" bucket is presented as a single count.
**Why parked:** That grouping is a reasonable reading of intent, not a certainty — if board reports should distinguish "with the author" from "with the MLRO" from "awaiting Board sign-off," this needs revisiting.
**Detail:** `app/services/board_reporting_service.py`, `_policies_section()`.

---

## Resolved (moved out of the active parking lot, kept here for the full-process history)

### P3 — Registration left every real user's org identity split across three NULLs
**Parked:** 2026-09-08, as "two parallel org-id concepts, needs a deliberate look before picking a side." **Resolved:** 2026-09-08 (same session), after scanning the parking lot ahead of Stage 5 and digging one level deeper into this specific item, since it sits directly in Stage 5's territory.
**What it turned out to be:** Not a judgment call between two legitimate conventions — a real, confirmed, live bug. A real registration through the actual API (`POST /auth/register`, then inspecting the resulting row directly) showed `org_id` set but `industry_id` and `primary_organisation_id` permanently `NULL`, because the frontend never sends `organisation_name` (confirmed: zero references anywhere under `web/`) and the code path that attaches a new user to their own org as "owner" — RBAC membership, `primary_organisation_id`, `industry_id` — was gated behind that field. This broke onboarding-session creation outright (`Customer.org_id` stamped from the `NULL` field, hitting its NOT NULL constraint), and silently broke documents/billing/storage/connectors/IFTI/analytics scoping and org-membership RBAC for every real user.
**What was done:** Extracted the attach-user-to-org logic (`org_service.py`'s `create_organisation()`) into a reusable `attach_owner()`, and made `register()` always call it on the one org it creates for a new user — self-serve signup still always creates a brand-new org and never joins an existing one (the deliberate anti-privilege-escalation design already documented there is unchanged), it now just consistently owns it across all three identity fields instead of only one.
**Detail:** `tests/test_register_identity_consistency_smoke.py`; `app/api/routes/auth.py`'s `register()`; `app/services/org_service.py`'s `attach_owner()`.

### Fix-now items — unauthenticated sanctions endpoint + mypy CI gate
**Parked:** never — these were the two "fix now" candidates agreed on 2026-09-08 in the same session as the full gap list.
**What was done:**
- Deleted `app/api/routes/sanctions.py` (`POST /sanctions/screen` had no auth dependency at all) and its registration in `main.py` — the authenticated `screening.py` module already covers this need.
- Made CI's mypy step actually block the build (was `--no-error-summary || true`, silently ignoring every error). That meant triaging all 184 pre-existing errors mypy had been suppressing, down to 0.
**What the triage surfaced along the way — nine confirmed, previously-undetected production bugs, each fixed with a regression test that reproduced the failure against the pre-fix code:**
- AUSTRAC SMR/IFTI/TTR filing-deadline reminder emails have never fired for any organisation (`ReportStatus.pending_review` doesn't exist; the check silently logged an error and returned 0 every time).
- Onboarding session creation was broken on all three of its entry points — manual creation and both CSV/Excel bulk import (a tuple-unpacking mismatch, then a `current_user.user_id` typo — `User` has no such attribute, it's `.id`).
- `GET /aml-program/risk-assessments` and `/compliance-status` were unreachable — shadowed by `GET /aml-program/{program_id}` registered earlier, so both 404'd via the wrong handler.
- Six list endpoints (screening, aml-program versions/risk-assessments, governance training assignments/records) 500'd on every call — `Pagination` has no `.limit` attribute.
- A sixth confirmed instance of the recurring "per-org admin role mistaken for the global super-admin flag" bug class, this time in `analytics.py` — any org's own admin could read another organisation's dashboard/customer/transaction analytics via the `?industry_id=` override.
- Compliance notification emails (deadline alerts, training overdue, policy review due, etc.) and compliance-calendar reminder emails have never actually sent — both silently swallowed by a broad `except Exception`, calling a real email function with a signature that didn't match, or importing a function that doesn't exist at all.
- Document versioning (`POST /documents/{id}/new-version`) has never worked — the service function didn't accept the version-tracking parameters the route passed it, and the call was also missing `await`.
- A recurring pattern of code referencing enum members that were never actually defined (e.g. `AlertStatus.open`/`.cleared`/`.false_positive` on the wrong `AlertStatus` — there are two enums of that name in this codebase — `CDDLevel.edd` instead of `.enhanced`, `CaseStatus.closed`/`.withdrawn` where there are five separate `closed_*` states and no "withdrawn" at all) broke board reporting, benchmarking, and the reporting-group dashboard, mostly silently (wrapped in broad exception handlers).
**Detail:** commits on `claude/verigo-repo-inspection-kffwrd` from the sanctions-endpoint deletion through the final mypy-clean commit; each has its own regression test file under `tests/` named for the bug it covers.

### C3 — Risk-threshold consolidation
**Parked:** 2026-09-08. **Resolved:** 2026-09-08 (same session), per your explicit direction to standardise on ISO 31000 style.
**What it was:** Two genuinely live, overlapping "customer risk score" engines (`customer_risk_engine.py` vs `risk_matrix_service.py`), plus a third undocumented ad hoc scale in a `/rescore` endpoint, each with different threshold boundaries — the same customer could get a different risk level depending which code path last touched them. Separately, the AUD $10,000 statutory TTR/CTR threshold was duplicated across ~20 sites.
**What was done:** `risk_engine.py`'s ISO 31000 methodology is now the single source of truth for both — a shared `risk_rating_pct()` function every scoring module rates against, and one `TTR_CTR_THRESHOLD_AUD` constant every threshold check references. Professional assessment scoring combined into the same rating function (with a documented, bump-able ceiling for future indicators). A real pre-existing bug surfaced and fixed along the way: a sanctions match forced the EDD workflow but not the numeric score to critical — now it does, verified live end-to-end.
**Real behavioural changes to be aware of:** customer risk classification boundaries are now stricter in some cases (a score that was "medium" can now be "high"); professional assessment classification is now more lenient in some cases (needs a relatively higher point total to reach "critical"). Existing stored risk levels aren't retroactively recomputed — this affects new scoring and rescoring going forward.
**Detail:** `STRUCTURE_REVIEW.md`, section C3.
