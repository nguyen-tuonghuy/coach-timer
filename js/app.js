import { TimerEngine, TIMER_STATES } from "./timer.js";
import { SoundPlayer } from "./sounds.js";
import {
  addStep,
  createBlock,
  createRoutine,
  duplicateRoutine,
  initializeRoutines,
  saveRoutines,
} from "./storage.js";

const elements = {
  routinesScreen: document.querySelector("#routines-screen"),
  editorScreen: document.querySelector("#editor-screen"),
  playerScreen: document.querySelector("#player-screen"),
  routineList: document.querySelector("#routine-list"),
  newRoutineButton: document.querySelector("#new-routine-button"),
  editorCancelButton: document.querySelector("#editor-cancel-button"),
  routineForm: document.querySelector("#routine-form"),
  routineNameInput: document.querySelector("#routine-name-input"),
  defaultTransitionInput: document.querySelector("#default-transition-input"),
  defaultDelayField: document.querySelector("#default-delay-field"),
  defaultDelayInput: document.querySelector("#default-delay-input"),
  blocksEditor: document.querySelector("#blocks-editor"),
  addBlockButton: document.querySelector("#add-block-button"),
  editorError: document.querySelector("#editor-error"),
  soundToggleButton: document.querySelector("#sound-toggle-button"),
  backToRoutinesButton: document.querySelector("#back-to-routines-button"),
  statusBadge: document.querySelector("#status-badge"),
  progressLabel: document.querySelector("#progress-label"),
  phaseLabel: document.querySelector("#phase-label"),
  stepLabel: document.querySelector("#step-label"),
  timeDisplay: document.querySelector("#time-display"),
  roundLabel: document.querySelector("#round-label"),
  liveStatus: document.querySelector("#live-status"),
  nextLabel: document.querySelector("#next-label"),
  transitionLabel: document.querySelector("#transition-label"),
  startButton: document.querySelector("#start-button"),
  pauseButton: document.querySelector("#pause-button"),
  resumeButton: document.querySelector("#resume-button"),
  goButton: document.querySelector("#go-button"),
  sessionControls: document.querySelector("#session-controls"),
  previousButton: document.querySelector("#previous-button"),
  restartButton: document.querySelector("#restart-button"),
  nextButton: document.querySelector("#next-button"),
  stopButton: document.querySelector("#stop-button"),
};

const stateLabels = {
  [TIMER_STATES.IDLE]: "Prêt", [TIMER_STATES.RUNNING]: "En cours",
  [TIMER_STATES.PAUSED]: "En pause", [TIMER_STATES.WAITING_MANUAL]: "Attente coach",
  [TIMER_STATES.RUNNING_TRANSITION]: "Transition", [TIMER_STATES.FINISHED]: "Terminée",
};

let routines = [];
let draft = null;
let engine;
let unsubscribe = () => {};
let lastAnnouncement = "";
let previousSoundSnapshot = null;
const sounds = new SoundPlayer();

