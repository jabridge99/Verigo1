# ── Stage 1: dependency builder ───────────────────────────────────────────────
FROM python:3.11-slim AS builder

WORKDIR /build
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt


# ── Stage 2: runtime image ────────────────────────────────────────────────────
FROM python:3.11-slim AS runtime

# Non-root user for security
RUN groupadd -r tvg && useradd -r -g tvg -d /app tvg

WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /install /usr/local

# Copy application source
COPY app/ ./app/
COPY alembic/ ./alembic/
COPY alembic.ini ./alembic.ini

# Uploads directory owned by app user
RUN mkdir -p /data/uploads && chown -R tvg:tvg /data

# Don't run as root
USER tvg

ENV DOCUMENT_STORE_PATH=/data/uploads \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

EXPOSE 8000

# Healthcheck for Docker / orchestrators
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health')" || exit 1

# Fixed port 8000 (matches the platform's configured edge-routing target
# port) rather than the platform-injected $PORT, which can drift and cause
# the public domain to route to the wrong port while internal checks still
# pass against whatever port the app actually bound.
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers ${WORKERS:-2} --log-level warning"]
