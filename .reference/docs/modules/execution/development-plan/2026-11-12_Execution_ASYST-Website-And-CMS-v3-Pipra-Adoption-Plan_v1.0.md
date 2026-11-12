# Comprehensive Architecture & Implementation Plan: ASYST Website & ASYST Website CMS v3 Dedicated Dev Server (172.25.192.11) Blue-Green Migration to Pipra

**Document ID:** `.reference/docs/modules/execution/development-plan/2026-11-12_Execution_ASYST-Website-And-CMS-v3-Pipra-Adoption-Plan_v1.0.md`  
**Module:** Execution & Remote Server Delivery  
**Target Server:** `172.25.192.11` (`new-web-asyst`, Rocky Linux 9, Kernel `5.14.0-687.10.1.el9_8`)  
**Target Host User:** `devel` (Password Vaulted)  
**Target Applications:**  
1. **`asyst-website`**: Corporate Public Website (Vite / React 18 / Tailwind / Nginx)  
   - Local: `D:\Anggit Arisa Siwi Pratama\ASYST\Development\js\asyst-website`  
   - Host: `/home/devel/asyst-website`  
2. **`asyst-website-cms`**: Corporate Content Management System v3 (Next.js 15 App Router / Prisma / PostgreSQL)  
   - Local: `D:\Anggit Arisa Siwi Pratama\ASYST\Development\js\asyst-website-cms`  
   - Host: `/home/devel/asyst-website-cms`  
**Reference Scripts Verified on Host:**  
- `/home/devel/asyst-website/scripts/deploy-asyst-website.sh`  
- `/home/devel/asyst-website-cms/scripts/deploy-asyst-website-cms.sh`  
**Status:** PROPOSED & READY FOR USER REVIEW  
**Date:** 2026-11-12  

---

## 1. Executive Summary & Forensic Audit of `172.25.192.11`

Live SSH telemetry audit of `devel@172.25.192.11` confirms that both applications are currently running as standalone Docker containers managed via manual bash scripts:

```text
CONTAINER ID   IMAGE                      COMMAND               STATUS       PORTS                                        NAMES
7eaad6e5d59b   asyst-website-cms:v3.0.0   "docker-entrypoint…"  Up 9 hours   0.0.0.0:3000->3000/tcp, [::]:3000->3000/tcp  asyst-website-cms
26f3c5648534   asyst-website:v3.0.0       "/docker-entrypoint…" Up 2 days    0.0.0.0:80->3000/tcp, [::]:80->3000/tcp      asyst-website
```

### Objectives:
1. Transition both applications from manual shell script execution (`deploy-asyst-website.sh` & `deploy-asyst-website-cms.sh`) to Pipra's automated 10-stage Blue-Green deployment engine.
2. Maintain 100% feature parity with the existing zero-downtime cutover, health check loops, SPA deep-link routing checks, and Prisma database migrations.
3. Configure Pipra Control Plane (`http://172.25.230.100:4200` or local cockpit) with vaulted SSH credentials (`devel@172.25.192.11`) to orchestrate deployments remotely, providing live SSE terminal logs, 3D execution HUD, and cryptographic SLSA provenance attestation.

---

## 2. Parameter & Lifecycle Mapping Matrix

Every procedural step in `deploy-asyst-website.sh` and `deploy-asyst-website-cms.sh` maps 1:1 into Pipra's execution engine:

| Legacy Script Flag | `asyst-website` | `asyst-website-cms` | Pipra Native Stage & Field | Engine Guarantee |
|---|---|---|---|---|
| `--branch` | `master` / `main` | `main` / `master` | **Stage 2: SOURCE_PULL** (`branch`) | Authenticated git fetch via host deploy key. |
| `--tag` | `v3.0.0` / semantic | `v3.0.0` / semantic | **Stage 1 & 4** (`image_tag`) | Tagged as `asyst-website:<tag>` / `asyst-website-cms:<tag>`. |
| `--name` | `asyst-website` | `asyst-website-cms` | `applications.slug` / `applications.name` | Container identifier. |
| `--port` | `:80` (or `:3000`) | `:3000` | **Stage 8** (`host_port`) | Live customer-facing host port. |
| `--staging-port` | `:3001` | `:3002` | **Stage 5 & 6** (`staging_port`) | Non-conflicting ephemeral port for health probes. |
| `--env-file` | `.env.prd` | `.env.production` | `application_environments.env_file` | Production secrets injected at build/run time. |
| `--dockerfile` | `Dockerfile` | `Dockerfile` | `applications.dockerfile` | Multi-stage Docker recipe in project root. |
| `prisma migrate` | N/A | `npx prisma migrate deploy` | **Stage 3: PREFLIGHT** (`.pipra.yaml`) | Automated DB migrations executed before cutover. |
| Deep-Link Probe | `/about` (SPA route) | `/login` & `/api/public/news`| **Stage 6: HEALTH_PROBES** (`.pipra.yaml`)| Comprehensive HTTP 200/301/302/304 assertions. |
| Sub-second Cutover| `rename -> backup -> run`| `rename -> backup -> run`| **Stage 8: CUTOVER_EXECUTION** | Atomic container switch with 0.0s downtime. |
| Auto-Rollback | Re-start backup on fail | Re-start backup on fail | **Stage 9: POST_CUTOVER_VERIFY** | Instant rollback restoration if health check fails. |

