const CACHE_NAME = "team-shoky-helper-v1";
const urlsToCache = [
  "./index.html",
  "./icon-192x192.png",
  "./icon-512x512.png",
  "https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css",
  "https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.0.0/css/all.min.css",
  "https://cdn.jsdelivr.net/npm/fullcalendar@5.10.1/main.min.css",
  "https://cdn.jsdelivr.net/npm/fullcalendar@5.10.1/main.min.js",
  "./youseftamer_profile.jpg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache).catch((error) => {
        console.error("Failed to cache resources:", error);
      });
    })
  );
});
// Add this to your existing service-worker.js
self.addEventListener("push", function (event) {
  const data = event.data
    ? event.data.json()
    : { title: "Welcome", body: "Thanks for visiting!" };
  const options = {
    body: data.body,
    icon: "./icon-192x192.png", // Replace with your icon path from manifest.json or another URL
    badge: "./icon-512x512.png", // Optional: Small badge image
  };
  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  event.waitUntil(
    clients.openWindow("/") // Redirect to your homepage
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
