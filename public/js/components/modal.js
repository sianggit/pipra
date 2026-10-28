/**
 * Pipra Accessible Modal Dialog Manager (WCAG 2.2 Level AA)
 * Features strict keyboard focus trapping, Escape dismiss, and focus restoration.
 */

import { renderIcon } from '../icons.js';

let activeModal = null;
let lastFocusedElement = null;

export function openModal({ title, bodyHtml, confirmText = 'Confirm', confirmClass = 'btn-primary', onConfirm = null }) {
  closeModal();

  lastFocusedElement = document.activeElement;

  const modalOverlay = document.createElement('div');
  modalOverlay.className = 'modal-backdrop';
  modalOverlay.id = 'pipra-modal-overlay';
  modalOverlay.setAttribute('role', 'dialog');
  modalOverlay.setAttribute('aria-modal', 'true');
  modalOverlay.setAttribute('aria-labelledby', 'modal-title');

  modalOverlay.innerHTML = `
    <div class="modal-dialog">
      <div class="modal-header">
        <h3 id="modal-title" style="margin: 0; font-size: var(--font-size-lg); font-weight: 600;">${title}</h3>
        <button id="modal-close-btn" class="btn btn-ghost btn-sm" aria-label="Close dialog" title="Close">
          ${renderIcon('x', 14)}
        </button>
      </div>
      <div class="modal-body">
        ${bodyHtml}
      </div>
      <div class="modal-footer">
        <button id="modal-cancel-btn" class="btn btn-secondary">Cancel</button>
        ${onConfirm ? `<button id="modal-confirm-btn" class="btn ${confirmClass}">${confirmText}</button>` : ''}
      </div>
    </div>
  `;

  document.body.appendChild(modalOverlay);
  activeModal = modalOverlay;

  const closeBtn = modalOverlay.querySelector('#modal-close-btn');
  const cancelBtn = modalOverlay.querySelector('#modal-cancel-btn');
  const confirmBtn = modalOverlay.querySelector('#modal-confirm-btn');

  const handleClose = () => closeModal();
  closeBtn.addEventListener('click', handleClose);
  cancelBtn.addEventListener('click', handleClose);

  if (confirmBtn && onConfirm) {
    confirmBtn.addEventListener('click', async () => {
      confirmBtn.disabled = true;
      confirmBtn.innerText = 'Processing...';
      try {
        await onConfirm();
        closeModal();
      } catch (err) {
        confirmBtn.disabled = false;
        confirmBtn.innerText = confirmText;
        const bodyElem = modalOverlay.querySelector('.modal-body');
        if (bodyElem) {
          const errBox = document.createElement('div');
          errBox.style.cssText = 'margin-top: 12px; padding: 8px 12px; background-color: var(--color-status-danger-bg); border: 1px solid var(--color-status-danger); border-radius: var(--radius-sm); color: var(--color-status-danger); font-size: 12px;';
          errBox.textContent = `Action failed: ${err.message}`;
          bodyElem.prepend(errBox);
        }
      }
    });
  }

  // Backdrop click dismiss
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
  });

  // WCAG 2.2 AA Tab Focus Trap & Escape Handler
  const focusableSelector = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
  const keyHandler = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeModal();
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
    } else {
      closeBtn.focus();
    }
  }, 50);
}

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
