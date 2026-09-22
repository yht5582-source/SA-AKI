import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { build } from 'vite';

// Emulate only browser CacheStorage/event/network I/O. The bundled application SW,
// Workbox router, strategies, precache install/activate and fallback plugin run unchanged.
function cacheStorage() {
  const named = new Map();
  const url = request => typeof request === 'string' ? new URL(request, 'https://example.test').href : request.url;
  return {
    async open(name) {
      if (!named.has(name)) {
        const entries = new Map();
        named.set(name, {
          async put(request, response) { entries.set(url(request), response.clone()); },
          async match(request) { return entries.get(url(request))?.clone(); },
          async keys() { return [...entries.keys()].map(key => new Request(key)); },
          async delete(request) { return entries.delete(url(request)); },
        });
      }
      return named.get(name);
    },
    async keys() { return [...named.keys()]; },
    async delete(name) { return named.delete(name); },
    async match(request, options = {}) {
      for (const [name, cache] of named) {
        if (options.cacheName && options.cacheName !== name) continue;
        const response = await cache.match(request);
        if (response) return response;
      }
    },
  };
}

class WorkerEvent {
  constructor() { this.promises = []; }
  waitUntil(promise) { this.promises.push(promise); }
  async complete() { for (let i = 0; i < this.promises.length; i++) await this.promises[i]; }
}
class FetchEvent extends WorkerEvent {
  constructor(request) { super(); this.request = request; }
  respondWith(response) { this.response = response; }
}

async function worker(version, caches, { githubPagesDeepRoute404 = false } = {}) {
  const manifest = [{ url: '/SA-AKI/index.html', revision: version }, { url: `/SA-AKI/assets/app-${version}.js`, revision: null }];
  const bundled = await build({ configFile: false, logLevel: 'silent',
    define: { 'process.env.NODE_ENV': '"production"', 'self.__WB_MANIFEST': JSON.stringify(manifest) },
    build: { write: false, minify: false, lib: { entry: 'src/sw.ts', formats: ['iife'], name: 'worker' } },
  });
  const listeners = new Map();
  let online = true;
  const location = new URL('https://example.test/SA-AKI/sw.js');
  const context = {
    URL, Request, Response, Headers, Error, FetchEvent, ExtendableEvent: WorkerEvent,
    setTimeout, clearTimeout, console, caches, location,
    registration: { scope: 'https://example.test/SA-AKI/' },
    clients: { claim: async () => {} }, skipWaiting: async () => {},
    addEventListener(type, listener) { const list = listeners.get(type) ?? []; list.push(listener); listeners.set(type, list); },
    async fetch(request) {
      if (!online) throw new Error('offline');
      const path = new URL(request.url).pathname;
      if (githubPagesDeepRoute404 && path === '/SA-AKI/case/demo-001/assessment') {
        return new Response('<script src="/SA-AKI/assets/app-not-found.js"></script>', { status: 404 });
      }
      return new Response(path.endsWith('.js') ? `application-${version}` : `<script src="/SA-AKI/assets/app-${version}.js"></script>`);
    },
  };
  context.self = context;
  const output = (Array.isArray(bundled) ? bundled[0] : bundled).output.find(file => file.type === 'chunk');
  runInNewContext(output.code, context);
  return {
    setOffline() { online = false; },
    async dispatch(type, event = new WorkerEvent()) {
      event.type = type;
      for (const listener of listeners.get(type) ?? []) listener(event);
      const response = event.response ? await event.response : undefined;
      await event.complete();
      return response;
    },
    async navigate(path) {
      const request = new Request(new URL(path, location));
      Object.defineProperty(request, 'mode', { value: 'navigate' });
      return this.dispatch('fetch', new FetchEvent(request));
    },
  };
}

test('after a changed build activates, offline revisits use the current shell, not a stale navigation shell with removed hashed assets', async () => {
  const caches = cacheStorage();
  const unrelated = await caches.open('unrelated-application');
  await unrelated.put(new Request('https://example.test/elsewhere'), new Response('keep-other-application'));
  const first = await worker('first', caches);
  await first.dispatch('install');
  assert.ok(await caches.match('https://example.test/SA-AKI/assets/app-first.js'), JSON.stringify(await Promise.all((await caches.keys()).map(async name => [name, (await (await caches.open(name)).keys()).map(request => request.url)]))));
  await first.dispatch('activate');
  assert.match(await (await first.navigate('/SA-AKI/')).text(), /app-first\.js/);
  const oldNavigationCaches = (await caches.keys()).filter(name => name.startsWith('sa-aki-navigation-'));
  assert.equal(oldNavigationCaches.length, 1);
  const second = await worker('second', caches);
  await second.dispatch('install'); await second.dispatch('activate'); second.setOffline();
  assert.equal(await caches.match('https://example.test/SA-AKI/assets/app-first.js'), undefined, 'precache activation removes obsolete hashed assets');
  const response = await second.navigate('/SA-AKI/');
  assert.match(await response.text(), /app-second\.js/, 'an existing navigation URL must resolve to the shell whose asset is still precached');
  assert.ok(await caches.match('https://example.test/SA-AKI/assets/app-second.js'));
  assert.match(await (await second.navigate('/SA-AKI/never-visited')).text(), /app-second\.js/);
  const currentCacheNames = await caches.keys();
  assert.ok(oldNavigationCaches.every(name => !currentCacheNames.includes(name)), 'retired navigation caches must be removed');
  assert.equal(await (await caches.match('https://example.test/elsewhere')).text(), 'keep-other-application');
});

test('a GitHub Pages deep-link 404 is replaced by the current revisioned precached shell', async () => {
  const caches = cacheStorage();
  const current = await worker('current', caches, { githubPagesDeepRoute404: true });
  await current.dispatch('install'); await current.dispatch('activate');

  const response = await current.navigate('/SA-AKI/case/demo-001/assessment');

  assert.equal(response.status, 200);
  assert.equal(response.ok, true);
  assert.match(await response.text(), /app-current\.js/);
});
