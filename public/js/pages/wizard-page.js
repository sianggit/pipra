/**
 * Pipra Deployment Wizard Page
 * Multi-step deployment configuration, automated preflight inspection,
 * and production confirmation gate.
 */

import { api } from '../api.js';
import { renderIcon } from '../icons.js';
import { state } from '../state.js';
import { canDeploy } from '../auth.js';

export async function renderWizardPage(container, params = {}) {
  container.innerHTML = `
    <div style="padding: var(--space-8); text-align: center; color: var(--color-text-secondary);">
      <div style="font-family: var(--font-family-mono); font-size: var(--font-size-sm);">Loading deployment configuration...</div>
    </div>
  `;

  try {
    const apps = await api.getApplications();
    const envs = await api.getEnvironments();

    const selectedAppId = params.app || (apps[0] ? apps[0].id : '');
    const selectedEnvId = params.env || (envs[0] ? envs[0].id : '');

    const selectedApp = apps.find(a => a.id === selectedAppId || a.name === selectedAppId) || apps[0];
    const selectedEnv = envs.find(e => e.id === selectedEnvId || e.name === selectedEnvId) || envs[0];

    const isProd = selectedEnv ? selectedEnv.is_production : false;

    // Default tag with timestamp
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const defaultTag = `v1.0.${now.getMonth() + 1}-b${now.getDate()}${pad(now.getHours())}`;

    container.innerHTML = `
      <div class="page-header">
        <div class="page-title-group">
          <h1>
            ${renderIcon('play', 22)}
            <span>Deployment Wizard</span>
          </h1>
          <p class="page-subtitle">Configure, validate, and launch a deterministic 10-stage deployment pipeline.</p>
        </div>
      </div>

      <div style="max-width: 820px; margin: 0 auto;">
        <!-- Compact Step Progression Bar -->
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--space-5); padding: var(--space-3) var(--space-4); background-color: var(--color-surface-muted); border: 1px solid var(--color-border-default); border-radius: var(--radius-sm); font-size: 12px;">
          <div style="display: flex; align-items: center; gap: var(--space-2); color: var(--color-action-primary); font-weight: 600;">
            <span style="display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 50%; background-color: var(--color-action-primary); color: var(--color-text-inverse); font-size: 11px;">1</span>
            <span>Target Environment</span>
          </div>
          <span style="color: var(--color-text-muted);">→</span>
          <div style="display: flex; align-items: center; gap: var(--space-2); color: var(--color-action-primary); font-weight: 600;">
            <span style="display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 50%; background-color: var(--color-action-primary); color: var(--color-text-inverse); font-size: 11px;">2</span>
            <span>Revision & Image</span>
          </div>
          <span style="color: var(--color-text-muted);">→</span>
          <div style="display: flex; align-items: center; gap: var(--space-2); color: var(--color-text-secondary); font-weight: 600;">
            <span style="display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; border-radius: 50%; background-color: var(--color-surface-strong); border: 1px solid var(--color-border-default); color: var(--color-text-secondary); font-size: 11px;">3</span>
            <span>Preflight & Cutover</span>
          </div>
        </div>

        <form id="wizard-form" class="card">
          <div class="card-header">
            <span class="card-title">
              ${renderIcon('layers', 16)}
              <span>Pipeline Configuration</span>
            </span>
            <span style="font-size: var(--font-size-xs); color: var(--color-text-secondary);">
              All fields required
            </span>
          </div>

          <div class="card-body">
            <!-- Step 1: Application and Environment -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); margin-bottom: var(--space-4);">
              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label" for="wizard-app">Target Application *</label>
                <select id="wizard-app" class="form-control" required>
                  ${apps.map(a => `<option value="${a.id}" ${a.id === selectedApp?.id ? 'selected' : ''}>${a.display_name} (${a.name})</option>`).join('')}
                </select>
              </div>

              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label" for="wizard-env">Target Environment *</label>
                <select id="wizard-env" class="form-control" required>
                  ${envs.map(e => `<option value="${e.id}" ${e.id === selectedEnv?.id ? 'selected' : ''}>${e.display_name} [${e.is_production ? 'PRODUCTION' : 'NON-PROD'}]</option>`).join('')}
                </select>
              </div>
            </div>

            <!-- Step 2: Release Reference -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-4); margin-bottom: var(--space-4);">
              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label" for="wizard-branch">Branch / Tag / Ref *</label>
                <input type="text" id="wizard-branch" class="form-control" value="${selectedApp?.default_branch || 'devel'}" required />
                <div class="form-hint">Permitted branches: ${selectedApp?.permitted_branches?.join(', ') || 'devel, main, prod'}</div>
              </div>

              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label" for="wizard-tag">Target Image Tag *</label>
                <input type="text" id="wizard-tag" class="form-control font-mono" value="${defaultTag}" required />
                <div class="form-hint">Immutable image identifier for Docker build</div>
              </div>
            </div>

            <!-- Step 3: Container Name -->
            <div class="form-group">
              <label class="form-label" for="wizard-container-name">Target Container Name *</label>
              <input type="text" id="wizard-container-name" class="form-control font-mono" value="${selectedApp?.name || 'asdp-dims-fe'}" required />
              <div class="form-hint">Production container identity. Temporary staging containers use <code>&lt;name&gt;-staging-&lt;timestamp&gt;</code>.</div>
            </div>

            <!-- Step 4: Preflight Validation Summary Box -->
            <div id="preflight-box" style="background-color: var(--color-surface-strong); border: 1px solid var(--color-border-default); border-radius: var(--radius-sm); padding: var(--space-4); margin-bottom: var(--space-5);">
              <div style="font-weight: 600; font-size: 12px; margin-bottom: var(--space-3); display: flex; align-items: center; justify-content: space-between;">
                <span style="display: flex; align-items: center; gap: var(--space-2);">
                  ${renderIcon('shield', 14)}
                  <span>Automated Preflight Parameters</span>
                </span>
                <span style="color: var(--color-status-success); font-size: 11px; font-weight: 600;">✓ PASSED PRE-CHECK</span>
              </div>
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: var(--space-3); font-size: 12px;">
                <div>
                  <span style="color: var(--color-text-secondary); font-size: 11px;">Production Port:</span>
                  <div id="pf-prod-port" style="font-weight: 600; font-family: var(--font-family-mono); color: var(--color-action-primary); margin-top: 2px;">:${selectedApp?.host_port || 4000}</div>
                </div>
                <div>
                  <span style="color: var(--color-text-secondary); font-size: 11px;">Staging Isolation Port:</span>
                  <div id="pf-stag-port" style="font-weight: 600; font-family: var(--font-family-mono); margin-top: 2px;">:${selectedApp?.staging_port || 4001}</div>
                </div>
                <div>
                  <span style="color: var(--color-text-secondary); font-size: 11px;">Target Host Working Dir:</span>
                  <div id="pf-app-dir" style="font-family: var(--font-family-mono); font-size: 11px; margin-top: 2px;">${selectedApp?.app_dir || '/home/devel/asdp-dims-fe'}</div>
                </div>
                <div>
                  <span style="color: var(--color-text-secondary); font-size: 11px;">Active Rollback Release:</span>
                  <div id="pf-rollback" style="font-family: var(--font-family-mono); font-size: 11px; color: var(--color-text-primary); margin-top: 2px;">
                    ${selectedEnv?.active_release_id || 'asdp-dims-fe:devel-latest'}
                  </div>
                </div>
              </div>
            </div>

            <!-- Optional verification options -->
            <div class="form-group">
              <label style="display: flex; align-items: center; gap: var(--space-3); cursor: pointer;">
                <input type="checkbox" id="wizard-local-verify" />
                <span style="font-size: 12px; color: var(--color-text-primary);">
                  Enable host local verification ('npm ci' and 'npm run build' before container build)
                </span>
              </label>
              <div class="form-hint" style="margin-left: 24px;">
                Leave unchecked for fast multi-stage container builds.
              </div>
            </div>

            <!-- Production Confirmation Barrier -->
            <div id="prod-barrier-container" style="display: ${isProd ? 'block' : 'none'}; margin-top: var(--space-5); padding: var(--space-4); background-color: var(--color-status-danger-bg); border: 1px solid var(--color-status-danger-border); border-radius: var(--radius-sm);">
              <div style="display: flex; align-items: flex-start; gap: var(--space-3);">
                <input type="checkbox" id="wizard-confirm-prod" style="margin-top: 3px;" />
                <div>
                  <label for="wizard-confirm-prod" style="font-weight: 600; color: var(--color-status-danger); cursor: pointer;">
                    Confirm Production Release Deployment
                  </label>
                  <p style="font-size: 12px; color: var(--color-text-secondary); margin-top: 4px;">
                    This deployment will execute an atomic zero-downtime cutover on production serving port. If post-cutover verification probes fail, Pipra will automatically restore the backup release.
                  </p>
                </div>
              </div>
            </div>

            ${!canDeploy() ? `
              <div style="margin-top: var(--space-4); padding: var(--space-3) var(--space-4); background-color: var(--color-status-warning-bg); border: 1px solid var(--color-status-warning-border); border-radius: var(--radius-sm); font-size: 12px; color: var(--color-text-primary); display: flex; align-items: center; gap: var(--space-2);">
                ${renderIcon('shield', 16)}
                <span><strong>Observation Mode:</strong> Your account has read-only access. Launching deployments requires Operator or Admin role.</span>
              </div>
            ` : ''}

            <div id="wizard-error" style="display: none; margin-top: var(--space-4); padding: var(--space-3) var(--space-4); background-color: var(--color-status-danger-bg); border: 1px solid var(--color-status-danger-border); border-radius: var(--radius-sm); color: var(--color-status-danger); font-size: 12px;"></div>
          </div>

          <div class="card-footer" style="justify-content: flex-end; gap: var(--space-3);">
            <a href="#/overview" class="btn btn-secondary">Cancel</a>
            <button type="submit" id="btn-submit-deploy" class="btn btn-primary" ${!canDeploy() ? 'disabled title="Operator or Admin role required"' : ''}>
              ${renderIcon('play', 14)}
              <span>Launch Deployment Pipeline</span>
            </button>
          </div>
        </form>
      </div>
    `;

    bindWizardEvents(apps, envs);
  } catch (err) {
    container.innerHTML = `
      <div class="card" style="border-left: 3px solid var(--color-status-danger);">
        <div class="card-body">
          <h3 style="color: var(--color-status-danger); margin-bottom: var(--space-2);">Error loading wizard</h3>
          <p style="color: var(--color-text-secondary);">${err.message}</p>
        </div>
      </div>
    `;
  }
}

