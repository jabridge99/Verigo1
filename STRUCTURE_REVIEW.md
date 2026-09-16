# VeriGo — Repository Structure & Clean-up Review (Stage 2)

**Purpose:** identify duplication, dead code, poor naming, and structural debt across the repository, propose how to address each, and separate what's safe to fix mechanically from what needs a real decision first. Per the staged plan's own rule: *"Do NOT perform a massive rewrite. Move/refactor code incrementally."* This document follows that — the safe items below are already done; everything else is a proposal, not yet touched.

---

## Part A — Already done (safe, zero-behaviour-risk, verified after each)

These were confirmed dead or wrong with no ambiguity, so they're already fixed on this branch (see commit history). After every change: full backend test suite (415 tests), ruff lint, and a frontend production build were re-run and passed.

| # | Change | Why it was safe |
|---|---|---|
| 1 | Deleted `KYC`, `corebackend` (root files) | Leftover scaffolding for a differently-named, unrelated earlier project. Never referenced anywhere. |
| 2 | Deleted `app/api/routes/orgs.py` | Never registered in `app/main.py`, never imported anywhere. |
| 3 | Deleted `app/models/beneficial_owner.py` | Confirmed duplicate — importing it errors with "Table already defined," because `customer.py` already defines the same table. |
| 4 | Untracked `web/tsconfig.tsbuildinfo`, gitignored `*.tsbuildinfo` | A build cache file, not source — shouldn't be in version control. |
| 5 | Fixed `next.config.js`: `/packs` now redirects to `/industries`, not `/industry` | `/industry` is the internal tenant-admin console; `/industries` is the actual public marketing page. The old redirect sent public visitors to an internal tool. |
| 6 | Deleted `web/components/SignupWizard.tsx` | Superseded first draft of the signup flow — never imported. The live version is `web/app/start-trial/StartTrialForm.tsx`. |
| 7 | Removed `ROLE_PERMISSIONS`/`has_permission()` from `app/services/auth_service.py` | A string-based permission system with zero call sites anywhere. The role checks actually in use live in `app/api/deps.py` and `app/services/org_service.py`. |

**One near-miss worth noting:** `app/services/risk_scoring.py` looked identically dead (no production callers) but has its own dedicated test file. Deleting it would mean deleting test coverage too — not a call to make unilaterally, so it was left in place. It's included in the proposal below instead.

---

## Part B — Proposed structure (the short version)

**The existing top-level shape is sound and should not change.** Backend `app/{api/routes, models, schemas, services, integrations, templates}` and frontend `web/{app, components, lib}` are conventional, appropriate for this stack, and already confirmed in Stage 0 as something *not* to rearchitect. The work here is internal tidying — splitting a few oversized files, removing duplication, consolidating things that quietly do the same job twice — not a folder reorganisation.

---

## Part C — Findings that need a decision

Grouped by how big a change fixing them actually is.

### C1. Small, low-risk — DONE

All three confirmed and fixed, verified after each (test suite, ruff, frontend build):

- **`app/services/risk_scoring.py`** — deleted, along with the two tests in `tests/test_coverage_boost.py` that existed solely to cover it (its only callers). Its logic lives for real in `app/services/customer_risk_engine.py`.
- **`app/api/routes/aml_solution.py`** — investigated first, per the plan: confirmed it's an older, never-registered `/aml` API superseded by the richer, live `/aml-program` API (`aml_program.py` — 10+ frontend callers, registered in `main.py`). Deleted the route file and its dedicated schema file (`app/schemas/aml_solution.py`). **Left `app/models/aml_solution.py` untouched** — it turned out to be genuinely, heavily used elsewhere (by `aml_program.py` itself, and by the governance policies/controls/training modules), not part of the dead API surface at all — only the superseded route layer over those same tables was dead.
- **Dead frontend pages:** `web/app/ifti/page.tsx` and `web/app/packs/page.tsx` deleted — both permanently unreachable behind their own redirects. `web/app/packs/[industry]/page.tsx` (a separate dynamic route, unaffected by the exact-match `/packs` redirect) was left alone.

