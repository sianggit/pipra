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

function seedCoreSystem(db) {
  const adminExists = db.prepare('SELECT id FROM users WHERE id = ?').get('user-admin-1');
  const now = new Date().toISOString();

  if (!adminExists) {
    logger.info('Seeding default Pipra users (admin, operator, viewer)...');
    const insertUser = db.prepare(`
      INSERT OR IGNORE INTO users (id, username, password_hash, role, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);

    insertUser.run('user-admin-1', 'admin', hashPassword('pipra-admin-2026'), 'admin', now);
    insertUser.run('user-ops-1', 'operator', hashPassword('pipra-ops-2026'), 'operator', now);
    insertUser.run('user-view-1', 'viewer', hashPassword('pipra-viewer-2026'), 'viewer', now);
  }

  const agentExists = db.prepare('SELECT id FROM agents WHERE id = ?').get('agent-local');
  const defaultHost = config.DEFAULT_TARGET_HOST;
  if (!agentExists) {
    logger.info('Seeding execution agents...');
    const insertAgent = db.prepare(`
      INSERT OR IGNORE INTO agents (
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

function seedDemoFixtures(db) {
  const now = new Date().toISOString();
  const defaultHost = config.DEFAULT_TARGET_HOST;
  const asdpApp = db.prepare('SELECT id FROM applications WHERE id = ?').get('app-asdp-dims-fe');
  if (!asdpApp) {
    logger.info('Seeding primary application: asdp-dims-fe...');
    const insertApp = db.prepare(`
      INSERT OR IGNORE INTO applications (
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
      JSON.stringify(['devel', 'develop', 'main', 'prod', 'staging', 'release/*', 'hotfix/*']),
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

  const develEnv = db.prepare('SELECT id FROM environments WHERE id = ?').get('env-devel');
  if (!develEnv) {
    logger.info(`Seeding deployment environments (default target host: ${defaultHost})...`);
    const insertEnv = db.prepare(`
      INSERT OR IGNORE INTO environments (
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

  const asdpFeDevel = db.prepare('SELECT id FROM application_environments WHERE id = ?').get('app-env-asdp-fe-devel');
  if (!asdpFeDevel) {
    logger.info('Seeding application-scoped environments...');
    const insertAppEnv = db.prepare(`
      INSERT OR IGNORE INTO application_environments (
        id, application_id, name, display_name, is_production,
        host, ssh_port, ssh_user, auth_type,
        app_dir, env_file, host_port, staging_port, container_port,
        healthcheck_path, healthcheck_max_retries, healthcheck_interval_sec,
        enable_local_verification, active_release_id, last_health_status, last_verified_at,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Mirror into environments for backward compatibility with existing databases
    const insertCompatEnv = db.prepare(`
      INSERT OR IGNORE INTO environments (id, name, display_name, is_production, host, ssh_user, ssh_port, auth_type, active_release_id, last_health_status, last_verified_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // 1. ASDP DIMS Frontend - Development
    insertAppEnv.run(
      'app-env-asdp-fe-devel',
      'app-asdp-dims-fe',
      'devel',
      'Development Host',
      0,
      defaultHost,
      22,
      'devel',
      'NONE',
      '/home/devel/asdp-dims-fe',
      '.env.development',
      4000,
      4001,
      3000,
      '/',
      15,
      2,
      0,
      'asdp-dims-fe:devel-20261027-v1.0.4',
      'HEALTHY',
      now,
      now,
      now
    );
    insertCompatEnv.run('app-env-asdp-fe-devel', 'app-env-asdp-fe-devel', 'Development Host', 0, defaultHost, 'devel', 22, 'NONE', 'asdp-dims-fe:devel-20261027-v1.0.4', 'HEALTHY', now);

    // 2. ASDP DIMS Frontend - Staging
    insertAppEnv.run(
      'app-env-asdp-fe-staging',
      'app-asdp-dims-fe',
      'staging',
      'Staging / QA',
      0,
      defaultHost,
      22,
      'devel',
      'NONE',
      '/home/devel/asdp-dims-fe',
      '.env.staging',
      4000,
      4001,
      3000,
      '/',
      15,
      2,
      0,
      'asdp-dims-fe:staging-20261027-v1.0.3',
      'HEALTHY',
      now,
      now,
      now
    );
    insertCompatEnv.run('app-env-asdp-fe-staging', 'app-env-asdp-fe-staging', 'Staging / QA', 0, defaultHost, 'devel', 22, 'NONE', 'asdp-dims-fe:staging-20261027-v1.0.3', 'HEALTHY', now);

    // 3. ASDP DIMS Frontend - Production
    insertAppEnv.run(
      'app-env-asdp-fe-prod',
      'app-asdp-dims-fe',
      'production',
      'Production Cluster',
      1,
      defaultHost,
      22,
      'devel',
      'NONE',
      '/home/devel/asdp-dims-fe',
      '.env.production',
      4000,
      4001,
      3000,
      '/',
      15,
      2,
      0,
      'asdp-dims-fe:prod-20261026-v1.0.0',
      'HEALTHY',
      now,
      now,
      now
    );
    insertCompatEnv.run('app-env-asdp-fe-prod', 'app-env-asdp-fe-prod', 'Production Cluster', 1, defaultHost, 'devel', 22, 'NONE', 'asdp-dims-fe:prod-20261026-v1.0.0', 'HEALTHY', now);

    // 4. Secondary Project: ASYST Web Next.js
    const asystAppExists = db.prepare('SELECT id FROM applications WHERE id = ?').get('app-asyst-web-nextjs');
    if (!asystAppExists) {
      db.prepare(`
        INSERT INTO applications (
          id, name, display_name, repo_url, app_dir,
          default_branch, permitted_branches, dockerfile, image_name,
          env_file, host_port, staging_port, container_port,
          healthcheck_path, healthcheck_max_retries, healthcheck_interval_sec,
          enable_local_verification, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        'app-asyst-web-nextjs',
        'asyst-web-nextjs',
        'ASYST Web Next.js',
        'git@gitlab.asyst.co.id:asyst/asyst-web-nextjs.git',
        '/home/devel/asyst-web-nextjs',
        'production',
        JSON.stringify(['production', 'main', 'staging', 'release/*']),
        'Dockerfile',
        'asyst-web-nextjs',
        '.env.production',
        3000,
        3001,
        3000,
        '/',
        15,
        2,
        0,
        now,
        now
      );

      insertAppEnv.run(
        'app-env-asyst-web-prod',
        'app-asyst-web-nextjs',
        'production',
        'Production Web Host',
        1,
        defaultHost,
        22,
        'devel',
        'NONE',
        '/home/devel/asyst-web-nextjs',
        '.env.production',
        3000,
        3001,
        3000,
        '/',
        15,
        2,
        0,
        'asyst-web-nextjs:prod-v2.1.0',
        'HEALTHY',
        now,
        now,
        now
      );
    }
  }
}

function seedDatabase(db) {
  seedCoreSystem(db);
  seedDemoFixtures(db);
}

module.exports = {
  hashPassword,
  verifyPassword,
  seedCoreSystem,
  seedDemoFixtures,
  seedDatabase,
};
