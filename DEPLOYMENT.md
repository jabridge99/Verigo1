# Verigo — Production Deployment Runbook

## Architecture

```
Internet
   │
   ▼
Nginx  (80 → 443 redirect, TLS termination, rate limiting)
   │
   ├─▶ Next.js  Web  :3000   (App Router, dark-theme SaaS UI)
   │
   └─▶ FastAPI  API  :8000   (JWT auth, RBAC, tenant isolation)
            │
            ├─▶ PostgreSQL  :5432   (primary data store)
            │
            └─▶ Object Storage      (S3 / Azure Blob / GCS / local)
                                    configurable per tenant
```

All services run in Docker containers orchestrated by Docker Compose.
For Kubernetes, each service maps to a Deployment + Service.

---

## Current State (as of June 2026)

| Area | Status | Notes |
|------|--------|-------|
| FastAPI backend | ✅ Complete | 20+ API route modules |
| Next.js frontend | ✅ Complete | All major pages built |
| PostgreSQL ORM | ✅ Complete | 16 SQLAlchemy models |
| Alembic migrations | ✅ Complete | Initial schema migration generated |
| Docker / Compose | ✅ Complete | Multi-stage, non-root, healthchecks |
| Nginx reverse proxy | ✅ Complete | TLS 1.2/1.3, HSTS, rate limiting |
| JWT auth + MFA TOTP | ✅ Complete | Blacklist, revocation, MFA flow |
| RBAC (5 roles) | ✅ Complete | admin / mlro / compliance / analyst / viewer |
| Tenant isolation | ✅ Complete | industry_id scoped on all queries |
| Zero Trust hardening | ✅ Complete | See ZERO_TRUST_ARCHITECTURE.md |
| IFTI-DRA IN/OUT reports | ✅ Complete | AUSTRAC Excel export (112 / 115 cols) |
| AML reports + maker-checker | ✅ Complete | SMR, TTR, IFTI, ECDD |
| Transaction monitoring | ✅ Complete | Alerts, cases, escalation |
| KYC / KYB onboarding | ✅ Complete | Document upload, risk scoring |
| Sanction screening | ✅ Complete | OFAC/UN list matching |
| Connector marketplace | ✅ Complete | 15 providers, Fernet-encrypted creds |
| Data retention | ✅ Complete | AUSTRAC 7yr/10yr, legal hold |
| Security monitoring | ✅ Complete | Brute force, MFA, role-change audit |
| Billing (Stripe) | ✅ Complete | Starter / Pro / Enterprise tiers |
| Storage abstraction | ✅ Complete | Local, S3, Azure Blob, GCS |
| Test suite | ✅ Complete | 63 tests — auth, IFTI, customers, reports, txns |
| GitHub Actions CI | ✅ Complete | Lint, type-check, pytest, Next.js build |
| `.env.example` | ✅ Complete | All secrets documented |
| `DEPLOYMENT.md` | ✅ This file |  |

---

## Prerequisites

| Tool | Min version |
|------|-------------|
| Docker | 24+ |
| Docker Compose | 2.20+ |
| PostgreSQL | 15+ (managed: RDS, Cloud SQL, Supabase) |
| Domain + TLS cert | Let's Encrypt / ACM / Cloudflare |

---

## First-time Setup

### 1. Clone and configure

```bash
git clone https://github.com/jabridge99/Verigo1.git verigo
cd tvg
cp .env.example .env
```

Edit `.env` — every `CHANGE_ME` value **must** be replaced before starting:

```bash
# Generate a 64-char secret key
python3 -c "import secrets; print(secrets.token_urlsafe(64))"
# Or use:
make secret
```

Key variables to set:

