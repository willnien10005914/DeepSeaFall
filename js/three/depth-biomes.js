import { scheduleAt } from "./biome-schedule.js?v=49";
import { DepthLandmarks } from "./depth-landmarks.js?v=49";
import { descentTravel, movingSlice } from "./descent-motion.js?v=49";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import * as THREE from "three";
import { makeDeepSeaFish, animateMarine } from "./marine-life.js?v=49";
export const BIOME_METRES = 10;
export const depthThemes = Object.freeze([
  {
    id: "blue-garden",
    weeds: 0.18,
    name: "湛藍海庭",
    weed: 0x348477,
    glow: 0x49c9c0,
    scatter: [0.033, 0.19, 0.4],
    background: 0x071d30,
    light: 1,
    sun: 3.6,
    ambient: 0.65,
    environment: 0.75,
    stars: 0.12,
    lantern: 0,
  },
  {
    id: "pink-meadow",
    weeds: 0.9,
    name: "粉紅海草林",
    weed: 0xc06c9e,
    glow: 0xf1a5dc,
    scatter: [0.071, 0.13, 0.28],
    background: 0x170f2c,
    light: 0.9,
    sun: 2.8,
    ambient: 0.56,
    environment: 0.65,
    stars: 0.4,
    lantern: 0,
  },
  {
    id: "jade-forest",
    weeds: 0.95,
    name: "翡翠流光林",
    weed: 0x348b64,
    glow: 0x85ffd1,
    scatter: [0.025, 0.2, 0.23],
    background: 0x071f24,
    light: 0.95,
    sun: 3.2,
    ambient: 0.6,
    environment: 0.68,
    stars: 0.26,
    lantern: 0,
  },
  {
    id: "star-drift",
    weeds: 0,
    name: "星河浮游帶",
    weed: 0x676fbb,
    glow: 0xbcc6ff,
    scatter: [0.03, 0.09, 0.21],
    background: 0x070b20,
    light: 0.68,
    sun: 1.45,
    ambient: 0.42,
    environment: 0.4,
    stars: 1,
    lantern: 0.18,
  },
  {
    id: "lantern-abyss",
    weeds: 0,
    name: "燈籠魚幽谷",
    weed: 0x214957,
    glow: 0x72dfff,
    scatter: [0.014, 0.047, 0.1],
    background: 0x010309,
    light: 0.48,
    sun: 0.75,
    ambient: 0.3,
    environment: 0.28,
    stars: 0.13,
    lantern: 1,
  },
  {
    id: "mythic-ruins",
    weeds: 0.1,
    name: "潮汐神話遺城",
    weed: 0x668f83,
    glow: 0x77e0d9,
    scatter: [0.035, 0.16, 0.24],
    background: 0x081e2a,
    light: 0.95,
    sun: 3.2,
    ambient: 0.62,
    environment: 0.72,
    stars: 0.2,
    lantern: 0,
  },
  {
    id: "stone-canyon",
    weeds: 0,
    name: "古老玄岩峽谷",
    weed: 0x516e6e,
    glow: 0x91c9d3,
    scatter: [0.032, 0.15, 0.26],
    background: 0x071926,
    light: 0.9,
    sun: 3.1,
    ambient: 0.57,
    environment: 0.64,
    stars: 0.04,
    lantern: 0,
  },
  {
    id: "volcanic-rift",
    weeds: 0,
    name: "海底火山裂隙",
    weed: 0x6d4d3d,
    glow: 0xffa46b,
    scatter: [0.13, 0.079, 0.055],
    background: 0x170d11,
    light: 0.78,
    sun: 2.5,
    ambient: 0.53,
    environment: 0.53,
    stars: 0.15,
    lantern: 0,
  },
  {
    id: "crimson-reef",
    weeds: 0.82,
    name: "赤紅異星珊瑚林",
    weed: 0xa43b65,
    glow: 0xff809d,
    scatter: [0.12, 0.045, 0.085],
    background: 0x170919,
    light: 0.77,
    sun: 2.3,
    ambient: 0.51,
    environment: 0.5,
    stars: 0.48,
    lantern: 0.08,
  },
  {
    id: "amber-grove",
    weeds: 0.72,
    name: "琥珀流金海林",
    weed: 0x9d8842,
    glow: 0xffdc85,
    scatter: [0.115, 0.105, 0.045],
    background: 0x15150c,
    light: 0.87,
    sun: 2.8,
    ambient: 0.58,
    environment: 0.6,
    stars: 0.55,
    lantern: 0,
  },
  {
    id: "black-trench",
    weeds: 0,
    name: "黑曜無光深淵",
    weed: 0x252c4b,
    glow: 0xa89cff,
    scatter: [0.016, 0.025, 0.066],
    background: 0x010209,
    light: 0.48,
    sun: 0.82,
    ambient: 0.32,
    environment: 0.32,
    stars: 0.65,
    lantern: 0.62,
  },
  {
    id: "violet-bloom",
    weeds: 0.12,
    name: "紫光深海花園",
    weed: 0x9d5eae,
    glow: 0xe7a4ff,
    scatter: [0.065, 0.075, 0.19],
    background: 0x10071d,
    light: 0.73,
    sun: 1.9,
    ambient: 0.46,
    environment: 0.46,
    stars: 0.76,
    lantern: 0.3,
  },
]);
function hash(n, seed) {
  let t = Math.imul((n ^ seed) >>> 0, 0x45d9f3b);
  t = Math.imul(t ^ (t >>> 16), 0x45d9f3b);
  return ((t ^ (t >>> 16)) >>> 0) / 4294967296;
}
export class DepthBiomes {
  constructor(scene, seed = Math.floor(Math.random() * 4294967295)) {
    this.scene = scene;
    this.landmarks = new DepthLandmarks(scene);
    this.group = new THREE.Group();
    this.group.name = "Changing ten metre biomes";
    scene.add(this.group);
    this.weedMaterial = new THREE.MeshPhysicalMaterial({
      transparent: true,
      depthWrite: false,
      clearcoat: 0.3,
      clearcoatRoughness: 0.4,
      color: 0x348477,
      emissive: 0x16463f,
      emissiveIntensity: 0.14,
      roughness: 0.7,
      side: THREE.DoubleSide,
    });
    this.weeds = [];
    const leaf = new THREE.CylinderGeometry(1, 1, 2.2, 10, 28, true);
    leaf.translate(0, 1.1, 0);
    const lp = leaf.attributes.position;
    for (let i = 0; i < lp.count; i++) {
      const h = THREE.MathUtils.clamp(lp.getY(i) / 2.2, 0, 1),
        width =
          0.004 + 0.075 * Math.pow(Math.max(0, Math.sin(Math.PI * h)), 0.7);
      lp.setXYZ(
        i,
        lp.getX(i) * width + Math.sin(h * 3.5) * 0.09,
        lp.getY(i),
        lp.getZ(i) * (0.005 + width * 0.08) + Math.sin(h * 5) * 0.06,
      );
    }
    leaf.computeVertexNormals();
    const blades = [-0.32, 0, 0.32].map((angle, i) => {
        const g = leaf.clone();
        g.rotateZ(angle);
        g.rotateY(i * 0.7);
        g.translate((i - 1) * 0.05, 0, 0);
        return g;
      }),
      stem = mergeGeometries(blades);
    blades.forEach((g) => g.dispose());
    leaf.dispose();
    for (let i = 0; i < 36; i++) {
      const mesh = new THREE.Mesh(stem, this.weedMaterial);
      mesh.name = "Layered drifting seagrass";
      const side = i % 2 ? 1 : -1;
      mesh.position.set(
        side * (2.5 + hash(i, 37) * 3.2),
        -6 + hash(i, 99) * 12,
        -2.6 - hash(i, 53) * 8,
      );
      mesh.rotation.y = hash(i, 43) * Math.PI;
      mesh.scale.set(0.65 + hash(i, 63) * 0.5, 0.25 + hash(i, 11) * 0.65, 0.7);
      mesh.userData.phase = hash(i, 81) * 20;
      mesh.userData.restY = mesh.position.y;
      mesh.userData.descentCycle = null;
      this.group.add(mesh);
      this.weeds.push(mesh);
    }
    this.weedMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.uBiomeTime = this.time;
      shader.vertexShader = "uniform float uBiomeTime;\n" + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nfloat height=clamp(position.y/2.2,0.,1.);transformed.x+=sin(uBiomeTime*.8+position.y*2.1+modelMatrix[3].x)*.22*height*height;transformed.z+=cos(uBiomeTime*.55+position.y*2.)*.14*height;",
      );
    };
    this.weedMaterial.customProgramCacheKey = () => "ten-metre-seagrass-v43";
    this.time = { value: 0 };
    const positions = [],
      seeds = [];
    for (let i = 0; i < 850; i++) {
      positions.push(
        (hash(i, 7) - 0.5) * 16,
        (hash(i, 9) - 0.5) * 18,
        -1.8 - hash(i, 13) * 18,
      );
      seeds.push(hash(i, 67));
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute("seed", new THREE.Float32BufferAttribute(seeds, 1));
    this.starMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: this.time,
        uGlow: { value: new THREE.Color(0x49c9c0) },
        uDensity: { value: 0.12 },
        uDescent: { value: 0 },
      },
      vertexShader:
        "uniform float uTime;uniform float uDescent;attribute float seed;varying float vSeed;void main(){vSeed=seed;vec3 p=position;p.x+=sin(uTime*.15+seed*31.)*.22;p.y=mod(p.y+uDescent*(.35+seed*.6)+9.,18.)-9.;p.y+=sin(uTime*.2+seed*51.)*.12;vec4 mv=modelViewMatrix*vec4(p,1.);gl_PointSize=clamp((14.+seed*44.)/max(1.,-mv.z),1.,7.);gl_Position=projectionMatrix*mv;}",
      fragmentShader:
        "uniform float uTime;uniform float uDensity;uniform vec3 uGlow;varying float vSeed;void main(){float r=length(gl_PointCoord-.5),pulse=.55+.45*sin(uTime*(.5+vSeed)+vSeed*70.);float a=smoothstep(.5,.02,r)*(.25+pulse*.7)*uDensity;gl_FragColor=vec4(uGlow*(1.+pulse*.8),a);}",
    });
    this.stars = new THREE.Points(g, this.starMaterial);
    this.stars.name = "Bioluminescent plankton constellation";
    this.group.add(this.stars);
    this.lanterns = [];
    this.lanternGroup = new THREE.Group();
    this.lanternGroup.name = "Dark water lanternfish shoal";
    this.lanternGroup.visible = false;
    this.group.add(this.lanternGroup);
    const glow = new THREE.MeshBasicMaterial({ color: 0x9fefff });
    for (let i = 0; i < 11; i++) {
      const fish = makeDeepSeaFish(
        ["lanternfish", "anglerfish", "hatchetfish"][i % 3],
      );
      fish.position.set(
        (hash(i, 89) - 0.5) * 9,
        (hash(i, 73) - 0.5) * 9,
        -2.2 - hash(i, 41) * 6,
      );
      fish.scale.multiplyScalar(0.55 + hash(i, 47) * 0.5);
      fish.rotation.y = i % 2 ? Math.PI : 0;
      fish.userData.biomeRest = fish.position.clone();
      for (let j = 0; j < 6; j++) {
        const dot = new THREE.Mesh(new THREE.SphereGeometry(0.013, 8, 6), glow);
        dot.position.set(-0.22 + j * 0.065, -0.1, 0.055);
        fish.add(dot);
      }
      if (i % 3 === 1) {
        const bulb = new THREE.Mesh(
          new THREE.SphereGeometry(0.03, 10, 8),
          glow,
        );
        bulb.position.set(0.43, 0.29, 0);
        fish.add(bulb);
      }
      fish.traverse((o) => {
        if (o.isMesh && o.material.emissiveIntensity > 0)
          o.material.emissiveIntensity = 1.6;
      });
      this.lanternGroup.add(fish);
      this.lanterns.push(fish);
    }
    this.glowLights = [
      new THREE.PointLight(0x79eaff, 0, 3.8, 2),
      new THREE.PointLight(0xb6eaff, 0, 3.8, 2),
    ];
    this.glowLights.forEach((l) => scene.add(l));
    this.reset(seed);
  }
  reset(seed = Math.floor(Math.random() * 4294967295)) {
    this.seed = seed >>> 0;
    for (const mesh of this.weeds) mesh.userData.descentCycle = null;
    this.plan = [];
    this.segment = -1;
    this.current = null;
    this.target = null;
    this.lastName = null;
    this.time.value = 0;
  }
  themeAt(depth) {
    const band = scheduleAt(depth);
    for (let i = this.plan.length; i <= Math.min(band.segment, 4); i++) {
      const previous = this.plan[i - 1],
        choices = depthThemes.filter(
          (t) =>
            [
              "blue-garden",
              "pink-meadow",
              "jade-forest",
              "star-drift",
              "lantern-abyss",
              "violet-bloom",
            ].includes(t.id) &&
            t.id !== previous?.id &&
            (i > 1 || t.id !== "lantern-abyss"),
        );
      this.plan.push(
        choices[Math.floor(hash(i + 1, this.seed) * choices.length)],
      );
    }
    return {
      ...band,
      theme: band.key
        ? depthThemes.find((t) => t.id === band.key)
        : this.plan[band.segment],
    };
  }
  update(dt, time, depth, game) {
    this.time.value = time;
    const next = this.themeAt(depth);
    let changed = false;
    if (next.segment !== this.segment) {
      this.segment = next.segment;
      this.target = next.theme;
      changed = true;
      if (!this.current)
        this.current = { ...next.theme, scatter: [...next.theme.scatter] };
    }
    const e = 1 - Math.exp(-Math.min(dt, 0.2) * 1.2),
      c = this.current,
      t = this.target;
    for (const k of [
      "light",
      "sun",
      "ambient",
      "environment",
      "stars",
      "lantern",
      "weeds",
    ])
      c[k] = THREE.MathUtils.lerp(c[k], t[k], e);
    for (let i = 0; i < 3; i++)
      c.scatter[i] = THREE.MathUtils.lerp(c.scatter[i], t.scatter[i], e);
    this.weedMaterial.color.lerp(new THREE.Color(t.weed), e);
    this.weedMaterial.emissive.lerp(new THREE.Color(t.glow), e);
    this.weedMaterial.emissiveIntensity = 0.012 + c.stars * 0.035;
    this.starMaterial.uniforms.uGlow.value.lerp(new THREE.Color(t.glow), e);
    this.starMaterial.uniforms.uDensity.value = c.stars;
    this.starMaterial.uniforms.uDescent.value = descentTravel(depth);
    const span = next.end - next.start,
      groveCentre = (span * (1 + hash(this.segment + 101, this.seed))) / 3,
      grove =
        1 -
        THREE.MathUtils.smoothstep(
          Math.abs(depth - next.start - groveCentre),
          span * 0.15,
          span * (8 / 30),
        );
    this.weedMaterial.opacity = c.weeds * grove;
    let visibleWeeds = 0;
    for (const [i, mesh] of this.weeds.entries()) {
      const slice = movingSlice(mesh.userData.restY, depth, {
        span: 28,
        bottom: -14,
        parallax: 0.72 + hash(i, 68) * 0.4,
      });
      mesh.position.y = slice.y;
      if (mesh.userData.descentCycle !== slice.cycle) {
        mesh.userData.descentCycle = slice.cycle;
        const slot = i + slice.cycle * 41;
        mesh.position.x =
          (i % 2 ? 1 : -1) * (2.5 + hash(slot, this.seed) * 3.2);
        mesh.position.z = -3 - hash(slot + 7, this.seed) * 8;
        mesh.rotation.y = hash(slot + 11, this.seed) * Math.PI;
        mesh.userData.patch =
          hash(Math.floor(i / 6) + slice.cycle * 7, this.seed) > 0.35;
      }
      mesh.visible = this.weedMaterial.opacity > 0.015 && mesh.userData.patch;
      if (mesh.visible) visibleWeeds++;
    }
    this.lanternGroup.visible = c.lantern > 0.015;
    for (let i = 0; i < this.lanterns.length; i++) {
      const f = this.lanterns[i],
        r = f.userData.biomeRest;
      f.position.set(
        r.x + Math.sin(time * 0.25 + i) * 0.65,
        movingSlice(r.y, depth, { span: 20, bottom: -10, parallax: 0.5 }).y +
          Math.cos(time * 0.35 + i) * 0.22,
        r.z,
      );
      animateMarine(f, time, i % 2 ? -0.2 : 0.2);
    }
    for (let i = 0; i < this.glowLights.length; i++) {
      this.lanterns[i].getWorldPosition(this.glowLights[i].position);
      this.glowLights[i].intensity = c.lantern * 1.2;
    }
    this.scene.background.lerp(new THREE.Color(t.background), e);
    this.scene.environmentIntensity = c.environment;
    game.hemi.intensity = c.ambient;
    game.sun.intensity = c.sun;
    game.key.color.lerp(
      new THREE.Color(0xdcefff).lerp(new THREE.Color(t.glow), 0.1),
      e,
    );
    game.key.intensity = THREE.MathUtils.lerp(10, 14, c.lantern);
    game.key.distance = 9;
    game.key.decay = 1.5;
    for (const fish of game.ocean.habitat.fish) fish.visible = c.lantern < 0.65;
    for (const jelly of game.ocean.habitat.jellies)
      jelly.visible = c.lantern < 0.85;
    game.ocean.largeShoal.group.visible = c.lantern < 0.75;
    for (const entity of game.entities)
      if (
        !entity.hostile &&
        (entity.kind === "creature" || entity.kind === "wildlife")
      )
        entity.mesh.visible = c.lantern < 0.75;
    game.water.uniforms.uCausticStrength.value = c.light;
    const label = document.querySelector(".depth-pill .label");
    if (label) label.textContent = t.name;
    this.landmarks.update(time, depth, t, game);
    this.status = {
      segment: this.segment,
      range: [next.start, next.end],
      landmarks: this.landmarks.status,
      id: t.id,
      name: t.name,
      light: c.light,
      stars: c.stars,
      lantern: c.lantern,
      weeds: c.weeds,
      visibleWeeds,
      grove,
      groveCentre,
      travel: descentTravel(depth),
    };
    if (changed && this.segment > 0)
      game.ui.toast(`${next.start}m · ${t.name}`);
    return this.status;
  }
}
