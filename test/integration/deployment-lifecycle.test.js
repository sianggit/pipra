/**
 * Integration Test: End-to-End Deployment Lifecycle
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { getDatabase } = require('../../src/db/database');

test('Integration: Full 10-stage deployment workflow succeeds', async (t) => {
  const host = 'http://localhost:4200';

  // Check if live Pipra server is reachable
  try {
    const probe = await fetch(`${host}/api/healthz`, { signal: AbortSignal.timeout(1000) });
    if (!probe.ok) {
      t.skip(`Integration test requires running Pipra server at ${host}. Start server with 'npm start' to run full E2E suite.`);
      return;
    }
  } catch (err) {
    t.skip(`Integration test requires running Pipra server at ${host}. Start server with 'npm start' to run full E2E suite.`);
    return;
  }

  // 1. Authenticate
  const loginRes = await fetch(`${host}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'operator', password: 'pipra-ops-2026' }),
  });
  const loginData = await loginRes.json();
  assert.strictEqual(loginRes.status, 200);

  // 2. Trigger deployment
  const tag = `test-v1-${Date.now()}`;
  const deployRes = await fetch(`${host}/api/deployments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${loginData.token}`,
    },
    body: JSON.stringify({
      application_id: 'asdp-dims-fe',
      environment_id: 'devel',
      branch: 'devel',
      tag,
      confirm_production: false,
    }),
  });

  assert.strictEqual(deployRes.status, 201);
  const { deploymentId } = await deployRes.json();
  assert.ok(deploymentId);

  // 3. Poll until terminal state
  let status = 'QUEUED';
  let detail = null;
  const startTime = Date.now();

  while (!['SUCCEEDED', 'FAILED', 'ROLLBACK_FAILED', 'CANCELLED'].includes(status)) {
    if (Date.now() - startTime > 25000) {
      throw new Error('Test timed out waiting for deployment to complete');
    }
    await new Promise(r => setTimeout(r, 800));
    const r = await fetch(`${host}/api/deployments/${deploymentId}`);
    detail = await r.json();
    status = detail.status;
  }

  assert.strictEqual(status, 'SUCCEEDED');
  assert.strictEqual(detail.stages.length, 10);

  // Verify DB record
  const db = getDatabase();
  const stages = db.prepare('SELECT * FROM deployment_stages WHERE deployment_id = ? ORDER BY stage_number ASC').all(deploymentId);
  assert.strictEqual(stages[0].status, 'SUCCEEDED'); // Stage 1
  assert.strictEqual(stages[1].status, 'SUCCEEDED'); // Stage 2
  assert.strictEqual(stages[3].status, 'SUCCEEDED'); // Stage 4
  assert.strictEqual(stages[4].status, 'SUCCEEDED'); // Stage 5
  assert.strictEqual(stages[5].status, 'SUCCEEDED'); // Stage 6
  assert.strictEqual(stages[6].status, 'SUCCEEDED'); // Stage 7
  assert.strictEqual(stages[7].status, 'SUCCEEDED'); // Stage 8
  assert.strictEqual(stages[8].status, 'SKIPPED');   // Stage 9 (Skipped on successful cutover)
  assert.strictEqual(stages[9].status, 'SUCCEEDED'); // Stage 10
});
