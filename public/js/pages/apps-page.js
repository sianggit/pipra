/**
 * Pipra Applications Catalog & Configuration Page
 * Aligned with DESIGN.md & Control Plane Redesign Mockup
 */

import { api } from '../api.js';
import { renderIcon } from '../icons.js';
import { openModal } from '../components/modal.js';
import { canDeploy, canRegisterApp } from '../auth.js';

export async function renderAppsPage(container) {
  container.innerHTML = `
    <div style="padding: 48px; text-align: center; color: var(--t2);">
      <div class="mono">Loading applications catalog...</div>
    </div>
  `;

  try {
    const [apps, envs] = await Promise.all([
      api.getApplications(),
      api.getEnvironments().catch(() => []),
    ]);

    container.innerHTML = `
      <div class="pg">
        <div>
          <h1>Applications</h1>
          <p class="sub">Repository, build, and health policy for each deployable application.</p>
        </div>
        ${canRegisterApp() ? `
          <div>
            <button id="btn-register-app" class="btn" aria-label="Register new application">
              ${renderIcon('plus', 14)}
              <span>Register application</span>
            </button>
          </div>
        ` : ''}
      </div>

      ${apps.map(app => `
        <div class="pn">
          <div class="ph">
            <div style="display: flex; align-items: baseline; gap: 8px;">
              <h2>${app.display_name}</h2>
              <span class="mono dim">${app.name}</span>
            </div>
            ${canDeploy() ? `
              <a class="btn p" href="#/deploy?app=${app.id}">
                ${renderIcon('play', 14)}
                <span>Deploy</span>
              </a>
            ` : ''}
          </div>
          <dl>
            <dt>Repository</dt>
            <dd class="mono">${app.repo_url}</dd>
            <dt>Host directory</dt>
            <dd class="mono">${app.app_dir}</dd>
            <dt>Dockerfile</dt>
            <dd class="mono">${app.dockerfile}</dd>
            <dt>Image namespace</dt>
            <dd class="mono">${app.image_name}</dd>
            <dt>Ports</dt>
            <dd class="mono">production :${app.host_port} · staging :${app.staging_port} · container :${app.container_port}</dd>
            <dt>Health policy</dt>
            <dd>GET <span class="mono">${app.healthcheck_path}</span> · up to ${app.healthcheck_max_retries} retries, ${app.healthcheck_interval_sec}s interval</dd>
          </dl>
        </div>
      `).join('')}

      <!-- Runtime Observed Status -->
      <div class="pn">
        <div class="ph">
          <h2>Runtime status</h2>
          <small>Observed from active container health checks</small>
        </div>
        <div class="tw">
          <table>
            <thead>
              <tr>
                <th>Environment</th>
                <th>Active release</th>
                <th>Health</th>
                <th>Target host</th>
              </tr>
            </thead>
            <tbody>
              ${envs.map(e => `
                <tr>
                  <td>
                    <span class="env ${e.is_production ? 'prod' : (e.name && e.name.includes('staging') ? 'staging' : 'devel')}">
                      <i></i>${e.display_name || e.name}
                    </span>
                  </td>
                  <td class="mono" style="color: var(--pr);">${e.active_release_id || 'asdp-dims-fe:devel-latest'}</td>
                  <td><span class="b ok">${renderIcon('check', 12)}Healthy</span></td>
                  <td class="mono num dim">${e.host || '127.0.0.1'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;

    // Bind registration modal if authorized
    const registerBtn = document.getElementById('btn-register-app');
    if (registerBtn) {
      registerBtn.addEventListener('click', () => {
        openModal({
          title: 'Register Application',
          content: `
            <form id="form-register-app" class="fl">
              <div>
                <label for="app-name">Application Identifier (slug) *</label>
                <input type="text" id="app-name" class="mono" placeholder="e.g. asdp-dims-be" required />
              </div>
              <div>
                <label for="app-display">Display Name *</label>
                <input type="text" id="app-display" placeholder="e.g. ASDP DIMS Backend Service" required />
              </div>
              <div>
                <label for="app-repo">Git Repository URL *</label>
                <input type="text" id="app-repo" class="mono" placeholder="git@gitlab.asyst.co.id:asdp/asdp-dims-be.git" required />
              </div>
              <div>
                <label for="app-dir">Host Directory *</label>
                <input type="text" id="app-dir" class="mono" value="/home/devel/asdp-dims-be" required />
              </div>
              <div class="row2">
                <div>
                  <label for="app-prod-port">Production Port *</label>
                  <input type="number" id="app-prod-port" class="mono" value="5000" required />
                </div>
                <div>
                  <label for="app-staging-port">Staging Port *</label>
                  <input type="number" id="app-staging-port" class="mono" value="5001" required />
                </div>
              </div>
            </form>
          `,
          onConfirm: async () => {
            const form = document.getElementById('form-register-app');
            if (!form.checkValidity()) {
              form.reportValidity();
              return false;
            }
            await api.registerApplication({
              name: document.getElementById('app-name').value,
              display_name: document.getElementById('app-display').value,
              repo_url: document.getElementById('app-repo').value,
              app_dir: document.getElementById('app-dir').value,
              host_port: parseInt(document.getElementById('app-prod-port').value, 10),
              staging_port: parseInt(document.getElementById('app-staging-port').value, 10),
              container_port: 3000,
              dockerfile: 'Dockerfile.jenkins',
              image_name: document.getElementById('app-name').value,
              default_branch: 'devel',
              permitted_branches: ['devel', 'main', 'prod'],
              healthcheck_path: '/',
              healthcheck_interval_sec: 2,
              healthcheck_max_retries: 15,
            });
            await renderAppsPage(container);
            return true;
          }
        });
      });
    }
  } catch (err) {
    container.innerHTML = `
      <div class="pn" style="margin-top: 24px; border-color: var(--bad);">
        <div class="ph"><h2 style="color: var(--bad);">Failed to load applications</h2></div>
        <div class="pb"><p class="t2">${err.message || 'An error occurred while loading applications catalog.'}</p></div>
      </div>
    `;
  }
}
