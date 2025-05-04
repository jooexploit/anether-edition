// --- START: Modified service-worker.js ---

/*
 Service Worker for Team Shoky Helper
 Version: v9
*/

const CACHE_NAME = "team-shoky-helper-v16"; // <-- INCREMENTED VERSION!

// Essential files for the App Shell to load offline
const APP_SHELL_URLS = [
  // ... (keep your existing URLs)
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192x192.png",
  "./icon-512x512.png",
  "./favicon/apple-icon-57x57.png",
  "./favicon/apple-icon-60x60.png",
  "./favicon/apple-icon-72x72.png",
  "./favicon/apple-icon-76x76.png",
  "./favicon/apple-icon-114x114.png",
  "./favicon/apple-icon-120x120.png",
  "./favicon/apple-icon-144x144.png",
  "./favicon/apple-icon-152x152.png",
  "./favicon/apple-icon-180x180.png",
  "./favicon/android-icon-192x192.png",
  "./favicon/favicon-32x32.png",
  "./favicon/favicon-96x96.png",
  "./favicon/favicon-16x16.png",
  "https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css",
  "https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.0.0/css/all.min.css",
  "https://cdn.jsdelivr.net/npm/fullcalendar@5.10.1/main.min.css",
  "https://cdn.jsdelivr.net/npm/fullcalendar@5.10.1/main.min.js",
  "https://cdn.jsdelivr.net/npm/shepherd.js@10.0.1/dist/css/shepherd.css",
  "https://cdn.jsdelivr.net/npm/shepherd.js@10.0.1/dist/js/shepherd.min.js",
  "https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.0.0/webfonts/fa-solid-900.woff2",
  "https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.0.0/webfonts/fa-brands-400.woff2",
  "https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.0.0/webfonts/fa-regular-400.woff2",
];

// --- Event Listeners ---

// Install Event: Cache the App Shell
self.addEventListener("install", (event) => {
  console.log("[Service Worker] Installing... Cache Version:", CACHE_NAME); // Log version
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log("[Service Worker] Precaching App Shell:", APP_SHELL_URLS);
        const cachePromises = APP_SHELL_URLS.map((urlToCache) => {
          return cache.add(urlToCache).catch((error) => {
            console.warn(
              `[Service Worker] Failed to cache ${urlToCache} during install:`,
              error
            );
          });
        });
        return Promise.all(cachePromises);
      })
      .then(() => {
        console.log(
          "[Service Worker] App Shell caching complete. Activating..."
        );
        return self.skipWaiting();
      })
  );
});

// Activate Event: Clean up old caches
self.addEventListener("activate", (event) => {
  console.log("[Service Worker] Activating... Cache Version:", CACHE_NAME); // Log version
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log("[Service Worker] Deleting old cache:", cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log("[Service Worker] Claiming clients...");
        return self.clients.claim();
      })
  );
});

// Fetch Event: Handle network requests
self.addEventListener("fetch", (event) => {
  const requestUrl = new URL(event.request.url);

  // --- Routing ---

  // 1. Ignore Chrome Extension requests completely
  if (requestUrl.protocol === "chrome-extension:") {
    return;
  }

  // ***********************************************************
  // ***** START: NEW BYPASS RULE FOR preview.html *****
  // ***********************************************************
  // Check if the requested path is exactly /preview.html
  if (requestUrl.pathname === "/preview.html") {
    console.log(
      "[Service Worker] Bypassing fetch for preview.html, letting browser handle:",
      event.request.url
    );
    // By simply returning without calling event.respondWith(),
    // we let the browser handle the request normally (network).
    return;
  }
  // ***********************************************************
  // ***** END: NEW BYPASS RULE FOR preview.html *****
  // ***********************************************************

  // 2. Network-only for specific APIs (Push Server, Analytics)
  const networkOnlyHosts = [
    "push-notfication-server-production.up.railway.app",
    "www.googletagmanager.com",
    "www.google-analytics.com",
    // Add any other domains that MUST always be fetched live
  ];
  if (networkOnlyHosts.includes(requestUrl.hostname)) {
    // console.log('[Service Worker] Network Only:', event.request.url);
    event.respondWith(fetch(event.request));
    return;
  }

  // 3. Serve App Shell (index.html) for Navigation requests (for SPA routing)
  //    (This should NOT match /preview.html because of the rule above)
  if (event.request.mode === "navigate") {
    // console.log('[Service Worker] Navigation request, serving App Shell:', event.request.url);
    event.respondWith(
      caches
        .match("./index.html", { cacheName: CACHE_NAME }) // Explicitly use our cache
        .then((response) => {
          if (response) {
            return response;
          }
          console.warn(
            "[Service Worker] index.html not found in cache for navigation, fetching from network."
          );
          return fetch("./index.html"); // Fetch index.html specifically
        })
        .catch((error) => {
          console.error(
            "[Service Worker] Error serving index.html for navigation:",
            error
          );
          // return caches.match('/offline.html'); // Optional offline page
        })
    );
    return;
  }

  // 4. Cache-First, then Network, then Update Cache (for static assets, CDN files etc.)
  // console.log('[Service Worker] Cache-First strategy for:', event.request.url);
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request)
          .then((networkResponse) => {
            if (
              networkResponse &&
              networkResponse.status === 200 &&
              event.request.method === "GET"
            ) {
              const responseToCache = networkResponse.clone();
              cache.put(event.request, responseToCache).catch((cacheError) => {
                console.warn(
                  `[Service Worker] Failed to cache resource ${event.request.url}:`,
                  cacheError
                );
              });
            }
            return networkResponse;
          })
          .catch((error) => {
            console.warn(
              `[Service Worker] Network fetch failed for ${event.request.url}. User might be offline.`,
              error
            );
            // Optional: return fallback for specific asset types like images
          });
      });
    })
  );
});

// --- Push Notification Handling ---
self.addEventListener("push", function (event) {
  // ... (keep your existing push handling logic)
  console.log("[Service Worker] Push Received.");
  let data = { title: "New Notification", body: "Something happened!" };
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      console.error("[Service Worker] Push data could not be parsed:", e);
      data = { title: "Update", body: event.data.text() };
    }
  }
  const options = {
    body: data.body,
    icon: "./icon-192x192.png",
    badge: "./icon-512x512.png",
    // data: { url: data.url || '/' }
  };
  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener("notificationclick", function (event) {
  // ... (keep your existing notification click logic)
  console.log("[Service Worker] Notification click Received.");
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        for (let i = 0; i < windowClients.length; i++) {
          let client = windowClients[i];
          if (client.url.endsWith(targetUrl) && "focus" in client) {
            console.log(
              "[Service Worker] Focusing existing client:",
              client.url
            );
            return client.focus();
          }
        }
        if (clients.openWindow) {
          console.log("[Service Worker] Opening new window:", targetUrl);
          return clients.openWindow(targetUrl);
        }
      })
  );
});

// --- END: Modified service-worker.js ---
