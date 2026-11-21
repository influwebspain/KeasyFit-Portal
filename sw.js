// FitActive Service Worker — Cache Offline-First
// IMPORTANTE: sube este número cada vez que cambies cualquier archivo de la
// app (HTML, CSS o JS). Si no, el móvil sigue abriendo la versión anterior la
// primera vez y no aparece el aviso de "versión nueva".
const CACHE_NAME = 'fitactive-v4';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/data.js',
  '/js/firebase-init.js',
  '/js/charts.js',
  '/js/app.js',
  '/manifest.json',
  '/icon-512.png'
  // Google Fonts se cachean automáticamente en la primera visita vía CDN handler
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

// Al tocar un aviso de entreno: volver a la app si está abierta, o abrirla
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windows => {
      const open = windows.find(w => 'focus' in w);
      return open ? open.focus() : self.clients.openWindow('/');
    })
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

  // Para CDNs de librerías (Chart.js, Confetti, Tesseract) y Google Fonts: cache-first
  if (url.hostname.includes('cdn.jsdelivr.net') || 
      url.hostname.includes('fonts.googleapis.com') || 
      url.hostname.includes('fonts.gstatic.com')) {
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
