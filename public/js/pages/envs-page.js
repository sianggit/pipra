/**
 * Pipra Environments Management Page
 * Displays target environments with host configuration, SSH connectivity testing,
 * and AES-256 vaulted credentials.
 */

import { api } from '../api.js';
import { renderIcon } from '../icons.js';
import { renderStatusBadge } from '../components/health-badge.js';
import { openModal } from '../components/modal.js';
import { showToast, showAlert } from '../components/toast.js';
import { canDeploy, canManageEnvironment } from '../auth.js';
import { state } from '../state.js';

export async function renderEnvsPage(container) {
  container.innerHTML = `
    <div style="padding: 48px; text-align: center; color: var(--t2);">
      <div class="mono">Loading environments...</div>
    </div>
  `;

  try {
    const envs = await api.getEnvironments();

    const formatDate = (iso) => {
      if (!iso) return 'just now';
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    container.innerHTML = `
      <div class="pg">
        <div>
          <h1>Target Environments</h1>
          <p class="sub">Serving hosts, SSH credentials, cutover safeguards, and active releases.</p>
        </div>
      </div>

      <div>
        ${envs.length === 0 ? `
          <div class="pn" style="text-align: center; padding: 48px 24px; border-style: dashed;">
            <div style="max-width: 440px; margin: 0 auto;">
              <div style="color: var(--pr); margin-bottom: 12px;">
                ${renderIcon('terminal', 36)}
              </div>
              <h2 style="font-size: 16px; margin-bottom: 6px;">No Target Environments Configured</h2>
              <p class="t2" style="font-size: 13px; line-height: 1.5; margin-bottom: 20px;">
                Environments are attached directly to registered projects. To set up target hosts and deployment destinations, register or select a project in the Applications catalog.
              </p>
              <a class="btn btn-primary" href="#/apps">
                ${renderIcon('cube', 14)}
                <span>Go to Applications & Projects</span>
              </a>
            </div>
          </div>
        ` : ''}

        ${envs.map(env => {
          const isProd = env.is_production || env.name === 'production';
          const safeguards = isProd
            ? ['Operator confirmation barrier', 'Automated sub-second rollback', 'Target concurrency locks']
            : ['Staging health check barrier', 'Automated cleanup on abort'];

          return `
            <div class="pn" style="margin-bottom: 20px; ${isProd ? 'border-color: color-mix(in srgb, var(--bad) 40%, var(--bd));' : ''}">
              <div class="ph">
                <div style="display: flex; gap: 10px; align-items: baseline;">
                  <h2>${env.display_name}</h2>
                  ${env.app_display_name ? `<span class="dim mono">(${env.app_display_name})</span>` : ''}
                  ${isProd
                    ? `<span class="b bad">${renderIcon('shield', 12)}Production critical</span>`
                    : '<span class="b info">Non-production</span>'}
                </div>
                <div style="display: flex; gap: 8px; align-items: center;">
                  <button class="btn sm btn-test-conn" data-env-id="${env.id}" title="Test SSH connection to ${env.host}">
                    ${renderIcon('terminal', 12)}
                    <span>Test SSH</span>
                  </button>
                  ${canManageEnvironment() ? `
                    <button id="btn-edit-env-${env.id}" class="btn sm" aria-label="Configure host for ${env.name}">
                      ${renderIcon('edit', 12)}
                      <span>Configure host</span>
                    </button>
                    <button class="btn sm btn-ghost btn-delete-env" data-env-id="${env.id}" data-env-name="${env.display_name || env.name}" data-env-host="${env.host}" title="Decommission environment" style="color: var(--t3);">
                      ${renderIcon('x', 12)}
                      <span>Decommission</span>
                    </button>
                  ` : ''}
                  ${canDeploy() ? `
                    <a class="btn sm ${isProd ? 'd' : 'p'}" href="#/deploy?env=${env.id}">
                      Deploy to ${env.name}
                    </a>
                  ` : ''}
                </div>
              </div>

              <dl style="grid-template-columns: 150px 1fr;">
                <dt>Target Host & SSH</dt>
                <dd class="mono">
                  ${env.host} <span class="dim">· ${env.ssh_user || 'devel'}@${env.host}:${env.ssh_port || 22}</span>
                  ${env.has_credential ? `<span style="color: var(--ok); margin-left: 8px; display: inline-flex; align-items: center; gap: 4px;" title="Credential encrypted at rest with AES-256-GCM">${renderIcon('lock', 10)} Vaulted</span>` : ''}
                </dd>
                <dt>Remote Directory</dt>
                <dd class="mono">${env.app_dir || '/home/devel/asdp-dims-fe'}</dd>
                <dt>Ports</dt>
                <dd class="mono">Prod :${env.host_port || 4000} · Staging :${env.staging_port || 4001}</dd>
                <dt>Live Release</dt>
                <dd class="mono" style="color: var(--pr);">${env.active_release_id || 'none'}</dd>
                <dt>Health Status</dt>
                <dd>
                  <span class="b ok">${renderIcon('check', 12)}Healthy</span>
                  <span class="dim" style="margin-left: 8px;">verified ${formatDate(env.last_verified_at)}</span>
                </dd>
                <dt>Safeguards</dt>
                <dd class="t2">${safeguards.join(' · ')}</dd>
              </dl>

              ${isProd ? `
                <div class="grd" style="margin-top: 12px;">
                  ${renderIcon('shield', 18)}
                  <div>
                    <b>Production safeguard active.</b> Deployment requires operator confirmation and post-cutover verification. If health checks fail, the engine rolls back automatically.
                  </div>
                </div>
              ` : ''}
            </div>
          `;
        }).join('')}
      </div>
    `;

    bindEnvsPageEvents(envs, container);
  } catch (err) {
    container.innerHTML = `
      <div class="pn" style="margin-top: 24px; border-color: var(--bad);">
        <div class="ph"><h2 style="color: var(--bad);">Failed to load environments</h2></div>
        <div class="pb"><p class="t2">${err.message || 'An error occurred while loading environments.'}</p></div>
      </div>
    `;
  }
}

function bindEnvsPageEvents(envs, container) {
  // 1. Test SSH Connection (Modern Toast / Alert)
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
            title: 'SSH Connection Failed',
            message: res.error || 'Host unreachable or authentication failed.',
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

  if (!canManageEnvironment()) return;

  // 2. Edit Environment Modal
  for (const env of envs) {
    const editBtn = document.getElementById(`btn-edit-env-${env.id}`);
    if (editBtn) {
      editBtn.addEventListener('click', () => {
        const formHtml = `
          <form id="modal-form-env" class="fl" style="padding: 0; gap: 12px;">
            <div>
              <label for="edit-env-display" style="display: block; font-weight: 500; margin-bottom: 5px;">Environment Display Name *</label>
              <input type="text" id="edit-env-display" class="form-control" value="${env.display_name}" required style="width: 100%; height: 36px; padding: 0 10px; background: var(--in); border: 1px solid var(--bd); border-radius: 6px;" />
            </div>

            <div>
              <label for="edit-env-host" style="display: block; font-weight: 500; margin-bottom: 5px;">Target Host Server Address (IP / FQDN) *</label>
              <input type="text" id="edit-env-host" class="mono" value="${env.host}" placeholder="e.g. 192.168.1.100 or server.asyst.co.id" required style="width: 100%; height: 36px; padding: 0 10px; background: var(--in); border: 1px solid var(--bd); border-radius: 6px;" />
              <div class="hint" style="color: var(--t3); font-size: 12px; margin-top: 4px;">Enter the IPv4 address or hostname of the remote deployment server.</div>
            </div>

            <div class="row2">
              <div>
                <label for="edit-env-ssh-user" style="display: block; font-weight: 500; margin-bottom: 5px;">SSH Service User</label>
                <input type="text" id="edit-env-ssh-user" class="mono" value="${env.ssh_user || 'devel'}" required style="width: 100%; height: 36px; padding: 0 10px; background: var(--in); border: 1px solid var(--bd); border-radius: 6px;" />
              </div>
              <div>
                <label for="edit-env-ssh-port" style="display: block; font-weight: 500; margin-bottom: 5px;">SSH Port</label>
                <input type="number" id="edit-env-ssh-port" class="mono" value="${env.ssh_port || 22}" min="1" max="65535" required style="width: 100%; height: 36px; padding: 0 10px; background: var(--in); border: 1px solid var(--bd); border-radius: 6px;" />
              </div>
            </div>

            <div>
              <label for="edit-env-auth-type" style="display: block; font-weight: 500; margin-bottom: 5px;">Authentication Method</label>
              <select id="edit-env-auth-type" style="width: 100%; height: 36px; padding: 0 10px; background: var(--in); border: 1px solid var(--bd); border-radius: 6px;">
                <option value="NONE" ${env.auth_type === 'NONE' ? 'selected' : ''}>None (Local Daemon or SSH Agent)</option>
                <option value="SSH_KEY" ${env.auth_type === 'SSH_KEY' ? 'selected' : ''}>SSH Key Pair</option>
                <option value="SSH_PASSWORD" ${env.auth_type === 'SSH_PASSWORD' ? 'selected' : ''}>SSH Password (Encrypted Vault)</option>
              </select>
            </div>

            <div id="credential-group">
              <label for="edit-env-credential" style="display: block; font-weight: 500; margin-bottom: 5px;">Host Password / Private Key</label>
              <input type="password" id="edit-env-credential" class="mono" placeholder="${env.has_credential ? '•••••••• (Saved securely — leave blank to keep unchanged)' : 'Enter target host password or private key'}" style="width: 100%; height: 36px; padding: 0 10px; background: var(--in); border: 1px solid var(--bd); border-radius: 6px;" />
              <div class="hint" style="color: var(--t3); font-size: 12px; margin-top: 4px;">Saved credentials are encrypted at rest with AES-256-GCM.</div>
            </div>

            <div>
              <label for="edit-env-dir" style="display: block; font-weight: 500; margin-bottom: 5px;">Target App Directory</label>
              <input type="text" id="edit-env-dir" class="mono" value="${env.app_dir || '/home/devel/asdp-dims-fe'}" style="width: 100%; height: 36px; padding: 0 10px; background: var(--in); border: 1px solid var(--bd); border-radius: 6px;" />
            </div>

            <div class="row2">
              <div>
                <label for="edit-env-prod-port" style="display: block; font-weight: 500; margin-bottom: 5px;">Prod Port</label>
                <input type="number" id="edit-env-prod-port" class="mono" value="${env.host_port || 4000}" style="width: 100%; height: 36px; padding: 0 10px; background: var(--in); border: 1px solid var(--bd); border-radius: 6px;" />
              </div>
              <div>
                <label for="edit-env-staging-port" style="display: block; font-weight: 500; margin-bottom: 5px;">Staging Port</label>
                <input type="number" id="edit-env-staging-port" class="mono" value="${env.staging_port || 4001}" style="width: 100%; height: 36px; padding: 0 10px; background: var(--in); border: 1px solid var(--bd); border-radius: 6px;" />
              </div>
            </div>
          </form>
        `;

        openModal({
          title: `Configure Target Host: ${env.display_name}`,
          bodyHtml: formHtml,
          content: formHtml,
          onConfirm: async () => {
            const form = document.getElementById('modal-form-env');
            if (form && !form.checkValidity()) {
              form.reportValidity();
              return false;
            }

            const display_name = document.getElementById('edit-env-display').value;
            const host = document.getElementById('edit-env-host').value;
            const ssh_user = document.getElementById('edit-env-ssh-user').value;
            const ssh_port = parseInt(document.getElementById('edit-env-ssh-port').value, 10);
            const auth_type = document.getElementById('edit-env-auth-type').value;
            const credential = document.getElementById('edit-env-credential').value;
            const app_dir = document.getElementById('edit-env-dir').value;
            const host_port = parseInt(document.getElementById('edit-env-prod-port').value, 10);
            const staging_port = parseInt(document.getElementById('edit-env-staging-port').value, 10);

            await api.updateEnvironment(env.id, {
              display_name,
              host,
              ssh_user,
              ssh_port,
              auth_type,
              credential: credential.length > 0 ? credential : undefined,
              app_dir,
              host_port,
              staging_port,
            });

            showToast({
              type: 'success',
              title: 'Host Configuration Saved',
              message: `Updated parameters for target host ${display_name}.`
            });

            await renderEnvsPage(container);
            return true;
          }
        });
      });
    }
  }

  // 3. Decommission Environment
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
              message: `Removed ${envName} from Pipra.`
            });
            await renderEnvsPage(container);
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
}
