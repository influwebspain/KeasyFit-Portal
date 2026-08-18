// KeasyFit Service Worker — Cache Offline-First
const CACHE_NAME = 'keasyfit-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/data.js',
  '/js/charts.js',
  '/js/app.js',
  '/icon-512.png',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Orbitron:wght@500;700;900&display=swap'
];

// Instalar: pre-cachear todos los recursos estáticos
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// Activar: limpiar caches antiguas
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: servir desde cache primero, luego red (stale-while-revalidate para CDNs)
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Para Firebase y APIs externas: siempre ir a la red
  if (url.hostname.includes('firestore') || 
      url.hostname.includes('firebase') ||
      url.hostname.includes('googleapis.com/identitytoolkit')) {
    return; // Dejar que el navegador maneje estas peticiones normalmente
  }

  // Para CDNs de librerías (Chart.js, Confetti, Tesseract): cache-first
  if (url.hostname.includes('cdn.jsdelivr.net')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // Para recursos locales: cache-first con fallback a red
  event.respondWith(
    caches.match(event.request).then(cached => {
      const fetchPromise = fetch(event.request).then(networkResponse => {
        // Actualizar cache con la versión nueva
        if (networkResponse.ok) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return networkResponse;
      }).catch(() => {
        // Sin red: devolver la versión cacheada si existe
        return cached;
      });
      // Devolver cache inmediatamente, actualizar en background
      return cached || fetchPromise;
    })
  );
});
