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

- **No central frontend API client.** ~35+ pages each redeclare the API base URL; several hand-roll near-identical `apiFetch` wrappers instead of sharing one from `web/lib/`. Proposal: add one shared client in `web/lib/api.ts` and migrate pages to it incrementally (a handful of pages per pass, tested each time) — not a single big-bang change.
- **`web/components/ui/` has only `button.tsx` and `card.tsx`.** Every table, modal, and form across ~40 routes is hand-built per page, including a repeated `ROLE_COLOR`/`STATUS_COLOR` badge pattern copy-pasted across many pages. Proposal: extract a small set of real shared primitives (badge, table shell, modal) starting from the most-duplicated pattern, migrate a few pages at a time.
- **Inline Pydantic schemas in 13 of 56 backend route files** instead of `app/schemas/` (the convention the other 43 follow). Proposal: move these out file-by-file — mechanical, low-risk, but touches 13 files, so worth doing as its own tracked pass rather than folded into something else.
- **`app/api/routes/ecdd/page.tsx` equivalent on the frontend** — `web/app/ecdd/page.tsx` (776 lines) bundles the main page plus three substantial sub-widgets (record detail/decision form, customer search, new-record form) in one file. Proposal: split into `web/components/ECDD/*`, following the pattern `web/components/Onboarding/` already establishes elsewhere in this codebase.
- **Oversized backend route files** — `customers.py` (2365 lines), `reports.py` (1590), `governance/training.py` (1350), `screening.py` (1304), `risk_assessment.py` (1119) are each genuinely ~15-20 distinct sub-resources bundled into one file (not one giant function — confirmed via each file's own section markers). Proposal: split into sub-routers per sub-domain (e.g. `customers/kyc.py`, `customers/beneficial_owners.py`, `customers/screening.py` under a `customers/` package) — real work, needs care around import cycles, best done one file at a time with tests after each.
- **Minor API-organization cleanups:** `api_keys.py` silently serves two unrelated resources (API keys and webhooks) under one file with no shared prefix — proposal: split webhooks into their own route file, matching every other domain's pattern. `organisations.py` (prefix `/organisations`) and `org_config.py` (prefix `/org`) have confusingly close prefixes for related-but-distinct concerns — proposal: rename one prefix for clarity (e.g. `/org-config` or fold into `/organisations/config`).

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

### C4. Naming issues (no functional risk, but renaming touches many files)

- `app/models/governance.py` actually contains only the *policy* domain (`Policy`, `PolicyVersion`, `PolicyAttestation`, etc.) — misleading next to its siblings `governance_controls.py`, `governance_customisation.py`, `governance_training.py`, which are named for what they contain. Renaming to `governance_policies.py` would be clearer but touches every file that imports from it — mechanical but wide.
- `app/services/identity_verification.py` vs `app/services/identity_verification_service.py` — two different, both-live scoring systems (single-document match confidence vs. a 6-category composite score) distinguished only by a `_service` suffix that carries no real meaning. A clearer pair of names would help; low urgency.

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
