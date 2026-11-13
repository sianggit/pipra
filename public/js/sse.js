/**
 * Pipra Resilient SSE Client
 * Manages live stage updates and terminal logs with reconnection recovery.
 */

export class DeploymentEventStream {
  constructor(deploymentId, options = {}) {
    this.deploymentId = deploymentId;
    this.eventSource = null;
    this.callbacks = {
      init: options.onInit ? [options.onInit] : [],
      stage: options.onStage ? [options.onStage] : [],
      log: options.onLog ? [options.onLog] : [],
      probe: options.onProbe ? [options.onProbe] : [],
      status: options.onStateChange ? [options.onStateChange] : [],
      finished: options.onFinished ? [options.onFinished] : [],
      approval_requested: options.onApprovalRequested ? [options.onApprovalRequested] : [],
      approved: options.onApproved ? [options.onApproved] : [],
      pipeline_spec_loaded: options.onPipelineSpecLoaded ? [options.onPipelineSpecLoaded] : [],
      diagnostic_ready: options.onDiagnosticReady ? [options.onDiagnosticReady] : [],
    };
    if (options.onError) {
      this.onErrorCallback = options.onError;
    }
    this.reconnectAttempts = 0;
    this.isClosed = false;
  }

  connect() {
    if (this.isClosed) return;
    const url = `/api/deployments/${this.deploymentId}/events`;
    this.eventSource = new EventSource(url);

    const eventNames = [
      'init', 'stage', 'log', 'probe', 'status', 'finished', 
      'approval_requested', 'approved', 'pipeline_spec_loaded', 'diagnostic_ready'
    ];
    for (const evt of eventNames) {
      this.eventSource.addEventListener(evt, (e) => {
        if (evt === 'init') this.reconnectAttempts = 0;
        try {
          const data = JSON.parse(e.data);
          (this.callbacks[evt] || []).forEach(cb => cb(data));
        } catch (err) {
          console.error(`[SSE parse error for ${evt}]`, err);
        }
      });
    }

    this.eventSource.onerror = (err) => {
      if (this.onErrorCallback) {
        try { this.onErrorCallback(err); } catch {}
      }
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
