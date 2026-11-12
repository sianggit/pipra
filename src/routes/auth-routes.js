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
      // Record audit for failed login attempt (ISO 27001 A.8.15 / A.8.16)
      try {
        db.prepare(`
          INSERT INTO audit_logs (user_id, username, action, resource_type, details, ip_address, created_at)
          VALUES ('unauthenticated', ?, 'USER_LOGIN_FAILED', 'auth', ?, ?, ?)
        `).run(
          username || 'unknown',
          result.error,
          req.socket?.remoteAddress || '127.0.0.1',
          new Date().toISOString()
        );
      } catch {}

      const statusCode = result.locked ? 429 : 401;
      res.writeHead(statusCode, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: result.error, locked: Boolean(result.locked) }));
      return true;
    }

    // Record audit
    db.prepare(`
      INSERT INTO audit_logs (user_id, username, action, resource_type, ip_address, created_at)
      VALUES (?, ?, 'USER_LOGIN', 'auth', ?, ?)
    `).run(result.user.id, result.user.username, req.socket?.remoteAddress || '127.0.0.1', new Date().toISOString());

    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Set-Cookie': `pipra_token=${result.token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`,
    });
    res.end(JSON.stringify({ user: result.user, token: result.token, must_change_password: result.must_change_password }));
    return true;
  }

  if (req.method === 'POST' && pathname === '/api/auth/change-password') {
    if (!user) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Authentication required to update password' }));
      return true;
    }

    const { new_password, current_password } = body || {};
    if (!new_password) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'new_password is required' }));
      return true;
    }

    try {
      authService.changePassword(user.id, new_password);

      // Record audit
      db.prepare(`
        INSERT INTO audit_logs (user_id, username, action, resource_type, resource_id, details, ip_address, created_at)
        VALUES (?, ?, 'USER_PASSWORD_CHANGED', 'auth', ?, 'Password updated by user', ?, ?)
      `).run(user.id, user.username, user.id, req.socket?.remoteAddress || '127.0.0.1', new Date().toISOString());

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Password updated successfully' }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
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
