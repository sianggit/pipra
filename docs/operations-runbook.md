# Pipra Operations Runbook & Platform Administration
**Document ID:** `docs/operations-runbook.md`  
**Product:** Pipra — Pipeline & Release Engineering Platform  
**Target Audience:** Release Engineers, System Administrators, On-Call Operators  
**Revision:** v1.0.0

---

## 1. Quick Start & Service Management

### 1.1 Starting the Pipra Control Plane
Pipra requires Node.js v26 LTS or higher.

```bash
# Install dependencies (only required on first setup)
npm install

# Start the Control Plane Server (default port: 4200)
npm start

# For development with auto-reload:
npm run dev

# Run full test suite:
npm test
```

### 1.2 Environment Configuration
Pipra can be configured via environment variables or a `.env` file in the root directory:

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `4200` | Port for Web UI & Control Plane API |
| `HOST` | `0.0.0.0` | Bind address |
| `PIPRA_DB_PATH` | `./data/pipra.db` | SQLite database file location |
| `PIPRA_EXEC_MODE` | `auto` | Execution mode: `auto` (uses Docker if present, simulation fallback), `docker`, or `sim` |
| `SESSION_SECRET` | `pipra-secret-key-change-in-prod` | Cookie signing and session token secret |
| `LOG_LEVEL` | `info` | Logging verbosity (`debug`, `info`, `warn`, `error`) |

---

## 2. Default Access Credentials

On first boot, Pipra initializes default administrator and operator accounts:

| Username | Role | Default Password | Recommended Action |
|---|---|---|---|
| `admin` | System Administrator | `pipra-admin-2026` | Change password upon first login |
| `operator` | Deployment Operator | `pipra-ops-2026` | Use for standard CI/CD operations |
| `viewer` | Read-Only Observer | `pipra-viewer-2026` | Share for monitoring and dashboards |

---

## 3. Incident Response & Troubleshooting

### 3.1 Deployment Stuck in `PREPARING` or `RUNNING`
If the host server reboots or crashes while a pipeline is running:
1. Pipra automatically detects unfinalized deployments during startup reconciliation.
2. If the deployment process has been terminated, Pipra marks the state as `INTERRUPTED` with a diagnostic note.
3. The operator can click **"Retry"** in the UI to safely rerun the pipeline from Preflight, or click **"Rollback"** to restore the previous known-good release.

### 3.2 Health Check Probes Failing (HTTP 000 / HTTP 502)
- **Symptom:** Stage 6 (Staging Health Verification) logs show retries exhausting without an acceptable HTTP code (`200`, `301`, etc.).
- **Automated Behavior:** Pipra terminates and removes the staging container. Production traffic is **never touched**.
- **Action:**
  1. Inspect the live container log output in Pipra Log Viewer under `Stage 5: Staging Startup` or `Stage 6: Health Verification`.
  2. Verify that `.env.development` or `.env.production` has correct backend API URLs and credentials.
  3. Confirm the container port matches the application's listening port (default `3000`).

### 3.3 Production Verification Fails & Automatic Rollback
- **Symptom:** Cutover completed, but Stage 8 verification returned an error.
- **Automated Behavior:** Pipra executes Stage 9 (Automatic Rollback):
  - Stops the faulty replacement container.
  - Restarts the previous container (`<name>-backup-<timestamp>`).
  - Restores production port binding.
  - Deployment status displays `FAILED` with `Rollback: SUCCESSFUL`.
- **Operator Action:**
  1. Review the failure logs in Pipra.
  2. The production site remains operational with the previous version.
  3. Fix the application bug before re-triggering deployment.

### 3.4 Concurrency Conflict (HTTP 409)
If two operators attempt to trigger a deployment to `asdp-dims-fe` on `production` simultaneously:
- The second request is rejected immediately with `HTTP 409: Deployment already active for this target`.
- Prevents Docker port and container name race conditions.
