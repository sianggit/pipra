/**
 * Pipra User & Role Management Routes (RBAC)
 * Strictly guarded for Administrator role.
 */

const authService = require('../auth/auth-service');
const { getDatabase } = require('../db/database');
const logger = require('../utils/logger');

function recordUserAudit(db, user, action, resourceId, details, clientIp) {
  try {
    db.prepare(`
      INSERT INTO audit_logs (user_id, username, action, resource_type, resource_id, details, ip_address, created_at)
      VALUES (?, ?, ?, 'user', ?, ?, ?, ?)
    `).run(
      user?.id || 'system',
      user?.username || 'admin',
      action,
      resourceId,
      details,
      clientIp || '127.0.0.1',
      new Date().toISOString()
    );
  } catch (err) {
    logger.warn('Failed to record user audit log:', err.message);
  }
}

function handleUserRoutes(req, res, pathname, query, body, user) {
  const db = getDatabase();
  const clientIp = req.socket?.remoteAddress || '127.0.0.1';

  // 1. List Users: GET /api/users
  if (req.method === 'GET' && pathname === '/api/users') {
    if (!authService.hasRole(user, ['admin'])) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Administrator role required to view users' }));
      return true;
    }

    try {
      const users = authService.listUsers();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(users));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return true;
  }

  // 2. Create User: POST /api/users
  if (req.method === 'POST' && pathname === '/api/users') {
    if (!authService.hasRole(user, ['admin'])) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Administrator role required to create users' }));
      return true;
    }

    const { username, password, role } = body || {};
    try {
      const created = authService.createUser({ username, password, role });
      recordUserAudit(
        db,
        user,
        'USER_CREATED',
        created.id,
        `Created account for "${created.username}" with role [${created.role}]`,
        clientIp
      );
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ user: created }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return true;
  }

  // 3. Update User Role: PATCH /api/users/:id/role
  const roleMatch = pathname.match(/^\/api\/users\/([a-zA-Z0-9_\-]+)\/role$/);
  if (req.method === 'PATCH' && roleMatch) {
    if (!authService.hasRole(user, ['admin'])) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Administrator role required to modify user roles' }));
      return true;
    }

    const targetUserId = roleMatch[1];
    const { role } = body || {};
    try {
      const updated = authService.updateUserRole(targetUserId, role);
      recordUserAudit(
        db,
        user,
        'USER_ROLE_UPDATED',
        updated.id,
        `Changed role of "${updated.username}" to [${updated.role}]`,
        clientIp
      );
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ user: updated }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return true;
  }

  // 4. Reset User Password: PATCH /api/users/:id/password
  const passMatch = pathname.match(/^\/api\/users\/([a-zA-Z0-9_\-]+)\/password$/);
  if (req.method === 'PATCH' && passMatch) {
    if (!authService.hasRole(user, ['admin'])) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Administrator role required to reset user passwords' }));
      return true;
    }

    const targetUserId = passMatch[1];
    const { password } = body || {};
    try {
      authService.resetUserPassword(targetUserId, password);
      recordUserAudit(
        db,
        user,
        'USER_PASSWORD_RESET',
        targetUserId,
        `Reset password and revoked active sessions for user ID: ${targetUserId}`,
        clientIp
      );
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Password reset and sessions revoked successfully' }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return true;
  }

  // 5. Delete User: DELETE /api/users/:id
  const deleteMatch = pathname.match(/^\/api\/users\/([a-zA-Z0-9_\-]+)$/);
  if (req.method === 'DELETE' && deleteMatch) {
    if (!authService.hasRole(user, ['admin'])) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Administrator role required to delete users' }));
      return true;
    }

    const targetUserId = deleteMatch[1];
    try {
      const result = authService.deleteUser(targetUserId, user?.id);
      recordUserAudit(
        db,
        user,
        'USER_DELETED',
        targetUserId,
        `Permanently deleted user account "${result.deletedUser?.username}"`,
        clientIp
      );
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'User deleted successfully' }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return true;
  }

  return false;
}

module.exports = { handleUserRoutes };
