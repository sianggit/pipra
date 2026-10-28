# PIPRA — ULTIMATE ANTIGRAVITY IMPLEMENTATION PROMPT
## Self-Hosted Pipeline, Deployment & Release Engineering Platform

**Role:** Principal Platform Engineer, Senior DevOps Engineer, Staff Software Architect, Application Security Engineer, Senior Product Designer, and QA Automation Lead.

**Execution mode:** Autonomous repository investigation, architecture design, implementation, integration, testing, and delivery.

**Primary objective:** Transform the existing manual ASDP DIMS frontend deployment process into a production-oriented, self-hosted deployment management platform with Jenkins-level workflow capabilities, a premium operator experience, secure execution, deployment observability, health verification, and dependable rollback.

**Product name:** Pipra  
**Product descriptor:** Pipeline & Release Engineering Platform  
**Brand concept:** Pipeline + a subtle bird-like identity.  
**Tagline:** Build with confidence. Ship with control.

**Non-negotiable:** Do not stop at a proposal, technical design, static mockup, or list of recommendations. Inspect the existing repository, establish the real architecture, implement the application, run the available tests, fix discovered issues, and document the working result. Do not claim functionality that has not been implemented and verified.

---

# 1. PRODUCT VISION AND BRAND IDENTITY

Build **Pipra** as a self-hosted pipeline and release engineering platform that transforms manual deployment scripts into a complete, observable, secure, and reusable workflow.

Pipra must let authorized operators configure applications, initiate deployments, monitor real-time execution, inspect logs, verify releases, investigate failures, and perform controlled recovery through a web interface.

The execution engine must run independently of the browser session. Refreshing the page, closing a tab, losing a connection, or restarting the UI must not silently terminate an active deployment.

Pipra must be a real operational system, not a dashboard-only demonstration.

## 1.1 Brand positioning

Pipra combines two ideas:

- **Pipeline:** structured execution, orchestration, automation, and predictable release workflows.
- **Bird-like identity:** agility, precision, direction, movement, and a recognizable silhouette.

The bird concept must be subtle and sophisticated. Do not turn the product into a bird game, mascot-driven consumer app, or cartoon-themed interface.

The product should feel like a premium engineering tool used daily by developers, release engineers, QA engineers, and infrastructure operators.

### Brand principles

- Short, recognizable product name.
- Technical and professional presentation.
- Restrained geometric bird-inspired symbol.
- Strong wordmark readability at small sizes.
- Distinctive icon suitable for a sidebar, browser favicon, and application launcher.
- A visual identity that scales from a single deployment application to a broad orchestration platform.

### Brand implementation rules

- Use `Pipra` as the product name throughout the UI and product documentation.
- Use `Pipeline & Release Engineering Platform` as the product descriptor where a descriptive label is useful.
- Use `Build with confidence. Ship with control.` as the primary tagline where appropriate, not as repeated decorative copy on every screen.
- Replace every new product-facing reference to `Shipwright` with `Pipra`.
- Audit existing references before changing them. Do not blindly rename unrelated third-party dependencies, repository identifiers, application names, Docker image names, deployment paths, or infrastructure resources.
- Preserve `asdp-dims-fe` and other existing application identifiers unless an explicit technical requirement calls for a change.
- Do not rename the Git repository or package unless necessary and explicitly documented.
- Do not claim that the name, domain, trademark, or package namespace is available without verification.

## 1.2 Logo and visual identity

Create a restrained, original vector logo that evokes a bird through abstract geometry and forward motion.

Preferred visual direction:

- Minimal geometric silhouette.
- Angular or flowing feather-inspired forms.
- A subtle forward-facing or upward motion.
- Clear negative space.
- Monochrome-first design.
- Legibility at 16–32 pixels.
- Consistent appearance on dark and light surfaces.
- A wordmark that pairs naturally with the symbol.

Avoid:

- Cartoon birds.
- Emoji as the brand mark.
- Generic AI-generated gradients.
- Overly detailed feathers.
- Literal bird photographs.
- Excessive neon colors.
- Complex symbols that become indistinguishable at favicon size.
- A logo that competes with deployment state information.

If the repository already includes a logo-generation or vector-design workflow, use it appropriately. Prefer an original, editable SVG mark over a raster image for the actual application logo.

Document the logo variants, clear-space rules, minimum size, and semantic color usage in the design system.

---

# 2. REPOSITORY INVESTIGATION — MANDATORY FIRST PHASE

Before modifying files, inspect the entire relevant repository and establish its current state.

## 2.1 Inspect the actual project

Identify and document:

