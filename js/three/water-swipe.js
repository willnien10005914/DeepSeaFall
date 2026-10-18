import * as THREE from 'three';

// Camera-facing ribbons live in the 3D scene, so cliffs/animals occlude them.
// Fixed buffers keep a long drag from growing geometry or particle counts.
class FadingRibbon {
 constructor(scene,name,life,width,capacity=120){
  this.life=life;this.width=width;this.capacity=capacity;this.points=[];
  this.geometry=new THREE.BufferGeometry();
  this.positions=new Float32Array(capacity*6);this.edges=new Float32Array(capacity*2);this.strength=new Float32Array(capacity*2);
  for(let i=0;i<capacity;i++){this.edges[i*2]=-1;this.edges[i*2+1]=1}
  const indices=[];for(let i=0;i<capacity-1;i++){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2)}
  this.geometry.setIndex(indices);this.geometry.setAttribute('position',new THREE.BufferAttribute(this.positions,3).setUsage(THREE.DynamicDrawUsage));
  this.geometry.setAttribute('edge',new THREE.BufferAttribute(this.edges,1));this.geometry.setAttribute('strength',new THREE.BufferAttribute(this.strength,1).setUsage(THREE.DynamicDrawUsage));
  const material=new THREE.ShaderMaterial({side:THREE.DoubleSide,transparent:true,depthWrite:false,depthTest:true,blending:THREE.AdditiveBlending,
   vertexShader:'attribute float edge;attribute float strength;varying float vEdge;varying float vStrength;void main(){vEdge=edge;vStrength=strength;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
   fragmentShader:`varying float vEdge;varying float vStrength;void main(){float x=abs(vEdge);float glow=pow(max(0.,1.-x),1.7);float core=exp(-x*x*58.);float alpha=(glow*.48+core*.95)*vStrength;
    gl_FragColor=vec4(mix(vec3(.18,1.2,1.7),vec3(3.6,4.4,4.7),core),alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
   }`});
  this.mesh=new THREE.Mesh(this.geometry,material);this.mesh.name=name;this.mesh.frustumCulled=false;this.mesh.renderOrder=2;scene.add(this.mesh);
  this.side=new THREE.Vector3();this.tangent=new THREE.Vector3();this.view=new THREE.Vector3();
 }
 push(position,time,start=false){
  const last=this.points.at(-1);if(last&&!start&&last.position.distanceToSquared(position)<.00035)return false;
  this.points.push({position:position.clone(),time,start});if(this.points.length>this.capacity)this.points.shift();return true;
 }
 clear(){this.points.length=0;this.geometry.setDrawRange(0,0)}
 update(time,camera){
  this.points=this.points.filter(p=>time-p.time<this.life);const points=this.points;camera.getWorldDirection(this.view);
  // Independent strokes are joined only by zero-width, zero-alpha vertices.
  for(let i=0;i<points.length;i++){
   const p=points[i],prev=points[Math.max(0,i-1)],next=points[Math.min(points.length-1,i+1)];
   this.tangent.subVectors(next.start?p.position:next.position,p.start?p.position:prev.position);
   this.side.crossVectors(this.tangent,this.view);if(this.side.lengthSq()<1e-8)this.side.set(1,0,0);this.side.normalize();
   const age=Math.max(0,time-p.time),fade=Math.pow(Math.max(0,1-age/this.life),1.5);
   const seam=p.start||(next.start&&i<points.length-1),width=seam?0:this.width*(.3+.7*fade)*(i===points.length-1?.18:1);
   for(let j=0;j<2;j++){const k=i*6+j*3,sign=j?1:-1;this.positions[k]=p.position.x+this.side.x*width*sign;this.positions[k+1]=p.position.y+this.side.y*width*sign;this.positions[k+2]=p.position.z+this.side.z*width*sign;this.strength[i*2+j]=seam?0:fade;}
  }
  this.geometry.setDrawRange(0,Math.max(0,points.length-1)*6);this.geometry.attributes.position.needsUpdate=true;this.geometry.attributes.strength.needsUpdate=true;
 }
}

