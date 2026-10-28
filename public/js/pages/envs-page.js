/**
 * Pipra Environments Management Page
 */

import { api } from '../api.js';
import { renderIcon } from '../icons.js';
import { renderStatusBadge } from '../components/health-badge.js';

export async function renderEnvsPage(container) {
  container.innerHTML = `<div style="padding: 24px; color: var(--color-text-secondary);">Loading environments...</div>`;

  try {
    const envs = await api.getEnvironments();

    container.innerHTML = `
      <div class="page-header">
        <div class="page-title-group">
          <h1>
            ${renderIcon('server', 24)}
            <span>Deployment Environments</span>
          </h1>
          <p class="page-subtitle">Serving targets, cutover strategies, risk ratings, and automated rollback policies.</p>
        </div>
      </div>

      <div style="display: flex; flex-direction: column; gap: var(--space-6);">
        ${envs.map(env => {
          const isProd = env.is_production;
          return `
            <div class="card" style="margin-bottom: 0; border-left: 4px solid ${isProd ? '#ef4444' : '#3b82f6'};">
              <div class="card-header">
                <div style="display: flex; align-items: center; gap: var(--space-4);">
                  <span class="card-title">${env.display_name}</span>
                  <span class="env-tag ${isProd ? 'env-tag-prod' : 'env-tag-nonprod'}">
                    ${isProd ? renderIcon('shield', 12) : renderIcon('box', 12)}
                    <span>${isProd ? 'CRITICAL / PRODUCTION' : 'STANDARD / NON-PROD'}</span>
                  </span>
                </div>
                <div>
                  <a href="#/deploy?env=${env.id}" class="btn ${isProd ? 'btn-secondary' : 'btn-primary'} btn-sm">
                    ${renderIcon('play', 12)}
                    <span>Deploy to ${env.name}</span>
                  </a>
                </div>
              </div>

              <div class="card-body">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: var(--space-6);">
                  <div>
                    <span style="font-size: var(--font-size-xs); color: var(--color-text-secondary); text-transform: uppercase;">Target Host & Agent</span>
                    <div style="font-weight: 600; font-family: var(--font-family-mono); font-size: 13px; margin-top: 2px;">${env.host}</div>
                    <div style="font-size: 11px; color: var(--color-text-tertiary);">${env.agent_id}</div>
                  </div>

                  <div>
                    <span style="font-size: var(--font-size-xs); color: var(--color-text-secondary); text-transform: uppercase;">Active Live Release</span>
                    <div style="font-weight: 600; font-family: var(--font-family-mono); font-size: 13px; color: var(--color-surface-raised); margin-top: 2px;">
                      ${env.active_release_id || 'asdp-dims-fe:devel-latest'}
                    </div>
                    <div style="font-size: 11px; color: var(--color-text-tertiary);">Serving live traffic</div>
                  </div>

                  <div>
                    <span style="font-size: var(--font-size-xs); color: var(--color-text-secondary); text-transform: uppercase;">Health Verification</span>
                    <div style="margin-top: 4px;">
                      ${renderStatusBadge(env.last_health_status || 'HEALTHY')}
                    </div>
                    <div style="font-size: 11px; color: var(--color-text-tertiary); margin-top: 2px;">
                      Verified: ${env.last_verified_at ? new Date(env.last_verified_at).toLocaleTimeString() : 'N/A'}
                    </div>
                  </div>

                  <div>
                    <span style="font-size: var(--font-size-xs); color: var(--color-text-secondary); text-transform: uppercase;">Cutover Safeguards</span>
                    <div style="font-size: 12px; margin-top: 2px; color: var(--color-text-primary);">
                      ${isProd ? '• Explicit confirmation required<br>• Automated sub-second rollback<br>• Concurrency locks enabled' : '• Staging health check barrier<br>• Auto-cleanup on failure'}
                    </div>
                  </div>
                </div>

                ${isProd ? `
                  <div style="margin-top: var(--space-6); padding: var(--space-4) var(--space-6); background-color: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.25); border-radius: var(--radius-sm); font-size: 12px; color: #fca5a5; display: flex; align-items: center; gap: var(--space-3);">
                    ${renderIcon('alert-triangle', 16)}
                    <span><strong>Production Protection Gate:</strong> Deployments to this environment require operator confirmation and trigger continuous post-cutover verification. If HTTP checks fail, the engine immediately rolls back to the backup release.</span>
                  </div>
                ` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div style="color: var(--color-status-error);">Error: ${err.message}</div>`;
  }
}
