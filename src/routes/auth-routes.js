/**
 * Pipra Authentication & User Profile Routes
 */

const authService = require('../auth/auth-service');
const { getDatabase } = require('../db/database');

function handleAuthRoutes(req, res, pathname, body, user) {
  const db = getDatabase();

  if (req.method === 'POST' && pathname === '/api/auth/login') {
    const { username, password } = body || {};
    const result = authService.authenticate(username, password);
    if (!result.success) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: result.error }));
      return true;
    }

    // Record audit
    db.prepare(`
      INSERT INTO audit_logs (user_id, username, action, resource_type, ip_address, created_at)
      VALUES (?, ?, 'USER_LOGIN', 'auth', ?, ?)
    `).run(result.user.id, result.user.username, req.socket.remoteAddress || '127.0.0.1', new Date().toISOString());

    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Set-Cookie': `pipra_token=${result.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`,
    });
    res.end(JSON.stringify({ user: result.user, token: result.token }));
    return true;
  }

  if (req.method === 'GET' && pathname === '/api/auth/me') {
    if (!user) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return true;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ user }));
    return true;
  }

  if (req.method === 'POST' && pathname === '/api/auth/logout') {
    if (user && user.token) {
      authService.destroySession(user.token);
    }
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Set-Cookie': 'pipra_token=; Path=/; HttpOnly; Max-Age=0',
    });
    res.end(JSON.stringify({ success: true }));
    return true;
  }

  return false;
}

module.exports = { handleAuthRoutes };
