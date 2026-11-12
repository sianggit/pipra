/**
 * Pipra Accessible Modal & Alert Dialog Manager (WCAG 2.2 Level AA)
 * Features strict keyboard focus trapping, Escape dismiss, and focus restoration.
 * Adheres to Pipra Design Tokens and Anti-Slop AI Quality Filter v3.2.20.
 */

import { renderIcon } from '../icons.js';

let activeModal = null;
let lastFocusedElement = null;

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Standard Modal Dialog
 * Supports both `bodyHtml` and `content` properties for backward/forward compatibility.
 */
export function openModal({
  title,
  bodyHtml,
  content,
  body,
  confirmText = 'Confirm',
  confirmClass = 'btn-primary',
  onConfirm = null,
  cancelText = 'Cancel',
  showCancel = true,
  closable = true,
  maxWidth = '540px'
}) {
  closeModal();

  lastFocusedElement = document.activeElement;

  const renderedBody = bodyHtml !== undefined ? bodyHtml : (content !== undefined ? content : (body !== undefined ? body : ''));

  const modalOverlay = document.createElement('div');
  modalOverlay.className = 'modal-backdrop';
  modalOverlay.id = 'pipra-modal-overlay';
  modalOverlay.setAttribute('role', 'dialog');
  modalOverlay.setAttribute('aria-modal', 'true');
  modalOverlay.setAttribute('aria-labelledby', 'modal-title');

  modalOverlay.innerHTML = `
    <div class="modal-dialog" style="max-width: ${maxWidth};">
      <div class="modal-header">
        <h3 id="modal-title" style="margin: 0; font-size: var(--font-size-lg); font-weight: 600; color: var(--t1);">${escapeHtml(title)}</h3>
        ${closable ? `
        <button id="modal-close-btn" class="btn btn-ghost btn-sm" aria-label="Close dialog" title="Close">
          ${renderIcon('x', 14)}
        </button>` : ''}
      </div>
      <div class="modal-body">
        ${renderedBody}
      </div>
      <div class="modal-footer">
        ${showCancel && closable ? `<button id="modal-cancel-btn" class="btn btn-secondary">${escapeHtml(cancelText)}</button>` : ''}
        ${onConfirm ? `<button id="modal-confirm-btn" class="btn ${confirmClass}">${escapeHtml(confirmText)}</button>` : ''}
      </div>
    </div>
  `;

  document.body.appendChild(modalOverlay);
  activeModal = modalOverlay;

  const closeBtn = modalOverlay.querySelector('#modal-close-btn');
  const cancelBtn = modalOverlay.querySelector('#modal-cancel-btn');
  const confirmBtn = modalOverlay.querySelector('#modal-confirm-btn');

  const handleClose = () => closeModal();
  if (closeBtn && closable) closeBtn.addEventListener('click', handleClose);
  if (cancelBtn && closable) cancelBtn.addEventListener('click', handleClose);

  if (confirmBtn && onConfirm) {
    confirmBtn.addEventListener('click', async () => {
      confirmBtn.disabled = true;
      confirmBtn.innerText = 'Processing...';
      try {
        const result = await onConfirm();
        // If onConfirm explicitly returns false (e.g. form validation failed), stay open
        if (result === false) {
          confirmBtn.disabled = false;
          confirmBtn.innerText = confirmText;
          return;
        }
        closeModal();
      } catch (err) {
        confirmBtn.disabled = false;
        confirmBtn.innerText = confirmText;
        const bodyElem = modalOverlay.querySelector('.modal-body');
        if (bodyElem) {
          const oldErr = bodyElem.querySelector('.modal-action-error');
          if (oldErr) oldErr.remove();

          const errBox = document.createElement('div');
          errBox.className = 'modal-action-error';
          errBox.style.cssText = 'margin-bottom: 12px; padding: 10px 14px; background-color: rgba(242, 118, 131, 0.12); border: 1px solid var(--bad); border-radius: var(--radius-sm, 6px); color: var(--bad); font-size: 13px; display: flex; align-items: flex-start; gap: 8px;';
          errBox.innerHTML = `<span style="flex-shrink: 0; margin-top: 1px;">${renderIcon('warn', 14)}</span><div><strong>Action failed:</strong> ${escapeHtml(err.message)}</div>`;
          bodyElem.prepend(errBox);
        }
      }
    });
  }

  // Backdrop click dismiss (only if closable)
  if (closable) {
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) closeModal();
    });
  }

  // WCAG 2.2 AA Tab Focus Trap & Escape Handler
  const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
  const keyHandler = (e) => {
    if (e.key === 'Escape') {
      if (closable) {
        e.preventDefault();
        closeModal();
      }
      return;
    }

    if (e.key === 'Tab') {
      const focusables = Array.from(modalOverlay.querySelectorAll(focusableSelector)).filter(el => !el.disabled);
      if (focusables.length === 0) return;

      const firstEl = focusables[0];
      const lastEl = focusables[focusables.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        }
      } else {
        if (document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    }
  };

  document.addEventListener('keydown', keyHandler);
  modalOverlay._keyHandler = keyHandler;

  // Set initial focus
  setTimeout(() => {
    if (confirmBtn) {
      confirmBtn.focus();
    } else if (cancelBtn) {
      cancelBtn.focus();
    } else if (closeBtn) {
      closeBtn.focus();
    }
  }, 50);
}

