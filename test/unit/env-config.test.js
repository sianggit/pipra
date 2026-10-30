/**
 * Unit Test: Environment Configuration & Host Credential Vault
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { getDatabase } = require('../../src/db/database');
const { seedDatabase } = require('../../src/db/seed');
const { handleEnvRoutes } = require('../../src/routes/env-routes');
const { decryptSecret } = require('../../src/utils/crypto-vault');

function createMockRes() {
  return {
    statusCode: 0,
    headers: {},
    body: '',
    writeHead(code, headers) {
      this.statusCode = code;
      this.headers = headers;
    },
    end(data) {
      this.body = data;
    },
  };
}

test('EnvRoutes: List and detail endpoints sanitize credentials', () => {
  const db = getDatabase();
  seedDatabase(db);

  // 1. Test GET /api/environments
  const reqGet = { method: 'GET' };
  const resGet = createMockRes();
  handleEnvRoutes(reqGet, resGet, '/api/environments', {}, {}, null);

  assert.strictEqual(resGet.statusCode, 200);
  const envs = JSON.parse(resGet.body);
  assert.ok(Array.isArray(envs));
  assert.ok(envs.length >= 3);

  for (const env of envs) {
    assert.strictEqual(env.encrypted_credential, undefined, 'Raw encrypted_credential must never be exposed');
    assert.ok('has_credential' in env, 'has_credential boolean must be present');
  }
});

test('EnvRoutes: PUT requires authentication and admin privileges', () => {
  // Unauthenticated
  const reqUnauth = { method: 'PUT', socket: {} };
  const resUnauth = createMockRes();
  handleEnvRoutes(reqUnauth, resUnauth, '/api/environments/env-devel', {}, { host: '10.0.0.1' }, null);
  assert.strictEqual(resUnauth.statusCode, 401);

  // Operator (Forbidden)
  const operatorUser = { id: 'user-ops-1', username: 'operator', role: 'operator' };
  const reqOperator = { method: 'PUT', socket: {} };
  const resOperator = createMockRes();
  handleEnvRoutes(reqOperator, resOperator, '/api/environments/env-devel', {}, { host: '10.0.0.1' }, operatorUser);
  assert.strictEqual(resOperator.statusCode, 403);

  // Viewer (Forbidden)
  const viewerUser = { id: 'user-view-1', username: 'viewer', role: 'viewer' };
  const reqViewer = { method: 'PUT', socket: {} };
  const resViewer = createMockRes();
  handleEnvRoutes(reqViewer, resViewer, '/api/environments/env-devel', {}, { host: '10.0.0.1' }, viewerUser);
  assert.strictEqual(resViewer.statusCode, 403);
});

test('EnvRoutes: Admin updates target host and stores encrypted credential', () => {
  const db = getDatabase();
  const adminUser = { id: 'user-admin-1', username: 'admin', role: 'admin' };

  // Update devel environment host and credential
  const updatePayload = {
    host: '10.200.45.10',
    display_name: 'Development Cluster 01',
    ssh_user: 'deploy-bot',
    ssh_port: 2222,
    auth_type: 'SSH_PASSWORD',
    credential: 'my-ultra-secret-ssh-password',
  };

  const reqAdmin = { method: 'PUT', socket: { remoteAddress: '127.0.0.1' } };
  const resAdmin = createMockRes();
  handleEnvRoutes(reqAdmin, resAdmin, '/api/environments/env-devel', {}, updatePayload, adminUser);

  assert.strictEqual(resAdmin.statusCode, 200);
  const updatedEnv = JSON.parse(resAdmin.body);

  assert.strictEqual(updatedEnv.host, '10.200.45.10');
  assert.strictEqual(updatedEnv.display_name, 'Development Cluster 01');
  assert.strictEqual(updatedEnv.ssh_user, 'deploy-bot');
  assert.strictEqual(updatedEnv.ssh_port, 2222);
  assert.strictEqual(updatedEnv.auth_type, 'SSH_PASSWORD');
  assert.strictEqual(updatedEnv.has_credential, true);
  assert.strictEqual(updatedEnv.encrypted_credential, undefined, 'Must not return encrypted credential');

  // Verify in database directly
  const dbRecord = db.prepare('SELECT * FROM environments WHERE id = ?').get('env-devel');
  assert.ok(dbRecord, 'Environment record must exist');
  assert.strictEqual(dbRecord.host, '10.200.45.10');
  assert.ok(dbRecord.encrypted_credential, 'Database must contain encrypted ciphertext');
  assert.notStrictEqual(dbRecord.encrypted_credential, 'my-ultra-secret-ssh-password');

  // Decrypt directly to verify AES-256-GCM authenticity
  const decrypted = decryptSecret(dbRecord.encrypted_credential);
  assert.strictEqual(decrypted, 'my-ultra-secret-ssh-password');

  // Verify audit log entry
  const audit = db.prepare('SELECT * FROM audit_logs WHERE action = ? ORDER BY id DESC LIMIT 1').get('ENV_UPDATED');
  assert.ok(audit);
  assert.strictEqual(audit.username, 'admin');
  assert.ok(audit.details.includes('10.200.45.10'));
  assert.ok(!audit.details.includes('my-ultra-secret-ssh-password'), 'Audit log must not contain plaintext credentials');
});
