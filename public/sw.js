const CACHE_NAME = 'woe-l2-cache-v3';
const URLS = ['/', '/index.html', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(URLS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
  );
});

function shouldBypassCache(request, requestUrl) {
  return requestUrl.pathname.startsWith('/api/') || requestUrl.pathname.startsWith('/audio/') || request.headers.has('range');
}

function isStaticAssetRequest(request, requestUrl) {
  return (
    request.destination === 'script' ||
    request.destination === 'style' ||
    request.destination === 'image' ||
    requestUrl.pathname.startsWith('/assets/') ||
    requestUrl.pathname.startsWith('/images/') ||
    requestUrl.pathname === '/favicon.svg'
  );
}

function cacheResponse(request, response) {
  if (response.ok) {
    const cloned = response.clone();
    caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned));
  }

  return response;
}

function cacheFirst(request) {
  return caches.match(request).then((cached) => {
    if (cached) {
      fetch(request)
        .then((response) => cacheResponse(request, response))
        .catch(() => undefined);
      return cached;
    }

    return fetch(request).then((response) => cacheResponse(request, response));
  });
}

function networkFirst(request) {
  return fetch(request)
    .then((response) => cacheResponse(request, response))
    .catch(() =>
      caches.match(request).then((cached) => {
        if (cached) return cached;
        if (request.mode === 'navigate') return caches.match('/index.html');
        return new Response('', { status: 504, statusText: 'Offline' });
      }),
    );
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (shouldBypassCache(event.request, url)) {
    event.respondWith(fetch(event.request));
    return;
  }

  if (isStaticAssetRequest(event.request, url)) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  event.respondWith(networkFirst(event.request));
});
