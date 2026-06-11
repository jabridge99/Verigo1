#!/bin/sh
# Nginx entrypoint: render domain template, provision TLS if needed, start nginx.
set -e

APP_DOMAIN="${APP_DOMAIN:-app.example.com}"
API_DOMAIN="${API_DOMAIN:-api.example.com}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-}"
STAGING="${CERTBOT_STAGING:-false}"

echo "[entrypoint] APP_DOMAIN=${APP_DOMAIN}  API_DOMAIN=${API_DOMAIN}"

# ── 1. Render nginx config from template ──────────────────────────────────────
export APP_DOMAIN API_DOMAIN
envsubst '${APP_DOMAIN} ${API_DOMAIN}' \
  < /etc/nginx/nginx.conf.template \
  > /etc/nginx/nginx.conf

# ── 2. TLS certificate handling ───────────────────────────────────────────────

CERT_DIR="/etc/nginx/certs"
mkdir -p "${CERT_DIR}"

_certs_exist() {
  [ -f "${CERT_DIR}/app.crt" ] && [ -f "${CERT_DIR}/app.key" ] && \
  [ -f "${CERT_DIR}/api.crt" ] && [ -f "${CERT_DIR}/api.key" ]
}

if _certs_exist; then
  echo "[entrypoint] TLS certificates already present — skipping provisioning."

elif [ -n "${CERTBOT_EMAIL}" ]; then
  echo "[entrypoint] Provisioning Let's Encrypt certs via Certbot..."

  STAGING_FLAG=""
  if [ "${STAGING}" = "true" ]; then
    STAGING_FLAG="--staging"
    echo "[entrypoint] Using Let's Encrypt STAGING environment."
  fi

  # Start nginx briefly on port 80 only to serve ACME challenges,
  # using a minimal config without TLS (certs don't exist yet).
  cat > /tmp/nginx-acme.conf <<EOF
events { worker_connections 64; }
http {
  server {
    listen 80;
    server_name _;
    location /.well-known/acme-challenge/ { root /var/www/certbot; }
    location / { return 200 "waiting for certs"; }
  }
}
EOF
  nginx -c /tmp/nginx-acme.conf -g "daemon on;"
  sleep 2

  certbot certonly --webroot \
    -w /var/www/certbot \
    -d "${APP_DOMAIN}" \
    -d "${API_DOMAIN}" \
    --email "${CERTBOT_EMAIL}" \
    --agree-tos \
    --non-interactive \
    ${STAGING_FLAG}

  # Stop the temporary nginx
  nginx -s stop || true
  sleep 1

  # Copy certs into the expected location
  APP_LIVE="/etc/letsencrypt/live/${APP_DOMAIN}"
  API_LIVE="/etc/letsencrypt/live/${API_DOMAIN}"

  # If both domains share one cert (SAN cert), point both to same files
  if [ -d "${APP_LIVE}" ]; then
    cp "${APP_LIVE}/fullchain.pem" "${CERT_DIR}/app.crt"
    cp "${APP_LIVE}/privkey.pem"   "${CERT_DIR}/app.key"
  else
    echo "[entrypoint] ERROR: cert for ${APP_DOMAIN} not found after certbot run." >&2
    exit 1
  fi

  if [ -d "${API_LIVE}" ]; then
    cp "${API_LIVE}/fullchain.pem" "${CERT_DIR}/api.crt"
    cp "${API_LIVE}/privkey.pem"   "${CERT_DIR}/api.key"
  else
    # API domain cert may be under the same directory if issued together
    cp "${CERT_DIR}/app.crt" "${CERT_DIR}/api.crt"
    cp "${CERT_DIR}/app.key" "${CERT_DIR}/api.key"
  fi

  echo "[entrypoint] Let's Encrypt certs provisioned successfully."

else
  echo "[entrypoint] No certs found and CERTBOT_EMAIL not set."
  echo "[entrypoint] Generating self-signed certificates for ${APP_DOMAIN} / ${API_DOMAIN}..."

  openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout "${CERT_DIR}/app.key" \
    -out    "${CERT_DIR}/app.crt" \
    -subj "/CN=${APP_DOMAIN}/O=TVG/C=AU" \
    -addext "subjectAltName=DNS:${APP_DOMAIN},DNS:${API_DOMAIN}" \
    2>/dev/null

  # API reuses the same SAN cert
  cp "${CERT_DIR}/app.crt" "${CERT_DIR}/api.crt"
  cp "${CERT_DIR}/app.key" "${CERT_DIR}/api.key"

  echo "[entrypoint] Self-signed cert generated (not trusted by browsers — dev/staging only)."
fi

# ── 3. Start nginx ────────────────────────────────────────────────────────────
echo "[entrypoint] Starting nginx..."
exec nginx -g "daemon off;"
