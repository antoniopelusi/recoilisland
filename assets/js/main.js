// =============================== CONFIGURATION ===============================
const CFG = {
    maxDt: 0.1,
    shootPower: 15,
    friction: 0.9,
    bulletSpeed: 10,
    cooldown: 0.25,
    playerRange: 5,
    enemyRange: 12,
    enemyShootMin: 1,
    enemyShootMax: 3,
    collisionRadius: 0.35,
    playerHitbox: 0.5,
    enemyHitbox: 0.5,
    bulletRadius: 0.15,
    drawRadius: 0.6,
    obstacleHalfSize: 0.4,
    obstacleCollisionHalf: 0.5,
    minSpawnDist: 3,
    countdownDur: 0.5,
    mapScale: 0.85,
    pauseSize: 40,
    pauseMargin: 20,
    maxEnemies: 10,
};

const COLORS = {
    bulletPlayer: "#f0f0f0",
    bulletEnemy: "#ff9a63",
    text: "#ffffff",
    overlay: "rgba(0,0,0,0.7)",
    overlayGreen: "rgba(0,100,0,0.7)",
    overlayRed: "rgba(100,0,0,0.7)",
    pauseBtn: "rgba(255,255,255,0.3)",
};

// ============================== UTILITY FUNCTIONS ==============================
const TAU = Math.PI * 2;
const { atan2, hypot, floor, ceil, round, random, abs, min, max } = Math;

const dist = (a, b) => hypot(b.x - a.x, b.y - a.y);
const angle = (a, b) => atan2(b.y - a.y, b.x - a.x);
const rand = (lo, hi) => lo + random() * (hi - lo);
const pick = (arr) => arr[(random() * arr.length) | 0];
const font = (size) => `${size}px "Pixelify Local"`;
const hitTest = (x, y, bx, by, bw, bh) =>
    x >= bx && x <= bx + bw && y >= by && y <= by + bh;
const cloneObs = (arr) => arr.map((o) => ({ x: o.x, y: o.y, img: o.img }));

function makeBullet(x, y, nx, ny, speed, range, isEnemy) {
    return {
        x,
        y,
        vx: nx * speed,
        vy: ny * speed,
        range,
        sx: x,
        sy: y,
        isEnemy,
    };
}

// =================================== ASSETS ===================================
const Assets = {
    grass1: null,
    grass2: null,
    water: null,
    sand: null,
    blood: null,
    obstacles: [],
    player: null,
    enemy: null,
    sfx: {
        death: null,
        startlevel: null,
        action: null,
        shotPool: [],
        shotIndex: 0,
        volume: 0.5,
    },

    async load() {
        const loadImg = (src) =>
            new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = () => resolve(img);
                img.onerror = () => reject(new Error(`Failed: ${src}`));
                img.src = src;
            });

        [
            this.grass1,
            this.grass2,
            this.water,
            this.sand,
            this.blood,
            this.player,
            this.enemy,
        ] = await Promise.all(
            [
                "grass1",
                "grass2",
                "water",
                "sand",
                "blood",
                "player",
                "enemy",
            ].map((n) => loadImg(`./../assets/img/${n}.png`)),
        );

        this.obstacles = await Promise.all(
            Array.from({ length: 9 }, (_, i) =>
                loadImg(`./../assets/img/obstacle${i + 1}.png`),
            ),
        );

        const sfx = this.sfx;
        sfx.death = new Audio("./../assets/fx/death.wav");
        sfx.startlevel = new Audio("./../assets/fx/startlevel.wav");
        sfx.action = new Audio("./../assets/fx/action.wav");

        for (let i = 0; i < 3; i++) {
            const audio = new Audio("./../assets/fx/shot.wav");
            audio.load();
            sfx.shotPool.push(audio);
        }

        sfx.death.load();
        sfx.startlevel.load();
        sfx.action.load();

        sfx.death.volume = this.sfx.volume;
        sfx.startlevel.volume = this.sfx.volume;
        sfx.action.volume = this.sfx.volume;

        for (let i = 0; i < sfx.shotPool.length; i++) {
            sfx.shotPool[i].volume = this.sfx.volume;
        }
    },

    playSound(sound) {
        const sfx = this.sfx;
        if (sound === "shot") {
            const audio = sfx.shotPool[sfx.shotIndex];
            audio.currentTime = 0;
            audio.play().catch(() => {});
            sfx.shotIndex = (sfx.shotIndex + 1) % 3;
        } else if (sfx[sound]) {
            sfx[sound].currentTime = 0;
            sfx[sound].play().catch(() => {});
        }
    },
};

