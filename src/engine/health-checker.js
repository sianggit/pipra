/**
 * Pipra Health Verification Engine
 */

const http = require('node:http');

const ACCEPTED_STATUSES = new Set([200, 301, 302, 304, 307, 308]);

async function probeEndpoint(url, timeoutMs = 2000) {
  const startTime = Date.now();
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);
      const req = http.request(
        {
          hostname: parsed.hostname,
          port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
          path: parsed.pathname + parsed.search,
          method: 'GET',
          timeout: timeoutMs,
          headers: {
            'User-Agent': 'Pipra-HealthChecker/1.0',
            'Accept': '*/*',
          },
        },
        (res) => {
          const duration = Date.now() - startTime;
          const status = res.statusCode || 0;
          const passed = ACCEPTED_STATUSES.has(status);
          resolve({
            httpStatus: status,
            responseTimeMs: duration,
            passed,
            error: passed ? null : `Unexpected HTTP status code: ${status}`,
          });
        }
      );

      req.on('timeout', () => {
        req.destroy();
        resolve({
          httpStatus: 0,
          responseTimeMs: Date.now() - startTime,
          passed: false,
          error: `Connection timed out after ${timeoutMs}ms`,
        });
      });

      req.on('error', (err) => {
        resolve({
          httpStatus: 0,
          responseTimeMs: Date.now() - startTime,
          passed: false,
          error: err.message,
        });
      });

      req.end();
    } catch (e) {
      resolve({
        httpStatus: 0,
        responseTimeMs: Date.now() - startTime,
        passed: false,
        error: e.message,
      });
    }
  });
}

/**
 * Executes full health check retry loop with simulated or real probe
 */
async function runHealthCheckLoop({
  url,
  maxRetries = 15,
  intervalSec = 2,
  isSimulated = false,
  simulateFailure = false,
  onAttempt = () => {},
  abortSignal = null,
}) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    if (abortSignal && abortSignal.aborted) {
      return { passed: false, error: 'Health check cancelled by operator' };
    }

    let probeResult;
    if (isSimulated) {
      // Realistic simulation: first 1 or 2 attempts might fail while booting, then succeeds (unless simulateFailure is set)
      await new Promise(r => setTimeout(r, 600));
      if (simulateFailure) {
        probeResult = {
          httpStatus: 502,
          responseTimeMs: 42,
          passed: false,
          error: 'HTTP 502 Bad Gateway (Simulated failure)',
        };
      } else if (attempt === 1) {
        probeResult = {
          httpStatus: 0,
          responseTimeMs: 35,
          passed: false,
          error: 'Connection refused (Container warming up)',
        };
      } else {
        probeResult = {
          httpStatus: 200,
          responseTimeMs: 24,
          passed: true,
          error: null,
        };
      }
    } else {
      probeResult = await probeEndpoint(url, 2000);
    }

    onAttempt({
      attempt,
      maxAttempts: maxRetries,
      url,
      ...probeResult,
    });

    if (probeResult.passed) {
      return {
        passed: true,
        attempts: attempt,
        finalStatus: probeResult.httpStatus,
        responseTimeMs: probeResult.responseTimeMs,
      };
    }

    if (attempt < maxRetries) {
      await new Promise(r => setTimeout(r, intervalSec * 1000));
    }
  }

  return {
    passed: false,
    attempts: maxRetries,
    finalStatus: 0,
    error: `Health check failed after ${maxRetries} attempts`,
  };
}

module.exports = {
  ACCEPTED_STATUSES,
  probeEndpoint,
  runHealthCheckLoop,
};
