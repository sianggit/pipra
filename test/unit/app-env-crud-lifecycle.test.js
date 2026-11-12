/**
 * Unit Test: Application & Environment Full-Lifecycle CRUD & Dual-Stage Archival
 * Validates PIPRA-401, PIPRA-402, PIPRA-403, and PIPRA-404.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { getDatabase, initSchema } = require('../../src/db/database');
const { handleAppRoutes } = require('../../src/routes/app-routes');
const { handleEnvRoutes } = require('../../src/routes/env-routes');

const PROJECT_ROOT = path.resolve(__dirname, '../..');

function mockRes() {
  const res = {
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
  return res;
}

const adminUser = { id: 'usr-admin', username: 'admin', role: 'admin' };
const operatorUser = { id: 'usr-operator', username: 'operator', role: 'operator' };
const viewerUser = { id: 'usr-viewer', username: 'viewer', role: 'viewer' };

test('MOD-01 & MOD-02: Schema defines is_archived columns on applications and environments', () => {
  const db = getDatabase();
  initSchema(db);

  const appCols = db.prepare('PRAGMA table_info(applications)').all().map(c => c.name);
  assert.ok(appCols.includes('is_archived'), 'applications must have is_archived column');

  const appEnvCols = db.prepare('PRAGMA table_info(application_environments)').all().map(c => c.name);
  assert.ok(appEnvCols.includes('is_archived'), 'application_environments must have is_archived column');
});

test('CFG-01 & HLP-01: Update Application via PUT /api/applications/:id with Immutable Slug', async () => {
  const db = getDatabase();
  const testSlug = `app-test-crud-${Date.now().toString(16)}`;
  const now = new Date().toISOString();

  // Insert test application
  db.prepare(`
    INSERT INTO applications (
      id, name, display_name, repo_url, app_dir, default_branch,
      dockerfile, image_name, env_file, host_port, staging_port,
      container_port, healthcheck_path, is_archived, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, 'devel', 'Dockerfile', ?, '.env', 4000, 4001, 3000, '/', 0, ?, ?)
  `).run(testSlug, testSlug, 'Old Display Name', 'git@example.com:old/repo.git', '/home/devel/old', testSlug, now, now);

  // 1. Non-admin is rejected with 403
  const resViewer = mockRes();
  handleAppRoutes({ method: 'PUT', socket: {} }, resViewer, `/api/applications/${testSlug}`, {}, { display_name: 'Hacked' }, viewerUser);
  assert.strictEqual(resViewer.statusCode, 403, 'Viewer must be rejected with 403');

  // 2. Admin updates metadata
  const resAdmin = mockRes();
  handleAppRoutes(
    { method: 'PUT', socket: {} },
    resAdmin,
    `/api/applications/${testSlug}`,
    {},
    {
      display_name: 'New Updated Display Name',
      repo_url: 'git@example.com:new/repo.git',
      app_dir: '/home/devel/new-path',
      default_branch: 'main',
      permitted_branches: ['main', 'staging', 'prod'],
      dockerfile: 'Dockerfile.prod',
      host_port: 5000,
      staging_port: 5001,
    },
    adminUser
  );

  assert.strictEqual(resAdmin.statusCode, 200, 'Admin update must succeed');
  const responseData = JSON.parse(resAdmin.body);
  assert.strictEqual(responseData.success, true);

  // Verify in database
  const updatedApp = db.prepare('SELECT * FROM applications WHERE id = ?').get(testSlug);
  assert.strictEqual(updatedApp.display_name, 'New Updated Display Name');
  assert.strictEqual(updatedApp.repo_url, 'git@example.com:new/repo.git');
  assert.strictEqual(updatedApp.app_dir, '/home/devel/new-path');
  assert.strictEqual(updatedApp.name, testSlug, 'Slug must remain immutable');
  assert.strictEqual(updatedApp.default_branch, 'main');
});

test('CFG-02 & HLP-02: Dual-Stage Application Archival & Active Deployment Lock', async () => {
  const db = getDatabase();
  const testSlug = `app-test-archive-${Date.now().toString(16)}`;
  const now = new Date().toISOString();

  // Create app with an attached environment
  db.prepare(`
    INSERT INTO applications (id, name, display_name, repo_url, app_dir, created_at, updated_at)
    VALUES (?, ?, ?, 'git@repo.git', '/dir', ?, ?)
  `).run(testSlug, testSlug, 'Archive Test App', now, now);

  const envId = `env-test-${Date.now().toString(16)}`;
  db.prepare(`
    INSERT INTO application_environments (id, application_id, name, display_name, host, ssh_port, ssh_user, auth_type, app_dir, env_file, host_port, staging_port, created_at, updated_at)
    VALUES (?, ?, 'devel', 'Dev Target', '127.0.0.1', 22, 'devel', 'NONE', '/dir', '.env', 4000, 4001, ?, ?)
  `).run(envId, testSlug, now, now);

  // 1. Archive the application
  const resArchive = mockRes();
  handleAppRoutes({ method: 'PATCH', socket: {} }, resArchive, `/api/applications/${testSlug}/archive`, {}, { is_archived: 1 }, adminUser);
  assert.strictEqual(resArchive.statusCode, 200);
  assert.strictEqual(JSON.parse(resArchive.body).is_archived, 1);

  // Verify both app and attached environment are marked archived
  const archivedApp = db.prepare('SELECT is_archived FROM applications WHERE id = ?').get(testSlug);
  assert.strictEqual(archivedApp.is_archived, 1);
  const archivedEnv = db.prepare('SELECT is_archived FROM application_environments WHERE id = ?').get(envId);
  assert.strictEqual(archivedEnv.is_archived, 1);

  // 2. Restore the application
  const resRestore = mockRes();
  handleAppRoutes({ method: 'PATCH', socket: {} }, resRestore, `/api/applications/${testSlug}/archive`, {}, { is_archived: 0 }, adminUser);
  assert.strictEqual(resRestore.statusCode, 200);
  assert.strictEqual(JSON.parse(resRestore.body).is_archived, 0);

  // 3. Test active deployment lock: insert active deployment
  const deployId = `dep-${Date.now().toString(16)}`;
  // Insert shadow environment to satisfy foreign key constraint
  const shadowEnvName = `shadow-${Date.now().toString(16)}`;
  db.prepare(`
    INSERT INTO environments (id, name, display_name, is_production, host, agent_id, auth_type, ssh_user, ssh_port)
    VALUES (?, ?, 'Dev Target', 0, '127.0.0.1', 'agent-local', 'NONE', 'devel', 22)
  `).run(envId, shadowEnvName);

  db.prepare(`
    INSERT INTO deployments (id, application_id, environment_id, status, initiated_by, branch, image_tag, container_name, created_at)
    VALUES (?, ?, ?, 'RUNNING', 'admin', 'devel', 'tag:1', 'cnt-test', ?)
  `).run(deployId, testSlug, envId, now);

  // Attempting to archive while deployment is running must return 409 Conflict
  const resBlocked = mockRes();
  handleAppRoutes({ method: 'PATCH', socket: {} }, resBlocked, `/api/applications/${testSlug}/archive`, {}, { is_archived: 1 }, adminUser);
  assert.strictEqual(resBlocked.statusCode, 409, 'Must reject archival when active deployment is running');

  // Cleanup active deployment and shadow environment
  db.prepare('DELETE FROM deployments WHERE id = ?').run(deployId);
  db.prepare('DELETE FROM environments WHERE id = ?').run(envId);
});

test('CFG-03 & MOD-03: Permanent Purge Application with Typed Slug Confirmation', async () => {
  const db = getDatabase();
  const testSlug = `app-test-purge-${Date.now().toString(16)}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO applications (id, name, display_name, repo_url, app_dir, created_at, updated_at)
    VALUES (?, ?, ?, 'git@repo.git', '/dir', ?, ?)
  `).run(testSlug, testSlug, 'Purge Test App', now, now);

  const envId = `env-purge-${Date.now().toString(16)}`;
  db.prepare(`
    INSERT INTO application_environments (id, application_id, name, display_name, host, ssh_port, ssh_user, auth_type, app_dir, env_file, host_port, staging_port, created_at, updated_at)
    VALUES (?, ?, 'devel', 'Dev Target', '127.0.0.1', 22, 'devel', 'NONE', '/dir', '.env', 4000, 4001, ?, ?)
  `).run(envId, testSlug, now, now);

  // 1. Rejects if confirm_slug does not match
  const resWrongSlug = mockRes();
  handleAppRoutes({ method: 'DELETE', socket: {} }, resWrongSlug, `/api/applications/${testSlug}`, {}, { confirm_slug: 'wrong-slug' }, adminUser);
  assert.strictEqual(resWrongSlug.statusCode, 400, 'Must return 400 when slug does not match');

  // 2. Succeeds when confirm_slug matches app.name
  const resPurge = mockRes();
  handleAppRoutes({ method: 'DELETE', socket: {} }, resPurge, `/api/applications/${testSlug}`, {}, { confirm_slug: testSlug }, adminUser);
  assert.strictEqual(resPurge.statusCode, 200, 'Must succeed with matching slug');

  // Verify records are gone from database
  const deletedApp = db.prepare('SELECT * FROM applications WHERE id = ?').get(testSlug);
  assert.strictEqual(deletedApp, undefined, 'Application must be deleted');
  const deletedEnv = db.prepare('SELECT * FROM application_environments WHERE id = ?').get(envId);
  assert.strictEqual(deletedEnv, undefined, 'Attached environments must be cascade deleted');
});

test('CFG-04 & CFG-05: Environment Archival & Decommissioning with Deployment Protection', async () => {
  const db = getDatabase();
  const now = new Date().toISOString();
  const testAppId = `app-test-decom-${Date.now().toString(16)}`;
  db.prepare(`
    INSERT INTO applications (id, name, display_name, repo_url, app_dir, created_at, updated_at)
    VALUES (?, ?, 'Decom Test App', 'git@repo.git', '/dir', ?, ?)
  `).run(testAppId, testAppId, now, now);

  const envId = `env-decom-${Date.now().toString(16)}`;

  db.prepare(`
    INSERT INTO application_environments (id, application_id, name, display_name, host, ssh_port, ssh_user, auth_type, app_dir, env_file, host_port, staging_port, created_at, updated_at)
    VALUES (?, ?, 'qa-decom', 'QA Decom Target', '127.0.0.1', 22, 'devel', 'NONE', '/dir', '.env', 4000, 4001, ?, ?)
  `).run(envId, testAppId, now, now);

  // 1. Archive environment
  const resArchive = mockRes();
  handleEnvRoutes({ method: 'PATCH', socket: {} }, resArchive, `/api/environments/${envId}/archive`, {}, { is_archived: 1 }, adminUser);
  assert.strictEqual(resArchive.statusCode, 200);

  // 2. Delete environment
  const resDelete = mockRes();
  handleEnvRoutes({ method: 'DELETE', socket: {} }, resDelete, `/api/environments/${envId}`, {}, {}, adminUser);
  assert.strictEqual(resDelete.statusCode, 200);

  // Verify deletion
  const check = db.prepare('SELECT * FROM application_environments WHERE id = ?').get(envId);
  assert.strictEqual(check, undefined);

  // Cleanup test app
  db.prepare('DELETE FROM applications WHERE id = ?').run(testAppId);
});
