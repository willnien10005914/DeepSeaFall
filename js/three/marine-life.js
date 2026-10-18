import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

const loader = new THREE.TextureLoader();
function texture(file,color=false){const t=loader.load('assets/marine/'+file+'?v=50');if(color)t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t}
const maps={albedo:texture('fish-albedo.jpg',true),normal:texture('fish-normal.png'),rough:texture('fish-roughness.png'),fin:texture('fin-membrane.png',true)};
const clamp=THREE.MathUtils.clamp;

function grid(rows,cols,fn){
  const p=[],uv=[],faces=[];
  for(let i=0;i<=rows;i++)for(let j=0;j<=cols;j++){p.push(...fn(i/rows,j/cols));uv.push(i/rows,j/cols)}
  for(let i=0;i<rows;i++)for(let j=0;j<cols;j++){const a=i*(cols+1)+j,b=a+cols+1;faces.push(a,b,a+1,a+1,b,b+1)}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(faces);g.computeVertexNormals();return g;
}
function membrane(points){
  const p=[],uv=[];const centre=points.reduce((a,b)=>a.add(new THREE.Vector3(...b)),new THREE.Vector3()).multiplyScalar(1/points.length);
  for(let i=0;i<points.length;i++){
    p.push(...centre.toArray(),...points[i],...points[(i+1)%points.length]);
    uv.push(.5,.1,i/points.length,1,(i+1)/points.length,1);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.computeVertexNormals();return g;
}

const fishBody=grid(44,32,(s,t)=>{
  const x=-.42+s*.84,a=t*Math.PI*2;
  const profile=Math.pow(Math.sin(Math.PI*s),.66);
  const h=.136*profile*(.74+.34*s),w=.081*profile;
  return [x,h*Math.sin(a),w*Math.cos(a)];
});
const fins=[];
fins.push(membrane([[-.39,.009,0],[-.67,.18,0],[-.60,.062,0],[-.52,0,0],[-.60,-.062,0],[-.67,-.18,0],[-.39,-.009,0]]));
fins.push(membrane([[.12,.124,0],[-.04,.238,0],[-.18,.177,0],[-.26,.079,0],[-.13,.112,0]]));
fins.push(membrane([[.01,-.134,0],[-.11,-.204,0],[-.24,-.073,0]]));
for(const side of [-1,1])fins.push(membrane([[.18,-.02,side*.074],[.02,-.092,side*.22],[-.04,-.061,side*.13],[.12,-.038,side*.079]]));
const fishFins=mergeGeometries(fins);fins.forEach(g=>g.dispose());
const eyes=[];
for(const side of [-1,1]){const g=new THREE.SphereGeometry(.018,12,8);g.scale(1,.85,.46);g.translate(.286,.032,side*.061);eyes.push(g)}
const fishEyes=mergeGeometries(eyes);eyes.forEach(g=>g.dispose());
const gills=[];
for(const side of [-1,1]){
  const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(.21,.088,side*.042),new THREE.Vector3(.177,.044,side*.069),new THREE.Vector3(.185,-.034,side*.072),new THREE.Vector3(.24,-.086,side*.045)]);
  gills.push(new THREE.TubeGeometry(curve,18,.0015,4,false));
}
const fishGills=mergeGeometries(gills);gills.forEach(g=>g.dispose());
const bend=`
uniform float uCreatureTime;uniform float uCreaturePhase;uniform float uCreatureSpeed;
float fishBend(float x){float w=clamp((.12-x)/.65,0.,1.);return sin(uCreatureTime*(5.8+uCreatureSpeed*.8)+x*6.5+uCreaturePhase)*.055*w*w;}
`;
function fishShader(material,uniforms){
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,uniforms);shader.vertexShader=bend+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.z+=fishBend(position.x);');
    shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\nfloat slope=(fishBend(position.x+.002)-fishBend(position.x-.002))/.004;objectNormal.x-=slope*objectNormal.z;objectNormal=normalize(objectNormal);');
  };material.customProgramCacheKey=()=> 'anatomical-fish-bend-v6';
}

