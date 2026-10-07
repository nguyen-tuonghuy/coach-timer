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
    if ([3, 2, 1].includes(second)) this._tone(880, 0.08);
  }

  playStepEnd() {
    this._tone(440, 0.6);
  }

  playStepStart() {
    this._tone(660, 0.07);
    this._tone(880, 0.12, 0.1);
  }

  playSessionEnd() {
    this._tone(523, 0.16);
    this._tone(659, 0.16, 0.2);
    this._tone(1047, 0.45, 0.4);
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
