import { SeaAudio } from "./audio.js";
import { zoneAt, lerpColor } from "./zones.js";
import {
  HAIR, OUTFITS, WEAPONS,
  drawGirl, drawWhale, drawCreature, drawRock, drawLoot, drawBubble, drawAttackArc,
} from "./draw.js";

const BEST_KEY = "deepSeaFallBest";
const WHALE_LINES = [
  "我在這裡，抓住我的背。",
  "左邊有石頭，我推開它！",
  "跟著氣泡，再深一點。",
  "累了就睡一會兒，我守著你。",
  "那裡有光——是寶物嗎？",
  "火山在吼，靠近我。",
  "你的氣功記號會帶我們回家。",
  "勇敢一點，但我會接住你。",
];

function rand(a, b) { return a + Math.random() * (b - a); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

export class Game {
  constructor(canvas, ui) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.ui = ui;
    this.audio = new SeaAudio();
    this.running = false;
    this.mode = "manual"; // manual | ai | demo
    this.prompt = "proactive";
    this.t = 0;
    this.depth = 0;
    this.maxDepth = 0;
    this.best = Number(localStorage.getItem(BEST_KEY) || 0);
    this.stamina = 100;
    this.lootCount = 0;
    this.seaweed = 0;
    this.scroll = 0;
    this.fallSpeed = 55;
    this.boost = 0;
    this.sleeping = false;
    this.attackT = 0;
    this.shake = 0;
    this.pointer = null;
    this.waypoints = [];
    this.entities = [];
    this.particles = [];
    this.bubbles = [];
    this.whale = null;
    this.whaleCd = 0;
    this.magicCd = 0;
    this.spawnAcc = 0;
    this.demoScript = 0;
    this.girl = null;
    this._bindUI();
    this._resize();
    window.addEventListener("resize", () => this._resize());
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  _bindUI() {
    const { btnSleep, btnWhale, btnBoost, btnMagic, btnAttack, btnMode } = this.ui;
    btnSleep?.addEventListener("click", () => this.toggleSleep());
    btnWhale?.addEventListener("click", () => this.summonWhale());
    btnBoost?.addEventListener("click", () => this.triggerBoost());
    btnMagic?.addEventListener("click", () => this.placeMagic());
    btnAttack?.addEventListener("click", () => this.attack());
    btnMode?.addEventListener("click", () => this.cycleMode());

    this.ui.aiPanel?.querySelectorAll(".prompt-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.ui.aiPanel.querySelectorAll(".prompt-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        this.setPrompt(btn.dataset.prompt);
      });
    });

    const el = this.canvas;
    const onDown = (e) => {
      const p = this._pos(e);
      this.pointer = { ...p, active: true };
      this.audio.unlock();
    };
    const onMove = (e) => {
      if (!this.pointer?.active) return;
      this.pointer = { ...this._pos(e), active: true };
    };
    const onUp = () => { if (this.pointer) this.pointer.active = false; };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
  }

  _pos(e) {
    const r = this.canvas.getBoundingClientRect();
    const x = (("clientX" in e ? e.clientX : e.touches[0].clientX) - r.left) * (this.canvas.width / r.width);
    const y = (("clientY" in e ? e.clientY : e.touches[0].clientY) - r.top) * (this.canvas.height / r.height);
    return { x, y };
  }

  _resize() {
    const ratio = window.devicePixelRatio || 1;
    const w = this.canvas.clientWidth || 390;
    const h = this.canvas.clientHeight || 844;
    this.canvas.width = Math.floor(w * ratio);
    this.canvas.height = Math.floor(h * ratio);
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    this.w = w;
    this.h = h;
  }

  async start(mode = "manual") {
    await this.audio.unlock();
    this.mode = mode;
    this.running = true;
    this.depth = 0;
    this.maxDepth = 0;
    this.stamina = 100;
    this.lootCount = 0;
    this.seaweed = 0;
    this.scroll = 0;
    this.fallSpeed = 55;
    this.boost = 0;
    this.sleeping = false;
    this.attackT = 0;
    this.entities = [];
    this.particles = [];
    this.bubbles = [];
    this.waypoints = [];
    this.whaleCd = 0;
    this.magicCd = 0;
    this.spawnAcc = 0;
    this.demoScript = 0;
    this.girl = {
      x: this.w * 0.5,
      y: this.h * 0.38,
      vx: 0,
      vy: 0,
      facing: 1,
      sleeping: false,
      hair: HAIR[0],
      outfit: OUTFITS[0],
      weapon: WEAPONS[0],
      invuln: 0,
    };
    this.whale = {
      x: this.w * 0.72,
      y: this.h * 0.55,
      facing: -1,
      scale: 0.85,
      alpha: 0.95,
      present: true,
      pushCd: 0,
    };
    this.audio.setPrompt(this.prompt);
    this.audio.sfxWhale();
    this._whaleSay("一起往下墜吧。");
    this.ui.showGame();
    this.ui.setModeLabel(this.mode);
    this.ui.setBest(this.best);
    this._toast("水花濺起——旅程開始");
  }

  setPrompt(p) {
    this.prompt = p;
    this.audio.setPrompt(p);
    const map = {
      proactive: "主動前進，積極搜集與戰鬥",
      careful: "小心迴避，優先保命與標記",
      treasure: "優先尋寶與裝備",
      explore: "深入未知層，不怕黑暗",
    };
    this.ui.setAiStatus(map[p] || p);
    this._toast(`Agent: ${p}`);
  }

  cycleMode() {
    if (this.mode === "manual") this.mode = "ai";
    else if (this.mode === "ai") this.mode = "manual";
    this.ui.setModeLabel(this.mode);
    this.ui.toggleAi(this.mode === "ai" || this.mode === "demo");
    this._toast(this.mode === "ai" ? "AI Mode 啟動" : "手動操作");
  }

  toggleSleep() {
    if (!this.running) return;
    this.sleeping = !this.sleeping;
    this.girl.sleeping = this.sleeping;
    if (this.sleeping) {
      this.audio.sfxSleep();
      this._toast("自由落體・回復體力");
    } else {
      this._toast("醒來繼續游");
    }
  }

  summonWhale() {
    if (!this.running || this.whaleCd > 0) return;
    this.whale.present = true;
    this.whale.alpha = 1;
    this.whale.x = this.girl.x + 80;
    this.whale.y = this.girl.y + 40;
    this.whaleCd = 4;
    this.audio.sfxWhale();
    this._whaleSay(pick(WHALE_LINES));
    this.boost = Math.max(this.boost, 1.2);
  }

  triggerBoost() {
    if (!this.running) return;
    this.boost = 2.2;
    this.audio.sfxBoost();
    this.stamina = Math.max(0, this.stamina - 4);
    this._toast("加速下潛！");
  }

  placeMagic() {
    if (!this.running || this.magicCd > 0) return;
    const near = this.entities.find((e) => e.tag === "rock" && dist(e, this.girl) < 70);
    const rune = pick(["✦", "☯", "✧", "❁", "◈"]);
    if (near) {
      near.rune = rune;
    } else {
      this.entities.push({
        tag: "rock",
        x: this.girl.x,
        y: this.girl.y + 40,
        w: 40,
        h: 36,
        volcanic: false,
        rune,
        marked: true,
      });
    }
    this.waypoints.push({ depth: this.depth, rune, x: this.girl.x });
    this.magicCd = 2.5;
    this.audio.sfxMagic();
    this._toast(`氣功標記 ${rune} @ ${Math.floor(this.depth)}m`);
  }

  attack() {
    if (!this.running || this.attackT > 0) return;
    this.attackT = 0.28;
    this.audio.sfxAttack();
    const reach = this.girl.weapon.reach;
    for (const e of this.entities) {
      if (e.tag !== "creature" || !e.hostile) continue;
      if (dist(e, this.girl) < reach) {
        e.hp -= this.girl.weapon.dmg;
        this._burst(e.x, e.y, e.color || "#ff6b6b");
        if (e.hp <= 0) {
          e.dead = true;
          this.lootCount += 1;
          if (Math.random() < 0.35) this._dropLoot(e.x, e.y);
        }
      }
    }
    this.entities = this.entities.filter((e) => !e.dead);
  }

  _dropLoot(x, y) {
    const roll = Math.random();
    if (roll < 0.35) {
      this.entities.push({ tag: "loot", type: "seaweed", x, y, phase: rand(0, 6), vy: -10 });
    } else if (roll < 0.6) {
      this.entities.push({ tag: "loot", type: "treasure", x, y, phase: rand(0, 6), vy: -10 });
    } else if (roll < 0.8) {
      const outfit = pick(OUTFITS);
      this.entities.push({ tag: "loot", type: "equip", x, y, phase: rand(0, 6), outfit, color: outfit.main, vy: -10 });
    } else {
      const hair = pick(HAIR);
      this.entities.push({ tag: "loot", type: "hair", x, y, phase: rand(0, 6), hair, color: hair.color, vy: -10 });
    }
  }

  _toast(msg) { this.ui.toast(msg); }
  _whaleSay(msg) {
    this.ui.whaleLine(msg);
    this.audio.sfxWhalePass();
  }

  _burst(x, y, color) {
    for (let i = 0; i < 10; i++) {
      this.particles.push({
        x, y,
        vx: rand(-60, 60),
        vy: rand(-80, 40),
        life: rand(0.3, 0.7),
        color,
        r: rand(1.5, 3.5),
      });
    }
  }

  _spawn(dt) {
    this.spawnAcc += dt;
    const rate = this.prompt === "careful" ? 0.55 : this.prompt === "proactive" ? 0.35 : 0.42;
    if (this.spawnAcc < rate) return;
    this.spawnAcc = 0;
    const zone = zoneAt(this.depth);
    const w = this.w;
    const roll = Math.random();

    if (roll < 0.28) {
      const volcanic = zone.id === "vent" || (this.depth > 600 && Math.random() < 0.35);
      this.entities.push({
        tag: "rock",
        x: rand(30, w - 30),
        y: this.h + 40,
        w: rand(36, 70),
        h: rand(30, 60),
        volcanic,
        rune: null,
        vy: -this.fallSpeed,
      });
    } else if (roll < 0.7) {
      const kind = pick(zone.fauna);
      const hostile = ["angler", "viper", "gulper", "monster", "eel", "lavaRock"].includes(kind) || Math.random() < 0.15;
      const school = kind === "school" ? 6 + Math.floor(Math.random() * 8) : 1;
      for (let i = 0; i < school; i++) {
        this.entities.push({
          tag: "creature",
          kind,
          x: rand(20, w - 20) + i * 8,
          y: this.h + 30 + i * 6,
          vx: rand(-30, 30),
          vy: rand(-20, 10),
          facing: Math.random() < 0.5 ? 1 : -1,
          color: hostile ? pick(["#6b2d5b", "#1f6f4a", "#8a2f2f", "#2c4a6e"]) : pick(["#5ce1ff", "#ffd166", "#ff8fab", "#9dffb0", "#7ad7f0", "#c9a7ff"]),
          phase: rand(0, 10),
          hostile,
          hp: hostile ? (kind === "monster" ? 40 : 20) : 8,
        });
      }
    } else if (roll < 0.9) {
      this._dropLoot(rand(40, w - 40), this.h + 20);
    } else {
      // giant whale pass silhouette
      if (Math.random() < 0.5) {
        this.audio.sfxWhalePass();
        this.entities.push({
          tag: "whalePass",
          x: -120,
          y: rand(this.h * 0.4, this.h * 0.8),
          vx: 90,
          scale: rand(1.1, 1.6),
          alpha: 0.35,
        });
      }
    }
  }

  _aiControl(dt) {
    if (!this.girl) return;
    const g = this.girl;
    const hazards = this.entities.filter((e) => (e.tag === "rock" || (e.tag === "creature" && e.hostile)) && e.y < g.y + 180 && e.y > g.y - 40);
    const loot = this.entities.filter((e) => e.tag === "loot");
    let tx = g.x;
    let wantSleep = false;
    let wantAttack = false;
    let wantUp = false;

    if (this.prompt === "careful") {
      if (hazards.length) {
        const h = hazards.sort((a, b) => dist(a, g) - dist(b, g))[0];
        tx = h.x < g.x ? g.x + 70 : g.x - 70;
        if (dist(h, g) < 90) this.summonWhale();
      }
      if (this.stamina < 45) wantSleep = true;
      if (this.magicCd <= 0 && Math.random() < 0.01) this.placeMagic();
    } else if (this.prompt === "treasure") {
      if (loot.length) {
        const L = loot.sort((a, b) => dist(a, g) - dist(b, g))[0];
        tx = L.x;
        if (L.y < g.y - 10) wantUp = true;
      } else {
        tx = g.x + Math.sin(this.t * 1.3) * 40;
      }
    } else if (this.prompt === "explore") {
      tx = g.x + Math.sin(this.t * 0.7) * 90;
      if (this.boost <= 0 && Math.random() < 0.01) this.triggerBoost();
    } else {
      // proactive
      tx = g.x + Math.sin(this.t * 1.6) * 50;
      const foe = hazards.find((e) => e.tag === "creature" && e.hostile && dist(e, g) < 90);
      if (foe) wantAttack = true;
      if (loot[0]) tx = loot[0].x;
      if (this.stamina < 30) wantSleep = true;
    }

    if (wantSleep && !this.sleeping) this.toggleSleep();
    if (!wantSleep && this.sleeping && this.stamina > 70) this.toggleSleep();
    if (wantAttack) this.attack();

    const dx = clamp(tx - g.x, -120, 120);
    g.vx += dx * 2.5 * dt;
    if (wantUp) g.vy -= 80 * dt;
  }

  _manualControl(dt) {
    const g = this.girl;
    if (this.pointer?.active && !this.sleeping) {
      const dx = this.pointer.x - g.x;
      const dy = this.pointer.y - g.y;
      g.vx += dx * 3.2 * dt;
      g.vy += dy * 2.4 * dt;
      // swimming up reduces fall / can go back
      if (dy < -20) {
        this.scroll = Math.max(0, this.scroll - 40 * dt);
      }
    }
  }

  _demoControl(dt) {
    this.demoScript += dt;
    if (this.demoScript < 2) this.setPrompt("proactive");
    else if (this.demoScript < 6) this.setPrompt("treasure");
    else if (this.demoScript < 10) this.setPrompt("careful");
    else this.setPrompt("explore");
    if (Math.floor(this.demoScript) === 3) this.summonWhale();
    if (Math.floor(this.demoScript) === 5) this.placeMagic();
    if (Math.floor(this.demoScript) === 7) this.triggerBoost();
    this._aiControl(dt);
  }

  _update(dt) {
    if (!this.running || !this.girl) return;
    this.t += dt;
    const g = this.girl;
    const zone = zoneAt(this.depth);
    this.audio.setMood(zone.mood);

    if (this.mode === "ai") this._aiControl(dt);
    else if (this.mode === "demo") this._demoControl(dt);
    else this._manualControl(dt);

    // fall / dive
    const speedMul = (this.sleeping ? 1.15 : 1) * (1 + this.boost) * (this.prompt === "careful" ? 0.85 : 1.05);
    const dive = this.fallSpeed * speedMul;
    this.scroll += dive * dt;
    this.depth += dive * dt * 0.55;
    this.maxDepth = Math.max(this.maxDepth, this.depth);
    if (this.boost > 0) this.boost = Math.max(0, this.boost - dt * 0.9);
    if (this.whaleCd > 0) this.whaleCd -= dt;
    if (this.magicCd > 0) this.magicCd -= dt;
    if (this.attackT > 0) this.attackT -= dt;
    if (g.invuln > 0) g.invuln -= dt;
    if (this.shake > 0) this.shake -= dt;

    // stamina
    if (this.sleeping) {
      this.stamina = Math.min(100, this.stamina + 14 * dt);
      g.vx *= 0.9;
      g.vy *= 0.9;
    } else {
      this.stamina = Math.min(100, this.stamina + 1.5 * dt);
    }

    g.vx *= 0.92;
    g.vy *= 0.9;
    g.x = clamp(g.x + g.vx * dt, 24, this.w - 24);
    g.y = clamp(g.y + g.vy * dt, this.h * 0.18, this.h * 0.62);
    if (Math.abs(g.vx) > 8) g.facing = g.vx > 0 ? 1 : -1;
    g.sleeping = this.sleeping;

    // whale companion
    if (this.whale.present) {
      const tx = g.x + 70;
      const ty = g.y + 50;
      this.whale.x += (tx - this.whale.x) * 1.8 * dt;
      this.whale.y += (ty - this.whale.y) * 1.5 * dt;
      this.whale.facing = this.whale.x > g.x ? -1 : 1;
      if (this.whale.pushCd > 0) this.whale.pushCd -= dt;

      // push hazards
      for (const e of this.entities) {
        if (e.tag === "rock" || (e.tag === "creature" && e.hostile)) {
          if (dist(e, g) < 70 && this.whale.pushCd <= 0) {
            e.x += e.x < g.x ? -90 : 90;
            this.whale.pushCd = 1.1;
            this.audio.sfxWhale();
            this._whaleSay(pick(WHALE_LINES));
            this._burst(e.x, e.y, "#5ce1ff");
          }
        }
      }
    }

    this._spawn(dt);

    // move world entities upward relative (girl falling)
    for (const e of this.entities) {
      if (e.tag === "rock") {
        e.y -= dive * dt;
      } else if (e.tag === "creature") {
        e.y -= dive * dt * 0.92;
        e.x += e.vx * dt;
        e.y += e.vy * dt;
        if (e.x < 10 || e.x > this.w - 10) e.vx *= -1;
        e.facing = e.vx >= 0 ? 1 : -1;
      } else if (e.tag === "loot") {
        e.y -= dive * dt;
        e.y += (e.vy || 0) * dt;
      } else if (e.tag === "whalePass") {
        e.x += e.vx * dt;
        e.y -= dive * dt * 0.3;
      }
    }

    // collisions
    for (const e of this.entities) {
      if (e.tag === "rock") {
        if (dist(e, g) < (e.w * 0.35 + 16) && g.invuln <= 0) {
          this._hurt(e.volcanic ? 18 : 12, e.volcanic ? "volcano" : "rock");
          e.x += e.x < g.x ? -40 : 40;
        }
      } else if (e.tag === "creature" && e.hostile) {
        if (dist(e, g) < 28 && g.invuln <= 0) {
          this._hurt(10, "creature");
        }
      } else if (e.tag === "loot" && dist(e, g) < 30) {
        this._collect(e);
        e.dead = true;
      }
    }
    this.entities = this.entities.filter((e) => !e.dead && e.y > -120 && e.x > -200 && e.x < this.w + 200);

    // bubbles
    if (Math.random() < 0.4) {
      this.bubbles.push({ x: rand(0, this.w), y: this.h + 10, r: rand(2, 6), a: rand(0.2, 0.6), vy: rand(-40, -90) });
    }
    for (const b of this.bubbles) {
      b.y += b.vy * dt - dive * dt * 0.2;
      b.x += Math.sin(this.t * 2 + b.x) * 8 * dt;
    }
    this.bubbles = this.bubbles.filter((b) => b.y > -20);

    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);

    // death
    if (this.stamina <= 0) {
      this.stamina = 0;
      this._die();
    }

    this.ui.setDepth(this.depth, this.best);
    this.ui.setStamina(this.stamina);
    this.ui.setEquip(g);
  }

  _hurt(amount, kind) {
    this.stamina -= amount;
    this.girl.invuln = 0.8;
    this.shake = 0.25;
    if (kind === "rock" || kind === "volcano") this.audio.sfxRock();
    else this.audio.sfxHit();
    this._burst(this.girl.x, this.girl.y, "#ff6b6b");
    if (this.whale.present && Math.random() < 0.4) {
      this._whaleSay("抓住我！");
      this.girl.x += this.girl.x < this.w / 2 ? 30 : -30;
    }
  }

  _collect(item) {
    if (item.type === "treasure") {
      this.lootCount += 1;
      this.audio.sfxTreasure();
      this._toast("取得海中寶物");
    } else if (item.type === "seaweed") {
      this.seaweed += 1;
      this.stamina = Math.min(100, this.stamina + 20);
      this.audio.sfxSeaweed();
      this._toast("海草！可復活 / 回復");
    } else if (item.type === "equip") {
      if (item.outfit) this.girl.outfit = item.outfit;
      // also maybe weapon
      if (Math.random() < 0.7) this.girl.weapon = pick(WEAPONS.filter((w) => w.id !== "hand"));
      this.audio.sfxEquip();
      this._toast(`換裝：${this.girl.outfit.label}`);
      this.ui.setEquip(this.girl);
    } else if (item.type === "hair") {
      if (item.hair) this.girl.hair = item.hair;
      this.audio.sfxEquip();
      this._toast(`新髮型：${this.girl.hair.label}`);
      this.ui.setEquip(this.girl);
    }
    this.lootCount += 1;
    this._burst(item.x, item.y, "#ffd166");
  }

  _die() {
    if (!this.running) return;
    this.running = false;
    this.audio.sfxDeath();
    this.best = Math.max(this.best, Math.floor(this.maxDepth));
    localStorage.setItem(BEST_KEY, String(this.best));
    this.ui.showGameOver({
      depth: Math.floor(this.maxDepth),
      loot: this.lootCount,
      canRevive: this.seaweed > 0,
    });
  }

  revive() {
    if (this.seaweed <= 0) return;
    this.seaweed -= 1;
    this.stamina = 60;
    this.running = true;
    this.girl.invuln = 2;
    this.audio.sfxRevive();
    this.ui.showGame();
    this._toast("海草復活！");
    this.summonWhale();
  }

  _drawBg() {
    const ctx = this.ctx;
    const zone = zoneAt(this.depth);
    const next = zoneAt(this.depth + 80);
    const t = clamp((this.depth - zone.from) / Math.max(1, Math.min(zone.to, this.depth + 200) - zone.from), 0, 1);
    const top = lerpColor(zone.top, next.top, t * 0.35);
    const bottom = lerpColor(zone.bottom, next.bottom, t * 0.35);
    const g = ctx.createLinearGradient(0, 0, 0, this.h);
    g.addColorStop(0, top);
    g.addColorStop(1, bottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.w, this.h);

    // light shafts near surface
    if (this.depth < 150) {
      ctx.save();
      ctx.globalAlpha = 0.08 * (1 - this.depth / 150);
      ctx.fillStyle = "#e8fbff";
      for (let i = 0; i < 5; i++) {
        const x = ((i * 90 + this.t * 12) % (this.w + 80)) - 40;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + 40, 0);
        ctx.lineTo(x + 10, this.h);
        ctx.lineTo(x - 30, this.h);
        ctx.fill();
      }
      ctx.restore();
    }

    // bioluminescent dots deep
    if (this.depth > 300) {
      ctx.fillStyle = zone.particle;
      for (let i = 0; i < 28; i++) {
        const x = (Math.sin(i * 12.1 + this.depth * 0.01) * 0.5 + 0.5) * this.w;
        const y = (Math.cos(i * 7.7 + this.t * 0.3) * 0.5 + 0.5) * this.h;
        ctx.globalAlpha = 0.25 + Math.sin(this.t + i) * 0.15;
        ctx.beginPath();
        ctx.arc(x, y, 1.5 + (i % 3), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // zone name
    ctx.save();
    ctx.font = "600 12px Sora, sans-serif";
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillText(zone.name, 14, this.h * 0.22);
    ctx.restore();
  }

  _draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.w, this.h);
    ctx.save();
    if (this.shake > 0) {
      ctx.translate(rand(-4, 4), rand(-3, 3));
    }
    this._drawBg();

    for (const b of this.bubbles) drawBubble(ctx, b);

    // distant whale passes first
    for (const e of this.entities) {
      if (e.tag === "whalePass") {
        drawWhale(ctx, e, this.t);
      }
    }

    for (const e of this.entities) {
      if (e.tag === "rock") drawRock(ctx, e);
      else if (e.tag === "creature") drawCreature(ctx, e, this.t);
      else if (e.tag === "loot") drawLoot(ctx, e, this.t);
    }

    if (this.whale?.present) drawWhale(ctx, this.whale, this.t);
    if (this.girl) {
      drawGirl(ctx, this.girl, this.t);
      drawAttackArc(ctx, this.girl, this.attackT);
    }

    for (const p of this.particles) {
      ctx.globalAlpha = clamp(p.life * 2, 0, 1);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // depth ribbon
    ctx.save();
    ctx.strokeStyle = "rgba(92,225,255,0.25)";
    ctx.beginPath();
    ctx.moveTo(this.w - 18, 80);
    ctx.lineTo(this.w - 18, this.h - 120);
    ctx.stroke();
    for (const wp of this.waypoints.slice(-6)) {
      const rel = (this.depth - wp.depth) * 0.35;
      const y = this.girl.y + rel;
      if (y > 80 && y < this.h - 100) {
        ctx.fillStyle = "#ffd166";
        ctx.font = "14px Fredoka, sans-serif";
        ctx.fillText(wp.rune, this.w - 28, y);
      }
    }
    ctx.restore();
    ctx.restore();
  }

  _loop(ts) {
    if (!this._last) this._last = ts;
    let dt = (ts - this._last) / 1000;
    this._last = ts;
    dt = Math.min(0.033, dt);
    if (this.running) this._update(dt);
    else if (!this.girl) {
      // idle title animation backdrop
      this.t += dt;
      this.depth = (Math.sin(this.t * 0.2) * 0.5 + 0.5) * 80;
      this._drawBg();
    }
    if (this.girl || this.running) this._draw();
    requestAnimationFrame(this._loop);
  }
}
