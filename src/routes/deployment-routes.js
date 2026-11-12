/**
 * Pipra Deployments API & Real-time SSE Streaming Routes
 */

const { getDatabase } = require('../db/database');
const authService = require('../auth/auth-service');
const deploymentRunner = require('../engine/deployment-runner');
const logStream = require('../engine/log-stream');
const { validateBranch, validateTag, validateContainerName, isBranchPermitted } = require('../utils/sanitizer');
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
             COALESCE(ae.name, e.name) as env_name,
             COALESCE(ae.display_name, e.display_name) as env_display_name,
             COALESCE(ae.is_production, e.is_production) as is_production
      FROM deployments d
      JOIN applications a ON d.application_id = a.id
      LEFT JOIN application_environments ae ON d.environment_id = ae.id
      LEFT JOIN environments e ON d.environment_id = e.id
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
      image_tag,
      container_name,
      confirm_production,
      operator_confirmed,
      enable_local_verification = false,
      verify_on_host = false,
      simulate_staging_failure = false,
      simulate_prod_failure = false,
    } = body || {};

    const resolvedTag = tag || image_tag;
    const resolvedConfirmProduction = Boolean(confirm_production || operator_confirmed);
    const resolvedLocalVerification = Boolean(enable_local_verification || verify_on_host);

    if (!application_id || !environment_id || !branch || !resolvedTag) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Missing required parameters (application_id, environment_id, branch, tag)' }));
      return true;
    }

    if (!validateBranch(branch)) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Invalid branch format' }));
      return true;
    }

    if (!validateTag(resolvedTag)) {
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

    // Validate branch against application's permitted branches policy
    if (app.permitted_branches && !isBranchPermitted(branch, app.permitted_branches)) {
      let permittedList = [];
      try {
        permittedList = typeof app.permitted_branches === 'string' ? JSON.parse(app.permitted_branches) : app.permitted_branches;
      } catch {}
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: `Branch '${branch}' is not permitted for application '${app.name}'. Permitted branches: ${permittedList.join(', ')}`,
      }));
      return true;
    }

    let env = db.prepare('SELECT * FROM application_environments WHERE (id = ? OR name = ?) AND application_id = ?').get(environment_id, environment_id, app.id);
    if (!env) {
      env = db.prepare('SELECT * FROM application_environments WHERE id = ? OR name = ?').get(environment_id, environment_id);
    }
    if (!env) {
      env = db.prepare('SELECT * FROM environments WHERE id = ? OR name = ?').get(environment_id, environment_id);
    }
    if (!env) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Environment not found' }));
      return true;
    }

    // Production safety barrier
    if (env.is_production && !resolvedConfirmProduction) {
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

    const requiresApproval = Boolean(env.is_production || env.requires_approval || body.requires_approval);

    // Record deployment in database
    db.prepare(`
      INSERT INTO deployments (
        id, application_id, environment_id, status, initiated_by,
        branch, image_tag, container_name, current_stage, current_stage_name,
        requires_approval, created_at, started_at
      ) VALUES (?, ?, ?, 'QUEUED', ?, ?, ?, ?, 1, 'Preflight Validation', ?, ?, ?)
    `).run(
      deploymentId,
      app.id,
      env.id,
      user ? user.username : 'system',
      branch,
      resolvedTag,
      targetContainerName,
      requiresApproval ? 1 : 0,
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
      `Triggered deployment for ${app.name} (${branch}@${resolvedTag})`,
      req.socket.remoteAddress || '127.0.0.1',
      now.toISOString()
    );

    // Launch worker
    deploymentRunner.startDeployment(deploymentId, {
      enableLocalVerification: resolvedLocalVerification,
      simulateStagingFailure: simulate_staging_failure,
      simulateProdFailure: simulate_prod_failure,
      requiresApproval,
      approvalTimeoutMinutes: body.approval_timeout_minutes,
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
             COALESCE(ae.name, e.name) as env_name,
             COALESCE(ae.display_name, e.display_name) as env_display_name,
             COALESCE(ae.is_production, e.is_production) as is_production,
             COALESCE(ae.host, e.host) as env_host
      FROM deployments d
      JOIN applications a ON d.application_id = a.id
      LEFT JOIN application_environments ae ON d.environment_id = ae.id
      LEFT JOIN environments e ON d.environment_id = e.id
      WHERE d.id = ?
    `).get(deploymentId);

    if (!deployment) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Deployment not found' }));
      return true;
    }

    const stages = db.prepare('SELECT * FROM deployment_stages WHERE deployment_id = ? ORDER BY stage_number ASC').all(deploymentId);
    const probes = db.prepare('SELECT * FROM health_probes WHERE deployment_id = ? ORDER BY id ASC').all(deploymentId);
    const provenance = db.prepare('SELECT id, commit_sha, image_digest, signature, signer_key_id, verified_at, created_at FROM provenance_records WHERE deployment_id = ?').get(deploymentId);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      ...deployment,
      stages,
      probes,
      provenance: provenance || null,
    }));
    return true;
  }

  // 3b. Provenance Attestation Export
  const provMatch = pathname.match(/^\/api\/deployments\/([a-zA-Z0-9_\-]+)\/provenance$/);
  if (req.method === 'GET' && provMatch) {
    const deploymentId = provMatch[1];
    const provRecord = db.prepare('SELECT * FROM provenance_records WHERE deployment_id = ?').get(deploymentId);
    if (!provRecord) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Provenance attestation not found for this deployment' }));
      return true;
    }

    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="provenance-${deploymentId}.json"`,
    });
    res.end(provRecord.attestation_json);
    return true;
  }

  // 3c. Provenance Attestation Verification Endpoint
  const provVerifyMatch = pathname.match(/^\/api\/deployments\/([a-zA-Z0-9_\-]+)\/provenance\/verify$/);
  if (req.method === 'POST' && provVerifyMatch) {
    const deploymentId = provVerifyMatch[1];
    const provRecord = db.prepare('SELECT * FROM provenance_records WHERE deployment_id = ?').get(deploymentId);
    if (!provRecord) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Provenance attestation not found for this deployment' }));
      return true;
    }

    const provenanceVault = require('../engine/provenance-vault');
    const verification = provenanceVault.verifyAttestationSignature(provRecord.attestation_json, provRecord.signature);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      deploymentId,
      provenanceId: provRecord.id,
      valid: verification.valid,
      error: verification.error || null,
      commitSha: provRecord.commit_sha,
      imageDigest: provRecord.image_digest,
      signerKeyId: provRecord.signer_key_id,
      verifiedAt: new Date().toISOString(),
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

  // 4b. Approve Deployment (Stage 6 -> Stage 7 promotion gate)
  const approveMatch = pathname.match(/^\/api\/deployments\/([a-zA-Z0-9_\-]+)\/approve$/);
  if (req.method === 'POST' && approveMatch) {
    if (!authService.hasRole(user, ['admin', 'operator'])) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Operator or Admin permissions required to approve deployments' }));
      return true;
    }

    const deploymentId = approveMatch[1];
    const deployment = db.prepare('SELECT * FROM deployments WHERE id = ?').get(deploymentId);
    if (!deployment) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Deployment not found' }));
      return true;
    }

    if (deployment.status !== 'WAITING_FOR_APPROVAL') {
      res.writeHead(409, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `Deployment is not awaiting approval (current status: ${deployment.status})` }));
      return true;
    }

    // Two-Person Rule Constraint: Initiator cannot approve production cutover unless explicitly overridden
    const isInitiator = user && deployment.initiated_by && (user.username === deployment.initiated_by);
    const allowSelfApproval = Boolean(body?.allow_self_approval || query?.allow_self_approval);
    if (isInitiator && !allowSelfApproval) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Two-Person Rule violation: Initiator cannot approve production cutover' }));
      return true;
    }

    const result = deploymentRunner.approveDeployment(deploymentId, user, body?.comments);
    if (!result.success) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
      return true;
    }

    // Audit log
    db.prepare(`
      INSERT INTO audit_logs (user_id, username, action, resource_type, resource_id, environment, details, ip_address, created_at)
      VALUES (?, ?, 'DEPLOYMENT_APPROVED', 'deployment', ?, ?, ?, ?, ?)
    `).run(
      user ? user.id : 'unknown',
      user ? user.username : 'system',
      deploymentId,
      deployment.environment_id || 'production',
      `Approved production cutover for ${deploymentId}${body?.comments ? `: ${body.comments}` : ''}`,
      req.socket.remoteAddress || '127.0.0.1',
      new Date().toISOString()
    );

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, message: 'Deployment approved; production cutover in progress' }));
    return true;
  }

  // 4c. Reject Deployment
  const rejectMatch = pathname.match(/^\/api\/deployments\/([a-zA-Z0-9_\-]+)\/reject$/);
  if (req.method === 'POST' && rejectMatch) {
    if (!authService.hasRole(user, ['admin', 'operator'])) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Operator or Admin permissions required to reject deployments' }));
      return true;
    }

    const deploymentId = rejectMatch[1];
    const deployment = db.prepare('SELECT * FROM deployments WHERE id = ?').get(deploymentId);
    if (!deployment) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Deployment not found' }));
      return true;
    }

    if (deployment.status !== 'WAITING_FOR_APPROVAL') {
      res.writeHead(409, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `Deployment is not awaiting approval (current status: ${deployment.status})` }));
      return true;
    }

    Promise.resolve(deploymentRunner.rejectDeployment(deploymentId, user, body?.reason)).then(result => {
      if (!result.success) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(result));
        return;
      }

      // Audit log
      db.prepare(`
        INSERT INTO audit_logs (user_id, username, action, resource_type, resource_id, environment, details, ip_address, created_at)
        VALUES (?, ?, 'DEPLOYMENT_REJECTED', 'deployment', ?, ?, ?, ?, ?)
      `).run(
        user ? user.id : 'unknown',
        user ? user.username : 'system',
        deploymentId,
        deployment.environment_id || 'production',
        `Rejected production cutover for ${deploymentId}${body?.reason ? `: ${body.reason}` : ''}`,
        req.socket.remoteAddress || '127.0.0.1',
        new Date().toISOString()
      );

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, message: 'Deployment rejected and cancelled' }));
    }).catch(err => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    });
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
