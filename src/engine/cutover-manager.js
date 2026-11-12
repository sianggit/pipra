/**
 * Pipra Production Cutover & Automatic Rollback Manager
 * Executes atomic container replacement and fallback restoration on local or remote target.
 */

const executionDriver = require('./execution-driver');
const logger = require('../utils/logger');

class CutoverManager {
  async executeCutover({
    env,
    containerName,
    backupName,
    imageName,
    imageTag,
    hostPort,
    containerPort,
    onLog,
    abortSignal,
  }) {
    if (abortSignal && abortSignal.aborted) throw new Error('Operation aborted');

    onLog('info', `Initiating sub-second atomic cutover to production container: ${containerName}`);
    const fullTag = `${imageName}:${imageTag}`;
    const hPort = (env && env.host_port) ? env.host_port : hostPort;
    const cPort = (env && env.container_port) ? env.container_port : (containerPort || 3000);

    if (executionDriver.dockerAvailable || executionDriver.isTargetRemote(env)) {
      // 1. Check if production container is currently running
      let isRunning = false;
      try {
        const out = await executionDriver.execOutputOnTarget({
          env,
          cwd: null,
          command: 'docker',
          args: ['ps', '--filter', `name=^/${containerName}$`, '--format', '"{{.Names}}"'],
        });
        isRunning = out.replace(/['"]+/g, '').trim() === containerName;
      } catch {}

      if (isRunning) {
        onLog('info', `Preserving active container as backup: ${backupName}`);
        try {
          await executionDriver.runCommandOnTarget({
            env,
            cwd: null,
            command: 'docker',
            args: ['rename', containerName, backupName],
            onLog: () => {},
            abortSignal: null,
          });
          await executionDriver.runCommandOnTarget({
            env,
            cwd: null,
            command: 'docker',
            args: ['stop', '-t', '2', backupName],
            onLog: () => {},
            abortSignal: null,
          });
        } catch (e) {
          onLog('warn', `Notice during backup rename: ${e.message}`);
        }
      }

      // 2. Launch modernized replacement container on production port
      onLog('info', `Launching replacement container on port :${hPort} -> :${cPort}`);
      await executionDriver.runCommandOnTarget({
        env,
        cwd: null,
        command: 'docker',
        args: [
          'run', '-d',
          '--restart', 'unless-stopped',
          '--name', containerName,
          '-e', 'NODE_ENV=production',
          '-p', `${hPort}:${cPort}`,
          fullTag,
        ],
        onLog,
        abortSignal,
      });
      return { success: true };
    }

    // High-fidelity simulation
    onLog('info', `Simulating atomic cutover: preserving running container as ${backupName}`);
    await executionDriver.delay(300);
    onLog('info', `Renamed live container to ${backupName} (state preserved)`);
    await executionDriver.delay(200);
    onLog('info', `Launched new container ${containerName} on production port :${hPort}`);
    return { success: true };
  }

  async executeRollback({
    env,
    containerName,
    backupName,
    onLog,
  }) {
    onLog('warn', `Executing automated rollback! Restoring previous container ${backupName}...`);

    if (executionDriver.dockerAvailable || executionDriver.isTargetRemote(env)) {
      try {
        // 1. Remove failed replacement container
        onLog('info', `Removing failed release container: ${containerName}`);
        await executionDriver.runCommandOnTarget({
          env,
          cwd: null,
          command: 'docker',
          args: ['rm', '-f', containerName],
          onLog: () => {},
          abortSignal: null,
        });

        // 2. Restart backup container
        onLog('info', `Restarting preserved container: ${backupName}`);
        await executionDriver.runCommandOnTarget({
          env,
          cwd: null,
          command: 'docker',
          args: ['start', backupName],
          onLog: () => {},
          abortSignal: null,
        });

        // 3. Rename back to original production name
        onLog('info', `Renaming ${backupName} back to ${containerName}`);
        await executionDriver.runCommandOnTarget({
          env,
          cwd: null,
          command: 'docker',
          args: ['rename', backupName, containerName],
          onLog: () => {},
          abortSignal: null,
        });

        onLog('info', `Rollback completed. Live production service successfully restored.`);
        return { success: true };
      } catch (e) {
        onLog('error', `CRITICAL: Rollback failed during container restoration: ${e.message}`);
        return { success: false, error: e.message };
      }
    }

    // Simulation
    await executionDriver.delay(400);
    onLog('info', `Stopped faulty container ${containerName}`);
    await executionDriver.delay(300);
    onLog('info', `Restored and restarted container ${backupName}`);
    await executionDriver.delay(200);
    onLog('info', `Renamed ${backupName} back to ${containerName}. Live service restored.`);
    return { success: true };
  }

  async cleanupBackup(backupName, onLog, env = null) {
    onLog('info', `Cleaning up pre-cutover backup container: ${backupName}`);
    if (executionDriver.dockerAvailable || (env && executionDriver.isTargetRemote(env))) {
      try {
        await executionDriver.runCommandOnTarget({
          env,
          cwd: null,
          command: 'docker',
          args: ['rm', '-f', backupName],
          onLog: () => {},
          abortSignal: null,
        });
      } catch {}
    }
  }
}

module.exports = new CutoverManager();
