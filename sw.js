const CACHE_VERSION = 'relaxplayer-v55';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/cs.html',
  '/chillout.html',
  '/chillout-cs.html',
  '/why-relaxplayer.html',
  '/why-relaxplayer-cs.html',
  '/features.html',
  '/services.html',
  '/services-cs.html',
  '/features-cs.html',
  '/articles.html',
  '/articles-cs.html',
  '/faq.html',
  '/faq-cs.html',
  '/contact.html',
  '/contact-cs.html',
  '/privacy.html',
  '/privacy-cs.html',
  '/manifest.json',
  '/manifest-cs.json',
  '/favicon-16.png',
  '/favicon-32.png',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) =>
        Promise.all(
          CORE_ASSETS.map((url) =>
            cache.add(url).catch((err) => {
              // Don't let one missing/failed asset (404, network hiccup, etc.)
              // block the whole install — log it and keep going with the rest.
              console.warn('[sw] skipping asset, failed to cache:', url, err);
            })
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle same-origin GET requests; let everything else (fonts, the
  // player on another domain, POSTs, ad scripts, etc.) go straight to the network.
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) {
    return;
  }

  // HTML / navigation requests: network-first, so updates to the page show up
  // immediately. Falls back to the cached copy only when offline.
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => {
          const isCs = new URL(req.url).pathname.includes('-cs.html') ||
                       new URL(req.url).pathname === '/cs.html';
          const fallback = isCs ? '/cs.html' : '/index.html';
          return caches.match(req).then((cached) => cached || caches.match(fallback));
        })
    );
    return;
  }

  // Everything else (images, JS, CSS, icons, etc.): cache-first for speed,
  // automatically saving every new same-origin asset it sees so the site
  // keeps building up its offline cache as it's used, with a background
  // network refresh to keep the cache up to date.
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
