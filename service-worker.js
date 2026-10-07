const CACHE_NAME = "coach-timer-v4";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-maskable-192.png",
  "./assets/icons/icon-maskable-512.png",
  "./assets/icons/apple-touch-icon.png",
  "./assets/icons/favicon-16.png",
  "./assets/icons/favicon-32.png",
  "./assets/icons/favicon-48.png",
  "./assets/icons/favicon.ico",
  "./css/style.css",
  "./js/app.js",
  "./js/pwa.js",
  "./js/routines.js",
  "./js/sounds.js",
  "./js/storage.js",
  "./js/timer.js",
  "./js/wake-lock.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names
        .filter((name) => name !== CACHE_NAME)
        .map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  if (request.mode === "navigate") {
    event.respondWith(
      caches.match("./index.html").then((cached) => cached ?? fetch(request)),
    );
    return;
  }

  event.respondWith(caches.match(request).then((cached) => cached ?? fetch(request)));
});
