/* Staff2 service worker — offline shell + runtime caching + push. */

const VERSION = 'v3';
const PRECACHE = `staff2-precache-${VERSION}`;
const RUNTIME = `staff2-runtime-${VERSION}`;
const OFFLINE_URL = '/offline.html';

// App shell that should always be available offline.
const PRECACHE_URLS = [
  '/',
  '/login',
  OFFLINE_URL,
  '/manifest.json',
  '/favicon.svg',
  '/icons/icon.svg',
  '/icons/maskable.svg',
  '/icons/apple-touch-icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-512.png',
];

// Requests we never want the SW to touch (real-time data, auth, APIs).
function isBypassed(url) {
  if (url.pathname.startsWith('/api/')) return true;
  const h = url.hostname;
  if (h === 'firestore.googleapis.com') return true;
  if (h === 'firebaseinstallations.googleapis.com') return true;
  if (h === 'identitytoolkit.googleapis.com') return true;
  if (h === 'securetoken.googleapis.com') return true;
  if (h === 'fcmregistrations.googleapis.com') return true;
  if (h.endsWith('.firebaseio.com')) return true;
  if (h.endsWith('.cloudfunctions.net')) return true;
  return false;
}

function isFirebaseStorage(url) {
  return (
    url.hostname === 'firebasestorage.googleapis.com' ||
    url.hostname === 'storage.googleapis.com' ||
    url.hostname.endsWith('.firebasestorage.app')
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(PRECACHE)
      // Don't let one bad asset abort the whole install.
      .then((cache) =>
        Promise.all(
          PRECACHE_URLS.map((u) =>
            cache.add(new Request(u, { cache: 'reload' })).catch(() => null)
          )
        )
      )
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((n) => n !== PRECACHE && n !== RUNTIME)
          .map((n) => caches.delete(n))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING' || event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  if (isBypassed(url)) return;

  const sameOrigin = url.origin === self.location.origin;

  // HTML navigations: network-first, fall back to cache, then offline page.
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(event));
    return;
  }

  if (sameOrigin && ['style', 'script', 'font'].includes(request.destination)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  if (request.destination === 'image' && (sameOrigin || isFirebaseStorage(url))) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (isFirebaseStorage(url)) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (sameOrigin) {
    event.respondWith(networkFirst(request));
  }
});

async function handleNavigation(event) {
  const { request } = event;
  try {
    const preload = await event.preloadResponse;
    if (preload) {
      putRuntime(request, preload.clone());
      return preload;
    }
    const network = await fetch(request);
    putRuntime(request, network.clone());
    return network;
  } catch {
    // Ignore the query string so e.g. /login?source=pwa still matches /login.
    const cached =
      (await caches.match(request, { ignoreSearch: true })) ||
      (await caches.match('/'));
    if (cached) return cached;
    const offline = await caches.match(OFFLINE_URL);
    if (offline) return offline;
    return new Response('Offline', {
      status: 503,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) putRuntime(request, response.clone());
    return response;
  } catch {
    return new Response('', { status: 504 });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) putRuntime(request, response.clone());
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response('Offline', { status: 503 });
  }
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const network = fetch(request)
    .then((response) => {
      if (response.ok) putRuntime(request, response.clone());
      return response;
    })
    .catch(() => null);
  return cached || (await network) || new Response('', { status: 504 });
}

async function putRuntime(request, response) {
  try {
    if (!response || !response.ok || response.type === 'opaque') return;
    const cache = await caches.open(RUNTIME);
    await cache.put(request, response);
  } catch {
    /* ignore quota / put errors */
  }
}

/* ---------------------------------------------------------------- push ---- */

self.addEventListener('push', (event) => {
  let data = {
    title: 'Staff2',
    body: 'You have a new notification',
    icon: '/icons/icon-192.png',
    badge: '/favicon.svg',
    url: '/',
  };

  try {
    if (event.data) {
      const payload = event.data.json();
      data = {
        title: payload.notification?.title || payload.title || data.title,
        body: payload.notification?.body || payload.body || data.body,
        icon: payload.notification?.icon || payload.icon || data.icon,
        badge: payload.badge || data.badge,
        url: payload.data?.url || payload.url || data.url,
        actions: payload.actions || [],
        tag: payload.tag || 'staff2-notification',
        requireInteraction: payload.requireInteraction || false,
        ...payload.data,
      };
    }
  } catch (e) {
    console.error('Error parsing push data:', e);
  }

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    vibrate: [100, 50, 100, 50, 100],
    tag: data.tag,
    requireInteraction: data.requireInteraction,
    data: { url: data.url, date: new Date().toISOString() },
    actions: data.actions,
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.focus();
            if (url !== '/') client.navigate(url);
            return;
          }
        }
        if (self.clients.openWindow) self.clients.openWindow(url);
      })
  );
});

self.addEventListener('notificationclose', (event) => {
  console.log('Notification closed:', event.notification.tag);
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-checklists') {
    event.waitUntil(syncChecklists());
  }
});

async function syncChecklists() {
  console.log('Background sync: checklists');
}
