# Trust Verify Go — Production Deployment Runbook

## Architecture

```
Internet → Nginx (80/443) → FastAPI API (8000) → PostgreSQL
                          → Next.js  Web (3000)
```

All services run in Docker containers orchestrated by Docker Compose.
For Kubernetes, each service maps to a Deployment + Service.

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
git clone https://github.com/jabridge99/EcoBin.git tvg
cd tvg
cp .env.example .env
```

Edit `.env` — every `CHANGE_ME` value **must** be replaced:

```bash
# Generate a strong secret key
python3 -c "import secrets; print(secrets.token_urlsafe(64))"
# Or use:
make secret
```

### 2. TLS certificates

**Production** — use Let's Encrypt with Certbot:

```bash
certbot certonly --webroot -w /var/www/certbot \
  -d app.trustverifygo.com.au \
  -d api.trustverifygo.com.au
mkdir -p nginx/certs
cp /etc/letsencrypt/live/app.trustverifygo.com.au/fullchain.pem nginx/certs/app.crt
cp /etc/letsencrypt/live/app.trustverifygo.com.au/privkey.pem   nginx/certs/app.key
cp /etc/letsencrypt/live/api.trustverifygo.com.au/fullchain.pem nginx/certs/api.crt
cp /etc/letsencrypt/live/api.trustverifygo.com.au/privkey.pem   nginx/certs/api.key
```

**Local testing** — generate self-signed certs:

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

### 4. Run initial migration

```bash
docker compose exec api alembic upgrade head
```

### 5. Verify

```bash
curl https://api.trustverifygo.com.au/health
# → {"status":"ok","version":"1.0.0","environment":"production"}

curl https://api.trustverifygo.com.au/health/ready
# → {"status":"ready","database":"ok",...}
```

---

## Database Migrations

### Create a migration after model changes

```bash
make migrate-auto MSG="add payment_method to subscriptions"
# Review the generated file in alembic/versions/
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
3. `alembic upgrade head` — runs any new migrations

---

## Stripe Setup

1. Create a Stripe account at https://dashboard.stripe.com
2. Create 6 recurring Price objects in AUD:
   - Starter Monthly ($299), Starter Annual ($2,870.40)
   - Professional Monthly ($799), Professional Annual ($7,670.40)
   - Enterprise Monthly ($1,999), Enterprise Annual ($19,190.40)
3. Copy Price IDs (`price_xxx`) into `.env`
4. Set up a webhook endpoint in Stripe Dashboard:
   - URL: `https://api.trustverifygo.com.au/api/v1/billing/webhook`
   - Events: `checkout.session.completed`, `customer.subscription.*`, `invoice.*`
5. Copy the webhook signing secret (`whsec_xxx`) into `.env`

---

## SMTP / Email

| Provider | SMTP Host | Port |
|----------|-----------|------|
| SendGrid | smtp.sendgrid.net | 587 |
| SES | email-smtp.ap-southeast-2.amazonaws.com | 587 |
| Postmark | smtp.postmarkapp.com | 587 |

Set `SMTP_USER`, `SMTP_PASS`, `FROM_EMAIL` in `.env`.

---

## Scaling

| Lever | How |
|-------|-----|
| API workers | Increase `API_WORKERS` in `.env` (default 2) |
| DB connections | Use PgBouncer in front of PostgreSQL |
| File storage | Replace local `/data/uploads` with S3/GCS via `boto3` |
| Caching | Add Redis; replace in-process rate limiter with `slowapi + redis` |
| Multi-region | Deploy Nginx + API behind a global load balancer; use managed DB with read replicas |

---

## Monitoring & Observability

- **Sentry** — set `SENTRY_DSN` in `.env` for automatic error reporting
- **Health endpoints** — `/health` (liveness), `/health/ready` (readiness)
- **Logs** — structured JSON to stdout; ship to CloudWatch / Datadog / Loki
- **Uptime** — configure an external monitor (e.g. UptimeRobot, Pingdom) on `/health`

---

## Security Checklist

- [ ] `SECRET_KEY` is a 64-char random value (never default)
- [ ] `POSTGRES_PASSWORD` is strong and unique
- [ ] `.env` is **not** committed to version control
- [ ] `CORS_ORIGINS` lists only your domains (not `*`)
- [ ] TLS certs are valid and auto-renewed
- [ ] Stripe webhook signature validation enabled (`STRIPE_WEBHOOK_SECRET` set)
- [ ] Nginx rate limits tuned for expected traffic
- [ ] Swagger UI disabled in production (`ENVIRONMENT=production`)
- [ ] Document uploads volume is not publicly accessible
- [ ] Regular database backups configured (pg_dump cron / managed snapshots)
- [ ] Dependency updates automated (Dependabot / Renovate)

---

## Backup & Recovery

```bash
# Manual DB backup
docker compose exec db pg_dump -U tvg tvg | gzip > backup_$(date +%Y%m%d).sql.gz

# Restore
gunzip -c backup_20250610.sql.gz | docker compose exec -T db psql -U tvg tvg

# Document files backup
tar czf uploads_$(date +%Y%m%d).tar.gz -C /var/lib/docker/volumes tvg_uploads
```

Set up automated daily snapshots via your cloud provider's managed PostgreSQL service for production.

---

## Support

- Issues: https://github.com/jabridge99/EcoBin/issues
- Docs: https://docs.trustverifygo.com.au
- Email: support@trustverifygo.com.au
