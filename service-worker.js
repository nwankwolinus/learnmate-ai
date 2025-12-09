
importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.4.1/workbox-sw.js');

if (workbox) {
  console.log(`Yay! Workbox is loaded 🎉`);

  // Precache nothing here (dynamic caching preferred for this setup)
  // In a build process, we would inject the manifest here.

  // Cache Google Fonts
  workbox.routing.registerRoute(
    ({url}) => url.origin === 'https://fonts.googleapis.com' ||
               url.origin === 'https://fonts.gstatic.com',
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: 'google-fonts',
      plugins: [
        new workbox.expiration.ExpirationPlugin({maxEntries: 20}),
      ],
    }),
  );

  // Cache CDN Libraries (React, Tailwind, Lucide, etc.)
  workbox.routing.registerRoute(
    ({url}) => url.origin === 'https://esm.sh' || 
               url.origin === 'https://cdn.tailwindcss.com' ||
               url.origin === 'https://aistudiocdn.com',
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: 'cdn-libraries',
    }),
  );

  // Cache Images
  workbox.routing.registerRoute(
    ({request}) => request.destination === 'image',
    new workbox.strategies.CacheFirst({
      cacheName: 'images',
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 60,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
        }),
      ],
    }),
  );

  // Cache Scripts and Styles
  workbox.routing.registerRoute(
    ({request}) => request.destination === 'script' ||
                   request.destination === 'style',
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: 'static-resources',
    }),
  );

  // Offline Fallback for Navigation
  // This ensures the SPA loads even if offline
  workbox.routing.registerRoute(
    ({request}) => request.mode === 'navigate',
    new workbox.strategies.NetworkFirst({
      cacheName: 'pages',
      networkTimeoutSeconds: 3,
    })
  );

} else {
  console.log(`Boo! Workbox didn't load 😬`);
}
