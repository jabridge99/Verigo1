# VeriGo — Audit & Evidence (Stage 11)

> **Addendum (P29, most of the AML/CTF-relevant subset resolved — see
> `PARKING_LOT.md`):** §3's "Not fixed this stage" list named seven files —
> `retention.py`, `screening.py`, `independent_review.py`,
> `board_reporting.py`, `monitoring.py`, `compliance_calendar.py`,
> `onboarding.py` — as the highest-value remaining gaps. All seven now call
> the central audit trail. Two corrections to this doc's original framing
> surfaced doing that work: `retention.py` has no destructive/irreversible
> action at all (`generate_purge_report()` is explicitly dry-run-only —
> the "destructive/irreversible" framing below overstated it); and
> `onboarding.py` already had its own audit trail (`OnboardingAuditLog`,
> `GET /onboarding/sessions/{id}/audit`) that was never merged into the
> central `GET /audit/` this doc describes, so onboarding events were
> invisible from the one place described in §1 as "the" audit trail — now
> also written to the central trail (entity_type `onboarding_session`)
> alongside the pre-existing session-scoped one. The remaining ~28 files
> P29 originally left untriaged are reparked as P33, since a few of them
> (`risk_assessment.py`, `aml_program.py`, `professional_assessment.py`,
> `rule_builder.py`, `examination_packs.py`, `customer_workflow.py`) look
> AML/CTF-relevant on inspection despite not being named in the original
> "commercial/infrastructure" bucket below.

**Purpose:** Stage 11 asks VeriGo to be audit-ready: an audit log, an evidence repository, and history for compliance, risk, customers, cases, reports, and user activity — so a reporting entity can answer "what happened? when? who did it? why? what evidence supported the decision?" for anything in the system.

**Headline finding:** the audit trail itself was, by this stage, already substantially real — Stages 8–10 each found and fixed a version of "this domain's mutating endpoints never wrote to the audit trail" (transaction monitoring, case management, regulatory reporting). Stage 11 found two more instances of the same gap (KYC decisions, transaction records) and, more importantly, found that the one place a human would actually go to read all of this — the audit trail page itself — was showing twelve fabricated demo entries whenever a real query came back empty, with a filter UI built around entity types that don't exist in the real data. Both fixed.

---

## 1. What "history" looks like today, per Stage 11's list

| Stage 11 requirement | Status |
|---|---|
| Audit log | Built and reachable — `GET /audit/` (merges two underlying tables, see §2), with a real frontend (`web/app/audit/page.tsx`, fixed this stage — see §3) |
| Evidence repository | Built — `app/api/routes/documents.py` (create, list, download-with-audit-trail, archive, legal hold, versioning) for general documents; `CaseEvidence` (Stage 9) for case-specific evidence, with a verification step |
| Compliance history | Available via `GET /audit/?entity_type=aml_program\|organisation` |
| Risk history | Available via each customer's `CustomerRiskScoreHistory` (Stage 6) plus `GET /audit/?entity_type=customer` for risk-relevant actions |
| Customer history | Available via `GET /audit/?entity_type=customer&entity_id=...` — now includes KYC review decisions (fixed this stage, see §2) |
| Case history | Available via `GET /audit/?entity_type=case&entity_id=...` (Stage 9) plus the case's own notes/evidence |
| Report history | Available via `GET /audit/?entity_type=ifti_report\|ttr_report\|smr_report&entity_id=...` (Stage 10) plus the Filing Register |
| User activity | Available via `GET /audit/?entity_type=user` or `?actor=<email>` — logins are audited (`app/api/routes/auth.py`); no dedicated login-history view beyond `User.last_login_at`, but the audit trail itself answers "what did this user do" |

---

## 2. What this stage found and fixed: two more unaudited domains

Following the same pattern Stages 9 and 10 established (`cases.py`, then `reports.py`), this stage checked the rest of the API for the same gap. Two more genuinely central AML/CTF domains had zero audit coverage:

- **`app/api/routes/kyc.py`'s `review_kyc()`** — the actual human decision to approve or reject a customer's identity verification, gating them onto `active`/`edd_required`/`rejected`. Exactly the "who did it, why" Stage 11 asks for, and it recorded nothing.
- **`app/api/routes/transactions.py`'s `create_transaction()` and `update_transaction()`** — the core AML transaction record. Recording who entered a transaction, and any subsequent edits, is basic to "what happened" for the platform's central financial data.

**Fix:** added `log_action()` calls to both, following the same convention established in Stages 9–10 (actor, actor role, org, an `after_state` summary). Verified live: rejecting a customer's KYC now produces a `kyc_reviewed` entry against `entity_type=customer`; creating and editing a transaction now produces `transaction_recorded`/`transaction_updated` entries against `entity_type=transaction`.

A broader check (`grep -c "log_action(" app/api/routes/*.py`) found roughly 35 more route files with zero audit coverage. Not fixed in this pass — recorded as `PARKING_LOT.md` P29, with `retention.py` flagged as the standout next candidate, since a data-retention purge is destructive and irreversible in a way most of the others aren't.

