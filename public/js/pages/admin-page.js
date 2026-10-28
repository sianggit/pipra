/**
 * Pipra Administration, RBAC & Audit Trail Page
 * Security audit logging, role-based authorization matrix,
 * system configuration parameters, and operator authentication.
 */

import { api } from '../api.js';
import { renderIcon } from '../icons.js';
import { state } from '../state.js';

export async function renderAdminPage(container) {
  container.innerHTML = `
    <div style="padding: var(--space-8); text-align: center; color: var(--color-text-secondary);">
      <div style="font-family: var(--font-family-mono); font-size: var(--font-size-sm);">Loading audit trail & platform controls...</div>
    </div>
  `;

  try {
    const auditLogs = await api.getAuditLogs(100);

    container.innerHTML = `
      <div class="page-header">
        <div class="page-title-group">
          <h1>
            ${renderIcon('shield', 22)}
            <span>Administration & Audit Logs</span>
          </h1>
          <p class="page-subtitle">Security event auditing, role-based authorization rules, and persistent platform diagnostics.</p>
        </div>
      </div>

      <!-- System Architecture & Security Parameters -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">
            ${renderIcon('box', 16)}
            <span>Platform Specifications & Operating Bounds</span>
          </span>
        </div>
        <div class="card-body">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: var(--space-4);">
            <div>
              <span style="font-size: var(--font-size-2xs); color: var(--color-text-secondary); text-transform: uppercase; font-weight: 600;">Persistence Engine</span>
              <div style="font-weight: 600; font-size: 13px; color: var(--color-text-primary); margin-top: 2px;">SQLite (node:sqlite)</div>
              <div style="font-size: 11px; color: var(--color-text-muted);">WAL Mode, ACID Transactions, Zero Daemons</div>
            </div>
            <div>
              <span style="font-size: var(--font-size-2xs); color: var(--color-text-secondary); text-transform: uppercase; font-weight: 600;">Real-Time Observability</span>
              <div style="font-weight: 600; font-size: 13px; color: var(--color-text-primary); margin-top: 2px;">Server-Sent Events (SSE)</div>
              <div style="font-size: 11px; color: var(--color-text-muted);">Zero-dependency, Automatic Reconnection</div>
            </div>
            <div>
              <span style="font-size: var(--font-size-2xs); color: var(--color-text-secondary); text-transform: uppercase; font-weight: 600;">Security Governance</span>
              <div style="font-weight: 600; font-size: 13px; color: var(--color-text-primary); margin-top: 2px;">Strict RBAC & Secret Masking</div>
              <div style="font-size: 11px; color: var(--color-text-muted);">Parameter Allowlists, Sanitized Command Output</div>
            </div>
            <div>
              <span style="font-size: var(--font-size-2xs); color: var(--color-text-secondary); text-transform: uppercase; font-weight: 600;">Brand Identity</span>
              <div style="font-weight: 600; font-size: 13px; color: var(--color-action-primary); margin-top: 2px;">Pipra Engineering Platform</div>
              <div style="font-size: 11px; color: var(--color-text-muted);">Build with confidence. Ship with control.</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Permanent Audit Trail Table -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">
            ${renderIcon('terminal', 16)}
            <span>Consequential Action Audit Trail</span>
          </span>
          <span style="font-size: var(--font-size-xs); color: var(--color-text-secondary); font-family: var(--font-family-mono);">Last 100 immutable events</span>
        </div>
        <div class="card-body" style="padding: 0;">
          ${auditLogs.length === 0 ? `
            <div style="padding: var(--space-8); text-align: center; color: var(--color-text-muted);">
              No audit records logged yet.
            </div>
          ` : `
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Operator</th>
                  <th>Action</th>
                  <th>Resource ID</th>
                  <th>Environment</th>
                  <th>Execution Details</th>
                  <th>Client IP</th>
                </tr>
              </thead>
              <tbody>
                ${auditLogs.map(log => `
                  <tr style="font-size: 12px;">
                    <td style="font-family: var(--font-family-mono); font-size: 11px; color: var(--color-text-secondary); white-space: nowrap;">
                      ${new Date(log.created_at).toLocaleString()}
                    </td>
                    <td><strong>${log.username}</strong></td>
                    <td>
                      <span class="badge badge-info" style="font-size: 10px;">${log.action}</span>
                    </td>
                    <td style="font-family: var(--font-family-mono); font-size: 11px;">${log.resource_id || '—'}</td>
                    <td>
                      ${log.environment ? `<span class="env-tag env-tag-nonprod">${log.environment}</span>` : '—'}
                    </td>
                    <td style="color: var(--color-text-primary);">${log.details || '—'}</td>
                    <td style="font-family: var(--font-family-mono); font-size: 11px; color: var(--color-text-secondary);">${log.ip_address || '127.0.0.1'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          `}
        </div>
      </div>
    `;
  } catch (err) {
    container.innerHTML = `
      <div class="card" style="border-left: 3px solid var(--color-status-danger);">
        <div class="card-body">
          <h3 style="color: var(--color-status-danger); margin-bottom: var(--space-2);">Error loading administration data</h3>
          <p style="color: var(--color-text-secondary);">${err.message}</p>
        </div>
      </div>
    `;
  }
}

export function renderLoginPage(container) {
  container.innerHTML = `
    <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: var(--space-6); background-color: var(--color-surface-base);">
      <div class="card" style="width: 100%; max-width: 400px; box-shadow: var(--shadow-dialog); margin-bottom: 0;">
        <div class="card-header" style="justify-content: center; flex-direction: column; text-align: center; gap: var(--space-2); padding: var(--space-6) var(--space-5);">
          <img src="/assets/logo.svg" alt="Pipra" width="168" height="38" />
          <div style="font-size: 10px; font-weight: 600; letter-spacing: 0.08em; color: var(--color-text-secondary); text-transform: uppercase; margin-top: var(--space-1);">
            BUILD WITH CONFIDENCE. SHIP WITH CONTROL.
          </div>
        </div>
        <div class="card-body">
          <form id="login-form">
            <div class="form-group">
              <label class="form-label" for="login-username">Operator Username</label>
              <input type="text" id="login-username" class="form-control" value="operator" required autofocus autocomplete="username" />
            </div>

            <div class="form-group">
              <label class="form-label" for="login-password">Password</label>
              <input type="password" id="login-password" class="form-control" value="pipra-ops-2026" required autocomplete="current-password" />
            </div>

            <div id="login-error" style="display: none; margin-bottom: var(--space-4); padding: var(--space-2) var(--space-3); background-color: var(--color-status-danger-bg); border: 1px solid var(--color-status-danger-border); border-radius: var(--radius-sm); color: var(--color-status-danger); font-size: 12px;"></div>

            <button type="submit" id="btn-login-submit" class="btn btn-primary" style="width: 100%;">
              <span>Sign In to Control Plane</span>
            </button>
          </form>

          <div style="margin-top: var(--space-5); padding-top: var(--space-3); border-top: 1px solid var(--color-border-subtle); font-size: 11px; color: var(--color-text-secondary);">
            <div style="font-weight: 600; margin-bottom: 4px; color: var(--color-text-primary);">Configured Operator Accounts:</div>
            <div>• <code>admin</code> (password: <code>pipra-admin-2026</code>)</div>
            <div>• <code>operator</code> (password: <code>pipra-ops-2026</code>)</div>
            <div>• <code>viewer</code> (password: <code>pipra-viewer-2026</code>)</div>
          </div>
        </div>
      </div>
    </div>
  `;

  const form = document.getElementById('login-form');
  const errorBox = document.getElementById('login-error');
  const submitBtn = document.getElementById('btn-login-submit');

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorBox.style.display = 'none';
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span>Authenticating...</span>`;

      const username = document.getElementById('login-username').value.trim();
      const password = document.getElementById('login-password').value;

      try {
        const authData = await api.login(username, password);
        state.set({ user: authData.user });
        window.location.hash = '#/overview';
      } catch (err) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<span>Sign In to Control Plane</span>`;
        errorBox.textContent = err.message || 'Authentication failed. Please verify credentials.';
        errorBox.style.display = 'block';
      }
    });
  }
}
