import * as THREE from 'three';

const MOVES = ['spiral-kick','cross-blades','diagonal-slash','crescent-kick','palm-wave','lotus-burst','halo-guard','twin-kick','sword-dance','tidal-release'];
const ELEMENTS = ['fire','ice','cold-fire'];
const STAGES = ['charge','strike','recover'];
const ELEMENT_OF = { 'spiral-kick':'fire','crescent-kick':'fire','palm-wave':'fire','twin-kick':'fire','cross-blades':'ice','diagonal-slash':'ice','sword-dance':'ice','lotus-burst':'cold-fire','halo-guard':'cold-fire','tidal-release':'cold-fire' };

export function inferCombat(model, observation){
  let input = observation;
  for (const layer of model.layers){
    const out = new Float64Array(layer.bias.length);
    for (let i = 0; i < out.length; i++){
      let sum = layer.bias[i];
      const row = layer.weights[i];
      for (let j = 0; j < input.length; j++) sum += row[j] * input[j];
      out[i] = Math.tanh(sum);
    }
    input = out;
  }
  return input;
}

let loaded;
export function loadCombatPPO(){
  return loaded ??= fetch(new URL('../../assets/policy/combat-ppo-v44.json', import.meta.url)).then(async response => {
    if (!response.ok) throw new Error('Combat policy unavailable');
    const model = await response.json();
    if (model.algorithm !== 'PPO residual joint control' || model.action_size !== model.joint_order.length) throw new Error('Combat policy dimensions differ');
    return model;
  });
}

export class CombatActor {
  constructor(model){
    this.model = model;
    this.D = model.action_size;
    this.q = new Float64Array(this.D);
    this.qd = new Float64Array(this.D);
    this.index = Object.fromEntries(model.joint_order.map((name, i) => [name, i]));
    this.bones = [...new Set(model.joint_order.map(name => name.slice(0, -2)))];
    this.euler = new THREE.Euler();
    this.quat = new THREE.Quaternion();
    this.last = null;
    this.ready = false;
  }
  pause(){ this.last = null; this.ready = false; this.qd.fill(0); }
  observation(state, ref, blend){
    const stage = STAGES.indexOf(state.stage);
    const element = ELEMENTS.indexOf(state.element || ELEMENT_OF[state.id]);
    const move = MOVES.indexOf(state.id);
    const phase = state.progress * Math.PI * 2;
    const obs = [blend, Math.sin(phase), Math.cos(phase)];
    for (let i = 0; i < 3; i++) obs.push(i === stage ? 1 : 0);
    for (let i = 0; i < 3; i++) obs.push(i === element ? 1 : 0);
    for (let i = 0; i < 10; i++) obs.push(i === move ? 1 : 0);
    for (let i = 0; i < this.D; i++) obs.push(this.q[i]);
    for (let i = 0; i < this.D; i++) obs.push(this.qd[i]);
    for (let i = 0; i < this.D; i++) obs.push(ref[i]);
    return obs;
  }
  pose(root, state, posed, blend){
    if (this.observation(state, new Float64Array(this.D), blend).length !== this.model.observation_size) return false;
    const now = performance.now() / 1000;
    const dt = this.last == null ? 1 / 60 : Math.max(0, Math.min(0.05, now - this.last));
    this.last = now;
    if (!this.ready){ this.q.fill(0); this.qd.fill(0); this.ready = true; }
    const ref = new Float64Array(this.D);
    for (const [bone, angles] of Object.entries(posed)){
      for (let axis = 0; axis < 3; axis++){
        const key = `${bone}_${'xyz'[axis]}`;
        if (key in this.index) ref[this.index[key]] = angles[axis] || 0;
      }
    }
    const action = inferCombat(this.model, this.observation(state, ref, blend));
    if (![...action].every(Number.isFinite)) return false;
    const { action_scales: scale, limits_low: low, limits_high: high } = this.model;
    const follow = Math.max(0.2, blend);
    for (let i = 0; i < this.D; i++){
      let goal = Math.max(low[i], Math.min(high[i], ref[i] + action[i] * scale[i]));
      goal = this.q[i] + (goal - this.q[i]) * follow;
      const acc = Math.max(-18, Math.min(18, 80 * (goal - this.q[i]) - 16 * this.qd[i]));
      this.qd[i] = Math.max(-4, Math.min(4, this.qd[i] + acc * dt));
      this.q[i] = Math.max(low[i], Math.min(high[i], this.q[i] + this.qd[i] * dt));
    }
    const bones = root.userData.bones;
    for (const bone of this.bones){
      const x = this.q[this.index[`${bone}_x`]];
      const y = this.q[this.index[`${bone}_y`]];
      const z = this.q[this.index[`${bone}_z`]];
      this.quat.setFromEuler(this.euler.set(x, y, z, 'XYZ'));
      bones[bone].quaternion.copy(this.quat);
    }
    let peak = 0;
    for (const value of action) peak = Math.max(peak, Math.abs(value));
    root.userData.combatPPOStats = { source: 'combat-ppo-v44', blend, actionPeak: peak };
    return true;
  }
}
