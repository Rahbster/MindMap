const CACHE_NAME = 'mindmap-pwa-cache-v6';
const urlsToCache = [
    './',
    './index.html',
    './css/style.css',
    './css/base.css',
    './css/quiz.css',
    './css/components/content.css',
    './css/components/mindmap.css',
    './css/components/modals.css',
    './css/components/sidenav.css',
    './css/components/theme.css',
    './js/main.js',
    './js/QuizManager.js',
    './js/MindMapRenderer.js',
    './js/MindMapInteraction.js',
    './js/UIManager.js',
    './js/NodeManager.js',
    './js/StateManager.js',
    './js/ModuleLoader.js',
    './js/SearchHandler.js',
    './js/editor.js',
    './README.md',
    // Top-Level Modules
    './modules/ai.json',
    './modules/web-development.json',
    // AI Sub-modules
    './modules/ai/applications.json',
    './modules/ai/ethics.json',
    './modules/ai/history-of-ai.json',
    './modules/ai/learning-paradigms.json',
    './modules/ai/ml.json',
    './modules/ai/programming-with-ai.json',
    // AI/Applications Sub-modules
    './modules/ai/applications/computer-vision.json',
    './modules/ai/applications/generative-ai.json',
    './modules/ai/applications/nlp.json',
    // AI/ML Sub-modules
    './modules/ai/ml/deep-learning.json',
    './modules/ai/ml/reinforcement.json',
    './modules/ai/ml/supervised.json',
    './modules/ai/ml/unsupervised.json',
    // Web Dev Sub-modules
    './modules/web-development/css.json',
    './modules/web-development/html.json',
    // .NET Sub-modules
    './modules/dotnet.json',
    './modules/dotnet/web-rendering-models.json',
    './modules/dotnet/blazor.json',
    './modules/dotnet/razor-syntax.json',
    // Manifest and Icons
    './manifest.json',
    './icons/icon-192x192.png',
    './icons/icon-512x512.png'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Caching all: app shell and content');
                // Use custom fetch to bypass browser HTTP cache.
                const cachePromises = urlsToCache.map((url) => {
                    return fetch(url, { cache: 'reload' }).then((response) => {
                        if (!response.ok) throw new Error(`Request for ${url} failed with status ${response.status}`);
                        return cache.put(url, response);
                    });
                });
                return Promise.all(cachePromises);
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