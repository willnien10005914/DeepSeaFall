import * as THREE from 'three';
import {SwimBubbles} from './three/swim-bubbles.js?v=48';
import {makeRealFish,makeRealJelly,makeDeepSeaFish,animateMarine} from './three/marine-life.js?v=48';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {prepareCharacter, animateCharacter} from './three/authored.js?v=48';
import {makeOcean,oceanEnvironment} from './three/ocean-real.js?v=48';
import {WaterRenderer} from './three/water.js?v=48';

const renderer = new THREE.WebGLRenderer({canvas:document.querySelector('canvas'),antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = .85;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();scene.background = new THREE.Color(0x071823);
const camera = new THREE.PerspectiveCamera(38,innerWidth/innerHeight,.01,100);
const controls = new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;
const pmrem = new THREE.PMREMGenerator(renderer);
const env = new RoomEnvironment();const envTarget = pmrem.fromScene(env,.04);scene.environment=envTarget.texture;scene.environmentIntensity=.4;env.dispose();pmrem.dispose();
const ambient = new THREE.HemisphereLight(0xc6e1e7,0x182830,.65);scene.add(ambient);
const key = new THREE.DirectionalLight(0xd6eaf0,2.1);key.position.set(3,8,7);scene.add(key);
const rim = new THREE.DirectionalLight(0x62b6c9,1.8);rim.position.set(-4,5,-5);scene.add(rim);
const fill = new THREE.DirectionalLight(0xffe4cf,.7);fill.position.set(-4,1,4);scene.add(fill);
scene.add(key.target,fill.target,rim.target);
key.castShadow=true;
key.shadow.mapSize.set(2048,2048);
key.shadow.camera.left=-2;key.shadow.camera.right=2;key.shadow.camera.top=2;key.shadow.camera.bottom=-2;
key.shadow.camera.near=.5;key.shadow.camera.far=20;key.shadow.bias=-.0003;key.shadow.normalBias=.002;
const floor=new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.MeshStandardMaterial({color:0xaaa7a1,roughness:.95}));
floor.rotation.x=-Math.PI/2;floor.position.y=-.003;floor.receiveShadow=true;scene.add(floor);
const ocean=makeOcean(scene),water=new WaterRenderer(renderer,scene,camera,key),oceanTarget=oceanEnvironment(renderer);water.apply(ocean.group);
const bubbles=new SwimBubbles(scene),marineStudy=new THREE.Group();marineStudy.name='Marine life inspection';scene.add(marineStudy);
const studyFish=makeRealFish(0xaabac2,1.15),studyJelly=makeRealJelly();
studyFish.position.set(0,-.45,.1);studyJelly.position.set(0,.90,-.35);studyJelly.scale.setScalar(.95);
const deepStudy=['lanternfish','hatchetfish','anglerfish'].map((species,i)=>{const f=makeDeepSeaFish(species);f.position.set(i%2===0?-.45:.48,.48-i*.62,.15);marineStudy.add(f);return f});
studyJelly.position.set(.45,1.22,-.35);studyFish.position.set(0,-1.36,.1);
marineStudy.add(studyFish,studyJelly);water.apply(marineStudy);marineStudy.visible=false;
let girl,whale,paused=false,view='encounter',time=0;
const clock = new THREE.Clock();
const status=document.querySelector('#status');
function resize(){renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();water.resize()}
addEventListener('resize',()=>{resize();if(girl)setView(view)});resize();
function setView(id){
 if(!girl||!whale)return;
 view=id;ocean.habitat.group.visible=id!=='life';girl.visible=!['whale','life'].includes(id);whale.visible=id==='whale'||id==='encounter';marineStudy.visible=id==='life';bubbles.mesh.visible=id==='encounter';bubbles.clear();
 girl.position.set(0,0,0);girl.rotation.set(0,0,0);whale.position.set(0,0,0);whale.rotation.set(0,0,0);
 const studio=['girl','face','front','side','back','hair-side','hair-back'].includes(id);
 document.body.classList.toggle('studio',studio);
 floor.visible=studio;
 ocean.group.visible=!studio;scene.environment=studio?envTarget.texture:oceanTarget.texture;
 water.uniforms.uCausticStrength.value=studio?0:1;
 key.shadow.camera.left=studio?-2:-23;key.shadow.camera.right=studio?2:23;
 key.shadow.camera.top=studio?2:28;key.shadow.camera.bottom=studio?-2:-28;
 key.shadow.camera.far=studio?20:85;key.shadow.camera.updateProjectionMatrix();
 whale.scale.setScalar(id==='encounter'?.78:1);
 scene.background.setHex(studio?0xb7adaf:0x071823);
 // A broad-looking key, a weaker neutral fill and a gentle back rim reveal the
 // facial volumes without turning the skin pink or flattening the black hair.
 key.color.setHex(studio?0xfff0e6:0xd6eaf0);key.intensity=studio?2.45:2.1;
 key.position.set(studio?-3.2:3,studio?5:8,studio?4.8:7);
 fill.color.setHex(studio?0xf2f0eb:0xffe4cf);fill.intensity=studio?.55:.7;
 fill.position.set(studio?4.3:-4,studio?2.7:1,studio?4:4);
 rim.color.setHex(studio?0xdce7ec:0x62b6c9);rim.intensity=studio?.90:1.8;
 rim.position.set(studio?2.8:-4,studio?4.4:5,studio?-3.5:-5);
 ambient.color.setHex(studio?0xeae6e1:0xc6e1e7);
 ambient.groundColor.setHex(studio?0x6b5c52:0x182830);ambient.intensity=studio?.42:.65;
 for(const light of [key,fill,rim])light.target.position.set(0,studio?1.05:0,0);
 scene.environmentIntensity=studio?.26:.4;
 key.shadow.radius=studio?4:1;
 key.shadow.bias=studio?-.00012:-.0003;key.shadow.normalBias=studio?.0015:.002;
 renderer.toneMapping=studio?THREE.AgXToneMapping:THREE.ACESFilmicToneMapping;
 renderer.toneMappingExposure=studio?1.03:.85;
 const portrait=innerWidth/innerHeight<.9;
 if(id==='encounter'){
  girl.position.set(.2,-.4,.7);girl.rotation.y=.15;
  whale.position.set(.45,-.15,-4.1);whale.rotation.set(-.60,-1.24,-.47);
  camera.position.set(.8,2.6,portrait?12.5:11);controls.target.set(.4,-1.3,-2.5);
  status.textContent='划水與踢腿 · 座頭鯨同行 · 立體海谷與水下光影';
 }else if(id==='life'){
  camera.position.set(.6,.65,portrait?6.4:4.8);controls.target.set(0,-.05,0);
  status.textContent='燈籠魚 · 斧頭魚 · 鮟鱇魚 · 水母立體傘體與觸手';
 }else if(id==='girl'){
  camera.position.set(-.5,.88,portrait?3.3:2.85);controls.target.set(0,.82,0);
  status.textContent='纖細比例 · 淡綠方領洋裝 · 深色長直髮';
 }else if(['front','side','back'].includes(id)){
  const distance=portrait?3.3:2.85;
  camera.position.set(id==='side'?distance:0,.83,id==='back'?-distance:id==='front'?distance:0);controls.target.set(0,.82,0);
  status.textContent='正面、側面、背面 · 同一個實際 3D 角色';
 }else if(id==='hair-side'||id==='hair-back'){
  camera.position.set(id==='hair-side'?1.35:0,1.30,id==='hair-back'?-1.42:.035);controls.target.set(0,1.265,.02);
  status.textContent='分層長直髮 · 精細髮絲 · 輕薄瀏海與水流擺動';
 }else if(id==='face'){
  camera.position.set(.18,1.46,.61);controls.target.set(0,1.44,.04);
  status.textContent='立體髮束與層次 · 衣物接觸約束';
 }else{
  camera.position.set(13,3.6,portrait?21:14);controls.target.set(0,0,0);
  status.textContent='皮膚斑紋與疤痕 · 下顎藤壺 · 尾柄推進 · 胸鰭轉向';
 }
 controls.update();
 document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===id));
}
document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));
document.querySelector('#motion').onclick=e=>{paused=!paused;e.target.textContent=paused?'播放':'暫停'};
try{
 const loader=new GLTFLoader();
 const [g,w]=await Promise.all([loader.loadAsync('assets/usd/girl.glb?v=48'),loader.loadAsync('assets/usd/whale.glb?v=48')]);
 girl=prepareCharacter(g.scene,'girl');whale=prepareCharacter(w.scene,'whale');scene.add(girl,whale);
 water.apply(girl);water.apply(whale);
 window.review={scene,camera,renderer,girl,whale,setView,controls,water,ocean,bubbles,marineStudy,studyFish,studyJelly,deepStudy,lights:{key,fill,rim,ambient}};setView(new URLSearchParams(location.search).get('view')||'encounter');
 window.review.ready=true;
}catch(e){status.textContent='模型載入失敗';document.querySelector('#error').textContent='無法載入 3D 模型，請以 HTTP 伺服器開啟。\n'+e.message;throw e}
renderer.setAnimationLoop(()=>{
 const dt=Math.min(clock.getDelta(),.05);if(!paused)time+=dt;
 if(girl){animateCharacter(girl,time,{state:view==='encounter'?'swim':'float',activity:.72,speed:.4});animateCharacter(whale,time)}
 if(girl&&view==='encounter')bubbles.update(paused?0:dt,time,girl,{swimming:true,velocity:new THREE.Vector3(),phase:time*1.3});
 animateMarine(studyFish,time);animateMarine(studyJelly,time);deepStudy.forEach(f=>animateMarine(f,time));
 controls.update();
 if(ocean.group.visible){ocean.update(time);water.render(time)}else renderer.render(scene,camera);
});
