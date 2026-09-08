# VeriGo — Current State Assessment (Stage 0)

**Purpose:** a plain-English, evidence-based snapshot of what exists in this repository today — before any code is changed. Written for a non-engineer reading this alongside a technical advisor.

**Method:** every claim below comes from actually reading the code, configs, migrations, and tests in this repository (not assumptions). Where something is a *claim the codebase makes about itself* (e.g. a security document written by a past contributor) rather than something independently re-verified line-by-line here, it's labelled as such.

**Headline finding:** this is **not** an early-stage scaffold. It's a substantial, mostly well-engineered FastAPI + Next.js AML/CTF platform that has already been through at least one serious internal security-hardening effort (visible in migration notes, code comments, and ~300 regression tests named after specific past bugs). It has real strengths worth preserving, one **confirmed live cross-tenant data-leak bug** that should be fixed before anything else, and a moderate amount of ordinary technical debt (duplication, stale docs, unfinished integrations).

---

## 1. Architecture Overview

VeriGo is a **two-service web application** plus a database, not a monolith:

```
┌─────────────────────┐        ┌──────────────────────┐        ┌──────────────┐
│  Next.js frontend    │  REST  │  FastAPI backend      │  SQL   │  PostgreSQL   │
│  (web/)               │ ─────▶ │  (app/)                │ ─────▶ │  database     │
│  ~40 page routes      │  JSON  │  ~55 route files,      │        │  ~90 tables   │
│  Runs in the browser  │        │  ~650 endpoints        │        │               │
└─────────────────────┘        └──────────────────────┘        └──────────────┘
```

- The **frontend never talks to the database directly** — it only calls the backend's REST API over HTTPS, sending a login cookie so the backend knows who's asking.
- The **backend is the single source of truth** for security: every piece of data is supposed to be filtered by which organisation (tenant) the logged-in user belongs to, on the server, not the browser.
- A background **scheduler** (APScheduler) runs inside the backend process for recurring jobs (reminders, retention sweeps), protected by a Redis-based lock so multiple server workers don't duplicate jobs.

This is a conventional, reasonable architecture for a SaaS product at this stage — not something that needs to be rearchitected.

---

## 2. Technology Stack

| Layer | Technology | Notes |
|---|---|---|
| Backend framework | FastAPI 0.111 (Python 3.11/3.12) | Async Python web framework |
| ORM / migrations | SQLAlchemy 2.0 + Alembic | Database access + schema version control |
| Database | PostgreSQL 16 | Relational database |
| Auth | Custom JWT (`python-jose`) + bcrypt (`passlib`) + hand-built TOTP MFA | No third-party auth vendor — built in-house |
| Background jobs | APScheduler + Redis lock | Runs inside the API process |
| Payments | Stripe | Subscriptions, invoices, webhooks |
| File storage | Pluggable: local disk, AWS S3, Cloudflare R2, Azure Blob, GCS, Supabase | Selectable per environment/tenant |
| Frontend framework | Next.js 16 (App Router), React 18.3, TypeScript | |
| Styling / UI kit | Tailwind CSS + a very thin shadcn/ui setup (2 components) | Most UI is hand-built per page |
| Observability | Sentry (both backend and frontend) | Optional, env-var gated |
| CI | GitHub Actions | Lint, type-check, tests, Docker smoke-build — **no deployment step** |
| Deployment targets | Railway (API), Vercel (frontend), **and** a full self-hosted Docker Compose + Nginx stack | All three exist in the repo simultaneously — see §6 |

**Dependency freshness:** most backend dependencies are pinned to versions from roughly mid-2024 — about 1.5–2 years old. Nothing found is a known actively-exploited vulnerability, but two libraries are worth flagging for an eventual upgrade: `python-jose` (JWT handling) and `passlib` (password hashing) are both effectively unmaintained upstream projects. The commonly recommended modern replacement for `python-jose` is `PyJWT`. This is not urgent, but should go on the technical roadmap.

---

## 3. Folder Structure

