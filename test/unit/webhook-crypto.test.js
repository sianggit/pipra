/**
 * Unit Test: Webhook HMAC Cryptographic Verification & Ref Sanitization
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {
  generateRandomSecret,
  computeHmacSha256,
  verifyHmacSha256,
} = require('../../src/utils/crypto-vault');
const { extractBranchFromRef } = require('../../src/utils/sanitizer');

test('Webhook Crypto: generateRandomSecret generates 64-char hex strings', () => {
  const secret1 = generateRandomSecret();
  const secret2 = generateRandomSecret();

  assert.strictEqual(typeof secret1, 'string');
  assert.strictEqual(secret1.length, 64);
  assert.strictEqual(secret2.length, 64);
  assert.notStrictEqual(secret1, secret2);
});

test('Webhook Crypto: computeHmacSha256 computes accurate hex digest', () => {
  const secret = 'super_secret_webhook_key_2026';
  const payload = '{"zen":"Practicality beats purity."}';

  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  const actual = computeHmacSha256(payload, secret);

  assert.strictEqual(actual, expected);
});

test('Webhook Crypto: verifyHmacSha256 verifies authentic signatures with and without sha256= prefix', () => {
  const secret = 'pipra_webhook_secret_key';
  const payload = JSON.stringify({ ref: 'refs/heads/devel', after: '1234567890abcdef' });
  const rawHex = computeHmacSha256(payload, secret);

  // With sha256= prefix (GitHub standard)
  assert.strictEqual(verifyHmacSha256(payload, `sha256=${rawHex}`, secret), true);

  // Bare hex
  assert.strictEqual(verifyHmacSha256(payload, rawHex, secret), true);

  // Buffer payload
  const bufPayload = Buffer.from(payload, 'utf8');
  assert.strictEqual(verifyHmacSha256(bufPayload, `sha256=${rawHex}`, secret), true);
});

test('Webhook Crypto: verifyHmacSha256 rejects tampered payload or incorrect secret', () => {
  const secret = 'pipra_webhook_secret_key';
  const payload = JSON.stringify({ ref: 'refs/heads/devel' });
  const sig = `sha256=${computeHmacSha256(payload, secret)}`;

  // Tampered payload
  assert.strictEqual(verifyHmacSha256(payload + ' ', sig, secret), false);

  // Wrong secret
  assert.strictEqual(verifyHmacSha256(payload, sig, 'different_secret'), false);

  // Malformed / incomplete signature length
  assert.strictEqual(verifyHmacSha256(payload, 'sha256=badhex', secret), false);

  // Empty values
  assert.strictEqual(verifyHmacSha256(payload, null, secret), false);
  assert.strictEqual(verifyHmacSha256(payload, sig, ''), false);
});

test('Sanitizer: extractBranchFromRef extracts clean branch name from git ref', () => {
  assert.strictEqual(extractBranchFromRef('refs/heads/devel'), 'devel');
  assert.strictEqual(extractBranchFromRef('refs/heads/main'), 'main');
  assert.strictEqual(extractBranchFromRef('refs/heads/feature/webhook-gateway'), 'feature/webhook-gateway');
  assert.strictEqual(extractBranchFromRef('refs/tags/v1.0.0'), 'v1.0.0');
  assert.strictEqual(extractBranchFromRef('devel'), 'devel');
  assert.strictEqual(extractBranchFromRef(''), null);
  assert.strictEqual(extractBranchFromRef(null), null);
});
