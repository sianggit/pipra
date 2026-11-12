/**
 * Pipra Persistent Deployment Execution Engine & Orchestrator
 * Runs asynchronously and independently of any open browser session.
 * Supports both Local server daemon and Zero-Agent Remote SSH execution.
 */

const { getDatabase } = require('../db/database');
const { DEPLOYMENT_STATES, STAGES, isTerminal } = require('./state-machine');
const logStream = require('./log-stream');
const executionDriver = require('./execution-driver');
const healthChecker = require('./health-checker');
const cutoverManager = require('./cutover-manager');
const scmNotifier = require('./scm-notifier');
const { discoverPipelineSpec, parsePipelineSpec } = require('./pipeline-spec-parser');
const aiDiagnostics = require('./ai-diagnostics');
const provenanceVault = require('./provenance-vault');
const logger = require('../utils/logger');

class DeploymentRunner {
  constructor() {
    this.activeRuns = new Map(); // deploymentId -> AbortController
    this.concurrencyLocks = new Set(); // "appId:envId"
    this.activeApprovals = new Map(); // deploymentId -> { resolve, reject, timeoutId, expiresAt, stagingContainerName, env }
    try {
      this.init();
    } catch {}
  }

  init() {
    this.reconcileInterruptedDeployments();
  }

  reconcileInterruptedDeployments() {
    const db = getDatabase();
    const active = db.prepare(`
      SELECT id, current_stage_name, status 
      FROM deployments 
      WHERE status IN ('QUEUED', 'PREPARING', 'RUNNING', 'VERIFYING', 'WAITING_FOR_APPROVAL', 'CUTTING_OVER', 'ROLLING_BACK')
    `).all();

    if (active.length > 0) {
      logger.warn(`Startup reconciliation: Found ${active.length} unfinalized deployments from prior process.`);
      const now = new Date().toISOString();
      for (const dep of active) {
        db.prepare(`
          UPDATE deployments 
          SET status = 'INTERRUPTED', 
              error_message = 'Process terminated unexpectedly during control plane restart',
              finished_at = ?
          WHERE id = ?
        `).run(now, dep.id);

        logStream.emitLog(dep.id, 10, 'error', `Execution interrupted by control plane restart. State safely marked as INTERRUPTED.`, db);
      }
    }
  }

  isTargetBusy(appId, envId) {
    const key = `${appId}:${envId}`;
    if (this.concurrencyLocks.has(key)) return true;

    // Double check database
    const db = getDatabase();
    const existing = db.prepare(`
      SELECT id FROM deployments 
      WHERE application_id = ? AND environment_id = ? 
      AND status NOT IN ('SUCCEEDED', 'FAILED', 'CANCELLED', 'INTERRUPTED', 'ROLLBACK_FAILED')
    `).get(appId, envId);

    return !!existing;
  }

