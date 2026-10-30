/**
 * Pipra Theme Controller
 * Manages light/dark theme persistence, DOM synchronization, and system preference detection.
 * Aligned with DESIGN.md & Anti-Slop UI Standards.
 */

import { state } from './state.js';

const STORAGE_KEY = 'pipra-theme';

export function getStoredTheme() {
  try {
    const val = localStorage.getItem(STORAGE_KEY);
    return val === 'light' || val === 'dark' ? val : null;
  } catch {
    return null;
  }
}

export function getSystemTheme() {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  return 'dark';
}

export function getTheme() {
  if (typeof document !== 'undefined') {
    const active = document.documentElement.getAttribute('data-theme');
    if (active === 'light' || active === 'dark') return active;
  }
  return getStoredTheme() || 'dark';
}

export function setTheme(theme) {
  const targetTheme = theme === 'light' ? 'light' : 'dark';
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', targetTheme);
  }
  try {
    localStorage.setItem(STORAGE_KEY, targetTheme);
  } catch {}

  state.set({ theme: targetTheme });
  return targetTheme;
}

export function toggleTheme() {
  const current = getTheme();
  const next = current === 'dark' ? 'light' : 'dark';
  return setTheme(next);
}

export function initTheme() {
  const stored = getStoredTheme();
  const initial = stored || 'dark';
  setTheme(initial);

  // Synchronize with OS theme changes only if user hasn't set an explicit preference
  if (!stored && typeof window !== 'undefined' && window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', (e) => {
      if (!getStoredTheme()) {
        setTheme(e.matches ? 'light' : 'dark');
      }
    });
  }

  return initial;
}

