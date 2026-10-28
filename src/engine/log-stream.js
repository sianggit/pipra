/**
 * Pipra Real-Time Event Hub & SSE Stream Manager
 */

const EventEmitter = require('node:events');
const { redactSecrets } = require('../utils/sanitizer');

class LogStreamManager extends EventEmitter {
  constructor() {
    super();
    this.clients = new Map(); // deploymentId -> Set of HTTP response objects
  }

  addClient(deploymentId, res, db) {
    if (!this.clients.has(deploymentId)) {
      this.clients.set(deploymentId, new Set());
    }
    const clientSet = this.clients.get(deploymentId);
    clientSet.add(res);

    // Initial replay from persistent database
    this.replayHistory(deploymentId, res, db);

    res.on('close', () => {
      clientSet.delete(res);
      if (clientSet.size === 0) {
        this.clients.delete(deploymentId);
      }
    });
  }

  replayHistory(deploymentId, res, db) {
    try {
      const deployment = db.prepare('SELECT * FROM deployments WHERE id = ?').get(deploymentId);
      if (!deployment) return;

      const stages = db.prepare('SELECT * FROM deployment_stages WHERE deployment_id = ? ORDER BY stage_number ASC').all(deploymentId);
      const logs = db.prepare('SELECT * FROM deployment_logs WHERE deployment_id = ? ORDER BY id ASC LIMIT 500').all(deploymentId);
      const probes = db.prepare('SELECT * FROM health_probes WHERE deployment_id = ? ORDER BY id ASC').all(deploymentId);

      this.sendEvent(res, 'init', {
        deployment,
        stages,
        logs: logs.map(l => ({ ...l, message: redactSecrets(l.message) })),
        probes,
      });
    } catch (err) {
      // client may have closed prematurely
    }
  }

  broadcast(deploymentId, eventType, data) {
    const clientSet = this.clients.get(deploymentId);
    if (!clientSet || clientSet.size === 0) return;

    for (const res of clientSet) {
      this.sendEvent(res, eventType, data);
    }
  }

  sendEvent(res, eventType, data) {
    try {
      const payload = typeof data === 'string' ? data : JSON.stringify(data);
      res.write(`event: ${eventType}\n`);
      res.write(`data: ${payload}\n\n`);
    } catch (err) {
      // client connection might be broken
    }
  }

  emitLog(deploymentId, stageNumber, level, rawMessage, db) {
    const message = redactSecrets(rawMessage);
    const timestamp = new Date().toISOString();

    // Persist to SQLite
    try {
      db.prepare(`
        INSERT INTO deployment_logs (deployment_id, stage_number, level, message, timestamp)
        VALUES (?, ?, ?, ?, ?)
      `).run(deploymentId, stageNumber, level, message, timestamp);
    } catch (e) {
      // ignore log insertion error during cancellation
    }

    // Broadcast to SSE clients
    this.broadcast(deploymentId, 'log', {
      deploymentId,
      stageNumber,
      level,
      message,
      timestamp,
    });
  }

  emitStage(deploymentId, stageNumber, stageName, status, durationMs, details, db) {
    const now = new Date().toISOString();
    try {
      const existing = db.prepare('SELECT id FROM deployment_stages WHERE deployment_id = ? AND stage_number = ?').get(deploymentId, stageNumber);
      if (existing) {
        db.prepare(`
          UPDATE deployment_stages
          SET status = ?, duration_ms = ?, details = ?, finished_at = ?
          WHERE id = ?
        `).run(status, durationMs || 0, details ? JSON.stringify(details) : null, now, existing.id);
      } else {
        db.prepare(`
          INSERT INTO deployment_stages (deployment_id, stage_number, stage_name, status, started_at, finished_at, duration_ms, details)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(deploymentId, stageNumber, stageName, status, now, status === 'RUNNING' ? null : now, durationMs || 0, details ? JSON.stringify(details) : null);
      }
    } catch (e) {
      // ignore
    }

    this.broadcast(deploymentId, 'stage', {
      deploymentId,
      stageNumber,
      stageName,
      status,
      durationMs,
      details,
      timestamp: now,
    });
  }

  emitProbe(deploymentId, stageNumber, probeData, db) {
    const timestamp = new Date().toISOString();
    try {
      db.prepare(`
        INSERT INTO health_probes (deployment_id, stage_number, attempt, max_attempts, url, http_status, response_time_ms, passed, error, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        deploymentId,
        stageNumber,
        probeData.attempt,
        probeData.maxAttempts,
        probeData.url,
        probeData.httpStatus,
        probeData.responseTimeMs,
        probeData.passed ? 1 : 0,
        probeData.error || null,
        timestamp
      );
    } catch (e) {
      // ignore
    }

    this.broadcast(deploymentId, 'probe', {
      deploymentId,
      stageNumber,
      ...probeData,
      timestamp,
    });
  }
}

module.exports = new LogStreamManager();
