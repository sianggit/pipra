/**
 * Pipra DORA Metrics & Engineering Reliability Cockpit Component
 * 4-Pillar DORA KPIs (DF, LTFC, CFR, MTTR) with standardized tier badges,
 * native SVG daily volume bars, period delta indicators, and export actions.
 * Zero external charting dependencies (pure SVG & semantic tokens).
 */

import { api } from '../api.js';
import { renderIcon, ic } from '../icons.js';
import { showToast } from './toast.js';

let activeTimeframe = '30d';
let activeAppFilter = null;
let cachedDoraData = null;

/**
 * Returns the CSS badge class for a given DORA tier
 */
function getTierBadge(tier) {
  switch (tier) {
    case 'ELITE':
      return `<span class="b ok" style="font-weight: 600;">${renderIcon('check', 11)} Elite</span>`;
    case 'HIGH':
      return `<span class="b info" style="font-weight: 600;">${renderIcon('shield', 11)} High</span>`;
    case 'MEDIUM':
      return `<span class="b warn" style="font-weight: 600;">${renderIcon('warn', 11)} Medium</span>`;
    case 'LOW':
    default:
      return `<span class="b bad" style="font-weight: 600;">${renderIcon('x', 11)} Low</span>`;
  }
}

/**
 * Formats period-over-period delta with directional indicator
 */
function renderDeltaPill(delta, isGoodDelta, timeframe) {
  if (delta === 0 || delta === null || delta === undefined) {
    return `<span style="color: var(--t3); font-size: 11px;">0.0% vs prior</span>`;
  }
  const color = isGoodDelta ? 'var(--ok)' : 'var(--bad)';
  const arrow = delta > 0 ? '↑' : '↓';
  const sign = delta > 0 ? '+' : '';
  return `<span style="color: ${color}; font-size: 11px; font-weight: 600;">${arrow} ${sign}${delta}% vs prior</span>`;
}

/**
 * Generates an accessible, zero-dependency SVG stacked bar chart of production deployments
 */
function renderDailyVolumeSvg(buckets = []) {
  if (!buckets || buckets.length === 0) {
    return `
      <div style="padding: 32px; text-align: center; color: var(--t3); font-size: 13px;">
        No production deployments recorded in this timeframe.
      </div>
    `;
  }

  const svgWidth = 840;
  const svgHeight = 160;
  const paddingLeft = 40;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 30;

  const chartWidth = svgWidth - paddingLeft - paddingRight;
  const chartHeight = svgHeight - paddingTop - paddingBottom;

  const maxTotal = Math.max(3, ...buckets.map(b => b.total));
  const barCount = buckets.length;
  const barGap = barCount > 30 ? 2 : 4;
  const barWidth = Math.max(3, (chartWidth / barCount) - barGap);

  // Y-axis grid ticks
  const yTicks = [0, Math.ceil(maxTotal / 2), maxTotal];
  const yLines = yTicks.map(val => {
    const y = paddingTop + chartHeight - (val / maxTotal) * chartHeight;
    return `
      <line x1="${paddingLeft}" y1="${y}" x2="${svgWidth - paddingRight}" y2="${y}" stroke="var(--bd)" stroke-dasharray="3,3" stroke-width="1" />
      <text x="${paddingLeft - 8}" y="${y + 4}" fill="var(--t3)" font-size="10" font-family="var(--m)" text-anchor="end">${val}</text>
    `;
  }).join('');

  // Bars rendering
  const bars = buckets.map((b, idx) => {
    const x = paddingLeft + idx * (barWidth + barGap);
    const totalHeight = (b.total / maxTotal) * chartHeight;
    const succHeight = (b.succeeded / maxTotal) * chartHeight;
    const failHeight = (b.failed / maxTotal) * chartHeight;

    const succY = paddingTop + chartHeight - succHeight;
    const failY = succY - failHeight;

    // Show date tick every ~7 bars or 1st/last
    const showTick = barCount <= 14 || (idx % Math.ceil(barCount / 7) === 0) || idx === barCount - 1;
    const dateLabel = showTick ? `
      <text x="${x + barWidth / 2}" y="${svgHeight - 10}" fill="var(--t3)" font-size="10" font-family="var(--m)" text-anchor="middle">${b.displayDate}</text>
    ` : '';

    return `
      <g class="chart-bar-group" tabindex="0" role="graphics-symbol" aria-label="${b.date}: ${b.succeeded} verified, ${b.failed} failed">
        <title>${b.date}: ${b.succeeded} verified, ${b.failed} failed (${b.total} total)</title>
        <!-- Background track for hover target -->
        <rect x="${x - 1}" y="${paddingTop}" width="${barWidth + 2}" height="${chartHeight}" fill="transparent" class="bar-target" />
        ${succHeight > 0 ? `
          <rect x="${x}" y="${succY}" width="${barWidth}" height="${succHeight}" fill="var(--ok)" rx="1" />
        ` : ''}
        ${failHeight > 0 ? `
          <rect x="${x}" y="${failY}" width="${barWidth}" height="${failHeight}" fill="var(--bad)" rx="1" />
        ` : ''}
        ${b.total === 0 ? `
          <rect x="${x}" y="${paddingTop + chartHeight - 2}" width="${barWidth}" height="2" fill="var(--bs)" />
        ` : ''}
        ${dateLabel}
      </g>
    `;
  }).join('');

  return `
    <figure style="margin: 0;">
      <svg viewBox="0 0 ${svgWidth} ${svgHeight}" style="width: 100%; height: auto; display: block; overflow: visible;" aria-label="Daily Production Deployment Volume Trend">
        ${yLines}
        ${bars}
      </svg>
      <figcaption class="sr-only" style="position: absolute; width: 1px; height: 1px; overflow: hidden;">
        Daily production deployment frequency chart showing verified and failed release distribution over the selected period.
      </figcaption>
    </figure>
  `;
}

