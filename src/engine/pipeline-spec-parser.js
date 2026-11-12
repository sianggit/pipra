/**
 * Pipra Declarative Pipeline Specification (.pipra.yaml / .pipra.json) Parser & Validator
 * Pure-JS zero-external-dependency implementation.
 * Validates pipeline structure, extracts hook commands, and enforces strict security boundaries.
 */

const fs = require('node:fs');
const path = require('node:path');

// Patterns that compromise host security or Pipra control plane
const FORBIDDEN_COMMAND_PATTERNS = [
  /\/etc\/shadow/i,
  /\/etc\/sudoers/i,
  /pipra\.db/i,
  /data[\/\\]pipra/i,
  /rm\s+-rf\s+\/(\s|$|\*)/i,
  /rm\s+-fr\s+\/(\s|$|\*)/i,
  /:(){:|:&};:/, // fork bomb
  /mkfs\./i,
  /dd\s+if=/i,
  />\s*\/dev\/sd/i,
  />\s*\/dev\/nvme/i,
];

/**
 * Validates a single shell command string against forbidden security patterns.
 * @param {string} cmd
 * @returns {{ valid: boolean, reason?: string }}
 */
function validateCommandSecurity(cmd) {
  if (typeof cmd !== 'string' || !cmd.trim()) {
    return { valid: false, reason: 'Command must be a non-empty string' };
  }

  for (const pattern of FORBIDDEN_COMMAND_PATTERNS) {
    if (pattern.test(cmd)) {
      return { valid: false, reason: `Command contains prohibited security pattern: ${pattern}` };
    }
  }

  return { valid: true };
}

/**
 * Lightweight recursive YAML subset parser.
 * Handles:
 * - Comments (#)
 * - Scalars (string, number, boolean)
 * - Key-value dictionaries
 * - Arrays (both bullet '- item' and inline '[a, b]')
 * - Nested objects via 2-space indentation
 *
 * @param {string} yamlStr
 * @returns {object}
 */