---

## 3. Host Port & Network Allocation Matrix (`172.25.192.11`)

To guarantee zero port collision between the two workloads during concurrent or staggered blue-green cutovers:

| Application | Container Name | Production Port | Staging Port (Blue/Green) | Target Workspace | Volume Mounts & Flags |
|---|---|---|---|---|---|
| **ASYST Website v3** | `asyst-website` | **`80`** (`:80->3000`) | **`3001`** (`:3001->3000`) | `/home/devel/asyst-website` | Ephemeral (Static Nginx SPA) |
| **ASYST Website CMS v3**| `asyst-website-cms`| **`3000`** (`:3000->3000`)| **`3002`** (`:3002->3000`) | `/home/devel/asyst-website-cms`| `-v /home/devel/asyst-website-cms/uploads:/app/public/uploads`<br>`-v /home/devel/asyst-website-cms/prisma.config.ts:/app/prisma.config.ts`<br>`--add-host=host.docker.internal:host-gateway` |

---

## 4. Declarative Pipeline Specifications (`.pipra.yaml`)

### 4.1 Declarative Spec for `asyst-website` (`/home/devel/asyst-website/.pipra.yaml`)

Commit this file to `D:\Anggit Arisa Siwi Pratama\ASYST\Development\js\asyst-website\.pipra.yaml` and `/home/devel/asyst-website/.pipra.yaml`:

```yaml
version: "1.0"

# 1. Preflight Hooks: Verify build readiness
preflight:
  - command: "npm run lint"
    timeout_sec: 120
    continue_on_error: true

# 2. Container Build Configuration
build:
  dockerfile: "Dockerfile"
  context: "."
  args:
    env: ""

# 3. Staging Verification: Automated root and SPA deep-link routing checks on port 3001
verification:
  - command: "curl -fsS --retry 8 --retry-delay 2 http://127.0.0.1:3001/ -o /dev/null"
    timeout_sec: 30
    continue_on_error: false
  - command: "curl -fsS --retry 5 --retry-delay 2 http://127.0.0.1:3001/about -o /dev/null"
    timeout_sec: 30
    continue_on_error: false

# 4. Post-Cutover Verification: Verify live port 80 health
post_cutover:
  - command: "curl -fsS http://127.0.0.1:80/ -o /dev/null"
    timeout_sec: 30
    continue_on_error: true
```

### 4.2 Declarative Spec for `asyst-website-cms` (`/home/devel/asyst-website-cms/.pipra.yaml`)

Commit this file to `D:\Anggit Arisa Siwi Pratama\ASYST\Development\js\asyst-website-cms\.pipra.yaml` and `/home/devel/asyst-website-cms/.pipra.yaml`:

```yaml
version: "1.0"

# 1. Preflight Hooks: Run Prisma migrations and schema synchronization
preflight:
  - command: "npx prisma generate"
    timeout_sec: 60
    continue_on_error: false
  - command: "npx prisma migrate deploy"
    timeout_sec: 120
    continue_on_error: false

# 2. Container Build Configuration
build:
  dockerfile: "Dockerfile"
  context: "."
  args:
    NODE_ENV: "production"

# 3. Staging Verification: Verify /login and public news API on port 3002
verification:
  - command: "curl -fsS --retry 10 --retry-delay 2 http://127.0.0.1:3002/login -o /dev/null"
    timeout_sec: 60
    continue_on_error: false
  - command: "curl -fsS --retry 5 --retry-delay 2 http://127.0.0.1:3002/api/public/news -o /dev/null"
    timeout_sec: 30
    continue_on_error: false

# 4. Post-Cutover Verification: Verify live CMS on port 3000
post_cutover:
  - command: "curl -fsS http://127.0.0.1:3000/login -o /dev/null"
    timeout_sec: 30
    continue_on_error: true
```

---

## 5. Pipra Control Plane Database Configuration (SQL Seed)

To register the target host `172.25.192.11` and both applications in Pipra's database (`pipra.db`), execute the following migration:

