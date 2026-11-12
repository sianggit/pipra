/**
 * Pipra DORA Metrics & Engineering Reliability Analytics Engine
 * Computes the 4 standard DORA pillars (DF, LTFC, CFR, MTTR) directly from
 * SQLite deployment history with sub-50ms execution, period-over-period deltas,
 * time-series bucketing, and DORA tier classification.
 */

const { getDatabase } = require('../db/database');

/**
 * Standard DORA 2026 Tier Thresholds
 */
const DORA_TIERS = {
  ELITE: 'ELITE',
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
};

/**
 * Classifies a raw numeric metric into a standardized DORA Tier.
 * @param {'DF'|'LTFC'|'CFR'|'MTTR'} metric 
 * @param {number} value 
 * @returns {'ELITE'|'HIGH'|'MEDIUM'|'LOW'}
 */
function evaluateDoraTier(metric, value) {
  if (value === null || value === undefined || isNaN(value)) {
    return DORA_TIERS.MEDIUM;
  }

  switch (metric) {
    case 'DF': // Deployments per day
      if (value >= 1.0) return DORA_TIERS.ELITE;      // >= 1/day
      if (value >= 1.0 / 7) return DORA_TIERS.HIGH;    // >= 1/week
      if (value >= 1.0 / 30) return DORA_TIERS.MEDIUM; // >= 1/month
      return DORA_TIERS.LOW;                           // < 1/month

    case 'LTFC': // Lead time in hours
      if (value <= 24) return DORA_TIERS.ELITE;       // < 1 day
      if (value <= 168) return DORA_TIERS.HIGH;       // 1 day - 1 week
      if (value <= 720) return DORA_TIERS.MEDIUM;     // 1 week - 1 month
      return DORA_TIERS.LOW;                          // > 1 month

    case 'CFR': // Change failure rate percentage (0 - 100)
      if (value <= 15) return DORA_TIERS.ELITE;       // 0% - 15%
      if (value <= 30) return DORA_TIERS.HIGH;        // 16% - 30%
      if (value <= 45) return DORA_TIERS.MEDIUM;      // 31% - 45%
      return DORA_TIERS.LOW;                          // > 45%

    case 'MTTR': // Recovery time in minutes
      if (value <= 60) return DORA_TIERS.ELITE;       // < 1 hour
      if (value <= 1440) return DORA_TIERS.HIGH;      // 1 hour - 1 day
      if (value <= 10080) return DORA_TIERS.MEDIUM;   // 1 day - 1 week
      return DORA_TIERS.LOW;                          // > 1 week

    default:
      return DORA_TIERS.MEDIUM;
  }
}

/**
 * Calculate time bounds for current and previous comparative window
 */
function parseTimeframe(timeframeStr = '30d') {
  const now = Date.now();
  let days = 30;

  switch (timeframeStr.toLowerCase()) {
    case '7d':
      days = 7;
      break;
    case '90d':
      days = 90;
      break;
    case 'all':
      days = 365; // Use 1 year as active window boundary, with no prior window limit
      break;
    case '30d':
    default:
      days = 30;
      break;
  }

  const msInDay = 86400000;
  const currentStartMs = now - days * msInDay;
  const priorStartMs = currentStartMs - days * msInDay;

  return {
    timeframe: timeframeStr,
    days,
    currentStartIso: new Date(currentStartMs).toISOString(),
    currentEndIso: new Date(now).toISOString(),
    priorStartIso: new Date(priorStartMs).toISOString(),
    priorEndIso: new Date(currentStartMs).toISOString(),
  };
}

/**
 * Formats a metric into a human-readable display string
 */
function formatHeadlineMetric(metric, value) {
  if (value === null || value === undefined || isNaN(value)) return '—';

  switch (metric) {
    case 'DF':
      if (value >= 1.0) return `${value.toFixed(1)} / day`;
      if (value * 7 >= 1.0) return `${(value * 7).toFixed(1)} / week`;
      return `${(value * 30).toFixed(1)} / month`;

    case 'LTFC':
      if (value < 1.0) return `${Math.max(1, Math.round(value * 60))} mins`;
      if (value < 48) return `${value.toFixed(1)} hours`;
      return `${(value / 24).toFixed(1)} days`;

    case 'CFR':
      return `${value.toFixed(1)}%`;

    case 'MTTR':
      if (value === 0) return '0m (Flawless)';
      if (value < 60) return `${Math.round(value)} mins`;
      if (value < 1440) return `${(value / 60).toFixed(1)} hours`;
      return `${(value / 1440).toFixed(1)} days`;

    default:
      return String(value);
  }
}

/**
 * Computes comprehensive 4-pillar DORA metrics from SQLite
 */
