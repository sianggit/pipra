/**
 * Pipra SVG Icons Library
 * Exact vector paths from Redesigned Control Plane Mockup
 */

export const P = {
  act: 'M22 12h-4l-3 9L9 3l-3 9H2',
  play: 'M6 4l14 8-14 8z',
  clock: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v5l3 2',
  layers: 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
  server: 'M4 3h16v7H4zM4 14h16v7H4zM8 6.5h.01M8 17.5h.01',
  cpu: 'M6 6h12v12H6zM9 9h6v6H9zM9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4',
  shield: 'M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z',
  'sun': 'M12 8a4 4 0 100 8 4 4 0 000-8zM12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  'moon': 'M21 13A9 9 0 1111 3a7 7 0 0010 10z',
  out: 'M9 21H5V3h4M16 17l5-5-5-5M21 12H9',
  check: 'M20 6L9 17l-5-5',
  x: 'M18 6L6 18M6 6l12 12',
  warn: 'M12 3l10 18H2zM12 10v5M12 18h.01',
  copy: 'M9 9h11v11H9zM5 15V4h11',
  search: 'M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-5-5',
  ban: 'M12 3a9 9 0 100 18 9 9 0 000-18zM5.6 5.6l12.8 12.8',
  minus: 'M5 12h14',
  back: 'M15 18l-6-6 6-6',
  dl: 'M12 3v12M7 10l5 5 5-5M5 21h14',
  rot: 'M3 12a9 9 0 109-9 9 9 0 00-6.4 2.6L3 8M3 3v5h5',
  user: 'M12 4a4 4 0 100 8 4 4 0 000-8zM4 21a8 8 0 0116 0',
  arr: 'M5 12h14M13 6l6 6-6 6',
  plus: 'M12 5v14M5 12h14',
  menu: 'M3 12h18M3 6h18M3 18h18',
  edit: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
  lock: 'M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z',
  key: 'M21 2l-2 2m-1.5 1.5L14 9l-2-2-4 4 2 2-3 3-2-2-3 3 2 2-2 2',
  settings: 'M12 8a4 4 0 100 8 4 4 0 000-8z'
};

const ALIASES = {
  'activity': 'act',
  'arrow-right': 'arr',
  'alert-triangle': 'warn',
  'alert-circle': 'warn',
  'log-out': 'out',
  'rotate-ccw': 'rot',
  'refresh-cw': 'rot',
  'download': 'dl',
  'terminal': 'act',
  'git-branch': 'act',
  'box': 'layers'
};

export function ic(name) {
  const key = ALIASES[name] || name;
  const path = P[key] || P.play;
  return `<svg class="i" viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>`;
}

export function renderIcon(name, size = 15, className = '') {
  const key = ALIASES[name] || name;
  const path = P[key] || P.play;
  const sizeStyle = size !== 15 ? `style="width:${size}px;height:${size}px;"` : '';
  return `<svg class="i ${className}" ${sizeStyle} viewBox="0 0 24 24" aria-hidden="true"><path d="${path}"/></svg>`;
}
