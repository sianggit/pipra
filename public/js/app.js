/**
 * Pipra Application Bootstrap
 */

import { Router } from './router.js';
import { api } from './api.js';
import { state } from './state.js';
import { initTheme } from './theme.js';

async function bootstrap() {
  initTheme();
  const appContainer = document.getElementById('app');

  // Pre-load metadata
  try {
    const [envs, apps] = await Promise.all([
      api.getEnvironments().catch(() => []),
      api.getApplications().catch(() => []),
    ]);
    state.set({
      environments: envs,
      applications: apps,
      activeEnvironment: envs[0]?.name || 'devel',
    });
  } catch (e) {
    // Initial fetch may fail if not logged in
  }

  const router = new Router(appContainer);
  router.init();
}

document.addEventListener('DOMContentLoaded', bootstrap);
