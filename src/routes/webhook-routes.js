/**
 * Pipra Webhook Ingestion & GitOps Routes
 * Handles event-driven triggers from GitHub and GitLab with HMAC validation,
 * branch policy filtering, and automatic deployment dispatching.
 */

const { getDatabase } = require('../db/database');
const authService = require('../auth/auth-service');
const deploymentRunner = require('../engine/deployment-runner');
const cryptoVault = require('../utils/crypto-vault');
const { extractBranchFromRef, isBranchPermitted, validateBranch } = require('../utils/sanitizer');
const logger = require('../utils/logger');

function generateId(prefix = 'wh') {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  const dateStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const randomHex = Math.random().toString(16).substring(2, 6);
  return `${prefix}-${dateStr}-${randomHex}`;
}

function resolveApplication(db, req, query, body) {
  const appParam = query?.app || query?.application_id || query?.application;
  if (appParam) {
    const app = db.prepare('SELECT * FROM applications WHERE (id = ? OR name = ?) AND is_archived = 0').get(appParam, appParam);
    if (app) return app;
  }

  // Auto-detect from repository clone_url or full_name in webhook payload
  const repoName = body?.repository?.name;
  const repoFullName = body?.repository?.full_name;
  const cloneUrl = body?.repository?.clone_url || body?.repository?.git_http_url;

  if (repoName) {
    const appByName = db.prepare('SELECT * FROM applications WHERE (name = ? OR display_name = ?) AND is_archived = 0').get(repoName, repoName);
    if (appByName) return appByName;
  }

  if (cloneUrl) {
    const appByRepo = db.prepare('SELECT * FROM applications WHERE repo_url = ? AND is_archived = 0').get(cloneUrl);
    if (appByRepo) return appByRepo;
  }

  if (repoFullName) {
    const appByLike = db.prepare('SELECT * FROM applications WHERE repo_url LIKE ? AND is_archived = 0').get(`%${repoFullName}%`);
    if (appByLike) return appByLike;
  }

  return null;
}

function resolveTargetEnvironment(db, app, branch) {
  // 1. Explicit auto_deploy_environment_id
  if (app.auto_deploy_environment_id) {
    const explicitEnv = db.prepare('SELECT * FROM application_environments WHERE id = ? AND application_id = ? AND is_archived = 0').get(app.auto_deploy_environment_id, app.id);
    if (explicitEnv) return explicitEnv;
  }

  // 2. Environment with exact matching name as branch (e.g. branch 'devel' -> env 'devel')
  const nameMatch = db.prepare('SELECT * FROM application_environments WHERE application_id = ? AND (name = ? OR name = ?) AND is_archived = 0').get(app.id, branch, `env-${branch}`);
  if (nameMatch) return nameMatch;

  // 3. First non-production environment
  const nonProd = db.prepare('SELECT * FROM application_environments WHERE application_id = ? AND is_production = 0 AND is_archived = 0 ORDER BY name ASC').get(app.id);
  if (nonProd) return nonProd;

  // 4. Default / first environment
  return db.prepare('SELECT * FROM application_environments WHERE application_id = ? AND is_archived = 0 ORDER BY is_production ASC, name ASC').get(app.id);
}

