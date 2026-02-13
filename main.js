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

const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
const angle = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
const rand = (min, max) => min + Math.random() * (max - min);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const hitTest = (x, y, bx, by, bw, bh) =>
    x >= bx && x <= bx + bw && y >= by && y <= by + bh;

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
        ] = await Promise.all([
            loadImg("assets/img/grass1.png"),
            loadImg("assets/img/grass2.png"),
            loadImg("assets/img/water.png"),
            loadImg("assets/img/sand.png"),
            loadImg("assets/img/blood.png"),
            loadImg("assets/img/player.png"),
            loadImg("assets/img/enemy.png"),
        ]);

        this.obstacles = await Promise.all(
            Array.from({ length: 9 }, (_, i) =>
                loadImg(`assets/img/obstacle${i + 1}.png`),
            ),
        );

        this.sfx.death = new Audio("assets/fx/death.wav");
        this.sfx.startlevel = new Audio("assets/fx/startlevel.wav");
        this.sfx.action = new Audio("assets/fx/action.wav");

        for (let i = 0; i < 3; i++) {
            const audio = new Audio("assets/fx/shot.wav");
            audio.load();
            this.sfx.shotPool.push(audio);
        }

        this.sfx.death.load();
        this.sfx.startlevel.load();
        this.sfx.action.load();
    },

    playSound(sound) {
        if (sound === "shot") {
            const audio = this.sfx.shotPool[this.sfx.shotIndex];
            audio.currentTime = 0;
            audio.play().catch(() => {});
            this.sfx.shotIndex = (this.sfx.shotIndex + 1) % 3;
        } else if (this.sfx[sound]) {
            this.sfx[sound].currentTime = 0;
            this.sfx[sound].play().catch(() => {});
        }
    },
};

// ==================================== MAP ====================================

