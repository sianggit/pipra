/**
 * Pipra Administration, Users (RBAC) & Audit Log Console
 * Strictly guarded for Administrator accounts.
 * Aligned with DESIGN.md & Control Plane Redesign Mockup.
 */

import { api } from '../api.js';
import { renderIcon } from '../icons.js';
import { state } from '../state.js';
import { getTheme, toggleTheme } from '../theme.js';
import { openModal } from '../components/modal.js';

export async function renderAdminPage(container) {
  container.innerHTML = `
    <div style="padding: 48px; text-align: center; color: var(--t2);">
      <div class="mono">Loading administrative control plane...</div>
    </div>
  `;

  try {
    const [usersList, auditLogs] = await Promise.all([
      api.getUsers().catch(err => {
        console.warn('Could not load users:', err);
        return [];
      }),
      api.getAuditLogs(150).catch(err => {
        console.warn('Could not load audit logs:', err);
        return [];
      }),
    ]);

    let activeTab = 'users'; // 'users' | 'audit'
    let eventFilter = 'all'; // 'all' | 'dep' | 'login' | 'user'
    const currentUser = state.get().user || {};

    const formatDate = (iso) => {
      if (!iso) return '—';
      const d = new Date(iso);
      return `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
    };

    function renderView() {
      container.innerHTML = `
        <div class="pg" style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px;">
          <div>
            <h1>Administration & Access</h1>
            <p class="sub">Configure operator roles, enforce RBAC boundaries, and inspect compliance audit events.</p>
          </div>
          ${activeTab === 'users' ? `
            <button id="btn-add-user" class="btn p" style="display: flex; align-items: center; gap: 6px;">
              ${renderIcon('plus', 14)}
              <span>Add User</span>
            </button>
          ` : ''}
        </div>

        <div class="chips" role="tablist" style="margin-bottom: 20px;">
          <button type="button" class="chip" id="tab-btn-users" role="tab" aria-selected="${activeTab === 'users'}" aria-pressed="${activeTab === 'users'}">
            Users &amp; Access (${usersList.length})
          </button>
          <button type="button" class="chip" id="tab-btn-audit" role="tab" aria-selected="${activeTab === 'audit'}" aria-pressed="${activeTab === 'audit'}">
            Audit Trail (${auditLogs.length})
          </button>
        </div>

        ${activeTab === 'users' ? renderUsersTabHtml() : renderAuditTabHtml()}
      `;

      // Bind Tab Switching
      const tabUsersBtn = container.querySelector('#tab-btn-users');
      const tabAuditBtn = container.querySelector('#tab-btn-audit');
      if (tabUsersBtn) {
        tabUsersBtn.addEventListener('click', () => {
          activeTab = 'users';
          renderView();
        });
      }
      if (tabAuditBtn) {
        tabAuditBtn.addEventListener('click', () => {
          activeTab = 'audit';
          renderView();
        });
      }

      if (activeTab === 'users') {
        bindUserActions();
      } else {
        bindAuditActions();
      }
    }

    function renderUsersTabHtml() {
      return `
        <div class="pn">
          <div class="ph" style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <h2 style="font-size: 15px; margin: 0;">Platform User Inventory</h2>
              <p class="dim" style="font-size: 12px; margin: 2px 0 0;">Authorized operators, admins, and deployment viewers.</p>
            </div>
            <span class="dim" style="font-size: 12px;">SQLite scrypt auth · Zero NPM runtime · Strict RBAC</span>
          </div>

          <div class="tw">
            <table>
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Assigned Role</th>
                  <th>Active Sessions</th>
                  <th>Created Date</th>
                  <th style="text-align: right;">Actions</th>
                </tr>
              </thead>
              <tbody>
                ${usersList.length === 0 ? `
                  <tr><td colspan="5" class="empty">No users registered in system.</td></tr>
                ` : usersList.map(u => {
                  const isCurrent = u.id === currentUser.id || u.username === currentUser.username;
                  const roleUpper = (u.role || 'viewer').toUpperCase();
                  let badgeClass = 'neu';
                  if (u.role === 'admin') badgeClass = 'info';
                  else if (u.role === 'operator') badgeClass = 'prod';

                  return `
                    <tr>
                      <td>
                        <div style="display: flex; align-items: center; gap: 10px;">
                          <div style="width: 28px; height: 28px; border-radius: 50%; background: var(--bd); display: grid; place-items: center; font-weight: 600; font-size: 12px; color: var(--t1);">
                            ${(u.username || 'U')[0].toUpperCase()}
                          </div>
                          <div>
                            <span class="mono" style="font-weight: 600; color: var(--t1);">${u.username}</span>
                            ${isCurrent ? `<span class="dim" style="font-size: 11px; margin-left: 6px;">(You)</span>` : ''}
                          </div>
                        </div>
                      </td>
                      <td>
                        <span class="b ${badgeClass}">${roleUpper}</span>
                      </td>
                      <td class="mono num t2">
                        ${u.active_sessions > 0 ? `
                          <span style="color: var(--ok); display: inline-flex; align-items: center; gap: 4px;">
                            <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: var(--ok);"></span>
                            ${u.active_sessions} active
                          </span>
                        ` : `<span class="dim">0 active</span>`}
                      </td>
                      <td class="mono num t2">${formatDate(u.created_at)}</td>
                      <td style="text-align: right;">
                        <div style="display: inline-flex; gap: 6px;">
                          <button type="button" class="btn sm s btn-edit-role" data-id="${u.id}" data-name="${u.username}" data-role="${u.role}" title="Change role">
                            Role
                          </button>
                          <button type="button" class="btn sm s btn-reset-pw" data-id="${u.id}" data-name="${u.username}" title="Reset password">
                            Password
                          </button>
                          <button type="button" class="btn sm d btn-delete-user" data-id="${u.id}" data-name="${u.username}" ${isCurrent ? 'disabled title="Cannot delete active session account"' : 'title="Delete user"'}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- RBAC Privilege Reference Matrix Card -->
        <div class="pn" style="margin-top: 24px;">
          <div class="ph">
            <h3 style="margin: 0; font-size: 14px;">Role-Based Access Control (RBAC) Specification</h3>
            <p class="dim" style="font-size: 12px; margin-top: 2px;">Pipra strictly verifies permissions at both the API Gateway and Client Routing boundaries.</p>
          </div>
          <div class="tw">
            <table>
              <thead>
                <tr>
                  <th style="width: 40%;">Operational Capability</th>
                  <th style="width: 20%;">Administrator</th>
                  <th style="width: 20%;">Operator</th>
                  <th style="width: 20%;">Viewer (Observer)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><b>Pipeline Telemetry, Live SSE Logs & DORA KPIs</b></td>
                  <td><span class="b info">ALLOWED</span></td>
                  <td><span class="b info">ALLOWED</span></td>
                  <td><span class="b info">ALLOWED</span></td>
                </tr>
                <tr>
                  <td><b>Trigger New Continuous Deployments</b></td>
                  <td><span class="b info">ALLOWED</span></td>
                  <td><span class="b info">ALLOWED</span></td>
                  <td><span class="b neu">RESTRICTED</span></td>
                </tr>
                <tr>
                  <td><b>Approve Promotion Gates, Rollback & Cancel Runs</b></td>
                  <td><span class="b info">ALLOWED</span></td>
                  <td><span class="b info">ALLOWED</span></td>
                  <td><span class="b neu">RESTRICTED</span></td>
                </tr>
                <tr>
                  <td><b>Application & Target Environment Configuration</b></td>
                  <td><span class="b info">ALLOWED</span></td>
                  <td><span class="b neu">RESTRICTED</span></td>
                  <td><span class="b neu">RESTRICTED</span></td>
                </tr>
                <tr>
                  <td><b>SSH Host Credentials & Webhook HMAC Secrets</b></td>
                  <td><span class="b info">ALLOWED</span></td>
                  <td><span class="b neu">RESTRICTED</span></td>
                  <td><span class="b neu">RESTRICTED</span></td>
                </tr>
                <tr>
                  <td><b>User Provisioning, Password Resets & Audit Logs</b></td>
                  <td><span class="b info">ALLOWED</span></td>
                  <td><span class="b neu">RESTRICTED</span></td>
                  <td><span class="b neu">RESTRICTED</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    function renderAuditTabHtml() {
      const filtered = auditLogs.filter(log => {
        const act = (log.action || '').toUpperCase();
        if (eventFilter === 'login') return act.includes('LOGIN');
        if (eventFilter === 'dep') return act.includes('DEPLOY');
        if (eventFilter === 'user') return act.includes('USER');
        return true;
      });

      return `
        <div class="pn">
          <div class="sr" style="justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <div class="chips" role="group" aria-label="Filter events">
              <button type="button" class="chip" aria-pressed="${eventFilter === 'all'}" data-filter="all">All events</button>
              <button type="button" class="chip" aria-pressed="${eventFilter === 'dep'}" data-filter="dep">Deployments</button>
              <button type="button" class="chip" aria-pressed="${eventFilter === 'user'}" data-filter="user">User &amp; RBAC</button>
              <button type="button" class="chip" aria-pressed="${eventFilter === 'login'}" data-filter="login">Sign-ins</button>
            </div>
            <span class="dim" style="font-size: 12px;">SQLite · SSE live updates · Secret masking</span>
          </div>

          <div class="tw">
            <table>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Operator</th>
                  <th>Action</th>
                  <th>Resource</th>
                  <th>Environment</th>
                  <th>Details</th>
                  <th>Client IP</th>
                </tr>
              </thead>
              <tbody>
                ${filtered.length === 0 ? `
                  <tr><td colspan="7" class="empty">No audit records match active filter.</td></tr>
                ` : filtered.map(log => {
                  const act = (log.action || '').toUpperCase();
                  const isCancel = act.includes('CANCEL');
                  const isFail = act.includes('FAIL');
                  const isUser = act.includes('USER');
                  let badgeColor = 'info';
                  if (isCancel) badgeColor = 'neu';
                  else if (isFail) badgeColor = 'bad';
                  else if (isUser) badgeColor = 'prod';

                  return `
                    <tr>
                      <td class="mono num t2">${formatDate(log.created_at)}</td>
                      <td><b>${log.username || 'operator'}</b></td>
                      <td><span class="b ${badgeColor}">${act}</span></td>
                      <td class="mono">${log.resource_id || log.target || '—'}</td>
                      <td>
                        ${log.environment_id ? `
                          <span class="env ${log.is_production ? 'prod' : 'devel'}">
                            <i></i>${log.env_name || log.environment_id}
                          </span>
                        ` : '—'}
                      </td>
                      <td class="t2">${log.details || '—'}</td>
                      <td class="mono dim">${log.ip_address || log.client_ip || '127.0.0.1'}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    function bindUserActions() {
      // Add User Button
      const addBtn = container.querySelector('#btn-add-user');
      if (addBtn) {
        addBtn.addEventListener('click', () => {
          openModal({
            title: 'Provision New User Account',
            bodyHtml: `
              <form id="form-create-user" style="display: grid; gap: 14px;">
                <div>
                  <label for="modal-new-username" style="display: block; font-size: 12px; font-weight: 600; color: var(--t1); margin-bottom: 6px;">Username</label>
                  <input id="modal-new-username" type="text" class="in" style="width: 100%; box-sizing: border-box;" placeholder="e.g. qa-engineer" required autocomplete="off" />
                  <span class="dim" style="font-size: 11px;">Alphanumeric, dashes, or dots (3-32 characters).</span>
                </div>
                <div>
                  <label for="modal-new-password" style="display: block; font-size: 12px; font-weight: 600; color: var(--t1); margin-bottom: 6px;">Initial Password</label>
                  <input id="modal-new-password" type="password" class="in" style="width: 100%; box-sizing: border-box;" placeholder="Minimum 6 characters" required autocomplete="new-password" />
                </div>
                <div>
                  <label for="modal-new-role" style="display: block; font-size: 12px; font-weight: 600; color: var(--t1); margin-bottom: 6px;">Operational Role</label>
                  <select id="modal-new-role" class="sel" style="width: 100%; box-sizing: border-box;">
                    <option value="viewer" selected>Viewer — Read-only observation &amp; telemetry monitoring</option>
                    <option value="operator">Operator — Deploy, cancel, rollback &amp; approve gates</option>
                    <option value="admin">Administrator — Full control (Apps, Envs, Secrets &amp; Users)</option>
                  </select>
                </div>
              </form>
            `,
            confirmText: 'Create Account',
            confirmClass: 'btn-primary',
            onConfirm: async () => {
              const u = document.getElementById('modal-new-username')?.value.trim();
              const p = document.getElementById('modal-new-password')?.value;
              const r = document.getElementById('modal-new-role')?.value;

              if (!u || !p) {
                state.notifyToast('Username and password are required', 'error');
                return false;
              }

              try {
                const res = await api.createUser({ username: u, password: p, role: r });
                usersList.push(res.user);
                state.notifyToast(`User "${res.user.username}" created successfully`, 'success');
                renderView();
                return true;
              } catch (err) {
                state.notifyToast(err.message, 'error');
                return false;
              }
            }
          });
        });
      }

      // Change Role Buttons
      container.querySelectorAll('.btn-edit-role').forEach(btn => {
        btn.addEventListener('click', () => {
          const userId = btn.getAttribute('data-id');
          const username = btn.getAttribute('data-name');
          const currentRole = btn.getAttribute('data-role');

          openModal({
            title: `Modify Role: ${username}`,
            bodyHtml: `
              <div style="display: grid; gap: 14px;">
                <p class="t2" style="font-size: 13px; margin: 0;">
                  Update the operational authority for account <strong class="mono">${username}</strong>. Active sessions will dynamically adopt the new permission tier.
                </p>
                <div>
                  <label for="modal-edit-role" style="display: block; font-size: 12px; font-weight: 600; color: var(--t1); margin-bottom: 6px;">New Role</label>
                  <select id="modal-edit-role" class="sel" style="width: 100%; box-sizing: border-box;">
                    <option value="viewer" ${currentRole === 'viewer' ? 'selected' : ''}>Viewer (Read-only observer)</option>
                    <option value="operator" ${currentRole === 'operator' ? 'selected' : ''}>Operator (Continuous delivery &amp; release ops)</option>
                    <option value="admin" ${currentRole === 'admin' ? 'selected' : ''}>Administrator (Full system authority)</option>
                  </select>
                </div>
              </div>
            `,
            confirmText: 'Save Role',
            confirmClass: 'btn-primary',
            onConfirm: async () => {
              const newRole = document.getElementById('modal-edit-role')?.value;
              try {
                const res = await api.updateUserRole(userId, newRole);
                const target = usersList.find(x => x.id === userId);
                if (target) target.role = res.user.role;
                state.notifyToast(`Updated role of "${username}" to ${newRole.toUpperCase()}`, 'success');
                renderView();
                return true;
              } catch (err) {
                state.notifyToast(err.message, 'error');
                return false;
              }
            }
          });
        });
      });

      // Reset Password Buttons
      container.querySelectorAll('.btn-reset-pw').forEach(btn => {
        btn.addEventListener('click', () => {
          const userId = btn.getAttribute('data-id');
          const username = btn.getAttribute('data-name');

          openModal({
            title: `Reset Password: ${username}`,
            bodyHtml: `
              <div style="display: grid; gap: 14px;">
                <p class="t2" style="font-size: 13px; margin: 0;">
                  Set a new password for <strong class="mono">${username}</strong>. This will revoke all currently active sessions for this account.
                </p>
                <div>
                  <label for="modal-reset-new-password" style="display: block; font-size: 12px; font-weight: 600; color: var(--t1); margin-bottom: 6px;">New Password</label>
                  <input id="modal-reset-new-password" type="password" class="in" style="width: 100%; box-sizing: border-box;" placeholder="Minimum 6 characters" required autocomplete="new-password" />
                </div>
              </div>
            `,
            confirmText: 'Reset Password',
            confirmClass: 'btn-primary',
            onConfirm: async () => {
              const newPass = document.getElementById('modal-reset-new-password')?.value;
              if (!newPass || newPass.length < 6) {
                state.notifyToast('Password must be at least 6 characters long', 'error');
                return false;
              }
              try {
                await api.resetUserPassword(userId, newPass);
                const target = usersList.find(x => x.id === userId);
                if (target) target.active_sessions = 0;
                state.notifyToast(`Password reset for "${username}". Sessions revoked.`, 'success');
                renderView();
                return true;
              } catch (err) {
                state.notifyToast(err.message, 'error');
                return false;
              }
            }
          });
        });
      });

      // Delete User Buttons
      container.querySelectorAll('.btn-delete-user').forEach(btn => {
        btn.addEventListener('click', () => {
          const userId = btn.getAttribute('data-id');
          const username = btn.getAttribute('data-name');

          openModal({
            title: `Delete Account: ${username}`,
            bodyHtml: `
              <div style="display: grid; gap: 12px;">
                <p class="t2" style="font-size: 13px; margin: 0;">
                  Are you sure you want to permanently delete user <strong class="mono">${username}</strong>?
                </p>
                <div style="padding: 10px 12px; background: color-mix(in srgb, var(--bad) 10%, transparent); border: 1px solid color-mix(in srgb, var(--bad) 30%, transparent); border-radius: 6px; font-size: 12px; color: var(--bad);">
                  This action is irreversible. All active tokens and sessions will be permanently revoked.
                </div>
              </div>
            `,
            confirmText: 'Delete Account',
            confirmClass: 'btn-danger',
            onConfirm: async () => {
              try {
                await api.deleteUser(userId);
                const idx = usersList.findIndex(x => x.id === userId);
                if (idx !== -1) usersList.splice(idx, 1);
                state.notifyToast(`User "${username}" permanently deleted`, 'success');
                renderView();
                return true;
              } catch (err) {
                state.notifyToast(err.message, 'error');
                return false;
              }
            }
          });
        });
      });
    }

    function bindAuditActions() {
      const chipButtons = container.querySelectorAll('.chips button[data-filter]');
      chipButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          eventFilter = btn.getAttribute('data-filter');
          renderView();
        });
      });
    }

    renderView();
  } catch (err) {
    container.innerHTML = `
      <div class="pn" style="margin-top: 24px; border-color: var(--bad);">
        <div class="ph"><h2 style="color: var(--bad);">Error loading administration console</h2></div>
        <div class="pb"><p class="t2">${err.message}</p></div>
      </div>
    `;
  }
}

export function renderLoginPage(container) {
  const theme = getTheme();
  const themeIcon = theme === 'dark' ? 'sun' : 'moon';

  container.innerHTML = `
    <div class="lg" style="min-height: 100vh; display: grid; place-items: center; padding: 24px; position: relative;">
      <button id="login-theme-toggle" class="ib" style="position: fixed; top: calc(16px + env(safe-area-inset-top, 0px)); right: 16px;" aria-label="Toggle theme">
        ${renderIcon(themeIcon, 16)}
      </button>

      <div class="lc" style="width: 100%; max-width: 400px; border: 1px solid var(--bd); border-radius: 14px; background: var(--sf); box-shadow: var(--sh); overflow: hidden;">
        <div class="top" style="padding: 28px 28px 20px; display: grid; gap: 14px; justify-items: center; border-bottom: 1px solid var(--bs); text-align: center;">
          <div style="display: flex; gap: 10px; align-items: center;">
            <img class="s" src="/assets/pipra-bird.png" alt="" />
            <img class="w" src="/assets/pipra-wordmark.png" alt="Pipra" />
          </div>
          <div class="dim" style="font-size: 12px;">Pipeline &amp; Release Engineering Platform</div>
        </div>

        <form id="login-form" class="fl" style="padding: 24px 28px 28px;">
          <div id="login-error-msg" style="display: none; padding: 8px 12px; background: color-mix(in srgb, var(--bad) 12%, transparent); border: 1px solid color-mix(in srgb, var(--bad) 30%, transparent); border-radius: 6px; color: var(--bad); font-size: 12px;"></div>

          <div>
            <label for="u">Operator username</label>
            <input id="u" type="text" autocomplete="username" placeholder="Enter username" required />
          </div>

          <div>
            <label for="pw">Password</label>
            <input id="pw" type="password" autocomplete="current-password" placeholder="Enter password" required />
          </div>

          <button type="submit" id="btn-submit-login" class="btn p" style="height: 38px; width: 100%; margin-top: 4px;">
            Sign in to control plane
          </button>
        </form>
      </div>

      <div class="dim" style="position: fixed; bottom: 20px; font-size: 12px;">
        Build with confidence. Ship with control.
      </div>
    </div>
  `;

  // Bind theme toggle on login screen
  const themeToggle = document.getElementById('login-theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      const newTheme = toggleTheme();
      const nextIcon = newTheme === 'dark' ? 'sun' : 'moon';
      themeToggle.innerHTML = renderIcon(nextIcon, 16);
    });
  }

  // Bind login form submission
  const form = document.getElementById('login-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const u = document.getElementById('u').value.trim();
      const pw = document.getElementById('pw').value;
      const submitBtn = document.getElementById('btn-submit-login');
      const errBox = document.getElementById('login-error-msg');

      try {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Authenticating...';
        if (errBox) errBox.style.display = 'none';

        const result = await api.login(u, pw);
        state.set({ user: result.user });

        if (result.must_change_password) {
          openModal({
            title: 'Mandatory Security Policy: Update Default Password',
            closable: false,
            content: `
              <div style="display: grid; gap: 14px;">
                <p class="t2" style="font-size: 13px; line-height: 1.5;">
                  ISO/IEC 27001 compliance requires all default factory passwords to be updated before operational access is granted.
                </p>
                <div class="fl">
                  <label for="new-mandatory-pw">New Secure Password</label>
                  <input id="new-mandatory-pw" type="password" placeholder="At least 8 characters" class="in" style="width: 100%; height: 36px;" />
                  <span id="pw-change-err" style="display: none; color: var(--bad); font-size: 12px; margin-top: 4px;"></span>
                </div>
              </div>
            `,
            confirmText: 'Update & Proceed',
            confirmClass: 'btn-primary',
            onConfirm: async () => {
              const newPw = document.getElementById('new-mandatory-pw')?.value;
              const errSpan = document.getElementById('pw-change-err');
              if (!newPw || newPw.length < 8) {
                if (errSpan) {
                  errSpan.textContent = 'Password must be at least 8 characters long';
                  errSpan.style.display = 'block';
                }
                return false;
              }
              try {
                await api.changePassword(newPw);
                state.notifyToast('Password updated successfully. Access granted.', 'success');
                state.set({ user: { ...result.user, must_change_password: false } });
                window.location.hash = '#/overview';
                return true;
              } catch (changeErr) {
                if (errSpan) {
                  errSpan.textContent = changeErr.message;
                  errSpan.style.display = 'block';
                }
                return false;
              }
            }
          });
          return;
        }

        window.location.hash = '#/overview';
      } catch (err) {
        if (errBox) {
          errBox.textContent = err.message || 'Invalid username or password';
          errBox.style.display = 'block';
        }
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign in to control plane';
      }
    });
  }
}
