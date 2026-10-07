const ACTIVE_STATES = new Set(["RUNNING", "RUNNING_TRANSITION", "WAITING_MANUAL"]);

export class ScreenWakeLock {
  constructor({ navigatorObject = globalThis.navigator } = {}) {
    this.navigatorObject = navigatorObject;
    this.sentinel = null;
    this.requesting = null;
    this.requestVersion = 0;
  }

  async acquire() {
    if (this.sentinel || this.requesting || !this.navigatorObject?.wakeLock?.request) return this.requesting;

    const version = this.requestVersion;
    this.requesting = this.navigatorObject.wakeLock.request("screen")
      .then(async (sentinel) => {
        if (version !== this.requestVersion) {
          await sentinel.release();
          return;
        }
        sentinel.addEventListener("release", () => {
          if (this.sentinel === sentinel) this.sentinel = null;
        });
        this.sentinel = sentinel;
      })
      .catch(() => {
        // Wake Lock is optional and can be rejected by the browser.
      })
      .finally(() => {
        this.requesting = null;
      });
    return this.requesting;
  }

  async release() {
    if (!this.sentinel && !this.requesting) return;
    this.requestVersion += 1;
    const sentinel = this.sentinel;
    this.sentinel = null;
    if (!sentinel) return;

    try {
      await sentinel.release();
    } catch {
      // A released sentinel may reject a second release attempt.
    }
  }

  sync(state, visible) {
    if (visible && ACTIVE_STATES.has(state)) return this.acquire();
    return this.release();
  }
}

export { ACTIVE_STATES };