/**
 * Primary Render function for the DORA Dashboard section
 */
export async function renderDoraDashboard(container, options = {}) {
  const { applicationId = null } = options;
  if (applicationId !== undefined) activeAppFilter = applicationId;

  container.innerHTML = `
    <div class="pn" style="margin-bottom: 24px;">
      <div style="padding: 24px; text-align: center; color: var(--t2);">
        <div class="mono">${renderIcon('clock', 14)} Computing DORA telemetry...</div>
      </div>
    </div>
  `;

  try {
    cachedDoraData = await api.getDoraMetrics(activeTimeframe, activeAppFilter);
    const m = cachedDoraData.metrics;

    container.innerHTML = `
      <section class="pn" style="margin-bottom: 24px; padding: 20px;">
        <!-- Header & Range Filter Bar -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <h2 style="margin: 0; font-size: 16px; font-weight: 600; color: var(--t1); display: flex; align-items: center; gap: 8px;">
                ${renderIcon('activity', 16)}
                <span>DORA Metrics & Engineering Reliability</span>
              </h2>
              <span class="b" style="font-size: 11px; background: var(--ss); color: var(--t3); border: 1px solid var(--bd);">
                Industry 2026 Standards
              </span>
            </div>
            <p style="margin: 4px 0 0 0; font-size: 12px; color: var(--t2);">
              DevOps Research & Assessment continuous delivery performance derived natively from SQLite telemetry.
            </p>
          </div>

          <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
            <!-- Timeframe toggles -->
            <div class="btn-group" style="display: inline-flex; border: 1px solid var(--bd); border-radius: 6px; overflow: hidden;">
              <button class="btn sm ${activeTimeframe === '7d' ? 'p' : ''}" data-tf="7d" style="border-radius: 0; padding: 4px 10px; font-size: 11px;">7D</button>
              <button class="btn sm ${activeTimeframe === '30d' ? 'p' : ''}" data-tf="30d" style="border-radius: 0; padding: 4px 10px; font-size: 11px;">30D</button>
              <button class="btn sm ${activeTimeframe === '90d' ? 'p' : ''}" data-tf="90d" style="border-radius: 0; padding: 4px 10px; font-size: 11px;">90D</button>
              <button class="btn sm ${activeTimeframe === 'all' ? 'p' : ''}" data-tf="all" style="border-radius: 0; padding: 4px 10px; font-size: 11px;">All</button>
            </div>

            <!-- Export Buttons -->
            <a id="btn-export-dora-csv" href="${api.getDoraExportUrl('csv', activeTimeframe, activeAppFilter)}" target="_blank" class="btn sm" title="Export CSV Report">
              ${renderIcon('download', 12)}
              <span>CSV</span>
            </a>
            <a id="btn-export-dora-json" href="${api.getDoraExportUrl('json', activeTimeframe, activeAppFilter)}" target="_blank" class="btn sm" title="Export JSON Report">
              ${renderIcon('download', 12)}
              <span>JSON</span>
            </a>
          </div>
        </div>

        <!-- 4-Card DORA KPI Strip -->
        <dl class="pn strip" style="margin-bottom: 20px; background: var(--sr); border: 1px solid var(--bd);">
          <!-- DF -->
          <div style="padding: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <dt class="l" style="margin: 0; font-size: 12px; color: var(--t2); font-weight: 500;">Deployment Frequency</dt>
              ${getTierBadge(m.deploymentFrequency.tier)}
            </div>
            <dd class="v mono num" style="margin: 0 0 4px 0; font-size: 22px; font-weight: 700; color: var(--t1);">
              ${m.deploymentFrequency.headline}
            </dd>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span class="l" style="font-size: 11px; color: var(--t3);">${m.deploymentFrequency.totalReleases} releases</span>
              ${renderDeltaPill(m.deploymentFrequency.delta, m.deploymentFrequency.isGoodDelta, activeTimeframe)}
            </div>
          </div>

          <!-- LTFC -->
          <div style="padding: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <dt class="l" style="margin: 0; font-size: 12px; color: var(--t2); font-weight: 500;">Lead Time for Changes</dt>
              ${getTierBadge(m.leadTimeForChanges.tier)}
            </div>
            <dd class="v mono num" style="margin: 0 0 4px 0; font-size: 22px; font-weight: 700; color: var(--t1);">
              ${m.leadTimeForChanges.headline}
            </dd>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span class="l" style="font-size: 11px; color: var(--t3);">Commit to Prod</span>
              ${renderDeltaPill(m.leadTimeForChanges.delta, m.leadTimeForChanges.isGoodDelta, activeTimeframe)}
            </div>
          </div>

          <!-- CFR -->
          <div style="padding: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <dt class="l" style="margin: 0; font-size: 12px; color: var(--t2); font-weight: 500;">Change Failure Rate</dt>
              ${getTierBadge(m.changeFailureRate.tier)}
            </div>
            <dd class="v mono num" style="margin: 0 0 4px 0; font-size: 22px; font-weight: 700; color: var(--t1);">
              ${m.changeFailureRate.headline}
            </dd>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span class="l" style="font-size: 11px; color: var(--t3);">${m.changeFailureRate.failedReleases} degraded of ${m.changeFailureRate.totalReleases}</span>
              ${renderDeltaPill(m.changeFailureRate.delta, m.changeFailureRate.isGoodDelta, activeTimeframe)}
            </div>
          </div>

          <!-- MTTR -->
          <div style="padding: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <dt class="l" style="margin: 0; font-size: 12px; color: var(--t2); font-weight: 500;">Time to Restore Service</dt>
              ${getTierBadge(m.meanTimeToRecovery.tier)}
            </div>
            <dd class="v mono num" style="margin: 0 0 4px 0; font-size: 22px; font-weight: 700; color: var(--t1);">
              ${m.meanTimeToRecovery.headline}
            </dd>
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span class="l" style="font-size: 11px; color: var(--t3);">Incident to Healthy</span>
              ${renderDeltaPill(m.meanTimeToRecovery.delta, m.meanTimeToRecovery.isGoodDelta, activeTimeframe)}
            </div>
          </div>
        </dl>

        <!-- Daily Production Releases SVG Chart -->
        <div class="pn" style="background: var(--ss); border: 1px solid var(--bd); padding: 16px; border-radius: 6px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <span style="font-size: 12px; font-weight: 600; color: var(--t2);">Daily Production Delivery Volume</span>
            <div style="display: flex; gap: 12px; font-size: 11px; color: var(--t3);">
              <span style="display: inline-flex; align-items: center; gap: 4px;">
                <span style="display: inline-block; width: 8px; height: 8px; background: var(--ok); border-radius: 2px;"></span>
                <span>Verified Release</span>
              </span>
              <span style="display: inline-flex; align-items: center; gap: 4px;">
                <span style="display: inline-block; width: 8px; height: 8px; background: var(--bad); border-radius: 2px;"></span>
                <span>Degraded / Rollback</span>
              </span>
            </div>
          </div>
          ${renderDailyVolumeSvg(cachedDoraData.dailyBuckets)}
        </div>
      </section>
    `;

    // Bind timeframe toggle events
    container.querySelectorAll('button[data-tf]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tf = e.currentTarget.getAttribute('data-tf');
        if (tf !== activeTimeframe) {
          activeTimeframe = tf;
          renderDoraDashboard(container, { applicationId: activeAppFilter });
        }
      });
    });

  } catch (err) {
    container.innerHTML = `
      <div class="pn" style="margin-bottom: 24px; border-color: var(--bad);">
        <div class="ph"><h3 style="color: var(--bad); margin: 0;">Failed to load DORA metrics</h3></div>
        <div class="pb"><p class="t2">${err.message || 'Error computing reliability telemetry.'}</p></div>
      </div>
    `;
  }
}

