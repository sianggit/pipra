/**
 * Pipra Accessible Toast Notification System (WCAG 2.2 Level AA)
 * Non-blocking floating status notifications with countdown auto-dismiss,
 * pause on hover, manual dismissal, and semantic styling.
 */

import { renderIcon } from '../icons.js';
import { openAlertDialog, showAlert } from './modal.js';

let toastContainer = null;

function ensureToastContainer() {
  if (!toastContainer || !document.body.contains(toastContainer)) {
    toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = 'toast-container';
      toastContainer.setAttribute('aria-live', 'polite');
      toastContainer.setAttribute('aria-atomic', 'false');
      document.body.appendChild(toastContainer);
    }
  }
  return toastContainer;
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const TYPE_CONFIG = {
  success: { icon: 'check', defaultTitle: 'Success' },
  error: { icon: 'warn', defaultTitle: 'Error' },
  warning: { icon: 'warn', defaultTitle: 'Warning' },
  info: { icon: 'act', defaultTitle: 'Notice' }
};

/**
 * Display a non-blocking toast notification.
 * @param {Object} options
 * @param {'success'|'error'|'warning'|'info'} [options.type='info']
 * @param {string} [options.title]
 * @param {string} options.message
 * @param {number} [options.duration=4000] Dismissal time in ms; set to 0 for persistent.
 */
export function showToast({
  type = 'info',
  title = '',
  message = '',
  duration = 4000
}) {
  const container = ensureToastContainer();
  const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.info;
  const toastTitle = title || (duration === 0 ? cfg.defaultTitle : '');

  const toast = document.createElement('div');
  toast.className = `pipra-toast pipra-toast-${type}`;
  toast.setAttribute('role', type === 'error' ? 'alert' : 'status');

  toast.innerHTML = `
    <div class="toast-icon">
      ${renderIcon(cfg.icon, 16)}
    </div>
    <div class="toast-body">
      ${toastTitle ? `<div class="toast-title">${escapeHtml(toastTitle)}</div>` : ''}
      <div class="toast-message">${escapeHtml(message)}</div>
    </div>
    <button class="toast-close" aria-label="Dismiss notification" title="Dismiss">
      ${renderIcon('x', 12)}
    </button>
  `;

  let timeoutId = null;
  let remainingMs = duration;
  let startTime = Date.now();

  const dismiss = () => {
    if (toast._dismissed) return;
    toast._dismissed = true;
    if (timeoutId) clearTimeout(timeoutId);
    toast.classList.add('pipra-toast-hiding');
    setTimeout(() => {
      toast.remove();
    }, 220);
  };

  const startTimer = () => {
    if (duration > 0 && remainingMs > 0) {
      startTime = Date.now();
      timeoutId = setTimeout(dismiss, remainingMs);
    }
  };

  const pauseTimer = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
      remainingMs -= (Date.now() - startTime);
    }
  };

  toast.addEventListener('mouseenter', pauseTimer);
  toast.addEventListener('mouseleave', startTimer);

  const closeBtn = toast.querySelector('.toast-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dismiss();
    });
  }

  container.appendChild(toast);
  startTimer();

  return { dismiss };
}

// Re-export accessible alert dialogs for unified notification imports
export { openAlertDialog, showAlert };

