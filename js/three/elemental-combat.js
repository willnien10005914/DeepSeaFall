import {AttackAdvection} from './attack-advection.js?v=50';
import * as THREE from 'three';
import { FlowGrains } from './attack-particles.js?v=50';

const ANCHORS = ['chest', 'l_wrist', 'r_wrist', 'l_ankle', 'r_ankle'];
const FIRE_ANCHORS = {
  'palm-wave': [1, 2],
  'spiral-kick': [3, 4],
  'crescent-kick': [3, 4],
  'twin-kick': [3, 4],
};
const FIRE_ROLES = ['core', 'body', 'tips', 'embers'];
const ROLE_GRAINS = { core: 8, body: 7, tips: 6, embers: 4, ice: 9, 'cold-fire': 7 };

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
    this.overlay.name = 'Stacked attack grains';
    this.overlayScene.add(this.overlay);
    this.grains = new FlowGrains(5200, this.overlay);
    this.flow = new AttackAdvection(this.overlay, scene);
    this.origin = new THREE.Vector3();
    this.quat = new THREE.Quaternion();
    this.point = new THREE.Vector3();
    this.up = new THREE.Vector3();
    this.right = new THREE.Vector3();
    this.forward = new THREE.Vector3();
    this.localUp = new THREE.Vector3(0, 1, 0);
    this.localRight = new THREE.Vector3(1, 0, 0);
    this.localForward = new THREE.Vector3(0, 0, 1);
    this.data = null;
  }
  install(data){ this.data = data; }
  hide(clear=true){
    if(clear)this.flow.clear();
    for (const light of this.lights) light.visible = false;
    this.spot.visible = false;
    this.grains.begin();
    this.grains.end();
  }
  renderOverlay(renderer, camera){
    if (!this.overlay.children.some(child => child.visible)) return;
    const autoClear = renderer.autoClear;
    const tone = renderer.toneMapping;
    renderer.autoClear = false;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.clearDepth();
    renderer.render(this.overlayScene, camera);
    renderer.autoClear = autoClear;
    renderer.toneMapping = tone;
  }
  anchorPosition(bones, anchor, local, target){
    const bone = bones[ANCHORS[anchor] || 'chest'];
    bone.getWorldQuaternion(this.quat);
    bone.getWorldPosition(this.origin);
    this.up.copy(this.localUp).applyQuaternion(this.quat);
    this.right.copy(this.localRight).applyQuaternion(this.quat);
    this.forward.copy(this.localForward).applyQuaternion(this.quat);
    return target.set(local[0], local[1], local[2]).applyQuaternion(this.quat).add(this.origin);
  }
  spray(sample, role, fade, time, index){
    const count = ROLE_GRAINS[role] || 6;
    const icy = role === 'ice' || role === 'cold-fire';
    const speed = icy ? 0.42 : role === 'embers' ? 1.35 : 0.95;
    const reach = icy ? 0.045 : role === 'tips' ? 0.11 : role === 'core' ? 0.035 : 0.07;
    for (let grain = 0; grain < count; grain++){
      const seed = index * 17.17 + grain * 2.81;
      const flow = (time * speed + seed) % 1;
      const along = (grain / count - 0.35) * reach * 1.4 + (flow - 0.2) * reach * (role === 'tips' ? 2.4 : 1.5);
      const spin = seed * 3.7 + time * (role === 'core' ? 1.6 : 3.1);
      const radius = reach * (0.22 + flow * (role === 'core' ? 0.35 : 0.95)) * (0.55 + (grain % 3) * 0.28);
      const x = this.point.x + this.up.x * along + this.right.x * Math.cos(spin) * radius + this.forward.x * Math.sin(spin) * radius;
      const y = this.point.y + this.up.y * along + this.right.y * Math.cos(spin) * radius + this.forward.y * Math.sin(spin) * radius;
      const z = this.point.z + this.up.z * along + this.right.z * Math.cos(spin) * radius + this.forward.z * Math.sin(spin) * radius;
      const life = Math.sin(flow * Math.PI);
      const heat = role === 'core' ? 0.62 : role === 'embers' ? 0.4 : role === 'tips' ? 0.05 : 0.22;
      const tone = life * fade * (0.45 + sample[9] * 0.55);
      this.grains.push(
        x, y, z,
        Math.min(1, sample[6] * (1 - heat) + heat) * tone,
        Math.min(1, sample[7] * (1 - heat * 0.35) + heat * 0.75) * tone,
        Math.min(1, sample[8] * (1 - heat * 0.2) + heat * (icy ? 1 : 0.35)) * tone,
      );
    }
  }
  update(game, move, pose){
    this.flow.update(game,move,pose);
    if (!this.data || !pose || !move){ this.hide(false); return; }
    const element = this.data.elements[move.element];
    if (!element){ this.hide(false); return; }
    const stageT = pose.stage === 'charge' ? pose.progress * 0.35 : pose.stage === 'strike' ? 0.35 + pose.progress * 0.55 : 0.9 + pose.progress * 0.1;
    const frame = Math.max(0, Math.min(element.particles.length - 1, Math.round(stageT * (element.particles.length - 1))));
    const fade = pose.stage === 'recover' ? 1 - pose.progress : pose.stage === 'charge' ? 0.35 + pose.progress * 0.65 : 1;
    const bones = game.girl.userData.bones;
    const time = game.t || 0;
    this.grains.begin();
    if (move.element === 'fire' && element.detail){
      const anchors = FIRE_ANCHORS[move.id] || [1, 2];
      let index = 0;
      for (const role of FIRE_ROLES){
        const samples = element.detail.components[role][frame] || [];
        for (const anchor of anchors){
          const mirror = anchor === 2 || anchor === 4 ? -1 : 1;
          for (const sample of samples){
            if (sample[9] <= 0.02) continue;
            this.anchorPosition(bones, anchor, [sample[1] * mirror, sample[2], sample[3]], this.point);
            this.spray(sample, role, fade, time, index);
            index += 1;
          }
        }
      }
    } else {
      const samples = element.particles[frame];
      const role = move.element === 'ice' ? 'ice' : 'cold-fire';
      samples.forEach((sample, index) => {
        if (!sample || sample[9] <= 0.02) return;
        if (move.element === 'ice' && index >= 18) return;
        this.anchorPosition(bones, sample[0], [sample[1], sample[2], sample[3]], this.point);
        this.spray(sample, role, fade, time, index);
      });
    }
    const grainSize = move.element === 'ice' ? 0.05 : move.element === 'fire' ? 0.064 : 0.058;
    this.grains.end(grainSize);
    const lights = element.lights.frames[Math.min(frame, element.lights.frames.length - 1)];
    this.lights.forEach((light, i) => {
      const sample = lights[i];
      this.anchorPosition(bones, sample[0], [sample[1], sample[2], sample[3]], this.point);
      light.visible = true;
      light.position.copy(this.point);
      light.color.setRGB(sample[5], sample[6], sample[7]);
      light.intensity = sample[4] * fade * (pose.stage === 'strike' ? 1.15 : 0.8) * 0.5;
    });
    bones.chest.getWorldPosition(this.origin);
    this.spot.visible = true;
    this.spot.color.setRGB(...element.lights.palette);
    this.spot.intensity = (pose.stage === 'strike' ? 8 : 3.5) * fade;
    this.spot.position.copy(this.origin).add(new THREE.Vector3(0.35, 0.85, 0.55));
    this.spot.target.position.copy(this.origin).add(new THREE.Vector3(0, -0.55, 0.15));
    this.spot.castShadow = pose.stage === 'strike';
    game.girl.userData.elementalAttack = { element: move.element, frame, fade, palette: element.lights.palette, detail: 'stacked-grains + momentum/curl advection', flow:this.flow.stats };
  }
}
