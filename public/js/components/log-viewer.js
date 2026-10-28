/**
 * Pipra Terminal Log Viewer Component
 */

import { renderIcon } from '../icons.js';

export function renderLogViewer(logs = [], selectedStage = null, autoScroll = true, filterText = '') {
  return `
    <div class="log-viewer-container">
      <div class="log-viewer-toolbar">
        <div class="log-viewer-controls">
          <span style="font-size: var(--font-size-xs); font-weight: 600; color: var(--color-text-secondary); display: flex; align-items: center; gap: 4px;">
            ${renderIcon('terminal', 14)}
            <span>TERMINAL LOGS</span>
          </span>
          <select id="log-stage-select" class="form-control" style="height: 28px; width: 160px; font-size: 11px; padding: 0 8px;">
            <option value="">All Stages</option>
            ${[1,2,3,4,5,6,7,8,9,10].map(n => `<option value="${n}" ${selectedStage === n ? 'selected' : ''}>Stage 0${n}</option>`).join('')}
          </select>
          <input type="text" id="log-search-input" class="form-control" placeholder="Filter log text..." value="${filterText}" style="height: 28px; width: 180px; font-size: 11px; padding: 0 8px;" />
        </div>

        <div class="log-viewer-controls">
          <label style="font-size: 11px; color: var(--color-text-secondary); display: flex; align-items: center; gap: 4px; cursor: pointer;">
            <input type="checkbox" id="log-autoscroll" ${autoScroll ? 'checked' : ''} />
            <span>Auto-scroll</span>
          </label>
          <button id="btn-copy-logs" class="btn btn-secondary btn-sm" title="Copy visible logs">
            ${renderIcon('copy', 12)}
            <span>Copy</span>
          </button>
          <button id="btn-download-logs" class="btn btn-secondary btn-sm" title="Download .log file">
            ${renderIcon('download', 12)}
            <span>Export</span>
          </button>
        </div>
      </div>

      <div class="log-stream" id="log-stream-content" role="log" aria-live="polite">
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

  if (filtered.length === 0) {
    container.innerHTML = `<div style="color: var(--color-text-tertiary); padding: 12px; font-style: italic;">No logs recorded for this view filter.</div>`;
    return;
  }

  container.innerHTML = filtered.map(log => {
    const timeStr = log.timestamp ? log.timestamp.substring(11, 19) : '--:--:--';
    const levelClass = `log-level-${log.level || 'info'}`;
    const stageStr = log.stage_number ? `[S${log.stage_number}]` : '';

    return `
      <div class="log-line">
        <span class="log-time">${timeStr}</span>
        <span style="color: #64748b; font-size: 11px;">${stageStr}</span>
        <span class="log-level ${levelClass}">[${(log.level || 'INFO').toUpperCase()}]</span>
        <span class="log-msg">${escapeHtml(log.message)}</span>
      </div>
    `;
  }).join('');

  if (autoScroll) {
    container.scrollTop = container.scrollHeight;
  }
}

function escapeHtml(text) {
  return (text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
