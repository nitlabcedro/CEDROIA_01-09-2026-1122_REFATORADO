// Service worker do Cedro IA: HTML sempre tenta a rede primeiro;
// JS/CSS versionados em /assets/ podem ser servidos do cache.
const CACHE_NAME = "cedro-ia-cache-v2";
const ASSETS_BASICOS = ["/manifest.webmanifest", "/192x192IA.png", "/512X512IA.png"];

function ehNavegacao(request) {
  return request.mode === "navigate"
    || request.destination === "document"
    || (request.headers.get("accept") || "").includes("text/html");
}

function ehAssetVersionado(url) {
  return url.pathname.startsWith("/assets/");
}

function ehPedidoDaApi(url) {
  return url.pathname.startsWith("/api/");
}

function buscarRedePrimeiro(request, armazenar) {
  return fetch(request)
    .then((respostaRede) => {
      if (armazenar && respostaRede && respostaRede.ok) {
        const clone = respostaRede.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
      }
      return respostaRede;
    })
    .catch(() => caches.match(request));
}

function buscarCachePrimeiro(request) {
  return caches.match(request).then((respostaCache) => {
    if (respostaCache) return respostaCache;

    return fetch(request).then((respostaRede) => {
      if (respostaRede && respostaRede.ok) {
        const clone = respostaRede.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
      }
      return respostaRede;
    });
  });
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS_BASICOS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((chaves) =>
      Promise.all(chaves.filter((chave) => chave !== CACHE_NAME).map((chave) => caches.delete(chave)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (ehPedidoDaApi(url)) return;
  if (url.pathname.endsWith("/sw.js")) return;

  if (ehNavegacao(event.request) || url.pathname === "/" || url.pathname.endsWith(".html")) {
    event.respondWith(buscarRedePrimeiro(event.request, true));
    return;
  }

  if (ehAssetVersionado(url)) {
    event.respondWith(buscarCachePrimeiro(event.request));
    return;
  }

  event.respondWith(buscarRedePrimeiro(event.request, true));
});
