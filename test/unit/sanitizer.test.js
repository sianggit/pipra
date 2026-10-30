/**
 * Unit Test: Sanitizer & Security Redaction
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  redactSecrets,
  validateBranch,
  validateTag,
  validateContainerName,
  validatePort,
  validateEnvFile,
  validateHost,
} = require('../../src/utils/sanitizer');

test('Sanitizer: Redacts passwords and tokens from command output', () => {
  const sample1 = 'Connecting with DB_PASSWORD=my_super_secret_pass123 to database';
  const redacted1 = redactSecrets(sample1);
  assert.ok(!redacted1.includes('my_super_secret_pass123'), 'Password should be redacted');
  assert.ok(redacted1.includes('[REDACTED]'));

  const sample2 = 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xyz123';
  const redacted2 = redactSecrets(sample2);
  assert.ok(!redacted2.includes('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'), 'Bearer token should be redacted');

  const sample3 = 'GitLab token glpat-abcdef12345678901234 used for fetch';
  const redacted3 = redactSecrets(sample3);
  assert.ok(!redacted3.includes('glpat-abcdef12345678901234'), 'GitLab PAT should be redacted');
});

test('Sanitizer: Parameter allowlists accept valid inputs', () => {
  assert.strictEqual(validateBranch('devel'), true);
  assert.strictEqual(validateBranch('feature/release-v2'), true);
  assert.strictEqual(validateBranch('hotfix-1.0.4'), true);

  assert.strictEqual(validateTag('v1.0.5'), true);
  assert.strictEqual(validateTag('prod-20261028-1'), true);

  assert.strictEqual(validateContainerName('asdp-dims-fe'), true);
  assert.strictEqual(validatePort(4000), true);
  assert.strictEqual(validateEnvFile('.env.development'), true);
  assert.strictEqual(validateEnvFile('.env.production'), true);

  // Host validator tests
  assert.strictEqual(validateHost('127.0.0.1'), true);
  assert.strictEqual(validateHost('192.168.1.100'), true);
  assert.strictEqual(validateHost('10.25.207.222'), true);
  assert.strictEqual(validateHost('srv-deploy-01.asyst.co.id'), true);
  assert.strictEqual(validateHost('localhost'), true);
});

test('Sanitizer: Parameter allowlists reject injection & traversal attempts', () => {
  assert.strictEqual(validateBranch('devel; rm -rf /'), false);
  assert.strictEqual(validateBranch('devel && whoami'), false);
  assert.strictEqual(validateBranch('devel | cat /etc/passwd'), false);
  assert.strictEqual(validateBranch('../../../etc/passwd'), false);

  assert.strictEqual(validateHost('127.0.0.1; whoami'), false);
  assert.strictEqual(validateHost('127.0.0.1 && cat /etc/shadow'), false);
  assert.strictEqual(validateHost('host with spaces'), false);
  assert.strictEqual(validateHost(''), false);
  assert.strictEqual(validateHost('999.999.999.999'), false);

  assert.strictEqual(validatePort(-1), false);
  assert.strictEqual(validatePort(70000), false);
  assert.strictEqual(validatePort('not_a_port'), false);

  assert.strictEqual(validateEnvFile('../../secret.txt'), false);
  assert.strictEqual(validateEnvFile('/etc/shadow'), false);
});
