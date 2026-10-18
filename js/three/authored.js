import {MotionGarment} from './motion-garment.js?v=42';
import {applyCombatPose} from './combat-moves.js?v=44';
import {SleepCloth} from './sleep-cloth.js?v=42';
import {installFabricDamage} from './injury-effects.js?v=42';
import {bodyColliderData} from './body-collider-data.js?v=42';
import {ClothContact} from './cloth-contact.js?v=42';
import * as THREE from 'three';
import {installPortraitSkin} from './portrait-shading.js?v=42';
import {rigData} from './rig-data.js?v=42';
import {bindWhale, poseWhale} from './whale-motion.js?v=42';
import {poseSwimmer} from './swimming.js?v=42';

function installHairFlow(material,uniforms){
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,uniforms);
    shader.vertexShader='uniform float uLongHairTime;uniform vec3 uLongHairFlow;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      float hairW=clamp((1.43-position.y)/.52,0.,1.);float hairWW=hairW*hairW;
      transformed.x+=(sin(uLongHairTime*1.15+position.y*6.+position.z*4.)*.033+uLongHairFlow.x*2.2)*hairWW;
      transformed.z+=(sin(uLongHairTime*.95+position.y*5.+position.x*3.)*.041+uLongHairFlow.z*1.45)*hairWW;
      transformed.x+=sin(uLongHairTime*1.73+position.z*24.+position.x*31.)*.009*hairWW*hairW;
      transformed.z+=cos(uLongHairTime*1.47+position.x*27.)*.008*hairWW*hairW;
      transformed.y+=sin(uLongHairTime*.8+position.x*4.)*.012*hairWW*hairW;`);
    shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>
      float nw=clamp((1.43-position.y)/.52,0.,1.);float dw=position.y<1.43&&position.y>.91?-1./.52:0.;
      float nxp=uLongHairTime*1.15+position.y*6.+position.z*4.;float nzp=uLongHairTime*.95+position.y*5.+position.x*3.;
      float dxdy=.033*(6.*cos(nxp)*nw*nw+2.*sin(nxp)*nw*dw)+uLongHairFlow.x*4.4*nw*dw;
      float dzdy=.041*(5.*cos(nzp)*nw*nw+2.*sin(nzp)*nw*dw)+uLongHairFlow.z*2.9*nw*dw;
      objectNormal.y-=dxdy*objectNormal.x+dzdy*objectNormal.z;objectNormal=normalize(objectNormal);`);
  };
  material.customProgramCacheKey=()=> 'layered-long-hair-flow-v25';
}
function bindHuman(root) {
  const colliderGeometry=new THREE.BufferGeometry();colliderGeometry.setAttribute('position',new THREE.Float32BufferAttribute(bodyColliderData.positions,3));colliderGeometry.setIndex(bodyColliderData.index);
  const collider=new THREE.Mesh(colliderGeometry,new THREE.MeshBasicMaterial());collider.name='skin_body_collider';root.add(collider);
  const bones=rigData.map(j=>{const b=new THREE.Bone();b.name=j.name;return b});
  const points=rigData.map(j=>new THREE.Vector3(...j.position));
  rigData.forEach((j,i)=>{
    const parent=rigData.findIndex(p=>p.name===j.parent);
    bones[i].position.copy(points[i]);
    if(parent>=0){bones[i].position.sub(points[parent]);bones[parent].add(bones[i])}
    else root.add(bones[i]);
  });
  const skeleton=new THREE.Skeleton(bones);root.updateMatrixWorld(true);
  const surfaces=[];root.traverse(o=>{if(o.isMesh)surfaces.push(o)});
  const head=rigData.findIndex(j=>j.name==='head');
  for(const mesh of surfaces){
    const geo=mesh.geometry;const position=geo.attributes.position;
    const indices=new Uint16Array(position.count*4);const weights=new Float32Array(position.count*4);
    const fixedHead=/hair|eyebrow|iris|pupil|sclera|lip|eyes|eyelashes/.test(mesh.name);
    for(let i=0;i<position.count;i++){
      if(mesh.name.includes('hair_long')||mesh.name==='hair_fine_long'){
        const y=position.getY(i),headW=THREE.MathUtils.clamp((y-1.29)/.14,0,1);
        const chestW=(1-headW)*THREE.MathUtils.clamp((y-1.10)/.19,0,1);
        indices[i*4]=head;indices[i*4+1]=rigData.findIndex(j=>j.name==='chest');indices[i*4+2]=rigData.findIndex(j=>j.name==='spine');
        weights[i*4]=headW;weights[i*4+1]=chestW;weights[i*4+2]=1-headW-chestW;continue;
      }
      if(mesh.name.startsWith('dress_strap')){indices[i*4]=rigData.findIndex(j=>j.name==='chest');weights[i*4]=1;continue}
      if(fixedHead){indices[i*4]=head;weights[i*4]=1;continue}
      const p=new THREE.Vector3().fromBufferAttribute(position,i);
      if(mesh.name==='dress_skirt' && p.y<.99){
        // Lower cloth follows the legs during compact poses; waist remains on hips.
        const legW=THREE.MathUtils.smoothstep(.98-p.y,.02,.13);
        const left=THREE.MathUtils.smoothstep(p.x,-.045,.045);
        indices[i*4]=0;indices[i*4+1]=rigData.findIndex(j=>j.name==='l_thigh');indices[i*4+2]=rigData.findIndex(j=>j.name==='r_thigh');
        weights[i*4]=1-legW;weights[i*4+1]=legW*left;weights[i*4+2]=legW*(1-left);continue;
      }
      if(mesh.name==='dress_skirt'||mesh.name==='dress_bodice'){
        // The upper garment follows the torso, never nearby arm bones.
        const chestW=THREE.MathUtils.smoothstep(p.y,.98,1.18),hipW=1-THREE.MathUtils.smoothstep(p.y,.90,1.04);
        indices[i*4]=rigData.findIndex(j=>j.name==='hips');indices[i*4+1]=rigData.findIndex(j=>j.name==='spine');indices[i*4+2]=rigData.findIndex(j=>j.name==='chest');
        weights[i*4]=hipW;weights[i*4+1]=(1-hipW)*(1-chestW);weights[i*4+2]=(1-hipW)*chestW;continue;
      }
      if(mesh.name.startsWith('skin_body') && p.y>1.35){indices[i*4]=head;weights[i*4]=1;continue}
      const isArm=p.y>.80&&p.y<1.29&&Math.abs(p.x)>.155&&mesh.name.startsWith('skin_body');
      if(isArm){
        const prefix=p.x<0?'r_':'l_';
        const si=rigData.findIndex(j=>j.name===prefix+'shoulder'),ei=rigData.findIndex(j=>j.name===prefix+'elbow'),wi=rigData.findIndex(j=>j.name===prefix+'wrist');
        const project=(a,b)=>{const ab=b.clone().sub(a);const t=THREE.MathUtils.clamp(p.clone().sub(a).dot(ab)/ab.lengthSq(),0,1);return{t,d:p.distanceToSquared(a.clone().addScaledVector(ab,t))}};
        const upper=project(points[si],points[ei]),lower=project(points[ei],points[wi]);
        let shoulder=0,elbow=0,wrist=0;
        if(p.distanceTo(points[wi])<.09&&Math.abs(p.x)>.33&&p.y<1.02)wrist=1;
        else if(upper.d<lower.d){elbow=.5*THREE.MathUtils.smoothstep(upper.t,.55,1);shoulder=1-elbow}
        else{shoulder=.5*(1-THREE.MathUtils.smoothstep(lower.t,0,.35));wrist=THREE.MathUtils.smoothstep(lower.t,.64,1);elbow=1-shoulder-wrist}
        indices[i*4]=si;indices[i*4+1]=ei;indices[i*4+2]=wi;weights[i*4]=shoulder;weights[i*4+1]=Math.max(0,elbow);weights[i*4+2]=wrist;
        const sum=weights[i*4]+weights[i*4+1]+weights[i*4+2];for(let k=0;k<3;k++)weights[i*4+k]/=sum;
        continue;
      }
      const candidates=[];
      for(let j=0;j<bones.length;j++){
        const name=rigData[j].name;
        if(p.y>1.36 && !['head','neck'].includes(name))continue;
        if(isArm && !(name.startsWith(p.x<0?'r_':'l_')&&/shoulder|elbow|wrist/.test(name)))continue;
        if(p.y<.82 && !isArm && !(name.startsWith(p.x<0?'r_':'l_')&&/thigh|knee|ankle|foot/.test(name)) && name!=='hips')continue;
        if(p.y>=.82 && p.y<=1.36 && Math.abs(p.x)<.15 && /^[lr]_/.test(name))continue;
        if(p.y>.90 && Math.abs(p.x)>.18 && !name.startsWith(p.x<0?'r_':'l_'))continue;
        const child=rigData.findIndex(k=>k.parent===name && !k.name.includes('shoulder') && !k.name.includes('thigh'));
        const a=points[j],b=child>=0?points[child]:a;
        const ab=b.clone().sub(a);const t=ab.lengthSq()?THREE.MathUtils.clamp(p.clone().sub(a).dot(ab)/ab.lengthSq(),0,1):0;
        const d=p.distanceToSquared(a.clone().addScaledVector(ab,t));
        candidates.push({j,w:1/Math.pow(d+.001,2)});
      }
      candidates.sort((a,b)=>b.w-a.w);const top=candidates.slice(0,4);const sum=top.reduce((s,c)=>s+c.w,0);
      top.forEach((c,k)=>{indices[i*4+k]=c.j;weights[i*4+k]=c.w/sum});
    }
    geo.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(indices,4));
    geo.setAttribute('skinWeight',new THREE.Float32BufferAttribute(weights,4));
    const skinned=new THREE.SkinnedMesh(geo,mesh.material);skinned.name=mesh.name;
    skinned.position.copy(mesh.position);skinned.quaternion.copy(mesh.quaternion);skinned.scale.copy(mesh.scale);
    const parent=mesh.parent;parent.add(skinned);parent.remove(mesh);
    skinned.bind(skeleton);skinned.frustumCulled=false;
  }
  root.userData.bones=Object.fromEntries(bones.map(b=>[b.name,b]));
  let proxy;const clothes=[];root.traverse(o=>{if(o.name==='skin_body_collider'){proxy=o;o.visible=false}if(o.isSkinnedMesh&&o.name.startsWith('dress'))clothes.push(o)});
  root.userData.clothContact=new ClothContact(root,proxy,clothes);
}

