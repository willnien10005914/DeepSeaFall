import * as T from "three";
import { FlowGrains } from "./attack-particles.js?v=49";
const clamp = T.MathUtils.clamp;
// A bounded Lagrangian visual simulation: emitter momentum, curl velocity,
// drag, buoyant heat and finite cooling/lifetime. This is not a fluid solver.
export class AttackAdvection {
  constructor(overlay, scene, capacity = 1300) {
    this.capacity = capacity;
    this.p = new Float32Array(capacity * 3);
    this.v = new Float32Array(capacity * 3);
    this.age = new Float32Array(capacity);
    this.life = new Float32Array(capacity);
    this.heat = new Float32Array(capacity);
    this.colors = new Float32Array(capacity * 3);
    this.cursor = 0;
    this.seed = 7153;
    this.accumulator = 0;
    this.lastTime = null;
    this.lastStage = "";
    this.previous = new Map();
    this.grains = new FlowGrains(capacity, overlay);
    this.grains.points.name = "Advected fire and light droplets";
    this.lines = new Float32Array(capacity * 6);
    this.lineColors = new Float32Array(capacity * 6);
    const g = new T.BufferGeometry();
    g.setAttribute(
      "position",
      new T.BufferAttribute(this.lines, 3).setUsage(T.DynamicDrawUsage),
    );
    g.setAttribute(
      "color",
      new T.BufferAttribute(this.lineColors, 3).setUsage(T.DynamicDrawUsage),
    );
    g.setDrawRange(0, 0);
    this.trails = new T.LineSegments(
      g,
      new T.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.35,
        blending: T.AdditiveBlending,
        depthWrite: false,
        depthTest: false,
        toneMapped: false,
      }),
    );
    this.trails.name = "Cooling advected light filaments";
    this.trails.frustumCulled = false;
    this.trails.visible = false;
    overlay.add(this.trails);
    this.light = new T.PointLight(0xffb15d, 0, 5.5, 2);
    scene.add(this.light);
    this.stats = { alive: 0 };
  }
  random() {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }
  clear() {
    this.life.fill(0);
    this.age.fill(0);
    this.grains.begin();
    this.grains.end();
    this.trails.visible = false;
    this.light.intensity = 0;
    this.previous.clear();
    this.lastTime = null;
    this.lastStage = "";
    this.accumulator = 0;
  }
  emit(position, momentum, color, heat, burst = 1) {
    const i = this.cursor++ % this.capacity,
      k = i * 3,
      a = this.random() * Math.PI * 2,
      r = Math.sqrt(this.random()),
      z = (this.random() - 0.5) * 0.8;
    this.p[k] = position.x + Math.cos(a) * r * 0.065;
    this.p[k + 1] = position.y + Math.sin(a) * r * 0.065;
    this.p[k + 2] = position.z + z * 0.08;
    this.v[k] = momentum.x * 0.62 + Math.cos(a) * r * burst;
    this.v[k + 1] = momentum.y * 0.62 + Math.sin(a) * r * burst + 0.2;
    this.v[k + 2] = momentum.z * 0.62 + z * burst;
    this.life[i] = 0.48 + this.random() * 1.45;
    this.age[i] = 0;
    this.heat[i] = heat;
    this.colors[k] = color.r;
    this.colors[k + 1] = color.g;
    this.colors[k + 2] = color.b;
  }
  update(game, move, pose) {
    const time = game.t || 0,
      dt =
        this.lastTime === null ? 1 / 60 : clamp(time - this.lastTime, 0, 0.08);
    this.lastTime = time;
    const active = !!(move && pose),
      fire = move?.element === "fire",
      icy = move?.element === "ice",
      color = new T.Color(move?.color || 0x9bdfff);
    let center = null;
    if (active) {
      const bones = game.girl.userData.bones,
        anchors = move.id.includes("kick")
          ? ["l_ankle", "r_ankle"]
          : move.id.includes("slash") ||
              move.id.includes("sword") ||
              move.id.includes("blades")
            ? ["l_wrist", "r_wrist"]
            : ["chest", "l_wrist", "r_wrist"];
      center = bones.chest.getWorldPosition(new T.Vector3());
      const stage = game.combat.serial + ":" + pose.stage;
      if (stage !== this.lastStage && pose.stage === "strike")
        for (let n = 0; n < 140; n++)
          this.emit(
            center,
            new T.Vector3(),
            color,
            fire ? 1 : 0.3,
            1.2 + this.random() * 1.3,
          );
      this.lastStage = stage;
      this.accumulator +=
        dt *
        (pose.stage === "charge" ? 110 : pose.stage === "strike" ? 520 : 55);
      let emissions = Math.min(64, Math.floor(this.accumulator));
      this.accumulator -= emissions;
      const sources = anchors.map((name) => {
        const point = bones[name].getWorldPosition(new T.Vector3()),
          previous = this.previous.get(name),
          velocity = previous
            ? point
                .clone()
                .sub(previous)
                .divideScalar(Math.max(dt, 0.008))
                .clampLength(0, 5)
            : new T.Vector3();
        this.previous.set(name, point.clone());
        return { point, velocity };
      });
      for (let n = 0; n < emissions; n++) {
        const s = sources[n % sources.length];
        const inward =
          pose.stage === "charge"
            ? center.clone().sub(s.point).multiplyScalar(0.6)
            : new T.Vector3();
        this.emit(
          s.point,
          s.velocity.clone().add(inward),
          color,
          fire ? 1 : icy ? 0.08 : 0.42,
          pose.stage === "strike" ? 1.1 : 0.24,
        );
      }
    } else this.previous.clear();
    this.grains.begin();
    let alive = 0,
      maxSpeed = 0,
      energy = 0;
    const count = Math.max(1, Math.ceil(dt / 0.011)),
      h = dt / count;
    for (let i = 0; i < this.capacity; i++) {
      if (this.age[i] >= this.life[i]) continue;
      this.age[i] += dt;
      if (this.age[i] >= this.life[i]) continue;
      const k = i * 3,
        heat = this.heat[i] * Math.exp(-this.age[i] * 1.65);
      for (let step = 0; step < count; step++) {
        const x = this.p[k] * 2.3,
          y = this.p[k + 1] * 2.3,
          z = this.p[k + 2] * 2.3,
          windX = Math.sin(y + time * 1.1) + 0.45 * Math.cos(z - time * 0.7),
          windY = Math.sin(z + time * 0.9) + 0.45 * Math.cos(x + time),
          windZ = Math.sin(x - time * 0.6) + 0.45 * Math.cos(y + time * 0.8),
          drag = Math.exp(-h * (1.9 + (0.4 - heat) * 0.3));
        this.v[k] = (this.v[k] + windX * h * 0.72) * drag;
        this.v[k + 1] =
          (this.v[k + 1] + (windY * 0.72 + heat * 1.65 + 0.1) * h) * drag;
        this.v[k + 2] = (this.v[k + 2] + windZ * h * 0.72) * drag;
        for (let a = 0; a < 3; a++) {
          this.v[k + a] = clamp(this.v[k + a], -6, 6);
          this.p[k + a] += this.v[k + a] * h;
        }
      }
      const u = this.age[i] / this.life[i],
        fade = Math.sin(Math.min(1, u * 5) * Math.PI * 0.5) * (1 - u) ** 1.35,
        hot = clamp(heat * 0.7, 0, 0.7),
        r = (this.colors[k] * (1 - hot) + hot) * fade,
        g = (this.colors[k + 1] * (1 - hot) + hot * 0.89) * fade,
        b = (this.colors[k + 2] * (1 - hot) + hot * 0.56) * fade;
      this.grains.push(this.p[k], this.p[k + 1], this.p[k + 2], r, g, b);
      const l = alive * 6,
        tail = 0.07 + 0.1 * u;
      for (let a = 0; a < 3; a++) {
        this.lines[l + a] = this.p[k + a];
        this.lines[l + 3 + a] = this.p[k + a] - this.v[k + a] * tail;
        this.lineColors[l + a] = [r, g, b][a] * 0.85;
        this.lineColors[l + 3 + a] = [r, g, b][a] * 0.06;
      }
      alive++;
      energy += heat;
      maxSpeed = Math.max(
        maxSpeed,
        Math.hypot(this.v[k], this.v[k + 1], this.v[k + 2]),
      );
    }
    this.grains.end(0.055);
    this.trails.geometry.attributes.position.needsUpdate = true;
    this.trails.geometry.attributes.color.needsUpdate = true;
    this.trails.geometry.setDrawRange(0, alive * 2);
    this.trails.visible = alive > 0;
    this.light.intensity = clamp(energy / 160, 0, 1.6);
    this.light.color.copy(color);
    if (center) this.light.position.copy(center);
    this.stats = {
      alive,
      maxSpeed,
      energy,
      detached: !active && alive > 0,
      method:
        "emitter momentum + curl advection + heat buoyancy + exponential drag/cooling",
    };
  }
}
