/**
 * Pipra SQLite Database Engine
 * Built on native Node.js v26 node:sqlite with WAL Mode
 */

const { DatabaseSync } = require('node:sqlite');
const config = require('../config');
const logger = require('../utils/logger');

let dbInstance = null;

function getDatabase(customPath = null) {
  if (dbInstance && !customPath) return dbInstance;

  const dbPath = customPath || config.DB_PATH;
  logger.info(`Opening Pipra SQLite database at: ${dbPath}`);

  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA synchronous = NORMAL;');
  db.exec('PRAGMA foreign_keys = ON;');

  initSchema(db);

  if (!customPath) {
    dbInstance = db;
  }
  return db;
}

function initSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'operator', 'viewer')),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS applications (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      repo_url TEXT NOT NULL,
      app_dir TEXT NOT NULL,
      default_branch TEXT NOT NULL DEFAULT 'devel',
      permitted_branches TEXT NOT NULL DEFAULT '["devel","main","prod","release/*","hotfix/*"]',
      dockerfile TEXT NOT NULL DEFAULT 'Dockerfile.jenkins',
      image_name TEXT NOT NULL DEFAULT 'asdp-dims-fe',
      env_file TEXT NOT NULL DEFAULT '.env.development',
      host_port INTEGER NOT NULL DEFAULT 4000,
      staging_port INTEGER NOT NULL DEFAULT 4001,
      container_port INTEGER NOT NULL DEFAULT 3000,
      healthcheck_path TEXT NOT NULL DEFAULT '/',
      healthcheck_max_retries INTEGER NOT NULL DEFAULT 15,
      healthcheck_interval_sec INTEGER NOT NULL DEFAULT 2,
      enable_local_verification INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS environments (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      display_name TEXT NOT NULL,
      is_production INTEGER NOT NULL DEFAULT 0,
      host TEXT NOT NULL DEFAULT '127.0.0.1',
      agent_id TEXT NOT NULL DEFAULT 'agent-local',
      auth_type TEXT NOT NULL DEFAULT 'NONE',
      ssh_user TEXT NOT NULL DEFAULT 'devel',
      ssh_port INTEGER NOT NULL DEFAULT 22,
      encrypted_credential TEXT,
      credential_updated_at TEXT,
      active_release_id TEXT,
      last_health_status TEXT NOT NULL DEFAULT 'UNKNOWN',
      last_verified_at TEXT
    );

    CREATE TABLE IF NOT EXISTS deployments (
      id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL,
      environment_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN (
        'QUEUED', 'PREPARING', 'RUNNING', 'VERIFYING',
        'CUTTING_OVER', 'ROLLING_BACK', 'SUCCEEDED', 'FAILED',
        'CANCELLED', 'INTERRUPTED', 'ROLLBACK_FAILED'
      )),
      initiated_by TEXT NOT NULL,
      branch TEXT NOT NULL,
      commit_sha TEXT,
      commit_message TEXT,
      author TEXT,
      image_tag TEXT NOT NULL,
      container_name TEXT NOT NULL,
      staging_container_name TEXT,
      backup_container_name TEXT,
      current_stage INTEGER NOT NULL DEFAULT 1,
      current_stage_name TEXT NOT NULL DEFAULT 'Preflight',
      rollback_status TEXT NOT NULL DEFAULT 'NONE' CHECK(rollback_status IN ('NONE', 'IN_PROGRESS', 'SUCCESSFUL', 'FAILED')),
      rollback_candidate_id TEXT,
      error_message TEXT,
      started_at TEXT,
      finished_at TEXT,
      duration_ms INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY(application_id) REFERENCES applications(id),
      FOREIGN KEY(environment_id) REFERENCES environments(id)
    );

    CREATE TABLE IF NOT EXISTS deployment_stages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      deployment_id TEXT NOT NULL,
      stage_number INTEGER NOT NULL,
      stage_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'SKIPPED')),
      started_at TEXT,
      finished_at TEXT,
      duration_ms INTEGER DEFAULT 0,
      details TEXT,
      FOREIGN KEY(deployment_id) REFERENCES deployments(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS deployment_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      deployment_id TEXT NOT NULL,
      stage_number INTEGER NOT NULL,
      level TEXT NOT NULL DEFAULT 'info',
      message TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      FOREIGN KEY(deployment_id) REFERENCES deployments(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS health_probes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      deployment_id TEXT NOT NULL,
      stage_number INTEGER NOT NULL,
      attempt INTEGER NOT NULL,
      max_attempts INTEGER NOT NULL,
      url TEXT NOT NULL,
      http_status INTEGER NOT NULL,
      response_time_ms INTEGER NOT NULL,
      passed INTEGER NOT NULL,
      error TEXT,
      timestamp TEXT NOT NULL,
      FOREIGN KEY(deployment_id) REFERENCES deployments(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      host TEXT NOT NULL,
      docker_version TEXT,
      status TEXT NOT NULL DEFAULT 'ONLINE' CHECK(status IN ('ONLINE', 'BUSY', 'OFFLINE')),
      active_jobs INTEGER NOT NULL DEFAULT 0,
      cpu_usage REAL DEFAULT 0.0,
      memory_free_mb INTEGER DEFAULT 0,
      disk_free_gb INTEGER DEFAULT 0,
      last_heartbeat TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      action TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT,
      environment TEXT,
      details TEXT,
      ip_address TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_deployments_app_env ON deployments(application_id, environment_id);
    CREATE INDEX IF NOT EXISTS idx_deployments_status ON deployments(status);
    CREATE INDEX IF NOT EXISTS idx_deployment_logs_deploy ON deployment_logs(deployment_id, id);
    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
  `);

  // Migrate environments table columns if missing
  try {
    const envCols = db.prepare('PRAGMA table_info(environments)').all().map(c => c.name);
    if (!envCols.includes('auth_type')) {
      db.exec("ALTER TABLE environments ADD COLUMN auth_type TEXT NOT NULL DEFAULT 'NONE';");
    }
    if (!envCols.includes('ssh_user')) {
      db.exec("ALTER TABLE environments ADD COLUMN ssh_user TEXT NOT NULL DEFAULT 'devel';");
    }
    if (!envCols.includes('ssh_port')) {
      db.exec("ALTER TABLE environments ADD COLUMN ssh_port INTEGER NOT NULL DEFAULT 22;");
    }
    if (!envCols.includes('encrypted_credential')) {
      db.exec("ALTER TABLE environments ADD COLUMN encrypted_credential TEXT;");
    }
    if (!envCols.includes('credential_updated_at')) {
      db.exec("ALTER TABLE environments ADD COLUMN credential_updated_at TEXT;");
    }
  } catch (err) {
    logger.warn('Environment schema migration check note:', err.message);
  }
}

module.exports = {
  getDatabase,
  initSchema,
};
