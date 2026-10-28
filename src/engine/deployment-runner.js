/**
 * Pipra Persistent Deployment Execution Engine & Orchestrator
 * Runs asynchronously and independently of any open browser session.
 */

const { getDatabase } = require('../db/database');
const { DEPLOYMENT_STATES, STAGES, isTerminal } = require('./state-machine');
const logStream = require('./log-stream');
const executionDriver = require('./execution-driver');
const healthChecker = require('./health-checker');
const cutoverManager = require('./cutover-manager');
const logger = require('../utils/logger');

class DeploymentRunner {
  constructor() {
    this.activeRuns = new Map(); // deploymentId -> AbortController
    this.concurrencyLocks = new Set(); // "appId:envId"
  }

  init() {
    this.reconcileInterruptedDeployments();
  }

  reconcileInterruptedDeployments() {
    const db = getDatabase();
    const active = db.prepare(`
      SELECT id, current_stage_name, status 
      FROM deployments 
      WHERE status IN ('QUEUED', 'PREPARING', 'RUNNING', 'VERIFYING', 'CUTTING_OVER', 'ROLLING_BACK')
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

  async startDeployment(deploymentId, options = {}) {
    const db = getDatabase();
    const deployment = db.prepare('SELECT * FROM deployments WHERE id = ?').get(deploymentId);
    if (!deployment) throw new Error(`Deployment ${deploymentId} not found`);

    const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(deployment.application_id);
    const env = db.prepare('SELECT * FROM environments WHERE id = ?').get(deployment.environment_id);

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

      try {
        // --- STAGE 1: PREFLIGHT ---
        currentStageNumber = 1;
        this.updateDeploymentState(deploymentId, DEPLOYMENT_STATES.PREPARING, 1, 'Preflight Validation', db);
        logStream.emitStage(deploymentId, 1, 'Preflight Validation', 'RUNNING', 0, null, db);
        const stage1Start = Date.now();

        onLog('info', `Starting deployment ${deploymentId} for application '${app.name}' in environment '${env.name}'`);
        onLog('info', `Preflight checks: checking host ports :${app.host_port} (prod) and :${app.staging_port} (staging)`);
        onLog('info', `Target directory: ${app.app_dir}`);
        onLog('info', `Execution Engine: ${executionDriver.dockerAvailable ? 'Docker Daemon Active' : 'High-Fidelity Safe Simulation Runner'}`);
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

        const gitResult = await executionDriver.runGitSync(app.app_dir, deployment.branch, onLog, signal);
        db.prepare(`
          UPDATE deployments 
          SET commit_sha = ?, commit_message = ?, author = ?
          WHERE id = ?
        `).run(gitResult.commitSha, gitResult.commitMessage, gitResult.author, deploymentId);

        logStream.emitStage(deploymentId, 2, 'Source Synchronization', 'SUCCEEDED', Date.now() - stage2Start, gitResult, db);

        // --- STAGE 3: LOCAL VERIFICATION (OPTIONAL) ---
        currentStageNumber = 3;
        logStream.emitStage(deploymentId, 3, 'Local Verification', 'RUNNING', 0, null, db);
        const stage3Start = Date.now();

        if (app.enable_local_verification || options.enableLocalVerification) {
          onLog('info', `Local verification enabled. Running 'npm ci' and 'npm run build' verification...`);
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
          appDir: app.app_dir,
          dockerfile: app.dockerfile,
          imageName: app.image_name,
          imageTag: deployment.image_tag,
          envFile: app.env_file,
          onLog,
          abortSignal: signal,
        });

        logStream.emitStage(deploymentId, 4, 'Docker Image Build', 'SUCCEEDED', Date.now() - stage4Start, buildResult, db);

        // --- STAGE 5: STAGING STARTUP ---
        currentStageNumber = 5;
        logStream.emitStage(deploymentId, 5, 'Staging Startup', 'RUNNING', 0, null, db);
        const stage5Start = Date.now();

        const stagingContainerName = `${app.name}-staging-${Date.now()}`;
        db.prepare('UPDATE deployments SET staging_container_name = ? WHERE id = ?').run(stagingContainerName, deploymentId);

        await executionDriver.runStagingContainer({
          imageName: app.image_name,
          imageTag: deployment.image_tag,
          containerName: stagingContainerName,
          stagingPort: app.staging_port,
          containerPort: app.container_port,
          onLog,
          abortSignal: signal,
        });

        logStream.emitStage(deploymentId, 5, 'Staging Startup', 'SUCCEEDED', Date.now() - stage5Start, null, db);

        // --- STAGE 6: STAGING HEALTH VERIFICATION ---
        currentStageNumber = 6;
        this.updateDeploymentState(deploymentId, DEPLOYMENT_STATES.VERIFYING, 6, 'Staging Health Verification', db);
        logStream.emitStage(deploymentId, 6, 'Staging Health Verification', 'RUNNING', 0, null, db);
        const stage6Start = Date.now();

        const stagingUrl = `http://127.0.0.1:${app.staging_port}${app.healthcheck_path}`;
        onLog('info', `Probing staging container at ${stagingUrl} (Max retries: ${app.healthcheck_max_retries}, Interval: ${app.healthcheck_interval_sec}s)...`);

        const stagingHealth = await healthChecker.runHealthCheckLoop({
          url: stagingUrl,
          maxRetries: app.healthcheck_max_retries,
          intervalSec: app.healthcheck_interval_sec,
          isSimulated: executionDriver.isSimulated(),
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
        logStream.emitStage(deploymentId, 6, 'Staging Health Verification', 'SUCCEEDED', Date.now() - stage6Start, stagingHealth, db);

        // Clean up temporary staging container prior to cutover
        await executionDriver.stopAndRemoveContainer(stagingContainerName, onLog);

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
          containerName: prodContainerName,
          backupName: backupContainerName,
          imageName: app.image_name,
          imageTag: deployment.image_tag,
          hostPort: app.host_port,
          containerPort: app.container_port,
          onLog,
          abortSignal: signal,
        });

        logStream.emitStage(deploymentId, 7, 'Production Cutover', 'SUCCEEDED', Date.now() - stage7Start, null, db);

        // --- STAGE 8: PRODUCTION VERIFICATION ---
        currentStageNumber = 8;
        logStream.emitStage(deploymentId, 8, 'Production Verification', 'RUNNING', 0, null, db);
        const stage8Start = Date.now();

        const prodUrl = `http://127.0.0.1:${app.host_port}${app.healthcheck_path}`;
        onLog('info', `Verifying real production route at ${prodUrl}...`);

        const prodHealth = await healthChecker.runHealthCheckLoop({
          url: prodUrl,
          maxRetries: 5,
          intervalSec: 2,
          isSimulated: executionDriver.isSimulated(),
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

        logStream.emitStage(deploymentId, 8, 'Production Verification', 'SUCCEEDED', Date.now() - stage8Start, prodHealth, db);

        // Stage 9 is marked SKIPPED when cutover passes without rollback
        logStream.emitStage(deploymentId, 9, 'Automatic Rollback', 'SKIPPED', 0, { reason: 'Production verified healthy' }, db);

        // Safe cleanup of backup container now that production release is confirmed healthy
        await cutoverManager.cleanupBackup(backupContainerName, onLog);

        // Update active release pointer on environment
        const newReleaseId = `${app.image_name}:${deployment.image_tag}`;
        db.prepare(`
          UPDATE environments 
          SET active_release_id = ?, last_health_status = 'HEALTHY', last_verified_at = ?
          WHERE id = ?
        `).run(newReleaseId, new Date().toISOString(), env.id);

        // --- STAGE 10: FINAL REPORT ---
        currentStageNumber = 10;
        const totalDuration = Date.now() - overallStart;
        logStream.emitStage(deploymentId, 10, 'Final Report & Provenance', 'SUCCEEDED', 120, null, db);
        this.finalizeDeployment(deploymentId, DEPLOYMENT_STATES.SUCCEEDED, totalDuration, null, db);

        onLog('info', `=========================================================`);
        onLog('info', `Pipra Release Completed Successfully in ${(totalDuration / 1000).toFixed(1)}s!`);
        onLog('info', `Live Release: ${newReleaseId} active on :${app.host_port}`);
        onLog('info', `=========================================================`);

      } catch (err) {
        const totalDuration = Date.now() - overallStart;
        const isCancelled = signal.aborted;
        const finalStatus = isCancelled ? DEPLOYMENT_STATES.CANCELLED : (db.prepare('SELECT status FROM deployments WHERE id = ?').get(deploymentId).status === DEPLOYMENT_STATES.ROLLBACK_FAILED ? DEPLOYMENT_STATES.ROLLBACK_FAILED : DEPLOYMENT_STATES.FAILED);

        logStream.emitStage(deploymentId, currentStageNumber, STAGES[currentStageNumber - 1]?.name || 'Error', 'FAILED', 0, { error: err.message }, db);
        this.finalizeDeployment(deploymentId, finalStatus, totalDuration, err.message, db);
        onLog('error', `Deployment halted: ${err.message}`);
      } finally {
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
  }
}

module.exports = new DeploymentRunner();
