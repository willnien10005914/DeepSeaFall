import {descentTravel,movingSlice} from './descent-motion.js?v=42';
import * as THREE from 'three';
import {makeLargeShoal} from './large-shoal.js?v=42';
import {makeMarineHabitat} from './marine-life.js?v=42';
import {mergeVertices,mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

function hash(x,y,z){const n=Math.sin(x*127.1+y*311.7+z*74.7)*43758.5453;return n-Math.floor(n)}
const fade=t=>t*t*t*(t*(t*6-15)+10);
function noise(x,y,z){
 const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z),a=fade(x-ix),b=fade(y-iy),c=fade(z-iz);
 const mix=(u,v,t)=>u+(v-u)*t;
 return mix(mix(mix(hash(ix,iy,iz),hash(ix+1,iy,iz),a),mix(hash(ix,iy+1,iz),hash(ix+1,iy+1,iz),a),b),
 mix(mix(hash(ix,iy,iz+1),hash(ix+1,iy,iz+1),a),mix(hash(ix,iy+1,iz+1),hash(ix+1,iy+1,iz+1),a),b),c);
}
function fbm(x,y,z){let f=0,a=.55;for(let i=0;i<4;i++){f+=noise(x,y,z)*a;x=x*2.07+13.1;y=y*2.03-7.2;z=z*2.11+5.8;a*=.48}return f}

function rockMaterial(textures){
 const m=new THREE.MeshStandardMaterial({map:textures.albedo,roughnessMap:textures.roughness,color:0x89939c,roughness:.97});
 m.name='Scanned rock / triplanar PBR';
 m.onBeforeCompile=shader=>{
  shader.uniforms.uRockHeight={value:textures.height};shader.uniforms.uRockNormal={value:textures.normal};shader.uniforms.uRockRough={value:textures.roughness};
  shader.vertexShader='attribute vec3 rockCoord; varying vec3 vRockCoord; varying vec3 vRockNormal;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvRockCoord=rockCoord;vRockNormal=normalize(mat3(modelMatrix)*normal);');
  shader.fragmentShader='varying vec3 vRockCoord;varying vec3 vRockNormal;uniform sampler2D uRockNormal;uniform sampler2D uRockRough;uniform sampler2D uRockHeight;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
   vec3 rw=pow(abs(normalize(vRockNormal)),vec3(5.));rw/=max(dot(rw,vec3(1.)),.0001);
   vec3 rc=vRockCoord*.625;
   vec3 scan=texture2D(map,rc.yz).rgb*rw.x+texture2D(map,rc.xz).rgb*rw.y+texture2D(map,rc.xy).rgb*rw.z;
   float weather=.87+.13*sin(vRockCoord.x*.57+vRockCoord.y*.37+sin(vRockCoord.z*.4));
   float h=texture2D(uRockHeight,rc.yz).r*rw.x+texture2D(uRockHeight,rc.xz).r*rw.y+texture2D(uRockHeight,rc.xy).r*rw.z;
   diffuseColor.rgb*=scan*weather*mix(.76,1.04,smoothstep(.12,.74,h));
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`
   float rr=texture2D(uRockRough,rc.yz).r*rw.x+texture2D(uRockRough,rc.xz).r*rw.y+texture2D(uRockRough,rc.xy).r*rw.z;
   float roughnessFactor=roughness*mix(.74,1.,rr);
  `);
  shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`
   vec3 rn=normalize(vRockNormal);
   vec3 nx=texture2D(uRockNormal,rc.yz).xyz*2.-1.;
   vec3 ny=texture2D(uRockNormal,rc.xz).xyz*2.-1.;
   vec3 nz=texture2D(uRockNormal,rc.xy).xyz*2.-1.;
   vec3 detail=vec3(nx.z*sign(rn.x),nx.x,nx.y)*rw.x+vec3(ny.x,ny.z*sign(rn.y),ny.y)*rw.y+vec3(nz.x,nz.y,nz.z*sign(rn.z))*rw.z;
   normal=normalize(mat3(viewMatrix)*normalize(mix(rn,detail,.68)));
  `);
 };
 m.customProgramCacheKey=()=> 'scanned-rock-triplanar-v6';return m;
}

