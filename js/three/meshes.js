import * as THREE from "three";

/** Procedural stylized-3D meshes inspired by Girl & Whale media art. */

export function makeGirl({ hairColor = 0x2b1b12, dressColor = 0x7ad7f0 } = {}) {
  const root = new THREE.Group();
  root.name = "girl";

  const skin = new THREE.MeshStandardMaterial({ color: 0xffd7c2, roughness: 0.55 });
  const hairMat = new THREE.MeshStandardMaterial({ color: hairColor, roughness: 0.7 });
  const dressMat = new THREE.MeshStandardMaterial({
    color: dressColor,
    roughness: 0.4,
    metalness: 0.08,
    emissive: dressColor,
    emissiveIntensity: 0.12,
  });

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 24), skin);
  head.position.y = 0.55;
  root.add(head);

  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.26, 24, 18), hairMat);
  hair.scale.set(1, 1.35, 0.95);
  hair.position.set(0, 0.52, -0.02);
  root.add(hair);

  const strandL = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.55, 6, 10), hairMat);
  strandL.position.set(-0.16, 0.15, -0.05);
  strandL.rotation.z = 0.25;
  const strandR = strandL.clone();
  strandR.position.x = 0.16;
  strandR.rotation.z = -0.25;
  root.add(strandL, strandR);

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.45, 8, 12), dressMat);
  body.position.y = 0.05;
  root.add(body);

  const skirt = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.35, 16, 1, true), dressMat);
  skirt.position.y = -0.2;
  skirt.rotation.x = Math.PI;
  root.add(skirt);

  const aura = new THREE.Mesh(
    new THREE.SphereGeometry(0.7, 24, 24),
    new THREE.MeshBasicMaterial({
      color: 0x5ce1ff,
      transparent: true,
      opacity: 0.08,
      depthWrite: false,
    }),
  );
  root.add(aura);

  root.userData = { hairMat, dressMat, strandL, strandR, aura };
  root.scale.setScalar(1.15);
  return root;
}

export function makeWhale() {
  const root = new THREE.Group();
  root.name = "whale";

  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x6f8fa8,
    roughness: 0.45,
    metalness: 0.15,
    emissive: 0x1a3040,
    emissiveIntensity: 0.2,
  });
  const bellyMat = new THREE.MeshStandardMaterial({ color: 0xe8f4ff, roughness: 0.55 });

  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), bodyMat);
  body.scale.set(1.8, 0.85, 1.05);
  root.add(body);

  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.7, 24, 16), bellyMat);
  belly.scale.set(1.5, 0.55, 0.9);
  belly.position.set(0.1, -0.25, 0.05);
  root.add(belly);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 20), bodyMat);
  head.scale.set(1.2, 0.85, 1);
  head.position.set(1.35, 0.05, 0);
  root.add(head);

  const fin = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.9, 10), bodyMat);
  fin.rotation.z = Math.PI / 2;
  fin.position.set(-0.2, 0.55, 0);
  root.add(fin);

  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.1, 0.55), bodyMat);
  tail.position.set(-1.7, 0.05, 0);
  root.add(tail);

  const eye = new THREE.Mesh(
    new THREE.SphereGeometry(0.07, 12, 12),
    new THREE.MeshStandardMaterial({ color: 0x102030, roughness: 0.3 }),
  );
  eye.position.set(1.7, 0.15, 0.35);
  root.add(eye);

  const glow = new THREE.PointLight(0x5ce1ff, 1.2, 12, 2);
  glow.position.set(0, 0.2, 0);
  root.add(glow);

  root.userData = { tail, fin };
  root.scale.setScalar(0.85);
  return root;
}

export function makeFish(color = 0x5ce1ff, scale = 1) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.35,
    metalness: 0.2,
    emissive: color,
    emissiveIntensity: 0.25,
  });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 12), mat);
  body.scale.set(1.6, 0.7, 0.9);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.25, 8), mat);
  tail.rotation.z = Math.PI / 2;
  tail.position.x = -0.28;
  g.add(body, tail);
  g.scale.setScalar(scale);
  return g;
}

export function makeJelly(color = 0xff8fab) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color,
    transparent: true,
    opacity: 0.65,
    roughness: 0.2,
    emissive: color,
    emissiveIntensity: 0.35,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat);
  g.add(dome);
  for (let i = 0; i < 5; i++) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.01, 0.55, 6), mat);
    t.position.set((i - 2) * 0.08, -0.28, 0);
    g.add(t);
  }
  return g;
}

export function makeRock(volcanic = false) {
  const geo = new THREE.DodecahedronGeometry(0.55 + Math.random() * 0.4, 0);
  const mat = new THREE.MeshStandardMaterial({
    color: volcanic ? 0x4a2218 : 0x3a4654,
    roughness: 0.95,
    flatShading: true,
    emissive: volcanic ? 0xff4a1a : 0x000000,
    emissiveIntensity: volcanic ? 0.35 : 0,
  });
  const m = new THREE.Mesh(geo, mat);
  m.scale.set(1 + Math.random(), 0.8 + Math.random() * 0.8, 1 + Math.random() * 0.5);
  return m;
}

export function makeTreasure() {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffd166,
    emissive: 0xffaa33,
    emissiveIntensity: 0.6,
    metalness: 0.7,
    roughness: 0.25,
  });
  const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.22), mat);
  return m;
}

export function makeBubble() {
  return new THREE.Mesh(
    new THREE.SphereGeometry(0.04 + Math.random() * 0.08, 10, 10),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.25,
      roughness: 0.1,
      metalness: 0.2,
    }),
  );
}

export const HAIR_COLORS = {
  long: 0x2b1b12,
  twin: 0x5a2a1a,
  short: 0x1c2430,
  glow: 0x5ce1ff,
  coral: 0xff8fab,
  abyss: 0x8b6cff,
};

export const DRESS_COLORS = {
  dress: 0x7ad7f0,
  diver: 0x1aa7a0,
  kimono: 0xff6b6b,
  armor: 0xd4a373,
  mage: 0xc9a7ff,
  shadow: 0x1b2433,
};
