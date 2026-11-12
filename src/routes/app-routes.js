/**
 * Pipra Application Management Routes
 * Supports Application Catalog, CRUD operations, Dual-Stage Archival,
 * and attached application-scoped environments.
 */

const { getDatabase } = require('../db/database');
const authService = require('../auth/auth-service');
const cryptoVault = require('../utils/crypto-vault');
const { validateBranch, validateTag, validateContainerName, validatePort, validateEnvFile } = require('../utils/sanitizer');

function handleAppRoutes(req, res, pathname, query, body, user) {
  const db = getDatabase();

  // 1. List Applications: GET /api/applications
  if (req.method === 'GET' && pathname === '/api/applications') {
    let whereClause = 'WHERE is_archived = 0';
    if (query?.archived === 'true') {
      whereClause = 'WHERE is_archived = 1';
    } else if (query?.include_archived === 'true') {
      whereClause = '';
    }

    const apps = db.prepare(`SELECT * FROM applications ${whereClause} ORDER BY name ASC`).all();
    const formatted = apps.map(app => {
      let permitted = ['develop', 'main', 'prod'];
      try { permitted = JSON.parse(app.permitted_branches); } catch { }
      const envs = db.prepare(`
        SELECT * FROM application_environments 
        WHERE application_id = ? ${query?.archived === 'true' ? '' : 'AND is_archived = 0'}
        ORDER BY is_production ASC, name ASC
      `).all(app.id);

      const { webhook_secret, ...safeApp } = app;
      return {
        ...safeApp,
        has_webhook_secret: !!webhook_secret,
        permitted_branches: permitted,
        environments: envs.map(e => {
          const { encrypted_credential, ...safe } = e;
          return { ...safe, has_credential: !!encrypted_credential };
        }),
      };
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(formatted));
    return true;
  }

  // 2. Archive / Restore Application: PATCH /api/applications/:id/archive
  const archiveMatch = pathname.match(/^\/api\/applications\/([a-zA-Z0-9_\-]+)\/archive$/);
  if (req.method === 'PATCH' && archiveMatch) {
    if (!authService.hasRole(user, ['admin'])) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Admin role required to archive or restore applications' }));
      return true;
    }

    const appId = archiveMatch[1];
    const app = db.prepare('SELECT * FROM applications WHERE id = ? OR name = ?').get(appId, appId);
    if (!app) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Application not found' }));
      return true;
    }

    const targetArchived = body?.is_archived !== undefined ? (body.is_archived ? 1 : 0) : (app.is_archived ? 0 : 1);

    // Active deployment check: cannot archive if deployment is in flight
    if (targetArchived === 1) {
      const activeDeployments = db.prepare(`
        SELECT COUNT(*) as count FROM deployments 
        WHERE application_id = ? AND status IN ('QUEUED', 'PREPARING', 'RUNNING', 'VERIFYING', 'CUTTING_OVER', 'ROLLING_BACK')
      `).get(app.id).count;

      if (activeDeployments > 0) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Cannot archive application while active deployments are in progress' }));
        return true;
      }
    }

    const now = new Date().toISOString();
    db.prepare('UPDATE applications SET is_archived = ?, updated_at = ? WHERE id = ?').run(targetArchived, now, app.id);
    db.prepare('UPDATE application_environments SET is_archived = ?, updated_at = ? WHERE application_id = ?').run(targetArchived, now, app.id);

    const action = targetArchived === 1 ? 'APP_ARCHIVED' : 'APP_RESTORED';
    db.prepare(`
      INSERT INTO audit_logs (user_id, username, action, resource_type, resource_id, details, ip_address, created_at)
      VALUES (?, ?, ?, 'application', ?, ?, ?, ?)
    `).run(user.id, user.username, action, app.id, `${action === 'APP_ARCHIVED' ? 'Archived' : 'Restored'} application ${app.name}`, req.socket.remoteAddress || '127.0.0.1', now);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, is_archived: targetArchived, id: app.id, name: app.name }));
    return true;
  }

  // 3. Single Application Detail: GET /api/applications/:id
  const singleMatch = pathname.match(/^\/api\/applications\/([a-zA-Z0-9_\-]+)$/);
  if (req.method === 'GET' && singleMatch) {
    const appId = singleMatch[1];
    const app = db.prepare('SELECT * FROM applications WHERE id = ? OR name = ?').get(appId, appId);
    if (!app) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Application not found' }));
      return true;
    }
    try { app.permitted_branches = JSON.parse(app.permitted_branches); } catch { }
    const envs = db.prepare('SELECT * FROM application_environments WHERE application_id = ? ORDER BY is_production ASC, name ASC').all(app.id);
    app.environments = envs.map(e => {
      const { encrypted_credential, ...safe } = e;
      return { ...safe, has_credential: !!encrypted_credential };
    });
    app.has_webhook_secret = !!app.webhook_secret;
    delete app.webhook_secret;

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(app));
    return true;
  }

  // 4. Update Application: PUT /api/applications/:id
  if (req.method === 'PUT' && singleMatch) {
    if (!authService.hasRole(user, ['admin'])) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Admin role required to update applications' }));
      return true;
    }

    const appId = singleMatch[1];
    const app = db.prepare('SELECT * FROM applications WHERE id = ? OR name = ?').get(appId, appId);
    if (!app) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Application not found' }));
      return true;
    }

    const {
      display_name,
      repo_url,
      app_dir,
      default_branch,
      permitted_branches,
      dockerfile,
      image_name,
      env_file,
      host_port,
      staging_port,
      container_port,
      healthcheck_path,
      webhook_enabled,
      auto_deploy_branch,
      auto_deploy_environment_id,
      webhook_secret,
    } = body || {};

    if (!display_name || !repo_url || !app_dir) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Display Name, Git Repo URL, and Target App Directory are required' }));
      return true;
    }

    if (host_port && !validatePort(host_port)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid default production port' }));
      return true;
    }

    const now = new Date().toISOString();
    let permittedBranchesJson = app.permitted_branches;
    if (permitted_branches) {
      if (Array.isArray(permitted_branches)) {
        permittedBranchesJson = JSON.stringify(permitted_branches);
      } else if (typeof permitted_branches === 'string') {
        permittedBranchesJson = JSON.stringify(permitted_branches.split(',').map(b => b.trim()).filter(Boolean));
      }
    }

    let encryptedWebhookSecret = undefined;
    if (webhook_secret !== undefined) {
      encryptedWebhookSecret = webhook_secret ? cryptoVault.encryptSecret(webhook_secret) : null;
    }

    try {
      db.prepare(`
        UPDATE applications SET
          display_name = ?,
          repo_url = ?,
          app_dir = ?,
          default_branch = COALESCE(?, default_branch),
          permitted_branches = ?,
          dockerfile = COALESCE(?, dockerfile),
          image_name = COALESCE(?, image_name),
          env_file = COALESCE(?, env_file),
          host_port = COALESCE(?, host_port),
          staging_port = COALESCE(?, staging_port),
          container_port = COALESCE(?, container_port),
          healthcheck_path = COALESCE(?, healthcheck_path),
          webhook_enabled = COALESCE(?, webhook_enabled),
          auto_deploy_branch = COALESCE(?, auto_deploy_branch),
          auto_deploy_environment_id = COALESCE(?, auto_deploy_environment_id),
          webhook_secret = CASE WHEN ? = 1 THEN ? ELSE webhook_secret END,
          updated_at = ?
        WHERE id = ?
      `).run(
        display_name,
        repo_url,
        app_dir,
        default_branch ?? null,
        permittedBranchesJson ?? null,
        dockerfile ?? null,
        image_name ?? null,
        env_file ?? null,
        host_port ? parseInt(host_port, 10) : null,
        staging_port ? parseInt(staging_port, 10) : null,
        container_port ? parseInt(container_port, 10) : null,
        healthcheck_path ?? null,
        webhook_enabled !== undefined ? (webhook_enabled ? 1 : 0) : null,
        auto_deploy_branch ?? null,
        auto_deploy_environment_id ?? null,
        webhook_secret !== undefined ? 1 : 0,
        encryptedWebhookSecret ?? null,
        now,
        app.id
      );

      db.prepare(`
        INSERT INTO audit_logs (user_id, username, action, resource_type, resource_id, details, ip_address, created_at)
        VALUES (?, ?, 'APP_UPDATED', 'application', ?, ?, ?, ?)
      `).run(user.id, user.username, app.id, `Updated application ${app.name} (${display_name})`, req.socket.remoteAddress || '127.0.0.1', now);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, id: app.id, name: app.name, display_name }));
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return true;
  }

  // 5. Permanent Purge Application: DELETE /api/applications/:id
  if (req.method === 'DELETE' && singleMatch) {
    if (!authService.hasRole(user, ['admin'])) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Admin role required to permanently delete applications' }));
      return true;
    }

    const appId = singleMatch[1];
    const app = db.prepare('SELECT * FROM applications WHERE id = ? OR name = ?').get(appId, appId);
    if (!app) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Application not found' }));
      return true;
    }

    const confirmSlug = body?.confirm_slug || query?.confirm_slug;
    if (confirmSlug !== app.name) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `Type "${app.name}" to confirm permanent deletion` }));
      return true;
    }

    // Active deployment check
    const activeDeployments = db.prepare(`
      SELECT COUNT(*) as count FROM deployments 
      WHERE application_id = ? AND status IN ('QUEUED', 'PREPARING', 'RUNNING', 'VERIFYING', 'CUTTING_OVER', 'ROLLING_BACK')
    `).get(app.id).count;

    if (activeDeployments > 0) {
      res.writeHead(409, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Cannot delete application while active deployments are in progress' }));
      return true;
    }

    const now = new Date().toISOString();
    // Cascade delete attached environments and application configuration
    db.prepare('DELETE FROM application_environments WHERE application_id = ?').run(app.id);
    db.prepare('DELETE FROM applications WHERE id = ?').run(app.id);

    db.prepare(`
      INSERT INTO audit_logs (user_id, username, action, resource_type, resource_id, details, ip_address, created_at)
      VALUES (?, ?, 'APP_PURGED', 'application', ?, ?, ?, ?)
    `).run(user.id, user.username, app.id, `Permanently purged application ${app.name}`, req.socket.remoteAddress || '127.0.0.1', now);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: `Application ${app.name} permanently purged` }));
    return true;
  }

  // 6. Register Application: POST /api/applications
  if (req.method === 'POST' && pathname === '/api/applications') {
    if (!authService.hasRole(user, ['admin'])) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Admin role required to register applications' }));
      return true;
    }

    const {
      name,
      display_name,
      repo_url,
      app_dir,
      default_branch = 'devel',
      dockerfile = 'Dockerfile',
      image_name,
      env_file = '.env.development',
      host_port = 4000,
      staging_port = 4001,
      container_port = 3000,
      healthcheck_path = '/',
    } = body || {};

    if (!name || !display_name || !repo_url || !app_dir) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing required application fields' }));
      return true;
    }

    if (!validatePort(host_port) || !validatePort(staging_port)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid port configuration' }));
      return true;
    }

    const id = `app-${name.toLowerCase().replace(/[^a-z0-9_-]/g, '-')}`;
    const now = new Date().toISOString();

    try {
      db.prepare(`
        INSERT INTO applications (
          id, name, display_name, repo_url, app_dir, default_branch,
          dockerfile, image_name, env_file, host_port, staging_port,
          container_port, healthcheck_path, is_archived, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
      `).run(
        id, name, display_name, repo_url, app_dir, default_branch,
        dockerfile, image_name || name, env_file, host_port, staging_port,
        container_port, healthcheck_path, now, now
      );

      // Automatically attach default Development and Production environments for this app
      db.prepare(`
        INSERT INTO application_environments (
          id, application_id, name, display_name, is_production,
          host, ssh_port, ssh_user, auth_type,
          app_dir, env_file, host_port, staging_port, container_port,
          healthcheck_path, healthcheck_max_retries, healthcheck_interval_sec,
          enable_local_verification, is_archived, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, '127.0.0.1', 22, 'devel', 'NONE', ?, ?, ?, ?, ?, ?, 15, 2, 0, 0, ?, ?)
      `).run(
        `app-env-${name}-devel`, id, 'devel', 'Development Host', 0,
        app_dir, env_file, host_port, staging_port, container_port, healthcheck_path, now, now
      );

      db.prepare(`
        INSERT INTO application_environments (
          id, application_id, name, display_name, is_production,
          host, ssh_port, ssh_user, auth_type,
          app_dir, env_file, host_port, staging_port, container_port,
          healthcheck_path, healthcheck_max_retries, healthcheck_interval_sec,
          enable_local_verification, is_archived, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, '127.0.0.1', 22, 'devel', 'NONE', ?, ?, ?, ?, ?, ?, 15, 2, 0, 0, ?, ?)
      `).run(
        `app-env-${name}-prod`, id, 'production', 'Production Host', 1,
        app_dir, env_file.replace('development', 'production'), host_port, staging_port, container_port, healthcheck_path, now, now
      );

      // Audit
      db.prepare(`
        INSERT INTO audit_logs (user_id, username, action, resource_type, resource_id, details, ip_address, created_at)
        VALUES (?, ?, 'APP_CREATED', 'application', ?, ?, ?, ?)
      `).run(user.id, user.username, id, `Created application ${name} with initial environments`, req.socket.remoteAddress || '127.0.0.1', now);

      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ id, name, success: true }));
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return true;
  }

  return false;
}

module.exports = { handleAppRoutes };
