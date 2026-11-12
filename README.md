# Pipra — Pipeline & Release Engineering Platform

<p align="center">
  <img src="public/assets/logo.svg" alt="Pipra Logo" width="360" />
</p>

<p align="center">
  <strong>Build with confidence. Ship with control.</strong><br>
  Self-hosted continuous delivery and deployment orchestration platform featuring zero-downtime cutover, deterministic state machine execution, automated rollback, cryptographic provenance attestation, and native DORA reliability intelligence.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-v20%20%7C%20v26%20LTS-43853d?style=flat-square&logo=node.js&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/License-MIT-blue?style=flat-square" alt="MIT License" />
  <img src="https://img.shields.io/badge/Storage-Native%20SQLite%20(WAL)-003B57?style=flat-square&logo=sqlite&logoColor=white" alt="SQLite" />
  <img src="https://img.shields.io/badge/Security-SLSA%20Level%202%20Attested-43c99a?style=flat-square" alt="SLSA Level 2" />
  <img src="https://img.shields.io/badge/Tests-87%20Passed%20%7C%200%20Failed-success?style=flat-square" alt="Test Status" />
  <img src="https://img.shields.io/badge/Dependencies-Zero%20External%20NPM-101722?style=flat-square" alt="Zero External Dependencies" />
</p>

---

## ⚡ Quick Start: Run Without Cloning Git

You can run or install Pipra on any machine instantly without cloning the git repository:

### Option 1: Instant Run with NPX (Recommended for Node.js Users)
Run directly in your terminal without any prior setup:
```bash
npx pipra-ci
```
Or specify a custom port:
```bash
npx pipra-ci --port 8080
```
Open **`http://localhost:4200`** in your browser.

---

### Option 2: Linux / macOS One-Liner (curl | bash)
Installs Pipra into `~/.pipra` and links the `pipra` CLI into your PATH:
```bash
curl -fsSL https://raw.githubusercontent.com/anggit-arisa/pipra/main/scripts/install.sh | bash
```
Once installed, simply start the server anytime:
```bash
pipra start
```

---

### Option 3: Windows PowerShell One-Liner
Installs Pipra on Windows and configures the environment PATH:
```powershell
irm https://raw.githubusercontent.com/anggit-arisa/pipra/main/scripts/install.ps1 | iex
```
Restart your PowerShell terminal and run:
```powershell
pipra start
```

---

### Option 4: Docker & Docker Compose
Run via Docker without cloning:
```bash
docker run -d \
  --name pipra \
  -p 4200:4200 \
  -v pipra_data:/app/data \
  -v /var/run/docker.sock:/var/run/docker.sock \
  --restart unless-stopped \
  ghcr.io/anggit-arisa/pipra:latest
```
Or download the single `docker-compose.yml` file:
```bash
curl -O https://raw.githubusercontent.com/anggit-arisa/pipra/main/docker-compose.yml
docker compose up -d
```

---

## 1. What is Pipra?

**Pipra** is a self-hosted continuous delivery and deployment orchestration platform designed to replace fragile shell scripts with an automated, observable, and resilient delivery pipeline.

### Architectural Value Pillars:
- **Persistent Detached Engine:** Deployments execute in background worker processes. Refreshing browsers, closing tabs, or network disconnections never disrupt active deployments.
- **Deterministic Zero-Downtime Cutover:** Candidate containers undergo rigorous health verification on staging ports before atomic production port reassignment. Pre-cutover states are automatically backed up as immediate rollback targets.
- **Zero External Runtime Dependencies:** Powered entirely by native Node.js standard libraries (`node:sqlite`, `node:crypto`, `node:http`, `node:fs`), eliminating external supply chain dependencies and npm package vulnerabilities.
- **Zero-Agent Remote Deployment:** Deploys directly to remote targets over standard SSH using encrypted credentials, requiring no agent daemons on target hosts.

---

## 2. Architectural Comparison

