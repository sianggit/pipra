/**
 * Integration Test: Concurrency Locks & Conflict Rejection
 */

const test = require('node:test');
const assert = require('node:assert/strict');

test('Integration: Prevents conflicting concurrent deployments to the same target', async (t) => {
  const host = 'http://localhost:4200';

  // Check if live server is reachable
  try {
    await fetch(`${host}/api/agents`, { signal: AbortSignal.timeout(1000) });
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

  // 2. Trigger first deployment
  const deploy1Res = await fetch(`${host}/api/deployments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${loginData.token}`,
    },
    body: JSON.stringify({
      application_id: 'asdp-dims-fe',
      environment_id: 'staging',
      branch: 'devel',
      tag: 'tag-conc-1',
      confirm_production: false,
    }),
  });
  assert.strictEqual(deploy1Res.status, 201);
  const { deploymentId: id1 } = await deploy1Res.json();

  // 3. Immediately attempt second deployment to identical target (asdp-dims-fe on staging)
  const deploy2Res = await fetch(`${host}/api/deployments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${loginData.token}`,
    },
    body: JSON.stringify({
      application_id: 'asdp-dims-fe',
      environment_id: 'staging',
      branch: 'devel',
      tag: 'tag-conc-2',
      confirm_production: false,
    }),
  });

  // Second deployment must be rejected with 409 Conflict
  assert.strictEqual(deploy2Res.status, 409);
  const conflictData = await deploy2Res.json();
  assert.ok(conflictData.error.includes('already running'));

  // Cancel first deployment to release target lock cleanly
  await fetch(`${host}/api/deployments/${id1}/cancel`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${loginData.token}` },
  });
});
