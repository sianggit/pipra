/**
 * Pipra Client-Side Role-Based Access Control (RBAC) Helper
 * Evaluates operational authority based on active authenticated user session.
 */

import { state } from './state.js';

export function getUser() {
  const s = state.get();
  return s ? s.user : null;
}

export function hasRole(allowedRoles = []) {
  const user = getUser();
  if (!user || !user.role) return false;
  if (user.role === 'admin') return true; // Administrator has full privileges
  return allowedRoles.includes(user.role);
}

export function canDeploy() {
  return hasRole(['admin', 'operator']);
}

export function canRegisterApp() {
  return hasRole(['admin']);
}

export function canManageEnvironment() {
  return hasRole(['admin']);
}

export function canCancelDeployment() {
  return hasRole(['admin', 'operator']);
}

export function canApproveDeployment() {
  return hasRole(['admin', 'operator']);
}

export function isViewerOnly() {
  const user = getUser();
  return !!user && user.role === 'viewer';
}

export function isAdmin() {
  return hasRole(['admin']);
}

export function canManageUsers() {
  return hasRole(['admin']);
}

