/**
 * Pipra Resilient SSE Client
 * Manages live stage updates and terminal logs with reconnection recovery.
 */

export class DeploymentEventStream {
  constructor(deploymentId) {
    this.deploymentId = deploymentId;
    this.eventSource = null;
    this.callbacks = {
      init: [],
      stage: [],
      log: [],
      probe: [],
      status: [],
      finished: [],
    };
    this.reconnectAttempts = 0;
    this.isClosed = false;
  }

  connect() {
    if (this.isClosed) return;
    const url = `/api/deployments/${this.deploymentId}/events`;
    this.eventSource = new EventSource(url);

    this.eventSource.addEventListener('init', (e) => {
      this.reconnectAttempts = 0;
      const data = JSON.parse(e.data);
      this.callbacks.init.forEach(cb => cb(data));
    });

    this.eventSource.addEventListener('stage', (e) => {
      const data = JSON.parse(e.data);
      this.callbacks.stage.forEach(cb => cb(data));
    });

    this.eventSource.addEventListener('log', (e) => {
      const data = JSON.parse(e.data);
      this.callbacks.log.forEach(cb => cb(data));
    });

    this.eventSource.addEventListener('probe', (e) => {
      const data = JSON.parse(e.data);
      this.callbacks.probe.forEach(cb => cb(data));
    });

    this.eventSource.addEventListener('status', (e) => {
      const data = JSON.parse(e.data);
      this.callbacks.status.forEach(cb => cb(data));
    });

    this.eventSource.addEventListener('finished', (e) => {
      const data = JSON.parse(e.data);
      this.callbacks.finished.forEach(cb => cb(data));
    });

    this.eventSource.onerror = () => {
      if (this.isClosed) return;
      this.eventSource.close();
      const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts++), 10000);
      setTimeout(() => this.connect(), delay);
    };
  }

  on(event, callback) {
    if (this.callbacks[event]) {
      this.callbacks[event].push(callback);
    }
    return this;
  }

  disconnect() {
    this.isClosed = true;
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
  }
}
