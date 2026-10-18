// Runs only inside the server-owned, non-rendering Chromium simulation.
// Clients submit destinations/actions, never transforms, health or cooldowns.
import * as T from "three";
import {
  avatar,
  tint,
  pose,
  transform,
  withSeed,
  staticRocks,
} from "./common.js?v=47";
import { TapSwim } from "../three/tap-swim.js?v=42";
import { SwimPropulsion } from "../three/swim-propulsion.js?v=42";
import { animateCharacter } from "../three/authored.js?v=47";
import {
  resolveGirlShark,
  girlContactSpheres,
} from "../three/shark-contacts.js?v=42";
import { makeTreasure } from "../three/meshes.js?v=42";

const owned = [
  "girl",
  "tapSwim",
  "swimMotor",
  "swimVelocity",
  "previousMotionVelocity",
  "swimAcceleration",
  "swimPhase",
  "policyCommand",
  "tapMotion",
];
const clamp = T.MathUtils.clamp;
export class AuthoritativeDive {
  constructor(game) {
    this.g = game;
    game.multiplayerAuthority = true;
    this.players = new Map();
    this.entitySerial = 0;
    this.recipeSerial = 0;
    this.attacker = null;
    this.events = [];
    this.eventSerial = 0;
    this.collisionCount = 0;
    this.tick = 0;
    for (const method of [
      "_spawn",
      "_spawnMarine",
      "_spawnPredator",
      "_spawnVisitor",
      "placeMagic",
    ]) {
      const original = game[method].bind(game);
      game[method] = (...args) => {
        const before = new Set(game.entities),
          seed = Math.floor(Math.random() * 4294967296),
          group = ++this.recipeSerial,
          counters = Object.fromEntries(
            ["predatorSpawns", "visitorCount", "wildlifeCount"].map((n) => [
              n,
              game[n],
            ]),
          );
        const value = withSeed(seed, () => original(...args));
        let index = 0;
        for (const e of game.entities)
          if (!before.has(e) && !e.net) {
            e.net = {
              id: ++this.entitySerial,
              method,
              seed,
              group,
              index: index++,
              args,
              counters,
            };
          }
        return value;
      };
    }
    for (const method of ["_breakWhaleRock", "_collectLoot", "_hurt"]) {
      const original = game[method].bind(game);
      game[method] = (...args) => {
        const value = original(...args);
        if (method === "_hurt" && value)
          this.emit("damage", { amount: game.lastDamage.amount });
        if (method === "_collectLoot")
          this.emit("pickup", { count: game.lootCount });
        if (method === "_breakWhaleRock")
          this.emit("shatter", { point: args[1].toArray() });
        return value;
      };
    }
  }
  emit(type, data = {}) {
    this.events.push({ id: ++this.eventSerial, type, ...data });
    if (this.events.length > 40) this.events.shift();
  }
  quiet(root) {
    root.userData.surfaces = [];
    root.userData.motionGarment.update = () => false;
    root.userData.sleepCloth.update = () => false;
    root.userData.clothContact.update = () => {};
  }
  capture(p) {
    for (const n of owned) p[n] = this.g[n];
  }
  use(p) {
    for (const n of owned) this.g[n] = p[n];
    this.current = p;
  }
  async start() {
    await this.g.start("manual");
    this.g.audio.track.pause();
    this.g.audio.ctx?.suspend();
    this.base = this.g.girl;
    this.quiet(this.base);
    this.rocks = staticRocks(this.g);
    for (const e of this.g.entities)
      if (!e.net)
        e.net = {
          id: ++this.entitySerial,
          method: "treasure",
          seed: 0,
          group: ++this.recipeSerial,
          index: 0,
          args: [],
        };
  }
  async sync(roster) {
    const ids = new Set(roster.map((p) => p.id));
    for (const [id, p] of this.players)
      if (!ids.has(id)) {
        if (this.attacker === id) {
          this.use(p);
          this.g.combat.interrupt(this.g);
          this.attacker = null;
        }
        this.g.scene.remove(p.girl);
        this.players.delete(id);
      }
    for (const info of roster) {
      if (this.players.has(info.id)) continue;
      const first = this.players.size === 0,
        root = first && !this.baseUsed ? this.base : await avatar(this.g);
      this.baseUsed = true;
      this.quiet(root);
      tint(root, info.color);
      const anchor =
        [...this.players.values()][0]?.girl.position ||
        new T.Vector3(0, -0.4, 0);
      root.position.copy(anchor);
      let best = null;
      for (const x of [-2.4, -1.2, 0, 1.2, 2.4])
        for (const y of [-0.8, 0.5, 1.7]) {
          const test = new T.Vector3(x, y, 0);
          const clear = [...this.players.values()].every(
            (p) =>
              Math.hypot(p.girl.position.x - x, (p.girl.position.y - y) * 0.8) >
              1,
          );
          if (
            clear &&
            (!best || test.distanceTo(anchor) < best.distanceTo(anchor))
          )
            best = test;
        }
      root.position.copy(best || new T.Vector3(2.8, 1.5, 0.3));
      const p = {
        ...info,
        girl: root,
        tapSwim: new TapSwim(),
        swimMotor: new SwimPropulsion(),
        swimVelocity: new T.Vector3(),
        previousMotionVelocity: new T.Vector3(),
        swimAcceleration: new T.Vector3(),
        swimPhase: 0,
        policyCommand: new T.Vector3(),
        tapMotion: { active: false },
      };
      this.players.set(p.id, p);
    }
  }
  action(c) {
    const p = this.players.get(c.id);
    if (!p) return;
    this.use(p);
    const g = this.g;
    if (c.type === "input") {
      p.tapSwim.setAspect(c.aspect);
      p.tapSwim.tap(c.x, c.y, p.girl.position);
      return;
    }
    let accepted = false;
    if (c.action === "attack") {
      document.querySelector("#attackStyle").value = c.move;
      accepted = g.attack();
      if (accepted) this.attacker = p.id;
    } else if (c.action === "sleep") {
      if (!g.combat.active) {
        g.toggleSleep();
        accepted = true;
      }
    } else if (c.action === "whale") accepted = g.summonWhale();
    else if (c.action === "boost") {
      if (g.running && !g.combat.active && g.boost < 0.05) {
        g.triggerBoost();
        accepted = true;
      }
    } else if (c.action === "magic") {
      if (g.magicCd <= 0) {
        g.placeMagic();
        accepted = true;
      }
    } else if (c.action === "revive") {
      g.revive();
      accepted = g.running;
    } else if (c.action === "restart" && !g.running) {
      this.restartRequested = true;
    }
    if (accepted) this.emit(c.action, { playerId: p.id });
    this.capture(p);
  }
  async step({ roster, commands = [], actions = {} }, dt) {
    await this.sync(roster);
    if (!this.players.size) return null;
    for (const p of this.players.values())
      p.girl.userData.swimPPO.externalAction = actions[p.id];
    for (const c of commands) this.action(c);
    const primary =
      this.players.get(this.attacker) || this.players.values().next().value;
    this.use(primary);
    const g = this.g;
    if (this.restartRequested) {
      this.restartRequested = false;
      await g.start("manual");
      this.capture(primary);
      this.quiet(primary.girl);
      for (const p of this.players.values()) p.girl.userData.swimPPO.reset();
    }
    g._update(dt);
    this.capture(primary);
    if (!g.combat.active) this.attacker = null;
    for (const p of this.players.values())
      if (p !== primary && g.running) {
        this.use(p);
        const m = p.tapSwim.update(dt, p.girl.position, {
            sleeping: g.sleeping,
          }),
          desired = new T.Vector3(m.x, m.y, 0);
        p.policyCommand = desired.clone();
        if (!g.sleeping)
          desired.multiplyScalar(
            p.girl.userData.swimPPO.locomotionGain(desired),
          );
        else desired.set(0, 0, 0);
        const output = p.swimMotor.update(dt, desired, {
          sleeping: g.sleeping,
          style: m.style,
        });
        p.swimVelocity.copy(output);
        const v = p.swimVelocity;
        p.girl.position.addScaledVector(v, dt);
        p.girl.position.x = clamp(p.girl.position.x, -3.2, 3.2);
        p.girl.position.y = clamp(p.girl.position.y, -1.2, 1.8);
        p.swimPhase += dt * (1.3 + v.length() * 0.2);
        p.tapMotion = m;
        p.girl.rotation.set(
          -0.12 - v.y * 0.04,
          0.42 + v.x * 0.22,
          -0.1 - v.x * 0.2,
        );
        animateCharacter(p.girl, g.t, {
          commandVelocity: p.policyCommand,
          velocity: v,
          sleeping: g.sleeping,
          controlled: m.active,
          swimStyle: m.style,
          phase: p.swimPhase,
          speed: v.length(),
          activity: 0.9,
        });
        const solids = [
          ...this.rocks.filter((o) => o.visible),
          ...g.entities
            .filter((e) => e.kind === "rock" && !e.dead)
            .map((e) => e.mesh),
        ];
        const hits = g.rockContacts.resolve(p.girl, solids);
        if (hits.some((h) => h.penetration > 0.025))
          g._hurt(10, hits[0].point, "rock");
        resolveGirlShark(g, dt);
        if (g.whale.visible) g._whaleTouch(dt);
        for (const e of g.entities)
          if (!e.dead) {
            if (
              e.kind === "loot" &&
              g.rockContacts.pickupDistance(p.girl, e.mesh.position) < 0.38
            )
              g._collectLoot(e);
            else if (
              e.hostile &&
              e.kind === "predator" &&
              g.combat.hitDistance(
                e,
                p.girl.userData.bones.chest.getWorldPosition(new T.Vector3()),
              ) < 0.18
            )
              g._predatorBite(
                e,
                p.girl.userData.bones.chest.getWorldPosition(new T.Vector3()),
              );
          }
        this.capture(p);
      }
    this.separate();
    this.use(primary);
    g.ocean.update(g.t, { depth: g.depth });
    g.oceanDetails.update(g.t, g.depth, g);
    return this.snapshot();
  }
  separate() {
    const players = [...this.players.values()];
    for (let pass = 0; pass < 10; pass++) {
      let moved = false;
      for (let i = 0; i < players.length; i++)
        for (let j = i + 1; j < players.length; j++) {
          const a = players[i],
            b = players[j],
            aa = girlContactSpheres(this.gFor(a)),
            bb = girlContactSpheres(this.gFor(b));
          let deepest = 0,
            normal = null;
          for (const x of aa)
            for (const y of bb) {
              const delta = x.center.clone().sub(y.center),
                d = delta.length(),
                pen = x.radius + y.radius + 0.045 - d;
              if (pen > deepest) {
                deepest = pen;
                normal =
                  d > 0.0001
                    ? delta.divideScalar(d)
                    : new T.Vector3(i % 2 ? 1 : -1, 0.2, 0).normalize();
              }
            }
          if (deepest > 0.0001) {
            const shift = normal.multiplyScalar((deepest + 0.001) * 0.5);
            a.girl.position.add(shift);
            b.girl.position.sub(shift);
            a.swimMotor.impulse(shift.x * 0.4, shift.y * 0.4, shift.z * 0.4);
            b.swimMotor.impulse(-shift.x * 0.4, -shift.y * 0.4, -shift.z * 0.4);
            moved = true;
            this.collisionCount++;
          }
        }
      if (!moved) break;
    }
  }
  gFor(p) {
    return { girl: p.girl, rockContacts: this.g.rockContacts };
  }
  snapshot() {
    const g = this.g;
    for (const e of g.entities)
      if (!e.net)
        e.net = {
          id: ++this.entitySerial,
          method: "treasure",
          seed: 0,
          group: ++this.recipeSerial,
          index: 0,
          args: [],
        };
    let minimumClearance = null;
    const peers = [...this.players.values()];
    for (let i = 0; i < peers.length; i++)
      for (let j = i + 1; j < peers.length; j++)
        for (const a of girlContactSpheres(this.gFor(peers[i])))
          for (const b of girlContactSpheres(this.gFor(peers[j]))) {
            const d = a.center.distanceTo(b.center) - a.radius - b.radius;
            minimumClearance =
              minimumClearance === null ? d : Math.min(minimumClearance, d);
          }
    return {
      tick: ++this.tick,
      t: g.t,
      depth: g.depth,
      running: g.running,
      stamina: g.stamina,
      loot: g.lootCount,
      affection: g.affection,
      seaweed: g.seaweed,
      dressDamage: g.dressDamage,
      sleeping: g.sleeping,
      boost: g.boost,
      whaleCd: g.whaleCd,
      magicCd: g.magicCd,
      biomeSeed: g.depthBiomes.seed,
      biome: g.depthBiomes.status,
      players: [...this.players.values()].map((p) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        ...transform(p.girl),
        bones: pose(p.girl),
        velocity: p.swimVelocity.toArray(),
        sleepBlend: p.girl.userData.sleepBlend || 0,
        combatPose: p.girl.userData.combatPose || null,
        clip: p.girl.userData.swimPPO.clip,
        ppo: p.girl.userData.swimPPO.status,
        observation: p.girl.userData.swimPPO.lastObservation || null,
      })),
      whale: {
        ...transform(g.whale),
        state: g.whaleState,
        motion: g.whale.userData.whaleMotion,
        near: g.whaleNear,
      },
      combat: {
        stage: g.combat.stage,
        age: g.combat.age,
        cooldown: g.combat.cooldown,
        move: g.combat.move?.id,
        serial: g.combat.serial,
        hits: g.combat.hits,
        lastResult: g.combat.lastResult,
        attacker: this.attacker,
      },
      entities: g.entities
        .filter((e) => !e.dead)
        .map((e) => ({
          net: e.net,
          kind: e.kind,
          hostile: e.hostile,
          hp: e.hp,
          ...transform(e.mesh),
          predator: e.mesh.userData.predator
            ? {
                phase: e.mesh.userData.predator.phase,
                stage: e.mesh.userData.predator.stage,
              }
            : null,
        })),
      broken: this.rocks
        .map((m, i) => (!m.visible ? i : -1))
        .filter((i) => i >= 0),
      events: this.events,
      collisions: this.collisionCount,
      minimumClearance,
    };
  }
}
