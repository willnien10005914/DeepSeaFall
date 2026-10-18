import * as THREE from 'three';

// Instanced, depth-tested 3D shells. Clear centres and Fresnel rims keep the
// water visible through each bubble rather than drawing opaque white dots.
export class SwimBubbles {
  constructor(scene, capacity = 420) {
    this.capacity = capacity; this.particles = []; this.accumulator = 0;
    this.randomState = 6147; this.lastBoost = false;
    const geometry = new THREE.SphereGeometry(1, 14, 10);
    this.alpha = new THREE.InstancedBufferAttribute(new Float32Array(capacity), 1);
    geometry.setAttribute('bubbleAlpha', this.alpha);
    const material = new THREE.ShaderMaterial({ transparent: true, depthWrite: false,
      uniforms: { sunDirection: { value: new THREE.Vector3(-.28, .78, .56) } },
      vertexShader: `attribute float bubbleAlpha;varying float vAlpha;varying vec3 vNormal;varying vec3 vView;
        void main(){vec4 local=instanceMatrix*vec4(position,1.);vec4 mv=modelViewMatrix*local;
        vNormal=normalize(normalMatrix*mat3(instanceMatrix)*normal);vView=-mv.xyz;vAlpha=bubbleAlpha;
        gl_Position=projectionMatrix*mv;}`,
      fragmentShader: `uniform vec3 sunDirection;varying float vAlpha;varying vec3 vNormal;varying vec3 vView;
        void main(){vec3 n=normalize(vNormal),eye=normalize(vView);float facing=abs(dot(n,eye));
        float rim=pow(1.-facing,3.2);vec3 light=normalize(mat3(viewMatrix)*sunDirection);
        float glint=pow(max(dot(reflect(-light,n),eye),0.),48.);
        float crescent=pow(max(dot(n,normalize(light+eye)),0.),18.);
        float opacity=(.014+rim*.56+glint*.64+crescent*.13)*vAlpha;
        gl_FragColor=vec4(vec3(.48,.69,.85)+glint*vec3(1.1)+crescent*.28,opacity);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        }` });
    this.mesh = new THREE.InstancedMesh(geometry, material, capacity);
    this.mesh.name = 'Swimmer entrained-air bubbles'; this.mesh.count = 0;
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 3;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); scene.add(this.mesh);
    this.dummy = new THREE.Object3D(); this.point = new THREE.Vector3();
    this.emission = { rate: 0, alive: 0, boosted: false };
  }
  random() { this.randomState = (1664525 * this.randomState + 1013904223) >>> 0; return this.randomState / 4294967296; }
  clear() { this.particles.length = 0; this.mesh.count = 0; this.accumulator = 0; this.lastBoost = false; }
  emit(position, velocity, boost = false) {
    if (this.particles.length >= this.capacity) return;
    const r = this.random.bind(this), big = r() > .93;
    this.particles.push({ position: position.clone().add(new THREE.Vector3((r()-.5)*.055,(r()-.5)*.035,(r()-.5)*.055)),
      velocity: new THREE.Vector3((r()-.5)*.11-velocity.x*.17,.22+r()*.30-velocity.y*.12,(r()-.5)*.10+.03),
      radius: big ? .043+r()*.022 : .009+r()*(boost?.029:.023),
      age: 0, life: 2.5+r()*2.0, seed: r()*20 });
  }
  update(dt, time, root, motion = {}) {
    dt = Math.min(Math.max(dt,0),.12);
    const swim = motion.swimming !== false, boost = (motion.boost || 0) > .25;
    const velocity = motion.velocity || new THREE.Vector3();
    const speed = velocity.length();
    const phase = motion.phase ?? time * 1.3;
    const stroke = .65+.35*Math.pow(Math.sin(phase),2);
    const rate = swim ? (boost ? 116 : 26+Math.min(speed,3)*12)*stroke : 2.2;
    root.updateMatrixWorld(true);
    const bones = root.userData.bones;
    const emitters = bones ? [bones.l_wrist,bones.r_wrist,bones.l_ankle,bones.r_ankle,bones.head,bones.chest,bones.head] : [];
    const origin = () => {
      const i = Math.floor(this.random()*7);
      if (emitters[i]) emitters[i].getWorldPosition(this.point);
      else root.localToWorld(this.point.set((this.random()-.5)*.28,i===6?1.38:.93,-.06));
      return this.point;
    };
    if (boost && !this.lastBoost) for (let i=0;i<48;i++) this.emit(origin(),velocity,true);
    this.accumulator += rate*dt;
    while (this.accumulator >= 1) { this.emit(origin(),velocity,boost); this.accumulator--; }
    this.lastBoost = boost;
    this.advance(dt,time);
    this.emission={rate,alive:this.particles.length,boosted:boost,swimming:swim};
  }
  burst(position,velocity,count=60,spread=.55,scale=1) {
    for(let i=0;i<count;i++){
      const before=this.particles.length;this.emit(position,velocity,true);
      if(this.particles.length===before)break;
      const p=this.particles[this.particles.length-1];
      p.position.x+=(this.random()-.5)*spread;p.position.y+=(this.random()-.5)*spread;p.position.z+=(this.random()-.5)*spread;
      p.radius*=scale;p.velocity.y+=this.random()*.35;p.life=2.5+this.random()*3;
    }
  }
  updateExternal(dt,time){this.advance(Math.min(Math.max(dt,0),.12),time);this.emission={rate:0,alive:this.particles.length};}
  advance(dt,time){
    const alive=[];
    for (const p of this.particles) {
      p.age+=dt;if(p.age>=p.life)continue;
      p.velocity.y+=dt*.035;
      p.position.addScaledVector(p.velocity,dt);
      p.position.x+=Math.sin(time*1.5+p.seed)*dt*.026;
      p.position.z+=Math.cos(time*1.25+p.seed)*dt*.021;
      const fade=Math.min(p.age/.16,1)*Math.min((p.life-p.age)/.85,1);
      const radius=p.radius*(1+p.age*.027),wobble=Math.sin(time*3+p.seed)*.045;
      this.dummy.position.copy(p.position);this.dummy.scale.set(radius*(1-wobble),radius*(1+wobble),radius);
      this.dummy.updateMatrix();this.mesh.setMatrixAt(alive.length,this.dummy.matrix);
      this.alpha.setX(alive.length,Math.max(0,fade));alive.push(p);
    }
    this.particles=alive;this.mesh.count=alive.length;
    this.alpha.needsUpdate=true;this.mesh.instanceMatrix.needsUpdate=true;
  }

}
