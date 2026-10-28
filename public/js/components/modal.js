/**
 * Pipra Accessible Modal Dialog Manager (WCAG 2.2 AA)
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
        <h3 id="modal-title" style="margin: 0; font-size: var(--font-size-title); font-weight: 600;">${title}</h3>
        <button id="modal-close-btn" class="btn btn-ghost btn-sm" aria-label="Close dialog">
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
        alert(`Error: ${err.message}`);
      }
    });
  }

  // Backdrop dismiss
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
  });

  // Escape key handler
  const keyHandler = (e) => {
    if (e.key === 'Escape') closeModal();
  };
  document.addEventListener('keydown', keyHandler);
  modalOverlay._keyHandler = keyHandler;

  // Focus the first action button
  if (confirmBtn) {
    confirmBtn.focus();
  } else if (cancelBtn) {
    cancelBtn.focus();
  }
}

export function closeModal() {
  if (activeModal) {
    if (activeModal._keyHandler) {
      document.removeEventListener('keydown', activeModal._keyHandler);
    }
    activeModal.remove();
    activeModal = null;
    if (lastFocusedElement) {
      lastFocusedElement.focus();
      lastFocusedElement = null;
    }
  }
}
