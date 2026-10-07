export const TRANSITION_MODES = Object.freeze({
  AUTO: "auto",
  MANUAL: "manual",
  DELAY: "delay",
});

function requireText(value, path) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${path} doit être une chaîne non vide.`);
  }

  return value.trim();
}

function requireDuration(value, path) {
  if (!Number.isFinite(value) || value <= 0) {
    throw new TypeError(`${path} doit être un nombre strictement positif.`);
  }

  return value;
}

function normalizeTransition(transition, path) {
  if (!transition || !Object.values(TRANSITION_MODES).includes(transition.mode)) {
    throw new TypeError(`${path}.mode doit valoir auto, manual ou delay.`);
  }

  if (transition.mode === TRANSITION_MODES.DELAY) {
    return {
      mode: transition.mode,
      duration: requireDuration(transition.duration, `${path}.duration`),
    };
  }

  return { mode: transition.mode };
}

export function normalizeRoutine(routine) {
  if (!routine || typeof routine !== "object") {
    throw new TypeError("La routine doit être un objet.");
  }

  if (!Array.isArray(routine.blocks) || routine.blocks.length === 0) {
    throw new TypeError("routine.blocks doit contenir au moins un bloc.");
  }

  const ids = new Set();
  const useId = (id, path) => {
    const normalizedId = requireText(id, path);
    if (ids.has(normalizedId)) {
      throw new TypeError(`${path} doit être unique.`);
    }
    ids.add(normalizedId);
    return normalizedId;
  };

  const defaultTransition = normalizeTransition(
    routine.defaultTransition ?? { mode: TRANSITION_MODES.AUTO },
    "routine.defaultTransition",
  );
  const normalized = {
    id: useId(routine.id, "routine.id"),
    name: requireText(routine.name, "routine.name"),
    defaultTransition,
    blocks: routine.blocks.map((block, blockIndex) => {
      const path = `routine.blocks[${blockIndex}]`;
      if (!block || typeof block !== "object") {
        throw new TypeError(`${path} doit être un objet.`);
      }
      if (!Number.isInteger(block.repeat) || block.repeat < 1) {
        throw new TypeError(`${path}.repeat doit être un entier supérieur ou égal à 1.`);
      }
      if (!Array.isArray(block.steps) || block.steps.length === 0) {
        throw new TypeError(`${path}.steps doit contenir au moins une étape.`);
      }

      return {
        id: useId(block.id, `${path}.id`),
        repeat: block.repeat,
        steps: block.steps.map((step, stepIndex) => {
          const stepPath = `${path}.steps[${stepIndex}]`;
          if (!step || typeof step !== "object") {
            throw new TypeError(`${stepPath} doit être un objet.`);
          }

          return {
            id: useId(step.id, `${stepPath}.id`),
            label: requireText(step.label, `${stepPath}.label`),
            duration: requireDuration(step.duration, `${stepPath}.duration`),
            type: step.type == null ? "other" : requireText(step.type, `${stepPath}.type`),
            transition: normalizeTransition(
              step.transition ?? defaultTransition,
              `${stepPath}.transition`,
            ),
          };
        }),
      };
    }),
  };

  return normalized;
}

export function expandRoutine(routine) {
  const normalized = normalizeRoutine(routine);
  const timeline = [];

  normalized.blocks.forEach((block, blockIndex) => {
    for (let repeatIndex = 0; repeatIndex < block.repeat; repeatIndex += 1) {
      block.steps.forEach((step, stepIndex) => {
        timeline.push({
          blockIndex,
          blockId: block.id,
          repeatIndex,
          repeatCount: block.repeat,
          stepIndex,
          step,
        });
      });
    }
  });

  return { routine: normalized, timeline };
}

export const DEMO_ROUTINES = Object.freeze([
  {
    id: "demo-auto",
    name: "Automatique · 5/5 × 2",
    defaultTransition: { mode: "auto" },
    blocks: [
      {
        id: "auto-block",
        repeat: 2,
        steps: [
          { id: "auto-work", label: "Travail", duration: 5, type: "work" },
          { id: "auto-rest", label: "Repos", duration: 5, type: "rest" },
        ],
      },
    ],
  },
  {
    id: "demo-manual",
    name: "Coach · 5/5 × 2",
    defaultTransition: { mode: "manual" },
    blocks: [
      {
        id: "manual-block",
        repeat: 2,
        steps: [
          { id: "player-a", label: "Joueur A", duration: 5, type: "work" },
          { id: "player-b", label: "Joueur B", duration: 5, type: "work" },
        ],
      },
    ],
  },
  {
    id: "demo-delay",
    name: "Ateliers · délai 3 s",
    defaultTransition: { mode: "auto" },
    blocks: [
      {
        id: "delay-block",
        repeat: 1,
        steps: [
          {
            id: "workshop-a",
            label: "Atelier A",
            duration: 5,
            type: "work",
            transition: { mode: "delay", duration: 3 },
          },
          { id: "workshop-b", label: "Atelier B", duration: 5, type: "work" },
        ],
      },
    ],
  },
]);
