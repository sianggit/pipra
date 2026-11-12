# Pipra .reference Directory Index & Governance Blueprint

This directory serves as the centralized knowledge repository, AI assistant rulebook, evidence ledger, system configuration hub, and architectural standard for **Pipra — Pipeline & Release Engineering Platform**.

---

## 1. Universal Naming Standard

All documentation, specifications, and plans within `.reference` MUST strictly follow the ASDP Universal Naming Standard:

```text
YYYY-MM-DD_[Project-or-Context]_[Document-Name]_v[X.X].[ext]
```

### Components
1. **`YYYY-MM-DD`**: Mandatory ISO date string representing document creation or major revision date.
2. **`[Project-or-Context]`**: Context boundary (`Standard`, `Pipra`, `System`, `Prompts`).
3. **`[Document-Name]`**: Hyphenated descriptive title (e.g., `Architecture`, `Security-And-Auth`).
4. **`_v[X.X]`**: Version tag (`v1.0`, `v2.0`).
5. **`.[ext]`**: File extension (`.md`, `.json`, `.js`, etc.).

---

## 2. Directory Structure & Inventory

```text
.reference/
├── _index.md                             # Master Governance Index & System Blueprint
├── antislop.md                           # Anti-Slop Core Filter (v3.2.20)
├── index.html                            # Developer Documentation Portal SPA
├── portal/                               # Documentation Portal Engine & Search Crawler
│   ├── app.css                           # Portal SPA styling & design tokens
│   ├── app.js                            # Portal client SPA router & markdown engine
│   ├── build.js                          # Reference crawler & doc index builder
│   ├── gateway.js                        # Control plane documentation server
│   ├── docs-manifest.json                # Navigation & full-text search manifest
│   └── docs-data.js                      # Compiled document payload
├── docs/                                 # Authoritative Project Documentation
│   ├── installation/                     # System Setup, Script Integrations & Runbooks
│   │   └── 2026-10-31_System_Manual-Deployment-Script-Setup-And-Pipra-User-Manual_v1.0.md
│   ├── standard/                         # Engineering, UI, and Architectural Standards
│   │   ├── 2026-10-28_Standard_architecture_v1.0.md
│   │   ├── 2026-10-28_Standard_security-and-auth_v1.0.md
│   │   ├── 2026-10-28_Standard_ui-design-system_v1.0.md
│   │   ├── 2026-10-28_Standard_deployment-lifecycle_v1.0.md
│   │   ├── 2026-10-28_Standard_api-and-sse_v1.0.md
│   │   └── 2026-10-28_Standard_operations-runbook_v1.0.md
│   └── modules/                          # Per-Subsystem Specifications & Plans
│       ├── engine/                       # Execution Engine & State Machine
│       │   └── development-plan/
│       │       ├── 2026-10-28_Pipra_Execution-Engine-Plan_v1.0.md
│       │       ├── 2026-10-31_Execution_Multi-App-Hierarchical-Environments-And-Remote-SSH-Execution-Plan_v1.0.md
│       │       ├── 2026-11-12_Execution_Page-Transition-And-Deployment-Telemetry-Enhancement_v1.0.md
│       │       ├── 2026-11-12_Execution_Git-Workspace-Permission-And-SSH-Auth-Remediation_v1.0.md
│       │       ├── 2026-11-12_Execution_ASYST-Website-And-CMS-v3-Pipra-Adoption-Plan_v1.0.md
│       │       ├── 2026-11-12_Execution_Pipra-Distribution-Architecture-And-ISO27002-Analysis_v1.0.md
│       │       └── 2026-11-12_Execution_Pipra-Dual-Track-Distribution-Implementation-Plan_v1.0.md
│       ├── control-plane/                # API Routes & Database Subsystem
│       │   ├── api-spec/2026-10-28_Pipra_Control-Plane-API-Spec_v1.0.md
│       │   └── development-plan/
│       │       ├── 2026-10-31_Control-Plane_Session-Plan-Clean-Slate-Database-Flush_v1.0.md
│       │       ├── 2026-11-12_Control-Plane_Session-Plan-User-And-Role-Management-RBAC_v1.0.md
│       │       └── 2026-11-12_Control-Plane_Session-Plan-Pipra-ISO27001-Security-Hardening-And-Compliance_v1.0.md
│       └── ui-portal/                    # Frontend Vanilla ES Modules & SSE Hub
│           └── development-plan/
│               ├── 2026-10-28_Pipra_UI-Portal-Plan_v1.0.md
│               ├── 2026-10-28_Pipra_UI-Design-System-Audit_v1.0.md
│               ├── 2026-10-29_UI-Portal_Session-Plan-Design-System-Light-Theme_v1.0.md
│               ├── 2026-10-30_UI-Portal_Session-Plan-Client-Gating-And-Configurable-Host_v1.0.md
│               ├── 2026-10-30_UI-Portal_Session-Plan-UI-Design-Refinement-And-Mockup-Alignment_v1.0.md
│               └── 2026-10-31_UI-Portal_Session-Plan-Full-Lifecycle-Application-And-Environment-CRUD_v1.0.md
├── prompts/                              # AI Assistant Canonical Session Prompts (v2.0)
│   ├── 2026-10-04_Prompts_Project-Bootstrap-And-Reference-Initialization_v2.0.md
│   ├── 2026-10-04_Prompts_Feature-Development-Session-Starter_v2.0.md
│   ├── 2026-10-04_Prompts_Feature-Development-Session-Closer_v2.0.md
│   ├── 2026-10-04_Prompts_Bug-Fixing-Session-Starter_v2.0.md
│   ├── 2026-10-04_Prompts_Bug-Fixing-Session-Closer_v2.0.md
│   └── 2026-10-04_Prompts_Mid-Session-Crash-Recovery_v2.0.md
└── system/                               # Centralized System Storage & AI Tooling
    ├── agents/                           # Agent Rules & Skills (Bridged to root .agents/)
    │   ├── rules/
    │   │   ├── antislop.md               # Anti-Slop Core Behavioral Rules
    │   │   └── codebase-memory.md        # CBM MCP Prioritization Rules
    │   └── skills/
    │       ├── antislop/                 # Anti-Slop Core Filter Skill
    │       ├── antislop-code/            # Code Comment Hygiene Skill
    │       ├── antislop-copywriting/     # Copy & Error Messaging Skill
    │       ├── antislop-human/           # WCAG Contrast & Keyboard Accessibility
    │       ├── antislop-layoutmobile/    # Responsive Mobile Reflow Skill
    │       └── antislop-ui/              # High-density Dark UI Skill
    ├── configs/                          # Codebase Memory & Linter Configs
    │   ├── .codebase-memory.json
    │   └── .cbmignore
    ├── codebase-memory/                  # Canonical AST Knowledge Graph (graph.db.zst)
    └── scripts/                          # System Bridging & Maintenance Automation
```

