import * as THREE from "three";
import { SeaAudio } from "../audio.js";
import { zoneAt } from "../zones.js";
import {
  makeGirl, makeWhale, makeFish, makeJelly, makeRock, makeTreasure, makeBubble,
  HAIR_COLORS, DRESS_COLORS,
} from "./meshes.js";

const BEST_KEY = "deepSeaFall3dBest";
const WHALE_LINES = [
  "我在這裡，抓住我的背。",
  "左邊有石頭，我推開它！",
  "跟著氣泡，再深一點。",
  "累了就睡一會兒，我守著你。",
  "那裡有光——是寶物嗎？",
];

function rand(a, b) { return a + Math.random() * (b - a); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

export class Game3D {
  constructor(canvas, ui) {
    this.canvas = canvas;
    this.ui = ui;
    this.audio = new SeaAudio();
    this.running = false;
    this.mode = "manual";
    this.prompt = "proactive";
    this.t = 0;
    this.depth = 0;
    this.maxDepth = 0;
    this.best = Number(localStorage.getItem(BEST_KEY) || 0);
    this.stamina = 100;
    this.lootCount = 0;
    this.seaweed = 0;
    this.boost = 0;
    this.sleeping = false;
    this.attackT = 0;
    this.whaleCd = 0;
    this.magicCd = 0;
    this.spawnAcc = 0;
    this.pointer = null;
    this.entities = [];
    this.waypoints = [];

    this._initThree();
    this._bindUI();
    this._onResize();
    window.addEventListener("resize", () => this._onResize());
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  _initThree() {
    const w = this.canvas.clientWidth || 390;
    const h = this.canvas.clientHeight || 844;
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x0a2744, 0.045);

    this.camera = new THREE.PerspectiveCamera(52, w / h, 0.1, 200);
    this.camera.position.set(0, 1.2, 6.5);

    this.hemi = new THREE.HemisphereLight(0x7ad7f0, 0x061525, 0.85);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xb8ecff, 1.1);
    this.sun.position.set(2, 8, 4);
    this.scene.add(this.sun);
    this.key = new THREE.PointLight(0x5ce1ff, 1.4, 30);
    this.key.position.set(0, 2, 3);
    this.scene.add(this.key);

    // volumetric-ish columns of light near surface via translucent planes
    this.shaftGroup = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const shaft = new THREE.Mesh(
        new THREE.PlaneGeometry(0.8, 18),
        new THREE.MeshBasicMaterial({
          color: 0xdff9ff,
          transparent: true,
          opacity: 0.04,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      shaft.position.set(-3 + i * 1.5, 2, -2 - i * 0.3);
      shaft.rotation.y = 0.2;
      this.shaftGroup.add(shaft);
    }
    this.scene.add(this.shaftGroup);

    // caustic plane under camera
    this.caustic = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40),
      new THREE.MeshBasicMaterial({
        color: 0x1aa7a0,
        transparent: true,
        opacity: 0.04,
        depthWrite: false,
      }),
    );
    this.caustic.rotation.x = -Math.PI / 2;
    this.caustic.position.y = -6;
    this.scene.add(this.caustic);

    this.world = new THREE.Group();
    this.scene.add(this.world);

    this.girl = makeGirl();
    this.girl.position.set(0, 0.2, 0);
    this.scene.add(this.girl);

    this.whale = makeWhale();
    this.whale.position.set(2.2, -0.6, -1.2);
    this.scene.add(this.whale);

    this.bubbleGroup = new THREE.Group();
    this.scene.add(this.bubbleGroup);
    for (let i = 0; i < 40; i++) {
      const b = makeBubble();
      b.position.set(rand(-5, 5), rand(-4, 6), rand(-6, 2));
      b.userData.vy = rand(0.3, 1.2);
      this.bubbleGroup.add(b);
    }

    // distant particle stars / biolume
    const pGeo = new THREE.BufferGeometry();
    const n = 400;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = rand(-12, 12);
      pos[i * 3 + 1] = rand(-20, 10);
      pos[i * 3 + 2] = rand(-18, 4);
    }
    pGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    this.bio = new THREE.Points(
      pGeo,
      new THREE.PointsMaterial({ color: 0x9dffb0, size: 0.06, transparent: true, opacity: 0.55 }),
    );
    this.scene.add(this.bio);
  }

  _onResize() {
    const w = this.canvas.clientWidth || 390;
    const h = this.canvas.clientHeight || 844;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
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
    el.addEventListener("pointerdown", (e) => {
      this.pointer = this._pos(e);
      this.pointer.active = true;
      this.audio.unlock();
    });
    el.addEventListener("pointermove", (e) => {
      if (!this.pointer?.active) return;
      this.pointer = { ...this._pos(e), active: true };
    });
    el.addEventListener("pointerup", () => { if (this.pointer) this.pointer.active = false; });
    el.addEventListener("pointercancel", () => { if (this.pointer) this.pointer.active = false; });
  }

  _pos(e) {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) / r.width * 2 - 1,
      y: -((e.clientY - r.top) / r.height * 2 - 1),
    };
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
    this.boost = 0;
    this.sleeping = false;
    this.attackT = 0;
    this.whaleCd = 0;
    this.magicCd = 0;
    this.spawnAcc = 0;
    this.entities.forEach((e) => this.world.remove(e.mesh));
    this.entities = [];
    this.waypoints = [];
    this.girl.position.set(0, 0.2, 0);
    this.whale.position.set(2.2, -0.6, -1.2);
    this.audio.setPrompt(this.prompt);
    this.audio.sfxWhale();
    this.ui.whaleLine(pick(WHALE_LINES));
    this.ui.showGame();
    this.ui.setModeLabel(this.mode);
    this.ui.setBest(this.best);
    this.ui.toast("3D 深海旅程開始");
    this._applyLook("long", "dress");
  }

  _applyLook(hairId, dressId) {
    const hc = HAIR_COLORS[hairId] ?? HAIR_COLORS.long;
    const dc = DRESS_COLORS[dressId] ?? DRESS_COLORS.dress;
    const { hairMat, dressMat } = this.girl.userData;
    hairMat.color.setHex(hc);
    if (hairId === "glow" || hairId === "abyss" || hairId === "coral") {
      hairMat.emissive.setHex(hc);
      hairMat.emissiveIntensity = 0.35;
    } else {
      hairMat.emissive.setHex(0x000000);
      hairMat.emissiveIntensity = 0;
    }
    dressMat.color.setHex(dc);
    dressMat.emissive.setHex(dc);
    dressMat.emissiveIntensity = 0.12;
    this.look = {
      hair: { id: hairId, label: hairId },
      outfit: { id: dressId, label: dressId },
      weapon: { id: "hand", label: "空手", color: "#fff" },
    };
    const labels = {
      long: "長波浪", twin: "雙馬尾", short: "短俏髮", glow: "螢光藍", coral: "珊瑚粉", abyss: "深淵紫",
      dress: "水色洋裝", diver: "潛水衣", kimono: "海紋浴衣", armor: "珊瑚甲", mage: "氣功袍", shadow: "深淵披風",
    };
    this.look.hair.label = labels[hairId] || hairId;
    this.look.outfit.label = labels[dressId] || dressId;
    this.ui.setEquip({
      hair: this.look.hair,
      outfit: this.look.outfit,
      weapon: this.look.weapon,
    });
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
    this.ui.toast(`Agent: ${p}`);
  }

  cycleMode() {
    this.mode = this.mode === "manual" ? "ai" : "manual";
    this.ui.setModeLabel(this.mode);
    this.ui.toggleAi(this.mode === "ai" || this.mode === "demo");
    this.ui.toast(this.mode === "ai" ? "AI Mode 啟動" : "手動操作");
  }

  toggleSleep() {
    if (!this.running) return;
    this.sleeping = !this.sleeping;
    if (this.sleeping) {
      this.audio.sfxSleep();
      this.ui.toast("自由落體・回復體力");
    }
  }

  summonWhale() {
    if (!this.running || this.whaleCd > 0) return;
    this.whaleCd = 3.5;
    this.whale.position.set(this.girl.position.x + 2.0, this.girl.position.y - 0.4, -1);
    this.audio.sfxWhale();
    this.ui.whaleLine(pick(WHALE_LINES));
    this.boost = Math.max(this.boost, 1.1);
  }

  triggerBoost() {
    if (!this.running) return;
    this.boost = 2.0;
    this.stamina = Math.max(0, this.stamina - 4);
    this.audio.sfxBoost();
    this.ui.toast("加速下潛！");
  }

  placeMagic() {
    if (!this.running || this.magicCd > 0) return;
    this.magicCd = 2.2;
    const rune = new THREE.Mesh(
      new THREE.TorusGeometry(0.35, 0.05, 8, 24),
      new THREE.MeshStandardMaterial({
        color: 0xffd166,
        emissive: 0x5ce1ff,
        emissiveIntensity: 0.8,
      }),
    );
    rune.position.copy(this.girl.position);
    rune.position.y -= 0.8;
    rune.userData = { kind: "rune", vy: 0 };
    this.world.add(rune);
    this.entities.push({ mesh: rune, kind: "rune", hostile: false });
    this.waypoints.push({ depth: this.depth });
    this.audio.sfxMagic();
    this.ui.toast(`氣功標記 @ ${Math.floor(this.depth)}m`);
  }

  attack() {
    if (!this.running || this.attackT > 0) return;
    this.attackT = 0.28;
    this.audio.sfxAttack();
    const g = this.girl.position;
    for (const e of this.entities) {
      if (!e.hostile) continue;
      if (e.mesh.position.distanceTo(g) < 2.2) {
        e.hp -= 14;
        if (e.hp <= 0) {
          e.dead = true;
          this.lootCount += 1;
          this.world.remove(e.mesh);
          this.audio.sfxTreasure();
        }
      }
    }
    this.entities = this.entities.filter((e) => !e.dead);
  }

  _spawn() {
    const zone = zoneAt(this.depth);
    const roll = Math.random();
    if (roll < 0.3) {
      const volcanic = zone.id === "vent" || this.depth > 700;
      const mesh = makeRock(volcanic);
      mesh.position.set(rand(-4, 4), -10, rand(-4, 1));
      this.world.add(mesh);
      this.entities.push({ mesh, kind: "rock", hostile: true, hp: 999, volcanic });
    } else if (roll < 0.75) {
      const hostile = Math.random() < 0.25 || ["midnight", "abyss", "hadal", "vent"].includes(zone.id);
      const colors = [0x5ce1ff, 0xffd166, 0xff8fab, 0x9dffb0, 0xc9a7ff, 0x6b2d5b];
      const school = Math.random() < 0.45 ? 5 + Math.floor(Math.random() * 6) : 1;
      for (let i = 0; i < school; i++) {
        const mesh = Math.random() < 0.25 ? makeJelly(pick(colors)) : makeFish(pick(colors), rand(0.7, 1.3));
        mesh.position.set(rand(-5, 5) + i * 0.2, -10 - i * 0.15, rand(-5, 1));
        mesh.userData.vx = rand(-0.8, 0.8);
        this.world.add(mesh);
        this.entities.push({
          mesh, kind: "creature", hostile, hp: hostile ? 22 : 8,
        });
      }
    } else {
      const mesh = makeTreasure();
      mesh.position.set(rand(-3.5, 3.5), -10, rand(-3, 1));
      this.world.add(mesh);
      this.entities.push({ mesh, kind: "loot", hostile: false, hp: 1 });
    }
  }

  _ai(dt) {
    const hazards = this.entities.filter((e) => e.hostile && e.mesh.position.y < 3 && e.mesh.position.y > -3);
    let tx = this.girl.position.x;
    if (this.prompt === "careful" && hazards[0]) {
      tx = hazards[0].mesh.position.x < tx ? tx + 1.5 : tx - 1.5;
      if (hazards[0].mesh.position.distanceTo(this.girl.position) < 2.5) this.summonWhale();
      if (this.stamina < 45 && !this.sleeping) this.toggleSleep();
    } else if (this.prompt === "treasure") {
      const loot = this.entities.find((e) => e.kind === "loot");
      if (loot) tx = loot.mesh.position.x;
    } else if (this.prompt === "explore") {
      tx = Math.sin(this.t * 0.7) * 2.5;
      if (this.boost <= 0 && Math.random() < 0.01) this.triggerBoost();
    } else {
      tx = Math.sin(this.t * 1.4) * 1.8;
      const foe = hazards.find((e) => e.mesh.position.distanceTo(this.girl.position) < 2.4);
      if (foe) this.attack();
      if (this.stamina < 30 && !this.sleeping) this.toggleSleep();
    }
    if (this.sleeping && this.stamina > 75) this.toggleSleep();
    this.girl.position.x += clamp(tx - this.girl.position.x, -2.5, 2.5) * dt * 2.2;
  }

  _update(dt) {
    if (!this.running) return;
    this.t += dt;
    const zone = zoneAt(this.depth);
    this.audio.setMood(zone.mood);

    // fog / light by depth
    const deep = clamp(this.depth / 1600, 0, 1);
    this.scene.fog.color.set(zone.bottom || "#0a1c33");
    this.scene.fog.density = 0.03 + deep * 0.05;
    this.hemi.intensity = 1.0 - deep * 0.55;
    this.sun.intensity = 1.2 - deep * 0.9;
    this.key.color.set(zone.particle || "#5ce1ff");
    this.shaftGroup.visible = this.depth < 160;
    this.bio.material.opacity = 0.2 + deep * 0.55;

    const speed = 4.2 * (this.sleeping ? 1.15 : 1) * (1 + this.boost) * (this.prompt === "careful" ? 0.85 : 1.05);
    this.depth += speed * dt * 8;
    this.maxDepth = Math.max(this.maxDepth, this.depth);
    if (this.boost > 0) this.boost = Math.max(0, this.boost - dt * 0.9);
    if (this.whaleCd > 0) this.whaleCd -= dt;
    if (this.magicCd > 0) this.magicCd -= dt;
    if (this.attackT > 0) this.attackT -= dt;

    if (this.sleeping) this.stamina = Math.min(100, this.stamina + 12 * dt);
    else this.stamina = Math.min(100, this.stamina + 1.2 * dt);

    if (this.mode === "ai" || this.mode === "demo") this._ai(dt);
    else if (this.pointer?.active && !this.sleeping) {
      this.girl.position.x += this.pointer.x * 4.5 * dt;
      this.girl.position.y += this.pointer.y * 2.2 * dt;
    }
    this.girl.position.x = clamp(this.girl.position.x, -3.2, 3.2);
    this.girl.position.y = clamp(this.girl.position.y, -1.2, 1.8);

    // animate girl / whale
    const bob = Math.sin(this.t * (this.sleeping ? 1.5 : 4)) * 0.05;
    this.girl.position.y += bob * 0.02;
    this.girl.rotation.z = Math.sin(this.t * 2) * 0.08;
    this.girl.userData.strandL.rotation.z = 0.25 + Math.sin(this.t * 3) * 0.15;
    this.girl.userData.strandR.rotation.z = -0.25 - Math.sin(this.t * 3.2) * 0.15;

    const wtx = this.girl.position.x + 2.1;
    const wty = this.girl.position.y - 0.5;
    this.whale.position.x += (wtx - this.whale.position.x) * 1.5 * dt;
    this.whale.position.y += (wty - this.whale.position.y) * 1.2 * dt;
    this.whale.rotation.y = Math.PI;
    this.whale.userData.tail.rotation.y = Math.sin(this.t * 2.2) * 0.35;
    this.whale.userData.fin.rotation.x = Math.sin(this.t * 1.8) * 0.2;

    // camera follow vertical feel
    this.camera.position.x += (this.girl.position.x * 0.35 - this.camera.position.x) * 2 * dt;
    this.camera.position.y += (this.girl.position.y + 1.0 - this.camera.position.y) * 2 * dt;
    this.camera.lookAt(this.girl.position.x * 0.3, this.girl.position.y, -1);

    this.spawnAcc += dt;
    if (this.spawnAcc > (this.prompt === "careful" ? 0.55 : 0.38)) {
      this.spawnAcc = 0;
      this._spawn();
    }

    // move world up (falling feeling)
    const rise = speed * dt;
    for (const e of this.entities) {
      e.mesh.position.y += rise;
      if (e.kind === "creature") {
        e.mesh.position.x += (e.mesh.userData.vx || 0) * dt;
        e.mesh.rotation.y += dt;
      }
      if (e.kind === "loot") {
        e.mesh.rotation.x += dt * 2;
        e.mesh.rotation.y += dt * 2.5;
      }
      if (e.kind === "rune") e.mesh.rotation.z += dt * 1.5;

      const d = e.mesh.position.distanceTo(this.girl.position);
      if (e.kind === "rock" && d < 1.1) {
        this._hurt(e.volcanic ? 14 : 10);
        e.mesh.position.x += e.mesh.position.x < this.girl.position.x ? -1.5 : 1.5;
        this.audio.sfxRock();
        this.ui.whaleLine(pick(WHALE_LINES));
      } else if (e.kind === "creature" && e.hostile && d < 0.9) {
        this._hurt(8);
        this.audio.sfxHit();
      } else if (e.kind === "loot" && d < 0.85) {
        e.dead = true;
        this.world.remove(e.mesh);
        this.lootCount += 1;
        this.audio.sfxTreasure();
        if (Math.random() < 0.4) {
          this.seaweed += 1;
          this.stamina = Math.min(100, this.stamina + 18);
          this.audio.sfxSeaweed();
          this.ui.toast("海草！可復活 / 回復");
        } else if (Math.random() < 0.55) {
          const hair = pick(Object.keys(HAIR_COLORS));
          const dress = pick(Object.keys(DRESS_COLORS));
          this._applyLook(hair, dress);
          this.audio.sfxEquip();
          this.ui.toast(`換裝：${this.look.outfit.label}`);
        } else {
          this.ui.toast("取得海中寶物");
        }
      }

      // whale push
      if (e.hostile && e.mesh.position.distanceTo(this.girl.position) < 1.8) {
        e.mesh.position.x += e.mesh.position.x < this.girl.position.x ? -0.8 : 0.8;
      }

      if (e.mesh.position.y > 12) e.dead = true;
    }
    this.entities = this.entities.filter((e) => {
      if (e.dead) {
        this.world.remove(e.mesh);
        return false;
      }
      return true;
    });

    for (const b of this.bubbleGroup.children) {
      b.position.y += b.userData.vy * dt + rise * 0.3;
      if (b.position.y > 8) b.position.y = -6;
    }
    this.bio.rotation.y += dt * 0.05;

    if (this.mode === "demo") {
      if (Math.floor(this.t) % 11 === 3) this.summonWhale();
      if (Math.floor(this.t) % 13 === 5) this.placeMagic();
      if (Math.floor(this.t) % 17 === 7) this.triggerBoost();
      const prompts = ["proactive", "treasure", "careful", "explore"];
      this.setPrompt(prompts[Math.floor(this.t / 12) % prompts.length]);
    }

    if (this.stamina <= 0) this._die();

    this.ui.setDepth(this.depth, this.best);
    this.ui.setStamina(this.stamina);
  }

  _hurt(n) {
    this.stamina -= n;
    this.girl.userData.aura.material.opacity = 0.25;
    setTimeout(() => { if (this.girl?.userData?.aura) this.girl.userData.aura.material.opacity = 0.08; }, 200);
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
    this.audio.sfxRevive();
    this.ui.showGame();
    this.ui.toast("海草復活！");
    this.summonWhale();
  }

  _loop(ts) {
    if (!this._last) this._last = ts;
    let dt = Math.min(0.033, (ts - this._last) / 1000);
    this._last = ts;
    if (this.running) this._update(dt);
    else {
      this.t += dt;
      this.girl.rotation.y = Math.sin(this.t * 0.5) * 0.3;
      this.whale.position.x = 2.2 + Math.sin(this.t * 0.4) * 0.4;
      this.whale.userData.tail.rotation.y = Math.sin(this.t * 2) * 0.3;
      this.camera.lookAt(0, 0.2, -1);
    }
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this._loop);
  }
}
