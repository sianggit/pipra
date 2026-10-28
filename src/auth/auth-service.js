/**
 * Pipra Authentication & Role-Based Access Control (RBAC) Service
 */

const crypto = require('node:crypto');
const { getDatabase } = require('../db/database');
const { verifyPassword } = require('../db/seed');
const config = require('../config');

class AuthService {
  constructor() {
    this.db = getDatabase();
  }

  authenticate(username, password) {
    if (!username || !password) {
      return { success: false, error: 'Username and password required' };
    }

    const user = this.db.prepare('SELECT * FROM users WHERE username = ?').get(username);
    if (!user) {
      return { success: false, error: 'Invalid credentials' };
    }

    if (!verifyPassword(password, user.password_hash)) {
      return { success: false, error: 'Invalid credentials' };
    }

    // Generate token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + config.SESSION_TTL_HOURS * 3600 * 1000).toISOString();

    this.db.prepare(`
      INSERT INTO sessions (token, user_id, role, expires_at)
      VALUES (?, ?, ?, ?)
    `).run(token, user.id, user.role, expiresAt);

    return {
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
      },
    };
  }

  validateSession(token) {
    if (!token) return null;
    const session = this.db.prepare(`
      SELECT s.*, u.username 
      FROM sessions s
      JOIN users u ON s.user_id = u.id
      WHERE s.token = ? AND s.expires_at > ?
    `).get(token, new Date().toISOString());

    if (!session) return null;
    return {
      id: session.user_id,
      username: session.username,
      role: session.role,
      token: session.token,
    };
  }

  destroySession(token) {
    if (!token) return;
    this.db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  }

  hasRole(user, allowedRoles) {
    if (!user) return false;
    if (user.role === 'admin') return true; // admin can do everything
    return allowedRoles.includes(user.role);
  }
}

module.exports = new AuthService();
