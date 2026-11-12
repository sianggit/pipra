/**
 * Unit Test: Multi-Application Hierarchical Environments & Remote Target Dispatch
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { getDatabase } = require('../../src/db/database');
const { seedDatabase } = require('../../src/db/seed');
const executionDriver = require('../../src/engine/execution-driver');
const { handleAppRoutes } = require('../../src/routes/app-routes');
const { handleEnvRoutes } = require('../../src/routes/env-routes');
const { handleDeploymentRoutes } = require('../../src/routes/deployment-routes');

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

test.beforeEach(() => {
  const db = getDatabase();
  seedDatabase(db);
});

test('Hierarchical Schema: application_environments is seeded and attached to applications', () => {
  const db = getDatabase();
  seedDatabase(db);

  const req = { method: 'GET' };
  const res = createMockRes();
  handleAppRoutes(req, res, '/api/applications', {}, {}, null);

  assert.strictEqual(res.statusCode, 200);
  const apps = JSON.parse(res.body);
  assert.ok(Array.isArray(apps));
  assert.ok(apps.length >= 2, 'Should have at least asdp-dims-fe and asyst-web-nextjs');

  const asdpApp = apps.find(a => a.name === 'asdp-dims-fe');
  assert.ok(asdpApp, 'asdp-dims-fe must exist');
  assert.ok(Array.isArray(asdpApp.environments), 'asdp-dims-fe must have attached environments');
  assert.ok(asdpApp.environments.length >= 3, 'asdp-dims-fe must have devel, staging, and prod environments');

  const develEnv = asdpApp.environments.find(e => e.name === 'devel');
  assert.ok(develEnv, 'devel environment must exist for asdp-dims-fe');
  assert.strictEqual(develEnv.host_port, 4000);
  assert.strictEqual(develEnv.staging_port, 4001);
  assert.strictEqual(develEnv.app_dir, '/home/devel/asdp-dims-fe');
});

test('ExecutionDriver: isTargetRemote accurately classifies local vs remote hosts', () => {
  assert.strictEqual(executionDriver.isTargetRemote({ host: '127.0.0.1' }), false);
  assert.strictEqual(executionDriver.isTargetRemote({ host: 'localhost' }), false);
  assert.strictEqual(executionDriver.isTargetRemote({ host: '::1' }), false);
  assert.strictEqual(executionDriver.isTargetRemote(null), false);

  assert.strictEqual(executionDriver.isTargetRemote({ host: '192.168.10.12' }), true);
  assert.strictEqual(executionDriver.isTargetRemote({ host: 'devel.asyst.co.id' }), true);
});

test('ExecutionDriver: testSshConnection handles local loopback gracefully', async () => {
  const localEnv = { host: '127.0.0.1' };
  const res = await executionDriver.testSshConnection(localEnv);
  assert.strictEqual(res.success, true);
  assert.ok(res.message.includes('127.0.0.1'));
});

test('EnvRoutes: Creates new application-scoped environment', () => {
  const adminUser = { id: 'user-admin-1', username: 'admin', role: 'admin' };
  const req = { method: 'POST', socket: { remoteAddress: '127.0.0.1' } };
  const res = createMockRes();

  const envSlug = `qa-${Date.now().toString(16).substring(4)}`;
  const payload = {
    application_id: 'app-asdp-dims-fe',
    name: envSlug,
    display_name: 'QA Automated Test Server',
    host: '192.168.10.99',
    ssh_port: 22,
    ssh_user: 'qa-runner',
    app_dir: '/home/qa/asdp-dims-fe',
    host_port: 4100,
    staging_port: 4101,
    container_port: 3000,
  };

  handleEnvRoutes(req, res, '/api/environments', {}, payload, adminUser);
  assert.strictEqual(res.statusCode, 201);
  const created = JSON.parse(res.body);
  assert.strictEqual(created.name, envSlug);
  assert.strictEqual(created.host, '192.168.10.99');
  assert.strictEqual(created.host_port, 4100);
});

test('DeploymentRoutes: Initiates deployment against application-scoped environment', () => {
  const opsUser = { id: 'user-ops-1', username: 'operator', role: 'operator' };
  const req = { method: 'POST', socket: { remoteAddress: '127.0.0.1' } };
  const res = createMockRes();

  const payload = {
    application_id: 'app-asdp-dims-fe',
    environment_id: 'app-env-asdp-fe-devel',
    branch: 'devel',
    tag: 'v1.0.test-b01',
    container_name: 'asdp-dims-fe',
  };

  handleDeploymentRoutes(req, res, '/api/deployments', {}, payload, opsUser);
  assert.strictEqual(res.statusCode, 201);
  const data = JSON.parse(res.body);
  assert.ok(data.deploymentId || data.id, 'Must return queued deployment ID');
  assert.strictEqual(data.status, 'QUEUED');
});