function parseSimpleYaml(yamlStr) {
  if (typeof yamlStr !== 'string') {
    throw new Error('YAML input must be a string');
  }

  // Check if content is actually valid JSON first
  const trimmed = yamlStr.trim();
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      return JSON.parse(trimmed);
    } catch {
      // Continue to line-by-line parser if JSON parsing fails
    }
  }

  const rawLines = yamlStr.split(/\r?\n/);
  // Filter out pure comment lines and blank lines, but retain original indentation
  const lines = [];
  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i];
    const strippedComment = raw.replace(/\s*#.*$/, '');
    if (!strippedComment.trim()) continue;
    const indent = raw.match(/^\s*/)[0].length;
    lines.push({ indent, text: strippedComment.trim(), rawIndex: i + 1 });
  }

  if (lines.length === 0) return {};

  function parseScalar(val) {
    const v = val.trim();
    if (v === 'true' || v === 'yes' || v === 'on') return true;
    if (v === 'false' || v === 'no' || v === 'off') return false;
    if (v === 'null' || v === '~') return null;
    if (/^-?\d+$/.test(v)) return parseInt(v, 10);
    if (/^-?\d+\.\d+$/.test(v)) return parseFloat(v);
    // Strip surrounding quotes if present
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      return v.slice(1, -1);
    }
    // Inline array: [a, b, c]
    if (v.startsWith('[') && v.endsWith(']')) {
      const inner = v.slice(1, -1).trim();
      if (!inner) return [];
      return inner.split(',').map(item => parseScalar(item.trim()));
    }
    return v;
  }

  function parseBlock(startIndex, currentIndent) {
    let index = startIndex;
    const isArrayBlock = lines[index] && lines[index].text.startsWith('-');

    if (isArrayBlock) {
      const arr = [];
      while (index < lines.length) {
        const line = lines[index];
        if (line.indent < currentIndent) break;
        if (line.indent === currentIndent && line.text.startsWith('-')) {
          const itemContent = line.text.substring(1).trim();
          if (!itemContent) {
            // Nested object/list inside array item
            if (index + 1 < lines.length && lines[index + 1].indent > line.indent) {
              const [nestedVal, nextIdx] = parseBlock(index + 1, lines[index + 1].indent);
              arr.push(nestedVal);
              index = nextIdx;
              continue;
            } else {
              arr.push(null);
            }
          } else if (itemContent.includes(': ') || itemContent.endsWith(':')) {
            // Array of inline objects: - name: foo
            const colonIdx = itemContent.indexOf(':');
            const key = itemContent.substring(0, colonIdx).trim();
            const valRest = itemContent.substring(colonIdx + 1).trim();
            const obj = {};
            if (valRest) {
              obj[key] = parseScalar(valRest);
            } else if (index + 1 < lines.length && lines[index + 1].indent > line.indent) {
              const [nestedChild, nextIdx] = parseBlock(index + 1, lines[index + 1].indent);
              obj[key] = nestedChild;
              index = nextIdx;
              arr.push(obj);
              continue;
            } else {
              obj[key] = null;
            }

            // Check if subsequent lines are sibling properties of this object (indented deeper than line.indent)
            index++;
            while (index < lines.length && lines[index].indent > line.indent && !lines[index].text.startsWith('-')) {
              const subLine = lines[index];
              const subColonIdx = subLine.text.indexOf(':');
              if (subColonIdx !== -1) {
                const subKey = subLine.text.substring(0, subColonIdx).trim();
                const subVal = subLine.text.substring(subColonIdx + 1).trim();
                obj[subKey] = parseScalar(subVal);
              }
              index++;
            }
            arr.push(obj);
            continue;
          } else {
            arr.push(parseScalar(itemContent));
          }
          index++;
        } else if (line.indent > currentIndent) {
          // Additional sub-properties for previous item
          index++;
        } else {
          break;
        }
      }
      return [arr, index];
    } else {
      const obj = {};
      while (index < lines.length) {
        const line = lines[index];
        if (line.indent < currentIndent) break;
        if (line.indent > currentIndent) {
          index++;
          continue;
        }

        const colonIdx = line.text.indexOf(':');
        if (colonIdx === -1) {
          throw new Error(`YAML syntax error at line ${line.rawIndex}: expected key: value pair, got '${line.text}'`);
        }

        const key = line.text.substring(0, colonIdx).trim();
        const valuePart = line.text.substring(colonIdx + 1).trim();

        if (valuePart.length > 0) {
          obj[key] = parseScalar(valuePart);
          index++;
        } else {
          // Nested block follows
          if (index + 1 < lines.length && lines[index + 1].indent > line.indent) {
            const nextIndent = lines[index + 1].indent;
            const [nestedVal, nextIdx] = parseBlock(index + 1, nextIndent);
            obj[key] = nestedVal;
            index = nextIdx;
          } else {
            obj[key] = null;
            index++;
          }
        }
      }
      return [obj, index];
    }
  }

  const [result] = parseBlock(0, lines[0].indent);
  return result || {};
}

/**
 * Normalizes an array of commands or objects into standard hook objects:
 * { command: string, timeout_sec: number, continue_on_error: boolean }
 */
function normalizeHooks(hooks, stageName) {
  if (!hooks) return [];
  if (!Array.isArray(hooks)) {
    throw new Error(`Invalid '${stageName}' specification: expected an array of commands.`);
  }

  return hooks.map((item, idx) => {
    let command = '';
    let timeout_sec = 180;
    let continue_on_error = false;

    if (typeof item === 'string') {
      command = item.trim();
    } else if (typeof item === 'object' && item !== null) {
      command = (item.command || item.run || item.cmd || '').trim();
      if (item.timeout_sec && Number.isInteger(item.timeout_sec) && item.timeout_sec > 0) {
        timeout_sec = item.timeout_sec;
      }
      if (typeof item.continue_on_error === 'boolean') {
        continue_on_error = item.continue_on_error;
      }
    } else {
      throw new Error(`Invalid item in '${stageName}' at index ${idx}: must be a string or object.`);
    }

    if (!command) {
      throw new Error(`Empty command specified in '${stageName}' at index ${idx}.`);
    }

    const secCheck = validateCommandSecurity(command);
    if (!secCheck.valid) {
      throw new Error(`Security validation failed for '${stageName}' command [${command}]: ${secCheck.reason}`);
    }

    return {
      command,
      timeout_sec,
      continue_on_error,
    };
  });
}

