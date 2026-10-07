import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { registerServiceWorker } from "../js/pwa.js";
import { ACTIVE_STATES, ScreenWakeLock } from "../js/wake-lock.js";

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
  assert.equal(manifest.id, "./");
  assert.equal(manifest.start_url, "./");
  assert.equal(manifest.scope, "./");
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
  assert.match(serviceWorker, /const CACHE_NAME = "coach-timer-v4"/);
  assert.match(html, /href="\.\/assets\/icons\/favicon\.ico"/);
  assert.match(html, /href="\.\/assets\/icons\/apple-touch-icon\.png"/);
  for (const [path] of iconAssets) {
    const relativePath = `./${path.slice(3)}`;
    assert.match(serviceWorker, new RegExp(`"${relativePath.replaceAll(".", "\\.")}"`));
  }
});

test("déclare les métadonnées iOS et les safe areas pour le mode autonome", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const css = await readFile(new URL("../css/style.css", import.meta.url), "utf8");
  assert.match(html, /viewport-fit=cover/);
  assert.match(html, /name="apple-mobile-web-app-capable" content="yes"/);
  assert.match(html, /name="apple-mobile-web-app-status-bar-style" content="black-translucent"/);
  assert.match(html, /name="apple-mobile-web-app-title" content="Coach Timer"/);
  assert.match(html, /name="theme-color" content="#161914"/);
  ["top", "right", "bottom", "left"].forEach((side) => {
    assert.match(css, new RegExp(`env\\(safe-area-inset-${side}\\)`));
  });
  assert.match(css, /100dvh/);
  assert.doesNotMatch(html, /<a\b|window\.location/);
});

test("ancre le panneau audio mobile à toute la rangée de contrôles", async () => {
  const css = await readFile(new URL("../css/style.css", import.meta.url), "utf8");
  assert.match(css, /\.header-controls\s*\{\s*position: relative;/);
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*?\.audio-settings\s*\{\s*position: static;/);
  assert.match(css, /@media \(max-width: 640px\)[\s\S]*?\.audio-settings-panel\s*\{[\s\S]*?right: 0;[\s\S]*?left: 0;[\s\S]*?width: auto;/);
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

test("conserve le Wake Lock uniquement pendant les états actifs et visibles", async () => {
  let released = 0;
  let requests = 0;
  const lock = new ScreenWakeLock({
    navigatorObject: {
      wakeLock: {
        request: async () => {
          requests += 1;
          return { addEventListener: () => {}, release: async () => { released += 1; } };
        },
      },
    },
  });

  assert.deepEqual([...ACTIVE_STATES], ["RUNNING", "RUNNING_TRANSITION", "WAITING_MANUAL"]);
  for (const state of ACTIVE_STATES) {
    await lock.sync(state, true);
    await lock.sync("PAUSED", true);
  }
  assert.equal(requests, 3);
  assert.equal(released, 3);
});

test("relâche au passage en arrière-plan et redemande au retour actif", async () => {
  let released = 0;
  let requests = 0;
  const lock = new ScreenWakeLock({
    navigatorObject: {
      wakeLock: {
        request: async () => {
          requests += 1;
          return { addEventListener: () => {}, release: async () => { released += 1; } };
        },
      },
    },
  });

  await lock.sync("RUNNING", true);
  await lock.sync("RUNNING", false);
  await lock.sync("RUNNING", true);
  await lock.sync("FINISHED", true);
  assert.equal(requests, 2);
  assert.equal(released, 2);
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
