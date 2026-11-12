/**
 * Pipra — Pipeline & Release Engineering Platform
 * Self-Hosted Control Plane Server & API Gateway
 */

const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const url = require('node:url');

const config = require('./src/config');
const logger = require('./src/utils/logger');
const { getDatabase } = require('./src/db/database');
const { seedCoreSystem } = require('./src/db/seed');
const authService = require('./src/auth/auth-service');
const deploymentRunner = require('./src/engine/deployment-runner');

// Route handlers
const { handleAuthRoutes } = require('./src/routes/auth-routes');
const { handleAppRoutes } = require('./src/routes/app-routes');
const { handleEnvRoutes } = require('./src/routes/env-routes');
const { handleDeploymentRoutes } = require('./src/routes/deployment-routes');
const { handleAgentRoutes } = require('./src/routes/agent-routes');
const { handleAuditRoutes } = require('./src/routes/audit-routes');
const { handleStatsRoutes } = require('./src/routes/stats-routes');
const { handleWebhookRoutes } = require('./src/routes/webhook-routes');

// MIME types
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

// 1. Initialize Database & Seed Core Security Baseline (Users & System Agents)
const db = getDatabase();
seedCoreSystem(db);

// 2. Initialize Persistent Deployment Engine
deploymentRunner.init();

// Helper to extract session token
function extractToken(req) {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  const cookieHeader = req.headers['cookie'];
  if (cookieHeader) {
    const cookies = cookieHeader.split(';').map(c => c.trim());
    for (const cookie of cookies) {
      if (cookie.startsWith('pipra_token=')) {
        return cookie.substring('pipra_token='.length);
      }
    }
  }
  return null;
}

// Helper to parse JSON body
function parseJsonBody(req) {
  return new Promise((resolve) => {
    let bodyStr = '';
    req.on('data', chunk => {
      bodyStr += chunk;
      if (bodyStr.length > 2 * 1024 * 1024) { // 2MB limit
        req.destroy();
      }
    });
    req.on('end', () => {
      req.rawBody = bodyStr;
      try {
        resolve(bodyStr ? JSON.parse(bodyStr) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', () => {
      req.rawBody = '';
      resolve({});
    });
  });
}

// 3. Create HTTP Server
const server = http.createServer(async (req, res) => {
  // CORS & Security Headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');

  const reqUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = reqUrl.pathname;
  const query = Object.fromEntries(reqUrl.searchParams.entries());

  // Extract authenticated user
  const token = extractToken(req);
  const user = authService.validateSession(token);

  // Parse body for mutations
  let body = {};
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    body = await parseJsonBody(req);
  }

  // --- API ROUTING ---
  try {
    if (pathname.startsWith('/api/')) {
      if (handleAuthRoutes(req, res, pathname, body, user)) return;
      if (handleWebhookRoutes(req, res, pathname, query, body, user, req.rawBody)) return;
      if (handleAppRoutes(req, res, pathname, query, body, user)) return;
      if (handleEnvRoutes(req, res, pathname, query, body, user)) return;
      if (handleDeploymentRoutes(req, res, pathname, query, body, user)) return;
      if (handleAgentRoutes(req, res, pathname, query, body, user)) return;
      if (handleAuditRoutes(req, res, pathname, query, body, user)) return;
      if (handleStatsRoutes(req, res, pathname, query, body, user)) return;

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: `API endpoint not found: ${pathname}` }));
      return;
    }
  } catch (err) {
    logger.error(`API Error on ${req.method} ${pathname}:`, err);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal Server Error', message: err.message }));
    }
    return;
  }

  // --- STATIC FILE SERVING (SPA) ---
  const publicDir = path.join(__dirname, 'public');
  let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  if (safePath === '/' || safePath === '\\') safePath = '/index.html';

  let filePath = path.join(publicDir, safePath);

  // If path doesn't have an extension and isn't an existing file, fallback to index.html for SPA router
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(publicDir, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('File Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
});

// Start Server
server.listen(config.PORT, config.HOST, () => {
  logger.info(`==========================================================`);
  logger.info(`Pipra Control Plane active at http://${config.HOST === '0.0.0.0' ? 'localhost' : config.HOST}:${config.PORT}/`);
  logger.info(`Brand Tagline: Build with confidence. Ship with control.`);
  logger.info(`==========================================================`);
});

// Graceful termination
function shutdown() {
  logger.info('Shutting down Pipra Control Plane...');
  server.close(() => {
    logger.info('Pipra Server closed gracefully.');
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

module.exports = server;
