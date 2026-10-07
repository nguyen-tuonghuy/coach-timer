import assert from "node:assert/strict";
import test from "node:test";

class FakeElement {
  constructor(tagName = "div") {
    this.tagName = tagName;
    this.dataset = {};
    this.disabled = false;
    this.hidden = false;
    this.listeners = new Map();
    this.textContent = "";
    this.children = [];
    this.classList = { add: () => {} };
    this._value = null;
  }

  get value() {
    if (this._value !== null) return this._value;
    const selected = this.children.find((child) => child.selected);
    return selected?.value ?? "";
  }

  set value(value) {
    this._value = value;
  }

  set innerHTML(value) {
    this.textContent = value;
  }

  append(...options) {
    options.forEach((option) => {
      option.parentElement = this;
      this.children.push(option);
    });
  }

  appendChild(child) {
    this.append(child);
    return child;
  }

  replaceChildren(...children) {
    this.children = children;
  }

  focus() {}

  setAttribute(name, value) {
    this[name] = value;
  }

  closest(selector) {
    if (selector === "button[data-action]" && this.tagName === "button" && this.dataset.action) {
      return this;
    }
    return this.parentElement?.closest(selector) ?? null;
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  click() {
    this.listeners.get("click")?.();
  }
}

test("affiche la transition courante avant et pendant une séance", async () => {
  const selectors = [
    "routines-screen",
    "editor-screen",
    "player-screen",
    "routine-list",
    "new-routine-button",
    "editor-cancel-button",
    "routine-form",
    "routine-name-input",
    "default-transition-input",
    "default-delay-field",
    "default-delay-input",
    "blocks-editor",
    "add-block-button",
    "editor-error",
    "audio-settings",
    "audio-settings-button",
    "audio-settings-panel",
    "audio-enabled-input",
    "audio-volume-input",
    "audio-volume-value",
    "audio-countdown-input",
    "audio-step-end-input",
    "back-to-routines-button",
    "status-badge",
    "progress-label",
    "phase-label",
    "step-label",
    "time-display",
    "round-label",
    "live-status",
    "next-label",
    "transition-label",
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
    createElement: (tagName) => new FakeElement(tagName),
    addEventListener: () => {},
  };
  const values = new Map();
  globalThis.window = {
    localStorage: {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    },
  };
  globalThis.requestAnimationFrame = () => 1;

  await import(`../js/app.js?test=${Date.now()}`);
  assert.equal(elements.get("#routines-screen").hidden, false);
  assert.equal(elements.get("#routine-list").children.length, 3);
  assert.equal(elements.get("#audio-settings-panel").hidden, true);
  assert.equal(elements.get("#audio-settings-button")["aria-expanded"], "false");
  elements.get("#audio-settings-button").click();
  assert.equal(elements.get("#audio-settings-panel").hidden, false);
  assert.equal(elements.get("#audio-settings-button")["aria-expanded"], "true");
  elements.get("#audio-volume-input").value = "35";
  elements.get("#audio-volume-input").listeners.get("input")();
  assert.equal(elements.get("#audio-volume-value").textContent, "35 %");
  elements.get("#audio-enabled-input").checked = false;
  elements.get("#audio-enabled-input").listeners.get("change")();
  assert.equal(JSON.parse(values.get("coach-timer.audio-settings")).enabled, false);
  const list = elements.get("#routine-list");
  const launch = (index) => list.children[index].children[2].children[0];
  const clickListButton = (button) => list.listeners.get("click")({ target: button });

  clickListButton(launch(0));
  assert.equal(elements.get("#transition-label").textContent, "Automatique");
  elements.get("#start-button").click();
  assert.equal(elements.get("#transition-label").textContent, "Automatique");
  clickListButton(launch(1));
  assert.equal(elements.get("#transition-label").textContent, "Manuelle");
  clickListButton(launch(2));
  assert.equal(elements.get("#transition-label").textContent, "Délai : 3 s");

  elements.get("#new-routine-button").click();
  assert.equal(elements.get("#editor-screen").hidden, false);
  assert.equal(elements.get("#default-transition-input").value, "");
  const initialBlock = elements.get("#blocks-editor").children[0];
  const initialStep = initialBlock.children[1];
  assert.equal(initialStep.children[0].children[1].value, "Étape 1");
  assert.equal(initialStep.children[1].children[1].value, 30);
  const initialTransition = initialStep.children[2].children[1];
  assert.equal(initialTransition.value, "");
  assert.equal(initialTransition.children[0].textContent, "Choisir…");

  delete globalThis.document;
  delete globalThis.window;
  delete globalThis.requestAnimationFrame;
});
