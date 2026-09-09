# VeriGo — Transaction & Monitoring Engine (Stage 8)

**Purpose:** Stage 8 asks for a transaction monitoring pipeline that runs a no-code, configurable rule engine against every transaction and produces investigable alerts, and a case-management workflow that carries an alert through investigation to a recorded outcome — SMR filed, referred to law enforcement, closed with no action, etc.

**Headline finding:** the pipeline's components — rule engine, behaviour-signal scoring, alert generation, case management, close/outcome recording — were all individually sound. The problem was end-to-end: monitoring was never actually triggered by real transaction creation, no organisation ever got any starter rules to configure, and the case-management frontend closed cases through the wrong endpoint, silently discarding the outcome data it was supposed to record. All three fixed this stage.

---

## 1. The pipeline

```
Transaction → Rules (MonitoringRule) → Alert (TransactionAlert) → Case → Investigation (CaseNote) → Outcome
```

- **Transaction** (`app/models/transaction.py`) — created via `POST /transactions/`.
- **Rules** — two independent, complementary scoring mechanisms, both run by `app/services/monitoring_engine.py`'s `run_monitoring()`:
  - **Configurable rules** (`MonitoringRule` → `RuleConditionGroup` [OR across groups] → `RuleCondition` [AND within a group]) — a no-code rule builder evaluated against a flat context dict (`_build_txn_context()`) built from the transaction, customer, and computed behaviour signals. Fully CRUD-able per org via `app/api/routes/monitoring.py`.
  - **Behaviour-signal scoring** (`evaluate_behaviour_signals()`) — 6 independently-scored dimensions (frequency, velocity, value, geographic, behaviour, crypto), computed regardless of whether any `MonitoringRule` exists. Alerts can fire from score thresholds alone even with zero configured rules.
- **Alert** (`TransactionAlert`) — created when a rule matches or a behaviour-signal score crosses its threshold; deduplicated against any existing open alert for the same transaction (pre-existing, verified still correct this stage).
- **Case** (`app/models/case.py`, `app/api/routes/cases.py`) — opened manually, or from an alert via `POST /alerts/{id}/create-case` (backend-only today — see P26).
- **Investigation** — `CaseNote` (append-only), status transitions (`open → under_investigation → escalated/decision → closed_*`) via `POST /cases/{id}/status`.
- **Outcome** — `POST /cases/{id}/close` (mlro+ only), the sole endpoint that records `outcome`/`outcome_notes`/`closure_reason`/`closed_by`/`closed_at`, and the only way a case can leave an open state.

This is distinct from an unrelated `AutomationRule`/`automation_engine.py` system used for generic workflow automation (document uploads, status changes, etc.) — `web/app/rule-builder/page.tsx` is currently wired to that system, not the `MonitoringRule` engine described above (see §3, P25).

---

## 2. What this stage found: the pipeline didn't actually run

Three real gaps, found by tracing the pipeline live end to end rather than reading the code in isolation.

### 2.1 Transaction creation never triggered monitoring

