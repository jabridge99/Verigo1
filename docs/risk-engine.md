# VeriGo — Risk Assessment Engine (Stage 6)

**Purpose:** Stage 6 asks for a configurable AML/CTF risk engine that considers customer type, geography, product/service, delivery channel, transaction behaviour, PEP status, sanctions, beneficial ownership, and other high-risk indicators, and produces a **Risk score + Risk rating + Reasons** — for example, "HIGH RISK / Reasons: High-risk jurisdiction / Complex ownership / PEP exposure."

**Headline finding:** the engines already existed and, once traced live end to end, both correctly produce score + rating + machine-readable reasons and correctly route customers to CDD or EDD. The real problem was upstream of the engines: no organisation ever created through a real signup or admin flow had a working AML/CTF Solution to run them against at all (see §3) — every engine-facing endpoint 404'd, permanently, for every real user, until this stage's fix.

---

## 1. Two distinct engines — what each is for

This codebase has two separate risk-scoring systems that answer different questions, plus a third that's out of scope for this stage. Distinguishing them matters because they don't share a UI, a data model, or (until this session — see `PARKING_LOT.md` §C3) even the same rating thresholds.

| | **Customer Risk Engine** | **Enterprise-Wide Risk Assessment (EWRA)** |
|---|---|---|
| **Question it answers** | "Is *this customer* CDD or EDD?" | "What is *this organisation's* overall AML/CTF risk profile, across its customer base, products, channels, and jurisdictions?" |
| **Code** | `app/services/customer_risk_engine.py` | `app/api/routes/risk_assessment.py`, `app/models/risk_engine.py` |
| **Runs** | Automatically, once per customer, as the last step of onboarding (`POST /customers/{id}/workflow/assess-risk`) | On demand / annually / trigger-based, by a compliance officer (`POST /risk/assessments`) |
| **Scale** | 5 weighted dimensions, 0–100 each | Likelihood (1–5) × Consequence (1–5) → Control Effectiveness Factor → residual score |
| **Output** | Score + rating + gateway decision (CDD/EDD) + machine-readable trigger list | Score + rating per category, an overall residual rating, executive summary, recommendations |

A third, narrower engine — `app/services/risk_matrix_service.py` — scores individual *transactions* for the approval-question workflow (`compute_risk_matrix()`, used by `customers.py`/`transactions.py`/`dashboard.py`). It's a different question again ("does this specific transaction need extra sign-off?") and belongs to Stage 8 (Transaction & Monitoring Engine), not this stage — mentioned here only so it isn't confused with the two above.

---

## 2. What the "score + rating + reasons" example looks like in practice

Verified live (`tests/test_stage6_risk_assessment_engine_live_trace.py`), walking a real customer through the actual API a compliance officer would use — not just reading the code.

**Low-risk customer** (Australian resident, no PEP flags, branch channel): scores low/medium, routes to CDD, `edd_triggers: []`.

**High-risk customer** (PEP, nationality = North Korea — on the FATF blacklist, channel = online, involves crypto):

```json
{
  "overall_score": 91.5,
  "overall_level": "critical",
  "gateway_decision": "edd",
  "edd_triggers": ["pep_match", "high_risk_country", "crypto_exposure"],
  "customer_risk": {"score": 65.0, "factors": {"pep": 50.0, "fatf_blacklist_nationality": 40.0, ...}},
  "geographic_risk": {"score": 80.0, "factors": {"blacklist_KP": 80.0}},
  ...
}
```

This is VeriGo's version of the stage's own example — "HIGH RISK / Reasons: High-risk jurisdiction / Complex ownership / PEP exposure" — expressed as a structured `edd_triggers` list plus a per-dimension `factors` breakdown, so a reviewer can see exactly *why* the score landed where it did, not just the final number. The same reasons persist to the customer's `CustomerRiskProfile` (`GET /customers/{id}/workflow/risk-profile`), so a reviewer coming back later — not just the analyst who ran the assessment — sees them too.

The EWRA engine's equivalent is `category_scores` (per risk category, e.g. "Customer Risk," "Geographic Risk," "Delivery Channel Risk" — the exact category set is industry-seeded, see §4) plus `key_findings`/`recommendations`, entered by the compliance officer conducting the assessment and stored against the run.

---

## 3. What this stage found: the engines had no organisation to run against

Both engines' code was already sound. What wasn't sound: **`seed_aml_solution()`** and **`seed_risk_framework()`** (`app/templates/aml/factory.py`, `app/templates/risk/factory.py`) — the functions that create an org's `AMLSolution`, its `AMLProgram` document, and its `RiskFramework` (with industry-seeded categories and factors) — had existed since early in this staged process but were **never called from any real code path**, only referenced in their own module docstrings.