- Repository structure and current Git status.
- Existing web framework, runtime, language, package manager, and build tooling.
- Existing backend services, APIs, database, migrations, and authentication.
- Existing UI component library, styling architecture, design tokens, and application shell.
- Existing testing infrastructure and test commands.
- The supplied deployment script and its supporting documentation.
- Docker configuration, Dockerfiles, environment files, ports, container names, and runtime requirements.
- Existing reverse proxy, ingress, load balancer, or routing configuration, if present.
- Deployment hosts, agents, execution identities, and access mechanisms, where documented.
- Existing CI/CD integrations and reusable infrastructure utilities.
- Any implementation that can be safely reused.
- The actual QA Test Studio design-system Markdown file.

Search for these artifacts and their equivalent paths:

- `deploy_asdp-dims-fe.sh`
- `2026-10-28_System_deploy-asdp-dims-fe-upgrade-plan_v1.0.md`
- `deploy-asyst-web-next.sh`
- The QA Test Studio design-system Markdown file.
- `Dockerfile.jenkins`
- Environment examples, Docker Compose files, proxy configuration, and deployment documentation.

Do not assume every listed path exists. Discover the actual files and report missing dependencies.

## 2.2 Source-of-truth rules

Use this precedence:

1. Actual repository code and verified runtime behavior.
2. Explicit deployment and infrastructure documentation.
3. The supplied deployment script.
4. The supplied QA Test Studio design specification.
5. New architectural decisions, documented explicitly when required.

Do not silently override a documented operational requirement. If sources conflict, identify the conflict and determine the safest supported interpretation.

Never overwrite unrelated user changes or reset the repository to a clean state as a shortcut.

## 2.3 Documentation

Create or update appropriate documentation under the repository's existing documentation conventions, including:

- `docs/architecture.md`
- `docs/deployment-lifecycle.md`
- `docs/security-model.md`
- `docs/design-system-integration.md`
- `docs/brand-guidelines.md`
- `docs/operations-runbook.md`
- `docs/implementation-status.md`

Use existing documentation locations where appropriate instead of creating duplicate structures.

Documentation must describe the architecture actually implemented, not an aspirational architecture presented as finished.

After the initial investigation, continue into implementation. Do not stop after generating these documents.

---

# 3. EXISTING DEPLOYMENT WORKFLOW — PRESERVE AND IMPROVE

The provided `deploy_asdp-dims-fe.sh` is the primary behavioral reference for the initial deployment integration.

Map its actual options, commands, conditions, and error handling into explicit, observable backend stages.

## 3.1 Initial deployment configuration

Use these as initial defaults to validate against the actual source script and infrastructure documentation.

| Setting | Initial value |
|---|---|
| Application | `asdp-dims-fe` |
| Branch/environment context | `devel` / `prod` |
| Application directory | `/home/devel/asdp-dims-fe` |
| Default environment file | `.env.development` |
| Docker image | `asdp-dims-fe` |
| Production host port | `4000` |
| Staging host port | Production port + 1, initially `4001` |
| Container port | `3000` |
| Dockerfile | `Dockerfile.jenkins` |
| Build environment | `NODE_ENV=production` |
| BuildKit | Enabled where supported |
| Health-check retry limit | `15` |
| Health-check retry interval | `2` seconds |
| Skip Git pull | `false` |
| Local build verification | `false` |

These are initial configuration values, not universal constants. Preserve configurable parameters and validate environment-specific values before execution.

The original script accepts configuration for the branch/tag/name, environment file, production and staging ports, Dockerfile, application directory, skip-pull behavior, and local verification.

Expose the supported settings in the UI with validation and clear descriptions.

## 3.2 Deployment lifecycle

Implement a persistent backend-controlled state machine.

### Stage 1 — Preflight

Verify:

- Authorization for the target application and environment.
- Required configuration and permitted deployment reference.
- Target host or agent availability.
- Git repository and requested branch/tag.
- Docker daemon connectivity and permissions.
- Dockerfile and environment-file availability.
- Port availability and existing container state.
- Sufficient disk space and relevant resource availability.
- Required credentials and secrets without exposing their values.
- Concurrency locks and conflicting deployments.
- Availability of a rollback candidate where required.

Display actionable failures and block execution when safety-critical preconditions are not satisfied.

### Stage 2 — Source synchronization

Implement the intended behavior:

- Fetch Git references and prune stale references when configured.
- Check out the requested branch or tag.
- Pull the appropriate remote branch when required.
- Capture the exact commit SHA, branch/tag, commit message, author metadata where available, and timestamp.
- Record the source revision used for the deployment.

Handle branches, tags, and commit references explicitly. Do not treat a tag as a branch.

### Stage 3 — Optional local verification

When enabled, execute the configured verification workflow, including `npm ci` and `npm run build` where appropriate.

Capture exit codes, durations, stdout, and stderr. Enforce timeouts and resource limits where practical. Distinguish skipped stages from successful stages.

Do not execute arbitrary browser-supplied shell strings.

### Stage 4 — Docker image build

