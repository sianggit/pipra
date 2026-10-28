# Pipra --- Product Design System

**Version:** 1.0 \| **Status:** Implementation baseline\
**Product descriptor:** Pipeline & Release Engineering Platform\
**Tagline:** Build with confidence. Ship with control.

## 1. Context and goals

### Design intent

Pipra must feel like a purpose-built release-engineering instrument:
calm, precise, high-trust, and visually distinctive---not a generic
AI-generated dashboard. It is a self-hosted platform for orchestrating
deployment pipelines, inspecting execution, managing releases, and
recovering from failures. Operators need to understand state quickly,
make consequential decisions, and diagnose problems under pressure.

### Experience goals

-   Make operational state immediately legible.
-   Prioritize real work, evidence, and diagnostics over decorative
    metrics.
-   Support information density without crowding.
-   Make production-impacting actions unmistakable and deliberate.
-   Make execution understandable through timelines, stage status, logs,
    and verified outcomes.
-   Maintain consistency across overview, applications, environments,
    deployments, releases, agents, and administration.
-   Use a restrained Pipra brand mark and disciplined typography, color,
    and spacing.

### Principles

1.  **State before decoration.** Status and next action must be easier
    to find than ornament.
2.  **Evidence before confidence.** Success means verified outcomes, not
    a green badge.
3.  **Density with rhythm.** Keep related information compact and
    separate unrelated groups.
4.  **Intentional risk.** Production and destructive actions must differ
    from routine actions.
5.  **Quiet confidence.** Use restrained color, clear typography, and
    deliberate alignment.
6.  **Consistency over exceptions.** Shared tokens and components are
    the default.
7.  **Honest interfaces.** Empty, unknown, stale, failed, and
    unavailable states must remain distinct.

Do not imitate Jenkins pixel-for-pixel. Do not add decorative charts,
fake metrics, oversized cards, excessive gradients, glow, glassmorphism,
or animations that compete with live operational data.

## 2. Brand direction

### Personality

Precise, composed, technical, dependable, premium, restrained, and
forward-looking without being flashy.

### Logo usage

Use the approved Pipra geometric bird/wing symbol and wordmark assets.
Use the full wordmark in expanded navigation and the symbol alone in
collapsed navigation, compact surfaces, and favicon contexts. Keep the
mark crisp with sufficient clear space and contrast. Do not redraw it
with arbitrary CSS, substitute emoji, or introduce unrelated bird
illustrations. Do not show the full tagline in compact navigation.

### Brand expression

The logo may use an icy-blue → indigo → violet gradient. This is a brand
accent, not a general-purpose surface treatment. Most application
surfaces must remain solid and quiet. Use green only for verified
success, amber for warnings, red for failures/destructive risk, and
slate for neutral states. Status must never rely on color alone.

## 3. Foundations and tokens

Use centralized semantic tokens. Components must reference tokens rather
than hard-coded values. Map these values onto an existing token system
when one exists; avoid duplicate token sources.

### 3.1 Dark theme --- default

  --------------------------------------------------------------------------------
  Token                            Value                   Use
  -------------------------------- ----------------------- -----------------------
  `color.bg.canvas`                `#080B12`               Main application
                                                           background

  `color.bg.sidebar`               `#0B1019`               Navigation surface

  `color.bg.surface`               `#101722`               Panels and compact
                                                           cards

  `color.bg.surface-raised`        `#151F2D`               Menus and popovers

  `color.bg.surface-subtle`        `#0D131D`               Nested regions

  `color.bg.input`                 `#0B111B`               Inputs and filters

  `color.text.primary`             `#EDF2F8`               Primary content

  `color.text.secondary`           `#A3AFBF`               Supporting text

  `color.text.muted`               `#748196`               Metadata

  `color.text.inverse`             `#07101C`               Text on suitable bright
                                                           actions

  `color.border.default`           `#283446`               Standard boundaries

  `color.border.subtle`            `#1C2736`               Quiet separators

  `color.border.strong`            `#3A4A60`               Emphasized boundaries

  `color.action.primary`           `#6EA8FE`               Primary action and
                                                           active navigation

  `color.action.primary-hover`     `#8AB9FF`               Hover

  `color.action.primary-pressed`   `#4D8CEB`               Pressed

  `color.focus.ring`               `#9BC5FF`               Keyboard focus

  `color.status.success`           `#43C99A`               Verified success

  `color.status.warning`           `#F0B85B`               Attention required

  `color.status.danger`            `#F27683`               Failure/destructive
                                                           risk

  `color.status.info`              `#7CB8F8`               Information

  `color.status.neutral`           `#93A1B4`               Queued/inactive
  --------------------------------------------------------------------------------

