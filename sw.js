// Service Worker für „Tuner“: hält die App offline verfügbar.
// Beim ersten Öffnen wird alles gespeichert. Danach startet die App aus dem Speicher
// und holt im Hintergrund neue Fassungen, die beim nächsten Start aktiv sind.
// Nach Änderungen VERSION erhöhen, dann wird der alte Speicher gelöscht.

var VERSION = 'tuner-2026-11-25-3';
var DATEIEN = [
  './', 'index.html', 'style.css', 'klang.js', 'stimmen.js', 'installieren.js', 'app.js', 'manifest.webmanifest',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png',
];

self.addEventListener('install', function (e) {
  // cache: 'reload' holt jede Datei frisch vom Server, nicht aus dem Zwischenspeicher des Browsers
  e.waitUntil(caches.open(VERSION).then(function (c) {
    return c.addAll(DATEIEN.map(function (u) { return new Request(u, { cache: 'reload' }); }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith(caches.open(VERSION).then(function (cache) {
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
