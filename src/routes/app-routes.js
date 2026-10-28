/**
 * Pipra Application Management Routes
 */

const { getDatabase } = require('../db/database');
const authService = require('../auth/auth-service');
const { validateBranch, validateTag, validateContainerName, validatePort, validateEnvFile } = require('../utils/sanitizer');

function handleAppRoutes(req, res, pathname, query, body, user) {
  const db = getDatabase();

  if (req.method === 'GET' && pathname === '/api/applications') {
    const apps = db.prepare('SELECT * FROM applications ORDER BY name ASC').all();
    const formatted = apps.map(app => {
      let permitted = ['devel', 'main', 'prod'];
      try { permitted = JSON.parse(app.permitted_branches); } catch {}
      return { ...app, permitted_branches: permitted };
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(formatted));
    return true;
  }

  const singleMatch = pathname.match(/^\/api\/applications\/([a-zA-Z0-9_\-]+)$/);
  if (req.method === 'GET' && singleMatch) {
    const appId = singleMatch[1];
    const app = db.prepare('SELECT * FROM applications WHERE id = ? OR name = ?').get(appId, appId);
    if (!app) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Application not found' }));
      return true;
    }
    try { app.permitted_branches = JSON.parse(app.permitted_branches); } catch {}
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(app));
    return true;
  }

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
      dockerfile = 'Dockerfile.jenkins',
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
          container_port, healthcheck_path, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, name, display_name, repo_url, app_dir, default_branch,
        dockerfile, image_name || name, env_file, host_port, staging_port,
        container_port, healthcheck_path, now, now
      );

      // Audit
      db.prepare(`
        INSERT INTO audit_logs (user_id, username, action, resource_type, resource_id, details, ip_address, created_at)
        VALUES (?, ?, 'APP_CREATED', 'application', ?, ?, ?, ?)
      `).run(user.id, user.username, id, `Created application ${name}`, req.socket.remoteAddress || '127.0.0.1', now);

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
