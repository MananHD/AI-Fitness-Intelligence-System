const CACHE = 'ai-fitness-v1';
const STATIC = ['/', '/static/icon-192.png'];

self.addEventListener('install', e =>
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC).catch(() => {})))
);

self.addEventListener('fetch', e => {
  if (e.request.url.includes('/api/')) return; // never cache API calls
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
