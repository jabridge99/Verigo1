# VeriGo — Development Baseline (Stage 1)

**Purpose:** a confirmed-working local development setup, plus a record of what was actually tested to establish this baseline — not just what the docs claim. Every claim in this file was verified by running the real commands during this baseline check, not inferred from reading code.

---

## 1. Prerequisites

| Tool | Version used to verify this baseline | Notes |
|---|---|---|
| Python | 3.11 | Backend. 3.12 also supported per CI matrix (not independently verified here). |
| Node.js | 22 | Frontend. 20 also supported per CI matrix (not independently verified here). |
| PostgreSQL | 16 | Production database. SQLite works for quick local dev (see §5). |
| Docker | Not available in this baseline-check environment | Full `docker-compose` stack was **not** verified this pass — see §7. |

---

## 2. Backend setup (confirmed working)

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt        # confirmed: installs cleanly, no errors
```

Minimum environment variables for local dev (see `.env.example` for the full list):

```env
ENVIRONMENT=development
SECRET_KEY=<any non-default string in dev>
DATABASE_URL=sqlite:///./dev.db        # or a postgresql:// URL — see §5
CORS_ORIGINS=http://localhost:3000     # must exactly match how you load the frontend — see §6 gotcha
```

Run it:

```bash
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

**Confirmed this pass:**
- Clean `pip install` of `requirements.txt`.
- Server boots, logs a clean startup sequence (DB tables verified, permission catalog seeded, master admin seeded, background scheduler started).
- `GET /health` → `{"status":"ok",...}`
- `GET /health/ready` → `{"status":"ready","checks":{"database":"ok","redis":"not_configured"}}`
- Full auth round-trip via the real HTTP API:
  - `POST /api/v1/auth/register` → creates a new organisation + user, returns a JWT, correctly forces `role=analyst` (cannot self-escalate).
  - `POST /api/v1/auth/login` → returns a JWT.
  - `GET /api/v1/auth/me` with `Authorization: Bearer <token>` → returns the authenticated user.
  - `GET /api/v1/customers/` authenticated → `200 []` (correctly empty, correctly org-scoped).
  - Same request unauthenticated → `401`.
- Full backend test suite: **415 passed**, 0 failed (`python -m pytest tests/`).
- `ruff check` / `ruff format --check` clean under the exact ruleset CI uses.

---

## 3. Frontend setup (confirmed working)

```bash
cd web
npm ci                                  # confirmed: installs cleanly
NEXT_PUBLIC_API_URL=http://localhost:8000 npm run build   # confirmed: production build succeeds
npm run start -- -p 3000                # confirmed: serves the production build
```

For local development with hot reload:

```bash
npm run dev
```

**Confirmed this pass:**
- `npm ci` — clean install, 517 packages. **9 known vulnerabilities flagged by `npm audit`, 8 of them high severity — see §8, this needs a decision.**
- `npm run build` — succeeds, 114 routes (static + dynamic), 0 build errors.
- `npm run lint` — **0 errors**, 20 warnings (missing `useEffect` dependencies, a few missing image `alt` text). None block the build.
- Production server (`next start`) serves all tested routes with `200`: `/`, `/login`, `/pricing`, `/dashboard`.
- **Full authenticated flow verified in a real browser** (Playwright + the Chromium build in this environment) against the production build: filled the login form → real `POST /api/v1/auth/login` fired → redirected to `/dashboard` → dashboard rendered fully, with the logged-in user's name, role badge, and module tiles.

---

## 4. Test environment

```bash
pytest tests/                           # 415 tests, no external services required
```

Tests use an in-memory/temporary SQLite database created fresh per test run (`tests/conftest.py`) — **no PostgreSQL, Redis, or Docker needed to run the test suite.** This is also how CI runs the Node/lint jobs; the Python job additionally spins up a real `postgres:16-alpine` service container to test against (see `.github/workflows/ci.yml`).

---

## 5. Database connection — confirmed, with an important caveat

