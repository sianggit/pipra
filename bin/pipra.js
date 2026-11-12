#!/usr/bin/env node

/**
 * Pipra CLI Entrypoint
 * Enables instant execution via:
 *   npx pipra-ci
 *   pipra start --port 4200
 */

const path = require('node:path');
const fs = require('node:fs');

// Parse simple CLI arguments
const args = process.argv.slice(2);
const command = args[0] || 'start';

function printHelp() {
  console.log(`
Pipra — Pipeline & Release Engineering Platform

Usage:
  npx pipra-ci [command] [options]
  pipra [command] [options]

Commands:
  start          Start the Pipra control plane (default)
  version, -v    Display current Pipra version
  help, -h       Display this help message

Options:
  --port, -p     Port to listen on (default: 4200, or process.env.PORT)
  --host, -H     Host network interface to bind to (default: 0.0.0.0)
  --data, -d     Directory path for SQLite database (default: ./data)
  --sim          Force simulation mode (no Docker daemon required)
  `);
}

if (command === 'help' || command === '-h' || command === '--help') {
  printHelp();
  process.exit(0);
}

if (command === 'version' || command === '-v' || command === '--version') {
  const pkg = require('../package.json');
  console.log(`Pipra v${pkg.version}`);
  process.exit(0);
}

// Extract option flags
for (let i = 0; i < args.length; i++) {
  if ((args[i] === '--port' || args[i] === '-p') && args[i + 1]) {
    process.env.PORT = args[i + 1];
    i++;
  } else if ((args[i] === '--host' || args[i] === '-H') && args[i + 1]) {
    process.env.HOST = args[i + 1];
    i++;
  } else if ((args[i] === '--data' || args[i] === '-d') && args[i + 1]) {
    process.env.DB_PATH = path.join(path.resolve(args[i + 1]), 'pipra.db');
    i++;
  } else if (args[i] === '--sim') {
    process.env.EXEC_MODE = 'sim';
  }
}

// Ensure data directory exists
const dbPath = process.env.DB_PATH || path.join(process.cwd(), 'data', 'pipra.db');
const dataDir = path.dirname(dbPath);
if (!fs.existsSync(dataDir)) {
  try {
    fs.mkdirSync(dataDir, { recursive: true });
  } catch {}
}

// Start Pipra server
require('../server.js');