/**
 * Parses and strictly validates a Pipra pipeline specification.
 *
 * @param {string} content - Raw YAML or JSON file content
 * @param {string} [format='yaml'] - 'yaml' or 'json'
 * @returns {{ valid: boolean, spec?: object, errors?: string[] }}
 */
function parsePipelineSpec(content, format = 'yaml') {
  if (!content || !content.trim()) {
    return { valid: false, errors: ['Pipeline spec content is empty'] };
  }

  let parsed = null;
  try {
    if (format === 'json') {
      parsed = JSON.parse(content);
    } else {
      parsed = parseSimpleYaml(content);
    }
  } catch (err) {
    return { valid: false, errors: [`Parser error: ${err.message}`] };
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { valid: false, errors: ['Pipeline specification must be a top-level key-value mapping'] };
  }

  // 1. Version check
  const version = String(parsed.version || '').trim();
  if (version !== '1.0' && version !== '1') {
    return { valid: false, errors: [`Unsupported pipeline version: '${parsed.version}'. Only version '1.0' is supported.`] };
  }

  const spec = {
    version: '1.0',
    preflight: [],
    build: {},
    verification: [],
    post_cutover: [],
  };

  const errors = [];

  // 2. Preflight hooks
  try {
    if (parsed.preflight) {
      spec.preflight = normalizeHooks(parsed.preflight, 'preflight');
    }
  } catch (err) {
    errors.push(err.message);
  }

  // 3. Build section
  if (parsed.build) {
    if (typeof parsed.build !== 'object' || Array.isArray(parsed.build)) {
      errors.push("Invalid 'build' specification: expected an object.");
    } else {
      spec.build = {
        dockerfile: parsed.build.dockerfile || null,
        context: parsed.build.context || null,
        args: typeof parsed.build.args === 'object' && !Array.isArray(parsed.build.args) ? parsed.build.args : {},
      };
    }
  }

  // 4. Staging verification hooks
  try {
    if (parsed.verification) {
      spec.verification = normalizeHooks(parsed.verification, 'verification');
    }
  } catch (err) {
    errors.push(err.message);
  }

  // 5. Post-cutover hooks
  try {
    if (parsed.post_cutover) {
      spec.post_cutover = normalizeHooks(parsed.post_cutover, 'post_cutover');
    }
  } catch (err) {
    errors.push(err.message);
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, spec };
}

/**
 * Discovers `.pipra.yaml`, `.pipra.yml`, or `.pipra.json` in a given repository directory.
 * @param {string} repoDir
 * @returns {{ found: boolean, filePath?: string, format?: string, content?: string }}
 */
function discoverPipelineSpec(repoDir) {
  if (!repoDir || !fs.existsSync(repoDir)) {
    return { found: false };
  }

  const candidates = [
    { name: '.pipra.yaml', format: 'yaml' },
    { name: '.pipra.yml', format: 'yaml' },
    { name: '.pipra.json', format: 'json' },
  ];

  for (const candidate of candidates) {
    const fullPath = path.join(repoDir, candidate.name);
    if (fs.existsSync(fullPath)) {
      try {
        const content = fs.readFileSync(fullPath, 'utf-8');
        return {
          found: true,
          filePath: fullPath,
          fileName: candidate.name,
          format: candidate.format,
          content,
        };
      } catch (err) {
        return {
          found: true,
          filePath: fullPath,
          fileName: candidate.name,
          format: candidate.format,
          error: `Failed to read spec file: ${err.message}`,
        };
      }
    }
  }

  return { found: false };
}

module.exports = {
  parseSimpleYaml,
  parsePipelineSpec,
  discoverPipelineSpec,
  validateCommandSecurity,
  FORBIDDEN_COMMAND_PATTERNS,
};