**SQLite (quick local dev):** works out of the box. On startup, non-production environments auto-create all tables (`Base.metadata.create_all()` runs in `app/main.py`'s lifespan). No migration step needed for local SQLite dev.

**PostgreSQL (matches production):** verified against a real, local PostgreSQL 16 instance — not just SQLite. This is where Stage 1 surfaced a real problem, now **fully fixed and verified**:

> `alembic upgrade head` against a **genuinely fresh** PostgreSQL database originally failed outright — `Base.metadata` was missing 12 of the 51 model files' tables (they were never imported by `app/models/__init__.py`, which `alembic/env.py` relies on to discover the full schema). Fixed (`Fix fresh-database migration failure: 12 model modules never imported`). That fix then surfaced a second class of problem: 9 of the remaining migrations each unconditionally added a column/table/type that the now-fixed baseline's `create_all()` (running against *current* models) had already created. Each was made idempotent — checks existence before making the DDL change, so it's a no-op on a database created via the baseline and still performs the real change on a database that predates it (`Make remaining 9 post-baseline migrations idempotent against create_all()`).
>
> **Verified end-to-end:** dropped and recreated a real local PostgreSQL 16 database from empty, ran `alembic upgrade head` — completes cleanly, reaches `head`, creates all 161 tables. Booted the app against that freshly-migrated database and completed a real `register → login` round trip through the live API. Full backend test suite (415 tests) still passes.

**What this means practically today:**
- An **existing** database (e.g. your real Railway production database, which was presumably provisioned before this gap existed) was never affected — `create_all()` only creates tables that don't already exist, so this bug never touched already-provisioned schemas.
- A **brand-new** database — a new environment, a disaster-recovery rebuild, a self-hosted customer's first deploy — previously failed to come up at all. **This is now confirmed fixed**, verified against real PostgreSQL, not inferred from reading the code.

---

## 6. Local-dev gotchas found while establishing this baseline

These aren't application bugs — they're easy to trip over when testing locally, worth documenting so the next person doesn't lose time on them:

1. **CORS origin must match exactly how you load the frontend.** `CORS_ORIGINS` is compared against the browser's `Origin` header verbatim. Loading the frontend at `http://127.0.0.1:3000` while `CORS_ORIGINS=http://localhost:3000` is set will silently fail every authenticated fetch (the two are different origins even though they're the same machine). Always use the same host string (`localhost` or `127.0.0.1`, pick one) in both places.
2. **`next dev` (Turbopack) in this sandboxed environment did not reliably deliver React's client-side event handlers** — clicking the login form's submit button fell through to a native HTML form GET instead of the React `onSubmit` handler, even after waiting for hydration. The dev server's HMR websocket handshake was also failing in this environment (`net::ERR_INVALID_HTTP_RESPONSE`). This reproduced consistently under `next dev` but **did not reproduce at all under the production build** (`next build && next start`), where the same interaction worked correctly first try. The login page's own code (`web/app/login/page.tsx`) is correct — a proper `<form onSubmit={...}>` with `e.preventDefault()`. Treat this as an artifact of this particular sandbox's dev-server networking, not a product defect — but if you hit "my clicks don't do anything" while developing here, test against a production build before assuming the code is broken.
3. The email validator (`pydantic[email]`) rejects reserved/special-use TLDs like `.test` or `.local` for registration and login — use a realistic-looking domain (e.g. `.com`, `.com.au`) when testing locally.

---

## 7. What was **not** verified this pass

Being explicit about the edges of this baseline check, so nobody mistakes silence for confirmation:

- **Docker / `docker-compose` full-stack deployment** — no Docker daemon was available in this environment. The Dockerfiles and `docker-compose.yml` were reviewed (Stage 0) but not built or run.
- **Vercel deployment itself** — this baseline confirmed the exact thing Vercel runs (`npm run build`) succeeds, which is the strongest available proxy without direct Vercel access, but did not trigger or observe an actual Vercel deployment.
- **Redis** — not available in this environment; the app correctly falls back to in-process rate limiting/JWT blacklist with a warning (as documented in Stage 0), but Redis-backed behaviour itself was not exercised.
- **Third-party integrations** (Stripe, Sumsub, sanctions providers, etc.) — none were exercised; they require live credentials.

---

## 8. Frontend dependency vulnerabilities — resolved (mostly)