| Capability | Manual Shell Scripts | Heavy Enterprise CI/CD | Pipra Control Plane |
|---|---|---|---|
| **Execution State Machine** | Procedural bash scripts | Complex distributed DAG | **Deterministic 10-Stage State Machine** |
| **Rollback Safety** | Manual intervention required | Scripted or external plugin | **Automatic & Instant on Probe Failure** |
| **Zero-Downtime Cutovers** | High downtime or port collision | Requires complex service mesh | **Native Staging-to-Prod Atomic Swap** |
| **Target Host Requirements** | Manual host SSH access | Heavy agent daemons installed | **Zero-Agent (Hardened SSH Key/Password)** |
| **Observability Telemetry** | Unstructured terminal logs | Third-party agent required | **Native DORA Metrics & Real-Time SSE Logs** |
| **Release Governance** | Honor system / external wiki | Complex custom permissions | **Built-in Two-Person Approval Gate** |
| **Supply Chain Attestation** | None | Separate Sigstore/in-toto tool | **Native SLSA Level 2 Signed Provenance** |
| **Database Overhead** | None (ephemeral) | PostgreSQL / MySQL / Redis | **Embedded Zero-Config SQLite (WAL Mode)** |

---

## 3. Core Capabilities

### ⚡ Deterministic 10-Stage Pipeline Engine
Every release transitions through a deterministic sequence from Preflight Validation to Source Synchronization, Image Build, Staging Startup, Health Probing, Cutover, Production Verification, Rollback, and Final Report.

### 📝 Declarative Pipeline Specification (`.pipra.yaml`)
Declare repository-level build parameters, preflight verification checks, staging smoke tests, and post-cutover alerts directly inside `.pipra.yaml` or `.pipra.json`.

### 🪝 Event-Driven SCM Webhook & GitOps Gateway
Listens for push and release events from GitHub and GitLab. Features cryptographic HMAC-SHA256 signature verification, branch policy filtering, and automatic pipeline triggering.

### 🛡️ Two-Person Release Promotion Gates
Enforces release governance before production cutovers. Operators review staging candidate URLs and commit diffs, authorizing cutovers under a strict Two-Person Rule with zero thread blocking.

### 📊 Native DORA Metrics & Engineering Reliability Dashboard
Computes all four standard DORA pillars (**Deployment Frequency**, **Lead Time for Changes**, **Change Failure Rate**, and **Mean Time to Recovery**) from persistent SQLite audit history. Includes SVG trend charts and CSV/JSON export.

### 🧠 AI-Assisted Failure Diagnostics & Log Root Cause Analysis (RCA)
Automatically captures sanitized log buffers and runtime context upon pipeline failure. Produces structured root cause analyses with copyable remediation commands using deterministic heuristic analysis and optional LLM endpoints.

### 🔒 SLSA Level 2 Cryptographic Provenance Vault
Constructs in-toto / SLSA v0.2 compliant provenance attestations recording git commit hashes, builder IDs, and verification results, digitally signed with HMAC-SHA256 and verified using constant-time checks.

---

## 4. Deterministic 10-Stage Pipeline Lifecycle

```text
[1. Preflight Validation] ──> [2. Source Synchronization] ──> [3. Local Verification (Custom Preflight)]
                                                                               │
[6. Staging Health Check] <── [5. Staging Startup] <───────── [4. Docker Image Build]
         │
         ├──> [Optional: Two-Person Promotion Gate (WAITING_FOR_APPROVAL)]
         │
         ▼
[7. Production Cutover] ───> [8. Production Verification] ───> [10. Final Report & Provenance]
                                              │ (On Failure)                     │
                                              ▼                         [SLSA Level 2 Attestation]
                                [9. Automatic Rollback & Recovery]
```

---

## 5. Default Roles & Credentials

Pipra seeds default accounts upon initialization:

| Username | Role | Default Password | Permissions |
|---|---|---|---|
| `admin` | Administrator | `pipra-admin-2026` | Full platform access, environments, agents, user administration, provenance audit |
| `operator` | Deployment Operator | `pipra-ops-2026` | Trigger releases, cancel executions, approve production promotion gates |
| `viewer` | Read-Only Observer | `pipra-viewer-2026` | Read telemetry, live logs, DORA analytics, and release history |

---

## 6. Adoption Recipes & Usage Guides

### Recipe 1: Declarative Pipeline Specification (`.pipra.yaml`)

Place `.pipra.yaml` at the root of your application repository:

```yaml
version: "1.0"

# Custom preflight verification commands executed sequentially in source root
preflight:
  - npm run lint
  - command: npm audit --audit-level=high
    timeout_sec: 120
    continue_on_error: true

# Multi-stage Docker build options
build:
  dockerfile: Dockerfile.prod
  context: .
  args:
    NODE_ENV: production

# Custom smoke tests executed against candidate container before cutover
verification:
  - curl -fsS $STAGING_URL/healthz
  - npm run test:smoke -- --target=$STAGING_URL

# Post-cutover verification hooks executed against live production port
post_cutover:
  - curl -fsS $PROD_URL/api/ping
```

