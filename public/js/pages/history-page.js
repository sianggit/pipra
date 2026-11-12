/**
 * Pipra Deployments & History Page
 * Aligned with DESIGN.md & Control Plane Redesign Mockup
 */

import { api } from '../api.js';
import { renderIcon } from '../icons.js';
import { renderStatusBadge } from '../components/health-badge.js';
import { canDeploy } from '../auth.js';

export async function renderHistoryPage(container) {
  container.innerHTML = `
    <div style="padding: 48px; text-align: center; color: var(--t2);">
      <div class="mono">Loading deployment history...</div>
    </div>
  `;

  try {
    const [deployments, envs] = await Promise.all([
      api.getDeployments({ limit: 100 }),
      api.getEnvironments().catch(() => []),
    ]);

    let searchFilter = '';
    let envFilter = '';
    let statusFilter = '';

    const formatDate = (iso) => {
      if (!iso) return '—';
      const d = new Date(iso);
      return `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    };

    function renderView() {
      const q = searchFilter.toLowerCase();
      const filtered = deployments.filter(d => {
        if (envFilter && d.environment_id !== envFilter && d.env_name !== envFilter) return false;
        if (statusFilter && d.status !== statusFilter) return false;
        if (q) {
          const id = (d.id || '').toLowerCase();
          const br = (d.branch || '').toLowerCase();
          const tag = (d.image_tag || d.tag || '').toLowerCase();
          const sha = (d.commit_sha || '').toLowerCase();
          const app = (d.app_display_name || d.app_name || '').toLowerCase();
          if (!id.includes(q) && !br.includes(q) && !tag.includes(q) && !sha.includes(q) && !app.includes(q)) return false;
        }
        return true;
      });

      container.innerHTML = `
        <div class="pg">
          <div>
            <h1>Deployments</h1>
            <p class="sub">Searchable record of pipelines, source revisions, and outcomes.</p>
          </div>
          ${canDeploy() ? `
            <div>
              <a class="btn p" href="#/deploy">
                ${renderIcon('play', 14)}
                <span>New deployment</span>
              </a>
            </div>
          ` : ''}
        </div>

        <div class="pn">
          <!-- Search & Filter Bar -->
          <div class="sr">
            <input id="history-search" type="text" aria-label="Search deployments" placeholder="Search by ID, branch, tag, or commit" value="${searchFilter}">
            <select id="history-env-filter" aria-label="Environment">
              <option value="">All environments</option>
              ${envs.map(e => `<option value="${e.id}" ${envFilter === e.id ? 'selected' : ''}>${e.display_name || e.name}</option>`).join('')}
            </select>
            <select id="history-status-filter" aria-label="Status">
              <option value="">All statuses</option>
              <option value="SUCCEEDED" ${statusFilter === 'SUCCEEDED' ? 'selected' : ''}>Verified (SUCCEEDED)</option>
              <option value="FAILED" ${statusFilter === 'FAILED' ? 'selected' : ''}>Failed (FAILED)</option>
              <option value="CANCELLED" ${statusFilter === 'CANCELLED' ? 'selected' : ''}>Cancelled (CANCELLED)</option>
              <option value="RUNNING" ${statusFilter === 'RUNNING' ? 'selected' : ''}>Running (RUNNING)</option>
            </select>
            <span class="dim num" style="align-self: center; font-size: 12px;">
              ${filtered.length} of ${deployments.length} runs
            </span>
          </div>

          <!-- Deployments Table -->
          <div class="tw">
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Deployment</th>
                  <th>Environment</th>
                  <th>Revision</th>
                  <th>Initiator</th>
                  <th>Started</th>
                  <th>Duration</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                ${filtered.length === 0 ? '' : filtered.map(r => `
                  <tr>
                    <td>${renderStatusBadge(r.status)}</td>
                    <td>
                      <a class="id" href="#/deployments/${r.id}">${r.id}</a>
                    </td>
                    <td>
                      <span class="env ${r.is_production ? 'prod' : (r.env_name && r.env_name.includes('staging') ? 'staging' : 'devel')}">
                        <i></i>${r.env_display_name || r.env_name || 'devel'}
                      </span>
                    </td>
                    <td class="mono">
                      <span class="t2">${r.branch || 'main'}</span> @ ${r.image_tag || r.tag || 'latest'}
                      ${r.commit_sha ? `<div class="dim">${r.commit_sha.substring(0, 8)}</div>` : ''}
                    </td>
                    <td class="t2">${r.triggered_by_username || 'operator'}</td>
                    <td class="num t2">${formatDate(r.created_at)}</td>
                    <td class="mono num">${r.duration_ms ? `${(r.duration_ms / 1000).toFixed(1)}s` : '—'}</td>
                    <td>
                      <a class="btn sm" href="#/deployments/${r.id}">View</a>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <!-- Empty State -->
          ${filtered.length === 0 ? `
            <div class="empty">
              <b>No runs match these filters.</b><br>
              Clear the search or choose a different environment or status.
            </div>
          ` : ''}
        </div>
      `;

      // Bind events
      const searchInput = document.getElementById('history-search');
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          searchFilter = e.target.value;
          renderView();
          // Restore focus to input
          const el = document.getElementById('history-search');
          if (el) {
            el.focus();
            el.selectionStart = el.selectionEnd = el.value.length;
          }
        });
      }

      const envSelect = document.getElementById('history-env-filter');
      if (envSelect) {
        envSelect.addEventListener('change', (e) => {
          envFilter = e.target.value;
          renderView();
        });
      }

      const statusSelect = document.getElementById('history-status-filter');
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
      <div class="pn" style="margin-top: 24px; border-color: var(--bad);">
        <div class="ph"><h2 style="color: var(--bad);">Failed to load deployment history</h2></div>
        <div class="pb"><p class="t2">${err.message || 'An error occurred while loading deployment history.'}</p></div>
      </div>
    `;
  }
}
