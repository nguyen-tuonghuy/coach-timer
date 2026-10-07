import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { registerServiceWorker } from "../js/pwa.js";
import { ScreenWakeLock } from "../js/wake-lock.js";

test("déclare un manifest installable avec une icône", async () => {
  const manifest = JSON.parse(await readFile(new URL("../manifest.json", import.meta.url)));
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, "./");
  assert.equal(manifest.icons[0].src, "icon.svg");
});

test("enregistre le service worker lorsque l'API est disponible", async () => {
  const calls = [];
  const registration = await registerServiceWorker({
    serviceWorker: { register: (path) => { calls.push(path); return Promise.resolve({ scope: "/" }); } },
  });
  assert.deepEqual(calls, ["./service-worker.js"]);
  assert.deepEqual(registration, { scope: "/" });
});

test("ne tente pas d'enregistrer le service worker sans support", async () => {
  assert.equal(await registerServiceWorker({}), null);
});

test("acquiert, relâche et récupère le Wake Lock", async () => {
  let releaseListener;
  let released = 0;
  let requests = 0;
  const createSentinel = () => ({
    addEventListener: (_, listener) => { releaseListener = listener; },
    release: async () => { released += 1; },
  });
  const lock = new ScreenWakeLock({
    navigatorObject: { wakeLock: { request: async () => { requests += 1; return createSentinel(); } } },
  });

  await lock.acquire();
  assert.equal(requests, 1);
  releaseListener();
  await lock.acquire();
  assert.equal(requests, 2);
  await lock.release();
  assert.equal(released, 1);
});

test("ne duplique pas les demandes Wake Lock en attente", async () => {
  let resolveRequest;
  let requests = 0;
  const sentinel = { addEventListener: () => {}, release: async () => {} };
  const lock = new ScreenWakeLock({
    navigatorObject: {
      wakeLock: {
        request: () => {
          requests += 1;
          return new Promise((resolve) => { resolveRequest = resolve; });
        },
      },
    },
  });

  const first = lock.acquire();
  const second = lock.acquire();
  assert.equal(requests, 1);
  resolveRequest(sentinel);
  await Promise.all([first, second]);
  assert.equal(lock.sentinel, sentinel);
});
