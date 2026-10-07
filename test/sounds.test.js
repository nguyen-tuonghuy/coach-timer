import assert from "node:assert/strict";
import test from "node:test";

import { SoundPlayer } from "../js/sounds.js";

class FakeAudioContext {
  constructor() {
    this.currentTime = 0;
    this.destination = {};
    this.state = "running";
    this.oscillators = [];
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
    return {
      gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
      connect: () => {},
    };
  }
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

test("désactive les sons et mémorise le réglage", () => {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const player = new SoundPlayer({ storage, AudioContextClass: FakeAudioContext });
  player.setEnabled(false);
  player.playCountdown(3);
  assert.equal(player.context, null);
  assert.equal(values.get("coach-timer.sound-enabled"), "false");
});