```
Verigo1/
├── app/                         # FastAPI backend
│   ├── main.py                  # App startup, middleware, router registration
│   ├── config.py                # Settings (env vars), startup safety checks
│   ├── api/routes/               # ~55 files, ~650 REST endpoints
│   ├── models/                   # ~49 files, ~90 database tables (SQLAlchemy)
│   ├── schemas/                  # Pydantic request/response validation
│   ├── services/                 # ~65 files — business logic (risk engine, IFTI
│   │                              #   Excel generation, billing, storage, email…)
│   ├── integrations/              # External providers (sanctions, KYC, crypto,
│   │                              #   ABR, ASIC, AUSTRAC, SMS, OCR) — see §7
│   ├── templates/                # Per-industry risk & AML program libraries
│   │                              #   (a real "industry pack" pattern — see §8)
│   └── data/packs/                # Currently empty — placeholder only
├── alembic/versions/              # 14 database migration files
├── tests/                         # 68 files, ~303 tests — mostly security regression tests
├── web/                           # Next.js frontend
│   ├── app/                      # ~40 route folders (page-router-style App Router)
│   ├── components/                # Shared UI (Navbar, Sidebar, wizards…)
│   ├── components/ui/             # Only 2 shadcn primitives (button, card)
│   └── lib/                       # Auth helpers, pricing, large content files
├── nginx/                         # Reverse proxy config for self-hosted deploy
├── .github/workflows/ci.yml       # The only CI workflow (build/test, no deploy)
├── docker-compose.yml, Dockerfile # Self-hosted deployment path
├── railway.json                   # Railway deployment path (backend only)
├── web/vercel.json                # Vercel deployment path (frontend only)
├── README.md, DEPLOYMENT.md, ZERO_TRUST_ARCHITECTURE.md
└── KYC, corebackend               # Stray leftover files — see §9
```

A few structural oddities worth naming now (details in §9):
- `app/data/packs/` exists as a folder but is empty — the real "industry pack" logic actually lives in `app/templates/`.
- Two root files, `KYC` and `corebackend`, have **no file extension** and contain scaffolding for a completely different, unrelated project ("kyc-system") — not VeriGo code at all. They appear to be an accidental commit.
- `web/tsconfig.tsbuildinfo` (a 220KB TypeScript build cache file) is committed to git by mistake — it should never be tracked.

---

## 4. Application Flow (what a user actually does)

The intended end-to-end workflow, as built today:

```
Sign up → Organisation created → Onboarding wizard (industry, risk appetite)
   → Industry-specific AML program + risk library auto-seeded
   → Add a customer (individual or business)
   → KYC/KYB: identity document, selfie/liveness, address, phone, email verification
   → Beneficial ownership recorded (for businesses)
   → Screening: sanctions / PEP / adverse media / watchlist checks
   → Risk score calculated → risk rating assigned with reasons
   → Approve / reject / escalate the customer
   → Ongoing: transactions recorded → monitoring rules → alerts
   → Alerts triaged → compliance case opened → investigated → decision recorded
   → Regulatory reports prepared: SMR / TTR / IFTI (maker-checker: creator ≠ approver)
   → Everything logged to an audit trail
```

**How the frontend and backend actually connect:**
- Login issues an **httpOnly cookie** holding the JWT — the browser can't read the token directly (good practice).
- The frontend also keeps a small non-secret "who am I" object (name, role, org id) in `localStorage` purely to decide what to show in the UI.
- **Every page's role/login check happens in React, after the page has already started rendering** — there is no `middleware.ts` file (Next.js's server-level gatekeeper) anywhere in this repository. In practice this means: a logged-out visitor who navigates straight to an internal URL will briefly see the page shell before being redirected, and several pages (e.g. the customer list) fall back to realistic-looking **hardcoded demo data** if the real API call fails. This is a real gap — see §9.
- On the backend, the actual security enforcement (can this user see this data?) is meant to happen entirely server-side, scoped by the organisation the logged-in user belongs to. This part is generally done well (see §8) — with one significant exception (§9, item 1).

---

## 5. Database Overview

Roughly **90 tables** across the following groups. This is already close to the "minimum viable domain model" you'd want for AML/CTF — not bloated, not obviously missing core entities.

