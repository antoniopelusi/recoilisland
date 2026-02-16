const CACHE_NAME = "recoil-island";
const urlsToCache = [
    "",
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
];

self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache)),
    );
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((keys) =>
                Promise.all(
                    keys
                        .filter((k) => k !== CACHE_NAME)
                        .map((k) => caches.delete(k)),
                ),
            ),
    );
    self.clients.claim();
});

self.addEventListener("fetch", (event) => {
    if (event.request.method !== "GET") return;
    event.respondWith(
        caches
            .match(event.request)
            .then((response) => response || fetch(event.request))
            .catch(() => caches.match("index.html")),
    );
});
