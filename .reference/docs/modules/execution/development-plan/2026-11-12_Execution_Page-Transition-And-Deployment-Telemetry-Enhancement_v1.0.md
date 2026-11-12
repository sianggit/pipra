# Architecture & Implementation Plan: Page Transitions, Embedded 3D Deployment Hero, Real-Time Stage Synchronization & Expanded Log Terminal

**Document ID:** `.reference/docs/modules/execution/development-plan/2026-11-12_Execution_Page-Transition-And-Deployment-Telemetry-Enhancement_v1.0.md`  
**Module:** Execution & Frontend Telemetry  
**Target Platform:** Pipra Control Plane (`http://172.25.230.100:4200`)  
**Status:** COMPLETED & VERIFIED ONLINE (`http://172.25.230.100:4200`)  
**Date:** 2026-11-12  

---

## 1. Executive Summary & Problem Diagnosis

Based on operational feedback from running Pipra on the development host (`172.25.230.100`), four key frontend telemetry and visual UX enhancements are required:

| # | Requirement | Current State | Root Cause Analysis | Target State |
|---|---|---|---|---|
| **1** | **Page Transition Loading Screen** | Only fires once on initial cold boot in `app.js`. Route changes in `router.js` swap DOM instantly without transition feedback. | `Router.handleRoute()` clears and repopulates `#main-content` directly without transition hooks or loading indicators. | Trigger a smooth, non-intrusive transition overlay with a lightweight 3D Pipra flight cycle during page transitions, automatically fading out once the route target renders. |
| **2** | **Extract Pipra Loading Animation for Deployment** | 3D bird canvas is locked inside `loading-screen.js` full-page wrapper. | No modular export of the 3D bird canvas as an embedded HUD widget for active execution states. | Extract reusable `PipraHeroCanvas` component and mount it on `/deployments/:id` while status is active (`QUEUED`, `PREFLIGHT`, `BUILDING`, etc.), displaying live aerodynamic flight during pipeline execution. |
| **3** | **Real-Time Deployment Stage Auto-Updates** | User must manually reload the page (`F5`) to see stage progression and status changes. | 1. `deployment-detail.js` did not wire the `onStage` callback to `DeploymentEventStream`.<br>2. No periodic polling reconciliation fallback when SSE disconnects or proxy buffers SSE events on remote servers. | Dual-Transport Synchronization: Wire `onStage` and `onStateChange` handlers with granular timeline DOM reconciliation + 2-second background polling fallback while execution is in progress. |
| **4** | **Expanded Terminal Log Coverage** | `.log` terminal is constrained to `max-height: 380px`, leaving excessive dead space and forcing excessive scrolling. | Static CSS rule `.log { max-height: 380px; }` in `components.css`. | Dynamic viewport flex layout (`height: calc(100vh - 240px); min-height: 580px;`) with auto-scroll anchor, sticky toolbar, and maximized terminal coverage. |

---

## 2. Applicable Files Breakdown

The following files are identified for modification and enhancement:

```
public/
├── css/
│   ├── components.css            # Update .log and .cols container heights to full-viewport flex
│   └── loading-screen.css        # Add styles for .page-transition-overlay and .deployment-hero-card
├── js/
│   ├── components/
│   │   ├── loading-screen.js     # Refactor: extract reusable createBirdScene() + page transition overlay
│   │   ├── deployment-hero.js    # [NEW] Embedded 3D flight HUD widget for active deployments
│   │   └── log-viewer.js         # Update layout, height classes, and sticky log counter
│   ├── pages/
│   │   └── deployment-detail.js  # Wire onStage SSE listener, add dual-transport polling fallback, mount hero
│   ├── router.js                 # Hook page transition overlay during route changes
│   └── sse.js                    # Ensure resilient reconnection and stage event propagation
```

---

## 3. Detailed Architectural Design

### 3.1 Page Transition Animation (`router.js` & `loading-screen.js`)
- **Mechanism:**
  - In `loading-screen.js`, export `showPageTransition()` and `hidePageTransition()`.
  - When route navigation begins in `router.js`, `showPageTransition()` activates a subtle high-contrast backdrop with a centered mini Pipra flight canvas and pulse halo.
  - To prevent UI flicker on fast navigation, the transition has a minimum display threshold (e.g. 200ms) and maximum ceiling (450ms) to ensure butter-smooth rendering without blocking user interactions.
  - Reduced-motion accessible: Fallback to CSS opacity fade if `prefers-reduced-motion` is detected.

### 3.2 Extracted 3D Pipra Deployment Hero (`deployment-hero.js`)
- **Visual Design:**
  - Render an executive **Active Execution HUD** at the top of `/deployments/:id` while status is active (`isTerminal === false`):
    - Left side: High-performance 3D Pipra bird flapping wings in aerodynamic cruise flight.
    - Right side: Live stage telemetry, active stage name, elapsed timer, and real-time step counter.
  - When deployment completes (`SUCCEEDED` or `FAILED`):
    - Smoothly transitions: on success, the bird glides upward with a green success halo; on failure, halts gently with diagnostic indicators.