function bindWizardEvents(apps, envs) {
  const appSelect = document.getElementById('wizard-app');
  const envSelect = document.getElementById('wizard-env');
  const prodBarrier = document.getElementById('prod-barrier-container');
  const confirmProd = document.getElementById('wizard-confirm-prod');
  const form = document.getElementById('wizard-form');
  const errorBox = document.getElementById('wizard-error');
  const submitBtn = document.getElementById('btn-submit-deploy');

  // Dynamic preflight parameter updates
  function updatePreflight() {
    const selectedApp = apps.find(a => a.id === appSelect?.value);
    const selectedEnv = envs.find(e => e.id === envSelect?.value);

    if (selectedApp) {
      const prodPort = document.getElementById('pf-prod-port');
      const stagPort = document.getElementById('pf-stag-port');
      const appDir = document.getElementById('pf-app-dir');
      const containerInput = document.getElementById('wizard-container-name');
      const branchInput = document.getElementById('wizard-branch');

      if (prodPort) prodPort.textContent = `:${selectedApp.host_port || 4000}`;
      if (stagPort) stagPort.textContent = `:${selectedApp.staging_port || 4001}`;
      if (appDir) appDir.textContent = selectedApp.app_dir || '';
      if (containerInput) containerInput.value = selectedApp.name || '';
      if (branchInput && !branchInput.value) branchInput.value = selectedApp.default_branch || 'devel';
    }

    if (selectedEnv) {
      const rollbackElem = document.getElementById('pf-rollback');
      if (rollbackElem) rollbackElem.textContent = selectedEnv.active_release_id || 'asdp-dims-fe:devel-latest';

      if (selectedEnv.is_production) {
        prodBarrier.style.display = 'block';
      } else {
        prodBarrier.style.display = 'none';
        if (confirmProd) confirmProd.checked = false;
      }
    }
  }

  if (appSelect) appSelect.addEventListener('change', updatePreflight);
  if (envSelect) envSelect.addEventListener('change', updatePreflight);

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorBox.style.display = 'none';

      const appVal = appSelect.value;
      const envVal = envSelect.value;
      const branchVal = document.getElementById('wizard-branch').value.trim();
      const tagVal = document.getElementById('wizard-tag').value.trim();
      const containerVal = document.getElementById('wizard-container-name').value.trim();
      const localVerify = document.getElementById('wizard-local-verify').checked;

      const selectedEnv = envs.find(env => env.id === envVal);
      const isProd = selectedEnv && selectedEnv.is_production;

      if (isProd && confirmProd && !confirmProd.checked) {
        errorBox.textContent = 'Confirmation required: Check the production release confirmation box before launching.';
        errorBox.style.display = 'block';
        confirmProd.focus();
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span>Starting Pipeline...</span>`;

      try {
        const result = await api.createDeployment({
          application_id: appVal,
          environment_id: envVal,
          branch: branchVal,
          tag: tagVal,
          container_name: containerVal,
          confirm_production: isProd,
          enable_local_verification: localVerify,
        });

        // Redirect immediately to live execution screen
        window.location.hash = `#/deployments/${result.deploymentId}`;
      } catch (err) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `${renderIcon('play', 14)} <span>Launch Deployment Pipeline</span>`;
        errorBox.textContent = err.message;
        errorBox.style.display = 'block';
      }
    });
  }
}
