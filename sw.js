// Service Worker für „Tuner“: hält die App offline verfügbar.
// Beim ersten Öffnen wird alles gespeichert. Danach startet die App aus dem Speicher
// und holt im Hintergrund neue Fassungen, die beim nächsten Start aktiv sind.
// Nach Änderungen VERSION erhöhen, dann wird der alte Speicher gelöscht.
//
// Auf GitHub Pages teilen sich alle Apps eines Kontos eine Adresse (DEIN-NAME.github.io) und damit den
// Speicher. Deshalb löscht dieser Service Worker nur eigene Speicher (tuner-…) und füllt seinen eigenen
// wieder auf, falls eine andere App ihn gelöscht hat.

var VERSION = 'tuner-2026-11-25-4';
var DATEIEN = [
  './', 'index.html', 'style.css', 'klang.js', 'stimmen.js', 'installieren.js', 'app.js', 'manifest.webmanifest',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png',
];

function allesLaden(c) {
  // cache: 'reload' holt jede Datei frisch vom Server, nicht aus dem Zwischenspeicher des Browsers
  return c.addAll(DATEIEN.map(function (u) { return new Request(u, { cache: 'reload' }); }));
}

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(allesLaden).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k.indexOf('tuner-') === 0 && k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(caches.open(VERSION).then(function (cache) {
    // Fehlt die Startseite im Speicher, hat ihn jemand geleert: im Hintergrund alles neu holen
    if (req.mode === 'navigate') {
      e.waitUntil(cache.match('index.html').then(function (da) { return da ? null : allesLaden(cache).catch(function () { /* offline */ }); }));
    }
    return cache.match(req, { ignoreSearch: true }).then(function (treffer) {
      var netz = fetch(req).then(function (res) {
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      }).catch(function () { return null; });
      if (treffer) { e.waitUntil(netz); return treffer; }
      return netz.then(function (res) {
        return res || (req.mode === 'navigate' ? cache.match('index.html') : Response.error());
      });
    });
  }));
});
