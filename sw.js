const CACHE_NAME = 'consulta-campo-v1';
const urlsToCache = [
    // 1. Archivos base
    '/',
    '/index.html',
    
    // 2. Archivo de tu lógica principal
    '/app.js', // <-- ¡Asegúrate de que esta ruta sea correcta!
    
    // 3. CDN de Supabase (Crítico para que la app se cargue)
    'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2', 
    
    // Opcional: Si tienes CSS separado
    '/styles.css' 
];

self.addEventListener('install', event => {
  console.log('Service Worker: Evento Install - Abriendo cache...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        // Al precachear, si una URL falla, el SW no se instala.
        return cache.addAll(urlsToCache); 
      })
      .catch(error => {
        // MUY IMPORTANTE: Loggea el error para ver qué URL falló.
        console.error('Service Worker: Fallo en cache.addAll (URL no encontrada):', error);
      })
  );
});

// El resto del código (fetch y activate) puede quedar igual.

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