Every organisation ever created through real self-serve registration (`POST /auth/register`) or admin-facing org creation (`POST /organisations`) got a bare `Organisation` row and nothing else. `GET /risk/framework`, `GET /aml-program`, `GET /governance/controls` — every endpoint gated on having an `AMLSolution` — 404'd with "Complete onboarding and industry selection first," permanently, with no "complete onboarding" endpoint anywhere that could have triggered the seeding. This explains why earlier stages' regression tests had to manually construct an `AMLSolution` row in their own test setup rather than going through the real flow: the real flow never produced one.

**Fix:** wired both seed functions into `org_service.py`'s `attach_owner()` — the one function already called from both real org-creation paths — via a new `_seed_aml_solution_and_risk_framework()` helper, guarded on `AMLSolution.org_id`'s unique constraint so it's a safe no-op if `attach_owner()` is ever called twice for the same org. Verified live: `POST /auth/register`, then confirmed `GET /risk/framework` and `GET /aml-program/versions` both return real, populated data instead of 404 (`tests/test_org_creation_seeds_aml_solution_smoke.py`).

A second, smaller gap found alongside it: the customer-level engine's API responses (`RiskAssessmentResponse`, `RiskProfileResponse`) carried no governance disclaimer, unlike the EWRA engine which has always returned one on every response. Added a matching `CUSTOMER_RISK_DISCLAIMER` (see §5) so both engines now carry the same disclaimer discipline.

---

## 4. How each engine is configurable

### EWRA — configurable end to end
- **Category and factor weights** live on `RiskFramework.category_weights` (JSON) and `RiskCategory.weight`/`RiskFactor.weight` — editable via the risk-framework API, not fixed in code.
- **Starting point is industry-specific**: `app/templates/risk/industries/*.py` (banking, remittance, VASP, fintech, legal, accounting, real estate, other) each define their own category weights and factor set, applied at seed time based on the org's industry.
- Users can add/remove factors, reweight categories, and override per-factor weights per assessment run (`RiskFactorScore.factor_weight_override`).

### Customer Risk Engine — partially configurable
- The 5-dimension weighting (`DEFAULT_WEIGHTS` — customer 30% / product 25% / geographic 20% / channel 15% / transaction 10%) is a parameter `assess_customer_risk()` accepts and can be overridden — but **neither real call site currently passes an override**, so every org is scored on the same fixed split regardless of industry or risk appetite. The code comment suggesting this is overridable "via `GovernanceCustomScoring`" doesn't reflect what's wired today — that model is read by an unrelated subsystem (governance/control-test severity thresholds), not this engine. Tracked as `PARKING_LOT.md` P10 rather than fixed in this pass, since it needs a decision on where per-org overrides should live and what UI exposes them.
- The individual scoring rules within each dimension (which countries are FATF-blacklisted, which occupations are high-risk, channel risk points, transaction volume bands) are plain Python constants at the top of `customer_risk_engine.py`, explicitly documented in the module as "illustrative starting points — replace with live FATF/DFAT feeds."
- What *is* shared and centrally configurable: both engines rate their score against the same threshold boundaries — `app/services/risk_engine.py`'s `risk_rating()`/`risk_rating_pct()` — a single source of truth established earlier this session (`PARKING_LOT.md` §C3) so the same customer can't be rated differently depending which engine or code path scored them.

---

## 5. Regulatory requirement vs. product design vs. internal methodology

This distinction matters because VeriGo must never be read as making a business automatically AML/CTF-compliant — the software is a tool; the risk-based assessment and the judgment behind it remain the reporting entity's own responsibility.

**Regulatory requirement (AUSTRAC, AML/CTF Act 2006 & Rules):**
- A reporting entity must carry out an AML/CTF risk assessment considering, at minimum, customer types, the types of products/services provided, the delivery channels used, and the foreign jurisdictions it deals with.
- That risk assessment must inform the entity's AML/CTF Program and its customer due diligence measures (standard vs. enhanced).
- PEP status and sanctions exposure must be identified and escalated.
- The entity — not any software it uses — is legally responsible for its risk ratings and the conclusions drawn from them.

