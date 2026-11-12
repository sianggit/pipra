/**
 * Pipra Navigation Shell Component
 * Exact match with Redesigned Control Plane Mockup
 */

import { ic } from '../icons.js';
import { state } from '../state.js';
import { api } from '../api.js';
import { getTheme, toggleTheme } from '../theme.js';
import { canDeploy } from '../auth.js';

export function renderNavShell(activeRoute = 'overview') {
  const { user, activeEnvironment, environments = [] } = state.get();
  const theme = getTheme();
  const themeIcon = theme === 'dark' ? 'sun' : 'moon';
  const themeLabel = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';

  const currentEnv = environments.find(e => e.name === activeEnvironment || e.id === activeEnvironment) || {
    name: activeEnvironment || 'devel',
    display_name: 'Development',
    is_production: activeEnvironment === 'production'
  };

  const navItems = [
    { id: 'overview', label: 'Overview', icon: 'act', path: '#/overview' },
    ...(canDeploy() ? [{ id: 'deploy', label: 'Deploy', icon: 'play', path: '#/deploy' }] : []),
    { id: 'history', label: 'Deployments', icon: 'clock', path: '#/history' },
    { id: 'applications', label: 'Applications', icon: 'layers', path: '#/applications' },
    { id: 'environments', label: 'Environments', icon: 'server', path: '#/environments' },
    { id: 'infrastructure', label: 'Infrastructure', icon: 'cpu', path: '#/infrastructure' },
    { id: 'admin', label: 'Audit & admin', icon: 'shield', path: '#/admin' },
  ];

  return `
    <header class="hd">
      <button class="logo" onclick="location.hash='#/overview'" aria-label="Pipra home">
        <img class="s" src="/assets/pipra-bird.png" alt="" />
        <img class="w" src="/assets/pipra-wordmark.png" alt="Pipra" />
      </button>

      <span class="ctx">
        <b style="background: ${currentEnv.is_production ? 'var(--bad)' : 'var(--info)'};"></b>
        <span>${currentEnv.display_name || currentEnv.name || 'Development'}</span>
      </span>

      <nav aria-label="Primary">
        ${navItems.map(item => {
          const isActive = activeRoute === item.id || (item.id === 'history' && activeRoute === 'deployments');
          return `
            <a href="${item.path}" ${isActive ? 'aria-current="page"' : ''}>
              ${ic(item.icon)}
              <span>${item.label}</span>
            </a>
          `;
        }).join('')}
      </nav>

      <button id="btn-theme-toggle" class="ib" aria-label="${themeLabel}">
        ${ic(themeIcon)}
      </button>

      ${user ? `
        <span class="usr">
          ${ic('user')}
          <span>${user.username}</span>
          <b>${(user.role || 'OPERATOR').toUpperCase()}</b>
        </span>
        <button id="btn-logout" class="ib" aria-label="Sign out">
          ${ic('out')}
        </button>
      ` : `
        <a href="#/login" class="btn sm p">Sign in</a>
      `}
    </header>
  `;
}

export function bindNavShellEvents() {
  const themeBtn = document.getElementById('btn-theme-toggle');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const newTheme = toggleTheme();
      const nextIcon = newTheme === 'dark' ? 'sun' : 'moon';
      const nextLabel = newTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
      themeBtn.setAttribute('aria-label', nextLabel);
      themeBtn.innerHTML = ic(nextIcon);
    });
  }

  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await api.logout();
      } catch (e) {}
      state.set({ user: null });
      location.hash = '#/login';
    });
  }
}
