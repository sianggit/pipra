/**
 * Pipra Infrastructure & Execution Agents Page
 * Real-time health, Docker daemon connectivity, and resource capacity of execution workers.
 */

import { api } from '../api.js';
import { renderIcon } from '../icons.js';
import { renderStatusBadge } from '../components/health-badge.js';

export async function renderInfraPage(container) {
  container.innerHTML = `
    <div style="padding: var(--space-8); text-align: center; color: var(--color-text-secondary);">
      <div style="font-family: var(--font-family-mono); font-size: var(--font-size-sm);">Loading infrastructure telemetry...</div>
    </div>
  `;

  try {
    const agents = await api.getAgents();

    container.innerHTML = `
      <div class="page-header">
        <div class="page-title-group">
          <h1>
            ${renderIcon('cpu', 22)}
            <span>Infrastructure & Execution Agents</span>
          </h1>
          <p class="page-subtitle">Real-time connectivity, Docker daemon operational status, and capacity of execution nodes.</p>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: var(--space-5);">
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
              <div style="display: flex; flex-direction: column; gap: var(--space-4);">
                <div>
                  <span style="font-size: var(--font-size-2xs); color: var(--color-text-secondary); text-transform: uppercase; font-weight: 600;">Container Runtime:</span>
                  <div style="font-weight: 500; font-size: 13px; color: var(--color-text-primary); margin-top: 2px; font-family: var(--font-family-mono);">
                    ${ag.docker_version}
                  </div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-3); background-color: var(--color-surface-strong); padding: var(--space-3); border-radius: var(--radius-sm); border: 1px solid var(--color-border-default);">
                  <div>
                    <span style="font-size: 10px; color: var(--color-text-secondary); text-transform: uppercase; font-weight: 600;">CPU Load</span>
                    <div style="font-weight: 600; font-family: var(--font-family-mono); font-size: 14px; color: var(--color-action-primary); margin-top: 2px;">
                      ${ag.cpu_usage}%
                    </div>
                  </div>
                  <div>
                    <span style="font-size: 10px; color: var(--color-text-secondary); text-transform: uppercase; font-weight: 600;">Memory Free</span>
                    <div style="font-weight: 600; font-family: var(--font-family-mono); font-size: 14px; margin-top: 2px;">
                      ${(ag.memory_free_mb / 1024).toFixed(1)} GB
                    </div>
                  </div>
                  <div>
                    <span style="font-size: 10px; color: var(--color-text-secondary); text-transform: uppercase; font-weight: 600;">Disk Free</span>
                    <div style="font-weight: 600; font-family: var(--font-family-mono); font-size: 14px; margin-top: 2px;">
                      ${ag.disk_free_gb} GB
                    </div>
                  </div>
                </div>

                <div style="display: flex; align-items: center; justify-content: space-between; font-size: 12px; color: var(--color-text-secondary); border-top: 1px solid var(--color-border-subtle); padding-top: var(--space-3);">
                  <span>Active Execution Slots: <strong style="color: var(--color-text-primary); font-family: var(--font-family-mono);">${ag.active_jobs} / 4</strong></span>
                  <span>Observation: <strong style="color: var(--color-text-primary);">Synchronized</strong></span>
                </div>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  } catch (err) {
    container.innerHTML = `
      <div class="card" style="border-left: 3px solid var(--color-status-danger);">
        <div class="card-body">
          <h3 style="color: var(--color-status-danger); margin-bottom: var(--space-2);">Error loading infrastructure telemetry</h3>
          <p style="color: var(--color-text-secondary);">${err.message}</p>
        </div>
      </div>
    `;
  }
}
