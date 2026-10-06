# VeriGo — Multi-Tenant SaaS Foundation (Stage 4)

**Purpose:** the staged plan's Stage 4 objective is "turn the application into a proper SaaS architecture" — organisation/workspace, user accounts, roles, permissions, tenant isolation, organisation settings, user invitation — and its own explicit instruction is *"Security must be enforced server-side. Do NOT rely only on frontend controls. Test for cross-tenant access."*

**Headline finding:** the foundation itself already exists and is well-built (confirmed in Stage 3's `docs/database.md`). The actual value of this stage was doing what the plan explicitly asks — *testing*, not assuming — and that testing found and fixed a second confirmed cross-tenant vulnerability, this time in the onboarding pipeline and, more seriously, in legal-hold management.

---

## 1. What already exists (confirmed, not rebuilt)

- **Organisation/workspace**: `Organisation` model, org-scoped everywhere via `org_id`/`organisation_id`.
- **User accounts**: `User` model with email/password, MFA, magic links (Stage 0).
- **Roles**: two systems coexist —
  1. A simple 5-value enum on `User.role` (`admin`/`mlro`/`compliance`/`analyst`/`viewer`), used for most route-level access gates.
  2. A proper, DB-backed RBAC layer (`Role`, `Permission`, `OrganisationUser` membership, `has_org_permission()` in `app/services/org_service.py`) — checked this stage and found to be **correctly built**: it requires an active membership row scoped to the specific `org_id` in question, and only `is_super_admin` (never the per-org `admin` role) bypasses it. This is the "second authorization mechanism" flagged as an open question in Stage 2's `STRUCTURE_REVIEW.md` §C3 — it's sound, not a risk.
- **Permissions**: as above — real, granular, DB-configurable permission codes per role per organisation.
- **Organisation settings**: `Organisation.settings` (JSON) plus a dedicated `org_config.py` route module for approval-question configuration and other org-level settings.
- **Tenant isolation**: the `org_id`/`industry_id` scoping pattern, confirmed broadly correct in Stage 0 and now stress-tested further this stage (see §2).

---

## 2. What this stage actually tested — and found

Stage 1 fixed a confirmed cross-tenant bug in the IFTI module, and flagged (but didn't chase down) a related loose end: `app/services/tenant_scope.py`, a *shared* tenant-scoping helper, had the same root flaw (treating the per-organisation `admin` role as if it were the global `is_super_admin` flag). This stage's job was to find every consumer of that shared helper and check each one.

**Search result:** exactly 4 route files import from `tenant_scope.py`. Two don't actually call it (dead imports — `documents.py` has its own correctly-hardened local check; `audit.py`'s import is unused). The other two both had real, confirmed, exploitable bugs:

### `app/api/routes/onboarding.py`
Any organisation's own `admin` could list and read **every other organisation's onboarding sessions** — full applicant PII (name, email, phone, company) — via `GET /onboarding/sessions` and `GET /onboarding/sessions/{id}`. Notably, this file's own module docstring claimed *"Tenant isolation enforced on list/get/audit/reminder/delete"* as an already-completed fix; the shared helper it relied on to do that enforcement was itself the thing that was broken.

### `app/api/routes/retention.py`
Five endpoints independently checked `current_user.role == UserRole.admin` instead of `is_super_admin` (not routed through the shared helper at all — the same wrong pattern, copy-pasted directly). The most serious of the five:

- **`release_hold`** — `retention_service.release_legal_hold()` only enforces its ownership check when `industry_id` is truthy (`elif industry_id and hold.industry_id != industry_id: raise PermissionError`). Every org admin was passed `industry_id=None`, which **skipped the ownership check entirely** — meaning any organisation's admin could release **any other organisation's legal hold**, with no restriction at all. A legal hold exists specifically to block deletion of evidence under litigation or regulatory hold, so this was a real evidence-preservation risk, not just a confidentiality leak.
- **`set_retention_policy`** — a related integrity bug: an org admin's own policy update was silently stored as the **platform-wide default** retention policy (`industry_id=None`), rather than their own organisation's policy, because it also went through the same flawed scoping helper.
- **`list_legal_holds`**, **`list_retention_policies`**, **`purge_report`** — each leaked cross-tenant visibility the same way.

**Fix:** corrected at the root (`tenant_scope.py`'s `is_unscoped()` now checks only `is_super_admin`) plus the five direct copies in `retention.py`. Verified with 16 new tests across three files — each vulnerability-specific test was confirmed to **fail against the pre-fix code** (reverted temporarily, confirmed the exact failure, restored) before being confirmed to pass with the fix. Full backend suite: 429 tests, all passing.

This is now the **third** confirmed instance of this exact bug class found across this staged process (IFTI in Stage 1, onboarding + retention here) — all traced back to the same root misunderstanding (treating a per-organisation role as a global one) introduced at different points in the codebase's history and fixed piecemeal rather than at a shared source. Worth being aware that this specific mistake has recurred multiple times; any *new* endpoint should be checked against this pattern specifically during review.

---

## 3. What's missing: a real user-invitation flow

The plan's Stage 4 checklist explicitly asks for "user invitation where appropriate." Checked this stage: **there isn't one.**

- Self-service signup (`POST /auth/register`) always creates a **brand-new organisation** — there's no way for it to join an existing one (a deliberate, correct anti-privilege-escalation design, confirmed in Stage 0).
- The only way to add someone to an existing organisation is `POST /organisations/{org_id}/members`, which requires the target person to **already have a VeriGo account** (`get_user_by_email` must find an existing user, or it 404s). There is no "invite someone who doesn't have an account yet by email, they click a link, set a password, and land in your organisation" flow — the conventional SaaS team-invite pattern.

This is a genuine feature gap, not a bug — nothing is insecure about the current behaviour, it's just incomplete relative to what a normal multi-user SaaS product needs (a compliance officer wanting to add a colleague who's never used VeriGo before currently has no self-service way to do that). Building this is real, scoped feature work (invite tokens, an email template, an accept-invite page) — flagged here rather than built unprompted.

---

## STAGE STATUS

**Stage:** 4 — Multi-Tenant SaaS Foundation
**Status:** COMPLETE

**What works:** Organisation/user/role/permission model is sound and confirmed correctly tenant-scoped where checked this stage (`org_service.py`'s permission catalog, `organisations.py`'s membership endpoints). Tenant isolation is enforced server-side, not just in the frontend, consistent with the plan's explicit requirement.

**Known issues found and fixed this stage:** Cross-tenant IDOR in the onboarding pipeline (applicant PII) and in retention/legal-hold management (including a real evidence-preservation risk in legal-hold release) — both traced to the same root cause already partially addressed in Stage 1, now fully closed for all four consumers of the shared helper.

**Security concerns:** None open from this stage's work. The recurring pattern (per-org `admin` role mistaken for a global flag) is worth flagging as a standing review checklist item for any future endpoint, since it's now been found three separate times in three unrelated modules.

**Technical debt:** The missing email-based user-invitation flow (§3) — a feature gap, not a defect. Also unchanged from prior stages: the C2/C4 items in `PARKING_LOT.md`.

**Recommended next stage:** Stage 5 (Customer Onboarding) — the actual guided workflow a compliance officer uses day to day, which Stage 0 already confirmed is substantially built; this stage would focus on verifying and polishing that flow specifically, given how much of the underlying platform work is now validated.
