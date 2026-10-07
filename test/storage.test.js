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
  setDefaultTransition,
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

test("crée une routine et son étape initiale sans transition", () => {
  const routine = createRoutine();
  assert.equal(routine.defaultTransition, null);
  assert.equal(routine.blocks.length, 1);
  assert.equal(routine.blocks[0].steps.length, 1);
  assert.equal(routine.blocks[0].steps[0].label, "Étape 1");
  assert.equal(routine.blocks[0].steps[0].duration, 30);
  assert.equal(routine.blocks[0].steps[0].transition, null);
});

test("remplit uniquement les étapes vides au premier choix du défaut", () => {
  const routine = createRoutine();
  addStep(routine.blocks[0], null);
  routine.blocks[0].steps[1].transition = { mode: "auto" };

  setDefaultTransition(routine, { mode: "manual" });

  assert.deepEqual(routine.blocks[0].steps[0].transition, { mode: "manual" });
  assert.deepEqual(routine.blocks[0].steps[1].transition, { mode: "auto" });
});

test("copie le défaut courant aux nouveaux blocs et étapes", () => {
  const transition = { mode: "delay", duration: 8 };
  const block = createBlock(transition);
  const step = addStep(block, transition);

  assert.deepEqual(block.steps[0].transition, transition);
  assert.notEqual(block.steps[0].transition, transition);
  assert.deepEqual(step.transition, transition);
  assert.notEqual(step.transition, transition);
});

test("ne modifie pas les étapes définies lorsque le défaut change", () => {
  const routine = createRoutine();
  setDefaultTransition(routine, { mode: "manual" });
  addStep(routine.blocks[0], routine.defaultTransition);
  routine.blocks[0].steps[1].transition = { mode: "auto" };

  setDefaultTransition(routine, { mode: "delay", duration: 5 });
  const next = addStep(routine.blocks[0], routine.defaultTransition);

  assert.deepEqual(routine.blocks[0].steps[0].transition, { mode: "manual" });
  assert.deepEqual(routine.blocks[0].steps[1].transition, { mode: "auto" });
  assert.deepEqual(next.transition, { mode: "delay", duration: 5 });
});

test("refuse d'enregistrer une étape sans transition", () => {
  const storage = memoryStorage();
  assert.throws(() => saveRoutines([createRoutine()], storage), /transition.mode/);
});

test("sauvegarde des transitions effectives sans défaut", () => {
  const storage = memoryStorage();
  const routine = createRoutine("Séance du soir");
  routine.blocks[0].steps[0].transition = { mode: "manual" };
  saveRoutines([routine], storage);
  const [loaded] = loadRoutines(storage);
  assert.equal(loaded.defaultTransition, null);
  assert.deepEqual(loaded.blocks[0].steps[0].transition, { mode: "manual" });
});

test("duplique une routine avec de nouveaux identifiants", () => {
  const routine = createRoutine("Circuit");
  setDefaultTransition(routine, { mode: "manual" });
  const copy = duplicateRoutine(routine);
  assert.equal(copy.name, "Circuit (copie)");
  assert.notEqual(copy.id, routine.id);
  assert.notEqual(copy.blocks[0].id, routine.blocks[0].id);
  assert.notEqual(copy.blocks[0].steps[0].id, routine.blocks[0].steps[0].id);
  assert.deepEqual(copy.blocks[0].steps[0].transition, { mode: "manual" });
});

test("migre les données v1 avec le fallback automatique historique", () => {
  const storage = memoryStorage();
  storage.setItem(STORAGE_KEY, JSON.stringify({
    version: 1,
    routines: [{
      id: "old-routine",
      name: "Ancienne",
      blocks: [{ id: "old-block", repeat: 1, steps: [{ id: "old-step", label: "Travail", duration: 5 }] }],
    }],
  }));
  const [loaded] = loadRoutines(storage);
  assert.deepEqual(loaded.defaultTransition, { mode: "auto" });
  assert.deepEqual(loaded.blocks[0].steps[0].transition, { mode: "auto" });
});

test("migre les héritages v2 vers des transitions explicites", () => {
  const storage = memoryStorage();
  storage.setItem(STORAGE_KEY, JSON.stringify({
    version: 2,
    routines: [{
      id: "inherited-routine",
      name: "Ancienne héritée",
      defaultTransition: { mode: "delay", duration: 3 },
      blocks: [{ id: "inherited-block", repeat: 1, steps: [{ id: "inherited-step", label: "Travail", duration: 5, transition: null }] }],
    }],
  }));
  const [loaded] = loadRoutines(storage);
  assert.deepEqual(loaded.defaultTransition, { mode: "delay", duration: 3 });
  assert.deepEqual(loaded.blocks[0].steps[0].transition, { mode: "delay", duration: 3 });
});

test("crée une étape vide lorsque aucun défaut n'est disponible", () => {
  const step = createStep(null, "Joueur B");
  assert.equal(step.label, "Joueur B");
  assert.equal(step.transition, null);
});
