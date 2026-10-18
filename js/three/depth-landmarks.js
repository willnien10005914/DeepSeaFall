import * as T from "three";
const smooth = T.MathUtils.smoothstep,
  TAU = Math.PI * 2;
const noise = (i, k = 1) => {
  const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return v - Math.floor(v);
};
let rockMaps;
function maps() {
  if (rockMaps) return rockMaps;
  const loader = new T.TextureLoader(),
    load = (name, color = false) => {
      const t = loader.load("assets/environment/" + name);
      t.wrapS = t.wrapT = T.RepeatWrapping;
      t.repeat.set(2, 2);
      t.anisotropy = 4;
      if (color) t.colorSpace = T.SRGBColorSpace;
      return t;
    };
  return (rockMaps = {
    map: load("rock-albedo.jpg", true),
    normalMap: load("rock-normal.jpg"),
    roughnessMap: load("rock-roughness.jpg"),
  });
}
function rockMaterial(color) {
  const m = new T.MeshStandardMaterial({
    color,
    ...maps(),
    normalScale: new T.Vector2(0.55, 0.55),
    roughness: 0.91,
    metalness: 0.025,
  });
  m.onBeforeCompile = (s) => {
    s.vertexShader = "varying vec3 vRelicPosition;\n" + s.vertexShader;
    s.vertexShader = s.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\nvRelicPosition=position;",
    );
    s.fragmentShader =
      "varying vec3 vRelicPosition;\nfloat relicNoise(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}\n" +
      s.fragmentShader;
    s.fragmentShader = s.fragmentShader.replace(
      "#include <color_fragment>",
      "#include <color_fragment>\nfloat worn=.90+.045*sin(vRelicPosition.y*19.+sin(vRelicPosition.x*12.))+.055*relicNoise(floor(vRelicPosition*77.));diffuseColor.rgb*=worn;",
    );
    s.fragmentShader = s.fragmentShader.replace(
      "#include <roughnessmap_fragment>",
      "#include <roughnessmap_fragment>\nroughnessFactor=clamp(roughnessFactor+relicNoise(floor(vRelicPosition*90.))*.08,.7,1.);",
    );
  };
  m.customProgramCacheKey = () => "eroded-relic-stone-v48";
  return m;
}
function mesh(parent, geometry, material, position = [0, 0, 0], name = "") {
  const m = new T.Mesh(geometry, material);
  m.position.set(...position);
  m.name = name;
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}
function erode(g, amount = 0.035) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i),
      y = p.getY(i),
      z = p.getZ(i),
      d =
        Math.sin(x * 13.7 + y * 9.1 + z * 17.3) *
        Math.sin(y * 24.1 - z * 11.3) *
        amount;
    p.setXYZ(i, x + d, y + d * 0.5, z + d * 0.7);
  }
  g.computeVertexNormals();
  return g;
}
function box(parent, mat, size, p, name) {
  return mesh(parent, erode(new T.BoxGeometry(...size, 3, 3, 3)), mat, p, name);
}
function tube(parent, points, radius, mat) {
  return mesh(
    parent,
    new T.TubeGeometry(
      new T.CatmullRomCurve3(points.map((v) => new T.Vector3(...v))),
      32,
      radius,
      6,
      false,
    ),
    mat,
  );
}
function fadeGroup(group, value) {
  group.traverse((o) => {
    if (!o.material) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
      if (m.userData.relicOpacity === undefined)
        m.userData.relicOpacity = m.opacity;
      if (m.userData.relicDepthWrite === undefined)
        m.userData.relicDepthWrite = m.depthWrite;
      m.transparent = true;
      m.opacity = m.userData.relicOpacity * value;
      m.depthWrite = m.userData.relicDepthWrite && value > 0.95;
    }
  });
}

