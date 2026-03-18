# Backend Planning Placeholder

This directory is reserved for the future FastAPI backend implementation.

## Planned module boundaries
- auth
- users
- bins
- devices
- telemetry
- deposits
- rewards
- logistics
- admin

## Planned internal layering
Each domain module should follow:
- controller/router
- service
- repository
- schemas

## Planned shared areas
- `app/core/` for config, security, logging, and database setup
- `app/common/` for reusable middleware, exceptions, and utilities
- `app/workers/` for MQTT ingestion and future background workers
- `migrations/` and `sql/` for schema lifecycle support
