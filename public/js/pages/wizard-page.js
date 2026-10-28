/**
 * Pipra Deployment Wizard Page
 * Multi-step safe deployment configuration and preflight validation.
 */

import { api } from '../api.js';
import { renderIcon } from '../icons.js';
import { state } from '../state.js';

export async function renderWizardPage(container, params = {}) {
  container.innerHTML = `<div style="padding: 24px; color: var(--color-text-secondary);">Loading deployment configuration...</div>`;

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
            ${renderIcon('play', 24)}
            <span>Deployment Wizard</span>
          </h1>
          <p class="page-subtitle">Configure, validate, and launch a verifiable release pipeline.</p>
        </div>
      </div>

      <div style="max-width: 840px; margin: 0 auto;">
        <form id="wizard-form" class="card">
          <div class="card-header">
            <span class="card-title">
              ${renderIcon('layers', 16)}
              <span>Pipeline Configuration & Preflight Review</span>
            </span>
          </div>

          <div class="card-body">
            <!-- Step 1: Application and Environment -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-6); margin-bottom: var(--space-6);">
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
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-6); margin-bottom: var(--space-6);">
              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label" for="wizard-branch">Branch / Tag / Ref *</label>
                <input type="text" id="wizard-branch" class="form-control" value="${selectedApp?.default_branch || 'devel'}" required />
                <div class="form-hint">Permitted: ${selectedApp?.permitted_branches?.join(', ') || 'devel, main, prod'}</div>
              </div>

              <div class="form-group" style="margin-bottom: 0;">
                <label class="form-label" for="wizard-tag">Image Tag *</label>
                <input type="text" id="wizard-tag" class="form-control" value="${defaultTag}" required />
                <div class="form-hint">Immutable image identifier for Docker build</div>
              </div>
            </div>

            <!-- Step 3: Container Name -->
            <div class="form-group">
              <label class="form-label" for="wizard-container-name">Container Name</label>
              <input type="text" id="wizard-container-name" class="form-control" value="${selectedApp?.name || 'asdp-dims-fe'}" required />
              <div class="form-hint">Production container name. Staging containers use &lt;name&gt;-staging-&lt;timestamp&gt;.</div>
            </div>

            <!-- Step 4: Preflight Validation Summary Box -->
            <div style="background-color: var(--color-surface-strong); border: 1px solid var(--color-border-default); border-radius: var(--radius-sm); padding: var(--space-6); margin-bottom: var(--space-6);">
              <div style="font-weight: 600; font-size: 13px; margin-bottom: var(--space-4); display: flex; align-items: center; gap: 8px;">
                ${renderIcon('shield', 14)}
                <span>Automated Preflight Validation Summary</span>
              </div>
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: var(--space-4); font-size: 12px;">
                <div>
                  <span style="color: var(--color-text-secondary);">Production Port:</span>
                  <div style="font-weight: 600; font-family: var(--font-family-mono); color: var(--color-surface-raised);">:${selectedApp?.host_port || 4000}</div>
                </div>
                <div>
                  <span style="color: var(--color-text-secondary);">Staging Port:</span>
                  <div style="font-weight: 600; font-family: var(--font-family-mono);">:${selectedApp?.staging_port || 4001}</div>
                </div>
                <div>
                  <span style="color: var(--color-text-secondary);">Target Host Directory:</span>
                  <div style="font-family: var(--font-family-mono); font-size: 11px;">${selectedApp?.app_dir || '/home/devel/asdp-dims-fe'}</div>
                </div>
                <div>
                  <span style="color: var(--color-text-secondary);">Active Rollback Candidate:</span>
                  <div style="font-family: var(--font-family-mono); font-size: 11px; color: var(--color-surface-raised);">
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
                  Enable host local verification ('npm ci' and 'npm run build' before Docker image creation)
                </span>
              </label>
              <div class="form-hint" style="margin-left: 20px;">
                Leave unchecked to accelerate release velocity. Multi-stage Dockerfile handles compilation.
              </div>
            </div>

            <!-- Production Barrier Checkbox -->
            <div id="prod-barrier-container" style="display: ${isProd ? 'block' : 'none'}; margin-top: var(--space-6); padding: var(--space-5); background-color: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.35); border-radius: var(--radius-sm);">
              <div style="display: flex; align-items: flex-start; gap: var(--space-4);">
                <input type="checkbox" id="wizard-confirm-prod" style="margin-top: 3px;" />
                <div>
                  <label for="wizard-confirm-prod" style="font-weight: 600; color: #f87171; cursor: pointer;">
                    Confirm Production Release Deployment
                  </label>
                  <p style="font-size: 12px; color: #fca5a5; margin-top: 2px;">
                    This deployment will execute an atomic zero-downtime cutover on production port :${selectedApp?.host_port || 4000}.
                    If post-cutover verification fails, Pipra will automatically restore the backup release.
                  </p>
                </div>
              </div>
            </div>

            <div id="wizard-error" style="display: none; margin-top: var(--space-6); padding: var(--space-4); background-color: var(--color-status-error-bg); border: 1px solid var(--color-status-error); border-radius: var(--radius-sm); color: #fca5a5; font-size: 12px;"></div>
          </div>

          <div class="card-header" style="justify-content: flex-end; gap: var(--space-4);">
            <a href="#/overview" class="btn btn-secondary">Cancel</a>
            <button type="submit" id="btn-submit-deploy" class="btn btn-primary">
              ${renderIcon('play', 14)}
              <span>Launch Deployment Pipeline</span>
            </button>
          </div>
        </form>
      </div>
    `;

    bindWizardEvents(apps, envs);
  } catch (err) {
    container.innerHTML = `<div style="color: var(--color-status-error);">Error: ${err.message}</div>`;
  }
}

function bindWizardEvents(apps, envs) {
  const envSelect = document.getElementById('wizard-env');
  const prodBarrier = document.getElementById('prod-barrier-container');
  const confirmProd = document.getElementById('wizard-confirm-prod');
  const form = document.getElementById('wizard-form');
  const errorBox = document.getElementById('wizard-error');
  const submitBtn = document.getElementById('btn-submit-deploy');

  if (envSelect) {
    envSelect.addEventListener('change', () => {
      const selected = envs.find(e => e.id === envSelect.value);
      if (selected && selected.is_production) {
        prodBarrier.style.display = 'block';
      } else {
        prodBarrier.style.display = 'none';
        if (confirmProd) confirmProd.checked = false;
      }
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorBox.style.display = 'none';

      const appVal = document.getElementById('wizard-app').value;
      const envVal = document.getElementById('wizard-env').value;
      const branchVal = document.getElementById('wizard-branch').value.trim();
      const tagVal = document.getElementById('wizard-tag').value.trim();
      const containerVal = document.getElementById('wizard-container-name').value.trim();
      const localVerify = document.getElementById('wizard-local-verify').checked;

      const selectedEnv = envs.find(env => env.id === envVal);
      const isProd = selectedEnv && selectedEnv.is_production;

      if (isProd && confirmProd && !confirmProd.checked) {
        errorBox.textContent = 'You must check the production confirmation box before launching to production.';
        errorBox.style.display = 'block';
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

        // Redirect to live deployment detail!
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
