/**
 * Pipra Structured Terminal Log Viewer Component
 * 4-Column Monospace Log Console with Stage Isolation & Copy Support
 * Aligned with DESIGN.md & Control Plane Redesign Mockup
 */

import { renderIcon } from '../icons.js';

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function renderLogViewer(logs = [], selectedStage = null) {
  const filtered = logs.filter(l => !selectedStage || l.stage_number === selectedStage);

  return `
    <div class="pn log-panel-container">
      <div class="ph">
        <h2>Terminal log</h2>
        <div style="display: flex; gap: 8px; align-items: center;">
          <small class="num" id="log-counter">
            ${filtered.length} / ${logs.length} lines${selectedStage ? ` · stage ${selectedStage}` : ''}
          </small>
          ${selectedStage ? `
            <button class="btn sm" id="btn-show-all-stages">Show all stages</button>
          ` : ''}
          <button class="btn sm" id="btn-copy-logs" aria-label="Copy logs">
            ${renderIcon('copy', 12)}
            <span>Copy</span>
          </button>
        </div>
      </div>
      <div class="log" id="log-stream-content" tabindex="0" aria-label="Deployment log">
        ${filtered.length === 0 ? `
          <div style="padding: 16px; color: var(--t3);">No log output for this stage.</div>
        ` : filtered.map(l => {
          const time = l.timestamp ? l.timestamp.substring(11, 19) : '--:--:--';
          const stage = l.stage_number ? `S${String(l.stage_number).padStart(2, '0')}` : 'S--';
          const level = (l.level || 'INFO').toUpperCase();
          const isWarn = level === 'WARN' || level === 'ERROR';
          return `<div><span class="t">${time}</span><span class="t">${stage}</span><span class="${isWarn ? 'w' : 't'}">${level}</span><span>${escapeHtml(l.message)}</span></div>`;
        }).join('')}
      </div>
    </div>
  `;
}

export function updateLogLines(container, logs = [], selectedStage = null) {
  if (!container) return;
  const filtered = logs.filter(l => !selectedStage || l.stage_number === selectedStage);

  const counter = document.getElementById('log-counter');
  if (counter) {
    counter.textContent = `${filtered.length} / ${logs.length} lines${selectedStage ? ` · stage ${selectedStage}` : ''}`;
  }

  // Check if user was already at or near bottom before updating
  const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 80;

  if (filtered.length === 0) {
    container.innerHTML = `<div style="padding: 16px; color: var(--t3);">No log output for this stage.</div>`;
    return;
  }

  container.innerHTML = filtered.map(l => {
    const time = l.timestamp ? l.timestamp.substring(11, 19) : '--:--:--';
    const stage = l.stage_number ? `S${String(l.stage_number).padStart(2, '0')}` : 'S--';
    const level = (l.level || 'INFO').toUpperCase();
    const isWarn = level === 'WARN' || level === 'ERROR';
    return `<div><span class="t">${time}</span><span class="t">${stage}</span><span class="${isWarn ? 'w' : 't'}">${level}</span><span>${escapeHtml(l.message)}</span></div>`;
  }).join('');

  if (isNearBottom) {
    container.scrollTop = container.scrollHeight;
  }
}
