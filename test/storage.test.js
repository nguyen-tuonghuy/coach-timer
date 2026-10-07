import assert from "node:assert/strict";
import test from "node:test";

import {
  STORAGE_KEY,
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

test("sauvegarde et recharge une routine en conservant les héritages", () => {
  const storage = memoryStorage();
  const routine = createRoutine("Séance du soir");
  routine.defaultTransition = { mode: "manual" };
  saveRoutines([routine], storage);
  const loaded = loadRoutines(storage);
  assert.equal(loaded[0].name, "Séance du soir");
  assert.deepEqual(loaded[0].defaultTransition, { mode: "manual" });
  assert.equal(loaded[0].blocks[0].steps[0].transition, null);
});

test("crée une routine sans imposer de transition", () => {
  const routine = createRoutine();
  assert.equal(routine.defaultTransition, null);
  assert.equal(routine.blocks.length, 1);
  assert.equal(routine.blocks[0].steps.length, 1);
  assert.equal(routine.blocks[0].steps[0].label, "Étape 1");
  assert.equal(routine.blocks[0].steps[0].duration, 30);
  assert.equal(routine.blocks[0].steps[0].transition, null);
});

test("crée un bloc et ajoute des étapes en héritage", () => {
  const block = createBlock();
  assert.equal(block.repeat, 1);
  assert.equal(block.steps[0].transition, null);
  const step = addStep(block);
  assert.equal(step.label, "Étape 2");
  assert.equal(step.transition, null);
});

test("crée une étape surchargeable avec une transition explicite", () => {
  const step = createStep("Joueur B");
  step.transition = { mode: "manual" };
  assert.equal(step.label, "Joueur B");
  assert.equal(step.duration, 30);
  assert.deepEqual(step.transition, { mode: "manual" });
});

test("refuse d'enregistrer un héritage non résoluble", () => {
  const storage = memoryStorage();
  assert.throws(() => saveRoutines([createRoutine()], storage), /Transition manquante/);
});

test("conserve une transition par défaut temporisée pour les étapes héritées", () => {
  const storage = memoryStorage();
  const routine = createRoutine();
  routine.defaultTransition = { mode: "delay", duration: 8 };
  saveRoutines([routine], storage);
  const loaded = loadRoutines(storage)[0];
  assert.deepEqual(loaded.defaultTransition, { mode: "delay", duration: 8 });
  assert.equal(loaded.blocks[0].steps[0].transition, null);
});

test("duplique une routine avec de nouveaux identifiants", () => {
  const routine = createRoutine("Circuit");
  routine.defaultTransition = { mode: "manual" };
  const copy = duplicateRoutine(routine);
  assert.equal(copy.name, "Circuit (copie)");
  assert.notEqual(copy.id, routine.id);
  assert.notEqual(copy.blocks[0].id, routine.blocks[0].id);
  assert.notEqual(copy.blocks[0].steps[0].id, routine.blocks[0].steps[0].id);
  assert.equal(copy.blocks[0].steps[0].transition, null);
});

test("migre les anciennes données vers une transition automatique", () => {
  const storage = memoryStorage();
  storage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      version: 1,
      routines: [{
        id: "old-routine",
        name: "Ancienne",
        blocks: [{
          id: "old-block",
          repeat: 1,
          steps: [
            { id: "old-step-1", label: "Travail", duration: 5 },
            { id: "old-step-2", label: "Repos", duration: 5, transition: { mode: "manual" } },
          ],
        }],
      }],
    }),
  );
  const [loaded] = loadRoutines(storage);
  assert.deepEqual(loaded.defaultTransition, { mode: "auto" });
  assert.equal(loaded.blocks[0].steps[0].transition, null);
  assert.deepEqual(loaded.blocks[0].steps[1].transition, { mode: "manual" });
});