export function makeRealFish(color=0xabb8bf,scale=1){
  const root=new THREE.Group();root.name='Silver reef fish';
  const uniforms={uCreatureTime:{value:0},uCreaturePhase:{value:Math.random()*Math.PI*2},uCreatureSpeed:{value:.6}};
  const body=new THREE.MeshPhysicalMaterial({map:maps.albedo,normalMap:maps.normal,roughnessMap:maps.rough,
    color:new THREE.Color(color).lerp(new THREE.Color(0xc5d0d2),.7),roughness:.46,metalness:.28,clearcoat:.32,clearcoatRoughness:.3,envMapIntensity:.7});
  body.normalScale.set(.38,.38);body.name='Silver scales';
  const fin=new THREE.MeshPhysicalMaterial({map:maps.fin,transparent:true,opacity:.80,alphaTest:.04,
    color:0xd9dfdf,roughness:.5,side:THREE.DoubleSide,depthWrite:false,clearcoat:.18});fin.name='Ray-supported fin membrane';
  const eye=new THREE.MeshPhysicalMaterial({color:0x080f12,roughness:.13,clearcoat:.65,clearcoatRoughness:.07});
  const gill=new THREE.MeshStandardMaterial({color:0x596c73,roughness:.65});
  for(const [name,geometry,material] of [['body',fishBody,body],['fins',fishFins,fin],['eyes',fishEyes,eye],['gill covers',fishGills,gill]]){
    fishShader(material,uniforms);const m=new THREE.Mesh(geometry,material);m.name=name;m.castShadow=name==='body';m.receiveShadow=true;root.add(m);
  }
  root.scale.setScalar(scale);root.userData.marine={kind:'fish',uniforms};return root;
}

