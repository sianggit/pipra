/**
 * Integration Test: Interactive Promotion Gate & Two-Person Release Verification Flow
 * End-to-end testing of Stage 6 -> Stage 7 gate, Two-Person Rule enforcement,
 * peer approval, self-approval blockage, rejection, and audit logging.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { getDatabase } = require('../../src/db/database');
const deploymentRunner = require('../../src/engine/deployment-runner');
const { handleDeploymentRoutes } = require('../../src/routes/deployment-routes');

function createMockReqRes({ method, pathname, query = {}, headers = {}, body = null }) {
  const req = {
    method,
    headers: { ...headers, host: 'localhost:4200' },
    url: pathname,
    socket: { remoteAddress: '127.0.0.1' },
    rawBody: typeof body === 'string' ? body : JSON.stringify(body || {}),
  };

  let statusCode = 200;
  let responseHeaders = {};
  let responseBody = '';

  const res = {
    writeHead(code, headers = {}) {
      statusCode = code;
      responseHeaders = { ...responseHeaders, ...headers };
    },
    setHeader(k, v) {
      responseHeaders[k] = v;
    },
    end(chunk) {
      if (chunk) responseBody += chunk;
    },
    getStatusCode: () => statusCode,
    getBody: () => {
      try {
        return JSON.parse(responseBody);
      } catch {
        return responseBody;
      }
    },
  };

  return { req, res };
}

test('Integration: Two-Person Rule blocks self-approval and permits peer approval', async () => {
  const db = getDatabase();
  const testDepId = `test-dep-promote-${Date.now()}`;
  let app = db.prepare('SELECT id, name FROM applications LIMIT 1').get();
  if (!app) {
    app = { id: 'app-test-promo', name: 'test-promo-app' };
    db.prepare(`
      INSERT OR IGNORE INTO applications (
        id, name, display_name, repo_url, app_dir, default_branch,
        dockerfile, image_name, host_port, staging_port, container_port,
        healthcheck_path, created_at, updated_at
      ) VALUES (?, ?, 'Promo App', '/tmp/repo', '/tmp/app', 'main', 'Dockerfile', 'img:latest', 8080, 8081, 3000, '/', datetime('now'), datetime('now'))
    `).run(app.id, app.name);
  }

  // Seed deployment in WAITING_FOR_APPROVAL
  db.prepare(`
    INSERT INTO deployments (
      id, application_id, environment_id, status, initiated_by,
      branch, image_tag, container_name, current_stage, current_stage_name,
      requires_approval, created_at, started_at
    ) VALUES (?, ?, 'devel', 'WAITING_FOR_APPROVAL', 'operator_alice',
      'main', 'v2.1.0', ?, 6, 'Waiting for Production Approval',
      1, datetime('now'), datetime('now'))
  `).run(testDepId, app.id, app.name);

  // Register in activeApprovals
  let promiseResolved = false;
  let resolvedData = null;
  deploymentRunner.activeApprovals.set(testDepId, {
    resolve: (data) => { promiseResolved = true; resolvedData = data; },
    reject: () => {},
    timeoutId: null,
    expiresAt: new Date(Date.now() + 1800000).toISOString(),
  });

  try {
    // 1. Viewer attempts to approve -> 403 Forbidden
    const viewerUser = { id: 'u-viewer', username: 'guest_viewer', role: 'viewer' };
    const { req: vReq, res: vRes } = createMockReqRes({
      method: 'POST',
      pathname: `/api/deployments/${testDepId}/approve`,
      body: { comments: 'Looks good' },
    });
    const handledViewer = handleDeploymentRoutes(vReq, vRes, `/api/deployments/${testDepId}/approve`, {}, { comments: 'Looks good' }, viewerUser);
    assert.strictEqual(handledViewer, true);
    assert.strictEqual(vRes.getStatusCode(), 403);
    assert.match(vRes.getBody().error, /Operator or Admin permissions required/);

    // 2. Initiator attempts self-approval -> 403 Forbidden (Two-Person Rule violation)
    const initiatorUser = { id: 'u-alice', username: 'operator_alice', role: 'operator' };
    const { req: sReq, res: sRes } = createMockReqRes({
      method: 'POST',
      pathname: `/api/deployments/${testDepId}/approve`,
      body: { comments: 'Self approval attempt' },
    });
    const handledSelf = handleDeploymentRoutes(sReq, sRes, `/api/deployments/${testDepId}/approve`, {}, { comments: 'Self approval attempt' }, initiatorUser);
    assert.strictEqual(handledSelf, true);
    assert.strictEqual(sRes.getStatusCode(), 403);
    assert.match(sRes.getBody().error, /Two-Person Rule violation/);
    assert.strictEqual(promiseResolved, false, 'Deferred cutover must NOT resolve on self-approval');

    // 3. Independent peer operator approves -> 200 OK
    const peerUser = { id: 'u-bob', username: 'operator_bob', role: 'operator' };
    const { req: pReq, res: pRes } = createMockReqRes({
      method: 'POST',
      pathname: `/api/deployments/${testDepId}/approve`,
      body: { comments: 'Staging sanity checks verified; authorized for production cutover.' },
    });
    const handledPeer = handleDeploymentRoutes(
      pReq,
      pRes,
      `/api/deployments/${testDepId}/approve`,
      {},
      { comments: 'Staging sanity checks verified; authorized for production cutover.' },
      peerUser
    );
    assert.strictEqual(handledPeer, true);
    assert.strictEqual(pRes.getStatusCode(), 200);
    assert.strictEqual(pRes.getBody().success, true);
    assert.strictEqual(promiseResolved, true, 'Deferred cutover must resolve on valid peer approval');
    assert.strictEqual(resolvedData.approver.username, 'operator_bob');

    // 4. Verify DB records and Provenance
    const dbRecord = db.prepare('SELECT * FROM deployments WHERE id = ?').get(testDepId);
    assert.strictEqual(dbRecord.approved_by_username, 'operator_bob');
    assert.strictEqual(dbRecord.approval_comments, 'Staging sanity checks verified; authorized for production cutover.');
    assert.ok(dbRecord.approved_at);

    // 5. Verify Audit Log entry
    const auditRecord = db.prepare(`
      SELECT * FROM audit_logs 
      WHERE resource_id = ? AND action = 'DEPLOYMENT_APPROVED'
      ORDER BY id DESC LIMIT 1
    `).get(testDepId);
    assert.ok(auditRecord, 'Audit record for DEPLOYMENT_APPROVED must exist');
    assert.strictEqual(auditRecord.username, 'operator_bob');
    assert.match(auditRecord.details, /Approved production cutover/);

    // 6. Conflict Guard: Attempting to re-approve after approval -> 409 Conflict
    const { req: reReq, res: reRes } = createMockReqRes({
      method: 'POST',
      pathname: `/api/deployments/${testDepId}/approve`,
      body: {},
    });
    // In our runner, after approval the status advances to CUTTING_OVER
    db.prepare('UPDATE deployments SET status = ? WHERE id = ?').run('CUTTING_OVER', testDepId);
    const handledRe = handleDeploymentRoutes(reReq, reRes, `/api/deployments/${testDepId}/approve`, {}, {}, peerUser);
    assert.strictEqual(handledRe, true);
    assert.strictEqual(reRes.getStatusCode(), 409);
    assert.match(reRes.getBody().error, /Deployment is not awaiting approval/);

  } finally {
    deploymentRunner.activeApprovals.delete(testDepId);
    db.prepare('DELETE FROM deployments WHERE id = ?').run(testDepId);
    db.prepare('DELETE FROM audit_logs WHERE resource_id = ?').run(testDepId);
  }
});

test('Integration: Operator can reject promotion gate to abort deployment safely', async () => {
  const db = getDatabase();
  const testDepId = `test-dep-reject-${Date.now()}`;
  let app = db.prepare('SELECT id, name FROM applications LIMIT 1').get();
  if (!app) {
    app = { id: 'app-test-promo', name: 'test-promo-app' };
    db.prepare(`
      INSERT OR IGNORE INTO applications (
        id, name, display_name, repo_url, app_dir, default_branch,
        dockerfile, image_name, host_port, staging_port, container_port,
        healthcheck_path, created_at, updated_at
      ) VALUES (?, ?, 'Promo App', '/tmp/repo', '/tmp/app', 'main', 'Dockerfile', 'img:latest', 8080, 8081, 3000, '/', datetime('now'), datetime('now'))
    `).run(app.id, app.name);
  }

  // Seed deployment in WAITING_FOR_APPROVAL
  db.prepare(`
    INSERT INTO deployments (
      id, application_id, environment_id, status, initiated_by,
      branch, image_tag, container_name, current_stage, current_stage_name,
      requires_approval, created_at, started_at
    ) VALUES (?, ?, 'devel', 'WAITING_FOR_APPROVAL', 'operator_alice',
      'main', 'v2.1.0', ?, 6, 'Waiting for Production Approval',
      1, datetime('now'), datetime('now'))
  `).run(testDepId, app.id, app.name);

  let promiseRejected = false;
  let rejectionReason = null;
  deploymentRunner.activeApprovals.set(testDepId, {
    resolve: () => {},
    reject: (err) => { promiseRejected = true; rejectionReason = err.message; },
    timeoutId: null,
    expiresAt: new Date(Date.now() + 1800000).toISOString(),
  });

  try {
    const operatorUser = { id: 'u-bob', username: 'operator_bob', role: 'operator' };
    const { req, res } = createMockReqRes({
      method: 'POST',
      pathname: `/api/deployments/${testDepId}/reject`,
      body: { reason: 'Critical UI regression in checkout form on staging container' },
    });

    const handled = handleDeploymentRoutes(
      req,
      res,
      `/api/deployments/${testDepId}/reject`,
      {},
      { reason: 'Critical UI regression in checkout form on staging container' },
      operatorUser
    );

    assert.strictEqual(handled, true);

    // Wait a tick for async promise resolution
    await new Promise(r => setTimeout(r, 50));

    assert.strictEqual(res.getStatusCode(), 200);
    assert.strictEqual(res.getBody().success, true);
    assert.strictEqual(promiseRejected, true, 'Deferred execution promise must reject on rejection');
    assert.match(rejectionReason, /Critical UI regression/);

    // Verify Audit Log entry
    const auditRecord = db.prepare(`
      SELECT * FROM audit_logs 
      WHERE resource_id = ? AND action = 'DEPLOYMENT_REJECTED'
      ORDER BY id DESC LIMIT 1
    `).get(testDepId);
    assert.ok(auditRecord, 'Audit record for DEPLOYMENT_REJECTED must exist');
    assert.strictEqual(auditRecord.username, 'operator_bob');
    assert.match(auditRecord.details, /Critical UI regression/);

  } finally {
    deploymentRunner.activeApprovals.delete(testDepId);
    db.prepare('DELETE FROM deployments WHERE id = ?').run(testDepId);
    db.prepare('DELETE FROM audit_logs WHERE resource_id = ?').run(testDepId);
  }
});

