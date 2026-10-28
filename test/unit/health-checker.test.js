/**
 * Unit Test: Health Verification & Status Code Policies
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { ACCEPTED_STATUSES, runHealthCheckLoop } = require('../../src/engine/health-checker');

test('Health Checker: Exactly matches required HTTP acceptable statuses', () => {
  const expected = [200, 301, 302, 304, 307, 308];
  for (const s of expected) {
    assert.strictEqual(ACCEPTED_STATUSES.has(s), true, `HTTP ${s} must be accepted`);
  }

  // Reject standard failure codes
  assert.strictEqual(ACCEPTED_STATUSES.has(400), false);
  assert.strictEqual(ACCEPTED_STATUSES.has(404), false);
  assert.strictEqual(ACCEPTED_STATUSES.has(500), false);
  assert.strictEqual(ACCEPTED_STATUSES.has(502), false);
  assert.strictEqual(ACCEPTED_STATUSES.has(0), false);
});

test('Health Checker: Retry loop succeeds when container warms up', async () => {
  let attemptsCount = 0;
  const result = await runHealthCheckLoop({
    url: 'http://127.0.0.1:4001/',
    maxRetries: 5,
    intervalSec: 0,
    isSimulated: true,
    simulateFailure: false,
    onAttempt: () => { attemptsCount++; },
  });

  assert.strictEqual(result.passed, true);
  assert.ok(attemptsCount >= 2, 'Should attempt at least twice during warmup');
});

test('Health Checker: Retry loop fails when simulateFailure is active', async () => {
  const result = await runHealthCheckLoop({
    url: 'http://127.0.0.1:4001/',
    maxRetries: 3,
    intervalSec: 0,
    isSimulated: true,
    simulateFailure: true,
  });

  assert.strictEqual(result.passed, false);
  assert.strictEqual(result.attempts, 3);
});
