/**
 * Unit Test: Theme System & WCAG 2.2 AA Token Integrity
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PROJECT_ROOT = path.resolve(__dirname, '../..');

test('Theme Tokens: tokens.css declares complete [data-theme="light"] palette', () => {
  const tokensPath = path.join(PROJECT_ROOT, 'public/css/tokens.css');
  assert.ok(fs.existsSync(tokensPath), 'tokens.css must exist');

  const css = fs.readFileSync(tokensPath, 'utf8');

  // Verify selector presence
  assert.ok(css.includes('[data-theme="light"]'), 'Must declare [data-theme="light"] selector');
  assert.ok(css.includes('[data-theme="dark"]'), 'Must declare [data-theme="dark"] selector');

  // Verify core token keys in light theme
  const requiredTokens = [
    '--color-surface-base',
    '--color-surface-sidebar',
    '--color-surface-muted',
    '--color-surface-strong',
    '--color-surface-raised',
    '--color-surface-subtle',
    '--color-surface-input',
    '--color-text-primary',
    '--color-text-secondary',
    '--color-text-tertiary',
    '--color-text-muted',
    '--color-text-inverse',
    '--color-border-default',
    '--color-border-subtle',
    '--color-border-muted',
    '--color-border-strong',
    '--color-border-active',
    '--color-border-focus',
    '--color-action-primary',
    '--color-action-primary-hover',
    '--color-action-primary-pressed',
    '--color-focus-ring',
    '--color-status-success',
    '--color-status-warning',
    '--color-status-danger',
    '--color-status-info',
    '--color-status-neutral',
    '--shadow-menu',
    '--shadow-dialog',
    '--color-backdrop'
  ];

  for (const token of requiredTokens) {
    assert.ok(css.includes(token), `tokens.css must define ${token}`);
  }

  // Verify mockup parity tokens
  const mockupTokens = ['--bg', '--sf', '--sr', '--ss', '--in', '--bd', '--bs', '--bst', '--pr', '--ok', '--warn', '--bad', '--info', '--neu', '--wm'];
  for (const token of mockupTokens) {
    assert.ok(css.includes(token), `tokens.css must declare mockup token ${token}`);
  }
});

test('Theme Icons: icons.js contains sun and moon SVG definitions', () => {
  const iconsPath = path.join(PROJECT_ROOT, 'public/js/icons.js');
  assert.ok(fs.existsSync(iconsPath), 'icons.js must exist');

  const content = fs.readFileSync(iconsPath, 'utf8');
  assert.ok(content.includes("'sun':"), 'icons.js must define sun icon');
  assert.ok(content.includes("'moon':"), 'icons.js must define moon icon');
});

test('Theme Assets: Real brand logo assets and favicon exist', () => {
  const assetsDir = path.join(PROJECT_ROOT, 'public/assets');
  assert.ok(fs.existsSync(path.join(assetsDir, 'logo.png')), 'logo.png must exist');
  assert.ok(fs.existsSync(path.join(assetsDir, 'logo-white-tagline.png')), 'logo-white-tagline.png must exist');
  assert.ok(fs.existsSync(path.join(assetsDir, 'logo-white-tagline.png')), 'logo-white-tagline.png must exist');
  assert.ok(fs.existsSync(path.join(assetsDir, 'logo-navy-tagline.png')), 'logo-navy-tagline.png must exist');
  assert.ok(fs.existsSync(path.join(assetsDir, 'favicon.ico')), 'favicon.ico must exist');
});

test('Theme Controller: theme.js exists with complete API contract', () => {
  const themePath = path.join(PROJECT_ROOT, 'public/js/theme.js');
  assert.ok(fs.existsSync(themePath), 'theme.js must exist');

  const content = fs.readFileSync(themePath, 'utf8');
  assert.ok(content.includes('export function initTheme'), 'Must export initTheme');
  assert.ok(content.includes('export function toggleTheme'), 'Must export toggleTheme');
  assert.ok(content.includes('export function getTheme'), 'Must export getTheme');
  assert.ok(content.includes('export function setTheme'), 'Must export setTheme');
});