// ==================================== MAP ====================================
const Map = {
    data: null,
    width: 30,
    height: 15,
    hw: 15,
    hh: 7.5,
    cache: null,
    obstacles: [],
    waterCache: null,
    bloodSpots: [],
    spawnCache: null,
    currentMapNum: null,

    async load(mapNum = null) {
        if (mapNum === null) mapNum = (random() * 10) | 0;
        this.currentMapNum = mapNum;
        const res = await fetch(`./../assets/maps/map${mapNum}.json`);
        this.data = (await res.json()).map;
        this.cache = null;
        this.waterCache = null;
        this.bloodSpots = [];
        this.spawnCache = null;
        this.generateObstacles();
        this.cacheSpawnPoints();
    },

    generateObstacles() {
        const { hw, hh, width, height, data } = this;
        this.obstacles = [];

        for (let y = 0; y < height; y++) {
            const row = data[y];
            for (let x = 0; x < width; x++) {
                if (row[x] === 3) {
                    this.obstacles.push({
                        x: x - hw + 0.5,
                        y: y - hh + 0.5,
                        img: pick(Assets.obstacles),
                    });
                }
            }
        }
    },

    cacheSpawnPoints() {
        const { hw, hh, width, height } = this;
        this.spawnCache = [];

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const wx = x - hw + 0.5;
                const wy = y - hh + 0.5;
                if (this.canFit(wx, wy)) {
                    this.spawnCache.push({ x: wx, y: wy });
                }
            }
        }
    },

    randomSpawn() {
        const sc = this.spawnCache;
        return sc && sc.length > 0 ? pick(sc) : { x: 0, y: 0 };
    },

    addBlood(x, y) {
        if (!this.cache) return;
        this.bloodSpots.push({ x, y });

        const tileSize = round(this.cache.width / this.width);
        const bx = round((x + this.hw - 0.5) * tileSize);
        const by = round((y + this.hh - 0.5) * tileSize);

        if (Assets.blood) {
            this.cache
                .getContext("2d")
                .drawImage(Assets.blood, bx, by, tileSize, tileSize);
        }
    },

    renderWaterCache(w, h, tileSize, ox, oy) {
        if (!Assets.water) return;
        tileSize = round(tileSize);
        this.waterCache = document.createElement("canvas");
        this.waterCache.width = w;
        this.waterCache.height = h;
        const ctx = this.waterCache.getContext("2d");
        ctx.imageSmoothingEnabled = false;

        const mapX = round(ox - (this.width * tileSize) / 2);
        const mapY = round(oy - (this.height * tileSize) / 2);
        const startX = (mapX % tileSize) - tileSize;
        const startY = (mapY % tileSize) - tileSize;
        const tilesX = ceil(w / tileSize) + 2;
        const tilesY = ceil(h / tileSize) + 2;
        const waterImg = Assets.water;

        for (let y = 0; y < tilesY; y++) {
            const py = startY + y * tileSize;
            for (let x = 0; x < tilesX; x++) {
                ctx.drawImage(
                    waterImg,
                    startX + x * tileSize,
                    py,
                    tileSize,
                    tileSize,
                );
            }
        }
    },

    renderCache(tileSize) {
        tileSize = round(tileSize);
        const { width, height, hw, hh, data, bloodSpots, obstacles } = this;
        const pxW = width * tileSize;
        const pxH = height * tileSize;

        this.cache = document.createElement("canvas");
        this.cache.width = pxW;
        this.cache.height = pxH;
        const ctx = this.cache.getContext("2d");
        ctx.imageSmoothingEnabled = false;

        const { grass1, grass2, water, sand, blood } = Assets;

        for (let y = 0; y < height; y++) {
            const row = data[y];
            const py = y * tileSize;
            for (let x = 0; x < width; x++) {
                const tile = row[x];
                const px = x * tileSize;

                if (tile === 0) {
                    if (water) ctx.drawImage(water, px, py, tileSize, tileSize);
                } else if (tile >= 1 && tile <= 3) {
                    if (grass1) {
                        const grass = (x + y) % 4 < 1 ? grass2 : grass1;
                        ctx.drawImage(grass, px, py, tileSize, tileSize);
                    }
                    if (tile === 2 && sand) {
                        ctx.drawImage(sand, px, py, tileSize, tileSize);
                    }
                }
            }
        }

        if (blood) {
            for (let i = 0; i < bloodSpots.length; i++) {
                const spot = bloodSpots[i];
                ctx.drawImage(
                    blood,
                    round((spot.x + hw - 0.5) * tileSize),
                    round((spot.y + hh - 0.5) * tileSize),
                    tileSize,
                    tileSize,
                );
            }
        }

        for (let i = 0; i < obstacles.length; i++) {
            const o = obstacles[i];
            if (o.img) {
                ctx.drawImage(
                    o.img,
                    round((o.x + hw - 0.5) * tileSize),
                    round((o.y + hh - 0.5) * tileSize),
                    tileSize,
                    tileSize,
                );
            }
        }
    },

    canFit(x, y, radius = CFG.collisionRadius) {
        const { hw, hh, width, height, data, obstacles } = this;
        const x0 = floor(x - radius + hw);
        const x1 = floor(x + radius + hw);
        const y0 = floor(y - radius + hh);
        const y1 = floor(y + radius + hh);

        for (let gy = y0; gy <= y1; gy++) {
            for (let gx = x0; gx <= x1; gx++) {
                if (gx < 0 || gx >= width || gy < 0 || gy >= height)
                    return false;
                const tile = data[gy][gx];
                if (tile < 1 || tile > 3) return false;
            }
        }

        const hs = CFG.obstacleCollisionHalf + radius;
        for (let i = 0; i < obstacles.length; i++) {
            const o = obstacles[i];
            if (abs(x - o.x) < hs && abs(y - o.y) < hs) return false;
        }

        return true;
    },

    hitsObstacle(x, y) {
        const h = CFG.obstacleHalfSize;
        const obs = this.obstacles;
        for (let i = 0; i < obs.length; i++) {
            const o = obs[i];
            if (abs(x - o.x) < h && abs(y - o.y) < h) return true;
        }
        return false;
    },
};

