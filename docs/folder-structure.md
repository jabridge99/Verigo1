# Proposed Folder Structure

> **Important:** This is the **planned target structure** for the future implementation phase. It is not a claim that all of these files currently exist in the repository.

```text
.
├── README.md
├── docs/
│   ├── system-architecture.md
│   └── folder-structure.md
├── backend/
│   ├── README.md
│   ├── app/
│   │   ├── main.py
│   │   ├── api/
│   │   │   ├── deps.py
│   │   │   ├── router.py
│   │   │   └── v1/
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   ├── security.py
│   │   │   ├── logging.py
│   │   │   └── database.py
│   │   ├── common/
│   │   │   ├── exceptions/
│   │   │   ├── middleware/
│   │   │   └── utils/
│   │   ├── models/
│   │   │   └── entities/
│   │   ├── repositories/
│   │   ├── modules/
│   │   │   ├── auth/
│   │   │   │   ├── controller.py
│   │   │   │   ├── service.py
│   │   │   │   ├── repository.py
│   │   │   │   └── schemas.py
│   │   │   ├── users/
│   │   │   ├── bins/
│   │   │   ├── devices/
│   │   │   ├── telemetry/
│   │   │   ├── deposits/
│   │   │   ├── rewards/
│   │   │   ├── logistics/
│   │   │   └── admin/
│   │   ├── workers/
│   │   │   └── mqtt_consumer.py
│   │   └── tests/
│   ├── migrations/
│   ├── sql/
│   ├── pyproject.toml
│   └── Dockerfile
├── frontend/
│   ├── README.md
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── globals.css
│   │   ├── login/
│   │   ├── signup/
│   │   ├── deposits/
│   │   ├── rewards/
│   │   ├── bins/
│   │   └── admin/
│   ├── components/
│   │   ├── common/
│   │   ├── auth/
│   │   ├── deposits/
│   │   ├── rewards/
│   │   ├── bins/
│   │   └── admin/
│   ├── lib/
│   │   ├── api/
│   │   ├── hooks/
│   │   ├── state/
│   │   └── utils/
│   ├── public/
│   ├── package.json
│   └── Dockerfile
├── infra/
│   ├── README.md
│   ├── docker/
│   │   ├── compose/
│   │   └── images/
│   ├── mqtt/
│   │   ├── broker/
│   │   └── acl/
│   ├── db/
│   │   ├── bootstrap/
│   │   └── backups/
│   └── environments/
│       ├── dev/
│       ├── staging/
│       └── prod/
└── .env.example
```

## Structure rationale

## Root
- `README.md` explains the current planning-only status of the repository.
- `docs/` contains architecture and implementation-planning documents.

## Backend
- `app/` contains the future FastAPI application entry point and internal modular monolith.
- `api/` centralizes route registration, versioning, and dependency wiring.
- `core/` contains cross-cutting technical foundations such as configuration, security, logging, and database setup.
- `common/` holds reusable middleware, exceptions, and utilities.
- `models/` stores persistence entities and database-facing models.
- `repositories/` can hold shared repository patterns where cross-module reuse is warranted.
- `modules/` isolates business domains so each can later be extracted into an independent service.
- `workers/` isolates asynchronous ingestion/background processes such as MQTT consumption.
- `tests/` keeps unit, integration, and contract tests close to backend boundaries.
- `migrations/` and `sql/` support schema lifecycle and operational database assets.

## Frontend
- `app/` organizes user and admin route segments.
- `components/` groups reusable UI building blocks by domain and shared/common usage.
- `lib/api/` provides REST integration utilities and typed clients.
- `lib/hooks/` houses query and mutation hooks.
- `lib/state/` contains shared client-side state where needed.
- `lib/utils/` contains UI and formatting helpers.
- `public/` stores static assets.

## Infrastructure
- `docker/compose/` stores Docker Compose assets for local/dev environments.
- `docker/images/` stores Dockerfiles or image-related assets when needed.
- `mqtt/broker/` stores broker configuration.
- `mqtt/acl/` stores device/topic authorization policy artifacts.
- `db/bootstrap/` stores database initialization assets.
- `db/backups/` stores backup/restore playbooks or helper scripts.
- `environments/` stores deployment overlays or templates for `dev`, `staging`, and `prod`.
