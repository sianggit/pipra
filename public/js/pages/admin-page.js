/**
 * Pipra Administration, RBAC & Audit Trail Page
 */

import { api } from '../api.js';
import { renderIcon } from '../icons.js';
import { state } from '../state.js';

export async function renderAdminPage(container) {
  container.innerHTML = `<div style="padding: 24px; color: var(--color-text-secondary);">Loading audit trail & platform controls...</div>`;

  try {
    const auditLogs = await api.getAuditLogs(100);

    container.innerHTML = `
      <div class="page-header">
        <div class="page-title-group">
          <h1>
            ${renderIcon('shield', 24)}
            <span>Administration & Audit Logs</span>
          </h1>
          <p class="page-subtitle">Security event auditing, role-based authorization rules, and persistent platform diagnostics.</p>
        </div>
      </div>

      <!-- System Architecture & Security Information -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">
            ${renderIcon('box', 16)}
            <span>Platform Specifications & Operational Parameters</span>
          </span>
        </div>
        <div class="card-body">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: var(--space-6);">
            <div>
              <span style="font-size: var(--font-size-xs); color: var(--color-text-secondary); text-transform: uppercase;">Persistence Engine</span>
              <div style="font-weight: 600; font-size: 13px; color: var(--color-text-primary); margin-top: 2px;">SQLite (Node.js native node:sqlite)</div>
              <div style="font-size: 11px; color: var(--color-text-tertiary);">WAL Mode, ACID Transactions, Zero External Daemons</div>
            </div>
            <div>
              <span style="font-size: var(--font-size-xs); color: var(--color-text-secondary); text-transform: uppercase;">Event Streaming Hub</span>
              <div style="font-weight: 600; font-size: 13px; color: var(--color-text-primary); margin-top: 2px;">Server-Sent Events (SSE)</div>
              <div style="font-size: 11px; color: var(--color-text-tertiary);">Zero-dependency, Resilient Reconnection Recovery</div>
            </div>
            <div>
              <span style="font-size: var(--font-size-xs); color: var(--color-text-secondary); text-transform: uppercase;">Security Model</span>
              <div style="font-weight: 600; font-size: 13px; color: var(--color-text-primary); margin-top: 2px;">Strict RBAC & Secret Redaction</div>
              <div style="font-size: 11px; color: var(--color-text-tertiary);">No Arbitrary Shell Strings, Parameter Allowlists</div>
            </div>
            <div>
              <span style="font-size: var(--font-size-xs); color: var(--color-text-secondary); text-transform: uppercase;">Brand Tagline</span>
              <div style="font-weight: 600; font-size: 13px; color: var(--color-surface-raised); margin-top: 2px;">Build with confidence. Ship with control.</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Permanent Audit Trail Table -->
      <div class="card">
        <div class="card-header">
          <span class="card-title">
            ${renderIcon('terminal', 16)}
            <span>Permanent Consequential Action Audit Trail</span>
          </span>
          <span style="font-size: var(--font-size-xs); color: var(--color-text-secondary);">Last 100 actions</span>
        </div>
        <div class="card-body" style="padding: 0;">
          ${auditLogs.length === 0 ? `
            <div style="padding: 32px; text-align: center; color: var(--color-text-tertiary);">
              No audit records logged yet.
            </div>
          ` : `
            <table>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Operator</th>
                  <th>Action</th>
                  <th>Resource</th>
                  <th>Environment</th>
                  <th>Details</th>
                  <th>Client IP</th>
                </tr>
              </thead>
              <tbody>
                ${auditLogs.map(log => `
                  <tr style="font-size: 12px;">
                    <td style="font-family: var(--font-family-mono); font-size: 11px; color: var(--color-text-secondary);">
                      ${new Date(log.created_at).toLocaleString()}
                    </td>
                    <td><strong>${log.username}</strong></td>
                    <td>
                      <span class="badge badge-info" style="font-size: 10px;">${log.action}</span>
                    </td>
                    <td style="font-family: var(--font-family-mono); font-size: 11px;">${log.resource_id || '--'}</td>
                    <td>
                      ${log.environment ? `<span class="env-tag env-tag-nonprod">${log.environment}</span>` : '--'}
                    </td>
                    <td style="color: var(--color-text-primary);">${log.details || '--'}</td>
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
    container.innerHTML = `<div style="color: var(--color-status-error);">Error: ${err.message}</div>`;
  }
}

export function renderLoginPage(container) {
  container.innerHTML = `
    <div style="min-height: calc(100vh - 120px); display: flex; align-items: center; justify-content: center; padding: 24px;">
      <div class="card" style="width: 100%; max-width: 420px; box-shadow: var(--shadow-1);">
        <div class="card-header" style="justify-content: center; flex-direction: column; text-align: center; gap: 8px; padding: 28px 24px;">
          <img src="/assets/logo.svg" alt="Pipra" width="180" height="42" />
          <div style="font-size: 11px; font-weight: 600; letter-spacing: 0.08em; color: var(--color-accent-cyan); text-transform: uppercase; margin-top: 4px;">
            BUILD WITH CONFIDENCE. SHIP WITH CONTROL.
          </div>
        </div>
        <div class="card-body">
          <form id="login-form">
            <div class="form-group">
              <label class="form-label" for="login-username">Operator Username</label>
              <input type="text" id="login-username" class="form-control" value="operator" required autofocus />
            </div>

            <div class="form-group">
              <label class="form-label" for="login-password">Password</label>
              <input type="password" id="login-password" class="form-control" value="pipra-ops-2026" required />
            </div>

            <div id="login-error" style="display: none; margin-bottom: var(--space-6); padding: var(--space-3); background-color: var(--color-status-error-bg); border: 1px solid var(--color-status-error); border-radius: var(--radius-sm); color: #fca5a5; font-size: 12px;"></div>

            <button type="submit" id="btn-login-submit" class="btn btn-primary" style="width: 100%;">
              <span>Sign In to Pipra</span>
            </button>
          </form>

          <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--color-border-default); font-size: 11px; color: var(--color-text-secondary);">
            <div>Default Accounts:</div>
            <div>• <strong>admin</strong> (password: <code>pipra-admin-2026</code>)</div>
            <div>• <strong>operator</strong> (password: <code>pipra-ops-2026</code>)</div>
            <div>• <strong>viewer</strong> (password: <code>pipra-viewer-2026</code>)</div>
          </div>
        </div>
      </div>
    </div>
  `;

  const form = document.getElementById('login-form');
  const errorBox = document.getElementById('login-error');
  const submitBtn = document.getElementById('btn-login-submit');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorBox.style.display = 'none';
    submitBtn.disabled = true;
    submitBtn.innerText = 'Signing in...';

    const u = document.getElementById('login-username').value.trim();
    const p = document.getElementById('login-password').value;

    try {
      const result = await api.login(u, p);
      state.set({ user: result.user });
      window.location.hash = '#/overview';
    } catch (err) {
      submitBtn.disabled = false;
      submitBtn.innerText = 'Sign In to Pipra';
      errorBox.textContent = err.message;
      errorBox.style.display = 'block';
    }
  });
}