function formatTime(milliseconds, countUp = false) {
  const totalSeconds = countUp ? Math.floor(milliseconds / 1000) : Math.ceil(milliseconds / 1000);
  return `${String(Math.floor(totalSeconds / 60)).padStart(2, "0")}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

function describeStep(entry) {
  return entry ? `${entry.step.label} · ${formatTime(entry.step.duration * 1000)}` : "—";
}

function describeTransition(transition) {
  if (!transition) return "";
  if (transition.mode === "manual") return "Manuelle";
  if (transition.mode === "delay") return `Délai : ${transition.duration} s`;
  return "Automatique";
}

function showScreen(screen) {
  elements.routinesScreen.hidden = screen !== "routines";
  elements.editorScreen.hidden = screen !== "editor";
  elements.playerScreen.hidden = screen !== "player";
}

function renderSoundToggle() {
  elements.soundToggleButton.textContent = sounds.enabled ? "Son activé" : "Son désactivé";
  elements.soundToggleButton.setAttribute("aria-pressed", String(sounds.enabled));
}

function playSounds(snapshot) {
  const previous = previousSoundSnapshot;
  previousSoundSnapshot = snapshot;
  if (!sounds.enabled || !previous) return;

  if (
    previous.state === TIMER_STATES.RUNNING
    && snapshot.state === TIMER_STATES.RUNNING
    && previous.currentPosition === snapshot.currentPosition
  ) {
    const previousSecond = Math.ceil(previous.remainingMs / 1000);
    const currentSecond = Math.ceil(snapshot.remainingMs / 1000);
    [3, 2, 1].forEach((second) => {
      if (second < previousSecond && second >= currentSecond) sounds.playCountdown(second);
    });
  }

  if (previous.state === TIMER_STATES.RUNNING && snapshot.state === TIMER_STATES.FINISHED) {
    sounds.playSessionEnd();
  } else if (
    previous.state === TIMER_STATES.RUNNING
    && (snapshot.state !== TIMER_STATES.RUNNING || previous.currentPosition !== snapshot.currentPosition)
  ) {
    sounds.playStepEnd();
  }
}

function makeButton(label, action, className = "button") {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = label;
  button.dataset.action = action;
  return button;
}

function renderRoutineList() {
  elements.routineList.replaceChildren();
  if (routines.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "Aucune routine. Créez votre première séance.";
    elements.routineList.append(empty);
    return;
  }

  routines.forEach((routine) => {
    const card = document.createElement("article");
    card.className = "routine-card";
    const title = document.createElement("h2");
    title.textContent = routine.name;
    const details = document.createElement("p");
    const stepCount = routine.blocks.reduce((total, block) => total + block.steps.length, 0);
    details.textContent = `${routine.blocks.length} bloc${routine.blocks.length > 1 ? "s" : ""} · ${stepCount} étape${stepCount > 1 ? "s" : ""}`;
    const actions = document.createElement("div");
    actions.className = "routine-actions";
    actions.append(makeButton("Lancer", `play:${routine.id}`, "button button-primary"));
    actions.append(makeButton("Modifier", `edit:${routine.id}`));
    actions.append(makeButton("Dupliquer", `duplicate:${routine.id}`));
    actions.append(makeButton("Supprimer", `delete:${routine.id}`, "button button-danger"));
    card.append(title, details, actions);
    elements.routineList.append(card);
  });
}

function transitionSelect(value) {
  const select = document.createElement("select");
  select.className = "step-transition";
  select.dataset.field = "transition";
  [["", "Hérite du défaut"], ["auto", "Automatique"], ["manual", "Manuelle"], ["delay", "Délai"]].forEach(([mode, label]) => {
    const option = document.createElement("option");
    option.value = mode;
    option.textContent = label;
    option.selected = mode === value;
    select.append(option);
  });
  return select;
}

function field(labelText, input) {
  const label = document.createElement("label");
  label.className = "field";
  const labelTextElement = document.createElement("span");
  labelTextElement.textContent = labelText;
  label.append(labelTextElement, input);
  return label;
}

function renderEditor() {
  elements.routineNameInput.value = draft.name;
  elements.defaultTransitionInput.value = draft.defaultTransition?.mode ?? "";
  elements.defaultDelayInput.value = draft.defaultTransition?.duration ?? 5;
  elements.defaultDelayField.hidden = draft.defaultTransition?.mode !== "delay";
  elements.blocksEditor.replaceChildren();
  draft.blocks.forEach((block, blockIndex) => {
    const blockElement = document.createElement("section");
    blockElement.className = "block-editor";
    blockElement.dataset.blockIndex = blockIndex;
    const header = document.createElement("div");
    header.className = "block-header";
    const heading = document.createElement("h2");
    heading.textContent = `Bloc ${blockIndex + 1}`;
    const repeat = document.createElement("input");
    repeat.type = "number";
    repeat.min = "1";
    repeat.step = "1";
    repeat.value = block.repeat;
    repeat.dataset.field = "repeat";
    header.append(heading, field("Répétitions", repeat));
    if (draft.blocks.length > 1) header.append(makeButton("Supprimer le bloc", "remove-block", "button button-danger"));
    blockElement.append(header);

    block.steps.forEach((step, stepIndex) => {
      const stepElement = document.createElement("div");
      stepElement.className = "step-editor";
      stepElement.dataset.stepIndex = stepIndex;
      const label = document.createElement("input");
      label.type = "text";
      label.value = step.label;
      label.required = true;
      label.dataset.field = "label";
      const duration = document.createElement("input");
      duration.type = "number";
      duration.min = "0.1";
      duration.step = "0.1";
      duration.value = step.duration;
      duration.required = true;
      duration.dataset.field = "duration";
      const delay = document.createElement("input");
      delay.type = "number";
      delay.min = "0.1";
      delay.step = "0.1";
      delay.value = step.transition?.mode === "delay" ? step.transition.duration : 5;
      delay.dataset.field = "delay";
      const delayField = field("Durée du délai (s)", delay);
      delayField.classList.add("delay-field");
      delayField.hidden = step.transition?.mode !== "delay";
      stepElement.append(field("Étape", label), field("Durée (s)", duration), field("Transition", transitionSelect(step.transition?.mode ?? "")), delayField);
      if (block.steps.length > 1) stepElement.append(makeButton("Retirer", "remove-step", "button button-danger"));
      blockElement.append(stepElement);
    });
    blockElement.append(makeButton("Ajouter une étape", "add-step"));
    elements.blocksEditor.append(blockElement);
  });
}

function syncDraft() {
  draft.name = elements.routineNameInput.value;
  const defaultMode = elements.defaultTransitionInput.value;
  draft.defaultTransition = !defaultMode
    ? null
    : defaultMode === "delay"
      ? { mode: defaultMode, duration: Number(elements.defaultDelayInput.value) }
      : { mode: defaultMode };
  elements.blocksEditor.querySelectorAll(".block-editor").forEach((blockElement) => {
    const block = draft.blocks[Number(blockElement.dataset.blockIndex)];
    block.repeat = Number(blockElement.querySelector('[data-field="repeat"]').value);
    blockElement.querySelectorAll(".step-editor").forEach((stepElement) => {
      const step = block.steps[Number(stepElement.dataset.stepIndex)];
      step.label = stepElement.querySelector('[data-field="label"]').value;
      step.duration = Number(stepElement.querySelector('[data-field="duration"]').value);
      const mode = stepElement.querySelector('[data-field="transition"]').value;
      step.transition = !mode
        ? null
        : mode === "delay"
          ? { mode, duration: Number(stepElement.querySelector('[data-field="delay"]').value) }
          : { mode };
    });
  });
}

function openEditor(routine) {
  draft = JSON.parse(JSON.stringify(routine));
  elements.editorError.hidden = true;
  renderEditor();
  showScreen("editor");
  elements.routineNameInput.focus();
}

function saveDraft() {
  syncDraft();
  const index = routines.findIndex(({ id }) => id === draft.id);
  const next = [...routines];
  if (index === -1) next.push(draft);
  else next[index] = draft;
  routines = saveRoutines(next);
  renderRoutineList();
  showScreen("routines");
}

function startRoutine(routine) {
  unsubscribe();
  engine = new TimerEngine(routine);
  lastAnnouncement = "";
  previousSoundSnapshot = null;
  unsubscribe = engine.subscribe(render);
  showScreen("player");
}

function render(snapshot) {
  playSounds(snapshot);
  const { state, current, next } = snapshot;
  const isIdle = state === TIMER_STATES.IDLE;
  const isFinished = state === TIMER_STATES.FINISHED;
  const isWaiting = state === TIMER_STATES.WAITING_MANUAL;
  const isTransition = state === TIMER_STATES.RUNNING_TRANSITION;
  const isPaused = state === TIMER_STATES.PAUSED;
  const pausedTransition = isPaused && snapshot.pausedState === TIMER_STATES.RUNNING_TRANSITION;
  elements.statusBadge.textContent = stateLabels[state];
  elements.statusBadge.dataset.state = state;
  elements.progressLabel.textContent = current ? `Étape ${snapshot.currentPosition + 1} / ${snapshot.totalSteps}` : `0 / ${snapshot.totalSteps}`;
  if (isFinished) {
    elements.phaseLabel.textContent = "Séance terminée";
    elements.stepLabel.textContent = snapshot.routine.name;
    elements.timeDisplay.textContent = formatTime(snapshot.elapsedActiveTime);
    elements.roundLabel.textContent = "Durée chronométrée";
  } else if (isWaiting) {
    elements.phaseLabel.textContent = `${current.step.label} terminé`;
    elements.stepLabel.textContent = "Prochain départ";
    elements.timeDisplay.textContent = formatTime(snapshot.waitingElapsedMs, true);
    elements.roundLabel.textContent = "Temps d’attente";
  } else if (isTransition || pausedTransition) {
    elements.phaseLabel.textContent = "Transition chronométrée";
    elements.stepLabel.textContent = next?.step.label ?? "Fin de séance";
    elements.timeDisplay.textContent = formatTime(snapshot.remainingMs);
    elements.roundLabel.textContent = "Préparez la prochaine étape";
  } else if (current) {
    elements.phaseLabel.textContent = isPaused ? "Étape en pause" : "Étape actuelle";
    elements.stepLabel.textContent = current.step.label;
    elements.timeDisplay.textContent = formatTime(snapshot.remainingMs);
    elements.roundLabel.textContent = `Tour ${current.repeatIndex + 1} / ${current.repeatCount}`;
  } else {
    elements.phaseLabel.textContent = "Séance prête";
    elements.stepLabel.textContent = snapshot.routine.name;
    elements.timeDisplay.textContent = formatTime((snapshot.next?.step.duration ?? 0) * 1000);
    elements.roundLabel.innerHTML = "&nbsp;";
  }
  elements.nextLabel.textContent = describeStep(isIdle ? snapshot.next : next);
  elements.transitionLabel.textContent = isFinished ? "" : describeTransition(current?.step.transition ?? snapshot.next?.step.transition);
  elements.startButton.hidden = !isIdle && !isFinished;
  elements.startButton.textContent = isFinished ? "Recommencer la séance" : "Démarrer";
  elements.pauseButton.hidden = !(state === TIMER_STATES.RUNNING || state === TIMER_STATES.RUNNING_TRANSITION);
  elements.resumeButton.hidden = !isPaused;
  elements.goButton.hidden = !isWaiting;
  elements.sessionControls.hidden = isIdle;
  elements.previousButton.disabled = snapshot.currentPosition === 0;
  elements.nextButton.disabled = isFinished;
  elements.restartButton.disabled = isFinished;
  const announcement = `${stateLabels[state]}. ${current?.step.label ?? snapshot.routine.name}`;
  if (announcement !== lastAnnouncement) {
    elements.liveStatus.textContent = announcement;
    lastAnnouncement = announcement;
  }
}

elements.routineList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const [action, id] = button.dataset.action.split(":");
  const routine = routines.find((item) => item.id === id);
  if (!routine) return;
  if (action === "play") startRoutine(routine);
  if (action === "edit") openEditor(routine);
  if (action === "duplicate") {
    routines = saveRoutines([...routines, duplicateRoutine(routine)]);
    renderRoutineList();
  }
  if (action === "delete" && window.confirm(`Supprimer « ${routine.name} » ?`)) {
    routines = saveRoutines(routines.filter((item) => item.id !== id));
    renderRoutineList();
  }
});

elements.blocksEditor.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  syncDraft();
  const blockElement = button.closest(".block-editor");
  const blockIndex = Number(blockElement.dataset.blockIndex);
  const block = draft.blocks[blockIndex];
  if (button.dataset.action === "add-step") addStep(block);
  if (button.dataset.action === "remove-step") block.steps.splice(Number(button.closest(".step-editor").dataset.stepIndex), 1);
  if (button.dataset.action === "remove-block") draft.blocks.splice(blockIndex, 1);
  renderEditor();
});

elements.blocksEditor.addEventListener("change", (event) => {
  if (event.target.dataset.field === "transition") {
    event.target.closest(".step-editor").querySelector(".delay-field").hidden = event.target.value !== "delay";
  }
});
elements.defaultTransitionInput.addEventListener("change", () => {
  elements.defaultDelayField.hidden = elements.defaultTransitionInput.value !== "delay";
});
elements.newRoutineButton.addEventListener("click", () => openEditor(createRoutine()));
elements.addBlockButton.addEventListener("click", () => {
  syncDraft();
  draft.blocks.push(createBlock());
  renderEditor();
});
elements.editorCancelButton.addEventListener("click", () => { renderRoutineList(); showScreen("routines"); });
elements.routineForm.addEventListener("submit", (event) => {
  event.preventDefault();
  try {
    saveDraft();
  } catch (error) {
    elements.editorError.textContent = error.message;
    elements.editorError.hidden = false;
  }
});
elements.backToRoutinesButton.addEventListener("click", () => { engine?.stop(); renderRoutineList(); showScreen("routines"); });
elements.soundToggleButton.addEventListener("click", () => {
  sounds.setEnabled(!sounds.enabled);
  if (sounds.enabled) sounds.resume();
  renderSoundToggle();
});
elements.startButton.addEventListener("click", () => { sounds.resume(); engine.start(); });
elements.pauseButton.addEventListener("click", () => engine.pause());
elements.resumeButton.addEventListener("click", () => { sounds.resume(); engine.resume(); });
elements.goButton.addEventListener("click", () => { sounds.resume(); engine.go(); });
elements.previousButton.addEventListener("click", () => { sounds.resume(); engine.previous(); });
elements.restartButton.addEventListener("click", () => { sounds.resume(); engine.restartStep(); });
elements.nextButton.addEventListener("click", () => { sounds.resume(); engine.next(); });
elements.stopButton.addEventListener("click", () => engine.stop());
document.addEventListener("visibilitychange", () => { if (!document.hidden) engine?.tick(); });

function update() { engine?.tick(); requestAnimationFrame(update); }

routines = initializeRoutines();
renderRoutineList();
showScreen("routines");
renderSoundToggle();
requestAnimationFrame(update);
