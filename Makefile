.PHONY: help dev build up down logs migrate shell test lint

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN{FS=":.*?## "}{printf "\033[36m%-20s\033[0m %s\n",$$1,$$2}'

# ── Development ───────────────────────────────────────────────────────────────

dev-api: ## Run FastAPI in dev mode with hot reload
	uvicorn app.main:app --reload --port 8000

dev-web: ## Run Next.js dev server
	cd web && npm run dev

dev: ## Run both API and web concurrently (requires: npm i -g concurrently)
	concurrently "make dev-api" "make dev-web"

# ── Database migrations ───────────────────────────────────────────────────────

migrate: ## Apply all pending Alembic migrations
	alembic upgrade head

migrate-auto: ## Auto-generate a new migration (usage: make migrate-auto MSG="add foo table")
	alembic revision --autogenerate -m "$(MSG)"

migrate-down: ## Downgrade one migration
	alembic downgrade -1

migrate-history: ## Show migration history
	alembic history --verbose

migrate-current: ## Show current migration version
	alembic current

# ── Docker ────────────────────────────────────────────────────────────────────

build: ## Build all Docker images
	docker compose build

up: ## Start all services (detached)
	docker compose up -d

down: ## Stop all services
	docker compose down

logs: ## Tail logs from all services
	docker compose logs -f

logs-api: ## Tail API logs only
	docker compose logs -f api

shell-api: ## Open a shell in the running API container
	docker compose exec api sh

shell-db: ## Open a psql session
	docker compose exec db psql -U $${POSTGRES_USER:-tvg} $${POSTGRES_DB:-tvg}

# ── Production ────────────────────────────────────────────────────────────────

deploy: build ## Build, migrate, restart (zero-downtime with Docker)
	docker compose up -d --no-deps --build api web
	docker compose exec api alembic upgrade head

certs: ## Generate self-signed certs for local HTTPS testing
	mkdir -p nginx/certs
	APP_DOMAIN=$${APP_DOMAIN:-app.localhost} API_DOMAIN=$${API_DOMAIN:-api.localhost} \
	openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
	  -keyout nginx/certs/app.key -out nginx/certs/app.crt \
	  -subj "/CN=$$APP_DOMAIN" -addext "subjectAltName=DNS:$$APP_DOMAIN,DNS:$$API_DOMAIN"
	cp nginx/certs/app.key nginx/certs/api.key
	cp nginx/certs/app.crt nginx/certs/api.crt

secret: ## Generate a secure SECRET_KEY
	@python3 -c "import secrets; print(secrets.token_urlsafe(64))"

# ── Quality ───────────────────────────────────────────────────────────────────

test: ## Run backend tests
	pytest tests/ -v

lint: ## Lint Python code
	ruff check app/ && ruff format --check app/

lint-fix: ## Auto-fix Python linting
	ruff check --fix app/ && ruff format app/

typecheck: ## Run mypy
	mypy app/ --ignore-missing-imports
