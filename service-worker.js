/*
 Service Worker for Team Shoky Helper
 Version: v2 
*/

// --- Configuration ---

const CACHE_NAME = "team-shoky-helper-v4";

// Essential files for the App Shell to load offline
const APP_SHELL_URLS = [
  "./", // Root route - important for PWAs
  "./index.html",
  "./manifest.json",
  // Icons
  "./icon-192x192.png",
  "./icon-512x512.png",
  // Favicons (add all relevant ones)
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
  // Core CSS/JS from CDN
  "https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css",
  "https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.0.0/css/all.min.css",
  "https://cdn.jsdelivr.net/npm/fullcalendar@5.10.1/main.min.css",
  "https://cdn.jsdelivr.net/npm/fullcalendar@5.10.1/main.min.js",
  "https://cdn.jsdelivr.net/npm/shepherd.js@10.0.1/dist/css/shepherd.css",
  "https://cdn.jsdelivr.net/npm/shepherd.js@10.0.1/dist/js/shepherd.min.js",
  // Font Awesome Font Files (VERIFY these URLs via Network tab)
  "https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.0.0/webfonts/fa-solid-900.woff2",
  "https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.0.0/webfonts/fa-brands-400.woff2",
  "https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.0.0/webfonts/fa-regular-400.woff2",
  // Add any other critical static assets needed for basic app function
];

// --- Event Listeners ---

// Install Event: Cache the App Shell
self.addEventListener("install", (event) => {
  console.log("[Service Worker] Installing...");
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log("[Service Worker] Precaching App Shell:", APP_SHELL_URLS);
        // Use individual add requests for resilience
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
        // Force the waiting service worker to become the active service worker.
        return self.skipWaiting();
      })
  );
});

// Activate Event: Clean up old caches
self.addEventListener("activate", (event) => {
  console.log("[Service Worker] Activating...");
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
        // Take control of all open clients (tabs/windows) immediately
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
    // console.log('[Service Worker] Ignoring chrome-extension request:', event.request.url);
    return; // Let the browser handle it natively
  }

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
          return fetch(event.request); // Fallback if index.html isn't cached
        })
        .catch((error) => {
          console.error(
            "[Service Worker] Error serving index.html for navigation:",
            error
          );
          // You might want a generic offline page here if index.html fetch also fails
          // return caches.match('/offline.html');
        })
    );
    return;
  }

  // 4. Cache-First, then Network, then Update Cache (for static assets, CDN files etc.)
  // console.log('[Service Worker] Cache-First strategy for:', event.request.url);
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((cachedResponse) => {
        // Return cached response if found
        if (cachedResponse) {
          // console.log(`[Service Worker] Serving from cache: ${event.request.url}`);
          return cachedResponse;
        }

        // Otherwise, fetch from network
        // console.log(`[Service Worker] Fetching from network: ${event.request.url}`);
        return fetch(event.request)
          .then((networkResponse) => {
            // Check if we received a valid response & it's a GET request we should cache
            if (
              networkResponse &&
              networkResponse.status === 200 &&
              event.request.method === "GET"
            ) {
              const responseToCache = networkResponse.clone();
              // Cache the fetched response
              cache
                .put(event.request, responseToCache)
                .then(() => {
                  // console.log(`[Service Worker] Cached new resource: ${event.request.url}`);
                })
                .catch((cacheError) => {
                  console.warn(
                    `[Service Worker] Failed to cache resource ${event.request.url}:`,
                    cacheError
                  );
                });
            } else {
              // console.log(`[Service Worker] Not caching non-200 or non-GET request: ${event.request.url} Status: ${networkResponse?.status}`);
            }
            return networkResponse; // Return the original network response to the browser
          })
          .catch((error) => {
            console.warn(
              `[Service Worker] Network fetch failed for ${event.request.url}. User might be offline.`,
              error
            );
            // Here you could return a fallback response, like a placeholder image or offline indicator
            // For example: if (event.request.destination === 'image') return caches.match('/placeholder.png');
            // Returning nothing or undefined will result in a standard browser network error page.
          });
      });
    })
  );
});

// --- Push Notification Handling ---

self.addEventListener("push", function (event) {
  console.log("[Service Worker] Push Received.");
  let data = { title: "New Notification", body: "Something happened!" };
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      console.error("[Service Worker] Push data could not be parsed:", e);
      data = { title: "Update", body: event.data.text() }; // Fallback to text if JSON fails
    }
  }

  const options = {
    body: data.body,
    icon: "./icon-192x192.png", // Ensure this path is correct relative to the SW
    badge: "./icon-512x512.png", // Optional badge
    // You can add more options: vibration, actions, etc.
    // data: { url: data.url || '/' } // Pass data to notificationclick
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener("notificationclick", function (event) {
  console.log("[Service Worker] Notification click Received.");
  event.notification.close();

  // Define the URL to open, potentially from notification data
  const targetUrl = event.notification.data?.url || "/"; // Default to root

  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        // Check if there is already a window/tab open with the target URL
        for (let i = 0; i < windowClients.length; i++) {
          let client = windowClients[i];
          // Use endsWith to handle potential trailing slashes or hash fragments
          if (client.url.endsWith(targetUrl) && "focus" in client) {
            console.log(
              "[Service Worker] Focusing existing client:",
              client.url
            );
            return client.focus();
          }
        }
        // If not, then open the target URL in a new window/tab.
        if (clients.openWindow) {
          console.log("[Service Worker] Opening new window:", targetUrl);
          return clients.openWindow(targetUrl);
        }
      })
  );
});
