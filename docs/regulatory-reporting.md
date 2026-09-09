# VeriGo — Australian Regulatory Reporting (Stage 10)

**Purpose:** Stage 10 asks for reporting workflows covering Australia's core AML/CTF regulatory reports — SMR, TTR, IFTI — built on current, authoritative regulatory requirements rather than hard-coded assumptions, with compliance logic, reporting interface, and regulatory submission kept as separate concerns. Every report must record who created it, when, what changed, who approved it, and its submission status.

**Headline finding:** the reporting workflow itself (`app/api/routes/reports.py`) was, unusually for this staged review, already extensive and largely correct by the time this stage started — full IFTI/TTR/SMR maker-checker workflows (draft → review → approve/MLRO sign-off → submit → acknowledge), a filing register, CSV/XML export, and validation endpoints, all already built. Two real gaps against the stage's own explicit requirements were found and fixed: almost none of that workflow was audited, and TTR/SMR reports had no way to ever be rejected despite having a redraft-from-rejected flow. A third, larger finding — three independent backend implementations of IFTI reporting, two of them entirely unreachable — was investigated and documented but not fixed, since resolving it is a genuine architecture decision, not a bug fix.

---

## 1. What the reporting workflow supports today

| Stage 10 requirement | Status |
|---|---|
| SMR (Suspicious Matter Report) | Built — generate from a case, draft → review → MLRO sign-off → submit → acknowledge/**reject** (fixed this stage) → redraft |
| TTR (Threshold Transaction Report) | Built — generate from a transaction (with industry-specific auto-draft for FBS/GS/ISI/MSB), CSV export, AUSTRAC Connect payload preview, draft → review → approve → submit → acknowledge/**reject** (fixed this stage) → redraft |
| IFTI (International Funds Transfer Instruction) | Built for the reachable implementation — see §3 for the architecture finding |
| Filing Register | Built — an append-only record of every submission (report type, reference, submitted-by, AUSTRAC reference, amount) across all three report types |
| **Who created it, when** | Fixed this stage — see §2 |
| **What changed** | Fixed this stage — see §2 |
| **Who approved it** | Fixed this stage — see §2 |
| **Submission status** | Built — `ReportStatus` enum (draft/under_review/approved/submitted/acknowledged/rejected) on every report |
| Maker-checker (reviewer ≠ approver) | Built — `_assert_maker_checker()`, enforced on IFTI/TTR approval and SMR sign-off |

Every report separates its **compliance logic** (validation rules — `_validate_ifti`/`_validate_ttr`/`_validate_smr`, threshold checks against `TTR_CTR_THRESHOLD_AUD`), its **reporting interface** (this API, and the `/reporting` frontend page), and **regulatory submission** (CSV/XML export and payload-preview endpoints — actual lodgement with AUSTRAC is explicitly out of scope: "requires a valid Data Exchange Agreement and AUSTRAC Connect OAuth 2.0 credentials... all decisions to lodge remain with the reporting entity").

---

## 2. What this stage found: only the final "submit" step was audited

Stage 10's objective states explicitly: "every report should maintain who created it, when, what information was used, what changes were made, who approved it, submission status where applicable." `app/api/routes/reports.py` called the audit trail (`audit_service.log_action()`) exactly 5 times — once each for `ifti_submitted`, `ttr_submitted`, `smr_submitted`, plus ECDD create/decision — across roughly 30 mutating endpoints. The entire maker-checker chain before submission (draft, update, review, approve/MLRO sign-off, acknowledge, reject, redraft) left no record of who did it or when. The same shape of gap found and fixed in Stage 9 for case management.

**Fix:** added a `_log()` call (mirroring Stage 9's `cases.py` pattern) to every remaining mutating endpoint across IFTI, TTR, and SMR — 21 additional call sites. Every report's full lifecycle is now queryable via the existing `GET /audit/?entity_type=ifti_report|ttr_report|smr_report&entity_id=...`.

**A second, independent bug surfaced alongside:** `redraft_ttr` and `redraft_smr` both guard on `report.status == ReportStatus.rejected` before allowing a reset to draft. Only IFTI had a working `POST /ifti/{id}/reject` endpoint — nothing in the API could ever set a TTR or SMR report's status to `rejected`. Both redraft endpoints were consequently unreachable dead code since the day they were written: an MLRO who determined a draft TTR or SMR was wrong had no way to formally reject it and start over. Fixed by adding `POST /reports/ttr/{id}/reject` and `POST /reports/smr/{id}/reject`, mirroring the existing `reject_ifti` exactly.

Verified live: full TTR and SMR draft → reject → redraft round trips, and confirmed every action in the chain appears in the audit trail with the correct actor (`tests/test_stage10_report_audit_trail_and_reject_smoke.py`).

---

## 3. A larger finding, investigated but not fixed: three IFTI systems, one reachable

Checking IFTI specifically surfaced the same "two/three parallel systems, only one has a front door" pattern found repeatedly across this whole staged review (governance controls, AML Program generation, the monitoring rule engine) — a fourth instance, and the most consequential given it concerns the actual data submitted to AUSTRAC, not just workflow UI.

Three independent backend implementations exist:

| | `app/api/routes/reports.py`'s IFTI section | `app/api/routes/ifti_e.py` | `app/api/routes/ifti.py` |
|---|---|---|---|
| Model | `app.models.report.IFTIReport` | `app.models.ifti_e.IFTIERecord` | `app.models.ifti.IFTIRecord` |
| Reachable from any frontend? | **Yes** — `web/app/reporting/page.tsx` | No | No |
| Maker-checker workflow | Full (review → approve → submit → acknowledge/reject → redraft) | None (draft → ready → submitted only) | None |
| Schema fidelity | Detailed ordering/beneficiary-customer fields, but not modelled against a specific AUSTRAC XSD | Explicitly modelled on AUSTRAC's real `IFTI-E-1-3.xsd` — correspondent bank chains, SWIFT-vs-structured mode, real XML payload generation | Simple CRUD, no schema-specific claim |

The practical consequence: a real reporting entity filing an IFTI today gets the workflow-complete system, whose data model doesn't capture correspondent/intermediary bank chains or the SWIFT-vs-structured submission distinction the real AUSTRAC schema requires — while the schema-faithful implementation, fully built and presumably tested at the code level, is invisible to every real user.

**Not fixed this stage** — recorded as `PARKING_LOT.md` P28. Neither system alone satisfies Stage 10 in full (one lacks governance workflow, the other lacks schema fidelity), so this isn't a "delete the wrong one" fix; reconciling them carries real data-migration risk for any org with existing draft or submitted reports, and deciding which property to prioritise is a compliance/product call.

---

## 4. Regulatory requirement vs. product design vs. internal methodology

**Regulatory requirement (AUSTRAC, AML/CTF Act 2006 & Rules):**
- IFTI reports are due within 10 business days of sending or receiving the instruction, for every cross-border funds transfer instruction regardless of amount.
- TTR reports are due within 15 business days for physical currency transactions ≥ AUD $10,000 (`TTR_CTR_THRESHOLD_AUD`).
- SMRs must be lodged as soon as practicable after forming a suspicion (statutory deadline shortens to 24 hours specifically for terrorism-related suspicion — `SMROffenceType.TERRORISM` drives `is_terrorism_related`).
- Tipping-off restrictions apply to SMRs under consideration or lodged.
- The decision to lodge any of these reports, and the lodgement itself, remain the reporting entity's own — the platform prepares and tracks, it does not submit on the entity's behalf.

**Product design (VeriGo's own architecture, not mandated by any specific structure):**
- The specific `ReportStatus` lifecycle (draft → under_review → approved → submitted → acknowledged, with rejected/redraft as a side branch) and which roles gate each transition.
- Generating draft reports pre-populated from an existing `Transaction` or `Case` record, rather than requiring the report to be built from scratch.
- The Filing Register as a separate, append-only cross-report-type ledger.

**Internal methodology (VeriGo's own choices, reviewable/replaceable by the reporting entity):**
- The specific set of ~26 audited report actions and what each entry's `after_state` captures.
- Which fields are protected from direct edit via PATCH (`prepared_by`, `approved_by`, timestamps, etc.) versus editable.

---

## STAGE STATUS

**Stage:** 10 — Australian Regulatory Reporting
**Status:** COMPLETE

**What works:** SMR, TTR, and IFTI reporting workflows, verified against the real API — generation from source records, the full maker-checker chain, submission tracking, and the Filing Register. Every report's full lifecycle (create through close) is now written to, and queryable from, the same audit trail every other AML/CTF record in this platform uses. TTR and SMR reports can now be formally rejected and redrafted, closing a dead-code gap that existed since these endpoints were first written.

**Known issues found and fixed this stage:**
- Only the final "submit" step was audited for all three report types (5 of ~30 mutating endpoints) — the stage's own explicitly-named requirement, unmet. Fixed by wiring every mutating endpoint into the audit trail.
- `redraft_ttr`/`redraft_smr` were permanently unreachable — no endpoint could ever set the `rejected` status they require. Fixed by adding the missing `/reject` endpoints.

**Known limitations, deliberately not fixed this stage (tracked in `PARKING_LOT.md`):**
- **P28** — Three independent IFTI reporting backends exist; only one is reachable from any frontend, and it is less faithful to AUSTRAC's real IFTI-E v1.3 XML schema than an unused sibling implementation. A real design decision on which to keep, merge, or migrate is needed before this materially affects a real reporting entity's actual AUSTRAC lodgement.

**Security concerns:** None found this stage. Both fixes are net tightenings — more of what happens is now recorded, and a previously-impossible action (rejecting a TTR/SMR) becomes possible only for MLRO-or-above, matching IFTI's existing precedent.

**Technical debt:** P28 (above) is now the most consequential instance of this codebase's recurring "duplicate system, one has no UI" pattern, given it concerns actual regulatory submission data rather than internal workflow.

**Recommended next stage:** Stage 11 (Audit & Evidence), per the original staged plan — **not started**; stopping here for manual input as instructed.
