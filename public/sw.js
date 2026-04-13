const CACHE_NAME = 'staffhub-v1';
const OFFLINE_URL = '/offline.html';

const STATIC_ASSETS = [
  '/',
  '/offline.html',
  '/manifest.json',
];

const FIREBASE_DOMAINS = [
  'firbasestorage.googleapis.com',
  'firebasestorage.googleapis.com',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') {
    return;
  }

  if (FIREBASE_DOMAINS.some(domain => url.hostname.includes(domain))) {
    event.respondWith(networkFirst(request));
    return;
  }

  if (url.origin === location.origin) {
    if (request.mode === 'navigate') {
      event.respondWith(networkFirst(request));
      return;
    }

    if (request.destination === 'style' || request.destination === 'script' || request.destination === 'font') {
      event.respondWith(cacheFirst(request));
      return;
    }

    if (request.destination === 'image') {
      event.respondWith(cacheFirst(request));
      return;
    }
  }

  event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
});

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;

    if (request.mode === 'navigate') {
      const offlinePage = await caches.match(OFFLINE_URL);
      if (offlinePage) return offlinePage;
    }

    return new Response('Offline', { status: 503 });
  }
}

self.addEventListener('push', (event) => {
  let data = {
    title: 'StaffHub',
    body: 'You have a new notification',
    icon: '/icons/icon.svg',
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
        tag: payload.tag || 'staffhub-notification',
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
    data: {
      url: data.url,
      date: new Date().toISOString(),
    },
    actions: data.actions,
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';
  
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          if (url !== '/') {
            client.navigate(url);
          }
          return;
        }
      }
      if (self.clients.openWindow) {
        self.clients.openWindow(url);
      }
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