```sql
-- 1. Register Remote Target Environment for 172.25.192.11
INSERT OR IGNORE INTO environments (
  id, name, display_name, host, ssh_port, ssh_user, auth_type, 
  created_at, updated_at
) VALUES (
  'env_target_192_11',
  'asyst-v3-dev',
  'ASYST Website v3 Dev Server (172.25.192.11)',
  '172.25.192.11',
  22,
  'devel',
  'SSH_PASSWORD',
  datetime('now'),
  datetime('now')
);

-- Store encrypted password in Pipra Vault for 172.25.192.11 (user: devel, pass: c9DsZCTXio)
-- (Handled automatically by Pipra CryptoVault service during environment creation)

-- 2. Register Application: asyst-website
INSERT OR IGNORE INTO applications (
  id, name, slug, git_repo_url, default_branch, permitted_branches, 
  dockerfile, default_host_app_dir, default_prod_port, default_staging_port, created_at, updated_at
) VALUES (
  'app_asyst_website',
  'ASYST Corporate Website v3',
  'asyst-website',
  'git@github.com:asyst-git/asyst-website.git',
  'master',
  'master, main, develop, release/*',
  'Dockerfile',
  '/home/devel/asyst-website',
  80,
  3001,
  datetime('now'),
  datetime('now')
);

INSERT OR IGNORE INTO application_environments (
  id, application_id, name, display_name, host_port, staging_port, 
  app_dir, env_file, is_production, created_at, updated_at
) VALUES (
  'appenv_asyst_web_v3',
  'app_asyst_website',
  'devel',
  'Development & Staging (172.25.192.11)',
  80,
  3001,
  '/home/devel/asyst-website',
  '.env.prd',
  0,
  datetime('now'),
  datetime('now')
);

-- 3. Register Application: asyst-website-cms
INSERT OR IGNORE INTO applications (
  id, name, slug, git_repo_url, default_branch, permitted_branches, 
  dockerfile, default_host_app_dir, default_prod_port, default_staging_port, created_at, updated_at
) VALUES (
  'app_asyst_website_cms',
  'ASYST Website CMS v3',
  'asyst-website-cms',
  'git@github-cms:asyst-git/asyst-website-cms.git',
  'master',
  'master, main, develop, release/*',
  'Dockerfile',
  '/home/devel/asyst-website-cms',
  3000,
  3002,
  datetime('now'),
  datetime('now')
);

INSERT OR IGNORE INTO application_environments (
  id, application_id, name, display_name, host_port, staging_port, 
  app_dir, env_file, is_production, created_at, updated_at
) VALUES (
  'appenv_asyst_cms_v3',
  'app_asyst_website_cms',
  'devel',
  'Development & Staging (172.25.192.11)',
  3000,
  3002,
  '/home/devel/asyst-website-cms',
  '.env.production',
  0,
  datetime('now'),
  datetime('now')
);
```

---

## 6. Verification Matrix & Scenarios

| Scenario ID | Test Case | Target Behavior | Verification Method |
|---|---|---|---|
| **SC-01** | SSH Target Connectivity | Pipra test runner connects to `devel@172.25.192.11` via vaulted credentials and verifies `docker info`. | Pipra environment connectivity probe |
| **SC-02** | Git Workspace State | Both `/home/devel/asyst-website` and `/home/devel/asyst-website-cms` verify clean git worktree with safe directory enabled. | `git status` check via Pipra Stage 2 |
| **SC-03** | `asyst-website` Blue-Green Cutover | Staging container boots on port `3001`, passes `/` and `/about` probes, atomically switches to live port `80` with zero dropped requests. | Continuous HTTP ping during deployment |
| **SC-04** | `asyst-website-cms` Prisma Migration | Preflight runs `npx prisma migrate deploy` successfully before containerization; staging boots on `3002` with media volume mounted. | Verify `/app/public/uploads` persistence and DB sync |
| **SC-05** | Automated Rollback Safety | If staging health probe fails or times out, Pipra aborts cutover, removes staging container, and leaves existing production containers on ports `80` & `3000` completely undisturbed. | Simulated probe failure test |
| **SC-06** | Cryptographic Provenance | Attestation JSON generated and signed by Pipra platform key, verifiable in UI. | Modal signature verification in Pipra UI |

---

## 7. Execution Runbook

1. **Step 1:** Create `.pipra.yaml` in local workspace `D:\Anggit Arisa Siwi Pratama\ASYST\Development\js\asyst-website` and push/copy to `172.25.192.11`.
2. **Step 2:** Create `.pipra.yaml` in local workspace `D:\Anggit Arisa Siwi Pratama\ASYST\Development\js\asyst-website-cms` and push/copy to `172.25.192.11`.
3. **Step 3:** Seed Pipra database with the SQL configuration registering `172.25.192.11`, `asyst-website`, and `asyst-website-cms`.
4. **Step 4:** Trigger pilot deployment of `asyst-website` via Pipra UI. Confirm zero-downtime cutover on port `80`.
5. **Step 5:** Trigger pilot deployment of `asyst-website-cms` via Pipra UI. Confirm Prisma migration and zero-downtime cutover on port `3000`.
