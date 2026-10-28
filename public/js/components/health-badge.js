/**
 * Pipra Accessible Status Badge Component
 * Combines color, dot, icon, and text to ensure WCAG 2.2 non-color-only compliance.
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
          ${renderIcon('check', 12)}
          <span>${s}</span>
        </span>
      `;

    case 'FAILED':
    case 'OFFLINE':
    case 'UNHEALTHY':
      return `
        <span class="badge badge-error" role="status" aria-label="Status: ${s}">
          <span class="badge-dot" aria-hidden="true"></span>
          ${renderIcon('x', 12)}
          <span>${s}</span>
        </span>
      `;

    case 'ROLLBACK_FAILED':
      return `
        <span class="badge badge-error" style="border: 2px solid #ef4444;" role="alert" aria-label="Emergency: Rollback Failed">
          <span class="badge-dot" aria-hidden="true"></span>
          ${renderIcon('alert-triangle', 12)}
          <span>ROLLBACK FAILED</span>
        </span>
      `;

    case 'ROLLING_BACK':
      return `
        <span class="badge badge-warning" role="status" aria-label="Status: Rolling Back">
          <span class="badge-dot" aria-hidden="true"></span>
          ${renderIcon('rotate-ccw', 12)}
          <span>ROLLING BACK</span>
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
          ${renderIcon('activity', 12)}
          <span>${s}</span>
        </span>
      `;

    case 'CANCELLED':
    case 'INTERRUPTED':
      return `
        <span class="badge badge-warning" role="status" aria-label="Status: ${s}">
          <span class="badge-dot" aria-hidden="true"></span>
          ${renderIcon('alert-circle', 12)}
          <span>${s}</span>
        </span>
      `;

    case 'QUEUED':
    default:
      return `
        <span class="badge badge-info" role="status" aria-label="Status: ${s}">
          <span class="badge-dot" aria-hidden="true"></span>
          ${renderIcon('clock', 12)}
          <span>${s}</span>
        </span>
      `;
  }
}
