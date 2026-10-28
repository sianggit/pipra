/**
 * Pipra Overview Dashboard Page
 * High-density operational cockpit: Attention required, active executions,
 * environment matrix, and recent deployment ledger.
 */

import { api } from '../api.js';
import { renderIcon } from '../icons.js';
import { renderStatusBadge } from '../components/health-badge.js';

export async function renderOverviewPage(container) {
  container.innerHTML = `
    <div style="padding: var(--space-8); text-align: center; color: var(--color-text-secondary);">
      <div style="font-family: var(--font-family-mono); font-size: var(--font-size-sm);">Loading platform telemetry...</div>
    </div>
  `;

  try {
    const stats = await api.getOverviewStats();
    const { metrics, recentDeployments = [], environments = [], agents = [] } = stats;

    const avgDurationSec = metrics.avgDurationMs ? (metrics.avgDurationMs / 1000).toFixed(1) : '0';

    // Identify active jobs and items needing attention
    const activeDeployments = recentDeployments.filter(d => ['RUNNING', 'PREPARING', 'VERIFYING', 'CUTTING_OVER'].includes(d.status));
    const failedRecent = recentDeployments.filter(d => ['FAILED', 'ROLLBACK_FAILED'].includes(d.status));
    const unhealthyEnvs = environments.filter(e => e.last_health_status && e.last_health_status !== 'HEALTHY');
    const offlineAgents = agents.filter(a => a.status && a.status !== 'ONLINE');

    const hasAttentionItems = failedRecent.length > 0 || unhealthyEnvs.length > 0 || offlineAgents.length > 0;

    container.innerHTML = `
      <div class="page-header">
        <div class="page-title-group">
          <h1>
            ${renderIcon('activity', 22)}
            <span>Release Operations Overview</span>
          </h1>
          <p class="page-subtitle">Real-time pipeline execution, serving environment health, and cutover telemetry.</p>
        </div>
        <div>
          <a href="#/deploy" class="btn btn-primary" aria-label="Start new deployment pipeline">
            ${renderIcon('play', 14)}
            <span>Start Deployment</span>
          </a>
        </div>
      </div>

      <!-- Restrained Operational Metrics Bar -->
      <div class="stats-grid">
        <div class="stat-card">
          <span class="stat-label">Total Deployments</span>
          <span class="stat-value">${metrics.total}</span>
          <span class="stat-subtext">${metrics.succeeded} verified releases</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Active Pipelines</span>
          <span class="stat-value" style="color: ${metrics.active > 0 ? 'var(--color-action-indigo)' : 'var(--color-text-primary)'};">
            ${metrics.active}
          </span>
          <span class="stat-subtext">${metrics.active > 0 ? 'Executing on worker agents' : 'Engine ready'}</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Verification Rate</span>
          <span class="stat-value" style="color: var(--color-status-success);">${metrics.successRate}%</span>
          <span class="stat-subtext">${metrics.failed} failed / rolled back</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Average Pipeline Time</span>
          <span class="stat-value">${avgDurationSec}s</span>
          <span class="stat-subtext">Mean duration across runs</span>
        </div>
      </div>

      <!-- Active Deployments Banner (If any running) -->
      ${activeDeployments.length > 0 ? `
        <div class="card" style="border-left: 3px solid var(--color-action-indigo); margin-bottom: var(--space-6);">
          <div class="card-header">
            <span class="card-title">
              <span class="badge-dot" style="background-color: var(--color-action-indigo); animation: badge-pulse 1s infinite ease-in-out;"></span>
              <span>Active Pipeline Executions (${activeDeployments.length})</span>
            </span>
            <span style="font-size: var(--font-size-xs); color: var(--color-text-secondary);">Real-time SSE streaming active</span>
          </div>
          <div class="card-body" style="padding: 0;">
            <table>
              <thead>
                <tr>
                  <th>Deployment ID</th>
                  <th>Application</th>
                  <th>Environment</th>
                  <th>Current Stage</th>
                  <th>Elapsed</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                ${activeDeployments.map(d => `
                  <tr>
                    <td style="font-family: var(--font-family-mono); font-size: 12px;">
                      <a href="#/deployments/${d.id}" style="font-weight: 600;">${d.id}</a>
                    </td>
                    <td><strong>${d.app_display_name || d.app_name}</strong></td>
                    <td>
                      <span class="env-tag ${d.is_production ? 'env-tag-prod' : 'env-tag-nonprod'}">
                        ${(d.env_name || '').toUpperCase()}
                      </span>
                    </td>
                    <td>${renderStatusBadge(d.status)}</td>
                    <td style="font-family: var(--font-family-mono); font-size: 12px;">${d.duration_ms ? `${(d.duration_ms / 1000).toFixed(1)}s` : 'in progress...'}</td>
                    <td>
                      <a href="#/deployments/${d.id}" class="btn btn-secondary btn-sm">
                        ${renderIcon('terminal', 12)}
                        <span>Watch Live</span>
                      </a>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      ` : ''}

      <!-- Attention Required Section (If anomalies detected) -->
      ${hasAttentionItems ? `
        <div class="card" style="border-left: 3px solid var(--color-status-danger); margin-bottom: var(--space-6);">
          <div class="card-header">
            <span class="card-title" style="color: var(--color-status-danger);">
              ${renderIcon('alert-triangle', 16)}
              <span>Attention Required</span>
            </span>
            <span style="font-size: var(--font-size-xs); color: var(--color-text-secondary);">Infrastructure anomalies & recent failures</span>
          </div>
          <div class="card-body" style="padding: var(--space-4) var(--space-5);">
            <div style="display: flex; flex-direction: column; gap: var(--space-2); font-size: 12px;">
              ${failedRecent.slice(0, 2).map(f => `
                <div style="display: flex; align-items: center; justify-content: space-between; padding: var(--space-2) var(--space-3); background-color: var(--color-surface-strong); border-radius: var(--radius-sm); border: 1px solid var(--color-border-subtle);">
                  <span>Recent failure on <strong>${f.app_display_name || f.app_name}</strong> (${(f.env_name || '').toUpperCase()}): ${f.error_message || 'Verification probe failed'}</span>
                  <a href="#/deployments/${f.id}" class="btn btn-secondary btn-sm">Inspect Diagnostics</a>
                </div>
              `).join('')}
              ${unhealthyEnvs.map(e => `
                <div style="display: flex; align-items: center; justify-content: space-between; padding: var(--space-2) var(--space-3); background-color: var(--color-surface-strong); border-radius: var(--radius-sm); border: 1px solid var(--color-border-subtle);">
                  <span>Environment <strong>${e.display_name}</strong> reported unhealthy status: <code>${e.last_health_status}</code></span>
                  <a href="#/environments" class="btn btn-secondary btn-sm">Review Health</a>
                </div>
              `).join('')}
              ${offlineAgents.map(a => `
                <div style="display: flex; align-items: center; justify-content: space-between; padding: var(--space-2) var(--space-3); background-color: var(--color-surface-strong); border-radius: var(--radius-sm); border: 1px solid var(--color-border-subtle);">
                  <span>Execution agent <strong>${a.name}</strong> is currently offline</span>
                  <a href="#/infrastructure" class="btn btn-secondary btn-sm">Check Agent</a>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      ` : ''}

      <!-- Environments & Infrastructure Health Grid -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: var(--space-6); margin-bottom: var(--space-6);">
        <!-- Environments Card -->
        <div class="card" style="margin-bottom: 0;">
          <div class="card-header">
            <span class="card-title">
              ${renderIcon('server', 16)}
              <span>Serving Environments</span>
            </span>
            <a href="#/environments" class="btn btn-ghost btn-sm">Manage</a>
          </div>
          <div class="card-body" style="padding: 0;">
            <table>
              <thead>
                <tr>
                  <th>Environment</th>
                  <th>Active Release</th>
                  <th>Health Status</th>
                </tr>
              </thead>
              <tbody>
                ${environments.map(env => `
                  <tr>
                    <td>
                      <div style="font-weight: 600;">${env.display_name}</div>
                      <div style="font-size: 11px; color: var(--color-text-secondary); font-family: var(--font-family-mono);">${env.host}</div>
                    </td>
                    <td>
                      <span style="font-family: var(--font-family-mono); font-size: 12px; color: var(--color-action-primary);">
                        ${env.active_release_id || 'asdp-dims-fe:devel-latest'}
                      </span>
                    </td>
                    <td>${renderStatusBadge(env.last_health_status || 'HEALTHY')}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Execution Agents Card -->
        <div class="card" style="margin-bottom: 0;">
          <div class="card-header">
            <span class="card-title">
              ${renderIcon('cpu', 16)}
              <span>Execution Agents</span>
            </span>
            <a href="#/infrastructure" class="btn btn-ghost btn-sm">Details</a>
          </div>
          <div class="card-body" style="padding: 0;">
            <table>
              <thead>
                <tr>
                  <th>Agent Host</th>
                  <th>Engine</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${agents.map(ag => `
                  <tr>
                    <td>
                      <div style="font-weight: 600;">${ag.name}</div>
                      <div style="font-size: 11px; color: var(--color-text-secondary); font-family: var(--font-family-mono);">${ag.host}</div>
                    </td>
                    <td style="font-size: 12px; color: var(--color-text-secondary); font-family: var(--font-family-mono);">${ag.docker_version}</td>
                    <td>${renderStatusBadge(ag.status)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Recent Deployments Ledger -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">
            ${renderIcon('clock', 16)}
            <span>Recent Deployment Ledger</span>
          </span>
          <a href="#/history" class="btn btn-secondary btn-sm">Full History</a>
        </div>
        <div class="card-body" style="padding: 0;">
          ${recentDeployments.length === 0 ? `
            <div style="padding: var(--space-8); text-align: center; color: var(--color-text-muted);">
              No deployment runs recorded yet. Click "Start Deployment" to launch your first pipeline.
            </div>
          ` : `
            <table>
              <thead>
                <tr>
                  <th>Deployment ID</th>
                  <th>Application</th>
                  <th>Environment</th>
                  <th>Branch / Tag</th>
                  <th>Status</th>
                  <th>Duration</th>
                  <th>Timestamp</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${recentDeployments.map(d => {
                  const duration = d.duration_ms ? `${(d.duration_ms / 1000).toFixed(1)}s` : '--';
                  const timeAgo = d.created_at ? new Date(d.created_at).toLocaleTimeString() : '';
                  return `
                    <tr>
                      <td style="font-family: var(--font-family-mono); font-size: 12px;">
                        <a href="#/deployments/${d.id}" style="font-weight: 600;">${d.id}</a>
                      </td>
                      <td><strong>${d.app_display_name || d.app_name}</strong></td>
                      <td>
                        <span class="env-tag ${d.is_production ? 'env-tag-prod' : 'env-tag-nonprod'}">
                          ${(d.env_name || '').toUpperCase()}
                        </span>
                      </td>
                      <td style="font-family: var(--font-family-mono); font-size: 12px;">
                        ${d.branch} <span style="color: var(--color-text-secondary);">@${d.image_tag}</span>
                      </td>
                      <td>${renderStatusBadge(d.status)}</td>
                      <td style="font-family: var(--font-family-mono); font-size: 12px;">${duration}</td>
                      <td style="font-size: 12px; color: var(--color-text-secondary);">${timeAgo}</td>
                      <td>
                        <a href="#/deployments/${d.id}" class="btn btn-secondary btn-sm" aria-label="View deployment ${d.id}">
                          ${renderIcon('external-link', 12)}
                          <span>View</span>
                        </a>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          `}
        </div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `
      <div class="card" style="border-left: 3px solid var(--color-status-danger);">
        <div class="card-body">
          <h3 style="color: var(--color-status-danger); margin-bottom: var(--space-2);">Error loading overview telemetry</h3>
          <p style="color: var(--color-text-secondary);">${err.message}</p>
        </div>
      </div>
    `;
  }
}
