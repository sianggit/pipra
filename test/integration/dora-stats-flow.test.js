/**
 * Integration Test: DORA Metrics Endpoints & Export Flow
 * Validates GET /api/stats/dora and GET /api/stats/dora/export format serialization.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { handleStatsRoutes } = require('../../src/routes/stats-routes');
const { getDatabase } = require('../../src/db/database');

function createMockReqRes({ method, pathname, query = {}, headers = {}, body = null }) {
  const req = {
    method,
    headers: { ...headers, host: 'localhost:4200' },
    url: pathname,
    socket: { remoteAddress: '127.0.0.1' },
    rawBody: typeof body === 'string' ? body : JSON.stringify(body || {}),
  };

  let statusCode = 200;
  let responseHeaders = {};
  let responseBody = '';

  const res = {
    writeHead(code, headers = {}) {
      statusCode = code;
      responseHeaders = { ...responseHeaders, ...headers };
    },
    setHeader(k, v) {
      responseHeaders[k] = v;
    },
    end(chunk) {
      if (chunk) responseBody += chunk;
    },
    getStatusCode: () => statusCode,
    getHeaders: () => responseHeaders,
    getBody: () => {
      try {
        return JSON.parse(responseBody);
      } catch {
        return responseBody;
      }
    },
    getRawBody: () => responseBody,
  };

  return { req, res };
}

test('Integration: GET /api/stats/dora returns full metrics envelope', () => {
  const { req, res } = createMockReqRes({
    method: 'GET',
    pathname: '/api/stats/dora',
    query: { timeframe: '30d' },
  });

  const handled = handleStatsRoutes(req, res, '/api/stats/dora', { timeframe: '30d' }, null, null);
  assert.strictEqual(handled, true);
  assert.strictEqual(res.getStatusCode(), 200);

  const data = res.getBody();
  assert.ok(data);
  assert.strictEqual(data.timeframe, '30d');
  assert.strictEqual(data.days, 30);
  assert.ok(data.metrics);
  assert.ok(data.metrics.deploymentFrequency);
  assert.ok(data.metrics.leadTimeForChanges);
  assert.ok(data.metrics.changeFailureRate);
  assert.ok(data.metrics.meanTimeToRecovery);

  // Validate metric structure
  const df = data.metrics.deploymentFrequency;
  assert.strictEqual(df.key, 'DF');
  assert.ok(['ELITE', 'HIGH', 'MEDIUM', 'LOW'].includes(df.tier));
  assert.ok(typeof df.headline === 'string');

  // Validate buckets
  assert.ok(Array.isArray(data.dailyBuckets));
  assert.ok(data.dailyBuckets.length > 0);
  assert.ok(data.dailyBuckets[0].date);
  assert.ok(data.dailyBuckets[0].total !== undefined);
});

test('Integration: GET /api/stats/dora scopes to application and custom timeframe', () => {
  const { req, res } = createMockReqRes({
    method: 'GET',
    pathname: '/api/stats/dora',
    query: { timeframe: '7d', application_id: 'app-asdp-dims-fe' },
  });

  const handled = handleStatsRoutes(
    req,
    res,
    '/api/stats/dora',
    { timeframe: '7d', application_id: 'app-asdp-dims-fe' },
    null,
    null
  );

  assert.strictEqual(handled, true);
  assert.strictEqual(res.getStatusCode(), 200);

  const data = res.getBody();
  assert.strictEqual(data.timeframe, '7d');
  assert.strictEqual(data.days, 7);
  assert.strictEqual(data.applicationId, 'app-asdp-dims-fe');
});

test('Integration: GET /api/stats/dora/export returns CSV attachment', () => {
  const { req, res } = createMockReqRes({
    method: 'GET',
    pathname: '/api/stats/dora/export',
    query: { format: 'csv', timeframe: '30d' },
  });

  const handled = handleStatsRoutes(
    req,
    res,
    '/api/stats/dora/export',
    { format: 'csv', timeframe: '30d' },
    null,
    null
  );

  assert.strictEqual(handled, true);
  assert.strictEqual(res.getStatusCode(), 200);

  const headers = res.getHeaders();
  assert.strictEqual(headers['Content-Type'], 'text/csv; charset=utf-8');
  assert.match(headers['Content-Disposition'], /attachment; filename="pipra-dora-metrics-30d/);

  const rawBody = res.getRawBody();
  assert.ok(rawBody.startsWith('Metric,Key,Value,Unit,Headline,DORA Tier,Period Delta %,Status Note'));
  assert.ok(rawBody.includes('Deployment Frequency,DF'));
});

test('Integration: GET /api/stats/dora/export returns JSON attachment', () => {
  const { req, res } = createMockReqRes({
    method: 'GET',
    pathname: '/api/stats/dora/export',
    query: { format: 'json', timeframe: '90d' },
  });

  const handled = handleStatsRoutes(
    req,
    res,
    '/api/stats/dora/export',
    { format: 'json', timeframe: '90d' },
    null,
    null
  );

  assert.strictEqual(handled, true);
  assert.strictEqual(res.getStatusCode(), 200);

  const headers = res.getHeaders();
  assert.strictEqual(headers['Content-Type'], 'application/json; charset=utf-8');
  assert.match(headers['Content-Disposition'], /attachment; filename="pipra-dora-metrics-90d/);

  const data = res.getBody();
  assert.strictEqual(data.timeframe, '90d');
  assert.ok(data.metrics);
});

