import { DEMO_ROUTINES } from "./routines.js";
import { TimerEngine, TIMER_STATES } from "./timer.js";

const elements = {
  routineSelect: document.querySelector("#routine-select"),
  statusBadge: document.querySelector("#status-badge"),
  progressLabel: document.querySelector("#progress-label"),
  phaseLabel: document.querySelector("#phase-label"),
  stepLabel: document.querySelector("#step-label"),
  timeDisplay: document.querySelector("#time-display"),
  roundLabel: document.querySelector("#round-label"),
  liveStatus: document.querySelector("#live-status"),
  nextLabel: document.querySelector("#next-label"),
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
  [TIMER_STATES.IDLE]: "Prêt",
  [TIMER_STATES.RUNNING]: "En cours",
  [TIMER_STATES.PAUSED]: "En pause",
  [TIMER_STATES.WAITING_MANUAL]: "Attente coach",
  [TIMER_STATES.RUNNING_TRANSITION]: "Transition",
  [TIMER_STATES.FINISHED]: "Terminée",
};

let engine;
let unsubscribe = () => {};
let lastAnnouncement = "";

function formatTime(milliseconds, countUp = false) {
  const totalSeconds = countUp
    ? Math.floor(milliseconds / 1000)
    : Math.ceil(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function describeStep(entry) {
  if (!entry) return "—";
  return `${entry.step.label} · ${formatTime(entry.step.duration * 1000)}`;
}

function render(snapshot) {
  const { state, current, next } = snapshot;
  const isIdle = state === TIMER_STATES.IDLE;
  const isFinished = state === TIMER_STATES.FINISHED;
  const isWaiting = state === TIMER_STATES.WAITING_MANUAL;
  const isTransition = state === TIMER_STATES.RUNNING_TRANSITION;
  const isPaused = state === TIMER_STATES.PAUSED;
  const pausedTransition = isPaused && snapshot.pausedState === TIMER_STATES.RUNNING_TRANSITION;

  elements.statusBadge.textContent = stateLabels[state];
  elements.statusBadge.dataset.state = state;
  elements.progressLabel.textContent = current
    ? `Étape ${snapshot.currentPosition + 1} / ${snapshot.totalSteps}`
    : `0 / ${snapshot.totalSteps}`;

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
  elements.startButton.hidden = !isIdle && !isFinished;
  elements.startButton.textContent = isFinished ? "Recommencer la séance" : "Démarrer";
  elements.pauseButton.hidden = !(
    state === TIMER_STATES.RUNNING || state === TIMER_STATES.RUNNING_TRANSITION
  );
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

function selectRoutine() {
  const routine = DEMO_ROUTINES.find(({ id }) => id === elements.routineSelect.value);
  unsubscribe();
  engine = new TimerEngine(routine);
  lastAnnouncement = "";
  unsubscribe = engine.subscribe(render);
}

DEMO_ROUTINES.forEach((routine) => {
  const option = document.createElement("option");
  option.value = routine.id;
  option.textContent = routine.name;
  elements.routineSelect.append(option);
});

elements.routineSelect.addEventListener("change", selectRoutine);
elements.startButton.addEventListener("click", () => engine.start());
elements.pauseButton.addEventListener("click", () => engine.pause());
elements.resumeButton.addEventListener("click", () => engine.resume());
elements.goButton.addEventListener("click", () => engine.go());
elements.previousButton.addEventListener("click", () => engine.previous());
elements.restartButton.addEventListener("click", () => engine.restartStep());
elements.nextButton.addEventListener("click", () => engine.next());
elements.stopButton.addEventListener("click", () => engine.stop());
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) engine.tick();
});

function update() {
  engine.tick();
  requestAnimationFrame(update);
}

selectRoutine();
requestAnimationFrame(update);