These values are a starting point, not a substitute for contrast
testing. Adjust failing combinations centrally and document changes.

### 3.2 Optional light theme

If light mode exists, preserve it and map it to semantic tokens. If it
does not exist, structure the token system so it can be added without
rewriting components. Do not mechanically invert the dark palette.
Validate text, borders, focus, statuses, tables, and disabled states
separately.

### 3.3 Typography

Preferred font: Inter, with a system fallback.

``` css
font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, system-ui, sans-serif;
```

  Token               Size   Line height Use
  ----------------- ------ ------------- -----------------------------------
  `font.size.2xs`     11px          16px Dense metadata only when readable
  `font.size.xs`      12px          17px Labels, timestamps, helper text
  `font.size.sm`      13px          19px Compact default interface text
  `font.size.md`      14px          21px Important body/form text
  `font.size.lg`      16px          24px Panel headings
  `font.size.xl`      20px          28px Section headings
  `font.size.2xl`     24px          32px Page title
  `font.size.3xl`     30px          38px Rare key overview metric

Weights: regular 400, medium 500, semibold 600, bold 700.

Rules: - Body text should default to 13--14px for the dense operator
interface. - Page titles must be clear, not oversized. - Use tabular
numerals for durations, timestamps, counts, and metrics. - Use monospace
for command output, commit SHAs, container IDs, and logs. - Avoid
all-caps labels except short purposeful metadata. - Typography size
alone must not communicate status.

### 3.4 Spacing

  Token          Value
  ------------ -------
  `space.0`        0px
  `space.1`        4px
  `space.2`        8px
  `space.3`       12px
  `space.4`       16px
  `space.5`       20px
  `space.6`       24px
  `space.7`       32px
  `space.8`       40px
  `space.9`       48px
  `space.10`      64px

Use tight spacing within related controls and larger spacing between
unrelated groups. Avoid undocumented one-off values.

### 3.5 Radius, elevation, and motion

  --------------------------------------------------------------------------------------
  Token                   Value                                  Use
  ----------------------- -------------------------------------- -----------------------
  `radius.xs`             4px                                    Compact labels

  `radius.sm`             6px                                    Inputs and buttons

  `radius.md`             8px                                    Menus and panels

  `radius.lg`             10px                                   Major content surfaces

  `radius.xl`             14px                                   Rare prominent
                                                                 containers

  `shadow.menu`           `0 12px 32px -10px rgb(0 0 0 / 45%)`   Menus/popovers

  `shadow.dialog`         `0 24px 64px -20px rgb(0 0 0 / 60%)`   Dialogs

  `shadow.none`           `none`                                 Default panels
  --------------------------------------------------------------------------------------

Motion tokens: instant 100ms, fast 140ms, normal 180ms, slow 240ms;
standard easing `cubic-bezier(0.2, 0, 0, 1)`. Motion must communicate
state or spatial continuity. Never animate progress that is not backed
by real execution. Respect `prefers-reduced-motion`.

Prefer borders and tonal contrast over persistent shadows. Do not wrap
every section in a separate rounded card.

## 4. Layout and information architecture

Primary navigation: 1. Overview 2. Deployments 3. Applications 4.
Environments 5. Releases 6. Agents / Infrastructure 7. Audit log 8.
Settings