function ruins() {
  const root = new T.Group();
  root.name = "The drowned tidal citadel";
  const stone = rockMaterial(0x65766f),
    dark = rockMaterial(0x344f52),
    pale = rockMaterial(0x92a29a),
    bronze = new T.MeshStandardMaterial({
      color: 0x557f78,
      metalness: 0.45,
      roughness: 0.73,
    }),
    rune = new T.MeshStandardMaterial({
      color: 0x74e6de,
      emissive: 0x48b9be,
      emissiveIntensity: 1.2,
      roughness: 0.3,
    });
  for (let i = 0; i < 5; i++)
    box(
      root,
      stone,
      [11 - i * 0.48, 0.23, 4.4 - i * 0.21],
      [0, -2.25 + i * 0.22, -0.5],
      "Silt-covered citadel stair",
    );
  for (const side of [-1, 1]) {
    const tower = new T.Group();
    tower.position.set(side * 3.5, 0.9, -1.3);
    root.add(tower);
    mesh(
      tower,
      erode(new T.CylinderGeometry(0.73, 0.95, 5.8, 10, 12), 0.075),
      stone,
      [0, 0, 0],
      "Broken watchtower",
    );
    for (let h = 0; h < 3; h++) {
      box(
        tower,
        dark,
        [0.34, 0.65, 0.06],
        [0, -1.2 + h * 1.18, 0.83],
        "Deep tower recess",
      );
      const arch = mesh(
        tower,
        new T.TorusGeometry(0.22, 0.075, 6, 20, Math.PI),
        pale,
        [0, -0.9 + h * 1.18, 0.87],
      );
    }
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * TAU;
      if (k === 2 || k === 5) continue;
      box(
        tower,
        stone,
        [0.3, 0.45, 0.3],
        [Math.cos(a) * 0.65, 3.0 + noise(k, side) * 0.16, Math.sin(a) * 0.65],
        "Crumbling battlement",
      );
    }
    const wall = box(
      root,
      dark,
      [1.15, 3.7, 1],
      [side * 4.3, -0.08, -0.5],
      "Ruined outer buttress",
    );
    wall.rotation.z = side * 0.035;
  }
  for (const x of [-2.35, -1.65, 1.65, 2.35]) {
    const column = mesh(
      root,
      erode(new T.CylinderGeometry(0.19, 0.24, 4.1, 14, 8), 0.018),
      pale,
      [x, 0.08, 0.3],
      "Fluted tidal column",
    );
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      mesh(
        root,
        new T.CylinderGeometry(0.018, 0.018, 3.95, 4),
        stone,
        [x + Math.cos(a) * 0.19, 0.08, 0.3 + Math.sin(a) * 0.19],
        "Column fluting",
      );
    }
    for (const y of [-1.93, 2.13])
      box(
        root,
        pale,
        [0.58, 0.19, 0.62],
        [x, y, 0.3],
        "Weathered column capital",
      );
  }
  const gateway = mesh(
    root,
    new T.TorusGeometry(1.65, 0.25, 10, 48, Math.PI),
    pale,
    [0, 2.1, 0.1],
    "Tide gate arch",
  );
  box(
    root,
    dark,
    [2.9, 4, 0.12],
    [0, 0.1, -0.1],
    "Dark opening behind the tide gate",
  );
  const roof = new T.Shape();
  roof.moveTo(-2.8, 0);
  roof.lineTo(2.8, 0);
  roof.lineTo(0, 1.25);
  roof.closePath();
  mesh(
    root,
    erode(
      new T.ExtrudeGeometry(roof, {
        depth: 0.6,
        bevelEnabled: true,
        bevelSize: 0.05,
        bevelThickness: 0.05,
        bevelSegments: 1,
        steps: 1,
      }),
      0.018,
    ),
    stone,
    [0, 3.9, -0.1],
    "Fractured mythic pediment",
  );
  box(root, pale, [5.9, 0.25, 1.1], [0, 3.88, 0.1], "Ancient entablature");
  const runes = [];
  for (let i = 0; i < 3; i++) {
    const group = new T.Group();
    group.position.set((i - 1) * 0.72, 2.55, 0.28);
    root.add(group);
    mesh(group, new T.RingGeometry(0.13, 0.16, 40), rune);
    const glyph = mesh(group, new T.TorusGeometry(0.085, 0.015, 5, 3), rune);
    glyph.rotation.z = i * 0.5;
    group.userData.phase = i * 1.7;
    runes.push(group);
  }
  for (let i = 0; i < 17; i++) {
    const side = i % 2 ? 1 : -1,
      x = side * (2.8 + noise(i, 3) * 2.5),
      y = -1.8 + noise(i, 5) * 0.25,
      z = -0.3 + noise(i, 8) * 2.8;
    const b = box(
      root,
      i % 3 ? pale : stone,
      [
        0.3 + noise(i) * 0.65,
        0.23 + noise(i, 4) * 0.3,
        0.3 + noise(i, 7) * 0.5,
      ],
      [x, y, z],
      "Fallen carved masonry",
    );
    b.rotation.set(noise(i, 9) * 0.4, noise(i, 10) * TAU, noise(i, 11) * 0.5);
  }
  const algae = new T.InstancedMesh(
      new T.SphereGeometry(1, 8, 6),
      new T.MeshStandardMaterial({ color: 0x667e70, roughness: 0.94 }),
      45,
    ),
    dummy = new T.Object3D();
  for (let i = 0; i < 45; i++) {
    dummy.position.set(
      (noise(i, 11) - 0.5) * 10,
      -1.7 + noise(i, 12) * 5,
      noise(i, 13) * 1.5,
    );
    dummy.scale.set(
      0.05 + noise(i, 14) * 0.1,
      0.03 + noise(i, 15) * 0.12,
      0.025,
    );
    dummy.updateMatrix();
    algae.setMatrixAt(i, dummy.matrix);
  }
  root.add(algae);
  for (const side of [-1, 1]) {
    const light = new T.PointLight(0x6acbc7, 5, 8, 2);
    light.position.set(side * 2, 1, 2);
    root.add(light);
  }
  root.userData.runes = runes;
  return root;
}