/**
 * Modern Accessible Alert Dialog (WCAG 2.2 Level AA alertdialog)
 * Replaces disruptive native window.alert() with Pipra design system standards.
 * Features semantic status icons, formatted diagnostic outputs, and one-click clipboard copying.
 */
export function openAlertDialog({
  title = 'Notification',
  message = '',
  type = 'info', // 'error' | 'success' | 'warning' | 'info'
  details = null,
  confirmText = 'Dismiss',
  onConfirm = null
}) {
  closeModal();

  lastFocusedElement = document.activeElement;

  const typeConfig = {
    error: {
      icon: 'warn',
      color: 'var(--bad)',
      bg: 'rgba(242, 118, 131, 0.12)',
      border: 'rgba(242, 118, 131, 0.3)',
      defaultTitle: 'Operation Failed'
    },
    success: {
      icon: 'check',
      color: 'var(--ok)',
      bg: 'rgba(67, 201, 154, 0.12)',
      border: 'rgba(67, 201, 154, 0.3)',
      defaultTitle: 'Operation Succeeded'
    },
    warning: {
      icon: 'warn',
      color: 'var(--warn)',
      bg: 'rgba(240, 184, 91, 0.12)',
      border: 'rgba(240, 184, 91, 0.3)',
      defaultTitle: 'Attention Required'
    },
    info: {
      icon: 'act',
      color: 'var(--info)',
      bg: 'rgba(124, 184, 248, 0.12)',
      border: 'rgba(124, 184, 248, 0.3)',
      defaultTitle: 'Notice'
    }
  };

  const cfg = typeConfig[type] || typeConfig.info;
  const dialogTitle = title || cfg.defaultTitle;

  const modalOverlay = document.createElement('div');
  modalOverlay.className = 'modal-backdrop pipra-alert-backdrop';
  modalOverlay.id = 'pipra-alert-overlay';
  modalOverlay.setAttribute('role', 'alertdialog');
  modalOverlay.setAttribute('aria-modal', 'true');
  modalOverlay.setAttribute('aria-labelledby', 'alert-dialog-title');
  modalOverlay.setAttribute('aria-describedby', 'alert-dialog-desc');

  const detailsHtml = details ? `
    <div class="alert-details-container" style="margin-top: 14px;">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 6px;">
        <span style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; color: var(--t3);">Diagnostic Output</span>
        <button id="alert-copy-btn" class="btn btn-ghost btn-sm" style="height: 24px; padding: 0 8px; font-size: 11px; gap: 4px; color: var(--t2);" title="Copy output to clipboard">
          ${renderIcon('copy', 12)}
          <span id="alert-copy-label">Copy Error</span>
        </button>
      </div>
      <pre id="alert-details-pre" class="mono" style="margin: 0; padding: 10px 12px; background: var(--in); border: 1px solid var(--bd); border-radius: 6px; font-size: 11px; line-height: 1.5; color: var(--t1); max-height: 200px; overflow-y: auto; white-space: pre-wrap; word-break: break-all; user-select: text;">${escapeHtml(details)}</pre>
    </div>
  ` : '';

  modalOverlay.innerHTML = `
    <div class="modal-dialog alert-dialog" style="max-width: 520px;">
      <div class="modal-header" style="padding: 14px 16px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="width: 32px; height: 32px; border-radius: 8px; background: ${cfg.bg}; border: 1px solid ${cfg.border}; display: grid; place-items: center; color: ${cfg.color}; flex-shrink: 0;">
            ${renderIcon(cfg.icon, 16)}
          </div>
          <h3 id="alert-dialog-title" style="margin: 0; font-size: 15px; font-weight: 600; color: var(--t1); line-height: 1.3;">${escapeHtml(dialogTitle)}</h3>
        </div>
        <button id="alert-close-btn" class="btn btn-ghost btn-sm" aria-label="Close dialog" title="Close">
          ${renderIcon('x', 14)}
        </button>
      </div>
      <div class="modal-body" style="padding: 16px;">
        <div id="alert-dialog-desc" style="font-size: 13px; color: var(--t2); line-height: 1.5;">${escapeHtml(message)}</div>
        ${detailsHtml}
      </div>
      <div class="modal-footer" style="padding: 12px 16px;">
        <button id="alert-confirm-btn" class="btn btn-primary" style="min-width: 88px;">${escapeHtml(confirmText)}</button>
      </div>
    </div>
  `;

  document.body.appendChild(modalOverlay);
  activeModal = modalOverlay;

  const closeBtn = modalOverlay.querySelector('#alert-close-btn');
  const confirmBtn = modalOverlay.querySelector('#alert-confirm-btn');
  const copyBtn = modalOverlay.querySelector('#alert-copy-btn');

  const handleClose = async () => {
    if (typeof onConfirm === 'function') {
      try {
        await onConfirm();
      } catch (e) {
        console.error('Error in alert onConfirm:', e);
      }
    }
    closeModal();
  };

  if (closeBtn) closeBtn.addEventListener('click', handleClose);
  if (confirmBtn) confirmBtn.addEventListener('click', handleClose);

  if (copyBtn && details) {
    copyBtn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(String(details));
        const label = modalOverlay.querySelector('#alert-copy-label');
        if (label) {
          const prev = label.innerText;
          label.innerText = 'Copied!';
          setTimeout(() => {
            label.innerText = prev;
          }, 2000);
        }
      } catch (err) {
        // Fallback for clipboard API restrictions
        const pre = modalOverlay.querySelector('#alert-details-pre');
        if (pre) {
          const selection = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(pre);
          selection.removeAllRanges();
          selection.addRange(range);
          document.execCommand('copy');
          const label = modalOverlay.querySelector('#alert-copy-label');
          if (label) {
            label.innerText = 'Copied!';
            setTimeout(() => { label.innerText = 'Copy Error'; }, 2000);
          }
        }
      }
    });
  }

  // Backdrop click dismiss
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) handleClose();
  });

  // Focus trap & Escape handler
  const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
  const keyHandler = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      handleClose();
      return;
    }

    if (e.key === 'Tab') {
      const focusables = Array.from(modalOverlay.querySelectorAll(focusableSelector)).filter(el => !el.disabled);
      if (focusables.length === 0) return;

      const firstEl = focusables[0];
      const lastEl = focusables[focusables.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        }
      } else {
        if (document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    }
  };

  document.addEventListener('keydown', keyHandler);
  modalOverlay._keyHandler = keyHandler;

  // Set initial focus
  setTimeout(() => {
    if (confirmBtn) confirmBtn.focus();
  }, 50);
}

export const showAlert = openAlertDialog;

export function closeModal() {
  if (activeModal) {
    if (activeModal._keyHandler) {
      document.removeEventListener('keydown', activeModal._keyHandler);
    }
    activeModal.remove();
    activeModal = null;
    if (lastFocusedElement && typeof lastFocusedElement.focus === 'function') {
      lastFocusedElement.focus();
      lastFocusedElement = null;
    }
  }
}