Build the application image using the configured Dockerfile and validated parameters.

Support:

- BuildKit where available.
- Configurable image tags.
- Required build arguments.
- Structured build output.
- Image IDs and metadata.
- Build durations and errors.
- Appropriate temporary-artifact cleanup.
- Optional image-retention policies.

Never expose secret values in build logs or ordinary deployment metadata.

Validate how `ENV_FILE` is handled by the actual Dockerfile. Do not assume that passing an environment-file path safely makes its contents available inside the build.

### Stage 5 — Staging startup

Create and start the staging container.

- Handle stale staging containers safely.
- Verify image identity.
- Record container ID, mapped ports, and startup status.
- Capture startup errors and logs.
- Ensure cleanup only affects resources owned by the relevant execution.
- Never remove a running production container because a staging operation failed.

### Stage 6 — Staging health verification

Preserve the original health-check behavior as the initial configurable policy:

- Probe the staging application at its configured host and port.
- Accept `200`, `301`, `302`, `304`, `307`, and `308`.
- Allow up to 15 attempts.
- Wait 2 seconds between retries.
- Use a 2-second connection timeout and 4-second maximum request duration where supported.

Show each attempt, response status, elapsed time, and failure reason.

Allow application-specific health paths and policies. A successful HTTP response alone must not be represented as proof of complete business correctness.

### Stage 7 — Production cutover

The original script renames and stops the existing production container before starting the replacement. That can cause an outage despite the script's zero-downtime label.

**Do not reproduce this sequence as a zero-downtime implementation.**

Inspect the real routing architecture first.

Preferred approach:

1. Build the candidate release.
2. Start it independently of the currently serving release.
3. Verify readiness.
4. Switch production traffic using the supported routing infrastructure.
5. Verify the new release through the production route.
6. Retain the previous release until the replacement is confirmed healthy.
7. Retire the old release only when verification and retention policies permit cleanup.

Only implement traffic switching when a real reverse proxy, load balancer, ingress, or equivalent mechanism exists and can be safely managed.

If the infrastructure supports only a single directly bound host port:

- Clearly label the fallback as potentially interruptive.
- Verify that the replacement can start with the required configuration.
- Minimize the interruption.
- Preserve the old image and sufficient metadata for restoration.
- Avoid deleting the previous release prematurely.
- Provide explicit warnings and recovery behavior.

Do not silently introduce or reconfigure production infrastructure.

### Stage 8 — Production verification

After cutover:

- Probe through the real production access path.
- Record status, response time, retries, and errors.
- Verify the expected release where supported.
- Apply the configured health policy.
- Optionally execute additional smoke tests.
- Distinguish success from success with warnings.

A successful staging probe must never be treated as proof that production cutover succeeded.

### Stage 9 — Automatic rollback

If production verification fails:

- Preserve failed-release logs and diagnostics.
- Determine the actual route and container state.
- Restore the last known-good release using the supported infrastructure mechanism.
- Verify the restored production route.
- Record actions, outcomes, and durations.
- Distinguish successful recovery from rollback failure.
- Alert the operator when intervention is needed.

If rollback fails, enter an explicit `ROLLBACK_FAILED` or equivalent recoverable state. Preserve diagnostic evidence and provide actionable recovery steps.

Never remove the previous production image or container before the new release has passed required verification and retention policies permit cleanup.

### Stage 10 — Final report

Record:

- Deployment outcome.
- Application and environment.
- Source reference and commit SHA.
- Previous and new release identifiers.
- Build and image metadata.
- Stage results and durations.
- Health-check results.
- Cutover strategy.
- Rollback outcome.
- Warnings and failures.
- Initiating identity.
- Execution agent and target host.
- Relevant log and diagnostic references.

The report must be derived from persisted execution data.

---

# 4. PLATFORM ARCHITECTURE

Use the simplest architecture that meets the repository's real requirements. Reuse the existing stack unless a documented technical reason requires change.

## 4.1 Control plane

Responsible for:

- Web UI and APIs.
- Authentication and authorization.
- Application and environment configuration.
- Deployment validation and scheduling.
- Persistent state and stage transitions.
- Queueing and concurrency control.
- Real-time event delivery.
- Deployment history and audit records.
- Cancellation and rollback coordination.
- Agent registration and health.
- Operational status.

The control plane must not depend on an open browser to keep a deployment alive.

## 4.2 Execution worker or agent

Implement a persistent backend execution mechanism that:

- Runs approved deployment workflows.
- Executes independently of browser sessions.
- Reports structured events and logs.
- Supports timeouts and safe cancellation.
- Validates application and environment settings.
- Reconnects after temporary network loss.
- Reports agent health.
- Restricts filesystem, process, Docker, and network access where practical.
- Prevents unauthorized cross-application access.

