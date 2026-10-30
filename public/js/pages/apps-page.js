/**
 * Pipra Applications Catalog & Configuration Page
 * Structured application specifications, container ports, repository bindings,
 * and automated health check policies.
 */

import { api } from '../api.js';
import { renderIcon } from '../icons.js';
import { openModal } from '../components/modal.js';
import { canDeploy, canRegisterApp } from '../auth.js';

export async function renderAppsPage(container) {
  container.innerHTML = `
    <div style="padding: var(--space-8); text-align: center; color: var(--color-text-secondary);">
      <div style="font-family: var(--font-family-mono); font-size: var(--font-size-sm);">Loading applications catalog...</div>
    </div>
  `;

  try {
    const apps = await api.getApplications();

    container.innerHTML = `
      <div class="page-header">
        <div class="page-title-group">
          <h1>
            ${renderIcon('layers', 22)}
            <span>Applications Catalog</span>
          </h1>
          <p class="page-subtitle">Configure application repositories, Docker build parameters, and health-check policies.</p>
        </div>
        ${canRegisterApp() ? `
          <div>
            <button id="btn-register-app" class="btn btn-primary" aria-label="Register new application">
              ${renderIcon('plus', 14)}
              <span>Register Application</span>
            </button>
          </div>
        ` : ''}
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(380px, 1fr)); gap: var(--space-5);">
        ${apps.map(app => `
          <div class="card" style="margin-bottom: 0;">
            <div class="card-header">
              <div>
                <span class="card-title">${app.display_name}</span>
                <span style="font-family: var(--font-family-mono); font-size: 11px; color: var(--color-action-primary);">${app.name}</span>
              </div>
              ${canDeploy() ? `
                <a href="#/deploy?app=${app.id}" class="btn btn-primary btn-sm" aria-label="Deploy ${app.display_name}">
                  ${renderIcon('play', 12)}
                  <span>Deploy</span>
                </a>
              ` : `
                <span class="badge badge-info" style="font-size: 10px;">Observation</span>
              `}
            </div>
            <div class="card-body">
              <div style="display: flex; flex-direction: column; gap: var(--space-3);">
                <div>
                  <span style="font-size: var(--font-size-2xs); color: var(--color-text-secondary); text-transform: uppercase; font-weight: 600;">Repository & Host Directory:</span>
                  <div style="font-family: var(--font-family-mono); font-size: 12px; margin-top: 2px; color: var(--color-text-primary); word-break: break-all;">${app.repo_url}</div>
                  <div style="font-family: var(--font-family-mono); font-size: 11px; color: var(--color-text-muted);">${app.app_dir}</div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); border-top: 1px solid var(--color-border-subtle); padding-top: var(--space-3);">
                  <div>
                    <span style="font-size: var(--font-size-2xs); color: var(--color-text-secondary); text-transform: uppercase; font-weight: 600;">Dockerfile:</span>
                    <div style="font-weight: 500; font-family: var(--font-family-mono); font-size: 12px; margin-top: 2px;">${app.dockerfile}</div>
                  </div>
                  <div>
                    <span style="font-size: var(--font-size-2xs); color: var(--color-text-secondary); text-transform: uppercase; font-weight: 600;">Image Namespace:</span>
                    <div style="font-weight: 500; font-family: var(--font-family-mono); font-size: 12px; margin-top: 2px;">${app.image_name}</div>
                  </div>
                </div>

                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--space-2); background-color: var(--color-surface-strong); padding: var(--space-3); border-radius: var(--radius-sm); border: 1px solid var(--color-border-default);">
                  <div>
                    <span style="font-size: 10px; color: var(--color-text-secondary); text-transform: uppercase; font-weight: 600;">Prod Port</span>
                    <div style="font-weight: 600; font-family: var(--font-family-mono); color: var(--color-action-primary); margin-top: 2px;">:${app.host_port}</div>
                  </div>
                  <div>
                    <span style="font-size: 10px; color: var(--color-text-secondary); text-transform: uppercase; font-weight: 600;">Staging Port</span>
                    <div style="font-weight: 600; font-family: var(--font-family-mono); margin-top: 2px;">:${app.staging_port}</div>
                  </div>
                  <div>
                    <span style="font-size: 10px; color: var(--color-text-secondary); text-transform: uppercase; font-weight: 600;">Container</span>
                    <div style="font-weight: 600; font-family: var(--font-family-mono); margin-top: 2px;">:${app.container_port}</div>
                  </div>
                </div>

                <div style="font-size: 12px; color: var(--color-text-secondary); border-top: 1px solid var(--color-border-subtle); padding-top: var(--space-2);">
                  Health Policy: <strong style="color: var(--color-text-primary); font-family: var(--font-family-mono);">${app.healthcheck_path}</strong> (Max ${app.healthcheck_max_retries} retries @ ${app.healthcheck_interval_sec}s interval)
                </div>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    bindAppsPageEvents();
  } catch (err) {
    container.innerHTML = `
      <div class="card" style="border-left: 3px solid var(--color-status-danger);">
        <div class="card-body">
          <h3 style="color: var(--color-status-danger); margin-bottom: var(--space-2);">Error loading applications</h3>
          <p style="color: var(--color-text-secondary);">${err.message}</p>
        </div>
      </div>
    `;
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
            <input type="text" id="new-app-name" class="form-control font-mono" placeholder="e.g. asyst-web-portal" required />
            <div class="form-hint">Lowercase alphanumeric and hyphens only.</div>
          </div>
          <div class="form-group">
            <label class="form-label" for="new-app-display">Display Name *</label>
            <input type="text" id="new-app-display" class="form-control" placeholder="e.g. ASYST Web Portal" required />
          </div>
          <div class="form-group">
            <label class="form-label" for="new-app-repo">Git Repository URL *</label>
            <input type="text" id="new-app-repo" class="form-control font-mono" placeholder="git@gitlab.asyst.co.id:web/portal.git" required />
          </div>
          <div class="form-group">
            <label class="form-label" for="new-app-dir">Host Working Directory *</label>
            <input type="text" id="new-app-dir" class="form-control font-mono" placeholder="/home/devel/portal" required />
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3);">
            <div class="form-group">
              <label class="form-label" for="new-app-hostport">Production Serving Port *</label>
              <input type="number" id="new-app-hostport" class="form-control font-mono" value="3000" required />
            </div>
            <div class="form-group">
              <label class="form-label" for="new-app-stgport">Staging Isolation Port *</label>
              <input type="number" id="new-app-stgport" class="form-control font-mono" value="3001" required />
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

          if (!name || !display_name || !repo_url || !app_dir) {
            throw new Error('All required fields must be specified.');
          }

          await api.createApplication({
            name,
            display_name,
            repo_url,
            app_dir,
            host_port,
            staging_port,
          });

          // Refresh catalog
          renderAppsPage(document.getElementById('main-content'));
        },
      });
    });
  }
}