`POST /transactions/`'s own docstring, and its sibling `/run-monitoring` endpoint's docstring, both claimed scoring happened "automatically... in production." Neither call site actually invoked `run_monitoring()`. Every transaction sat completely unscored — zero alerts, ever — unless something separately called the manual re-evaluation endpoint afterward. The same "seeding/wiring function exists but nothing calls it" shape found repeatedly across this staged review (Stage 6's `AMLSolution`/`RiskFramework` seeding, below).

**Fix:** added the `run_monitoring(txn, customer, db)` call to `create_transaction()`. Corrected both docstrings to state what actually happens now. Verified live: creating a transaction via the real API now produces a `TransactionAlert` with no separate call required (`tests/test_stage8_transaction_creation_triggers_monitoring_smoke.py`).

### 2.2 No organisation ever got any starter monitoring rules

`MonitoringRule` has a complete CRUD API, but nothing ever seeded a starting set for a new org — every real org started with zero rules. Behaviour-signal scoring still worked independently, but the "configurable rules" layer the stage explicitly asks for had nothing in it to configure.

**Fix:** seeded 6 starter rules on org creation (`org_service.py`'s `attach_owner()`), one per indicator type the stage brief names:

| Rule | Trigger | Category | Severity |
|---|---|---|---|
| RULE-TM-001 | Amount ≥ AUD 50,000 | High value | High |
| RULE-TM-002 | Velocity score ≥ 60 | Rapid movement | High |
| RULE-TM-003 | Structuring-suspect flag, or near-threshold + round-number | Structuring | Critical |
| RULE-TM-004 | Frequency score ≥ 60 | Frequency anomaly | Medium |
| RULE-TM-005 | Source or destination country in a high-risk list (KP, IR, MM, RU, BY, SY, CU, SD) | High-risk jurisdiction | High |
| RULE-TM-006 | Customer is PEP, or risk level = high | High-risk customer | High |

All marked `is_system_rule` (editable and can be disabled, not deleted) — same discipline as the org's other seeded starter content (controls, policies, approval questions).

**A second bug surfaced verifying RULE-TM-005 against a real payload:** `Transaction` has two overlapping country-pair column sets — `source_country`/`destination_country` alongside `country_origin`/`country_destination`. Behaviour-signal scoring already checked all four; the rule-condition context only ever exposed the first pair. A transaction entered via the real frontend form (which sends `country_destination` — confirmed in `web/app/monitoring/page.tsx`) was therefore invisible to every "high-risk jurisdiction" rule, seeded or user-created, independent of the seeding fix above. Fixed by falling back to the other pair when the first is unset.

Verified live end to end: register a real org → confirm 6 rules exist and are reachable via `GET /monitoring/rules` → create a customer and a transaction to a FATF-listed jurisdiction using the real frontend field name → confirm an alert exists (`tests/test_stage8_default_monitoring_rules_seeded_smoke.py`).

### 2.3 MLRO dashboard closed cases through the wrong endpoint, and faked success on failure

`web/app/mlro/page.tsx`, the case-management frontend, had three compounding issues:

1. Its "Close Case" button called `POST /cases/{id}/status` (`transition_status`, compliance-role gated) instead of `POST /cases/{id}/close` (`close_case`, MLRO-role gated) — the *only* endpoint that records `outcome`, `outcome_notes`, `closure_reason`, `closed_by`, and `closed_at`. Every case a real MLRO "closed" through the dashboard silently lost all of that data; the case just sat at `closed_no_action` with every close-specific field still null.
2. `updateStatus()` wrapped its fetch in `try { ... } catch {}`, discarding the response, then unconditionally updated local state and showed a success toast — regardless of whether the backend call actually succeeded.
3. The page fell back to a hardcoded 5-case demo array whenever a real fetch returned zero cases, masking a genuinely empty real organisation behind fabricated data indefinitely.

**Fix:** added a real close-case form (closing status, outcome, required closure reason, optional outcome notes) that calls `/close`; `updateStatus()` and the close flow now check `response.ok` and only reflect genuine success, surfacing failures as an error toast instead; removed the demo-data fallback so a real empty result renders as a real empty state. `CreateCaseForm`'s matching fake-success-on-failure fallback (fabricated a synthetic case object) fixed the same way. This backend contract had zero test coverage before this stage — added `tests/test_stage8_case_close_records_outcome_smoke.py`, the first tests `app/api/routes/cases.py` has ever had.

---

## 3. Two rule systems in this codebase — don't confuse them

| | **MonitoringRule** (the real one) | **AutomationRule** |
|---|---|---|
| **Question it answers** | "Does this transaction warrant an alert?" | "Should some workflow action fire when X happens?" |
| **Code** | `app/models/monitoring.py`, `app/services/monitoring_engine.py`, `app/api/routes/monitoring.py` | `app/models/automation.py`, `app/services/automation_engine.py` |
| **Scope** | Transactions only | Broad — document uploads, status changes, and other workflow events |
| **Frontend** | None (`web/app/rule-builder/page.tsx` is wired to the wrong system — see `PARKING_LOT.md` P25) | `web/app/rule-builder/page.tsx` |

A compliance officer opening "Rule Builder" today edits `AutomationRule` rows, not the `MonitoringRule` rows the transaction pipeline actually reads. Flagged, not fixed this stage (`PARKING_LOT.md` P25) — building a correct UI against the real API is scoped work of its own.

---

## 4. Regulatory requirement vs. product design vs. internal methodology

**Regulatory requirement (AUSTRAC, AML/CTF Act 2006 & Rules):**
- A reporting entity must monitor transactions to identify suspicious activity and, where relevant, transactions requiring TTR/IFTI-E reporting.
- Suspicious matters must be assessed and, where the SMR obligation is triggered, reported to AUSTRAC. That determination and any filing decision is the reporting entity's own — never automated by the platform.
- Tipping-off restrictions apply once an SMR is under consideration or lodged.

**Product design (VeriGo's own architecture, not mandated by any specific structure):**
- Splitting rule evaluation into user-configurable `MonitoringRule` conditions plus independent behaviour-signal scoring — a design choice about *how* to combine deterministic and heuristic detection, not a regulator-specified structure.
- The `Case` status lifecycle (`open → under_investigation → escalated/decision → closed_*`) and requiring MLRO-level sign-off specifically at the closing step.
- Alert deduplication against open alerts for the same transaction, to avoid queue-flooding on repeated manual re-runs.

**Internal methodology (VeriGo's own numbers, reviewable/replaceable by the reporting entity):**
- The 6 starter rule thresholds (AUD 50,000, velocity/frequency score ≥ 60, the specific high-risk country list) are illustrative starting points, editable per org — not AUSTRAC-mandated figures.
- The 6-dimension behaviour-signal scoring weights and thresholds are VeriGo's own heuristic, not a regulator-issued formula.

The platform provides case-management tooling only — decisions to lodge an SMR, refer a matter to law enforcement, or take any other action remain entirely with the reporting entity (existing disclaimer, `app/api/routes/cases.py`).

---

## 5. What was checked and found correct

- Alert deduplication: re-running monitoring on a transaction that already has an open alert does not create a duplicate (pre-existing, re-verified live this stage against the new automatic-trigger-on-creation behaviour — `tests/test_monitoring_dedup_smoke.py`).
- `Case` status-transition rules correctly block invalid transitions and reject any transition attempted on an already-closed case (`CASE_TRANSITIONS`, `CLOSED_STATUSES` — `app/api/routes/cases.py`).
- `close_case()` correctly requires MLRO-or-above and rejects a `status` outside the real closed-status set.
- Behaviour-signal scoring's geographic dimension already checked all four of the transaction's country columns — only the rule-condition context needed the fallback fix in §2.2.

---

## STAGE STATUS

**Stage:** 8 — Transaction & Monitoring Engine
**Status:** COMPLETE

**What works:** The full pipeline — transaction creation → configurable-rule and behaviour-signal scoring → alert → case → investigation → MLRO-recorded outcome — now runs end to end through the real API and real frontend, verified live rather than only in isolated unit tests. Every organisation created through a real signup now gets 6 starter monitoring rules covering the indicator types the stage brief names. The MLRO dashboard's case-closing flow now calls the correct endpoint and genuinely records the outcome, instead of silently discarding it.

**Known issues found and fixed this stage:**
- Transaction creation never actually triggered monitoring, despite the code's own docstrings claiming it did — every transaction sat unscored. Fixed by wiring `run_monitoring()` into `create_transaction()`.
- No organisation ever got any starter `MonitoringRule` rows — the configurable-rules layer had nothing to configure. Fixed by seeding 6 rules on org creation.
- The rule-condition context only read one of two overlapping country-column pairs on `Transaction`, making real frontend-submitted transactions invisible to "high-risk jurisdiction" rules. Fixed with a fallback.
- The MLRO dashboard's "Close Case" flow called the wrong endpoint (losing outcome/closure-reason data), silently faked success on failed API calls, and masked a genuinely empty case list behind hardcoded demo data. All three fixed; added the first backend test coverage `app/api/routes/cases.py` has ever had.

**Known limitations, deliberately not fixed this stage (tracked in `PARKING_LOT.md`):**
- **P25** — `web/app/rule-builder/page.tsx` is wired to the unrelated `AutomationRule` system, not the real `MonitoringRule` engine this stage seeded and fixed. No frontend exists today for editing the real monitoring rules.
- **P26** — No "create case from alert" action in the monitoring UI, despite `POST /alerts/{id}/create-case` being fully implemented on the backend.
- **P27** — No production transaction-ingestion path beyond manual entry (no batch import, API ingestion, or core-banking connector) — later-stage scope.

**Security concerns:** None found this stage specific to the monitoring/case pipeline itself. The close-case fix moves outcome recording onto the MLRO-gated endpoint as intended, which is a tightening, not a loosening, of who can record a case outcome.

**Technical debt:** Two rule systems share the vague name "rules" in this codebase (`MonitoringRule` vs `AutomationRule`) with only one having a frontend today — worth being explicit about which one is meant in future stages, since the name alone doesn't disambiguate.

**Recommended next stage:** Stage 9, per the original staged plan — **not started**; stopping here for manual input as instructed.
