/**
 * Pipra Navigation Shell Component
 * Aligned with DESIGN.md & Anti-Slop Layout Standards
 */

import { renderIcon } from '../icons.js';
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
    { id: 'overview', label: 'Overview', icon: 'activity', path: '#/overview' },
    ...(canDeploy() ? [{ id: 'deploy', label: 'Deploy', icon: 'play', path: '#/deploy' }] : []),
    { id: 'history', label: 'Deployments', icon: 'clock', path: '#/history' },
    { id: 'applications', label: 'Applications', icon: 'layers', path: '#/applications' },
    { id: 'environments', label: 'Environments', icon: 'server', path: '#/environments' },
    { id: 'infrastructure', label: 'Infrastructure', icon: 'cpu', path: '#/infrastructure' },
    { id: 'admin', label: 'Audit & admin', icon: 'shield', path: '#/admin' },
  ];

  return `
    <header class="hd" role="banner">
      <button id="mobile-nav-toggle" class="ib mobile-only" aria-label="Toggle navigation menu" aria-expanded="false" style="display: none;">
        ${renderIcon('menu', 16)}
      </button>

      <a href="#/overview" class="logo" aria-label="Pipra Control Plane">
        <img class="s" src="/assets/logo.png" alt="Pipra" style="height: 26px; width: auto;" />
        <span style="font-size: 17px; font-weight: 700; letter-spacing: -0.02em; color: var(--t1); margin-left: 2px;">Pipra</span>
      </a>

      <!-- Environment Operational Context Badge -->
      <span class="ctx" role="status" aria-label="Active environment: ${currentEnv.display_name || currentEnv.name}">
        <b style="background: ${currentEnv.is_production ? 'var(--bad)' : 'var(--info)'};"></b>
        <span>${currentEnv.display_name || currentEnv.name || 'Development'}</span>
      </span>

      <!-- Primary Navigation Links -->
      <nav id="pipra-main-nav" aria-label="Primary Navigation" style="display: flex; gap: 2px; overflow-x: auto; flex: 1; scrollbar-width: none;">
        ${navItems.map(item => {
          const isActive = activeRoute === item.id || (item.id === 'history' && activeRoute === 'deployments');
          return `
            <a href="${item.path}" class="pipra-nav-link ${isActive ? 'active' : ''}" ${isActive ? 'aria-current="page"' : ''}>
              ${renderIcon(item.icon, 15)}
              <span>${item.label}</span>
            </a>
          `;
        }).join('')}
      </nav>

      <!-- Header Actions -->
      <div style="display: flex; align-items: center; gap: 8px;">
        <button id="btn-theme-toggle" class="ib" aria-label="${themeLabel}" title="${themeLabel}">
          ${renderIcon(themeIcon, 15)}
        </button>

        ${user ? `
          <span class="usr" aria-label="Authenticated operator: ${user.username} (${user.role})">
            ${renderIcon('user', 14)}
            <span>${user.username}</span>
            <b>${(user.role || 'OPERATOR').toUpperCase()}</b>
          </span>
          <button id="btn-logout" class="ib" aria-label="Sign out" title="Sign out">
            ${renderIcon('log-out', 15)}
          </button>
        ` : `
          <a href="#/login" class="btn btn-primary btn-sm">Sign In</a>
        `}
      </div>
    </header>
  `;
}

export function bindNavShellEvents() {
  const themeBtn = document.getElementById('btn-theme-toggle');
  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const newTheme = toggleTheme();
      const logo = document.getElementById('pipra-brand-logo');
      if (logo) {
        logo.src = newTheme === 'light' ? '/assets/logo-navy-tagline.png' : '/assets/logo-white-tagline.png';
      }
      const nextIcon = newTheme === 'dark' ? 'sun' : 'moon';
      const nextLabel = newTheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';
      themeBtn.setAttribute('aria-label', nextLabel);
      themeBtn.setAttribute('title', nextLabel);
      themeBtn.innerHTML = renderIcon(nextIcon, 15);
    });
  }

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
