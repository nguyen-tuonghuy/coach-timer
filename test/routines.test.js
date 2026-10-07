import assert from "node:assert/strict";
import test from "node:test";

import { TimerEngine, TIMER_STATES } from "../js/timer.js";
import { expandRoutine, normalizeRoutine } from "../js/routines.js";
import { addStep, createRoutine, setDefaultTransition } from "../js/storage.js";

test("conserve les transitions effectives à l'expansion", () => {
  const routine = createRoutine();
  setDefaultTransition(routine, { mode: "manual" });
  addStep(routine.blocks[0], routine.defaultTransition);
  routine.blocks[0].steps[1].transition = { mode: "auto" };
  addStep(routine.blocks[0], routine.defaultTransition);

  const { timeline } = expandRoutine(routine);
  assert.deepEqual(timeline.map(({ step }) => step.transition), [
    { mode: "manual" },
    { mode: "auto" },
    { mode: "manual" },
  ]);
});

test("conserve la durée d'un délai copié", () => {
  const routine = createRoutine();
  setDefaultTransition(routine, { mode: "delay", duration: 8 });
  addStep(routine.blocks[0], routine.defaultTransition);

  const normalized = normalizeRoutine(routine);
  assert.deepEqual(normalized.blocks[0].steps[0].transition, { mode: "delay", duration: 8 });
  assert.deepEqual(normalized.blocks[0].steps[1].transition, { mode: "delay", duration: 8 });
});

test("refuse le lancement d'une routine contenant une étape vide", () => {
  assert.throws(() => new TimerEngine(createRoutine()), /transition.mode/);
});

test("accepte une routine sans défaut lorsque toutes les étapes sont explicites", () => {
  const routine = createRoutine();
  routine.blocks[0].steps[0].transition = { mode: "auto" };
  assert.equal(normalizeRoutine(routine).defaultTransition, null);
  const timer = new TimerEngine(routine);
  timer.start(0);
  assert.equal(timer.getSnapshot(0).state, TIMER_STATES.RUNNING);
});
