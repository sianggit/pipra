/**
 * Pipra Environments Management Routes
 */

const { getDatabase } = require('../db/database');

function handleEnvRoutes(req, res, pathname, query, body, user) {
  const db = getDatabase();

  if (req.method === 'GET' && pathname === '/api/environments') {
    const envs = db.prepare('SELECT * FROM environments ORDER BY is_production ASC, name ASC').all();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(envs));
    return true;
  }

  const singleMatch = pathname.match(/^\/api\/environments\/([a-zA-Z0-9_\-]+)$/);
  if (req.method === 'GET' && singleMatch) {
    const envId = singleMatch[1];
    const env = db.prepare('SELECT * FROM environments WHERE id = ? OR name = ?').get(envId, envId);
    if (!env) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Environment not found' }));
      return true;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(env));
    return true;
  }

  return false;
}

module.exports = { handleEnvRoutes };
