/* Offline support. Pages open from the phone's cache, and quietly refresh in the background.
   After you upload a new version, open the app twice to see it. Change CACHE below to force a clean refresh. */
var CACHE = 'tj-shell-v7';
var FILES = [
  './', 'index.html', 'create.html', 'entry.html', 'calendar.html', 'library.html', 'progress.html', 'settings.html',
  'css/style.css',
  'js/store.js', 'js/ui.js', 'js/dashboard.js', 'js/create.js', 'js/entry.js', 'js/calendar.js', 'js/library.js', 'js/progress.js', 'js/settings.js',
  'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(FILES); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k.indexOf('tj-shell-') === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== location.origin) return;
  var key = new Request(url.origin + url.pathname); // ignore ?id=... so one copy serves every entry
  e.respondWith(
    caches.match(key).then(function (hit) {
      var fresh = fetch(req).then(function (res) {
        if (res && res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(key, copy); }); }
        return res;
      }).catch(function () { return hit; });
      return hit || fresh;
    })
  );
});
