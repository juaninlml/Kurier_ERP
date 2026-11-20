/* Service worker del kiosco (alcance /kiosco): permite instalarlo como app y muestra un aviso si no hay internet. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

const OFFLINE = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sin conexión</title><style>html,body{height:100%;margin:0}body{display:grid;place-items:center;background:#163a5c;color:#fff;font:16px system-ui,sans-serif;text-align:center}
small{opacity:.7}</style></head><body><div><h1>Sin conexión a internet</h1><p>El kiosco se reconectará solo.</p><small>Reintentando cada 10 segundos…</small></div>
<script>setTimeout(()=>location.reload(),10000)</script></body></html>`;

self.addEventListener("fetch", (event) => {
  // Solo las páginas; lo demás (acciones, archivos) va directo a la red
  if (event.request.mode !== "navigate") return;
  event.respondWith(fetch(event.request).catch(() => new Response(OFFLINE, { headers: { "Content-Type": "text/html; charset=utf-8" } })));
});
