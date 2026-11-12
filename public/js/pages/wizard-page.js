/**
 * Pipra Deployment Wizard Page
 * 3-Step Wizard with persistent summary aside and production cutover safeguards.
 * Aligned with DESIGN.md & Control Plane Redesign Mockup.
 */

import { api } from '../api.js';
import { renderIcon } from '../icons.js';
import { state } from '../state.js';
import { canDeploy } from '../auth.js';

export async function renderWizardPage(container, params = {}) {
  container.innerHTML = `
    <div style="padding: 48px; text-align: center; color: var(--t2);">
      <div class="mono">Loading deployment configuration...</div>
    </div>
  `;

  try {
    const [apps, envs] = await Promise.all([
      api.getApplications(),
      api.getEnvironments(),
    ]);

    const initialApp = apps.find(a => a.id === params.app || a.name === params.app) || apps[0];
    const initialEnv = envs.find(e => e.id === params.env || e.name === params.env) || envs[0];

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
      const currentEnv = envs.find(e => e.id === wz.envId) || envs[0] || {};
      const isProd = currentEnv.is_production || currentEnv.name === 'production';
      const isRefValid = /^(devel|main|prod|staging|release\/.+|hotfix\/.+)$/.test(wz.branch);

      // Step 1: Target Application & Environment
      const step1Html = `
        <div class="fl">
          <div>
            <label for="wz-app-select" style="display: block; font-weight: 500; margin-bottom: 5px;">Application</label>
            <select id="wz-app-select" aria-label="Application" style="width: 100%; height: 36px; padding: 0 10px; background: var(--in); border: 1px solid var(--bd); border-radius: 6px;">
              ${apps.map(a => `<option value="${a.id}" ${a.id === wz.appId ? 'selected' : ''}>${a.display_name} (${a.name})</option>`).join('')}
            </select>
          </div>
          <div>
            <label id="wz-env-label" style="display: block; font-weight: 500; margin-bottom: 5px;">Target environment</label>
            <div class="seg" role="group" aria-labelledby="wz-env-label">
              ${envs.map(e => {
                const ep = e.is_production || e.name === 'production';
                const isSelected = e.id === wz.envId;
                return `
                  <button type="button" class="${ep ? 'prod' : ''}" aria-pressed="${isSelected}" data-env-id="${e.id}">
                    <b>${e.display_name || e.name}</b>
                    <span class="dim">${ep ? 'Production critical' : 'Non-production'}</span>
                  </button>
                `;
              }).join('')}
            </div>
          </div>
        </div>
      `;

      // Step 2: Revision & Docker Image
      const step2Html = `
        <div class="fl">
          <div class="row2">
            <div>
              <label for="wz-branch" style="display: block; font-weight: 500; margin-bottom: 5px;">Branch / tag / ref</label>
              <input id="wz-branch" type="text" value="${wz.branch}" aria-invalid="${!isRefValid}" style="width: 100%; height: 36px; padding: 0 10px; background: var(--in); border: 1px solid var(--bd); border-radius: 6px;" />
              <div class="${isRefValid ? 'hint' : 'err'}" style="font-size: 12px; margin-top: 5px; color: ${isRefValid ? 'var(--t3)' : 'var(--bad)'};">
                ${isRefValid ? 'Permitted: devel, main, prod, staging, release/*, hotfix/*' : 'Not a permitted ref. Use devel, main, prod, staging, release/*, or hotfix/*.'}
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
            <div class="hint" style="color: var(--t3); font-size: 12px; margin-top: 5px;">Target container identity. Staging uses &lt;name&gt;-staging-&lt;timestamp&gt;.</div>
          </div>

          <label class="ck">
            <input type="checkbox" id="wz-verify-host" ${wz.verifyOnHost ? 'checked' : ''} />
            <span>
              Verify on host before building
              <div class="hint" style="color: var(--t3); font-size: 12px;">Runs npm ci and npm run build first. Leave off for faster multi-stage builds.</div>
            </span>
          </label>
        </div>
      `;

      // Step 3: Preflight & Cutover
      const step3Html = `
        <div class="fl">
          <div>
            <h2 style="font-size: 14px; font-weight: 600; margin-bottom: 8px;">Preflight validation</h2>
            <dl style="grid-template-columns: 170px 1fr; border: 1px solid var(--bs); border-radius: 8px;">
              <dt>Production port</dt>
              <dd class="mono">${currentApp.ports?.production || ':4000'}</dd>
              <dt>Staging isolation port</dt>
              <dd class="mono">${currentApp.ports?.staging || ':4001'}</dd>
              <dt>Host directory</dt>
              <dd class="mono">${currentApp.host_directory || '/home/devel/asdp-dims-fe'}</dd>
              <dt>Rollback target release</dt>
              <dd class="mono">${currentEnv.active_release_id || 'asdp-dims-fe:devel-latest'}</dd>
              <dt>Preflight result</dt>
              <dd><span class="b ok">${renderIcon('check', 12)}Passed</span></dd>
            </dl>
          </div>

          ${isProd ? `
            <div class="grd" style="margin: 0;">
              ${renderIcon('shield', 18)}
              <div>
                <b>Production cutover may cause a brief interruption.</b><br>
                Target <code>${currentEnv.host || '127.0.0.1'}</code> · release <code>${wz.branch}@${wz.tag}</code>. Strategy: staging health check, atomic container cutover, and production verification. If verification fails, Pipra automatically rolls back to <span class="mono">${currentEnv.active_release_id || 'last known-good release'}</span>.
              </div>
            </div>

            <label class="ck" style="margin-top: 4px;">
              <input type="checkbox" id="wz-confirm-prod" ${wz.confirmed ? 'checked' : ''} />
              <span>I confirm deploying <b>${wz.tag}</b> to <b>Production</b>.</span>
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

          <!-- Persistent Summary Aside -->
          <aside class="pn" aria-label="Deployment summary">
            <div class="ph">
              <h2>Summary</h2>
            </div>
            <dl style="grid-template-columns: 100px 1fr;">
              <dt>Application</dt>
              <dd>${currentApp.display_name || 'ASDP DIMS Frontend'}</dd>
              <dt>Environment</dt>
              <dd>
                <span class="env ${isProd ? 'prod' : (currentEnv.name && currentEnv.name.includes('staging') ? 'staging' : 'devel')}">
                  <i></i>${currentEnv.display_name || currentEnv.name || 'devel'}
                </span>
              </dd>
              <dt>Revision</dt>
              <dd class="mono">${wz.branch || '—'}</dd>
              <dt>Image tag</dt>
              <dd class="mono">${wz.tag || '—'}</dd>
              <dt>Rollback to</dt>
              <dd class="mono">${currentEnv.active_release_id || 'asdp-dims-fe:devel-latest'}</dd>
            </dl>
          </aside>
        </div>
      `;

      // Event Listeners for Step 1
      const appSelect = document.getElementById('wz-app-select');
      if (appSelect) {
        appSelect.addEventListener('change', (e) => {
          wz.appId = e.target.value;
          const a = apps.find(x => x.id === wz.appId);
          if (a) {
            wz.branch = a.default_branch || 'devel';
            wz.containerName = a.name || 'asdp-dims-fe';
          }
          renderView();
        });
      }

      const envButtons = container.querySelectorAll('.seg button');
      envButtons.forEach(btn => {
        btn.addEventListener('click', () => {
          wz.envId = btn.getAttribute('data-env-id');
          wz.confirmed = false;
          renderView();
        });
      });

      // Event Listeners for Step 2
      const branchInput = document.getElementById('wz-branch');
      if (branchInput) {
        branchInput.addEventListener('input', (e) => {
          wz.branch = e.target.value;
          const nextBtn = document.getElementById('btn-wizard-next');
          const valid = /^(devel|main|prod|staging|release\/.+|hotfix\/.+)$/.test(wz.branch);
          if (nextBtn) nextBtn.disabled = !valid || !wz.tag;
          // Update summary
          const summaryRev = container.querySelector('aside dl dd:nth-of-type(3)');
          if (summaryRev) summaryRev.textContent = wz.branch || '—';
        });
      }

      const tagInput = document.getElementById('wz-tag');
      if (tagInput) {
        tagInput.addEventListener('input', (e) => {
          wz.tag = e.target.value;
          const nextBtn = document.getElementById('btn-wizard-next');
          const valid = /^(devel|main|prod|staging|release\/.+|hotfix\/.+)$/.test(wz.branch);
          if (nextBtn) nextBtn.disabled = !valid || !wz.tag;
          // Update summary
          const summaryTag = container.querySelector('aside dl dd:nth-of-type(4)');
          if (summaryTag) summaryTag.textContent = wz.tag || '—';
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
              image_tag: wz.tag,
              container_name: wz.containerName,
              verify_on_host: wz.verifyOnHost,
              operator_confirmed: wz.confirmed,
            });

            window.location.hash = `#/deployments/${deployment.id}`;
          } catch (err) {
            alert(`Failed to launch deployment: ${err.message}`);
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
