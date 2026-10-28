/**
 * Pipra Deployment History & Release Catalog Page
 * Searchable, filterable ledger of historical pipelines, commit provenance,
 * and recovery outcomes.
 */

import { api } from '../api.js';
import { renderIcon } from '../icons.js';
import { renderStatusBadge } from '../components/health-badge.js';

export async function renderHistoryPage(container) {
  container.innerHTML = `
    <div style="padding: var(--space-8); text-align: center; color: var(--color-text-secondary);">
      <div style="font-family: var(--font-family-mono); font-size: var(--font-size-sm);">Loading deployment history...</div>
    </div>
  `;

  try {
    const [deployments, apps, envs] = await Promise.all([
      api.getDeployments({ limit: 100 }),
      api.getApplications().catch(() => []),
      api.getEnvironments().catch(() => []),
    ]);

    let statusFilter = '';
    let envFilter = '';
    let searchFilter = '';

    function renderView() {
      const filtered = deployments.filter(d => {
        if (statusFilter && d.status !== statusFilter) return false;
        if (envFilter && d.environment_id !== envFilter && d.env_name !== envFilter) return false;
        if (searchFilter) {
          const s = searchFilter.toLowerCase();
          const matchId = d.id.toLowerCase().includes(s);
          const matchBranch = (d.branch || '').toLowerCase().includes(s);
          const matchTag = (d.image_tag || '').toLowerCase().includes(s);
          const matchCommit = (d.commit_sha || '').toLowerCase().includes(s);
          const matchApp = (d.app_display_name || d.app_name || '').toLowerCase().includes(s);
          if (!matchId && !matchBranch && !matchTag && !matchCommit && !matchApp) return false;
        }
        return true;
      });

      container.innerHTML = `
        <div class="page-header">
          <div class="page-title-group">
            <h1>
              ${renderIcon('clock', 22)}
              <span>Deployments & Releases</span>
            </h1>
            <p class="page-subtitle">Searchable audit trail of historical pipelines, commit provenance, and recovery outcomes.</p>
          </div>
          <div>
            <a href="#/deploy" class="btn btn-primary" aria-label="Start new deployment">
              ${renderIcon('play', 14)}
              <span>New Deployment</span>
            </a>
          </div>
        </div>

        <!-- Filter Controls -->
        <div class="card" style="margin-bottom: var(--space-5);">
          <div class="card-body" style="padding: var(--space-3) var(--space-4);">
            <div style="display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap;">
              <div style="flex: 1; min-width: 220px;">
                <label for="history-search" class="sr-only">Search deployments</label>
                <input type="text" id="history-search" class="form-control" placeholder="Search by ID, app, branch, tag, commit..." value="${searchFilter}" />
              </div>

              <div style="width: 170px;">
                <label for="history-env-filter" class="sr-only">Filter by environment</label>
                <select id="history-env-filter" class="form-control">
                  <option value="">All Environments</option>
                  ${envs.map(e => `<option value="${e.id}" ${envFilter === e.id ? 'selected' : ''}>${e.display_name}</option>`).join('')}
                </select>
              </div>

              <div style="width: 170px;">
                <label for="history-status-filter" class="sr-only">Filter by status</label>
                <select id="history-status-filter" class="form-control">
                  <option value="">All Statuses</option>
                  <option value="SUCCEEDED" ${statusFilter === 'SUCCEEDED' ? 'selected' : ''}>SUCCEEDED</option>
                  <option value="FAILED" ${statusFilter === 'FAILED' ? 'selected' : ''}>FAILED</option>
                  <option value="CANCELLED" ${statusFilter === 'CANCELLED' ? 'selected' : ''}>CANCELLED</option>
                  <option value="ROLLBACK_FAILED" ${statusFilter === 'ROLLBACK_FAILED' ? 'selected' : ''}>ROLLBACK FAILED</option>
                  <option value="RUNNING" ${statusFilter === 'RUNNING' ? 'selected' : ''}>RUNNING</option>
                </select>
              </div>

              <span style="font-size: var(--font-size-xs); color: var(--color-text-secondary); font-family: var(--font-family-mono); white-space: nowrap;">
                ${filtered.length} of ${deployments.length} runs
              </span>
            </div>
          </div>
        </div>

        <!-- Deployments Table -->
        <div class="card">
          <div class="card-body" style="padding: 0;">
            ${filtered.length === 0 ? `
              <div style="padding: var(--space-8); text-align: center; color: var(--color-text-muted);">
                No matching deployment records found for this filter.
              </div>
            ` : `
              <table>
                <thead>
                  <tr>
                    <th>Deployment ID</th>
                    <th>Application</th>
                    <th>Environment</th>
                    <th>Revision & Image</th>
                    <th>Initiated By</th>
                    <th>Status</th>
                    <th>Duration</th>
                    <th>Timestamp</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${filtered.map(d => {
                    const dur = d.duration_ms ? `${(d.duration_ms / 1000).toFixed(1)}s` : '--';
                    const dateStr = d.created_at ? new Date(d.created_at).toLocaleString() : '';
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
                        <td style="font-family: var(--font-family-mono); font-size: 11px;">
                          <div>${d.branch} @ <span style="color: var(--color-action-primary); font-weight: 600;">${d.image_tag}</span></div>
                          ${d.commit_sha ? `<div style="color: var(--color-text-muted);">${d.commit_sha.substring(0, 8)}</div>` : ''}
                        </td>
                        <td style="font-size: 12px;">${d.initiated_by}</td>
                        <td>${renderStatusBadge(d.status)}</td>
                        <td style="font-family: var(--font-family-mono); font-size: 12px;">${dur}</td>
                        <td style="font-size: 12px; color: var(--color-text-secondary);">${dateStr}</td>
                        <td>
                          <div style="display: flex; align-items: center; gap: var(--space-2);">
                            <a href="#/deployments/${d.id}" class="btn btn-secondary btn-sm" aria-label="View live execution for ${d.id}">
                              ${renderIcon('external-link', 12)}
                              <span>View</span>
                            </a>
                            <a href="#/deploy?app=${d.application_id}&env=${d.environment_id}&branch=${d.branch}" class="btn btn-ghost btn-sm" aria-label="Re-deploy revision ${d.image_tag}" title="Re-deploy this revision">
                              ${renderIcon('rotate-ccw', 12)}
                            </a>
                          </div>
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

      bindHistoryEvents();
    }

    function bindHistoryEvents() {
      const searchInput = document.getElementById('history-search');
      const envSelect = document.getElementById('history-env-filter');
      const statusSelect = document.getElementById('history-status-filter');

      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          searchFilter = e.target.value;
          renderView();
        });
      }

      if (envSelect) {
        envSelect.addEventListener('change', (e) => {
          envFilter = e.target.value;
          renderView();
        });
      }

      if (statusSelect) {
        statusSelect.addEventListener('change', (e) => {
          statusFilter = e.target.value;
          renderView();
        });
      }
    }

    renderView();
  } catch (err) {
    container.innerHTML = `
      <div class="card" style="border-left: 3px solid var(--color-status-danger);">
        <div class="card-body">
          <h3 style="color: var(--color-status-danger); margin-bottom: var(--space-2);">Error loading deployment history</h3>
          <p style="color: var(--color-text-secondary);">${err.message}</p>
        </div>
      </div>
    `;
  }
}
