/**
 * Pipra Security Sanitizer & Input Validator
 */

function redactSecrets(text) {
  if (!text || typeof text !== 'string') return text;
  let redacted = text;

  // 1. Authorization Bearer Tokens
  redacted = redacted.replace(/((?:Authorization\s*:\s*)?Bearer\s+)([a-zA-Z0-9_\-\.]{8,})/gi, '$1[REDACTED]');

  // 2. GitLab Personal Access Tokens
  redacted = redacted.replace(/glpat-[a-zA-Z0-9_\-]{20,}/gi, '[REDACTED_TOKEN]');

  // 3. GitHub Personal Access Tokens
  redacted = redacted.replace(/ghp_[a-zA-Z0-9]{36,}/gi, '[REDACTED_TOKEN]');

  // 4. SSH / TLS Private Keys
  redacted = redacted.replace(/-----BEGIN [A-Z ]+ PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+ PRIVATE KEY-----/gi, '[REDACTED_PRIVATE_KEY]');

  // 5. Key-Value pairs (password: '...', secret=..., etc.)
  redacted = redacted.replace(
    /([a-zA-Z0-9_-]*(?:password|passwd|secret|api[_-]?key|credential)[a-zA-Z0-9_-]*\s*[:=]\s*)(['"]?)([^'"\s\r\n]{4,})\2/gi,
    '$1$2[REDACTED]$2'
  );

  return redacted;
}

function validateBranch(branch) {
  if (!branch || typeof branch !== 'string') return false;
  if (branch.length > 120) return false;
  if (branch.includes('..') || branch.includes(';') || branch.includes('&') || branch.includes('|') || branch.includes('`') || branch.includes('$')) {
    return false;
  }
  return /^[a-zA-Z0-9_\-\./]+$/.test(branch);
}

function validateTag(tag) {
  if (!tag || typeof tag !== 'string') return false;
  if (tag.length > 80) return false;
  if (tag.includes('..') || tag.includes(';') || tag.includes('&') || tag.includes('|') || tag.includes('`') || tag.includes('$')) {
    return false;
  }
  return /^[a-zA-Z0-9_\-\.]+$/.test(tag);
}

function validateContainerName(name) {
  if (!name || typeof name !== 'string') return false;
  if (name.length > 80) return false;
  return /^[a-zA-Z0-9_\-]+$/.test(name);
}

function validatePort(port) {
  const p = parseInt(port, 10);
  return !isNaN(p) && p >= 80 && p <= 65535;
}

function validateEnvFile(file) {
  if (!file || typeof file !== 'string') return false;
  if (file.includes('..') || file.startsWith('/') || file.includes('\\')) return false;
  return /^\.env(\.[a-zA-Z0-9_-]+)?$/.test(file);
}

module.exports = {
  redactSecrets,
  validateBranch,
  validateTag,
  validateContainerName,
  validatePort,
  validateEnvFile,
};
