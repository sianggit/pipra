/**
 * Pipra Applications Management Page
 */

import { api } from '../api.js';
import { renderIcon } from '../icons.js';
import { openModal } from '../components/modal.js';

export async function renderAppsPage(container) {
  container.innerHTML = `<div style="padding: 24px; color: var(--color-text-secondary);">Loading applications...</div>`;

  try {
    const apps = await api.getApplications();

    container.innerHTML = `
      <div class="page-header">
        <div class="page-title-group">
          <h1>
            ${renderIcon('layers', 24)}
            <span>Applications Catalog</span>
          </h1>
          <p class="page-subtitle">Configure application repositories, Docker build parameters, and health-check policies.</p>
        </div>
        <div>
          <button id="btn-register-app" class="btn btn-primary">
            ${renderIcon('plus', 14)}
            <span>Register Application</span>
          </button>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(420px, 1fr)); gap: var(--space-6);">
        ${apps.map(app => `
          <div class="card" style="margin-bottom: 0;">
            <div class="card-header">
              <div>
                <span class="card-title">${app.display_name}</span>
                <span style="font-family: var(--font-family-mono); font-size: 11px; color: var(--color-surface-raised);">${app.name}</span>
              </div>
              <a href="#/deploy?app=${app.id}" class="btn btn-primary btn-sm">
                ${renderIcon('play', 12)}
                <span>Deploy</span>
              </a>
            </div>
            <div class="card-body">
              <div style="display: flex; flex-direction: column; gap: var(--space-4);">
                <div>
                  <span style="font-size: var(--font-size-xs); color: var(--color-text-secondary); text-transform: uppercase;">Repository & Path:</span>
                  <div style="font-family: var(--font-family-mono); font-size: 12px; margin-top: 2px;">${app.repo_url}</div>
                  <div style="font-family: var(--font-family-mono); font-size: 11px; color: var(--color-text-tertiary);">${app.app_dir}</div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); border-top: 1px solid var(--color-border-default); padding-top: var(--space-4);">
                  <div>
                    <span style="font-size: var(--font-size-xs); color: var(--color-text-secondary);">Dockerfile:</span>
                    <div style="font-weight: 500; font-family: var(--font-family-mono);">${app.dockerfile}</div>
                  </div>
                  <div>
                    <span style="font-size: var(--font-size-xs); color: var(--color-text-secondary);">Image Name:</span>
                    <div style="font-weight: 500; font-family: var(--font-family-mono);">${app.image_name}</div>
                  </div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-4); background-color: var(--color-surface-strong); padding: var(--space-4); border-radius: var(--radius-sm); border: 1px solid var(--color-border-default);">
                  <div>
                    <span style="font-size: 10px; color: var(--color-text-secondary); text-transform: uppercase;">Prod Port</span>
                    <div style="font-weight: 600; font-family: var(--font-family-mono); color: var(--color-surface-raised);">:${app.host_port}</div>
                  </div>
                  <div>
                    <span style="font-size: 10px; color: var(--color-text-secondary); text-transform: uppercase;">Staging Port</span>
                    <div style="font-weight: 600; font-family: var(--font-family-mono);">:${app.staging_port}</div>
                  </div>
                  <div>
                    <span style="font-size: 10px; color: var(--color-text-secondary); text-transform: uppercase;">Container</span>
                    <div style="font-weight: 600; font-family: var(--font-family-mono);">:${app.container_port}</div>
                  </div>
                </div>

                <div style="font-size: 12px; color: var(--color-text-secondary);">
                  Health Policy: <strong style="color: var(--color-text-primary);">${app.healthcheck_path}</strong> (Max ${app.healthcheck_max_retries} retries @ ${app.healthcheck_interval_sec}s interval)
                </div>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    bindAppsPageEvents();
  } catch (err) {
    container.innerHTML = `<div style="color: var(--color-status-error);">Error: ${err.message}</div>`;
  }
}

function bindAppsPageEvents() {
  const registerBtn = document.getElementById('btn-register-app');
  if (registerBtn) {
    registerBtn.addEventListener('click', () => {
      openModal({
        title: 'Register New Application',
        bodyHtml: `
          <div class="form-group">
            <label class="form-label" for="new-app-name">Application Identifier *</label>
            <input type="text" id="new-app-name" class="form-control" placeholder="e.g. asyst-web-portal" required />
            <div class="form-hint">Lowercase alphanumeric and hyphens only.</div>
          </div>
          <div class="form-group">
            <label class="form-label" for="new-app-display">Display Name *</label>
            <input type="text" id="new-app-display" class="form-control" placeholder="e.g. ASYST Web Portal" required />
          </div>
          <div class="form-group">
            <label class="form-label" for="new-app-repo">Git Repository URL *</label>
            <input type="text" id="new-app-repo" class="form-control" placeholder="git@gitlab.asyst.co.id:web/portal.git" required />
          </div>
          <div class="form-group">
            <label class="form-label" for="new-app-dir">Server Working Directory *</label>
            <input type="text" id="new-app-dir" class="form-control" placeholder="/home/devel/portal" required />
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4);">
            <div class="form-group">
              <label class="form-label" for="new-app-hostport">Production Port</label>
              <input type="number" id="new-app-hostport" class="form-control" value="3000" />
            </div>
            <div class="form-group">
              <label class="form-label" for="new-app-stgport">Staging Port</label>
              <input type="number" id="new-app-stgport" class="form-control" value="3001" />
            </div>
          </div>
        `,
        confirmText: 'Register Application',
        onConfirm: async () => {
          const name = document.getElementById('new-app-name').value.trim();
          const display_name = document.getElementById('new-app-display').value.trim();
          const repo_url = document.getElementById('new-app-repo').value.trim();
          const app_dir = document.getElementById('new-app-dir').value.trim();
          const host_port = parseInt(document.getElementById('new-app-hostport').value, 10);
          const staging_port = parseInt(document.getElementById('new-app-stgport').value, 10);

          await api.createApplication({
            name,
            display_name,
            repo_url,
            app_dir,
            host_port,
            staging_port,
          });

          // Refresh page
          renderAppsPage(document.getElementById('main-content'));
        },
      });
    });
  }
}