| Variable | Required | Description |
|----------|----------|-------------|
| `SECRET_KEY` | Yes | 64-char random string — JWT signing key |
| `DATABASE_URL` | Yes | `postgresql://user:pass@host:5432/dbname` |
| `CORS_ORIGINS` | Yes | `https://app.yourdomain.com` (never `*` in prod) |
| `POSTGRES_PASSWORD` | Yes | Strong password for the DB container |
| `STRIPE_SECRET_KEY` | Billing | Stripe live secret key |
| `STRIPE_WEBHOOK_SECRET` | Billing | Stripe webhook signing secret |
| `SMTP_HOST / SMTP_USER / SMTP_PASS` | Email | SMTP credentials |
| `STORAGE_BACKEND` | File upload | `local` / `s3` / `azure` / `gcs` |
| `SENTRY_DSN` | Monitoring | Optional — error tracking |

### 2. TLS certificates

**Production** — use Let's Encrypt with Certbot:

```bash
certbot certonly --webroot -w /var/www/certbot \
  -d app.yourdomain.com \
  -d api.yourdomain.com
mkdir -p nginx/certs
cp /etc/letsencrypt/live/app.yourdomain.com/fullchain.pem nginx/certs/app.crt
cp /etc/letsencrypt/live/app.yourdomain.com/privkey.pem   nginx/certs/app.key
cp /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem nginx/certs/api.crt
cp /etc/letsencrypt/live/api.yourdomain.com/privkey.pem   nginx/certs/api.key
```

Also update domain names in `nginx/nginx.conf` — replace `app.verigo.com.au` and `api.verigo.com.au` with your actual domain.

**Local/staging testing** — generate self-signed certs:

```bash
make certs
```

### 3. Build and start

```bash
make build
make up
# Watch logs until all services are healthy
make logs
```

Expected startup sequence:
1. PostgreSQL starts and becomes healthy (~5s)
2. FastAPI starts, runs `alembic upgrade head`, seeds compliance packs (~10s)
3. Next.js starts (~15s)
4. Nginx starts and begins accepting traffic (~2s)

### 4. Verify

```bash
curl https://api.yourdomain.com/health
# → {"status":"ok","version":"1.0.0","environment":"production"}

curl https://api.yourdomain.com/health/ready
# → {"status":"ready","database":"ok",...}
```

---

## Database Migrations

The initial schema migration is included — `alembic/versions/ffafae2ef332_initial_schema.py` — covering all 16 tables. Migrations run automatically on container start.

### Create a migration after model changes

```bash
# In the running container:
docker compose exec api alembic revision --autogenerate -m "describe the change"
# Review the generated file in alembic/versions/
docker compose exec api alembic upgrade head
```

Or locally (requires DATABASE_URL to be set):

```bash
make migrate-auto MSG="add payment_method to subscriptions"
make migrate
```

### Rollback one step

```bash
make migrate-down
```

### Full history

```bash
make migrate-history
```

---

## Ongoing Deployments

```bash
# Pull latest code
git pull origin main

# Build new images, migrate, restart with zero downtime
make deploy
```

This runs:
1. `docker compose build` — builds new images
2. `docker compose up -d --no-deps --build api web` — rolling restart
3. `alembic upgrade head` — runs any new migrations automatically on startup

---

## Running Tests

```bash
# Run locally
pip install -r requirements.txt
pytest tests/ -v --tb=short

# Run with coverage report
pytest tests/ --cov=app --cov-report=term-missing

# Run in Docker
docker compose exec api pytest tests/ -v
```

The test suite covers:
- **Auth**: Register, login, JWT validation, logout blacklist, RBAC enforcement
- **IFTI**: Draft → ready → submitted workflow, Excel export (IN/OUT), tenant isolation
- **Customers**: CRUD, tenant isolation, privilege field protection
- **Reports**: Maker-checker enforcement, RBAC, tenant isolation
- **Transactions**: Create, tenant isolation, alert RBAC
- **Health**: Liveness + readiness probes

---

## IFTI Report Workflow (AUSTRAC)

Verigo generates AUSTRAC-compatible IFTI-DRA Excel files for IFTI-IN (115 cols) and IFTI-OUT (112 cols).

