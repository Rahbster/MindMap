const CACHE_NAME = 'mindmap-pwa-cache-v3';
const urlsToCache = [
    './',
    './index.html',
    './css/style.css',
    './css/quiz.css',
    './js/main.js',
    './js/QuizManager.js',
    './js/MindMapRenderer.js',
    './js/MindMapInteraction.js',
    './js/UIManager.js',
    './js/NodeManager.js',
    './modules/ai.json',
    './modules/ml.json',
    './modules/deep-learning.json',
    './modules/nlp.json',
    './modules/history-of-ai.json',
    './modules/computer-vision.json',
    './modules/generative-ai.json',
    './modules/applications.json',
    './modules/ethics.json',
    './modules/supervised.json',
    './modules/unsupervised.json',
    './modules/reinforcement.json',
    './modules/learning-paradigms.json',
    './manifest.json',
    './icons/icon-192x192.png',
    './icons/icon-512x512.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Caching all: app shell and content');
                return cache.addAll(urlsToCache);
            })
    );
});

self.addEventListener('message', (event) => {
    if (event.data && event.data.action === 'skipWaiting') {
        console.log('[Service Worker] Skipping waiting and activating new version.');
        self.skipWaiting();
        // After skipping waiting, we must claim the clients to take control immediately.
        self.clients.claim();
    }
});

self.addEventListener('fetch', (event) => {
    // Only apply caching strategy for GET requests.
    if (event.request.method !== 'GET') {
        return;
    }

    // "Cache First" (Cache, falling back to Network) strategy.
    event.respondWith(
        caches.match(event.request).then((response) => {
            // If the response is in the cache, return it.
            if (response) {
                return response;
            }
            // If it's not in the cache, fetch it from the network.
            return fetch(event.request).then((networkResponse) => {
                // And cache the new response for future use.
                return caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, networkResponse.clone());
                    return networkResponse;
                });
            });
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keyList) => {
            return Promise.all(keyList.map((key) => {
                if (key !== CACHE_NAME) {
                    console.log('[Service Worker] Removing old cache', key);
                    return caches.delete(key);
                }
            }));
        })
    );
    return self.clients.claim();
});