function computeDoraMetrics(dbInstance = null, options = {}) {
  const db = dbInstance || getDatabase();
  const { timeframe = '30d', applicationId = null } = options;
  const window = parseTimeframe(timeframe);

  // Helper to query metrics for a specific time window
  function queryWindowStats(startIso, endIso) {
    let sql = `
      SELECT d.id, d.application_id, d.status, d.rollback_status,
             d.created_at, d.started_at, d.finished_at, d.duration_ms,
             COALESCE(ae.is_production, e.is_production, 0) as is_prod
      FROM deployments d
      LEFT JOIN application_environments ae ON d.environment_id = ae.id
      LEFT JOIN environments e ON d.environment_id = e.id
      WHERE (COALESCE(ae.is_production, e.is_production, 0) = 1)
        AND d.created_at >= ? AND d.created_at <= ?
    `;
    const params = [startIso, endIso];

    if (applicationId) {
      sql += ' AND d.application_id = ?';
      params.push(applicationId);
    }

    sql += ' ORDER BY d.created_at ASC';
    const prodRuns = db.prepare(sql).all(...params);

    const totalProd = prodRuns.length;
    const succeededRuns = prodRuns.filter(r => r.status === 'SUCCEEDED');
    const failedRuns = prodRuns.filter(r => 
      ['FAILED', 'ROLLBACK_FAILED'].includes(r.status) || r.rollback_status === 'SUCCESSFUL'
    );

    // 1. Deployment Frequency
    const dfValue = totalProd > 0 ? (succeededRuns.length / window.days) : 0;

    // 2. Lead Time for Changes (in hours)
    let totalLeadTimeHours = 0;
    let leadTimeCount = 0;
    const leadTimes = [];

    for (const run of succeededRuns) {
      let runHours = 0;
      if (run.duration_ms && run.duration_ms > 0) {
        runHours = run.duration_ms / 3600000;
      } else if (run.finished_at && run.created_at) {
        const diffMs = new Date(run.finished_at).getTime() - new Date(run.created_at).getTime();
        runHours = Math.max(0, diffMs / 3600000);
      } else {
        runHours = 0.25; // Default fallback: 15 mins
      }
      totalLeadTimeHours += runHours;
      leadTimes.push(runHours);
      leadTimeCount++;
    }

    const ltfcValue = leadTimeCount > 0 ? (totalLeadTimeHours / leadTimeCount) : 0;

    // 3. Change Failure Rate
    const cfrValue = totalProd > 0 ? ((failedRuns.length / totalProd) * 100) : 0;

    // 4. Mean Time to Recovery (in minutes)
    let totalRecoveryMinutes = 0;
    let recoveredIncidentCount = 0;

    for (const failRun of failedRuns) {
      const failTime = new Date(failRun.finished_at || failRun.created_at).getTime();

      // Find the subsequent successful production deployment for this application
      let nextSuccSql = `
        SELECT d.created_at, d.finished_at
        FROM deployments d
        LEFT JOIN application_environments ae ON d.environment_id = ae.id
        LEFT JOIN environments e ON d.environment_id = e.id
        WHERE d.application_id = ?
          AND (COALESCE(ae.is_production, e.is_production, 0) = 1)
          AND d.status = 'SUCCEEDED'
          AND d.created_at > ?
        ORDER BY d.created_at ASC LIMIT 1
      `;
      const nextSuccess = db.prepare(nextSuccSql).get(failRun.application_id, failRun.created_at);

      if (nextSuccess) {
        const restoreTime = new Date(nextSuccess.finished_at || nextSuccess.created_at).getTime();
        const diffMins = Math.max(1, (restoreTime - failTime) / 60000);
        totalRecoveryMinutes += diffMins;
        recoveredIncidentCount++;
      } else {
        // Ongoing incident: calculate duration until now
        const diffMins = Math.max(1, (Date.now() - failTime) / 60000);
        totalRecoveryMinutes += diffMins;
        recoveredIncidentCount++;
      }
    }

    const mttrValue = failedRuns.length === 0 ? 0 : (recoveredIncidentCount > 0 ? (totalRecoveryMinutes / recoveredIncidentCount) : 0);

    return {
      totalProd,
      succeededCount: succeededRuns.length,
      failedCount: failedRuns.length,
      df: dfValue,
      ltfc: ltfcValue,
      cfr: cfrValue,
      mttr: mttrValue,
      prodRuns,
    };
  }

  // Execute queries for current and prior windows
  const currentStats = queryWindowStats(window.currentStartIso, window.currentEndIso);
  const priorStats = queryWindowStats(window.priorStartIso, window.priorEndIso);

  // Compute percentage deltas: ((current - prior) / prior) * 100
  const computeDelta = (curr, prior, higherIsBetter = true) => {
    if (!prior || prior === 0) {
      if (!curr || curr === 0) return 0;
      return 100;
    }
    const rawDelta = ((curr - prior) / prior) * 100;
    const rounded = Math.round(rawDelta * 10) / 10;
    return rounded;
  };

  const dfDelta = computeDelta(currentStats.df, priorStats.df, true);
  const ltfcDelta = computeDelta(currentStats.ltfc, priorStats.ltfc, false);
  const cfrDelta = computeDelta(currentStats.cfr, priorStats.cfr, false);
  const mttrDelta = computeDelta(currentStats.mttr, priorStats.mttr, false);

  // Daily time-series bucket aggregation for SVG charts
  const bucketMap = new Map();
  const msInDay = 86400000;
  const numDays = Math.min(window.days, 90);

  for (let i = numDays - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * msInDay);
    const dateStr = d.toISOString().substring(0, 10);
    bucketMap.set(dateStr, {
      date: dateStr,
      displayDate: `${d.getMonth() + 1}/${d.getDate()}`,
      succeeded: 0,
      failed: 0,
      total: 0,
    });
  }

  for (const run of currentStats.prodRuns) {
    const dateStr = (run.created_at || '').substring(0, 10);
    if (bucketMap.has(dateStr)) {
      const b = bucketMap.get(dateStr);
      b.total++;
      if (run.status === 'SUCCEEDED') b.succeeded++;
      if (['FAILED', 'ROLLBACK_FAILED'].includes(run.status) || run.rollback_status === 'SUCCESSFUL') b.failed++;
    }
  }

  const dailyBuckets = Array.from(bucketMap.values());

  return {
    timeframe: window.timeframe,
    days: window.days,
    applicationId: applicationId || 'all',
    generatedAt: new Date().toISOString(),
    metrics: {
      deploymentFrequency: {
        key: 'DF',
        name: 'Deployment Frequency',
        value: Math.round(currentStats.df * 100) / 100,
        unit: 'deploys/day',
        headline: formatHeadlineMetric('DF', currentStats.df),
        tier: evaluateDoraTier('DF', currentStats.df),
        delta: dfDelta,
        deltaDirection: dfDelta >= 0 ? 'positive' : 'negative',
        isGoodDelta: dfDelta >= 0,
        totalReleases: currentStats.succeededCount,
      },
      leadTimeForChanges: {
        key: 'LTFC',
        name: 'Lead Time for Changes',
        value: Math.round(currentStats.ltfc * 10) / 10,
        unit: 'hours',
        headline: formatHeadlineMetric('LTFC', currentStats.ltfc),
        tier: evaluateDoraTier('LTFC', currentStats.ltfc),
        delta: ltfcDelta,
        deltaDirection: ltfcDelta <= 0 ? 'positive' : 'negative',
        isGoodDelta: ltfcDelta <= 0,
      },
      changeFailureRate: {
        key: 'CFR',
        name: 'Change Failure Rate',
        value: Math.round(currentStats.cfr * 10) / 10,
        unit: '%',
        headline: formatHeadlineMetric('CFR', currentStats.cfr),
        tier: evaluateDoraTier('CFR', currentStats.cfr),
        delta: cfrDelta,
        deltaDirection: cfrDelta <= 0 ? 'positive' : 'negative',
        isGoodDelta: cfrDelta <= 0,
        failedReleases: currentStats.failedCount,
        totalReleases: currentStats.totalProd,
      },
      meanTimeToRecovery: {
        key: 'MTTR',
        name: 'Mean Time to Recovery',
        value: Math.round(currentStats.mttr),
        unit: 'minutes',
        headline: formatHeadlineMetric('MTTR', currentStats.mttr),
        tier: evaluateDoraTier('MTTR', currentStats.mttr),
        delta: mttrDelta,
        deltaDirection: mttrDelta <= 0 ? 'positive' : 'negative',
        isGoodDelta: mttrDelta <= 0,
      },
    },
    dailyBuckets,
    summary: {
      totalProductionDeployments: currentStats.totalProd,
      succeededCount: currentStats.succeededCount,
      failedCount: currentStats.failedCount,
      priorPeriodTotal: priorStats.totalProd,
    },
  };
}