`npm audit` on a clean `npm ci` install reported **9 vulnerabilities (1 low, 8 high)**, including real, named CVEs in **Next.js itself** at the then-resolved version (`16.2.9`): SSRF via rewrites with an attacker-controlled destination hostname, cache confusion of response bodies, unauthenticated disclosure of internal Server Function endpoints, and a few denial-of-service issues. The rest were in `postcss`, `sharp`, `browserslist`, `js-yaml`, `nanoid`, and `fast-uri` (all transitive).

**Applied `npm audit fix` (no `--force`)** — resolved 8 of 9, moving Next.js to `16.3.4`, still within the declared `^16.2.9` range in `package.json` (no dependency-range change). Re-verified after: production build still succeeds (114 routes), lint unchanged (0 errors, same 20 pre-existing warnings), production server still serves `/`, `/login`, `/pricing` with `200`s.

**One remaining, deliberately left unresolved:** `postcss` (XSS + path-traversal-via-sourcemap CVEs) needs `npm audit fix --force`, which would move it outside its currently declared range. Not applied — that's a distinct decision from the in-range bump above.

---

## 9. Git workflow

Confirmed: keep the current workflow. The repository develops via short-lived feature branches merged directly into `main` (see `git log`), and that's staying as-is — no persistent `development` branch was set up.

---

## 10. Environment variables reference

See `.env.example` for the authoritative, fully-commented list. Categories, and what's required per environment:

| Category | Required in dev? | Required in production? |
|---|---|---|
| `SECRET_KEY` | Any value | **Must** be changed from the default — app refuses to start otherwise |
| `DATABASE_URL` | SQLite is fine | PostgreSQL required — app refuses SQLite in production |
| `CORS_ORIGINS` | Your frontend origin | **Must not** be `*` — app refuses to start otherwise (staging too) |
| `REDIS_URL` | Optional (falls back, with a warning) | Strongly recommended once running >1 worker — see Stage 0 findings |
| Stripe keys | Not needed unless testing billing | Required for billing to function |
| SMTP / email | Not needed — falls back to console logging | Required for real email delivery |
| Storage backend | Defaults to local disk | S3/Azure/GCS/R2/Supabase, per your deployment |
| Sentry DSN | Optional | Recommended |
| `MASTER_ADMIN_EMAIL` / `PASSWORD` | Optional, for a bootstrap admin | Set once, then rotate/remove per your own policy |

---

## Stage Status

**Stage:** 1 — Create a Safe Development Baseline
**Status:** COMPLETE

**What works:** Backend installs, boots, and serves a fully working authenticated API (verified end-to-end, not just via tests). Frontend installs, builds cleanly for production (114 routes), and — verified in a real browser — logs in and renders a fully authenticated dashboard with live data. Full test suite (415 tests) passes. SQLite local dev works with zero setup. `alembic upgrade head` now confirmed working against a genuinely fresh PostgreSQL 16 database, not just an already-provisioned one.

**Issues surfaced and resolved this stage:**
1. A genuinely fresh PostgreSQL database could not run `alembic upgrade head` to completion — root-caused to 12 model modules never being imported, plus 9 migrations that weren't idempotent against the fixed baseline. **Both fully fixed and re-verified against real PostgreSQL 16** (§5).
2. 9 npm dependency vulnerabilities, including real Next.js CVEs — **8 of 9 fixed** via `npm audit fix` within the declared version range; 1 (`postcss`) deliberately left for a separate, explicit decision since fixing it requires leaving the declared range (§8).
3. Git workflow — **confirmed**: keep feature-branches-into-`main` as-is, no change made (§9).

**Security concerns:** None new beyond what Stage 0 already found. The migration gap was a build-integrity issue, not a security exposure, and is now closed.

**Technical debt:** As catalogued in `CURRENT_STATE.md` (Stage 0). One new, minor item added: the migration chain now carries defensive existence-checks in 10 files rather than a single clean baseline — functionally correct and fully verified, but a future re-squash (once the team is ready to retire pre-baseline migration history entirely) would be tidier than carrying these guards indefinitely.

**Recommended next stage:** Stage 2 (Repository Structure & Clean-up).
