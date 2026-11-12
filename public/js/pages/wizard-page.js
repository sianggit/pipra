/**
 * Pipra Deployment Wizard Page
 * 3-Step Wizard with Dynamic Application-Scoped Environment Resolution
 * and production cutover safeguards.
 */

import { api } from '../api.js';
import { renderIcon } from '../icons.js';
import { state } from '../state.js';
import { canDeploy } from '../auth.js';
import { showAlert, showToast } from '../components/toast.js';

function checkBranchPermitted(branch, permittedList) {
  if (!branch || typeof branch !== 'string') return false;
  const b = branch.trim();
  if (!b) return false;
  if (!/^[a-zA-Z0-9_\-\./]+$/.test(b)) return false;

  let list = permittedList;
  if (typeof list === 'string') {
    try {
      list = JSON.parse(list);
    } catch {
      list = list.split(',').map(s => s.trim()).filter(Boolean);
    }
  }

  if (!Array.isArray(list) || list.length === 0) return true;

  return list.some(pattern => {
    if (!pattern || typeof pattern !== 'string') return false;
    const p = pattern.trim();
    if (p === '*' || p === b) return true;
    if (p.endsWith('/*')) {
      const prefix = p.slice(0, -1);
      return b.startsWith(prefix) && b.length > prefix.length;
    }
    if (p.includes('*')) {
      const regex = new RegExp('^' + p.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$');
      return regex.test(b);
    }
    return p === b;
  });
}

export async function renderWizardPage(container, params = {}) {
  container.innerHTML = `
    <div style="padding: 48px; text-align: center; color: var(--t2);">
      <div class="mono">Loading deployment configuration...</div>
    </div>
  `;

  try {
    const [apps, allEnvs] = await Promise.all([
      api.getApplications(),
      api.getEnvironments().catch(() => []),
    ]);

    if (apps.length === 0) {
      container.innerHTML = `
        <div class="pg">
          <div>
            <h1>Deploy Application</h1>
            <p class="sub">3-step zero-downtime deployment pipeline with automated blue-green cutover.</p>
          </div>
        </div>
        <div class="pn" style="text-align: center; padding: 48px 24px; border-style: dashed;">
          <div style="max-width: 440px; margin: 0 auto;">
            <div style="color: var(--pr); margin-bottom: 12px;">
              ${renderIcon('cube', 36)}
            </div>
            <h2 style="font-size: 16px; margin-bottom: 6px;">No Applications Registered Yet</h2>
            <p class="t2" style="font-size: 13px; line-height: 1.5; margin-bottom: 20px;">
              The deployment wizard requires at least one registered project with target environments. Register your first project in the applications catalog to begin.
            </p>
            <a class="btn btn-primary" href="#/apps">
              ${renderIcon('plus', 14)}
              <span>Register First Project</span>
            </a>
          </div>
        </div>
      `;
      return;
    }

    const initialApp = apps.find(a => a.id === params.app || a.name === params.app) || apps[0];
    const initialAppEnvs = (initialApp && initialApp.environments && initialApp.environments.length > 0)
      ? initialApp.environments
      : allEnvs.filter(e => !initialApp || e.application_id === initialApp.id || !e.application_id);

    const initialEnv = initialAppEnvs.find(e => e.id === params.env || e.name === params.env) || initialAppEnvs[0];

    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const defaultTag = `v1.0.${now.getMonth() + 1}-b${now.getDate()}${pad(now.getHours())}`;

    // Wizard reactive state
    const wz = {
      step: 1,
      appId: initialApp ? initialApp.id : '',
      envId: initialEnv ? initialEnv.id : '',
      branch: initialApp ? (initialApp.default_branch || 'devel') : 'devel',
      tag: defaultTag,
      containerName: initialApp ? (initialApp.name || 'asdp-dims-fe') : 'asdp-dims-fe',
      verifyOnHost: false,
      confirmed: false,
    };

    const steps = ['Target', 'Revision & image', 'Preflight & cutover'];

    function renderView() {
      const currentApp = apps.find(a => a.id === wz.appId) || apps[0] || {};
      const permittedBranches = Array.isArray(currentApp.permitted_branches)
        ? currentApp.permitted_branches
        : (typeof currentApp.permitted_branches === 'string'
          ? (JSON.parse(currentApp.permitted_branches || '[]'))
          : ['develop', 'main', 'prod']);

      const appEnvs = (currentApp.environments && currentApp.environments.length > 0)
        ? currentApp.environments
        : allEnvs.filter(e => e.application_id === currentApp.id || !e.application_id);

      // Auto-reconcile selected envId if switching applications
      if (!appEnvs.some(e => e.id === wz.envId)) {
        wz.envId = appEnvs[0] ? appEnvs[0].id : '';
      }

      const currentEnv = appEnvs.find(e => e.id === wz.envId) || appEnvs[0] || {};
      const isProd = currentEnv.is_production || currentEnv.name === 'production';
      const isRefValid = checkBranchPermitted(wz.branch, permittedBranches);

      // Step 1: Target Application & Application-Scoped Environment
      const step1Html = `
        <div class="fl" style="gap: 16px;">
          <div>
            <label for="wz-app-select" style="display: block; font-weight: 500; margin-bottom: 5px;">Project / Application</label>
            <select id="wz-app-select" aria-label="Application" style="width: 100%; height: 38px; padding: 0 10px; background: var(--in); border: 1px solid var(--bd); border-radius: 6px;">
              ${apps.map(a => `<option value="${a.id}" ${a.id === wz.appId ? 'selected' : ''}>${a.display_name} (${a.name})</option>`).join('')}
            </select>
          </div>

          <div>
            <label id="wz-env-label" style="display: block; font-weight: 500; margin-bottom: 5px;">
              Target environment for <b>${currentApp.display_name || currentApp.name}</b>
            </label>
            ${appEnvs.length === 0 ? `
              <div class="t3" style="padding: 12px; background: var(--in); border: 1px dashed var(--bd); border-radius: 6px;">
                No environments configured for this application yet. Go to <a href="#/apps" style="color: var(--pr);">Applications</a> to add one.
              </div>
            ` : `
              <div class="seg" role="group" aria-labelledby="wz-env-label" style="display: flex; flex-wrap: wrap; gap: 8px;">
                ${appEnvs.map(e => {
        const ep = e.is_production || e.name === 'production';
        const isSelected = e.id === wz.envId;
        return `
                    <button type="button" class="${ep ? 'prod' : ''}" aria-pressed="${isSelected}" data-env-id="${e.id}" style="flex: 1 1 200px;">
                      <b>${e.display_name || e.name}</b>
                      <span class="dim">${ep ? 'Production critical' : 'Non-production'} · ${e.host || '127.0.0.1'}</span>
                    </button>
                  `;
      }).join('')}
              </div>
            `}
          </div>
        </div>
      `;

      // Step 2: Revision & Docker Image
      const step2Html = `
        <div class="fl" style="gap: 16px;">
          <div class="row2">
            <div>
              <label for="wz-branch" style="display: block; font-weight: 500; margin-bottom: 5px;">Branch / tag / ref</label>
              <input id="wz-branch" type="text" value="${wz.branch}" aria-invalid="${!isRefValid}" style="width: 100%; height: 36px; padding: 0 10px; background: var(--in); border: 1px solid var(--bd); border-radius: 6px;" />
              <div id="wz-branch-hint" class="${isRefValid ? 'hint' : 'err'}" style="font-size: 12px; margin-top: 5px; color: ${isRefValid ? 'var(--t3)' : 'var(--bad)'};">
                ${isRefValid
                  ? `Permitted for ${currentApp.display_name || currentApp.name}: ${permittedBranches.join(', ')}`
                  : `Not a permitted ref for ${currentApp.display_name || currentApp.name}. Allowed: ${permittedBranches.join(', ')}`}
              </div>
            </div>
            <div>
              <label for="wz-tag" style="display: block; font-weight: 500; margin-bottom: 5px;">Image tag</label>
              <input id="wz-tag" type="text" class="mono" value="${wz.tag}" style="width: 100%; height: 36px; padding: 0 10px; background: var(--in); border: 1px solid var(--bd); border-radius: 6px;" />
              <div class="hint" style="color: var(--t3); font-size: 12px; margin-top: 5px;">Immutable identifier for the Docker build</div>
            </div>
          </div>

          <div>
            <label for="wz-container" style="display: block; font-weight: 500; margin-bottom: 5px;">Container name</label>
            <input id="wz-container" type="text" class="mono" value="${wz.containerName}" style="width: 100%; height: 36px; padding: 0 10px; background: var(--in); border: 1px solid var(--bd); border-radius: 6px;" />
            <div class="hint" style="color: var(--t3); font-size: 12px; margin-top: 5px;">Target container identity on remote Docker host.</div>
          </div>

          <label class="ck">
            <input type="checkbox" id="wz-verify-host" ${wz.verifyOnHost ? 'checked' : ''} />
            <span>
              Verify on host before building (npm ci & npm run build)
              <div class="hint" style="color: var(--t3); font-size: 12px;">Leave off to let multi-stage Docker build handle compilation natively.</div>
            </span>
          </label>
        </div>
      `;

      // Step 3: Preflight & Cutover
      const step3Html = `
        <div class="fl" style="gap: 16px;">
          <div>
            <h2 style="font-size: 14px; font-weight: 600; margin-bottom: 8px;">Target Preflight Parameters</h2>
            <dl style="grid-template-columns: 180px 1fr; border: 1px solid var(--bs); border-radius: 8px;">
              <dt>Target host & SSH</dt>
              <dd class="mono">${currentEnv.ssh_user || 'devel'}@${currentEnv.host || '127.0.0.1'}:${currentEnv.ssh_port || 22}</dd>
              <dt>Production port</dt>
              <dd class="mono">:${currentEnv.host_port || currentApp.host_port || 4000}</dd>
              <dt>Staging isolation port</dt>
              <dd class="mono">:${currentEnv.staging_port || currentApp.staging_port || 4001}</dd>
              <dt>Remote directory</dt>
              <dd class="mono">${currentEnv.app_dir || currentApp.app_dir || '/home/devel/' + currentApp.name}</dd>
              <dt>Environment file</dt>
              <dd class="mono">${currentEnv.env_file || currentApp.env_file || '.env.production'}</dd>
              <dt>Rollback target release</dt>
              <dd class="mono">${currentEnv.active_release_id || 'none'}</dd>
              <dt>Preflight result</dt>
              <dd><span class="b ok">${renderIcon('check', 12)}Passed</span></dd>
            </dl>
          </div>

          ${isProd ? `
            <div class="grd" style="margin: 0;">
              ${renderIcon('shield', 18)}
              <div>
                <b>Production cutover safeguard.</b><br>
                Target <code>${currentEnv.host || '127.0.0.1'}</code> · release <code>${wz.branch}@${wz.tag}</code>.<br>
                Strategy: staging health verification, atomic container cutover, and production verification. If verification fails, Pipra automatically restores <span class="mono">${currentEnv.active_release_id || 'previous release'}</span>.
              </div>
            </div>

            <label class="ck" style="margin-top: 4px;">
              <input type="checkbox" id="wz-confirm-prod" ${wz.confirmed ? 'checked' : ''} />
              <span>I confirm deploying <b>${wz.tag}</b> to <b>Production (${currentEnv.display_name})</b>.</span>
            </label>
          ` : ''}
        </div>
      `;

      container.innerHTML = `
        <div class="pg">
          <div>
            <h1>Deploy</h1>
            <p class="sub">Configure, validate, and launch the 10-stage deployment pipeline.</p>
          </div>
        </div>

        <!-- 3-Step Stepper Progress Bar -->
        <div class="stp">
          ${steps.map((s, idx) => {
        const stepNum = idx + 1;
        const isCurrent = wz.step === stepNum;
        const isCompleted = wz.step > stepNum;
        return `
              <div class="${isCurrent ? 'on' : (isCompleted ? 'dn' : '')}">
                <b>${isCompleted ? renderIcon('check', 12) : stepNum}</b>
                <span>${s}</span>
              </div>
            `;
      }).join('')}
        </div>

        <!-- 2-Column Split: Wizard Step Form & Persistent Summary Aside -->
        <div class="wz">
          <div class="pn">
            <div class="ph">
              <h2>${steps[wz.step - 1]}</h2>
              <small>All fields required</small>
            </div>

            ${[step1Html, step2Html, step3Html][wz.step - 1]}

            <div class="ph" style="border-top: 1px solid var(--bs); border-bottom: 0;">
              <button type="button" class="btn" id="btn-wizard-back" ${wz.step === 1 ? 'disabled' : ''}>
                Back
              </button>

              ${wz.step < 3 ? `
                <button type="button" class="btn p" id="btn-wizard-next" ${wz.step === 2 && (!isRefValid || !wz.tag) ? 'disabled' : ''}>
                  Continue
                </button>
              ` : `
                <button type="button" class="btn ${isProd ? 'd' : 'p'}" id="btn-wizard-launch"
                  style="${isProd ? 'background: var(--bad); color: var(--pri); border-color: var(--bad);' : ''}"
                  ${isProd && !wz.confirmed ? 'disabled' : ''}>
                  ${renderIcon('play', 14)}
                  <span>Start deployment to ${isProd ? 'Production' : (currentEnv.display_name || currentEnv.name)}</span>
                </button>
              `}
            </div>
          </div>

          <!-- Summary Aside -->
          <div class="pn as">
            <div class="ph">
              <h2>Summary</h2>
              <small>Configuration review</small>
            </div>
            <dl>
              <dt>Application</dt>
              <dd><b>${currentApp.display_name || currentApp.name || '—'}</b></dd>
              <dt>Environment</dt>
              <dd>${currentEnv.display_name || currentEnv.name || '—'}</dd>
              <dt>Target host</dt>
              <dd class="mono num">${currentEnv.host || '127.0.0.1'}</dd>
              <dt>Branch</dt>
              <dd class="mono">${wz.branch || '—'}</dd>
              <dt>Image tag</dt>
              <dd class="mono">${wz.tag || '—'}</dd>
              <dt>Container</dt>
              <dd class="mono">${wz.containerName || '—'}</dd>
            </dl>
          </div>
        </div>
      `;

      // Event Listeners for Step 1
      const appSelect = document.getElementById('wz-app-select');
      if (appSelect) {
        appSelect.addEventListener('change', (e) => {
          wz.appId = e.target.value;
          const selectedApp = apps.find(a => a.id === wz.appId) || {};
          let appPermitted = selectedApp.permitted_branches || [];
          if (typeof appPermitted === 'string') {
            try { appPermitted = JSON.parse(appPermitted); } catch { appPermitted = []; }
          }
          wz.branch = selectedApp.default_branch || (appPermitted[0] || 'devel');
          wz.containerName = selectedApp.name || 'asdp-dims-fe';

          const newAppEnvs = (selectedApp.environments && selectedApp.environments.length > 0)
            ? selectedApp.environments
            : allEnvs.filter(envItem => envItem.application_id === selectedApp.id || !envItem.application_id);

          wz.envId = newAppEnvs[0] ? newAppEnvs[0].id : '';
          renderView();
        });
      }

      container.querySelectorAll('.seg button').forEach(btn => {
        btn.addEventListener('click', () => {
          wz.envId = btn.getAttribute('data-env-id');
          renderView();
        });
      });

      // Event Listeners for Step 2
      const branchInput = document.getElementById('wz-branch');
      if (branchInput) {
        branchInput.addEventListener('input', (e) => {
          wz.branch = e.target.value;
          const valid = checkBranchPermitted(wz.branch, permittedBranches);
          branchInput.setAttribute('aria-invalid', String(!valid));
          const hintEl = document.getElementById('wz-branch-hint');
          if (hintEl) {
            hintEl.className = valid ? 'hint' : 'err';
            hintEl.style.color = valid ? 'var(--t3)' : 'var(--bad)';
            hintEl.textContent = valid
              ? `Permitted for ${currentApp.display_name || currentApp.name}: ${permittedBranches.join(', ')}`
              : `Not a permitted ref for ${currentApp.display_name || currentApp.name}. Allowed: ${permittedBranches.join(', ')}`;
          }
          const nextBtn = document.getElementById('btn-wizard-next');
          if (nextBtn) nextBtn.disabled = !valid || !wz.tag;
        });
      }

      const tagInput = document.getElementById('wz-tag');
      if (tagInput) {
        tagInput.addEventListener('input', (e) => {
          wz.tag = e.target.value;
          const valid = checkBranchPermitted(wz.branch, permittedBranches);
          const nextBtn = document.getElementById('btn-wizard-next');
          if (nextBtn) nextBtn.disabled = !valid || !wz.tag;
        });
      }

      const containerInput = document.getElementById('wz-container');
      if (containerInput) {
        containerInput.addEventListener('input', (e) => {
          wz.containerName = e.target.value;
        });
      }

      const verifyHostCk = document.getElementById('wz-verify-host');
      if (verifyHostCk) {
        verifyHostCk.addEventListener('change', (e) => {
          wz.verifyOnHost = e.target.checked;
        });
      }

      // Event Listeners for Step 3
      const confirmProdCk = document.getElementById('wz-confirm-prod');
      if (confirmProdCk) {
        confirmProdCk.addEventListener('change', (e) => {
          wz.confirmed = e.target.checked;
          const launchBtn = document.getElementById('btn-wizard-launch');
          if (launchBtn) launchBtn.disabled = !wz.confirmed;
        });
      }

      // Step Navigation Controls
      const backBtn = document.getElementById('btn-wizard-back');
      if (backBtn) {
        backBtn.addEventListener('click', () => {
          if (wz.step > 1) {
            wz.step--;
            renderView();
          }
        });
      }

      const nextBtn = document.getElementById('btn-wizard-next');
      if (nextBtn) {
        nextBtn.addEventListener('click', () => {
          if (wz.step < 3) {
            wz.step++;
            renderView();
          }
        });
      }

      const launchBtn = document.getElementById('btn-wizard-launch');
      if (launchBtn) {
        launchBtn.addEventListener('click', async () => {
          try {
            launchBtn.disabled = true;
            launchBtn.innerHTML = `${renderIcon('loader', 14)}<span>Launching pipeline...</span>`;

            const deployment = await api.createDeployment({
              application_id: wz.appId,
              environment_id: wz.envId,
              branch: wz.branch,
              tag: wz.tag,
              image_tag: wz.tag,
              container_name: wz.containerName,
              verify_on_host: wz.verifyOnHost,
              enable_local_verification: wz.verifyOnHost,
              operator_confirmed: wz.confirmed,
              confirm_production: wz.confirmed,
            });

            window.location.hash = `#/deployments/${deployment.id || deployment.deploymentId}`;
          } catch (err) {
            showAlert({
              type: 'error',
              title: 'Deployment Launch Failed',
              message: err.message || 'An unexpected error occurred while launching deployment.',
              details: err.stack || null
            });
            launchBtn.disabled = false;
            launchBtn.innerHTML = `${renderIcon('play', 14)}<span>Start deployment</span>`;
          }
        });
      }
    }

    renderView();
  } catch (err) {
    container.innerHTML = `
      <div class="pn" style="margin-top: 24px; border-color: var(--bad);">
        <div class="ph"><h2 style="color: var(--bad);">Failed to load deployment wizard</h2></div>
        <div class="pb"><p class="t2">${err.message || 'An error occurred while loading deployment wizard.'}</p></div>
      </div>
    `;
  }
}
