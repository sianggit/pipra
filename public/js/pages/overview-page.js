/**
 * Pipra Overview Dashboard Page
 */

import { api } from '../api.js';
import { renderIcon } from '../icons.js';
import { renderStatusBadge } from '../components/health-badge.js';

export async function renderOverviewPage(container) {
  container.innerHTML = `<div style="padding: 24px; color: var(--color-text-secondary);">Loading platform telemetry...</div>`;

  try {
    const stats = await api.getOverviewStats();
    const { metrics, recentDeployments, environments, agents } = stats;

    const avgDurationSec = metrics.avgDurationMs ? (metrics.avgDurationMs / 1000).toFixed(1) : '0';

    container.innerHTML = `
      <div class="page-header">
        <div class="page-title-group">
          <h1>
            ${renderIcon('activity', 24)}
            <span>Release Operations Overview</span>
          </h1>
          <p class="page-subtitle">Continuous deployment observability, pipeline health, and cutover telemetry.</p>
        </div>
        <div>
          <a href="#/deploy" class="btn btn-primary">
            ${renderIcon('play', 14)}
            <span>Deploy Application</span>
          </a>
        </div>
      </div>

      <!-- KPI Metrics Grid -->
      <div class="stats-grid">
        <div class="stat-card">
          <span class="stat-label">Total Deployments</span>
          <span class="stat-value">${metrics.total}</span>
          <span class="stat-subtext">${metrics.succeeded} successful releases</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Active Jobs</span>
          <span class="stat-value" style="color: ${metrics.active > 0 ? 'var(--color-surface-raised)' : 'var(--color-text-primary)'};">
            ${metrics.active}
          </span>
          <span class="stat-subtext">${metrics.active > 0 ? 'Pipelines executing in background' : 'Engine idle & ready'}</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Success Rate</span>
          <span class="stat-value" style="color: var(--color-status-success);">${metrics.successRate}%</span>
          <span class="stat-subtext">${metrics.failed} failed / rolled back</span>
        </div>
        <div class="stat-card">
          <span class="stat-label">Average Release Time</span>
          <span class="stat-value">${avgDurationSec}s</span>
          <span class="stat-subtext">Zero-downtime cutover latency</span>
        </div>
      </div>

      <!-- Environments & Infrastructure Health Grid -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: var(--space-6); margin-bottom: var(--space-8);">
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
                  <th>Health</th>
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
                      <span style="font-family: var(--font-family-mono); font-size: 12px; color: var(--color-surface-raised);">
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
                    <td style="font-size: 12px; color: var(--color-text-secondary);">${ag.docker_version}</td>
                    <td>${renderStatusBadge(ag.status)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Recent Deployments Card -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">
            ${renderIcon('clock', 16)}
            <span>Recent Deployments</span>
          </span>
          <a href="#/history" class="btn btn-secondary btn-sm">Full History</a>
        </div>
        <div class="card-body" style="padding: 0;">
          ${recentDeployments.length === 0 ? `
            <div style="padding: 32px; text-align: center; color: var(--color-text-tertiary);">
              No deployment runs recorded yet. Click "Deploy Application" to launch your first pipeline.
            </div>
          ` : `
            <table>
              <thead>
                <tr>
                  <th>Deployment ID</th>
                  <th>Application</th>
                  <th>Environment</th>
                  <th>Branch / Tag</th>
                  <th>Current Stage</th>
                  <th>Status</th>
                  <th>Duration</th>
                  <th>Time</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                ${recentDeployments.map(d => {
                  const duration = d.duration_ms ? `${(d.duration_ms / 1000).toFixed(1)}s` : '--';
                  const timeAgo = d.created_at ? new Date(d.created_at).toLocaleTimeString() : '';
                  return `
                    <tr>
                      <td style="font-family: var(--font-family-mono); font-size: 12px;">
                        <a href="#/deployments/${d.id}" style="color: var(--color-text-primary); font-weight: 600;">${d.id}</a>
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
                      <td style="font-size: 12px; color: var(--color-text-secondary);">${d.current_stage_name || 'Completed'}</td>
                      <td>${renderStatusBadge(d.status)}</td>
                      <td style="font-family: var(--font-family-mono); font-size: 12px;">${duration}</td>
                      <td style="font-size: 12px; color: var(--color-text-secondary);">${timeAgo}</td>
                      <td>
                        <a href="#/deployments/${d.id}" class="btn btn-secondary btn-sm">
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
      <div class="card" style="border-color: var(--color-status-error);">
        <div class="card-body">
          <h3 style="color: var(--color-status-error); margin-bottom: 8px;">Error loading overview telemetry</h3>
          <p>${err.message}</p>
        </div>
      </div>
    `;
  }
}
