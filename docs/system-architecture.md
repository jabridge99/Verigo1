# System Architecture

## 1. Product scope
A smart e-waste recycling MVP with four main surfaces:
1. **Smart bins / IoT devices** sending telemetry such as fill level, weight, and health status.
2. **Backend platform** managing users, bins, devices, deposits, rewards, logistics, and administration.
3. **Data platform** storing transactional and telemetry data with room for analytics expansion.
4. **Mobile-first web app** for citizens and operations/admin teams.

The MVP should be implemented as a **modular monolith** that preserves clean boundaries for future extraction into microservices.

---

## 2. Architecture principles
- **API-first design** for frontend, admin, and future partner integrations.
- **Modular monolith first** for fast delivery and lower operational complexity.
- **Event-aware design** so telemetry, alerts, rewards, and logistics can later become separate services.
- **Environment-based configuration** for dev/staging/prod.
- **Security by default** with JWT auth, secret management, request validation, role-based access, and auditability.
- **Scalability where it matters early**: telemetry ingestion, bin monitoring, and analytics-ready schema design.

---

## 3. High-level system view

```text
[Smart Bin Devices]
     |
     | MQTT
     v
[MQTT Broker]
     |
     v
[IoT Ingestion Module] ---> [Alert Evaluation]
     |                           |
     |                           +--> Admin alerts / pickup triggers
     v
[Core Backend Platform / REST API]
     |
     +--> Auth & Users
     +--> Device Management
     +--> Bin Management
     +--> Deposits
     +--> Rewards Engine
     +--> Logistics
     +--> Admin Dashboard APIs
     |
     +--> PostgreSQL
     +--> Redis
     |
     v
[Next.js Mobile-First Web App]
    |- User experience
    |- Admin operations
```

---

## 4. Backend modular architecture

### 4.1 Core modules
### Auth & Identity Module
**Responsibilities**
- signup/login
- JWT issuance and refresh strategy (refresh can be added after MVP)
- role-based access control (`user`, `admin`, later `operator`)
- user profile access

**Primary entities**
- users
- auth sessions / refresh token store (future)

### User & Wallet Module
**Responsibilities**
- profile management
- wallet points balance
- transaction history
- reward redemption compatibility for future crypto or partner rewards

**Primary entities**
- users
- transactions
- rewards

### Bin Module
**Responsibilities**
- bin metadata
- geolocation
- city assignment
- current state projection from latest telemetry

**Primary entities**
- bins

### Device Management Module
**Responsibilities**
- device registration
- device-to-bin binding
- device credentials/tokens
- firmware metadata
- online/offline status and heartbeat visibility

**Primary entities**
- devices

### IoT Ingestion Module
**Responsibilities**
- consume MQTT payloads
- validate and normalize telemetry
- authenticate devices
- persist telemetry
- emit alert conditions such as `bin_full`, `battery_low`, `tamper`, `offline`

**Primary entities**
- telemetry
- devices

### Deposit Module
**Responsibilities**
- QR-based deposit logging
- user-to-bin transaction records
- deposit status lifecycle
- future image/AI validation integration point

**Primary entities**
- deposits

### Rewards Engine Module
**Responsibilities**
- points calculation
- reward issuance
- ledger entries for wallet transactions
- extension point for tokenized or crypto rewards

**Primary entities**
- rewards
- transactions

### Logistics Module
**Responsibilities**
- pickup candidate generation
- route scheduling
- route status updates
- future route optimization integration

**Primary entities**
- pickup_routes

### Admin Module
**Responsibilities**
- operational dashboards
- device health overview
- fill-level monitoring
- analytics summaries
- multi-city oversight foundation

---

### 4.2 Layering inside the modular monolith
Every backend module should follow the same internal structure:
- **controller/router layer** — HTTP interface
- **service layer** — business rules and orchestration
- **repository layer** — database access
- **schema/model layer** — request/response DTOs and persistence models

This gives a clean extraction path into independent services later without rewriting business logic boundaries.

### 4.3 Planned REST API surface
The initial REST surface should be grouped by domain rather than by internal database entities:
- `POST /auth/signup`, `POST /auth/login`, `GET /auth/me`
- `GET /users/profile`, `GET /users/wallet`, `GET /users/transactions`
- `POST /devices/register`, `GET /devices`, `GET /devices/{id}/status`
- `GET /bins`, `GET /bins/{id}`
- `POST /deposits`, `GET /deposits`
- `GET /rewards`, `POST /rewards/redeem`
- `GET /logistics/pickups`, `POST /logistics/routes`
- `GET /admin/dashboard`, `GET /admin/analytics`, `GET /admin/alerts`

This keeps the API consumer-facing, while the internal module boundaries remain implementation details.

---

## 5. IoT architecture

### 5.1 MQTT topic structure
Recommended MVP topic taxonomy:

