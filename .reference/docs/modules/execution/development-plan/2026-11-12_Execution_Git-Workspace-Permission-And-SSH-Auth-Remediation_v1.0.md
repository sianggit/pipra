# Architecture & Remediation Plan: Git Workspace Permissions, Host SSH Key Provisioning & Stage 2 Sync Resilience

**Document ID:** `.reference/docs/modules/execution/development-plan/2026-11-12_Execution_Git-Workspace-Permission-And-SSH-Auth-Remediation_v1.0.md`  
**Module:** Execution Engine & Host Workspace Management  
**Target Host Server:** `172.25.230.100` (User: `devel`, Service: `pipra.service`)  
**Target Repository Workspace:** `/home/devel/asdp-dims-fe` (`origin git@github.com:asyst-git/asdp-dims-fe.git`)  
**Status:** COMPLETED & VERIFIED ONLINE (`http://172.25.230.100:4200`)  
**Date:** 2026-11-12  

---

## 1. Root Cause Analysis (RCA)

### 1.1 Observed Symptoms
During Stage 2 (`SOURCE_PULL`) of the deployment pipeline on `172.25.230.100`:
```text
09:39:27 S02 INFO Checking git workspace at: /home/devel/asdp-dims-fe
09:39:27 S02 INFO git fetch --all --prune (tracking origin)
09:39:27 S02 WARN error: cannot open '.git/FETCH_HEAD': Permission denied
09:39:27 S02 WARN Git sync note: Command git failed with exit code 255
09:39:27 S02 INFO Source Revision: 628558fa (...) by DevOps Release Bot
```

### 1.2 Root Cause Breakdown

Our live forensic audit on `172.25.230.100` revealed **three interconnected root causes**:

| # | Component | Forensic Evidence | Impact |
|---|---|---|---|
| **RC-01** | **Workspace Ownership Discrepancy** | `/home/devel/asdp-dims-fe` and all files inside `.git/` (including `FETCH_HEAD`, `index`, `objects`) are owned by `root:root` (`-rw-r--r--. 1 root root FETCH_HEAD`). | Pipra runs under systemd as unprivileged user `devel`. When `devel` runs `git fetch`, git attempts to open `.git/FETCH_HEAD` for writing, resulting in OS error `EACCES (Permission denied)`. |
| **RC-02** | **Host SSH Key Isolation** | The GitHub deploy key (`id_ed25519`) authenticated as `sianggit` exists exclusively in `/root/.ssh/id_ed25519`. `/home/devel/.ssh/` contains only `known_hosts` and zero SSH keys. | Even if file permissions are corrected, `git fetch` connecting to `git@github.com:asyst-git/asdp-dims-fe.git` will fail with `git@github.com: Permission denied (publickey)` because user `devel` lacks the private key. |
| **RC-03** | **Pipra Silent Catch & Fake SHA Fallback** | In `src/engine/execution-driver.js` line 272, errors during `git fetch` / `git checkout` / `git pull` are swallowed into a `catch` block that only logs a warning and proceeds with a synthesized random SHA. | The pipeline continues deploying with stale/outdated code on the server rather than reporting an explicit git sync failure or providing an actionable diagnostic recommendation. |

---

## 2. Remediation Strategy & Architectural Fixes

### 2.1 Host Infrastructure Remediation (`172.25.230.100`)

1. **Deploy SSH Key to User `devel`:**
   - Copy `/root/.ssh/id_ed25519` and `/root/.ssh/id_ed25519.pub` to `/home/devel/.ssh/`.
   - Set strict ownership to `devel:devel` and permissions `0600` (private key) and `0644` (public key).
   - Verify `ssh -T git@github.com` succeeds as user `devel`.

2. **Reclaim Workspace Ownership:**
   - Recursively change ownership of `/home/devel/asdp-dims-fe` to `devel:devel`:
     ```bash
     sudo chown -R devel:devel /home/devel/asdp-dims-fe
     ```
   - Ensure proper write permissions (`chmod -R u+rwX /home/devel/asdp-dims-fe`).

3. **Configure Git Safe Directory for `devel`:**
   ```bash
   git config --global --add safe.directory /home/devel/asdp-dims-fe
   ```

### 2.2 Control Plane Engine Hardening (`src/engine/execution-driver.js`)

1. **Pre-flight Permission & Write Check:**
   - Before executing `git fetch`, test write accessibility to `<appDir>/.git` using `fs.access(..., fs.constants.W_OK)`.
   - If not writable, emit an explicit log error explaining that the workspace is owned by another user (e.g. `root`) and recommend running `sudo chown -R devel:devel <appDir>`.

2. **Strict Git Pull Enforcement vs Graceful Recovery:**
   - Differentiate network/credential errors from filesystem permission errors.
   - For permission errors (`Permission denied`), abort the stage immediately with an informative diagnostic message rather than proceeding blindly with stale source code.

3. **AI Diagnostic Categorization:**
   - Ensure the diagnostic analyzer categorizes git permission errors as `WORKSPACE_PERMISSION_DENIED` with actionable remediation commands displayed directly on the UI RCA card.

---

## 3. Verification Matrix & Scenarios

| Scenario ID | Test Case | Target Behavior | Verification Method |
|---|---|---|---|
| **SC-01** | Devel User SSH Authentication | User `devel` connects to GitHub SSH (`ssh -T git@github.com`) and receives authenticated greeting (`Hi sianggit!`). | Plink command under `devel` |
| **SC-02** | Workspace Writable Check | User `devel` can write to `/home/devel/asdp-dims-fe/.git/FETCH_HEAD` without sudo. | `test -w /home/devel/asdp-dims-fe/.git/FETCH_HEAD && echo OK` |
| **SC-03** | Stage 2 Git Fetch & Pull | Running `git fetch --all --prune` and `git checkout <branch>` in `/home/devel/asdp-dims-fe` exits with code `0`. | Run git command directly as `devel` |
| **SC-04** | End-to-End Pipeline Execution | Trigger a fresh deployment from Pipra UI (`http://172.25.230.100:4200/#/deploy`). Stage 2 pulls live commit, records authentic SHA/commit message, and completes without exit code 255 warnings. | Inspect live deployment logs on UI |
| **SC-05** | Engine Regression Suite | All 90 backend/integration tests in `pipra` continue passing without regression. | `npm test` |

---

## 4. Implementation Steps

1. **Step 1:** Execute Host SSH key provisioning on `172.25.230.100` (`/root/.ssh/id_ed25519` -> `/home/devel/.ssh/`).
2. **Step 2:** Recursively grant ownership of `/home/devel/asdp-dims-fe` to `devel:devel` and set git safe directory.
3. **Step 3:** Test manual `git fetch --all --prune` as `devel` to confirm 100% clean output.
4. **Step 4:** Update `src/engine/execution-driver.js` with preflight workspace write checks and precise permission error categorization.
5. **Step 5:** Run local unit test suite (`npm test`).
6. **Step 6:** Push changes to GitHub (`origin master`) and deploy updated backend to `172.25.230.100`.
7. **Step 7:** Run live deployment verification via Pipra Control Plane.

