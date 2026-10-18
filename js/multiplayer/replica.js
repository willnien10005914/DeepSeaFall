import { animateGemstone } from "../three/gemstones.js?v=49";
// Render-only replica. All gameplay mutations and actor decisions come from Spark.
import * as T from "three";
import {
  avatar,
  tint,
  applyPose,
  applyTransform,
  withSeed,
  staticRocks,
} from "./common.js?v=49";
import { animateCharacter } from "../three/authored.js?v=49";
import { animateMarine } from "../three/marine-life.js?v=49";
import { makeTreasure } from "../three/meshes.js?v=49";
import { SwimBubbles } from "../three/swim-bubbles.js?v=49";
import { combatMoves } from "../three/combat-moves.js?v=49";

export class SeaReplica {
  constructor(game, id, onRoster) {
    this.g = game;
    this.id = id;
    this.onRoster = onRoster;
    this.avatars = new Map();
    this.labels = new Map();
    this.entityMap = new Map();
    this.groups = new Map();
    this.loading = new Set();
    this.eventId = null;
    this.latest = null;
    this.rocks = staticRocks(game);
    this.lastRunning = true;
    for (const e of game.entities) game.world.remove(e.mesh);
    game.entities = [];
    game.girl.visible = false;
    game.combat.strike = () => {};
    game._breakWhaleRock = () => {};
    game._hurt = () => false;
    this.layer = document.createElement("div");
    this.layer.className = "mp-label-layer";
    document.querySelector("#app").append(this.layer);
    game._update = (dt) => this.update(dt);
  }
  receive(state) {
    if (this.generation !== state.generation) {
      this.generation = state.generation;
      this.latest = null;
      this.eventId = null;
      this.g.depth = 0;
      this.g.maxDepth = 0;
      this.g.feedback.clear();
      for (const e of this.g.entities) this.g.world.remove(e.mesh);
      this.g.entities = [];
      this.entityMap.clear();
      this.groups.clear();
    }
    if (this.latest && state.tick <= this.latest.tick) return;
    this.latest = state;
    this.receivedAt = performance.now();
    this.onRoster(state.players, state.scoreboard);
  }
  async ensure(info) {
    if (this.avatars.has(info.id) || this.loading.has(info.id)) return;
    this.loading.add(info.id);
    try {
      const root = info.id === this.id ? this.g.girl : await avatar(this.g);
      if (!this.latest?.players.some((p) => p.id === info.id)) {
        if (root !== this.g.girl) this.g.scene.remove(root);
        return;
      }
      root.userData.networkPose = true;
      root.userData.surfaces = root.userData.surfaces || [];
      applyTransform(root, info);
      applyPose(root, info.bones);
      tint(root, info.color);
      const bubble = new SwimBubbles(
        this.g.scene,
        info.id === this.id ? 180 : 90,
      );
      this.avatars.set(info.id, { root, bubble });
      const label = document.createElement("div");
      label.className = "mp-avatar-label";
      label.style.setProperty("--girl-color", info.color);
      const name = document.createElement("span");
      name.textContent = info.name + (info.id === this.id ? " · 妳" : "");
      const chat = document.createElement("span");
      chat.className = "mp-bubble";
      label.append(name, chat);
      this.layer.append(label);
      this.labels.set(info.id, { label, name, chat, until: 0 });
    } finally {
      this.loading.delete(info.id);
    }
  }
  chat(message) {
    const b = this.labels.get(message.playerId);
    if (b) {
      b.chat.textContent = message.text;
      b.until = performance.now() + 7000;
      b.chat.classList.add("show");
    }
  }
  entity(data) {
    const id = data.net.id;
    if (this.entityMap.has(id)) return this.entityMap.get(id);
    const recipe = data.net;
    if (data.kind === "loot") {
      const mesh = makeTreasure(data.gemId);
      applyTransform(mesh, data);
      this.g.world.add(mesh);
      const e = { mesh, kind: "loot", hostile: false, hp: 1, net: recipe };
      this.g.entities.push(e);
      this.entityMap.set(id, e);
      return e;
    }
    let group = this.groups.get(recipe.group);
    if (!group) {
      const before = new Set(this.g.entities),
        oldToast = this.g.ui.toast;
      this.g.ui.toast = () => {};
      try {
        withSeed(recipe.seed, () => {
          if (recipe.method === "treasure") {
            const mesh = makeTreasure(...(recipe.args || []));
            this.g.world.add(mesh);
            this.g.entities.push({ mesh, kind: "loot", hostile: false, hp: 1 });
          } else {
            Object.assign(this.g, recipe.counters || {});
            this.g[recipe.method](...recipe.args);
          }
        });
      } finally {
        this.g.ui.toast = oldToast;
      }
      group = this.g.entities.filter((e) => !before.has(e));
      this.groups.set(recipe.group, group);
    }
    const e = group[recipe.index];
    if (e) {
      e.net = recipe;
      this.entityMap.set(id, e);
    }
    return e;
  }
  update(dt) {
    const s = this.latest;
    if (!s) return;
    const g = this.g,
      blend = 1 - Math.exp(-dt * 20),
      age = Math.min(0.1, (performance.now() - this.receivedAt) / 1000);
    g.t = s.t + age;
    g.depth = T.MathUtils.lerp(g.depth, s.depth, blend);
    g.maxDepth = Math.max(g.maxDepth, g.depth);
    g.stamina = s.stamina;
    g.lootCount = s.loot;
    g.affection = s.affection;
    g.sleeping = s.sleeping;
    g.whaleCd = s.whaleCd;
    g.magicCd = s.magicCd;
    g.boost = s.boost;
    g.seaweed = s.seaweed;
    g.dressDamage = s.dressDamage;
    if (g.depthBiomes.seed !== s.biomeSeed) g.depthBiomes.reset(s.biomeSeed);
    g.depthBiomes.update(dt, g.t, g.depth, g);
    const live = new Set(s.players.map((p) => p.id));
    for (const [id, a] of this.avatars)
      if (!live.has(id)) {
        g.scene.remove(a.root, a.bubble.mesh);
        this.labels.get(id)?.label.remove();
        this.labels.delete(id);
        this.avatars.delete(id);
        a.root.traverse((o) => {
          if (o.isMesh) {
            o.geometry?.dispose();
            for (const m of Array.isArray(o.material)
              ? o.material
              : [o.material])
              m.dispose();
          }
        });
      }
    for (const p of s.players) {
      this.ensure(p).catch((e) => console.error("Avatar load failed", e));
      const a = this.avatars.get(p.id);
      if (!a) continue;
      const root = a.root;
      applyTransform(root, p, blend);
      applyPose(root, p.bones, blend);
      root.userData.sleepBlend = p.sleepBlend;
      root.userData.combatPose = p.combatPose;
      root.userData.swimPPO.clip = p.clip;
      root.userData.swimPPO.active = !s.sleeping && !p.combatPose;
      root.userData.fabricDamage.value = s.dressDamage;
      const velocity = new T.Vector3(...p.velocity);
      animateCharacter(root, g.t, { velocity, sleeping: s.sleeping });
      a.bubble.update(dt, g.t, root, {
        swimming: !s.sleeping,
        velocity,
        phase: g.t * 1.3,
        boost: s.boost,
        turn: velocity.x * 0.4,
      });
      tint(root, p.color);
      const l = this.labels.get(p.id),
        point = root.userData.bones.head
          .getWorldPosition(new T.Vector3())
          .add(new T.Vector3(0, 0.25, 0))
          .project(g.camera),
        rect = g.canvas.getBoundingClientRect();
      if (l) {
        const text = `${p.name}${p.id === this.id ? " · 妳" : ""} · ◆${p.treasures || 0} · ${p.points || 0} 分`;
        if (l.name.textContent !== text) l.name.textContent = text;
        l.label.style.transform = `translate(${(point.x * 0.5 + 0.5) * rect.width}px,${(-point.y * 0.5 + 0.5) * rect.height}px) translate(-50%,-100%)`;
        l.label.hidden =
          point.z > 1 || Math.abs(point.x) > 1.2 || Math.abs(point.y) > 1.2;
        if (l.until < performance.now()) l.chat.classList.remove("show");
      }
    }
    const visibleEntities = new Set(s.entities.map((e) => e.net.id));
    for (const [id, e] of this.entityMap)
      if (!visibleEntities.has(id)) {
        g.world.remove(e.mesh);
        this.entityMap.delete(id);
        g.entities = g.entities.filter((x) => x !== e);
      }
    const groups = new Set(s.entities.map((e) => e.net.group));
    for (const id of this.groups.keys())
      if (!groups.has(id)) this.groups.delete(id);
    for (const data of s.entities) {
      const e = this.entity(data);
      if (!e) continue;
      applyTransform(e.mesh, data, blend);
      e.hostile = data.hostile;
      e.hp = data.hp;
      if (e.mesh.userData.predator && data.predator)
        Object.assign(e.mesh.userData.predator, data.predator);
      animateMarine(e.mesh, g.t, e.mesh.userData.vx || 0);
      if (e.kind === "loot") animateGemstone(e.mesh, g.t);
    }
    const broken = new Set(s.broken);
    for (let i = 0; i < this.rocks.length; i++)
      this.rocks[i].visible = !broken.has(i);
    applyTransform(g.whale, s.whale, blend);
    g.whaleState = s.whale.state;
    g.whaleNear = s.whale.near;
    animateCharacter(g.whale, g.t, s.whale.motion || {});
    g.whaleBubbles.updateExternal(dt, g.t);
    if (g.whale.visible && g.whaleState !== "hidden" && Math.random() < dt * 10)
      g.whaleBubbles.burst(
        g.whale.position,
        new T.Vector3(0, 0.1, 0),
        2,
        1.4,
        1,
      );
    const c = s.combat;
    Object.assign(g.combat, {
      stage: c.stage,
      age: c.age,
      cooldown: c.cooldown,
      serial: c.serial,
      hits: c.hits,
      lastResult: c.lastResult,
    });
    g.combat.move = combatMoves.find((m) => m.id === c.move) || g.combat.move;
    const own = g.girl,
      attacker = this.avatars.get(c.attacker);
    if (attacker) g.girl = attacker.root;
    g.combat.afterPose(g);
    g.girl = own;
    g.combat.updateUI(g);
    g._updateCamera(dt);
    if (this.avatars.size > 1) {
      const box = new T.Box3();
      for (const a of this.avatars.values())
        for (const b of Object.values(a.root.userData.bones))
          box.expandByPoint(b.getWorldPosition(new T.Vector3()));
      const size = box.getSize(new T.Vector3()),
        center = box.getCenter(new T.Vector3()),
        tan = Math.tan((g.camera.fov * Math.PI) / 360),
        distance = Math.max(
          8.5,
          (size.x + 1.6) / (2 * tan * g.camera.aspect),
          (size.y + 1.8) / (2 * tan),
        );
      g.camera.position.lerp(
        center.clone().add(new T.Vector3(0.3, 0.35, distance)),
        1 - Math.exp(-dt * 2),
      );
      g.camera.lookAt(center);
    }

    g.ui.setDepth(g.depth, g.best);
    g.ui.setStamina(s.stamina);
    const personal = s.players.find((p) => p.id === this.id);
    g.ui.setTreasure(personal?.treasures || 0);
    g.ui.setScore?.(personal?.points || 0);
    g.ui.setAffection(s.affection);
    g.ui.setDressCondition(s.dressDamage);
    g.ui.btnSleep.textContent = s.sleeping ? "一起醒來" : "一起抱膝補力";
    g.ui.btnWhale.disabled = s.whale.state !== "hidden" || s.whaleCd > 0;
    g.ui.btnWhale.textContent =
      s.whale.state === "following"
        ? "鯨魚相伴中"
        : s.whale.state === "approaching"
          ? "鯨魚游來中…"
          : s.whale.state === "departing"
            ? "鯨魚離開中…"
            : s.whaleCd > 0
              ? "稍候再呼喚"
              : "一起呼喚鯨魚";
    if (this.eventId === null) this.eventId = s.events.at(-1)?.id || 0;
    for (const e of s.events)
      if (e.id > this.eventId) {
        this.eventId = e.id;
        if (e.type === "whale") g.audio.sfxWhale();
        if (e.type === "attack") g.audio.sfxMagic();
        if (e.type === "pickup") {
          g.audio.sfxTreasure();
          if (e.playerId === this.id) {
            const point = g._screenPoint(new T.Vector3(...e.point));
            g.feedback.collect(point, e.gain || 0, e.gemId);
            g.feedback.label(point, `+${e.value} 分`);
            document
              .querySelector(".treasure-total")
              ?.animate(
                [{ filter: "brightness(2)" }, { filter: "brightness(1)" }],
                { duration: 500 },
              );
          }
        }
        if (e.type === "damage") g.audio.sfxHit();
        if (e.type === "shatter") {
          const p = new T.Vector3(...e.point);
          g.rockFragments.burst(p, new T.Vector3(0.3, 0.5, 0), 1);
          g.audio.sfxRock();
        }
      }
    g.rockFragments.update(dt);
    if (s.running !== this.lastRunning) {
      this.lastRunning = s.running;
      if (s.running) g.ui.showGame();
      else
        g.ui.showGameOver({
          depth: Math.floor(s.depth),
          loot: personal?.treasures || 0,
          score: personal?.points || 0,
          canRevive: s.seaweed > 0,
        });
    }
  }
}
