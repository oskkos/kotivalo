// Kotivalo's service worker, registered by the root route in production
// (src/routes/__root.tsx). It makes the app installable and does two things:
//
// 1. Keeps the build's hashed files (/assets/*) once fetched, so the
//    installed app starts fast. Their names change with their content, so
//    a cached copy is never stale.
// 2. Shows the offline page (/offline) when a page can't be loaded.
//
// It never caches pages, server function responses, /api/* or files: those
// may hold a signed-in user's data, which must not outlive sign-out on a
// shared device. Everything else goes straight to the network.
//
// A changed sw.js replaces the old one at once (skipWaiting, claim): it
// serves only immutable files and the offline page, so there's no old
// version for open tabs to depend on.

const ASSETS = 'kotivalo-assets-v1'
const PAGES = 'kotivalo-pages-v1'
const OFFLINE = '/offline'
/** Old builds' files are dropped beyond this many. */
const MAX_ASSETS = 120

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(PAGES)
      .then((cache) => cache.add(OFFLINE))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const current = [ASSETS, PAGES]
      for (const name of await caches.keys()) {
        if (!current.includes(name)) {
          await caches.delete(name)
        }
      }
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable()
      }
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') {
    return
  }
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) {
    return
  }
  if (request.mode === 'navigate') {
    event.respondWith(navigate(event))
  } else if (url.pathname.startsWith('/assets/')) {
    event.respondWith(asset(event))
  }
})

/** Pages always come from the network; the offline page if that fails. */
async function navigate(event) {
  try {
    const preloaded = await event.preloadResponse
    const response = preloaded ?? (await fetch(event.request))
    // Once per service worker start: refresh the offline page, in case its
    // text changed in a deploy.
    if (!refreshed) {
      refreshed = true
      event.waitUntil(refreshOfflinePage())
    }
    return response
  } catch {
    const offline = await caches.match(OFFLINE, { cacheName: PAGES })
    return offline ?? Response.error()
  }
}

let refreshed = false

async function refreshOfflinePage() {
  try {
    await (await caches.open(PAGES)).add(OFFLINE)
  } catch {
    // Keep the copy we have.
  }
}

/** Hashed build files: the cached copy, else the network's, kept. */
async function asset(event) {
  const cache = await caches.open(ASSETS)
  const cached = await cache.match(event.request)
  if (cached) {
    return cached
  }
  const response = await fetch(event.request)
  if (response.ok) {
    event.waitUntil(keep(cache, event.request, response.clone()))
  }
  return response
}

async function keep(cache, request, response) {
  await cache.put(request, response)
  const keys = await cache.keys()
  // Oldest first: drop what is over the limit.
  for (const key of keys.slice(0, Math.max(0, keys.length - MAX_ASSETS))) {
    await cache.delete(key)
  }
}
