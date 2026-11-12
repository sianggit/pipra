/**
 * Pipra AI Pipeline Failure Diagnostics & Root Cause Analysis (RCA) Engine
 * Extracts failure telemetry, strips ANSI/secrets, and provides zero-slop root cause analysis
 * using deterministic heuristic classification and optional LLM REST inference.
 */

const { redactSecrets } = require('../utils/sanitizer');
const logger = require('../utils/logger');
const config = require('../config');

// Standard error categories for Pipra CI/CD failures
const ERROR_CATEGORIES = {
  PORT_CONFLICT: 'PORT_CONFLICT',
  DEPENDENCY_ERROR: 'DEPENDENCY_ERROR',
  DOCKER_BUILD_ERROR: 'DOCKER_BUILD_ERROR',
  HEALTHCHECK_TIMEOUT: 'HEALTHCHECK_TIMEOUT',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  SYNTAX_ERROR: 'SYNTAX_ERROR',
  UNKNOWN: 'UNKNOWN_ERROR',
};

/**
 * Extracts and sanitizes failure telemetry from SQLite database.
 * @param {object} db - DatabaseSync instance
 * @param {string} deploymentId
 * @returns {object} Context payload
 */
function extractFailureContext(db, deploymentId) {
  const deployment = db.prepare('SELECT * FROM deployments WHERE id = ?').get(deploymentId);
  if (!deployment) return null;

  // Retrieve last 60 log lines
  const rawLogs = db.prepare(`
    SELECT stage_number, level, message, timestamp 
    FROM deployment_logs 
    WHERE deployment_id = ? 
    ORDER BY id DESC 
    LIMIT 60
  `).all(deploymentId);

  // Reverse to maintain chronological order
  const logsChronological = rawLogs.reverse();

  // Strip ANSI color codes and redact secrets
  const cleanLogs = logsChronological.map(l => {
    const strippedAnsi = l.message.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '');
    return {
      stage: l.stage_number,
      level: l.level,
      message: redactSecrets(strippedAnsi),
      timestamp: l.timestamp,
    };
  });

  // Health probe failures if applicable
  const failedProbes = db.prepare(`
    SELECT * FROM health_probes 
    WHERE deployment_id = ? AND passed = 0 
    ORDER BY id DESC LIMIT 5
  `).all(deploymentId);

  return {
    deploymentId,
    status: deployment.status,
    failedStage: deployment.current_stage,
    failedStageName: deployment.current_stage_name,
    errorMessage: deployment.error_message ? redactSecrets(deployment.error_message) : null,
    branch: deployment.branch,
    imageTag: deployment.image_tag,
    logs: cleanLogs,
    failedProbes,
    platform: process.platform,
    nodeVersion: process.version,
  };
}

/**
 * Deterministic heuristic diagnostic analyzer.
 * Evaluates raw log text against regular expressions for instant, accurate classification.
 * @param {object} context - Output from extractFailureContext
 * @returns {object} Structured diagnostic object
 */
function analyzeHeuristic(context) {
  if (!context) {
    return {
      summary: 'Deployment failed with unknown cause',
      category: ERROR_CATEGORIES.UNKNOWN,
      root_cause: 'No failure context or log records found for this deployment.',
      probable_file: null,
      suggested_fix: 'Check server logs or re-trigger the deployment.',
    };
  }

  const logText = [
    context.errorMessage || '',
    ...context.logs.map(l => l.message),
    ...context.failedProbes.map(p => `Probe failed: HTTP ${p.http_status} on ${p.url}: ${p.error || ''}`)
  ].join('\n');

  // 1. Port conflict / EADDRINUSE
  if (/EADDRINUSE|address already in use|port is already allocated/i.test(logText)) {
    const portMatch = logText.match(/:\s*(\d{4,5})|port\s*(\d{4,5})/i);
    const port = portMatch ? (portMatch[1] || portMatch[2]) : 'target port';
    return {
      summary: `Port collision: Port ${port} is already bound by another process.`,
      category: ERROR_CATEGORIES.PORT_CONFLICT,
      root_cause: `The target environment attempted to bind to port ${port}, which is already held by a lingering container or host daemon.`,
      probable_file: 'application_environments configuration or docker-compose.yml',
      suggested_fix: `netstat -ano | findstr :${port} && docker ps --filter "publish=${port}"`,
    };
  }

  // 2. Missing dependency / MODULE_NOT_FOUND
  if (/MODULE_NOT_FOUND|Cannot find module\s*['"]([^'"]+)['"]/i.test(logText)) {
    const modMatch = logText.match(/Cannot find module\s*['"]([^'"]+)['"]/i);
    const moduleName = modMatch ? modMatch[1] : 'required package';
    return {
      summary: `Missing module dependency: '${moduleName}' could not be resolved.`,
      category: ERROR_CATEGORIES.DEPENDENCY_ERROR,
      root_cause: `The Node.js runtime failed to load dependency '${moduleName}'. It may not be listed in package.json or npm ci was skipped.`,
      probable_file: 'package.json or Dockerfile',
      suggested_fix: `npm install ${moduleName} --save && git commit -am "fix(deps): add missing ${moduleName}"`,
    };
  }

  // 3. Permission Denied / EACCES
  if (/EACCES|permission denied|operation not permitted/i.test(logText)) {
    return {
      summary: 'Filesystem permission denied during execution.',
      category: ERROR_CATEGORIES.PERMISSION_DENIED,
      root_cause: 'The execution worker or Docker container lacks read/write permissions for the target directory or socket.',
      probable_file: 'Dockerfile or target directory permissions',
      suggested_fix: 'chmod -R 755 . or check container USER directive in Dockerfile',
    };
  }

  // 4. Staging / Production Healthcheck Probe Timeout
  if (context.failedStage === 6 || context.failedStage === 8 || /health verification failed|Probe failed|ECONNREFUSED/i.test(logText)) {
    return {
      summary: `Health check probe failed: Application failed to return HTTP 200 within timeout window.`,
      category: ERROR_CATEGORIES.HEALTHCHECK_TIMEOUT,
      root_cause: `The container started but the HTTP healthcheck endpoint did not become healthy within the configured retry limit. The application server may have crashed during initialization or failed database connectivity.`,
      probable_file: 'healthcheck_path setting or application startup listener',
      suggested_fix: 'Check container logs: docker logs <container_name> to diagnose startup crash.',
    };
  }

  // 5. Docker build syntax / Dockerfile error
  if (/dockerfile|unknown instruction|failed to solve with frontend dockerfile/i.test(logText)) {
    return {
      summary: 'Docker image compilation failed due to Dockerfile syntax or instruction error.',
      category: ERROR_CATEGORIES.DOCKER_BUILD_ERROR,
      root_cause: 'The Docker build engine encountered an invalid instruction, invalid syntax, or missing base image during build execution.',
      probable_file: 'Dockerfile',
      suggested_fix: 'docker build -t test-build -f Dockerfile . to reproduce and validate locally.',
    };
  }

  // Default Fallback
  return {
    summary: context.errorMessage || `Pipeline failed at Stage ${context.failedStage}: ${context.failedStageName}`,
    category: ERROR_CATEGORIES.UNKNOWN,
    root_cause: `Stage ${context.failedStage} (${context.failedStageName}) terminated unexpectedly. Inspect terminal logs for details.`,
    probable_file: null,
    suggested_fix: 'Review raw terminal execution logs for exact stack trace or exit code.',
  };
}

