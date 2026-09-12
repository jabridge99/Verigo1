# VeriGo — Case Management (Stage 9)

**Purpose:** Stage 9 asks for a compliance investigation workspace: open a case, review the customer, transactions, risk score, and alerts behind it, add notes and evidence, assign, escalate, record a decision, and close it — with a complete audit trail throughout.

**Headline finding:** the investigation workflow itself (`app/api/routes/cases.py`) was already substantially built and correct by the time this stage started — most of it was put in place and fixed incrementally during Stage 8's work on the transaction-monitoring pipeline. What Stage 9 found missing were two things the stage brief names explicitly: the audit trail (zero coverage, for any of the 12 case-mutating endpoints) and a way to actually see which alerts drove a case (write-only since the feature was first built). Both fixed this stage.

---

## 1. What the investigation workspace supports today

| Stage 9 requirement | Endpoint(s) | Status |
|---|---|---|
| Open case | `POST /cases` | Built (Stage 8) |
| Review customer | `Case.customer_id` + link to `/customers/{id}` | Built (Stage 5/6) |
| Review transactions | `Case.customer_id` + linked alerts' `transaction_id` | Built |
| Review risk score | Customer profile page (`/customers/{id}`) | Built (Stage 6) |
| Review alerts | `GET /cases/{id}/alerts` | **Fixed this stage** — see §3 |
| Add notes | `POST/GET /cases/{id}/notes` | Built (Stage 8), confidential/legal-privilege notes MLRO-restricted |
| Add evidence | `POST/GET /cases/{id}/evidence`, `PATCH .../verify` | Built (Stage 8) |
| Assign case | `POST /cases/{id}/assign` | Built (Stage 8) |
| Escalate | `POST /cases/{id}/escalate` | Built (Stage 8) |
| Record decision | `POST /cases/{id}/close` (outcome + closure reason) | Built and fixed this session — see `PARKING_LOT.md`'s MLRO close-case entry |
| Close case | Same as above; 5 real closed statuses (`closed_no_action`, `closed_smr_filed`, `closed_referred`, `closed_exited`, `closed_no_smr`) | Built |
| **Complete audit trail** | `GET /audit/?entity_type=case&entity_id=...` | **Fixed this stage** — see §2 |

