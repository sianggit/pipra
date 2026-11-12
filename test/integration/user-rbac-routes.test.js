/**
 * Integration Test: User Management & RBAC Route Authorization Flow
 * Validates /api/users CRUD permissions and /api/audit-logs protection.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { handleUserRoutes } = require('../../src/routes/user-routes');
const { handleAuditRoutes } = require('../../src/routes/audit-routes');
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
    getRawBody: () => responseBody,
  };

  return { req, res };
}

test('Integration: GET /api/users rejects non-admins and allows admins', () => {
  const viewerUser = { id: 'v-1', username: 'viewer', role: 'viewer' };
  const adminUser = { id: 'a-1', username: 'admin', role: 'admin' };

  // 1. Viewer attempt -> 403 Forbidden
  const mock1 = createMockReqRes({ method: 'GET', pathname: '/api/users' });
  const handled1 = handleUserRoutes(mock1.req, mock1.res, '/api/users', {}, {}, viewerUser);
  assert.strictEqual(handled1, true);
  assert.strictEqual(mock1.res.getStatusCode(), 403);

  // 2. Admin attempt -> 200 OK
  const mock2 = createMockReqRes({ method: 'GET', pathname: '/api/users' });
  const handled2 = handleUserRoutes(mock2.req, mock2.res, '/api/users', {}, {}, adminUser);
  assert.strictEqual(handled2, true);
  assert.strictEqual(mock2.res.getStatusCode(), 200);
  const users = mock2.res.getBody();
  assert.ok(Array.isArray(users));
  assert.ok(users.length >= 3);
});

test('Integration: Full User Management Lifecycle via /api/users', () => {
  const adminUser = { id: 'user-admin-1', username: 'admin', role: 'admin' };
  const operatorUser = { id: 'user-ops-1', username: 'operator', role: 'operator' };
  const username = `qa_e2e_${Date.now()}`;

  // 1. Non-admin cannot create user -> 403
  const mockCreateNonAdmin = createMockReqRes({
    method: 'POST',
    pathname: '/api/users',
    body: { username, password: 'password123', role: 'viewer' },
  });
  handleUserRoutes(mockCreateNonAdmin.req, mockCreateNonAdmin.res, '/api/users', {}, mockCreateNonAdmin.req.body, operatorUser);
  assert.strictEqual(mockCreateNonAdmin.res.getStatusCode(), 403);

  // 2. Admin creates user -> 201 Created
  const mockCreate = createMockReqRes({
    method: 'POST',
    pathname: '/api/users',
    body: { username, password: 'password123', role: 'viewer' },
  });
  handleUserRoutes(mockCreate.req, mockCreate.res, '/api/users', {}, { username, password: 'password123', role: 'viewer' }, adminUser);
  assert.strictEqual(mockCreate.res.getStatusCode(), 201);
  const createdUser = mockCreate.res.getBody().user;
  assert.ok(createdUser.id);
  assert.strictEqual(createdUser.username, username);
  assert.strictEqual(createdUser.role, 'viewer');

  // 3. Admin updates role -> 200 OK
  const rolePath = `/api/users/${createdUser.id}/role`;
  const mockRole = createMockReqRes({ method: 'PATCH', pathname: rolePath, body: { role: 'operator' } });
  handleUserRoutes(mockRole.req, mockRole.res, rolePath, {}, { role: 'operator' }, adminUser);
  assert.strictEqual(mockRole.res.getStatusCode(), 200);
  assert.strictEqual(mockRole.res.getBody().user.role, 'operator');

  // 4. Admin resets password -> 200 OK
  const passPath = `/api/users/${createdUser.id}/password`;
  const mockPass = createMockReqRes({ method: 'PATCH', pathname: passPath, body: { password: 'new-password-789' } });
  handleUserRoutes(mockPass.req, mockPass.res, passPath, {}, { password: 'new-password-789' }, adminUser);
  assert.strictEqual(mockPass.res.getStatusCode(), 200);

  // Verify new password authenticates
  const authRes = authService.authenticate(username, 'new-password-789');
  assert.strictEqual(authRes.success, true);

  // 5. Self-deletion guard check -> 400 Bad Request
  const selfDelMock = createMockReqRes({ method: 'DELETE', pathname: `/api/users/${adminUser.id}` });
  handleUserRoutes(selfDelMock.req, selfDelMock.res, `/api/users/${adminUser.id}`, {}, {}, adminUser);
  assert.strictEqual(selfDelMock.res.getStatusCode(), 400);
  assert.ok(selfDelMock.res.getBody().error.includes('Cannot delete your own active administrator account'));

  // 6. Admin deletes created user -> 200 OK
  const delPath = `/api/users/${createdUser.id}`;
  const mockDel = createMockReqRes({ method: 'DELETE', pathname: delPath });
  handleUserRoutes(mockDel.req, mockDel.res, delPath, {}, {}, adminUser);
  assert.strictEqual(mockDel.res.getStatusCode(), 200);

  // Verify user is gone
  const authDeleted = authService.authenticate(username, 'new-password-789');
  assert.strictEqual(authDeleted.success, false);
});

test('Integration: GET /api/audit-logs is protected against non-admins', () => {
  const viewerUser = { id: 'v-1', username: 'viewer', role: 'viewer' };
  const adminUser = { id: 'a-1', username: 'admin', role: 'admin' };

  // Viewer -> 403 Forbidden
  const mockViewer = createMockReqRes({ method: 'GET', pathname: '/api/audit-logs' });
  handleAuditRoutes(mockViewer.req, mockViewer.res, '/api/audit-logs', {}, {}, viewerUser);
  assert.strictEqual(mockViewer.res.getStatusCode(), 403);

  // Admin -> 200 OK
  const mockAdmin = createMockReqRes({ method: 'GET', pathname: '/api/audit-logs' });
  handleAuditRoutes(mockAdmin.req, mockAdmin.res, '/api/audit-logs', { limit: '10' }, {}, adminUser);
  assert.strictEqual(mockAdmin.res.getStatusCode(), 200);
  assert.ok(Array.isArray(mockAdmin.res.getBody()));
});