If remote execution is required, use an authenticated agent or a documented secure transport mechanism.

Do not expose an unauthenticated arbitrary shell-execution API.

## 4.3 Persistence

Reuse the existing database if suitable. Otherwise, select a durable store compatible with the stack.

Persist:

- Applications.
- Environments and non-secret configuration.
- Deployment executions.
- Stage execution records.
- Structured logs or durable log references.
- Health-check attempts.
- Release metadata.
- Rollback relationships.
- Agent status.
- Users and authorization data.
- Audit events.
- Relevant settings.

Define retention, indexing, and cleanup policies. In-memory UI state must not be the authoritative deployment history.

## 4.4 Execution events

Use the existing real-time technology where suitable.

Support:

- Live stage transitions.
- Incremental logs.
- Health-check updates.
- Actual progress derived from events.
- Agent connectivity changes.
- Completion and failure notifications.
- Browser reconnection and history recovery.

Authenticate streaming endpoints. Retrieve missed events from durable history where available and avoid duplicate log rendering.

---

# 5. REQUIRED PRODUCT PAGES

Implement functional routes and real backend-connected data.

## 5.1 Global application shell

Include:

- Pipra brand mark and wordmark.
- Primary navigation.
- Environment context.
- Search where useful.
- Operational notifications where implemented.
- User menu.
- Responsive navigation.
- Accessible dialogs.
- Clear differentiation between development, staging, and production.

Do not communicate environment identity by color alone.

## 5.2 Overview

Show actual operational data:

- Recent deployments.
- Active deployments.
- Success and failure trends.
- Deployment duration.
- Application and environment health.
- Failed or interrupted executions.
- Rollback events.
- Agent connectivity.
- Recent audit activity.

Provide actionable navigation and useful first-install empty states. Never fabricate metrics.

## 5.3 Applications

Allow authorized users to register, view, configure, validate, and manage applications.

Support validated settings for:

- Repository.
- Permitted branches, tags, and commit references.
- Application directory.
- Dockerfile and image.
- Environment-file reference.
- Ports.
- Health-check policies.
- Verification and smoke tests.
- Deployment and rollback policy.

Show recent executions and the current release.

## 5.4 Environments

Show:

- Environment identity and risk level.
- Target host or agent.
- Application and release currently serving.
- Health status and last verification.
- Active deployment.
- Cutover strategy.
- Relevant infrastructure status.
- Access controls and environment policies.

Production actions must be clearly distinguished and authorized.

## 5.5 Deployment wizard

Implement the following steps:

1. **Application and environment:** select the target.
2. **Release reference:** choose a permitted branch, tag, or commit SHA.
3. **Deployment options:** select supported configuration.
4. **Preflight review:** display validation, agent availability, existing release, resource checks, and warnings.
5. **Confirmation:** show target, revision, deployment strategy, expected impact, and rollback policy.
6. **Live execution:** open the persisted execution detail page.

Require explicit confirmation for production deployments.

Do not claim that execution has started until the backend has accepted and persisted the request.

## 5.6 Live deployment detail

Display:

- Deployment ID and state.
- Application and environment.
- Source revision.
- Initiating identity.
- Start time and elapsed duration.
- Pipeline timeline.
- Current stage and real status.
- Stage durations.
- Live logs.
- Health-check results.
- Build and container metadata.
- Warnings and errors.
- Safe cancellation where supported.
- Authorized retry or rollback.
- Reconnection and log-history recovery.
- Final result and related executions.

Support explicit states such as:

`QUEUED`, `PREPARING`, `RUNNING`, `VERIFYING`, `CUTTING_OVER`, `ROLLING_BACK`, `SUCCEEDED`, `FAILED`, `CANCELLED`, `INTERRUPTED`, and `ROLLBACK_FAILED`.

Define valid transitions. UI status must reflect persisted backend state, never decorative timers.

## 5.7 Log viewer

Implement:

- Incremental updates.
- Timestamps.
- Severity where available.
- Stage association.
- Search and filters.
- Pause/resume of visual auto-scroll.
- Copy selected output.
- Authorized log export.
- Long-output handling.
- Secret redaction.
- Accessible announcements.
- Reconnection recovery.

Never render untrusted terminal output as executable HTML.

## 5.8 History and releases

Provide searchable, filterable deployment history with details, stage outcomes, source references, durations, failure diagnostics, and rollback relationships.

Where supported, show current, previous, and candidate releases, immutable image identifiers, commit SHAs, verification outcomes, and retention status.

Only offer rollback to releases whose artifacts and metadata are actually available.

## 5.9 Infrastructure and agents

Show actual:

- Agent health and last-seen time.
- Supported capabilities.
- Target host identity.
- Docker availability and version.
- Collected resource and disk information.
- Active jobs.
- Connectivity errors.

