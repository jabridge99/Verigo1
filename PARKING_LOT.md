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

### P4 — "Under review" policy status was mapped to three real sub-stages (judgment call, worth confirming)
**Status:** Parked for awareness, not blocking — a reasonable reading was applied, flagging it rather than presenting it as unquestionably correct.
**What:** `board_reporting_service.py`'s `_policies_section()` used `PolicyLifecycleStatus.under_review`/`.approved`, neither of which exist (real lifecycle: draft → internal_review → compliance_review → pending_approval → published → periodic_review → superseded → archived). Fixed `.approved` → `.published` (clear match, per the enum's own comment). For `.under_review`, mapped it to the three real intermediate stages (`internal_review`, `compliance_review`, `pending_approval`) grouped together, since the board report's "under review" bucket is presented as a single count.
**Why parked:** That grouping is a reasonable reading of intent, not a certainty — if board reports should distinguish "with the author" from "with the MLRO" from "awaiting Board sign-off," this needs revisiting.
**Detail:** `app/services/board_reporting_service.py`, `_policies_section()`.

### P5 — `app/models/*.py` relationships aren't `Mapped[]`-typed
**Status:** Parked — a large, mechanical, low-bug-value retrofit; not attempted beyond the columns/relationships mypy actually flagged.
**What:** All of `app/models/` uses SQLAlchemy's classic `Column()`/`relationship()` declarative style. Without an explicit `Mapped[X]` (or `Mapped[list[X]]`) annotation on the left-hand side, the SQLAlchemy mypy plugin can't infer a relationship's scalar-vs-collection Python type, or a `Float`/`Numeric`/`Enum` column's Python type on either read or write — every access type-checks as `Mapped[Any]` or an unresolved `SQLCoreOperations[_N] | _N`, masking real bugs a properly-typed access would catch. `mypy.ini` disables the `[misc]` error code project-wide for `app.models.*` to suppress the (harmless, SQLAlchemy always resolves the real type correctly at runtime) declaration-line noise this produces once a column *is* annotated.
**Why parked:** Fixed every column/relationship mypy actually flagged as a downstream error across two full passes (the CI-gate fix and this one) — over 60 columns and a dozen relationships, enough to get CI green — but a handful of the codebase's ~2,500 other `Column()`/`relationship()` declarations remain unannotated and will surface the same false-positive class the next time new code reads/writes them in a way mypy checks. A full retrofit (add `Mapped[]` to every declaration in `app/models/`) is a well-defined, mechanical, low-risk piece of work, but sizeable (~40 model files) and out of scope for a bug-fixing pass.
**Detail:** `mypy.ini`'s `[mypy-app.models.*]` section; any commit on `claude/verigo-repo-inspection-kffwrd` touching `app/models/*.py` with a `Mapped[` diff.

---

## Resolved (moved out of the active parking lot, kept here for the full-process history)

### P1 — Independent review "due" notifications have no date to key off
**Parked:** 2026-09-08, as "needs a product decision, not a mechanical fix." **Resolved:** 2026-09-08 (same session), while finishing the second mypy CI-gate pass (see "Second mypy CI-gate pass" below) — enabling the SQLAlchemy mypy plugin re-surfaced the exact same underlying bug from the type-checker's side, which forced the decision.
**What it was:** `check_independent_review_due()` (`app/services/notification_scheduler.py`) filtered on `IndependentReview.target_completion` — a column that never existed on the model, and there was no field anywhere (model, create/update API schema) for setting a review's target completion date in the first place. Its own try/except silently caught the `AttributeError` on every scheduled run, so this notification had never fired once.
**What was done:** Added `IndependentReview.target_completion_date` (migration `d2e3f4a5b6c7`) and wired it into `ReviewCreate`/`ReviewUpdate` and the review response dict, so it's an explicit, settable field rather than an inferred/derived one — the simpler of the two options raised when this was parked, chosen because deriving it from a fixed AUSTRAC cadence would need a firmer read on how that cadence should be tracked (per-org override? per-review-type?) than was available here.
**Detail:** `tests/test_independent_review_target_completion_smoke.py`; `app/models/independent_review.py`; `app/api/routes/independent_review.py`.

### P2 — Retention purge report only covered 1 of 5 KYC verification tables
**Parked:** 2026-09-08, as "a well-defined, bounded piece of work, but expanding it wasn't part of the [original] crash fix." **Resolved:** 2026-09-08 (same session), as the one clearly worthwhile, self-contained item left in the parking lot once the CI mypy fix was done.
**What it was:** `generate_purge_report()` (`app/services/retention_service.py`) only swept `CustomerIdentityDocument`, the most fundamental of the five real KYC verification tables (identity document, selfie, address, phone, email) — the other four were never included in the purge-eligibility sweep, so a compliance officer reviewing the report would see it as complete when it wasn't.
**What was done:** Generalised the sweep into a loop over all five KYC verification models (all share the same `org_id`/`created_at` shape), each reported under its own `scope` label (`kyc_identity_document`, `kyc_selfie_verification`, etc.) rather than collapsing them into one ambiguous `kyc_record` bucket.
**Detail:** `app/services/retention_service.py`, `generate_purge_report()`; `tests/test_retention_purge_report_crash_smoke.py`.

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

