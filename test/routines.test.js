import assert from "node:assert/strict";
import test from "node:test";

import { TimerEngine, TIMER_STATES } from "../js/timer.js";
import { expandRoutine, normalizeRoutine, resolveStepTransition } from "../js/routines.js";
import { addStep, createBlock, createRoutine } from "../js/storage.js";

test("fait suivre immédiatement les étapes héritées quand le défaut change", () => {
  const routine = createRoutine();
  const step = routine.blocks[0].steps[0];
  assert.equal(step.transition, null);

  routine.defaultTransition = { mode: "manual" };
  assert.deepEqual(resolveStepTransition(routine, step), { mode: "manual" });

  routine.defaultTransition = { mode: "auto" };
  assert.deepEqual(resolveStepTransition(routine, step), { mode: "auto" });
});

test("conserve une surcharge explicite malgré le changement du défaut", () => {
  const routine = createRoutine();
  const step = routine.blocks[0].steps[0];
  step.transition = { mode: "delay", duration: 4 };
  routine.defaultTransition = { mode: "manual" };
  assert.deepEqual(resolveStepTransition(routine, step), { mode: "delay", duration: 4 });
});

test("résout un héritage temporisé avec sa durée lors de l'expansion", () => {
  const routine = createRoutine();
  routine.defaultTransition = { mode: "delay", duration: 8 };
  const { timeline } = expandRoutine(routine);
  assert.deepEqual(timeline[0].step.transition, { mode: "delay", duration: 8 });
});

test("mélange étapes héritées et surchargées dans la même séance", () => {
  const routine = createRoutine();
  routine.defaultTransition = { mode: "manual" };
  routine.blocks[0].steps[0].transition = null;
  addStep(routine.blocks[0]);
  routine.blocks[0].steps[1].transition = { mode: "auto" };
  addStep(routine.blocks[0]);
  routine.blocks[0].steps[2].transition = { mode: "delay", duration: 3 };

  const timer = new TimerEngine(routine);
  timer.start(0);
  assert.equal(timer.getSnapshot(0).current.step.transition.mode, "manual");
  assert.equal(timer.next(0).current.step.transition.mode, "auto");
  assert.deepEqual(timer.next(0).current.step.transition, { mode: "delay", duration: 3 });
  assert.equal(timer.next(0).state, TIMER_STATES.FINISHED);
});

test("refuse le lancement d'une routine dont un héritage est non résoluble", () => {
  assert.throws(() => new TimerEngine(createRoutine()), /Transition manquante/);
});

test("accepte une routine sans défaut lorsque toutes les étapes sont explicites", () => {
  const routine = createRoutine();
  routine.blocks[0].steps[0].transition = { mode: "auto" };
  assert.equal(normalizeRoutine(routine).defaultTransition, null);
  const timer = new TimerEngine(routine);
  timer.start(0);
  assert.equal(timer.getSnapshot(0).state, TIMER_STATES.RUNNING);
});