function volcano() {
  const root = new T.Group();
  root.name = "Erupting submarine volcanic fissure";
  const basalt = rockMaterial(0x30383c),
    lava = new T.MeshStandardMaterial({
      color: 0xff8329,
      emissive: 0xff4910,
      emissiveIntensity: 2.1,
      roughness: 0.42,
      metalness: 0.08,
    });
  const shape = [
    [0, 0],
    [4.2, 0],
    [3.2, 0.65],
    [2.1, 2.1],
    [1.25, 3.15],
    [0.87, 3.35],
    [0.62, 3.12],
    [0.63, 2.8],
  ].map((v) => new T.Vector2(...v));
  mesh(
    root,
    erode(new T.LatheGeometry(shape, 64), 0.08),
    basalt,
    [0, 0, 0],
    "Rugged basalt volcanic cone",
  );
  const rim = mesh(
    root,
    new T.TorusGeometry(0.86, 0.18, 12, 64),
    basalt,
    [0, 3.2, 0],
  );
  rim.rotation.x = Math.PI / 2;
  const pool = mesh(
    root,
    new T.CircleGeometry(0.72, 64),
    lava,
    [0, 3.02, 0],
    "Glowing lava inside flooded crater",
  );
  pool.rotation.x = -Math.PI / 2;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU,
      points = [];
    for (let j = 0; j < 6; j++) {
      const r = 0.8 + j * 0.48,
        angle = a + Math.sin(j * 2 + i) * 0.11;
      points.push([Math.cos(angle) * r, 3.2 - j * 0.5, Math.sin(angle) * r]);
    }
    tube(root, points, 0.025 + noise(i) * 0.024, lava).name =
      "Cooling incandescent fissure";
  }
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * TAU,
      r = 3 + noise(i, 2) * 2;
    const rock = mesh(
      root,
      erode(new T.DodecahedronGeometry(0.28 + noise(i, 4) * 0.6, 1), 0.05),
      basalt,
      [Math.cos(a) * r, 0.12, Math.sin(a) * r],
      "Rift field basalt",
    );
    rock.scale.y = 0.8 + noise(i, 6) * 1.7;
  }
  const count = 700,
    p = new Float32Array(count * 3),
    seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    p[i * 3] = Math.cos(i * 2.399) * noise(i, 11) * 0.5;
    p[i * 3 + 1] = 3.13;
    p[i * 3 + 2] = Math.sin(i * 2.399) * noise(i, 11) * 0.5;
    seeds[i] = noise(i, 7);
  }
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.BufferAttribute(p, 3));
  g.setAttribute("seed", new T.BufferAttribute(seeds, 1));
  const material = new T.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: T.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uFade: { value: 0 } },
    vertexShader: `attribute float seed;uniform float uTime;varying float vAge;varying float vKind;void main(){float span=2.5+seed*3.5;float age=mod(uTime+seed*37.,span);vAge=age/span;vKind=step(.27,seed);vec3 p=position;float a=seed*63.;if(vKind<.5){p.x+=cos(a)*age*(.3+seed*2.);p.z+=sin(a)*age*(.3+seed*2.);p.y+=age*(3.+seed*5.)-age*age*2.2;}else{p.y+=age*(.85+seed*.65);p.x+=sin(age*1.6+a)*age*.25;p.z+=cos(age*1.3+a)*age*.20;}vec4 mv=modelViewMatrix*vec4(p,1.);gl_PointSize=clamp((vKind<.5?95.:130.)/max(1.,-mv.z),1.5,18.);gl_Position=projectionMatrix*mv;}`,
    fragmentShader: `uniform float uFade;varying float vAge;varying float vKind;void main(){float r=length(gl_PointCoord-.5);float edge=smoothstep(.5,.05,r),life=sin(vAge*3.14159);if(edge<.01)discard;vec3 hot=mix(vec3(1.,.70,.20),vec3(.22,.025,.008),vAge);vec3 water=vec3(.48,.64,.66);float alpha=vKind<.5?.9:.15;gl_FragColor=vec4(mix(hot*1.6,water,vKind)*edge,edge*life*alpha*uFade);}`,
  });
  const plume = new T.Points(g, material);
  plume.name = "Hot ejecta, steam and buoyant mineral plume";
  plume.frustumCulled = false;
  root.add(plume);
  const light = new T.PointLight(0xff7d36, 15, 11, 2);
  light.position.set(0, 3.4, 0.5);
  root.add(light);
  root.userData.plume = plume;
  root.userData.lava = lava;
  root.userData.light = light;
  return root;
}