### Second mypy CI-gate break — CI's real command still had 1545 errors
**Parked:** never — the user reported the "Backend (Python 3.11)" CI job failing and asked for it to be diagnosed and fixed.
**What it was:** The "Fix-now" mypy-clean pass above had verified `mypy` through an isolated `uv tool install` environment with no access to the project's real dependencies — combined with `--ignore-missing-imports`, that silently treated SQLAlchemy (and everything else) as untyped `Any`, so the "0 errors" it reported never matched what CI's `pip install mypy && mypy app/ --ignore-missing-imports --no-strict-optional` actually saw. CI's real command reported 1545 errors, entirely because no `mypy.ini` existed to enable `sqlalchemy.ext.mypy.plugin` — without it, every classic `Column()`-style model attribute type-checks as `Column[T]` instead of `T`, producing thousands of false positives that drown out real bugs.
**What was done:** Added `mypy.ini` enabling the plugin (with `[misc]` disabled for `app.models.*` — see P5 above). That alone cut 1545 errors to 634; from there, the same real-bug-vs-annotation-gap triage from the first pass, across four more commits, brought it to 0 — matching CI's exact command for the first time.
**What the triage surfaced along the way — real, confirmed, previously-undetected bugs, each fixed with a regression test proven to fail pre-fix via `git stash`:**
- `AuditLog(entity_type=..., entity_id=..., detail=...)` — none of those kwargs exist (real fields: `event_type`/`object_type`/`object_id`/`new_value`) — crashed every governance control create/update, test finalisation, and policy update/workflow transition.
- `ControlRemediationAction` had no `control_id` column at all, though every remediation route built or filtered by one — the entire governance remediation subsystem crashed on every call. Added the column via migration.
- Three independent instances of `SomeModel(metadata=...)` — `metadata` isn't a real column on any model (it's the SQLAlchemy declarative class's own `MetaData` object) but doesn't raise either, so each one silently discarded the value instead of persisting it: `record_security_event()` (meant every login/MFA/password-change security event, ~20 call sites in `auth.py`, was silently dropped), `customer_workflow.py`'s `_transition()` (every customer workflow transition's audit event lost its metadata), and `security_monitor.py`'s role-change audit (always read back `None` instead of the real target/from/to role).
- `security_monitor.py`'s brute-force detection used `SecurityEvent.ip_address is not None` inside `.filter(...)` — a Python identity check against the column descriptor (always `True`), not a SQL predicate, so NULL-IP failed logins were never actually excluded from the count.
- `examination_pack_service.py` (the AUSTRAC examination pack generator): `AMLProgram.name`, `RiskAssessment.assessed_at`, `Policy.lifecycle_status`, and a second independent `IFTIERecord.org_id` instance (real fields: none/`version`, `assessment_date`, `status`, `industry_id`) — each guarded by `getattr`/`hasattr` so none crashed, they just silently rendered null/empty in every examination pack ever generated.
- `board_reporting_service.py`: `SMRReport.smr_lodged`, `TrainingAssignment.status`, `ControlTest.tested_at`, and a third independent `IFTIERecord.org_id` instance — every board/quarterly/annual compliance snapshot crashed building the SMR, training, controls, or regulatory-reporting sections.
- `IndependentReview.target_completion` — see P1 above (moved from parked to resolved in this same pass).
**Detail:** commits on `claude/verigo-repo-inspection-kffwrd` from the `mypy.ini` addition through the final 0-error commit; each real bug has its own regression test file under `tests/`.

### C3 — Risk-threshold consolidation
**Parked:** 2026-09-08. **Resolved:** 2026-09-08 (same session), per your explicit direction to standardise on ISO 31000 style.
**What it was:** Two genuinely live, overlapping "customer risk score" engines (`customer_risk_engine.py` vs `risk_matrix_service.py`), plus a third undocumented ad hoc scale in a `/rescore` endpoint, each with different threshold boundaries — the same customer could get a different risk level depending which code path last touched them. Separately, the AUD $10,000 statutory TTR/CTR threshold was duplicated across ~20 sites.
**What was done:** `risk_engine.py`'s ISO 31000 methodology is now the single source of truth for both — a shared `risk_rating_pct()` function every scoring module rates against, and one `TTR_CTR_THRESHOLD_AUD` constant every threshold check references. Professional assessment scoring combined into the same rating function (with a documented, bump-able ceiling for future indicators). A real pre-existing bug surfaced and fixed along the way: a sanctions match forced the EDD workflow but not the numeric score to critical — now it does, verified live end-to-end.
**Real behavioural changes to be aware of:** customer risk classification boundaries are now stricter in some cases (a score that was "medium" can now be "high"); professional assessment classification is now more lenient in some cases (needs a relatively higher point total to reach "critical"). Existing stored risk levels aren't retroactively recomputed — this affects new scoring and rescoring going forward.
**Detail:** `STRUCTURE_REVIEW.md`, section C3.