| Group | Key tables | Purpose |
|---|---|---|
| Organisations & access | `organisations`, `users`, `roles`, `permissions`, `organisation_users` | Multi-tenant accounts, RBAC |
| Customers & KYC/KYB | `customers`, `beneficial_owners`, 5 verification tables (ID doc, selfie, address, phone, email) | Onboarding & due diligence |
| Risk engine | `risk_frameworks`, `risk_categories`, `risk_factors`, `risk_library_factors`, score history | Configurable, industry-seeded risk scoring |
| Transactions & monitoring | `transactions`, `monitoring_rules`, `rule_executions`, `transaction_alerts` | Behaviour tracking, rule-based alerting |
| Screening | `screening_records`, `screening_alerts`, `crypto_wallet_screening` | Sanctions/PEP/adverse-media results |
| Cases | `cases`, `case_notes`, `case_evidence` | Investigation workspace |
| Regulatory reports | `ifti_reports`/`ttr_reports`/`smr_reports`/`ecdd_records` (maker-checker workflow), **plus** a separate `ifti_records` + `ifti_e_records` pair for Excel export | See duplication note below |
| Documents | `documents` (versioned, hashed, retention-mapped, legal-hold aware) | Evidence storage |
| Audit | `audit_log` (canonical) **and** a separate `legacy_audit_log` | Two parallel systems — see §9 |
| Billing | `subscriptions`, `invoices`, plan catalogue | Stripe-backed |
| Connectors | `connector_credentials`, `integration_providers` | Third-party API credentials, encrypted at rest |
| Governance | Policies, controls, training, independent review, board reporting, compliance calendar | Unusually deep for this stage — a real asset |

**Tenant isolation, in plain terms:** nearly every table carries an organisation-id column, and the backend consistently filters queries by "which org does the logged-in user belong to." This pattern is applied correctly in almost every module that was checked in detail — the one confirmed exception is flagged in §9.

