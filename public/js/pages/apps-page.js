/**
 * Pipra Applications Catalog & Configuration Page
 * Supports Multi-Project Hub with Nested Application Environments,
 * Full Lifecycle CRUD (Edit, Dual-Stage Archive & Permanent Purge),
 * SSH Connection Diagnostics, and Quick-Deploy triggers.
 */

import { api } from '../api.js';
import { renderIcon } from '../icons.js';
import { openModal } from '../components/modal.js';
import { showToast, showAlert } from '../components/toast.js';
import { canDeploy, canRegisterApp, canManageEnvironment } from '../auth.js';

let currentTab = 'active'; // 'active' | 'archived'

export async function renderAppsPage(container, tab = currentTab) {
  currentTab = tab;
  container.innerHTML = `
    <div style="padding: 48px; text-align: center; color: var(--t2);">
      <div class="mono">Loading applications catalog...</div>
    </div>
  `;

  try {
    const [activeApps, archivedApps] = await Promise.all([
      api.getApplications({ archived: 'false' }),
      api.getApplications({ archived: 'true' }).catch(() => []),
    ]);

    const isArchivedTab = currentTab === 'archived';
    const apps = isArchivedTab ? archivedApps : activeApps;

    container.innerHTML = `
      <div class="pg">
        <div>
          <h1>Applications & Projects</h1>
          <p class="sub">Manage multiple projects, repositories, and their attached target environments.</p>
        </div>
        ${canRegisterApp() && !isArchivedTab ? `
          <div>
            <button id="btn-register-app" class="btn" aria-label="Register new application">
              ${renderIcon('plus', 14)}
              <span>Register new project</span>
            </button>
          </div>
        ` : ''}
      </div>

      <!-- Segmented View Tabs (Active vs Archived) -->
      <div style="display: flex; gap: 8px; margin-bottom: 20px;">
        <button id="tab-active-apps" class="btn sm ${!isArchivedTab ? 'btn-primary' : 'btn-ghost'}" style="${!isArchivedTab ? 'font-weight: 600;' : ''}">
          Active Projects (${activeApps.length})
        </button>
        <button id="tab-archived-apps" class="btn sm ${isArchivedTab ? 'btn-primary' : 'btn-ghost'}" style="${isArchivedTab ? 'font-weight: 600;' : ''}">
          Archived Projects (${archivedApps.length})
        </button>
      </div>

      ${apps.length === 0 ? `
        <div class="pn" style="text-align: center; padding: 48px 24px; border-style: dashed;">
          <div style="max-width: 440px; margin: 0 auto;">
            <div style="color: var(--pr); margin-bottom: 12px;">
              ${renderIcon('cube', 36)}
            </div>
            <h2 style="font-size: 16px; margin-bottom: 6px;">${isArchivedTab ? 'No Archived Projects' : 'Clean Slate: No Projects Registered'}</h2>
            <p class="t2" style="font-size: 13px; line-height: 1.5; margin-bottom: 20px;">
              ${isArchivedTab
          ? 'There are currently no archived applications. Projects archived from the active tab will appear here.'
          : 'Your Pipra instance is clean and ready. Register your first application or microservice repository to begin configuring target deployment environments.'}
            </p>
            ${!isArchivedTab && canRegisterApp() ? `
              <button id="btn-register-app-zero" class="btn btn-primary" aria-label="Register first application">
                ${renderIcon('plus', 14)}
                <span>Register your first project</span>
              </button>
            ` : ''}
          </div>
        </div>
      ` : ''}

      ${apps.map(app => {
            const appEnvs = app.environments || [];
            return `
          <div class="pn" style="margin-bottom: 24px; ${isArchivedTab ? 'opacity: 0.85; border-style: dashed;' : ''}">
            <div class="ph" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
              <div>
                <div style="display: flex; align-items: baseline; gap: 8px; flex-wrap: wrap;">
                  <h2>${app.display_name}</h2>
                  <span class="mono dim">(${app.name})</span>
                  ${isArchivedTab ? `<span class="b warn" style="font-size: 11px;">Archived</span>` : ''}
                </div>
                <div class="t3" style="font-size: 13px; margin-top: 4px;">
                  Repo: <code class="mono">${app.repo_url}</code> · Branch: <code>${app.default_branch || 'devel'}</code> · Dockerfile: <code>${app.dockerfile}</code> · Image: <code>${app.image_name}</code>
                  ${app.webhook_enabled ? `· <span class="b ok" style="font-size: 11px;">GitOps: Push Webhook Active (${app.auto_deploy_branch || 'devel'})</span>` : ''}
                </div>
              </div>
              <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
                ${!isArchivedTab ? `
                  ${canRegisterApp() ? `
                    <button class="btn sm btn-edit-app" data-app-id="${app.id}" title="Edit application metadata">
                      ${renderIcon('edit', 12)}
                      <span>Edit</span>
                    </button>
                    <button class="btn sm btn-webhooks-app" data-app-id="${app.id}" data-app-name="${app.name}" data-app-display="${app.display_name}" title="Configure GitOps Webhook">
                      ${renderIcon('terminal', 12)}
                      <span>Webhooks</span>
                    </button>
                  ` : ''}
                  ${canManageEnvironment() ? `
                    <button class="btn sm btn-add-app-env" data-app-id="${app.id}" data-app-name="${app.name}">
                      ${renderIcon('plus', 12)}
                      <span>Add environment</span>
                    </button>
                  ` : ''}
                  ${canDeploy() ? `
                    <a class="btn p sm" href="#/deploy?app=${app.id}">
                      ${renderIcon('play', 12)}
                      <span>Launch wizard</span>
                    </a>
                  ` : ''}
                  ${canRegisterApp() ? `
                    <button class="btn sm btn-ghost btn-archive-app" data-app-id="${app.id}" data-app-name="${app.name}" data-app-display="${app.display_name}" title="Archive project" style="color: var(--t3);">
                      ${renderIcon('ban', 12)}
                      <span>Archive</span>
                    </button>
                  ` : ''}
                ` : `
                  ${canRegisterApp() ? `
                    <button class="btn sm btn-restore-app" data-app-id="${app.id}" data-app-name="${app.name}" title="Restore project to active catalog">
                      ${renderIcon('rot', 12)}
                      <span>Restore</span>
                    </button>
                    <button class="btn sm btn-danger btn-purge-app" data-app-id="${app.id}" data-app-name="${app.name}" data-app-display="${app.display_name}" title="Permanently delete project">
                      ${renderIcon('x', 12)}
                      <span>Permanently Delete</span>
                    </button>
                  ` : ''}
                `}
              </div>
            </div>

            <!-- Attached Environments List for this Application -->
            <div style="padding: 12px 16px;">
              <h3 style="font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--t3); margin-bottom: 10px;">
                Attached Target Environments (${appEnvs.length})
              </h3>

              ${appEnvs.length === 0 ? `
                <div class="t3" style="padding: 16px 0; font-size: 13px;">
                  No environments attached to this project. Click <b>"Add environment"</b> to configure target servers.
                </div>
              ` : `
                <div class="tw" style="margin: 0; border: 1px solid var(--bd); border-radius: 6px;">
                  <table>
                    <thead>
                      <tr>
                        <th>Environment</th>
                        <th>Target Host & SSH</th>
                        <th>Remote Dir & Ports</th>
                        <th>Live Release</th>
                        <th>Status</th>
                        <th style="text-align: right;">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${appEnvs.map(env => {
              const isProd = env.is_production || env.name === 'production';
              return `
                          <tr>
                            <td>
                              <span class="env ${isProd ? 'prod' : (env.name.includes('staging') ? 'staging' : 'devel')}">
                                <i></i>${env.display_name || env.name}
                              </span>
                              ${isProd ? '<div style="font-size: 10px; color: var(--bad); margin-top: 2px;">Production Critical</div>' : ''}
                            </td>
                            <td>
                              <div class="mono" style="font-size: 13px;">
                                ${env.ssh_user || 'devel'}@<b>${env.host || '127.0.0.1'}</b>:${env.ssh_port || 22}
                              </div>
                              <div class="t3" style="font-size: 11px;">
                                Auth: ${env.auth_type || 'NONE'} ${env.has_credential ? '<span style="color: var(--ok)">· Vaulted Key</span>' : ''}
                              </div>
                            </td>
                            <td>
                              <div class="mono" style="font-size: 12px; max-width: 220px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                ${env.app_dir || app.app_dir}
                              </div>
                              <div class="mono t3" style="font-size: 11px;">
                                Prod :${env.host_port || app.host_port} · Staging :${env.staging_port || app.staging_port}
                              </div>
                            </td>
                            <td>
                              <div class="mono" style="font-size: 12px; color: var(--pr); max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                ${env.active_release_id || 'none'}
                              </div>
                            </td>
                            <td>
                              <span class="b ok" style="font-size: 11px;">${renderIcon('check', 10)}Healthy</span>
                            </td>
                            <td style="text-align: right;">
                              <div style="display: inline-flex; gap: 6px;">
                                <button class="btn sm btn-test-conn" data-env-id="${env.id}" title="Test SSH connectivity to ${env.host}">
                                  ${renderIcon('terminal', 12)}
                                  <span>Test SSH</span>
                                </button>
                                ${canManageEnvironment() && !isArchivedTab ? `
                                  <button class="btn sm btn-configure-env" data-env-id="${env.id}" data-app-id="${app.id}" title="Configure target host">
                                    ${renderIcon('edit', 12)}
                                    <span>Configure</span>
                                  </button>
                                  <button class="btn sm btn-ghost btn-delete-env" data-env-id="${env.id}" data-env-name="${env.display_name || env.name}" data-env-host="${env.host}" title="Decommission environment" style="color: var(--t3);">
                                    ${renderIcon('x', 12)}
                                  </button>
                                ` : ''}
                                ${canDeploy() && !isArchivedTab ? `
                                  <a class="btn sm ${isProd ? 'd' : 'p'}" href="#/deploy?app=${app.id}&env=${env.id}" title="Quick deploy to ${env.name}">
                                    ${renderIcon('play', 12)}
                                    <span>Deploy</span>
                                  </a>
                                ` : ''}
                              </div>
                            </td>
                          </tr>
                        `;
            }).join('')}
                    </tbody>
                  </table>
                </div>
              `}
            </div>
          </div>
        `;
          }).join('')}
    `;

    bindAppsPageEvents(apps, container);
  } catch (err) {
    container.innerHTML = `
      <div class="pn" style="margin-top: 24px; border-color: var(--bad);">
        <div class="ph"><h2 style="color: var(--bad);">Failed to load applications catalog</h2></div>
        <div class="pb"><p class="t2">${err.message || 'An error occurred while loading applications.'}</p></div>
      </div>
    `;
  }
}

