import * as THREE from 'three';

const ANCHORS = ['chest', 'l_wrist', 'r_wrist', 'l_ankle', 'r_ankle'];
const FIRE_ANCHORS = {
  'palm-wave': [1, 2],
  'spiral-kick': [3, 4],
  'crescent-kick': [3, 4],
  'twin-kick': [3, 4],
};
const FIRE_ROLES = ['core', 'body', 'tips', 'embers'];

function flameShape(width, height, tip){
  const shape = new THREE.Shape();
  shape.moveTo(0, height * tip);
  shape.bezierCurveTo(width, height * 0.45, width * 1.15, height * 0.05, width * 0.42, -height * 0.5);
  shape.bezierCurveTo(width * 0.12, -height * 0.62, -width * 0.12, -height * 0.62, -width * 0.42, -height * 0.5);
  shape.bezierCurveTo(-width * 1.15, height * 0.05, -width, height * 0.45, 0, height * tip);
  return new THREE.ShapeGeometry(shape);
}

function fireMaterial(opacity){
  return new THREE.MeshBasicMaterial({
    color: 0xfff1d2,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
}

let loaded;
export function loadElementalDynamics(){
  return loaded ??= fetch(new URL('../../assets/policy/elemental-dynamics-v45.json', import.meta.url)).then(async response => {
    if (!response.ok) throw new Error('Elemental dynamics unavailable');
    return response.json();
  });
}

export class ElementalCombat {
  constructor(scene){
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'Fire, ice and cold-fire attack light';
    scene.add(this.group);
    this.flames = [];
    for (let i = 0; i < 36; i++){
      const material = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
      mesh.visible = false;
      mesh.frustumCulled = false;
      this.group.add(mesh);
      this.flames.push(mesh);
    }
    this.shards = [];
    const shard = new THREE.OctahedronGeometry(1, 0);
    for (let i = 0; i < 12; i++){
      const material = new THREE.MeshStandardMaterial({ color: 0xd7f4ff, roughness: 0.08, metalness: 0.12, emissive: 0x9adfff, emissiveIntensity: 0.65, transparent: true, opacity: 0.92 });
      const mesh = new THREE.Mesh(shard, material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.visible = false;
      this.group.add(mesh);
      this.shards.push(mesh);
    }
    this.lights = [];
    for (let i = 0; i < 4; i++){
      const light = new THREE.PointLight(0xfff1df, 0, 7, 2);
      light.visible = false;
      this.group.add(light);
      this.lights.push(light);
    }
    this.spot = new THREE.SpotLight(0xffb15a, 0, 9, Math.PI / 5, 0.55, 1);
    this.spot.castShadow = true;
    this.spot.shadow.mapSize.set(512, 512);
    this.spot.shadow.bias = -0.001;
    this.spot.shadow.normalBias = 0.02;
    this.spot.visible = false;
    this.group.add(this.spot);
    this.group.add(this.spot.target);
    this.overlayScene = new THREE.Scene();
    this.overlay = new THREE.Group();
    this.overlay.name = 'Fire heat-ramp overlay';
    this.overlayScene.add(this.overlay);
    this.origin = new THREE.Vector3();
    this.quat = new THREE.Quaternion();
    this.point = new THREE.Vector3();
    this.up = new THREE.Vector3();
    this.right = new THREE.Vector3();
    this.toCam = new THREE.Vector3();
    this.localUp = new THREE.Vector3(0, 1, 0);
    this.basis = new THREE.Matrix4();
    this.fireDetail = null;
    this.data = null;
  }
  install(data){
    this.data = data;
    const detail = data?.elements?.fire?.detail;
    if (!detail || this.fireDetail) return;
    const geometries = {
      core: new THREE.CircleGeometry(0.5, 16),
      body: flameShape(0.42, 1, 0.62),
      tips: flameShape(0.28, 1.15, 0.78),
      embers: new THREE.CircleGeometry(0.22, 8),
    };
    const pools = {};
    for (const role of FIRE_ROLES){
      const count = Math.max(...detail.components[role].map(frame => frame.length)) * 2;
      pools[role] = [];
      for (let i = 0; i < count; i++){
        const mesh = new THREE.Mesh(geometries[role], fireMaterial(role === 'tips' ? 0.55 : 0.9));
        mesh.visible = false;
        mesh.frustumCulled = false;
        mesh.depthTest = false;
        mesh.userData.role = role;
        this.overlay.add(mesh);
        pools[role].push(mesh);
      }
    }
    const halo = new THREE.Mesh(new THREE.CircleGeometry(0.72, 20), fireMaterial(0.28));
    halo.visible = false;
    halo.frustumCulled = false;
    halo.depthTest = false;
    this.overlay.add(halo);
    this.fireDetail = { pools, halo };
  }
  hide(){
    for (const mesh of this.flames) mesh.visible = false;
    for (const mesh of this.shards) mesh.visible = false;
    for (const light of this.lights) light.visible = false;
    this.spot.visible = false;
    this.hideFireDetail();
  }
  renderOverlay(renderer, camera){
    if (!this.fireDetail) return;
    const showing = this.fireDetail.halo.visible || FIRE_ROLES.some(role => this.fireDetail.pools[role].some(mesh => mesh.visible));
    if (!showing) return;
    const autoClear = renderer.autoClear;
    const tone = renderer.toneMapping;
    renderer.autoClear = false;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.clearDepth();
    renderer.render(this.overlayScene, camera);
    renderer.autoClear = autoClear;
    renderer.toneMapping = tone;
  }
  hideFireDetail(){
    if (!this.fireDetail) return;
    for (const pool of Object.values(this.fireDetail.pools)){
      for (const mesh of pool) mesh.visible = false;
    }
    this.fireDetail.halo.visible = false;
  }
  anchorPosition(bones, anchor, local, target){
    const bone = bones[ANCHORS[anchor] || 'chest'];
    bone.getWorldQuaternion(this.quat);
    bone.getWorldPosition(this.origin);
    return target.set(local[0], local[1], local[2]).applyQuaternion(this.quat).add(this.origin);
  }
  orientFlame(mesh, camera){
    this.up.copy(this.localUp).applyQuaternion(this.quat).normalize();
    camera.getWorldPosition(this.toCam);
    this.toCam.sub(mesh.position);
    this.toCam.addScaledVector(this.up, -this.toCam.dot(this.up));
    if (this.toCam.lengthSq() < 1e-6) this.toCam.set(0, 0, 1);
    this.toCam.normalize();
    this.right.crossVectors(this.up, this.toCam).normalize();
    this.basis.makeBasis(this.right, this.up, this.toCam);
    mesh.quaternion.setFromRotationMatrix(this.basis);
  }
  drawFire(game, move, element, frame, fade, bones){
    const detail = element.detail;
    const anchors = FIRE_ANCHORS[move.id] || [1, 2];
    const grow = 0.72 + 0.28 * fade;
    const roleScale = { core: 2.1, body: 3.5, tips: 4.1, embers: 2.4 };
    const roleOpacity = { core: 0.62, body: 0.28, tips: 0.5, embers: 0.9 };
    let haloPoint = null;
    let haloWeight = 0;
    for (const role of FIRE_ROLES){
      const samples = detail.components[role][frame] || [];
      const pool = this.fireDetail.pools[role];
      let slot = 0;
      for (const anchor of anchors){
        const mirror = anchor === 2 || anchor === 4 ? -1 : 1;
        for (const sample of samples){
          const mesh = pool[slot++];
          if (!mesh) break;
          this.anchorPosition(bones, anchor, [sample[1] * mirror, sample[2], sample[3]], this.point);
          mesh.visible = sample[9] > 0.02;
          mesh.position.copy(this.point);
          this.orientFlame(mesh, game.camera);
          const scale = roleScale[role] * grow;
          mesh.scale.set(sample[4] * scale, sample[5] * scale, 1);
          mesh.material.color.setRGB(sample[6], sample[7], sample[8]);
          mesh.material.opacity = sample[9] * fade * roleOpacity[role];
          if (role === 'core'){
            if (!haloPoint) haloPoint = new THREE.Vector3();
            haloPoint.add(this.point);
            haloWeight += 1;
          }
        }
      }
      for (let i = slot; i < pool.length; i++) pool[i].visible = false;
    }
    const halo = this.fireDetail.halo;
    if (haloPoint && haloWeight){
      halo.visible = true;
      halo.position.copy(haloPoint).multiplyScalar(1 / haloWeight);
      halo.quaternion.copy(game.camera.quaternion);
      halo.scale.setScalar(0.55 * grow);
      halo.material.color.setRGB(1, 0.42, 0.05);
      halo.material.opacity = 0.1 * fade;
    } else halo.visible = false;
  }
  update(game, move, pose){
    if (!this.data || !pose || !move){ this.hide(); return; }
    const element = this.data.elements[move.element];
    if (!element){ this.hide(); return; }
    const stageT = pose.stage === 'charge' ? pose.progress * 0.35 : pose.stage === 'strike' ? 0.35 + pose.progress * 0.55 : 0.9 + pose.progress * 0.1;
    const frame = Math.max(0, Math.min(element.particles.length - 1, Math.round(stageT * (element.particles.length - 1))));
    const particles = element.particles[frame];
    const fade = pose.stage === 'recover' ? 1 - pose.progress : pose.stage === 'charge' ? 0.35 + pose.progress * 0.65 : 1;
    const icy = move.element === 'ice';
    const detailedFire = move.element === 'fire' && element.detail && this.fireDetail;
    const bones = game.girl.userData.bones;
    if (detailedFire){
      for (const mesh of this.flames) mesh.visible = false;
      this.drawFire(game, move, element, frame, fade, bones);
    } else {
      this.hideFireDetail();
      this.flames.forEach((mesh, i) => {
        const sample = particles[i];
        if (!sample || icy && i < 12){ mesh.visible = false; return; }
        this.anchorPosition(bones, sample[0], [sample[1], sample[2], sample[3]], this.point);
        mesh.visible = sample[9] > 0.02;
        mesh.position.copy(this.point);
        mesh.quaternion.copy(game.camera.quaternion);
        const flameScale = move.element === 'fire' ? 2.8 : 2.2;
        mesh.scale.set(sample[4] * flameScale, sample[5] * flameScale, 1);
        mesh.material.color.setRGB(sample[6], sample[7], sample[8]);
        mesh.material.opacity = sample[9] * fade;
      });
    }
    this.shards.forEach((mesh, i) => {
      const sample = particles[i];
      mesh.visible = icy && !!sample;
      if (!mesh.visible) return;
      this.anchorPosition(bones, sample[0], [sample[1], sample[2], sample[3]], this.point);
      mesh.position.copy(this.point);
      mesh.scale.setScalar(Math.max(0.035, sample[4] * 0.9));
      mesh.rotation.set(frame * 0.35 + i, frame * 0.22, i);
      mesh.material.emissive.setRGB(sample[6] * 0.7, sample[7] * 0.85, sample[8]);
      mesh.material.opacity = 0.45 + sample[9] * fade;
    });
    const lights = element.lights.frames[Math.min(frame, element.lights.frames.length - 1)];
    this.lights.forEach((light, i) => {
      const sample = lights[i];
      this.anchorPosition(bones, sample[0], [sample[1], sample[2], sample[3]], this.point);
      light.visible = true;
      light.position.copy(this.point);
      light.color.setRGB(sample[5], sample[6], sample[7]);
      light.intensity = sample[4] * fade * (pose.stage === 'strike' ? 1.35 : 1) * (detailedFire ? 0.55 : 1);
    });
    bones.chest.getWorldPosition(this.origin);
    this.spot.visible = true;
    this.spot.color.setRGB(...element.lights.palette);
    this.spot.intensity = (pose.stage === 'strike' ? 16 : 7) * fade * (detailedFire ? 0.28 : 1);
    this.spot.position.copy(this.origin).add(new THREE.Vector3(0.35, 0.85, 0.55));
    this.spot.target.position.copy(this.origin).add(new THREE.Vector3(0, -0.55, 0.15));
    this.spot.castShadow = pose.stage === 'strike';
    game.girl.userData.elementalAttack = { element: move.element, frame, fade, palette: element.lights.palette, detail: detailedFire ? 'heat-ramps' : 'particles' };
  }
}
