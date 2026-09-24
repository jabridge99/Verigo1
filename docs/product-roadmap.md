# VeriGo — Current-State Assessment & Product Roadmap

**Purpose:** a single, plain-English report answering "where does VeriGo stand today, how does it compare to what else exists, and what should happen next" — written for a non-programmer reading alongside a technical advisor.

**How this was built:** most of this report synthesises work already done and documented elsewhere in this repository (`CURRENT_STATE.md`, `STRUCTURE_REVIEW.md`, the `docs/*.md` domain write-ups, and `PARKING_LOT.md`) rather than re-inspecting the codebase from scratch — that inspection already happened, in depth, across an 11-stage review. What's genuinely new here: external research into comparable open-source projects (Section 3), a capability benchmark against them (Section 4), product differentiation and AI-feature thinking (Sections 10–11), and a consolidated roadmap (Section 16).

**No code was changed to produce this report**, per instruction. It is an assessment and a set of recommendations, not an implementation.

**A note on scope:** throughout, this report tries to keep three different kinds of statement clearly separated:
- **Regulatory requirement** — something AUSTRAC/the AML/CTF Act actually requires.
- **Recommended feature** — something not legally required, but that would make the product better or more competitive.
- **Design/architecture decision** — a technical choice with no compliance weight either way.

Where that distinction matters, it's called out explicitly. **This report does not, and no software can, make an organisation "automatically compliant."** VeriGo is a tool that supports a compliance program a human still has to design, operate, and take responsibility for.

---

## Executive Summary

VeriGo is a real, substantially-built AML/CTF compliance platform, not a prototype — a two-service web application (Next.js frontend, FastAPI backend, PostgreSQL database) covering the full AML/CTF lifecycle: customer onboarding and KYC/KYB, risk scoring, sanctions/PEP screening, transaction monitoring, case management, Australian regulatory reporting (SMR/TTR/IFTI), audit trail, and a genuinely deep governance module (policies, controls, training, board reporting). Across this session's own 11-stage review, a confirmed cross-tenant data leak was found and fixed, a broken auth pattern that made most of the app unusable in a real browser session was found and fixed, CSRF protection was added, and audit-trail coverage was extended to essentially the whole app. What's left (documented in detail in `PARKING_LOT.md`) is mostly known, bounded, non-urgent work: industry-template content that needs deepening for several sectors, a couple of duplicate/competing subsystems that need a product decision (not a bug fix), and ordinary technical debt.

Compared to the open-source AML/CTF landscape (Section 3), nothing found is a complete, off-the-shelf competitor covering onboarding + risk + screening + monitoring + case management + Australian regulatory reporting + governance in one product — the closest comparisons (Ballerine for KYC/KYB orchestration, Marble and Jube for transaction monitoring/case management, OpenSanctions/Yente for sanctions data and matching) each cover one slice of what VeriGo already does end-to-end. VeriGo's real, defensible differentiators are: (1) Australia-specific regulatory depth (AUSTRAC report formats, the $10,000 TTR/IFTI threshold, industry-specific designated-service logic) that a generic global tool doesn't have out of the box, and (2) the governance/GRC layer (policies, controls, training, independent review, board reporting), which most comparable open-source projects don't attempt at all.

The single highest-value near-term investment is **Stage 12 — an AI Compliance Assistant** (Section 11): nothing in the codebase does this today, it's a genuine differentiator few competitors in this space do well, and VeriGo's existing data model (rich structured records for every customer, case, alert, and report) is unusually well-suited to it.

---

## 1. What I Currently Have

VeriGo today, in one paragraph: a multi-tenant SaaS application where an accounting firm, real estate agency, remittance provider, or other AUSTRAC-regulated business signs up, gets an industry-specific AML/CTF program and risk framework auto-generated, onboards its own customers with KYC/KYB and beneficial-ownership checks, screens them against sanctions/PEP/adverse-media lists, scores their risk, monitors their transactions against configurable rules, investigates alerts through a case-management workflow, and produces AUSTRAC-format regulatory reports (SMR, TTR, IFTI) with a maker-checker approval step — all logged to an audit trail, all backed by a governance layer of policies, controls, staff training records, and board reporting.