Implement registration and revocation workflows where appropriate. Never invent telemetry.

## 5.10 Administration and audit

Implement the required authentication, role management, application and environment permissions, agent management, secret references, retention settings, deployment policies, audit events, and system health.

Prioritize actual authorization over decorative administration pages.

---

# 6. JENKINS-LEVEL ROADMAP

Treat Jenkins-level capability as the product direction, not a requirement to recreate every Jenkins feature immediately.

## P0 — First production-oriented release

- Persistent deployment execution.
- Application and environment management.
- Configurable deployment stages.
- Source revision tracking.
- Docker image building.
- Staging startup and health checks.
- Safe production cutover appropriate to actual infrastructure.
- Production verification.
- Automatic rollback and rollback verification.
- Live logs and pipeline timeline.
- Durable deployment history.
- Authentication and role-based authorization.
- Audit logging.
- Safe cancellation.
- Concurrency and idempotency.
- Agent health and recovery.
- Responsive, accessible UI.
- Automated tests and operations documentation.

## P1 — Subsequent capabilities

- Reusable deployment templates.
- Approval gates.
- Environment promotion.
- Retry policies.
- Notifications.
- Scheduled deployments.
- Release comparisons.
- Additional application adapters.
- Secret-manager integration.
- Artifact retention.
- Advanced search.
- Configuration import/export.
- Smoke-test integration.
- Deployment policy rules.

## P2 — Future extensibility

- General-purpose CI/CD pipelines.
- Pipeline-as-code.
- Reusable pipeline steps and templates.
- Multiple execution agents and controlled parallelism.
- Plugin or adapter architecture.
- Git-provider webhooks.
- Multi-project organization management.
- Deployment analytics.
- Change-management integrations.
- Artifact registries and provenance.

Do not create fake features to make the product look complete. Label planned capabilities accurately.

---

# 7. MANDATORY QA TEST STUDIO DESIGN SYSTEM

The supplied QA Test Studio design-system Markdown is the mandatory foundation for Pipra's visual language, component behavior, and accessibility.

Locate the actual design MD in the repository. If unavailable, use the provided specification as the temporary source of truth and document this limitation.

## 7.1 Design intent

Create a structured, token-driven, content-first dashboard for authenticated operators.

The result must be premium, restrained, technical, information-dense, and consistent. It must feel designed for engineers who monitor deployments under time pressure.

Avoid generic AI-generated dashboard patterns, decorative visual noise, oversized empty cards, excessive gradients, unnecessary animations, emoji status indicators, and ornamental hero sections.

## 7.2 Typography

Preserve the supplied values:

- Primary font: Inter.
- Font stack: `Inter, -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, system-ui, sans-serif`.
- Base font size: `13px`.
- Base weight: `400`.
- Base line height: `19.5px`.
- Extra-small size: `12px`.
- Small size: `13px`.
- Medium size: `24px`.

Extend the scale centrally only where necessary for page titles, section headings, metrics, and logs. Avoid ad hoc typography values.

## 7.3 Colors

Preserve these supplied values as the initial design foundation:

| Token | Value |
|---|---|
| `color.text.primary` | `#edf1f7` |
| `color.text.secondary` | `#778396` |
| `color.text.tertiary` | `#a4aebd` |
| `color.text.inverse` | `#0b0d12` |
| `color.surface.base` | `#000000` |
| `color.surface.muted` | `#11151c` |
| `color.surface.raised` | `#818cf8` |
| `color.surface.strong` | `#171d27` |
| `color.border.muted` | `#293241` |

The supplied `color.border.default` value is malformed:

`rgb(237, 241, 247) rgb(237, 241, 247) rgb(32, 41, 56)`

Resolve it into a valid semantic border token. Document the original value, the chosen interpretation, and the contrast tests. Do not silently propagate invalid CSS.

Use `color.surface.raised` as a restrained accent rather than the background for every card.

## 7.4 Semantic tokens

Create centralized tokens for:

- Text hierarchy.
- Base, muted, raised, and strong surfaces.
- Default, subtle, and strong borders.
- Primary, secondary, and destructive actions.
- Keyboard focus.
- Success, warning, error, and information.
- Production identity.
- Pipeline and health states.
- Hover, active, disabled, and loading states.
- Overlays and dialogs.

Status must remain distinguishable without color alone.

## 7.5 Spacing

Preserve the supplied spacing values:

- `space.1 = 1px`
- `space.2 = 2px`
- `space.3 = 8px`
- `space.4 = 9px`
- `space.5 = 10px`
- `space.6 = 12px`
- `space.7 = 14px`
- `space.8 = 24px`

Document their intended use and introduce additional tokens only where necessary. Avoid one-off spacing values.

Favor compact, predictable spacing for tables, forms, pipeline timelines, and logs.

## 7.6 Radius, shadow, and motion

