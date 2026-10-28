/**
 * Pipra Internal System Logger
 */

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const currentLevel = LEVELS[process.env.LOG_LEVEL || 'info'] || 1;

function log(level, message, ...args) {
  if (LEVELS[level] < currentLevel) return;
  const ts = new Date().toISOString();
  const prefix = `[${ts}] [${level.toUpperCase()}] [Pipra]`;
  if (level === 'error') {
    console.error(prefix, message, ...args);
  } else if (level === 'warn') {
    console.warn(prefix, message, ...args);
  } else {
    console.log(prefix, message, ...args);
  }
}

module.exports = {
  debug: (msg, ...args) => log('debug', msg, ...args),
  info: (msg, ...args) => log('info', msg, ...args),
  warn: (msg, ...args) => log('warn', msg, ...args),
  error: (msg, ...args) => log('error', msg, ...args),
};
