/**
 * Pipra REST Client & API Wrapper
 */

class ApiClient {
  constructor() {
    this.token = localStorage.getItem('pipra_token') || null;
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('pipra_token', token);
    } else {
      localStorage.removeItem('pipra_token');
    }
  }

  async request(path, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(options.headers || {}),
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(path, {
      ...options,
      headers,
    });

    if (response.status === 401 && !path.includes('/api/auth/login')) {
      this.setToken(null);
      window.location.hash = '#/login';
      throw new Error('Session expired. Please log in again.');
    }

    const contentType = response.headers.get('content-type');
    let data = null;
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    if (!response.ok) {
      const errorMsg = (data && data.error) ? data.error : `HTTP ${response.status}`;
      throw new Error(errorMsg);
    }

    return data;
  }

  // Auth endpoints
  async login(username, password) {
    const data = await this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    if (data.token) this.setToken(data.token);
    return data;
  }

  async me() {
    return this.request('/api/auth/me');
  }

  async logout() {
    try {
      await this.request('/api/auth/logout', { method: 'POST' });
    } finally {
      this.setToken(null);
    }
  }

  async changePassword(new_password) {
    return this.request('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ new_password }),
    });
  }

  // Users & RBAC
  async getUsers() {
    return this.request('/api/users');
  }

  async createUser(payload) {
    return this.request('/api/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateUserRole(id, role) {
    return this.request(`/api/users/${id}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
  }

  async resetUserPassword(id, password) {
    return this.request(`/api/users/${id}/password`, {
      method: 'PATCH',
      body: JSON.stringify({ password }),
    });
  }

  async deleteUser(id) {
    return this.request(`/api/users/${id}`, {
      method: 'DELETE',
    });
  }

  // Deployments
  async getDeployments(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/deployments${query ? '?' + query : ''}`);
  }

  async getDeployment(id) {
    return this.request(`/api/deployments/${id}`);
  }

  async createDeployment(payload) {
    return this.request('/api/deployments', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async cancelDeployment(id) {
    return this.request(`/api/deployments/${id}/cancel`, { method: 'POST' });
  }

  async approveDeployment(id, comments = '', allowSelfApproval = false) {
    return this.request(`/api/deployments/${id}/approve`, {
      method: 'POST',
      body: JSON.stringify({ comments, allow_self_approval: allowSelfApproval }),
    });
  }

  async rejectDeployment(id, reason = '') {
    return this.request(`/api/deployments/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async getDeploymentLogs(id, stage = null) {
    const query = stage ? `?stage=${stage}` : '';
    return this.request(`/api/deployments/${id}/logs${query}`);
  }

  async verifyDeploymentProvenance(id) {
    return this.request(`/api/deployments/${id}/provenance/verify`, {
      method: 'POST',
    });
  }

  // Applications
  async getApplications(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/api/applications${query ? '?' + query : ''}`);
  }

  async getApplication(id) {
    return this.request(`/api/applications/${id}`);
  }

  async createApplication(payload) {
    return this.request('/api/applications', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateApplication(id, payload) {
    return this.request(`/api/applications/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async archiveApplication(id, isArchived = true) {
    return this.request(`/api/applications/${id}/archive`, {
      method: 'PATCH',
      body: JSON.stringify({ is_archived: isArchived ? 1 : 0 }),
    });
  }

  async deleteApplication(id, confirmSlug) {
    return this.request(`/api/applications/${id}`, {
      method: 'DELETE',
      body: JSON.stringify({ confirm_slug: confirmSlug }),
    });
  }

  // Environments
  async getEnvironments(appId = null, params = {}) {
    const queryObj = { ...(params || {}) };
    if (appId) queryObj.app = appId;
    const query = new URLSearchParams(queryObj).toString();
    return this.request(`/api/environments${query ? '?' + query : ''}`);
  }

  async createEnvironment(payload) {
    return this.request('/api/environments', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateEnvironment(id, payload) {
    return this.request(`/api/environments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  }

  async archiveEnvironment(id, isArchived = true) {
    return this.request(`/api/environments/${id}/archive`, {
      method: 'PATCH',
      body: JSON.stringify({ is_archived: isArchived ? 1 : 0 }),
    });
  }

  async deleteEnvironment(id) {
    return this.request(`/api/environments/${id}`, {
      method: 'DELETE',
    });
  }

  async testConnection(id) {
    return this.request(`/api/environments/${id}/test-connection`, {
      method: 'POST',
    });
  }

  // Agents & Infra
  async getAgents() {
    return this.request('/api/agents');
  }

  // Audit Logs
  async getAuditLogs(limit = 50) {
    return this.request(`/api/audit-logs?limit=${limit}`);
  }

  // Overview & DORA Analytics Stats
  async getOverviewStats() {
    return this.request('/api/stats/overview');
  }

  async getDoraMetrics(timeframe = '30d', appId = null) {
    const params = new URLSearchParams({ timeframe });
    if (appId) params.append('application_id', appId);
    return this.request(`/api/stats/dora?${params.toString()}`);
  }

  getDoraExportUrl(format = 'csv', timeframe = '30d', appId = null) {
    const params = new URLSearchParams({ format, timeframe });
    if (appId) params.append('application_id', appId);
    return `/api/stats/dora/export?${params.toString()}`;
  }

  // Webhooks & GitOps
  async getAppWebhooks(appId) {
    return this.request(`/api/applications/${appId}/webhooks`);
  }

  async regenerateWebhookSecret(appId) {
    return this.request(`/api/applications/${appId}/webhooks/regenerate-secret`, {
      method: 'POST',
    });
  }
}

export const api = new ApiClient();
