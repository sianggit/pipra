/**
 * Integration Test: ISO 27001 Global API Gateway Authentication & Access Control
 * Validates endpoint authorization boundaries, first-boot password change barrier, and test-connection guards.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { handleDeploymentRoutes } = require('../../src/routes/deployment-routes');
const { handleEnvRoutes } = require('../../src/routes/env-routes');
const { handleAuthRoutes } = require('../../src/routes/auth-routes');
const authService = require('../../src/auth/auth-service');
const { getDatabase } = require('../../src/db/database');

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
    getHeaders: () => responseHeaders,
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

test('CFG-01 & CFG-02: GET /api/deployments requires authentication', () => {
  // 1. Unauthenticated attempt -> 401 Unauthorized
  const mock1 = createMockReqRes({ method: 'GET', pathname: '/api/deployments' });
  const handled1 = handleDeploymentRoutes(mock1.req, mock1.res, '/api/deployments', {}, {}, null);
  assert.strictEqual(handled1, true);
  assert.strictEqual(mock1.res.getStatusCode(), 401);
  assert.ok(mock1.res.getBody().error.includes('Authentication required'));

  // 2. Authenticated attempt with viewer -> 200 OK
  const viewerUser = { id: 'v-1', username: 'viewer', role: 'viewer' };
  const mock2 = createMockReqRes({ method: 'GET', pathname: '/api/deployments' });
  const handled2 = handleDeploymentRoutes(mock2.req, mock2.res, '/api/deployments', {}, {}, viewerUser);
  assert.strictEqual(handled2, true);
  assert.strictEqual(mock2.res.getStatusCode(), 200);
  assert.ok(Array.isArray(mock2.res.getBody()));
});

test('CFG-04 & CFG-05: POST /api/environments/:id/test-connection rejects unauthenticated & viewer requests', () => {
  // 1. Unauthenticated -> 403 Forbidden (requires operator/admin)
  const mock1 = createMockReqRes({ method: 'POST', pathname: '/api/environments/env-local/test-connection' });
  const handled1 = handleEnvRoutes(mock1.req, mock1.res, '/api/environments/env-local/test-connection', {}, {}, null);
  assert.strictEqual(handled1, true);
  assert.strictEqual(mock1.res.getStatusCode(), 403);

  // 2. Viewer -> 403 Forbidden
  const viewerUser = { id: 'v-1', username: 'viewer', role: 'viewer' };
  const mock2 = createMockReqRes({ method: 'POST', pathname: '/api/environments/env-local/test-connection' });
  const handled2 = handleEnvRoutes(mock2.req, mock2.res, '/api/environments/env-local/test-connection', {}, {}, viewerUser);
  assert.strictEqual(handled2, true);
  assert.strictEqual(mock2.res.getStatusCode(), 403);
});

test('CFG-06: POST /api/auth/change-password updates password and clears rotation restriction', () => {
  const db = getDatabase();
  const testUsername = `pwd_flow_${Date.now()}`;
  const created = authService.createUser({ username: testUsername, password: 'InitialPass2026!', role: 'operator' });
  db.prepare('UPDATE users SET must_change_password = 1 WHERE id = ?').run(created.id);

  const authUser = { id: created.id, username: testUsername, role: 'operator', must_change_password: true };

  // Update password via route
  const mock = createMockReqRes({
    method: 'POST',
    pathname: '/api/auth/change-password',
    body: { new_password: 'NewStrongCompliantPassword2026!' },
  });

  const handled = handleAuthRoutes(mock.req, mock.res, '/api/auth/change-password', { new_password: 'NewStrongCompliantPassword2026!' }, authUser);
  assert.strictEqual(handled, true);
  assert.strictEqual(mock.res.getStatusCode(), 200);
  assert.strictEqual(mock.res.getBody().success, true);

  // Verify new password can be used to authenticate
  const loginRes = authService.authenticate(testUsername, 'NewStrongCompliantPassword2026!');
  assert.strictEqual(loginRes.success, true);
  assert.strictEqual(loginRes.must_change_password, false);

  // Clean up
  db.prepare('DELETE FROM users WHERE id = ?').run(created.id);
});