Scale, concretely: ~55 backend route files exposing ~650 API endpoints, ~90 database tables, ~40 frontend pages, and a regression test suite of ~415+ tests (many specifically written to lock in fixes for previously-found bugs). This is already close to the minimum viable domain model for AML/CTF — not bloated, not missing obvious core entities.

**What actually works today (real, implemented, not a stub):**
- KYC/KYB onboarding — identity document, selfie/liveness, address/phone/email verification, beneficial ownership
- Industry-seeded risk scoring (customer-level and organisation-level EWRA)
- Sanctions/PEP/adverse-media screening (via ComplyAdvantage, plus an internal cached-list fallback)
- Crypto wallet screening (Chainalysis, Elliptic, CryptoAPIs, GoPlus, Scorechain, OFAC SDN)
- Transaction monitoring, rule-based alerting
- Case management
- SMR / TTR / IFTI regulatory reporting with maker-checker approval
- ABR (Australian Business Register) lookup
- Audit trail covering essentially the whole application
- Document evidence repository (hashing, retention, legal hold, MIME verification)
- Governance module: policies, controls, training records, independent review, board reporting
- Multi-tenant role-based access control (admin / MLRO / compliance / analyst / viewer)
- Billing/subscriptions via Stripe

**What's a stub or not yet started:**
- ASIC company registry cross-check (stub)
- Direct AUSTRAC submission API (stub — but AUSTRAC itself doesn't broadly offer a public submission API for most reporting entities, so this may not be a gap that's actually closeable)
- AI compliance features (not started — see Section 11)
- Production-scale transaction ingestion (today: manual entry only; no batch/API/core-banking connector)

Full detail: `CURRENT_STATE.md`.

---

## 2. Current Architecture

```
┌─────────────────────┐        ┌──────────────────────┐        ┌──────────────┐
│  Next.js frontend    │  REST  │  FastAPI backend      │  SQL   │  PostgreSQL   │
│  (web/) ~40 pages     │ ─────▶ │  (app/) ~55 route     │ ─────▶ │  ~90 tables   │
│                       │  JSON  │  files, ~650 endpoints│        │               │
└─────────────────────┘        └──────────────────────┘        └──────────────┘
```

- The frontend never talks to the database directly — only to the backend's REST API.
- The backend is the single source of truth for security: every request is scoped to the logged-in user's organisation (tenant) server-side.
- A background scheduler (APScheduler, Redis-locked) runs recurring jobs — reminders, retention sweeps — inside the backend process.

**Tech stack:** FastAPI 0.111 + SQLAlchemy 2.0/Alembic + PostgreSQL 16 on the backend; custom JWT + bcrypt + hand-built TOTP MFA for auth (no third-party auth vendor); Next.js 16 + React 18.3 + TypeScript on the frontend; Tailwind + a thin shadcn/ui layer; Stripe for billing; pluggable storage (local disk, S3, R2, Azure Blob, GCS, Supabase); Sentry for observability; GitHub Actions CI (lint, type-check, tests, Docker smoke-build — no deploy step).

**Deployment:** Railway (backend) + Vercel (frontend) is the confirmed live production setup; a full self-hosted Docker Compose + Nginx path also exists for on-prem/self-hosted customers.

**Why this architecture should not be rearchitected:** this is a conventional, appropriate shape for a SaaS product at this stage. The tenant-isolation pattern, the from-scratch auth system (JWT + cookie + MFA + magic links, now also CSRF-protected), the industry risk-library pattern, and document handling are all genuine strengths confirmed by direct code review — rewriting any of them would be a step backward. Full detail: `CURRENT_STATE.md` §8.

---

## 3. Relevant Open-Source Projects

