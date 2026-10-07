import { expandRoutine, TRANSITION_MODES } from "./routines.js";

export const TIMER_STATES = Object.freeze({
  IDLE: "IDLE",
  RUNNING: "RUNNING",
  PAUSED: "PAUSED",
  WAITING_MANUAL: "WAITING_MANUAL",
  RUNNING_TRANSITION: "RUNNING_TRANSITION",
  FINISHED: "FINISHED",
});

const TIMED_STATES = new Set([
  TIMER_STATES.RUNNING,
  TIMER_STATES.RUNNING_TRANSITION,
]);

export class TimerEngine {
  constructor(routine, { now = () => Date.now() } = {}) {
    const expanded = expandRoutine(routine);
    this.routine = expanded.routine;
    this.timeline = expanded.timeline;
    this.now = now;
    this.listeners = new Set();
    this._resetRuntime();
  }

  _resetRuntime() {
    this.state = TIMER_STATES.IDLE;
    this.currentIndex = null;
    this.endTimestamp = null;
    this.phaseStartedAt = null;
    this.phaseDurationMs = 0;
    this.pausedState = null;
    this.pausedRemainingMs = 0;
    this.waitingStartedAt = null;
    this.startedAt = null;
    this.completedAt = null;
    this.elapsedActiveTime = 0;
    this.manualTransitionTime = 0;
  }

  subscribe(listener) {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => this.listeners.delete(listener);
  }

  getSnapshot(timestamp = this.now()) {
    const current = this.currentIndex == null ? null : this.timeline[this.currentIndex];
    const next = this.currentIndex == null
      ? this.timeline[0] ?? null
      : this.timeline[this.currentIndex + 1] ?? null;
    let remainingMs = 0;
    let waitingElapsedMs = 0;

    if (TIMED_STATES.has(this.state)) {
      remainingMs = Math.max(0, this.endTimestamp - timestamp);
    } else if (this.state === TIMER_STATES.PAUSED) {
      remainingMs = this.pausedRemainingMs;
    } else if (this.state === TIMER_STATES.WAITING_MANUAL) {
      waitingElapsedMs = Math.max(0, timestamp - this.waitingStartedAt);
    }

    const activeInProgress = TIMED_STATES.has(this.state)
      ? Math.max(0, Math.min(timestamp, this.endTimestamp) - this.phaseStartedAt)
      : 0;
    const manualInProgress = this.state === TIMER_STATES.WAITING_MANUAL
      ? waitingElapsedMs
      : 0;

    return {
      state: this.state,
      routine: this.routine,
      current,
      next,
      currentPosition: this.currentIndex,
      totalSteps: this.timeline.length,
      remainingMs,
      waitingElapsedMs,
      pausedState: this.pausedState,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      elapsedActiveTime: this.elapsedActiveTime + activeInProgress,
      manualTransitionTime: this.manualTransitionTime + manualInProgress,
    };
  }

  start(timestamp = this.now()) {
    this._resetRuntime();
    this.startedAt = timestamp;
    this.currentIndex = 0;
    this._startStep(timestamp);
    return this._publish(timestamp);
  }

  tick(timestamp = this.now()) {
    this._advance(timestamp);
    return this._publish(timestamp);
  }

  pause(timestamp = this.now()) {
    this._advance(timestamp);
    if (!TIMED_STATES.has(this.state)) return this.getSnapshot(timestamp);

    this._closeTimedPhase(timestamp);
    this.pausedState = this.state;
    this.pausedRemainingMs = Math.max(0, this.endTimestamp - timestamp);
    this.state = TIMER_STATES.PAUSED;
    this.endTimestamp = null;
    return this._publish(timestamp);
  }

  resume(timestamp = this.now()) {
    if (this.state !== TIMER_STATES.PAUSED) return this.getSnapshot(timestamp);

    this.state = this.pausedState;
    this.phaseStartedAt = timestamp;
    this.phaseDurationMs = this.pausedRemainingMs;
    this.endTimestamp = timestamp + this.pausedRemainingMs;
    this.pausedState = null;
    this.pausedRemainingMs = 0;
    return this._publish(timestamp);
  }

  go(timestamp = this.now()) {
    this._advance(timestamp);
    if (this.state !== TIMER_STATES.WAITING_MANUAL) return this.getSnapshot(timestamp);

    this._closeManualWait(timestamp);
    this._moveTo(this.currentIndex + 1, timestamp);
    return this._publish(timestamp);
  }