### 3.3 Real-Time Stage Synchronization (`deployment-detail.js` & `sse.js`)
- **Root Cause Resolution:**
  1. **Wire SSE `onStage` Listener:**
     ```javascript
     onStage: (stageEvent) => {
       // Update in-memory deployment stages
       const existing = deployment.stages.find(s => s.stage_number === stageEvent.stageNumber);
       if (existing) {
         Object.assign(existing, { status: stageEvent.status, duration_ms: stageEvent.durationMs });
       } else {
         deployment.stages.push({
           stage_number: stageEvent.stageNumber,
           stage_name: stageEvent.stageName,
           status: stageEvent.status,
           duration_ms: stageEvent.durationMs
         });
       }
       // Immediately update pipeline timeline without full page re-render
       updatePipelineMount();
     }
     ```
  2. **Dual-Transport Polling Reconciliation:**
     - Add `setInterval(async () => { ... }, 2000)` while `isRunning === true`.
     - Calls `api.getDeployment(deploymentId)` to reconcile stage status, duration, and pipeline state in the event of dropped SSE packets, reverse proxy buffering, or network stalls.
     - Automatically terminates polling when deployment reaches a terminal state (`SUCCEEDED`, `FAILED`, `CANCELLED`).

### 3.4 Full-Viewport Terminal Log Section (`components.css` & `log-viewer.js`)
- **Layout Adjustments:**
  - Change `.log` from `max-height: 380px` to `flex: 1 1 auto; height: calc(100vh - 260px); min-height: 560px; max-height: calc(100vh - 220px);`.
  - Right column of `.cols` becomes a flex column occupying the full vertical height of the viewport.
  - Left column remains a sticky diagnostics sidebar (`align-self: flex-start; position: sticky; top: 16px;`).
  - Terminal auto-scroll lock: automatically stick to bottom when streaming live logs unless the user scrolls up to inspect previous output.

---

## 4. Verification Matrix & Scenarios

| Scenario ID | Test Case | Target Behavior | Verification Method |
|---|---|---|---|
| **SC-01** | Page Transition Trigger | Clicking any nav link (e.g. Overview -> Applications -> Deployments) displays the Pipra transition animation and seamlessly resolves into the new view. | Browser navigation test & Playwright route change check |
| **SC-02** | Active Deployment Hero | Navigating to an active deployment (`/deployments/:id`) displays the extracted 3D Pipra flight HUD canvas with live stage metrics. | Trigger deployment -> Inspect DOM for `#deployment-hero-canvas` and active WebGL render loop |
| **SC-03** | Terminal State Hero Transition | When pipeline completes, the 3D hero smoothly transitions into finished state without WebGL context leaks. | Observe transition at Stage 10 cutover -> WebGL animation loop gracefully clears |
| **SC-04** | Live Stage Progression (Zero-Reload) | When a stage completes, the pipeline timeline track reflects status change (`RUNNING` -> `SUCCEEDED`) in sub-second time without page reload. | Monitor SSE `stage` events and DOM `#pipeline-mount` updates |
| **SC-05** | Dual-Transport Resilience | Simulate SSE disconnection or delayed packets; stage status updates within 2s via background polling fallback. | Block SSE route temporarily in DevTools network tab -> verify timeline updates via polling |
| **SC-06** | Full-Height Terminal Coverage | Terminal log console extends vertically to match viewport height, maximizing log visibility without excessive nested scroll bars. | Measure `.log` computed height across 1080p, 1440p, and 900p viewports |
| **SC-07** | Automated Regression Suite | All 78 backend unit/integration tests continue passing without regression. | Run `npm test` |

---

## 5. Rollout & Deployment Sequence

1. **Phase 1: Component Refactoring (Local)**
   - Extract `createBirdScene()` from `loading-screen.js` to create modular 3D instance factory.
   - Implement `public/js/components/deployment-hero.js`.
   - Update `public/js/router.js` with `showPageTransition()` / `hidePageTransition()`.
2. **Phase 2: Live Telemetry & Viewport CSS (Local)**
   - Update `deployment-detail.js` with `onStage` handler and background reconciliation poller.
   - Update `components.css` and `log-viewer.js` for full-height responsive terminal layout.
3. **Phase 3: Automated Testing & Verification**
   - Run local test suite (`npm test`).
   - Validate Three.js canvas cleanup and memory leak prevention (`cancelAnimationFrame`, geometry disposal).
4. **Phase 4: Remote Production Server Deployment (`172.25.230.100`)**
   - Grouped Git commit and push to `https://github.com/sianggit/pipra` (`master` branch).
   - Remote `git pull` and service reload on `172.25.230.100`.
   - Live browser verification on `http://172.25.230.100:4200`.

