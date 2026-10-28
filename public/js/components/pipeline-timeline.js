/**
 * Pipra Pipeline Timeline Component
 * High-density visual track of the 10 deterministic deployment lifecycle stages.
 * Fully keyboard accessible (Enter / Space to select / filter logs).
 */

import { renderIcon } from '../icons.js';

export function renderPipelineTimeline(stages = [], selectedStageNumber = null, currentActiveStage = 1) {
  const stageRows = stages.map(stage => {
    const isSelected = selectedStageNumber === stage.stage_number;
    const isRunning = stage.status === 'RUNNING';
    const isSkipped = stage.status === 'SKIPPED';
    const isFailed = stage.status === 'FAILED';
    const isSucceeded = stage.status === 'SUCCEEDED';
    const isRolledBack = stage.status === 'ROLLED_BACK' || stage.status === 'ROLLING_BACK';

    let iconHtml = renderIcon('clock', 12);
    if (isRunning) {
      iconHtml = `<span class="badge-dot" style="background-color: var(--color-action-indigo); animation: badge-pulse 1s infinite ease-in-out;"></span>`;
    } else if (isSucceeded) {
      iconHtml = `<span style="color: var(--color-status-success);">${renderIcon('check', 12)}</span>`;
    } else if (isFailed) {
      iconHtml = `<span style="color: var(--color-status-danger);">${renderIcon('x', 12)}</span>`;
    } else if (isRolledBack) {
      iconHtml = `<span style="color: var(--color-status-warning);">${renderIcon('rotate-ccw', 12)}</span>`;
    } else if (isSkipped) {
      iconHtml = `<span style="color: var(--color-text-muted); font-size: 11px;">—</span>`;
    }

    const timingStr = stage.duration_ms 
      ? `${(stage.duration_ms / 1000).toFixed(1)}s` 
      : (isRunning ? 'running...' : (isSkipped ? 'skipped' : 'pending'));

    return `
      <div class="stage-step ${isSelected ? 'active' : ''}" 
           data-stage-number="${stage.stage_number}" 
           role="button" 
           tabindex="0"
           aria-pressed="${isSelected}"
           aria-label="Stage 0${stage.stage_number}: ${stage.stage_name}. Status: ${stage.status}. Duration: ${timingStr}">
        <div class="stage-step-header">
          <span class="stage-number">${stage.stage_number < 10 ? '0' : ''}${stage.stage_number}</span>
          ${iconHtml}
        </div>
        <div class="stage-name" title="${stage.stage_name}">${stage.stage_name}</div>
        <div class="stage-timing">${timingStr}</div>
      </div>
    `;
  }).join('');

  return `
    <div class="card" style="margin-bottom: var(--space-6);">
      <div class="card-header">
        <span class="card-title">
          ${renderIcon('layers', 16)}
          <span>Pipeline Execution Track</span>
        </span>
        <span style="font-size: var(--font-size-xs); color: var(--color-text-secondary);">
          ${selectedStageNumber ? `Filtering Stage 0${selectedStageNumber} (click again to reset)` : 'Click stage to filter terminal stream'}
        </span>
      </div>
      <div class="card-body" style="padding: var(--space-3) var(--space-4);">
        <div class="pipeline-timeline-horizontal">
          ${stageRows}
        </div>
      </div>
    </div>
  `;
}

export function bindTimelineEvents(container, onSelectStage) {
  if (!container) return;
  const steps = container.querySelectorAll('.stage-step');
  steps.forEach(step => {
    step.addEventListener('click', () => {
      const num = parseInt(step.getAttribute('data-stage-number'), 10);
      onSelectStage(num);
    });
    step.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const num = parseInt(step.getAttribute('data-stage-number'), 10);
        onSelectStage(num);
      }
    });
  });
}