---

## 3. What this stage found and fixed: the audit trail page itself was showing fake data

`web/app/audit/page.tsx` is the real, reachable frontend for `GET /audit/` — the one place a compliance officer or an AUSTRAC examiner would actually go to answer "what happened." It had the same demo-data-masking bug found repeatedly across this staged review (the MLRO dashboard, the monitoring/alerts page): a hardcoded 12-entry `DEMO_LOGS` array shown whenever a real fetch returned zero rows, and kept silently on any fetch failure. Of every instance of this bug pattern found this session, this is the most consequential — an audit trail is specifically the artifact meant to be trusted as ground truth, and this one could silently substitute fabricated events for real ones with no visible indication.

Separately, the page's entity-type and role filter dropdowns were built around values that don't exist in the real data: `"report"`, `"ecdd"`, `"kyc"`, and `"transaction"` don't match any `entity_type` string the backend actually writes. The real values are `ifti_report`/`ttr_report`/`smr_report`/`case`/`customer`/`ecdd_record`/`document`/`aml_program`/`organisation`/`user` — split across two underlying tables (`legacy_audit_logs` and `audit_logs`, a pre-existing, documented duplication `GET /audit/` already merges at read time) that use inconsistent casing conventions (snake_case vs PascalCase) for the same concept.

**Fix:** removed `DEMO_LOGS` — a real empty result now shows a real empty state, and a fetch failure now shows an explicit error rather than silently falling back to fabricated data. Rebuilt the entity-type/role filter lists from the actual strings written across the codebase. Normalised casing once, at fetch time, so filtering and colour/icon lookups work regardless of which of the two underlying tables an entry came from.

---

## 4. Regulatory requirement vs. product design vs. internal methodology

**Regulatory requirement (AUSTRAC, AML/CTF Act 2006 & Rules):**
- A reporting entity must be able to demonstrate its compliance decisions and the basis for them, and retain relevant records (generally 7 years).
- Records must be available to AUSTRAC on request.

**Product design (VeriGo's own architecture, not mandated by any specific structure):**
- A single, entity-type/entity-id-filterable audit endpoint as the common substrate every domain-specific "history" view reads from, rather than a bespoke history table per entity type.
- Immutability by convention — audit entries are never updated or deleted, only appended (the frontend states this explicitly: "This record is immutable... tamper-evident by design").
- The Filing Register (Stage 10) as a purpose-built append-only ledger specifically for regulatory submissions, layered on top of the general audit trail rather than replacing it.

**Internal methodology (VeriGo's own choices, reviewable/replaceable by the reporting entity):**
- Which specific actions across ~60+ mutating endpoints are currently audited versus not (P29) — a coverage decision, not a regulatory one; AUSTRAC doesn't prescribe which internal system events must be logged, only that the entity can demonstrate what happened.
- The two-table audit architecture itself (legacy vs newer) is an implementation detail merged transparently at the API layer; not something a reporting entity's obligations turn on.

---

## STAGE STATUS

**Stage:** 11 — Audit & Evidence
**Status:** COMPLETE WITH ISSUES

**What works:** A real, reachable, filterable audit trail (`GET /audit/`, `web/app/audit/page.tsx`) covering case management, regulatory reporting, KYC decisions, and transaction records — each independently verified this session. A general evidence/document repository with archival, legal hold, and versioning. Per-entity history is available for customers, cases, reports, and (via score history) risk, all keyed off the same audit substrate.

**Known issues found and fixed this stage:**
- The audit trail's own frontend page showed fabricated demo data whenever a real query returned zero rows or failed — the most consequential instance of this session's recurring "demo data masks a real empty/failed state" bug, given the page's entire purpose is being a trustworthy record.
- The same page's entity-type/role filters didn't match any real backend value.
- KYC review decisions and transaction record creation/edits were entirely unaudited.

**Known limitations, deliberately not fixed this stage (tracked in `PARKING_LOT.md`):**
- **P29** — Roughly 35 route files still have zero audit coverage. The two highest-value gaps (KYC, transactions) are fixed; the rest is a long mechanical tail, `retention.py` being the standout next priority given its actions are irreversible.
- No dedicated user-activity/login-history view beyond `User.last_login_at` and filtering the general audit trail by actor — adequate but not purpose-built.
- **Status is "COMPLETE WITH ISSUES"** rather than "COMPLETE" specifically because P29 means "what happened" is not yet answerable for every domain in the system — only the ones covered so far (transactions, cases, reports, KYC, plus what documents/alerts/customers/auth already had).

**Security concerns:** None found this stage. Both fixes are net tightenings; no access control changes.

**Technical debt:** The two-audit-table architecture (documented, pre-existing, merged transparently at read time) means every new audited domain has to choose which table's calling convention to follow — this session has consistently used the legacy `log_action()` path, matching the majority of existing call sites, but the underlying duplication itself remains unresolved.

**Recommended next stage:** Stage 12 (AI Compliance Assistant), per the original staged plan — **not started**; stopping here for manual input as instructed.
