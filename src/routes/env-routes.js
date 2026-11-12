/**
 * Pipra Environments Management Routes
 * Supports application-scoped hierarchical environments, target host discovery,
 * administrative host configuration, SSH connectivity testing, and AES-256 vault.
 */

const { getDatabase } = require('../db/database');
const authService = require('../auth/auth-service');
const cryptoVault = require('../utils/crypto-vault');
const { validateHost } = require('../utils/sanitizer');
const executionDriver = require('../engine/execution-driver');

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

  // 1. List environments (optional query.app filter & query.archived)
  if (req.method === 'GET' && pathname === '/api/environments') {
    let envs = [];
    const archivedVal = query?.archived === 'true' ? 1 : 0;
    if (query?.app) {
      envs = db.prepare(`
        SELECT ae.*, a.name as app_name, a.display_name as app_display_name
        FROM application_environments ae
        JOIN applications a ON ae.application_id = a.id
        WHERE (ae.application_id = ? OR a.name = ?) AND ae.is_archived = ?
        ORDER BY ae.is_production ASC, ae.name ASC
      `).all(query.app, query.app, archivedVal);
    } else {
      envs = db.prepare(`
        SELECT ae.*, a.name as app_name, a.display_name as app_display_name
        FROM application_environments ae
        JOIN applications a ON ae.application_id = a.id
        WHERE ae.is_archived = ?
        ORDER BY a.name ASC, ae.is_production ASC, ae.name ASC
      `).all(archivedVal);

      // Fallback if application_environments is empty
      if (envs.length === 0) {
        envs = db.prepare('SELECT * FROM environments ORDER BY is_production ASC, name ASC').all();
      }
    }

    const sanitized = envs.map(sanitizeEnv);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(sanitized));
    return true;
  }

  // 2. Test Connection endpoint: POST /api/environments/:id/test-connection
  const testMatch = pathname.match(/^\/api\/environments\/([a-zA-Z0-9_\-]+)\/test-connection$/);
  if (req.method === 'POST' && testMatch) {
    const envId = testMatch[1];
    let env = db.prepare('SELECT * FROM application_environments WHERE id = ? OR name = ?').get(envId, envId);
    if (!env) {
      env = db.prepare('SELECT * FROM environments WHERE id = ? OR name = ?').get(envId, envId);
    }
    if (!env) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Environment not found' }));
      return true;
    }

    executionDriver.testSshConnection(env).then(result => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    }).catch(err => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    });
    return true;
  }

  // 3. Create new application environment: POST /api/environments
  if (req.method === 'POST' && pathname === '/api/environments') {
    if (!authService.hasRole(user, ['admin'])) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Admin role required to create environments' }));
      return true;
    }

    const {
      application_id,
      name,
      display_name,
      is_production = 0,
      host = '127.0.0.1',
      ssh_port = 22,
      ssh_user = 'devel',
      auth_type = 'NONE',
      credential,
      app_dir,
      env_file = '.env.production',
      host_port = 4000,
      staging_port = 4001,
      container_port = 3000,
      healthcheck_path = '/',
    } = body || {};

    if (!application_id || !name || !display_name || !app_dir) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing required fields (application_id, name, display_name, app_dir)' }));
      return true;
    }

    const app = db.prepare('SELECT * FROM applications WHERE id = ? OR name = ?').get(application_id, application_id);
    if (!app) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Target application not found' }));
      return true;
    }

    const id = `app-env-${app.name}-${name.toLowerCase().replace(/[^a-z0-9_-]/g, '-')}`;
    const now = new Date().toISOString();
    let encryptedCred = null;
    if (credential && String(credential).trim().length > 0) {
      encryptedCred = cryptoVault.encryptSecret(String(credential).trim());
    }

    try {
      db.prepare(`
        INSERT INTO application_environments (
          id, application_id, name, display_name, is_production,
          host, ssh_port, ssh_user, auth_type, encrypted_credential, credential_updated_at,
          app_dir, env_file, host_port, staging_port, container_port,
          healthcheck_path, healthcheck_max_retries, healthcheck_interval_sec,
          enable_local_verification, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 15, 2, 0, ?, ?)
      `).run(
        id, app.id, name, display_name, is_production ? 1 : 0,
        host, ssh_port, ssh_user, auth_type, encryptedCred, encryptedCred ? now : null,
        app_dir, env_file, host_port, staging_port, container_port,
        healthcheck_path, now, now
      );

      // Compatibility shadow record in environments table
      try {
        db.prepare(`
          INSERT OR IGNORE INTO environments (id, name, display_name, is_production, host, ssh_user, ssh_port, auth_type)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, id, display_name, is_production ? 1 : 0, host, ssh_user, ssh_port, auth_type);
      } catch {}

      // Audit log
      db.prepare(`
        INSERT INTO audit_logs (user_id, username, action, resource_type, resource_id, environment, details, ip_address, created_at)
        VALUES (?, ?, 'ENV_CREATED', 'environment', ?, ?, ?, ?, ?)
      `).run(
        user ? user.id : 'system',
        user ? user.username : 'system',
        id,
        name,
        `Created environment '${name}' for application '${app.name}' on host ${host}`,
        req.socket.remoteAddress || '127.0.0.1',
        now
      );

      const created = db.prepare('SELECT * FROM application_environments WHERE id = ?').get(id);
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(sanitizeEnv(created)));
      return true;
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
      return true;
    }
  }

  // 4. Environment detail
  const singleMatch = pathname.match(/^\/api\/environments\/([a-zA-Z0-9_\-]+)$/);
  if (req.method === 'GET' && singleMatch) {
    const envId = singleMatch[1];
    let env = db.prepare('SELECT * FROM application_environments WHERE id = ? OR name = ?').get(envId, envId);
    if (!env) {
      env = db.prepare('SELECT * FROM environments WHERE id = ? OR name = ?').get(envId, envId);
    }
    if (!env) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Environment not found' }));
      return true;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(sanitizeEnv(env)));
    return true;
  }

  // 5. Update environment configuration (Admin role required)
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
    let existingAppEnv = db.prepare('SELECT * FROM application_environments WHERE id = ? OR name = ?').get(envId, envId);
    let existingLegacyEnv = db.prepare('SELECT * FROM environments WHERE id = ? OR name = ?').get(envId, envId);

    if (!existingAppEnv && !existingLegacyEnv) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Environment not found' }));
      return true;
    }

    const existing = existingAppEnv || existingLegacyEnv;

    const {
      host,
      display_name,
      ssh_user,
      ssh_port,
      auth_type,
      credential,
      app_dir,
      env_file,
      host_port,
      staging_port,
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
      if (existingAppEnv) {
        db.prepare(`
          UPDATE application_environments
          SET host = ?,
              display_name = ?,
              ssh_user = ?,
              ssh_port = ?,
              auth_type = ?,
              app_dir = COALESCE(?, app_dir),
              env_file = COALESCE(?, env_file),
              host_port = COALESCE(?, host_port),
              staging_port = COALESCE(?, staging_port),
              encrypted_credential = CASE WHEN ? = 1 THEN ? ELSE encrypted_credential END,
              credential_updated_at = CASE WHEN ? = 1 THEN ? ELSE credential_updated_at END,
              updated_at = ?
          WHERE id = ?
        `).run(
          targetHost,
          targetDisplayName,
          targetSshUser,
          targetSshPort,
          targetAuthType,
          app_dir || null,
          env_file || null,
          host_port ? parseInt(host_port, 10) : null,
          staging_port ? parseInt(staging_port, 10) : null,
          updateCred,
          encryptedCred,
          updateCred,
          credUpdatedAt,
          now,
          existingAppEnv.id
        );
      }

      if (existingLegacyEnv) {
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
          existingLegacyEnv.id
        );
      }

      // Audit log (never log credentials)
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

      const updated = existingAppEnv
        ? db.prepare('SELECT * FROM application_environments WHERE id = ?').get(existingAppEnv.id)
        : db.prepare('SELECT * FROM environments WHERE id = ?').get(existingLegacyEnv.id);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(sanitizeEnv(updated)));
      return true;
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
      return true;
    }
  }

  // 6. Archive / Restore Environment: PATCH /api/environments/:id/archive
  const envArchiveMatch = pathname.match(/^\/api\/environments\/([a-zA-Z0-9_\-]+)\/archive$/);
  if (req.method === 'PATCH' && envArchiveMatch) {
    if (!authService.hasRole(user, ['admin'])) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Admin role required to archive or restore environments' }));
      return true;
    }

    const envId = envArchiveMatch[1];
    let env = db.prepare('SELECT * FROM application_environments WHERE id = ? OR name = ?').get(envId, envId);
    if (!env) {
      env = db.prepare('SELECT * FROM environments WHERE id = ? OR name = ?').get(envId, envId);
    }
    if (!env) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Environment not found' }));
      return true;
    }

    const targetArchived = body?.is_archived !== undefined ? (body.is_archived ? 1 : 0) : (env.is_archived ? 0 : 1);

    // Active deployment check
    if (targetArchived === 1) {
      const activeDeployments = db.prepare(`
        SELECT COUNT(*) as count FROM deployments 
        WHERE environment_id = ? AND status IN ('QUEUED', 'PREPARING', 'RUNNING', 'VERIFYING', 'CUTTING_OVER', 'ROLLING_BACK')
      `).get(env.id).count;

      if (activeDeployments > 0) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Cannot archive environment while active deployments are in progress' }));
        return true;
      }
    }

    const now = new Date().toISOString();
    db.prepare('UPDATE application_environments SET is_archived = ?, updated_at = ? WHERE id = ?').run(targetArchived, now, env.id);

    const action = targetArchived === 1 ? 'ENV_ARCHIVED' : 'ENV_RESTORED';
    db.prepare(`
      INSERT INTO audit_logs (user_id, username, action, resource_type, resource_id, details, ip_address, created_at)
      VALUES (?, ?, ?, 'environment', ?, ?, ?, ?)
    `).run(user.id, user.username, action, env.id, `${action === 'ENV_ARCHIVED' ? 'Archived' : 'Restored'} environment ${env.name}`, req.socket.remoteAddress || '127.0.0.1', now);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, is_archived: targetArchived, id: env.id, name: env.name }));
    return true;
  }

  // 7. Delete environment: DELETE /api/environments/:id
  if (req.method === 'DELETE' && singleMatch) {
    if (!authService.hasRole(user, ['admin'])) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Admin role required to delete environments' }));
      return true;
    }
    const envId = singleMatch[1];
    let env = db.prepare('SELECT * FROM application_environments WHERE id = ? OR name = ?').get(envId, envId);
    if (!env) {
      env = db.prepare('SELECT * FROM environments WHERE id = ? OR name = ?').get(envId, envId);
    }
    if (!env) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Environment not found' }));
      return true;
    }

    // Active deployment check
    const activeDeployments = db.prepare(`
      SELECT COUNT(*) as count FROM deployments 
      WHERE environment_id = ? AND status IN ('QUEUED', 'PREPARING', 'RUNNING', 'VERIFYING', 'CUTTING_OVER', 'ROLLING_BACK')
    `).get(env.id).count;

    if (activeDeployments > 0) {
      res.writeHead(409, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Cannot delete environment while active deployments are in progress' }));
      return true;
    }

    const now = new Date().toISOString();
    db.prepare('DELETE FROM application_environments WHERE id = ?').run(env.id);
    db.prepare('DELETE FROM environments WHERE id = ?').run(env.id);

    db.prepare(`
      INSERT INTO audit_logs (user_id, username, action, resource_type, resource_id, details, ip_address, created_at)
      VALUES (?, ?, 'ENV_PURGED', 'environment', ?, ?, ?, ?)
    `).run(user.id, user.username, env.id, `Permanently deleted environment ${env.name}`, req.socket.remoteAddress || '127.0.0.1', now);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: `Environment ${env.name} deleted` }));
    return true;
  }

  return false;
}

module.exports = { handleEnvRoutes };
