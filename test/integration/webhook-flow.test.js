/**
 * Integration Test: Webhook & GitOps Ingestion Flow
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { getDatabase } = require('../../src/db/database');
const { computeHmacSha256 } = require('../../src/utils/crypto-vault');
const authService = require('../../src/auth/auth-service');
const { handleWebhookRoutes } = require('../../src/routes/webhook-routes');

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

test('Webhook Flow: Full lifecycle from ping to HMAC push and audit log', async () => {
  const db = getDatabase();

  // 1. Seed test application and environment
  const appId = `test-wh-app-${Date.now()}`;
  const envId = `test-wh-env-${Date.now()}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO applications (
      id, name, display_name, repo_url, app_dir, default_branch,
      permitted_branches, webhook_enabled, auto_deploy_branch, auto_deploy_environment_id,
      created_at, updated_at
    ) VALUES (?, ?, 'Webhook Test App', 'https://github.com/asyst/webhook-test.git', '/tmp/wh', 'devel',
      '["devel","main"]', 1, 'devel', ?, ?, ?)
  `).run(appId, appId, envId, now, now);

  db.prepare(`
    INSERT INTO application_environments (
      id, application_id, name, display_name, is_production, host,
      app_dir, env_file, host_port, staging_port, container_port, created_at, updated_at
    ) VALUES (?, ?, 'devel', 'Development', 0, '127.0.0.1', '/tmp/wh', '.env', 5000, 5001, 3000, ?, ?)
  `).run(envId, appId, now, now);

  db.prepare(`
    INSERT OR IGNORE INTO environments (id, name, display_name, is_production, host, ssh_user, ssh_port, auth_type)
    VALUES (?, ?, 'Development', 0, '127.0.0.1', 'devel', 22, 'NONE')
  `).run(envId, envId);

  // Authenticate admin
  const adminLogin = authService.authenticate('admin', 'pipra-admin-2026');
  assert.ok(adminLogin.success);
  const adminUser = adminLogin.user;

  try {
    // 2. Generate Webhook Secret via Admin Endpoint
    const { req: rotReq, res: rotRes } = createMockReqRes({
      method: 'POST',
      pathname: `/api/applications/${appId}/webhooks/regenerate-secret`,
    });
    const handledRot = handleWebhookRoutes(rotReq, rotRes, `/api/applications/${appId}/webhooks/regenerate-secret`, {}, {}, adminUser, '');
    assert.strictEqual(handledRot, true);
    assert.strictEqual(rotRes.getStatusCode(), 200);

    const rotData = rotRes.getBody();
    assert.strictEqual(rotData.success, true);
    assert.ok(rotData.secret);
    const webhookSecret = rotData.secret;

    // 3. GitHub Ping Handshake
    const { req: pingReq, res: pingRes } = createMockReqRes({
      method: 'POST',
      pathname: '/api/webhooks/github',
      query: { app: appId },
      headers: {
        'x-github-event': 'ping',
        'x-github-delivery': 'delivery-ping-123',
      },
      body: { zen: 'Pipra release engineering' },
    });
    const handledPing = handleWebhookRoutes(pingReq, pingRes, '/api/webhooks/github', { app: appId }, { zen: 'Pipra release engineering' }, null, pingReq.rawBody);
    assert.strictEqual(handledPing, true);
    assert.strictEqual(pingRes.getStatusCode(), 200);
    assert.strictEqual(pingRes.getBody().status, 'pong');

    // 4. Reject Tampered Signature
    const payload = JSON.stringify({
      ref: 'refs/heads/devel',
      after: 'abcdef1234567890',
      head_commit: {
        id: 'abcdef1234567890',
        message: 'feat: add gitops listener',
        author: { name: 'Anggit' },
      },
    });

    const { req: badReq, res: badRes } = createMockReqRes({
      method: 'POST',
      pathname: '/api/webhooks/github',
      query: { app: appId },
      headers: {
        'x-github-event': 'push',
        'x-github-delivery': 'deliv-bad-sig',
        'x-hub-signature-256': 'sha256=0000000000000000000000000000000000000000000000000000000000000000',
      },
      body: payload,
    });
    const handledBad = handleWebhookRoutes(badReq, badRes, '/api/webhooks/github', { app: appId }, JSON.parse(payload), null, payload);
    assert.strictEqual(handledBad, true);
    assert.strictEqual(badRes.getStatusCode(), 401);

    // 5. Accept Valid HMAC Signature & Queue Deployment
    const validHex = computeHmacSha256(payload, webhookSecret);
    const { req: goodReq, res: goodRes } = createMockReqRes({
      method: 'POST',
      pathname: '/api/webhooks/github',
      query: { app: appId },
      headers: {
        'x-github-event': 'push',
        'x-github-delivery': 'deliv-good-sig',
        'x-hub-signature-256': `sha256=${validHex}`,
      },
      body: payload,
    });
    const handledGood = handleWebhookRoutes(goodReq, goodRes, '/api/webhooks/github', { app: appId }, JSON.parse(payload), null, payload);
    assert.strictEqual(handledGood, true);
    assert.strictEqual(goodRes.getStatusCode(), 202);

    const goodData = goodRes.getBody();
    assert.strictEqual(goodData.status, 'queued');
    assert.ok(goodData.deploymentId);
    assert.strictEqual(goodData.branch, 'devel');

    // Cancel deployment to avoid waiting for full 10-stage simulation delay
    const deploymentRunner = require('../../src/engine/deployment-runner');
    deploymentRunner.cancelDeployment(goodData.deploymentId);

    // 6. Verify Webhook Event History in DB
    const { req: histReq, res: histRes } = createMockReqRes({
      method: 'GET',
      pathname: `/api/applications/${appId}/webhooks`,
    });
    const handledHist = handleWebhookRoutes(histReq, histRes, `/api/applications/${appId}/webhooks`, {}, {}, null, '');
    assert.strictEqual(handledHist, true);
    assert.strictEqual(histRes.getStatusCode(), 200);

    const history = histRes.getBody();
    assert.ok(Array.isArray(history));
    assert.ok(history.length >= 3); // ping, rejected, accepted

    const acceptedEvent = history.find(e => e.status === 'ACCEPTED');
    assert.ok(acceptedEvent);
    assert.strictEqual(acceptedEvent.delivery_id, 'deliv-good-sig');
    assert.strictEqual(acceptedEvent.branch, 'devel');
    assert.strictEqual(acceptedEvent.deployment_id, goodData.deploymentId);

  } finally {
    // Clean up test data
    db.prepare('DELETE FROM webhook_events WHERE application_id = ?').run(appId);
    db.prepare('DELETE FROM deployments WHERE application_id = ?').run(appId);
    db.prepare('DELETE FROM application_environments WHERE application_id = ?').run(appId);
    db.prepare('DELETE FROM environments WHERE id = ?').run(envId);
    db.prepare('DELETE FROM applications WHERE id = ?').run(appId);
  }
});
