/**
 * Emergency Service Worker - Cache Clear Mode
 * This script is designed to kill old stuck caches (like v6) and force a fresh load.
 */

const CACHE_NAME = 'ledgerbot-v12-cleanup';

self.addEventListener('install', event => {
  // Immediately activate the new service worker
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    // Delete ALL existing caches to clear the "v6" mess
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(name => {
          console.log('Force deleting cache:', name);
          return caches.delete(name);
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  // Network-only strategy to ensure we bypass any cache and get the latest from server
  event.respondWith(fetch(event.request));
});
