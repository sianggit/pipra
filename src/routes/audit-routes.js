/**
 * Pipra Audit Trail Routes
 */

const { getDatabase } = require('../db/database');

function handleAuditRoutes(req, res, pathname, query, body, user) {
  const db = getDatabase();

  if (req.method === 'GET' && pathname === '/api/audit-logs') {
    const limit = Math.min(parseInt(query.limit || '50', 10), 200);
    const logs = db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?').all(limit);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(logs));
    return true;
  }

  return false;
}

module.exports = { handleAuditRoutes };
