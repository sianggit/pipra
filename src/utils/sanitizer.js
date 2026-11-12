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

  // 6. Command line password flags (-pw "...", -pw secret, etc.)
  redacted = redacted.replace(/(-pw\s+)(['"]?[^\s"']+['"]?)/gi, '$1[REDACTED_PASSWORD]');

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

function validateHost(host) {
  if (!host || typeof host !== 'string') return false;
  const trimmed = host.trim();
  if (trimmed.length === 0 || trimmed.length > 255) return false;
  if (/[\s;`$&|><"'\\]/.test(trimmed)) return false;

  // If it consists of only digits and dots, it must be a valid IPv4 address
  if (/^[0-9.]+$/.test(trimmed)) {
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return ipv4Regex.test(trimmed);
  }

  // Otherwise validate valid RFC-compliant hostname
  const hostnameRegex = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  return hostnameRegex.test(trimmed);
}

function isBranchPermitted(branch, permittedList) {
  if (!branch || typeof branch !== 'string') return false;
  const b = branch.trim();
  if (!b || !validateBranch(b)) return false;

  let list = permittedList;
  if (typeof list === 'string') {
    try {
      list = JSON.parse(list);
    } catch {
      list = list.split(',').map(s => s.trim()).filter(Boolean);
    }
  }

  if (!Array.isArray(list) || list.length === 0) return true;

  return list.some(pattern => {
    if (!pattern || typeof pattern !== 'string') return false;
    const p = pattern.trim();
    if (p === '*' || p === b) return true;
    if (p.endsWith('/*')) {
      const prefix = p.slice(0, -1);
      return b.startsWith(prefix) && b.length > prefix.length;
    }
    if (p.includes('*')) {
      const regex = new RegExp('^' + p.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
      return regex.test(b);
    }
    return p === b;
  });
}

/**
 * Extract clean branch or tag name from SCM git ref (e.g. refs/heads/devel -> devel)
 */
function extractBranchFromRef(ref) {
  if (!ref || typeof ref !== 'string') return null;
  const trimmed = ref.trim();
  if (trimmed.startsWith('refs/heads/')) {
    return trimmed.substring('refs/heads/'.length).trim();
  }
  if (trimmed.startsWith('refs/tags/')) {
    return trimmed.substring('refs/tags/'.length).trim();
  }
  return trimmed;
}

module.exports = {
  redactSecrets,
  validateBranch,
  validateTag,
  validateContainerName,
  validatePort,
  validateEnvFile,
  validateHost,
  isBranchPermitted,
  extractBranchFromRef,
};
