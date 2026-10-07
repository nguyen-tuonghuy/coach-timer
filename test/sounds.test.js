import assert from "node:assert/strict";
import test from "node:test";

import {
  AUDIO_SETTINGS_KEY,
  DEFAULT_SETTINGS,
  LEGACY_SOUND_ENABLED_KEY,
  SoundPlayer,
} from "../js/sounds.js";

class FakeAudioContext {
  constructor() {
    this.currentTime = 0;
    this.destination = {};
    this.state = "running";
    this.oscillators = [];
    this.gains = [];
  }

  createOscillator() {
    const oscillator = {
      frequency: { setValueAtTime: (value) => { oscillator.frequencyValue = value; } },
      connect: () => {},
      start: (time) => { oscillator.startTime = time; },
      stop: (time) => { oscillator.stopTime = time; },
    };
    this.oscillators.push(oscillator);
    return oscillator;
  }

  createGain() {
    const gain = {
      gain: {
        values: [],
        setValueAtTime: (value, time) => { gain.gain.values.push({ value, time }); },
        exponentialRampToValueAtTime: () => {},
      },
      connect: (target) => { gain.connectedTo = target; },
    };
    this.gains.push(gain);
    return gain;
  }
}

function memoryStorage(values = new Map()) {
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    values,
  };
}

function pattern(player) {
  return player.context.oscillators.map((oscillator) => ({
    frequency: oscillator.frequencyValue,
    start: oscillator.startTime,
    duration: Number((oscillator.stopTime - oscillator.startTime).toFixed(2)),
  }));
}

test("joue trois bips de compte à rebours identiques", () => {
  const player = new SoundPlayer({ AudioContextClass: FakeAudioContext });
  player.playCountdown(3);
  player.playCountdown(2);
  player.playCountdown(1);
  assert.deepEqual(pattern(player), [
    { frequency: 880, start: 0, duration: 0.08 },
    { frequency: 880, start: 0, duration: 0.08 },
    { frequency: 880, start: 0, duration: 0.08 },
  ]);
});

test("joue un signal de fin d'intervalle unique et plus long", () => {
  const player = new SoundPlayer({ AudioContextClass: FakeAudioContext });
  player.playStepEnd();
  assert.deepEqual(pattern(player), [{ frequency: 440, start: 0, duration: 0.6 }]);
});

test("distingue le départ d'étape et la fin de séance", () => {
  const player = new SoundPlayer({ AudioContextClass: FakeAudioContext });
  player.playStepStart();
  assert.deepEqual(pattern(player), [
    { frequency: 660, start: 0, duration: 0.07 },
    { frequency: 880, start: 0.1, duration: 0.12 },
  ]);

  player.playSessionEnd();
  assert.deepEqual(pattern(player).slice(2), [
    { frequency: 523, start: 0, duration: 0.16 },
    { frequency: 659, start: 0.2, duration: 0.16 },
    { frequency: 1047, start: 0.4, duration: 0.45 },
  ]);
});

test("restaure et sauvegarde tous les réglages audio", () => {
  const storage = memoryStorage();
  const player = new SoundPlayer({ storage, AudioContextClass: FakeAudioContext });
  assert.deepEqual(player.settings, DEFAULT_SETTINGS);
  assert.equal(player.settings.volume, 90);

  player.setEnabled(false);
  player.setVolume(42);
  player.setCountdownEnabled(false);
  player.setStepEndEnabled(false);
  assert.deepEqual(JSON.parse(storage.values.get(AUDIO_SETTINGS_KEY)), {
    enabled: false,
    volume: 42,
    countdownEnabled: false,
    stepEndEnabled: false,
  });

  const restored = new SoundPlayer({ storage, AudioContextClass: FakeAudioContext });
  assert.deepEqual(restored.settings, player.settings);
});

test("migre l'ancien réglage Son activé", () => {
  const storage = memoryStorage(new Map([[LEGACY_SOUND_ENABLED_KEY, "false"]]));
  const player = new SoundPlayer({ storage, AudioContextClass: FakeAudioContext });
  assert.equal(player.enabled, false);
  assert.equal(player.settings.volume, 90);
  assert.equal(JSON.parse(storage.values.get(AUDIO_SETTINGS_KEY)).enabled, false);
});

test("applique le volume au gain maître et borne ses valeurs", () => {
  const player = new SoundPlayer({ AudioContextClass: FakeAudioContext });
  player.playCountdown(3);
  assert.equal(player.context.gains[0].gain.values.at(-1).value, 0.9);
  assert.equal(player.context.gains[1].gain.values[0].value, 0.28);
  player.setVolume(125);
  assert.equal(player.settings.volume, 100);
  assert.equal(player.context.gains[0].gain.values.at(-1).value, 1);
  player.setVolume(-2);
  assert.equal(player.settings.volume, 0);
  assert.equal(player.context.gains[0].gain.values.at(-1).value, 0);
});

test("désactive séparément compte à rebours et fin d'étape", () => {
  const player = new SoundPlayer({ AudioContextClass: FakeAudioContext });
  player.setCountdownEnabled(false);
  player.setStepEndEnabled(false);
  player.playCountdown(3);
  player.playStepEnd();
  assert.equal(player.context, null);

  player.playSessionEnd();
  assert.equal(player.context.oscillators.length, 3);
});

test("désactive tous les sons avec l'interrupteur principal", () => {
  const storage = memoryStorage();
  const player = new SoundPlayer({ storage, AudioContextClass: FakeAudioContext });
  player.setEnabled(false);
  player.playSessionEnd();
  assert.equal(player.context, null);
  assert.equal(JSON.parse(storage.values.get(AUDIO_SETTINGS_KEY)).enabled, false);
});
