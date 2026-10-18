import * as T from "three";
import { prepareCharacter } from "../three/authored.js?v=48";
import { LearnedSwimmer, loadSwimPPO } from "../three/ppo-swimmer.js?v=48";
import { CombatActor, loadCombatPPO } from "../three/combat-ppo.js?v=48";

export function seeded(seed) {
  let n = seed >>> 0;
  return () => (n = (Math.imul(n, 1664525) + 1013904223) >>> 0) / 4294967296;
}
export function withSeed(seed, fn) {
  const old = Math.random;
  Math.random = seeded(seed);
  try {
    return fn();
  } finally {
    Math.random = old;
  }
}
export async function avatar(game) {
  const root = game.multiplayerTemplate.clone(true);
  root.traverse((o) => {
    if (o.isMesh) {
      o.geometry = o.geometry.clone();
      o.material = Array.isArray(o.material)
        ? o.material.map((m) => m.clone())
        : o.material.clone();
    }
  });
  prepareCharacter(root, "girl");
  root.userData.swimPPO = new LearnedSwimmer(await loadSwimPPO());
  root.userData.combatPPO = new CombatActor(await loadCombatPPO());
  game.scene.add(root);
  game.water.apply(root);
  return root;
}
export function tint(root, color) {
  root.traverse((o) => {
    if (!o.isMesh) return;
    for (const m of Array.isArray(o.material) ? o.material : [o.material])
      if (
        m.name === "dress" ||
        o.name === "Swimming dress with posed cross-section clearance" ||
        o.name.startsWith("dress")
      )
        m.color?.set(color);
  });
  root.userData.dressMat?.color.set(color);
}
export function transform(root) {
  return {
    p: root.position.toArray(),
    q: root.quaternion.toArray(),
    s: root.scale.toArray(),
    v: root.visible,
  };
}
export function applyTransform(root, data, blend = 1) {
  root.position.lerp(new T.Vector3(...data.p), blend);
  root.quaternion.slerp(new T.Quaternion(...data.q), blend);
  root.scale.fromArray(data.s);
  root.visible = data.v;
}
export const pose = (root) =>
  Object.fromEntries(
    Object.entries(root.userData.bones || {}).map(([n, b]) => [
      n,
      b.quaternion.toArray(),
    ]),
  );
export function applyPose(root, data, blend = 1) {
  for (const [n, a] of Object.entries(data || {}))
    root.userData.bones[n]?.quaternion.slerp(new T.Quaternion(...a), blend);
  root.updateMatrixWorld(true);
}
export function staticRocks(game) {
  const rocks = [];
  game.ocean.group.traverse((o) => {
    if (o.isMesh && o.material === game.ocean.material) rocks.push(o);
  });
  return rocks;
}