export class WaterSwipe {
 constructor(scene,bubbles){
  this.bubbles=bubbles;this.stroke=new FadingRibbon(scene,'Directional finger water cut',.52,.085);
  this.wake=new FadingRibbon(scene,'Swimmer curved water wake',.70,.10);
  this.swish=new FadingRibbon(scene,'Turning crescent of disturbed water',.60,.040,160);
  this.origin=new THREE.Vector3();this.lastPointer=null;this.lastOrigin=null;this.lastDirection=new THREE.Vector3(1,0,0);this.active=false;this.lastBurst=-10;this.emissionCarry=0;
  this.status={active:false,strokePoints:0,wakePoints:0,bursts:0};this.bursts=0;
 }
 clear(){for(const r of [this.stroke,this.wake,this.swish])r.clear();this.lastPointer=null;this.lastOrigin=null;this.active=false;this.emissionCarry=0;this.lastBurst=-10;this.lastDirection.set(1,0,0);this.bursts=0;this.status={active:false,strokePoints:0,wakePoints:0,bursts:0}}
 spray(position,velocity,direction,count=1){
  for(let i=0;i<count&&this.bubbles.particles.length<this.bubbles.capacity;i++){
   const r=this.bubbles.random.bind(this.bubbles),side=new THREE.Vector3(-direction.y,direction.x,0);
   this.bubbles.particles.push({position:position.clone().addScaledVector(side,(r()-.5)*.17).addScaledVector(direction,(r()-.5)*.07),velocity:new THREE.Vector3((r()-.5)*.13,.18+r()*.29,(r()-.5)*.12).addScaledVector(velocity,-.26).addScaledVector(side,(r()-.5)*.24),radius:.013+r()*.025,age:0,life:1.1+r()*1.7,seed:r()*20});
  }
 }
 update(dt,time,root,camera,pointer,velocity,enabled=true){
  dt=THREE.MathUtils.clamp(dt,0,.12);root.updateMatrixWorld(true);
  const bones=root.userData.bones;if(bones?.chest)bones.chest.getWorldPosition(this.origin);else root.localToWorld(this.origin.set(0,1.10,0));
  const active=enabled&&!!pointer?.active,speed=velocity.length();let direction=speed>.08?velocity.clone().normalize():this.lastDirection.clone();direction.z=0;direction.normalize();
  if(active){
   const world=new THREE.Vector3(pointer.x,pointer.y,.5).unproject(camera),ray=world.sub(camera.position).normalize();
   const target=camera.position.clone().addScaledVector(ray,-camera.position.z/ray.z);
   if(speed<.10){direction.copy(target).sub(this.origin);direction.z=0;if(direction.lengthSq()>.0001)direction.normalize();else direction.copy(this.lastDirection)}
   const distance=this.lastPointer?target.distanceTo(this.lastPointer):0;
   const start=!this.active||distance>3.5;this.stroke.push(target,time,start);
   if(distance>.015&&!start){
    const count=Math.min(14,Math.ceil(distance*14)),along=target.clone().sub(this.lastPointer).normalize();
    for(let i=0;i<count;i++)this.spray(this.lastPointer.clone().lerp(target,(i+.5)/count),velocity,along);
   }
   const turn=this.active&&speed>.20&&direction.dot(this.lastDirection)<.84;
   if((!this.active||turn)&&time-this.lastBurst>.22){
    this.lastBurst=time;this.bursts++;const side=new THREE.Vector3(-direction.y,direction.x,0);
    for(let i=0;i<=18;i++){
     const u=i/18,a=(u-.5)*Math.PI*.95,point=this.origin.clone().addScaledVector(direction,.22+Math.cos(a)*.55).addScaledVector(side,Math.sin(a)*.55);point.z+=.07;
     this.swish.push(point,time,i===0);if(i%2===0)this.spray(point,velocity,direction,2);
    }
   }
   if(speed>.10){
    const point=this.origin.clone().addScaledVector(direction,-.18);point.z+=.06;this.wake.push(point,time,!this.active);
    this.emissionCarry+=dt*(34+speed*16);let count=Math.min(10,Math.floor(this.emissionCarry));this.emissionCarry-=count;
    while(count-->0)this.spray(this.origin,velocity,direction);
   }
   this.lastPointer=target;
  }else this.lastPointer=null;
  if(speed>.10)this.lastDirection.copy(direction);this.active=active;
  for(const ribbon of [this.stroke,this.wake,this.swish])ribbon.update(time,camera);
  this.status={active,strokePoints:this.stroke.points.length,wakePoints:this.wake.points.length,swishPoints:this.swish.points.length,bursts:this.bursts};
 }
}
