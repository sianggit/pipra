/**
 * Pipra Environments Management Page
 * Aligned with DESIGN.md & Control Plane Redesign Mockup
 */

import { api } from '../api.js';
import { renderIcon } from '../icons.js';
import { renderStatusBadge } from '../components/health-badge.js';
import { openModal } from '../components/modal.js';
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
          <h1>Environments</h1>
          <p class="sub">Serving targets, cutover safeguards, and rollback policy.</p>
        </div>
      </div>

      <div>
        ${envs.map(env => {
          const isProd = env.is_production || env.name === 'production';
          const safeguards = isProd
            ? ['Operator confirmation barrier', 'Automated sub-second rollback', 'Target concurrency locks']
            : ['Staging health check barrier', 'Automated cleanup on abort'];

          return `
            <div class="pn" style="${isProd ? 'border-color: color-mix(in srgb, var(--bad) 40%, var(--bd));' : ''}">
              <div class="ph">
                <div style="display: flex; gap: 10px; align-items: center;">
                  <h2>${env.display_name}</h2>
                  ${isProd
                    ? `<span class="b bad">${renderIcon('shield', 12)}Production critical</span>`
                    : '<span class="b info">Non-production</span>'}
                </div>
                <div style="display: flex; gap: 8px; align-items: center;">
                  ${canManageEnvironment() ? `
                    <button id="btn-edit-env-${env.id}" class="btn sm" aria-label="Configure host for ${env.name}">
                      ${renderIcon('edit', 12)}
                      <span>Configure host</span>
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
                <dt>Target</dt>
                <dd class="mono">
                  ${env.host} <span class="dim">· ${env.ssh_user || 'devel'}@${env.host}:${env.ssh_port || 22}</span>
                  ${env.has_credential ? `<span style="color: var(--ok); margin-left: 8px; display: inline-flex; align-items: center; gap: 4px;" title="Credential encrypted at rest with AES-256-GCM">${renderIcon('lock', 10)} Vaulted</span>` : ''}
                </dd>
                <dt>Live release</dt>
                <dd class="mono" style="color: var(--pr);">${env.active_release_id || 'asdp-dims-fe:devel-latest'}</dd>
                <dt>Health</dt>
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
                    <b>Production safeguard.</b> Deployment requires operator confirmation and post-cutover verification. If health checks fail, the engine rolls back to the previous release.
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
        <div class="ph"><h2 style="color: var(--bad);">Error loading environments</h2></div>
        <div class="pb"><p class="t2">${err.message}</p></div>
      </div>
    `;
  }
}

function bindEnvsPageEvents(envs, container) {
  if (!canManageEnvironment()) return;

  for (const env of envs) {
    const editBtn = document.getElementById(`btn-edit-env-${env.id}`);
    if (editBtn) {
      editBtn.addEventListener('click', () => {
        openModal({
          title: `Configure Target Host: ${env.display_name}`,
          bodyHtml: `
            <div class="fl" style="padding: 0;">
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
                  <option value="NONE" ${env.auth_type === 'NONE' ? 'selected' : ''}>None (Simulated / Local Engine)</option>
                  <option value="SSH_KEY" ${env.auth_type === 'SSH_KEY' ? 'selected' : ''}>SSH Key Pair (Recommended)</option>
                  <option value="SSH_PASSWORD" ${env.auth_type === 'SSH_PASSWORD' ? 'selected' : ''}>SSH Password (Encrypted Vault)</option>
                </select>
              </div>

              <div id="credential-group">
                <label for="edit-env-credential" style="display: block; font-weight: 500; margin-bottom: 5px;">Host Password / Private Key</label>
                <input type="password" id="edit-env-credential" class="mono" placeholder="${env.has_credential ? '•••••••• (Saved securely — leave blank to keep unchanged)' : 'Enter target host password or private key'}" style="width: 100%; height: 36px; padding: 0 10px; background: var(--in); border: 1px solid var(--bd); border-radius: 6px;" />
                <div class="hint" style="color: var(--t3); font-size: 12px; margin-top: 4px;">Saved credentials are encrypted at rest with AES-256-GCM and never exposed over the API.</div>
              </div>
            </div>
          `,
          confirmText: 'Update Environment',
          onConfirm: async () => {
            const host = document.getElementById('edit-env-host').value.trim();
            const displayName = document.getElementById('edit-env-display').value.trim();
            const sshUser = document.getElementById('edit-env-ssh-user').value.trim();
            const sshPort = parseInt(document.getElementById('edit-env-ssh-port').value, 10);
            const authType = document.getElementById('edit-env-auth-type').value;
            const credential = document.getElementById('edit-env-credential').value;

            if (!host || !displayName) {
              throw new Error('Host address and display name are required.');
            }

            const payload = {
              host,
              display_name: displayName,
              ssh_user: sshUser,
              ssh_port: sshPort,
              auth_type: authType,
            };

            if (credential && credential.trim() !== '') {
              payload.credential = credential.trim();
            } else if (authType === 'NONE') {
              payload.credential = '';
            }

            await api.updateEnvironment(env.id, payload);
            state.notifyToast(`Target host for ${displayName} updated to ${host}`, 'success');
            renderEnvsPage(container);
          },
        });
      });
    }
  }
}