**Migration history:** there are only 14 migration files, all from a tight few-day window. The very first one explicitly documents *why*: the team discovered the old migration history had drifted from the actual database models (a real, disclosed past incident — e.g. one column's type disagreed between migrations and code) and reset the migration history entirely rather than trying to reconcile 20 broken revisions. This means **there is no migration history before that reset point**, but everything since then is clean, well-documented, and each migration explains what bug it fixes. This should be treated as a stable foundation, not something to redo.

---

## 6. Deployment Overview

This is the area with the most internal inconsistency, and it's worth getting a straight answer on before Stage 1.

**Three deployment paths exist in the repository at the same time:**

1. **Railway** (`railway.json`) — deploys the FastAPI backend only, via Docker, with Railway injecting its own port and running database migrations automatically before each deploy.
2. **Vercel** (`web/vercel.json`) — deploys the Next.js frontend only, and hardcodes a rewrite rule pointing at `https://api.verigo.com.au/api/*` — a real-looking production domain.
3. **Self-hosted Docker Compose + Nginx** (`docker-compose.yml`, `nginx/`) — a fully independent path that runs *everything* (database, API, frontend, TLS-terminating reverse proxy) on one's own server, and is the **only path documented in depth** in `DEPLOYMENT.md`.

The presence of a real domain name (`api.verigo.com.au`) hardcoded into the Vercel rewrite rule strongly suggests **Railway + Vercel is the actual live production setup**, with the Docker/Nginx path serving as an alternative for self-hosted/on-prem customers — but the main deployment documentation doesn't say this explicitly. **This should be confirmed with you directly before Stage 1's "confirm Vercel deployment works" step**, so the baseline documentation reflects reality rather than the aspirational Docker/Nginx narrative.

**CI does not deploy anything.** GitHub Actions runs lint, type-checking (failures currently don't block the build — see §10), tests, and a Docker smoke-build, but has no step that pushes anywhere. Railway and Vercel most likely auto-deploy directly from GitHub pushes via their own native git integrations, entirely outside this repo's CI file.

**No committed secrets were found anywhere in the repository** — a targeted search for API keys, private keys, and hardcoded passwords across the whole codebase came back clean. `.env.example` is thorough and uses only placeholder values.

---

## 7. Existing AML/CTF Functionality — What Actually Works vs. What's a Stub

| Capability | Status |
|---|---|
| KYC/KYB onboarding, document upload, verification tracking | **Real, implemented** |
| Industry-specific risk scoring, seeded per organisation | **Real, implemented** |
| Sanctions/PEP/adverse-media screening (main workflow) | **Real** — via ComplyAdvantage integration and an internal cached-list fallback |
| A *second*, unauthenticated "sanctions screening" endpoint (`/api/v1/sanctions/screen`) | **Fake/demo only** — hardcoded 3-name test list, not connected to real screening. See §9, item 2. |
| Crypto wallet screening (Chainalysis, Elliptic, CryptoAPIs, GoPlus, Scorechain, OFAC SDN) | **Real HTTP integrations**, though several have response-parsing the original developer flagged as unverified against a live vendor sandbox |
| Transaction monitoring, rule builder, alerts | **Real, implemented** |
| Case management | **Real, implemented** |
| SMR / TTR / ECDD reporting with maker-checker (creator ≠ approver) | **Real, implemented** |
| IFTI-DRA reporting, AUSTRAC-format Excel export | **Real, implemented** — but see the critical bug in §9 |
| ABR (business number) lookup | **Real** — calls the free government ABR web service |
| ASIC company registry cross-check | **Stub only** — no live integration exists yet |
| Direct AUSTRAC submission API | **Stub only** — the current workflow is "export a correctly-formatted Excel file for manual upload to AUSTRAC Online," not a live API submission. (Worth noting: AUSTRAC does not currently offer a public submission API for most reporting entities, so this may not be a gap you can close yourself — it may simply reflect reality.) |
| Audit trail | **Real, implemented**, though duplicated (see §9) |
| Document evidence repository | **Real, mature** — hashing, retention rules, legal hold, MIME verification |
| Governance module (policies, controls, training, board reporting) | **Real, and unusually deep** for this stage |
| Multi-tenant RBAC (5 roles: admin/mlro/compliance/analyst/viewer) | **Real, implemented**, enforced mostly server-side |
| Billing/subscriptions (Stripe) | **Real, implemented** |
| AI compliance assistant / AI features | **Not present yet** — nothing in the codebase implements this |

---

## 8. What Should NOT Be Changed

These are genuine strengths — a rewrite here would be a step backward, not forward:

- **The tenant-isolation pattern itself** (organisation-id scoping helpers, the distinction between a per-organisation "admin" and a true cross-tenant "super admin"). It's well-designed and consistently applied everywhere except one confirmed bug (§9).
- **The auth system** (JWT + cookie + TOTP MFA + magic links) is a thoughtful, from-scratch implementation that already defends against timing attacks, user enumeration, replay, and self-serve privilege escalation. It doesn't need a rewrite or a switch to a third-party auth vendor.
- **The industry risk-library pattern** (`app/templates/risk/industries/*.py`, `app/templates/aml/industries/*.py`) — this is already a working version of the "configurable, industry-reusable risk model" concept. It seeds a shared library into per-organisation, editable database rows on signup. This is a good foundation to build the "industry pack" idea on top of, rather than inventing a new mechanism from scratch.
- **Document handling** (hashing, retention mapping, legal hold, audit-on-download) — mature and correct.
- **The regression test suite** — ~300 tests, heavily weighted toward locking in fixes for previously-found security bugs. This should be extended, not discarded.
- **The governance/GRC module** — policies, controls, training records, independent review, board reporting. This is more complete than most competitors would have at this stage and is a real product asset.

---

## 9. Known Issues (things that are actively wrong today)

Ordered by severity.

**1. Confirmed cross-tenant data leak in the IFTI-DRA module — highest priority.**
`app/api/routes/ifti.py` checks access using `current_user.role != UserRole.admin`. The problem: `admin` is a role *within one organisation* — any organisation's own admin can get this role just by signing up normally. The check should instead require the platform-wide `is_super_admin` flag (which is how every *other* admin-only area of the codebase correctly does it — the code comments in those other files even reference having fixed this exact bug before). As written, **any organisation's admin can list, read, export, edit, mark-submitted, or delete every other organisation's IFTI-DRA regulatory reports** by guessing or incrementing an ID. This affects real AUSTRAC-reportable data. This should be the first thing fixed, independent of any larger restructuring work.

**2. An unauthenticated, fake "sanctions screening" endpoint exists.**
`POST /api/v1/sanctions/screen` requires no login and internally checks names against a hardcoded 3-entry test list — it is not connected to the real screening system used elsewhere in the product. This is a double risk: it accepts free-form personal data with no authentication, and if anyone (a customer, an auditor, or a future engineer) mistakes it for the real thing, that's a compliance-integrity problem, not just a code-quality one.

**3. No server-level route protection on the frontend.**
There is no `middleware.ts`. All login/role checks happen in the browser after the page has already loaded. Combined with hardcoded demo-data fallbacks on some pages, this means the *application's own security* isn't at risk (the backend still enforces access to real data), but the **perceived professionalism and trustworthiness of the product** is — a prospective customer or auditor navigating directly to an internal URL could see a fully-populated-looking (fake) compliance dashboard before any redirect happens.

**4. Session/rate-limit protections silently weaken without Redis.**
If a production deployment doesn't set `REDIS_URL`, two things degrade quietly rather than failing loudly: logging a user out stops actually revoking their access across multiple server workers, and rate limiting stops being shared across workers. There's a startup warning, but not a hard failure. Worth confirming Redis is actually configured wherever this runs today.

**5. A likely-wrong redirect.** `next.config.js` redirects the public `/packs` marketing page to `/industry` — which is actually the *internal admin console* for managing tenant accounts, not a public page. This almost certainly should point to `/industries` instead.

None of these require a rewrite. All five are targeted, well-understood fixes.

---

## 10. Technical Debt (not broken, but worth cleaning up over time)

- **Two parallel IFTI implementations**: the maker-checker `ifti_reports` table (used by the main `/reporting` workflow) and a separate `ifti_records`/`ifti_e_records` pair (used by the standalone Excel-export module, which is where the bug in §9 lives). There's also a fully-built but unreachable `/ifti` frontend page, permanently redirected away in favour of `/reporting?type=ifti`. Worth consolidating once the priority bug is fixed, not before.
- **Two parallel audit log tables** — a canonical `AuditLog` and a `LegacyAuditLog` explicitly documented in the code as "superseded, kept only for existing consumers," but both are still actively written to by different parts of the app.
- **Frontend API calls are not centralised.** Instead of one shared API client, ~35+ pages each redeclare the API URL and several hand-roll their own near-identical fetch wrapper. This makes error handling inconsistent and any future auth or API change more error-prone to roll out.
- **Very thin shared UI component library** — only a `button` and `card` component exist in `web/components/ui/`. Every table, modal, and form across ~40 page routes is a hand-built one-off. This isn't broken, but it's the main reason the frontend will be slow to extend consistently going forward.
- **A dead backend router** (`app/api/routes/orgs.py`) exists but is never registered in `main.py` — superseded by `organisations.py`. Safe to delete once confirmed unused.
- **Two stray, extension-less root files** (`KYC`, `corebackend`) contain planning notes/scaffolding for a differently-named, unrelated project — not part of VeriGo. They likely evaded `.gitignore`'s Python-file rule specifically because they have no file extension. Safe to delete.
- **A build artifact is committed to git** (`web/tsconfig.tsbuildinfo`, 220KB) — should be removed and gitignored.
- **ASIC and AUSTRAC direct-submission integrations are stubs.** This may be an acceptable, permanent state (AUSTRAC doesn't broadly offer a submission API) rather than "unfinished work" — worth clarifying expectations rather than treating it as a gap to close.
- **Documentation drift**: the app-level and nginx-level rate-limit numbers don't match; the coverage gate is actually 58%, not the 60% claimed in README/DEPLOYMENT.md; the storage backend options listed in `.env.example` (including Supabase, R2) aren't all mentioned in DEPLOYMENT.md.
- **CI doesn't block on type errors** (`mypy ... || true`) — type-checking runs but can't currently fail the build.
- **Test coverage has real gaps**: several important modules have no dedicated tests at all (case management, the standalone risk-assessment routes, most of the governance module, the unauthenticated fake sanctions endpoint), and MFA/email-sending code is explicitly excluded from the coverage measurement — meaning some of the most security-sensitive code has no enforced test floor.
- **Dependency staleness**: most backend packages are pinned to mid-2024 versions; `python-jose` and `passlib` are both unmaintained upstream projects worth planning a migration away from eventually (not urgent).
- **`STORAGE_ENCRYPTION_KEY` operational trap**: if this isn't set explicitly, it's silently derived from the JWT `SECRET_KEY`. Rotating the JWT secret in response to a security incident would then also break decryption of stored tenant credentials — worth documenting in an incident-response runbook.

---

## Summary Table

| Question | Answer |
|---|---|
| What works? | Almost everything in the core AML workflow — KYC/KYB, risk scoring, screening, monitoring, case management, SMR/TTR/ECDD/IFTI reporting, audit trail, billing, governance. |
| What doesn't work / is actively wrong? | One confirmed cross-tenant data leak (IFTI module), one fake unauthenticated endpoint, no frontend route protection. |
| What's incomplete? | ASIC & AUSTRAC live integrations (stubs), AI features (not started), a few crypto-screening integrations need sandbox verification. |
| What's duplicated? | IFTI logic (two systems), audit logging (two tables), frontend API-fetch code, two stray root files. |
| What's technically risky? | Redis-dependent protections that silently degrade, stale JWT/password-hashing libraries, thin test coverage on some modules. |
| What should be preserved? | Tenant isolation pattern, auth/MFA system, industry risk-library pattern, document handling, governance module, existing test suite. |
| What should eventually change? | Consolidate duplicate systems, add frontend middleware, centralise API client code, build out a real shared UI component library, upgrade stale dependencies. |

---

## STAGE STATUS

**Stage:** 0 — Repository Discovery
**Status:** COMPLETE

**What works:** The application is a real, largely-functional AML/CTF platform, not a prototype. Core compliance workflows (onboarding, KYC/KYB, risk scoring, screening, monitoring, cases, regulatory reporting, audit, governance, billing) are genuinely implemented, and the security architecture is thoughtful and mostly correctly applied.

**Known issues:** One confirmed cross-tenant data-leak bug in the IFTI module (§9.1); one unauthenticated fake screening endpoint (§9.2); no frontend-level route protection (§9.3); Redis-dependent protections that silently weaken if misconfigured (§9.4); one likely-wrong marketing redirect (§9.5).

**Security concerns:** The IFTI cross-tenant leak (§9.1) is the one item that should not wait for a broader stage — it affects real regulated report data across every tenant. Everything else identified is manageable within the normal stage sequence.

**Technical debt:** Moderate and well-understood — mostly duplication (two IFTI systems, two audit-log tables), documentation drift, thin frontend componentisation, and stale dependencies. Nothing here blocks progress; it's a cleanup backlog, not a crisis.

**Recommended next stage:** Stage 1 (Safe Development Baseline).

**Update (Stage 1, since this was written):**
1. **Production deployment topology confirmed by you:** Railway (API) + Vercel (frontend), as this document guessed from the hardcoded `api.verigo.com.au` domain.
2. **The IFTI cross-tenant bug (§9.1) is fixed** — see commit "Fix cross-tenant IDOR in IFTI module: gate on is_super_admin, not admin role." Verified with a new regression test suite (9 tests) that fails against the old code and passes with the fix; full existing suite (415 tests) still green.
3. **A second, unrelated critical baseline bug was found and partly fixed during Stage 1:** a genuinely fresh PostgreSQL database could not run `alembic upgrade head` at all (12 model modules were never imported into `Base.metadata`). Root cause fixed; one downstream migration conflict fixed; at least one more migration is known to have the same class of conflict and is not yet fixed. See `DEVELOPMENT.md` §5 for full detail — this is now the top open item.
