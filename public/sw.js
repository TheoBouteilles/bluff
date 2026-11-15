// Service worker de Bluff : rend l'application installable et accélère les visites suivantes.
// - Pages : réseau d'abord (toujours la dernière version), copie en cache seulement si hors ligne.
// - Fichiers versionnés (/assets/, /px/, polices) : cache d'abord, ils ne changent jamais sous le même nom.
// - Supabase et autres domaines : jamais interceptés (le jeu a besoin du serveur en direct).
const CACHE = 'bluff-v1'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put('/', copy))
          return res
        })
        .catch(() => caches.match('/').then((r) => r ?? Response.error())),
    )
    return
  }

  if (/^\/(assets|px|pwa|fonts)\//.test(url.pathname)) {
    e.respondWith(
      caches.match(req).then((hit) => hit ?? fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(req, copy))
        }
        return res
      })),
    )
  }
})