```
1. Create IFTI records via UI or POST /api/v1/ifti/
2. Review and mark as Ready (POST /api/v1/ifti/{id}/ready)
3. Export to Excel (GET /api/v1/ifti/export/{incoming|outgoing})
4. Open in Excel, verify rows match AUSTRAC template
5. Copy-paste into AUSTRAC Online and submit
6. Mark as Submitted in system (POST /api/v1/ifti/{id}/submitted) — requires MLRO role
```

Triggers for reporting: international transfers ≥ AUD $10,000 under a Designated Remittance Arrangement (DRA).

---

## API Routes Summary

| Prefix | Module | Auth required |
|--------|--------|---------------|
| `/api/v1/auth` | Users, JWT, MFA, magic links | Some public |
| `/api/v1/customers` | Customer CRUD, risk scoring | analyst+ |
| `/api/v1/kyc` | KYC/KYB records, document upload | analyst+ |
| `/api/v1/transactions` | Transactions, AML alerts | analyst+ |
| `/api/v1/reports` | SMR, TTR, ECDD, IFTI reports | compliance+ |
| `/api/v1/ifti` | IFTI-DRA IN/OUT, Excel export | analyst+ (read), compliance+ (write) |
| `/api/v1/sanctions` | Sanction screening | analyst+ |
| `/api/v1/audit` | Audit log | compliance+ |
| `/api/v1/tenants` | Tenant management | admin |
| `/api/v1/analytics` | Dashboard KPIs | analyst+ |
| `/api/v1/documents` | Document store | analyst+ |
| `/api/v1/billing` | Stripe subscriptions, webhook | admin |
| `/api/v1/connectors` | External provider credentials | compliance+ |
| `/api/v1/retention` | Data retention policies, legal hold | admin |
| `/api/v1/security` | Security event monitor, alerts | mlro+ |
| `/api/v1/notifications` | User notifications | authenticated |
| `/api/v1/api-keys` | API key management | admin |

Swagger UI available at `/docs` in non-production environments.

---

## Stripe Setup

1. Create a Stripe account at https://dashboard.stripe.com
2. Create 6 recurring Price objects in AUD:
   - Starter Monthly ($299), Starter Annual ($2,870.40)
   - Professional Monthly ($799), Professional Annual ($7,670.40)
   - Enterprise Monthly ($1,999), Enterprise Annual ($19,190.40)
3. Copy Price IDs (`price_xxx`) into `.env`
4. Set up a webhook endpoint in Stripe Dashboard:
   - URL: `https://api.yourdomain.com/api/v1/billing/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.*`, `invoice.*`
5. Copy the webhook signing secret (`whsec_xxx`) into `.env`

---

## SMTP / Email

| Provider | SMTP Host | Port |
|----------|-----------|------|
| SendGrid | smtp.sendgrid.net | 587 |
| SES | email-smtp.ap-southeast-2.amazonaws.com | 587 |
| Postmark | smtp.postmarkapp.com | 587 |

Set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `FROM_EMAIL` in `.env`.

---

## File / Document Storage

Document uploads support four backends — configured via `STORAGE_BACKEND` in `.env`:

| Backend | Variables required |
|---------|--------------------|
| `local` | `DOCUMENT_STORE_PATH` (default `./uploads`) |
| `s3` | `S3_BUCKET`, `S3_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` |
| `s3` (Backblaze B2) | Above + `S3_ENDPOINT_URL=https://s3.us-west-002.backblazeb2.com` |
| `azure` | `AZURE_ACCOUNT_NAME`, `AZURE_ACCOUNT_KEY`, `AZURE_CONTAINER` |
| `gcs` | `GCS_BUCKET`, `GCS_CREDENTIALS_JSON` (path to service-account JSON) |

For production, use cloud storage (`s3`, `azure`, or `gcs`) — local storage does not work with multiple API instances.

---

## Scaling

