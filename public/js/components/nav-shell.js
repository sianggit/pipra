/**
 * Pipra Navigation Shell Component
 * Aligned with DESIGN.md & Anti-Slop Layout Standards
 */

import { renderIcon } from '../icons.js';
import { state } from '../state.js';
import { api } from '../api.js';

export function renderNavShell(activeRoute = 'overview') {
  const { user, activeEnvironment, environments = [] } = state.get();
  const currentEnv = environments.find(e => e.name === activeEnvironment || e.id === activeEnvironment) || { 
    name: activeEnvironment || 'devel', 
    display_name: 'Development',
    is_production: activeEnvironment === 'production' 
  };

  return `
    <header class="pipra-header" role="banner">
      <div class="pipra-brand-area">
        <button id="mobile-nav-toggle" class="mobile-nav-toggle" aria-label="Toggle navigation menu" aria-expanded="false">
          ${renderIcon('menu', 18)}
        </button>

        <a href="#/overview" class="pipra-brand" aria-label="Pipra — Pipeline & Release Engineering Platform">
          <img src="/assets/logo.svg" alt="Pipra" class="pipra-brand-mark" width="148" height="34" />
        </a>

        <!-- Environment Operational Context -->
        <div style="display: flex; align-items: center; gap: var(--space-2);">
          <span class="env-tag ${currentEnv.is_production ? 'env-tag-prod' : 'env-tag-nonprod'}" role="status" aria-label="Active Environment: ${currentEnv.display_name || currentEnv.name}">
            ${currentEnv.is_production ? renderIcon('shield', 12) : renderIcon('box', 12)}
            <span>${(currentEnv.display_name || currentEnv.name || 'DEVEL').toUpperCase()}</span>
          </span>
        </div>
      </div>

      <nav id="pipra-main-nav" class="pipra-nav" role="navigation" aria-label="Primary Navigation">
        <a href="#/overview" class="pipra-nav-link ${activeRoute === 'overview' ? 'active' : ''}">
          ${renderIcon('activity', 14)}
          <span>Overview</span>
        </a>
        <a href="#/deploy" class="pipra-nav-link ${activeRoute === 'deploy' ? 'active' : ''}">
          ${renderIcon('play', 14)}
          <span>Deploy</span>
        </a>
        <a href="#/history" class="pipra-nav-link ${activeRoute === 'history' ? 'active' : ''}">
          ${renderIcon('clock', 14)}
          <span>Deployments</span>
        </a>
        <a href="#/applications" class="pipra-nav-link ${activeRoute === 'applications' ? 'active' : ''}">
          ${renderIcon('layers', 14)}
          <span>Applications</span>
        </a>
        <a href="#/environments" class="pipra-nav-link ${activeRoute === 'environments' ? 'active' : ''}">
          ${renderIcon('server', 14)}
          <span>Environments</span>
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
          <div class="user-badge" aria-label="Authenticated operator: ${user.username} (${user.role})">
            ${renderIcon('user', 14)}
            <span>${user.username}</span>
            <span class="user-role-tag">${user.role}</span>
          </div>
          <button id="btn-logout" class="btn btn-ghost btn-sm" aria-label="Sign out of platform" title="Sign out">
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

  const mobileToggle = document.getElementById('mobile-nav-toggle');
  const navMenu = document.getElementById('pipra-main-nav');
  if (mobileToggle && navMenu) {
    mobileToggle.addEventListener('click', () => {
      const isOpen = navMenu.classList.toggle('open');
      mobileToggle.setAttribute('aria-expanded', String(isOpen));
    });

    // Close on navigation click on mobile
    navMenu.querySelectorAll('.pipra-nav-link').forEach(link => {
      link.addEventListener('click', () => {
        navMenu.classList.remove('open');
        mobileToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }
}
