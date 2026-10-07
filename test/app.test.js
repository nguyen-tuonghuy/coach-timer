import assert from "node:assert/strict";
import test from "node:test";

class FakeElement {
  constructor() {
    this.dataset = {};
    this.disabled = false;
    this.hidden = false;
    this.listeners = new Map();
    this.textContent = "";
    this.value = "";
  }

  set innerHTML(value) {
    this.textContent = value;
  }

  append(option) {
    if (!this.value) this.value = option.value;
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  click() {
    this.listeners.get("click")?.();
  }
}

test("le bouton Démarrer actualise immédiatement l'interface", async () => {
  const selectors = [
    "routine-select",
    "status-badge",
    "progress-label",
    "phase-label",
    "step-label",
    "time-display",
    "round-label",
    "live-status",
    "next-label",
    "start-button",
    "pause-button",
    "resume-button",
    "go-button",
    "session-controls",
    "previous-button",
    "restart-button",
    "next-button",
    "stop-button",
  ];
  const elements = new Map(selectors.map((id) => [`#${id}`, new FakeElement()]));

  globalThis.document = {
    hidden: false,
    querySelector: (selector) => elements.get(selector),
    createElement: () => new FakeElement(),
    addEventListener: () => {},
  };
  globalThis.requestAnimationFrame = () => 1;

  await import(`../js/app.js?test=${Date.now()}`);
  elements.get("#start-button").click();

  assert.equal(elements.get("#status-badge").textContent, "En cours");
  assert.equal(elements.get("#step-label").textContent, "Travail");
  assert.equal(elements.get("#time-display").textContent, "00:05");
  assert.equal(elements.get("#start-button").hidden, true);
  assert.equal(elements.get("#pause-button").hidden, false);

  delete globalThis.document;
  delete globalThis.requestAnimationFrame;
});
