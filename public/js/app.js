/**
 * Pipra Application Bootstrap
 */

import { Router } from './router.js';
import { api } from './api.js';
import { state } from './state.js';
import { initTheme } from './theme.js';
import { initLoadingScreen, hideLoadingScreen } from './components/loading-screen.js';

async function bootstrap() {
  initTheme();
  initLoadingScreen();
  const startTime = Date.now();
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

  // Allow animated loading screen to present its smooth bird flight
  const elapsed = Date.now() - startTime;
  const minDisplayMs = 1000;
  const remaining = Math.max(0, minDisplayMs - elapsed);
  setTimeout(() => {
    hideLoadingScreen(400);
  }, remaining);
}

document.addEventListener('DOMContentLoaded', bootstrap);
