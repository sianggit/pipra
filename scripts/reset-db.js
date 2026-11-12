/**
 * Pipra Database Reset & Clean-Slate Utility
 * PIPRA-501 & PIPRA-502: Safe table truncation preserving core security baseline
 * (Users, Roles, Execution Agents, Sessions) while flushing all applications,
 * environments, deployments, and logs for clean production-ready initialization.
 */

const config = require('../src/config');
const { getDatabase } = require('../src/db/database');
const { seedCoreSystem, seedDemoFixtures } = require('../src/db/seed');
const logger = require('../src/utils/logger');

function resetDatabase({ demo = false } = {}) {
  const db = getDatabase();
  const now = new Date().toISOString();

  logger.info(`Starting Pipra database ${demo ? 'demo fixture reset' : 'clean-slate flush'}...`);

  db.exec('PRAGMA foreign_keys = OFF;');
  db.exec(`
    DELETE FROM deployment_logs;
    DELETE FROM health_probes;
    DELETE FROM deployment_stages;
    DELETE FROM deployments;
    DELETE FROM application_environments;
    DELETE FROM applications;
    DELETE FROM environments;
    DELETE FROM audit_logs;
    VACUUM;
  `);
  db.exec('PRAGMA foreign_keys = ON;');

  // Ensure core security baseline (users and agents) is seeded
  seedCoreSystem(db);

  // Record baseline clean slate audit event
  const insertAudit = db.prepare(`
    INSERT INTO audit_logs (user_id, username, action, resource_type, resource_id, details, ip_address, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertAudit.run(
    'user-admin-1',
    'admin',
    'CLEAN_SLATE_INITIALIZED',
    'SYSTEM',
    'pipra-db',
    demo ? 'Database reset with demo fixtures' : 'Clean-slate initialized: applications, environments, and deployments flushed.',
    '127.0.0.1',
    now
  );

  // If explicitly requested, seed demo fixtures
  if (demo) {
    logger.info('Injecting demo applications and environments (--demo flag active)...');
    seedDemoFixtures(db);
  }

  const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  const agentCount = db.prepare('SELECT COUNT(*) as c FROM agents').get().c;
  const appCount = db.prepare('SELECT COUNT(*) as c FROM applications').get().c;
  const envCount = db.prepare('SELECT COUNT(*) as c FROM application_environments').get().c;
  const legacyEnvCount = db.prepare('SELECT COUNT(*) as c FROM environments').get().c;
  const deployCount = db.prepare('SELECT COUNT(*) as c FROM deployments').get().c;
  const auditCount = db.prepare('SELECT COUNT(*) as c FROM audit_logs').get().c;

  logger.info('==========================================================');
  logger.info(`Pipra Database ${demo ? 'Demo Reset' : 'Clean Slate'} Completed Successfully!`);
  logger.info(`- Users (Preserved): ${userCount} (admin, operator, viewer)`);
  logger.info(`- Agents (Preserved): ${agentCount} (agent-local, agent-devel-prod)`);
  logger.info(`- Applications: ${appCount}`);
  logger.info(`- Attached Environments: ${envCount}`);
  logger.info(`- Legacy Environments: ${legacyEnvCount}`);
  logger.info(`- Deployments: ${deployCount}`);
  logger.info(`- Audit Logs: ${auditCount}`);
  logger.info('==========================================================');

  return {
    users: userCount,
    agents: agentCount,
    applications: appCount,
    environments: envCount,
    deployments: deployCount,
    auditLogs: auditCount,
  };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const isDemo = args.includes('--demo');
  resetDatabase({ demo: isDemo });
}

module.exports = { resetDatabase };
