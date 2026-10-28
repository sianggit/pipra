/**
 * Pipra Infrastructure & Agents Dashboard Page
 */

import { api } from '../api.js';
import { renderIcon } from '../icons.js';
import { renderStatusBadge } from '../components/health-badge.js';

export async function renderInfraPage(container) {
  container.innerHTML = `<div style="padding: 24px; color: var(--color-text-secondary);">Loading infrastructure telemetry...</div>`;

  try {
    const agents = await api.getAgents();

    container.innerHTML = `
      <div class="page-header">
        <div class="page-title-group">
          <h1>
            ${renderIcon('cpu', 24)}
            <span>Infrastructure & Execution Agents</span>
          </h1>
          <p class="page-subtitle">Real-time health, Docker daemon connectivity, and resource capacity of execution workers.</p>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(380px, 1fr)); gap: var(--space-6);">
        ${agents.map(ag => `
          <div class="card" style="margin-bottom: 0;">
            <div class="card-header">
              <div>
                <span class="card-title">${ag.name}</span>
                <span style="font-family: var(--font-family-mono); font-size: 11px; color: var(--color-text-secondary);">${ag.host}</span>
              </div>
              ${renderStatusBadge(ag.status)}
            </div>
            <div class="card-body">
              <div style="display: flex; flex-direction: column; gap: var(--space-5);">
                <div>
                  <span style="font-size: var(--font-size-xs); color: var(--color-text-secondary);">Container Engine:</span>
                  <div style="font-weight: 500; font-size: 13px; color: var(--color-text-primary); margin-top: 2px;">
                    ${ag.docker_version}
                  </div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-4); background-color: var(--color-surface-strong); padding: var(--space-4); border-radius: var(--radius-sm); border: 1px solid var(--color-border-default);">
                  <div>
                    <span style="font-size: 10px; color: var(--color-text-secondary); text-transform: uppercase;">CPU Usage</span>
                    <div style="font-weight: 600; font-family: var(--font-family-mono); font-size: 14px; color: var(--color-surface-raised);">
                      ${ag.cpu_usage}%
                    </div>
                  </div>
                  <div>
                    <span style="font-size: 10px; color: var(--color-text-secondary); text-transform: uppercase;">Memory Free</span>
                    <div style="font-weight: 600; font-family: var(--font-family-mono); font-size: 14px;">
                      ${(ag.memory_free_mb / 1024).toFixed(1)} GB
                    </div>
                  </div>
                  <div>
                    <span style="font-size: 10px; color: var(--color-text-secondary); text-transform: uppercase;">Disk Available</span>
                    <div style="font-weight: 600; font-family: var(--font-family-mono); font-size: 14px;">
                      ${ag.disk_free_gb} GB
                    </div>
                  </div>
                </div>

                <div style="display: flex; align-items: center; justify-content: space-between; font-size: 12px; color: var(--color-text-secondary); border-top: 1px solid var(--color-border-default); padding-top: var(--space-4);">
                  <span>Active Execution Slots: <strong>${ag.active_jobs} / 4</strong></span>
                  <span>Last Heartbeat: <strong>Just now</strong></span>
                </div>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  } catch (err) {
    container.innerHTML = `<div style="color: var(--color-status-error);">Error: ${err.message}</div>`;
  }
}
