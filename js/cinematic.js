import * as THREE from 'three';
import {SeaAudio} from './audio.js?v=50';
const audio=new SeaAudio();
import {SwimBubbles} from './three/swim-bubbles.js?v=50';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {prepareCharacter,animateCharacter} from './three/authored.js?v=50';
import {makeOcean,oceanEnvironment} from './three/ocean-real.js?v=50';
import {WaterRenderer} from './three/water.js?v=50';

const renderer=new THREE.WebGLRenderer({canvas:document.querySelector('canvas'),antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();scene.background=new THREE.Color(0x051c2c);scene.fog=null;
const camera=new THREE.PerspectiveCamera(42,1,.1,120);
const target=oceanEnvironment(renderer);scene.environment=target.texture;scene.environmentIntensity=.65;
scene.add(new THREE.HemisphereLight(0x9fc5d7,0x102535,.55));
const sun=new THREE.DirectionalLight(0xdaeff7,3.1);sun.position.set(-5,14,6);sun.target.position.set(0,0,-4);scene.add(sun,sun.target);sun.castShadow=true;sun.shadow.mapSize.set(1536,1536);Object.assign(sun.shadow.camera,{left:-23,right:23,top:28,bottom:-28,near:.5,far:85});sun.shadow.bias=-.0004;sun.shadow.normalBias=.012;
const rim=new THREE.DirectionalLight(0x84afc9,.65);rim.position.set(5,5,-5);scene.add(rim);
const ocean=makeOcean(scene);
const water=new WaterRenderer(renderer,scene,camera,sun);water.apply(ocean.group);
const bubbles=new SwimBubbles(scene);let previousPoseTime=0;const previousGirlPosition=new THREE.Vector3();
let girl,whale,time=0,paused=false;const clock=new THREE.Clock();
const range=document.querySelector('#progress');const phase=document.querySelector('#phase');
function resize(){renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();water.resize()}
resize();addEventListener('resize',resize);
const smooth=(t,a,b)=>{const x=THREE.MathUtils.clamp((t-a)/(b-a),0,1);return x*x*(3-2*x)};
function pose(t){
 const reveal=smooth(t,5,13),rise=smooth(t,19,32),dive=smooth(t,0,7),contact=smooth(t,12,18);
 const light=smooth(t,25,35),near=smooth(t,9,12)*(1-smooth(t,17,21));
 girl.position.set(-1.0+contact*1.5,5.8-dive*5.1+rise*5.4,2.8);
 girl.rotation.set(.07*Math.sin(t*.6),.2+contact*.9,-.13+Math.sin(t*.7)*.06);
 whale.position.set(.6+near*1.3,-4+reveal*3+rise*5.4,-2+(1-reveal)*-7+near*1.8);
 whale.rotation.set(-.60+rise*.1-near*.42,-1.20-near*.22,-.43+rise*.16+Math.sin(t*.35)*.018);
 whale.visible=t>4;
 animateCharacter(girl,t,{state:contact>.6?'reach':'swim',activity:contact>.6?.5:.85,speed:.45});animateCharacter(whale,t);
 const delta=t-previousPoseTime,velocity=girl.position.clone().sub(previousGirlPosition).multiplyScalar(delta>0?1/delta:0).clampLength(0,4);
 if(delta<0||delta>.3)bubbles.clear();
 bubbles.update(delta>=0&&delta<.3?delta:0,t,girl,{swimming:true,boost:velocity.length()>1?.4:0,velocity});
 previousPoseTime=t;previousGirlPosition.copy(girl.position);
 const bones=girl.userData.bones;
 if(bones){bones.r_knee.rotation.x+=contact*.18;bones.head.rotation.y-=contact*.18}
 const aspect=innerWidth/innerHeight;
 camera.position.set(4.3-contact*1.5-near*.9,3.1+rise*5.4,aspect<.8?18.0-near*4.8:15.5-near*3.3);
 camera.lookAt(.4+near*.6,.7+rise*5.4,0);
 sun.intensity=2.8+light*.7;
 ocean.update(t);ocean.surface.position.y=13;
 phase.textContent=t<7?'下沉':t<13?'深海中的守護者':t<19?'相遇':t<30?'一起上升':'向著光';
 range.value=t;
}
document.querySelector('#music').onclick=async e=>{if(!audio.ctx){await audio.unlock();e.target.textContent='音樂：開'}else{const enabled=await audio.toggleMusic();e.target.textContent=enabled?'音樂：開':'音樂：關'}};
document.querySelector('#pause').onclick=e=>{paused=!paused;e.target.textContent=paused?'播放':'暫停'};
range.oninput=()=>{time=Number(range.value);if(girl)pose(time)};
try{
 const l=new GLTFLoader();const [g,w]=await Promise.all([l.loadAsync('assets/usd/girl.glb?v=50'),l.loadAsync('assets/usd/whale.glb?v=50')]);
 girl=prepareCharacter(g.scene,'girl');whale=prepareCharacter(w.scene,'whale');scene.add(girl,whale);water.apply(girl);water.apply(whale);document.querySelector('#loading').remove();
 window.cinematic={ready:true,scene,camera,renderer,girl,whale,water,ocean,bubbles,seek(t){time=t;paused=true;pose(t);water.render(t)}};
}catch(e){document.querySelector('#loading').textContent='3D 模型載入失敗：'+e.message;throw e}
renderer.setAnimationLoop(()=>{const dt=Math.min(clock.getDelta(),.15);if(!paused)time=(time+dt)%36;if(girl)pose(time);water.render(time)});