/**
 * Serializes DORA metrics into a standard CSV report
 */
function generateDoraCsv(doraData) {
  const m = doraData.metrics;
  const lines = [
    'Metric,Key,Value,Unit,Headline,DORA Tier,Period Delta %,Status Note',
    `Deployment Frequency,DF,${m.deploymentFrequency.value},${m.deploymentFrequency.unit},"${m.deploymentFrequency.headline}",${m.deploymentFrequency.tier},${m.deploymentFrequency.delta}%,"Frequency of production releases"`,
    `Lead Time for Changes,LTFC,${m.leadTimeForChanges.value},${m.leadTimeForChanges.unit},"${m.leadTimeForChanges.headline}",${m.leadTimeForChanges.tier},${m.leadTimeForChanges.delta}%,"Initiation to production verification"`,
    `Change Failure Rate,CFR,${m.changeFailureRate.value},${m.changeFailureRate.unit},"${m.changeFailureRate.headline}",${m.changeFailureRate.tier},${m.changeFailureRate.delta}%,"Production failures and rollbacks"`,
    `Mean Time to Recovery,MTTR,${m.meanTimeToRecovery.value},${m.meanTimeToRecovery.unit},"${m.meanTimeToRecovery.headline}",${m.meanTimeToRecovery.tier},${m.meanTimeToRecovery.delta}%,"Incident to successful service restore"`,
    '',
    'Date,Succeeded Releases,Failed Releases,Total Volume',
    ...doraData.dailyBuckets.map(b => `${b.date},${b.succeeded},${b.failed},${b.total}`),
  ];
  return lines.join('\n');
}

module.exports = {
  DORA_TIERS,
  evaluateDoraTier,
  parseTimeframe,
  formatHeadlineMetric,
  computeDoraMetrics,
  generateDoraCsv,
};

