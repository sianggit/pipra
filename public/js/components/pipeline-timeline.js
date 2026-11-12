/**
 * Pipra Interactive Pipeline Timeline Component
 * Proportional duration bar + 10-stage interactive button grid.
 * Aligned with DESIGN.md & Control Plane Redesign Mockup.
 */

import { renderIcon } from '../icons.js';

export function renderPipelineTimeline(stages = [], selectedStageNumber = null) {
  // Fallback default stages if empty
  const stageList = stages.length > 0 ? stages : [
    { stage_number: 1, stage_name: 'Preflight validation', status: 'PENDING', duration_ms: 400 },
    { stage_number: 2, stage_name: 'Source sync', status: 'PENDING', duration_ms: 400 },
    { stage_number: 3, stage_name: 'Local verification', status: 'SKIPPED', duration_ms: 0 },
    { stage_number: 4, stage_name: 'Docker image build', status: 'PENDING', duration_ms: 4700 },
    { stage_number: 5, stage_name: 'Staging startup', status: 'PENDING', duration_ms: 500 },
    { stage_number: 6, stage_name: 'Staging health check', status: 'PENDING', duration_ms: 3200 },
    { stage_number: 7, stage_name: 'Production cutover', status: 'PENDING', duration_ms: 500 },
    { stage_number: 8, stage_name: 'Production verification', status: 'PENDING', duration_ms: 3200 },
    { stage_number: 9, stage_name: 'Automatic rollback', status: 'SKIPPED', duration_ms: 0 },
    { stage_number: 10, stage_name: 'Finalization', status: 'PENDING', duration_ms: 300 },
  ];

  const barSegments = stageList.map(s => {
    const isSucceeded = s.status === 'SUCCEEDED';
    const isFailed = s.status === 'FAILED';
    const isRunning = s.status === 'RUNNING';
    const color = isSucceeded ? 'ok' : (isFailed ? 'bad' : (isRunning ? 'info' : 'neu'));
    const flexVal = s.duration_ms ? (s.duration_ms / 1000).toFixed(1) : 0.5;
    return `<i style="--c: var(--${color}); flex: ${flexVal};" title="Stage ${s.stage_number}: ${s.stage_name} (${s.status})"></i>`;
  }).join('');

  const stageButtons = stageList.map((s, idx) => {
    const num = s.stage_number || (idx + 1);
    const isSelected = selectedStageNumber === num;
    const isSucceeded = s.status === 'SUCCEEDED';
    const isFailed = s.status === 'FAILED';
    const isRunning = s.status === 'RUNNING';
    const isSkipped = s.status === 'SKIPPED';

    let color = 'neu';
    let icon = 'minus';
    let label = 'Skipped';

    if (isSucceeded) {
      color = 'ok';
      icon = 'check';
      label = 'Passed';
    } else if (isFailed) {
      color = 'bad';
      icon = 'x';
      label = 'Failed';
    } else if (isRunning) {
      color = 'info';
      icon = 'play';
      label = 'Running';
    } else if (!isSkipped) {
      color = 'neu';
      icon = 'clock';
      label = 'Pending';
    }

    const durationStr = s.duration_ms ? `${(s.duration_ms / 1000).toFixed(1)}s` : '';

    return `
      <button class="st ${color}" aria-pressed="${isSelected}" data-stage-number="${num}">
        <span class="n">Stage ${num}</span>
        <b>${s.stage_name}</b>
        <span class="s">
          ${renderIcon(icon, 12)}
          ${label}
          <span class="mono num" style="margin-left: auto;">${durationStr}</span>
        </span>
      </button>
    `;
  }).join('');

  return `
    <div class="pn">
      <div class="ph">
        <h2>Pipeline</h2>
        <small>10 stages · select a stage to filter the log</small>
      </div>
      <div class="bar" aria-hidden="true">
        ${barSegments}
      </div>
      <div class="tl">
        ${stageButtons}
      </div>
    </div>
  `;
}

export function bindTimelineEvents(container, onSelectStage) {
  if (!container) return;
  const buttons = container.querySelectorAll('.st');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      const num = parseInt(btn.getAttribute('data-stage-number'), 10);
      onSelectStage(num);
    });
  });
}
