/**
 * Pipra Client-Side Hash Router
 */

import { renderNavShell, bindNavShellEvents } from './components/nav-shell.js';
import { renderOverviewPage } from './pages/overview-page.js';
import { renderAppsPage } from './pages/apps-page.js';
import { renderEnvsPage } from './pages/envs-page.js';
import { renderWizardPage } from './pages/wizard-page.js';
import { renderDeploymentDetailPage } from './pages/deployment-detail.js';
import { renderHistoryPage } from './pages/history-page.js';
import { renderInfraPage } from './pages/infra-page.js';
import { renderAdminPage, renderLoginPage } from './pages/admin-page.js';
import { showPageTransition, hidePageTransition } from './components/loading-screen.js';
import { state } from './state.js';
import { api } from './api.js';
import { renderIcon } from './icons.js';
import { canDeploy, isAdmin } from './auth.js';

export class Router {
  constructor(appContainer) {
    this.appContainer = appContainer;
    this.isFirstRoute = true;
  }

  init() {
    window.addEventListener('hashchange', () => this.handleRoute());
    this.handleRoute();
  }

  async handleRoute() {
    const isSwitch = !this.isFirstRoute;
    this.isFirstRoute = false;

    if (isSwitch) {
      showPageTransition('Loading view...');
    }

    const hash = window.location.hash.slice(1) || '/overview';
    const [pathPart, queryPart] = hash.split('?');
    const query = Object.fromEntries(new URLSearchParams(queryPart || '').entries());

    // Check authentication
    const { user } = state.get();
    if (!user && pathPart !== '/login') {
      try {
        const authData = await api.me();
        state.set({ user: authData.user });
      } catch {
        if (isSwitch) hidePageTransition();
        window.location.hash = '#/login';
        return;
      }
    }

    if (pathPart === '/login') {
      this.appContainer.innerHTML = `<main id="main-content"></main>`;
      renderLoginPage(document.getElementById('main-content'));
      if (isSwitch) hidePageTransition();
      return;
    }

    // Determine active route name for nav highlights
    let activeRouteName = 'overview';
    if (pathPart.startsWith('/applications')) activeRouteName = 'applications';
    else if (pathPart.startsWith('/environments')) activeRouteName = 'environments';
    else if (pathPart.startsWith('/deployments')) activeRouteName = 'history';
    else if (pathPart.startsWith('/deploy')) activeRouteName = 'deploy';
    else if (pathPart.startsWith('/history')) activeRouteName = 'history';
    else if (pathPart.startsWith('/infrastructure')) activeRouteName = 'infrastructure';
    else if (pathPart.startsWith('/admin')) activeRouteName = 'admin';

    // Render Navigation Shell + Main mount
    this.appContainer.innerHTML = `
      ${renderNavShell(activeRouteName)}
      <main id="main-content" class="pipra-main" role="main"></main>
    `;
    bindNavShellEvents();

    const mainContent = document.getElementById('main-content');

    // Route dispatch
    try {
      if (pathPart === '/' || pathPart === '/overview') {
        await renderOverviewPage(mainContent);
      } else if (pathPart === '/applications') {
        await renderAppsPage(mainContent);
      } else if (pathPart === '/environments') {
        await renderEnvsPage(mainContent);
      } else if (pathPart === '/deploy') {
        if (!canDeploy()) {
          state.notifyToast('Deployment access requires Operator or Admin role', 'warning');
          mainContent.innerHTML = `
            <div class="card" style="border-left: 3px solid var(--color-status-warning); max-width: 680px; margin: var(--space-8) auto;">
              <div class="card-body" style="padding: var(--space-6); text-align: center;">
                <div style="color: var(--color-status-warning); margin-bottom: var(--space-3);">
                  ${renderIcon('shield', 32)}
                </div>
                <h2 style="margin-bottom: var(--space-2);">Access Restricted</h2>
                <p style="color: var(--color-text-secondary); margin-bottom: var(--space-5); line-height: 1.6;">
                  Your current account role (<strong>${state.get().user?.role || 'viewer'}</strong>) is granted read-only observation permissions. Triggering pipeline deployments requires <strong>Operator</strong> or <strong>Admin</strong> privileges.
                </p>
                <a href="#/overview" class="btn btn-primary">Return to Overview</a>
              </div>
            </div>
          `;
        } else {
          await renderWizardPage(mainContent, query);
        }
      } else if (pathPart.startsWith('/deployments/')) {
        const deploymentId = pathPart.replace('/deployments/', '');
        await renderDeploymentDetailPage(mainContent, deploymentId);
      } else if (pathPart === '/history') {
        await renderHistoryPage(mainContent);
      } else if (pathPart === '/infrastructure') {
        await renderInfraPage(mainContent);
      } else if (pathPart === '/admin') {
        if (!isAdmin()) {
          state.notifyToast('Administrative console requires Administrator role', 'warning');
          mainContent.innerHTML = `
            <div class="card" style="border-left: 3px solid var(--bad); max-width: 680px; margin: var(--space-8) auto;">
              <div class="card-body" style="padding: var(--space-6); text-align: center;">
                <div style="color: var(--bad); margin-bottom: var(--space-3);">
                  ${renderIcon('shield', 32)}
                </div>
                <h2 style="margin-bottom: var(--space-2);">Access Restricted</h2>
                <p style="color: var(--color-text-secondary); margin-bottom: var(--space-5); line-height: 1.6;">
                  User management and administrative controls are strictly restricted to <strong>Administrator</strong> accounts. Your current role is <strong>${state.get().user?.role || 'viewer'}</strong>.
                </p>
                <a href="#/overview" class="btn btn-primary">Return to Overview</a>
              </div>
            </div>
          `;
        } else {
          await renderAdminPage(mainContent);
        }
      } else {
        mainContent.innerHTML = `
          <div class="card" style="text-align: center; padding: 48px;">
            <h2>Page Not Found</h2>
            <p style="color: var(--color-text-secondary); margin: 12px 0 24px;">The requested operational route '${pathPart}' does not exist.</p>
            <a href="#/overview" class="btn btn-primary">Return to Overview</a>
          </div>
        `;
      }
    } finally {
      if (isSwitch) {
        setTimeout(() => hidePageTransition(), 140);
      }
    }
  }
}