function alien(kind, index) {
  const root = new T.Group();
  root.name = [
    "Abyssal glass ribbon ray",
    "Colonial luminous siphonophore",
    "Armoured orbital nautilus",
  ][kind];
  const skin = new T.MeshPhysicalMaterial({
      color: 0x456c82,
      roughness: 0.3,
      metalness: 0.18,
      clearcoat: 0.75,
      transparent: true,
      opacity: 0.78,
      side: T.DoubleSide,
    }),
    glow = new T.MeshStandardMaterial({
      color: 0x8adeec,
      emissive: 0x47b1da,
      emissiveIntensity: 1.5,
      roughness: 0.22,
    }),
    membrane = new T.MeshPhysicalMaterial({
      color: 0x6e9ec0,
      transparent: true,
      opacity: 0.28,
      roughness: 0.18,
      clearcoat: 0.9,
      side: T.DoubleSide,
    });
  const parts = [];
  if (kind === 0) {
    const body = mesh(root, new T.SphereGeometry(1, 24, 16), skin);
    body.scale.set(0.9, 0.14, 0.32);
    for (const side of [-1, 1]) {
      const shape = new T.Shape();
      shape.moveTo(0.6, 0);
      shape.bezierCurveTo(0.2, 1.2, -1.4, 1.8, -0.7, 0);
      shape.quadraticCurveTo(-0.3, -0.15, 0.6, 0);
      const fin = mesh(root, new T.ShapeGeometry(shape, 24), membrane, [
        0,
        0,
        side * 0.12,
      ]);
      fin.rotation.x = -Math.PI / 2;
      fin.rotation.y = side < 0 ? Math.PI : 0;
      fin.userData.side = side;
      parts.push(fin);
    }
    for (let i = 0; i < 7; i++)
      mesh(
        root,
        new T.SphereGeometry(0.025, 8, 6),
        glow,
        [-0.6 + i * 0.18, 0.12, 0.13],
        "Photophore",
      );
    tube(
      root,
      [
        [-0.8, 0, 0],
        [-1.4, 0.1, 0],
        [-2.2, 0.3, 0.2],
        [-2.8, 0.7, 0.1],
      ],
      0.018,
      glow,
    );
  } else if (kind === 1) {
    for (let i = 0; i < 11; i++) {
      const bell = mesh(
        root,
        new T.SphereGeometry(0.12, 14, 10),
        i % 3 === 0 ? glow : skin,
        [-i * 0.19, Math.sin(i * 0.55) * 0.09, 0],
        "Siphonophore zooid",
      );
      bell.scale.set(1, 0.85, 1);
      parts.push(bell);
      if (i % 2 === 0)
        tube(
          root,
          [
            [-i * 0.19, -0.1, 0],
            [-i * 0.19 - 0.15, -0.5, 0.1],
            [-i * 0.19 - 0.25, -1.0, -0.1],
          ],
          0.009,
          membrane,
        );
    }
    tube(
      root,
      [
        [0.1, 0, 0],
        [-0.7, 0.05, 0],
        [-1.4, -0.05, 0],
        [-2.05, 0, 0],
      ],
      0.025,
      glow,
    );
  } else {
    const shell = mesh(root, new T.SphereGeometry(0.43, 24, 18), skin);
    shell.scale.set(1, 1.05, 0.5);
    for (let i = 0; i < 15; i++) {
      const a = (i / 15) * TAU,
        ring = mesh(
          root,
          new T.TorusGeometry(0.13 + i * 0.017, 0.014, 5, 30),
          i % 4 ? skin : glow,
          [0, 0, 0.2],
        );
      ring.rotation.z = a;
    }
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * TAU;
      const arm = tube(
        root,
        [
          [0.3, 0, 0],
          [0.65, Math.cos(a) * 0.18, Math.sin(a) * 0.2],
          [1.0, Math.cos(a) * 0.45, Math.sin(a) * 0.4],
          [1.15, Math.cos(a) * 0.5 + 0.15, Math.sin(a) * 0.35],
        ],
        0.018,
        membrane,
      );
      parts.push(arm);
    }
  }
  root.userData.alien = { kind, parts, glow, phase: index * 2.7 };
  return root;
}

