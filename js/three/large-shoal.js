import * as THREE from 'three';
import {makeRealFish} from './marine-life.js?v=42';

const hash=(i,k)=>{const n=Math.sin(i*127.1+k*311.7)*43758.5453;return n-Math.floor(n)};

// Four instanced draws reuse the same anatomical fish, including membranes,
// eyes and gill covers. Per-instance phases prevent a rigid synchronised grid.
export function makeLargeShoal(parent,count=144){
  const group=new THREE.Group();group.name='Passing large shoal';parent.add(group);
  const template=makeRealFish(0xb5c2c8),meshes=[],slots=[],dummy=new THREE.Object3D();
  const phases=new Float32Array(count);
  for(let i=0;i<count;i++){
    const a=hash(i,1)*Math.PI*2,cos=hash(i,2)*2-1,r=Math.cbrt(hash(i,3)),sin=Math.sqrt(1-cos*cos);
    slots.push({x:Math.cos(a)*sin*r*4.0,y:cos*r*1.7,z:Math.sin(a)*sin*r*1.8,scale:.42+hash(i,4)*.28});
    phases[i]=hash(i,5)*Math.PI*2;
  }
  for(const part of template.children){
    const geometry=part.geometry.clone();geometry.setAttribute('schoolPhase',new THREE.InstancedBufferAttribute(phases,1));
    const mat=part.material,previous=mat.onBeforeCompile;
    mat.onBeforeCompile=shader=>{
      previous(shader);shader.vertexShader='attribute float schoolPhase;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('+uCreaturePhase)*.055','+uCreaturePhase+schoolPhase)*.055');
    };
    mat.customProgramCacheKey=()=> 'large-shoal-phase-v7';
    const mesh=new THREE.InstancedMesh(geometry,mat,count);mesh.name='School '+part.name;mesh.frustumCulled=false;mesh.receiveShadow=true;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for(let i=0;i<count;i++)mesh.setColorAt(i,new THREE.Color(.86+hash(i,6)*.14,.89+hash(i,7)*.11,.92+hash(i,8)*.08));
    group.add(mesh);meshes.push(mesh);
  }
  const status={active:false,count:0,pass:0};
  return {group,meshes,status,update(time){
    const t=((time%36)+36)%36;
    const pass=t>=6&&t<=14.5?1:t>=23&&t<=31.5?2:0;
    group.visible=!!pass;status.active=!!pass;status.count=pass?count:0;status.pass=pass;
    if(!pass)return;
    const u=(t-(pass===1?6:23))/8.5,direction=pass===1?1:-1;
    const centreX=direction*(-10+u*20),centreY=pass===1?1.05:-.30;
    template.userData.marine.uniforms.uCreatureTime.value=time;
    template.userData.marine.uniforms.uCreatureSpeed.value=1.3;
    for(let i=0;i<count;i++){
      const s=slots[i];dummy.position.set(centreX+s.x,centreY+s.y+Math.sin(time*.9+i*.71)*.075,-5.8+s.z);
      dummy.rotation.set(Math.sin(time*.7+i*.4)*.035,direction>0?.025:Math.PI-.025,Math.sin(time*.8+i*.37)*.04);
      dummy.scale.setScalar(s.scale);dummy.updateMatrix();
      for(const mesh of meshes)mesh.setMatrixAt(i,dummy.matrix);
    }
    for(const mesh of meshes)mesh.instanceMatrix.needsUpdate=true;
  }};
}
