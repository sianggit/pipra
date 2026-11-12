/**
 * Unit Test Suite for Pipra Declarative Pipeline Specification (.pipra.yaml / .pipra.json)
 */

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const {
  parseSimpleYaml,
  parsePipelineSpec,
  discoverPipelineSpec,
  validateCommandSecurity,
} = require('../../src/engine/pipeline-spec-parser');

describe('Pipeline Spec Parser - YAML Sub-parser', () => {
  it('parses basic scalar key-values and arrays', () => {
    const yaml = `
# Sample pipra config
version: "1.0"
preflight:
  - npm run lint
  - npm test
build:
  dockerfile: Dockerfile.custom
  context: .
`;
    const res = parseSimpleYaml(yaml);
    assert.equal(res.version, '1.0');
    assert.deepEqual(res.preflight, ['npm run lint', 'npm test']);
    assert.equal(res.build.dockerfile, 'Dockerfile.custom');
    assert.equal(res.build.context, '.');
  });

  it('parses inline arrays and scalar booleans/integers', () => {
    const yaml = `
version: "1.0"
enabled: true
retries: 3
tags: [alpha, beta, prod]
`;
    const res = parseSimpleYaml(yaml);
    assert.equal(res.version, '1.0');
    assert.equal(res.enabled, true);
    assert.equal(res.retries, 3);
    assert.deepEqual(res.tags, ['alpha', 'beta', 'prod']);
  });

  it('seamlessly handles valid JSON input as YAML equivalent', () => {
    const json = JSON.stringify({
      version: '1.0',
      preflight: ['npm run lint'],
    });
    const res = parseSimpleYaml(json);
    assert.equal(res.version, '1.0');
    assert.deepEqual(res.preflight, ['npm run lint']);
  });
});

describe('Pipeline Spec Validator & Schema Rules', () => {
  it('successfully validates a complete compliant .pipra.yaml spec', () => {
    const yaml = `
version: "1.0"
preflight:
  - npm run lint
  - command: npm audit --audit-level=high
    timeout_sec: 120
    continue_on_error: true
build:
  dockerfile: Dockerfile.prod
  context: ./app
verification:
  - curl -fsS $STAGING_URL/healthz
post_cutover:
  - curl -fsS $PROD_URL/api/ping
`;
    const result = parsePipelineSpec(yaml, 'yaml');
    assert.equal(result.valid, true);
    assert.equal(result.spec.version, '1.0');
    assert.equal(result.spec.preflight.length, 2);
    assert.equal(result.spec.preflight[0].command, 'npm run lint');
    assert.equal(result.spec.preflight[0].timeout_sec, 180);
    assert.equal(result.spec.preflight[0].continue_on_error, false);
    assert.equal(result.spec.preflight[1].command, 'npm audit --audit-level=high');
    assert.equal(result.spec.preflight[1].timeout_sec, 120);
    assert.equal(result.spec.preflight[1].continue_on_error, true);
    assert.equal(result.spec.build.dockerfile, 'Dockerfile.prod');
    assert.equal(result.spec.verification[0].command, 'curl -fsS $STAGING_URL/healthz');
    assert.equal(result.spec.post_cutover[0].command, 'curl -fsS $PROD_URL/api/ping');
  });

  it('rejects unsupported pipeline versions', () => {
    const yaml = `
version: "2.0"
preflight:
  - echo hello
`;
    const result = parsePipelineSpec(yaml, 'yaml');
    assert.equal(result.valid, false);
    assert.match(result.errors[0], /Unsupported pipeline version/);
  });

  it('rejects empty or missing pipeline specs', () => {
    const result = parsePipelineSpec('', 'yaml');
    assert.equal(result.valid, false);
    assert.match(result.errors[0], /content is empty/);
  });
});

describe('Pipeline Security & Sandboxing Boundary', () => {
  it('blocks commands attempting to read /etc/shadow or modify sudoers', () => {
    const sec1 = validateCommandSecurity('cat /etc/shadow');
    assert.equal(sec1.valid, false);

    const sec2 = validateCommandSecurity('visudo /etc/sudoers.d/backdoor');
    assert.equal(sec2.valid, false);
  });

  it('blocks commands attempting to access or delete pipra.db', () => {
    const sec = validateCommandSecurity('rm -f data/pipra.db');
    assert.equal(sec.valid, false);
  });

  it('blocks dangerous root wiping or fork bomb commands', () => {
    assert.equal(validateCommandSecurity('rm -rf /').valid, false);
    assert.equal(validateCommandSecurity('rm -rf /*').valid, false);
    assert.equal(validateCommandSecurity(':(){:|:&};:').valid, false);
  });

  it('rejects malicious commands when parsing pipeline specs', () => {
    const maliciousYaml = `
version: "1.0"
preflight:
  - cat /etc/shadow > leaked.txt
`;
    const result = parsePipelineSpec(maliciousYaml, 'yaml');
    assert.equal(result.valid, false);
    assert.match(result.errors[0], /Security validation failed/);
  });
});

describe('Pipeline Spec Discovery in Repository Root', () => {
  it('discovers .pipra.yaml when present', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pipra_spec_test_'));
    try {
      const specPath = path.join(tmpDir, '.pipra.yaml');
      fs.writeFileSync(specPath, 'version: "1.0"\npreflight: [npm test]');

      const discovered = discoverPipelineSpec(tmpDir);
      assert.equal(discovered.found, true);
      assert.equal(discovered.fileName, '.pipra.yaml');
      assert.equal(discovered.format, 'yaml');
      assert.match(discovered.content, /npm test/);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('returns found: false when no spec exists', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pipra_no_spec_'));
    try {
      const discovered = discoverPipelineSpec(tmpDir);
      assert.equal(discovered.found, false);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

