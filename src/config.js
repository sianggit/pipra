const path = require('node:path');
const fs = require('node:fs');

const DATA_DIR = process.env.PIPRA_DATA_DIR || path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

module.exports = {
  PORT: parseInt(process.env.PORT || '4200', 10),
  HOST: process.env.HOST || '0.0.0.0',
  DATA_DIR,
  DB_PATH: process.env.PIPRA_DB_PATH || path.join(DATA_DIR, 'pipra.db'),
  EXEC_MODE: process.env.PIPRA_EXEC_MODE || 'auto', // 'auto', 'docker', 'sim'
  SESSION_SECRET: process.env.SESSION_SECRET || 'pipra-secure-session-key-asdp-dims-2026',
  MASTER_KEY: process.env.PIPRA_MASTER_KEY || process.env.SESSION_SECRET || 'pipra-secure-session-key-asdp-dims-2026',
  DEFAULT_TARGET_HOST: process.env.PIPRA_TARGET_HOST || process.env.TARGET_HOST || '127.0.0.1',
  SESSION_TTL_HOURS: 24,
  MAX_LOG_HISTORY_LINES: 2000,
  DEFAULT_HEALTHCHECK_RETRIES: 15,
  DEFAULT_HEALTHCHECK_INTERVAL_SEC: 2,
};
