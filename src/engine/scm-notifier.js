/**
 * Pipra SCM Commit Status Notifier
 * Sends asynchronous deployment status callbacks to GitHub and GitLab APIs.
 * Uses native fetch with zero external dependencies.
 */

const logger = require('../utils/logger');
const config = require('../config');

class ScmNotifier {
  /**
   * Parse GitHub owner and repo from various Git URL formats:
   * - https://github.com/owner/repo.git
   * - git@github.com:owner/repo.git
   * - https://github.com/owner/repo
   */
  parseGitHubRepo(repoUrl) {
    if (!repoUrl || typeof repoUrl !== 'string') return null;
    const clean = repoUrl.trim();
    const httpsMatch = clean.match(/^https?:\/\/github\.com\/([^\/]+)\/([^\/\.]+)(?:\.git)?$/i);
    if (httpsMatch) {
      return { owner: httpsMatch[1], repo: httpsMatch[2] };
    }
    const sshMatch = clean.match(/^git@github\.com:([^\/]+)\/([^\/\.]+)(?:\.git)?$/i);
    if (sshMatch) {
      return { owner: sshMatch[1], repo: sshMatch[2] };
    }
    return null;
  }

  /**
   * Post commit status to GitHub Commit Status API:
   * POST /repos/{owner}/{repo}/statuses/{sha}
   */
  async postGitHubStatus({ owner, repo, commitSha, state, description, targetUrl, token }) {
    if (!token || !commitSha || !owner || !repo) return { skipped: true };

    const url = `https://api.github.com/repos/${owner}/${repo}/statuses/${commitSha}`;
    const payload = {
      state: state, // 'pending' | 'success' | 'failure' | 'error'
      target_url: targetUrl || undefined,
      description: description ? description.substring(0, 140) : 'Pipra Release Pipeline',
      context: 'pipra/release-pipeline',
    };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Accept': 'application/vnd.github+json',
          'Authorization': `Bearer ${token}`,
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
          'User-Agent': 'Pipra-Release-Portal/1.0',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000), // 5s timeout
      });

      if (!res.ok) {
        const text = await res.text();
        logger.warn(`GitHub status update failed (HTTP ${res.status}): ${text.substring(0, 200)}`);
        return { success: false, status: res.status };
      }

      return { success: true };
    } catch (err) {
      logger.warn(`SCM Notifier error updating GitHub status: ${err.message}`);
      return { success: false, error: err.message };
    }
  }

  /**
   * Unified notification dispatcher called on stage transitions or completion
   */
  async notify({ app, deployment, state, description }) {
    if (!app || !deployment || !deployment.commit_sha) return;

    const token = process.env.GITHUB_TOKEN || process.env.PIPRA_GITHUB_TOKEN || config.GITHUB_TOKEN;
    if (!token) return; // Silent skip if no token configured

    const gh = this.parseGitHubRepo(app.repo_url);
    if (gh) {
      // Map Pipra deployment state to GitHub state: pending | success | failure | error
      let ghState = 'pending';
      if (state === 'SUCCEEDED') ghState = 'success';
      else if (state === 'FAILED' || state === 'ROLLBACK_FAILED') ghState = 'failure';
      else if (state === 'CANCELLED' || state === 'INTERRUPTED') ghState = 'error';

      await this.postGitHubStatus({
        owner: gh.owner,
        repo: gh.repo,
        commitSha: deployment.commit_sha,
        state: ghState,
        description: description || `Pipra: ${deployment.current_stage_name || state}`,
        targetUrl: `${config.APP_URL || 'http://localhost:4200'}/#/deployments/${deployment.id}`,
        token,
      });
    }
  }
}

module.exports = new ScmNotifier();

