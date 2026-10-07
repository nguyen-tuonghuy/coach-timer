const AUDIO_SETTINGS_KEY = "coach-timer.audio-settings";
const LEGACY_SOUND_ENABLED_KEY = "coach-timer.sound-enabled";
const DEFAULT_SETTINGS = Object.freeze({
  enabled: true,
  volume: 90,
  countdownEnabled: true,
  stepEndEnabled: true,
});

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

function clampVolume(value) {
  const volume = Number(value);
  if (!Number.isFinite(volume)) return DEFAULT_SETTINGS.volume;
  return Math.round(Math.min(100, Math.max(0, volume)));
}

function readSettings(storage) {
  try {
    const stored = storage?.getItem(AUDIO_SETTINGS_KEY);
    if (stored) {
      const settings = JSON.parse(stored);
      return {
        enabled: typeof settings.enabled === "boolean" ? settings.enabled : DEFAULT_SETTINGS.enabled,
        volume: clampVolume(settings.volume),
        countdownEnabled: typeof settings.countdownEnabled === "boolean" ? settings.countdownEnabled : DEFAULT_SETTINGS.countdownEnabled,
        stepEndEnabled: typeof settings.stepEndEnabled === "boolean" ? settings.stepEndEnabled : DEFAULT_SETTINGS.stepEndEnabled,
      };
    }

    const legacyEnabled = storage?.getItem(LEGACY_SOUND_ENABLED_KEY);
    return { ...DEFAULT_SETTINGS, enabled: legacyEnabled !== "false" };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export class SoundPlayer {
  constructor({ storage, AudioContextClass = globalThis.AudioContext ?? globalThis.webkitAudioContext } = {}) {
    this.storage = getStorage(storage);
    this.AudioContextClass = AudioContextClass;
    this.settings = readSettings(this.storage);
    this.context = null;
    this.masterGain = null;
    this._saveSettings();
  }

  get enabled() {
    return this.settings.enabled;
  }

  setEnabled(enabled) {
    this._updateSettings({ enabled: Boolean(enabled) });
  }

  setVolume(volume) {
    this._updateSettings({ volume: clampVolume(volume) });
    this._applyMasterVolume();
  }

  setCountdownEnabled(enabled) {
    this._updateSettings({ countdownEnabled: Boolean(enabled) });
  }

  setStepEndEnabled(enabled) {
    this._updateSettings({ stepEndEnabled: Boolean(enabled) });
  }

  async resume() {
    if (!this.enabled || !this.AudioContextClass) return;
    this._ensureAudioGraph();
    if (this.context.state === "suspended") {
      try {
        await this.context.resume();
      } catch {
        // Some browsers reject audio outside a user gesture.
      }
    }
  }

  playCountdown(second) {
    if (this.settings.countdownEnabled && [3, 2, 1].includes(second)) this._tone(880, 0.08);
  }

  playStepEnd() {
    if (this.settings.stepEndEnabled) this._tone(440, 0.6);
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

  _updateSettings(settings) {
    this.settings = { ...this.settings, ...settings };
    this._saveSettings();
  }

  _saveSettings() {
    try {
      this.storage?.setItem(AUDIO_SETTINGS_KEY, JSON.stringify(this.settings));
    } catch {
      // The controls still work when browser storage is unavailable.
    }
  }

  _ensureAudioGraph() {
    this.context ??= new this.AudioContextClass();
    if (!this.masterGain) {
      this.masterGain = this.context.createGain();
      this.masterGain.connect(this.context.destination);
    }
    this._applyMasterVolume();
  }

  _applyMasterVolume() {
    if (!this.masterGain || !this.context) return;
    this.masterGain.gain.setValueAtTime(this.settings.volume / 100, this.context.currentTime);
  }

  _tone(frequency, duration, offset = 0) {
    if (!this.enabled || !this.AudioContextClass) return;
    this._ensureAudioGraph();
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const startAt = this.context.currentTime + offset;
    oscillator.frequency.setValueAtTime(frequency, startAt);
    gain.gain.setValueAtTime(0.28, startAt);
    gain.gain.exponentialRampToValueAtTime(0.001, startAt + duration);
    oscillator.connect(gain);
    gain.connect(this.masterGain);
    oscillator.start(startAt);
    oscillator.stop(startAt + duration);
  }
}

export { AUDIO_SETTINGS_KEY, DEFAULT_SETTINGS, LEGACY_SOUND_ENABLED_KEY };
