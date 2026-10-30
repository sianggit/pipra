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

  async getDeploymentLogs(id, stage = null) {
    const query = stage ? `?stage=${stage}` : '';
    return this.request(`/api/deployments/${id}/logs${query}`);
  }

  // Applications
  async getApplications() {
    return this.request('/api/applications');
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

  // Environments
  async getEnvironments() {
    return this.request('/api/environments');
  }

  async updateEnvironment(id, payload) {
    return this.request(`/api/environments/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
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

  // Overview Stats
  async getOverviewStats() {
    return this.request('/api/stats/overview');
  }
}

export const api = new ApiClient();
