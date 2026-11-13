/**
 * Unit Test Suite for Enhanced AI Diagnostics (ai-diagnostics-enhanced.test.js)
 * Validates accurate RCA and actionable fix suggestions for Rocky Linux / DevOps edge cases:
 * - COMMAND_NOT_FOUND (spawn npx/docker/git ENOENT)
 * - GIT_DUBIOUS_OWNERSHIP (fatal: detected dubious ownership)
 * - DOCKER_SOCKET_EACCES (spawn docker EACCES / Docker daemon socket)
 * - PRISMA_MIGRATION_ERROR (P1001 database unreachable)
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  ERROR_CATEGORIES,
  analyzeHeuristic,
} = require('../../src/engine/ai-diagnostics');

describe('Enhanced AI Diagnostics - Real-world Incident Patterns', () => {
  it('correctly categorizes missing host binary (spawn npx ENOENT)', () => {
    const context = {
      errorMessage: 'Declarative preflight hook failed: npx prisma generate (spawn npx ENOENT)',
      failedStage: 3,
      failedStageName: 'Local Verification',
      logs: [
        { stage: 3, level: 'info', message: "[Hook 1/2] Executing: 'npx prisma generate' (timeout: 60s)" },
        { stage: 3, level: 'error', message: "Preflight hook 'npx prisma generate' failed: spawn npx ENOENT" },
        { stage: 3, level: 'error', message: 'Deployment halted: Declarative preflight hook failed: npx prisma generate (spawn npx ENOENT)' },
      ],
      failedProbes: [],
    };

    const res = analyzeHeuristic(context);
    assert.equal(res.category, ERROR_CATEGORIES.COMMAND_NOT_FOUND);
    assert.match(res.summary, /Command not found: 'npx'/i);
    assert.match(res.root_cause, /binary was not found in the environment PATH/i);
    assert.match(res.suggested_fix, /which npx/i);
    assert.match(res.suggested_fix, /remove host preflight hook/i);
  });

  it('correctly categorizes Git dubious directory ownership', () => {
    const context = {
      errorMessage: 'Git sync note: Command git failed with exit code 128',
      failedStage: 2,
      failedStageName: 'Git Workspace Sync',
      logs: [
        { stage: 2, level: 'info', message: 'Checking git workspace at: /home/devel/asyst-website-cms' },
        { stage: 2, level: 'warn', message: "fatal: detected dubious ownership in repository at '/home/devel/asyst-website-cms'" },
        { stage: 2, level: 'warn', message: 'To add an exception for this directory, call: git config --global --add safe.directory /home/devel/asyst-website-cms' },
        { stage: 2, level: 'warn', message: 'Git sync note: Command git failed with exit code 128' },
      ],
      failedProbes: [],
    };

    const res = analyzeHeuristic(context);
    assert.equal(res.category, ERROR_CATEGORIES.GIT_DUBIOUS_OWNERSHIP);
    assert.match(res.summary, /Git dubious ownership detected/i);
    assert.match(res.root_cause, /owned by another host user/i);
    assert.match(res.suggested_fix, /git config --system --add safe.directory '\*'/i);
  });

  it('correctly categorizes Docker daemon socket / execution EACCES', () => {
    const context = {
      errorMessage: 'Deployment halted: spawn docker EACCES',
      failedStage: 4,
      failedStageName: 'Docker Image Build',
      logs: [
        { stage: 4, level: 'info', message: 'Building Docker image: asyst-website:v1.0.11-b1313 using Dockerfile' },
        { stage: 4, level: 'error', message: 'Deployment halted: spawn docker EACCES' },
      ],
      failedProbes: [],
    };

    const res = analyzeHeuristic(context);
    assert.equal(res.category, ERROR_CATEGORIES.DOCKER_SOCKET_EACCES);
    assert.match(res.summary, /Docker daemon permission denied/i);
    assert.match(res.root_cause, /is not a member of the 'docker' group/i);
    assert.match(res.suggested_fix, /usermod -aG docker pipra/i);
    assert.match(res.suggested_fix, /systemctl restart pipra/i);
  });

  it('correctly categorizes Prisma database migration / connection error', () => {
    const context = {
      errorMessage: 'Preflight hook failed: npx prisma migrate deploy (Error: P1001)',
      failedStage: 3,
      failedStageName: 'Local Verification',
      logs: [
        { stage: 3, level: 'info', message: "Running preflight hook: 'npx prisma migrate deploy'" },
        { stage: 3, level: 'error', message: "Error: P1001: Can't reach database server at `postgres:5432`" },
      ],
      failedProbes: [],
    };

    const res = analyzeHeuristic(context);
    assert.equal(res.category, ERROR_CATEGORIES.PRISMA_MIGRATION_ERROR);
    assert.match(res.summary, /Prisma database connection or migration failed/i);
    assert.match(res.root_cause, /could not connect to the database/i);
    assert.match(res.suggested_fix, /DATABASE_URL/i);
  });
});
