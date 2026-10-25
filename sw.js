// Guarda el juego en el móvil para poder jugar sin internet.
// Sube el número de versión cada vez que cambies index.html.
const VERSION = "chapas-v4";
const ARCHIVOS = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  // Fuentes de Google: se guardan la primera vez que se descargan
  if (url.hostname.endsWith("googleapis.com") || url.hostname.endsWith("gstatic.com")) {
    e.respondWith(caches.open(VERSION).then(c => c.match(e.request).then(r => r || fetch(e.request).then(res => { c.put(e.request, res.clone()); return res; }))));
    return;
  }
  // El juego: primero intenta la red (para recibir cambios) y si no hay conexión usa la copia guardada
  e.respondWith(fetch(e.request).then(res => {
    const copia = res.clone();
    caches.open(VERSION).then(c => c.put(e.request, copia));
    return res;
  }).catch(() => caches.match(e.request).then(r => r || caches.match("index.html"))));
});
