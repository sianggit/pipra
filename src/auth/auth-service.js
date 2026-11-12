/**
 * Pipra Authentication & Role-Based Access Control (RBAC) Service
 */

const crypto = require('node:crypto');
const { getDatabase } = require('../db/database');
const { verifyPassword, hashPassword } = require('../db/seed');
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

    // Check account lockout (ISO 27001 A.8.5)
    if (user.locked_until) {
      const lockExpiry = new Date(user.locked_until).getTime();
      if (Date.now() < lockExpiry) {
        const remainingMin = Math.ceil((lockExpiry - Date.now()) / 60000);
        return {
          success: false,
          error: `Account locked due to consecutive failed attempts. Try again in ${remainingMin} minute(s).`,
          locked: true,
        };
      }
    }

    if (!verifyPassword(password, user.password_hash)) {
      const attempts = Number(user.failed_login_attempts || 0) + 1;
      if (attempts >= 5) {
        const lockUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        this.db.prepare('UPDATE users SET failed_login_attempts = ?, locked_until = ? WHERE id = ?').run(attempts, lockUntil, user.id);
        return {
          success: false,
          error: 'Account locked due to consecutive failed attempts. Try again in 15 minutes.',
          locked: true,
        };
      }
      this.db.prepare('UPDATE users SET failed_login_attempts = ? WHERE id = ?').run(attempts, user.id);
      return { success: false, error: 'Invalid credentials' };
    }

    // Reset failed login attempts on successful authentication
    if (user.failed_login_attempts > 0 || user.locked_until) {
      this.db.prepare('UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = ?').run(user.id);
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
      must_change_password: Boolean(user.must_change_password),
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        must_change_password: Boolean(user.must_change_password),
      },
    };
  }

  validateSession(token) {
    if (!token) return null;
    const session = this.db.prepare(`
      SELECT s.*, u.username, u.must_change_password
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
      must_change_password: Boolean(session.must_change_password),
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

  listUsers() {
    const nowIso = new Date().toISOString();
    const users = this.db.prepare(`
      SELECT u.id, u.username, u.role, u.created_at,
             COUNT(s.token) as active_sessions
      FROM users u
      LEFT JOIN sessions s ON u.id = s.user_id AND s.expires_at > ?
      GROUP BY u.id
      ORDER BY u.created_at ASC
    `).all(nowIso);

    return users.map(u => ({
      id: u.id,
      username: u.username,
      role: u.role,
      created_at: u.created_at,
      active_sessions: Number(u.active_sessions || 0),
    }));
  }

  getUserById(id) {
    if (!id) return null;
    const user = this.db.prepare('SELECT id, username, role, created_at FROM users WHERE id = ?').get(id);
    return user || null;
  }

  createUser({ username, password, role }) {
    if (!username || typeof username !== 'string') {
      throw new Error('Username is required');
    }
    const cleanUsername = username.trim();
    if (!/^[a-zA-Z0-9_\-\.]{3,32}$/.test(cleanUsername)) {
      throw new Error('Username must be 3-32 alphanumeric characters, dashes, or dots');
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }

    const validRoles = ['admin', 'operator', 'viewer'];
    const assignedRole = (role || 'viewer').toLowerCase();
    if (!validRoles.includes(assignedRole)) {
      throw new Error(`Invalid role: ${role}. Must be one of: ${validRoles.join(', ')}`);
    }

    // Check unique username
    const existing = this.db.prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?)').get(cleanUsername);
    if (existing) {
      throw new Error(`Username "${cleanUsername}" is already in use`);
    }

    const userId = `user-${crypto.randomBytes(6).toString('hex')}`;
    const passwordHash = hashPassword(password);
    const createdAt = new Date().toISOString();

    this.db.prepare(`
      INSERT INTO users (id, username, password_hash, role, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(userId, cleanUsername, passwordHash, assignedRole, createdAt);

    return {
      id: userId,
      username: cleanUsername,
      role: assignedRole,
      created_at: createdAt,
      active_sessions: 0,
    };
  }

  updateUserRole(userId, newRole) {
    if (!userId) throw new Error('User ID is required');

    const validRoles = ['admin', 'operator', 'viewer'];
    const assignedRole = (newRole || '').toLowerCase();
    if (!validRoles.includes(assignedRole)) {
      throw new Error(`Invalid role: ${newRole}. Must be one of: ${validRoles.join(', ')}`);
    }

    const targetUser = this.getUserById(userId);
    if (!targetUser) {
      throw new Error(`User not found: ${userId}`);
    }

    // Safety guard: Last admin protection
    if (targetUser.role === 'admin' && assignedRole !== 'admin') {
      const adminCount = this.db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get().count;
      if (adminCount <= 1) {
        throw new Error('Cannot demote the only remaining administrator account');
      }
    }

    // Update user role in users table
    this.db.prepare('UPDATE users SET role = ? WHERE id = ?').run(assignedRole, userId);

    // Dynamically synchronize role across all active sessions for this user
    this.db.prepare('UPDATE sessions SET role = ? WHERE user_id = ?').run(assignedRole, userId);

    return {
      id: targetUser.id,
      username: targetUser.username,
      role: assignedRole,
      created_at: targetUser.created_at,
    };
  }

  resetUserPassword(userId, newPassword) {
    if (!userId) throw new Error('User ID is required');
    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      throw new Error('New password must be at least 6 characters long');
    }

    const targetUser = this.getUserById(userId);
    if (!targetUser) {
      throw new Error(`User not found: ${userId}`);
    }

    const newHash = hashPassword(newPassword);
    this.db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, userId);

    // Invalidate and terminate all active sessions for this user (forces re-login)
    this.db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);

    return { success: true };
  }

  changePassword(userId, newPassword) {
    if (!userId) throw new Error('User ID is required');
    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
      throw new Error('New password must be at least 8 characters long');
    }

    const targetUser = this.getUserById(userId);
    if (!targetUser) {
      throw new Error(`User not found: ${userId}`);
    }

    const newHash = hashPassword(newPassword);
    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE users
      SET password_hash = ?,
          must_change_password = 0,
          password_updated_at = ?,
          failed_login_attempts = 0,
          locked_until = NULL
      WHERE id = ?
    `).run(newHash, now, userId);

    return { success: true };
  }

  deleteUser(userId, currentAdminId) {
    if (!userId) throw new Error('User ID is required');

    // Self-deletion guard
    if (userId === currentAdminId) {
      throw new Error('Cannot delete your own active administrator account');
    }

    const targetUser = this.getUserById(userId);
    if (!targetUser) {
      throw new Error(`User not found: ${userId}`);
    }

    // Last admin protection
    if (targetUser.role === 'admin') {
      const adminCount = this.db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'admin'").get().count;
      if (adminCount <= 1) {
        throw new Error('Cannot delete the only remaining administrator account');
      }
    }

    // Delete user (sessions will cascade or delete explicitly)
    this.db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
    this.db.prepare('DELETE FROM users WHERE id = ?').run(userId);

    return {
      success: true,
      deletedUser: targetUser,
    };
  }
}

module.exports = new AuthService();
