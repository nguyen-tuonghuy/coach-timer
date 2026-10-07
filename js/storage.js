import { DEMO_ROUTINES, normalizeRoutine } from "./routines.js";

const STORAGE_KEY = "coach-timer.routines";
const STORAGE_VERSION = 2;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function getStorage(storage) {
  if (storage) return storage;
  if (typeof window !== "undefined") return window.localStorage;
  throw new Error("Le stockage local n'est pas disponible.");
}

function migrateRoutine(routine) {
  return {
    ...routine,
    defaultTransition: routine.defaultTransition ?? { mode: "auto" },
    blocks: (routine.blocks ?? []).map((block) => ({
      ...block,
      steps: (block.steps ?? []).map((step) =>
        step.transition === undefined ? { ...step, transition: null } : step,
      ),
    })),
  };
}

function parseRoutines(serialized) {
  if (!serialized) return null;

  try {
    const data = JSON.parse(serialized);
    if (!Array.isArray(data?.routines) || ![1, STORAGE_VERSION].includes(data.version)) return [];
    const source = data.version === 1 ? data.routines.map(migrateRoutine) : data.routines;
    return source.map(normalizeRoutine);
  } catch {
    return [];
  }
}

function makeId(prefix) {
  if (globalThis.crypto?.randomUUID) return `${prefix}-${globalThis.crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function loadRoutines(storage) {
  const routines = parseRoutines(getStorage(storage).getItem(STORAGE_KEY));
  return routines ? clone(routines) : [];
}

export function saveRoutines(routines, storage) {
  if (!Array.isArray(routines)) throw new TypeError("Les routines doivent être une liste.");

  const normalized = routines.map(normalizeRoutine);
  const ids = new Set();
  normalized.forEach((routine) => {
    if (ids.has(routine.id)) throw new TypeError("Chaque routine doit avoir un identifiant unique.");
    ids.add(routine.id);
  });
  getStorage(storage).setItem(STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, routines: normalized }));
  return clone(normalized);
}

export function initializeRoutines(storage) {
  const target = getStorage(storage);
  const stored = parseRoutines(target.getItem(STORAGE_KEY));
  if (stored !== null) return clone(stored);
  return saveRoutines(DEMO_ROUTINES, target);
}

export function createStep(label = "Étape 1") {
  return {
    id: makeId("step"),
    label,
    duration: 30,
    type: "work",
    transition: null,
  };
}

export function createBlock() {
  return {
    id: makeId("block"),
    repeat: 1,
    steps: [createStep()],
  };
}

export function addStep(block) {
  const step = createStep(`Étape ${block.steps.length + 1}`);
  block.steps.push(step);
  return step;
}

export function createRoutine(name = "Nouvelle routine") {
  return {
    id: makeId("routine"),
    name,
    defaultTransition: null,
    blocks: [createBlock()],
  };
}

export function duplicateRoutine(routine) {
  const copy = clone(normalizeRoutine(routine));
  copy.id = makeId("routine");
  copy.name = `${copy.name} (copie)`;
  copy.blocks.forEach((block) => {
    block.id = makeId("block");
    block.steps.forEach((step) => {
      step.id = makeId("step");
    });
  });
  return copy;
}

export function routineId(prefix) {
  return makeId(prefix);
}

export { STORAGE_KEY };
