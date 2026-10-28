/**
 * Pipra Pipeline Timeline Component
 * Interactive visual representation of the 10 deployment lifecycle stages.
 */

import { renderIcon } from '../icons.js';
import { renderStatusBadge } from './health-badge.js';

export function renderPipelineTimeline(stages = [], selectedStageNumber = null, currentActiveStage = 1) {
  const stageRows = stages.map(stage => {
    const isSelected = selectedStageNumber === stage.stage_number;
    const isRunning = stage.status === 'RUNNING';
    const isSkipped = stage.status === 'SKIPPED';
    const isFailed = stage.status === 'FAILED';
    const isSucceeded = stage.status === 'SUCCEEDED';

    let iconHtml = renderIcon('clock', 12);
    if (isRunning) iconHtml = `<span class="badge-dot" style="background-color: var(--color-surface-raised); animation: pulse-ring 1s infinite;"></span>`;
    if (isSucceeded) iconHtml = `<span style="color: var(--color-status-success);">${renderIcon('check', 12)}</span>`;
    if (isFailed) iconHtml = `<span style="color: var(--color-status-error);">${renderIcon('x', 12)}</span>`;
    if (isSkipped) iconHtml = `<span style="color: var(--color-text-tertiary);">-</span>`;

    const timingStr = stage.duration_ms ? `${(stage.duration_ms / 1000).toFixed(1)}s` : (isRunning ? 'in progress...' : (isSkipped ? 'skipped' : 'pending'));

    return `
      <div class="stage-step ${isSelected ? 'active' : ''}" 
           data-stage-number="${stage.stage_number}" 
           role="button" 
           tabindex="0"
           aria-pressed="${isSelected}"
           aria-label="Stage ${stage.stage_number}: ${stage.stage_name}, status: ${stage.status}">
        <div class="stage-step-header">
          <span class="stage-number">0${stage.stage_number}</span>
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
          <span>Pipeline Execution Lifecycle</span>
        </span>
        <span style="font-size: var(--font-size-xs); color: var(--color-text-secondary);">
          Click stage to filter logs
        </span>
      </div>
      <div class="card-body" style="padding: var(--space-5);">
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