**Product design (VeriGo's own architecture, not mandated by any specific numbers):**
- Splitting customer risk into 5 named dimensions (customer / product / geographic / channel / transaction) versus the EWRA's category/factor structure — a design choice about *how* to organise the mandated considerations, not a regulator-specified structure.
- The CDD/EDD decision gateway being driven by an `edd_triggers` list (any one trigger forces EDD) rather than, say, a single composite score cutoff.
- Persisting a versioned `CustomerRiskProfile` per assessment, and an immutable `CustomerRiskScoreHistory` record specifically when EDD triggers fire.

**Internal risk methodology (VeriGo's own numbers, entirely reviewable/replaceable by the reporting entity):**
- The specific 0–100 scale, the 30/25/20/15/10 default dimension weights, the point values assigned to individual risk factors (e.g. "crypto involvement = +40 points," "PEP = +50 points"), and the low/medium/high/critical cut-points (20% / 48% / 76% of scale) are VeriGo's own scoring choices, not numbers AUSTRAC prescribes.
- The seed country risk lists (FATF blacklist/greylist, sanctions, "high-risk" countries) and high-risk occupation list are explicitly documented as illustrative starting points to be replaced with live regulator/DFAT feeds — not a definitive or regulator-issued list.
- The EWRA's Likelihood × Consequence × Control-Effectiveness-Factor formula is a standard ISO 31000-style risk methodology VeriGo adopted as its calculation approach — a recognised industry practice, not an AUSTRAC-mandated formula.

Both engines' API responses now carry an explicit disclaimer reflecting this boundary:

> *"This [risk assessment framework / customer risk assessment] is a configurable tool only. Risk ratings, scoring, assumptions, and conclusions remain the sole responsibility of the reporting entity[' MLRO/compliance officer]. The platform does not determine final risk ratings, provide legal or compliance advice, or accept liability for risk outcomes."*

(EWRA: `DISCLAIMER` in `app/api/routes/risk_assessment.py`, returned on every response and required to be acknowledged at approval. Customer engine: `CUSTOMER_RISK_DISCLAIMER` in `app/schemas/customer_workflow.py`, added this stage.)

---

## 6. What was checked and found correct

- Both engines' scoring math, traced live: EWRA's `inherent = L × C`, `residual = inherent × CEF` (verified `L=4, C=4 → inherent=16`; `CEF(2)=0.40 → residual=6.4`); customer engine's weighted sum across all 5 dimensions.
- PEP + FATF-blacklist-country + crypto-involvement customer correctly triggers all three corresponding `edd_triggers` and routes to `edd_required`.
- A confirmed sanctions match forces the numeric score to 100/"critical" outright, not just the EDD gateway (a real bug found and fixed earlier this session under `PARKING_LOT.md` §C3 — re-verified live this stage, still correct).
- EWRA lifecycle end to end: framework → create run → score a factor → submit → approve, with `disclaimer_acknowledged` required at approval.
- Rating thresholds are consistent between both engines (shared `risk_rating_pct()`), so the same numeric score can't be labelled differently depending which engine produced it.

---

## STAGE STATUS

**Stage:** 6 — Risk Assessment Engine
**Status:** COMPLETE

**What works:** Both risk engines — the per-customer 5-dimension CDD/EDD gateway and the org-level Enterprise-Wide Risk Assessment — verified live, end to end, via the real API. Both produce a score, a rating, and machine-readable reasons, matching the stage's own worked example. Both now carry a governance disclaimer. Every organisation created through a real signup or admin flow now actually gets a working AML Program and Risk Framework to run these engines against, which was not true before this stage.

**Known issues found and fixed this stage:**
- No organisation ever created through a real code path had a working `AMLSolution`/`AMLProgram`/`RiskFramework` — the seeding functions existed but were never wired into org creation. Fixed in `org_service.py`'s `attach_owner()`. (The most severe finding this stage — every engine-facing endpoint was unreachable for every real org until this fix.)
- The customer-level engine's API responses carried no governance disclaimer, unlike the EWRA engine. Fixed by adding a matching `CUSTOMER_RISK_DISCLAIMER`.

**Known limitations, deliberately not fixed this stage (tracked in `PARKING_LOT.md`):**
- **P6** — `Organisation.industry_type` is hardcoded to `"other"` on both real org-creation paths, so every org gets the generic risk/AML template, never an industry-specific one, even though the seeding machinery supports per-industry variation. Needs a product decision on where industry selection belongs in onboarding.
- **P7** — `seed_aml_solution()` populates a "legacy" `Control`/`AMLPolicy` model set that the actively-used `/governance/controls` and `/governance/policies` endpoints don't read from — seeded starter controls/policies are invisible to the UI that manages them day to day. Pre-existing architectural duplication, not introduced this session.
- **P10** — The customer engine's dimension weights accept an override parameter that no real call site ever passes; every org is scored on the same fixed 30/25/20/15/10 split regardless of industry or risk appetite, unlike the EWRA engine which is genuinely configurable per org.

**Security concerns:** None found this stage specific to the risk engines themselves.

**Technical debt:** Three parallel risk-scoring systems now exist in this codebase (customer engine, EWRA, and the transaction-level risk matrix used by the approval workflow) — each answering a genuinely different question, but worth being aware of when reasoning about "the risk engine" in future stages, since the name is ambiguous without qualification.

**Recommended next stage:** Stage 7 (AML/CTF Program Module), per the original staged plan — **not started**; stopping here for manual input as instructed.
