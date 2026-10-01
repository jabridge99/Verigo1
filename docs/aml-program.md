# VeriGo — AML/CTF Program Module (Stage 7)

**Purpose:** Stage 7 asks for the organisation-level AML/CTF compliance program: a business selects its industry, establishes its AML/CTF Program, completes a compliance assessment, identifies controls, assigns compliance tasks, records evidence, sets review dates, and tracks outstanding actions — via an Industry + Compliance Pack + Rules + Workflow pattern, not a duplicated application per industry.

**Headline finding:** most of the underlying machinery for this stage already existed — industry-specific templates, a full program document model, a governance-controls register, a task-assignment system — but the very first requirement, "select industry," had no reachable path anywhere for a real user, and neither did registration itself. This stage's main work was less about building new features than reconnecting real, already-built pieces that had never been wired to an actual user-facing entry point.

---

## 1. Select industry

**What was found:** `Organisation.industry_type` (the AUSTRAC-aligned enum that drives which industry template an org's AML Solution is seeded from) was hardcoded to `IndustryType.other` on both real org-creation paths (`POST /auth/register`, `POST /organisations`), with no endpoint anywhere to change it afterwards. Digging into why turned up a fully-built, correctly-designed 7-step onboarding wizard (`web/components/OnboardingWizard.tsx`, linked in the main nav) whose industry list was explicitly written to match the `IndustryType` enum — but whose "choose your industry" step sent the selection to an unrelated field driving a different, weaker system entirely (see §5). And underneath that: there was no reachable frontend page anywhere for a new visitor to actually create an account. `POST /auth/register` had zero UI callers; only a login page existed. The onboarding wizard was unreachable regardless of its own correctness.

**What was done:**
- `POST /organisations/{org_id}/select-industry` sets the real industry and re-seeds the org's AML Solution (Program + Risk Framework) from the matching Compliance Pack — but only while nothing has been customised yet (the program is still an untouched draft v1.0, no risk assessment has been started). Attempting to change industry after that point returns 409, rather than silently wiping real work.
- Wired the onboarding wizard's industry step to call it.
- Wired the existing `start-trial` signup form — fully designed (name, email, company, industry, password fields, the correct industry list, even the "this industry needs a custom package" redirect logic) but with no `onSubmit` handler at all — to actually register an account and land the new user in the onboarding wizard.

Verified live: register → confirm `industry_type` is `"other"` and the seeded program/framework are the generic template → select a real industry (e.g. remittance) → confirm the program and risk framework were re-seeded from the remittance template, not just the field flipped.

## 2. Establish AML/CTF Program

Already substantially built (`app.models.aml_solution.AMLProgram`) and, since the Stage 6 fix, seeded automatically for every new org: overview, scope, EWRA summary, CDD procedures (individuals/companies/trusts), beneficial ownership, PEP, sanctions/TFS, travel rule, SMR/TTR/IFTI procedures, training, record-keeping, independent review, AUSTRAC registration dates — a genuinely section-by-section document, not a flat checklist. Lifecycle: `draft → active → under_review → superseded`, with `POST /aml-program/{id}/submit-for-review` and `POST /aml-program/{id}/activate` (MLRO+). Confirmed live this stage as part of the industry-selection test.

## 3. Complete compliance assessment

This is the Enterprise-Wide Risk Assessment (EWRA), already verified end to end in Stage 6 (`docs/risk-engine.md` §6): framework → create assessment run → score factors (Likelihood × Consequence × Control Effectiveness) → submit → approve, with a governance disclaimer acknowledged at approval. Not re-verified in this stage since Stage 6 already did so live; referenced here because it's the concrete answer to Stage 7's "complete a compliance assessment" requirement.

## 4. Identify controls

`GET/POST /governance/controls` — a full control register with risk-area classification, testing (`ControlTest`), findings by severity, calculated effectiveness scoring, and remediation tracking. Extensively built and fixed in earlier stages this session, re-verified working this stage.

**Caveat worth stating plainly:** the industry template seeds 13 starter controls per org, but into a *different*, legacy model (`app.models.aml_solution.Control`) than the one this real controls UI reads from (`app.models.governance_controls.GovernanceControl`) — a pre-existing duplication (parking lot P7, made concrete for this stage as P11). So "identify controls" works, but a freshly onboarded org starts from zero in the real register, not from the industry-specific starter set the Compliance Pack is meant to provide. Reconciling the two model sets is a real design decision (which one is canonical, what happens to existing rows in either), not attempted in this pass.

## 5. Assign compliance tasks / track outstanding actions

The existing `Task` model (`app/models/task.py`, `POST/GET /tasks`) already supported this without any new model — `case_id`/`customer_id` are optional, so an org-level compliance task (e.g. "complete the Q1 sanctions policy review") can be created, assigned to a user, given a due date, and tracked through open → in_progress → completed with no case or customer attached. Added a dedicated `TaskType.compliance_task` value so these are distinguishable from case-investigation tasks when filtering/reporting, and verified the full lifecycle live.

Control-specific remediation (findings from a failed control test) is tracked separately and more specifically via `ControlRemediationAction` (`/governance/controls/{id}/remediations`), already built and fixed in earlier stages — this is the narrower "outstanding actions arising from a control test" case, `Task` is the general one.

## 6. Record evidence

`ControlEvidenceItem` — "ongoing operational evidence" attached to a control (monthly system reports, dual-sign-off logs, alert summaries — distinct from per-test evidence document IDs on `ControlTest`) was a fully defined model, with its relationship to `GovernanceControl` already wired up, but had **zero routes anywhere**. No real user could ever record evidence against a control. Added `GET/POST /governance/controls/{id}/evidence` this stage; verified live.

## 7. Set review dates

Not a gap — verified live rather than assumed from reading the code. `AMLProgram.review_due_date` is seeded one year out by the industry template factory, and `POST /aml-program/{id}/record-review` lets an MLRO+ record a review and set the next due date (with `status → under_review` if the review found changes required). Confirmed end to end: activate a program, record a review, confirm the new due date and reviewer persisted.

---

## What was checked and found correct

- The industry-template machinery itself (`app/templates/aml/factory.py`, `app/templates/risk/factory.py`, and the per-industry modules under `app/templates/{aml,risk}/industries/`) was already sound — the gap was entirely that nothing drove it with a real industry after signup, not that the templates themselves were wrong.
- `select-industry`'s guard against changing industry after the program is activated or a risk assessment has started, confirmed live (409 on both).
- Every route touched this stage (`select-industry`, control evidence, compliance tasks) checked for RBAC consistency with its neighbours (`org:manage` for org-level settings, `require_compliance_or_above` for creating governance/task records, matching the existing pattern in each file) rather than inventing a new convention.

## What was found but deliberately not fixed this stage

Tracked in full in `PARKING_LOT.md` (P11–P14):
- **P11** — freshly-seeded orgs' starter controls are invisible to the real controls UI (the P7 duplication, made concrete for Stage 7's "identify controls" requirement).
- **P12** — the onboarding wizard's later steps still generate a *second*, independent, weaker "AML program" (a different model entirely) alongside the real one that's now seeded automatically and industry-correct. A user who completes the full wizard ends up with two unrelated programs. Needs a UX decision (retire those steps, or point them at the real program) rather than a guess.
- **P13** — a small, separate bug in the wizard's *last* step (mapping the user's industry choice to their first customer's industry field) uses a slug list that doesn't match any real value, so it silently defaults to "other." Narrow, one-function fix, not part of this stage's scope.
- **P14** — the industry picker offers a non-real "Reporting Group" option that now correctly 422s rather than silently succeeding, but shouldn't be selectable there at all.