/**
 * Executes AI diagnostic report generation (LLM with deterministic heuristic fallback).
 * @param {object} db - DatabaseSync instance
 * @param {string} deploymentId
 * @returns {Promise<object>} Structured diagnostic result
 */
async function generateDiagnostics(db, deploymentId) {
  const context = extractFailureContext(db, deploymentId);
  if (!context) return null;

  // Attempt external LLM if configured
  if (config.AI_DIAGNOSTICS_ENABLED && config.AI_ENDPOINT) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const prompt = `You are a Principal DevOps Systems Engineer analyzing a failed CI/CD deployment in Pipra.
Analyze this failure context and output STRICT JSON only matching this schema:
{
  "summary": "Short 1-sentence description of the exact failure cause",
  "category": "PORT_CONFLICT | DEPENDENCY_ERROR | DOCKER_BUILD_ERROR | HEALTHCHECK_TIMEOUT | PERMISSION_DENIED | SYNTAX_ERROR | UNKNOWN_ERROR",
  "root_cause": "Detailed technical explanation of what went wrong",
  "probable_file": "path/to/suspected/file or null",
  "suggested_fix": "Concrete shell command or code edit to fix the issue"
}

Failure Context:
Failed Stage: Stage ${context.failedStage} (${context.failedStageName})
Error Message: ${context.errorMessage || 'None'}
Recent Logs:
${context.logs.map(l => `[${l.level.toUpperCase()}] ${l.message}`).join('\n')}
`;

      const response = await fetch(config.AI_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(config.AI_API_KEY ? { 'Authorization': `Bearer ${config.AI_API_KEY}` } : {})
        },
        body: JSON.stringify({
          model: config.AI_MODEL || 'llama3',
          prompt,
          stream: false,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (response.ok) {
        const data = await response.json();
        const rawContent = data.response || (data.choices && data.choices[0]?.message?.content) || '';
        const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.summary && parsed.category && parsed.root_cause) {
            return parsed;
          }
        }
      }
    } catch (err) {
      logger.warn(`External AI diagnostic endpoint failed (${err.message}). Falling back to heuristic engine.`);
    }
  }

  // Deterministic Heuristic Fallback
  return analyzeHeuristic(context);
}

/**
 * Asynchronously generates and persists diagnostic report for a failed deployment.
 * @param {object} db - DatabaseSync instance
 * @param {string} deploymentId
 * @param {object} logStream - log-stream singleton
 */
async function analyzeAndPersist(db, deploymentId, logStream = null) {
  try {
    const diagnostic = await generateDiagnostics(db, deploymentId);
    if (!diagnostic) return;

    db.prepare(`
      UPDATE deployments 
      SET diagnostic_summary = ?, diagnostic_details = ? 
      WHERE id = ?
    `).run(diagnostic.summary, JSON.stringify(diagnostic), deploymentId);

    if (logStream) {
      logStream.broadcast(deploymentId, 'diagnostic_ready', {
        deploymentId,
        diagnostic,
      });
      logStream.emitLog(deploymentId, 10, 'info', `[AI Diagnostics] Analysis complete: ${diagnostic.summary}`, db);
    }

    logger.info(`AI Diagnostics recorded for deployment ${deploymentId}: [${diagnostic.category}] ${diagnostic.summary}`);
  } catch (err) {
    logger.error(`Failed to analyze failure for deployment ${deploymentId}: ${err.message}`);
  }
}

module.exports = {
  ERROR_CATEGORIES,
  extractFailureContext,
  analyzeHeuristic,
  generateDiagnostics,
  analyzeAndPersist,
};