```text
ewaste/devices/{device_uid}/telemetry
ewaste/devices/{device_uid}/status
ewaste/devices/{device_uid}/heartbeat
ewaste/devices/{device_uid}/alerts
```

### 5.2 Device registration and identity
For the MVP, use **token-based device authentication**:
- each device gets a unique `device_uid`
- each device is assigned to exactly one bin at a time
- each device receives a provisioned auth token
- the token is included in every MQTT payload or mapped from broker credentials

For later versions, move to:
- certificate-based device identity
- broker-level ACLs by topic
- hardware-backed secrets where available

### 5.3 Telemetry ingestion flow
```text
Device publishes telemetry
    -> MQTT broker receives message
    -> ingestion consumer subscribes to device topics
    -> payload validation and normalization
    -> device credential verification
    -> telemetry persistence
    -> alert threshold evaluation
    -> device status projection update
    -> admin/logistics consumers read latest state
```

### 5.4 Alerting logic for MVP
Alerts should be created when:
- fill level exceeds configured threshold
- weight exceeds safe threshold
- battery falls below configured minimum
- telemetry status indicates fault/tamper/error
- heartbeat timeout marks device offline

---

## 6. Data architecture

### 6.1 Primary stores
### PostgreSQL
Use as the source of truth for:
- users
- bins
- devices
- telemetry metadata and history
- deposits
- rewards
- wallet transactions
- pickup routes

### Redis
Use for:
- short-lived caching
- rate limiting
- session/refresh token support if added later
- latest telemetry snapshots cache
- background job coordination in later phases

### 6.2 Telemetry storage strategy
Telemetry is the highest-volume dataset. The MVP should prepare for scale by:
- partitioning telemetry tables by time (`recorded_at`)
- indexing by `(device_id, recorded_at desc)`
- indexing alert queries separately
- keeping latest-device-state derivations accessible for dashboard use

### 6.3 Analytics readiness
Future ESG and reporting needs require:
- city dimension on bins and routes
- stable user/deposit/reward history
- auditable transaction ledger
- later ETL/warehouse export paths from PostgreSQL

---

## 7. Web application architecture

### 7.1 User-facing experience
The mobile-first web app should include:
- sign up / login
- QR code input or scan simulation
- deposit history
- rewards wallet dashboard
- nearby/available bins map view

### 7.2 Admin-facing experience
The admin web surface should include:
- live bin monitoring overview
- collection queue / pickup status
- analytics cards and trend summaries
- device health and alert visibility

### 7.3 Frontend architecture principles
- Next.js for app shell and routing
- component-based UI organization
- shared API client for REST integration
- server/client rendering chosen per page need
- React Query for API data fetching and cache orchestration
- mobile-first layout system from the start

---

## 8. Security architecture

### User security
- JWT access tokens for API authentication
- password hashing with strong one-way hashing
- request validation on all write endpoints
- role-based authorization for admin routes

### Device security
- unique device credentials
- topic scoping by device identity where possible
- message validation and schema enforcement
- device disable/revoke path in the admin system

### Platform security
- environment variable configuration
- secrets separated per environment
- CORS allowlist
- structured logging
- audit-friendly transaction and admin activity design
- rate limiting for public/auth endpoints

---

## 9. Deployment architecture

### 9.1 MVP deployment topology
```text
[Users / Admins]
       |
       v
[Next.js Frontend]
       |
       v
[REST API / Backend] <------ [MQTT Consumer Worker] <------ [MQTT Broker] <------ [Smart Bin Devices]
   |             |
   |             +--> Redis
   +----------------> PostgreSQL
```

### 9.2 Runtime components
- **frontend container**
- **backend API container**
- **MQTT consumer worker container**
- **PostgreSQL container/service**
- **Redis container/service**
- **MQTT broker container/service**

### 9.3 Environment separation
Separate configuration and secrets for:
- local development
- staging
- production

This should include isolated databases, redis instances, broker credentials, and API URLs.

---

## 10. Future scalability path

### Phase 1: Strong MVP
- modular monolith
- REST APIs
- PostgreSQL + Redis
- MQTT ingestion worker
- mobile-first citizen/admin web app

### Phase 2: Operational maturity
- background jobs
- alert notification channels
- real-time dashboard updates
- better device health monitoring
- observability stack

### Phase 3: Intelligent optimization
- AI route optimization engine
- predictive bin overflow detection
- anomaly detection for device telemetry
- adaptive rewards optimization

### Phase 4: Platform expansion
- crypto rewards wallet integration
- multi-region deployment
- city/operator tenancy
- B2B ESG reporting and export APIs
- partner and municipality integrations

---

## 11. Recommended implementation sequence
1. Establish repository structure and shared standards.
2. Design database schema and migrations.
3. Implement auth/users/bins/devices modules.
4. Implement MQTT ingestion and telemetry persistence.
5. Implement deposits and rewards.
6. Implement logistics and admin reporting.
7. Implement mobile-first frontend pages.
8. Add observability, hardening, and staging rollout.
