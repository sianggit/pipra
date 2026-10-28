/**
 * Pipra Deployments API & Real-time SSE Streaming Routes
 */

const { getDatabase } = require('../db/database');
const authService = require('../auth/auth-service');
const deploymentRunner = require('../engine/deployment-runner');
const logStream = require('../engine/log-stream');
const { validateBranch, validateTag, validateContainerName } = require('../utils/sanitizer');
const { STAGES } = require('../engine/state-machine');

function handleDeploymentRoutes(req, res, pathname, query, body, user) {
  const db = getDatabase();

  // 1. List deployments
  if (req.method === 'GET' && pathname === '/api/deployments') {
    const limit = Math.min(parseInt(query.limit || '50', 10), 100);
    const offset = Math.max(parseInt(query.offset || '0', 10), 0);
    const appFilter = query.app;
    const envFilter = query.env;
    const statusFilter = query.status;

    let sql = `
      SELECT d.*, a.name as app_name, a.display_name as app_display_name,
             e.name as env_name, e.display_name as env_display_name, e.is_production
      FROM deployments d
      JOIN applications a ON d.application_id = a.id
      JOIN environments e ON d.environment_id = e.id
      WHERE 1=1
    `;
    const params = [];

    if (appFilter) {
      sql += ' AND (d.application_id = ? OR a.name = ?)';
      params.push(appFilter, appFilter);
    }
    if (envFilter) {
      sql += ' AND (d.environment_id = ? OR e.name = ?)';
      params.push(envFilter, envFilter);
    }
    if (statusFilter) {
      sql += ' AND d.status = ?';
      params.push(statusFilter);
    }

    sql += ' ORDER BY d.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const deployments = db.prepare(sql).all(...params);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(deployments));
    return true;
  }

  // 2. Trigger new deployment
  if (req.method === 'POST' && pathname === '/api/deployments') {
    if (!authService.hasRole(user, ['admin', 'operator'])) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Operator or Admin permissions required to trigger deployments' }));
      return true;
    }

    const {
      application_id,
      environment_id,
      branch,
      tag,
      container_name,
      confirm_production,
      enable_local_verification = false,
      simulate_staging_failure = false,
      simulate_prod_failure = false,
    } = body || {};

    if (!application_id || !environment_id || !branch || !tag) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing required parameters (application_id, environment_id, branch, tag)' }));
      return true;
    }

    if (!validateBranch(branch)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid branch format' }));
      return true;
    }

    if (!validateTag(tag)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid tag format' }));
      return true;
    }

    const app = db.prepare('SELECT * FROM applications WHERE id = ? OR name = ?').get(application_id, application_id);
    if (!app) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Application not found' }));
      return true;
    }

    const env = db.prepare('SELECT * FROM environments WHERE id = ? OR name = ?').get(environment_id, environment_id);
    if (!env) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Environment not found' }));
      return true;
    }

    // Production safety barrier
    if (env.is_production && !confirm_production) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Explicit production confirmation is required for production deployments' }));
      return true;
    }

    // Concurrency conflict check
    if (deploymentRunner.isTargetBusy(app.id, env.id)) {
      res.writeHead(409, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `A deployment is already running for application '${app.name}' in environment '${env.name}'` }));
      return true;
    }

    const targetContainerName = container_name || app.name;
    if (!validateContainerName(targetContainerName)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid container name format' }));
      return true;
    }

    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const dateStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const randomHex = Math.random().toString(16).substring(2, 6);
    const deploymentId = `pipra-deploy-${dateStr}-${randomHex}`;

    // Record deployment in database
    db.prepare(`
      INSERT INTO deployments (
        id, application_id, environment_id, status, initiated_by,
        branch, image_tag, container_name, current_stage, current_stage_name,
        created_at, started_at
      ) VALUES (?, ?, ?, 'QUEUED', ?, ?, ?, ?, 1, 'Preflight Validation', ?, ?)
    `).run(
      deploymentId,
      app.id,
      env.id,
      user ? user.username : 'system',
      branch,
      tag,
      targetContainerName,
      now.toISOString(),
      now.toISOString()
    );

    // Initialize all 10 stages in PENDING status
    for (const stage of STAGES) {
      db.prepare(`
        INSERT INTO deployment_stages (deployment_id, stage_number, stage_name, status)
        VALUES (?, ?, ?, 'PENDING')
      `).run(deploymentId, stage.number, stage.name);
    }

    // Audit log
    db.prepare(`
      INSERT INTO audit_logs (user_id, username, action, resource_type, resource_id, environment, details, ip_address, created_at)
      VALUES (?, ?, 'DEPLOY_TRIGGERED', 'deployment', ?, ?, ?, ?, ?)
    `).run(
      user ? user.id : 'unknown',
      user ? user.username : 'system',
      deploymentId,
      env.name,
      `Triggered deployment for ${app.name} (${branch}@${tag})`,
      req.socket.remoteAddress || '127.0.0.1',
      now.toISOString()
    );

    // Launch worker
    deploymentRunner.startDeployment(deploymentId, {
      enableLocalVerification: enable_local_verification,
      simulateStagingFailure: simulate_staging_failure,
      simulateProdFailure: simulate_prod_failure,
    });

    res.writeHead(201, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ deploymentId, status: 'QUEUED', message: 'Deployment queued and persistent worker started' }));
    return true;
  }

  // 3. Deployment Detail
  const detailMatch = pathname.match(/^\/api\/deployments\/([a-zA-Z0-9_\-]+)$/);
  if (req.method === 'GET' && detailMatch) {
    const deploymentId = detailMatch[1];
    const deployment = db.prepare(`
      SELECT d.*, a.name as app_name, a.display_name as app_display_name, a.repo_url, a.app_dir, a.dockerfile, a.host_port, a.staging_port,
             e.name as env_name, e.display_name as env_display_name, e.is_production
      FROM deployments d
      JOIN applications a ON d.application_id = a.id
      JOIN environments e ON d.environment_id = e.id
      WHERE d.id = ?
    `).get(deploymentId);

    if (!deployment) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Deployment not found' }));
      return true;
    }

    const stages = db.prepare('SELECT * FROM deployment_stages WHERE deployment_id = ? ORDER BY stage_number ASC').all(deploymentId);
    const probes = db.prepare('SELECT * FROM health_probes WHERE deployment_id = ? ORDER BY id ASC').all(deploymentId);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ...deployment,
      stages,
      probes,
    }));
    return true;
  }

  // 4. Cancel Deployment
  const cancelMatch = pathname.match(/^\/api\/deployments\/([a-zA-Z0-9_\-]+)\/cancel$/);
  if (req.method === 'POST' && cancelMatch) {
    if (!authService.hasRole(user, ['admin', 'operator'])) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Operator or Admin permissions required to cancel deployments' }));
      return true;
    }

    const deploymentId = cancelMatch[1];
    const result = deploymentRunner.cancelDeployment(deploymentId, user ? user.username : 'Operator');
    if (!result.success) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
      return true;
    }

    // Audit
    db.prepare(`
      INSERT INTO audit_logs (user_id, username, action, resource_type, resource_id, details, ip_address, created_at)
      VALUES (?, ?, 'DEPLOY_CANCELLED', 'deployment', ?, ?, ?, ?)
    `).run(user.id, user.username, deploymentId, `Cancelled deployment ${deploymentId}`, req.socket.remoteAddress || '127.0.0.1', new Date().toISOString());

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'Deployment cancelled' }));
    return true;
  }

  // 5. Server-Sent Events (SSE) Streaming
  const eventsMatch = pathname.match(/^\/api\/deployments\/([a-zA-Z0-9_\-]+)\/events$/);
  if (req.method === 'GET' && eventsMatch) {
    const deploymentId = eventsMatch[1];
    const deployment = db.prepare('SELECT id FROM deployments WHERE id = ?').get(deploymentId);
    if (!deployment) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Deployment not found' }));
      return true;
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    res.write('\n');

    logStream.addClient(deploymentId, res, db);
    return true;
  }

  // 6. Retrieve Logs
  const logsMatch = pathname.match(/^\/api\/deployments\/([a-zA-Z0-9_\-]+)\/logs$/);
  if (req.method === 'GET' && logsMatch) {
    const deploymentId = logsMatch[1];
    const stage = query.stage ? parseInt(query.stage, 10) : null;
    let sql = 'SELECT * FROM deployment_logs WHERE deployment_id = ?';
    const params = [deploymentId];
    if (stage) {
      sql += ' AND stage_number = ?';
      params.push(stage);
    }
    sql += ' ORDER BY id ASC';

    const logs = db.prepare(sql).all(...params);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(logs));
    return true;
  }

  // 7. Export Logs as text
  const exportMatch = pathname.match(/^\/api\/deployments\/([a-zA-Z0-9_\-]+)\/logs\/export$/);
  if (req.method === 'GET' && exportMatch) {
    const deploymentId = exportMatch[1];
    const logs = db.prepare('SELECT * FROM deployment_logs WHERE deployment_id = ? ORDER BY id ASC').all(deploymentId);
    const text = logs.map(l => `[${l.timestamp}] [Stage ${l.stage_number}] [${l.level.toUpperCase()}] ${l.message}`).join('\n');

    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Disposition': `attachment; filename="${deploymentId}.log"`,
    });
    res.end(text);
    return true;
  }

  return false;
}

module.exports = { handleDeploymentRoutes };
