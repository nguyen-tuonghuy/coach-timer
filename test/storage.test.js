import assert from "node:assert/strict";
import test from "node:test";

import {
  addStep,
  createBlock,
  createRoutine,
  createStep,
  duplicateRoutine,
  initializeRoutines,
  loadRoutines,
  saveRoutines,
} from "../js/storage.js";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
}

test("initialise les routines de démonstration une seule fois", () => {
  const storage = memoryStorage();
  assert.equal(initializeRoutines(storage).length, 3);
  saveRoutines([], storage);
  assert.deepEqual(initializeRoutines(storage), []);
});

test("sauvegarde et recharge une routine validée", () => {
  const storage = memoryStorage();
  const routine = createRoutine("Séance du soir");
  saveRoutines([routine], storage);
  const loaded = loadRoutines(storage);
  assert.equal(loaded[0].name, "Séance du soir");
  assert.equal(loaded[0].blocks[0].steps[0].duration, 30);
});

test("crée une routine manuelle avec son bloc et son étape initiaux", () => {
  const routine = createRoutine();
  assert.deepEqual(routine.defaultTransition, { mode: "manual" });
  assert.equal(routine.blocks.length, 1);
  assert.equal(routine.blocks[0].steps.length, 1);
  assert.equal(routine.blocks[0].steps[0].label, "Étape 1");
  assert.equal(routine.blocks[0].steps[0].duration, 30);
  assert.deepEqual(routine.blocks[0].steps[0].transition, routine.defaultTransition);
  assert.notEqual(routine.blocks[0].steps[0].transition, routine.defaultTransition);
});

test("crée un bloc initial depuis la transition fournie", () => {
  const transition = { mode: "delay", duration: 8 };
  const block = createBlock(transition);
  assert.equal(block.repeat, 1);
  assert.deepEqual(block.steps[0].transition, transition);
  assert.notEqual(block.steps[0].transition, transition);
});

test("crée une étape depuis la transition fournie", () => {
  const transition = { mode: "manual" };
  const step = createStep(transition, "Joueur B");
  assert.equal(step.label, "Joueur B");
  assert.equal(step.duration, 30);
  assert.deepEqual(step.transition, transition);
  assert.notEqual(step.transition, transition);
});

test("ajoute une étape depuis la transition par défaut courante", () => {
  const transition = { mode: "delay", duration: 12 };
  const block = createBlock({ mode: "manual" });
  const step = addStep(block, transition);
  assert.equal(step.label, "Étape 2");
  assert.deepEqual(step.transition, transition);
  assert.notEqual(step.transition, transition);
});

test("duplique une routine avec de nouveaux identifiants", () => {
  const routine = createRoutine("Circuit");
  const copy = duplicateRoutine(routine);
  assert.equal(copy.name, "Circuit (copie)");
  assert.notEqual(copy.id, routine.id);
  assert.notEqual(copy.blocks[0].id, routine.blocks[0].id);
  assert.notEqual(copy.blocks[0].steps[0].id, routine.blocks[0].steps[0].id);
});

test("conserve une transition par défaut temporisée", () => {
  const storage = memoryStorage();
  const routine = createRoutine("Nouvelle routine", { mode: "delay", duration: 8 });
  saveRoutines([routine], storage);
  assert.deepEqual(loadRoutines(storage)[0].defaultTransition, { mode: "delay", duration: 8 });
  assert.deepEqual(loadRoutines(storage)[0].blocks[0].steps[0].transition, { mode: "delay", duration: 8 });
});
