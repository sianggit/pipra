/**
 * Unit Test: Authentication & RBAC Authorization
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const authService = require('../../src/auth/auth-service');

test('Auth Service: Validates default operator credentials', () => {
  const res = authService.authenticate('operator', 'pipra-ops-2026');
  assert.strictEqual(res.success, true);
  assert.ok(res.token);
  assert.strictEqual(res.user.role, 'operator');

  // Verify session resolution
  const session = authService.validateSession(res.token);
  assert.ok(session);
  assert.strictEqual(session.username, 'operator');
  assert.strictEqual(session.role, 'operator');
});

test('Auth Service: Rejects invalid password', () => {
  const res = authService.authenticate('operator', 'wrong-pass');
  assert.strictEqual(res.success, false);
});

test('Auth Service: Enforces role permissions', () => {
  const adminUser = { role: 'admin' };
  const operatorUser = { role: 'operator' };
  const viewerUser = { role: 'viewer' };

  // Admin can do anything
  assert.strictEqual(authService.hasRole(adminUser, ['admin']), true);
  assert.strictEqual(authService.hasRole(adminUser, ['operator']), true);

  // Operator can deploy but not administer
  assert.strictEqual(authService.hasRole(operatorUser, ['operator']), true);
  assert.strictEqual(authService.hasRole(operatorUser, ['admin']), false);

  // Viewer is read only
  assert.strictEqual(authService.hasRole(viewerUser, ['operator']), false);
  assert.strictEqual(authService.hasRole(viewerUser, ['admin']), false);
});
