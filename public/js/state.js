/**
 * Pipra Reactive State Store
 */

class StateStore {
  constructor() {
    this.state = {
      user: null,
      activeEnvironment: 'devel',
      environments: [],
      applications: [],
      activeDeploymentCount: 0,
      notifications: [],
    };
    this.listeners = new Set();
  }

  get() {
    return this.state;
  }

  set(partial) {
    this.state = { ...this.state, ...partial };
    this.notify();
  }

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  notifyToast(message, type = 'info') {
    const id = Date.now();
    const item = { id, message, type };
    this.set({ notifications: [...this.state.notifications, item] });
    setTimeout(() => {
      this.set({ notifications: this.state.notifications.filter(n => n.id !== id) });
    }, 4000);
  }
}

export const state = new StateStore();
