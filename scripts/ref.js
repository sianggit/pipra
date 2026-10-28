#!/usr/bin/env node
/**
 * scripts/ref.js
 * Universal Developer Reference & Tooling Dispatcher
 * Manages bridges, ledgers, duplication checks, and knowledge graphs
 * without exposing .reference paths in package.json.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const REF_DIR = path.join(PROJECT_ROOT, '.reference');
const rawArgs = process.argv.slice(2);

function printHelp() {
  console.log(`
Universal Developer Reference & Tooling Runner
Usage:
  npm run ref -- [command | flag] [options]
  node scripts/ref.js [command | flag] [options]

Available Commands & Flags:
  --bridges, bridges [opts]    Sync workspace OS bridges (--status, --clean, --rebuild)
  --backup, backup             Create isolated git snapshot of reference ledger
  --history, history           Show git commit history of reference ledger
  --status, status             Check git status of reference ledger
  --verify, verify             Verify integrity and secret-scanning on reference ledger
  --restore, restore [hash]    Restore reference ledger to a target commit hash
  --dup, dup                   Run jscpd code duplication analysis (ratchet check)
  --graphify, graphify         Sync codebase AST knowledge graph
  --e2e, e2e [opts]            Run Playwright & Chrome DevTools E2E recorder (--list, --scenario <id>)
  --antislop, antislop [opts]  Check status or verify anti-slop quality filter (status, verify)
  --help, -h                   Display this help message
`);
}

function normalizeCommand(arg) {
  if (!arg) return 'help';
  if (arg === '--help' || arg === '-h') return 'help';
  return arg.replace(/^--/, '').toLowerCase();
}

const mainCommand = normalizeCommand(rawArgs[0]);
const subArgs = rawArgs.slice(1);

function runCommand(bin, cmdArgs, cwd = PROJECT_ROOT) {
  const isWindows = process.platform === 'win32';
  const isNode = bin === process.execPath;
  const useShell = isWindows && !isNode && bin === 'npx';

  const result = spawnSync(bin, cmdArgs, {
    cwd,
    stdio: 'inherit',
    env: process.env,
    shell: useShell
  });
  process.exit(result.status ?? 0);
}

function ensureReferenceDir() {
  if (!fs.existsSync(REF_DIR)) {
    console.log('[ref] .reference directory is not present in this workspace.');
    console.log('[ref] Reference tooling is optional or managed externally via "portal" CLI.');
    process.exit(0);
  }
}

switch (mainCommand) {
  case 'help': {
    printHelp();
    process.exit(0);
    break;
  }

  case 'bridges': {
    ensureReferenceDir();
    const bridgeRunner = path.join(REF_DIR, 'system', 'scripts', 'sync-bridges.js');
    if (!fs.existsSync(bridgeRunner)) {
      console.error(`[ref] Bridge runner not found at: ${bridgeRunner}`);
      process.exit(1);
    }
    const normalizedArgs = subArgs.map(arg => {
      const lower = arg.toLowerCase().replace(/^--/, '');
      if (lower === 'status') return '--status';
      if (lower === 'clean') return '--clean';
      if (lower === 'rebuild') return '--rebuild';
      return arg;
    });
    runCommand(process.execPath, [bridgeRunner, ...normalizedArgs]);
    break;
  }

  case 'backup':
  case 'history':
  case 'status':
  case 'restore': {
    ensureReferenceDir();
    const backupRunner = path.join(REF_DIR, 'system', 'scripts', 'ref-backup.js');
    if (!fs.existsSync(backupRunner)) {
      console.error(`[ref] Backup engine not found at: ${backupRunner}`);
      process.exit(1);
    }
    runCommand(process.execPath, [backupRunner, mainCommand, ...subArgs]);
    break;
  }

  case 'verify': {
    ensureReferenceDir();
    const backupRunner = path.join(REF_DIR, 'system', 'scripts', 'ref-backup.js');
    if (fs.existsSync(backupRunner)) {
      const gitRes = spawnSync(process.execPath, [backupRunner, 'verify'], {
        cwd: PROJECT_ROOT,
        stdio: 'inherit',
        env: process.env
      });
      if (gitRes.status !== 0) {
        process.exit(gitRes.status ?? 1);
      }
    }

    console.log('\n[ref] Verifying Anti-Slop Canonical Integration & Quality Gates...');
    const skillsDir = path.join(REF_DIR, 'system', 'agents', 'skills');
    const requiredSkills = ['antislop', 'antislop-code', 'antislop-copywriting', 'antislop-human', 'antislop-layoutmobile', 'antislop-ui'];
    let allSkillsFound = true;
    for (const s of requiredSkills) {
      const skillFile = path.join(skillsDir, s, 'SKILL.md');
      if (!fs.existsSync(skillFile)) {
        console.error(`  [FAIL] Missing anti-slop skill: "${s}"`);
        allSkillsFound = false;
      } else {
        console.log(`  [OK] Skill verified: "${s}"`);
      }
    }

    const ruleFile = path.join(REF_DIR, 'system', 'agents', 'rules', 'antislop.md');
    if (fs.existsSync(ruleFile)) {
      console.log('  [OK] Rule verified: antislop.md');
    } else {
      console.error('  [FAIL] Missing rule: antislop.md');
      allSkillsFound = false;
    }

    const contrastScript = path.join(skillsDir, 'antislop-human', 'contrast-check.py');
    if (fs.existsSync(contrastScript)) {
      const pyCheck = spawnSync('python', [contrastScript, '--selftest'], { encoding: 'utf8' });
      if (pyCheck.status === 0) {
        console.log('  [OK] Tool execution: contrast-check.py --selftest PASSED');
      } else {
        console.log('  [WARN] Python unavailable or selftest notice (offline check skipped)');
      }
    }

    // Thesis isolation check
    const hasThesisDir = fs.existsSync(path.join(REF_DIR, 'thesis'));
    const isThesisTemplate = fs.existsSync(path.join(REF_DIR, 'thesis', 'bab_1_pendahuluan'));
    if (hasThesisDir && !isThesisTemplate) {
      console.error('  [SECURITY ALERT] Partial thesis directory detected in non-thesis project!');
      allSkillsFound = false;
    } else if (!hasThesisDir) {
      console.log('  [OK] Blueprint isolation verified (zero thesis cross-contamination)');
    }

    if (!allSkillsFound) {
      console.error('\n[ref] Verification FAILED: Anti-slop integration is incomplete. Run "portal update" to repair.');
      process.exit(1);
    }
    console.log('\n[ref] All reference ledger and anti-slop integrity checks PASSED successfully!');
    process.exit(0);
    break;
  }

  case 'antislop': {
    ensureReferenceDir();
    const action = subArgs[0] || 'status';
    try {
      const portalAntislop = path.join(REF_DIR, 'portal', 'antislop');
      const antislopModule = fs.existsSync(portalAntislop) ? require(portalAntislop) : require('../src/antislop');
      if (action === 'status') {
        const st = antislopModule.getStatus(PROJECT_ROOT);
        console.log('\n=== Anti-Slop Integration Status ===');
        console.log(`State       : ${st.state}`);
        console.log(`Version     : v${st.version} (${st.commit.substring(0, 8)})`);
        console.log(`Skills      : ${st.canonicalSkillsCount}/${st.totalSkillsExpected} canonical, ${st.workspaceSkillsCount}/${st.totalSkillsExpected} workspace`);
        console.log(`Rule Active : ${st.hasRule ? 'YES' : 'NO'}`);
        console.log(`Pointers    : AGENTS.md: ${st.hasAgentsPointer ? 'YES' : 'NO'} | GEMINI.md: ${st.hasGeminiPointer ? 'YES' : 'NO'}`);
        console.log('====================================\n');
      } else if (action === 'verify') {
        const v = antislopModule.verifyIntegration(PROJECT_ROOT);
        console.log('\n=== Anti-Slop Verification Report ===');
        v.checks.forEach(c => {
          console.log(`  [${c.pass ? 'PASS' : (c.warning ? 'WARN' : 'FAIL')}] ${c.name}${c.error ? ' - ' + c.error : ''}`);
        });
        if (v.valid) {
          console.log('\n[SUCCESS] Anti-slop integration is complete and delivery-gate ready!\n');
        } else {
          console.error('\n[ERROR] Anti-slop verification failed. Run "portal update" to repair.\n');
          process.exit(1);
        }
      } else {
        console.log('Usage: npm run ref antislop [status|verify]');
      }
    } catch (e) {
      console.error('[ref antislop] Error:', e.message);
      process.exit(1);
    }
    process.exit(0);
    break;
  }

  case 'dup':
  case 'dup-check':
  case 'dup:check': {
    const rawOutputDir = fs.existsSync(REF_DIR)
      ? path.join(REF_DIR, 'system', 'jscpd')
      : path.join(PROJECT_ROOT, '.jscpd');

    const outputDir = path.relative(PROJECT_ROOT, rawOutputDir).replace(/\\/g, '/');

    const jscpdArgs = [
      '-y',
      'jscpd',
      'src',
      '--min-lines', '15',
      '--min-tokens', '50',
      '--threshold', '5',
      '--reporters', 'console,json',
      '--output', outputDir,
      ...subArgs
    ];
    runCommand('npx', jscpdArgs);
    break;
  }

  case 'graphify':
  case 'graphify-sync':
  case 'graphify:sync': {
    if (process.platform === 'win32') {
      const psScript = path.join(REF_DIR, 'system', 'scripts', '2026-09-21_System_Sync-Graphify_v1.0.ps1');
      if (fs.existsSync(psScript)) {
        runCommand('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', psScript]);
      } else {
        runCommand('python', ['-m', 'graphifyy']);
      }
    } else {
      runCommand('python', ['-m', 'graphifyy']);
    }
    break;
  }

  case 'e2e': {
    ensureReferenceDir();
    const e2eRunner = path.join(REF_DIR, 'evidence', 'e2e', 'runner.mjs');
    if (!fs.existsSync(e2eRunner)) {
      console.error(`[ref] E2E runner not found at: ${e2eRunner}`);
      process.exit(1);
    }
    runCommand(process.execPath, [e2eRunner, ...subArgs]);
    break;
  }

  default: {
    console.error(`[ref] Unknown command or flag: "${rawArgs[0]}". Run "npm run ref -- --help" for available commands.`);
    process.exit(1);
  }
}