  next(timestamp = this.now()) {
    this._advance(timestamp);
    if (this.state === TIMER_STATES.IDLE || this.state === TIMER_STATES.FINISHED) {
      return this.getSnapshot(timestamp);
    }

    this._closeCurrentPhase(timestamp);
    this._moveTo(this.currentIndex + 1, timestamp);
    return this._publish(timestamp);
  }

  previous(timestamp = this.now()) {
    this._advance(timestamp);
    if (this.state === TIMER_STATES.IDLE) return this.getSnapshot(timestamp);

    this._closeCurrentPhase(timestamp);
    const target = Math.max(0, (this.currentIndex ?? 0) - 1);
    this.completedAt = null;
    this._moveTo(target, timestamp);
    return this._publish(timestamp);
  }

  restartStep(timestamp = this.now()) {
    this._advance(timestamp);
    if (this.currentIndex == null || this.state === TIMER_STATES.IDLE) {
      return this.getSnapshot(timestamp);
    }

    this._closeCurrentPhase(timestamp);
    this.completedAt = null;
    this._startStep(timestamp);
    return this._publish(timestamp);
  }

  stop(timestamp = this.now()) {
    this._advance(timestamp);
    this._closeCurrentPhase(timestamp);
    this._resetRuntime();
    return this._publish(timestamp);
  }

  _startStep(timestamp) {
    const entry = this.timeline[this.currentIndex];
    this.state = TIMER_STATES.RUNNING;
    this._startTimedPhase(entry.step.duration * 1000, timestamp);
  }

  _startTransition(durationSeconds, timestamp) {
    this.state = TIMER_STATES.RUNNING_TRANSITION;
    this._startTimedPhase(durationSeconds * 1000, timestamp);
  }

  _startTimedPhase(durationMs, timestamp) {
    this.pausedState = null;
    this.pausedRemainingMs = 0;
    this.phaseStartedAt = timestamp;
    this.phaseDurationMs = durationMs;
    this.endTimestamp = timestamp + durationMs;
  }

  _advance(timestamp) {
    while (TIMED_STATES.has(this.state) && timestamp >= this.endTimestamp) {
      const boundary = this.endTimestamp;
      const completedState = this.state;
      this._closeTimedPhase(boundary);

      if (completedState === TIMER_STATES.RUNNING_TRANSITION) {
        this._moveTo(this.currentIndex + 1, boundary);
        continue;
      }

      if (this.currentIndex + 1 >= this.timeline.length) {
        this._finish(boundary);
        break;
      }

      const transition = this.timeline[this.currentIndex].step.transition;
      if (transition.mode === TRANSITION_MODES.MANUAL) {
        this.state = TIMER_STATES.WAITING_MANUAL;
        this.waitingStartedAt = boundary;
        this.endTimestamp = null;
        break;
      }
      if (transition.mode === TRANSITION_MODES.DELAY) {
        this._startTransition(transition.duration, boundary);
        continue;
      }

      this._moveTo(this.currentIndex + 1, boundary);
    }
  }

  _moveTo(index, timestamp) {
    this.waitingStartedAt = null;
    if (index >= this.timeline.length) {
      this._finish(timestamp);
      return;
    }

    this.currentIndex = index;
    this._startStep(timestamp);
  }

  _finish(timestamp) {
    this.state = TIMER_STATES.FINISHED;
    this.completedAt = timestamp;
    this.endTimestamp = null;
    this.phaseStartedAt = null;
    this.phaseDurationMs = 0;
    this.waitingStartedAt = null;
  }

  _closeTimedPhase(timestamp) {
    if (!TIMED_STATES.has(this.state) || this.phaseStartedAt == null) return;

    const elapsed = Math.max(
      0,
      Math.min(timestamp - this.phaseStartedAt, this.phaseDurationMs),
    );
    this.elapsedActiveTime += elapsed;
    this.phaseStartedAt = null;
    this.phaseDurationMs = 0;
  }

  _closeManualWait(timestamp) {
    if (this.state !== TIMER_STATES.WAITING_MANUAL || this.waitingStartedAt == null) return;

    this.manualTransitionTime += Math.max(0, timestamp - this.waitingStartedAt);
    this.waitingStartedAt = null;
  }

  _closeCurrentPhase(timestamp) {
    if (TIMED_STATES.has(this.state)) this._closeTimedPhase(timestamp);
    if (this.state === TIMER_STATES.WAITING_MANUAL) this._closeManualWait(timestamp);
  }

  _publish(timestamp) {
    const snapshot = this.getSnapshot(timestamp);
    this.listeners.forEach((listener) => listener(snapshot));
    return snapshot;
  }
}
