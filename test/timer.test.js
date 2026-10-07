import assert from "node:assert/strict";
import test from "node:test";

import { TimerEngine, TIMER_STATES } from "../js/timer.js";

function routine(steps, repeat = 1) {
  return {
    id: "test-routine",
    name: "Test",
    blocks: [{ id: "test-block", repeat, steps }],
  };
}

function step(id, duration, transition = { mode: "auto" }) {
  return { id, label: id, duration, transition };
}

test("enchaîne immédiatement les étapes automatiques", () => {
  const timer = new TimerEngine(routine([step("A", 5), step("B", 5)]));

  timer.start(0);
  const snapshot = timer.tick(5_000);

  assert.equal(snapshot.state, TIMER_STATES.RUNNING);
  assert.equal(snapshot.current.step.id, "B");
  assert.equal(snapshot.remainingMs, 5_000);
});

test("refuse les étapes qui n'ont pas de transition effective", () => {
  const data = routine([
    { id: "A", label: "A", duration: 5 },
    { id: "B", label: "B", duration: 5 },
  ]);
  data.defaultTransition = { mode: "manual" };
  assert.throws(() => new TimerEngine(data), /transition.mode/);
});

test("attend GO lors d'une transition manuelle", () => {
  const timer = new TimerEngine(
    routine([step("A", 5, { mode: "manual" }), step("B", 5)]),
  );

  timer.start(0);
  assert.equal(timer.tick(60_000).state, TIMER_STATES.WAITING_MANUAL);
  assert.equal(timer.getSnapshot(600_000).current.step.id, "A");
  assert.equal(timer.go(600_000).current.step.id, "B");
});

test("exécute une transition temporisée avant l'étape suivante", () => {
  const timer = new TimerEngine(
    routine([step("A", 5, { mode: "delay", duration: 3 }), step("B", 5)]),
  );

  timer.start(0);
  assert.equal(timer.tick(5_000).state, TIMER_STATES.RUNNING_TRANSITION);
  assert.equal(timer.tick(7_000).remainingMs, 1_000);
  assert.equal(timer.tick(8_000).current.step.id, "B");
});

test("fige le temps restant pendant une pause", () => {
  const timer = new TimerEngine(routine([step("A", 20)]));

  timer.start(0);
  assert.equal(timer.pause(5_000).remainingMs, 15_000);
  assert.equal(timer.tick(50_000).remainingMs, 15_000);
  assert.equal(timer.resume(50_000).remainingMs, 15_000);
  assert.equal(timer.tick(65_000).state, TIMER_STATES.FINISHED);
});

test("rattrape plusieurs étapes automatiques après un passage en arrière-plan", () => {
  const timer = new TimerEngine(
    routine([step("A", 10), step("B", 10), step("C", 10)]),
  );

  timer.start(0);
  const snapshot = timer.tick(25_000);

  assert.equal(snapshot.current.step.id, "C");
  assert.equal(snapshot.remainingMs, 5_000);
});

test("ne franchit jamais une transition manuelle en arrière-plan", () => {
  const timer = new TimerEngine(
    routine([step("A", 5, { mode: "manual" }), step("B", 5)]),
  );

  timer.start(0);
  const snapshot = timer.tick(600_000);

  assert.equal(snapshot.state, TIMER_STATES.WAITING_MANUAL);
  assert.equal(snapshot.current.step.id, "A");
});

test("déroule toutes les répétitions d'un bloc dans l'ordre", () => {
  const timer = new TimerEngine(routine([step("A", 2), step("B", 2)], 3));
  const visited = [];

  timer.start(0);
  for (let timestamp = 0; timestamp <= 12_000; timestamp += 2_000) {
    const snapshot = timer.tick(timestamp);
    if (snapshot.current) visited.push(snapshot.current.step.id);
  }

  assert.deepEqual(visited.slice(0, 6), ["A", "B", "A", "B", "A", "B"]);
  assert.equal(timer.getSnapshot(12_000).state, TIMER_STATES.FINISHED);
});

test("permet suivant, précédent et recommencer sans appliquer de transition", () => {
  const timer = new TimerEngine(routine([step("A", 10), step("B", 10)]));

  timer.start(0);
  assert.equal(timer.next(1_000).current.step.id, "B");
  assert.equal(timer.previous(2_000).current.step.id, "A");
  assert.equal(timer.restartStep(5_000).remainingMs, 10_000);
});
