/**
 * Pipra Environments Management Routes
 * Supports target host discovery, administrative host configuration,
 * zero-return secret sanitization, and AES-256-GCM vault integration.
 */

const { getDatabase } = require('../db/database');
const authService = require('../auth/auth-service');
const cryptoVault = require('../utils/crypto-vault');
const { validateHost } = require('../utils/sanitizer');

function sanitizeEnv(env) {
  if (!env) return null;
  const { encrypted_credential, ...safeEnv } = env;
  return {
    ...safeEnv,
    has_credential: !!encrypted_credential,
  };
}

function handleEnvRoutes(req, res, pathname, query, body, user) {
  const db = getDatabase();

  // 1. List environments
  if (req.method === 'GET' && pathname === '/api/environments') {
    const envs = db.prepare('SELECT * FROM environments ORDER BY is_production ASC, name ASC').all();
    const sanitized = envs.map(sanitizeEnv);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(sanitized));
    return true;
  }

  // 2. Environment detail
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
    res.end(JSON.stringify(sanitizeEnv(env)));
    return true;
  }

  // 3. Update environment configuration (Admin role required)
  if (req.method === 'PUT' && singleMatch) {
    if (!user) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Authentication required' }));
      return true;
    }

    if (!authService.hasRole(user, ['admin'])) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Admin role required to configure environment targets and credentials' }));
      return true;
    }

    const envId = singleMatch[1];
    const existing = db.prepare('SELECT * FROM environments WHERE id = ? OR name = ?').get(envId, envId);
    if (!existing) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Environment not found' }));
      return true;
    }

    const {
      host,
      display_name,
      ssh_user,
      ssh_port,
      auth_type,
      credential,
    } = body || {};

    const targetHost = host ? host.trim() : existing.host;
    if (!validateHost(targetHost)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid host address. Must be a valid IPv4 address or hostname.' }));
      return true;
    }

    const targetDisplayName = display_name ? display_name.trim() : existing.display_name;
    const targetSshUser = ssh_user ? ssh_user.trim() : (existing.ssh_user || 'devel');
    const targetSshPort = ssh_port ? parseInt(ssh_port, 10) : (existing.ssh_port || 22);

    if (isNaN(targetSshPort) || targetSshPort < 1 || targetSshPort > 65535) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'SSH port must be an integer between 1 and 65535.' }));
      return true;
    }

    const allowedAuthTypes = ['NONE', 'SSH_KEY', 'SSH_PASSWORD'];
    const targetAuthType = auth_type && allowedAuthTypes.includes(auth_type.toUpperCase())
      ? auth_type.toUpperCase()
      : (existing.auth_type || 'NONE');

    let updateCred = 0;
    let encryptedCred = null;
    let credUpdatedAt = null;

    if (credential !== undefined && credential !== null) {
      const trimmedCred = String(credential).trim();
      if (trimmedCred.length > 0) {
        updateCred = 1;
        encryptedCred = cryptoVault.encryptSecret(trimmedCred);
        credUpdatedAt = new Date().toISOString();
      } else if (targetAuthType === 'NONE') {
        updateCred = 1;
        encryptedCred = null;
        credUpdatedAt = null;
      }
    }

    const now = new Date().toISOString();
    try {
      db.prepare(`
        UPDATE environments
        SET host = ?,
            display_name = ?,
            ssh_user = ?,
            ssh_port = ?,
            auth_type = ?,
            encrypted_credential = CASE WHEN ? = 1 THEN ? ELSE encrypted_credential END,
            credential_updated_at = CASE WHEN ? = 1 THEN ? ELSE credential_updated_at END
        WHERE id = ?
      `).run(
        targetHost,
        targetDisplayName,
        targetSshUser,
        targetSshPort,
        targetAuthType,
        updateCred,
        encryptedCred,
        updateCred,
        credUpdatedAt,
        existing.id
      );

      // Audit log (never log credential content)
      db.prepare(`
        INSERT INTO audit_logs (user_id, username, action, resource_type, resource_id, environment, details, ip_address, created_at)
        VALUES (?, ?, 'ENV_UPDATED', 'environment', ?, ?, ?, ?, ?)
      `).run(
        user.id,
        user.username,
        existing.id,
        existing.name,
        `Updated environment '${existing.name}' host to '${targetHost}' (auth: ${targetAuthType}, user: ${targetSshUser})`,
        req.socket.remoteAddress || '127.0.0.1',
        now
      );

      const updated = db.prepare('SELECT * FROM environments WHERE id = ?').get(existing.id);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(sanitizeEnv(updated)));
      return true;
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
      return true;
    }
  }

  return false;
}

module.exports = { handleEnvRoutes };
