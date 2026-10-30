/**
 * Unit Test: Cryptographic Vault (AES-256-GCM)
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { encryptSecret, decryptSecret } = require('../../src/utils/crypto-vault');

test('CryptoVault: Encrypts and decrypts secrets accurately', () => {
  const secret = 'super-secret-ssh-password-2026';
  const encrypted = encryptSecret(secret);

  assert.ok(encrypted, 'Ciphertext should be produced');
  assert.notStrictEqual(encrypted, secret, 'Ciphertext must not match raw secret');
  assert.ok(encrypted.includes(':'), 'Should follow iv:tag:ciphertext format');

  const parts = encrypted.split(':');
  assert.strictEqual(parts.length, 3, 'Must have 3 parts (IV, authTag, ciphertext)');
  assert.strictEqual(parts[0].length, 24, 'IV must be 12 bytes (24 hex characters)');
  assert.strictEqual(parts[1].length, 32, 'AuthTag must be 16 bytes (32 hex characters)');

  const decrypted = decryptSecret(encrypted);
  assert.strictEqual(decrypted, secret, 'Decrypted secret must match original plaintext');
});

test('CryptoVault: Handles empty, null and undefined inputs gracefully', () => {
  assert.strictEqual(encryptSecret(null), null);
  assert.strictEqual(encryptSecret(undefined), null);
  assert.strictEqual(encryptSecret(''), null);
  assert.strictEqual(decryptSecret(null), null);
  assert.strictEqual(decryptSecret(''), null);
});

test('CryptoVault: Rejects tampered ciphertexts and invalid auth tags', () => {
  const secret = 'immutable-credential-value';
  const encrypted = encryptSecret(secret);
  const parts = encrypted.split(':');

  // Tamper with ciphertext by altering last hex char
  const tamperedCipher = parts[2].slice(0, -1) + (parts[2].slice(-1) === 'a' ? 'b' : 'a');
  const tamperedPayload = `${parts[0]}:${parts[1]}:${tamperedCipher}`;

  assert.throws(() => {
    decryptSecret(tamperedPayload);
  }, /Unsupported state or unable to authenticate data|bad decrypt/i);

  // Tamper with authTag
  const tamperedTag = parts[1].slice(0, -1) + (parts[1].slice(-1) === 'a' ? 'b' : 'a');
  const tamperedTagPayload = `${parts[0]}:${tamperedTag}:${parts[2]}`;

  assert.throws(() => {
    decryptSecret(tamperedTagPayload);
  }, /Unsupported state or unable to authenticate data|bad decrypt/i);
});