### C2. Medium — real refactoring, moderate effort, low-to-moderate risk — deferred

Not done this session, by your choice — kept as a documented backlog for a dedicated future pass, one item at a time with its own build+test verification:

- **No central frontend API client — IN PROGRESS 2026-09-16, see PARKING_LOT.md's "C2 pass 11" through "C2 pass 15".** A survey before writing anything found a partial client already existed (`lib/auth.ts`'s `apiFetch()`, already used at 214 of the ~250 real call sites) — the actual gap was 44 files each redeclaring the same base-URL constant, zero typed response interfaces, and 30 silently-swallowed fetch errors, not a from-scratch build. Scaffolded the shared layer at `web/lib/api/client.ts` (one `API_BASE`, typed `apiGet`/`apiPost`/`apiPatch`/`apiPut`/`apiDelete`) and migrated five pilot resources onto it end-to-end: `customers` (5 files — a real bug the typing immediately surfaced, a page assigning an untyped API response into state typed for a different shape, which crashed on render the moment a real fetch succeeded), `analytics` (4 files — every `by_status`/`by_risk` dict is enum-keyed at runtime, not fixed, so `Record<string, number>` rather than a narrower literal was confirmed necessary against the live backend), `billing` (1 file, 12 of its 17 API call sites — the other 5 hit a genuinely different backend resource, `storage.py`, sharing the same page file, and were deliberately left alone at the time; a related `null`-vs-`undefined` type gap between the backend's `Optional[X] = None` fields and the page's pre-existing looser local types was fixed the same principled way), `organisations` (1 file, `lib/signup.ts`, 12 of its 15 `/api/v1/*` call sites — the other 3 hit `auth.py` and the separate `aml_program.py` resource despite similarly-named nested routes, both deliberately left alone; the new `lib/api/organisations.ts` module's functions/types are re-exported from `lib/signup.ts` rather than just moved, since three existing pages still import them by name from there), and `storage` (the 6 call sites left out of the `billing` pilot, same page file — after this pass the page has no raw `apiFetch`/local `API` constant left at all; needed a new `apiPut` on the shared client, the first pilot whose mutating endpoints weren't `POST`/`PATCH`; also surfaced a second instance of the `customers`-pilot bug class, both storage panels spreading an entire untyped API response — including boolean fields — into a `Record<string,string>` form state, fixed with a field-filtering helper rather than a type-level workaround). `lib/pricing.ts`'s public, server-side/ISR-cached plan-price fetch was deliberately excluded from the `billing` migration — a different execution context from the client-only auth wrapper. Remaining: 32 files/~157 call sites, one resource at a time (a handful of pages per pass, tested each time — not a single big-bang change), plus the 30 silent-`catch{}` sites as a related but separate cleanup.
- **`web/components/ui/` has only `button.tsx` and `card.tsx`.** Every table, modal, and form across ~40 routes is hand-built per page, including a repeated `ROLE_COLOR`/`STATUS_COLOR` badge pattern copy-pasted across many pages. Proposal: extract a small set of real shared primitives (badge, table shell, modal) starting from the most-duplicated pattern, migrate a few pages at a time.
- **Inline Pydantic schemas** instead of `app/schemas/` (the convention most route files follow). **RESOLVED — 28 of 28 route files done, 2026-09-16.** See PARKING_LOT.md's "C2 pass 3", "C2 pass 4", and "C2 pass 5" for detail. Found and left alone (flagged, not deleted) one piece of pre-existing dead code along the way: `app/schemas/governance.py` already had unused `Training*`/`BulkAssignRequest` classes with no caller anywhere — never wired up to `governance/training.py` or anything else.
- **`app/api/routes/ecdd/page.tsx` equivalent on the frontend** — `web/app/ecdd/page.tsx` (776 lines) bundles the main page plus three substantial sub-widgets (record detail/decision form, customer search, new-record form) in one file. Proposal: split into `web/components/ECDD/*`, following the pattern `web/components/Onboarding/` already establishes elsewhere in this codebase.
- **Oversized backend route files** — **RESOLVED 2026-09-16, all 5 of 5.** `risk_assessment.py` (1213 lines), `governance/training.py` (1278 lines), `reports.py` (1497 lines), `screening.py` (1570 lines) and finally `customers.py` (2377 lines, the last and largest) — see PARKING_LOT.md's "C2 pass 6" through "C2 pass 10" — are now packages, split along real domain boundaries rather than by line count, each verified via an AST-diff script comparing every function's exact source and every endpoint's permission dependency against the original. This caught two real transcription bugs in the first split (a dropped log line, a widened permission check), found zero in the second, found a genuine pre-existing production bug in the third (an unreachable `/filing-register/export-csv` endpoint shadowed by `/filing-register/{entry_id}`, fixed as part of the split), caught three manual-retyping mistakes in the fourth (a lost `Optional[...]` type hint and two missing imports), and caught two import-sort issues in the fifth — confirming the check is cheap and worth keeping standard for this class of change. Two FastAPI-specific gotchas surfaced along the way, both documented in the affected packages' `__init__.py` docstrings: (1) `include_router()` rejects a sub-router whose own route path is `""` when the combined prefix is also empty, even though the *parent* router's prefix will resolve it fine — hit by both `screening.py` (`list_screening_records`) and `customers.py` (`list_customers`/`create_customer`), fixed both times by passing the prefix explicitly on each `include_router()` call instead of setting it on the package's own `APIRouter()`; (2) a package split needs every `monkeypatch.setattr("app.api.routes.X.name", ...)` in the test suite retargeted to the submodule where `name` now actually lives — hit in both the `screening.py` and `customers.py` splits (5 and 2 call sites respectively), since a monkeypatch has to target where a name is imported and used, not a flat re-export that no longer exists.
- **Minor API-organization cleanups:** `api_keys.py`/webhooks split and the `organisations.py`/`org_config.py` prefix naming — both **RESOLVED 2026-09-16**, see PARKING_LOT.md's "P5/C2 pass" for detail.

