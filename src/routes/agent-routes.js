/**
 * Pipra Infrastructure & Agent Telemetry Routes
 */

const { getDatabase } = require('../db/database');

function handleAgentRoutes(req, res, pathname, query, body, user) {
  const db = getDatabase();

  if (req.method === 'GET' && pathname === '/api/agents') {
    const agents = db.prepare('SELECT * FROM agents ORDER BY name ASC').all();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(agents));
    return true;
  }

  return false;
}

module.exports = { handleAgentRoutes };
