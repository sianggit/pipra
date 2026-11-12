/**
 * Unit Test Suite for Pipra AI Pipeline Failure Diagnostics (ai-diagnostics.js)
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  ERROR_CATEGORIES,
  analyzeHeuristic,
} = require('../../src/engine/ai-diagnostics');

describe('AI Diagnostics - Deterministic Heuristic Analysis', () => {
  it('correctly categorizes port binding collisions (EADDRINUSE)', () => {
    const context = {
      errorMessage: 'Error: listen EADDRINUSE: address already in use :::4000',
      failedStage: 7,
      failedStageName: 'Production Cutover',
      logs: [
        { stage: 7, level: 'error', message: 'Error: listen EADDRINUSE: address already in use :::4000' }
      ],
      failedProbes: [],
    };

    const res = analyzeHeuristic(context);
    assert.equal(res.category, ERROR_CATEGORIES.PORT_CONFLICT);
    assert.match(res.summary, /Port collision/i);
    assert.match(res.suggested_fix, /netstat|findstr/i);
  });

  it('correctly categorizes missing module dependencies (MODULE_NOT_FOUND)', () => {
    const context = {
      errorMessage: "Cannot find module 'express'",
      failedStage: 3,
      failedStageName: 'Local Verification',
      logs: [
        { stage: 3, level: 'error', message: "Error: Cannot find module 'express'" }
      ],
      failedProbes: [],
    };

    const res = analyzeHeuristic(context);
    assert.equal(res.category, ERROR_CATEGORIES.DEPENDENCY_ERROR);
    assert.match(res.summary, /Missing module dependency: 'express'/i);
    assert.match(res.suggested_fix, /npm install express/i);
  });

  it('correctly categorizes staging health probe timeouts', () => {
    const context = {
      errorMessage: 'Staging health verification failed: Retry limit exceeded',
      failedStage: 6,
      failedStageName: 'Staging Health Verification',
      logs: [
        { stage: 6, level: 'warn', message: 'Probe failed: HTTP 500 on http://127.0.0.1:4001/' }
      ],
      failedProbes: [
        { http_status: 500, url: 'http://127.0.0.1:4001/', error: 'Internal Server Error' }
      ],
    };

    const res = analyzeHeuristic(context);
    assert.equal(res.category, ERROR_CATEGORIES.HEALTHCHECK_TIMEOUT);
    assert.match(res.summary, /Health check probe failed/i);
    assert.match(res.suggested_fix, /docker logs/i);
  });

  it('correctly categorizes filesystem permission errors (EACCES)', () => {
    const context = {
      errorMessage: 'open /app/dist/bundle.js: permission denied',
      failedStage: 4,
      failedStageName: 'Docker Image Build',
      logs: [
        { stage: 4, level: 'error', message: 'EACCES: permission denied, open /app/dist/bundle.js' }
      ],
      failedProbes: [],
    };

    const res = analyzeHeuristic(context);
    assert.equal(res.category, ERROR_CATEGORIES.PERMISSION_DENIED);
    assert.match(res.summary, /permission denied/i);
  });
});

