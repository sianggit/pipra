/**
 * Integration Test: Production Verification Failure & Automated Rollback
 */

const test = require('node:test');
const assert = require('node:assert/strict');

test('Integration: Failed production verification executes automatic rollback', async (t) => {
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

  // 2. Trigger deployment with simulated failure
  const tag = `test-rollback-${Date.now()}`;
  const deployRes = await fetch(`${host}/api/deployments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${loginData.token}`,
    },
    body: JSON.stringify({
      application_id: 'asdp-dims-fe',
      environment_id: 'production',
      branch: 'prod',
      tag,
      confirm_production: true,
      simulate_prod_failure: true,
    }),
  });

  assert.strictEqual(deployRes.status, 201);
  const { deploymentId } = await deployRes.json();

  // 3. Poll until terminal state
  let status = 'QUEUED';
  let detail = null;
  const startTime = Date.now();

  while (!['SUCCEEDED', 'FAILED', 'ROLLBACK_FAILED', 'CANCELLED'].includes(status)) {
    if (Date.now() - startTime > 30000) {
      throw new Error('Test timed out waiting for rollback to complete');
    }
    await new Promise(r => setTimeout(r, 800));
    const r = await fetch(`${host}/api/deployments/${deploymentId}`);
    detail = await r.json();
    status = detail.status;
  }

  assert.strictEqual(status, 'FAILED');
  assert.strictEqual(detail.rollback_status, 'SUCCESSFUL');
  assert.ok(detail.error_message.includes('Rollback executed successfully'));

  // Stage 8 failed, Stage 9 succeeded
  const stage8 = detail.stages.find(s => s.stage_number === 8);
  const stage9 = detail.stages.find(s => s.stage_number === 9);
  assert.strictEqual(stage8.status, 'FAILED');
  assert.strictEqual(stage9.status, 'SUCCEEDED');
});
