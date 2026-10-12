// Service worker: makes the game installable and playable offline, and keeps it fresh.
//  - The app shell is saved at install time.
//  - Lessons, labs and translations are saved the first time they are used (or all at once from Settings).
//  - Everything is served from the device first and refreshed in the background, so it opens fast.
//  - If the main host is unreachable and a file is not saved yet, the mirrors listed in mirrors.json are tried.
importScripts('precache.js');
const { version, files } = self.__PRECACHE;
const SHELL = `ukc-shell-${version}`, DATA = 'ukc-data-v1';

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => Promise.all(files.map((f) => c.add(new Request(f, { cache: 'reload' })).catch(() => {})))).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('ukc-shell-') && k !== SHELL).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

let mirrors = null;
async function getMirrors() {
  if (mirrors) return mirrors;
  try { const r = await caches.match('mirrors.json') || await fetch('mirrors.json'); mirrors = (await r.clone().json()).mirrors || []; } catch { mirrors = []; }
  return mirrors;
}
async function fromMirrors(path) {
  for (const base of await getMirrors()) {
    try { const r = await fetch(base.replace(/\/?$/, '/') + path, { mode: 'cors' }); if (r.ok) return r; } catch { /* next mirror */ }
  }
  return null;
}

self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return; // live sources are cached by the app itself
  const path = url.pathname.slice(new URL(self.registration.scope).pathname.length);
  e.respondWith((async () => {
    const hit = await caches.match(req, { ignoreSearch: true });
    const refresh = fetch(req).then(async (res) => {
      if (res.ok && res.type === 'basic') { const c = await caches.open(files.includes(path) || path === '' ? SHELL : DATA); c.put(req, res.clone()); }
      return res;
    });
    if (hit) { e.waitUntil(refresh.catch(() => {})); return hit; }
    try { const res = await refresh; if (res.ok || res.status < 500) return res; throw new Error('bad'); } catch {
      const alt = path ? await fromMirrors(path) : null;
      if (alt) { const c = await caches.open(DATA); c.put(req, alt.clone()); return alt; }
      if (req.mode === 'navigate') return (await caches.match('index.html')) || (await caches.match('./')) || Response.error();
      return Response.error();
    }
  })());
});

// Where the browser supports it, lesson packs already on the device are refreshed in the background from time to time.
self.addEventListener('periodicsync', (e) => {
  if (e.tag !== 'ukc-refresh') return;
  e.waitUntil((async () => {
    const c = await caches.open(DATA);
    for (const req of (await c.keys()).slice(0, 80)) { try { const r = await fetch(req, { cache: 'no-cache' }); if (r.ok) await c.put(req, r); } catch { /* offline */ } }
  })());
});
