/**
 * Pipra Environments Management Page
 * Target environments, dynamic host configuration, AES-256-GCM vault credentials,
 * and role-based action gating.
 */

import { api } from '../api.js';
import { renderIcon } from '../icons.js';
import { renderStatusBadge } from '../components/health-badge.js';
import { openModal } from '../components/modal.js';
import { canDeploy, canManageEnvironment } from '../auth.js';
import { state } from '../state.js';

export async function renderEnvsPage(container) {
  container.innerHTML = `
    <div style="padding: var(--space-8); text-align: center; color: var(--color-text-secondary);">
      <div style="font-family: var(--font-family-mono); font-size: var(--font-size-sm);">Loading environments...</div>
    </div>
  `;

  try {
    const envs = await api.getEnvironments();

    container.innerHTML = `
      <div class="page-header">
        <div class="page-title-group">
          <h1>
            ${renderIcon('server', 22)}
            <span>Deployment Environments</span>
          </h1>
          <p class="page-subtitle">Serving targets, cutover strategies, target host server configuration, and automated rollback policies.</p>
        </div>
      </div>

      <div style="display: flex; flex-direction: column; gap: var(--space-5);">
        ${envs.map(env => {
          const isProd = env.is_production;
          const authLabel = env.auth_type === 'SSH_KEY' 
            ? 'SSH Key Pair' 
            : (env.auth_type === 'SSH_PASSWORD' ? 'SSH Password' : 'None (Local / Agent)');
          
          return `
            <div class="card" style="margin-bottom: 0; border-left: 3px solid ${isProd ? 'var(--color-status-danger)' : 'var(--color-action-primary)'};">
              <div class="card-header">
                <div style="display: flex; align-items: center; gap: var(--space-3); flex-wrap: wrap;">
                  <span class="card-title">${env.display_name}</span>
                  <span class="env-tag ${isProd ? 'env-tag-prod' : 'env-tag-nonprod'}">
                    ${isProd ? renderIcon('shield', 12) : renderIcon('box', 12)}
                    <span>${isProd ? 'PRODUCTION CRITICAL' : 'NON-PRODUCTION'}</span>
                  </span>
                </div>
                <div style="display: flex; align-items: center; gap: var(--space-2);">
                  ${canManageEnvironment() ? `
                    <button id="btn-edit-env-${env.id}" class="btn btn-secondary btn-sm" aria-label="Configure host for ${env.name}">
                      ${renderIcon('edit', 12)}
                      <span>Configure Host</span>
                    </button>
                  ` : ''}
                  ${canDeploy() ? `
                    <a href="#/deploy?env=${env.id}" class="btn ${isProd ? 'btn-secondary' : 'btn-primary'} btn-sm" aria-label="Deploy to ${env.name}">
                      ${renderIcon('play', 12)}
                      <span>Deploy to ${env.name}</span>
                    </a>
                  ` : `
                    <span class="badge badge-info" style="font-size: 10px;">Observation</span>
                  `}
                </div>
              </div>

              <div class="card-body">
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: var(--space-4);">
                  <div>
                    <span style="font-size: var(--font-size-2xs); color: var(--color-text-secondary); text-transform: uppercase; font-weight: 600;">Target Host & Worker</span>
                    <div style="font-weight: 600; font-family: var(--font-family-mono); font-size: 13px; margin-top: 2px; color: var(--color-text-primary); word-break: break-all;">
                      ${env.host}
                    </div>
                    <div style="font-size: 11px; color: var(--color-text-muted); font-family: var(--font-family-mono); margin-top: 2px;">
                      ${env.ssh_user || 'devel'}@${env.host}:${env.ssh_port || 22}
                    </div>
                    <div style="font-size: 11px; color: var(--color-text-secondary); margin-top: 4px; display: flex; align-items: center; gap: 4px;">
                      <span>Auth: <strong>${authLabel}</strong></span>
                      ${env.has_credential ? `<span style="color: var(--color-status-success); display: inline-flex; align-items: center; gap: 2px;" title="Credential encrypted at rest with AES-256-GCM">${renderIcon('lock', 10)} Vaulted</span>` : ''}
                    </div>
                  </div>

                  <div>
                    <span style="font-size: var(--font-size-2xs); color: var(--color-text-secondary); text-transform: uppercase; font-weight: 600;">Active Live Release</span>
                    <div style="font-weight: 600; font-family: var(--font-family-mono); font-size: 13px; color: var(--color-action-primary); margin-top: 2px;">
                      ${env.active_release_id || 'asdp-dims-fe:devel-latest'}
                    </div>
                    <div style="font-size: 11px; color: var(--color-text-muted);">Serving live traffic</div>
                  </div>

                  <div>
                    <span style="font-size: var(--font-size-2xs); color: var(--color-text-secondary); text-transform: uppercase; font-weight: 600;">Health Verification</span>
                    <div style="margin-top: 4px;">
                      ${renderStatusBadge(env.last_health_status || 'HEALTHY')}
                    </div>
                    <div style="font-size: 11px; color: var(--color-text-muted); margin-top: 2px;">
                      Last verified: ${env.last_verified_at ? new Date(env.last_verified_at).toLocaleTimeString() : 'N/A'}
                    </div>
                  </div>

                  <div>
                    <span style="font-size: var(--font-size-2xs); color: var(--color-text-secondary); text-transform: uppercase; font-weight: 600;">Cutover Safeguards</span>
                    <div style="font-size: 12px; margin-top: 2px; color: var(--color-text-primary); line-height: 18px;">
                      ${isProd 
                        ? '• Operator confirmation barrier<br>• Automated sub-second rollback<br>• Target concurrency locks' 
                        : '• Staging health check barrier<br>• Automated cleanup on abort'}
                    </div>
                  </div>
                </div>

                ${isProd ? `
                  <div style="margin-top: var(--space-4); padding: var(--space-3) var(--space-4); background-color: var(--color-status-danger-bg); border: 1px solid var(--color-status-danger-border); border-radius: var(--radius-sm); font-size: 12px; color: var(--color-text-primary); display: flex; align-items: flex-start; gap: var(--space-3);">
                    <span style="color: var(--color-status-danger); margin-top: 2px;">${renderIcon('shield', 16)}</span>
                    <div>
                      <strong style="color: var(--color-status-danger);">Production Safety Guardrail:</strong>
                      Deployments to this target environment require explicit operator confirmation and trigger continuous post-cutover verification probes. If health checks fail, the engine immediately rolls back to the previous release.
                    </div>
                  </div>
                ` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    bindEnvsPageEvents(envs, container);
  } catch (err) {
    container.innerHTML = `
      <div class="card" style="border-left: 3px solid var(--color-status-danger);">
        <div class="card-body">
          <h3 style="color: var(--color-status-danger); margin-bottom: var(--space-2);">Error loading environments</h3>
          <p style="color: var(--color-text-secondary);">${err.message}</p>
        </div>
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
            <div class="form-group">
              <label class="form-label" for="edit-env-display">Environment Display Name *</label>
              <input type="text" id="edit-env-display" class="form-control" value="${env.display_name}" required />
            </div>

            <div class="form-group">
              <label class="form-label" for="edit-env-host">Target Host Server Address (IP / FQDN) *</label>
              <input type="text" id="edit-env-host" class="form-control font-mono" value="${env.host}" placeholder="e.g. 192.168.1.100 or server.asyst.co.id" required />
              <div class="form-hint">Enter the IPv4 address or hostname of the remote deployment server.</div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3);">
              <div class="form-group">
                <label class="form-label" for="edit-env-ssh-user">SSH Service User</label>
                <input type="text" id="edit-env-ssh-user" class="form-control font-mono" value="${env.ssh_user || 'devel'}" required />
              </div>
              <div class="form-group">
                <label class="form-label" for="edit-env-ssh-port">SSH Port</label>
                <input type="number" id="edit-env-ssh-port" class="form-control font-mono" value="${env.ssh_port || 22}" min="1" max="65535" required />
              </div>
            </div>

            <div class="form-group">
              <label class="form-label" for="edit-env-auth-type">Authentication Method</label>
              <select id="edit-env-auth-type" class="form-control">
                <option value="NONE" ${env.auth_type === 'NONE' ? 'selected' : ''}>None (Simulated / Local Engine)</option>
                <option value="SSH_KEY" ${env.auth_type === 'SSH_KEY' ? 'selected' : ''}>SSH Key Pair (Recommended)</option>
                <option value="SSH_PASSWORD" ${env.auth_type === 'SSH_PASSWORD' ? 'selected' : ''}>SSH Password (Encrypted Vault)</option>
              </select>
            </div>

            <div class="form-group" id="credential-group">
              <label class="form-label" for="edit-env-credential">Host Password / Private Key</label>
              <input type="password" id="edit-env-credential" class="form-control font-mono" placeholder="${env.has_credential ? '•••••••• (Saved securely — leave blank to keep unchanged)' : 'Enter target host password or private key'}" />
              <div class="form-hint">Saved credentials are encrypted at rest with AES-256-GCM and never exposed over the API.</div>
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

            // Only send credential if user provided one
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