A case additionally supports the SMR-specific workflow AUSTRAC reporting requires: `POST /cases/{id}/smr/consider` (MLRO records the consideration decision) and `POST /cases/{id}/smr/lodge` (records that an SMR was lodged directly via AUSTRAC Online — the platform never lodges on the entity's behalf).

---

## 2. What this stage found: zero audit trail coverage

Stage 9's own objective states "maintain a complete audit trail" as an explicit requirement — not implied, named. `app/api/routes/cases.py` had never once called `app.services.audit_service.log_action()`, the same audit-logging function every other mutable AML/CTF record in this codebase already uses (`customers.py`, `alerts.py`, `auth.py`, `documents.py`, `organisations.py`, `reports.py`). A compliance officer could open a case, investigate it, escalate it to the MLRO, and close it with a recorded outcome — with no queryable record anywhere of who did which of those things, or when. This directly contradicts the stage's own worked example: "What happened? When? Who did it? Why?"

**Fix:** added a `log_action()` call to all 12 case-mutating endpoints — create, update, assign, escalate, status transition, close, add note, add evidence, verify evidence, link alert, SMR consider, SMR lodge — each recording the actor, their role, and a relevant before/after summary. Deliberately excluded from the audit entry: note *content* itself. Confidential and legally-privileged notes are already access-restricted at the note level (MLRO-only); writing their content into the audit trail (readable by a broader set of roles) would have created a side channel around that restriction. The audit entry records that a note was added and its type, never its text.

Verified this actually surfaces somewhere real, not just written to a table nothing reads: this codebase has two audit-log tables (a documented, known duplication — `legacy_audit_logs`, used by `audit_service.log_action()`, and `audit_logs`, used by governance/risk/customer-workflow code), and `GET /audit/` already merges both into one response. So calling the same function every other route already calls means case events appear in the same, real, already-built audit UI — no new duplication introduced.

## 3. A second gap found alongside: linked alerts were write-only

`CaseAlert` (the many-to-many link between a case and the alert(s) that drove it) has existed since case management was first built — written at case creation (`alert_ids` in the create payload), via `POST /cases/{id}/link-alert`, and via `POST /alerts/{id}/create-case` (the alert→case bridge fixed earlier this stage, see `PARKING_LOT.md`). Nothing ever read it back. A case created directly from a real alert had no way, from the case itself, to show an investigator which alert triggered it — undermining "review alerts" specifically for the cases that most need it: the ones that came from a real, automated detection.

**Fix:** added `GET /cases/{id}/alerts`, returning the linked alerts via the `Case.alert_links` → `.alert` relationship (which already existed at the model level, just was never queried). Wired the MLRO dashboard's case detail panel to call it and show the real linked alerts (reference, category, severity) instead of a field (`Case.alert_ids` on the frontend) the real API has never populated.

---

## 4. Regulatory requirement vs. product design vs. internal methodology

**Regulatory requirement (AUSTRAC, AML/CTF Act 2006 & Rules):**
- A reporting entity must investigate potentially suspicious matters and be able to demonstrate the basis for its decisions.
- Records supporting a suspicion assessment (or a decision not to report) must be retained and available to AUSTRAC.
- Tipping-off restrictions apply once an SMR is under consideration or lodged — the platform never discloses this to the customer.
- The decision to lodge an SMR, and the lodgement itself, remain the reporting entity's own — the platform records that consideration/lodgement occurred, it does not make or submit the report.

**Product design (VeriGo's own architecture, not mandated by any specific structure):**
- The specific case status lifecycle (`open → under_investigation/additional_information → escalated/decision → closed_*`) and which roles gate each transition (compliance+ for most, MLRO+ specifically for closing) — a design choice about investigation governance, not a regulator-specified workflow.
- Confidential/legal-privilege notes being MLRO-restricted, and excluded from the audit trail's content (only their existence and type are recorded).
- Linking alerts to cases via an explicit many-to-many table rather than a single alert-per-case model, so one case can consolidate multiple related alerts.

**Internal methodology (VeriGo's own choices, reviewable/replaceable by the reporting entity):**
- The specific set of 12 audited actions and what each entry's `after_state` captures.
- The severity/case-type defaults applied when a case is opened from an alert (`create_case_from_alert()`'s severity mapping and SMR-candidate flag).

---

## STAGE STATUS

**Stage:** 9 — Case Management
**Status:** COMPLETE

**What works:** The full investigation workspace — open, review (customer, transactions via linked alerts, risk score via the customer profile, and now alerts directly), note, evidence, assign, escalate, SMR consider/lodge, and close with a recorded outcome — verified against the real API. Every case-mutating action is now written to, and queryable from, the same audit trail every other AML/CTF record in this platform uses.

**Known issues found and fixed this stage:**
- Zero audit trail coverage across all 12 case-mutating endpoints — the stage's own explicitly-named requirement, unmet. Fixed by wiring every one into the existing `audit_service.log_action()` pattern.
- `CaseAlert` links (which alert(s) drove a case) were write-only since the feature was first built — no way to read them back. Fixed with `GET /cases/{id}/alerts`, wired into the MLRO dashboard's case detail view.

**Known limitations, deliberately not fixed this stage:**
- "Review risk score" and "review transactions" are satisfied via links out to the customer profile and monitoring pages respectively, not a bundled in-case view — reasonable given both already exist and work, but a richer single-pane investigation view (case + customer summary + risk score + transaction list + alerts, all in one place) remains a real, larger UX project if wanted later.
- The case-list (queue) view's alert-count badge still reads the same never-populated frontend field the detail panel used to — left as-is rather than adding a per-row API call for every case in the list; it fails safe (shows nothing) rather than showing wrong data.

**Security concerns:** None found this stage. The audit-trail fix is a net tightening (more of what happens is now recorded, nothing became less restricted); confidential/legal-privilege note content was deliberately kept out of the audit trail to avoid creating a new access-control side channel.

**Technical debt:** This stage's audit-trail fix used the `legacy_audit_logs` table (via `audit_service.log_action()`) to match the majority of existing call sites, consistent with `GET /audit/`'s existing merge of both tables — not a new instance of the two-audit-table duplication, just following the established (if imperfect) convention.

**Recommended next stage:** Stage 10 (Australian Regulatory Reporting), per the original staged plan — **not started**; stopping here for manual input as instructed.