### C3. Risk-threshold consolidation — RESOLVED (2026-09-08)

Per your direction ("use ISO 31000 style"), the risk-rating and $10,000-threshold duplication is fixed. What changed:

- **`app/services/risk_engine.py`** (the ISO 31000-style likelihood×consequence engine) is now the single source of truth for both: a new `risk_rating_pct(score, max_score=100)` function ratings any 0-100 (or 0-`max_score`) score using the exact same proportional boundaries as the native 1-25 scale (5/25=20%, 12/25=48%, 19/25=76%), and `TTR_CTR_THRESHOLD_AUD = 10_000` is the one place the AUD statutory threshold is defined.
- **`customer_risk_engine.py`** — its own `RISK_THRESHOLDS` (33/66/85) removed; now calls `risk_rating_pct()`. **Real behavioural change:** the new boundaries are stricter (20/48/76 vs the old 33/66/85), so some customers will now rate one tier higher than before at the same score — e.g. a score of 50 was "medium," is now "high." Existing stored `Customer.risk_level` values aren't retroactively recomputed; this only affects new scoring and rescoring going forward.
- **A real, pre-existing bug found and fixed along the way:** the engine already forced the *EDD workflow gateway* on a sanctions match but never actually pushed the *numeric score* to critical — a sanctions-matched customer could still read "medium" or "high" rather than "critical." Now a confirmed sanctions match forces the score to 100 (critical) outright. Verified live end-to-end (register → create customer → flag sanctions match → rescore → confirmed `risk_score: 100.0, risk_level: "critical"`).
- **`risk_matrix_service.py`** — its own `_risk_level_from_score` (76/51/26) now delegates to `risk_rating_pct()` too. Only the label-lookup step changed; its own 4-dimension scoring math is untouched.
- **`app/api/routes/customers.py`'s `/rescore` endpoint** — replaced its ad hoc placeholder scoring (explicitly commented "replace with full engine call when ready," its own 25/50/75 scale, and missing product/geographic/channel/transaction dimensions entirely) with a real call to `customer_risk_engine.assess_customer_risk()` — the same engine onboarding already uses. This closes a third, previously-undocumented scale this review didn't originally catch.
- **`professional_assessment_service.py`** — its SOF/SOW/tax/investment/PEP point-scoring logic is unchanged (that's real domain-specific business logic), but the final point-total → label decision now goes through `risk_rating_pct()` too, normalised against a documented ceiling (`PROFESSIONAL_ASSESSMENT_MAX_SCORE = 39`, the sum of every flag's max points) instead of its own independent 12/7/3 cut points. The ceiling is a named constant specifically so **new indicators can be added later** ("additional lines," per your instruction) by bumping it — a comment on the constant says so explicitly. **Real behavioural change, in the opposite direction:** this normalisation is more lenient than the old cut points, so a given point total now needs to be relatively higher to reach "critical" than before.
- **The AUD $10,000 threshold** is now referenced from `TTR_CTR_THRESHOLD_AUD` at every site found — about 20 individual fixes across 12 files (7 previously-independent named constants now just alias the shared one, kept under their existing names for readability since IFTI/TTR/CTR are distinct report types that happen to share this figure; the rest were bare literals replaced outright, including two in `regulatory_decision_service.py` a fresh sweep caught that the original audit had missed).

