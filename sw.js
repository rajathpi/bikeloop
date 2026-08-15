// Minimal shell cache so Loop opens instantly and survives a flaky signal.
// Route generation and map tiles always need the network.
const CACHE = 'loop-v2';
const SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon.svg',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(SHELL.map(u => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const { request } = e;
  if (request.method !== 'GET') return;                       // never touch the ORS POSTs
  if (request.url.includes('api.openrouteservice.org')) return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === location.origin;
  // The app's own code must never be served from a stale cache, or an update
  // can never reach an installed device. Third-party libs are versioned, so
  // cache-first is safe for those.
  const isAppCode = sameOrigin &&
    (request.mode === 'navigate' || /\.(html|js|json|svg)$/.test(url.pathname) || url.pathname === '/');

  if (isAppCode) {
    e.respondWith(
      fetch(request)
        .then(res => {
          if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(request, copy)); }
          return res;
        })
        .catch(() => caches.match(request).then(hit => hit || caches.match('./index.html')))
    );
    return;
  }

  e.respondWith(
    caches.match(request).then(hit =>
      hit || fetch(request).then(res => {
        if (res.ok && sameOrigin) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(request, copy));
        }
        return res;
      }).catch(() => hit)
    )
  );
});