Preserve:

- `radius.xs = 4px`
- `radius.sm = 8px`
- `radius.md = 9px`
- `radius.lg = 10px`
- `shadow.1 = rgb(0, 0, 0) 0px 12px 32px -8px`
- `motion.duration.instant = 120ms`
- `motion.duration.fast = 150ms`
- `motion.duration.normal = 180ms`

Use shadows and rounded surfaces sparingly. Favor hierarchy through typography, spacing, borders, and alignment. Respect reduced-motion preferences.

## 7.7 Theme strategy

The supplied palette is a dark baseline.

- Implement dark mode first.
- Preserve light mode if it already exists.
- If light mode does not exist, structure tokens so it can be added without rewriting components.
- Do not compromise the first reliable release to implement an unnecessary second theme.
- Validate both themes independently if both are implemented.

## 7.8 Component inventory and state rules

Audit the actual code and shared components. The reference specification provides this component-density context:

- Buttons: 38.
- Inputs: 11.
- Cards: 5.
- Lists: 4.
- Navigation groups: 2.
- Tables: 1.

These are not fixed component counts for Pipra.

Every applicable interactive component must define:

- Anatomy and variants.
- Default, hover, focus-visible, active, disabled, loading, and error states.
- Responsive behavior.
- Long-content and overflow behavior.
- Empty-state behavior.
- Keyboard, pointer, and touch interaction.
- Testable accessibility acceptance criteria.

Every non-negotiable rule in design documentation must use **must**. Recommendations must use **should**.

## 7.9 Component-specific rules

**Buttons:** Consistent sizing and semantics; clear destructive actions; no duplicate submissions; accessible names for icon-only controls.

**Forms:** Explicit labels, descriptions, field-level errors, server-side validation, preserved values after recoverable errors, and secure handling of secrets.

**Cards and lists:** Purposeful grouping, restrained surfaces, useful density, and consistent loading, empty, and error states.

**Navigation:** Clear hierarchy, active-page indication, environment context, keyboard accessibility, and responsive behavior.

**Tables:** Consistent alignment, readable status, pagination, overflow handling, keyboard-accessible actions, and useful empty states.

**Pipeline timeline:** Real stage state, actual durations, meaningful status labels, and direct links to failure diagnostics.

**Log viewer:** Readable monospace output, timestamps, preserved whitespace, long-line handling, selection and copy support, and safe rendering of untrusted output.

## 7.10 Density and responsive behavior

- Prioritize operational information over decoration.
- Avoid oversized cards and unnecessary hero sections.
- Keep important state visible without excessive scrolling.
- Make stage status and live logs easy to scan.
- Support desktop, tablet, and mobile.
- Preserve clear production warnings on all viewport sizes.
- Handle narrow tables with controlled overflow or a suitable compact view.
- Do not merely shrink desktop content to fit mobile.

---

# 8. ACCESSIBILITY — WCAG 2.2 AA

Target WCAG 2.2 AA and test:

- Semantic HTML and accessible names.
- Logical heading structure.
- Keyboard-operable navigation, forms, dialogs, tables, and deployment controls.
- Visible focus indicators.
- Sufficient text and non-text contrast.
- Associated field labels and errors.
- Accessible announcements for critical deployment transitions.
- Reduced-motion support.
- Touch-friendly controls.
- Correct dialog focus management.
- Clear disabled, loading, and unavailable states.
- Status indicators that do not rely on color alone.
- Accessible live-log behavior.
- Focus restoration after dialogs and navigation.

Use automated tools where available and manual keyboard testing. Do not claim complete WCAG conformance solely because an automated scanner passes.

---

# 9. SECURITY AND PRODUCTION SAFETY

## 9.1 Authentication and authorization

Implement or reuse real authentication. Enforce server-side permissions for deployment creation, environment access, cancellation, rollback, configuration, credentials, agents, audit, and administration.

Hiding a button in the frontend is not authorization.

## 9.2 Command execution

- Never expose unrestricted shell access through the browser.
- Use predefined operations and validated parameters.
- Prefer safe process invocation and argument arrays.
- Avoid shell-string concatenation with untrusted input.
- Allowlist supported commands.
- Validate branches, tags, image names, file paths, ports, and environment identifiers.
- Restrict filesystem access.
- Enforce timeouts and controlled process termination.
- Capture exit codes and signals.
- Prevent command injection and path traversal.
- Use the narrowest practical execution privileges.

A shell script may be used as a transitional adapter, but it must be called through a controlled backend interface with validated arguments and structured results.

## 9.3 Secrets

- Never return raw stored secrets to the browser.
- Never expose secrets in logs, errors, audits, or summaries.
- Use an existing secret manager if available.
- Otherwise implement protected server-side storage consistent with the deployment model.
- Prefer secret references where practical.
- Redact sensitive values from command output.
- Never commit credentials, private keys, or real environment files.

