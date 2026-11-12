/**
 * Unit Test: Pipra User Management & Role-Based Access Control (RBAC) Lifecycle
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const authService = require('../../src/auth/auth-service');
const { getDatabase } = require('../../src/db/database');

test('User Management: listUsers returns sanitized user list with session counts', () => {
  const users = authService.listUsers();
  assert.ok(Array.isArray(users));
  assert.ok(users.length >= 3); // admin, operator, viewer baseline

  const admin = users.find(u => u.username === 'admin');
  assert.ok(admin);
  assert.strictEqual(admin.role, 'admin');
  assert.strictEqual(typeof admin.active_sessions, 'number');
  assert.strictEqual(admin.password_hash, undefined, 'password_hash must never be leaked');
});

test('User Management: createUser validates username, password and role', () => {
  const testUser = `test_qa_${Date.now()}`;

  // Rejects short password
  assert.throws(() => {
    authService.createUser({ username: testUser, password: '123', role: 'viewer' });
  }, /Password must be at least 6 characters/);

  // Rejects invalid role
  assert.throws(() => {
    authService.createUser({ username: testUser, password: 'password123', role: 'superadmin' });
  }, /Invalid role/);

  // Successfully creates user
  const created = authService.createUser({ username: testUser, password: 'password123', role: 'viewer' });
  assert.ok(created.id);
  assert.strictEqual(created.username, testUser);
  assert.strictEqual(created.role, 'viewer');

  // Rejects duplicate username
  assert.throws(() => {
    authService.createUser({ username: testUser, password: 'password123', role: 'viewer' });
  }, /already in use/);

  // Authenticate as new viewer user
  const auth = authService.authenticate(testUser, 'password123');
  assert.strictEqual(auth.success, true);
  assert.strictEqual(auth.user.role, 'viewer');
  assert.ok(auth.token);

  // Verify session role
  const session = authService.validateSession(auth.token);
  assert.strictEqual(session.role, 'viewer');

  // Clean up
  authService.deleteUser(created.id, 'some-other-admin');
});

test('User Management: updateUserRole updates role and synchronizes active sessions', () => {
  const testUser = `test_promo_${Date.now()}`;
  const created = authService.createUser({ username: testUser, password: 'password123', role: 'viewer' });

  // Log in to create active session
  const auth = authService.authenticate(testUser, 'password123');
  assert.strictEqual(auth.success, true);

  // Promote from viewer to operator
  const updated = authService.updateUserRole(created.id, 'operator');
  assert.strictEqual(updated.role, 'operator');

  // Dynamic session sync check: existing token must now reflect operator role without re-login
  const session = authService.validateSession(auth.token);
  assert.strictEqual(session.role, 'operator', 'Active session role must be dynamically synchronized');

  // Clean up
  authService.deleteUser(created.id, 'some-other-admin');
});

test('User Management: resetUserPassword invalidates all active sessions', () => {
  const testUser = `test_reset_${Date.now()}`;
  const created = authService.createUser({ username: testUser, password: 'old-password-123', role: 'viewer' });

  // Log in
  const auth = authService.authenticate(testUser, 'old-password-123');
  assert.ok(auth.token);

  // Session is currently valid
  assert.ok(authService.validateSession(auth.token));

  // Reset password
  authService.resetUserPassword(created.id, 'new-secure-password-456');

  // Old session must be revoked
  const revokedSession = authService.validateSession(auth.token);
  assert.strictEqual(revokedSession, null, 'Active session must be revoked upon password reset');

  // Old password fails
  const authOld = authService.authenticate(testUser, 'old-password-123');
  assert.strictEqual(authOld.success, false);

  // New password succeeds
  const authNew = authService.authenticate(testUser, 'new-secure-password-456');
  assert.strictEqual(authNew.success, true);

  // Clean up
  authService.deleteUser(created.id, 'some-other-admin');
});

test('User Management: Safety guards prevent self-deletion and last admin deletion', () => {
  const users = authService.listUsers();
  const admin = users.find(u => u.role === 'admin');
  assert.ok(admin);

  // 1. Self deletion guard
  assert.throws(() => {
    authService.deleteUser(admin.id, admin.id);
  }, /Cannot delete your own active administrator account/);

  // 2. Last admin protection:
  // If there's only 1 admin, cannot demote or delete
  const adminCount = users.filter(u => u.role === 'admin').length;
  if (adminCount === 1) {
    assert.throws(() => {
      authService.updateUserRole(admin.id, 'viewer');
    }, /Cannot demote the only remaining administrator account/);

    assert.throws(() => {
      authService.deleteUser(admin.id, 'other-user');
    }, /Cannot delete the only remaining administrator account/);
  }
});

