/**
 * Pipra Navigation Shell Component
 */

import { renderIcon } from '../icons.js';
import { state } from '../state.js';
import { api } from '../api.js';

export function renderNavShell(activeRoute = 'overview') {
  const { user, activeEnvironment, environments } = state.get();
  const currentEnv = environments.find(e => e.name === activeEnvironment) || { name: activeEnvironment, is_production: activeEnvironment === 'production' };

  return `
    <header class="pipra-header" role="banner">
      <div style="display: flex; align-items: center; gap: var(--space-6);">
        <a href="#/overview" class="pipra-brand" aria-label="Pipra - Pipeline & Release Engineering Platform">
          <img src="/assets/logo.svg" alt="Pipra" class="pipra-brand-mark" width="160" height="36" />
        </a>

        <!-- Environment Context -->
        <div style="display: flex; align-items: center; gap: var(--space-2); margin-left: var(--space-4);">
          <span class="env-tag ${currentEnv.is_production ? 'env-tag-prod' : 'env-tag-nonprod'}" role="status">
            ${currentEnv.is_production ? renderIcon('shield', 12) : renderIcon('box', 12)}
            <span>${(currentEnv.display_name || currentEnv.name || 'DEVEL').toUpperCase()}</span>
          </span>
        </div>
      </div>

      <nav class="pipra-nav" role="navigation" aria-label="Main Navigation">
        <a href="#/overview" class="pipra-nav-link ${activeRoute === 'overview' ? 'active' : ''}">
          ${renderIcon('activity', 14)}
          <span>Overview</span>
        </a>
        <a href="#/applications" class="pipra-nav-link ${activeRoute === 'applications' ? 'active' : ''}">
          ${renderIcon('layers', 14)}
          <span>Applications</span>
        </a>
        <a href="#/environments" class="pipra-nav-link ${activeRoute === 'environments' ? 'active' : ''}">
          ${renderIcon('server', 14)}
          <span>Environments</span>
        </a>
        <a href="#/deploy" class="pipra-nav-link ${activeRoute === 'deploy' ? 'active' : ''}">
          ${renderIcon('play', 14)}
          <span>Deploy Wizard</span>
        </a>
        <a href="#/history" class="pipra-nav-link ${activeRoute === 'history' ? 'active' : ''}">
          ${renderIcon('clock', 14)}
          <span>History & Releases</span>
        </a>
        <a href="#/infrastructure" class="pipra-nav-link ${activeRoute === 'infrastructure' ? 'active' : ''}">
          ${renderIcon('cpu', 14)}
          <span>Infrastructure</span>
        </a>
        <a href="#/admin" class="pipra-nav-link ${activeRoute === 'admin' ? 'active' : ''}">
          ${renderIcon('shield', 14)}
          <span>Audit & Admin</span>
        </a>
      </nav>

      <div class="pipra-header-actions">
        ${user ? `
          <div class="user-badge" aria-label="Logged in as ${user.username}">
            ${renderIcon('user', 14)}
            <span>${user.username}</span>
            <span class="user-role-tag">${user.role}</span>
          </div>
          <button id="btn-logout" class="btn btn-ghost btn-sm" aria-label="Log out" title="Log out">
            ${renderIcon('log-out', 14)}
          </button>
        ` : `
          <a href="#/login" class="btn btn-primary btn-sm">Sign In</a>
        `}
      </div>
    </header>
  `;
}

export function bindNavShellEvents() {
  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await api.logout();
      state.set({ user: null });
      window.location.hash = '#/login';
    });
  }
}
