# Pipra — Pipeline & Release Engineering Platform

<p align="center">
  <img src="public/assets/logo.svg" alt="Pipra Logo" width="360" />
</p>

<p align="center">
  <strong>Build with confidence. Ship with control.</strong><br>
  Self-hosted deployment orchestration platform with zero-downtime cutover, real-time observability, verified health checks, and dependable rollback.
</p>

---

## 1. Overview

**Pipra** is an enterprise-grade platform built to modernize manual deployment scripts (such as `deploy_asdp-dims-fe.sh`) into a resilient, observable, and automated workflow. 

### Core Platform Highlights
- **Persistent Detached Engine:** Deployments run independently in a background worker process. Refreshing the browser, closing tabs, or network disconnections never interrupt an active deployment.
- **10-Stage Deterministic State Machine:** From Preflight through Source Sync, Image Build, Staging, Health Verification, Atomic Cutover, Production Verification, Automated Rollback, and Final Provenance Reporting.
- **Embedded Zero-Config Storage:** Native SQLite (`node:sqlite` in WAL mode) with zero external database dependencies.
- **Atomic Zero-Downtime Cutover:** Sub-second container swapping with pre-cutover state backup and automated rollback.
- **Real-Time Observability:** Native Server-Sent Events (SSE) streaming live ANSI-colored terminal output, stage transitions, and health check probe logs.
- **Role-Based Access Control (RBAC):** Built-in `admin`, `operator`, and `viewer` tiers with cryptographic scrypt authentication.
- **Enterprise Design System:** Built with the mandatory QA Test Studio design tokens, high-density layout, Inter typography, and WCAG 2.2 AA accessibility.

---

## 2. Quick Start

### Prerequisites
- **Node.js:** v20.0.0 or higher (v26 LTS recommended).
- **Docker:** (Optional) Docker daemon for real container builds. Pipra automatically provides a high-fidelity simulation engine when Docker is unavailable.

### Running the Control Plane
```bash
# 1. Start Pipra Control Plane (Default Port: 4200)
npm start

# For development mode with auto-reload:
npm run dev
```

Open your browser at: **`http://localhost:4200`**

### Running the Test Suite
```bash
# Run unit & integration test suite
npm test

# Run unit tests only:
npm run test:unit

# Run E2E integration tests (requires server running):
npm run test:integration
```

---

## 3. Default Credentials

On initial boot, Pipra seeds default credentials for each role:

| Username | Role | Default Password | Scope |
|---|---|---|---|
| `admin` | Administrator | `pipra-admin-2026` | Full platform control, agents, audit logs, user management |
| `operator` | Deployment Operator | `pipra-ops-2026` | Trigger deployments, cancel pipelines, initiate rollbacks |
| `viewer` | Read-Only Observer | `pipra-viewer-2026` | Telemetry, logs, dashboards, and release history |

---

## 4. 10-Stage Deployment Lifecycle

```text
[1. Preflight Validation] ──> [2. Source Synchronization] ──> [3. Local Verification (Optional)]
                                                                           │
[6. Staging Health Check] <── [5. Staging Startup] <─────── [4. Docker Image Build]
         │
         ▼
[7. Production Cutover] ───> [8. Production Verification] ──> [10. Final Report & Provenance]
                                           │ (On Failure)
                                           ▼
                              [9. Automatic Rollback & Verification]
```

1. **Preflight Validation:** Authorization, environment config, concurrency locks, port availability.
2. **Source Synchronization:** Git checkout, pull, commit SHA, author, and revision tracking.
3. **Local Verification:** Optional `npm ci` & `npm run build` verification.
4. **Docker Image Build:** BuildKit-enabled multi-stage Docker build with secret redaction.
5. **Staging Startup:** Boots candidate container on staging port (e.g., `:4001`) without touching production.
6. **Staging Health Verification:** 15 retries @ 2s interval probing HTTP 200/301/302/304/307/308.
7. **Production Cutover:** Renames & preserves live container as backup, binds candidate to production port (`:4000`).
8. **Production Verification:** Probes live production route for readiness.
9. **Automatic Rollback:** Restores backup container immediately if Stage 8 fails; preserves evidence.
10. **Final Report & Provenance:** Stores execution metrics, timing breakdown, and release provenance.

---

## 5. Documentation Directory

Detailed architectural and operational documentation is located in the [`docs/`](docs/) directory:

- [Architecture & Subsystem Design](docs/architecture.md)
- [10-Stage Deployment Lifecycle](docs/deployment-lifecycle.md)
- [Security Model & Safe Execution Policy](docs/security-model.md)
- [Design System & UI Component Integration](docs/design-system-integration.md)
- [Brand Guidelines & Visual Identity System](docs/brand-guidelines.md)
- [Operations Runbook & Admin Guide](docs/operations-runbook.md)
- [Implementation Status & Traceability Matrix](docs/implementation-status.md)

---

## 6. Project Structure

```text
pipra/
├── data/                      # Persistent SQLite database (WAL mode)
├── docs/                      # Architectural, operational, and design documentation
├── public/                    # Web UI Frontend (Single-Page Application)
│   ├── assets/                # Logos, favicons, brand identity board
│   ├── css/                   # Tokens, base layout, component styling
│   └── js/                    # ES Module application components and pages
├── src/                       # Control Plane Backend
│   ├── auth/                  # RBAC and session token management
│   ├── db/                    # SQLite database schema and seed definitions
│   ├── engine/                # Persistent runner, state machine, cutover, health checker, SSE
│   ├── routes/                # REST API endpoints
│   └── utils/                 # Logging, input sanitization, and secret redaction
├── test/                      # Unit and integration test suites
│   ├── integration/           # E2E lifecycle, concurrency, and rollback tests
│   └── unit/                  # State machine, auth, health checker, sanitizer unit tests
├── package.json
└── server.js                  # Control plane server entrypoint
```

---

## 7. License
UNLICENSED — ASYST Platform Engineering. All Rights Reserved.