// Animate the actual exported vertices. No fabricated animation objects.
export function prepareCharacter(root, kind) {
  if(kind==='girl')bindHuman(root);
  if(kind==='whale'){root.rotation.order='YZX';bindWhale(root)}
  const surfaces = [];
  const materialCache = new Map();
  const hairUniforms={uLongHairTime:{value:0},uLongHairFlow:{value:new THREE.Vector3()}};
  if(kind==='girl')root.userData.hairFlowUniforms=hairUniforms;
  const textureLoader=new THREE.TextureLoader();
  const skinPores=kind==='girl'?textureLoader.load('assets/usd/textures/skin_micro_height.png?v=42'):null;
  const fabric=kind==='girl'?textureLoader.load('assets/usd/textures/dress_weave_height.png?v=42'):null;
  if(fabric){fabric.wrapS=fabric.wrapT=THREE.RepeatWrapping;fabric.repeat.set(16,16);fabric.anisotropy=4}
  root.traverse(obj => {
    if (!obj.isMesh) return;
    obj.castShadow = true;
    obj.receiveShadow = true;
    const name = obj.name;
    obj.material.envMapIntensity = kind === 'whale' ? .7 : .45;
    if(kind==='whale'&&['whale','belly','pectoral','fluke','eye','barnacle','barnacle_core'].includes(obj.material.name)){
      const id=obj.material.name;
      if(materialCache.has(id))obj.material=materialCache.get(id);
      else{
        const material=new THREE.MeshPhysicalMaterial();
        THREE.MeshStandardMaterial.prototype.copy.call(material,obj.material);material.defines.PHYSICAL='';
        const shell=id.startsWith('barnacle');
        material.roughness=id==='eye'?.12:shell?.85:.82;
        material.clearcoat=id==='eye'?.7:shell?0:.22;
        material.clearcoatRoughness=id==='eye'?.08:.30;material.ior=1.37;
        material.envMapIntensity=id==='eye'?.7:shell?.25:.55;
        material.normalScale.set(.65,.65);
        obj.material=material;materialCache.set(id,material);
      }
    }
    if (obj.material.name === 'skin' && materialCache.has('skin')) obj.material=materialCache.get('skin');
    else if (obj.material.name === 'skin') {
      const material = new THREE.MeshPhysicalMaterial();
      THREE.MeshStandardMaterial.prototype.copy.call(material, obj.material);material.defines.PHYSICAL='';
      material.roughness = .53;
      material.bumpMap=skinPores;material.bumpScale=.000075;
      material.ior=1.4;material.specularIntensity=.45;
      material.clearcoat = 0;
      material.sheen = .12;
      material.sheenColor.setHex(0xaa6652);
      obj.material = material;
      root.userData.portraitUniforms=installPortraitSkin(material,{lipCenter:[0,1.3982,.12546],lipWidth:.0218,lipHeight:.0085});
      materialCache.set('skin',material);
    }
    if (obj.material.name === 'dress' && materialCache.has('dress')) obj.material=materialCache.get('dress');
    else if (obj.material.name === 'dress') {
      const material = new THREE.MeshPhysicalMaterial();
      THREE.MeshStandardMaterial.prototype.copy.call(material, obj.material);material.defines.PHYSICAL='';
      material.sheen = .48;
      material.bumpMap=fabric;material.bumpScale=.00032;material.roughness=.84;
      material.sheenRoughness = .8;
      material.sheenColor.setHex(0xc9d9d5);
      material.side = THREE.DoubleSide;
      const damage={value:0};installFabricDamage(material,damage);root.userData.fabricDamage=damage;
      obj.material = material;
      materialCache.set('dress',material);
    }
    if(['hair','fringe','haircap','hairfine','hairlinecap'].includes(obj.material.name)){
      const id=obj.material.name;
      if(materialCache.has(id))obj.material=materialCache.get(id);
      else{
        const mat=new THREE.MeshPhysicalMaterial();THREE.MeshStandardMaterial.prototype.copy.call(mat,obj.material);mat.defines.PHYSICAL='';
        mat.roughness=(id==='haircap'||id==='hairlinecap')?.52:id==='hairfine'?.70:.48;
        mat.anisotropy=.62;mat.anisotropyRotation=Math.PI/2;mat.ior=1.45;
        mat.specularIntensity=(id==='haircap'||id==='hairlinecap')?.65:id==='hairfine'?.04:.58;mat.envMapIntensity=.22;mat.specularColor.setRGB(.50,.42,.46);
        mat.bumpMap=null;mat.bumpScale=0;mat.side=THREE.DoubleSide;
        mat.transparent=false;mat.opacity=1;mat.depthWrite=true;mat.alphaToCoverage=id!=='haircap';
        mat.alphaTest=id==='hairlinecap'?.12:id==='haircap'?0:id==='hairfine'?0:.20;mat.alphaToCoverage=id==='hairlinecap'||id==='hair';
        installHairFlow(mat,hairUniforms);obj.material=mat;materialCache.set(id,mat);
      }
      if(obj.material.name==='hairlinecap'){
        obj.material.transparent=true;obj.material.depthWrite=false;
        obj.material.alphaTest=.012;obj.material.alphaToCoverage=false;
      }
      if(name==='hair_fringe'||name==='hair_fine_fringe'){
        const mat=obj.material.clone();mat.defines.PHYSICAL='';
        mat.specularIntensity=name==='hair_fringe'?.18:.012;
        mat.roughness=.62;mat.envMapIntensity=.08;mat.anisotropy=.30;
        installHairFlow(mat,hairUniforms);obj.material=mat;
      }
      if(name.includes('fringe_sweep')){
        const mat=obj.material.clone();mat.defines.PHYSICAL='';installHairFlow(mat,hairUniforms);
        mat.transparent=true;mat.opacity=name.includes('fine')?.70:.91;mat.depthWrite=false;mat.alphaTest=.012;
        const previous=mat.onBeforeCompile;
        mat.onBeforeCompile=shader=>{
          previous.call(mat,shader);
          shader.vertexShader='varying vec2 vTempleRootUv;\n'+shader.vertexShader;
          shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvTempleRootUv=uv;');
          shader.fragmentShader='varying vec2 vTempleRootUv;\n'+shader.fragmentShader;
          shader.fragmentShader=shader.fragmentShader.replace('#include <alphamap_fragment>','#include <alphamap_fragment>\ndiffuseColor.a*=smoothstep(.05,.34,vTempleRootUv.y);');
        };
        mat.customProgramCacheKey=()=> 'soft-temple-root-v25-'+(name.includes('fine')?'fine':'cards');
        obj.material=mat;
      }
      // Fine ribbons and cards rely on the underlying volume for shadows.
      // Their subpixel faces otherwise produce detached flecks on the scalp.
      if(obj.material.name!=='haircap')obj.castShadow=false;
      obj.receiveShadow=false;
    }
    if(['hair','fringe','brows','lashes'].includes(obj.material.name)){
      obj.material.side=THREE.DoubleSide;
      obj.material.alphaTest=['hair','fringe'].includes(obj.material.name)?.20:.25;
      obj.material.alphaToCoverage=true;
      obj.material.transparent=false;
      obj.material.depthWrite=true;
      if(obj.material.name==='brows'){obj.material.color.multiplyScalar(.92);obj.material.alphaTest=.18;}
      if(obj.material.name==='lashes'){obj.material.transparent=true;obj.material.opacity=.76;obj.material.alphaTest=.065;obj.material.alphaToCoverage=false;obj.material.depthWrite=false;obj.castShadow=false;}
      if(['hair','fringe'].includes(obj.material.name)){obj.material.transparent=true;obj.material.opacity=.94;obj.material.alphaTest=.04;obj.material.alphaToCoverage=false;obj.material.depthWrite=false;obj.castShadow=false;}
    }
    if(obj.material.name==='eyes'){
      const material=new THREE.MeshPhysicalMaterial();
      THREE.MeshStandardMaterial.prototype.copy.call(material,obj.material);material.defines.PHYSICAL='';
      material.roughness=.20;material.clearcoat=.45;material.clearcoatRoughness=.12;
      material.alphaTest=.04;material.alphaToCoverage=true;material.transparent=false;
      material.onBeforeCompile=shader=>{
        shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#ifdef USE_MAP
          vec2 eyeUv=vMapUv;vec2 c0=vec2(.702,.298),c1=vec2(.296,.720);vec2 irisCentre=distance(eyeUv,c0)<distance(eyeUv,c1)?c0:c1;
          float enlarge=1.-smoothstep(.13,.22,distance(eyeUv,irisCentre));eyeUv=mix(eyeUv,irisCentre+(eyeUv-irisCentre)*.97,enlarge);
          diffuseColor*=texture2D(map,eyeUv);
          #endif
          float iris=smoothstep(.015,.065,diffuseColor.r-diffuseColor.g)*(1.-smoothstep(.12,.27,diffuseColor.g));
          diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.50,.67,.58),iris*.98);`);
      };material.customProgramCacheKey=()=> 'dark-brown-reference-iris-v25';
      obj.material=material;
    }
    if (kind === 'girl' && /hair_fringe|hair_fine_fringe|hair_loose|hair_sideburn|hair_fine_sideburn|hair_ear_wisp|hair_crown_lift|^dress/.test(name)) {
      surfaces.push({ mesh: obj, rest: obj.geometry.attributes.position.array.slice(), restNormals:obj.geometry.attributes.normal.array.slice(), flex: /hair_ear_wisp|hair_crown_lift/.test(name)?Float32Array.from({length:obj.geometry.attributes.position.count},(_,i)=>THREE.MathUtils.smoothstep(obj.geometry.attributes.uv.getY(i),.20,1)**2):null, name });
      obj.geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);
    }
  });
  if (kind === 'girl') {
    const findMat = n => {
      let found;
      root.traverse(o => { if (o.isMesh && o.material.name === n) found = o.material; });
      return found;
    };
    const aura = new THREE.Mesh(new THREE.SphereGeometry(.9, 20, 12),
      new THREE.MeshBasicMaterial({color:0x86bac4,transparent:true,opacity:0,depthWrite:false}));
    aura.visible = false;
    root.add(aura);
    root.userData.hairMat = findMat('hair');
    const hairMaterials=[];
    root.traverse(o=>{if(o.isMesh&&['hair','fringe','haircap','hairfine','hairlinecap'].includes(o.material.name)&&!hairMaterials.includes(o.material))hairMaterials.push(o.material)});
    root.userData.hairMaterials=hairMaterials;
    root.userData.dressMat = findMat('dress');
    root.userData.aura = aura;
  }
  if(kind==='girl'){root.userData.sleepCloth=new SleepCloth(root);root.userData.motionGarment=new MotionGarment(root);}
  root.userData.surfaces = surfaces;
  root.userData.kind = kind;
  return root;
}

export function animateCharacter(root, time, motion={}) {
  if(root.userData.whaleRig)poseWhale(root,time,motion);
  const bones=root.userData.bones;
  if(bones){
    poseSwimmer(root,time,motion);if(root.userData.kind==='girl')applyCombatPose(root);
  }
  if(root.userData.kind!=='girl')return;
  if(root.userData.portraitUniforms)root.userData.portraitUniforms.uPortraitTime.value=time;
  const previous=root.userData.secondaryMotion;
  const now=motion.sampleTime??time,dt=previous?THREE.MathUtils.clamp(now-previous.time,0,.05):1/60;
  const secondary=previous||{time:now,flow:new THREE.Vector3(),speed:new THREE.Vector3()};secondary.time=now;root.userData.secondaryMotion=secondary;
  const inverse=new THREE.Quaternion();bones.head.getWorldQuaternion(inverse).invert();
  const waterVelocity=(motion.velocity||new THREE.Vector3()).clone().applyQuaternion(inverse);
  const acceleration=(motion.acceleration||new THREE.Vector3()).clone().applyQuaternion(inverse);
  const target=waterVelocity.multiplyScalar(-.021).addScaledVector(acceleration,-.0035).clampLength(0,.072);
  // Damped spring leaves a visible lag after turns, with bounded displacement.
  const substeps=Math.max(1,Math.ceil(dt/.016));const step=dt/substeps;
  for(let i=0;i<substeps;i++){
   secondary.speed.addScaledVector(target.clone().sub(secondary.flow).multiplyScalar(38).addScaledVector(secondary.speed,-7.5),step);
   secondary.flow.addScaledVector(secondary.speed,step).clampLength(0,.085);
  }
  const hairFlow=root.userData.hairFlowUniforms;if(hairFlow){hairFlow.uLongHairTime.value=time;hairFlow.uLongHairFlow.value.copy(secondary.flow)}
  let hairTravel=0,fringeTravel=0,sideTravel=0,clothTravel=0,crownTravel=0,earWispTravel=0;
  for (const {mesh,rest,restNormals,flex,name} of root.userData.surfaces || []) {
    const position=mesh.geometry.attributes.position,normal=mesh.geometry.attributes.normal,data=position.array,normals=normal.array;
    for (let i=0;i<data.length;i+=3){
      const x=rest[i],y=rest[i+1],z=rest[i+2];let px=x,py=y,pz=z;
      if(/hair_ear_wisp|hair_crown_lift/.test(name)){
       const w=flex[i/3],crown=name.startsWith('hair_crown_lift');
       const phase=x*29+z*19;
       px+=(Math.sin(time*1.14+phase)*(crown?.0028:.008)+secondary.flow.x*(crown?.05:.20))*w;
       py+=Math.sin(time*.93+phase)*(crown?.0015:.003)*w;
       pz+=(Math.cos(time*1.03+phase)*(crown?.0032:.009)+secondary.flow.z*(crown?.06:.22))*w;
       const travel=Math.hypot(px-x,py-y,pz-z);if(crown)crownTravel=Math.max(crownTravel,travel);else earWispTravel=Math.max(earWispTravel,travel);
      }else if(name.startsWith('hair_ponytail')){
       const w=THREE.MathUtils.smoothstep(1.435-y,0,.11),ax=(Math.sin(time*1.65+y*9)*.30+secondary.flow.z*6)*w;
       const az=(Math.sin(time*1.35+z*11)*.34+secondary.flow.x*8)*w;
       const cx=Math.cos(ax),sx=Math.sin(ax),cz=Math.cos(az),sz=Math.sin(az),oy=y-1.429,oz=z+.067;
       const yy=oy*cx-oz*sx,zz=oy*sx+oz*cx;
       px=x*cz-yy*sz;py=1.429+x*sz+yy*cz;pz=-.067+zz;
       const nx=restNormals[i],ny=restNormals[i+1]*cx-restNormals[i+2]*sx,nz=restNormals[i+1]*sx+restNormals[i+2]*cx;
       normals[i]=nx*cz-ny*sz;normals[i+1]=nx*sz+ny*cz;normals[i+2]=nz;
       hairTravel=Math.max(hairTravel,Math.hypot(px-x,py-y,pz-z));
      }else if(name==='hair_fringe'||name==='hair_fine_fringe'){
       const w=THREE.MathUtils.smoothstep(1.515-y,0,.074);
       px+=(Math.sin(time*1.7+y*15)*.008+secondary.flow.x*.18)*w;
       py+=Math.sin(time*1.2+x*17)*.003*w;
       pz+=(Math.sin(time*1.4+x*12)*.007+secondary.flow.z*.20)*w;
       fringeTravel=Math.max(fringeTravel,Math.hypot(px-x,py-y,pz-z));
      }else if(name.startsWith('hair_')){
       const w=THREE.MathUtils.smoothstep(1.50-y,0,.13);
       px+=(Math.sin(time*1.6+y*14)*.006+secondary.flow.x*.18)*w;
       py+=Math.sin(time*1.3+x*20)*.002*w;
       pz+=(Math.sin(time*1.4+x*15)*.007+secondary.flow.z*.22)*w;
       sideTravel=Math.max(sideTravel,Math.hypot(px-x,py-y,pz-z));
      }else{
       const w=THREE.MathUtils.clamp((1.045-y)/.52,0,1);
       const flex=THREE.MathUtils.smoothstep(Math.max(Math.abs(bones.l_thigh.quaternion.x),Math.abs(bones.r_thigh.quaternion.x)),.12,.45);
       const clearance=THREE.MathUtils.smoothstep(.97-y,.02,.16)*flex;
       px*=1+clearance*.18;pz=.025+(pz-.025)*(1+clearance*.18);
       px+=(Math.sin(time*1.5+z*14)*.041+secondary.flow.x*.90)*w;
       py+=Math.sin(time*1.4+x*12)*.032*w*w;
       pz+=(Math.sin(time*1.25+x*10)*.052+secondary.flow.z*.90)*w;
       pz+=Math.sin(time*2.1+Math.atan2(x,z-.025)*5)*.012*w*w;
       clothTravel=Math.max(clothTravel,Math.hypot(px-x,py-y,pz-z));
      }
      data[i]=px;data[i+1]=py;data[i+2]=pz;
    }
    position.needsUpdate=true;if(name.startsWith('hair_ponytail'))normal.needsUpdate=true;
  }
  const movingCover=root.userData.motionGarment?.update(time,!!root.userData.swimPPO?.active);
  const sleepCover=movingCover?false:root.userData.sleepCloth?.update(time,root.userData.sleepBlend||0);
  const contact=root.userData.clothContact;if(contact){if(sleepCover||movingCover){const clothes=contact.clothes;try{contact.clothes=clothes.filter(m=>m.name.startsWith('dress_strap'));contact.update(dt);}finally{contact.clothes=clothes;}root.userData.clothContactStats={mode:movingCover?'pose-fitted-swim':'pose-fitted-sleep',...(movingCover?root.userData.motionGarment.status:root.userData.sleepCloth.lastStats)};}else contact.update(dt);}
  root.userData.secondaryMotionStats={hairTravel,longHairTipEnvelope:.032+secondary.flow.length()*1.8,fringeTravel,sideTravel,clothTravel,crownTravel,earWispTravel,flow:secondary.flow.toArray()};
}