const bell=grid(32,72,(s,t)=>{
  const a=t*Math.PI*2,r=.28*s*(1+Math.pow(s,7)*.025*Math.cos(a*16));
  return [r*Math.cos(a),.225*Math.sqrt(Math.max(0,1-s*s))-.025-.018*Math.pow(s,6)*Math.cos(a*8),r*Math.sin(a)];
});
for(let i=0;i<bell.index.count;i+=3){const a=bell.index.getX(i+1);bell.index.setX(i+1,bell.index.getX(i+2));bell.index.setX(i+2,a)}bell.computeVertexNormals();
// Tube and ribbon geometry has actual thickness and curvature, not rigid rods.
const threads=[];
for(let i=0;i<36;i++){
  const a=i*Math.PI*2/36,length=.56+(i%5)*.10,points=[];
  for(let j=0;j<=24;j++){const d=j/24;points.push(new THREE.Vector3(.25*Math.cos(a)+Math.sin(d*12+i)*.045*d,-.025-length*d,.25*Math.sin(a)+Math.cos(d*10+i)*.038*d))}
  threads.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),32,.0010+(i%3)*.00025,4,false));
}
const tentacles=mergeGeometries(threads);threads.forEach(g=>g.dispose());
const arms=[];
for(let i=0;i<4;i++){
  const a=i*Math.PI/2;
  arms.push(grid(36,6,(s,t)=>{
    const width=.027*(1-s*.7)*(t-.5)*2,fold=Math.sin(s*30+t*5)*.014*(1-s*.4),r=.04+Math.sin(s*4+i)*.025;
    return [(r+width)*Math.cos(a)+fold*Math.sin(a),-.04-s*.64,(r+width)*Math.sin(a)-fold*Math.cos(a)];
  }));
}
const oralArms=mergeGeometries(arms);arms.forEach(g=>g.dispose());
const gonads=[];
for(let i=0;i<4;i++){const a=i*Math.PI/2,g=new THREE.TorusGeometry(.049,.009,6,24);g.rotateX(Math.PI/2);g.translate(.063*Math.cos(a),.16,.063*Math.sin(a));gonads.push(g)}
const inner=mergeGeometries(gonads);gonads.forEach(g=>g.dispose());
function jellyShader(material,uniforms){
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,uniforms);
    shader.vertexShader='uniform float uCreatureTime;uniform float uCreaturePhase;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      float phase=uCreatureTime*2.15+uCreaturePhase;float pulse=sin(phase)+.18*sin(phase*2.);float d=max(0.,-position.y-.025);
      float rim=exp(-d*5.);transformed.xz*=1.-pulse*.10*rim;
      if(position.y>-.04)transformed.y=(position.y+.025)*(1.+pulse*.12)-.025;
      transformed.x+=sin(uCreatureTime*1.25+d*6.+uCreaturePhase)*d*.15;
      transformed.z+=cos(uCreatureTime*1.10+d*5.+uCreaturePhase)*d*.13;`);
  };material.customProgramCacheKey=()=> 'gelatin-bell-tentacle-v6';
}
export function makeRealJelly(){
  const root=new THREE.Group();root.name='Moon jellyfish';
  const uniforms={uCreatureTime:{value:0},uCreaturePhase:{value:Math.random()*Math.PI*2}};
  const membrane=new THREE.MeshPhysicalMaterial({color:0xd2e5e4,transparent:true,opacity:.66,roughness:.12,transmission:.72,thickness:.055,attenuationColor:0x8fbcc0,attenuationDistance:.8,
    side:THREE.DoubleSide,depthWrite:false,clearcoat:.65,clearcoatRoughness:.15,ior:1.33,envMapIntensity:.65});membrane.name='Translucent jelly mesoglea';
  const threads=new THREE.MeshPhysicalMaterial({color:0xb3c6ca,transparent:true,opacity:.44,roughness:.3,depthWrite:false,side:THREE.DoubleSide});
  const organ=new THREE.MeshStandardMaterial({color:0xc4a9bc,transparent:true,opacity:.57,roughness:.6,depthWrite:false});
  for(const [name,geometry,mat] of [['Pulsing bell',bell,membrane],['Trailing tentacles',tentacles,threads],['Folded oral arms',oralArms,threads],['Four internal gonads',inner,organ]]){
    jellyShader(mat,uniforms);const m=new THREE.Mesh(geometry,mat);m.name=name;root.add(m);
  }
  const canals=[];
  for(let i=0;i<24;i++){
    const a=i*Math.PI*2/24,pts=[];
    for(let j=0;j<=20;j++){const r=.018+j/20*.25;pts.push(new THREE.Vector3(r*Math.cos(a),.225*Math.sqrt(Math.max(0,1-(r/.28)**2))-.032,r*Math.sin(a)))}
    canals.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),20,.00045,4,false));
  }
  const canalGeo=mergeGeometries(canals);canals.forEach(g=>g.dispose());
  const canalMat=new THREE.MeshPhysicalMaterial({color:0xa8c2c8,transparent:true,opacity:.23,roughness:.24,depthWrite:false});
  const radial=new THREE.Mesh(canalGeo,canalMat);radial.name='Radial gastrovascular canals';jellyShader(canalMat,uniforms);root.add(radial);
  const innerBell=new THREE.Mesh(bell,new THREE.MeshPhysicalMaterial({color:0xb0bdcf,transparent:true,opacity:.12,roughness:.28,side:THREE.BackSide,depthWrite:false}));
  innerBell.scale.set(.94,.91,.94);innerBell.name='Inner subumbrellar cavity';jellyShader(innerBell.material,uniforms);root.add(innerBell);
  root.userData.marine={kind:'jelly',uniforms};return root;
}

export function animateMarine(root,time,speed=.6){
  const m=root.userData.marine;if(!m)return;
  m.uniforms.uCreatureTime.value=time;
  if(m.uniforms.uCreatureSpeed)m.uniforms.uCreatureSpeed.value=Math.min(Math.abs(speed),2);
  if(m.kind==='jelly')root.rotation.y=Math.sin(time*.17+m.uniforms.uCreaturePhase.value)*.13;
}

export function makeMarineHabitat(parent){
  const group=new THREE.Group();group.name='Reef shoal and drifting jellyfish';parent.add(group);
  const fish=[];
  for(let i=0;i<12;i++){
    const f=makeRealFish(0x9caeb6,.48+(i%4)*.065);
    f.userData.marine.uniforms.uCreaturePhase.value=i*.43;
    f.userData.slot={x:(i%4)*.65+Math.sin(i*3.71)*.16,y:Math.floor(i/4)*.32+Math.sin(i*5.17)*.17,z:(i%3)*.42+Math.cos(i*3.31)*.16};group.add(f);fish.push(f);
  }
  const deepFish=[];
  for(let i=0;i<8;i++){const f=makeDeepSeaFish(['lanternfish','hatchetfish','anglerfish'][i%3]);group.add(f);deepFish.push(f)}
  const jellies=[];
  for(let i=0;i<3;i++){const j=makeRealJelly();j.scale.setScalar(.85+i*.12);group.add(j);jellies.push(j)}
  return {group,fish,jellies,deepFish,update(t,depth=0){
    deepFish.forEach((f,i)=>{const phase=t*(.08+(i%3)*.015)+i*1.91;f.position.set(Math.sin(phase)*(3.4+i*.23),-2+(i%4)*1.25+Math.sin(t*.3+i)*.18,-5.2-(i%3)*1.55);f.rotation.y=Math.cos(phase)>0?-.12:Math.PI+.12;f.rotation.z=Math.sin(t*.26+i)*.035;animateMarine(f,t,.35);f.userData.marine.uniforms.uCreatureSpeed.value=.35;});
    const x=5.5*Math.sin(t*.085),direction=Math.atan2(Math.sin(t*.085)*.16,Math.cos(t*.085));
    fish.forEach((f,i)=>{const s=f.userData.slot;f.position.set(x+s.x-1.5,-1.0+s.y+Math.sin(t*.35+i*.6)*.09,-8.5-s.z);f.rotation.y=direction+Math.sin(t*.25+i*.3)*.04;animateMarine(f,t,.5)});
    jellies.forEach((j,i)=>{j.position.set((i-1)*4.2,-3.4+i*2.5+Math.sin(t*.42+i)*.28,-5.5-i*3.2);animateMarine(j,t)});
  }};
}

// Distinct anatomical meshes. These are authored real-time interpretations,
// with actual eyes, fin membranes, gill folds and small photophore organs.
export function makeDeepSeaFish(species='lanternfish'){
 const root=new THREE.Group();root.name=species;
 const uniforms={uCreatureTime:{value:0},uCreaturePhase:{value:Math.random()*6.28},uCreatureSpeed:{value:.45}};
 const hatchet=species==='hatchetfish',angler=species==='anglerfish';
 const geo=grid(48,40,(s,t)=>{const a=t*Math.PI*2,profile=angler?.04+.96*(s<.64?Math.pow(Math.sin(s/.64*Math.PI/2),1.7):Math.sqrt(Math.max(0,1-Math.pow((s-.64)/.46,2)))):Math.pow(Math.sin(Math.PI*s),.72),x=angler?-.55+s*.88:-.48+s*.92;
  const belly=hatchet?.24*(.4+.6*s):angler?.31:.105;
  const y=belly*profile*Math.sin(a)-(hatchet?.05*profile:0),z=(hatchet?.043:angler?.24:.065)*profile*Math.cos(a);return[x,y,z]});
 const bodyMat=new THREE.MeshPhysicalMaterial({map:angler?null:maps.albedo,normalMap:maps.normal,roughnessMap:angler?null:maps.rough,color:angler?0x39383b:hatchet?0x9fadb5:0x697b87,roughness:angler?.74:.35,metalness:angler?.01:.42,clearcoat:angler?.08:.38,clearcoatRoughness:.22});bodyMat.normalScale.set(.25,.25);
 const body=new THREE.Mesh(geo,bodyMat);body.name='Sculpted '+species+' body';fishShader(bodyMat,uniforms);root.add(body);
 const finMat=new THREE.MeshPhysicalMaterial({map:maps.fin,color:0xb3bdc1,transparent:true,opacity:.74,roughness:.44,side:THREE.DoubleSide,depthWrite:false});fishShader(finMat,uniforms);
 const tail=new THREE.Mesh(membrane([[-.42,.025,0],[-.66,.15,0],[-.58,0,0],[-.66,-.15,0],[-.42,-.025,0]]),finMat);root.add(tail);
 const dorsal=new THREE.Mesh(membrane([[-.31,.05,0],[-.22,.21,0],[.03,hatchet?.27:.21,0],[.17,.10,0]]),finMat);root.add(dorsal);
 const eyeMat=new THREE.MeshPhysicalMaterial({color:0x050a0c,roughness:.08,clearcoat:1,clearcoatRoughness:.03});
 for(const side of [-1,1]){
  const eye=new THREE.Mesh(new THREE.SphereGeometry(angler?.027:hatchet?.037:.03,20,14),eyeMat);eye.scale.z=.48;eye.position.set(.265,hatchet?.10:.055,side*(hatchet?.043:angler?.20:.052));root.add(eye);
  const fin=new THREE.Mesh(membrane([[.16,-.035,side*.04],[.01,-.13,side*.20],[-.10,-.08,side*.13]]),finMat);root.add(fin);
  const points=[new THREE.Vector3(.20,.10,side*.04),new THREE.Vector3(.14,0,side*(angler?.14:.07)),new THREE.Vector3(.20,-.10,side*.04)];
  root.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),20,.002,5,false),new THREE.MeshStandardMaterial({color:0x26373b,roughness:.6})));
 }
 const glowMat=new THREE.MeshStandardMaterial({color:0x9cdee1,emissive:0x49b6c5,emissiveIntensity:.65,roughness:.24});
 if(!angler){for(let i=0;i<11;i++)for(const side of [-1,1]){const x=-.29+i*.049,ph=new THREE.Mesh(new THREE.SphereGeometry(.0048,8,6),glowMat);ph.position.set(x,hatchet?-.14:-.061,side*(hatchet?.025:.045));root.add(ph)}}
 else{
  const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(.13,.17,0),new THREE.Vector3(.12,.40,0),new THREE.Vector3(.35,.43,0),new THREE.Vector3(.43,.29,0)]);
  const lure=new THREE.Mesh(new THREE.TubeGeometry(curve,32,.005,6,false),bodyMat);root.add(lure);
  const bulb=new THREE.Mesh(new THREE.SphereGeometry(.021,16,10),glowMat);bulb.position.set(.43,.29,0);root.add(bulb);
  const mouth=new THREE.Mesh(new THREE.SphereGeometry(.19,32,24),new THREE.MeshStandardMaterial({color:0x080c10,roughness:.8}));mouth.scale.set(.13,1,.75);mouth.position.set(.329,-.018,0);root.add(mouth);
  const rimPoints=[];for(let i=0;i<=64;i++){const a=i/64*Math.PI*2;rimPoints.push(new THREE.Vector3(.346,-.018+Math.sin(a)*.195,Math.cos(a)*.150))}
  root.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rimPoints),64,.011,8,false),new THREE.MeshStandardMaterial({color:0x65565b,roughness:.82})));
  const toothMat=new THREE.MeshStandardMaterial({color:0xc3b9a0,roughness:.58});
  for(let i=0;i<19;i++){const a=i/19*Math.PI*2,len=.026+(i%4)*.006,dir=new THREE.Vector3(0,-Math.sin(a),-Math.cos(a)).normalize();const tooth=new THREE.Mesh(new THREE.ConeGeometry(.0032,len,7),toothMat);tooth.position.set(.352,-.018+Math.sin(a)*(.185-len*.4),Math.cos(a)*(.14-len*.4));tooth.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir);root.add(tooth)}
 }
 fishShader(glowMat,uniforms);root.userData.marine={kind:'fish',species,uniforms};root.scale.setScalar(angler?.76:hatchet?.85:.7);return root;
}
