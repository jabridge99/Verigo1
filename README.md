# Verigo

**Australian-first AML/CTF Compliance Operating System for AUSTRAC-regulated businesses.**

Verigo automates the full compliance lifecycle — KYC/KYB onboarding, AML transaction monitoring, AUSTRAC regulatory reporting (IFTI-DRA, SMR, TTR, ECDD), sanction screening, and audit case management — in a single multi-tenant SaaS platform.

---

## Features

- **AUSTRAC IFTI-DRA reporting** — IN (115-column) and OUT (112-column) Excel export, 10-business-day lodgement workflow
- **AML/CTF reports** — SMR, TTR, ECDD with maker-checker enforcement (reviewer ≠ approver)
- **KYC/KYB onboarding** — document upload, risk scoring, customer lifecycle management
- **Transaction monitoring** — real-time AML alerts, escalation, case management
- **Sanction screening** — OFAC/UN list matching
- **Data retention** — AUSTRAC 7yr/10yr policies with legal hold
- **Zero-trust security** — RBAC (5 roles), JWT + TOTP MFA, tenant isolation, rate limiting, full audit log
- **Connector marketplace** — 15 provider integrations with Fernet-encrypted credential storage
- **Stripe billing** — Starter / Pro / Enterprise, monthly and annual plans
- **Cloud storage** — pluggable S3, Azure Blob, GCS, or local backends

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | FastAPI 0.111, Python 3.11, SQLAlchemy 2.0, Alembic |
| Database | PostgreSQL 16 |
| Frontend | Next.js 14 (App Router), React 18, TypeScript, Tailwind CSS |
| Auth | JWT (python-jose), TOTP MFA, magic links |
| Infra | Docker, Docker Compose, Nginx, Let's Encrypt (Certbot) |
| CI | GitHub Actions — lint, type-check, pytest, Next.js build, Docker smoke |
| Payments | Stripe |

---

## Quick Start

### Prerequisites

- Docker & Docker Compose
- A domain pointed at your server (for TLS)

### 1. Clone and configure

```bash
git clone https://github.com/jabridge99/Verigo1.git verigo
cd verigo
cp .env.example .env
```

Edit `.env` — the minimum required variables:

```env
APP_DOMAIN=app.yourdomain.com
API_DOMAIN=api.yourdomain.com
POSTGRES_PASSWORD=<strong-password>
SECRET_KEY=<64-char-random>          # make secret
CERTBOT_EMAIL=ops@yourdomain.com     # omit for self-signed TLS
```

Generate a secret key:

```bash
make secret
```

### 2. Build and start

```bash
make build
make up
```

On first boot, Nginx automatically provisions a Let's Encrypt certificate if `CERTBOT_EMAIL` is set, or falls back to a self-signed certificate for development.

### 3. Run database migrations

```bash
make migrate
```

The application is now running:

| Service | URL |
|---------|-----|
| Frontend | `https://app.yourdomain.com` |
| API | `https://api.yourdomain.com` |
| API docs | `https://api.yourdomain.com/docs` |
| Health | `https://api.yourdomain.com/health` |

---

## Development

```bash
# Backend
make dev-api        # uvicorn with --reload on :8000

# Frontend
make dev-web        # next dev on :3000

# Run tests
make test

# Lint
make lint
```

### Environment

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

cd web && npm install
```

---

## Project Structure

```
verigo/
├── app/                    # FastAPI backend
│   ├── api/routes/         # REST endpoints (auth, customers, IFTI, reports, billing…)
│   ├── models/             # SQLAlchemy ORM models (17 tables)
│   ├── schemas/            # Pydantic request/response schemas
│   ├── services/           # Business logic, IFTI Excel generation, storage backends
│   └── main.py             # App entrypoint, middleware, lifespan
├── web/                    # Next.js 14 frontend
│   └── app/                # App Router pages (29 routes)
├── alembic/                # Database migrations
├── nginx/                  # Nginx config template + TLS entrypoint
├── tests/                  # pytest suite (63 tests, 60% coverage gate)
├── .github/workflows/      # CI pipeline
├── docker-compose.yml
├── .env.example
├── Makefile
├── DEPLOYMENT.md           # Full production deployment runbook
└── ZERO_TRUST_ARCHITECTURE.md
```

---

## AUSTRAC IFTI Workflow

```
Create record → Mark Ready → Export Excel → Verify → Lodge via AUSTRAC Online → Mark Submitted (MLRO only)
```

IFTI records require maker-checker: the user who creates/marks ready cannot be the same user who submits. Submission is restricted to the MLRO role.

---

## Roles

| Role | Permissions |
|------|-------------|
| `admin` | Full access including user management and tenant config |
| `mlro` | Submit IFTI/SMR/TTR reports, approve cases |
| `compliance` | Create and edit all compliance records |
| `analyst` | Read/create transactions and alerts |
| `viewer` | Read-only access |

---

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for the full production runbook covering:

- Server prerequisites
- TLS / Let's Encrypt setup
- Stripe webhook configuration
- SMTP setup
- Scaling and load balancing
- Backup and recovery
- AUSTRAC-specific compliance notes

### Vercel (frontend preview)

```bash
# 1. Import repo at vercel.com/new
# 2. Add environment variable:
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
# 3. Deploy — 41 pages build with zero errors
```

---

## CI / CD

GitHub Actions runs on every push:

- **Python 3.11 & 3.12** — ruff lint, mypy type-check, pytest (60% coverage floor)
- **Node 20 & 22** — ESLint, `next build`
- **Docker smoke build** — on pushes to `main`

---

## Security

See [ZERO_TRUST_ARCHITECTURE.md](ZERO_TRUST_ARCHITECTURE.md) for the full security model.

Key controls:
- Rate limiting: 10/min login, 20/min auth, 200/min general API
- JWT blacklist with token revocation
- TOTP MFA enforced for privileged roles (10-min pending window)
- All queries tenant-scoped via `industry_id`
- Security event log (brute force, MFA failures, role changes)
- Non-root Docker containers
- HSTS, CSP, X-Frame-Options headers via Nginx

---

## License

Private — all rights reserved.