External research (GitHub, project docs) into comparable open-source tools, done specifically for this report. None of these is a drop-in replacement for VeriGo as a whole — each covers one slice of the AML/CTF workflow. Licence terms are noted because several carry real restrictions for a company operating a *hosted, paid* SaaS product (as opposed to using the software purely internally) — **verify the exact current licence text on the project's own repository before adopting anything**, licences do change between versions.

| Project | What it covers | Licence (as researched — verify before use) | Adopt / Adapt / Avoid, and why |
|---|---|---|---|
| **[Ballerine](https://github.com/ballerine-io/ballerine)** | Open-source KYC/KYB orchestration: identity flows, a rules/workflow engine, manual-review back office, 3rd-party verification-provider plugins | Mixed across its sub-repos — some components carry copyleft terms | **Avoid adopting wholesale.** VeriGo's own onboarding/KYC flow already does more (beneficial ownership, industry-specific risk seeding) than Ballerine's generic flow. Worth a design read for its plugin/provider-orchestration pattern, not for its code. |
| **[Jube](https://github.com/jube-home/aml-fraud-transaction-monitoring)** | Real-time AML/fraud transaction monitoring, adaptive ML + rule-based detection, workflow-driven case management | **AGPLv3** (copyleft — using it inside a hosted service can trigger obligations to publish your own modifications) | **Avoid** for direct code reuse in a closed-source hosted product without legal review of AGPL's network-use clause. Worth studying its rule/ML hybrid approach conceptually. |
| **[Marble](https://github.com/checkmarble/marble)** | Real-time decision engine for fraud/AML; unified case manager for investigating alerts | **Elastic License v2** on at least parts of the project — explicitly forbids offering the software itself as a hosted/managed service to third parties | **Avoid for direct reuse** — ELv2's "no hosted service" clause is a direct conflict with VeriGo's own business model (VeriGo *is* a hosted service). Its case-manager UX (unified alert investigation, no context-switching) is a good reference point for VeriGo's own case-management screens. |
| **[OpenSanctions](https://github.com/opensanctions/opensanctions)** / **Yente** (matching API) / **Nomenklatura** (entity matching library) | Open, aggregated sanctions/PEP/watchlist data (461+ sources) plus name-matching tooling | Code: **MIT**. Data: **CC BY-NC 4.0** (non-commercial) | **Worth evaluating as a supplementary/fallback data source or matching-algorithm reference**, but the data licence's non-commercial restriction is a real problem for a paid SaaS product using it as a primary screening source — would need OpenSanctions' own commercial data licence, not the free CC BY-NC feed. VeriGo's existing ComplyAdvantage integration is already licensed for commercial use; this is not an urgent replacement. |
| **[moov-io/watchman](https://github.com/moov-io/watchman)** | Self-hosted OFAC/consolidated-sanctions-list search service | **Apache 2.0** (permissive) | **Genuinely adoptable** as a self-hosted, free fallback/second-opinion sanctions check alongside the existing ComplyAdvantage integration, if a low-cost redundancy layer is ever wanted. Not a reason to replace the existing screening system. |
| **Flowintel / Foreman / L.I.A.M** | General-purpose case-management/investigation tooling (built for security-analyst or digital-forensics workflows, not AML specifically) | Mixed, mostly permissive | **Avoid.** Not AML-domain-shaped (no customer/transaction/report linkage); VeriGo's own case-management module is already more fit-for-purpose for this use case. |

**Overall conclusion for Section 3:** there is no single open-source project worth adopting wholesale — VeriGo's own build already covers more ground, in an Australia-specific way, than any one of these. The genuinely useful thing from this research is **negative confirmation**: nothing here is quietly doing what VeriGo does better, so the roadmap below is about extending VeriGo's own strengths, not catching up to something else. Two narrow, low-risk technical ideas worth carrying forward: `moov-io/watchman`'s permissively-licensed OFAC-list self-hosting pattern (as a fallback), and Marble's unified case-investigation UX as a design reference (not code reuse).

---

## 4. AML/CTF Capability Benchmark

A capability-by-capability comparison of VeriGo against the closest comparable tools researched in Section 3, plus a general sense of where commercial competitors (Napier, ComplyAdvantage's own platform, Refinitiv, NICE Actimize — not independently re-verified here, based on general market knowledge) tend to sit.

| Capability | VeriGo today | Best comparable OSS project | Typical commercial competitor |
|---|---|---|---|
| KYC/KYB onboarding | Real, implemented | Ballerine (generic flow) | Yes, usually stronger document-verification vendor integrations |
| Industry-specific risk scoring | Real, seeded per org/industry | Not found in OSS | Yes, usually configurable |
| Sanctions/PEP/adverse media screening | Real (ComplyAdvantage + fallback) | OpenSanctions (data only, non-commercial licence) | Yes, core feature |
| Crypto wallet / VASP screening | Real (6 integrations) | Not found in general-purpose OSS | Specialist vendors only (Chainalysis, Elliptic) |
| Transaction monitoring (rules) | Real | Jube, Marble | Yes, usually with more mature ML |
| Case management | Real | Marble, Flowintel (generic) | Yes |
| Australian regulatory reporting (SMR/TTR/IFTI, AUSTRAC formats) | Real, Australia-specific | **None found** | Rare — most commercial tools are US/UK/EU-first |
| Maker-checker approval workflow | Real | Not commonly found in OSS | Yes |
| Audit trail | Real, comprehensive | Partial in most OSS | Yes |
| Governance (policies, controls, training, board reporting) | Real, unusually deep for this stage | **None found in OSS** | Rare even in commercial tools below enterprise tier |
| Multi-tenant SaaS / billing | Real | Not applicable (most OSS is self-hosted, single-tenant) | Yes |
| AI-assisted compliance features | **Not started** | Not found in OSS reviewed | Emerging in some commercial platforms (2025-2026 vintage) |
| Production transaction ingestion (batch/API/core-banking) | Manual entry only | Varies | Yes, standard |

**Reading this table:** VeriGo's genuine, defensible edge is Australia-specific regulatory depth and the governance/GRC layer — neither shows up in any open-source project reviewed, and both are the two things a compliance officer at an AUSTRAC-regulated business would actually care about most. VeriGo's real gaps against a mature commercial platform are AI features (not started) and production-scale transaction ingestion (manual-entry only) — both good candidates for the roadmap below.

---

## 5–9. Architecture, Repository Structure, Database, Compliance Workflow, Missing Features

These five areas are already thoroughly documented elsewhere in this repository from the 11-stage review that has already happened — repeating them in full here would be redundant. Rather than re-deriving them, here is a synthesis with pointers to the source-of-truth document for each.

### 5. Architecture — verdict: keep, don't rebuild
Confirmed sound at Stage 0 and unchanged since: `CURRENT_STATE.md` §1, §8.

### 6. Repository structure — verdict: sound top-level shape, targeted internal tidying only
The existing `app/{api/routes, models, schemas, services, integrations, templates}` and `web/{app, components, lib}` layout is conventional and confirmed *not* something to reorganise. What's queued (not urgent, tracked as **C2** in `PARKING_LOT.md`): a central frontend API client (~35+ pages currently redeclare it), a real shared UI component library (currently only 2 shared primitives — button, card), splitting a handful of oversized backend route files (`customers.py` at 2,365 lines being the largest) into sub-routers, and moving 13 files' inline Pydantic schemas into the shared `app/schemas/` convention the other 43 already follow. Full detail: `STRUCTURE_REVIEW.md`.

### 7. Database structure — verdict: close to minimum viable domain model, no redesign needed
~90 tables, described table-group-by-table-group in `CURRENT_STATE.md` §5. Tenant isolation (an organisation-id column, consistently filtered server-side) is applied correctly almost everywhere — the one confirmed exception (the IFTI cross-tenant bug) is already fixed. Two known duplications, both tracked and understood rather than urgent: a legacy vs. canonical audit-log table pair, and two parallel IFTI-report table structures (the maker-checker `ifti_reports` table used by the main workflow, and a separate `ifti_records`/`ifti_e_records` pair used by the Excel-export module). Full detail: `docs/database.md`, `CURRENT_STATE.md` §10.

### 8. Compliance workflow — verdict: real, complete end-to-end
```
Sign up → org created → onboarding wizard (industry, risk appetite)
  → industry AML program + risk library auto-seeded
  → add customer → KYC/KYB → beneficial ownership → screening
  → risk score + rating assigned → approve/reject/escalate
  → transactions recorded → monitoring rules → alerts
  → alerts triaged → case opened → investigated → decision recorded
  → SMR/TTR/IFTI reports prepared (maker ≠ checker) → submitted
  → everything logged to the audit trail
```
This is a real, working AML/CTF lifecycle, not a mockup. Domain-by-domain detail: `docs/customer-onboarding.md`, `docs/risk-engine.md`, `docs/aml-program.md`, `docs/transaction-monitoring.md`, `docs/case-management.md`, `docs/regulatory-reporting.md`, `docs/audit-evidence.md`.

### 9. Missing features
The authoritative, current, itemised list is `PARKING_LOT.md`'s "Open items — at a glance" table (21 open items as of this report). In summary, grouped by why each is open:
- **Needs a product/pricing decision, not a code fix:** two competing AML-program-generation systems (P12) tied to a live subscription paywall; two independent rule engines (P25); Independent Review report packaging/pricing (P16).
- **Needs your sign-off before content-authoring work starts:** industry-template depth gaps for Conveyancers, Remittance, VASP, Legal, Accountants, Real Estate (P17–P20, P22–P23) — each already researched against the real document library, each a content-writing task rather than a bug.
- **Needs a data-model decision:** operational logs (ECDD case files, TMP alert logs) have no structured home yet (P24); structured compliance-breach tracking doesn't exist (P34).
- **Bounded, scheduled, non-urgent:** per-org configurable risk weights (P10); production transaction ingestion beyond manual entry (P27); exact cell-by-cell AUSTRAC template fidelity for IFTI-DRA export (P32); a raw-ORM-object HTTP serialisation bug affecting at least one endpoint (P36).
- **Mechanical backlog with no functional urgency:** C2 (frontend/backend structural tidying), C4 (naming), P5 (SQLAlchemy type-annotation retrofit), P4 (a policy-status mapping judgment call).

---

## 10. Innovative Features / Differentiators

What would make VeriGo stand out, distinct from simply matching competitors — split by what's already true today versus what's a genuine opportunity.

**Already differentiating (real, in the product today):**
- **Australia-specific regulatory depth out of the box** — AUSTRAC report formats, the $10,000 TTR/IFTI threshold applied consistently, industry-specific designated-service boundaries. This is the single hardest thing for a generic (usually US/UK-first) competitor to retrofit.
- **The governance/GRC layer** (policies, controls, training records, independent review, board reporting) bundled with the operational AML tooling, rather than sold as a separate product. Section 4's benchmark found nothing comparable in the open-source space, and it's uncommon even in commercial tools below enterprise pricing tiers.
- **Industry-seeded risk libraries and AML programs** — a new organisation gets a working, industry-tailored starting point on day one rather than a blank form.

**Recommended features — genuine opportunities, not required by any regulation:**
- **AI Compliance Assistant** (Stage 12 — see Section 11 in full).
- **A real "compliance health score" for a firm** — one dashboard number derived from the existing governance data (policy currency, training completion rate, open control-test failures, overdue reviews) that a small-business owner can actually understand without a compliance background — the target market is explicitly non-specialist, and this is presenting existing data more usefully rather than building anything new.
- **A guided remediation view for open case/alert backlogs**, prioritised by risk and statutory deadline, rather than a flat list — again a presentation layer over data that already exists.
- **A cross-industry benchmark view** (anonymised/aggregated across VeriGo's tenant base) letting a compliance officer see "is my alert volume/false-positive rate typical for a business my size in my sector" — this would be a genuinely new data product, not just a UI change, and would need a clear data-use/privacy design before building (tenant data must never leak across organisations, so this needs careful, explicit aggregation — not a quick feature).

---

## 11. AI Features (Stage 12 groundwork)

Nothing in the codebase implements AI features today — this section is forward-looking design thinking to seed Stage 12, not a description of anything built. Ideas below are grouped by how close they sit to the existing data model (closer = lower-risk, faster to build), and each is explicitly labelled as a **recommended feature**, not a regulatory requirement — AUSTRAC does not require AI in a compliance program.

**Near-term, low-risk (build on existing structured data, no new AI infrastructure):**
- **Narrative drafting assistance** — pre-filling the free-text fields regulatory reports already have (SMR grounds for suspicion, case investigation notes, board-report commentary) from the structured facts already on the record (customer risk factors, alert triggers, screening hits), with the human always reviewing and editing before submission. This is drafting help, not a decision-maker — the compliance officer stays the one who decides and signs off, which matters both for AUSTRAC's expectations and for not overstating what the tool does.
- **Alert triage summarisation** — a short, plain-English summary of what a monitoring alert or case actually contains (which existing rule fired, on what transaction pattern, against which customer risk profile) to speed up an analyst's first read, generated from data VeriGo already has rather than anything novel.
- **Policy/document Q&A** — letting a user ask "does our AML program cover X" in plain English, answered by searching the org's own existing policy/program text (already stored, already versioned) rather than a general knowledge base — keeps answers grounded in the firm's actual, current documents rather than invented.

**Medium-term (real new capability, more design/validation work before shipping):**
- **Risk-factor suggestion** — surfacing patterns in a customer's data that resemble known typologies (using the AUSTRAC typology material already used to build the industry risk templates) as a suggestion for a human to review, never as an automatic score change. This has to be built carefully: a wrong suggestion that gets rubber-stamped is worse than no suggestion, so any version of this needs a clear "this is a prompt for a human, not a finding" framing in the UI itself, not just in a policy document.
- **Transaction-pattern anomaly flagging** — a complement to (not replacement for) the existing rule-based monitoring, flagging patterns the fixed rules don't catch, for a human to assess. Needs real transaction volume to train/tune against, which ties into the same production-ingestion gap noted in Section 9 (P27) — worth sequencing after that, not before.

**What NOT to do, and why (a real risk, not just a caution):** nothing here should ever auto-submit a regulatory report, auto-close a case, or auto-clear a screening hit without a human decision in the loop — both because AUSTRAC's maker-checker expectations exist precisely to keep a human accountable for these decisions, and because an AI system making a wrong call on a suspicious-matter determination is a materially worse outcome than a slow one. Every AI feature above is designed as an assistant to a human decision-maker, not a replacement for one.

---

## 12. Security Risks

Current state, based on the security work already completed this session plus what remains open.

**Already fixed (not currently a risk):**
- Cross-tenant data leak in the IFTI module (was: any org's own admin could access every other org's IFTI reports) — fixed, regression-tested.
- Auth pattern that silently broke most of the app in a real browser session (P35) — fixed across ~44 frontend files, live-verified.
- No CSRF protection on cookie-authenticated requests — fixed (double-submit-cookie pattern).
- An unauthenticated, fake sanctions-screening endpoint — fixed per `CURRENT_STATE.md` §9.

**Still open, none critical, all tracked:**
- **Redis-dependent protections silently weaken without Redis configured** — logout-based session revocation and rate limiting both degrade quietly (a startup warning, not a hard failure) if `REDIS_URL` isn't set in a given deployment. Worth confirming Redis is actually configured in production rather than assuming it.
- **`STORAGE_ENCRYPTION_KEY` operational trap** — if not explicitly set, it's silently derived from the JWT secret key. Rotating the JWT secret during an incident response would then also break decryption of stored tenant credentials. This should be documented in an incident-response runbook, not necessarily code-changed.
- **Dependency staleness** — `python-jose` and `passlib` (JWT and password hashing) are both effectively unmaintained upstream. Not an active known vulnerability, but worth an eventual migration (PyJWT is the commonly recommended replacement for `python-jose`). Not urgent.
- **Thin test coverage on some security-sensitive modules** — MFA and email-sending code are explicitly excluded from the coverage measurement; case management and some governance routes have limited dedicated tests.
- **No committed secrets found anywhere in the repository** — a targeted search across the whole codebase for API keys, private keys, and hardcoded passwords came back clean, and `.env.example` uses only placeholders. Nothing to flag or stop for.

---

## 13. Deployment Recommendations

Current production setup — Railway (backend API) + Vercel (frontend) — is confirmed and appropriate; no change recommended. Two things worth doing, both low-effort:
- **Confirm this explicitly in `DEPLOYMENT.md`.** The self-hosted Docker Compose + Nginx path is currently the *only* path documented in depth, which misrepresents what's actually running in production. Keep the Docker path documented too (it's genuinely useful for self-hosted/on-prem customers), but make the Railway+Vercel path the clearly-labelled default.
- **Add a CI deployment gate, even a manual-approval one.** CI currently runs lint/type-check/tests/a Docker smoke-build but has no deploy step at all — Railway and Vercel most likely auto-deploy directly from GitHub pushes via their own native integrations, outside this repo's CI file entirely. Worth confirming that's the actual intended behaviour (rather than an oversight), and considering whether a required-CI-green gate should sit in front of that auto-deploy for a compliance product specifically — reducing the odds of a broken build reaching production data.

---

## 14. Technical Debt

The authoritative, current list is `CURRENT_STATE.md` §10 and `PARKING_LOT.md`'s "F. Structural / mechanical backlog". Summarised, ordered roughly by how much it currently costs versus how much effort to fix:

| Item | Cost of leaving it | Effort to fix |
|---|---|---|
| No central frontend API client (~35+ pages redeclare it) | Inconsistent error handling, slower/riskier future auth changes | Moderate, incremental |
| Thin shared UI component library (2 primitives) | Slower to build new UI consistently | Moderate, incremental |
| Two parallel audit-log tables | Low — both already merged into the one API consumers use | Low priority |
| Two parallel IFTI table structures | Low-moderate — confusing to maintain, not currently broken | Moderate, needs care |
| Oversized route files (`customers.py` 2,365 lines, etc.) | Low — works, but slower to navigate/extend | Moderate, mechanical, file-by-file |
| ~2,500 SQLAlchemy columns without `Mapped[]` type annotations | Low — the ~60 mypy actually flags are fixed; rest is masked type-safety | Large but purely mechanical |
| CI doesn't block on type errors (`mypy ... \|\| true` in some contexts) | Real — type errors can reach production undetected | Low — flip the gate, then fix what surfaces |
| `python-jose`/`passlib` unmaintained upstream | Low today, grows over time | Moderate — a real migration project |
| A raw-ORM-object HTTP serialisation bug (P36) | Unknown blast radius — only confirmed on one endpoint so far | Needs investigation before effort estimate |

None of this blocks further product work — it's a cleanup backlog, not a crisis, consistent with every prior stage's own conclusion.

---

## 15. AI Compliance Assistant — see Section 11
(Kept as its own numbered section per the original 16-section brief; content lives in Section 11 above to avoid duplication.)

---

## 16. Recommended Roadmap

A phased sequence, building on the "Suggested future development" order already in `PARKING_LOT.md` (which reflects hands-on knowledge of what's genuinely ready to build next) plus this report's new findings.

**Phase 1 — Decisions that unblock everything else (no build yet)**
Get your sign-off on the items that are blocked purely on a decision, not effort: the AML-program-generation architecture/paywall question (P12), the rule-engine merge-or-build-UI question (P25), and go-ahead to start the industry-template content rewrites (P17–P20, P22–P23). Nothing else in this roadmap can sequence sensibly until these are resolved, since several later items depend on which system "wins."

**Phase 2 — Industry content depth (the largest body of ready-to-start work)**
Rewrite the industry templates in priority order already established: Conveyancers first (needs its own new module), then Remittance and VASP (most mature reference material, Remittance missing AUSTRAC's #1 typology outright), then Legal/Accountants/Real Estate, then DPMS's remaining depth. Build the operational-log data model (P24) alongside or just before this, since the richer content assumes somewhere to log an ECDD case file or TMP alert.

**Phase 3 — Platform completeness**
Per-org configurable risk weights (P10); structured compliance-breach tracking (P34); resolve the onboarding wizard's remaining UX/paywall question once P12 is decided; production transaction ingestion beyond manual entry (P27) — sequenced here because Phase 4's anomaly-detection AI feature needs real volume to be useful.

**Phase 4 — AI Compliance Assistant (Stage 12)**
Start with the near-term, low-risk items from Section 11 (narrative drafting assistance, alert summarisation, policy Q&A) — all build on data VeriGo already has, all keep a human as the decision-maker. Only take on risk-factor suggestion and transaction-anomaly flagging once the near-term features are live and validated, and only with the explicit "this is a suggestion for a human, not a finding" framing built into the UI from day one.

**Phase 5 — Commercialisation (Stage 13) and mechanical cleanup**
Independent Review deliverable pricing/packaging (P16); the Liddar real-world validation check once that client is live on the platform (P15); the structural/mechanical backlog (C2, C4, P5, P4) picked up opportunistically rather than blocking anything ahead of it, since none of it is functionally urgent.

Throughout every phase: keep extending the existing regression test suite rather than treating it as separate work, and keep the audit trail / maker-checker pattern as the default for any new mutating feature, including AI-assisted ones — it's the pattern the whole rest of the product already earns trust from, and AI features are exactly where that discipline matters most.

---

## Top 10 Actions

Ranked by a mix of urgency, effort, and how much they unblock other work — not a strict priority order, since several are independent.

1. **Get sign-off on Phase 1's three architecture decisions (P12, P25, and the industry-template go-ahead)** — nothing in Phase 2 onward can sequence properly until these are resolved, and none of them requires new code, only a decision.
2. **Confirm the Redis/production-config items in Section 12** (Redis actually configured; document the `STORAGE_ENCRYPTION_KEY`/JWT-secret-rotation interaction in a runbook) — cheap, closes a real operational gap.
3. **Update `DEPLOYMENT.md` to reflect Railway+Vercel as the actual default**, keeping the Docker path documented as the self-hosted alternative — a documentation fix, not code, and removes a real confusion risk for anyone onboarding to this repo.
4. **Start Conveyancers as the first industry-template rewrite** — has its own already-researched content and no existing module to untangle, the cleanest starting point in Phase 2.
5. **Build the operational-log data model (P24)** before or alongside further template content, so the richer content being written doesn't describe a workflow the product has nowhere to actually run.
6. **Flip CI's mypy gate to actually block the build** where it doesn't already — a real type error currently can reach production undetected in some paths; low effort, real payoff.
7. **Scope and start Phase 4's first AI feature (narrative drafting assistance)** as a bounded pilot — highest differentiation value in this whole report, and the near-term version needs no new infrastructure, just careful UI framing to keep a human as decision-maker.
8. **Investigate P36 (the raw-ORM-response serialisation bug)** — currently confirmed on one endpoint, unknown how many others share it; worth a focused look specifically because the blast radius is unknown.
9. **Decide P25 (the two live rule engines) and either build a real UI for `MonitoringRule` or merge it into Rule Builder** — not urgent today since the unseen engine works correctly, but the gap only gets more confusing as more starter rules accumulate.
10. **Schedule the Liddar real-world validation check (P15)** for whenever that client goes live on the platform — the single best available "does this hold up against a real, professionally-reviewed instance of this industry" test, and costs nothing to schedule now even though it can't run yet.

---

*This report was produced without making any code changes, per instruction. Everything above is an assessment and a set of recommendations for your review — nothing here has been implemented.*
