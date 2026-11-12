/**
 * Pipra Audit Trail Routes
 */

const { getDatabase } = require('../db/database');
const authService = require('../auth/auth-service');

function handleAuditRoutes(req, res, pathname, query, body, user) {
  const db = getDatabase();

  if (req.method === 'GET' && pathname === '/api/audit-logs') {
    if (!authService.hasRole(user, ['admin'])) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Administrator role required to view audit logs' }));
      return true;
    }

    const limit = Math.min(parseInt(query.limit || '100', 10), 500);
    const logs = db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?').all(limit);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(logs));
    return true;
  }

  return false;
}

module.exports = { handleAuditRoutes };