Group navigation into "Operate" and "Manage" only if that improves
clarity. Do not add hierarchy without a real need.

-   Expanded navigation shows Pipra mark and wordmark.
-   Collapsed navigation shows the symbol with accessible tooltips.
-   Active navigation uses a subtle surface and clear indicator, not a
    glowing gradient.
-   Production context must remain explicit on production deployment
    screens.
-   Mobile navigation must be keyboard and touch accessible.
-   Breadcrumbs should appear only when they help users understand
    hierarchy.

Use a stable shell, consistent alignment, and compact operational
density. Avoid giant empty headers, oversized KPI cards, and excessive
blank margins. Use sticky elements only when they materially improve
context or navigation.

## 5. Page-level guidance

### Overview

Answer: "What needs attention, and what is happening now?" Use a compact
heading and primary deployment action, a restrained summary row based on
real data, active deployments, recent deployment table, and an
attention-required section. Add charts only when historical data exists
and the chart supports a concrete operational decision. Do not use a
grid of oversized statistic cards as the whole page.

### Deployments

Use a high-utility table with search and filters. Keep status,
application, environment, source revision, initiator, start time,
duration, and outcome scannable. Support loading, empty, no-results,
error, and stale-data states.

### Deployment wizard

Use a compact stepper. Show application, environment, and source
revision in a persistent summary. Group related fields, explain
infrastructure-dependent options, display preflight findings before
confirmation, and show target, revision, cutover strategy, expected
impact, and rollback policy before production execution. Prevent
duplicate submissions.

### Live deployment detail

This is a core Pipra screen and deserves the highest design attention.
Prioritize: 1. Deployment identity, state, target, and source revision.
2. Current stage and elapsed time. 3. Pipeline timeline with actual
stage states. 4. Logs and diagnostics. 5. Health checks and release
verification. 6. Metadata and recovery actions.

Use two columns on wide screens only when both remain readable. Stack on
narrow screens without hiding critical status. Each stage must show its
name, real state, timestamps/duration when available, failure reason,
and link to logs. Logs must be calm and readable; never simulate
terminal output.

### Applications and environments

Prefer structured detail layouts over card-heavy dashboards. Separate
editable configuration from runtime status. Distinguish configuration
drift from observed runtime state where supported. Mask secrets and show
references rather than values. Surface relevant history without
duplicating the overview.

### Releases and rollback

Use immutable artifact or commit metadata where available. Label
current, previous, and candidate releases explicitly. Show verification
evidence and retention status. Offer rollback only when a valid artifact
exists and the user is authorized. Never label a release healthy without
evidence.

### Agents and infrastructure

Use a compact table/list for agent identity, connectivity, capabilities,
last-seen time, and active work. Distinguish unavailable telemetry from
a failed host. Show last observation time. Do not use decorative gauges
unless measurements are real and useful.

### Audit and administration

Optimize for traceability: actor, action, target, time, outcome, and
related deployment ID. Make permission boundaries understandable. Never
expose secrets.

## 6. Component contracts

Every interactive component must document applicable default, hover,
focus-visible, active, disabled, loading, and error states. It must
define keyboard, pointer, touch, responsive, overflow, and empty-state
behavior.

### Buttons

Variants: primary, secondary, tertiary/ghost, destructive, and
icon-only. Use one principal action per region where practical. Loading
prevents duplicate submission. Disabled controls remain legible and
explain unavailability where useful. Destructive actions must not look
like routine actions. Icon-only buttons need accessible names.

### Inputs and forms

Every field must have a visible label. Associate helper text and errors
with the field. Preserve input after recoverable errors. Validate on the
server and client. Placeholder text must not be the only label. Mask
secrets. Long paths and branch names must not break layout.

### Status badges

Use concise labels such as "Running", "Failed", "Verified", "Queued",
and "Rollback failed". Pair color with text and optionally an icon. Keep
badges restrained. Unknown and stale states must not appear successful.

### Cards and panels

