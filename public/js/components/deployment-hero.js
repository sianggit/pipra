/**
 * Pipra 3D Active Deployment Execution Hero Component
 * Displays live aerodynamic flight telemetry while pipeline stages execute.
 */

import { createBirdScene } from './loading-screen.js';

let heroBirdScene = null;

export function renderDeploymentHeroHtml(deployment) {
  const currentStageNum = deployment.current_stage || 1;
  const stageName = (deployment.stages && deployment.stages.find(s => s.stage_number === currentStageNum)?.stage_name) || `Stage ${currentStageNum}`;
  const totalStages = 10;
  const progressPct = Math.round((currentStageNum / totalStages) * 100);

  return `
    <div class="deployment-hero-card" id="deployment-hero-hud">
      <div class="hero-canvas-wrap">
        <canvas id="deployment-hero-canvas"></canvas>
      </div>
      <div class="hero-meta">
        <div class="hero-badge">
          <span class="hero-pulse"></span>
          <span>Pipeline In Flight · Stage ${currentStageNum} of ${totalStages} (${progressPct}%)</span>
        </div>
        <h2 class="hero-title">
          <span>Executing: ${stageName}</span>
        </h2>
        <p class="hero-desc">
          Live container build & cutover automation in progress. Real-time telemetry streamed via secure control plane bridge.
        </p>
      </div>
      <div style="text-align: right; font-family: var(--m); font-size: 13px; color: var(--pr); min-width: 100px;">
        <div style="font-size: 20px; font-weight: 700;">${progressPct}%</div>
        <div style="font-size: 11px; color: var(--t3); text-transform: uppercase;">Progress</div>
      </div>
    </div>
  `;
}

export function mountDeploymentHero(container, deployment) {
  if (!container) return;
  const isTerminal = ['SUCCEEDED', 'FAILED', 'CANCELLED', 'INTERRUPTED', 'ROLLBACK_FAILED'].includes(deployment.status);
  if (isTerminal) {
    destroyDeploymentHero();
    container.innerHTML = '';
    return;
  }

  container.innerHTML = renderDeploymentHeroHtml(deployment);
  const canvas = document.getElementById('deployment-hero-canvas');
  if (canvas && typeof window.THREE !== 'undefined') {
    if (heroBirdScene) {
      heroBirdScene.destroy();
      heroBirdScene = null;
    }
    heroBirdScene = createBirdScene(canvas, {
      scale: 0.0076,
      cameraZ: 22,
      showRing: false,
      enablePointer: false,
    });
  }
}

export function updateDeploymentHeroTelemetry(deployment) {
  const hud = document.getElementById('deployment-hero-hud');
  if (!hud) return;
  const isTerminal = ['SUCCEEDED', 'FAILED', 'CANCELLED', 'INTERRUPTED', 'ROLLBACK_FAILED'].includes(deployment.status);
  if (isTerminal) {
    destroyDeploymentHero();
    hud.remove();
    return;
  }

  const currentStageNum = deployment.current_stage || 1;
  const stageName = (deployment.stages && deployment.stages.find(s => s.stage_number === currentStageNum)?.stage_name) || `Stage ${currentStageNum}`;
  const totalStages = 10;
  const progressPct = Math.round((currentStageNum / totalStages) * 100);

  const titleEl = hud.querySelector('.hero-title span');
  if (titleEl) titleEl.textContent = `Executing: ${stageName}`;

  const badgeEl = hud.querySelector('.hero-badge span:last-child');
  if (badgeEl) badgeEl.textContent = `Pipeline In Flight · Stage ${currentStageNum} of ${totalStages} (${progressPct}%)`;

  const pctEl = hud.querySelector('div[style*="font-size: 20px"]');
  if (pctEl) pctEl.textContent = `${progressPct}%`;
}

export function destroyDeploymentHero() {
  if (heroBirdScene) {
    heroBirdScene.destroy();
    heroBirdScene = null;
  }
}

