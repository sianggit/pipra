/**
 * Pipra Overview Dashboard Page — Production Cockpit
 * Aligned with DESIGN.md & Control Plane Redesign Mockup
 */

import { api } from '../api.js';
import { renderIcon } from '../icons.js';
import { renderStatusBadge } from '../components/health-badge.js';
import { canDeploy } from '../auth.js';

export async function renderOverviewPage(container) {
  container.innerHTML = `
    <div style="padding: 48px; text-align: center; color: var(--t2);">
      <div class="mono">Loading platform telemetry...</div>
    </div>
  `;

  try {
    const stats = await api.getOverviewStats();
    const { metrics, recentDeployments = [], environments = [], agents = [] } = stats;

    const avgDurationSec = metrics.avgDurationMs ? (metrics.avgDurationMs / 1000).toFixed(1) : '0';
    const failedRecent = recentDeployments.filter(d => ['FAILED', 'ROLLBACK_FAILED'].includes(d.status));
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    // Format relative or short date
    const formatDate = (iso) => {
      if (!iso) return '—';
      const d = new Date(iso);
      return `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    };

    // Sort environments for the promotion rail: Non-production first, then Production
    const sortedEnvs = [...environments].sort((a, b) => {
      if (a.is_production && !b.is_production) return 1;
      if (!a.is_production && b.is_production) return -1;
      return a.name.localeCompare(b.name);
    });

    container.innerHTML = `
      <div class="pg">
        <div>
          <h1>Release operations</h1>
          <p class="sub">What needs attention, and what is serving now. Based on the last ${metrics.total} runs; last updated ${nowTime}.</p>
        </div>
        ${canDeploy() ? `
          <div>
            <a class="btn p" href="#/deploy">
              ${renderIcon('play', 14)}
              <span>Start deployment</span>
            </a>
          </div>
        ` : ''}
      </div>

      <!-- 4-Cell Metric Strip -->
      <div class="pn strip">
        <div>
          <div class="l">Deployments</div>
          <div class="v">${metrics.total}</div>
          <div class="l">${metrics.succeeded} verified · ${metrics.failed} failed</div>
        </div>
        <div>
          <div class="l">Active pipelines</div>
          <div class="v">${metrics.active}</div>
          <div class="l">${metrics.active > 0 ? 'Executing on worker agents' : 'Engine idle'}</div>
        </div>
        <div>
          <div class="l">Verified rate</div>
          <div class="v" style="color: ${metrics.successRate >= 80 ? 'var(--ok)' : (metrics.successRate >= 50 ? 'var(--warn)' : 'var(--bad)')};">
            ${metrics.successRate}%
          </div>
          <div class="l">${metrics.succeeded} of ${metrics.total} runs verified</div>
        </div>
        <div>
          <div class="l">Average duration</div>
          <div class="v">${avgDurationSec}s</div>
          <div class="l">Mean across recorded runs</div>
        </div>
      </div>

      <!-- Needs Attention Section (Failed production runs or anomalies) -->
      ${failedRecent.length > 0 ? `
        <div class="pn">
          <div class="ph">
            <h2 style="color: var(--bad); display: flex; gap: 8px; align-items: center;">
              ${renderIcon('alert-triangle', 15)}
              <span>Needs attention</span>
            </h2>
            <small>${failedRecent.length} failed run${failedRecent.length > 1 ? 's' : ''} — latest shown</small>
          </div>
          ${failedRecent.slice(0, 2).map(r => `
            <div class="att">
              <div>
                <b>Production verification failed</b> on ${r.app_display_name || r.app_name}
                <div class="t2 mono" style="margin-top: 2px;">
                  ${r.branch || 'prod'} @ ${r.tag || 'latest'} · ${formatDate(r.created_at)}
                </div>
                <div class="t2">Rollback completed and the previous release is still serving.</div>
              </div>
              <a class="btn sm" href="#/deployments/${r.id}">Inspect diagnostics</a>
            </div>
          `).join('')}
        </div>
      ` : ''}

      <!-- Serving Now Promotion Rail -->
      <div class="pn">
        <div class="ph">
          <h2>Serving now</h2>
          <small>Promotion path · all health checks verified</small>
        </div>
        <div class="rail">
          ${sortedEnvs.map((env, i) => `
            ${i > 0 ? `<div class="ar">${renderIcon('arrow-right', 14)}</div>` : ''}
            <div class="rc ${env.is_production ? 'prod' : (env.name.includes('staging') ? 'staging' : 'devel')}">
              <span class="env ${env.is_production ? 'prod' : (env.name.includes('staging') ? 'staging' : 'devel')}">
                <i></i>${env.display_name || env.name}
              </span>
              <div class="rel">${env.active_release_id || 'asdp-dims-fe:devel-latest'}</div>
              <div><span class="b ok">${renderIcon('check', 12)}Healthy</span></div>
              <div class="dim">Verified ${formatDate(env.last_health_check_at)} · ${env.host}</div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- 2-Column Grid: Recent Deployments & Execution Agents -->
      <div class="g2">
        <div class="pn">
          <div class="ph">
            <h2>Recent deployments</h2>
            <a class="btn sm" href="#/history">Full history</a>
          </div>
          <div class="tw">
            <table>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Deployment</th>
                  <th>Environment</th>
                  <th>Revision</th>
                  <th>Duration</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                ${recentDeployments.length === 0 ? `
                  <tr><td colspan="6" class="empty">No deployments recorded yet.</td></tr>
                ` : recentDeployments.map(r => `
                  <tr>
                    <td>${renderStatusBadge(r.status)}</td>
                    <td>
                      <a class="id" href="#/deployments/${r.id}">${r.id}</a>
                    </td>
                    <td>
                      <span class="env ${r.is_production ? 'prod' : (r.env_name && r.env_name.includes('staging') ? 'staging' : 'devel')}">
                        <i></i>${(r.env_display_name || r.env_name || 'devel')}
                      </span>
                    </td>
                    <td class="mono">
                      <span class="t2">${r.branch || 'main'}</span> @ ${r.tag || 'v1.0.0'}
                      ${r.commit_sha ? `<div class="dim">${r.commit_sha.substring(0, 8)}</div>` : ''}
                    </td>
                    <td class="mono num">${r.duration_ms ? `${(r.duration_ms / 1000).toFixed(1)}s` : '—'}</td>
                    <td>
                      <a class="btn sm" href="#/deployments/${r.id}">View</a>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="pn">
          <div class="ph">
            <h2>Execution agents</h2>
            <a class="btn sm" href="#/infrastructure">Details</a>
          </div>
          <div>
            ${agents.length === 0 ? `
              <div class="empty">No execution agents registered.</div>
            ` : agents.map(a => `
              <div style="padding: 12px 16px; border-bottom: 1px solid var(--bs); display: flex; justify-content: space-between; gap: 12px;">
                <div>
                  <b>${a.name}</b>
                  <div class="dim mono">${a.host || '127.0.0.1'}</div>
                  <div class="t2">${a.version || 'Docker Engine v27.1.1 (Linux x86_64)'}</div>
                </div>
                <span class="b ok" style="align-self: start;">
                  ${renderIcon('check', 12)}Online
                </span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `
      <div class="pn" style="margin-top: 24px; border-color: var(--bad);">
        <div class="ph"><h2 style="color: var(--bad);">Failed to load platform telemetry</h2></div>
        <div class="pb">
          <p class="t2">${err.message || 'An error occurred while fetching overview telemetry.'}</p>
        </div>
      </div>
    `;
  }
}