function logWebhookEvent(db, {
  application_id,
  provider,
  event_type,
  delivery_id,
  branch,
  commit_sha,
  commit_message,
  author,
  status,
  rejection_reason,
  deployment_id,
}) {
  const id = generateId('wh');
  const now = new Date().toISOString();

  try {
    db.prepare(`
      INSERT INTO webhook_events (
        id, application_id, provider, event_type, delivery_id,
        branch, commit_sha, commit_message, author,
        status, rejection_reason, deployment_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      application_id,
      provider,
      event_type || 'unknown',
      delivery_id || null,
      branch || null,
      commit_sha ? commit_sha.substring(0, 40) : null,
      commit_message ? commit_message.substring(0, 200) : null,
      author || null,
      status,
      rejection_reason || null,
      deployment_id || null,
      now
    );
  } catch (err) {
    logger.warn('Failed to insert webhook event record:', err.message);
  }

  return id;
}

function handleWebhookRoutes(req, res, pathname, query, body, user, rawBody) {
  const db = getDatabase();

  // -------------------------------------------------------------
  // 1. GET /api/applications/:id/webhooks - Recent delivery events
  // -------------------------------------------------------------
  const listMatch = pathname.match(/^\/api\/applications\/([a-zA-Z0-9_\-]+)\/webhooks$/);
  if (req.method === 'GET' && listMatch) {
    const appId = listMatch[1];
    const app = db.prepare('SELECT * FROM applications WHERE id = ? OR name = ?').get(appId, appId);
    if (!app) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Application not found' }));
      return true;
    }

    const events = db.prepare(`
      SELECT w.*, d.status as deployment_status, d.duration_ms as deployment_duration_ms
      FROM webhook_events w
      LEFT JOIN deployments d ON w.deployment_id = d.id
      WHERE w.application_id = ?
      ORDER BY w.created_at DESC LIMIT 25
    `).all(app.id);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(events));
    return true;
  }

  // --------------------------------------------------------------------------
  // 2. POST /api/applications/:id/webhooks/regenerate-secret - Rotate Secret
  // --------------------------------------------------------------------------
  const rotateMatch = pathname.match(/^\/api\/applications\/([a-zA-Z0-9_\-]+)\/webhooks\/regenerate-secret$/);
  if (req.method === 'POST' && rotateMatch) {
    if (!authService.hasRole(user, ['admin'])) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Admin role required to generate or rotate webhook secrets' }));
      return true;
    }

    const appId = rotateMatch[1];
    const app = db.prepare('SELECT * FROM applications WHERE id = ? OR name = ?').get(appId, appId);
    if (!app) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Application not found' }));
      return true;
    }

    const newSecret = cryptoVault.generateRandomSecret(32);
    const encryptedSecret = cryptoVault.encryptSecret(newSecret);
    const now = new Date().toISOString();

    db.prepare(`
      UPDATE applications 
      SET webhook_secret = ?, updated_at = ?
      WHERE id = ?
    `).run(encryptedSecret, now, app.id);

    db.prepare(`
      INSERT INTO audit_logs (user_id, username, action, resource_type, resource_id, details, ip_address, created_at)
      VALUES (?, ?, 'WEBHOOK_SECRET_ROTATED', 'application', ?, 'Rotated webhook HMAC secret', ?, ?)
    `).run(user.id, user.username, app.id, req.socket.remoteAddress || '127.0.0.1', now);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      message: 'New webhook secret generated. Copy it now; the plaintext secret will not be displayed again.',
      secret: newSecret,
    }));
    return true;
  }

  // -------------------------------------------------------------
  // 3. POST /api/webhooks/github - Ingest GitHub Webhook
  // -------------------------------------------------------------
  if (req.method === 'POST' && pathname === '/api/webhooks/github') {
    const deliveryId = req.headers['x-github-delivery'];
    const eventType = req.headers['x-github-event'] || 'unknown';
    const signature = req.headers['x-hub-signature-256'];

    const app = resolveApplication(db, req, query, body);
    if (!app) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Target application not found for webhook' }));
      return true;
    }

    // Ping event handshake
    if (eventType === 'ping') {
      logWebhookEvent(db, {
        application_id: app.id,
        provider: 'GITHUB',
        event_type: 'ping',
        delivery_id: deliveryId,
        status: 'ACCEPTED',
        commit_message: body?.zen || 'GitHub Webhook Ping',
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'pong',
        message: 'Pipra GitHub webhook listener active and healthy',
        application: app.name,
      }));
      return true;
    }

    // Check if webhooks are enabled for this application
    if (!app.webhook_enabled) {
      logWebhookEvent(db, {
        application_id: app.id,
        provider: 'GITHUB',
        event_type: eventType,
        delivery_id: deliveryId,
        status: 'IGNORED',
        rejection_reason: 'Webhooks are disabled for this application',
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ignored', reason: 'Webhooks disabled for this application' }));
      return true;
    }

    // Cryptographic HMAC Verification
    if (app.webhook_secret) {
      let decryptedSecret = null;
      try {
        decryptedSecret = cryptoVault.decryptSecret(app.webhook_secret);
      } catch (err) {
        logger.error(`Failed to decrypt webhook secret for app ${app.name}: ${err.message}`);
      }

      const isValid = decryptedSecret && cryptoVault.verifyHmacSha256(rawBody || JSON.stringify(body || {}), signature, decryptedSecret);
      if (!isValid) {
        logWebhookEvent(db, {
          application_id: app.id,
          provider: 'GITHUB',
          event_type: eventType,
          delivery_id: deliveryId,
          status: 'REJECTED',
          rejection_reason: 'Invalid or missing HMAC SHA-256 signature',
        });

        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid HMAC signature (X-Hub-Signature-256 mismatch)' }));
        return true;
      }
    }

    // We only trigger deployment on 'push' events
    if (eventType !== 'push') {
      logWebhookEvent(db, {
        application_id: app.id,
        provider: 'GITHUB',
        event_type: eventType,
        delivery_id: deliveryId,
        status: 'IGNORED',
        rejection_reason: `Event type '${eventType}' is not configured for automatic deployment`,
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ignored', reason: `Event type '${eventType}' ignored; only 'push' triggers releases` }));
      return true;
    }

    // Extract Git details
    const branch = extractBranchFromRef(body?.ref);
    if (!branch || !validateBranch(branch)) {
      logWebhookEvent(db, {
        application_id: app.id,
        provider: 'GITHUB',
        event_type: eventType,
        delivery_id: deliveryId,
        branch: body?.ref,
        status: 'REJECTED',
        rejection_reason: `Invalid git branch ref format: '${body?.ref}'`,
      });

      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid branch ref format' }));
      return true;
    }

    // Branch policy check: permitted_branches
    if (app.permitted_branches && !isBranchPermitted(branch, app.permitted_branches)) {
      logWebhookEvent(db, {
        application_id: app.id,
        provider: 'GITHUB',
        event_type: eventType,
        delivery_id: deliveryId,
        branch,
        status: 'IGNORED',
        rejection_reason: `Branch '${branch}' is not permitted by application policy`,
      });

      res.writeHead(202, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ignored', reason: `Branch '${branch}' is not permitted by application policy` }));
      return true;
    }

    // Auto-deploy branch check (if specified)
    if (app.auto_deploy_branch && app.auto_deploy_branch !== '*' && app.auto_deploy_branch !== branch) {
      logWebhookEvent(db, {
        application_id: app.id,
        provider: 'GITHUB',
        event_type: eventType,
        delivery_id: deliveryId,
        branch,
        status: 'IGNORED',
        rejection_reason: `Branch '${branch}' does not match auto_deploy_branch '${app.auto_deploy_branch}'`,
      });

      res.writeHead(202, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ignored', reason: `Branch '${branch}' does not match configured auto_deploy_branch '${app.auto_deploy_branch}'` }));
      return true;
    }

    // Target environment resolution
    const targetEnv = resolveTargetEnvironment(db, app, branch);
    if (!targetEnv) {
      logWebhookEvent(db, {
        application_id: app.id,
        provider: 'GITHUB',
        event_type: eventType,
        delivery_id: deliveryId,
        branch,
        status: 'REJECTED',
        rejection_reason: 'No configured environment found for application',
      });

      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'No target environment configured for application' }));
      return true;
    }

    // Concurrency lock check
    if (deploymentRunner.isTargetBusy(app.id, targetEnv.id)) {
      logWebhookEvent(db, {
        application_id: app.id,
        provider: 'GITHUB',
        event_type: eventType,
        delivery_id: deliveryId,
        branch,
        status: 'BUSY',
        rejection_reason: `Target environment '${targetEnv.name}' is already running an active deployment`,
      });

      res.writeHead(202, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'skipped', reason: `Target environment '${targetEnv.name}' is busy` }));
      return true;
    }

    // Commit details
    const commitSha = body?.after || body?.head_commit?.id || body?.commits?.[0]?.id || 'HEAD';
    const commitMessage = body?.head_commit?.message || body?.commits?.[0]?.message || 'Automated deployment via GitHub webhook';
    const author = body?.head_commit?.author?.name || body?.pusher?.name || body?.sender?.login || 'GitHub Webhook';

    const deploymentId = generateId('dep');
    const imageTag = `git-${commitSha.substring(0, 7)}`;
    const now = new Date().toISOString();

    // Create deployment record
    db.prepare(`
      INSERT INTO deployments (
        id, application_id, environment_id, branch, image_tag, container_name,
        status, current_stage, current_stage_name, initiated_by,
        commit_sha, commit_message, author, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'QUEUED', 1, 'Preflight Validation', ?, ?, ?, ?, ?)
    `).run(
      deploymentId,
      app.id,
      targetEnv.id,
      branch,
      imageTag,
      app.name,
      `webhook:github (${author})`,
      commitSha,
      commitMessage,
      author,
      now
    );

    // Record accepted webhook event
    logWebhookEvent(db, {
      application_id: app.id,
      provider: 'GITHUB',
      event_type: eventType,
      delivery_id: deliveryId,
      branch,
      commit_sha: commitSha,
      commit_message: commitMessage,
      author,
      status: 'ACCEPTED',
      deployment_id: deploymentId,
    });

    // Dispatch background execution
    deploymentRunner.startDeployment(deploymentId, { skipPull: false });

    logger.info(`GitOps: Triggered deployment ${deploymentId} for ${app.name} (${branch}@${commitSha.substring(0, 7)}) on env ${targetEnv.name}`);

    res.writeHead(202, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'queued',
      deploymentId,
      application: app.name,
      environment: targetEnv.name,
      branch,
      commitSha,
    }));
    return true;
  }

  // -------------------------------------------------------------
  // 4. POST /api/webhooks/gitlab - Ingest GitLab Webhook
  // -------------------------------------------------------------
  if (req.method === 'POST' && pathname === '/api/webhooks/gitlab') {
    const gitlabToken = req.headers['x-gitlab-token'];
    const eventType = req.headers['x-gitlab-event'] || 'Push Hook';

    const app = resolveApplication(db, req, query, body);
    if (!app) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Target application not found for webhook' }));
      return true;
    }

    if (!app.webhook_enabled) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ignored', reason: 'Webhooks disabled for this application' }));
      return true;
    }

    // Secret check for GitLab token
    if (app.webhook_secret) {
      let decryptedSecret = null;
      try {
        decryptedSecret = cryptoVault.decryptSecret(app.webhook_secret);
      } catch {}

      if (!decryptedSecret || gitlabToken !== decryptedSecret) {
        logWebhookEvent(db, {
          application_id: app.id,
          provider: 'GITLAB',
          event_type: eventType,
          status: 'REJECTED',
          rejection_reason: 'Invalid X-Gitlab-Token header',
        });

        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid GitLab webhook token' }));
        return true;
      }
    }

    const branch = extractBranchFromRef(body?.ref);
    if (!branch || !validateBranch(branch)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid branch ref format' }));
      return true;
    }

    if (app.permitted_branches && !isBranchPermitted(branch, app.permitted_branches)) {
      res.writeHead(202, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ignored', reason: `Branch '${branch}' is not permitted` }));
      return true;
    }

    const targetEnv = resolveTargetEnvironment(db, app, branch);
    if (!targetEnv || deploymentRunner.isTargetBusy(app.id, targetEnv.id)) {
      res.writeHead(202, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'skipped', reason: 'Target environment busy or unavailable' }));
      return true;
    }

    const commitSha = body?.after || body?.checkout_sha || 'HEAD';
    const commitMessage = body?.commits?.[0]?.message || 'Automated deployment via GitLab webhook';
    const author = body?.user_name || body?.user_username || 'GitLab Webhook';

    const deploymentId = generateId('dep');
    const imageTag = `git-${commitSha.substring(0, 7)}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO deployments (
        id, application_id, environment_id, branch, image_tag, container_name,
        status, current_stage, current_stage_name, initiated_by,
        commit_sha, commit_message, author, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'QUEUED', 1, 'Preflight Validation', ?, ?, ?, ?, ?)
    `).run(
      deploymentId,
      app.id,
      targetEnv.id,
      branch,
      imageTag,
      app.name,
      `webhook:gitlab (${author})`,
      commitSha,
      commitMessage,
      author,
      now
    );

    logWebhookEvent(db, {
      application_id: app.id,
      provider: 'GITLAB',
      event_type: eventType,
      branch,
      commit_sha: commitSha,
      commit_message: commitMessage,
      author,
      status: 'ACCEPTED',
      deployment_id: deploymentId,
    });

    deploymentRunner.startDeployment(deploymentId, { skipPull: false });

    res.writeHead(202, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'queued',
      deploymentId,
      application: app.name,
      environment: targetEnv.name,
      branch,
      commitSha,
    }));
    return true;
  }

  return false;
}

module.exports = {
  handleWebhookRoutes,
  resolveApplication,
  resolveTargetEnvironment,
  logWebhookEvent,
};
