// Stickman Game Zone — Service Worker
//
// *** IMPORTANT — READ BEFORE SHIPPING ANY FUTURE UPDATE ***
// This is a single-page app: index.html + all part*.js files are the ENTIRE
// game, not just a "shell". Every one of them is cached below so the site
// works fully offline. That means whenever ANY of these files changes
// (a bug fix, a new game, a tweak to part6.js, etc.) you MUST bump
// CACHE_VERSION below. If you ship new code without bumping the version,
// players who already installed the app (or are just offline) will keep
// playing the OLD cached code indefinitely — the browser will never know
// to fetch the new files. Bumping the version is what makes the old cache
// get deleted and the new files get fetched fresh on next launch.
//
// So: every deploy that touches index.html or any part*.js -> bump this.
const CACHE_VERSION = 'v7';
const CACHE_NAME = `stickgames-shell-${CACHE_VERSION}`;

// Every asset needed to fully play the game with no network connection.
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/part1.js',
  '/part2.js',
  '/part3.js',
  '/part4.js',
  '/part5.js',
  '/part7.js',
  '/part8.js',
  '/part9.js',
  '/part10.js',
  '/part12.js',
  '/part13.js',
  '/part14.js',
  '/part15.js',
  '/part16.js',
  '/part6.js',
  '/quest-bgm.mp3',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/offline.html'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

// Strategy: cache-first for everything we know about (instant + offline-safe),
// with a background revalidate so the cache quietly catches up to a newer
// deploy on the NEXT launch (the version-bump above is what guarantees a
// clean break, this just smooths normal same-version updates like a CDN
// re-fetch). Anything not in our known list falls back to network, then to
// the offline page for full-page navigations only.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // don't intercept 3rd-party requests

  event.respondWith(
    caches.match(req).then((cached) => {
      const networkFetch = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => null);

      if (cached) {
        // stale-while-revalidate: serve cached immediately, refresh in background
        networkFetch;
        return cached;
      }

      return networkFetch.then((res) => {
        if (res) return res;
        if (req.mode === 'navigate') return caches.match('/offline.html');
        return new Response('', { status: 504, statusText: 'Offline' });
      });
    })
  );
});
