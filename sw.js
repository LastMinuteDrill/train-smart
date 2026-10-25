// Train Smart offline copy. Pages and data come from the network first, so updates show right away;
// the saved copy (still encrypted) is used only when there's no connection.
const CACHE = "train-smart-68754dc23b19";
const SHELL = ["./", "manifest.webmanifest", "icon-192.png", "icon-512.png", "apple-touch-icon.png", "icon.svg", "data.enc"];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith("train-smart-") && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
// Something shared to Train Smart from Android's share sheet: the file (or text) is kept in this device's cache, never
// sent anywhere, and the page opens to pick it up and delete it
const SHARED = "ts-share";
async function takeShare(req) {
  try {
    const form = await req.formData(), box = await caches.open(SHARED);
    for (const k of await box.keys()) await box.delete(k);
    const file = form.getAll("file").find(f => f && typeof f === "object" && f.size > 0);
    if (file) await box.put("shared-file", new Response(file, { headers: { "Content-Type": file.type || "application/octet-stream", "X-Name": encodeURIComponent(file.name || "shared") } }));
    const text = ["title", "text", "url"].map(k => form.get(k)).filter(v => typeof v === "string" && v.trim()).join("\n");
    if (text) await box.put("shared-text", new Response(text, { headers: { "Content-Type": "text/plain; charset=utf-8" } }));
  } catch (err) {}
  return Response.redirect(new URL("./?share=1", self.registration.scope).href, 303);
}
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method === "POST" && new URL(req.url).pathname.endsWith("/share-target")) { e.respondWith(takeShare(req)); return; }
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
