const SOUND_ENABLED_KEY = "coach-timer.sound-enabled";

function getStorage(storage) {
  if (storage) return storage;
  if (typeof window !== "undefined") {
    try {
      return window.localStorage;
    } catch {
      return null;
    }
  }
  return null;
}

function readEnabled(storage) {
  try {
    return storage?.getItem(SOUND_ENABLED_KEY) !== "false";
  } catch {
    return true;
  }
}

export class SoundPlayer {
  constructor({ storage, AudioContextClass = globalThis.AudioContext ?? globalThis.webkitAudioContext } = {}) {
    this.storage = getStorage(storage);
    this.AudioContextClass = AudioContextClass;
    this.enabled = readEnabled(this.storage);
    this.context = null;
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    try {
      this.storage?.setItem(SOUND_ENABLED_KEY, String(this.enabled));
    } catch {
      // The control still works when browser storage is unavailable.
    }
  }

  async resume() {
    if (!this.enabled || !this.AudioContextClass) return;
    this.context ??= new this.AudioContextClass();
    if (this.context.state === "suspended") {
      try {
        await this.context.resume();
      } catch {
        // Some browsers reject audio outside a user gesture.
      }
    }
  }

  playCountdown(second) {
    const frequency = { 3: 660, 2: 740, 1: 880 }[second];
    if (frequency) this._tone(frequency, 0.07);
  }

  playStepEnd() {
    this._tone(520, 0.09);
    this._tone(740, 0.13, 0.11);
  }

  playSessionEnd() {
    this._tone(523, 0.12);
    this._tone(659, 0.12, 0.14);
    this._tone(784, 0.2, 0.28);
  }

  _tone(frequency, duration, offset = 0) {
    if (!this.enabled || !this.AudioContextClass) return;
    this.context ??= new this.AudioContextClass();
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const startAt = this.context.currentTime + offset;
    oscillator.frequency.setValueAtTime(frequency, startAt);
    gain.gain.setValueAtTime(0.12, startAt);
    gain.gain.exponentialRampToValueAtTime(0.001, startAt + duration);
    oscillator.connect(gain);
    gain.connect(this.context.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + duration);
  }
}

export { SOUND_ENABLED_KEY };