---

## STAGE STATUS

**Stage:** 7 — AML/CTF Program Module
**Status:** COMPLETE WITH ISSUES

**What works:** A business can now register through a real, reachable page, select its actual AUSTRAC industry, and get an AML/CTF Program and Risk Framework seeded from the matching Compliance Pack rather than a generic default. The Program has a genuine draft → active → review lifecycle with review dates. The Enterprise-Wide Risk Assessment (compliance assessment) was already verified working in Stage 6. Controls can be identified, tested, and remediated. Evidence can now be recorded against a control. Compliance tasks can be assigned and tracked as outstanding actions, org-wide or per obligation.

**Known issues found and fixed this stage:** no reachable registration page existed anywhere in the frontend (fixed); the onboarding wizard's industry step drove the wrong backend system (fixed); `ControlEvidenceItem` had no routes at all (fixed); a second frontend page (`aml-program`) had a latent bug reading `org.org_id`, which the API never actually returns, always `undefined` (fixed incidentally while correcting the TS type).

**Known issues NOT fixed this stage (see PARKING_LOT.md P11-P14):** the industry template's starter controls are seeded into a model the real controls UI can't see (P11); the onboarding wizard still generates a second, redundant AML program via the older system (P12); a small industry-slug mismatch on the wizard's final step (P13); one non-real option in the industry picker (P14).

**Security concerns:** None found this stage. `select-industry` is permission-gated the same way as other org-settings changes (`org:manage`), and its wipe-and-reseed path is guarded against running once a program has been activated or a risk assessment started.

**Technical debt:** This stage confirmed the codebase now has (at least) two independent "AML Program" systems in active use rather than one orphaned and one live, as it looked from Stage 6 alone — P12 is the direct product-facing consequence and should be resolved before this UX is shown to a real customer.

**Recommended next stage:** Stage 8 (Transaction & Monitoring Engine), per the original staged plan — **not started**; stopping here for manual input as instructed.
