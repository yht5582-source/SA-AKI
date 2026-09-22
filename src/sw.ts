/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import type { WorkboxPlugin } from 'workbox-core';
import { cleanupOutdatedCaches, precacheAndRoute, PrecacheFallbackPlugin } from 'workbox-precaching';
import type { PrecacheEntry } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst } from 'workbox-strategies';

declare const self: ServiceWorkerGlobalScope & { __WB_MANIFEST: Array<PrecacheEntry | string> };

const manifest = self.__WB_MANIFEST;
const shell = manifest.find((entry): entry is PrecacheEntry => typeof entry !== 'string'
  && new URL(entry.url, self.location.href).pathname === '/SA-AKI/index.html');
if (!shell?.revision) throw new Error('A revisioned application shell is required for safe offline updates');
// An old navigation response can reference hashed assets removed by the new precache.
// Scope navigation responses to this shell revision so offline revisits use its matching assets.
const navigationCacheName = `sa-aki-navigation-${shell.revision}`;
const successfulNavigationResponse: WorkboxPlugin = {
  fetchDidSucceed: async ({ response }) => {
    if (!response.ok) throw new Error(`Navigation request failed with ${response.status}`);
    return response;
  },
};

void self.skipWaiting();
clientsClaim();

// Register navigation FIRST so index.html precaching cannot shadow NetworkFirst.
registerRoute(
  ({ request, url }) => request.mode === 'navigate' && url.origin === self.location.origin && url.pathname.startsWith('/SA-AKI/'),
  new NetworkFirst({
    cacheName: navigationCacheName,
    networkTimeoutSeconds: 3,
    plugins: [successfulNavigationResponse, new PrecacheFallbackPlugin({ fallbackURL: '/SA-AKI/index.html' })],
  }),
);

// Offline fallback also works immediately after the first successful install.
precacheAndRoute(manifest);
cleanupOutdatedCaches();
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(names => Promise.all(names
    .filter(name => name.startsWith('sa-aki-navigation-') && name !== navigationCacheName)
    .map(name => caches.delete(name)))));
});

registerRoute(
  ({ request, url }) => url.origin === self.location.origin && ['script', 'style', 'image', 'font'].includes(request.destination),
  new CacheFirst({ cacheName: 'sa-aki-static-v1' }),
);
