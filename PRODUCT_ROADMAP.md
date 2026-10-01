# VeriGo — Product Roadmap

Stage 18 (Continuous Improvement) deliverable. This is the "what to build next, and why" view — ordered by the real customer journey VeriGo supports, not by engineering convenience. `TECHNICAL_ROADMAP.md` covers code health/architecture; `COMPLIANCE_ROADMAP.md` covers regulatory content fidelity and compliance-vendor dependencies. `PARKING_LOT.md` is the detailed, dated change log every item below links back to.

**Standing constraint (Final Product Vision, restated 2026-09-16):** VeriGo must never claim that using it automatically makes a business legally compliant. Every feature below supports the organisation's own obligations, policies, controls, and professional judgement — it does not replace them.

**The core journey this roadmap is organised around:**
Set up business → Select industry → Build AML/CTF program → Onboard customer → KYC/KYB → Risk assessment → Monitor transactions → Investigate alerts → Manage cases → Prepare regulatory reports → Maintain evidence → Stay continuously compliant.

---

## Now — shipped and stable

Every stage of that journey has a real, working implementation as of Stage 17:

- **Set up business → Select industry → Build AML/CTF program**: onboarding wizard, 8 fully-written industry templates (Remittance, VASP, Legal, Real Estate, Accountants, DPMS, Conveyancers, plus the general template), per-org configurable risk weights and monitoring rules.
- **Onboard customer → KYC/KYB**: customer creation, document verification, identity composite scoring, sanctions/PEP screening (self-hosted DFAT/OFAC/UN lists; PEP screening honestly reports "no free data source" rather than faking a result — see `COMPLIANCE_ROADMAP.md`).
- **Risk assessment**: two risk engines (customer-level, ISO 31000-style matrix), sanctions match forces critical risk, professional (SOF/SOW) assessment.
- **Monitor transactions → Investigate alerts → Manage cases**: transaction monitoring pipeline with configurable rules, alert→case bridge, case management with full audit trail.
- **Prepare regulatory reports**: IFTI, IFTI-E, TTR, SMR decision log, Independent Review, CO Quarterly Compliance Report, board reporting (including the new "Breaches Identified This Quarter" section).
- **Maintain evidence → Stay continuously compliant**: audit trail across all AML/CTF-relevant routes, retention/purge reporting, compliance calendar, regulatory-update-driven training assignment.
- **Commercial layer**: plan catalogue, usage-limit enforcement, Stripe billing, add-ons (Independent Review, Quarterly Report) priced and gated for real.

## Next — unblocked, ready to schedule

- **P15 — Liddar as a real-world validation checkpoint.** VeriGo's first onboarded client; once live, use their actual usage as a check against a real reviewer's findings across the whole platform. Scheduled for whenever Liddar goes live, not before.
- **Observability build-out** (raised during Stage 18 kickoff, 2026-09-16, not yet started): self-hosted feature-usage tracking, reusing the existing audit-log pattern rather than a new vendor — you chose to start with the roadmap docs first; this is next in that conversation whenever you want it picked up.

## Later — needs a decision or external dependency before work can start

- **Stage 12 — AI Compliance Assistant** (Risk Explanation, Gap Analysis, Compliance Assistant next-steps). Parked in full per your direction, 2026-09-10 — needs an AI provider chosen and an API key added to the environment before any of the three features can be scoped, let alone built.
- **P27 — Production transaction ingestion beyond manual entry.** No batch/API/core-banking connector exists yet. A later-stage-sized project, realistically sized once the platform has real transaction volume to receive (i.e. once Liddar or another real customer is live).
- **P43 — PEP screening vendor.** Dow Jones Risk & Compliance chosen over ComplyAdvantage, but blocked on you (or your account rep) providing the actual API reference doc — nothing can be built against a guessed schema without risking the exact false-integration problem P45 was fixed to catch.
- **P45 remainder — the other 41 marketplace integrations with no adapter.** Each needs either a real vendor account + API docs, a real OAuth2 app (client_id/secret), or a decision to leave it as an honestly-labelled "not yet built" roadmap item rather than quietly building nothing.
- **Third-party product-analytics vendor** (PostHog/Mixpanel/etc.), if you decide the self-hosted feature-usage approach above isn't enough — a new vendor + AML-customer-data-flow decision, not something to default into.

## Explicitly out of scope until you say otherwise

The broader KYC/ECDD/vendor-API-key hold from 2026-09-15 remains in effect for everything except the items already explicitly carved out (P51). No new KYC/ECDD or vendor-API-key work should start without further direction — see `COMPLIANCE_ROADMAP.md`.

---

*Maintained as part of Stage 18. Review alongside `PARKING_LOT.md` whenever a new item is resolved or a new gap is found — this file should stay a short, current "what's next" view, not a duplicate of the full history.*
