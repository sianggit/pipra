# Pipra Security Model & Safe Execution Policy
**Document ID:** `docs/security-model.md`  
**Product:** Pipra — Pipeline & Release Engineering Platform  
**Target Environment:** Production Deployment Systems  
**Revision:** v1.0.0

---

## 1. Principles of Platform Safety

Pipra enforces strict operational boundaries to prevent arbitrary execution, unauthorized deployments, credential leaks, and system compromise.

### 1.1 Non-Negotiable Security Rules
1. **No Arbitrary Shell APIs:** The frontend never sends raw shell commands, script snippets, or uncontrolled command strings to the backend.
2. **Strict Whitelisted Operations:** All deployment stages execute strictly parameterized, predefined commands (`git`, `docker`, health probe HTTP requests).
3. **Safe Parameter Validation:** Every input parameter (branch names, image tags, container names, ports, file paths) is validated against strict alphanumeric and character regex allowlists before execution.
4. **Real-time Secret Redaction:** Secret keys, environment variables, authentication bearer tokens, passwords, and SSH private keys are sanitized and replaced with `[REDACTED]` before emission to logs, SSE channels, or database storage.
5. **No Secret Return over API:** Stored environment secrets or private configurations are never sent back in API responses.

---

## 2. Authentication & Authorization (RBAC)

Pipra implements session-based authentication with cryptographically random tokens (or Bearer auth) and strict server-side RBAC validation on every mutation.

### 2.1 Role Hierarchy

| Role | Permissions |
|---|---|
| **Admin** | Full system control: Manage users, create/edit/delete applications, register execution agents, configure security policies, trigger and rollback deployments in all environments, view audit logs. |
| **Operator** | Deployment operations: Trigger deployments, cancel running pipelines, trigger rollbacks, inspect detailed execution logs, view environment health. Cannot modify global security policies or manage user accounts. |
| **Viewer** | Read-only observation: View dashboards, execution timelines, deployment history, and metrics. Cannot trigger or alter deployments. |

### 2.2 Environment Protection Gates
- **Production Confirmation Barrier:** Initiating a deployment or rollback to an environment marked `is_production: true` requires:
  - An explicit confirmation payload (`confirm_production: true`).
  - Active `operator` or `admin` credentials.
- **Concurrency Locks:** Only one active deployment may execute against an `(application_id, environment_id)` pair at a time. Conflicting requests return HTTP `409 Conflict`.

---

## 3. Command Execution & Process Isolation

### 3.1 Input Sanitation Rules

| Parameter | Allowed Pattern | Violation Action |
|---|---|---|
| `branch` | `^[a-zA-Z0-9_\-\./]+$` (no `..`, no `;`, no `&`, no `\|`) | Reject with HTTP 400 |
| `tag` | `^[a-zA-Z0-9_\-\.]+$` | Reject with HTTP 400 |
| `container_name` | `^[a-zA-Z0-9_\-]+$` | Reject with HTTP 400 |
| `host_port` | Integer between `1024` and `65535` | Reject with HTTP 400 |
| `env_file` | Relative path with `.env` extension, no directory traversal (`..`) | Reject with HTTP 400 |

### 3.2 Process Execution Guarantees
- Commands are executed using child process spawn with argument arrays (e.g. `['docker', 'build', ...]`) rather than concatenated shell strings where possible.
- Execution timeouts: Every stage enforces an upper execution limit (e.g., Docker build max 15 minutes, health check max 2 minutes).
- Graceful termination: Cancellation attempts issue `SIGTERM` followed by a controlled grace window before issuing `SIGKILL` to prevent orphaned Docker containers.

---

## 4. Audit Logging

Every consequential action is permanently recorded in the `audit_logs` table:
- User ID and username
- IP Address and User Agent
- Action type (`DEPLOY_TRIGGERED`, `DEPLOY_CANCELLED`, `ROLLBACK_TRIGGERED`, `APP_UPDATED`, `USER_LOGIN`)
- Target resource ID and environment
- Timestamp and payload summary (excluding redacted credentials)
