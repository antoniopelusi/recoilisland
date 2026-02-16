const CACHE_NAME = "recoil-island";

const urlsToCache = [
    ".",
    "index.html",
    "assets/css/main.css",
    "assets/js/main.js",
    "favicon.ico",
    "assets/fonts/PixelifySans-Medium.ttf",
    "assets/fx/action.wav",
    "assets/fx/death.wav",
    "assets/fx/shot.wav",
    "assets/fx/startlevel.wav",
    "assets/img/blood.png",
    "assets/img/enemy.png",
    "assets/img/grass1.png",
    "assets/img/grass2.png",
    "assets/img/obstacle1.png",
    "assets/img/obstacle2.png",
    "assets/img/obstacle3.png",
    "assets/img/obstacle4.png",
    "assets/img/obstacle5.png",
    "assets/img/obstacle6.png",
    "assets/img/obstacle7.png",
    "assets/img/obstacle8.png",
    "assets/img/obstacle9.png",
    "assets/img/player.png",
    "assets/img/sand.png",
    "assets/img/water.png",
    "assets/maps/map0.json",
    "assets/maps/map1.json",
    "assets/maps/map2.json",
    "assets/maps/map3.json",
    "assets/maps/map4.json",
    "assets/maps/map5.json",
    "assets/maps/map6.json",
    "assets/maps/map7.json",
    "assets/maps/map8.json",
    "assets/maps/map9.json",
    "assets/icons/apple-touch-icon.png",
    "assets/icons/favicon.ico",
    "assets/icons/favicon.svg",
    "assets/icons/favicon-96x96.png",
    "assets/icons/web-app-manifest-192x192.png",
    "assets/icons/web-app-manifest-512x512.png",
    "site.webmanifest",
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            let successCount = 0;
            let failCount = 0;

            for (const url of urlsToCache) {
                try {
                    await cache.add(url);
                    successCount++;
                } catch (err) {
                    failCount++;
                }
            }
        }),
    );
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys
                    .filter((k) => k !== CACHE_NAME)
                    .map((k) => {
                        return caches.delete(k);
                    }),
            );
        }),
    );
    self.clients.claim();
});

self.addEventListener("fetch", (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            if (response) {
                return response;
            }

            return fetch(event.request)
                .then((response) => {
                    if (
                        response &&
                        response.status === 200 &&
                        event.request.method === "GET"
                    ) {
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(event.request, responseToCache);
                        });
                    }
                    return response;
                })
                .catch((err) => {
                    if (event.request.mode === "navigate") {
                        return caches.match("index.html");
                    }
                });
        }),
    );
});