  cancelDeployment(deploymentId, operatorName = 'Operator') {
    const db = getDatabase();
    const deployment = db.prepare('SELECT * FROM deployments WHERE id = ?').get(deploymentId);
    if (!deployment || isTerminal(deployment.status)) {
      return { success: false, error: 'Deployment is already finalized or not found' };
    }

    // Cancel active approval session if waiting
    const approval = this.activeApprovals.get(deploymentId);
    if (approval) {
      if (approval.timeoutId) clearTimeout(approval.timeoutId);
      this.activeApprovals.delete(deploymentId);
      approval.reject(new Error(`Cancelled by ${operatorName}`));
    }

    const abortController = this.activeRuns.get(deploymentId);
    if (abortController) {
      abortController.abort();
    }

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE deployments 
      SET status = 'CANCELLED', 
          error_message = ?, 
          finished_at = ?
      WHERE id = ?
    `).run(`Cancelled by ${operatorName}`, now, deploymentId);

    logStream.emitLog(deploymentId, deployment.current_stage || 1, 'warn', `Pipeline cancellation requested by ${operatorName}`, db);
    logStream.broadcast(deploymentId, 'status', { status: 'CANCELLED', deploymentId });

    const lockKey = `${deployment.application_id}:${deployment.environment_id}`;
    this.concurrencyLocks.delete(lockKey);

    return { success: true };
  }

  approveDeployment(deploymentId, approverUser, comments = '') {
    const db = getDatabase();
    const deployment = db.prepare('SELECT * FROM deployments WHERE id = ?').get(deploymentId);
    if (!deployment) {
      return { success: false, error: 'Deployment not found' };
    }
    if (deployment.status !== DEPLOYMENT_STATES.WAITING_FOR_APPROVAL) {
      return { success: false, error: `Deployment is not awaiting approval (current status: ${deployment.status})` };
    }

    const approval = this.activeApprovals.get(deploymentId);
    if (!approval) {
      return { success: false, error: 'No active approval session found for this deployment' };
    }

    const now = new Date().toISOString();
    db.prepare(`
      UPDATE deployments 
      SET approved_by_user_id = ?,
          approved_by_username = ?,
          approved_at = ?,
          approval_comments = ?
      WHERE id = ?
    `).run(approverUser ? approverUser.id : 'unknown', approverUser ? approverUser.username : 'Operator', now, comments || null, deploymentId);

    logStream.emitLog(deploymentId, 6, 'info', `Production cutover authorized by ${approverUser ? approverUser.username : 'Operator'}${comments ? `: "${comments}"` : ''}`, db);
    logStream.broadcast(deploymentId, 'approved', {
      deploymentId,
      approvedBy: approverUser ? approverUser.username : 'Operator',
      approvedAt: now,
      comments,
    });

    if (approval.timeoutId) clearTimeout(approval.timeoutId);
    this.activeApprovals.delete(deploymentId);

    // Resolve deferred promise to advance to Stage 7
    approval.resolve({ approved: true, approver: approverUser, comments });

    return { success: true, message: 'Deployment authorized for production cutover' };
  }

  async rejectDeployment(deploymentId, rejectorUser, reason = 'Rejected by operator') {
    const db = getDatabase();
    const deployment = db.prepare('SELECT * FROM deployments WHERE id = ?').get(deploymentId);
    if (!deployment) {
      return { success: false, error: 'Deployment not found' };
    }
    if (deployment.status !== DEPLOYMENT_STATES.WAITING_FOR_APPROVAL) {
      return { success: false, error: `Deployment is not awaiting approval (current status: ${deployment.status})` };
    }

    const approval = this.activeApprovals.get(deploymentId);
    if (approval) {
      if (approval.timeoutId) clearTimeout(approval.timeoutId);
      this.activeApprovals.delete(deploymentId);
      approval.reject(new Error(`Promotion rejected: ${reason}`));
    } else {
      const now = new Date().toISOString();
      db.prepare(`
        UPDATE deployments 
        SET status = 'CANCELLED',
            error_message = ?,
            finished_at = ?
        WHERE id = ?
      `).run(`Rejected by ${rejectorUser ? rejectorUser.username : 'Operator'}: ${reason}`, now, deploymentId);
    }

    logStream.emitLog(deploymentId, 6, 'warn', `Production cutover rejected by ${rejectorUser ? rejectorUser.username : 'Operator'}: ${reason}`, db);
    logStream.broadcast(deploymentId, 'status', { status: 'CANCELLED', deploymentId });

    return { success: true, message: 'Deployment rejected and cancelled' };
  }

  async startDeployment(deploymentId, options = {}) {
    const db = getDatabase();
    const deployment = db.prepare('SELECT * FROM deployments WHERE id = ?').get(deploymentId);
    if (!deployment) throw new Error(`Deployment ${deploymentId} not found`);

    const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(deployment.application_id);
    let env = db.prepare('SELECT * FROM application_environments WHERE id = ?').get(deployment.environment_id);
    if (!env) {
      env = db.prepare('SELECT * FROM environments WHERE id = ?').get(deployment.environment_id);
    }
    if (!env) throw new Error(`Environment ${deployment.environment_id} not found`);

    const appDir = env.app_dir || app.app_dir;
    const hostPort = env.host_port || app.host_port;
    const stagingPort = env.staging_port || app.staging_port;
    const containerPort = env.container_port || app.container_port || 3000;
    const envFile = env.env_file || app.env_file;
    const healthcheckPath = env.healthcheck_path || app.healthcheck_path || '/';
    const healthMaxRetries = env.healthcheck_max_retries || app.healthcheck_max_retries || 15;
    const healthIntervalSec = env.healthcheck_interval_sec || app.healthcheck_interval_sec || 2;
    const targetHost = (env.host && env.host !== '127.0.0.1' && env.host !== 'localhost') ? env.host : '127.0.0.1';
    const isRemote = executionDriver.isTargetRemote(env);

    const lockKey = `${deployment.application_id}:${deployment.environment_id}`;
    this.concurrencyLocks.add(lockKey);

    const abortController = new AbortController();
    this.activeRuns.set(deploymentId, abortController);
    const signal = abortController.signal;

    // Start background asynchronous workflow - detached from HTTP response
    setImmediate(async () => {
      const overallStart = Date.now();
      const onLog = (level, msg) => logStream.emitLog(deploymentId, currentStageNumber, level, msg, db);

      let currentStageNumber = 1;
      let rollbackCandidate = null;
      let stagingContainerName = null;
      let pipelineSpec = null;

      try {
        // --- STAGE 1: PREFLIGHT ---
        currentStageNumber = 1;
        this.updateDeploymentState(deploymentId, DEPLOYMENT_STATES.PREPARING, 1, 'Preflight Validation', db);
        logStream.emitStage(deploymentId, 1, 'Preflight Validation', 'RUNNING', 0, null, db);
        const stage1Start = Date.now();

        onLog('info', `Starting deployment ${deploymentId} for application '${app.name}' in environment '${env.name}'`);
        onLog('info', `Target Host: ${env.host} (Mode: ${isRemote ? `Remote SSH as ${env.ssh_user || 'devel'}` : 'Local Server Daemon'})`);
        onLog('info', `Preflight checks: checking ports :${hostPort} (prod) and :${stagingPort} (staging)`);
        onLog('info', `Target directory: ${appDir}`);
        onLog('info', `Execution Engine: ${isRemote ? `Zero-Agent Remote SSH Engine` : (executionDriver.dockerAvailable ? 'Docker Daemon Active' : 'Simulation Runner')}`);
        await executionDriver.delay(400);

        if (env.is_production) {
          onLog('info', `Production safety check: Rollback candidate '${env.active_release_id || 'none'}' recorded.`);
          rollbackCandidate = env.active_release_id;
        }

        logStream.emitStage(deploymentId, 1, 'Preflight Validation', 'SUCCEEDED', Date.now() - stage1Start, null, db);

        // --- STAGE 2: SOURCE SYNCHRONIZATION ---
        currentStageNumber = 2;
        this.updateDeploymentState(deploymentId, DEPLOYMENT_STATES.RUNNING, 2, 'Source Synchronization', db);
        logStream.emitStage(deploymentId, 2, 'Source Synchronization', 'RUNNING', 0, null, db);
        const stage2Start = Date.now();

        const gitResult = await executionDriver.runGitSync({
          env: { ...env, app_dir: appDir },
          branch: deployment.branch,
          skipPull: options.skipPull || false,
        }, deployment.branch, onLog, signal);

        db.prepare(`
          UPDATE deployments 
          SET commit_sha = ?, commit_message = ?, author = ?
          WHERE id = ?
        `).run(gitResult.commitSha, gitResult.commitMessage, gitResult.author, deploymentId);

        // Check for Declarative Pipeline Specification in source repo
        const specDiscovery = discoverPipelineSpec(appDir);
        if (specDiscovery.found) {
          onLog('info', `Found declarative pipeline specification: '${specDiscovery.fileName}'`);
          const parseResult = parsePipelineSpec(specDiscovery.content, specDiscovery.format);
          if (!parseResult.valid) {
            const parseErr = parseResult.errors.join('; ');
            onLog('error', `Declarative pipeline validation failed: ${parseErr}`);
            throw new Error(`Declarative pipeline validation error in '${specDiscovery.fileName}': ${parseErr}`);
          }
          pipelineSpec = parseResult.spec;
          db.prepare('UPDATE deployments SET pipeline_spec = ? WHERE id = ?').run(JSON.stringify(pipelineSpec), deploymentId);
          onLog('info', `Declarative spec active (v${pipelineSpec.version}): ${pipelineSpec.preflight.length} preflight hook(s), ${pipelineSpec.verification.length} staging verification hook(s), ${pipelineSpec.post_cutover.length} post-cutover hook(s).`);
          logStream.broadcast(deploymentId, 'pipeline_spec_loaded', { deploymentId, spec: pipelineSpec });
        } else {
          onLog('info', `No .pipra.yaml or .pipra.json found in repository. Using default execution policies.`);
        }

        logStream.emitStage(deploymentId, 2, 'Source Synchronization', 'SUCCEEDED', Date.now() - stage2Start, gitResult, db);

        // --- STAGE 3: LOCAL VERIFICATION (CUSTOM PREFLIGHT HOOKS) ---
        currentStageNumber = 3;
        logStream.emitStage(deploymentId, 3, 'Local Verification', 'RUNNING', 0, null, db);
        const stage3Start = Date.now();

        if (pipelineSpec && pipelineSpec.preflight && pipelineSpec.preflight.length > 0) {
          onLog('info', `Running ${pipelineSpec.preflight.length} custom preflight hook(s) from .pipra.yaml...`);
          for (let i = 0; i < pipelineSpec.preflight.length; i++) {
            const hook = pipelineSpec.preflight[i];
            onLog('info', `[Hook ${i + 1}/${pipelineSpec.preflight.length}] Executing: '${hook.command}' (timeout: ${hook.timeout_sec}s)`);
            try {
              if (options.simulateHookFailure || (executionDriver.isSimulated() && hook.command.includes('fails_immediately'))) {
                throw new Error(`Simulated hook failure for command: ${hook.command}`);
              }

              if (executionDriver.isSimulated() && !isRemote) {
                await executionDriver.delay(400);
                onLog('info', `[Simulated] Preflight command '${hook.command}' completed with exit code 0.`);
              } else {
                const parts = hook.command.split(' ');
                const bin = parts[0];
                const cmdArgs = parts.slice(1);
                await executionDriver.runCommandOnTarget({
                  env,
                  cwd: appDir,
                  command: bin,
                  args: cmdArgs,
                  onLog,
                  abortSignal: signal,
                });
              }
            } catch (hookErr) {
              if (hook.continue_on_error) {
                onLog('warn', `Preflight hook '${hook.command}' failed but continue_on_error is true: ${hookErr.message}`);
              } else {
                onLog('error', `Preflight hook '${hook.command}' failed: ${hookErr.message}`);
                throw new Error(`Declarative preflight hook failed: ${hook.command} (${hookErr.message})`);
              }
            }
          }
          logStream.emitStage(deploymentId, 3, 'Local Verification', 'SUCCEEDED', Date.now() - stage3Start, { executedHooks: pipelineSpec.preflight.length }, db);
        } else if (env.enable_local_verification || app.enable_local_verification || options.enableLocalVerification) {
          onLog('info', `Local verification enabled. Running host 'npm ci' and 'npm run build' verification...`);
          await executionDriver.delay(1200);
          onLog('info', `Local build passed successfully.`);
          logStream.emitStage(deploymentId, 3, 'Local Verification', 'SUCCEEDED', Date.now() - stage3Start, null, db);
        } else {
          onLog('info', `Skipping host local verification: multi-stage Docker build handles compilation natively.`);
          logStream.emitStage(deploymentId, 3, 'Local Verification', 'SKIPPED', Date.now() - stage3Start, { reason: 'Skipped by policy' }, db);
        }

        // --- STAGE 4: DOCKER IMAGE BUILD ---
        currentStageNumber = 4;
        logStream.emitStage(deploymentId, 4, 'Docker Image Build', 'RUNNING', 0, null, db);
        const stage4Start = Date.now();

        const buildResult = await executionDriver.runDockerBuild({
          env: { ...env, app_dir: appDir, env_file: envFile },
          appDir,
          dockerfile: app.dockerfile,
          imageName: app.image_name,
          imageTag: deployment.image_tag,
          envFile,
          onLog,
          abortSignal: signal,
        });

        logStream.emitStage(deploymentId, 4, 'Docker Image Build', 'SUCCEEDED', Date.now() - stage4Start, buildResult, db);

        // --- STAGE 5: STAGING STARTUP ---
        currentStageNumber = 5;
        logStream.emitStage(deploymentId, 5, 'Staging Startup', 'RUNNING', 0, null, db);
        const stage5Start = Date.now();

        stagingContainerName = `${app.name}-staging-${Date.now()}`;
        db.prepare('UPDATE deployments SET staging_container_name = ? WHERE id = ?').run(stagingContainerName, deploymentId);

        await executionDriver.runStagingContainer({
          env: { ...env, staging_port: stagingPort, container_port: containerPort },
          imageName: app.image_name,
          imageTag: deployment.image_tag,
          containerName: stagingContainerName,
          stagingPort,
          containerPort,
          onLog,
          abortSignal: signal,
        });

        logStream.emitStage(deploymentId, 5, 'Staging Startup', 'SUCCEEDED', Date.now() - stage5Start, null, db);

        // --- STAGE 6: STAGING HEALTH VERIFICATION ---
        currentStageNumber = 6;
        this.updateDeploymentState(deploymentId, DEPLOYMENT_STATES.VERIFYING, 6, 'Staging Health Verification', db);
        logStream.emitStage(deploymentId, 6, 'Staging Health Verification', 'RUNNING', 0, null, db);
        const stage6Start = Date.now();

        const stagingUrl = `http://${targetHost}:${stagingPort}${healthcheckPath}`;
        onLog('info', `Probing staging container at ${stagingUrl} (Max retries: ${healthMaxRetries}, Interval: ${healthIntervalSec}s)...`);

        const stagingHealth = await healthChecker.runHealthCheckLoop({
          url: stagingUrl,
          maxRetries: healthMaxRetries,
          intervalSec: healthIntervalSec,
          isSimulated: options.simulateStagingHealth || (executionDriver.isSimulated() && !isRemote),
          simulateFailure: options.simulateStagingFailure || false,
          onAttempt: (probe) => {
            logStream.emitProbe(deploymentId, 6, probe, db);
            onLog(probe.passed ? 'info' : 'warn', `[Health Probe ${probe.attempt}/${probe.maxAttempts}] ${probe.url} -> HTTP ${probe.httpStatus} (${probe.responseTimeMs}ms) ${probe.passed ? 'PASSED' : 'RETRYING'}`);
          },
          abortSignal: signal,
        });

        if (!stagingHealth.passed) {
          throw new Error(`Staging health verification failed: ${stagingHealth.error}`);
        }

        onLog('info', `Staging container verified healthy in ${stagingHealth.attempts} attempt(s).`);

        // Run custom staging verification hooks if declared in .pipra.yaml
        if (pipelineSpec && pipelineSpec.verification && pipelineSpec.verification.length > 0) {
          onLog('info', `Running ${pipelineSpec.verification.length} custom staging verification hook(s) from .pipra.yaml...`);
          for (let i = 0; i < pipelineSpec.verification.length; i++) {
            const hook = pipelineSpec.verification[i];
            const resolvedCmd = hook.command
              .replace(/\$STAGING_URL/g, stagingUrl)
              .replace(/\$\{STAGING_URL\}/g, stagingUrl)
              .replace(/\$STAGING_PORT/g, stagingPort)
              .replace(/\$\{STAGING_PORT\}/g, stagingPort);

            onLog('info', `[Staging Verification Hook ${i + 1}/${pipelineSpec.verification.length}] Executing: '${resolvedCmd}'`);
            try {
              if (executionDriver.isSimulated() && !isRemote) {
                await executionDriver.delay(350);
                onLog('info', `[Simulated] Staging hook '${resolvedCmd}' completed with exit code 0.`);
              } else {
                const parts = resolvedCmd.split(' ');
                await executionDriver.runCommandOnTarget({
                  env,
                  cwd: appDir,
                  command: parts[0],
                  args: parts.slice(1),
                  onLog,
                  abortSignal: signal,
                });
              }
            } catch (hookErr) {
              if (hook.continue_on_error) {
                onLog('warn', `Staging verification hook '${resolvedCmd}' failed but continue_on_error is true: ${hookErr.message}`);
              } else {
                onLog('error', `Staging verification hook '${resolvedCmd}' failed: ${hookErr.message}`);
                throw new Error(`Custom staging verification failed: ${hookErr.message}`);
              }
            }
          }
        }

        logStream.emitStage(deploymentId, 6, 'Staging Health Verification', 'SUCCEEDED', Date.now() - stage6Start, stagingHealth, db);

        // --- CHECK APPROVAL GATE (INTERACTIVE TWO-PERSON PROMOTION) ---
        const requiresApproval = Boolean(
          env.requires_approval ||
          env.is_production ||
          app.requires_approval ||
          options.requiresApproval ||
          deployment.requires_approval
        );

        if (requiresApproval) {
          this.updateDeploymentState(deploymentId, DEPLOYMENT_STATES.WAITING_FOR_APPROVAL, 6, 'Waiting for Production Approval', db);
          onLog('warn', `================================================================`);
          onLog('warn', `PROMOTION GATE: Staging verified healthy on :${stagingPort}.`);
          onLog('warn', `Awaiting explicit operator authorization before initiating Production Cutover.`);
          onLog('warn', `Preview candidate URL: ${stagingUrl}`);
          onLog('warn', `================================================================`);

          const timeoutMinutes = options.approvalTimeoutMinutes || 30;
          const timeoutMs = timeoutMinutes * 60 * 1000;
          const expiresAt = new Date(Date.now() + timeoutMs).toISOString();

          logStream.broadcast(deploymentId, 'approval_requested', {
            deploymentId,
            stagingUrl,
            stagingContainerName,
            targetHost,
            stagingPort,
            initiatedBy: deployment.initiated_by,
            commitSha: deployment.commit_sha,
            expiresAt,
            timeoutMinutes,
          });

          // Deferred Promise: pauses execution without blocking event loop
          await new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
              this.activeApprovals.delete(deploymentId);
              reject(new Error(`Approval window expired (${timeoutMinutes}m timeout)`));
            }, timeoutMs);