## 9.4 Operational safeguards

- Prevent conflicting deployments to the same target.
- Make deployment requests idempotent.
- Audit consequential operations.
- Require confirmation for production and destructive actions.
- Implement safe cancellation boundaries.
- Never kill unrelated processes.
- Never remove resources without verifying ownership and intent.
- Retain the last known-good release.
- Verify rollback rather than assuming it succeeded.
- Reconcile execution state after worker restarts.

## 9.5 Network and web security

Apply appropriate session security, CSRF protection, input validation, output encoding, cookie configuration, CORS restrictions, rate limiting, streaming-endpoint authorization, log-export authorization, safe downloads, and agent-registration protection.

Document infrastructure-specific limitations.

---

# 10. STATE MACHINE AND RECOVERY

Define the formal execution state machine before connecting all UI controls.

Document valid states, transitions, terminal states, retries, cancellation boundaries, rollback rules, restart recovery, event ordering, and persistence guarantees.

Prevent:

- Completed deployments returning to running without a new execution.
- Concurrent production cutovers.
- Failed health checks being recorded as successful.
- Frontend cancellation being treated as proof that backend execution stopped.
- Worker restarts losing deployment history.
- Rollback being marked successful without verification.
- One execution deleting resources owned by another.

On startup, reconcile nonterminal executions with actual worker and infrastructure state. Use `INTERRUPTED` only when supported by available evidence. Provide recovery for ambiguous states.

---

# 11. API AND DATA CONTRACTS

Implement explicit contracts for:

- Applications.
- Environments.
- Deployment creation.
- Deployment detail and history.
- Stage status.
- Log retrieval and streaming.
- Health-check results.
- Release metadata.
- Rollback.
- Cancellation.
- Agent registration and heartbeat.
- Audit events.
- System health.

For deployment creation:

1. Validate the request.
2. Authorize the user.
3. Validate target configuration.
4. Apply idempotency and concurrency rules.
5. Persist the execution record.
6. Queue or start the worker.
7. Return a stable deployment ID.
8. Deliver subsequent events from the authoritative execution record.

Use consistent error structures and appropriate HTTP status codes. Reuse existing API conventions when sound.

---

# 12. TESTING STRATEGY

Use the existing test stack where practical.

## 12.1 Unit tests

Test state transitions, parameter validation, branch/tag/commit handling, configuration parsing, health checks, retry and timeout policies, concurrency, idempotency, secret redaction, authorization, rollback decisions, and duration calculations.

## 12.2 Integration tests

Test request persistence, worker execution, process invocation, exit-code capture, Docker adapter behavior, log storage, agent reconnection, restart recovery, production verification failure, successful rollback, failed rollback, safe cancellation, concurrent-deployment rejection, authorization, and secret redaction.

Use mocks or a safe test environment. Never run destructive tests against production.

## 12.3 End-to-end tests

Verify that an authorized operator can sign in, configure an application, initiate a test deployment, observe real stages and logs, refresh the browser, recover the same execution, complete a successful deployment, simulate a health-check failure, verify rollback, and confirm that unauthorized actions are rejected.

Test responsive behavior, keyboard accessibility, empty states, and error states.

## 12.4 UI quality assurance

Check:

- Token consistency.
- Component state coverage.
- Visual hierarchy.
- Long-content and table-overflow behavior.
- Form validation.
- Loading, empty, error, and success states.
- Responsive navigation.
- Dialog focus management.
- Log readability.
- Keyboard operation.
- Contrast and focus visibility.
- Absence of fake operational data.
- Absence of browser console errors.
- Absence of broken navigation and inert primary actions.

Run available lint, type-check, build, unit, integration, and end-to-end tests. Report what was not executed and why.

---

# 13. IMPLEMENTATION PHASES

## Phase 1 — Audit and architecture

Inspect the repository, deployment script, upgrade plan, infrastructure, and design MD. Map the lifecycle, identify risks, and document the implementation plan.

## Phase 2 — Execution foundation

Implement durable deployment records, the state machine, validated requests, worker or execution adapter, concurrency control, structured logs, event delivery, cancellation, and recovery boundaries.

## Phase 3 — Safe deployment integration

Integrate Git, optional verification, Docker build, staging, health checks, infrastructure-appropriate cutover, production verification, rollback, and release retention.

## Phase 4 — Pipra brand and design system

Implement the Pipra wordmark and vector mark, migrate the supplied tokens, build shared accessible components, establish the global shell, and verify responsive and accessible behavior.

## Phase 5 — Product screens

Implement overview, applications, environments, deployment wizard, live deployment detail, logs, history, releases, infrastructure and agents, administration, and audit.

Every released screen must use real backend-connected functionality.

## Phase 6 — Hardening and verification

