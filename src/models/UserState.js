/**
 * User State Manager
 * Manages per-user state for multi-step operations
 */
export class UserState {
  constructor() {
    this.states = new Map();
  }

  setState(userId, state) {
    this.states.set(String(userId), state);
  }

  getState(userId) {
    return this.states.get(String(userId));
  }

  clearState(userId) {
    this.states.delete(String(userId));
  }

  hasState(userId) {
    return this.states.has(String(userId));
  }
}