function coordinates(geometry,seed=0){
 const p=geometry.attributes.position;const a=new Float32Array(p.count*3);
 for(let i=0;i<p.count;i++){a[i*3]=p.getX(i)+seed*5.17;a[i*3+1]=p.getY(i);a[i*3+2]=p.getZ(i)+seed*2.31}
 geometry.setAttribute('rockCoord',new THREE.BufferAttribute(a,3));geometry.computeVertexNormals();return geometry;
}
function boulder(seed,size,detail){
 const raw=new THREE.IcosahedronGeometry(1,detail);
 raw.deleteAttribute('uv');
 const geometry=mergeVertices(raw,.0001);raw.dispose();
 geometry.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(geometry.attributes.position.count*2),2));
 const p=geometry.attributes.position;
 for(let i=0;i<p.count;i++){
  const x=p.getX(i),y=p.getY(i),z=p.getZ(i);
  const warp=fbm(x*1.8+seed,y*1.7,z*1.6);
  const fractures=Math.abs(noise(x*5.6+seed,y*5.1,z*5.4)-.5);
  const angular=.60+.40/Math.max(Math.abs(x),Math.abs(y),Math.abs(z));
  const stratum=Math.tanh(Math.sin(y*11.5+noise(x*2+seed,0,z*2)*1.8)*4)*.052;
  const crack=Math.exp(-Math.abs(x*.91+z*.35-.16)*34)*.07;
  const r=(.74+.32*warp+.24*fractures+stratum-crack)*angular;
  p.setXYZ(i,x*r*size[0],y*r*size[1],z*r*size[2]);
 }
 return coordinates(geometry,seed);
}
function wall(side,seed){
 const rows=152,cols=96,positions=[],indices=[];
 for(let i=0;i<=rows;i++)for(let j=0;j<=cols;j++){
  const y=-24+i/rows*48,z=-38+j/cols*46,angle=y/48*Math.PI*2;
  const warp=noise(Math.sin(angle)*1.8,Math.cos(angle)*1.8,z*.16+seed)*2.8;
  const relief=(fbm(Math.sin(angle)*2.2+warp,Math.cos(angle)*2.2,z*.23+seed)-.5)*5.2;
  const fissure=Math.abs(noise(Math.sin(angle)*7.4,Math.cos(angle)*7.4,z*.56+seed)-.5)*.65;
  const strata=Math.tanh(Math.sin(angle*11+noise(0,0,z*.23+seed)*1.8)*5)*.45;
  const cut=Math.exp(-Math.abs(Math.sin(angle*4+z*.19+seed))*24)*.32;
  positions.push(side*(7.2+relief*1.10+fissure+strata+cut+z*.018),y,z);
 }
 for(let i=0;i<rows;i++)for(let j=0;j<cols;j++){
  const a=i*(cols+1)+j,b=a+cols+1;
  if(side<0)indices.push(a,b,a+1,b,b+1,a+1);else indices.push(a,a+1,b,b,a+1,b+1);
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);
 // UV exists for Three's standard map defines; the rock shader samples triplanar coordinates.
 geometry.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(positions.length/3*2),2));
 return coordinates(geometry,seed);
}