Use panels only to group related content. Prefer a clear canvas and
separators over nested cards. Every panel must have a purpose and useful
heading where needed. Empty panels must explain why no data exists or
what to do next.

### Tables

Align text and numeric values consistently; use tabular numerals for
times and counts. Sorting and filtering must be accessible. Preserve
important columns on small screens or provide a deliberate compact
alternative. Long identifiers need wrapping, truncation with
inspect/copy, or a detail view. Row actions must be keyboard accessible
and must not trigger accidentally. Add pagination or virtualization when
needed.

### Pipeline timeline

Distinguish pending, running, successful, failed, skipped, cancelled,
and unknown. Never infer success from the previous stage. Show durations
only from timestamps. Failures must be easy to locate. Use textual
status. Do not show decorative progress percentages when total work is
not measurable.

### Logs

Use a legible monospace font and preserve whitespace. Separate
timestamps, stage metadata, severity, and message without excessive
chrome. Support long lines, horizontal overflow, search, selection,
copy, and controlled auto-scroll. Do not force auto-scroll while users
inspect older output. Sanitize output and never interpret log content as
HTML. Redact secrets before display and, where appropriate, before
persistence. Announce critical transitions without announcing every log
line to assistive technology.

### Dialogs and notifications

Use dialogs for consequential confirmation, not routine navigation.
State consequences plainly; production confirmations must show target
and release. Manage and restore focus. Escape should close only when
safe. Toasts are for brief non-blocking feedback; they must not be the
only record of deployment failure. Avoid notification piles.

## 7. Content and tone

Use concise, confident, implementation-focused language.

Preferred: - "Deployment failed during production verification." -
"Rollback completed and the previous release is responding." - "Agent
unavailable. Last successful heartbeat: 8 minutes ago." - "Preflight
found a port conflict on 4001." - "Production cutover may cause a brief
interruption."

Avoid: - "Oops! Something went wrong." - "Your deployment is flying!" -
"Everything looks amazing." - "Almost there!" when progress cannot be
measured. - "Zero downtime" without verified infrastructure support. -
"Success" when a command exited successfully but production health was
not verified.

Actions should describe outcomes: "Start deployment", "Cancel
deployment", "Retry verification", "Roll back to previous release", and
"View stage logs".

## 8. Accessibility --- WCAG 2.2 AA

Target WCAG 2.2 AA. Test: - Keyboard completion of all primary
workflows. - Visible focus on every interactive element. - Logical focus
order and semantic headings. - Text contrast of at least 4.5:1 for
normal text and 3:1 for large text, subject to applicable criteria. -
Applicable non-text contrast for important boundaries and states. -
Programmatic labels and associated field errors. - Dialog names, focus
management, and restoration. - Status not conveyed by color alone. -
Reduced-motion support. - Usable touch targets meeting applicable WCAG
2.2 criteria or documented exceptions. - Live updates announced without
overwhelming assistive technology. - Tables and logs usable at high zoom
and narrow viewports. - Understandability at 200% zoom. -
Distinguishable disabled, loading, unavailable, and stale states.

Automated scans must be supplemented by manual keyboard and
screen-reader checks for critical flows.

## 9. Responsive behavior

**Desktop:** use available width for tables, timelines, and logs; keep
shell stable; allow side-by-side layouts only when readable.

**Tablet:** collapse low-priority metadata, keep primary actions
visible, reflow forms, and keep tables navigable.

**Mobile:** use compact navigation, stack sections by operational
priority, keep environment and deployment state visible, use controlled
horizontal overflow only when necessary, and retain production warnings
and confirmation details.

Responsive changes must preserve meaning and actions, not merely shrink
desktop content.

## 10. Loading, empty, error, and stale states

Every data-driven page must define initial loading, partial loading
where relevant, empty state, no results, permission denied, backend
failure, offline/disconnected, stale data, and retry behavior.

-   Use skeletons only when they improve continuity; do not imitate fake
    data.
