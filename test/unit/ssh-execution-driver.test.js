/**
 * Pipra SSH Execution Driver & Dynamic Branch Validation Unit Test Suite
 */

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const executionDriver = require('../../src/engine/execution-driver');
const cryptoVault = require('../../src/utils/crypto-vault');
const { redactSecrets, isBranchPermitted } = require('../../src/utils/sanitizer');

test('Sanitizer: redactSecrets masks -pw arguments from command strings', () => {
  const cmd1 = 'plink.exe -ssh -P 22 -batch -pw "SuperSecretPass123" devel@172.25.230.100 "echo ok"';
  const redacted1 = redactSecrets(cmd1);
  assert.ok(!redacted1.includes('SuperSecretPass123'), 'Raw password must not be present');
  assert.ok(redacted1.includes('-pw [REDACTED_PASSWORD]'), 'Must replace with [REDACTED_PASSWORD]');

  const cmd2 = 'plink -pw myPass devel@host';
  const redacted2 = redactSecrets(cmd2);
  assert.ok(!redacted2.includes('myPass'), 'Raw password must not be present');
  assert.ok(redacted2.includes('-pw [REDACTED_PASSWORD]'));
});

test('Sanitizer: isBranchPermitted evaluates exact matches and wildcards dynamically', () => {
  const allowed = ['devel', 'develop', 'main', 'prod', 'staging', 'release/*', 'hotfix/*'];

  // Exact matches
  assert.strictEqual(isBranchPermitted('devel', allowed), true);
  assert.strictEqual(isBranchPermitted('develop', allowed), true);
  assert.strictEqual(isBranchPermitted('main', allowed), true);
  assert.strictEqual(isBranchPermitted('prod', allowed), true);
  assert.strictEqual(isBranchPermitted('staging', allowed), true);

  // Wildcards
  assert.strictEqual(isBranchPermitted('release/v1.0.0', allowed), true);
  assert.strictEqual(isBranchPermitted('release/2026-10-31', allowed), true);
  assert.strictEqual(isBranchPermitted('hotfix/patch-ssh', allowed), true);

  // Invalid branches
  assert.strictEqual(isBranchPermitted('feature/login', allowed), false);
  assert.strictEqual(isBranchPermitted('random-branch', allowed), false);
  assert.strictEqual(isBranchPermitted('release/', allowed), false); // must have suffix

  // Wildcard all
  assert.strictEqual(isBranchPermitted('anything-goes', ['*']), true);

  // JSON string parsing
  assert.strictEqual(isBranchPermitted('develop', JSON.stringify(allowed)), true);
  assert.strictEqual(isBranchPermitted('not-allowed', JSON.stringify(allowed)), false);
});

test('ExecutionDriver: resolveSshInvocation handles SSH_PASSWORD authentication', () => {
  const password = 'mySecretPassword999';
  const encrypted = cryptoVault.encryptSecret(password);
  const env = {
    host: '172.25.230.100',
    ssh_port: 22,
    ssh_user: 'devel',
    auth_type: 'SSH_PASSWORD',
    encrypted_credential: encrypted,
  };

  const invocation = executionDriver.resolveSshInvocation(env, 'docker --version');
  assert.ok(invocation, 'Invocation object returned');
  assert.ok(invocation.bin.includes('plink') || invocation.bin.includes('sshpass'), 'Uses plink or sshpass');
  assert.ok(invocation.args.includes(password), 'Args include decrypted password');
  assert.ok(invocation.args.includes('devel@172.25.230.100'));
});

test('ExecutionDriver: resolveSshInvocation handles SSH_KEY with temporary key lifecycle', () => {
  const fakeKey = '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA0fake...\n-----END RSA PRIVATE KEY-----';
  const encrypted = cryptoVault.encryptSecret(fakeKey);
  const env = {
    host: '192.168.10.15',
    ssh_port: 2200,
    ssh_user: 'deployer',
    auth_type: 'SSH_KEY',
    encrypted_credential: encrypted,
  };

  const invocation = executionDriver.resolveSshInvocation(env, 'uptime');
  assert.strictEqual(invocation.bin, 'ssh');
  assert.ok(invocation.args.includes('-i'), 'Must include -i flag');
  assert.ok(typeof invocation.cleanup === 'function', 'Must provide cleanup function');

  // Find the temp key file path
  const iIdx = invocation.args.indexOf('-i');
  const tempKeyFile = invocation.args[iIdx + 1];
  assert.ok(fs.existsSync(tempKeyFile), 'Temporary key file must exist on disk');

  // Verify content
  const content = fs.readFileSync(tempKeyFile, 'utf-8');
  assert.ok(content.includes('BEGIN RSA PRIVATE KEY'));

  // Execute cleanup
  invocation.cleanup();
  assert.ok(!fs.existsSync(tempKeyFile), 'Temporary key file must be destroyed on cleanup');
});

test('ExecutionDriver: resolveSshInvocation defaults to NONE for agent authentication', () => {
  const env = {
    host: '192.168.10.20',
    ssh_port: 22,
    ssh_user: 'ubuntu',
    auth_type: 'NONE',
  };

  const invocation = executionDriver.resolveSshInvocation(env, 'whoami');
  assert.strictEqual(invocation.bin, 'ssh');
  assert.strictEqual(invocation.cleanup, null);
  assert.ok(invocation.args.includes('ubuntu@192.168.10.20'));
});

test('ExecutionDriver: testSshConnection handles local loopback accurately', async () => {
  const res = await executionDriver.testSshConnection({ host: '127.0.0.1' });
  assert.strictEqual(res.success, true);
  assert.ok(res.message.includes('127.0.0.1'));
});

test('DeploymentRoutes: accepts image_tag or tag seamlessly on deployment launch', () => {
  const { handleDeploymentRoutes } = require('../../src/routes/deployment-routes');

  function mockRes() {
    return {
      statusCode: 200,
      headers: {},
      body: '',
      writeHead(code, headers) {
        this.statusCode = code;
        this.headers = headers || {};
      },
      end(data) {
        this.body = data;
      }
    };
  }

  const opUser = { id: 'usr-op', username: 'operator', role: 'operator' };

  // 1. Missing both tag and image_tag returns 400
  const resMissing = mockRes();
  handleDeploymentRoutes(
    { method: 'POST', socket: {} },
    resMissing,
    '/api/deployments',
    {},
    { application_id: 'asdp-ams-fe', environment_id: 'staging', branch: 'devel' },
    opUser
  );
  assert.strictEqual(resMissing.statusCode, 400);
  assert.ok(resMissing.body.includes('Missing required parameters'));

  // 2. Passing image_tag (wizard UI format) succeeds in parameter extraction
  // Note: if app exists, it continues past validation
  const resImageTag = mockRes();
  handleDeploymentRoutes(
    { method: 'POST', socket: {} },
    resImageTag,
    '/api/deployments',
    {},
    {
      application_id: 'non-existent-app',
      environment_id: 'staging',
      branch: 'devel',
      image_tag: 'v1.0.10-b3112'
    },
    opUser
  );
  // It should reach application lookup (404) rather than 400 parameter missing
  assert.strictEqual(resImageTag.statusCode, 404, 'Must parse image_tag and proceed to app lookup');
  assert.ok(resImageTag.body.includes('Application not found'));
});
