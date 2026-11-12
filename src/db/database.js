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
  db.exec('PRAGMA busy_timeout = 5000;');
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA synchronous = NORMAL;');
  db.exec('PRAGMA foreign_keys = ON;');

  initSchema(db);

  // Auto-seed security baseline & default accounts on first database creation
  try {
    const { seedCoreSystem } = require('./seed');
    seedCoreSystem(db);
  } catch {}

  if (!customPath) {
    dbInstance = db;
  }
  return db;
}

function initSchema(db) {
  const targetDb = db || dbInstance || getDatabase();
  targetDb.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'operator', 'viewer')),
      must_change_password INTEGER DEFAULT 0,
      failed_login_attempts INTEGER DEFAULT 0,
      locked_until TEXT DEFAULT NULL,
      password_updated_at TEXT DEFAULT NULL,
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
      is_archived INTEGER NOT NULL DEFAULT 0,
      webhook_secret TEXT,
      webhook_enabled INTEGER NOT NULL DEFAULT 0,
      auto_deploy_branch TEXT NOT NULL DEFAULT 'devel',
      auto_deploy_environment_id TEXT,
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

    CREATE TABLE IF NOT EXISTS application_environments (
      id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL,
      name TEXT NOT NULL,
      display_name TEXT NOT NULL,
      is_production INTEGER NOT NULL DEFAULT 0,
      host TEXT NOT NULL DEFAULT '127.0.0.1',
      ssh_port INTEGER NOT NULL DEFAULT 22,
      ssh_user TEXT NOT NULL DEFAULT 'devel',
      auth_type TEXT NOT NULL DEFAULT 'NONE' CHECK(auth_type IN ('NONE', 'SSH_KEY', 'SSH_PASSWORD')),
      encrypted_credential TEXT,
      credential_updated_at TEXT,
      app_dir TEXT NOT NULL,
      env_file TEXT NOT NULL,
      host_port INTEGER NOT NULL,
      staging_port INTEGER NOT NULL,
      container_port INTEGER NOT NULL DEFAULT 3000,
      healthcheck_path TEXT NOT NULL DEFAULT '/',
      healthcheck_max_retries INTEGER NOT NULL DEFAULT 15,
      healthcheck_interval_sec INTEGER NOT NULL DEFAULT 2,
      enable_local_verification INTEGER NOT NULL DEFAULT 0,
      requires_approval INTEGER NOT NULL DEFAULT 0,
      active_release_id TEXT,
      last_health_status TEXT NOT NULL DEFAULT 'UNKNOWN',
      last_verified_at TEXT,
      is_archived INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(application_id) REFERENCES applications(id) ON DELETE CASCADE,
      UNIQUE(application_id, name)
    );

    CREATE INDEX IF NOT EXISTS idx_app_env_app_id ON application_environments(application_id);

    CREATE TABLE IF NOT EXISTS deployments (
      id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL,
      environment_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN (
        'QUEUED', 'PREPARING', 'RUNNING', 'VERIFYING',
        'WAITING_FOR_APPROVAL',
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
      requires_approval INTEGER NOT NULL DEFAULT 0,
      approved_by_user_id TEXT,
      approved_by_username TEXT,
      approved_at TEXT,
      approval_comments TEXT,
      pipeline_spec TEXT,
      diagnostic_summary TEXT,
      diagnostic_details TEXT,
      error_message TEXT,
      started_at TEXT,
      finished_at TEXT,
      duration_ms INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY(application_id) REFERENCES applications(id)
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

    CREATE TABLE IF NOT EXISTS webhook_events (
      id TEXT PRIMARY KEY,
      application_id TEXT NOT NULL,
      provider TEXT NOT NULL CHECK(provider IN ('GITHUB', 'GITLAB')),
      event_type TEXT NOT NULL,
      delivery_id TEXT,
      branch TEXT,
      commit_sha TEXT,
      commit_message TEXT,
      author TEXT,
      status TEXT NOT NULL CHECK(status IN ('ACCEPTED', 'REJECTED', 'IGNORED', 'BUSY')),
      rejection_reason TEXT,
      deployment_id TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(application_id) REFERENCES applications(id) ON DELETE CASCADE,
      FOREIGN KEY(deployment_id) REFERENCES deployments(id) ON DELETE SET NULL
    );

    CREATE INDEX IF NOT EXISTS idx_deployments_app_env ON deployments(application_id, environment_id);
    CREATE INDEX IF NOT EXISTS idx_deployments_status ON deployments(status);
    CREATE INDEX IF NOT EXISTS idx_deployments_created ON deployments(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_deployments_prod_time ON deployments(environment_id, status, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_deployment_logs_deploy ON deployment_logs(deployment_id, id);
    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_webhook_events_app ON webhook_events(application_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_webhook_events_delivery ON webhook_events(delivery_id);

    CREATE TABLE IF NOT EXISTS provenance_records (
      id TEXT PRIMARY KEY,
      deployment_id TEXT NOT NULL,
      application_id TEXT NOT NULL,
      commit_sha TEXT,
      image_digest TEXT,
      attestation_json TEXT NOT NULL,
      signature TEXT NOT NULL,
      signer_key_id TEXT NOT NULL,
      verified_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(deployment_id) REFERENCES deployments(id) ON DELETE CASCADE,
      FOREIGN KEY(application_id) REFERENCES applications(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_provenance_deployment ON provenance_records(deployment_id);
    CREATE INDEX IF NOT EXISTS idx_provenance_app ON provenance_records(application_id);
  `);

  // Migrate environments table columns if missing
  try {
    const envCols = targetDb.prepare('PRAGMA table_info(environments)').all().map(c => c.name);
    if (!envCols.includes('auth_type')) {
      targetDb.exec("ALTER TABLE environments ADD COLUMN auth_type TEXT NOT NULL DEFAULT 'NONE';");
    }
    if (!envCols.includes('ssh_user')) {
      targetDb.exec("ALTER TABLE environments ADD COLUMN ssh_user TEXT NOT NULL DEFAULT 'devel';");
    }
    if (!envCols.includes('ssh_port')) {
      targetDb.exec("ALTER TABLE environments ADD COLUMN ssh_port INTEGER NOT NULL DEFAULT 22;");
    }
    if (!envCols.includes('encrypted_credential')) {
      targetDb.exec("ALTER TABLE environments ADD COLUMN encrypted_credential TEXT;");
    }
    if (!envCols.includes('credential_updated_at')) {
      targetDb.exec("ALTER TABLE environments ADD COLUMN credential_updated_at TEXT;");
    }

    // Migrate is_archived and webhook columns for applications
    const appCols = targetDb.prepare('PRAGMA table_info(applications)').all().map(c => c.name);
    if (!appCols.includes('is_archived')) {
      targetDb.exec("ALTER TABLE applications ADD COLUMN is_archived INTEGER NOT NULL DEFAULT 0;");
    }
    if (!appCols.includes('webhook_secret')) {
      targetDb.exec("ALTER TABLE applications ADD COLUMN webhook_secret TEXT;");
    }
    if (!appCols.includes('webhook_enabled')) {
      targetDb.exec("ALTER TABLE applications ADD COLUMN webhook_enabled INTEGER NOT NULL DEFAULT 0;");
    }
    if (!appCols.includes('auto_deploy_branch')) {
      targetDb.exec("ALTER TABLE applications ADD COLUMN auto_deploy_branch TEXT NOT NULL DEFAULT 'devel';");
    }
    if (!appCols.includes('auto_deploy_environment_id')) {
      targetDb.exec("ALTER TABLE applications ADD COLUMN auto_deploy_environment_id TEXT;");
    }

    const appEnvCols = targetDb.prepare('PRAGMA table_info(application_environments)').all().map(c => c.name);
    if (!appEnvCols.includes('is_archived')) {
      targetDb.exec("ALTER TABLE application_environments ADD COLUMN is_archived INTEGER NOT NULL DEFAULT 0;");
    }
    if (!appEnvCols.includes('requires_approval')) {
      targetDb.exec("ALTER TABLE application_environments ADD COLUMN requires_approval INTEGER NOT NULL DEFAULT 0;");
    }

    // Migrate approval columns on deployments table
    const depCols = targetDb.prepare('PRAGMA table_info(deployments)').all().map(c => c.name);
    if (!depCols.includes('requires_approval')) {
      targetDb.exec("ALTER TABLE deployments ADD COLUMN requires_approval INTEGER NOT NULL DEFAULT 0;");
    }
    if (!depCols.includes('approved_by_user_id')) {
      targetDb.exec("ALTER TABLE deployments ADD COLUMN approved_by_user_id TEXT;");
    }
    if (!depCols.includes('approved_by_username')) {
      targetDb.exec("ALTER TABLE deployments ADD COLUMN approved_by_username TEXT;");
    }
    if (!depCols.includes('approved_at')) {
      targetDb.exec("ALTER TABLE deployments ADD COLUMN approved_at TEXT;");
    }
    if (!depCols.includes('approval_comments')) {
      targetDb.exec("ALTER TABLE deployments ADD COLUMN approval_comments TEXT;");
    }

    // Migrate check constraint on deployments table if WAITING_FOR_APPROVAL is missing
    const depMaster = targetDb.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='deployments'").get();
    if (depMaster && depMaster.sql && !depMaster.sql.includes('WAITING_FOR_APPROVAL')) {
      const existingOldCols = targetDb.prepare('PRAGMA table_info(deployments)').all().map(c => c.name);
      targetDb.exec(`
        PRAGMA foreign_keys = OFF;
        ALTER TABLE deployments RENAME TO deployments_old_approval;
        CREATE TABLE deployments (
          id TEXT PRIMARY KEY,
          application_id TEXT NOT NULL,
          environment_id TEXT NOT NULL,
          status TEXT NOT NULL CHECK(status IN (
            'QUEUED', 'PREPARING', 'RUNNING', 'VERIFYING',
            'WAITING_FOR_APPROVAL',
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
          requires_approval INTEGER NOT NULL DEFAULT 0,
          approved_by_user_id TEXT,
          approved_by_username TEXT,
          approved_at TEXT,
          approval_comments TEXT,
          error_message TEXT,
          started_at TEXT,
          finished_at TEXT,
          duration_ms INTEGER DEFAULT 0,
          created_at TEXT NOT NULL,
          FOREIGN KEY(application_id) REFERENCES applications(id)
        );
      `);
      const newCols = targetDb.prepare('PRAGMA table_info(deployments)').all().map(c => c.name);
      const sharedCols = newCols.filter(col => existingOldCols.includes(col));
      targetDb.exec(`
        INSERT INTO deployments (${sharedCols.join(', ')})
        SELECT ${sharedCols.join(', ')} FROM deployments_old_approval;
        DROP TABLE deployments_old_approval;
        PRAGMA foreign_keys = ON;
      `);
    }

    // Fix any foreign keys that were rewritten by SQLite table rename to 'deployments_old_approval'
    try {
      const oldRefTables = targetDb.prepare("SELECT name, sql FROM sqlite_master WHERE type='table' AND sql LIKE '%deployments_old_approval%'").all();
      if (oldRefTables.length > 0) {
        targetDb.exec('PRAGMA foreign_keys = OFF; PRAGMA legacy_alter_table = ON;');
        for (const t of oldRefTables) {
          const fixedSql = t.sql.replace(/"deployments_old_approval"/g, 'deployments').replace(/deployments_old_approval/g, 'deployments');
          const tempName = `${t.name}_backup_fix`;
          targetDb.exec(`ALTER TABLE ${t.name} RENAME TO ${tempName};`);
          targetDb.exec(fixedSql);
          targetDb.exec(`INSERT INTO ${t.name} SELECT * FROM ${tempName};`);
          targetDb.exec(`DROP TABLE ${tempName};`);
        }
        targetDb.exec('PRAGMA foreign_keys = ON; PRAGMA legacy_alter_table = OFF;');
      }
    } catch (fkErr) {
      logger.warn('Foreign key repair note:', fkErr.message);
    }

    // Migrate deployments table columns if missing
    try {
      const depCols = targetDb.prepare('PRAGMA table_info(deployments)').all().map(c => c.name);
      if (!depCols.includes('pipeline_spec')) {
        targetDb.exec('ALTER TABLE deployments ADD COLUMN pipeline_spec TEXT;');
      }
      if (!depCols.includes('diagnostic_summary')) {
        targetDb.exec('ALTER TABLE deployments ADD COLUMN diagnostic_summary TEXT;');
      }
      if (!depCols.includes('diagnostic_details')) {
        targetDb.exec('ALTER TABLE deployments ADD COLUMN diagnostic_details TEXT;');
      }
    } catch {}

    // Migrate user & audit security columns (ISO 27001 A.8.5, A.5.17, A.8.15)
    try {
      const userCols = targetDb.prepare('PRAGMA table_info(users)').all().map(c => c.name);
      if (!userCols.includes('must_change_password')) {
        targetDb.exec("ALTER TABLE users ADD COLUMN must_change_password INTEGER DEFAULT 0;");
      }
      if (!userCols.includes('failed_login_attempts')) {
        targetDb.exec("ALTER TABLE users ADD COLUMN failed_login_attempts INTEGER DEFAULT 0;");
      }
      if (!userCols.includes('locked_until')) {
        targetDb.exec("ALTER TABLE users ADD COLUMN locked_until TEXT DEFAULT NULL;");
      }
      if (!userCols.includes('password_updated_at')) {
        targetDb.exec("ALTER TABLE users ADD COLUMN password_updated_at TEXT DEFAULT NULL;");
      }

      const auditCols = targetDb.prepare('PRAGMA table_info(audit_logs)').all().map(c => c.name);
      if (!auditCols.includes('prev_hash')) {
        targetDb.exec("ALTER TABLE audit_logs ADD COLUMN prev_hash TEXT DEFAULT NULL;");
      }
      if (!auditCols.includes('curr_hash')) {
        targetDb.exec("ALTER TABLE audit_logs ADD COLUMN curr_hash TEXT DEFAULT NULL;");
      }
    } catch (migErr) {
      logger.warn('User/audit security column migration note:', migErr.message);
    }

    // Auto-sync shadow compatibility records from application_environments to environments
    try {
      targetDb.exec(`
        INSERT OR IGNORE INTO environments (id, name, display_name, is_production, host, ssh_user, ssh_port, auth_type)
        SELECT id, id, display_name, is_production, host, ssh_user, ssh_port, auth_type FROM application_environments;
      `);
    } catch {}
  } catch (err) {
    logger.warn('Environment schema migration check note:', err.message);
  }
}

module.exports = {
  getDatabase,
  initSchema,
};
