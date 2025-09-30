const CACHE_NAME = 'consulta-campo-v1';
// Solo incluimos el index.html y la raíz, y el sw.js (opcionalmente)
const urlsToCache = [
    '/',
    '/index.html'
    // Elimina '/styles.css' y '/app.js' si no existen como archivos separados
];

self.addEventListener('install', event => {
  console.log('Service Worker: Evento Install - Abriendo cache...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        // Usa .addAll para el precache. Si falla aquí, el SW no se activará.
        return cache.addAll(urlsToCache); 
      })
      .catch(error => {
        console.error('Service Worker: Fallo en cache.addAll:', error);
        // Es mejor dejar que falle aquí para depurar, pero para evitar el bloqueo, 
        // asegúrate que las URLs de urlsToCache son correctas.
      })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        return response || fetch(event.request);
      })
  );
});

// Opcional: Para evitar que versiones antiguas se queden
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