---

## 3. Anti-Slop AI Quality Filter v3.2.20

Pipra incorporates the full Anti-Slop suite. AI coding assistants operating on this codebase must adhere to the two usage modes and enforce strict accessibility, contrast, and code comment cleanliness standards.

- **Status Check:** `node scripts/ref.js antislop status`
- **Delivery Gate Verification:** `node scripts/ref.js antislop verify`
- **Core Rules:** Documented in [antislop.md](file:///D:/Anggit%20Arisa%20Siwi%20Pratama/ASYST/Development/tools/pipra/.reference/antislop.md) and bridged to `.agents/rules/antislop.md`.

---

## Changelog

### [v1.5.0] - 2026-11-12
- **User & Role Management (Basic RBAC) & Read-Only Viewer (Observer) Persona (PIPRA-601..604)**:
  - **Auth & Session Service (`src/auth/auth-service.js`)**: Implemented full User CRUD (`listUsers`, `createUser`, `updateUserRole`, `resetUserPassword`, `deleteUser`) with scrypt password hashing, parameter allowlisting, dynamic session role synchronization in `sessions` table, and forced session invalidation on password reset.
  - **Security Boundaries & Safety Guards**: Implemented self-deletion lockout (active admin cannot delete their own account) and last-admin protection (system prevents deleting or demoting the final administrator).
  - **Control Plane API Routes (`src/routes/user-routes.js`, `server.js`)**: Added `/api/users` REST endpoints (`GET`, `POST`, `PATCH /role`, `PATCH /password`, `DELETE`) strictly guarded by `admin` role with consequential compliance logging into `audit_logs` table (`USER_CREATED`, `USER_ROLE_UPDATED`, `USER_PASSWORD_RESET`, `USER_DELETED`).
  - **Audit Route Hardening (`src/routes/audit-routes.js`)**: Guarded `GET /api/audit-logs` to restrict access strictly to `admin` accounts.
  - **Admin UI Console Overhaul (`public/js/pages/admin-page.js`)**: Transformed `#/admin` into a segmented dual-tab interface (`Users & Access` and `Audit Trail`). Added user inventory table with avatars, role badges, active session counts, and accessible modal dialogs for provisioning accounts, role editing, password resets, and deletions. Embedded comprehensive RBAC capability reference matrix.
  - **Read-Only Viewer (Observer) Experience (`public/js/auth.js`, `public/js/components/nav-shell.js`, `public/js/router.js`)**: Added `isAdmin()` and `canManageUsers()` helpers. Hidden administrative links from primary navigation for non-admins, guarded `#/admin` with accessible access-restriction cards, and suppressed mutation controls across app and deployment pages while preserving live monitoring, log streaming (SSE), SLSA provenance verification, and DORA analytics.
  - **Automated Test Coverage**: Added `test/unit/user-management.test.js` and `test/integration/user-rbac-routes.test.js`, expanding automated test suite to 95 passing tests with 0 failures.

### [v1.2.1] - 2026-10-31
- **Remote SSH Authentication, Dynamic Branch Policy & Deployment Contract Normalization (PIPRA-BUG-501, 502 & 503)**:
  - **Vaulted SSH Password & Key Execution (`src/engine/execution-driver.js`)**: Built unified `resolveSshInvocation(env, command)` detecting `plink.exe` (Windows) and `sshpass` (Linux) for `SSH_PASSWORD`, and generating ephemeral identity files with strict `0600` permissions and `finally` cleanup for `SSH_KEY`. Eliminated hardcoded OpenSSH `-o BatchMode=yes`.
  - **Direct Process Execution (`execFileSync`)**: Switched synchronous commands to `execFileSync` to avoid shell stripping of special characters (e.g. `^`, `&`, `%`) in complex passwords.
  - **Dynamic Branch Validation (`public/js/pages/wizard-page.js`)**: Eliminated hardcoded regular expressions and conflicting `develop` vs `devel` branches in Wizard Step 2. Bound validation and hints dynamically to `currentApp.permitted_branches`.
  - **Backend Branch Guard (`src/routes/deployment-routes.js`)**: Enforced `isBranchPermitted(branch, app.permitted_branches)` in `POST /api/deployments` to guard against unauthorized branch launches.
  - **Payload Contract Normalization (`src/routes/deployment-routes.js`, `public/js/pages/wizard-page.js`)**: Resolved `tag || image_tag`, `confirm_production || operator_confirmed`, and `enable_local_verification || verify_on_host` aliases on both client and API routes to ensure forward and backward contract resilience.
  - **SQLite WAL Concurrency Hardening (`src/db/database.js`)**: Configured `PRAGMA busy_timeout = 5000;` on native SQLite connections to eliminate multi-process lock contention during high-concurrency test runs and background pipelines.
  - **Credential Redaction (`src/utils/sanitizer.js`)**: Added `-pw <password>` masking in `redactSecrets` to prevent credential leaks into logs or UI error dialogs.
  - **Automated Test Coverage**: Added dedicated unit suite `test/unit/ssh-execution-driver.test.js` bringing total unit tests to 45/45 passing with 0 jscpd clones and 100% anti-slop compliance.

### [v1.2.0] - 2026-10-30
- **Control Plane UI Design Refinement & Mockup Alignment (PIPRA-401..406)**:
  - Aligned core color tokens and surface hierarchy in `public/css/tokens.css` with master HTML mockup (`--bg: #080B12`, `--sf: #101722`, `--sr: #151F2D`, `--ss: #0D131D`, `--in: #0B111B`, `--bd: #283446`, `--pr: #6EA8FE`, status tokens) with 100% WCAG 2.2 AA compliance.
  - Implemented cohesive utility class system in `public/css/components.css` (`.pn`, `.ph`, `.pb`, `.strip`, `.att`, `.rail`, `.rc`, `.tl`, `.st`, `.bar`, `.log`, `.cols`, `.sr`, `.stp`, `.seg`, `.wz`, `.grd`, `.meter`, `.empty`, `.chips`, `.chip`, `.ctx`, `.ib`, `.usr`, `.num`, `.mono`, `.b`, `.env`).
  - Refined sticky 52px navigation shell (`public/js/components/nav-shell.js`) with compact Pipra bird mark (26px) + wordmark (17px), active bottom underline indicator (`aria-current="page"`), context badge (`.ctx`), user pill (`.usr`), and icon buttons (`.ib`).
  - Redesigned overview operational cockpit (`public/js/pages/overview-page.js`) featuring 4-cell metric strip (`.strip`), red-accented needs-attention banner (`.att`) with rollback status, horizontal promotion rail (`.rail`), and 2-column recent runs / execution agents grid (`.g2`).
  - Upgraded deployments history (`public/js/pages/history-page.js`) with real-time multi-criteria filter toolbar (`.sr`), tabular numeric columns, status pill badges, and dedicated empty state.
  - Extended pipeline visualizer (`public/js/components/pipeline-timeline.js`) with proportional multi-segment duration bar (`.bar`) and 10-stage interactive button grid (`.tl`).
  - Upgraded terminal log viewer (`public/js/components/log-viewer.js`) into 4-column structured monospace grid with dynamic stage isolation filtering, line counter, and copy-to-clipboard.
  - Refactored deployment detail page (`public/js/pages/deployment-detail.js`) into 2-column layout (`.cols`) connecting release verification, revision definition list, health probes table, and stage-filtered terminal log.
  - Redesigned 3-step deployment wizard (`public/js/pages/wizard-page.js`) with progress stepper (`.stp`), 2-column layout (`.wz`) with persistent summary aside (`aside.pn`), segmented environment picker (`.seg`), branch regex validation, and production cutover safeguard confirmation barrier (`.grd`).
  - Re-aligned applications (`apps-page.js`), environments (`envs-page.js`), infrastructure (`infra-page.js`), and admin audit log (`admin-page.js`) with definition lists, capacity meters, and prototype account chips.
  - Maintained 100% test pass rate (26/26 unit tests in `test/unit/theme-tokens.test.js`).
  - Regenerated all 18 full-page automated screenshots in `docs/screenshot/` across Dark and Light themes with zero errors or timeouts.

### [v1.1.0] - 2026-10-29
- **Design System Light Theme & Flexible Palette Architecture**:
  - Implemented complete `:root[data-theme="light"]` token palette in `public/css/tokens.css` with 1:1 token parity across all 36 design tokens.
  - Verified 100% WCAG 2.2 AA contrast compliance using `contrast-check.py` across all text, border, and status combinations ($17.85:1$ text primary, $7.58:1$ secondary, $5.02:1$ success, $5.91:1$ danger, $4.58:1$ warning, $6.70:1$ focus ring).
  - Built autonomous `public/js/theme.js` controller handling `localStorage` persistence, DOM attributes, and system `prefers-color-scheme` listeners.
  - Injected anti-FOUC pre-render script in `public/index.html` guaranteeing 0ms theme flicker on page load.
  - Extended `public/js/icons.js` with `sun` and `moon` SVG glyphs.
  - Integrated accessible theme toggles into navigation shell `public/js/components/nav-shell.js` and login view `public/js/pages/admin-page.js`.
  - Integrated production brand assets: `public/assets/logo-navy-tagline.png` (light mode), `public/assets/logo-white.png` (dark nav), `public/assets/logo-white-tagline.png` (login/pre-hydration), and binary `public/assets/favicon.ico`.
  - Configured login page brand logo with responsive `height: auto` and dynamic theme asset switching.
  - Retained dedicated dark viewport (`#000000`) for terminal ANSI log output across both themes.
  - Added automated test suite `test/unit/theme-tokens.test.js` bringing total unit tests to 20/20 passing.
  - Formulated Session Plan `docs/modules/ui-portal/development-plan/2026-10-29_UI-Portal_Session-Plan-Design-System-Light-Theme_v1.0.md` with complete Matrix DUP and verification gates.

### [v1.0.0] - 2026-10-28
- **Initial Pipra .reference Architecture & Governance Setup**:
  - Initialized framework-agnostic `.reference` documentation infrastructure, crawler, and portal engine.
  - Migrated platform specifications to Universal Naming Standard: architecture, security & auth, UI design system, deployment lifecycle, API & SSE, operations runbook.
  - Established sub-module documentation under `docs/modules/` for Execution Engine, Control Plane, and UI Portal.
  - Installed and integrated Anti-Slop AI Quality Filter v3.2.20 with all 6 skills and WCAG contrast tooling.
  - Created single source of truth system bridges (.agents, .codebase-memory, .vscode) via NTFS junctions and hardlinks.
  - Registered Pipra into Central Hub registry.

