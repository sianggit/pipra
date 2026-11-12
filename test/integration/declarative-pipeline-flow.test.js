/**
 * Integration Test Suite for Pipra Declarative Pipeline Specification (.pipra.yaml)
 * Verifies stage 2 ingestion, stage 3 preflight execution, staging hooks, and automatic rollback on failure.
 */

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { getDatabase } = require('../../src/db/database');
const deploymentRunner = require('../../src/engine/deployment-runner');

describe('Integration: Declarative Pipeline Specification Flow', () => {
  let db;
  let testAppDir;
  const appId = 'app_declarative_test';
  const envId = 'env_declarative_test';

  before(() => {
    db = getDatabase();
    testAppDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pipra_declarative_repo_'));

    // Insert test application
    db.prepare(`
      INSERT OR REPLACE INTO applications (
        id, name, display_name, repo_url, app_dir, default_branch,
        dockerfile, image_name, host_port, staging_port, container_port,
        healthcheck_path, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      appId,
      'decl-test-app',
      'Declarative Test App',
      'git@github.com:asdp/decl-test.git',
      testAppDir,
      'main',
      'Dockerfile',
      'decl-test-img',
      4500,
      4501,
      3000,
      '/',
      new Date().toISOString(),
      new Date().toISOString()
    );

    // Insert test environment
    db.prepare(`
      INSERT OR REPLACE INTO environments (
        id, name, display_name, is_production, host, ssh_user, ssh_port, auth_type
      ) VALUES (?, ?, ?, 0, '127.0.0.1', 'devel', 22, 'NONE')
    `).run(
      envId,
      'decl-test-env',
      'Declarative Test Staging'
    );
  });

  after(() => {
    try {
      fs.rmSync(testAppDir, { recursive: true, force: true });
    } catch {}
    try {
      db.prepare('DELETE FROM deployments WHERE application_id = ?').run(appId);
      db.prepare('DELETE FROM applications WHERE id = ?').run(appId);
      db.prepare('DELETE FROM environments WHERE id = ?').run(envId);
    } catch {}
  });

  it('ingests .pipra.yaml and executes preflight hooks during deployment', async () => {
    // Write a valid .pipra.yaml in the test repo
    const yamlSpec = `
version: "1.0"
preflight:
  - echo "Pipra preflight verification step 1"
  - echo "Pipra preflight verification step 2"
verification:
  - echo "Smoke test against $STAGING_URL"
post_cutover:
  - echo "Post-cutover probe against $PROD_URL"
`;
    fs.writeFileSync(path.join(testAppDir, '.pipra.yaml'), yamlSpec, 'utf-8');

    const deploymentId = `deploy_decl_success_${Date.now()}`;
    db.prepare(`
      INSERT INTO deployments (
        id, application_id, environment_id, status, initiated_by,
        branch, image_tag, container_name, current_stage, current_stage_name,
        requires_approval, created_at, started_at
      ) VALUES (?, ?, ?, 'QUEUED', 'tester', 'main', 'v1.0.0', 'decl-test-cnt', 1, 'Preflight Validation', 0, ?, ?)
    `).run(deploymentId, appId, envId, new Date().toISOString(), new Date().toISOString());

    for (let i = 1; i <= 10; i++) {
      db.prepare(`
        INSERT INTO deployment_stages (deployment_id, stage_number, stage_name, status)
        VALUES (?, ?, ?, 'PENDING')
      `).run(deploymentId, i, `Stage ${i}`);
    }

    await deploymentRunner.startDeployment(deploymentId, {
      skipPull: true,
      requiresApproval: false,
    });

    // Poll until deployment reaches a terminal status or timeout
    const deadline = Date.now() + 30000;
    let depRecord = null;
    while (Date.now() < deadline) {
      depRecord = db.prepare('SELECT * FROM deployments WHERE id = ?').get(deploymentId);
      if (depRecord && ['SUCCEEDED', 'FAILED', 'CANCELLED'].includes(depRecord.status)) {
        break;
      }
      await new Promise(r => setTimeout(r, 200));
    }

    assert.equal(depRecord.status, 'SUCCEEDED');
    assert.ok(depRecord.pipeline_spec, 'pipeline_spec should be persisted in database');

    const parsedSpec = JSON.parse(depRecord.pipeline_spec);
    assert.equal(parsedSpec.version, '1.0');
    assert.equal(parsedSpec.preflight.length, 2);

    // Verify logs captured preflight and verification hooks
    const logs = db.prepare('SELECT * FROM deployment_logs WHERE deployment_id = ? ORDER BY id ASC').all(deploymentId);
    const logMessages = logs.map(l => l.message).join(' ');

    assert.match(logMessages, /Found declarative pipeline specification: '\.pipra\.yaml'/);
    assert.match(logMessages, /Running 2 custom preflight hook\(s\)/);
    assert.match(logMessages, /Preflight verification step 1/i);
    assert.match(logMessages, /Smoke test against/i);
  });

  it('aborts deployment if a declarative preflight hook fails without continue_on_error', async () => {
    // Write .pipra.yaml with an invalid/failing preflight command
    const yamlSpec = `
version: "1.0"
preflight:
  - non_existent_command_that_fails_immediately_12345
`;
    fs.writeFileSync(path.join(testAppDir, '.pipra.yaml'), yamlSpec, 'utf-8');

    const deploymentId = `deploy_decl_fail_${Date.now()}`;
    db.prepare(`
      INSERT INTO deployments (
        id, application_id, environment_id, status, initiated_by,
        branch, image_tag, container_name, current_stage, current_stage_name,
        requires_approval, created_at, started_at
      ) VALUES (?, ?, ?, 'QUEUED', 'tester', 'main', 'v1.0.1', 'decl-test-cnt-fail', 1, 'Preflight Validation', 0, ?, ?)
    `).run(deploymentId, appId, envId, new Date().toISOString(), new Date().toISOString());

    for (let i = 1; i <= 10; i++) {
      db.prepare(`
        INSERT INTO deployment_stages (deployment_id, stage_number, stage_name, status)
        VALUES (?, ?, ?, 'PENDING')
      `).run(deploymentId, i, `Stage ${i}`);
    }

    await deploymentRunner.startDeployment(deploymentId, {
      skipPull: true,
      requiresApproval: false,
    });

    const deadline = Date.now() + 15000;
    let depRecord = null;
    while (Date.now() < deadline) {
      depRecord = db.prepare('SELECT * FROM deployments WHERE id = ?').get(deploymentId);
      if (depRecord && ['FAILED', 'SUCCEEDED', 'CANCELLED'].includes(depRecord.status)) {
        break;
      }
      await new Promise(r => setTimeout(r, 200));
    }

    assert.equal(depRecord.status, 'FAILED');
    assert.match(depRecord.error_message, /preflight hook failed|non_existent_command/i);
  });
});

