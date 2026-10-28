/**
 * Pipra Terminal Log Viewer Component
 * High-performance monospace log console with intelligent auto-scroll,
 * stage filtering, regex/text search, and full keyboard/screen reader compliance.
 */

import { renderIcon } from '../icons.js';

export function renderLogViewer(logs = [], selectedStage = null, autoScroll = true, filterText = '') {
  return `
    <div class="log-viewer-container" role="region" aria-label="Deployment Execution Terminal Output">
      <div class="log-viewer-toolbar">
        <div class="log-viewer-controls">
          <span style="font-size: var(--font-size-xs); font-weight: 600; color: var(--color-text-primary); display: flex; align-items: center; gap: var(--space-2);">
            ${renderIcon('terminal', 14)}
            <span>TERMINAL LOGS</span>
          </span>

          <label for="log-stage-select" class="sr-only">Filter by stage</label>
          <select id="log-stage-select" class="form-control" style="height: 28px; width: 140px; font-size: 11px; padding: 0 var(--space-2);">
            <option value="">All Stages</option>
            ${[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => `<option value="${n}" ${selectedStage === n ? 'selected' : ''}>Stage 0${n}</option>`).join('')}
          </select>

          <label for="log-search-input" class="sr-only">Filter log messages</label>
          <input type="text" id="log-search-input" class="form-control" placeholder="Search logs..." value="${filterText}" style="height: 28px; width: 170px; font-size: 11px; padding: 0 var(--space-2);" />
          
          <span id="log-counter" style="font-size: 11px; color: var(--color-text-secondary); font-family: var(--font-family-mono); white-space: nowrap;"></span>
        </div>

        <div class="log-viewer-controls">
          <label style="font-size: 11px; color: var(--color-text-secondary); display: flex; align-items: center; gap: 6px; cursor: pointer;">
            <input type="checkbox" id="log-autoscroll" ${autoScroll ? 'checked' : ''} />
            <span>Lock scroll to bottom</span>
          </label>
          <button id="btn-copy-logs" class="btn btn-secondary btn-sm" aria-label="Copy logs to clipboard" title="Copy visible logs">
            ${renderIcon('copy', 12)}
            <span>Copy</span>
          </button>
          <button id="btn-download-logs" class="btn btn-secondary btn-sm" aria-label="Export log file" title="Download raw log file">
            ${renderIcon('download', 12)}
            <span>Export</span>
          </button>
        </div>
      </div>

      <div class="log-stream" id="log-stream-content" role="log" aria-live="polite" aria-atomic="false">
        <!-- Log lines injected here -->
      </div>
    </div>
  `;
}

export function updateLogLines(container, logs, selectedStage, filterText, autoScroll) {
  if (!container) return;

  const filtered = logs.filter(log => {
    if (selectedStage && log.stage_number !== selectedStage) return false;
    if (filterText && !log.message.toLowerCase().includes(filterText.toLowerCase())) return false;
    return true;
  });

  const counterElem = document.getElementById('log-counter');
  if (counterElem) {
    counterElem.textContent = `${filtered.length} / ${logs.length} lines`;
  }

  if (filtered.length === 0) {
    container.innerHTML = `<div style="color: var(--color-text-muted); padding: var(--space-4); font-style: italic; font-size: 12px;">No log records matching active criteria.</div>`;
    return;
  }

  // Check if operator is already scrolled near the bottom
  const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 60;

  container.innerHTML = filtered.map(log => {
    const timeStr = log.timestamp ? log.timestamp.substring(11, 19) : '--:--:--';
    const levelClass = `log-level-${log.level || 'info'}`;
    const stageStr = log.stage_number ? `[S0${log.stage_number}]` : '';

    return `
      <div class="log-line">
        <span class="log-time">${timeStr}</span>
        <span style="color: var(--color-text-muted); font-size: 11px;">${stageStr}</span>
        <span class="log-level ${levelClass}">[${(log.level || 'INFO').toUpperCase()}]</span>
        <span class="log-msg">${escapeHtml(log.message)}</span>
      </div>
    `;
  }).join('');

  if (autoScroll && (isNearBottom || container.children.length < 20)) {
    container.scrollTop = container.scrollHeight;
  }
}

function escapeHtml(text) {
  return (text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
