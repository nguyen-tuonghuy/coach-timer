import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { registerServiceWorker } from "../js/pwa.js";
import { ScreenWakeLock } from "../js/wake-lock.js";

const iconAssets = [
  ["../assets/icons/icon-192.png", 192],
  ["../assets/icons/icon-512.png", 512],
  ["../assets/icons/icon-maskable-192.png", 192],
  ["../assets/icons/icon-maskable-512.png", 512],
  ["../assets/icons/apple-touch-icon.png", 180],
  ["../assets/icons/favicon-32.png", 32],
];

async function pngDimensions(path) {
  const image = await readFile(new URL(path, import.meta.url));
  assert.deepEqual([...image.subarray(1, 4)], [80, 78, 71]);
  return { width: image.readUInt32BE(16), height: image.readUInt32BE(20) };
}

test("déclare un manifest installable avec les icônes PWA", async () => {
  const manifest = JSON.parse(await readFile(new URL("../manifest.json", import.meta.url)));
  assert.equal(manifest.name, "Coach Timer");
  assert.equal(manifest.short_name, "Coach Timer");
  assert.equal(manifest.display, "standalone");
  assert.equal(manifest.start_url, "./");
  assert.equal(manifest.theme_color, "#161914");
  assert.equal(manifest.background_color, "#0d0f0c");
  assert.deepEqual(manifest.icons.map(({ src, purpose }) => [src, purpose]), [
    ["./assets/icons/icon-192.png", "any"],
    ["./assets/icons/icon-512.png", "any"],
    ["./assets/icons/icon-maskable-192.png", "maskable"],
    ["./assets/icons/icon-maskable-512.png", "maskable"],
  ]);
});

test("génère les variantes PNG aux dimensions attendues depuis l'icône source", async () => {
  assert.deepEqual(await pngDimensions("../Neon Stopwatch Play Icon.png"), { width: 1254, height: 1254 });
  for (const [path, size] of iconAssets) {
    assert.deepEqual(await pngDimensions(path), { width: size, height: size });
  }
});

test("référence les icônes avec des chemins relatifs compatibles GitHub Pages", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const serviceWorker = await readFile(new URL("../service-worker.js", import.meta.url), "utf8");
  assert.match(html, /href="\.\/assets\/icons\/favicon\.ico"/);
  assert.match(html, /href="\.\/assets\/icons\/apple-touch-icon\.png"/);
  for (const [path] of iconAssets) {
    const relativePath = `./${path.slice(3)}`;
    assert.match(serviceWorker, new RegExp(`"${relativePath.replaceAll(".", "\\.")}"`));
  }
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
