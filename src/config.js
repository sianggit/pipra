const path = require('node:path');
const fs = require('node:fs');

const DATA_DIR = process.env.PIPRA_DATA_DIR || path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DEFAULT_FALLBACK_SECRET = 'pipra-secure-session-key-asdp-dims-2026';

function validateProductionSecrets(env = process.env) {
  const isProd = (env.NODE_ENV || '').toLowerCase() === 'production';
  const sessionSecret = env.SESSION_SECRET;
  const masterKey = env.PIPRA_MASTER_KEY || env.SESSION_SECRET;

  if (isProd) {
    if (!sessionSecret || sessionSecret === DEFAULT_FALLBACK_SECRET) {
      throw new Error('[ISO 27001 Violation] In production, SESSION_SECRET must be explicitly set and cannot use default fallback.');
    }
    if (!masterKey || masterKey === DEFAULT_FALLBACK_SECRET) {
      throw new Error('[ISO 27001 Violation] In production, PIPRA_MASTER_KEY must be explicitly set and cannot use default fallback.');
    }
  }
}

// Execute check on startup
try {
  validateProductionSecrets();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

module.exports = {
  PORT: parseInt(process.env.PORT || '4200', 10),
  HOST: process.env.HOST || '0.0.0.0',
  DATA_DIR,
  DB_PATH: process.env.PIPRA_DB_PATH || path.join(DATA_DIR, 'pipra.db'),
  EXEC_MODE: process.env.PIPRA_EXEC_MODE || 'auto', // 'auto', 'docker', 'sim'
  SESSION_SECRET: process.env.SESSION_SECRET || DEFAULT_FALLBACK_SECRET,
  MASTER_KEY: process.env.PIPRA_MASTER_KEY || process.env.SESSION_SECRET || DEFAULT_FALLBACK_SECRET,
  VAULT_SALT: process.env.PIPRA_VAULT_SALT || 'pipra_vault_salt_2026',
  DEFAULT_TARGET_HOST: process.env.PIPRA_TARGET_HOST || process.env.TARGET_HOST || '127.0.0.1',
  SESSION_TTL_HOURS: 24,
  MAX_LOG_HISTORY_LINES: 2000,
  DEFAULT_HEALTHCHECK_RETRIES: 15,
  DEFAULT_HEALTHCHECK_INTERVAL_SEC: 2,
  SIEM_WEBHOOK_URL: process.env.SIEM_WEBHOOK_URL || null,
  SIEM_SYSLOG_HOST: process.env.SIEM_SYSLOG_HOST || null,
  validateProductionSecrets,
};
