/**
 * Unit Test: DORA Metrics & Engineering Reliability Calculations
 * Validates Tier classifications, timeframe boundaries, formula calculations, and CSV serialization.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DORA_TIERS,
  evaluateDoraTier,
  parseTimeframe,
  formatHeadlineMetric,
  computeDoraMetrics,
  generateDoraCsv,
} = require('../../src/engine/dora-analytics');
const { getDatabase } = require('../../src/db/database');

test('DORA Analytics: Tier classification rules', () => {
  // Deployment Frequency (deploys per day)
  assert.strictEqual(evaluateDoraTier('DF', 3.0), DORA_TIERS.ELITE);       // >= 1/day
  assert.strictEqual(evaluateDoraTier('DF', 1.0), DORA_TIERS.ELITE);
  assert.strictEqual(evaluateDoraTier('DF', 0.5), DORA_TIERS.HIGH);        // >= 1/week (~0.14)
  assert.strictEqual(evaluateDoraTier('DF', 0.05), DORA_TIERS.MEDIUM);     // >= 1/month (~0.033)
  assert.strictEqual(evaluateDoraTier('DF', 0.01), DORA_TIERS.LOW);        // < 1/month

  // Lead Time for Changes (hours)
  assert.strictEqual(evaluateDoraTier('LTFC', 2.5), DORA_TIERS.ELITE);     // <= 24 hours
  assert.strictEqual(evaluateDoraTier('LTFC', 24), DORA_TIERS.ELITE);
  assert.strictEqual(evaluateDoraTier('LTFC', 48), DORA_TIERS.HIGH);       // <= 168 hours (1 week)
  assert.strictEqual(evaluateDoraTier('LTFC', 300), DORA_TIERS.MEDIUM);    // <= 720 hours (1 month)
  assert.strictEqual(evaluateDoraTier('LTFC', 800), DORA_TIERS.LOW);       // > 720 hours

  // Change Failure Rate (%)
  assert.strictEqual(evaluateDoraTier('CFR', 0.0), DORA_TIERS.ELITE);      // 0 - 15%
  assert.strictEqual(evaluateDoraTier('CFR', 12.5), DORA_TIERS.ELITE);
  assert.strictEqual(evaluateDoraTier('CFR', 20.0), DORA_TIERS.HIGH);      // 16 - 30%
  assert.strictEqual(evaluateDoraTier('CFR', 35.0), DORA_TIERS.MEDIUM);    // 31 - 45%
  assert.strictEqual(evaluateDoraTier('CFR', 55.0), DORA_TIERS.LOW);       // > 45%

  // Mean Time to Recovery (minutes)
  assert.strictEqual(evaluateDoraTier('MTTR', 0), DORA_TIERS.ELITE);       // 0m (Flawless)
  assert.strictEqual(evaluateDoraTier('MTTR', 45), DORA_TIERS.ELITE);      // <= 60 mins
  assert.strictEqual(evaluateDoraTier('MTTR', 360), DORA_TIERS.HIGH);      // <= 1440 mins (1 day)
  assert.strictEqual(evaluateDoraTier('MTTR', 5000), DORA_TIERS.MEDIUM);   // <= 10080 mins (1 week)
  assert.strictEqual(evaluateDoraTier('MTTR', 20000), DORA_TIERS.LOW);     // > 1 week
});

test('DORA Analytics: Timeframe parsing and period boundaries', () => {
  const tf7 = parseTimeframe('7d');
  assert.strictEqual(tf7.days, 7);
  assert.ok(tf7.currentStartIso < tf7.currentEndIso);
  assert.ok(tf7.priorStartIso < tf7.priorEndIso);

  const tf30 = parseTimeframe('30d');
  assert.strictEqual(tf30.days, 30);

  const tf90 = parseTimeframe('90d');
  assert.strictEqual(tf90.days, 90);
});

test('DORA Analytics: Headline metric formatters', () => {
  assert.strictEqual(formatHeadlineMetric('DF', 2.45), '2.5 / day');
  assert.strictEqual(formatHeadlineMetric('DF', 0.4), '2.8 / week');
  assert.strictEqual(formatHeadlineMetric('LTFC', 0.5), '30 mins');
  assert.strictEqual(formatHeadlineMetric('LTFC', 12.4), '12.4 hours');
  assert.strictEqual(formatHeadlineMetric('CFR', 15.2), '15.2%');
  assert.strictEqual(formatHeadlineMetric('MTTR', 0), '0m (Flawless)');
  assert.strictEqual(formatHeadlineMetric('MTTR', 35), '35 mins');
});

test('DORA Analytics: Metric computation with seeded production dataset', () => {
  const db = getDatabase();
  const testAppId = `test-dora-app-${Date.now()}`;
  const testEnvId = `test-dora-env-prod-${Date.now()}`;
  const now = Date.now();
  const hourMs = 3600000;

  // 1. Seed application and production environment
  db.prepare(`
    INSERT INTO applications (id, name, display_name, repo_url, app_dir, default_branch, created_at, updated_at)
    VALUES (?, ?, 'DORA Test App', 'https://github.com/asyst/dora.git', '/tmp/dora', 'main', datetime('now'), datetime('now'))
  `).run(testAppId, testAppId);

  db.prepare(`
    INSERT INTO application_environments (
      id, application_id, name, display_name, is_production, host, app_dir, env_file,
      host_port, staging_port, container_port, created_at, updated_at
    ) VALUES (?, ?, 'production', 'Production', 1, '127.0.0.1', '/tmp/dora', '.env', 8000, 8001, 3000, datetime('now'), datetime('now'))
  `).run(testEnvId, testAppId);

  // Companion shadow insert for environments table compatibility
  db.prepare(`
    INSERT OR IGNORE INTO environments (id, name, display_name, is_production, host, ssh_user, ssh_port, auth_type)
    VALUES (?, 'production', 'Production', 1, '127.0.0.1', 'devel', 22, 'NONE')
  `).run(testEnvId);

  const seededIds = [];

  try {
    // 2. Seed 4 successful production releases (varying lead times)
    const successOffsets = [
      { startOffset: 24 * hourMs, durMs: 30 * 60000 },  // 30m lead time
      { startOffset: 48 * hourMs, durMs: 60 * 60000 },  // 1h lead time
      { startOffset: 72 * hourMs, durMs: 120 * 60000 }, // 2h lead time
      { startOffset: 96 * hourMs, durMs: 180 * 60000 }, // 3h lead time
    ];

    for (let i = 0; i < successOffsets.length; i++) {
      const depId = `dora-succ-${i}-${Date.now()}`;
      seededIds.push(depId);
      const createdAt = new Date(now - successOffsets[i].startOffset).toISOString();
      const finishedAt = new Date(now - successOffsets[i].startOffset + successOffsets[i].durMs).toISOString();

      db.prepare(`
        INSERT INTO deployments (
          id, application_id, environment_id, status, initiated_by,
          branch, image_tag, container_name, current_stage, current_stage_name,
          duration_ms, created_at, started_at, finished_at
        ) VALUES (?, ?, ?, 'SUCCEEDED', 'operator', 'main', 'v1.0.0', 'dora-app', 10, 'Final Report', ?, ?, ?, ?)
      `).run(depId, testAppId, testEnvId, successOffsets[i].durMs, createdAt, createdAt, finishedAt);
    }

    // 3. Seed 1 failed release followed by a recovery success 40 mins later
    const failId = `dora-fail-${Date.now()}`;
    const recoverId = `dora-recover-${Date.now()}`;
    seededIds.push(failId, recoverId);

    const failTime = new Date(now - 12 * hourMs).toISOString();
    const recoverTime = new Date(now - 12 * hourMs + 40 * 60000).toISOString();

    db.prepare(`
      INSERT INTO deployments (
        id, application_id, environment_id, status, initiated_by,
        branch, image_tag, container_name, current_stage, current_stage_name,
        created_at, started_at, finished_at
      ) VALUES (?, ?, ?, 'FAILED', 'operator', 'main', 'v1.0.1-bad', 'dora-app', 8, 'Production Verification', ?, ?, ?)
    `).run(failId, testAppId, testEnvId, failTime, failTime, failTime);

    db.prepare(`
      INSERT INTO deployments (
        id, application_id, environment_id, status, initiated_by,
        branch, image_tag, container_name, current_stage, current_stage_name,
        duration_ms, created_at, started_at, finished_at
      ) VALUES (?, ?, ?, 'SUCCEEDED', 'operator', 'main', 'v1.0.2-fix', 'dora-app', 10, 'Final Report', 900000, ?, ?, ?)
    `).run(recoverId, testAppId, testEnvId, recoverTime, recoverTime, recoverTime);

    // 4. Compute metrics for 30d timeframe scoped to testAppId
    const result = computeDoraMetrics(db, { timeframe: '30d', applicationId: testAppId });

    assert.ok(result);
    assert.strictEqual(result.applicationId, testAppId);
    assert.strictEqual(result.summary.totalProductionDeployments, 6);
    assert.strictEqual(result.summary.succeededCount, 5);
    assert.strictEqual(result.summary.failedCount, 1);

    // Deployment Frequency: 5 / 30 = ~0.17/day (HIGH tier)
    assert.strictEqual(result.metrics.deploymentFrequency.tier, DORA_TIERS.HIGH);
    assert.ok(result.metrics.deploymentFrequency.value > 0);

    // Lead Time for Changes: avg of (30m, 60m, 120m, 180m, 15m) = ~1.35h (ELITE tier)
    assert.strictEqual(result.metrics.leadTimeForChanges.tier, DORA_TIERS.ELITE);

    // Change Failure Rate: 1 / 6 = 16.7% (HIGH tier)
    assert.strictEqual(result.metrics.changeFailureRate.tier, DORA_TIERS.HIGH);
    assert.strictEqual(Math.round(result.metrics.changeFailureRate.value), 17);

    // Mean Time to Recovery: ~40 mins (ELITE tier: < 1 hour)
    assert.strictEqual(result.metrics.meanTimeToRecovery.tier, DORA_TIERS.ELITE);
    assert.strictEqual(Math.round(result.metrics.meanTimeToRecovery.value), 40);

    // CSV Generator validation
    const csv = generateDoraCsv(result);
    assert.ok(csv.includes('Deployment Frequency,DF'));
    assert.ok(csv.includes('Lead Time for Changes,LTFC'));
    assert.ok(csv.includes('Change Failure Rate,CFR'));
    assert.ok(csv.includes('Mean Time to Recovery,MTTR'));

  } finally {
    for (const id of seededIds) {
      db.prepare('DELETE FROM deployments WHERE id = ?').run(id);
    }
    db.prepare('DELETE FROM application_environments WHERE id = ?').run(testEnvId);
    db.prepare('DELETE FROM environments WHERE id = ?').run(testEnvId);
    db.prepare('DELETE FROM applications WHERE id = ?').run(testAppId);
  }
});

