/**
 * Pipra Software Supply Chain Provenance Vault
 * SLSA Level 2 / In-Toto Predicate Attestation Generator & Cryptographic Signer
 * Built strictly on native Node.js v26 node:crypto with constant-time verification.
 */

const crypto = require('node:crypto');
const cryptoVault = require('../utils/crypto-vault');
const logger = require('../utils/logger');

const BUILDER_ID = 'https://pipra.asyst.co.id/builder/v1';
const ATTESTATION_TYPE = 'https://in-toto.io/Statement/v0.1';
const PREDICATE_TYPE = 'https://slsa.dev/provenance/v0.2';

/**
 * Deterministically sorts object keys recursively for canonical JSON serialization.
 * @param {*} obj
 * @returns {*} canonical object
 */
function canonicalizeObject(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(canonicalizeObject);
  }

  const sortedKeys = Object.keys(obj).sort();
  const result = {};
  for (const key of sortedKeys) {
    result[key] = canonicalizeObject(obj[key]);
  }
  return result;
}

/**
 * Returns canonical, deterministic JSON string of any object.
 * @param {object} obj
 * @returns {string} canonical JSON
 */
function canonicalizeJson(obj) {
  return JSON.stringify(canonicalizeObject(obj));
}

/**
 * Computes SHA-256 hex hash of a string or buffer.
 * @param {string|Buffer} content
 * @returns {string} 64-char hex
 */