Verified after every step: full backend test suite (413 tests — 2 fewer than before, the two tests that covered now-deleted `risk_scoring.py`), ruff clean, and a live end-to-end smoke test against a running server for the sanctions-match fix specifically.

**Not touched, and still an open question:** the two-tier authorization split (`app/api/deps.py`'s role-based gating vs `app/services/org_service.py`'s DB-backed permission catalog) mentioned in the original C3 write-up is unrelated to risk scoring and wasn't part of this fix — still open, not urgent.

### C4. Naming issues — RESOLVED 2026-09-16 (see PARKING_LOT.md, "Parking-lot cleanup pass, 2026-09-16")

- `app/models/governance.py` actually contained only the *policy* domain (`Policy`, `PolicyVersion`, `PolicyAttestation`, etc.) — misleading next to its siblings `governance_controls.py`, `governance_customisation.py`, `governance_training.py`, which are named for what they contain. Renamed to `governance_policies.py`; every importer updated.
- `app/services/identity_verification.py` vs `app/services/identity_verification_service.py` — two different, both-live scoring systems (single-document match confidence vs. a 6-category composite score) distinguished only by a `_service` suffix that carried no real meaning. Renamed to `document_verification.py` (single-document field match) and `identity_composite_score.py` (six-category composite score) respectively.

---

## Decisions made this session

1. **C1 — done.** All three items fixed and verified (see above).
2. **C2 — parked**, by your choice. Tracked in `PARKING_LOT.md` for a dedicated future pass, one item at a time with its own build+test verification, rather than rushed into this session.
3. **C3 — resolved**, per your direction to standardise on ISO 31000 style. See the updated section above for the full detail: every risk-rating decision in the codebase now goes through one shared function, the professional assessment scoring is combined into it (with room for future indicators), the sanctions-match scoring gap that surfaced along the way is fixed, and the $10,000 threshold is centralised.
4. **C4 — low priority**, unchanged. Cosmetic, can wait indefinitely.

---

## STAGE STATUS

**Stage:** 2 — GitHub Structure & Code Clean-up
**Status:** COMPLETE

**What works:** All C1 cleanups (7 files/items across Part A and C1) verified — full test suite (413 tests, down from 415 as two tests covering now-deleted dead code were removed with it) passing, ruff clean, frontend production build succeeding, at every step.

**Known issues:** None introduced. The remaining structural debt (C2, C3, C4) is pre-existing, catalogued, and intentionally deferred per your direction — not overlooked.

**Security concerns:** None found in this pass — this was a structure/duplication review, not a security review (Stage 0 already covered that).

**Technical debt:** Catalogued in detail above (C2–C4, C1 resolved). The two most consequential remaining items are the five inconsistent risk-threshold scales and the duplicated $10,000 statutory threshold (both C3) — both touch real regulatory-reporting logic, so they stay flagged for your review rather than acted on.

**Recommended next stage:** Stage 3 (AML/CTF Domain Foundation).
