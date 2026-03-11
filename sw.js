// Service Worker for PWA (Improved Cache Management)
const CACHE_NAME = 'finance-pwa-v2';
const ASSETS = [
    './index.html',
    './manifest.json'
];

self.addEventListener('install', (e) => {
    self.skipWaiting(); // 즉시 활성화
    e.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
});

self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        })
    );
});

self.addEventListener('fetch', (e) => {
    // index.html은 항상 최신 버전을 시도 (Network First)
    if (e.request.url.includes('index.html')) {
        e.respondWith(
            fetch(e.request).catch(() => caches.match(e.request))
        );
        return;
    }

    e.respondWith(
        caches.match(e.request).then((res) => {
            return res || fetch(e.request);
        })
    );
});
