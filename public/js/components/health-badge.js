/**
 * Pipra Accessible Status Badge Component
 * Aligned with Redesigned Control Plane Mockup
 */

import { ic } from '../icons.js';

const SB = {
  s: ['ok', 'check', 'Verified'],
  f: ['bad', 'x', 'Failed'],
  c: ['neu', 'ban', 'Cancelled'],
  k: ['neu', 'minus', 'Skipped']
};

export function renderBadgeByCode(code) {
  const item = SB[code] || SB.c;
  return `<span class="b ${item[0]}">${ic(item[1])}${item[2]}</span>`;
}

export function renderStatusBadge(status) {
  const s = (status || 'UNKNOWN').toUpperCase();

  switch (s) {
    case 'SUCCEEDED':
    case 'VERIFIED':
    case 'HEALTHY':
    case 'ONLINE':
      return `<span class="b ok">${ic('check')}Verified</span>`;

    case 'FAILED':
    case 'OFFLINE':
    case 'UNHEALTHY':
      return `<span class="b bad">${ic('x')}Failed</span>`;

    case 'ROLLBACK_FAILED':
      return `<span class="b bad">${ic('warn')}Rollback failed</span>`;

    case 'ROLLED_BACK':
    case 'ROLLING_BACK':
      return `<span class="b warn">${ic('rot')}Rolled back</span>`;

    case 'RUNNING':
    case 'IN_PROGRESS':
    case 'EXECUTING':
      return `<span class="b info">${ic('play')}Running</span>`;

    case 'CANCELLED':
      return `<span class="b neu">${ic('ban')}Cancelled</span>`;

    case 'WAITING_FOR_APPROVAL':
      return `<span class="b warn">${ic('shield')}Awaiting Approval</span>`;

    case 'QUEUED':
    case 'PENDING':
      return `<span class="b neu">${ic('clock')}Queued</span>`;

    case 'SKIPPED':
      return `<span class="b neu">${ic('minus')}Skipped</span>`;

    default:
      return `<span class="b neu">${ic('ban')}${s}</span>`;
  }
}
