/**
 * Pipra Overview & Metric Statistics Routes
 */

const { getDatabase } = require('../db/database');
const doraAnalytics = require('../engine/dora-analytics');

function handleStatsRoutes(req, res, pathname, query, body, user) {
  const db = getDatabase();

  // 1. DORA Metrics API: GET /api/stats/dora
  if (req.method === 'GET' && pathname === '/api/stats/dora') {
    const timeframe = query.timeframe || '30d';
    const applicationId = query.application_id || null;
    const doraData = doraAnalytics.computeDoraMetrics(db, { timeframe, applicationId });

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(doraData));
    return true;
  }

  // 2. DORA Metrics Export: GET /api/stats/dora/export
  if (req.method === 'GET' && pathname === '/api/stats/dora/export') {
    const timeframe = query.timeframe || '30d';
    const applicationId = query.application_id || null;
    const format = (query.format || 'csv').toLowerCase();
    const doraData = doraAnalytics.computeDoraMetrics(db, { timeframe, applicationId });

    const timestamp = new Date().toISOString().substring(0, 10);
    const filename = `pipra-dora-metrics-${timeframe}-${timestamp}.${format === 'json' ? 'json' : 'csv'}`;

    if (format === 'json') {
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      });
      res.end(JSON.stringify(doraData, null, 2));
      return true;
    }

    const csvContent = doraAnalytics.generateDoraCsv(doraData);
    res.writeHead(200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    res.end(csvContent);
    return true;
  }

  // 3. Existing Overview stats: GET /api/stats/overview

  if (req.method === 'GET' && pathname === '/api/stats/overview') {
    const totalCount = db.prepare('SELECT COUNT(*) as count FROM deployments').get().count;
    const successCount = db.prepare("SELECT COUNT(*) as count FROM deployments WHERE status = 'SUCCEEDED'").get().count;
    const failureCount = db.prepare("SELECT COUNT(*) as count FROM deployments WHERE status IN ('FAILED', 'ROLLBACK_FAILED')").get().count;
    const activeCount = db.prepare("SELECT COUNT(*) as count FROM deployments WHERE status IN ('QUEUED', 'PREPARING', 'RUNNING', 'VERIFYING', 'CUTTING_OVER', 'ROLLING_BACK')").get().count;

    const avgDuration = db.prepare("SELECT AVG(duration_ms) as avg_duration FROM deployments WHERE status = 'SUCCEEDED' AND duration_ms > 0").get().avg_duration || 0;

    const recentDeployments = db.prepare(`
      SELECT d.*, a.name as app_name, a.display_name as app_display_name,
             e.name as env_name, e.display_name as env_display_name, e.is_production
      FROM deployments d
      JOIN applications a ON d.application_id = a.id
      JOIN environments e ON d.environment_id = e.id
      ORDER BY d.created_at DESC LIMIT 5
    `).all();

    const envs = db.prepare('SELECT * FROM environments ORDER BY is_production ASC, name ASC').all();
    const agents = db.prepare('SELECT * FROM agents ORDER BY name ASC').all();

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      metrics: {
        total: totalCount,
        succeeded: successCount,
        failed: failureCount,
        active: activeCount,
        avgDurationMs: Math.round(avgDuration),
        successRate: totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 100,
      },
      recentDeployments,
      environments: envs,
      agents,
    }));
    return true;
  }

  return false;
}

module.exports = { handleStatsRoutes };