export function makeOcean(scene){
 const group=new THREE.Group();group.name='Three dimensional ocean canyon';scene.add(group);
 const textures=getRockTextures();
 const material=rockMaterial(textures),terrain=new THREE.Group();terrain.name='Fractured canyon walls';group.add(terrain);
 const walls=[];
 for(const side of [-1,1]){
  const geometry=wall(side,side<0?4:9);
  for(let tile=0;tile<2;tile++){
   const mesh=new THREE.Mesh(geometry,material);mesh.name='continuous_cliff_'+side+'_'+tile;mesh.position.y=-tile*48;mesh.userData.tile=tile;mesh.castShadow=true;mesh.receiveShadow=true;terrain.add(mesh);walls.push(mesh);
  }
 }
 const rocks=[];
 for(const side of [-1,1])for(let i=0;i<20;i++){
  const seed=i+31+(side>0?20:0),foreground=i<5;
  const size=foreground?[1.9+hash(i,side,0),2.1+hash(i,2,0)*2.7,2.0]:[2.5+hash(i,7,0)*1.6,3.0+hash(i,3,0)*3.9,2.6];
  const mesh=new THREE.Mesh(boulder(seed,size,foreground?10:6),material);
  mesh.name='weathered_boulder_'+seed;mesh.castShadow=true;mesh.receiveShadow=true;
  const z=foreground?2.5-i*3.6:-12-(i-5)%5*4.8;
  mesh.position.set(side*(foreground?6.0+hash(i,4,0)*1.5:10.5+hash(i,9,0)*4),-13+hash(i,side,5)*35,z);
  mesh.rotation.set(hash(i,1,8)*.35,seed*1.738,hash(i,2,8)*.24);
  mesh.userData.restY=mesh.position.y;terrain.add(mesh);rocks.push(mesh);
 }
 // The near silhouettes are real rounded, fractured meshes, with room for both subjects.
 const foregroundRocks=[];
 for(const side of [-1,1]){
  const mesh=new THREE.Mesh(boulder(side+81,[2.4,2.9,2.8],12),material);
  mesh.position.set(side*4.5,-6.2,-.5);mesh.rotation.y=side*.75;mesh.castShadow=true;mesh.receiveShadow=true;mesh.name='foreground_rock_'+side;mesh.userData.restY=mesh.position.y;mesh.userData.side=side;group.add(mesh);foregroundRocks.push(mesh);
 }

 const arches=[];
 for(const [seed,z,y,radius] of [[131,-22,-8.8,7.1],[137,-32,7.7,8.3]]){
  const spine=new THREE.CatmullRomCurve3([new THREE.Vector3(-radius,-1.8,.2),new THREE.Vector3(-radius*.5,-.65,-.6),new THREE.Vector3(0,.35,-.1),new THREE.Vector3(radius*.55,1.4,-.5),new THREE.Vector3(radius,2.1,.15)]);
  const chunks=[];
  for(let i=0;i<10;i++){
   const point=spine.getPoint(i/9),g=boulder(seed+i,[1.38+hash(i,seed,1)*.34,.86+hash(i,seed,2)*.48,.92+hash(i,seed,3)*.42],8);
   g.rotateZ(.22+(hash(i,seed,4)-.5)*.3);g.rotateY(hash(i,seed,5)*.38);g.translate(point.x,point.y,point.z);
   coordinates(g,seed);chunks.push(g);
  }
  const merged=mergeGeometries(chunks);chunks.forEach(g=>g.dispose());
  const m=new THREE.Mesh(merged,material);m.name='Distant fractured rock arch '+seed;m.position.set(0,y,z);m.userData.restY=y;
  m.castShadow=true;m.receiveShadow=true;terrain.add(m);arches.push(m);
 }
 const habitat=makeMarineHabitat(group),largeShoal=makeLargeShoal(group);
 const n=1600,positions=new Float32Array(n*3),seeds=new Float32Array(n);
 for(let i=0;i<n;i++){positions[i*3]=(hash(i,1,9)-.5)*36;positions[i*3+1]=(hash(i,2,9)-.5)*42;positions[i*3+2]=5-hash(i,3,9)*42;seeds[i]=hash(i,4,9)}
 const pg=new THREE.BufferGeometry();pg.setAttribute('position',new THREE.BufferAttribute(positions,3));pg.setAttribute('seed',new THREE.BufferAttribute(seeds,1));
 const motes=new THREE.Points(pg,new THREE.ShaderMaterial({transparent:true,depthWrite:false,
  uniforms:{uTime:{value:0},uDescent:{value:0}},
  vertexShader:`uniform float uTime;uniform float uDescent;attribute float seed;varying float vOpacity;void main(){vec3 p=position;p.x+=sin(uTime*.13+seed*19.)*.30;p.y=mod(p.y+uDescent*(.45+seed*.65)+uTime*.025+21.,42.)-21.;vec4 mv=modelViewMatrix*vec4(p,1.);vOpacity=(.13+seed*.19)*exp(-length(mv.xyz)*.027);gl_PointSize=clamp((16.+seed*20.)/max(-mv.z,1.),.6,3.2);gl_Position=projectionMatrix*mv;}`,
  fragmentShader:`varying float vOpacity;void main(){float r=length(gl_PointCoord-.5);gl_FragColor=vec4(.67,.77,.83,vOpacity*smoothstep(.5,.08,r));}`
 }));motes.name='Suspended marine particles';group.add(motes);

 const surface=new THREE.Mesh(new THREE.PlaneGeometry(90,90,80,80),new THREE.MeshPhysicalMaterial({color:0x6bb7cb,roughness:.15,metalness:0,transparent:true,opacity:.48,side:THREE.DoubleSide,envMapIntensity:.8}));
 surface.name='Underside of the moving water surface';surface.rotation.x=-Math.PI/2;surface.position.y=17;group.add(surface);
 const rest=surface.geometry.attributes.position.array.slice();
 // Kept as an API handle; visible light shafts are integrated in the water volume pass.
 const rays=new THREE.Group();rays.name='Volumetric rays controlled by water pass';group.add(rays);
 return {group,terrain,rocks,walls,arches,foregroundRocks,habitat,largeShoal,motes,surface,rays,textures,material,update(t,options={}){
  motes.material.uniforms.uTime.value=t;habitat.update(t);largeShoal.update(t);
  const depth=options.depth||0,travel=descentTravel(depth);motes.material.uniforms.uDescent.value=travel;
  for(const wall of walls)wall.position.y=(descentTravel(depth,.55)%48)-wall.userData.tile*48;
  surface.position.y=17+travel;
  for(const [i,arch]of arches.entries()){const slice=movingSlice(arch.userData.restY,depth,{span:48,bottom:-22,parallax:.45});arch.position.y=slice.y;arch.rotation.z=(hash(slice.cycle,i,71)-.5)*.24;}
  for(const [i,rock]of rocks.entries()){const parallax=THREE.MathUtils.clamp(1+rock.position.z*.013,.42,1.1),slice=movingSlice(rock.userData.restY,depth,{span:42,bottom:-21,parallax});rock.position.y=slice.y;if(rock.userData.descentCycle!==slice.cycle){rock.userData.descentCycle=slice.cycle;rock.rotation.y=i*1.738+slice.cycle*1.37;rock.rotation.z=(hash(i,slice.cycle,63)-.5)*.5;}}
  for(const rock of foregroundRocks){const side=rock.userData.side,slice=movingSlice(rock.userData.restY,depth,{span:32,bottom:-16,parallax:1.25});rock.position.y=slice.y;rock.position.z=-4.2;rock.position.x=side*(4.5+hash(slice.cycle,side,24)*.9);rock.rotation.y=side*.75+slice.cycle*.83;}
  for(const fish of [...habitat.fish,...habitat.deepFish])fish.position.y=movingSlice(fish.position.y,depth,{span:26,bottom:-13,parallax:.45}).y;
  for(const jelly of habitat.jellies)jelly.position.y=movingSlice(jelly.position.y,depth,{span:28,bottom:-14,parallax:.65}).y;
  this.descentStatus={depth,travel,near:foregroundRocks[0].position.y,far:walls[0].position.y};
  const p=surface.geometry.attributes.position;
  for(let i=0;i<p.count;i++)p.setZ(i,Math.sin(rest[i*3]*.28+t*.65)*.18+Math.sin(rest[i*3+1]*.34-t*.48)*.13);
  p.needsUpdate=true;
  surface.geometry.computeVertexNormals();
 }};
}