const Map = {
    data: null,
    width: 30,
    height: 15,
    cache: null,
    obstacles: [],
    waterCache: null,
    bloodSpots: [],
    spawnCache: null,
    currentMapNum: null,
    savedObstacles: null,

    async load(mapNum = null) {
        if (mapNum === null) {
            mapNum = Math.floor(Math.random() * 10);
        }
        this.currentMapNum = mapNum;
        const res = await fetch(`assets/maps/map${mapNum}.json`);
        this.data = (await res.json()).map;
        this.cache = null;
        this.waterCache = null;
        this.bloodSpots = [];
        this.spawnCache = null;
        this.generateObstacles();
        this.cacheSpawnPoints();
    },

    generateObstacles() {
        const hw = this.width / 2;
        const hh = this.height / 2;
        this.obstacles = [];

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                if (this.data[y][x] === 3) {
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
        const hw = this.width / 2;
        const hh = this.height / 2;
        this.spawnCache = [];

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const wx = x - hw + 0.5;
                const wy = y - hh + 0.5;
                if (this.canFit(wx, wy)) {
                    this.spawnCache.push({ x: wx, y: wy });
                }
            }
        }
    },

    randomSpawn() {
        return this.spawnCache && this.spawnCache.length > 0
            ? pick(this.spawnCache)
            : { x: 0, y: 0 };
    },

    addBlood(x, y) {
        if (!this.cache) return;

        this.bloodSpots.push({ x, y });

        const hw = this.width / 2;
        const hh = this.height / 2;
        const tileSize = Math.round(this.cache.width / this.width);
        const bx = Math.round((x + hw - 0.5) * tileSize);
        const by = Math.round((y + hh - 0.5) * tileSize);

        const ctx = this.cache.getContext("2d");
        if (Assets.blood) {
            ctx.drawImage(Assets.blood, bx, by, tileSize, tileSize);
        }
    },

    renderWaterCache(w, h, tileSize, ox, oy) {
        if (!Assets.water) return;
        tileSize = Math.round(tileSize);
        this.waterCache = document.createElement("canvas");
        this.waterCache.width = w;
        this.waterCache.height = h;
        const ctx = this.waterCache.getContext("2d");
        ctx.imageSmoothingEnabled = false;

        const mapPxW = this.width * tileSize;
        const mapPxH = this.height * tileSize;
        const mapX = Math.round(ox - mapPxW / 2);
        const mapY = Math.round(oy - mapPxH / 2);
        const startX = (mapX % tileSize) - tileSize;
        const startY = (mapY % tileSize) - tileSize;
        const tilesX = Math.ceil(w / tileSize) + 2;
        const tilesY = Math.ceil(h / tileSize) + 2;

        for (let y = 0; y < tilesY; y++) {
            for (let x = 0; x < tilesX; x++) {
                ctx.drawImage(
                    Assets.water,
                    startX + x * tileSize,
                    startY + y * tileSize,
                    tileSize,
                    tileSize,
                );
            }
        }
    },

    renderCache(tileSize) {
        tileSize = Math.round(tileSize);
        const pxW = this.width * tileSize;
        const pxH = this.height * tileSize;
        const hw = this.width / 2;
        const hh = this.height / 2;

        this.cache = document.createElement("canvas");
        this.cache.width = pxW;
        this.cache.height = pxH;
        const ctx = this.cache.getContext("2d");
        ctx.imageSmoothingEnabled = false;

        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const tile = this.data[y][x];
                const useGrass2 = (x + y) % 4 < 1;

                if (tile === 0 && Assets.water) {
                    ctx.drawImage(
                        Assets.water,
                        x * tileSize,
                        y * tileSize,
                        tileSize,
                        tileSize,
                    );
                } else if (
                    (tile === 1 || tile === 2 || tile === 3) &&
                    Assets.grass1
                ) {
                    const grass = useGrass2 ? Assets.grass2 : Assets.grass1;
                    ctx.drawImage(
                        grass,
                        x * tileSize,
                        y * tileSize,
                        tileSize,
                        tileSize,
                    );
                }
            }
        }

        if (Assets.sand) {
            for (let y = 0; y < this.height; y++) {
                for (let x = 0; x < this.width; x++) {
                    if (this.data[y][x] === 2) {
                        ctx.drawImage(
                            Assets.sand,
                            x * tileSize,
                            y * tileSize,
                            tileSize,
                            tileSize,
                        );
                    }
                }
            }
        }

        for (const spot of this.bloodSpots) {
            const bx = Math.round((spot.x + hw - 0.5) * tileSize);
            const by = Math.round((spot.y + hh - 0.5) * tileSize);
            if (Assets.blood) {
                ctx.drawImage(Assets.blood, bx, by, tileSize, tileSize);
            }
        }

        for (const obstacle of this.obstacles) {
            const ox = Math.round((obstacle.x + hw - 0.5) * tileSize);
            const oy = Math.round((obstacle.y + hh - 0.5) * tileSize);
            if (obstacle.img) {
                ctx.drawImage(obstacle.img, ox, oy, tileSize, tileSize);
            }
        }
    },

    canFit(x, y, radius = CFG.collisionRadius) {
        const hw = this.width / 2;
        const hh = this.height / 2;
        const x0 = Math.floor(x - radius + hw);
        const x1 = Math.floor(x + radius + hw);
        const y0 = Math.floor(y - radius + hh);
        const y1 = Math.floor(y + radius + hh);

        for (let gy = y0; gy <= y1; gy++) {
            for (let gx = x0; gx <= x1; gx++) {
                if (gx < 0 || gx >= this.width || gy < 0 || gy >= this.height)
                    return false;
                const tile = this.data[gy][gx];
                if (tile !== 1 && tile !== 2 && tile !== 3) return false;
            }
        }

        for (const obstacle of this.obstacles) {
            const hs = CFG.obstacleCollisionHalf + radius;
            if (Math.abs(x - obstacle.x) < hs && Math.abs(y - obstacle.y) < hs)
                return false;
        }

        return true;
    },

    hitsObstacle(x, y) {
        const h = CFG.obstacleHalfSize;
        return this.obstacles.some(
            (o) => Math.abs(x - o.x) < h && Math.abs(y - o.y) < h,
        );
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
        this.homeMapNum = Math.floor(Math.random() * 10);
        const res = await fetch(`assets/maps/map${this.homeMapNum}.json`);
        Map.data = (await res.json()).map;
        Map.currentMapNum = this.homeMapNum;
        Map.cache = null;
        Map.waterCache = null;
        Map.bloodSpots = [];
        Map.generateObstacles();
        this.homeObstacles = Map.obstacles.map((obs) => ({
            x: obs.x,
            y: obs.y,
            img: obs.img,
        }));
        Map.cacheSpawnPoints();
        this.resize();
    },

    setupEvents() {
        const pointer = (x, y, type) => {
            if (type !== "end") {
                this.mouse = {
                    x: (x - this.world.ox) / this.world.scale,
                    y: (y - this.world.oy) / this.world.scale,
                };
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
            if (
                (e.key === "p" || e.key === "P") &&
                (this.state === "PLAYING" || this.state === "PAUSED")
            ) {
                this.togglePause();
            }
            if (e.key === "f" || e.key === "F") {
                Assets.playSound("action");
                if (document.fullscreenElement) document.exitFullscreen();
                else document.documentElement.requestFullscreen();
            }
        });

        addEventListener("resize", () => this.resize());

        document.addEventListener("fullscreenchange", () => {
            Assets.playSound("action");
        });

        document.addEventListener("visibilitychange", () => {
            if (document.hidden && this.state === "PLAYING") {
                this.state = "PAUSED";
                this.shooting = false;
            }
        });
    },

    handleClick(x, y) {
        const s = CFG.pauseSize;
        const m = CFG.pauseMargin;

        if (hitTest(x, y, this.world.w - s - m, m, s, s)) {
            Assets.playSound("action");
            if (document.fullscreenElement) document.exitFullscreen();
            else document.documentElement.requestFullscreen();
            return;
        }

        if (
            this.state === "PLAYING" &&
            hitTest(x, y, this.world.w - s - m, m + s + m, s, s)
        ) {
            this.togglePause();
            return;
        }

        if (this.state === "PAUSED") {
            const btnW = this.world.scale * 3;
            const btnH = this.world.scale * 0.9;
            const btnX = this.world.w / 2 - btnW / 2;
            const btnY = this.world.h / 2 + this.world.scale * 2.5;
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
            Assets.playSound("action");
        } else if (this.state === "PAUSED") {
            this.state = "PLAYING";
            this.lastTime = performance.now();
            Assets.playSound("action");
        }
    },

    resize() {
        const dpr = devicePixelRatio || 1;
        this.world.w = innerWidth;
        this.world.h = innerHeight;
        this.canvas.width = this.world.w * dpr;
        this.canvas.height = this.world.h * dpr;
        this.canvas.style.width = this.world.w + "px";
        this.canvas.style.height = this.world.h + "px";

        this.ctx.scale(dpr, dpr);
        this.ctx.imageSmoothingEnabled = false;
        this.world.scale =
            Math.min(this.world.w / Map.width, this.world.h / Map.height) *
            CFG.mapScale;
        this.world.ox = this.world.w / 2;
        this.world.oy = this.world.h / 2;

        Map.renderWaterCache(
            this.world.w,
            this.world.h,
            this.world.scale,
            this.world.ox,
            this.world.oy,
        );
        if (Map.data) Map.renderCache(this.world.scale);
    },

    async initLevel(lvl) {
        this.level = lvl;
        if (lvl === 1 && this.homeMapNum !== null) {
            await Map.load(this.homeMapNum);
            if (this.homeObstacles) {
                Map.obstacles = this.homeObstacles.map((obs) => ({
                    x: obs.x,
                    y: obs.y,
                    img: obs.img,
                }));
            }
        } else {
            await Map.load();
        }
        this.resize();

        this.player = { x: 0, y: 0, vx: 0, vy: 0, angle: 0 };
        this.enemies = [];
        this.bullets = [];

        const count = Math.min(lvl, CFG.maxEnemies);
        for (let i = 0; i < count; i++) {
            let pos;
            do {
                pos = Map.randomSpawn();
            } while (dist(pos, this.player) < CFG.minSpawnDist);

            this.enemies.push({
                x: pos.x,
                y: pos.y,
                angle: Math.random() * Math.PI * 2,
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
        if (this.state === "COUNTDOWN") {
            if (now - this.timer > CFG.countdownDur) {
                this.initLevel(this.level + 1);
            }
            this.updateBullets(dt);
            return;
        }

        if (this.state === "READY") {
            return;
        }

        if (this.state === "LOST") {
            if (now - this.timer > CFG.countdownDur) {
                this.state = "MENU";
                this.loadHomeMap();
            }
            this.updateBullets(dt);
            return;
        }

        if (this.state !== "PLAYING") return;

        this.updatePlayer(dt, now);
        this.updateEnemies(now);
        this.updateBullets(dt);
        this.checkCollisions(now);
    },

    updatePlayer(dt, now) {
        const player = this.player;

        if (this.shooting && now - this.lastShot >= CFG.cooldown) {
            const dx = this.mouse.x - player.x;
            const dy = this.mouse.y - player.y;
            const len = Math.hypot(dx, dy);

            if (len > 0.1) {
                const nx = dx / len;
                const ny = dy / len;

                this.bullets.push({
                    x: player.x,
                    y: player.y,
                    vx: nx * CFG.bulletSpeed,
                    vy: ny * CFG.bulletSpeed,
                    range: CFG.playerRange,
                    sx: player.x,
                    sy: player.y,
                    isEnemy: false,
                });

                player.vx -= nx * CFG.shootPower;
                player.vy -= ny * CFG.shootPower;
                this.lastShot = now;
                Assets.playSound("shot");
            }
        }

        const nx = player.x + player.vx * dt;
        const ny = player.y + player.vy * dt;
        if (Map.canFit(nx, player.y)) player.x = nx;
        if (Map.canFit(player.x, ny)) player.y = ny;

        const friction = CFG.friction ** (dt * 60);
        player.vx *= friction;
        player.vy *= friction;
        player.angle = angle(player, this.mouse);
    },

    updateEnemies(now) {
        const player = this.player;

        for (const enemy of this.enemies) {
            const distance = dist(enemy, player);
            const inRange = distance <= CFG.enemyRange;

            if (inRange) {
                if (!enemy.lastInRange) {
                    enemy.nextShot =
                        now + rand(CFG.enemyShootMin, CFG.enemyShootMax);
                }

                enemy.angle = angle(enemy, player);

                if (now > enemy.nextShot) {
                    const dx = player.x - enemy.x;
                    const dy = player.y - enemy.y;
                    const len = Math.hypot(dx, dy);

                    if (len > 0.1) {
                        const nx = dx / len;
                        const ny = dy / len;
                        const extra = Math.max(0, this.level - CFG.maxEnemies);
                        const speed = CFG.bulletSpeed * (1 + extra * 0.05);

                        this.bullets.push({
                            x: enemy.x,
                            y: enemy.y,
                            vx: nx * speed,
                            vy: ny * speed,
                            range: CFG.enemyRange,
                            sx: enemy.x,
                            sy: enemy.y,
                            isEnemy: true,
                        });
                    }

                    enemy.nextShot =
                        now + rand(CFG.enemyShootMin, CFG.enemyShootMax);
                    Assets.playSound("shot");
                }
            }

            enemy.lastInRange = inRange;
        }
    },

    updateBullets(dt) {
        for (const bullet of this.bullets) {
            bullet.x += bullet.vx * dt;
            bullet.y += bullet.vy * dt;
        }
    },

    checkCollisions(now) {
        const player = this.player;
        const alive = [];

        for (const bullet of this.bullets) {
            if (
                Math.hypot(bullet.x - bullet.sx, bullet.y - bullet.sy) >
                bullet.range
            ) {
                continue;
            }

            if (Map.hitsObstacle(bullet.x, bullet.y)) {
                continue;
            }

            let hit = false;

            if (bullet.isEnemy) {
                if (dist(bullet, player) < CFG.playerHitbox) {
                    Map.addBlood(player.x, player.y);
                    this.state = "LOST";
                    this.timer = now;
                    hit = true;
                    Assets.playSound("death");
                }
            } else {
                for (let i = 0; i < this.enemies.length; i++) {
                    if (dist(bullet, this.enemies[i]) < CFG.enemyHitbox) {
                        Map.addBlood(this.enemies[i].x, this.enemies[i].y);
                        this.enemies.splice(i, 1);
                        hit = true;
                        Assets.playSound("death");

                        if (this.enemies.length === 0) {
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

            if (!hit) alive.push(bullet);
        }

        this.bullets = alive;
    },

    toScreen(x, y) {
        return {
            x: this.world.ox + x * this.world.scale,
            y: this.world.oy + y * this.world.scale,
        };
    },

    drawEntity(entity, isPlayer) {
        const screen = this.toScreen(entity.x, entity.y);
        const radius = Math.round(this.world.scale * CFG.drawRadius);
        const img = isPlayer ? Assets.player : Assets.enemy;

        if (img) {
            this.ctx.save();
            this.ctx.translate(Math.round(screen.x), Math.round(screen.y));
            this.ctx.rotate(entity.angle);
            this.ctx.drawImage(img, -radius, -radius, radius * 2, radius * 2);
            this.ctx.restore();
        }
    },

    drawBullet(bullet) {
        const screen = this.toScreen(bullet.x, bullet.y);
        const radius = Math.round(this.world.scale * CFG.bulletRadius);
        const color = bullet.isEnemy ? COLORS.bulletEnemy : COLORS.bulletPlayer;

        this.ctx.beginPath();
        this.ctx.arc(
            Math.round(screen.x),
            Math.round(screen.y),
            radius,
            0,
            Math.PI * 2,
        );
        this.ctx.fillStyle = color;
        this.ctx.fill();
        this.ctx.strokeStyle = "#000";
        this.ctx.lineWidth = 1;
        this.ctx.stroke();
    },

    drawUI() {
        const s = CFG.pauseSize;
        const m = CFG.pauseMargin;
        const x1 = this.world.w - s - m;
        const y1 = m;
        const y2 = m + s + m;

        this.ctx.fillStyle = COLORS.pauseBtn;
        this.ctx.fillRect(x1, y1, s, s);
        this.ctx.fillRect(x1, y2, s, s);

        this.ctx.strokeStyle = COLORS.text;
        this.ctx.lineWidth = 2;
        const p = s * 0.25;
        const c = s * 0.3;
        this.ctx.beginPath();
        this.ctx.moveTo(x1 + p, y1 + p + c);
        this.ctx.lineTo(x1 + p, y1 + p);
        this.ctx.lineTo(x1 + p + c, y1 + p);
        this.ctx.moveTo(x1 + s - p - c, y1 + p);
        this.ctx.lineTo(x1 + s - p, y1 + p);
        this.ctx.lineTo(x1 + s - p, y1 + p + c);
        this.ctx.moveTo(x1 + s - p, y1 + s - p - c);
        this.ctx.lineTo(x1 + s - p, y1 + s - p);
        this.ctx.lineTo(x1 + s - p - c, y1 + s - p);
        this.ctx.moveTo(x1 + p + c, y1 + s - p);
        this.ctx.lineTo(x1 + p, y1 + s - p);
        this.ctx.lineTo(x1 + p, y1 + s - p - c);
        this.ctx.stroke();

        this.ctx.fillStyle = COLORS.text;
        const bw = s * 0.2;
        const bh = s * 0.5;
        const gap = s * 0.15;
        this.ctx.fillRect(x1 + s / 2 - gap - bw, y2 + s / 4, bw, bh);
        this.ctx.fillRect(x1 + s / 2 + gap, y2 + s / 4, bw, bh);
    },

    drawOverlay(main, sub, showHome, overlayColor) {
        this.ctx.fillStyle = overlayColor || COLORS.overlay;
        this.ctx.fillRect(0, 0, this.world.w, this.world.h);
        this.ctx.fillStyle = COLORS.text;
        this.ctx.textAlign = "center";
        const titleSize = Math.max(
            24,
            Math.min(this.world.w, this.world.h) * 0.08,
        );
        this.ctx.font = `${titleSize}px "Pixelify Local"`;
        this.ctx.fillText(main, this.world.w / 2, this.world.h / 2);

        if (sub) {
            const subSize = Math.max(
                14,
                Math.min(this.world.w, this.world.h) * 0.04,
            );
            this.ctx.font = `${subSize}px "Pixelify Local"`;
            this.ctx.fillText(
                sub,
                this.world.w / 2,
                this.world.h / 2 + this.world.scale * 1.5,
            );
        }

        if (showHome) {
            const btnW = this.world.scale * 3;
            const btnH = this.world.scale * 0.9;
            const btnX = this.world.w / 2 - btnW / 2;
            const btnY = this.world.h / 2 + this.world.scale * 2.5;
            this.ctx.fillStyle = COLORS.pauseBtn;
            this.ctx.fillRect(btnX, btnY, btnW, btnH);
            this.ctx.fillStyle = COLORS.text;
            this.ctx.font = `${this.world.scale * 0.6}px "Pixelify Local"`;
            this.ctx.fillText(
                "HOME",
                this.world.w / 2,
                this.world.h / 2 + this.world.scale * 3.15,
            );
        }
    },

    draw() {
        this.ctx.imageSmoothingEnabled = false;

        if (Map.waterCache) {
            this.ctx.drawImage(Map.waterCache, 0, 0);
        }

        if (this.state === "MENU") {
            const pxW = Math.round(Map.width * this.world.scale);
            const pxH = Math.round(Map.height * this.world.scale);
            const mx = Math.round(this.world.ox - pxW / 2);
            const my = Math.round(this.world.oy - pxH / 2);

            if (Map.cache) this.ctx.drawImage(Map.cache, mx, my, pxW, pxH);

            this.drawOverlay("Recoil Island", null);

            this.ctx.fillStyle = COLORS.text;
            const tipSize = Math.max(
                14,
                Math.min(this.world.w, this.world.h) * 0.04,
            );
            this.ctx.font = `${tipSize}px "Pixelify Local"`;
            this.ctx.textAlign = "center";
            const tipY = this.world.h / 2 + tipSize * 3;
            this.ctx.fillText("click to start", this.world.w / 2, tipY);
            this.ctx.fillText(
                "use landscape mode",
                this.world.w / 2,
                tipY + tipSize * 1.3,
            );
            this.ctx.fillText(
                "and enable fullscreen",
                this.world.w / 2,
                tipY + tipSize * 2.6,
            );

            const s = CFG.pauseSize;
            const m = CFG.pauseMargin;
            this.ctx.fillStyle = COLORS.pauseBtn;
            this.ctx.fillRect(this.world.w - s - m, m, s, s);
            this.ctx.strokeStyle = COLORS.text;
            this.ctx.lineWidth = 2;
            const p = s * 0.25;
            const c = s * 0.3;
            const x1 = this.world.w - s - m;
            const y1 = m;
            this.ctx.beginPath();
            this.ctx.moveTo(x1 + p, y1 + p + c);
            this.ctx.lineTo(x1 + p, y1 + p);
            this.ctx.lineTo(x1 + p + c, y1 + p);
            this.ctx.moveTo(x1 + s - p - c, y1 + p);
            this.ctx.lineTo(x1 + s - p, y1 + p);
            this.ctx.lineTo(x1 + s - p, y1 + p + c);
            this.ctx.moveTo(x1 + s - p, y1 + s - p - c);
            this.ctx.lineTo(x1 + s - p, y1 + s - p);
            this.ctx.lineTo(x1 + s - p - c, y1 + s - p);
            this.ctx.moveTo(x1 + p + c, y1 + s - p);
            this.ctx.lineTo(x1 + p, y1 + s - p);
            this.ctx.lineTo(x1 + p, y1 + s - p - c);
            this.ctx.stroke();
            return;
        }

        const pxW = Math.round(Map.width * this.world.scale);
        const pxH = Math.round(Map.height * this.world.scale);
        const mx = Math.round(this.world.ox - pxW / 2);
        const my = Math.round(this.world.oy - pxH / 2);

        if (Map.cache) this.ctx.drawImage(Map.cache, mx, my, pxW, pxH);

        if (this.state !== "READY") {
            this.enemies.forEach((enemy) => this.drawEntity(enemy, false));
            if (this.state !== "LOST") this.drawEntity(this.player, true);
        }

        this.bullets.forEach((bullet) => this.drawBullet(bullet));

        if (["PLAYING", "COUNTDOWN", "READY", "PAUSED"].includes(this.state)) {
            this.ctx.fillStyle = COLORS.text;
            this.ctx.font = `${Math.max(16, this.world.scale * 0.6)}px "Pixelify Local"`;
            this.ctx.textAlign = "left";
            this.ctx.fillText(`LEVEL: ${this.level}`, 20, 40);
            this.ctx.fillText(`BEST: ${this.best}`, 20, 70);
            this.drawUI();
        }

        if (this.state === "LOST")
            this.drawOverlay("GAME OVER", null, false, COLORS.overlayRed);
        else if (this.state === "COUNTDOWN")
            this.drawOverlay(
                "LEVEL COMPLETE",
                null,
                false,
                COLORS.overlayGreen,
            );
        else if (this.state === "READY")
            this.drawOverlay(`LEVEL ${this.level}`, "CLICK TO START");
        else if (this.state === "PAUSED")
            this.drawOverlay("PAUSED", "CLICK TO RESUME", true);
    },
};

// ================================= MAIN LOOP =================================

const loop = (t) => {
    const now = t / 1000;
    const dt = Math.min((t - Game.lastTime) / 1000, CFG.maxDt);
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
    requestAnimationFrame(loop);
})();
