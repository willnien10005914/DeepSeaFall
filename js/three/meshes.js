import {makeGemstone} from './gemstones.js?v=48';
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

/** Procedural stylized-3D meshes inspired by Girl & Whale media art.
 *  Optional: load authored GLB from /assets/usd/*.glb (same generator as USD).
 */

import {makeRealFish,makeRealJelly} from './marine-life.js?v=48';
import {makeScannedRock} from './ocean-real.js?v=48';

const loader = new GLTFLoader();

export function loadGlb(url) {
  return new Promise((resolve, reject) => {
    loader.load(url, (gltf) => resolve(gltf.scene), undefined, reject);
  });
}

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

export function makeFish(color,scale=1){return makeRealFish(color,scale)}
export function makeJelly(){return makeRealJelly()}
export function makeRock(volcanic=false){return makeScannedRock(volcanic)}

export function makeTreasure(id){return makeGemstone(id);}

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
