import * as THREE from 'three';

// X is the whale's forward axis, Y is up. The head stays rigid while a
// travelling dorsoventral bend drives the peduncle and the two tail leaves.
export function bindWhale(root) {
  const joints = [
    ['thorax', null, [1.8, .16, 0]],
    ['spine', 'thorax', [-.8, .16, 0]],
    ['lumbar', 'spine', [-2.8, .12, 0]],
    ['peduncle', 'lumbar', [-4.4, .03, 0]],
    ['flukes', 'peduncle', [-5.8, .04, 0]],
  ];
  for (const [label, sign] of [['l', 1], ['r', -1]]) {
    joints.push([`pectoral_${label}`, 'thorax', [.95, -.35, sign * 1.10]],
      [`pectoral_${label}_tip`, `pectoral_${label}`, [-.12, -.65, sign * 3.35]]);
  }
  const bones = joints.map(([name]) => { const b = new THREE.Bone(); b.name = name; return b; });
  const points = joints.map(j => new THREE.Vector3(...j[2]));
  joints.forEach((j, i) => {
    const p = joints.findIndex(k => k[0] === j[1]);
    bones[i].position.copy(points[i]);
    if (p >= 0) { bones[i].position.sub(points[p]); bones[p].add(bones[i]); }
    else root.add(bones[i]);
  });
  root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  const meshes = []; root.traverse(o => { if (o.isMesh) meshes.push(o); });
  for (const mesh of meshes) {
    const geo = mesh.geometry, pos = geo.attributes.position;
    const indices = new Uint16Array(pos.count * 4), weights = new Float32Array(pos.count * 4);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), k = i * 4;
      if (mesh.name.startsWith('pectoral')) {
        const shoulder = z > 0 ? 5 : 7;
        const t = THREE.MathUtils.smoothstep(Math.abs(z), 2.15, 4.7);
        indices[k] = shoulder; indices[k + 1] = shoulder + 1;
        weights[k] = 1 - t; weights[k + 1] = t;
      } else if (mesh.name.startsWith('fluke')) {
        indices[k] = 4; weights[k] = 1;
      } else {
        let a = 0, b = 0, t = 0;
        for (let j = 0; j < 4; j++) {
          if (x <= points[j].x) {
            a = j; b = j + 1;
            t = THREE.MathUtils.clamp((points[j].x - x) / (points[j].x - points[j + 1].x), 0, 1);
          }
        }
        // Smooth weights retain the broad chest and avoid visible hinge rings.
        t = t * t * (3 - 2 * t);
        indices[k] = a; indices[k + 1] = b;
        weights[k] = 1 - t; weights[k + 1] = t;
      }
    }
    geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4));
    geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
    const skinned = new THREE.SkinnedMesh(geo, mesh.material);
    skinned.name = mesh.name; skinned.position.copy(mesh.position);
    skinned.quaternion.copy(mesh.quaternion); skinned.scale.copy(mesh.scale);
    mesh.parent.add(skinned); mesh.parent.remove(mesh);
    skinned.bind(skeleton); skinned.frustumCulled = false;
  }
  root.userData.whaleRig = Object.fromEntries(bones.map(b => [b.name, b]));
  root.userData.whaleSkeleton = skeleton;
}

export function poseWhale(root, time, motion = {}) {
  const b = root.userData.whaleRig;
  if (!b) return;
  const asymmetry=THREE.MathUtils.clamp(motion.asymmetry??0,-1,1),waveScale=THREE.MathUtils.clamp(motion.waveScale??1,.65,1.3);
  const p = motion.phase ?? time * 1.38;
  const effort = THREE.MathUtils.clamp(motion.effort ?? .65, .18, 1);
  const turn = THREE.MathUtils.clamp(motion.turn ?? 0, -1, 1);
  const lift = THREE.MathUtils.clamp(motion.lift ?? 0, -1, 1);
  for (const bone of Object.values(b)) bone.rotation.set(0, 0, 0);
  // A firm downstroke and longer recovery; phase delays carry the wave aft.
  const stroke = q => Math.sin(q) + .12 * Math.sin(q * 2 - .4);
  b.spine.rotation.z = stroke(p - .15) * (.022 + effort * .022)*waveScale;
  b.lumbar.rotation.z = stroke(p - .58) * (.050 + effort * .042)*waveScale;
  b.peduncle.rotation.z = stroke(p - .98) * (.090 + effort * .065)*waveScale;
  // Tail pitch trails the bend so the fluke acts as a hydrofoil, not a paddle.
  b.flukes.rotation.z = -stroke(p - 1.36) * (.11 + effort * .10);
  b.flukes.rotation.x = Math.sin(p - 1.10) * .016 + turn * .035;
  b.thorax.rotation.x=Math.sin(p*.47)*.018*asymmetry;
  b.spine.rotation.y = turn * .028;
  b.lumbar.rotation.y = turn * .045;
  for (const [side, sign] of [['l', 1], ['r', -1]]) {
    const fin = b[`pectoral_${side}`], tip = b[`pectoral_${side}_tip`];
    const q = p * .52 + sign * (.28+asymmetry*.32);
    fin.rotation.x = sign * (-.09 + Math.sin(q) * .095 - lift * .08) + turn * .14+asymmetry*.10;
    fin.rotation.y = sign * (.025 + Math.sin(q - .6) * .032);
    fin.rotation.z = Math.sin(q - .35) * .035 - lift * .07;
    tip.rotation.x = sign * Math.sin(q - .70) * .062;
    tip.rotation.y = sign * Math.sin(q - .9) * .03;
  }
  root.userData.whaleMotion = { phase: p, effort, turn, lift, asymmetry, waveScale };
}
