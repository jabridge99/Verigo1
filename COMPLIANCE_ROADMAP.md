# VeriGo — Compliance Roadmap

Stage 18 (Continuous Improvement) deliverable. This tracks regulatory content fidelity and compliance-vendor dependencies — the things that need a compliance/legal judgement call or a real vendor relationship, not just engineering effort. `PRODUCT_ROADMAP.md` covers feature build-out; `TECHNICAL_ROADMAP.md` covers architecture/code health.

**Standing constraint (Final Product Vision, restated 2026-09-16):** VeriGo is a compliance *management* tool. It must never claim, in its own UI, reports, or documentation, that using it automatically makes a business legally compliant. Every item below is about making the organisation's own AML/CTF program more structured and auditable — never about VeriGo substituting for the organisation's obligations, its Compliance Officer's judgement, or professional/legal advice.

---

## Content fidelity — exact match to official forms and sources

| Item | State | What's needed |
|---|---|---|
| **P32 — IFTI-DRA/TTR/SMR export exact match** | Built from AUSTRAC's published schema/reference docs, not verified cell-by-cell against the actual official AUSTRAC template file(s) | You provide the real AUSTRAC template file(s); diff column-by-column/sheet-by-sheet against current output |
| **Industry template content — all 8 sectors** | Done. Remittance, VASP, Legal, Real Estate, Accountants, DPMS, Conveyancers, and the general template are all rewritten from the real VERIGO document library, at matching depth | Ongoing: re-check against source documents if AUSTRAC guidance changes materially (see "Regulatory-change monitoring" below) |
| **Independent Review / CO Quarterly Report template alignment** | Done, including the newly-added "Breaches Identified This Quarter" and "Existing relationships exited following EDD review" sections | Re-verify alignment if either report's real-world template changes |

## Vendor dependencies — screening and identity data sources

| Item | State | What's needed |
|---|---|---|
| **Sanctions screening (DFAT/OFAC/UN)** | Self-hosted, free official sources, live-fetched and cached. `EU_CONSOLIDATED` remains an always-checked empty list — no free source found | A free EU source, if one exists, or accept the gap as documented |
| **PEP screening** | No free data source exists (real PEP databases are commercial). Vendor chosen: Dow Jones Risk & Compliance (over ComplyAdvantage, which has a working adapter and was declined) | You (or your account rep) provide the real Dow Jones API reference — building against a guessed schema risks the same false-integration problem P45 was fixed to catch |
| **KYC/identity verification adapters** | 7 providers have real, working adapters (Sumsub, ComplyAdvantage, Chainalysis, Elliptic, ABR, Twilio SMS, SendGrid/SES) | 41 remaining marketplace-listed providers have no adapter — each needs a real account/API docs pass, or a decision to leave as an honestly-labelled "not yet built" item |

## Standing hold

**The broader KYC/ECDD/vendor-API-key hold (set 2026-09-15) remains in effect**, except for items already explicitly carved out (P51, KYC identity-number field-level encryption — resolved on your direction). No new KYC/ECDD feature work or vendor-API-key integration should start until you've had your offline review session and lifted the hold, item by item, the way P51 was.

## Regulatory-change monitoring

- **`RegulatoryUpdateEvent`** (built) already exists as the mechanism for tracking AUSTRAC/regulatory changes and auto-assigning affected staff training when one is published (`publish_regulatory_update()`). This is the "monitor compliance changes" half of Stage 18's brief — already operational, not something new to build.
- **What's not automated, and shouldn't be**: deciding *whether* a real-world AUSTRAC/AML-CTF Rules change requires a content update to VeriGo's own templates or reports is a compliance judgement call, not something the platform should infer on its own. Treat this roadmap's "Content fidelity" section as the place to log a needed update once you've identified one.

---

*Maintained as part of Stage 18. This is compliance-content and vendor tracking specifically — general product features go in `PRODUCT_ROADMAP.md`, code health in `TECHNICAL_ROADMAP.md`.*
