// Train Smart offline copy. Pages and data come from the network first, so updates show right away;
// the saved copy (still encrypted) is used only when there's no connection.
const CACHE = "train-smart-e85eec046f0b";
const SHELL = ["./", "manifest.webmanifest", "icon-192.png", "icon-512.png", "apple-touch-icon.png", "icon.svg", "data.enc"];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith("train-smart-") && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    // "no-cache" asks GitHub whether the file changed, instead of reusing a copy for up to 10 minutes
    e.respondWith(fetch(new Request(req, { cache: "no-cache" })).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(hit => hit || (req.mode === "navigate" ? caches.match("./") : Response.error()))));
  } else if (url.hostname === "cdnjs.cloudflare.com") {
    // The PDF viewer library never changes at a given version, so the saved copy is used first
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy));
      return res;
    })));
  }
});