---

### Recipe 2: Configuring Remote Target Servers via SSH

Pipra supports agentless deployment to any Linux host over standard SSH:

1. Open **Environments** in the navigation shell.
2. Select or create an environment (e.g., `production`).
3. Set **Target Host** (e.g., `192.168.1.50`).
4. Select **Authentication Type**:
   - `SSH_KEY`: Provide your private key string or path to `.pem` key file.
   - `SSH_PASSWORD`: Provide SSH user password (encrypted at rest via AES-256-GCM).
5. Click **Test Connection**. Pipra validates connectivity and Docker version in real-time.

---

### Recipe 3: Event-Driven SCM Webhook Setup (GitHub / GitLab)

1. In Pipra, navigate to **Applications** -> Select Application -> **Settings**.
2. Enable **Event-Driven Webhook Ingestion**.
3. Copy the generated Webhook Secret and Webhook URL:
   - GitHub: `http://<pipra-host>:4200/api/webhooks/github`
   - GitLab: `http://<pipra-host>:4200/api/webhooks/gitlab`
4. In GitHub / GitLab:
   - Navigate to **Settings -> Webhooks -> Add Webhook**.
   - Paste the Payload URL and Secret Token.
   - Select Content-type: `application/json`.
   - Event trigger: `Pushes` and `Releases`.
5. Every push to an authorized branch will automatically trigger Pipra's 10-stage execution pipeline.

---

## 7. Configuration Reference

Options can be supplied via environment variables or a `.env` file in the root directory:

| Variable | Default | Description |
|---|---|---|
| `PORT` | `4200` | Port on which the Pipra control plane listens |
| `HOST` | `0.0.0.0` | Network binding interface |
| `NODE_ENV` | `development` | Runtime environment (`development`, `production`, `test`) |
| `DB_PATH` | `./data/pipra.db` | Location of the persistent SQLite database file |
| `EXEC_MODE` | `auto` | Execution mode: `auto` (Docker if present, otherwise simulation), `real`, or `sim` |
| `CRYPTO_SECRET` | *(auto-generated)* | Master key used for AES-256 credential encryption and digital signing |
| `AI_DIAGNOSTICS_ENABLED` | `false` | Enable external LLM inference for log failure diagnostics |
| `AI_ENDPOINT` | `http://localhost:11434/api/generate` | OpenAI / Ollama compatible REST endpoint |
| `AI_MODEL` | `llama3` | LLM model name for root cause analysis |
| `AI_API_KEY` | `""` | API key for external AI inference endpoint |

---

## 8. REST API Reference

### Deployments
- `GET /api/deployments` — List recent deployments with status, environment, and timing metrics.
- `POST /api/deployments` — Trigger new deployment pipeline.
- `GET /api/deployments/:id` — Retrieve detailed deployment telemetry, stages, and health probes.
- `POST /api/deployments/:id/cancel` — Cancel an active execution.
- `POST /api/deployments/:id/approve` — Authorize production cutover (Two-Person Rule).
- `POST /api/deployments/:id/reject` — Reject staging candidate and cancel deployment.
- `GET /api/deployments/:id/logs` — Fetch structured stage execution logs.
- `GET /api/deployments/:id/events` — Server-Sent Events (SSE) live telemetry stream.

### SCM Webhooks & GitOps
- `POST /api/webhooks/github` — GitHub push/release webhook ingestion endpoint.
- `POST /api/webhooks/gitlab` — GitLab push/release webhook ingestion endpoint.
- `GET /api/applications/:id/webhooks` — List webhook deliveries and status logs.
- `POST /api/applications/:id/webhooks/regenerate-secret` — Rotate application webhook secret.

### Provenance & Compliance
- `GET /api/deployments/:id/provenance` — Export SLSA in-toto attestation JSON.
- `POST /api/deployments/:id/provenance/verify` — Validate cryptographic digital signature.

### DORA Reliability Intelligence
- `GET /api/stats/dora` — Compute 4-pillar DORA metrics (`7d`, `30d`, `90d`, `all`).
- `GET /api/stats/dora/export` — Download executive summary (`format=csv` or `format=json`).

---

## 9. Testing & Quality Assurance

```bash
# Run complete test suite (87 tests)
npm test

# Run unit tests only:
npm run test:unit

# Run integration tests:
npm run test:integration
```

---

## 10. License
[MIT](LICENSE) © Anggit Arisa Siwi Pratama.
