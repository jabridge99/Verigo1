/**
 * Trust Verify Go — Service Worker
 * App-shell caching with network-first for API/navigation, cache-first for static assets.
 */

const CACHE_VERSION = "tvg-v1";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

const APP_SHELL = [
  "/",
  "/dashboard",
  "/offline",
  "/manifest.json",
];

// Install — pre-cache the app shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

// Activate — clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => !k.startsWith(CACHE_VERSION))
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch strategy
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Only handle GET
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Never cache API calls — network-first, fall through to offline JSON
  if (url.pathname.includes("/api/")) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(
          JSON.stringify({ offline: true, message: "You are offline" }),
          { headers: { "Content-Type": "application/json" }, status: 503 }
        )
      )
    );
    return;
  }

  // Navigation requests — network-first, fallback to cache, then offline page
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((resp) => {
          const copy = resp.clone();
          caches.open(RUNTIME_CACHE).then((c) => c.put(request, copy));
          return resp;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match("/offline"))
        )
    );
    return;
  }

  // Static assets (JS/CSS/images/fonts) — cache-first
  if (
    request.destination === "script" ||
    request.destination === "style" ||
    request.destination === "image" ||
    request.destination === "font"
  ) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((resp) => {
          const copy = resp.clone();
          caches.open(RUNTIME_CACHE).then((c) => c.put(request, copy));
          return resp;
        });
      })
    );
    return;
  }

  // Default — network with cache fallback
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

// Push notifications — show native notification from payload
self.addEventListener("push", (event) => {
  let data = { title: "Trust Verify Go", body: "You have a new notification", url: "/notifications" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch (e) { /* keep defaults */ }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: data.tag || "tvg-notification",
      data: { url: data.url },
      vibrate: [100, 50, 100],
    })
  );
});

// Notification click — focus or open the target page
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/notifications";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(targetUrl) && "focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});
