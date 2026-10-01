# VeriGo — Database Domain Model (Stage 3)

**Purpose:** map the AML/CTF core domain model the staged plan asks for (Organisation → Customer → Risk → Transaction → Alert → Case → Report → Audit) against what's actually built, in `Entity → Relationship → Purpose` form. Every relationship below was read directly from the model files, not inferred.

**Headline finding:** the plan asks to "determine the minimum viable domain model" and "not create unnecessary tables." **There is no domain-model gap to fill.** Every entity the plan lists already exists — and in most cases the real implementation is *more* granular than the minimal version the plan describes (e.g. one `KYCRecord` becomes five separate, append-only verification tables — identity document, selfie, address, phone, email — which is a better fit for AML/CTF audit requirements than a single table would be, not over-engineering). This document is therefore a map of what exists, not a build plan.

---

## How to read this

`Entity → Relationship → Purpose`. "Relationship" shows the real foreign key and its delete behaviour (`CASCADE` = deleting the parent deletes this row too; `SET NULL` = the reference is cleared but the row survives). Every entity below carries `org_id` (or reaches it in one hop) — see [Tenant isolation](#tenant-isolation) at the end for what that guarantees.

---

## 1. Organisation & access (the tenant boundary)

| Entity | Relationship | Purpose |
|---|---|---|
| **Organisation** | — (the root) | One reporting entity / customer of VeriGo. Everything else in the system either belongs to one directly or reaches one through a chain of foreign keys. Carries ABN/ACN, industry type, AUSTRAC reference, and settings. |
| **User** | `org_id → organisations.id` (CASCADE) | A person who can log in. Has a role (`admin`/`mlro`/`compliance`/`analyst`/`viewer`) scoped to their organisation. `is_super_admin` (a separate, global flag, not a role) is how VeriGo's own staff get cross-tenant access — this is the flag Stage 1's IFTI fix corrected several endpoints to check instead of the per-org `admin` role. |
| **Role / Permission / OrganisationUser** | `OrganisationUser` links `User` ↔ `Organisation` with a role; `Permission`/`Role` back a finer-grained, DB-configurable permission catalogue used by `organisations.py` | A second, more granular authorization layer alongside the simpler 5-role enum on `User` itself — see `STRUCTURE_REVIEW.md` §C3 for the open question about whether these two authorization paths should eventually converge. |

---

## 2. Customers, businesses, and know-your-customer records

| Entity | Relationship | Purpose |
|---|---|---|
| **Customer** | `org_id → organisations.id` (CASCADE) | The core onboarded party — individual or business (`CustomerType`). Everything about "who is this customer and what's their status" lives here: CDD level, risk level, PEP flag, onboarding status. |
| **BusinessDetail** (the plan's "Business"/KYB) | `customer_id → customers.id` (CASCADE) | A 1:1 extension of `Customer` for business customers — ABN/ACN, business structure, industry. A business is a `Customer` with `CustomerType=business` plus this row, not a separate top-level entity — deliberately, since almost everything else (risk, transactions, cases) attaches to the customer either way. |
| **BeneficialOwner** | `customer_id → customers.id` (CASCADE), `org_id → organisations.id` (CASCADE) | Ultimate beneficial owners of a business customer — name, ownership %, PEP/sanctions flags per owner. Required for KYB under the AML/CTF Rules' beneficial ownership provisions. |
| **CorporateDocument** | `customer_id → customers.id` | Company registration documents, trust deeds, etc. — the document side of KYB. |
| **CustomerIdentityDocument, CustomerSelfieVerification, CustomerAddressVerification, CustomerPhoneVerification, CustomerEmailVerification** (the plan's "KYCRecord", split by check type) | each `customer_id → customers.id` | Five separate, append-only records — one per verification channel — rather than one mutable `KYCRecord`. This is the more granular, correct shape for AML/CTF: each verification event (a specific ID document check, a specific liveness check) is its own timestamped, evidence-carrying record, and a customer can have several over time without overwriting history. |
| **CustomerOnboardingChecklist** | `customer_id → customers.id` | Tracks which onboarding steps are complete — the gate that decides whether a customer can be activated (Stage 0 noted this fails closed: a missing checklist row blocks activation rather than defaulting to "nothing to check"). |
| **CustomerRiskScoreHistory** | `customer_id → customers.id` | Append-only history of the customer's risk score over time — never overwritten, so "what was this customer's risk rating on the date of this transaction" is always answerable. |
| **CustomerReview** | `customer_id → customers.id` | Periodic (ongoing due diligence) reviews — AML/CTF Rules require risk-based periodic review, not just onboarding-time assessment. |

---

## 3. Risk assessment

| Entity | Relationship | Purpose |
|---|---|---|
| **RiskFramework** (the plan's "RiskAssessment" container) | `org_id → organisations.id` (CASCADE) | An organisation's risk assessment methodology — created automatically per organisation on signup, seeded from the industry-specific risk libraries in `app/templates/risk/industries/*.py` (Stage 0 flagged this as a genuinely good existing implementation of the "configurable, industry-reusable risk model" concept — worth building on, not replacing). |
| **RiskCategory** | `framework_id → risk_frameworks.id` (CASCADE) | The weighted categories inside a framework (customer / product / geographic / channel / transaction risk), each with a configurable weight. |
| **RiskFactor** (the plan's "RiskFactor") | `category_id → risk_categories.id` (CASCADE) | The individual, editable risk factors within a category — seeded from `RiskLibraryFactor` (the shared industry template) but copied into org-owned, org-editable rows, so an organisation can adjust its own framework without affecting the shared library or other tenants. |
| **RiskAssessmentRun, RiskFactorScore, RiskScoreHistory** | chain down to `RiskFramework`/`RiskFactor` | A specific scoring run against the framework, and its per-factor scores and history — the actual "how risky is this org's book of business right now" computation, distinct from an individual customer's own risk score (§2). |
| **RiskControl, RiskMitigation** | chain down to `RiskFramework` | Controls and mitigations mapped to risk factors — "what are we doing about this risk." |

*(Separately, individual customer risk scoring happens live, computed by `customer_risk_engine.py` and `risk_matrix_service.py` rather than stored as its own table beyond `CustomerRiskScoreHistory` — see `STRUCTURE_REVIEW.md` §C3 for the open question about those two engines.)*

---

## 4. Transactions & monitoring

| Entity | Relationship | Purpose |
|---|---|---|
| **Transaction** | `org_id → organisations.id` (CASCADE), `customer_id → customers.id` | A recorded transaction — amount, direction, counterparty, cross-border flag. The factual record everything downstream (monitoring, alerts, TTR/IFTI reporting) is computed from. |
| **MonitoringRule** (the plan's "ComplianceRule", for transaction monitoring specifically) | `org_id → organisations.id` (CASCADE) | A configurable rule (condition groups + conditions) an organisation defines to flag suspicious activity — e.g. "amount over $X and counterparty in high-risk country." Built via the rule-builder UI (Stage 0 noted this as a real, implemented feature, not a stub). |
| **TransactionAlert** (the plan's "Alert") | `org_id → organisations.id` (CASCADE) | Generated when a transaction trips a monitoring rule. Feeds into case management — an alert is an investigation trigger, explicitly not, on its own, proof of anything (the codebase's own disclaimer language, carried through to the UI, is consistent about this). |

---

## 5. Case management & investigation

| Entity | Relationship | Purpose |
|---|---|---|
| **Case** (the plan's "ComplianceCase") | `org_id → organisations.id` (CASCADE), `customer_id → customers.id` (nullable) | An investigation opened against a customer, a set of alerts, or both. Carries status, severity, assigned analyst, and outcome. |
| **CaseAlert** | links `Case` ↔ `TransactionAlert` | Many-to-many — one case can bundle several related alerts. |
| **CaseNote** | `case_id → cases.id` | Append-only investigation notes — the "why" trail an auditor would want to see. |
| **CaseEvidence** (the plan's "Evidence") | `case_id → cases.id` | Evidence attached to a case — SHA-256 hashed, versioned, legal-hold-aware (Stage 0 confirmed this is mature: hashing, retention mapping, legal hold, audit-on-download all real). |

---

## 6. Documents

| Entity | Relationship | Purpose |
|---|---|---|
| **Document** | `org_id → organisations.id` (CASCADE) | The general-purpose evidence/document store — versioned (`previous_version_id` self-reference), SHA-256 hashed at upload, mapped to statutory retention categories (e.g. `aml_7year`), legal-hold-gated. Used across customer KYC, case evidence, and program documentation. |

---

## 7. Audit trail

| Entity | Relationship | Purpose |
|---|---|---|
| **AuditLog** (the plan's "AuditEvent") | `org_id → organisations.id` (CASCADE) | The canonical, immutable audit trail — who did what, when, to what record, with before/after state. This is what answers "what happened, when, who did it" for any record in the system. |
| *(LegacyAuditLog exists in parallel — Stage 0 flagged this duplication; both tables are still actively written to by different parts of the app. Not touched in this pass — see `STRUCTURE_REVIEW.md`.)* | | |

---

## 8. Compliance tasks & calendar

| Entity | Relationship | Purpose |
|---|---|---|
| **Task** (the plan's "ComplianceTask") | `org_id → organisations.id` (CASCADE) | A trackable compliance to-do — assigned, prioritised, with due dates and event history. |
| **ComplianceCalendarItem, ComplianceReminder** | reach `org_id` via the organisation relationship | Scheduled/recurring compliance obligations (e.g. "annual AML/CTF program review due") — the calendar side of compliance task management, separate from ad hoc tasks. |

---

## 9. Australian regulatory reporting (beyond the plan's generic list — required for the "Australia-first" brief)

The staged plan's entity list is generic (it doesn't name specific report types); VeriGo's actual domain model adds the Australia-specific reporting entities that make the platform usable for real AUSTRAC obligations:

| Entity | Relationship | Purpose |
|---|---|---|
| **SMRReport, TTRReport, IFTIReport, ECDDRecord** | each `org_id → organisations.id` (CASCADE) | Suspicious Matter Report, Threshold Transaction Report, International Funds Transfer Instruction report, and Enhanced CDD record — the maker-checker-enforced (creator ≠ approver) regulatory report types, plus supporting ECDD assessments. |
| **FilingRegisterEntry** | `org_id → organisations.id` (CASCADE) | The register of what's been filed, when, and by whom — separate from the reports themselves so the filing history survives even if a report is later amended. |

*(A second, older, standalone IFTI Excel-export system — `ifti_records`/`ifti_e_records` — exists in parallel to the maker-checker `IFTIReport` above. Flagged in Stage 0/2 as duplication, not resolved in this pass.)*

---

## Tenant isolation

Every entity above either carries `org_id`/`organisation_id` directly, or reaches one in a single foreign-key hop (e.g. `BeneficialOwner.customer_id → Customer.org_id`). This is the mechanism Stage 0 found "well-designed and consistently applied" across the codebase, and the one place it wasn't — the IFTI standalone module — was fixed in Stage 1.

**What "isolated" means in practice here:** a query for organisation A's data is supposed to always include a filter tracing back to A's `org_id`, enforced server-side (never left to the frontend). This was verified two ways this session: by code review (Stage 0) and by live testing (Stage 1 — registering a fresh account and confirming it only ever saw its own, empty data).

**What this document does not claim:** that every one of the ~160 tables in the full schema has been individually re-verified for correct tenant scoping in this pass. Stage 0 covered the pattern broadly; this document is scoped to the core domain model the staged plan asks about, not a table-by-table isolation audit.

---

## What goes beyond this core model

The real system has substantially more than the above — a governance/GRC module (policies, controls, training, independent review, board reporting), billing/subscriptions, third-party connector credentials, API keys/webhooks, a notification system, and more. None of that is "unnecessary" in the sense the plan warns against — it's real, working functionality Stage 0 catalogued as a genuine product asset. It's simply outside the specific domain model this stage was asked to map. See `CURRENT_STATE.md` for the fuller picture.

---

## STAGE STATUS

**Stage:** 3 — AML/CTF Domain Foundation
**Status:** COMPLETE

**What works:** Every entity in the plan's minimum-viable domain model already exists, correctly related, and tenant-isolated. No missing entities, no unnecessary ones to prune.

**Known issues:** None new. Two duplication items already tracked (two audit-log tables, two IFTI systems) touch entities documented here — see `PARKING_LOT.md`.

**Security concerns:** None new — tenant isolation for this core model was already covered by Stage 0/1's work.

**Technical debt:** Same as previously tracked (`PARKING_LOT.md`, `STRUCTURE_REVIEW.md`). Nothing new surfaced by mapping the domain model itself.

**Recommended next stage:** Stage 4 (Multi-Tenant SaaS Foundation) — largely a verification pass on top of what this stage already confirmed, since the org/user/role/isolation model is already built.
