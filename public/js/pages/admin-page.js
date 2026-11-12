/**
 * Pipra Administration, Audit & Login Page
 * Aligned with DESIGN.md & Control Plane Redesign Mockup
 */

import { api } from '../api.js';
import { renderIcon } from '../icons.js';
import { state } from '../state.js';
import { getTheme, toggleTheme } from '../theme.js';

export async function renderAdminPage(container) {
  container.innerHTML = `
    <div style="padding: 48px; text-align: center; color: var(--t2);">
      <div class="mono">Loading audit trail & platform controls...</div>
    </div>
  `;

  try {
    const auditLogs = await api.getAuditLogs(100);
    let eventFilter = 'all'; // 'all', 'dep', 'login'

    const formatDate = (iso) => {
      if (!iso) return '—';
      const d = new Date(iso);
      return `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getDate().toString().padStart(2, '0')} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
    };

    function renderView() {
      const filtered = auditLogs.filter(log => {
        if (eventFilter === 'login') return (log.action || '').toUpperCase().includes('LOGIN');
        if (eventFilter === 'dep') return (log.action || '').toUpperCase().includes('DEPLOY');
        return true;
      });

      container.innerHTML = `
        <div class="pg">
          <div>
            <h1>Audit & admin</h1>
            <p class="sub">Immutable record of consequential actions. Last 100 events retained.</p>
          </div>
        </div>

        <div class="pn">
          <div class="sr" style="justify-content: space-between; align-items: center;">
            <div class="chips" role="group" aria-label="Filter events">
              <button type="button" class="chip" aria-pressed="${eventFilter === 'all'}" data-filter="all">All events</button>
              <button type="button" class="chip" aria-pressed="${eventFilter === 'dep'}" data-filter="dep">Deployments</button>
              <button type="button" class="chip" aria-pressed="${eventFilter === 'login'}" data-filter="login">Sign-ins</button>
            </div>
            <span class="dim" style="font-size: 12px;">SQLite · SSE live updates · RBAC with secret masking</span>
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
                  const badgeColor = isCancel ? 'neu' : (isFail ? 'bad' : 'info');

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
                      <td class="mono dim">${log.client_ip || '127.0.0.1'}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;

      // Bind filter chip events
      const chipButtons = container.querySelectorAll('.chips button');
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
        <div class="ph"><h2 style="color: var(--bad);">Error loading audit logs</h2></div>
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
