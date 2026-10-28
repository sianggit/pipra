/**
 * Pipra Accessible Status Badge Component
 * Strict dual-state mapping (SVG icon + uppercase text) for WCAG 2.2 AA non-color-only compliance.
 */

import { renderIcon } from '../icons.js';

export function renderStatusBadge(status) {
  const s = (status || 'UNKNOWN').toUpperCase();

  switch (s) {
    case 'SUCCEEDED':
    case 'HEALTHY':
    case 'ONLINE':
      return `
        <span class="badge badge-success" role="status" aria-label="Status: ${s}">
          <span class="badge-dot" aria-hidden="true"></span>
          ${renderIcon('check', 11)}
          <span>${s}</span>
        </span>
      `;

    case 'FAILED':
    case 'OFFLINE':
    case 'UNHEALTHY':
      return `
        <span class="badge badge-error" role="status" aria-label="Status: ${s}">
          <span class="badge-dot" aria-hidden="true"></span>
          ${renderIcon('x', 11)}
          <span>${s}</span>
        </span>
      `;

    case 'ROLLBACK_FAILED':
      return `
        <span class="badge badge-error" style="border: 1px solid var(--color-status-danger); font-weight: 700;" role="alert" aria-label="Emergency: Rollback Failed">
          <span class="badge-dot" aria-hidden="true"></span>
          ${renderIcon('alert-triangle', 11)}
          <span>ROLLBACK FAILED</span>
        </span>
      `;

    case 'ROLLING_BACK':
    case 'ROLLED_BACK':
      return `
        <span class="badge badge-warning" role="status" aria-label="Status: ${s}">
          <span class="badge-dot" aria-hidden="true"></span>
          ${renderIcon('rotate-ccw', 11)}
          <span>${s.replace('_', ' ')}</span>
        </span>
      `;

    case 'RUNNING':
    case 'PREPARING':
    case 'VERIFYING':
    case 'CUTTING_OVER':
    case 'BUSY':
      return `
        <span class="badge badge-running" role="status" aria-label="Status: ${s}">
          <span class="badge-dot" aria-hidden="true"></span>
          ${renderIcon('activity', 11)}
          <span>${s.replace('_', ' ')}</span>
        </span>
      `;

    case 'CANCELLED':
    case 'INTERRUPTED':
      return `
        <span class="badge badge-warning" role="status" aria-label="Status: ${s}">
          <span class="badge-dot" aria-hidden="true"></span>
          ${renderIcon('alert-circle', 11)}
          <span>${s}</span>
        </span>
      `;

    case 'QUEUED':
    case 'PENDING':
      return `
        <span class="badge badge-neutral" role="status" aria-label="Status: ${s}">
          <span class="badge-dot" aria-hidden="true"></span>
          ${renderIcon('clock', 11)}
          <span>${s}</span>
        </span>
      `;

    default:
      return `
        <span class="badge badge-neutral" role="status" aria-label="Status: ${s}">
          <span class="badge-dot" aria-hidden="true"></span>
          ${renderIcon('alert-circle', 11)}
          <span>${s}</span>
        </span>
      `;
  }
}
