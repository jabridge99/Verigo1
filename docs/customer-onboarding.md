# VeriGo — Customer Onboarding (Stage 5)

**Purpose:** Stage 0 confirmed the onboarding pipeline is substantially built. Stage 4's own recommendation for this stage was to actually verify and polish that flow, rather than assume it works because the code exists. This stage traced the real pipeline end to end — session creation, the applicant's self-serve wizard, staff document upload, identity scoring, and cancellation — and found three real, confirmed, previously-undetected bugs along the way.

**Headline finding:** the most severe bug meant every applicant who completed the self-serve onboarding wizard had their submission silently discarded. This has likely been true since the feature was built, and would not have been caught by reading the code alone — it only surfaced by constructing the exact sequence a real applicant goes through and checking what actually landed in the database.

---

## 1. The pipeline, as built

Two related things share the name "onboarding" in this codebase, distinguished here to avoid the confusion this repo has run into before with similarly-named modules (see `PARKING_LOT.md`'s C4):

- **Onboarding Autopilot** (`app/models/onboarding.py`, `onboarding_service.py`, `app/api/routes/onboarding.py`) — the pipeline this stage covers. An `OnboardingSession` tracks one applicant from invite through completion; a linked `Customer` record is the actual screenable subject.
- **Customer Portal** (`customer_portal_service.py`, `customer_portal_staff.py`) — a separate, unrelated staff/customer-communication feature with its own `PortalSessionStatus`. Not covered by this stage.

The Autopilot pipeline, as the staff-facing dashboard (`web/app/onboarding/page.tsx`) presents it:

1. **Applicant** — a session is created either manually (one at a time) or via CSV/Excel bulk import. Either way, a draft `Customer` record is created immediately so ops-entered applicants have somewhere to attach documents before the applicant ever does anything themselves.
2. **Document Upload** — a compliance officer opens an applicant's profile and uploads their ID documents directly.
3. **Screening** — a composite identity score (OCR, manual review, PEP, sanctions, adverse media, company/UBO — each weighted evenly) drives a Pass / ECDD-required / Fail decision, which is what actually moves a `Customer` from `draft` to `active` (or `edd_required`, or `rejected`).

Separately, the applicant can complete their own onboarding via a self-serve link (`web/app/onboarding/[token]/page.tsx` → `CustomerPortal.tsx`) — a 5-step wizard (Identity, Address, Source of Funds, Declarations, Review) that submits back to the same pipeline.

---

## 2. What this stage found

### The self-serve applicant wizard silently discarded everything

`create_session()` — called for every session regardless of how it's created — sets `session.customer_id` immediately, so a manually- or bulk-imported applicant has a Customer to attach documents to. `submit_onboarding()` — the function that runs when an applicant finishes the wizard and clicks "Submit Application" — used `if session.customer_id: return {"status": "already_completed", ...}` as its first line. Since `customer_id` is always already set from session creation, this fired on every real applicant submission, before any of the function's actual logic (saving the applicant's DOB, nationality, address, occupation, source of funds, PEP declaration, or running sanctions screening) ever ran. The applicant saw a normal "Application Submitted" success screen; nothing they entered reached their Customer record.

Confirmed live: created a session exactly as the real endpoint does, walked it through all 5 wizard steps with real data, submitted, and the resulting Customer record's `date_of_birth`/`occupation` were still `None`.

The existing test for this function (`test_onboarding_submit_creates_draft_customer.py`) hand-built its `OnboardingSession` directly, bypassing `create_session()` entirely — so `customer_id` was never set going in, and the bug never had a chance to show up in that test.

**Fix:** track submission idempotency via `session.status` (only `documents_submitted` or later counts as "already submitted") instead of the presence of `customer_id`, and update the existing draft Customer in place with the applicant's collected data rather than assuming a new one still needs to be created.

### "Cancel Request" 404'd on every use

The staff dashboard's "Cancel Request" button called `POST /onboarding/sessions/{id}/cancel` — a route that never existed on this router. The frontend also set the cancelled session's local status to the string `"cancelled"`, which was never a real `SessionStatus` value. Both symptoms point to the same root cause: this looks like it was wired up by analogy to the separate Customer Portal feature, which does have a working cancel flow (to a genuinely different `PortalSessionStatus.cancelled`) on a different router.

**Fix:** added the missing route and a `cancel_session()` service function (rejects cancelling an already-completed/rejected session with 409, otherwise sets status to `abandoned` — the closest existing status for "staff cancelled before the applicant finished"), and corrected the frontend's status string.

### Step 2 (document upload) sent an invalid category on every upload

`DocumentUploadStep.tsx` posted `category=identity` to `POST /documents`. `"identity"` has never been a valid `DocumentCategory` — the real values are `kyc`/`aml`/`report`/`case`/`ecdd`/`contract`/`policy`/`correspondence`/`trust_deed`/`asic_extract`/`company_document`/`sof_document`/`sow_document`/`rfi_response`/`other`. Every document uploaded through this step returned a 422.

**Fix:** changed to `category=kyc` ("ID documents, proof of address" per its own definition — exactly what this step uploads).

---

## 3. What was checked and found correct

- Session creation (manual and CSV/Excel bulk import) — already fixed earlier this session (tuple-unpacking crash, `current_user.user_id` typo); re-verified as part of this stage.
- The identity-score decision endpoint (`POST /screening/customers/{id}/identity-score/decide`) — correctly moves `Customer.status` and the linked `OnboardingSession.status` together, and its response contract matches what `ScreeningStep.tsx` expects.
- `ApplicantTable.tsx` and `PipelineView.tsx` (both presentational) — every field they read matches the real `SessionSummary`/`PipelineStats` response schemas.
- The bulk-import endpoints' request contract (`/import/csv`, `/import/excel`) matches the frontend's calls.
- `org_id_for()` (used by the screening decision endpoint) uses the correct, now-consistent `User.org_id` field — not the pattern that caused the registration identity bug fixed just before this stage.

---

## STAGE STATUS

**Stage:** 5 — Customer Onboarding
**Status:** COMPLETE

**What works:** The full pipeline — session creation, self-serve applicant wizard, staff document upload, identity scoring and decision, cancellation — is now verified end-to-end, live, not just read from the code.

**Known issues found and fixed this stage:** Applicant wizard data silently discarded on submission (the most severe finding — complete data loss for the feature's core self-serve use case), missing session-cancel endpoint (404 on every use), invalid document category on Step 2 uploads (422 on every use). All three fixed with regression tests that were confirmed to fail against the pre-fix code.

**Security concerns:** None found this stage specific to onboarding (the registration identity bug found while investigating the parking lot ahead of this stage was fixed separately, just before it).

**Technical debt:** None new. The C2/C4 items in `PARKING_LOT.md` remain the standing backlog.

**Recommended next stage:** Stage 6, per the original staged plan (whatever comes next in that plan — not restated here since it wasn't re-confirmed this session).