// ==================================== GAME ====================================
const Game = {
    canvas: null,
    ctx: null,
    state: "MENU",
    level: 1,
    best: 0,
    timer: 0,
    lastTime: 0,
    world: { w: 0, h: 0, scale: 1, ox: 0, oy: 0 },
    player: null,
    enemies: [],
    bullets: [],
    mouse: { x: 0, y: 0 },
    shooting: false,
    lastShot: 0,
    homeMapNum: null,
    homeObstacles: null,

    init() {
        this.canvas = document.querySelector("canvas");
        this.ctx = this.canvas.getContext("2d");
        this.best = +localStorage.getItem("best") || 0;
        this.setupEvents();
        this.loadHomeMap();
    },

    async loadHomeMap() {
        this.homeMapNum = (random() * 10) | 0;
        await Map.load(this.homeMapNum);
        this.homeObstacles = cloneObs(Map.obstacles);
        this.resize();
    },

    setupEvents() {
        const pointer = (x, y, type) => {
            if (type !== "end") {
                this.mouse.x = (x - this.world.ox) / this.world.scale;
                this.mouse.y = (y - this.world.oy) / this.world.scale;
            }
            if (type === "start") this.handleClick(x, y);
            else if (type === "end") this.shooting = false;
        };

        this.canvas.addEventListener("mousedown", (e) =>
            pointer(e.clientX, e.clientY, "start"),
        );
        this.canvas.addEventListener("mousemove", (e) =>
            pointer(e.clientX, e.clientY, "move"),
        );
        this.canvas.addEventListener("mouseup", () => pointer(0, 0, "end"));

        this.canvas.addEventListener(
            "touchstart",
            (e) => {
                e.preventDefault();
                pointer(e.touches[0].clientX, e.touches[0].clientY, "start");
            },
            { passive: false },
        );

        this.canvas.addEventListener(
            "touchmove",
            (e) => {
                e.preventDefault();
                pointer(e.touches[0].clientX, e.touches[0].clientY, "move");
            },
            { passive: false },
        );

        this.canvas.addEventListener("touchend", () => pointer(0, 0, "end"));

        addEventListener("keydown", (e) => {
            const k = e.key.toLowerCase();
            if (
                k === "p" &&
                (this.state === "PLAYING" || this.state === "PAUSED")
            ) {
                this.togglePause();
            }
            if (k === "f") this.toggleFullscreen();
        });

        addEventListener("resize", () => this.resize());
        document.addEventListener("fullscreenchange", () =>
            Assets.playSound("action"),
        );
        document.addEventListener("visibilitychange", () => {
            if (document.hidden && this.state === "PLAYING") {
                this.state = "PAUSED";
                this.shooting = false;
            }
        });
    },

    handleClick(x, y) {
        const { w, h, scale } = this.world;
        const s = CFG.pauseSize;
        const m = CFG.pauseMargin;
        const btnRight = w - s - m;

        if (hitTest(x, y, btnRight, m, s, s)) {
            this.toggleFullscreen();
            return;
        }

        if (
            this.state === "PLAYING" &&
            hitTest(x, y, btnRight, m + s + m, s, s)
        ) {
            this.togglePause();
            return;
        }

        if (this.state === "PAUSED") {
            const btnW = scale * 3;
            const btnH = scale * 0.9;
            const btnX = w / 2 - btnW / 2;
            const btnY = h / 2 + scale * 2.5;
            if (hitTest(x, y, btnX, btnY, btnW, btnH)) {
                this.state = "MENU";
                Assets.playSound("action");
                this.loadHomeMap();
                return;
            }
        }

        if (this.state === "MENU") {
            this.initLevel(1);
        } else if (this.state === "READY") {
            this.state = "PLAYING";
            this.lastTime = performance.now();
            Assets.playSound("startlevel");
        } else if (this.state === "PAUSED") {
            this.togglePause();
        } else if (this.state === "PLAYING") {
            this.shooting = true;
        }
    },

    togglePause() {
        if (this.state === "PLAYING") {
            this.state = "PAUSED";
            this.shooting = false;
        } else if (this.state === "PAUSED") {
            this.state = "PLAYING";
            this.lastTime = performance.now();
        }
        Assets.playSound("action");
    },

    toggleFullscreen() {
        Assets.playSound("action");
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen();
    },

    resize() {
        const dpr = devicePixelRatio || 1;
        const w = this.world;
        w.w = innerWidth;
        w.h = innerHeight;
        this.canvas.width = w.w * dpr;
        this.canvas.height = w.h * dpr;
        this.canvas.style.width = w.w + "px";
        this.canvas.style.height = w.h + "px";

        this.ctx.scale(dpr, dpr);
        this.ctx.imageSmoothingEnabled = false;
        w.scale = min(w.w / Map.width, w.h / Map.height) * CFG.mapScale;
        w.ox = w.w / 2;
        w.oy = w.h / 2;

        Map.renderWaterCache(w.w, w.h, w.scale, w.ox, w.oy);
        if (Map.data) Map.renderCache(w.scale);
    },

    async initLevel(lvl) {
        this.level = lvl;

        if (lvl === 1 && this.homeMapNum !== null) {
            await Map.load(this.homeMapNum);
            if (this.homeObstacles) {
                Map.obstacles = cloneObs(this.homeObstacles);
            }
        } else {
            await Map.load();
        }
        this.resize();

        this.player = { x: 0, y: 0, vx: 0, vy: 0, angle: 0 };
        this.enemies = [];
        this.bullets = [];

        const count = min(lvl, CFG.maxEnemies);
        for (let i = 0; i < count; i++) {
            let pos;
            do {
                pos = Map.randomSpawn();
            } while (dist(pos, this.player) < CFG.minSpawnDist);

            this.enemies.push({
                x: pos.x,
                y: pos.y,
                angle: random() * TAU,
                nextShot: 0,
            });
        }

        if (lvl === 1) {
            this.state = "PLAYING";
            this.lastTime = performance.now();
            Assets.playSound("startlevel");
        } else {
            this.state = "READY";
        }
    },

    update(dt, now) {
        const state = this.state;

        if (state === "COUNTDOWN") {
            if (now - this.timer > CFG.countdownDur) {
                this.state = "READY";
                this.initLevel(this.level + 1);
            }
            this.updateBullets(dt);
            return;
        }

        if (state === "READY") return;

        if (state === "LOST") {
            if (now - this.timer > CFG.countdownDur) {
                this.state = "MENU";
                this.loadHomeMap();
            }
            this.updateBullets(dt);
            return;
        }

        if (state !== "PLAYING") return;

        this.updatePlayer(dt, now);
        this.updateEnemies(now);
        this.updateBullets(dt);
        this.checkCollisions(now);
    },

    updatePlayer(dt, now) {
        const p = this.player;

        if (this.shooting && now - this.lastShot >= CFG.cooldown) {
            const dx = this.mouse.x - p.x;
            const dy = this.mouse.y - p.y;
            const len = hypot(dx, dy);

            if (len > 0.1) {
                const nx = dx / len;
                const ny = dy / len;

                this.bullets.push(
                    makeBullet(
                        p.x,
                        p.y,
                        nx,
                        ny,
                        CFG.bulletSpeed,
                        CFG.playerRange,
                        false,
                    ),
                );

                p.vx -= nx * CFG.shootPower;
                p.vy -= ny * CFG.shootPower;
                this.lastShot = now;
                Assets.playSound("shot");
            }
        }

        const nx = p.x + p.vx * dt;
        const ny = p.y + p.vy * dt;
        if (Map.canFit(nx, p.y)) p.x = nx;
        if (Map.canFit(p.x, ny)) p.y = ny;

        const friction = CFG.friction ** (dt * 60);
        p.vx *= friction;
        p.vy *= friction;
        p.angle = angle(p, this.mouse);
    },

    updateEnemies(now) {
        const player = this.player;
        const enemies = this.enemies;

        for (let i = 0; i < enemies.length; i++) {
            const e = enemies[i];
            const distance = dist(e, player);
            const inRange = distance <= CFG.enemyRange;

            if (inRange) {
                if (!e.lastInRange) {
                    e.nextShot =
                        now + rand(CFG.enemyShootMin, CFG.enemyShootMax);
                }

                e.angle = angle(e, player);

                if (now > e.nextShot) {
                    const dx = player.x - e.x;
                    const dy = player.y - e.y;
                    const len = hypot(dx, dy);

                    if (len > 0.1) {
                        const extra = max(0, this.level - CFG.maxEnemies);
                        const speed = CFG.bulletSpeed * (1 + extra * 0.05);

                        this.bullets.push(
                            makeBullet(
                                e.x,
                                e.y,
                                dx / len,
                                dy / len,
                                speed,
                                CFG.enemyRange,
                                true,
                            ),
                        );
                    }

                    e.nextShot =
                        now + rand(CFG.enemyShootMin, CFG.enemyShootMax);
                    Assets.playSound("shot");
                }
            }

            e.lastInRange = inRange;
        }
    },

    updateBullets(dt) {
        const bullets = this.bullets;
        for (let i = 0; i < bullets.length; i++) {
            const b = bullets[i];
            b.x += b.vx * dt;
            b.y += b.vy * dt;
        }
    },

    checkCollisions(now) {
        const player = this.player;
        const bullets = this.bullets;
        const enemies = this.enemies;
        let write = 0;

        for (let i = 0; i < bullets.length; i++) {
            const b = bullets[i];

            if (hypot(b.x - b.sx, b.y - b.sy) > b.range) continue;
            if (Map.hitsObstacle(b.x, b.y)) continue;

            let hit = false;

            if (b.isEnemy) {
                if (hypot(b.x - player.x, b.y - player.y) < CFG.playerHitbox) {
                    Map.addBlood(player.x, player.y);
                    this.state = "LOST";
                    this.timer = now;
                    hit = true;
                    Assets.playSound("death");
                }
            } else {
                for (let j = 0; j < enemies.length; j++) {
                    const e = enemies[j];
                    if (hypot(b.x - e.x, b.y - e.y) < CFG.enemyHitbox) {
                        Map.addBlood(e.x, e.y);
                        enemies.splice(j, 1);
                        hit = true;
                        Assets.playSound("death");

                        if (enemies.length === 0) {
                            if (this.level > this.best) {
                                this.best = this.level;
                                localStorage.setItem("best", this.best);
                            }
                            this.state = "COUNTDOWN";
                            this.timer = now;
                        }
                        break;
                    }
                }
            }

            if (!hit) bullets[write++] = b;
        }

        bullets.length = write;
    },

    drawEntity(entity, isPlayer) {
        const { ox, oy, scale } = this.world;
        const sx = round(ox + entity.x * scale);
        const sy = round(oy + entity.y * scale);
        const radius = round(scale * CFG.drawRadius);
        const img = isPlayer ? Assets.player : Assets.enemy;

        if (img) {
            const ctx = this.ctx;
            ctx.save();
            ctx.translate(sx, sy);
            ctx.rotate(entity.angle);
            ctx.drawImage(img, -radius, -radius, radius * 2, radius * 2);
            ctx.restore();
        }
    },

    drawBullet(bullet) {
        const { ox, oy, scale } = this.world;
        const sx = round(ox + bullet.x * scale);
        const sy = round(oy + bullet.y * scale);
        const radius = round(scale * CFG.bulletRadius);
        const ctx = this.ctx;

        ctx.beginPath();
        ctx.arc(sx, sy, radius, 0, TAU);
        ctx.fillStyle = bullet.isEnemy
            ? COLORS.bulletEnemy
            : COLORS.bulletPlayer;
        ctx.fill();
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 1;
        ctx.stroke();
    },

    drawFullscreenIcon(x1, y1, s) {
        const ctx = this.ctx;
        const p = s * 0.25;
        const c = s * 0.3;

        ctx.fillStyle = COLORS.pauseBtn;
        ctx.fillRect(x1, y1, s, s);
        ctx.strokeStyle = COLORS.text;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x1 + p, y1 + p + c);
        ctx.lineTo(x1 + p, y1 + p);
        ctx.lineTo(x1 + p + c, y1 + p);
        ctx.moveTo(x1 + s - p - c, y1 + p);
        ctx.lineTo(x1 + s - p, y1 + p);
        ctx.lineTo(x1 + s - p, y1 + p + c);
        ctx.moveTo(x1 + s - p, y1 + s - p - c);
        ctx.lineTo(x1 + s - p, y1 + s - p);
        ctx.lineTo(x1 + s - p - c, y1 + s - p);
        ctx.moveTo(x1 + p + c, y1 + s - p);
        ctx.lineTo(x1 + p, y1 + s - p);
        ctx.lineTo(x1 + p, y1 + s - p - c);
        ctx.stroke();
    },

    drawUI() {
        const ctx = this.ctx;
        const s = CFG.pauseSize;
        const m = CFG.pauseMargin;
        const x1 = this.world.w - s - m;
        const y2 = m + s + m;

        this.drawFullscreenIcon(x1, m, s);

        ctx.fillStyle = COLORS.pauseBtn;
        ctx.fillRect(x1, y2, s, s);
        ctx.fillStyle = COLORS.text;
        const bw = s * 0.2;
        const bh = s * 0.5;
        const gap = s * 0.15;
        ctx.fillRect(x1 + s / 2 - gap - bw, y2 + s / 4, bw, bh);
        ctx.fillRect(x1 + s / 2 + gap, y2 + s / 4, bw, bh);
    },

    drawOverlay(main, sub, showHome, overlayColor) {
        const ctx = this.ctx;
        const { w, h, scale } = this.world;
        const dim = min(w, h);

        ctx.fillStyle = overlayColor || COLORS.overlay;
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = COLORS.text;
        ctx.textAlign = "center";
        ctx.font = font(max(24, dim * 0.08));
        ctx.fillText(main, w / 2, h / 2);

        if (sub) {
            ctx.font = font(max(14, dim * 0.04));
            ctx.fillText(sub, w / 2, h / 2 + scale * 1.5);
        }

        if (showHome) {
            const btnW = scale * 3;
            const btnH = scale * 0.9;
            const btnX = w / 2 - btnW / 2;
            const btnY = h / 2 + scale * 2.5;
            ctx.fillStyle = COLORS.pauseBtn;
            ctx.fillRect(btnX, btnY, btnW, btnH);
            ctx.fillStyle = COLORS.text;
            ctx.font = font(scale * 0.6);
            ctx.fillText("HOME", w / 2, h / 2 + scale * 3.15);
        }
    },

    drawMap() {
        const { scale, ox, oy } = this.world;
        const pxW = round(Map.width * scale);
        const pxH = round(Map.height * scale);
        if (Map.cache)
            this.ctx.drawImage(
                Map.cache,
                round(ox - pxW / 2),
                round(oy - pxH / 2),
                pxW,
                pxH,
            );
    },

    draw() {
        const ctx = this.ctx;
        const state = this.state;
        const { w, h, scale } = this.world;
        const cx = w / 2;
        const cy = h / 2;
        ctx.imageSmoothingEnabled = false;

        if (Map.waterCache) ctx.drawImage(Map.waterCache, 0, 0);

        this.drawMap();

        if (state === "MENU") {
            this.drawOverlay("Recoil Island", null);

            const dim = min(w, h);
            const tipSize = max(14, dim * 0.04);
            const tipY = cy + tipSize * 3;

            ctx.fillStyle = COLORS.text;
            ctx.font = font(tipSize);
            ctx.textAlign = "center";
            ctx.fillText("click to start", cx, tipY);
            ctx.fillText("use landscape mode", cx, tipY + tipSize * 1.3);
            ctx.fillText("and enable fullscreen", cx, tipY + tipSize * 2.6);

            this.drawFullscreenIcon(
                w - CFG.pauseSize - CFG.pauseMargin,
                CFG.pauseMargin,
                CFG.pauseSize,
            );
            return;
        }

        if (state !== "READY") {
            const enemies = this.enemies;
            for (let i = 0; i < enemies.length; i++)
                this.drawEntity(enemies[i], false);
            if (state !== "LOST") this.drawEntity(this.player, true);
        }

        const bullets = this.bullets;
        for (let i = 0; i < bullets.length; i++) this.drawBullet(bullets[i]);

        if (
            state === "PLAYING" ||
            state === "COUNTDOWN" ||
            state === "READY" ||
            state === "PAUSED"
        ) {
            ctx.fillStyle = COLORS.text;
            ctx.font = font(max(16, scale * 0.6));
            ctx.textAlign = "left";
            ctx.fillText(`LEVEL: ${this.level}`, 20, 40);
            ctx.fillText(`BEST: ${this.best}`, 20, 70);
            this.drawUI();
        }

        if (state === "LOST")
            this.drawOverlay("GAME OVER", null, false, COLORS.overlayRed);
        else if (state === "COUNTDOWN")
            this.drawOverlay(
                "LEVEL COMPLETE",
                null,
                false,
                COLORS.overlayGreen,
            );
        else if (state === "READY")
            this.drawOverlay(`LEVEL ${this.level}`, "CLICK TO START");
        else if (state === "PAUSED")
            this.drawOverlay("PAUSED", "CLICK TO RESUME", true);
    },
};

// ================================= MAIN LOOP =================================
const loop = (t) => {
    const now = t / 1000;
    const dt = min((t - Game.lastTime) / 1000, CFG.maxDt);
    Game.lastTime = t;

    Game.update(dt, now);
    Game.draw();

    requestAnimationFrame(loop);
};

// =============================== INITIALIZATION ===============================
(async () => {
    await Assets.load();
    await Map.load();
    Game.init();

    if ("serviceWorker" in navigator) {
        window.addEventListener("load", () => {
            navigator.serviceWorker
                .register("service-worker.js")
                .then((reg) => console.log("SW ready:", reg.scope))
                .catch((err) => console.error("SW not ready:", err));
        });
    }

    requestAnimationFrame(loop);
})();
