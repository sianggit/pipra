/**
 * Pipra Cryptographic Vault Helper
 * AES-256-GCM authenticated encryption for host credentials at rest.
 * Uses native Node.js node:crypto with zero external dependencies.
 */

const crypto = require('node:crypto');
const config = require('../config');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit standard IV for GCM
const SALT_LENGTH = 16; // 128-bit dynamic salt
const LEGACY_SALT = config.VAULT_SALT || 'pipra_vault_salt_2026';

function getDerivedKey(salt = null) {
  const masterSecret = config.MASTER_KEY || config.SESSION_SECRET || 'pipra-secure-session-key-asdp-dims-2026';
  const effectiveSalt = salt || LEGACY_SALT;
  return crypto.scryptSync(masterSecret, effectiveSalt, 32);
}

function encryptSecret(plaintext, useDynamicSalt = false) {
  if (plaintext === null || plaintext === undefined || plaintext === '') {
    return null;
  }

  const isDynamic = useDynamicSalt || process.env.PIPRA_DYNAMIC_SALT === 'true';
  const salt = isDynamic ? crypto.randomBytes(SALT_LENGTH) : null;
  const key = getDerivedKey(salt);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(String(plaintext), 'utf8'),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  if (isDynamic) {
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${salt.toString('hex')}:${encrypted.toString('hex')}`;
  }

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decryptSecret(cipherString) {
  if (!cipherString || typeof cipherString !== 'string') {
    return null;
  }

  const parts = cipherString.split(':');
  let ivHex, authTagHex, saltHex, encryptedHex;
  let key;

  if (parts.length === 4) {
    // Dynamic per-payload salt format: iv:authTag:salt:encrypted
    [ivHex, authTagHex, saltHex, encryptedHex] = parts;
    key = getDerivedKey(Buffer.from(saltHex, 'hex'));
  } else if (parts.length === 3) {
    // Legacy static salt format: iv:authTag:encrypted
    [ivHex, authTagHex, encryptedHex] = parts;
    key = getDerivedKey(LEGACY_SALT);
  } else {
    throw new Error('Invalid encrypted payload format');
  }

  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

/**
 * Generate cryptographically secure random secret token
 */
function generateRandomSecret(byteLength = 32) {
  return crypto.randomBytes(byteLength).toString('hex');
}

/**
 * Compute HMAC-SHA256 hex digest for payload
 */
function computeHmacSha256(rawBody, secret) {
  if (!secret) return null;
  const bodyBuf = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody || ''), 'utf8');
  return crypto.createHmac('sha256', String(secret)).update(bodyBuf).digest('hex');
}

/**
 * Constant-time verification of HMAC-SHA256 signature (neutralizes timing attacks)
 * Accepts signature formatted as 'sha256=<hex>' or raw '<hex>'
 */
function verifyHmacSha256(rawBody, signatureHeader, secret) {
  if (!signatureHeader || !secret) {
    return false;
  }

  const expectedHex = computeHmacSha256(rawBody, secret);
  if (!expectedHex) return false;

  let providedHex = String(signatureHeader).trim();
  if (providedHex.startsWith('sha256=')) {
    providedHex = providedHex.substring('sha256='.length);
  }

  const expectedBuf = Buffer.from(expectedHex, 'hex');
  const providedBuf = Buffer.from(providedHex, 'hex');

  if (expectedBuf.length !== providedBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

module.exports = {
  encryptSecret,
  decryptSecret,
  generateRandomSecret,
  computeHmacSha256,
  verifyHmacSha256,
};

