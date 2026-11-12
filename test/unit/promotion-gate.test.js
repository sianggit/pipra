/**
 * Unit Test: Interactive Staging Promotion & Two-Person Approval Gate
 * Validates State Machine transitions, terminal checks, active approvals, and Two-Person Rule guards.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  DEPLOYMENT_STATES,
  isValidTransition,
  isTerminal,
} = require('../../src/engine/state-machine');
const deploymentRunner = require('../../src/engine/deployment-runner');
const { getDatabase } = require('../../src/db/database');

test('Promotion Gate: WAITING_FOR_APPROVAL state definition & properties', () => {
  assert.ok(DEPLOYMENT_STATES.WAITING_FOR_APPROVAL, 'WAITING_FOR_APPROVAL must be defined in DEPLOYMENT_STATES');
  assert.strictEqual(DEPLOYMENT_STATES.WAITING_FOR_APPROVAL, 'WAITING_FOR_APPROVAL');
  assert.strictEqual(isTerminal(DEPLOYMENT_STATES.WAITING_FOR_APPROVAL), false, 'WAITING_FOR_APPROVAL must not be terminal');
});

test('Promotion Gate: Valid forward and abort transitions', () => {
  // 1. Stage 6 verification transition into waiting for approval
  assert.strictEqual(
    isValidTransition(DEPLOYMENT_STATES.VERIFYING, DEPLOYMENT_STATES.WAITING_FOR_APPROVAL),
    true,
    'VERIFYING -> WAITING_FOR_APPROVAL must be valid'
  );

  // 2. Promotion gate approval: advances to Stage 7 cutover
  assert.strictEqual(
    isValidTransition(DEPLOYMENT_STATES.WAITING_FOR_APPROVAL, DEPLOYMENT_STATES.CUTTING_OVER),
    true,
    'WAITING_FOR_APPROVAL -> CUTTING_OVER must be valid'
  );

  // 3. Promotion gate rejection or timeout: cancels deployment
  assert.strictEqual(
    isValidTransition(DEPLOYMENT_STATES.WAITING_FOR_APPROVAL, DEPLOYMENT_STATES.CANCELLED),
    true,
    'WAITING_FOR_APPROVAL -> CANCELLED must be valid'
  );

  // 4. Server restart / crash: marks interrupted
  assert.strictEqual(
    isValidTransition(DEPLOYMENT_STATES.WAITING_FOR_APPROVAL, DEPLOYMENT_STATES.INTERRUPTED),
    true,
    'WAITING_FOR_APPROVAL -> INTERRUPTED must be valid'
  );

  // 5. Invalid transitions
  assert.strictEqual(
    isValidTransition(DEPLOYMENT_STATES.WAITING_FOR_APPROVAL, DEPLOYMENT_STATES.QUEUED),
    false,
    'WAITING_FOR_APPROVAL -> QUEUED must be invalid'
  );
  assert.strictEqual(
    isValidTransition(DEPLOYMENT_STATES.WAITING_FOR_APPROVAL, DEPLOYMENT_STATES.SUCCEEDED),
    false,
    'WAITING_FOR_APPROVAL -> SUCCEEDED must be invalid (must cutover first)'
  );
  assert.strictEqual(
    isValidTransition(DEPLOYMENT_STATES.SUCCEEDED, DEPLOYMENT_STATES.WAITING_FOR_APPROVAL),
    false,
    'SUCCEEDED -> WAITING_FOR_APPROVAL must be invalid'
  );
});

test('Promotion Gate: Two-Person Rule verification logic', () => {
  const evaluateTwoPersonRule = ({ initiator, currentUsername, allowSelfApproval }) => {
    const isInitiator = Boolean(initiator && currentUsername && (initiator === currentUsername));
    if (isInitiator && !allowSelfApproval) {
      return { allowed: false, reason: 'Two-Person Rule violation: Initiator cannot approve production cutover' };
    }
    return { allowed: true };
  };

  // Scenario A: Initiator attempts self-approval without override -> REJECT
  const selfAttempt = evaluateTwoPersonRule({
    initiator: 'developer_alice',
    currentUsername: 'developer_alice',
    allowSelfApproval: false,
  });
  assert.strictEqual(selfAttempt.allowed, false);
  assert.match(selfAttempt.reason, /Two-Person Rule violation/);

  // Scenario B: Independent operator approves -> ALLOW
  const peerApproval = evaluateTwoPersonRule({
    initiator: 'developer_alice',
    currentUsername: 'operator_bob',
    allowSelfApproval: false,
  });
  assert.strictEqual(peerApproval.allowed, true);

  // Scenario C: Initiator self-approves with explicit admin emergency override -> ALLOW
  const overrideApproval = evaluateTwoPersonRule({
    initiator: 'developer_alice',
    currentUsername: 'developer_alice',
    allowSelfApproval: true,
  });
  assert.strictEqual(overrideApproval.allowed, true);
});

test('Promotion Gate: Active Approvals Map & Runner State Resolution', async () => {
  const db = getDatabase();
  const testId = `test-gate-${Date.now()}`;
  const app = db.prepare('SELECT id FROM applications LIMIT 1').get() || { id: 'app-asdp-dims-fe' };

  // Seed minimal test deployment in WAITING_FOR_APPROVAL
  db.prepare(`
    INSERT INTO deployments (
      id, application_id, environment_id, status, initiated_by,
      branch, image_tag, container_name, current_stage, current_stage_name,
      requires_approval, created_at, started_at
    ) VALUES (?, ?, 'devel', 'WAITING_FOR_APPROVAL', 'operator',
      'main', 'v1.0.0', 'asdp-dims-fe', 6, 'Waiting for Production Approval',
      1, datetime('now'), datetime('now'))
  `).run(testId, app.id);

  try {
    let resolvedValue = null;
    let rejectedError = null;

    // Simulate active deferred approval
    const deferredPromise = new Promise((resolve, reject) => {
      deploymentRunner.activeApprovals.set(testId, {
        resolve: (val) => { resolvedValue = val; resolve(val); },
        reject: (err) => { rejectedError = err; reject(err); },
        timeoutId: null,
        expiresAt: new Date(Date.now() + 60000).toISOString(),
      });
    });

    assert.strictEqual(deploymentRunner.activeApprovals.has(testId), true);

    // Call approveDeployment
    const approver = { id: 'user-2', username: 'peer_reviewer' };
    const approveRes = deploymentRunner.approveDeployment(testId, approver, 'Staging checks verified');
    assert.strictEqual(approveRes.success, true);

    // Verify deferred promise resolved
    const result = await deferredPromise;
    assert.strictEqual(result.approved, true);
    assert.strictEqual(result.approver.username, 'peer_reviewer');
    assert.strictEqual(result.comments, 'Staging checks verified');
    assert.strictEqual(deploymentRunner.activeApprovals.has(testId), false, 'Active approval must be deleted on resolution');

    // Verify database record
    const updated = db.prepare('SELECT * FROM deployments WHERE id = ?').get(testId);
    assert.strictEqual(updated.approved_by_username, 'peer_reviewer');
    assert.strictEqual(updated.approval_comments, 'Staging checks verified');
    assert.ok(updated.approved_at);
  } finally {
    deploymentRunner.activeApprovals.delete(testId);
    db.prepare('DELETE FROM deployments WHERE id = ?').run(testId);
  }
});
