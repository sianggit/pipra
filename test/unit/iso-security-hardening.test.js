/**
 * Unit Test Suite: Pipra ISO/IEC 27001:2022 Security Hardening Verification
 * Validates dynamic salts, timing-safe checks, account lockout, and CLI credential protection.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const authService = require('../../src/auth/auth-service');
const { hashPassword, verifyPassword } = require('../../src/db/seed');
const { validateProductionSecrets } = require('../../src/config');
const executionDriver = require('../../src/engine/execution-driver');
const cryptoVault = require('../../src/utils/crypto-vault');
const siemStreamer = require('../../src/utils/siem-streamer');
const { getDatabase } = require('../../src/db/database');

test('ISO 27001 A.8.5: Dynamic per-user salt and timing-safe password verification', () => {
  const password = 'SuperSecretCompliance2026!';
  const hash1 = hashPassword(password);
  const hash2 = hashPassword(password);

  assert.ok(hash1.startsWith('scrypt:'), 'Must use scrypt format');
  assert.ok(hash2.startsWith('scrypt:'), 'Must use scrypt format');
  assert.notStrictEqual(hash1, hash2, 'Two identical passwords must yield distinct hashes due to dynamic random salts');

  // Verify valid password
  assert.strictEqual(verifyPassword(password, hash1), true);
  assert.strictEqual(verifyPassword(password, hash2), true);

  // Reject wrong password
  assert.strictEqual(verifyPassword('WrongPass123', hash1), false);

  // Backward compatibility with legacy static salt
  const legacySalt = 'pipra_salt_2026';
  const legacyHash = crypto.scryptSync(password, legacySalt, 32).toString('hex');
  assert.strictEqual(verifyPassword(password, legacyHash), true, 'Legacy hashes must verify seamlessly');
});

test('ISO 27001 A.8.5: Account lockout policy after 5 consecutive failed logins', () => {
  const db = getDatabase();
  const testUser = `lockout_test_${Date.now()}`;
  const created = authService.createUser({ username: testUser, password: 'InitialPass2026!', role: 'operator' });

  // 4 invalid attempts
  for (let i = 1; i <= 4; i++) {
    const res = authService.authenticate(testUser, 'BadPassword!');
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.locked, undefined);
  }

  // 5th invalid attempt triggers lockout
  const lockedRes = authService.authenticate(testUser, 'BadPassword!');
  assert.strictEqual(lockedRes.success, false);
  assert.strictEqual(lockedRes.locked, true);
  assert.ok(lockedRes.error.includes('Account locked'));

  // 6th attempt with correct password still fails during lockout window
  const duringLockout = authService.authenticate(testUser, 'InitialPass2026!');
  assert.strictEqual(duringLockout.success, false);
  assert.strictEqual(duringLockout.locked, true);

  // Clean up
  db.prepare('DELETE FROM users WHERE id = ?').run(created.id);
});

test('ISO 27001 A.5.17: First-boot credential lifecycle & password rotation barrier', () => {
  const db = getDatabase();
  const testUser = `rotate_test_${Date.now()}`;
  const created = authService.createUser({ username: testUser, password: 'InitialPass2026!', role: 'viewer' });

  // Simulate factory default state
  db.prepare('UPDATE users SET must_change_password = 1 WHERE id = ?').run(created.id);

  // Login identifies mandatory change
  const authRes = authService.authenticate(testUser, 'InitialPass2026!');
  assert.strictEqual(authRes.success, true);
  assert.strictEqual(authRes.must_change_password, true);

  // Session reflects restriction
  const session = authService.validateSession(authRes.token);
  assert.strictEqual(session.must_change_password, true);

  // Execute password rotation
  const changeRes = authService.changePassword(created.id, 'NewStrongCompliancePass2026!');
  assert.strictEqual(changeRes.success, true);

  // Verify must_change_password cleared
  const updatedUser = authService.getUserById(created.id);
  const updatedRow = db.prepare('SELECT must_change_password FROM users WHERE id = ?').get(created.id);
  assert.strictEqual(updatedRow.must_change_password, 0);

  // Clean up
  db.prepare('DELETE FROM users WHERE id = ?').run(created.id);
});

test('ISO 27001 A.8.24: Production secret guard refuses default fallback keys', () => {
  // Test fallback in production throws
  assert.throws(() => {
    validateProductionSecrets({
      NODE_ENV: 'production',
      SESSION_SECRET: 'pipra-secure-session-key-asdp-dims-2026',
    });
  }, /In production, SESSION_SECRET must be explicitly set/);

  // Test valid production secrets passes
  assert.doesNotThrow(() => {
    validateProductionSecrets({
      NODE_ENV: 'production',
      SESSION_SECRET: 'custom-hardened-enterprise-secret-key-xyz-123',
      PIPRA_MASTER_KEY: 'custom-hardened-enterprise-master-key-xyz-123',
    });
  });
});

test('ISO 27001 A.8.8 / A.8.20: Execution driver protects credentials from process-space CLI leaks', () => {
  const rawPassword = 'SensitiveHostRootPassword2026!';
  const encrypted = cryptoVault.encryptSecret(rawPassword);
  const env = {
    host: '10.200.1.55',
    ssh_port: 22,
    ssh_user: 'root',
    auth_type: 'SSH_PASSWORD',
    encrypted_credential: encrypted,
  };

  const invocation = executionDriver.resolveSshInvocation(env, 'uname -a');
  assert.ok(invocation);
  assert.ok(invocation.args, 'Args array must exist');

  // Verify CLI arguments NEVER contain raw password
  assert.strictEqual(
    invocation.args.includes(rawPassword),
    false,
    'CRITICAL: Cleartext password leaked in process invocation arguments'
  );

  // Verify -pwfile or -f is used
  const usesSecureFile = invocation.args.includes('-pwfile') || invocation.args.includes('-f');
  assert.strictEqual(usesSecureFile, true, 'Must use protected temporary credential descriptor');

  // Execute cleanup
  assert.strictEqual(typeof invocation.cleanup, 'function');
  invocation.cleanup();
});

test('ISO 27001 A.8.15: Cryptographic audit log chaining and SIEM forwarder', () => {
  const genesisHash = '0000000000000000000000000000000000000000000000000000000000000000';
  const record1 = {
    created_at: new Date().toISOString(),
    user_id: 'user-admin-1',
    username: 'admin',
    action: 'DEPLOY_TRIGGERED',
    resource_type: 'deployment',
    resource_id: 'dep-101',
    ip_address: '127.0.0.1',
  };

  const hash1 = siemStreamer.computeAuditHash(genesisHash, record1);
  assert.ok(hash1 && hash1.length === 64, 'Must compute 64-character SHA-256 HMAC digest');

  const record2 = {
    created_at: new Date().toISOString(),
    user_id: 'user-ops-1',
    username: 'operator',
    action: 'PROD_CUTOVER_APPROVED',
    resource_type: 'deployment',
    resource_id: 'dep-101',
    ip_address: '127.0.0.1',
  };

  const hash2 = siemStreamer.computeAuditHash(hash1, record2);
  assert.ok(hash2 && hash2.length === 64);
  assert.notStrictEqual(hash1, hash2, 'Chained hashes must link sequentially');
});