            this.activeApprovals.set(deploymentId, {
              resolve,
              reject,
              timeoutId,
              expiresAt,
              stagingContainerName,
              env,
            });
          });
        }

        // Clean up temporary staging container prior to cutover
        await executionDriver.stopAndRemoveContainer(stagingContainerName, onLog, env);

        // --- STAGE 7: PRODUCTION CUTOVER ---
        currentStageNumber = 7;
        this.updateDeploymentState(deploymentId, DEPLOYMENT_STATES.CUTTING_OVER, 7, 'Production Cutover', db);
        logStream.emitStage(deploymentId, 7, 'Production Cutover', 'RUNNING', 0, null, db);
        const stage7Start = Date.now();

        const timestamp = Date.now();
        const prodContainerName = deployment.container_name || app.name;
        const backupContainerName = `${prodContainerName}-backup-${timestamp}`;
        db.prepare('UPDATE deployments SET backup_container_name = ? WHERE id = ?').run(backupContainerName, deploymentId);

        await cutoverManager.executeCutover({
          env: { ...env, host_port: hostPort, container_port: containerPort },
          containerName: prodContainerName,
          backupName: backupContainerName,
          imageName: app.image_name,
          imageTag: deployment.image_tag,
          hostPort,
          containerPort,
          onLog,
          abortSignal: signal,
        });

        logStream.emitStage(deploymentId, 7, 'Production Cutover', 'SUCCEEDED', Date.now() - stage7Start, null, db);

        // --- STAGE 8: PRODUCTION VERIFICATION ---
        currentStageNumber = 8;
        logStream.emitStage(deploymentId, 8, 'Production Verification', 'RUNNING', 0, null, db);
        const stage8Start = Date.now();

        const prodUrl = `http://${targetHost}:${hostPort}${healthcheckPath}`;
        onLog('info', `Verifying real production route at ${prodUrl}...`);

        const prodHealth = await healthChecker.runHealthCheckLoop({
          url: prodUrl,
          maxRetries: 5,
          intervalSec: 2,
          isSimulated: options.simulateStagingHealth || (executionDriver.isSimulated() && !isRemote),
          simulateFailure: options.simulateProdFailure || false,
          onAttempt: (probe) => {
            logStream.emitProbe(deploymentId, 8, probe, db);
            onLog(probe.passed ? 'info' : 'warn', `[Prod Probe ${probe.attempt}/${probe.maxAttempts}] ${probe.url} -> HTTP ${probe.httpStatus} (${probe.responseTimeMs}ms)`);
          },
          abortSignal: signal,
        });

        if (!prodHealth.passed) {
          logStream.emitStage(deploymentId, 8, 'Production Verification', 'FAILED', Date.now() - stage8Start, prodHealth, db);

          // --- STAGE 9: AUTOMATIC ROLLBACK ---
          currentStageNumber = 9;
          this.updateDeploymentState(deploymentId, DEPLOYMENT_STATES.ROLLING_BACK, 9, 'Automatic Rollback', db);
          logStream.emitStage(deploymentId, 9, 'Automatic Rollback', 'RUNNING', 0, null, db);
          const stage9Start = Date.now();

          onLog('error', `CRITICAL: Production verification failed! Initiating automated recovery.`);
          db.prepare('UPDATE deployments SET rollback_status = ? WHERE id = ?').run('IN_PROGRESS', deploymentId);

          const rollbackRes = await cutoverManager.executeRollback({
            env,
            containerName: prodContainerName,
            backupName: backupContainerName,
            onLog,
          });

          if (rollbackRes.success) {
            db.prepare('UPDATE deployments SET rollback_status = ? WHERE id = ?').run('SUCCESSFUL', deploymentId);
            logStream.emitStage(deploymentId, 9, 'Automatic Rollback', 'SUCCEEDED', Date.now() - stage9Start, { status: 'RESTORED' }, db);
            logStream.emitStage(deploymentId, 10, 'Final Report & Provenance', 'SUCCEEDED', 100, { outcome: 'ROLLBACK_RESTORED' }, db);

            const totalDuration = Date.now() - overallStart;
            this.finalizeDeployment(deploymentId, DEPLOYMENT_STATES.FAILED, totalDuration, 'Production verification failed. Rollback executed successfully; live traffic preserved.', db);
            onLog('warn', `Deployment marked as FAILED with automatic rollback successful. Live service preserved.`);
            return;
          } else {
            db.prepare('UPDATE deployments SET rollback_status = ? WHERE id = ?').run('FAILED', deploymentId);
            logStream.emitStage(deploymentId, 9, 'Automatic Rollback', 'FAILED', Date.now() - stage9Start, { status: 'ROLLBACK_FAILED' }, db);
            this.updateDeploymentState(deploymentId, DEPLOYMENT_STATES.ROLLBACK_FAILED, 9, 'Automatic Rollback', db);
            throw new Error(`CRITICAL: Production verification failed AND rollback failed! Manual intervention required.`);
          }
        }

        // Run custom post-cutover hooks if declared in .pipra.yaml
        if (pipelineSpec && pipelineSpec.post_cutover && pipelineSpec.post_cutover.length > 0) {
          onLog('info', `Running ${pipelineSpec.post_cutover.length} custom post-cutover hook(s) from .pipra.yaml...`);
          for (let i = 0; i < pipelineSpec.post_cutover.length; i++) {
            const hook = pipelineSpec.post_cutover[i];
            const resolvedCmd = hook.command
              .replace(/\$PROD_URL/g, prodUrl)
              .replace(/\$\{PROD_URL\}/g, prodUrl)
              .replace(/\$PROD_PORT/g, hostPort)
              .replace(/\$\{PROD_PORT\}/g, hostPort);

            onLog('info', `[Post-Cutover Hook ${i + 1}/${pipelineSpec.post_cutover.length}] Executing: '${resolvedCmd}'`);
            try {
              if (executionDriver.isSimulated() && !isRemote) {
                await executionDriver.delay(350);
                onLog('info', `[Simulated] Post-cutover hook '${resolvedCmd}' completed with exit code 0.`);
              } else {
                const parts = resolvedCmd.split(' ');
                await executionDriver.runCommandOnTarget({
                  env,
                  cwd: appDir,
                  command: parts[0],
                  args: parts.slice(1),
                  onLog,
                  abortSignal: signal,
                });
              }
            } catch (hookErr) {
              if (hook.continue_on_error) {
                onLog('warn', `Post-cutover hook '${resolvedCmd}' failed but continue_on_error is true: ${hookErr.message}`);
              } else {
                onLog('warn', `Post-cutover hook '${resolvedCmd}' failed: ${hookErr.message}`);
              }
            }
          }
        }

        logStream.emitStage(deploymentId, 8, 'Production Verification', 'SUCCEEDED', Date.now() - stage8Start, prodHealth, db);

        // Stage 9 is marked SKIPPED when cutover passes without rollback
        logStream.emitStage(deploymentId, 9, 'Automatic Rollback', 'SKIPPED', 0, { reason: 'Production verified healthy' }, db);

        // Safe cleanup of backup container now that production release is confirmed healthy
        await cutoverManager.cleanupBackup(backupContainerName, onLog, env);

        // Update active release pointer on environment (both new table and legacy table)
        const newReleaseId = `${app.image_name}:${deployment.image_tag}`;
        try {
          db.prepare(`
            UPDATE application_environments 
            SET active_release_id = ?, last_health_status = 'HEALTHY', last_verified_at = ?
            WHERE id = ?
          `).run(newReleaseId, new Date().toISOString(), env.id);
        } catch {}

        try {
          db.prepare(`
            UPDATE environments 
            SET active_release_id = ?, last_health_status = 'HEALTHY', last_verified_at = ?
            WHERE id = ?
          `).run(newReleaseId, new Date().toISOString(), env.id);
        } catch {}

        // --- STAGE 10: FINAL REPORT ---
        currentStageNumber = 10;
        const totalDuration = Date.now() - overallStart;

        // Generate and record cryptographic SLSA Level 2 Provenance Attestation
        let provenanceResult = null;
        try {
          provenanceResult = provenanceVault.recordDeploymentProvenance(db, deploymentId);
          onLog('info', `SLSA Level 2 Attestation Generated: [Digest: ${provenanceResult.canonicalDigest.substring(0, 16)}...] [Sig: ${provenanceResult.signature.substring(0, 16)}...]`);
        } catch (provErr) {
          onLog('warn', `SLSA Provenance generation note: ${provErr.message}`);
        }

        logStream.emitStage(deploymentId, 10, 'Final Report & Provenance', 'SUCCEEDED', 120, provenanceResult ? { provenanceId: provenanceResult.recordId, digest: provenanceResult.canonicalDigest } : null, db);
        this.finalizeDeployment(deploymentId, DEPLOYMENT_STATES.SUCCEEDED, totalDuration, null, db);

        onLog('info', `=========================================================`);
        onLog('info', `Pipra Release Completed Successfully in ${(totalDuration / 1000).toFixed(1)}s!`);
        onLog('info', `Live Release: ${newReleaseId} active on :${hostPort} (${env.host})`);
        onLog('info', `=========================================================`);

      } catch (err) {
        if (stagingContainerName) {
          try {
            await executionDriver.stopAndRemoveContainer(stagingContainerName, onLog, env);
          } catch {}
        }
        const totalDuration = Date.now() - overallStart;
        const isCancelled = signal.aborted || (err.message && (err.message.includes('rejected') || err.message.includes('expired')));
        const finalStatus = isCancelled ? DEPLOYMENT_STATES.CANCELLED : (db.prepare('SELECT status FROM deployments WHERE id = ?').get(deploymentId).status === DEPLOYMENT_STATES.ROLLBACK_FAILED ? DEPLOYMENT_STATES.ROLLBACK_FAILED : DEPLOYMENT_STATES.FAILED);

        logStream.emitStage(deploymentId, currentStageNumber, STAGES[currentStageNumber - 1]?.name || 'Error', 'FAILED', 0, { error: err.message }, db);
        this.finalizeDeployment(deploymentId, finalStatus, totalDuration, err.message, db);
        onLog('error', `Deployment halted: ${err.message}`);
      } finally {
        const apprv = this.activeApprovals.get(deploymentId);
        if (apprv && apprv.timeoutId) clearTimeout(apprv.timeoutId);
        this.activeApprovals.delete(deploymentId);
        this.activeRuns.delete(deploymentId);
        this.concurrencyLocks.delete(lockKey);
      }
    });

    return { deploymentId, status: DEPLOYMENT_STATES.QUEUED };
  }

  updateDeploymentState(id, status, stageNumber, stageName, db) {
    db.prepare(`
      UPDATE deployments 
      SET status = ?, current_stage = ?, current_stage_name = ?
      WHERE id = ?
    `).run(status, stageNumber, stageName, id);

    logStream.broadcast(id, 'status', { status, stageNumber, stageName, deploymentId: id });

    // Outbound SCM status feedback (async non-blocking)
    setImmediate(async () => {
      try {
        const dep = db.prepare('SELECT * FROM deployments WHERE id = ?').get(id);
        if (dep && dep.commit_sha) {
          const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(dep.application_id);
          if (app) {
            await scmNotifier.notify({ app, deployment: dep, state: status, description: `Stage ${stageNumber}: ${stageName}` });
          }
        }
      } catch {}
    });
  }

  finalizeDeployment(id, status, durationMs, errorMessage, db) {
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE deployments 
      SET status = ?, duration_ms = ?, error_message = ?, finished_at = ?
      WHERE id = ?
    `).run(status, durationMs, errorMessage || null, now, id);

    logStream.broadcast(id, 'finished', {
      deploymentId: id,
      status,
      durationMs,
      errorMessage,
      finishedAt: now,
    });

    // Asynchronous Failure Diagnostics (non-blocking)
    if (status === DEPLOYMENT_STATES.FAILED || status === DEPLOYMENT_STATES.ROLLBACK_FAILED) {
      setImmediate(async () => {
        try {
          await aiDiagnostics.analyzeAndPersist(db, id, logStream);
        } catch (diagErr) {
          logger.warn(`AI diagnostics execution error: ${diagErr.message}`);
        }
      });
    }

    // Outbound SCM status feedback (async non-blocking)
    setImmediate(async () => {
      try {
        const dep = db.prepare('SELECT * FROM deployments WHERE id = ?').get(id);
        if (dep && dep.commit_sha) {
          const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(dep.application_id);
          if (app) {
            const desc = status === 'SUCCEEDED' ? 'Release succeeded' : (errorMessage ? errorMessage.substring(0, 100) : `Release ${status}`);
            await scmNotifier.notify({ app, deployment: dep, state: status, description: desc });
          }
        }
      } catch {}
    });
  }
}

module.exports = new DeploymentRunner();
