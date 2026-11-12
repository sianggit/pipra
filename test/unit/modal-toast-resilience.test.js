/**
 * Unit Test: Modal & Toast Component Resilience & Alert Elimination
 * Enforces Anti-Slop UI standards, zero undefined modal bodies,
 * and zero disruptive native browser alert() invocations.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PROJECT_ROOT = path.resolve(__dirname, '../..');

test('Modal Component: openModal safely normalizes bodyHtml, content, and body properties', () => {
  const modalPath = path.join(PROJECT_ROOT, 'public/js/components/modal.js');
  assert.ok(fs.existsSync(modalPath), 'modal.js must exist');

  const content = fs.readFileSync(modalPath, 'utf8');

  // Verify parameter destructuring includes bodyHtml, content, and body
  assert.ok(content.includes('bodyHtml'), 'openModal must accept bodyHtml');
  assert.ok(content.includes('content'), 'openModal must accept content for backward/forward compatibility');
  assert.ok(content.includes('body'), 'openModal must accept body');

  // Verify fallback normalization never returns literal undefined
  assert.ok(
    content.includes("renderedBody = bodyHtml !== undefined ? bodyHtml : (content !== undefined ? content : (body !== undefined ? body : ''))"),
    'openModal must normalize renderedBody to empty string fallback'
  );

  // Verify confirm button does not close modal if onConfirm returns false
  assert.ok(content.includes('if (result === false)'), 'Must check if onConfirm returned false to prevent dismiss');

  // Verify accessible alert dialog is exported
  assert.ok(content.includes('export function openAlertDialog'), 'Must export openAlertDialog');
  assert.ok(content.includes('export const showAlert = openAlertDialog'), 'Must export showAlert alias');
});

test('Toast Component: public/js/components/toast.js is implemented and accessible', () => {
  const toastPath = path.join(PROJECT_ROOT, 'public/js/components/toast.js');
  assert.ok(fs.existsSync(toastPath), 'toast.js must exist');

  const content = fs.readFileSync(toastPath, 'utf8');

  // Verify exports
  assert.ok(content.includes('export function showToast'), 'Must export showToast function');
  assert.ok(content.includes('export { openAlertDialog, showAlert }'), 'Must re-export accessible dialogs');

  // Verify WCAG accessibility roles
  assert.ok(content.includes("toast.setAttribute('role', type === 'error' ? 'alert' : 'status')"), 'Must assign semantic aria role');
  assert.ok(content.includes("toastContainer.setAttribute('aria-live', 'polite')"), 'Must configure aria-live region');

  // Verify pause on hover & manual dismissal
  assert.ok(content.includes('mouseenter'), 'Must pause auto-dismiss on mouse enter');
  assert.ok(content.includes('mouseleave'), 'Must resume auto-dismiss on mouse leave');
  assert.ok(content.includes('toast-close'), 'Must provide accessible close button');
});

test('Toast CSS: components.css defines complete floating notification styles', () => {
  const cssPath = path.join(PROJECT_ROOT, 'public/css/components.css');
  assert.ok(fs.existsSync(cssPath), 'components.css must exist');

  const css = fs.readFileSync(cssPath, 'utf8');

  assert.ok(css.includes('#toast-container'), 'Must style #toast-container with fixed positioning');
  assert.ok(css.includes('.pipra-toast'), 'Must define .pipra-toast card');
  assert.ok(css.includes('.pipra-toast-success'), 'Must define success variant');
  assert.ok(css.includes('.pipra-toast-error'), 'Must define error variant');
  assert.ok(css.includes('.pipra-toast-warning'), 'Must define warning variant');
  assert.ok(css.includes('.pipra-toast-info'), 'Must define info variant');
});

test('Anti-Slop Cleanliness: Zero browser native alert() calls across client codebase', () => {
  const jsDir = path.join(PROJECT_ROOT, 'public/js');

  function scanDir(dir) {
    const files = fs.readdirSync(dir);
    let occurrences = [];

    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        occurrences = occurrences.concat(scanDir(fullPath));
      } else if (file.endsWith('.js')) {
        const text = fs.readFileSync(fullPath, 'utf8');
        const lines = text.split('\n');
        lines.forEach((line, idx) => {
          // Check for actual function call: alert(...) but not comments or openAlertDialog
          if (/\balert\s*\(/.test(line) && !line.trim().startsWith('*') && !line.trim().startsWith('//')) {
            occurrences.push(`${path.relative(PROJECT_ROOT, fullPath)}:${idx + 1}: ${line.trim()}`);
          }
        });
      }
    }

    return occurrences;
  }

  const alertCalls = scanDir(jsDir);
  assert.deepEqual(alertCalls, [], `Found unexpected native alert() calls:\n${alertCalls.join('\n')}`);
});

test('Form Safety: Apps and Envs pages contain null-safety checks before checkValidity()', () => {
  const appsPagePath = path.join(PROJECT_ROOT, 'public/js/pages/apps-page.js');
  const envsPagePath = path.join(PROJECT_ROOT, 'public/js/pages/envs-page.js');

  const appsCode = fs.readFileSync(appsPagePath, 'utf8');
  const envsCode = fs.readFileSync(envsPagePath, 'utf8');

  // Verify apps-page form null guards
  assert.ok(/const form = document\.getElementById\('form-edit-env'\);\s*if \(!form\) return false;/.test(appsCode), 'Must guard form-edit-env');
  assert.ok(/const form = document\.getElementById\('form-create-env'\);\s*if \(!form\) return false;/.test(appsCode), 'Must guard form-create-env');
  assert.ok(/const form = document\.getElementById\('form-register-app'\);\s*if \(!form\) return false;/.test(appsCode), 'Must guard form-register-app');

  // Verify envs-page form null guards
  assert.ok(/const form = document\.getElementById\('modal-form-env'\);\s*if \(form && !form\.checkValidity\(\)\)/.test(envsCode), 'Must guard modal-form-env');
});

