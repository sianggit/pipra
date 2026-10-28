/**
 * Unit Test: State Machine & Valid Transitions
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DEPLOYMENT_STATES,
  TERMINAL_STATES,
  isValidTransition,
  isTerminal,
  getStageMeta,
} = require('../../src/engine/state-machine');

test('State Machine: All required lifecycle states are defined', () => {
  const expected = [
    'QUEUED', 'PREPARING', 'RUNNING', 'VERIFYING',
    'CUTTING_OVER', 'ROLLING_BACK', 'SUCCEEDED', 'FAILED',
    'CANCELLED', 'INTERRUPTED', 'ROLLBACK_FAILED'
  ];

  for (const s of expected) {
    assert.ok(DEPLOYMENT_STATES[s], `Missing state ${s}`);
  }
});

test('State Machine: Terminal states cannot transition to running states', () => {
  const terminalList = [
    DEPLOYMENT_STATES.SUCCEEDED,
    DEPLOYMENT_STATES.FAILED,
    DEPLOYMENT_STATES.CANCELLED,
    DEPLOYMENT_STATES.INTERRUPTED,
    DEPLOYMENT_STATES.ROLLBACK_FAILED,
  ];

  for (const term of terminalList) {
    assert.strictEqual(isTerminal(term), true, `${term} should be terminal`);
    assert.strictEqual(isValidTransition(term, DEPLOYMENT_STATES.RUNNING), false);
    assert.strictEqual(isValidTransition(term, DEPLOYMENT_STATES.CUTTING_OVER), false);
  }
});

test('State Machine: Valid forward progression transitions', () => {
  assert.strictEqual(isValidTransition(DEPLOYMENT_STATES.QUEUED, DEPLOYMENT_STATES.PREPARING), true);
  assert.strictEqual(isValidTransition(DEPLOYMENT_STATES.PREPARING, DEPLOYMENT_STATES.RUNNING), true);
  assert.strictEqual(isValidTransition(DEPLOYMENT_STATES.RUNNING, DEPLOYMENT_STATES.VERIFYING), true);
  assert.strictEqual(isValidTransition(DEPLOYMENT_STATES.VERIFYING, DEPLOYMENT_STATES.CUTTING_OVER), true);
  assert.strictEqual(isValidTransition(DEPLOYMENT_STATES.CUTTING_OVER, DEPLOYMENT_STATES.SUCCEEDED), true);
  assert.strictEqual(isValidTransition(DEPLOYMENT_STATES.CUTTING_OVER, DEPLOYMENT_STATES.ROLLING_BACK), true);
  assert.strictEqual(isValidTransition(DEPLOYMENT_STATES.ROLLING_BACK, DEPLOYMENT_STATES.FAILED), true);
});

test('State Machine: Stage metadata contains all 10 stages', () => {
  for (let i = 1; i <= 10; i++) {
    const meta = getStageMeta(i);
    assert.ok(meta, `Stage ${i} metadata must exist`);
    assert.strictEqual(meta.number, i);
    assert.ok(meta.name.length > 0);
  }
});
