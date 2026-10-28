/**
 * Pipra Environments Management Page
 * Target environments, cutover strategies, risk ratings, and automated rollback policies.
 */

import { api } from '../api.js';
import { renderIcon } from '../icons.js';
import { renderStatusBadge } from '../components/health-badge.js';

export async function renderEnvsPage(container) {
  container.innerHTML = `
    <div style="padding: var(--space-8); text-align: center; color: var(--color-text-secondary);">
      <div style="font-family: var(--font-family-mono); font-size: var(--font-size-sm);">Loading environments...</div>
    </div>
  `;

  try {
    const envs = await api.getEnvironments();

    container.innerHTML = `
      <div class="page-header">
        <div class="page-title-group">
          <h1>
            ${renderIcon('server', 22)}
            <span>Deployment Environments</span>
          </h1>
          <p class="page-subtitle">Serving targets, cutover strategies, risk ratings, and automated rollback policies.</p>
        </div>
      </div>

      <div style="display: flex; flex-direction: column; gap: var(--space-5);">
        ${envs.map(env => {
          const isProd = env.is_production;
          return `
            <div class="card" style="margin-bottom: 0; border-left: 3px solid ${isProd ? 'var(--color-status-danger)' : 'var(--color-action-primary)'};">
              <div class="card-header">
                <div style="display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap;">
                  <span class="card-title">${env.display_name}</span>
                  <span class="env-tag ${isProd ? 'env-tag-prod' : 'env-tag-nonprod'}">
                    ${isProd ? renderIcon('shield', 12) : renderIcon('box', 12)}
                    <span>${isProd ? 'PRODUCTION CRITICAL' : 'NON-PRODUCTION'}</span>
                  </span>
                </div>
                <div>
                  <a href="#/deploy?env=${env.id}" class="btn ${isProd ? 'btn-secondary' : 'btn-primary'} btn-sm" aria-label="Deploy to ${env.name}">
                    ${renderIcon('play', 12)}
                    <span>Deploy to ${env.name}</span>
                  </a>
                </div>
              </div>

              <div class="card-body">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: var(--space-4);">
                  <div>
                    <span style="font-size: var(--font-size-2xs); color: var(--color-text-secondary); text-transform: uppercase; font-weight: 600;">Target Host & Worker</span>
                    <div style="font-weight: 600; font-family: var(--font-family-mono); font-size: 13px; margin-top: 2px; color: var(--color-text-primary);">${env.host}</div>
                    <div style="font-size: 11px; color: var(--color-text-muted);">${env.agent_id}</div>
                  </div>

                  <div>
                    <span style="font-size: var(--font-size-2xs); color: var(--color-text-secondary); text-transform: uppercase; font-weight: 600;">Active Live Release</span>
                    <div style="font-weight: 600; font-family: var(--font-family-mono); font-size: 13px; color: var(--color-action-primary); margin-top: 2px;">
                      ${env.active_release_id || 'asdp-dims-fe:devel-latest'}
                    </div>
                    <div style="font-size: 11px; color: var(--color-text-muted);">Serving live traffic</div>
                  </div>

                  <div>
                    <span style="font-size: var(--font-size-2xs); color: var(--color-text-secondary); text-transform: uppercase; font-weight: 600;">Health Verification</span>
                    <div style="margin-top: 4px;">
                      ${renderStatusBadge(env.last_health_status || 'HEALTHY')}
                    </div>
                    <div style="font-size: 11px; color: var(--color-text-muted); margin-top: 2px;">
                      Last verified: ${env.last_verified_at ? new Date(env.last_verified_at).toLocaleTimeString() : 'N/A'}
                    </div>
                  </div>

                  <div>
                    <span style="font-size: var(--font-size-2xs); color: var(--color-text-secondary); text-transform: uppercase; font-weight: 600;">Cutover Safeguards</span>
                    <div style="font-size: 12px; margin-top: 2px; color: var(--color-text-primary); line-height: 18px;">
                      ${isProd 
                        ? '• Operator confirmation barrier<br>• Automated sub-second rollback<br>• Target concurrency locks' 
                        : '• Staging health check barrier<br>• Automated cleanup on abort'}
                    </div>
                  </div>
                </div>

                ${isProd ? `
                  <div style="margin-top: var(--space-4); padding: var(--space-3) var(--space-4); background-color: var(--color-status-danger-bg); border: 1px solid var(--color-status-danger-border); border-radius: var(--radius-sm); font-size: 12px; color: var(--color-text-primary); display: flex; align-items: flex-start; gap: var(--space-3);">
                    <span style="color: var(--color-status-danger); margin-top: 2px;">${renderIcon('shield', 16)}</span>
                    <div>
                      <strong style="color: var(--color-status-danger);">Production Safety Guardrail:</strong>
                      Deployments to this target environment require explicit operator confirmation and trigger continuous post-cutover verification probes. If health checks fail, the engine immediately rolls back to the previous release.
                    </div>
                  </div>
                ` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  } catch (err) {
    container.innerHTML = `
      <div class="card" style="border-left: 3px solid var(--color-status-danger);">
        <div class="card-body">
          <h3 style="color: var(--color-status-danger); margin-bottom: var(--space-2);">Error loading environments</h3>
          <p style="color: var(--color-text-secondary);">${err.message}</p>
        </div>
      </div>
    `;
  }
}