function computeSha256(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Derives a platform-specific signing key from the master crypto vault.
 * @returns {string} Signing key secret
 */
function getPlatformSigningKey() {
  const masterKey = cryptoVault.getMasterKey ? cryptoVault.getMasterKey() : null;
  if (masterKey) {
    return crypto.createHash('sha256').update(masterKey).digest('hex');
  }
  return crypto.createHash('sha256').update('pipra-provenance-default-platform-key').digest('hex');
}

/**
 * Generates an in-toto / SLSA provenance attestation document.
 * @param {object} params
 * @returns {object} Attestation document
 */
function generateAttestationPayload({
  deployment,
  app,
  env,
  commitSha,
  imageDigest,
  probes = [],
}) {
  const resolvedCommitSha = commitSha || deployment.commit_sha || '0000000000000000000000000000000000000000';
  const resolvedImageDigest = imageDigest || deployment.image_tag || 'latest';

  const attestation = {
    _type: ATTESTATION_TYPE,
    subject: [
      {
        name: app.image_name || 'app-release',
        digest: {
          sha256: computeSha256(resolvedImageDigest),
        },
      },
    ],
    predicateType: PREDICATE_TYPE,
    predicate: {
      builder: {
        id: BUILDER_ID,
        controlPlaneVersion: '1.0.0',
        agentHost: env.host || '127.0.0.1',
      },
      buildType: 'https://pipra.asyst.co.id/buildTypes/docker-container/v1',
      invocation: {
        configSource: {
          uri: app.repo_url || 'local-repo',
          digest: {
            sha1: resolvedCommitSha,
          },
          entryPoint: app.dockerfile || 'Dockerfile',
        },
        parameters: {
          environment: env.name || 'devel',
          isProduction: Boolean(env.is_production),
          branch: deployment.branch,
          imageTag: deployment.image_tag,
        },
        environment: {
          initiatedBy: deployment.initiated_by || 'system',
          approvedBy: deployment.approved_by_username || null,
          startedAt: deployment.started_at,
          finishedAt: deployment.finished_at || new Date().toISOString(),
        },
      },
      materials: [
        {
          uri: app.repo_url || 'local-repo',
          digest: {
            commit: resolvedCommitSha,
          },
        },
      ],
      metadata: {
        buildStartedOn: deployment.started_at,
        buildFinishedOn: deployment.finished_at || new Date().toISOString(),
        completeness: {
          parameters: true,
          environment: true,
          materials: true,
        },
        reproducible: false,
      },
      verification: {
        probesPassed: probes.filter(p => p.passed === 1).length,
        probesTotal: probes.length,
        status: deployment.status,
      },
    },
  };

  return attestation;
}

/**
 * Digitally signs a canonical attestation JSON payload using HMAC-SHA256.
 * @param {string} canonicalJson
 * @param {string} [signingKey]
 * @returns {string} Hex signature
 */
function signAttestation(canonicalJson, signingKey = null) {
  const key = signingKey || getPlatformSigningKey();
  return crypto.createHmac('sha256', key).update(canonicalJson).digest('hex');
}

/**
 * Validates the cryptographic signature of an attestation using constant-time comparison.
 * @param {string} attestationJson
 * @param {string} signature
 * @param {string} [signingKey]
 * @returns {{ valid: boolean, error?: string }}
 */
function verifyAttestationSignature(attestationJson, signature, signingKey = null) {
  if (!attestationJson || !signature) {
    return { valid: false, error: 'Missing attestation JSON or signature' };
  }

  try {
    let parsedObj;
    if (typeof attestationJson === 'string') {
      parsedObj = JSON.parse(attestationJson);
    } else {
      parsedObj = attestationJson;
    }

    const canonical = canonicalizeJson(parsedObj);
    const key = signingKey || getPlatformSigningKey();
    const expectedSignature = crypto.createHmac('sha256', key).update(canonical).digest('hex');

    const sigBuf = Buffer.from(signature, 'hex');
    const expBuf = Buffer.from(expectedSignature, 'hex');

    if (sigBuf.length !== expBuf.length) {
      return { valid: false, error: 'Signature length mismatch' };
    }

    const match = crypto.timingSafeEqual(sigBuf, expBuf);
    return { valid: match, error: match ? null : 'Cryptographic signature mismatch (tamper detected)' };
  } catch (err) {
    return { valid: false, error: `Verification failed: ${err.message}` };
  }
}

/**
 * Generates, signs, and persists SLSA provenance attestation for a deployment in SQLite.
 * @param {object} db - DatabaseSync instance
 * @param {string} deploymentId
 * @returns {object} { recordId, attestation, signature, canonicalDigest }
 */
function recordDeploymentProvenance(db, deploymentId) {
  const deployment = db.prepare('SELECT * FROM deployments WHERE id = ?').get(deploymentId);
  if (!deployment) throw new Error(`Deployment ${deploymentId} not found`);

  const app = db.prepare('SELECT * FROM applications WHERE id = ?').get(deployment.application_id);
  const env = db.prepare('SELECT * FROM application_environments WHERE id = ?').get(deployment.environment_id) ||
              db.prepare('SELECT * FROM environments WHERE id = ?').get(deployment.environment_id) || {};

  const probes = db.prepare('SELECT * FROM health_probes WHERE deployment_id = ?').all(deploymentId);

  const attestation = generateAttestationPayload({
    deployment,
    app,
    env,
    commitSha: deployment.commit_sha,
    imageDigest: deployment.image_tag,
    probes,
  });

  const canonicalJson = canonicalizeJson(attestation);
  const signature = signAttestation(canonicalJson);
  const canonicalDigest = computeSha256(canonicalJson);

  const recordId = `prov_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const now = new Date().toISOString();

  db.prepare(`
    INSERT OR REPLACE INTO provenance_records (
      id, deployment_id, application_id, commit_sha, image_digest,
      attestation_json, signature, signer_key_id, verified_at, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    recordId,
    deploymentId,
    app.id,
    deployment.commit_sha || '0000000',
    canonicalDigest,
    canonicalJson,
    signature,
    'pipra-platform-root-key',
    now,
    now
  );

  logger.info(`SLSA Provenance Attestation generated and signed for deployment ${deploymentId}: ${recordId}`);

  return {
    recordId,
    attestation,
    signature,
    canonicalDigest,
  };
}

module.exports = {
  BUILDER_ID,
  ATTESTATION_TYPE,
  PREDICATE_TYPE,
  canonicalizeObject,
  canonicalizeJson,
  computeSha256,
  generateAttestationPayload,
  signAttestation,
  verifyAttestationSignature,
  recordDeploymentProvenance,
};

