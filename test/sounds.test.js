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
      frequency: { setValueAtTime: () => {} },
      connect: () => {},
      start: () => {},
      stop: () => {},
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

test("joue des séquences distinctes pour la fin d'étape et de séance", () => {
  const player = new SoundPlayer({ AudioContextClass: FakeAudioContext });
  player.playCountdown(3);
  assert.equal(player.context.oscillators.length, 1);
  player.playStepEnd();
  assert.equal(player.context.oscillators.length, 3);
  player.playSessionEnd();
  assert.equal(player.context.oscillators.length, 6);
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