-   Explain empty states and provide a useful next action.
-   Preserve filters and form values after recoverable errors.
-   Show last-updated time where freshness matters.
-   Never convert missing data into zero or success.
-   Backend state remains authoritative.

## 11. Anti-patterns and prohibited implementations

Prohibited unless a documented requirement justifies an exception: -
Generic AI dashboard layouts made from identical cards. - Giant headings
that push operational content below the fold. - Excessive gradients,
neon glow, glassmorphism, or blurred backgrounds. - Random charts and
fake metrics. - Emoji as product icons, status icons, or brand assets. -
Arbitrary colors or one-off spacing. - Nested rounded cards without
clear hierarchy. - Tiny low-contrast metadata. - Ambiguous labels such
as "Go", "Proceed", or "Do it". - Hover-only controls. - Hidden focus
indicators. - Fake progress bars or fabricated logs. - Green success
styling before verification. - Unclear staging/production distinction. -
Destructive actions beside routine actions without separation. - Secrets
in forms, logs, or audit records. - Full-screen modals for routine
low-risk edits. - Unnecessary animations competing with live data. -
Repeated taglines or oversized branding in operational pages. -
Components shipped without state and accessibility rules.

## 12. Implementation workflow

1.  Inspect the existing application, routes, components, and styles
    before redesigning.
2.  Identify the token source and map it to this semantic system.
3.  Record conflicts and make token migration explicit.
4.  Refine shared primitives before migrating pages.
5.  Apply Pipra branding, navigation, typography, and layout
    consistently.
6.  Prioritize live deployment detail, deployment wizard, history, and
    overview.
7.  Connect UI to real backend contracts; do not create
    presentation-only success paths.
8.  Implement component states and responsive behavior.
9.  Test accessibility and critical operator flows.
10. Remove obsolete styles only after checking consumers.
11. Update visual references after the implementation stabilizes.
12. Document deliberate deviations.

Do not rewrite the application framework solely to achieve the design.
Reuse the existing stack when sound.

## 13. QA checklist

### Brand and visual consistency

-   [ ] Approved Pipra assets are used consistently.
-   [ ] No emoji are used as product icons.
-   [ ] Semantic tokens are centralized.
-   [ ] Typography, spacing, radius, borders, and motion are consistent.
-   [ ] Gradients are limited to intentional brand accents.
-   [ ] Operational content is prioritized over decoration.

### Components and interaction

-   [ ] Components define applicable states.
-   [ ] Keyboard, pointer, and touch interactions work.
-   [ ] Loading, empty, error, disabled, and stale states exist.
-   [ ] Long content and overflow are handled.
-   [ ] Primary actions are functional and clearly named.

### Operational clarity

-   [ ] Deployment status reflects persisted backend state.
-   [ ] Execution survives browser refresh and reconnects.
-   [ ] Stage timings and logs are real.
-   [ ] Failed, unknown, stale, and successful states are distinct.
-   [ ] Production actions communicate target and impact.
-   [ ] Rollback claims have verification evidence.
-   [ ] No fake metrics or infrastructure status appear.

### Accessibility and delivery

-   [ ] Keyboard navigation and visible focus work.
-   [ ] Applicable WCAG 2.2 AA contrast criteria pass.
-   [ ] Status does not rely on color alone.
-   [ ] Forms and dialogs are accessible.
-   [ ] Reduced motion is respected.
-   [ ] Desktop, tablet, mobile, and zoom layouts are tested.
-   [ ] Relevant automated checks and manual critical-flow checks are
    completed.
-   [ ] Deviations are documented.

## 14. Quality gates

-   Every non-negotiable rule must use **must**.
-   Every recommendation must use **should**.
-   Every accessibility requirement must have a testable pass/fail
    criterion.
-   Every interactive component must define applicable state behavior.
-   Every page must handle loading, empty, error, and stale data where
    relevant.
-   System consistency must take priority over local visual exceptions.
-   Real operational evidence must take priority over decorative
    presentation.
-   Deviations must be documented and justified.
