/**
 * Pipra Live Deployment Detail Page
 * Features real-time SSE stage transitions, terminal log streaming,
 * health verification probe telemetry, and verified rollback recovery.
 */

import { api } from '../api.js';
import { renderIcon } from '../icons.js';
import { renderStatusBadge } from '../components/health-badge.js';
import { renderPipelineTimeline, bindTimelineEvents } from '../components/pipeline-timeline.js';
import { renderLogViewer, updateLogLines } from '../components/log-viewer.js';
import { DeploymentEventStream } from '../sse.js';
import { openModal } from '../components/modal.js';

let activeStream = null;

export async function renderDeploymentDetailPage(container, deploymentId) {
  if (activeStream) {
    activeStream.disconnect();
    activeStream = null;
  }

  container.innerHTML = `
    <div style="padding: var(--space-8); text-align: center; color: var(--color-text-secondary);">
      <div style="font-family: var(--font-family-mono); font-size: var(--font-size-sm);">Loading telemetry for ${deploymentId}...</div>
    </div>
  `;

  try {
    const deployment = await api.getDeployment(deploymentId);
    let currentLogs = await api.getDeploymentLogs(deploymentId);

    let selectedStageFilter = null;
    let autoScrollEnabled = true;
    let searchFilterText = '';

    function renderView() {
      const isTerminal = ['SUCCEEDED', 'FAILED', 'CANCELLED', 'INTERRUPTED', 'ROLLBACK_FAILED'].includes(deployment.status);
      const isRunning = !isTerminal;
      const isFailed = deployment.status === 'FAILED' || deployment.status === 'ROLLBACK_FAILED';

      const durationStr = deployment.duration_ms 
        ? `${(deployment.duration_ms / 1000).toFixed(1)}s` 
        : (isRunning ? 'in progress...' : '--');

      container.innerHTML = `
        <div class="page-header" style="margin-bottom: var(--space-5);">
          <div class="page-title-group">
            <div style="display: flex; align-items: center; gap: var(--space-3); margin-bottom: var(--space-1); flex-wrap: wrap;">
              <a href="#/history" class="btn btn-ghost btn-sm" title="Back to Deployments">
                ${renderIcon('rotate-ccw', 12)}
                <span>Back</span>
              </a>
              <span class="env-tag ${deployment.is_production ? 'env-tag-prod' : 'env-tag-nonprod'}">
                ${(deployment.env_name || '').toUpperCase()}
              </span>
              <span style="font-family: var(--font-family-mono); font-size: 14px; font-weight: 600; color: var(--color-text-primary);">${deployment.id}</span>
              ${renderStatusBadge(deployment.status)}
            </div>
            <p class="page-subtitle" style="margin-top: 0;">
              Target: <strong>${deployment.app_display_name}</strong> | Initiated by: <strong>${deployment.initiated_by}</strong> | Started: ${new Date(deployment.created_at).toLocaleTimeString()}
            </p>
          </div>

          <div style="display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap;">
            ${isRunning ? `
              <button id="btn-cancel-deploy" class="btn btn-danger btn-sm" aria-label="Cancel active deployment">
                ${renderIcon('x', 14)}
                <span>Cancel Execution</span>
              </button>
            ` : `
              <a href="#/deploy?app=${deployment.application_id}&env=${deployment.environment_id}&branch=${deployment.branch}" class="btn btn-primary btn-sm" aria-label="Re-deploy this revision">
                ${renderIcon('play', 14)}
                <span>Re-deploy</span>
              </a>
            `}
            <a href="/api/deployments/${deployment.id}/logs/export" target="_blank" class="btn btn-secondary btn-sm" title="Export complete raw log file">
              ${renderIcon('download', 14)}
              <span>Export Log</span>
            </a>
          </div>
        </div>

        <!-- 10-Stage Pipeline Lifecycle Track -->
        <div id="timeline-container">
          ${renderPipelineTimeline(deployment.stages, selectedStageFilter, deployment.current_stage)}
        </div>

        <!-- Failure or Rollback Diagnostic Alert -->
        ${deployment.error_message ? `
          <div style="margin-bottom: var(--space-5); padding: var(--space-3) var(--space-4); background-color: var(--color-status-danger-bg); border: 1px solid var(--color-status-danger-border); border-radius: var(--radius-sm); font-size: 13px; color: var(--color-text-primary); display: flex; align-items: flex-start; justify-content: space-between; gap: var(--space-3);">
            <div style="display: flex; align-items: flex-start; gap: var(--space-3);">
              <span style="color: var(--color-status-danger); margin-top: 2px;">${renderIcon('alert-triangle', 18)}</span>
              <div>
                <strong style="color: var(--color-status-danger);">Execution Failure Diagnostic:</strong>
                <div style="margin-top: 2px;">${deployment.error_message}</div>
                ${deployment.rollback_status === 'SUCCESSFUL' 
                  ? '<div style="color: var(--color-status-success); font-weight: 600; margin-top: 4px;">Verified: Automated rollback completed successfully. Production serving remains on last known-good release.</div>' 
                  : (deployment.rollback_status === 'FAILED'
                    ? '<div style="color: var(--color-status-danger); font-weight: 700; margin-top: 4px;">CRITICAL: Automated rollback failed. Manual infrastructure intervention required.</div>'
                    : '')}
              </div>
            </div>
          </div>
        ` : ''}

        <!-- Split View: Execution Metadata & Log Console -->
        <div style="display: grid; grid-template-columns: minmax(300px, 340px) 1fr; gap: var(--space-5); align-items: start;" class="deployment-split-grid">
          <!-- Left: Provenance & Health Probes -->
          <div style="display: flex; flex-direction: column; gap: var(--space-5);">
            <!-- Provenance Card -->
            <div class="card" style="margin-bottom: 0;">
              <div class="card-header">
                <span class="card-title">
                  ${renderIcon('git-branch', 14)}
                  <span>Release Provenance</span>
                </span>
              </div>
              <div class="card-body" style="font-size: 12px; display: flex; flex-direction: column; gap: var(--space-3);">
                <div>
                  <span style="color: var(--color-text-secondary); text-transform: uppercase; font-size: 10px; font-weight: 600;">Branch & Tag:</span>
                  <div style="font-family: var(--font-family-mono); font-weight: 600; color: var(--color-action-primary); margin-top: 2px;">
                    ${deployment.branch} @ ${deployment.image_tag}
                  </div>
                </div>
                <div>
                  <span style="color: var(--color-text-secondary); text-transform: uppercase; font-size: 10px; font-weight: 600;">Commit SHA:</span>
                  <div style="font-family: var(--font-family-mono); color: var(--color-text-primary); margin-top: 2px;">
                    ${deployment.commit_sha ? deployment.commit_sha.substring(0, 12) : 'Resolving...'}
                  </div>
                </div>
                <div>
                  <span style="color: var(--color-text-secondary); text-transform: uppercase; font-size: 10px; font-weight: 600;">Commit Message:</span>
                  <div style="color: var(--color-text-primary); margin-top: 2px; font-style: italic;">
                    ${deployment.commit_message || 'N/A'}
                  </div>
                </div>
                <div>
                  <span style="color: var(--color-text-secondary); text-transform: uppercase; font-size: 10px; font-weight: 600;">Author:</span>
                  <div style="color: var(--color-text-primary); margin-top: 2px;">
                    ${deployment.author || 'N/A'}
                  </div>
                </div>
                <div style="border-top: 1px solid var(--color-border-subtle); padding-top: var(--space-2); display: flex; justify-content: space-between;">
                  <span style="color: var(--color-text-secondary);">Total Elapsed:</span>
                  <span style="font-family: var(--font-family-mono); font-weight: 600;">${durationStr}</span>
                </div>
              </div>
            </div>

            <!-- Health Probes Card -->
            <div class="card" style="margin-bottom: 0;">
              <div class="card-header">
                <span class="card-title">
                  ${renderIcon('activity', 14)}
                  <span>Health Probes</span>
                </span>
                <span style="font-size: 11px; color: var(--color-text-secondary); font-family: var(--font-family-mono);">${deployment.probes?.length || 0} checks</span>
              </div>
              <div class="card-body" style="padding: 0; max-height: 240px; overflow-y: auto;">
                ${(!deployment.probes || deployment.probes.length === 0) ? `
                  <div style="padding: var(--space-4); font-size: 12px; color: var(--color-text-muted); text-align: center;">
                    Waiting for Stage 6 / Stage 8 probes...
                  </div>
                ` : `
                  <table>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Target</th>
                        <th>HTTP</th>
                        <th>Latency</th>
                        <th>Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${deployment.probes.map(p => `
                        <tr style="font-size: 11px; font-family: var(--font-family-mono);">
                          <td>#${p.attempt}</td>
                          <td style="max-width: 90px; overflow: hidden; text-overflow: ellipsis;" title="${p.url}">${p.url}</td>
                          <td style="color: ${p.passed ? 'var(--color-status-success)' : 'var(--color-status-danger)'}; font-weight: 600;">
                            ${p.http_status}
                          </td>
                          <td>${p.response_time_ms}ms</td>
                          <td>
                            ${p.passed 
                              ? '<span style="color: var(--color-status-success); font-weight: 600;">PASS</span>' 
                              : '<span style="color: var(--color-status-danger); font-weight: 600;">FAIL</span>'}
                          </td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                `}
              </div>
            </div>
          </div>

          <!-- Right: Terminal Log Console -->
          <div id="log-viewer-mount">
            ${renderLogViewer(currentLogs, selectedStageFilter, autoScrollEnabled, searchFilterText)}
          </div>
        </div>
      `;

      // Update log lines and bind UI controls
      const streamContent = document.getElementById('log-stream-content');
      updateLogLines(streamContent, currentLogs, selectedStageFilter, searchFilterText, autoScrollEnabled);

      bindPageEvents();
    }

    function bindPageEvents() {
      // Timeline selection
      const timelineBox = document.getElementById('timeline-container');
      bindTimelineEvents(timelineBox, (stageNumber) => {
        selectedStageFilter = (selectedStageFilter === stageNumber) ? null : stageNumber;
        renderView();
      });

      // Stage select dropdown
      const stageSelect = document.getElementById('log-stage-select');
      if (stageSelect) {
        stageSelect.addEventListener('change', (e) => {
          selectedStageFilter = e.target.value ? parseInt(e.target.value, 10) : null;
          const streamContent = document.getElementById('log-stream-content');
          updateLogLines(streamContent, currentLogs, selectedStageFilter, searchFilterText, autoScrollEnabled);
        });
      }

      // Search text filter
      const searchInput = document.getElementById('log-search-input');
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          searchFilterText = e.target.value;
          const streamContent = document.getElementById('log-stream-content');
          updateLogLines(streamContent, currentLogs, selectedStageFilter, searchFilterText, autoScrollEnabled);
        });
      }

      // Auto-scroll checkbox
      const autoScrollBox = document.getElementById('log-autoscroll');
      if (autoScrollBox) {
        autoScrollBox.addEventListener('change', (e) => {
          autoScrollEnabled = e.target.checked;
        });
      }

      // Copy logs
      const copyBtn = document.getElementById('btn-copy-logs');
      if (copyBtn) {
        copyBtn.addEventListener('click', () => {
          const text = currentLogs
            .filter(l => !selectedStageFilter || l.stage_number === selectedStageFilter)
            .map(l => `[${l.timestamp}] [Stage ${l.stage_number}] [${l.level.toUpperCase()}] ${l.message}`)
            .join('\n');
          navigator.clipboard.writeText(text);
          copyBtn.innerHTML = `<span>Copied!</span>`;
          setTimeout(() => { copyBtn.innerHTML = `${renderIcon('copy', 12)} <span>Copy</span>`; }, 2000);
        });
      }

      // Download logs
      const downloadBtn = document.getElementById('btn-download-logs');
      if (downloadBtn) {
        downloadBtn.addEventListener('click', () => {
          window.location.href = `/api/deployments/${deployment.id}/logs/export`;
        });
      }

      // Cancel deployment confirmation modal
      const cancelBtn = document.getElementById('btn-cancel-deploy');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
          openModal({
            title: 'Cancel Active Deployment',
            bodyHtml: `
              <p style="color: var(--color-text-primary);">Are you sure you want to abort deployment <strong>${deployment.id}</strong>?</p>
              <div style="margin-top: 12px; padding: 10px 12px; background-color: var(--color-status-warning-bg); border: 1px solid var(--color-status-warning-border); border-radius: var(--radius-sm); font-size: 12px; color: var(--color-text-primary);">
                Cancellation terminates active build processes and safely isolates staging containers. Live production traffic will not be affected.
              </div>
            `,
            confirmText: 'Abort Execution',
            confirmClass: 'btn-danger',
            onConfirm: async () => {
              await api.cancelDeployment(deployment.id);
              deployment.status = 'CANCELLED';
              renderView();
            },
          });
        });
      }
    }

    renderView();

    // Connect real-time Server-Sent Events stream
    activeStream = new DeploymentEventStream(deploymentId);

    activeStream.on('stage', (data) => {
      const idx = deployment.stages.findIndex(s => s.stage_number === data.stageNumber);
      if (idx !== -1) {
        deployment.stages[idx].status = data.status;
        deployment.stages[idx].duration_ms = data.durationMs;
      }
      deployment.current_stage = data.stageNumber;
      deployment.current_stage_name = data.stageName;

      // Update timeline directly
      const timelineBox = document.getElementById('timeline-container');
      if (timelineBox) {
        timelineBox.innerHTML = renderPipelineTimeline(deployment.stages, selectedStageFilter, deployment.current_stage);
        bindTimelineEvents(timelineBox, (num) => {
          selectedStageFilter = (selectedStageFilter === num) ? null : num;
          const streamContent = document.getElementById('log-stream-content');
          updateLogLines(streamContent, currentLogs, selectedStageFilter, searchFilterText, autoScrollEnabled);
        });
      }
    });

    activeStream.on('log', (logEntry) => {
      currentLogs.push(logEntry);
      const streamContent = document.getElementById('log-stream-content');
      updateLogLines(streamContent, currentLogs, selectedStageFilter, searchFilterText, autoScrollEnabled);
    });

    activeStream.on('probe', (probeData) => {
      if (!deployment.probes) deployment.probes = [];
      deployment.probes.push(probeData);
      renderView();
    });

    activeStream.on('status', (data) => {
      deployment.status = data.status;
      renderView();
    });

    activeStream.on('finished', (data) => {
      deployment.status = data.status;
      deployment.duration_ms = data.durationMs;
      deployment.error_message = data.errorMessage;
      renderView();
    });

    activeStream.connect();

  } catch (err) {
    container.innerHTML = `
      <div class="card" style="border-left: 3px solid var(--color-status-danger);">
        <div class="card-body">
          <h3 style="color: var(--color-status-danger); margin-bottom: var(--space-2);">Error loading deployment</h3>
          <p style="color: var(--color-text-secondary);">${err.message}</p>
        </div>
      </div>
    `;
  }
}
