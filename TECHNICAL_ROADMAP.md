# VeriGo — Technical Roadmap

Stage 18 (Continuous Improvement) deliverable. This is the maintained index of architecture/code-health work — the "why it matters and what order" view. `PARKING_LOT.md` and `STRUCTURE_REVIEW.md` are the detailed, dated records of what was actually found and done; this file exists so there's one short place to check "what's the state of the mechanical backlog" without reading either in full.

Per the master plan's own instruction: *"Do not continuously add features without understanding their impact on architecture."* This file is where that impact gets tracked.

---

## Mechanical backlog

| Item | State | Next step |
|---|---|---|
| **C2 — structural refactor** (6 sub-items) | 1 of 6 done (`api_keys.py`/webhooks split, 2026-09-16). Remaining: no central frontend API client (~35+ pages); thin `web/components/ui/` (only `button.tsx`/`card.tsx`); inline Pydantic schemas in 13 of 56 route files; `web/app/ecdd/page.tsx` (776 lines, needs splitting); 5 oversized backend route files (1100-2400 lines each); `/org` vs `/organisations` prefix naming | Pick up one sub-item at a time — `/org`/`/organisations` rename is the next-smallest, fully self-contained candidate |
| **P5 — `Mapped[]` type retrofit** | `Column()` side done (3,238 of 3,238 sites, all 51 model files, 2026-09-16). `relationship()`'s 184 declarations remain | Needs per-relationship pairing against the actual model graph (list-vs-scalar, `back_populates`) — not safe to do with a blind codemod the way `Column()` was |
| **`mypy.ini`'s `[misc]` suppression for `app.models.*`** | Still in place | A separate, larger decision from P5 itself — re-enabling it will surface a new batch of type errors needing the same real-bug-vs-annotation-gap triage as the original CI-gate fix. Don't bundle into a routine P5 follow-up |
| **P32 — IFTI-DRA/TTR/SMR export fidelity** | Built from AUSTRAC's published schema, not verified cell-by-cell against the actual official template file | Needs the real AUSTRAC template file(s) from you, then a column-by-column/sheet-by-sheet diff |

## Observability

Raised at Stage 18 kickoff (2026-09-16); not yet built, pending your direction:

- **Error tracking**: done — Sentry integration exists (`app/logging_config.py`), optional via `SENTRY_DSN`.
- **Security monitoring**: done — `/api/v1/security/summary` (brute force, MFA, role changes).
- **Compliance-change monitoring**: done — `RegulatoryUpdateEvent` model + `publish_regulatory_update()` broadcasts training to affected orgs.
- **Performance**: partial — Sentry's `traces_sample_rate` gives basic APM only, no dedicated dashboard.
- **User behaviour / feature usage / customer feedback**: nothing built. Two options on the table: a self-hosted `FeatureUsageEvent` table reusing the existing audit-log pattern (no new vendor, no new data flow), or a third-party product-analytics vendor (richer, but a new vendor + API key + AML-customer-data-flow decision that needs your explicit call, same category as the standing KYC-vendor hold).

## Testing

- **P53's first frontend suite** (Vitest+RTL, Playwright) covers real business logic (pricing display, analytics-consent behaviour) and the P50/P50b CSP/HSTS regression check — not exhaustive coverage of all ~62 frontend routes. Broader route coverage remains open-ended future work, not tracked as a numbered item.
- **P54's coverage push** covered its 4 named highest-risk modules (`automation_engine.py`, `dashboard.py`, `governance/training.py`, `risk_triggered_training_service.py`). The rest of the 15-30% coverage band was explicitly out of scope ("not a blanket coverage-chasing pass") — revisit only if a specific low-coverage module becomes a real risk (new bugs found there, or it gets a lot busier).

## Data ingestion

- **P27 — production transaction ingestion.** No batch/API/core-banking connector exists beyond manual entry. Sized for a later stage, once real transaction volume exists to receive.

---

*Maintained as part of Stage 18. Update this file's table whenever a mechanical-backlog item moves, rather than letting it drift out of sync with `PARKING_LOT.md`.*
