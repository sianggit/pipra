/**
 * Pipra Deployment Lifecycle State Machine
 */

const DEPLOYMENT_STATES = {
  QUEUED: 'QUEUED',
  PREPARING: 'PREPARING',
  RUNNING: 'RUNNING',
  VERIFYING: 'VERIFYING',
  CUTTING_OVER: 'CUTTING_OVER',
  ROLLING_BACK: 'ROLLING_BACK',
  SUCCEEDED: 'SUCCEEDED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  INTERRUPTED: 'INTERRUPTED',
  ROLLBACK_FAILED: 'ROLLBACK_FAILED',
};

const TERMINAL_STATES = new Set([
  DEPLOYMENT_STATES.SUCCEEDED,
  DEPLOYMENT_STATES.FAILED,
  DEPLOYMENT_STATES.CANCELLED,
  DEPLOYMENT_STATES.INTERRUPTED,
  DEPLOYMENT_STATES.ROLLBACK_FAILED,
]);

const STAGES = [
  { number: 1, name: 'Preflight Validation', description: 'Validate authorization, host availability, port locks, and prerequisites' },
  { number: 2, name: 'Source Synchronization', description: 'Fetch, checkout, and capture Git commit provenance' },
  { number: 3, name: 'Local Verification', description: 'Optional local npm build validation prior to containerization' },
  { number: 4, name: 'Docker Image Build', description: 'Build and tag container image with BuildKit layer caching' },
  { number: 5, name: 'Staging Startup', description: 'Spin up candidate container on staging port without disrupting live traffic' },
  { number: 6, name: 'Staging Health Verification', description: 'Probe staging endpoint with 15 retries to ensure server readiness' },
  { number: 7, name: 'Production Cutover', description: 'Atomic container rename and sub-second production port binding' },
  { number: 8, name: 'Production Verification', description: 'Independent verification of the active production route' },
  { number: 9, name: 'Automatic Rollback', description: 'Restore previous known-good release if verification fails' },
  { number: 10, name: 'Final Report & Provenance', description: 'Compile execution summary, latencies, container IDs, and audit records' },
];

const VALID_TRANSITIONS = {
  [DEPLOYMENT_STATES.QUEUED]: [DEPLOYMENT_STATES.PREPARING, DEPLOYMENT_STATES.CANCELLED],
  [DEPLOYMENT_STATES.PREPARING]: [DEPLOYMENT_STATES.RUNNING, DEPLOYMENT_STATES.FAILED, DEPLOYMENT_STATES.CANCELLED, DEPLOYMENT_STATES.INTERRUPTED],
  [DEPLOYMENT_STATES.RUNNING]: [DEPLOYMENT_STATES.VERIFYING, DEPLOYMENT_STATES.FAILED, DEPLOYMENT_STATES.CANCELLED, DEPLOYMENT_STATES.INTERRUPTED],
  [DEPLOYMENT_STATES.VERIFYING]: [DEPLOYMENT_STATES.CUTTING_OVER, DEPLOYMENT_STATES.FAILED, DEPLOYMENT_STATES.CANCELLED, DEPLOYMENT_STATES.INTERRUPTED],
  [DEPLOYMENT_STATES.CUTTING_OVER]: [DEPLOYMENT_STATES.SUCCEEDED, DEPLOYMENT_STATES.ROLLING_BACK, DEPLOYMENT_STATES.FAILED, DEPLOYMENT_STATES.INTERRUPTED],
  [DEPLOYMENT_STATES.ROLLING_BACK]: [DEPLOYMENT_STATES.FAILED, DEPLOYMENT_STATES.ROLLBACK_FAILED, DEPLOYMENT_STATES.INTERRUPTED],
  [DEPLOYMENT_STATES.SUCCEEDED]: [],
  [DEPLOYMENT_STATES.FAILED]: [],
  [DEPLOYMENT_STATES.CANCELLED]: [],
  [DEPLOYMENT_STATES.INTERRUPTED]: [],
  [DEPLOYMENT_STATES.ROLLBACK_FAILED]: [],
};

function isValidTransition(currentState, nextState) {
  if (currentState === nextState) return true;
  const allowed = VALID_TRANSITIONS[currentState] || [];
  return allowed.includes(nextState);
}

function isTerminal(state) {
  return TERMINAL_STATES.has(state);
}

function getStageMeta(stageNumber) {
  return STAGES.find(s => s.number === stageNumber) || null;
}

module.exports = {
  DEPLOYMENT_STATES,
  TERMINAL_STATES,
  STAGES,
  isValidTransition,
  isTerminal,
  getStageMeta,
};
