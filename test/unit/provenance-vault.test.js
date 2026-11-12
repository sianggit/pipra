/**
 * Unit Test Suite for Pipra Software Supply Chain Provenance Vault (provenance-vault.js)
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  canonicalizeJson,
  computeSha256,
  generateAttestationPayload,
  signAttestation,
  verifyAttestationSignature,
} = require('../../src/engine/provenance-vault');

describe('Supply Chain Security - SLSA Provenance Vault', () => {
  it('canonicalizes JSON objects deterministically regardless of key order', () => {
    const objA = { z: 1, a: 2, m: { y: 10, b: 20 } };
    const objB = { a: 2, m: { b: 20, y: 10 }, z: 1 };

    const canonA = canonicalizeJson(objA);
    const canonB = canonicalizeJson(objB);

    assert.equal(canonA, canonB);
    assert.equal(computeSha256(canonA), computeSha256(canonB));
  });

  it('generates compliant SLSA v0.2 / in-toto attestation envelope', () => {
    const payload = generateAttestationPayload({
      deployment: {
        commit_sha: 'abcdef1234567890abcdef1234567890abcdef12',
        image_tag: 'v2.0.0',
        branch: 'main',
        initiated_by: 'devops-admin',
        started_at: '2026-11-12T00:00:00Z',
        finished_at: '2026-11-12T00:01:30Z',
        status: 'SUCCEEDED',
      },
      app: {
        name: 'asdp-dims-fe',
        image_name: 'asdp-dims-fe',
        repo_url: 'git@github.com:asdp/dims.git',
        dockerfile: 'Dockerfile.jenkins',
      },
      env: {
        name: 'prod',
        host: '10.0.1.20',
        is_production: 1,
      },
      probes: [{ passed: 1 }, { passed: 1 }],
    });

    assert.equal(payload._type, 'https://in-toto.io/Statement/v0.1');
    assert.equal(payload.predicateType, 'https://slsa.dev/provenance/v0.2');
    assert.equal(payload.predicate.builder.id, 'https://pipra.asyst.co.id/builder/v1');
    assert.equal(payload.predicate.materials[0].digest.commit, 'abcdef1234567890abcdef1234567890abcdef12');
    assert.equal(payload.predicate.verification.probesPassed, 2);
  });

  it('signs and verifies authentic attestations with constant-time security', () => {
    const testDoc = {
      builder: 'pipra',
      commit: '123456',
      status: 'SUCCEEDED',
    };
    const canonical = canonicalizeJson(testDoc);
    const signature = signAttestation(canonical);

    // Verify valid signature
    const verification = verifyAttestationSignature(canonical, signature);
    assert.equal(verification.valid, true);
    assert.equal(verification.error, null);
  });

  it('detects and rejects tampered attestations (1-byte alteration)', () => {
    const testDoc = {
      builder: 'pipra',
      commit: '123456',
      status: 'SUCCEEDED',
    };
    const canonical = canonicalizeJson(testDoc);
    const signature = signAttestation(canonical);

    // Deliberate 1-byte tamper in commit hash
    const tamperedDoc = {
      builder: 'pipra',
      commit: '123457',
      status: 'SUCCEEDED',
    };
    const tamperedCanonical = canonicalizeJson(tamperedDoc);

    const verification = verifyAttestationSignature(tamperedCanonical, signature);
    assert.equal(verification.valid, false);
    assert.match(verification.error, /tamper detected/i);
  });
});