export function oceanEnvironment(renderer){
 const scene=new THREE.Scene();
 const sphere=new THREE.Mesh(new THREE.SphereGeometry(20,32,16),new THREE.ShaderMaterial({side:THREE.BackSide,
  vertexShader:'varying vec3 vDir;void main(){vDir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:'varying vec3 vDir;void main(){vec3 d=normalize(vDir);float top=smoothstep(-.1,.9,d.y);vec3 c=mix(vec3(.012,.038,.068),vec3(.30,.56,.68),top);float sun=pow(max(dot(d,normalize(vec3(-.35,.90,.25))),0.),32.);gl_FragColor=vec4(c+sun*vec3(1.0,1.08,1.1),1.);}'
 }));scene.add(sphere);
 const pmrem=new THREE.PMREMGenerator(renderer);const target=pmrem.fromScene(scene,.04);pmrem.dispose();sphere.geometry.dispose();sphere.material.dispose();return target;
}

let sharedRockTextures;
function getRockTextures(){
 if(sharedRockTextures)return sharedRockTextures;
 const loader=new THREE.TextureLoader();
 const load=(file,color=false)=>{const t=loader.load('assets/environment/'+file);if(color)t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;return t};
 sharedRockTextures={albedo:load('rock-albedo.jpg',true),normal:load('rock-normal.jpg'),roughness:load('rock-roughness.jpg'),height:load('rock-height.jpg')};return sharedRockTextures;
}
let sharedRockMaterial;
export function makeScannedRock(volcanic=false){
 sharedRockMaterial ||= rockMaterial(getRockTextures());sharedRockMaterial.userData.sharedScanned=true;
 const material=volcanic?sharedRockMaterial.clone():sharedRockMaterial;
 if(volcanic){material.userData.sharedScanned=false;material.onBeforeCompile=sharedRockMaterial.onBeforeCompile;material.customProgramCacheKey=sharedRockMaterial.customProgramCacheKey;material.color.setHex(0x6e777d)}
 const seed=Math.random()*1000,mesh=new THREE.Mesh(boulder(seed,[.7+Math.random()*.35,.65+Math.random()*.6,.65+Math.random()*.4],8),material);
 mesh.name=volcanic?'Fractured basalt obstacle':'Scanned stone obstacle';mesh.castShadow=true;mesh.receiveShadow=true;
 return mesh;
}
