export function registerServiceWorker(navigatorObject = globalThis.navigator) {
  if (!navigatorObject?.serviceWorker) return Promise.resolve(null);
  return navigatorObject.serviceWorker.register("./service-worker.js").catch(() => null);
}
