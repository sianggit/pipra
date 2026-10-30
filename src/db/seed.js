/**
 * Pipra Database Seeder
 * Populates initial application, environments, agents, and default accounts.
 */

const crypto = require('node:crypto');
const logger = require('../utils/logger');
const config = require('../config');

function hashPassword(password) {
  const salt = 'pipra_salt_2026';
  return crypto.scryptSync(password, salt, 32).toString('hex');
}

function verifyPassword(password, hash) {
  const salt = 'pipra_salt_2026';
  const computed = crypto.scryptSync(password, salt, 32).toString('hex');
  return computed === hash;
}

function seedDatabase(db) {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  const now = new Date().toISOString();

  if (userCount === 0) {
    logger.info('Seeding default Pipra users (admin, operator, viewer)...');
    const insertUser = db.prepare(`
      INSERT INTO users (id, username, password_hash, role, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    insertUser.run('user-admin-1', 'admin', hashPassword('pipra-admin-2026'), 'admin', now);
    insertUser.run('user-ops-1', 'operator', hashPassword('pipra-ops-2026'), 'operator', now);
    insertUser.run('user-view-1', 'viewer', hashPassword('pipra-viewer-2026'), 'viewer', now);
  }

  const appCount = db.prepare('SELECT COUNT(*) as count FROM applications').get().count;
  if (appCount === 0) {
    logger.info('Seeding primary application: asdp-dims-fe...');
    const insertApp = db.prepare(`
      INSERT INTO applications (
        id, name, display_name, repo_url, app_dir,
        default_branch, permitted_branches, dockerfile, image_name,
        env_file, host_port, staging_port, container_port,
        healthcheck_path, healthcheck_max_retries, healthcheck_interval_sec,
        enable_local_verification, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertApp.run(
      'app-asdp-dims-fe',
      'asdp-dims-fe',
      'ASDP DIMS Frontend',
      'git@gitlab.asyst.co.id:asdp/asdp-dims-fe.git',
      '/home/devel/asdp-dims-fe',
      'devel',
      JSON.stringify(['devel', 'main', 'prod', 'staging', 'release/*', 'hotfix/*']),
      'Dockerfile.jenkins',
      'asdp-dims-fe',
      '.env.development',
      4000,
      4001,
      3000,
      '/',
      15,
      2,
      0, // local verification skipped by default to avoid duplicate build
      now,
      now
    );
  }

  const envCount = db.prepare('SELECT COUNT(*) as count FROM environments').get().count;
  const defaultHost = config.DEFAULT_TARGET_HOST;
  if (envCount === 0) {
    logger.info(`Seeding deployment environments (default target host: ${defaultHost})...`);
    const insertEnv = db.prepare(`
      INSERT INTO environments (
        id, name, display_name, is_production, host, agent_id,
        auth_type, ssh_user, ssh_port,
        active_release_id, last_health_status, last_verified_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertEnv.run(
      'env-devel',
      'devel',
      'Development',
      0,
      defaultHost,
      'agent-devel-prod',
      'NONE',
      'devel',
      22,
      'asdp-dims-fe:devel-20261027-v1.0.4',
      'HEALTHY',
      now
    );

    insertEnv.run(
      'env-staging',
      'staging',
      'Staging / QA',
      0,
      defaultHost,
      'agent-devel-prod',
      'NONE',
      'devel',
      22,
      'asdp-dims-fe:staging-20261027-v1.0.3',
      'HEALTHY',
      now
    );

    insertEnv.run(
      'env-production',
      'production',
      'Production',
      1,
      defaultHost,
      'agent-devel-prod',
      'NONE',
      'devel',
      22,
      'asdp-dims-fe:prod-20261026-v1.0.0',
      'HEALTHY',
      now
    );
  }

  const agentCount = db.prepare('SELECT COUNT(*) as count FROM agents').get().count;
  if (agentCount === 0) {
    logger.info('Seeding execution agents...');
    const insertAgent = db.prepare(`
      INSERT INTO agents (
        id, name, host, docker_version, status,
        active_jobs, cpu_usage, memory_free_mb, disk_free_gb, last_heartbeat
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    insertAgent.run(
      'agent-local',
      'Local Engine Worker',
      '127.0.0.1',
      'Docker Engine v27.1.1 (Simulated/Local)',
      'ONLINE',
      0,
      12.4,
      8192,
      142,
      now
    );

    insertAgent.run(
      'agent-devel-prod',
      'Devel/Prod Target Host',
      defaultHost,
      'Docker Engine v26.1.3 (Linux x86_64)',
      'ONLINE',
      0,
      18.2,
      16384,
      380,
      now
    );
  }
}

module.exports = {
  hashPassword,
  verifyPassword,
  seedDatabase,
};
