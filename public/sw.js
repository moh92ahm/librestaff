self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// Phase 1 intentionally has no fetch handler or offline cache. Authenticated
// employee data always continues to come from the network.
