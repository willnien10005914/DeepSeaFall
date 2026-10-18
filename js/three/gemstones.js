import * as T from "three";
import { chooseGem, gemType } from "./treasure-rules.js?v=48";
let haloTexture;
function texture() {
  if (haloTexture) return haloTexture;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const c = canvas.getContext("2d"),
    g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,.65)");
  g.addColorStop(0.25, "rgba(255,255,255,.27)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  c.fillStyle = g;
  c.fillRect(0, 0, 64, 64);
  return (haloTexture = new T.CanvasTexture(canvas));
}
export function makeGemstone(id) {
  const type = id ? gemType(id) : chooseGem(),
    material = new T.MeshPhysicalMaterial({
      color: type.color,
      emissive: type.glow,
      emissiveIntensity: 0.24,
      metalness: 0.25,
      roughness: 0.13,
      clearcoat: 1,
      clearcoatRoughness: 0.08,
      flatShading: true,
    });
  const gem = new T.Mesh(new T.OctahedronGeometry(0.23, 0), material);
  gem.name = type.name + " · " + type.value + " 分";
  gem.scale.set(1, 1.38, 1);
  Object.assign(gem.userData, {
    gemId: type.id,
    value: type.value,
    staminaRestore: 20,
  });
  gem.castShadow = true;
  const inner = new T.Mesh(
    new T.OctahedronGeometry(0.16, 0),
    new T.MeshBasicMaterial({
      color: type.glow,
      transparent: true,
      opacity: 0.28,
      blending: T.AdditiveBlending,
      depthWrite: false,
    }),
  );
  inner.name = "Crystal luminous core";
  gem.add(inner);
  const halo = new T.Sprite(
    new T.SpriteMaterial({
      map: texture(),
      color: type.glow,
      transparent: true,
      opacity: 0.34,
      blending: T.AdditiveBlending,
      depthWrite: false,
    }),
  );
  halo.name = "Crystal soft halo";
  halo.scale.set(0.94, 0.72, 1);
  gem.add(halo);
  const points = new T.BufferGeometry(),
    pos = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    pos.push(
      Math.cos(a) * (0.3 + (i % 2) * 0.06),
      Math.sin(a) * 0.25,
      ((i % 3) - 1) * 0.08,
    );
  }
  points.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
  const sparks = new T.Points(
    points,
    new T.PointsMaterial({
      map: texture(),
      color: type.glow,
      size: 0.065,
      transparent: true,
      blending: T.AdditiveBlending,
      depthWrite: false,
    }),
  );
  sparks.name = "Orbiting crystal glints";
  gem.add(sparks);
  gem.userData.gemGlow = { halo, sparks, inner };
  return gem;
}
export function animateGemstone(mesh, time) {
  const glow = mesh.userData.gemGlow;
  if (!glow) return;
  const pulse = 0.5 + 0.5 * Math.sin(time * 2.7 + mesh.position.x * 2);
  glow.halo.material.opacity = 0.23 + pulse * 0.15;
  glow.sparks.rotation.y = time * 0.8;
  glow.sparks.rotation.z = Math.sin(time * 0.7) * 0.4;
  glow.inner.material.opacity = 0.2 + pulse * 0.13;
  mesh.material.emissiveIntensity = 0.22 + pulse * 0.17;
}