Run tests, fix defects, validate recovery and rollback, audit authorization, verify secret redaction, test accessibility and responsiveness, update documentation, and verify startup instructions.

Reuse existing capabilities instead of rebuilding them unnecessarily.

---

# 14. ENGINEERING RULES

- Preserve existing conventions and user changes.
- Prefer the smallest reliable architecture that satisfies the requirements.
- Avoid unnecessary dependencies and microservices.
- Do not add a framework merely to imitate Jenkins.
- Do not replace working code without understanding its consumers.
- Do not leave primary actions as placeholders.
- Do not hardcode successful deployment outcomes.
- Do not simulate infrastructure telemetry.
- Do not suppress errors to make the UI appear successful.
- Do not leave security-critical TODOs in the completed P0 workflow.
- Do not claim zero downtime without a verified routing strategy.
- Use centralized configuration and consistent naming.
- Keep business logic out of presentation components.
- Enforce authorization on every deployment mutation.
- Make cleanup ownership-aware.
- Document limitations and infrastructure assumptions.
- If an infrastructure-dependent decision cannot be verified, implement the safe supported behavior and document the limitation.

Do not invent server access or assume an external service exists.

---

# 15. DEFINITION OF DONE

## Functional

- [ ] Pipra starts using documented instructions.
- [ ] The initial application can be registered and configured.
- [ ] Authorized users can initiate deployments through the UI.
- [ ] Execution continues independently of the browser.
- [ ] Source revisions are recorded accurately.
- [ ] Docker output and failures are captured.
- [ ] Staging health checks are persisted.
- [ ] Cutover matches actual infrastructure capabilities.
- [ ] Production verification is independent of staging verification.
- [ ] The previous release is retained until the replacement passes verification.
- [ ] Rollback restores and verifies the previous release where supported.
- [ ] Rollback failure is explicit.
- [ ] Logs and stage transitions use actual backend events.
- [ ] Browser reconnection restores the existing execution.
- [ ] History survives application and worker restarts.
- [ ] Concurrency and idempotency safeguards work.
- [ ] Server-side authorization works.
- [ ] Sensitive values are redacted.
- [ ] Consequential actions generate audit records.
- [ ] Released primary actions work.

## Design and accessibility

- [ ] Pipra branding is consistently applied.
- [ ] QA Test Studio design principles and tokens are integrated.
- [ ] The malformed border token is resolved and documented.
- [ ] Components follow the state contract.
- [ ] Relevant loading, empty, error, disabled, and success states are implemented.
- [ ] Desktop, tablet, and mobile layouts work.
- [ ] Keyboard navigation and visible focus work.
- [ ] Applicable WCAG 2.2 AA criteria are tested.
- [ ] The UI avoids unnecessary AI-generated dashboard patterns.
- [ ] Navigation is functional.
- [ ] Status does not rely on color alone.

## Quality and operations

- [ ] Relevant lint, type-check, build, and test commands were executed.
- [ ] Critical deployment and rollback paths have automated coverage.
- [ ] Failure paths were tested safely.
- [ ] No known critical security issue remains in the implemented P0 workflow.
- [ ] Documentation reflects the real implementation.
- [ ] Remaining risks and infrastructure assumptions are documented.

If a criterion cannot be completed, mark it incomplete and explain the reason and next action. Never mark a criterion complete based on intention alone.

---

# 16. FINAL EXECUTION REPORT

Provide an evidence-based report containing:

1. Product delivered and implemented capabilities.
2. Key repository files created or modified.
3. Actual architecture and execution model.
4. Implemented deployment lifecycle.
5. Cutover strategy, rollback guarantees, and limitations.
6. UI pages, design-system integration, and accessibility results.
7. Authentication, authorization, secret handling, and execution safeguards.
8. Tests executed and their results.
9. Exact setup, development, testing, and deployment commands.
10. Infrastructure prerequisites and credential configuration.
11. Remaining work, risks, and unimplemented roadmap items.
12. Definition-of-Done status based on verified evidence.

Distinguish implemented, tested, partially implemented, and planned capabilities.

# FINAL DIRECTIVE

Build **Pipra — Pipeline & Release Engineering Platform** as a real, secure, persistent, and usable deployment operations product.

Use the existing deployment script as the behavioral starting point, the actual repository and infrastructure as the operational source of truth, and the QA Test Studio design-system Markdown as the mandatory UI foundation.

Apply the Pipra identity consistently without renaming unrelated infrastructure identifiers. Prioritize safe deployment execution, verified health checks, recoverability, and truthful operational state.

Deliver a premium, restrained, bird-inspired identity and an elegant, information-dense engineering interface—but never sacrifice production safety or real functionality for visual polish.

**Inspect first. Implement end to end. Test the failure paths. Verify the result. Document what actually works.**