| Lever | How |
|-------|-----|
| API workers | Increase `API_WORKERS` in `.env` (default 2) |
| DB connections | Use PgBouncer in front of PostgreSQL |
| File storage | Set `STORAGE_BACKEND=s3` (or azure/gcs) |
| Rate limiting | Replace in-process limiter with `slowapi + redis` |
| JWT blacklist | Replace in-process `TOKEN_BLACKLIST` set with Redis (multi-worker safe) |
| Multi-region | Deploy Nginx + API behind a global load balancer; use managed DB with read replicas |

---

## Monitoring & Observability

- **Sentry** — set `SENTRY_DSN` in `.env` for automatic error + performance tracking
- **Health endpoints** — `/health` (liveness), `/health/ready` (readiness + DB check)
- **Security dashboard** — `GET /api/v1/security/summary` (brute force, MFA, role changes)
- **Logs** — structured JSON to stdout; ship to CloudWatch / Datadog / Loki
- **Uptime** — configure external monitor (UptimeRobot, Pingdom, Better Uptime) on `/health`

---

## Security Checklist

**Must complete before go-live:**

- [ ] `SECRET_KEY` is a 64-char random value — never the default
- [ ] `POSTGRES_PASSWORD` is strong and unique
- [ ] `.env` is **not** committed to version control (confirmed in `.gitignore`)
- [ ] `CORS_ORIGINS` lists only your domains — never `*`
- [ ] `ENVIRONMENT=production` set — disables Swagger UI
- [ ] TLS certs are valid and auto-renewed (Certbot timer or ACME)
- [ ] `nginx.conf` domain names updated to your actual domain
- [ ] Stripe webhook secret set and verified (`STRIPE_WEBHOOK_SECRET`)
- [ ] Cloud storage configured for document uploads (not local for multi-instance)
- [ ] Rate limits tuned for expected traffic volume
- [ ] Nginx only exposes ports 80 and 443 to the public internet

**Strongly recommended:**

- [ ] MFA enabled for all admin and MLRO accounts
- [ ] Regular database backups configured (daily pg_dump / managed snapshots)
- [ ] Sentry DSN configured for error alerting
- [ ] Dependabot / Renovate enabled for dependency updates
- [ ] Security monitoring reviewed weekly (`/api/v1/security/alerts`)

**Hardening roadmap (post-launch):**

- [ ] Migrate `TOKEN_BLACKLIST` to Redis (required for multi-worker JWT revocation)
- [ ] Encrypt TOTP secrets at rest (Fernet)
- [ ] Replace `unsafe-inline` in CSP with nonce-based headers
- [ ] Migrate rate limiter to `slowapi + Redis` for distributed enforcement
- [ ] Add CSRF middleware for session-based flows

---

## Backup & Recovery

```bash
# Manual DB backup
docker compose exec db pg_dump -U tvg tvg | gzip > backup_$(date +%Y%m%d).sql.gz

# Restore
gunzip -c backup_20260611.sql.gz | docker compose exec -T db psql -U tvg tvg

# Document files backup (local storage only)
tar czf uploads_$(date +%Y%m%d).tar.gz -C /var/lib/docker/volumes tvg_uploads
```

For production: use your cloud provider's managed PostgreSQL daily snapshot feature. For S3/Azure/GCS document storage, enable versioning and cross-region replication.

---

## AUSTRAC Compliance Notes

This system is designed for AUSTRAC-regulated Designated Remittance Arrangements (DRAs) and financial institutions.

- IFTI reports must be lodged within **10 business days** of the transfer date
- AML/CTF records must be retained for **7 years** (10 years for ECDD records)
- Submitted IFTI records are locked — they cannot be edited or deleted
- Maker-checker is enforced: the person who prepares a report cannot also approve it
- All privileged actions are logged to the audit trail

---

## Support

- Issues: https://github.com/jabridge99/Verigo1/issues
- Docs: https://docs.verigo.com.au
- Email: support@verigo.com.au