export class DepthLandmarks {
  constructor(scene) {
    this.group = new T.Group();
    this.group.name = "Depth narrative: citadel, volcano and alien abyss";
    scene.add(this.group);
    this.ruins = ruins();
    this.volcano = volcano();
    this.group.add(this.ruins, this.volcano);
    this.aliens = [];
    for (let i = 0; i < 6; i++) {
      const a = alien(i % 3, i);
      a.scale.setScalar(0.65 + noise(i, 4) * 0.5);
      this.group.add(a);
      this.aliens.push(a);
    }
    this.ruins.visible = this.volcano.visible = false;
    this.aliens.forEach((a) => (a.visible = false));
    this.lastCue = null;
  }
  update(time, depth, theme, game) {
    const ruinFade = smooth(depth, 50, 52) * (1 - smooth(depth, 67, 70)),
      volcanoFade = smooth(depth, 100, 103) * (1 - smooth(depth, 126, 130));
    this.ruins.visible = ruinFade > 0;
    this.ruins.position.set(0, (depth - 59) * 0.28 - 1, -8.5);
    if (this.ruins.visible) {
      fadeGroup(this.ruins, ruinFade);
      for (const [i, g] of this.ruins.userData.runes.entries())
        g.scale.setScalar(1 + Math.sin(time * 1.5 + i * 1.7) * 0.05);
    }
    this.volcano.visible = volcanoFade > 0;
    this.volcano.position.set(0.9, (depth - 113) * 0.16 - 4.1, -9);
    if (this.volcano.visible) {
      fadeGroup(this.volcano, volcanoFade);
      this.volcano.userData.plume.material.uniforms.uTime.value = time;
      this.volcano.userData.plume.material.uniforms.uFade.value = volcanoFade;
      this.volcano.userData.lava.emissiveIntensity =
        1.8 + Math.sin(time * 2.1) * 0.4;
      this.volcano.userData.light.intensity =
        (12 + Math.sin(time * 1.7) * 3) * volcanoFade;
    }
    const alienFade = smooth(depth, 130, 137);
    let visible = 0;
    for (let i = 0; i < this.aliens.length; i++) {
      const a = this.aliens[i],
        info = a.userData.alien;
      a.visible = alienFade > 0;
      if (!a.visible) continue;
      visible++;
      a.position.set(
        (i % 2 ? 1 : -1) * (1.5 + noise(i, 7) * 3) +
          Math.sin(time * 0.15 + info.phase) * 0.7,
        ((i * 3.6 + (depth - 130) * 0.19 + time * 0.06) % 15) - 7,
        -5.5 - noise(i, 8) * 8,
      );
      a.rotation.set(
        Math.sin(time * 0.3 + i) * 0.07,
        i % 2 ? Math.PI : 0,
        Math.sin(time * 0.4 + i) * 0.13,
      );
      info.glow.emissive.lerp(new T.Color(theme.glow), 0.025);
      info.glow.emissiveIntensity = 0.8 + Math.sin(time * 1.4 + i) * 0.2;
      for (let j = 0; j < info.parts.length; j++) {
        const p = info.parts[j];
        if (info.kind === 0)
          p.rotation.z = Math.sin(time * 1.6 + i) * 0.2 * p.userData.side;
        else p.rotation.x = Math.sin(time * 1.3 + j * 0.5 + i) * 0.08;
      }
    }
    const cue =
      depth >= 100 && depth < 130
        ? "volcano"
        : depth >= 50 && depth < 70
          ? "ruins"
          : null;
    if (cue && this.lastCue !== cue) {
      this.lastCue = cue;
      game.ui.whaleLine(
        cue === "ruins"
          ? "古碑殘句：「循三道星紋，尋潮汐之門。」"
          : "海床正在震動——熔岩裂隙與熱泉噴發。",
      );
    }
    if (depth < 1) this.lastCue = null;
    this.status = {
      ruins: ruinFade,
      volcano: volcanoFade,
      alienCreatures: visible,
      alienKinds:
        alienFade > 0 ? ["glass-ray", "siphonophore", "orbital-nautilus"] : [],
      clue: cue === "ruins" ? "循三道星紋，尋潮汐之門" : null,
    };
  }
}
