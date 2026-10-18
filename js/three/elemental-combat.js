import * as THREE from 'three';

const ANCHORS = ['chest', 'l_wrist', 'r_wrist', 'l_ankle', 'r_ankle'];
let loaded;
export function loadElementalDynamics(){
  return loaded ??= fetch(new URL('../../assets/policy/elemental-dynamics-v44.json', import.meta.url)).then(async response => {
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
    this.origin = new THREE.Vector3();
    this.quat = new THREE.Quaternion();
    this.data = null;
  }
  install(data){ this.data = data; }
  hide(){
    for (const mesh of this.flames) mesh.visible = false;
    for (const mesh of this.shards) mesh.visible = false;
    for (const light of this.lights) light.visible = false;
    this.spot.visible = false;
  }
  anchorPosition(bones, anchor, local, target){
    const bone = bones[ANCHORS[anchor] || 'chest'];
    bone.getWorldQuaternion(this.quat);
    bone.getWorldPosition(this.origin);
    return target.set(local[0], local[1], local[2]).applyQuaternion(this.quat).add(this.origin);
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
    const bones = game.girl.userData.bones;
    const point = new THREE.Vector3();
    this.flames.forEach((mesh, i) => {
      const sample = particles[i];
      if (!sample || icy && i < 12){ mesh.visible = false; return; }
      this.anchorPosition(bones, sample[0], [sample[1], sample[2], sample[3]], point);
      mesh.visible = sample[9] > 0.02;
      mesh.position.copy(point);
      mesh.quaternion.copy(game.camera.quaternion);
      const flameScale = move.element === 'fire' ? 2.8 : 2.2;
      mesh.scale.set(sample[4] * flameScale, sample[5] * flameScale, 1);
      mesh.material.color.setRGB(sample[6], sample[7], sample[8]);
      mesh.material.opacity = sample[9] * fade;
    });
    this.shards.forEach((mesh, i) => {
      const sample = particles[i];
      mesh.visible = icy && !!sample;
      if (!mesh.visible) return;
      this.anchorPosition(bones, sample[0], [sample[1], sample[2], sample[3]], point);
      mesh.position.copy(point);
      mesh.scale.setScalar(Math.max(0.035, sample[4] * 0.9));
      mesh.rotation.set(frame * 0.35 + i, frame * 0.22, i);
      mesh.material.emissive.setRGB(sample[6] * 0.7, sample[7] * 0.85, sample[8]);
      mesh.material.opacity = 0.45 + sample[9] * fade;
    });
    const lights = element.lights.frames[Math.min(frame, element.lights.frames.length - 1)];
    this.lights.forEach((light, i) => {
      const sample = lights[i];
      this.anchorPosition(bones, sample[0], [sample[1], sample[2], sample[3]], point);
      light.visible = true;
      light.position.copy(point);
      light.color.setRGB(sample[5], sample[6], sample[7]);
      light.intensity = sample[4] * fade * (pose.stage === 'strike' ? 1.35 : 1);
    });
    bones.chest.getWorldPosition(this.origin);
    this.spot.visible = true;
    this.spot.color.setRGB(...element.lights.palette);
    this.spot.intensity = (pose.stage === 'strike' ? 16 : 7) * fade;
    this.spot.position.copy(this.origin).add(new THREE.Vector3(0.35, 0.85, 0.55));
    this.spot.target.position.copy(this.origin).add(new THREE.Vector3(0, -0.55, 0.15));
    this.spot.castShadow = pose.stage === 'strike';
    game.girl.userData.elementalAttack = { element: move.element, frame, fade, palette: element.lights.palette };
  }
}