function bindAppsPageEvents(apps, container) {
  // Tab Switching (Active vs Archived)
  const tabActive = container.querySelector('#tab-active-apps');
  const tabArchived = container.querySelector('#tab-archived-apps');
  if (tabActive) tabActive.addEventListener('click', () => renderAppsPage(container, 'active'));
  if (tabArchived) tabArchived.addEventListener('click', () => renderAppsPage(container, 'archived'));

  // 1. Test SSH Connection buttons (Modern Toast / Alert)
  container.querySelectorAll('.btn-test-conn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const envId = btn.getAttribute('data-env-id');
      const originalText = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = `${renderIcon('loader', 12)} <span>Testing...</span>`;

      try {
        const res = await api.testConnection(envId);
        if (res.success) {
          showToast({
            type: 'success',
            title: 'SSH Connection Active',
            message: res.message || 'Host is reachable and Docker daemon is responding.'
          });
        } else {
          showAlert({
            type: 'error',
            title: 'SSH Connection Check Failed',
            message: res.error || 'Host unreachable or SSH authentication failed.',
            details: res.details || res.stderr || null
          });
        }
      } catch (err) {
        showAlert({
          type: 'error',
          title: 'Connection Error',
          message: err.message
        });
      } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
      }
    });
  });

  // 2. Edit Project Metadata Modal (PUT /api/applications/:id)
  container.querySelectorAll('.btn-edit-app').forEach(btn => {
    btn.addEventListener('click', () => {
      const appId = btn.getAttribute('data-app-id');
      const app = apps.find(a => a.id === appId);
      if (!app) return;

      const branchesStr = Array.isArray(app.permitted_branches) ? app.permitted_branches.join(', ') : (app.permitted_branches || 'develop, main, prod');

      const formHtml = `
        <form id="form-edit-app" class="fl" style="gap: 12px;">
          <div class="row2">
            <div>
              <label for="edit-app-slug">Project Slug (Identifier)</label>
              <input type="text" id="edit-app-slug" class="mono" value="${app.name}" disabled style="width: 100%; height: 36px; padding: 0 10px; background: var(--bg); border: 1px solid var(--bd); border-radius: 6px; opacity: 0.7; cursor: not-allowed;" />
              <div class="hint" style="font-size: 11px; color: var(--t3); margin-top: 3px;">Slug is immutable to protect foreign keys and image tags.</div>
            </div>
            <div>
              <label for="edit-app-display">Display Name *</label>
              <input type="text" id="edit-app-display" value="${app.display_name}" required style="width: 100%; height: 36px; padding: 0 10px; background: var(--in); border: 1px solid var(--bd); border-radius: 6px;" />
            </div>
          </div>

          <div>
            <label for="edit-app-repo">Git Repository URL *</label>
            <input type="text" id="edit-app-repo" class="mono" value="${app.repo_url}" required style="width: 100%; height: 36px; padding: 0 10px; background: var(--in); border: 1px solid var(--bd); border-radius: 6px;" />
          </div>

          <div class="row2">
            <div>
              <label for="edit-app-branch">Default Branch *</label>
              <input type="text" id="edit-app-branch" class="mono" value="${app.default_branch || 'devel'}" required style="width: 100%; height: 36px; padding: 0 10px; background: var(--in); border: 1px solid var(--bd); border-radius: 6px;" />
            </div>
            <div>
              <label for="edit-app-dockerfile">Dockerfile Path *</label>
              <input type="text" id="edit-app-dockerfile" class="mono" value="${app.dockerfile || 'Dockerfile.jenkins'}" required style="width: 100%; height: 36px; padding: 0 10px; background: var(--in); border: 1px solid var(--bd); border-radius: 6px;" />
            </div>
          </div>

          <div>
            <label for="edit-app-permitted">Permitted Branches (comma-separated)</label>
            <input type="text" id="edit-app-permitted" class="mono" value="${branchesStr}" required style="width: 100%; height: 36px; padding: 0 10px; background: var(--in); border: 1px solid var(--bd); border-radius: 6px;" />
            <div class="hint" style="font-size: 11px; color: var(--t3); margin-top: 3px;">Use <code>*</code> to permit any custom branch name, or enter patterns (e.g. <code>develop-*, release/*, *</code>).</div>
          </div>

          <div>
            <label for="edit-app-dir">Default Host App Directory *</label>
            <input type="text" id="edit-app-dir" class="mono" value="${app.app_dir}" required style="width: 100%; height: 36px; padding: 0 10px; background: var(--in); border: 1px solid var(--bd); border-radius: 6px;" />
          </div>

          <div class="row2">
            <div>
              <label for="edit-app-prod-port">Default Production Port</label>
              <input type="number" id="edit-app-prod-port" class="mono" value="${app.host_port || 4000}" required style="width: 100%; height: 36px; padding: 0 10px; background: var(--in); border: 1px solid var(--bd); border-radius: 6px;" />
            </div>
            <div>
              <label for="edit-app-staging-port">Default Staging Port</label>
              <input type="number" id="edit-app-staging-port" class="mono" value="${app.staging_port || 4001}" required style="width: 100%; height: 36px; padding: 0 10px; background: var(--in); border: 1px solid var(--bd); border-radius: 6px;" />
            </div>
          </div>
        </form>
      `;

      openModal({
        title: `Edit Project: ${app.display_name}`,
        bodyHtml: formHtml,
        content: formHtml,
        onConfirm: async () => {
          const form = document.getElementById('form-edit-app');
          if (!form) return false;
          if (!form.checkValidity()) {
            form.reportValidity();
            return false;
          }

          const permitted = document.getElementById('edit-app-permitted').value
            .split(',')
            .map(s => s.trim())
            .filter(Boolean);

          await api.updateApplication(app.id, {
            display_name: document.getElementById('edit-app-display').value,
            repo_url: document.getElementById('edit-app-repo').value,
            default_branch: document.getElementById('edit-app-branch').value,
            dockerfile: document.getElementById('edit-app-dockerfile').value,
            permitted_branches: permitted,
            app_dir: document.getElementById('edit-app-dir').value,
            host_port: parseInt(document.getElementById('edit-app-prod-port').value, 10),
            staging_port: parseInt(document.getElementById('edit-app-staging-port').value, 10),
          });

          showToast({
            type: 'success',
            title: 'Project Updated',
            message: `Updated configuration for ${document.getElementById('edit-app-display').value}.`
          });

          await renderAppsPage(container, currentTab);
          return true;
        }
      });
    });
  });

  // 3. Archive Project Modal
  container.querySelectorAll('.btn-archive-app').forEach(btn => {
    btn.addEventListener('click', () => {
      const appId = btn.getAttribute('data-app-id');
      const appName = btn.getAttribute('data-app-name');
      const appDisplay = btn.getAttribute('data-app-display');

      const bodyHtml = `
        <div style="font-size: 13px; line-height: 1.5; color: var(--t2);">
          <p>Are you sure you want to archive <strong>${appDisplay}</strong> (<code class="mono">${appName}</code>)?</p>
          <div style="margin: 12px 0; padding: 10px 12px; background: rgba(240, 184, 91, 0.1); border: 1px solid var(--warn); border-radius: 6px; color: var(--t1); font-size: 12px;">
            <strong>Notice:</strong>
            <ul style="margin: 6px 0 0 16px; padding: 0;">
              <li>Project and attached environments will be hidden from active views and the Deployment Wizard.</li>
              <li>Historical deployments and audit logs remain 100% intact.</li>
              <li>Live Docker containers on remote hosts remain completely untouched.</li>
              <li>You can restore this project at any time from the <b>Archived Projects</b> tab.</li>
            </ul>
          </div>
        </div>
      `;

      openModal({
        title: `Archive Project: ${appDisplay}`,
        bodyHtml,
        content: bodyHtml,
        confirmText: 'Archive Project',
        confirmClass: 'btn-secondary',
        onConfirm: async () => {
          await api.archiveApplication(appId, true);
          showToast({
            type: 'info',
            title: 'Project Archived',
            message: `Archived ${appDisplay}. Moved to Archived Projects tab.`
          });
          await renderAppsPage(container, currentTab);
          return true;
        }
      });
    });
  });

  // 4. Restore Project
  container.querySelectorAll('.btn-restore-app').forEach(btn => {
    btn.addEventListener('click', async () => {
      const appId = btn.getAttribute('data-app-id');
      const appName = btn.getAttribute('data-app-name');
      try {
        await api.archiveApplication(appId, false);
        showToast({
          type: 'success',
          title: 'Project Restored',
          message: `Restored ${appName} back to the active applications catalog.`
        });
        await renderAppsPage(container, 'active');
      } catch (err) {
        showAlert({ type: 'error', title: 'Restore Failed', message: err.message });
      }
    });
  });

  // 5. Permanently Purge Project Modal (Typed Slug Confirmation Barrier)
  container.querySelectorAll('.btn-purge-app').forEach(btn => {
    btn.addEventListener('click', () => {
      const appId = btn.getAttribute('data-app-id');
      const appName = btn.getAttribute('data-app-name');
      const appDisplay = btn.getAttribute('data-app-display');

      const bodyHtml = `
        <div style="font-size: 13px; line-height: 1.5; color: var(--t2);">
          <div style="padding: 10px 12px; background: rgba(242, 118, 131, 0.12); border: 1px solid var(--bad); border-radius: 6px; color: var(--bad); font-size: 12px; margin-bottom: 12px;">
            <strong>🚨 DANGER: Irreversible Deletion</strong><br/>
            This permanently removes project <strong>${appName}</strong> and all its attached target environment configurations from Pipra. Remote server containers remain untouched.
          </div>
          <p style="margin-bottom: 8px;">To prevent accidental deletion, please type the project slug <b><code class="mono">${appName}</code></b> below:</p>
          <input type="text" id="purge-confirm-slug" class="mono" placeholder="Type ${appName} to confirm" style="width: 100%; height: 36px; padding: 0 10px; background: var(--in); border: 1px solid var(--bd); border-radius: 6px;" />
        </div>
      `;

      openModal({
        title: `Permanently Delete ${appDisplay}`,
        bodyHtml,
        content: bodyHtml,
        confirmText: 'Permanently Delete',
        confirmClass: 'btn-danger',
        onConfirm: async () => {
          const input = document.getElementById('purge-confirm-slug');
          if (!input || input.value.trim() !== appName) {
            showAlert({
              type: 'warning',
              title: 'Confirmation Mismatch',
              message: `You must type "${appName}" exactly to confirm permanent deletion.`
            });
            return false;
          }

          try {
            await api.deleteApplication(appId, appName);
            showToast({
              type: 'info',
              title: 'Project Purged',
              message: `Permanently removed ${appDisplay} from Pipra.`
            });
            await renderAppsPage(container, currentTab);
            return true;
          } catch (err) {
            showAlert({
              type: 'error',
              title: 'Purge Failed',
              message: err.message
            });
            return false;
          }
        }
      });
    });
  });

  // 6. Delete/Decommission Environment Modal
  container.querySelectorAll('.btn-delete-env').forEach(btn => {
    btn.addEventListener('click', () => {
      const envId = btn.getAttribute('data-env-id');
      const envName = btn.getAttribute('data-env-name');
      const envHost = btn.getAttribute('data-env-host');

      const bodyHtml = `
        <div style="font-size: 13px; line-height: 1.5; color: var(--t2);">
          <p>Are you sure you want to decommission environment <strong>${envName}</strong> on host <code class="mono">${envHost}</code>?</p>
          <div style="margin: 12px 0; padding: 10px 12px; background: rgba(240, 184, 91, 0.1); border: 1px solid var(--warn); border-radius: 6px; color: var(--t1); font-size: 12px;">
            <strong>Notice:</strong> This unregisters the target host from Pipra. Any running containers on <code>${envHost}</code> will remain running.
          </div>
        </div>
      `;

      openModal({
        title: `Decommission Environment: ${envName}`,
        bodyHtml,
        content: bodyHtml,
        confirmText: 'Decommission',
        confirmClass: 'btn-danger',
        onConfirm: async () => {
          try {
            await api.deleteEnvironment(envId);
            showToast({
              type: 'info',
              title: 'Environment Decommissioned',
              message: `Removed ${envName} from project.`
            });
            await renderAppsPage(container, currentTab);
            return true;
          } catch (err) {
            showAlert({
              type: 'error',
              title: 'Decommission Failed',
              message: err.message
            });
            return false;
          }
        }
      });
    });
  });

  // 7. Configure Environment Modal
  container.querySelectorAll('.btn-configure-env').forEach(btn => {
    btn.addEventListener('click', async () => {
      const envId = btn.getAttribute('data-env-id');
      const appId = btn.getAttribute('data-app-id');
      const app = apps.find(a => a.id === appId) || {};
      const env = (app.environments || []).find(e => e.id === envId) || {};

      const formHtml = `
        <form id="form-edit-env" class="fl" style="gap: 12px;">
          <div>
            <label for="cfg-env-display">Environment Display Name *</label>
            <input type="text" id="cfg-env-display" value="${env.display_name || env.name}" required style="width: 100%; height: 36px; padding: 0 10px; background: var(--in); border: 1px solid var(--bd); border-radius: 6px;" />
          </div>

          <div class="row2">
            <div>
              <label for="cfg-env-host">Target Host IP / FQDN *</label>
              <input type="text" id="cfg-env-host" class="mono" value="${env.host || '127.0.0.1'}" placeholder="e.g. 192.168.10.12" required style="width: 100%; height: 36px; padding: 0 10px; background: var(--in); border: 1px solid var(--bd); border-radius: 6px;" />
              <div class="hint" style="font-size: 11px; color: var(--t3); margin-top: 3px;">Use 127.0.0.1 for local daemon or server IP over VPN.</div>
            </div>
            <div>
              <label for="cfg-env-ssh-user">SSH Service User *</label>
              <input type="text" id="cfg-env-ssh-user" class="mono" value="${env.ssh_user || 'devel'}" required style="width: 100%; height: 36px; padding: 0 10px; background: var(--in); border: 1px solid var(--bd); border-radius: 6px;" />
            </div>
          </div>

          <div class="row2">
            <div>
              <label for="cfg-env-ssh-port">SSH Port *</label>
              <input type="number" id="cfg-env-ssh-port" class="mono" value="${env.ssh_port || 22}" required style="width: 100%; height: 36px; padding: 0 10px; background: var(--in); border: 1px solid var(--bd); border-radius: 6px;" />
            </div>
            <div>
              <label for="cfg-env-auth">Auth Method</label>
              <select id="cfg-env-auth" style="width: 100%; height: 36px; padding: 0 10px; background: var(--in); border: 1px solid var(--bd); border-radius: 6px;">
                <option value="NONE" ${env.auth_type === 'NONE' ? 'selected' : ''}>None (Local Daemon or SSH Agent)</option>
                <option value="SSH_KEY" ${env.auth_type === 'SSH_KEY' ? 'selected' : ''}>SSH Key Pair</option>
                <option value="SSH_PASSWORD" ${env.auth_type === 'SSH_PASSWORD' ? 'selected' : ''}>SSH Password (AES-256 Vault)</option>
              </select>
            </div>
          </div>

          <div>
            <label for="cfg-env-cred">Host Password / Private Key</label>
            <input type="password" id="cfg-env-cred" class="mono" placeholder="${env.has_credential ? '•••••••• (Vaulted — leave blank to keep unchanged)' : 'Enter password or private key'}" style="width: 100%; height: 36px; padding: 0 10px; background: var(--in); border: 1px solid var(--bd); border-radius: 6px;" />
          </div>

          <div>
            <label for="cfg-env-dir">Target Application Directory on Host *</label>
            <input type="text" id="cfg-env-dir" class="mono" value="${env.app_dir || app.app_dir || '/home/devel/' + app.name}" required style="width: 100%; height: 36px; padding: 0 10px; background: var(--in); border: 1px solid var(--bd); border-radius: 6px;" />
          </div>

          <div class="row2">
            <div>
              <label for="cfg-env-prod-port">Production Port *</label>
              <input type="number" id="cfg-env-prod-port" class="mono" value="${env.host_port || app.host_port || 4000}" required style="width: 100%; height: 36px; padding: 0 10px; background: var(--in); border: 1px solid var(--bd); border-radius: 6px;" />
            </div>
            <div>
              <label for="cfg-env-staging-port">Staging Port *</label>
              <input type="number" id="cfg-env-staging-port" class="mono" value="${env.staging_port || app.staging_port || 4001}" required style="width: 100%; height: 36px; padding: 0 10px; background: var(--in); border: 1px solid var(--bd); border-radius: 6px;" />
            </div>
          </div>

          <div>
            <label for="cfg-env-file">Environment File</label>
            <input type="text" id="cfg-env-file" class="mono" value="${env.env_file || app.env_file || '.env.production'}" required style="width: 100%; height: 36px; padding: 0 10px; background: var(--in); border: 1px solid var(--bd); border-radius: 6px;" />
          </div>
        </form>
      `;

      openModal({
        title: `Configure Target: ${env.display_name || env.name} (${app.name})`,
        bodyHtml: formHtml,
        content: formHtml,
        onConfirm: async () => {
          const form = document.getElementById('form-edit-env');
          if (!form) return false;
          if (!form.checkValidity()) {
            form.reportValidity();
            return false;
          }
          await api.updateEnvironment(env.id, {
            display_name: document.getElementById('cfg-env-display').value,
            host: document.getElementById('cfg-env-host').value,
            ssh_user: document.getElementById('cfg-env-ssh-user').value,
            ssh_port: parseInt(document.getElementById('cfg-env-ssh-port').value, 10),
            auth_type: document.getElementById('cfg-env-auth').value,
            credential: document.getElementById('cfg-env-cred').value || undefined,
            app_dir: document.getElementById('cfg-env-dir').value,
            host_port: parseInt(document.getElementById('cfg-env-prod-port').value, 10),
            staging_port: parseInt(document.getElementById('cfg-env-staging-port').value, 10),
            env_file: document.getElementById('cfg-env-file').value,
          });
          showToast({
            type: 'success',
            title: 'Configuration Saved',
            message: `Updated target host settings for ${env.display_name || env.name}.`
          });
          await renderAppsPage(container, currentTab);
          return true;
        }
      });
    });
  });

  // 8. Add Environment to App Modal
  container.querySelectorAll('.btn-add-app-env').forEach(btn => {
    btn.addEventListener('click', () => {
      const appId = btn.getAttribute('data-app-id');
      const appName = btn.getAttribute('data-app-name');
      const app = apps.find(a => a.id === appId) || {};

      const formHtml = `
        <form id="form-create-env" class="fl" style="gap: 12px;">
          <div class="row2">
            <div>
              <label for="new-env-slug">Environment Identifier (e.g. qa, staging, prod) *</label>
              <input type="text" id="new-env-slug" class="mono" placeholder="e.g. qa" required style="width: 100%; height: 36px; padding: 0 10px; background: var(--in); border: 1px solid var(--bd); border-radius: 6px;" />
            </div>
            <div>
              <label for="new-env-display">Display Name *</label>
              <input type="text" id="new-env-display" placeholder="e.g. QA Validation Server" required style="width: 100%; height: 36px; padding: 0 10px; background: var(--in); border: 1px solid var(--bd); border-radius: 6px;" />
            </div>
          </div>

          <div class="row2">
            <div>
              <label for="new-env-host">Target Host IP / FQDN *</label>
              <input type="text" id="new-env-host" class="mono" value="192.168.10.12" required style="width: 100%; height: 36px; padding: 0 10px; background: var(--in); border: 1px solid var(--bd); border-radius: 6px;" />
            </div>
            <div>
              <label for="new-env-ssh-user">SSH User *</label>
              <input type="text" id="new-env-ssh-user" class="mono" value="devel" required style="width: 100%; height: 36px; padding: 0 10px; background: var(--in); border: 1px solid var(--bd); border-radius: 6px;" />
            </div>
          </div>

          <div class="row2">
            <div>
              <label for="new-env-prod-port">Production Port *</label>
              <input type="number" id="new-env-prod-port" class="mono" value="${app.host_port || 4000}" required style="width: 100%; height: 36px; padding: 0 10px; background: var(--in); border: 1px solid var(--bd); border-radius: 6px;" />
            </div>
            <div>
              <label for="new-env-staging-port">Staging Port *</label>
              <input type="number" id="new-env-staging-port" class="mono" value="${(app.host_port || 4000) + 1}" required style="width: 100%; height: 36px; padding: 0 10px; background: var(--in); border: 1px solid var(--bd); border-radius: 6px;" />
            </div>
          </div>

          <div>
            <label for="new-env-dir">Target Directory on Server *</label>
            <input type="text" id="new-env-dir" class="mono" value="/home/devel/${app.name}" required style="width: 100%; height: 36px; padding: 0 10px; background: var(--in); border: 1px solid var(--bd); border-radius: 6px;" />
          </div>

          <label class="ck">
            <input type="checkbox" id="new-env-is-prod" />
            <span>Mark as Production Critical (requires explicit deployment confirmation)</span>
          </label>
        </form>
      `;

      openModal({
        title: `Add Environment to ${app.display_name || appName}`,
        bodyHtml: formHtml,
        content: formHtml,
        onConfirm: async () => {
          const form = document.getElementById('form-create-env');
          if (!form) return false;
          if (!form.checkValidity()) {
            form.reportValidity();
            return false;
          }
          await api.createEnvironment({
            application_id: appId,
            name: document.getElementById('new-env-slug').value,
            display_name: document.getElementById('new-env-display').value,
            host: document.getElementById('new-env-host').value,
            ssh_user: document.getElementById('new-env-ssh-user').value,
            ssh_port: 22,
            host_port: parseInt(document.getElementById('new-env-prod-port').value, 10),
            staging_port: parseInt(document.getElementById('new-env-staging-port').value, 10),
            container_port: 3000,
            app_dir: document.getElementById('new-env-dir').value,
            env_file: '.env.production',
            is_production: document.getElementById('new-env-is-prod').checked ? 1 : 0,
          });
          showToast({
            type: 'success',
            title: 'Environment Added',
            message: `Attached ${document.getElementById('new-env-display').value} to ${app.display_name || appName}.`
          });
          await renderAppsPage(container, currentTab);
          return true;
        }
      });
    });
  });

  // 9. Register Application Modal
  const openRegisterModal = () => {
    const formHtml = `
      <form id="form-register-app" class="fl" style="gap: 12px;">
        <div class="row2">
          <div>
            <label for="app-slug">Project Slug (Identifier) *</label>
            <input type="text" id="app-slug" class="mono" placeholder="e.g. asdp-dims-be" required style="width: 100%; height: 36px; padding: 0 10px; background: var(--in); border: 1px solid var(--bd); border-radius: 6px;" />
          </div>
          <div>
            <label for="app-display">Display Name *</label>
            <input type="text" id="app-display" placeholder="e.g. ASDP DIMS Backend Service" required style="width: 100%; height: 36px; padding: 0 10px; background: var(--in); border: 1px solid var(--bd); border-radius: 6px;" />
          </div>
        </div>

        <div>
          <label for="app-repo">Git Repository URL *</label>
          <input type="text" id="app-repo" class="mono" placeholder="git@gitlab.asyst.co.id:asdp/asdp-dims-be.git" required style="width: 100%; height: 36px; padding: 0 10px; background: var(--in); border: 1px solid var(--bd); border-radius: 6px;" />
        </div>

        <div class="row2">
          <div>
            <label for="app-dockerfile">Dockerfile Path</label>
            <input type="text" id="app-dockerfile" class="mono" value="Dockerfile" required style="width: 100%; height: 36px; padding: 0 10px; background: var(--in); border: 1px solid var(--bd); border-radius: 6px;" />
          </div>
          <div>
            <label for="app-dir">Default Host Directory *</label>
            <input type="text" id="app-dir" class="mono" value="/home/devel/asdp-dims-be" required style="width: 100%; height: 36px; padding: 0 10px; background: var(--in); border: 1px solid var(--bd); border-radius: 6px;" />
          </div>
        </div>

        <div class="row2">
          <div>
            <label for="app-prod-port">Default Prod Port *</label>
            <input type="number" id="app-prod-port" class="mono" value="5000" required style="width: 100%; height: 36px; padding: 0 10px; background: var(--in); border: 1px solid var(--bd); border-radius: 6px;" />
          </div>
          <div>
            <label for="app-staging-port">Default Staging Port *</label>
            <input type="number" id="app-staging-port" class="mono" value="5001" required style="width: 100%; height: 36px; padding: 0 10px; background: var(--in); border: 1px solid var(--bd); border-radius: 6px;" />
          </div>
        </div>
      </form>
    `;

    openModal({
      title: 'Register New Project',
      bodyHtml: formHtml,
      content: formHtml,
      onConfirm: async () => {
        const form = document.getElementById('form-register-app');
        if (!form) return false;
        if (!form.checkValidity()) {
          form.reportValidity();
          return false;
        }
        await api.createApplication({
          name: document.getElementById('app-slug').value,
          display_name: document.getElementById('app-display').value,
          repo_url: document.getElementById('app-repo').value,
          dockerfile: document.getElementById('app-dockerfile').value,
          app_dir: document.getElementById('app-dir').value,
          host_port: parseInt(document.getElementById('app-prod-port').value, 10),
          staging_port: parseInt(document.getElementById('app-staging-port').value, 10),
          container_port: 3000,
          image_name: document.getElementById('app-slug').value,
          default_branch: 'devel',
          permitted_branches: ['develop', 'main', 'prod', 'staging'],
          healthcheck_path: '/',
          healthcheck_interval_sec: 2,
          healthcheck_max_retries: 15,
        });
        showToast({
          type: 'success',
          title: 'Project Registered',
          message: `Created project ${document.getElementById('app-display').value}.`
        });
        await renderAppsPage(container, currentTab);
        return true;
      }
    });
  };

  const registerBtn = document.getElementById('btn-register-app');
  if (registerBtn) {
    registerBtn.addEventListener('click', openRegisterModal);
  }
  const registerBtnZero = document.getElementById('btn-register-app-zero');
  if (registerBtnZero) {
    registerBtnZero.addEventListener('click', openRegisterModal);
  }

  // Webhook & GitOps Configuration Modal
  container.querySelectorAll('.btn-webhooks-app').forEach(btn => {
    btn.addEventListener('click', async () => {
      const appId = btn.getAttribute('data-app-id');
      const appName = btn.getAttribute('data-app-name');
      const appDisplay = btn.getAttribute('data-app-display');

      let app = null;
      let events = [];
      try {
        [app, events] = await Promise.all([
          api.getApplication(appId),
          api.getAppWebhooks(appId).catch(() => []),
        ]);
      } catch (err) {
        showAlert({ type: 'error', title: 'Failed to load webhooks', message: err.message });
        return;
      }

      const hostOrigin = window.location.origin;
      const ghWebhookUrl = `${hostOrigin}/api/webhooks/github?app=${app.id}`;
      const glWebhookUrl = `${hostOrigin}/api/webhooks/gitlab?app=${app.id}`;
      const envOptions = (app.environments || []).map(e => `
        <option value="${e.id}" ${app.auto_deploy_environment_id === e.id ? 'selected' : ''}>
          ${e.display_name || e.name} (${e.is_production ? 'Production' : 'Non-Production'})
        </option>
      `).join('');

      const eventsHtml = events.length === 0 ? `
        <div style="padding: 16px; text-align: center; color: var(--t3); font-size: 12px; border: 1px dashed var(--bdr); border-radius: 6px;">
          No webhook deliveries recorded yet. Configure your Git repository webhook to begin.
        </div>
      ` : `
        <div style="max-height: 180px; overflow-y: auto; border: 1px solid var(--bdr); border-radius: 6px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
            <thead>
              <tr style="background: var(--bg-surface); border-bottom: 1px solid var(--bdr); text-align: left; color: var(--t2);">
                <th style="padding: 6px 8px;">Status</th>
                <th style="padding: 6px 8px;">Event / Delivery</th>
                <th style="padding: 6px 8px;">Branch / Commit</th>
                <th style="padding: 6px 8px;">Time</th>
              </tr>
            </thead>
            <tbody>
              ${events.map(ev => {
                const badgeClass = ev.status === 'ACCEPTED' ? 'ok' : (ev.status === 'REJECTED' ? 'err' : 'warn');
                return `
                  <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <td style="padding: 6px 8px;"><span class="b ${badgeClass}" style="font-size: 10px;">${ev.status}</span></td>
                    <td style="padding: 6px 8px;"><code class="mono">${ev.event_type}</code> ${ev.delivery_id ? `<span class="dim">(${ev.delivery_id.substring(0, 8)})</span>` : ''}</td>
                    <td style="padding: 6px 8px;"><code class="mono">${ev.branch || '—'}</code> ${ev.commit_sha ? `<span class="dim">@${ev.commit_sha.substring(0, 7)}</span>` : ''}</td>
                    <td style="padding: 6px 8px; color: var(--t3); white-space: nowrap;">${new Date(ev.created_at).toLocaleTimeString()}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;

      const bodyHtml = `
        <div style="font-size: 13px; line-height: 1.5; color: var(--t1);">
          <div style="margin-bottom: 16px;">
            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-weight: 600;">
              <input type="checkbox" id="wh-enabled" ${app.webhook_enabled ? 'checked' : ''} style="accent-color: var(--accent);">
              <span>Enable Event-Driven GitOps Webhook Triggers</span>
            </label>
            <p class="t3" style="font-size: 12px; margin: 4px 0 0 24px;">
              Automatically triggers Pipra release pipelines when commits are pushed to the matching branch.
            </p>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px;">
            <div>
              <label class="lbl" for="wh-branch">Auto-Deploy Branch Filter</label>
              <input type="text" id="wh-branch" class="in" value="${app.auto_deploy_branch || 'devel'}" placeholder="e.g. devel or main">
            </div>
            <div>
              <label class="lbl" for="wh-env">Target Environment</label>
              <select id="wh-env" class="in">
                ${envOptions || '<option value="">No environments attached</option>'}
              </select>
            </div>
          </div>

          <div style="margin-bottom: 16px;">
            <label class="lbl">GitHub Webhook Payload URL</label>
            <div style="display: flex; gap: 8px;">
              <input type="text" class="in mono" readonly value="${ghWebhookUrl}" id="wh-gh-url" style="font-size: 12px;">
              <button type="button" class="btn sm" id="btn-copy-gh-url" title="Copy to clipboard">
                ${renderIcon('copy', 12)}
                <span>Copy</span>
              </button>
            </div>
          </div>

          <div style="margin-bottom: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <label class="lbl" style="margin: 0;">Webhook Secret (HMAC SHA-256)</label>
              <button type="button" class="btn sm btn-ghost" id="btn-rotate-wh-secret" style="font-size: 11px; padding: 2px 8px;">
                ${renderIcon('rot', 10)}
                <span>Generate / Rotate Secret</span>
              </button>
            </div>
            <div style="display: flex; gap: 8px;">
              <input type="password" class="in mono" id="wh-secret-display" readonly value="${app.has_webhook_secret ? '••••••••••••••••••••••••••••••••' : ''}" placeholder="${app.has_webhook_secret ? '' : 'No secret set'}" style="font-size: 12px;">
              <button type="button" class="btn sm" id="btn-copy-wh-secret" title="Copy Secret" ${!app.has_webhook_secret ? 'disabled' : ''}>
                ${renderIcon('copy', 12)}
                <span>Copy</span>
              </button>
            </div>
            <p class="t3" style="font-size: 11px; margin-top: 4px;">
              Configured in GitHub/GitLab repository settings under <b>Secret</b>. Authenticates payload integrity via HMAC-SHA256.
            </p>
          </div>

          <div>
            <label class="lbl">Recent Delivery Events</label>
            ${eventsHtml}
          </div>
        </div>
      `;

      openModal({
        title: `GitOps & Webhook Settings: ${appDisplay}`,
        bodyHtml,
        content: bodyHtml,
        confirmText: 'Save Settings',
        confirmClass: 'btn-primary',
        onConfirm: async () => {
          const enabled = document.getElementById('wh-enabled').checked;
          const branch = document.getElementById('wh-branch').value.trim();
          const targetEnvId = document.getElementById('wh-env').value;

          try {
            await api.updateApplication(app.id, {
              display_name: app.display_name,
              repo_url: app.repo_url,
              app_dir: app.app_dir,
              webhook_enabled: enabled ? 1 : 0,
              auto_deploy_branch: branch || 'devel',
              auto_deploy_environment_id: targetEnvId || null,
            });

            showToast({
              type: 'success',
              title: 'Webhook Settings Saved',
              message: `Updated GitOps configuration for ${app.name}.`,
            });
            await renderAppsPage(container, currentTab);
            return true;
          } catch (err) {
            showAlert({ type: 'error', title: 'Save Failed', message: err.message });
            return false;
          }
        },
      });

      // Bind in-modal interactions
      setTimeout(() => {
        const copyGhBtn = document.getElementById('btn-copy-gh-url');
        if (copyGhBtn) {
          copyGhBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(ghWebhookUrl);
            showToast({ type: 'info', title: 'Copied', message: 'GitHub Webhook URL copied to clipboard.' });
          });
        }

        const rotateBtn = document.getElementById('btn-rotate-wh-secret');
        if (rotateBtn) {
          rotateBtn.addEventListener('click', async () => {
            try {
              const res = await api.regenerateWebhookSecret(app.id);
              if (res.secret) {
                const secInput = document.getElementById('wh-secret-display');
                secInput.type = 'text';
                secInput.value = res.secret;
                const copyBtn = document.getElementById('btn-copy-wh-secret');
                if (copyBtn) copyBtn.removeAttribute('disabled');
                navigator.clipboard.writeText(res.secret);
                showToast({
                  type: 'success',
                  title: 'New Secret Generated',
                  message: 'Generated and copied 256-bit secret to clipboard.',
                });
              }
            } catch (err) {
              showAlert({ type: 'error', title: 'Secret Generation Failed', message: err.message });
            }
          });
        }

        const copySecBtn = document.getElementById('btn-copy-wh-secret');
        if (copySecBtn) {
          copySecBtn.addEventListener('click', () => {
            const secInput = document.getElementById('wh-secret-display');
            if (secInput && secInput.value && !secInput.value.includes('•')) {
              navigator.clipboard.writeText(secInput.value);
              showToast({ type: 'info', title: 'Copied', message: 'Webhook secret copied to clipboard.' });
            } else {
              showToast({ type: 'warn', title: 'Hidden Secret', message: 'Click Rotate to generate a new visible secret token.' });
            }
          });
        }
      }, 50);
    });
  });
}
