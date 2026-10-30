/**
 * Pipra Database Reset & Fresh Seed Utility
 * Flushes all runtime data and restores fresh schema and default seed accounts.
 * Safely executes in-place table truncation with zero file locking conflicts.
 */

const config = require('../src/config');
const { getDatabase } = require('../src/db/database');
const { seedDatabase } = require('../src/db/seed');
const logger = require('../src/utils/logger');

function resetDatabase() {
  const db = getDatabase();

  logger.info('Flushing all Pipra database tables...');

  db.exec('PRAGMA foreign_keys = OFF;');
  db.exec(`
    DELETE FROM deployment_logs;
    DELETE FROM health_probes;
    DELETE FROM deployment_stages;
    DELETE FROM deployments;
    DELETE FROM audit_logs;
    DELETE FROM sessions;
    DELETE FROM applications;
    DELETE FROM environments;
    DELETE FROM agents;
    DELETE FROM users;
    VACUUM;
  `);
  db.exec('PRAGMA foreign_keys = ON;');

  logger.info('Re-seeding clean default baseline...');
  seedDatabase(db);

  const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  const appCount = db.prepare('SELECT COUNT(*) as c FROM applications').get().c;
  const envCount = db.prepare('SELECT COUNT(*) as c FROM environments').get().c;
  const deployCount = db.prepare('SELECT COUNT(*) as c FROM deployments').get().c;
  const auditCount = db.prepare('SELECT COUNT(*) as c FROM audit_logs').get().c;

  logger.info('==========================================================');
  logger.info('Pipra Database Reset Completed Successfully!');
  logger.info(`- Users: ${userCount} (admin, operator, viewer)`);
  logger.info(`- Applications: ${appCount} (asdp-dims-fe)`);
  logger.info(`- Environments: ${envCount} (devel, staging, production)`);
  logger.info(`- Deployments: ${deployCount} (clean state)`);
  logger.info(`- Audit Logs: ${auditCount} (clean state)`);
  logger.info(`- Default Target Host: ${config.DEFAULT_TARGET_HOST}`);
  logger.info('==========================================================');
}

if (require.main === module) {
  resetDatabase();
}

module.exports = { resetDatabase };
