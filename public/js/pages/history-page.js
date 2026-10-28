/**
 * Pipra Deployment History & Release Catalog Page
 */

import { api } from '../api.js';
import { renderIcon } from '../icons.js';
import { renderStatusBadge } from '../components/health-badge.js';

export async function renderHistoryPage(container) {
  container.innerHTML = `<div style="padding: 24px; color: var(--color-text-secondary);">Loading release history...</div>`;

  try {
    const deployments = await api.getDeployments({ limit: 100 });
    const apps = await api.getApplications();
    const envs = await api.getEnvironments();

    let statusFilter = '';
    let envFilter = '';
    let searchFilter = '';

    function renderTable() {
      const filtered = deployments.filter(d => {
        if (statusFilter && d.status !== statusFilter) return false;
        if (envFilter && d.environment_id !== envFilter && d.env_name !== envFilter) return false;
        if (searchFilter) {
          const s = searchFilter.toLowerCase();
          const matchId = d.id.toLowerCase().includes(s);
          const matchBranch = (d.branch || '').toLowerCase().includes(s);
          const matchTag = (d.image_tag || '').toLowerCase().includes(s);
          const matchCommit = (d.commit_sha || '').toLowerCase().includes(s);
          if (!matchId && !matchBranch && !matchTag && !matchCommit) return false;
        }
        return true;
      });

      container.innerHTML = `
        <div class="page-header">
          <div class="page-title-group">
            <h1>
              ${renderIcon('clock', 24)}
              <span>Deployment History & Releases</span>
            </h1>
            <p class="page-subtitle">Searchable audit trail of all historical releases, commit provenance, and recovery outcomes.</p>
          </div>
          <div>
            <a href="#/deploy" class="btn btn-primary">
              ${renderIcon('play', 14)}
              <span>New Deployment</span>
            </a>
          </div>
        </div>

        <!-- Filter Controls -->
        <div class="card" style="margin-bottom: var(--space-6);">
          <div class="card-body" style="padding: var(--space-4) var(--space-6);">
            <div style="display: flex; align-items: center; gap: var(--space-4); flex-wrap: wrap;">
              <div style="flex: 1; min-width: 220px; position: relative;">
                <input type="text" id="history-search" class="form-control" placeholder="Search by ID, branch, image tag, commit SHA..." value="${searchFilter}" />
              </div>

              <div style="width: 160px;">
                <select id="history-env-filter" class="form-control">
                  <option value="">All Environments</option>
                  ${envs.map(e => `<option value="${e.id}" ${envFilter === e.id ? 'selected' : ''}>${e.display_name}</option>`).join('')}
                </select>
              </div>

              <div style="width: 160px;">
                <select id="history-status-filter" class="form-control">
                  <option value="">All Statuses</option>
                  <option value="SUCCEEDED" ${statusFilter === 'SUCCEEDED' ? 'selected' : ''}>SUCCEEDED</option>
                  <option value="FAILED" ${statusFilter === 'FAILED' ? 'selected' : ''}>FAILED</option>
                  <option value="CANCELLED" ${statusFilter === 'CANCELLED' ? 'selected' : ''}>CANCELLED</option>
                  <option value="ROLLBACK_FAILED" ${statusFilter === 'ROLLBACK_FAILED' ? 'selected' : ''}>ROLLBACK FAILED</option>
                </select>
              </div>

              <span style="font-size: var(--font-size-xs); color: var(--color-text-secondary);">
                ${filtered.length} records found
              </span>
            </div>
          </div>
        </div>

        <!-- Deployments Table -->
        <div class="card">
          <div class="card-body" style="padding: 0;">
            ${filtered.length === 0 ? `
              <div style="padding: 40px; text-align: center; color: var(--color-text-tertiary);">
                No matching deployment executions found.
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
                    <th>Created</th>
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
                          <a href="#/deployments/${d.id}" style="color: var(--color-text-primary); font-weight: 600;">${d.id}</a>
                        </td>
                        <td><strong>${d.app_display_name || d.app_name}</strong></td>
                        <td>
                          <span class="env-tag ${d.is_production ? 'env-tag-prod' : 'env-tag-nonprod'}">
                            ${(d.env_name || '').toUpperCase()}
                          </span>
                        </td>
                        <td style="font-family: var(--font-family-mono); font-size: 11px;">
                          <div>${d.branch} @ <span style="color: var(--color-surface-raised); font-weight: 600;">${d.image_tag}</span></div>
                          ${d.commit_sha ? `<div style="color: var(--color-text-tertiary);">${d.commit_sha.substring(0, 8)}</div>` : ''}
                        </td>
                        <td style="font-size: 12px;">${d.initiated_by}</td>
                        <td>${renderStatusBadge(d.status)}</td>
                        <td style="font-family: var(--font-family-mono); font-size: 12px;">${dur}</td>
                        <td style="font-size: 12px; color: var(--color-text-secondary);">${dateStr}</td>
                        <td>
                          <div style="display: flex; align-items: center; gap: var(--space-2);">
                            <a href="#/deployments/${d.id}" class="btn btn-secondary btn-sm" title="View live timeline & logs">
                              ${renderIcon('external-link', 12)}
                              <span>View</span>
                            </a>
                            <a href="#/deploy?app=${d.application_id}&env=${d.environment_id}&branch=${d.branch}" class="btn btn-ghost btn-sm" title="Re-deploy this revision">
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
          renderTable();
        });
      }

      if (envSelect) {
        envSelect.addEventListener('change', (e) => {
          envFilter = e.target.value;
          renderTable();
        });
      }

      if (statusSelect) {
        statusSelect.addEventListener('change', (e) => {
          statusFilter = e.target.value;
          renderTable();
        });
      }
    }

    renderTable();
  } catch (err) {
    container.innerHTML = `<div style="color: var(--color-status-error);">Error: ${err.message}</div>`;
  }
}
