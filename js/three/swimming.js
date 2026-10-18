import {prepareSwimTurn,finishSwimTurn} from './swim-turns.js?v=42';
import {applySwimAccents} from './swim-accents.js?v=42';
import {blendSleepPose,hugSleepLegs} from './sleep-curl.js?v=42';
import * as THREE from 'three';
import {rigData} from './rig-data.js?v=42';
import {swimClips} from './swim-clips.js?v=42';
const smooth=THREE.MathUtils.smoothstep;
const windowWeight=(t,start,end)=>smooth(t,start,start+.9)*(1-smooth(t,end-.9,end));
const sampled=new THREE.Quaternion(),a=new THREE.Quaternion(),b=new THREE.Quaternion(),inverse=new THREE.Quaternion(),direction=new THREE.Vector3();

export function swimmerAction(time,motion={}){
 if(motion.controlled&&motion.swimStyle&&!motion.sleeping)return {action:motion.swimStyle,weights:{[motion.swimStyle==='freestyle'?'flutter':'breaststroke']:1}};
 if(motion.sleeping)return {action:'float',weights:{float:1}};
 if(motion.action&&swimClips.clips[motion.action])return {action:motion.action,weights:{[motion.action]:1}};
 const t=((time%30)+30)%30;
 const weights={extend:windowWeight(t,3.6,7.5),breaststroke:windowWeight(t,8.2,11.8),tuck:windowWeight(t,12.1,15.3),roll:windowWeight(t,16,19.8),dolphin:windowWeight(t,20.2,24.2),reach:windowWeight(t,24.6,28.7)};
 if(motion.state==='float')return {action:'float',weights:{float:1}};
 if(!motion.controlled&&motion.intent==='avoid')return {action:'evade',weights:{evade:1}};
 if(motion.strokeStage){const stage=motion.strokeStage;const action=stage==='gather'?'tuck':stage==='idle'?'float':(motion.diveWeight||0)>.55?'headfirst':'extend';return {action,weights:{[action]:1}};}
 if((motion.diveWeight||0)>.35&&swimClips.clips.headfirst)return {action:'headfirst',weights:{headfirst:1}};
 if(motion.controlled)return {action:'extend',weights:{extend:1}};
 if(motion.intent==='avoid')return {action:'evade',weights:{evade:1}};
 if(motion.intent==='probe'||motion.state==='reach')return {action:'reach',weights:{reach:1}};
 if(motion.intent==='approach')return {action:'breaststroke',weights:{breaststroke:1}};
 let action='flutter',largest=.1;
 for(const [name,w] of Object.entries(weights))if(w>largest){largest=w;action=name}
 return {action,weights};
}
function sample(clip,seconds,index,out){
 const count=clip.frames.length-1,frame=((seconds%clip.duration)+clip.duration)%clip.duration/clip.duration*count;
 const i=Math.floor(frame),alpha=frame-i,k=index*4;
 a.fromArray(clip.frames[i],k);b.fromArray(clip.frames[i+1],k);out.copy(a).slerp(b,alpha).normalize();
}
const rest=Object.fromEntries(rigData.map(j=>[j.name,new THREE.Vector3(...j.position)]));
function pointHand(root,prefix,worldTarget){
 const bones=root.userData.bones,upper=bones[prefix+'shoulder'],lower=bones[prefix+'elbow'],wrist=bones[prefix+'wrist'];
 const shoulder=upper.getWorldPosition(new THREE.Vector3()),target=worldTarget.clone();
 const l1=rest[prefix+'shoulder'].distanceTo(rest[prefix+'elbow'])*root.scale.x,l2=rest[prefix+'elbow'].distanceTo(rest[prefix+'wrist'])*root.scale.x;
 const axis=target.sub(shoulder).normalize(),length=(l1+l2)*.92;
 target.copy(shoulder).addScaledVector(axis,length);
 const parentQ=upper.parent.getWorldQuaternion(new THREE.Quaternion());
 const pole=new THREE.Vector3(prefix==='l_'?.65:-.65,0,-.14).applyQuaternion(parentQ);
 pole.addScaledVector(axis,-pole.dot(axis)).normalize();
 const along=(l1*l1+length*length-l2*l2)/(2*length),height=Math.sqrt(Math.max(0,l1*l1-along*along));
 const elbow=shoulder.clone().addScaledVector(axis,along).addScaledVector(pole,height);
 const desired=elbow.sub(shoulder).normalize().applyQuaternion(parentQ.invert());
 const upperQ=new THREE.Quaternion().setFromUnitVectors(lower.position.clone().normalize(),desired);upper.quaternion.slerp(upperQ,.72);root.updateMatrixWorld(true);
 lower.getWorldPosition(shoulder);lower.parent.getWorldQuaternion(parentQ).invert();
 desired.copy(target).sub(shoulder).normalize().applyQuaternion(parentQ);
 const lowerQ=new THREE.Quaternion().setFromUnitVectors(wrist.position.clone().normalize(),desired);lower.quaternion.slerp(lowerQ,.72);
}
export function poseSwimmer(root,time,motion={}){
 if(root.userData.swimPPO?.pose(root,time,motion))return;
 const bones=root.userData.bones;if(!bones)return;
 const intent=swimmerAction(time,motion),weights=intent.weights;
 const now=motion.sampleTime??time,previous=root.userData.clipSampleTime;
 const dt=previous===undefined?.016:THREE.MathUtils.clamp(Math.abs(now-previous),0,.12);
 root.userData.clipSampleTime=now;
 // Smooth clip weights retain the current pose when a nearby animal changes
 // the intended movement. Sampling is from Blender-authored quaternion data.
 const state=root.userData.clipBlend||Object.fromEntries(Object.keys(swimClips.clips).map(n=>[n,n==='float'?1:0]));
 root.userData.clipBlend=state;
 const requested={...weights};let total=Object.values(requested).reduce((s,w)=>s+w,0);
 if(total<1)requested.flutter=1-total;
 const blend=1-Math.exp(-dt*4.2);
 for(const name in state)state[name]=THREE.MathUtils.lerp(state[name],requested[name]||0,blend);
 const phaseTime=motion.controlled&&motion.swimStyle?motion.strokeTime??time:motion.phase!==undefined?motion.phase/1.3:time;
 for(let index=0;index<swimClips.bones.length;index++){
  const bone=bones[swimClips.bones[index]];let sum=0;
  for(const [name,weight]of Object.entries(state)){
   if(weight<.00001)continue;
   sample(swimClips.clips[name],phaseTime,index,sampled);
   if(sum===0)bone.quaternion.copy(sampled);else bone.quaternion.slerp(sampled,weight/(sum+weight));sum+=weight;
  }
 }
 const sleepTarget=motion.sleeping?1:0;root.userData.sleepBlend=THREE.MathUtils.lerp(root.userData.sleepBlend||0,sleepTarget,1-Math.exp(-dt*(motion.sleeping?2.1:1.7)));blendSleepPose(root,root.userData.sleepBlend);
 // Alternating flutter after the gathered legs extend; reduced amplitude
 // during the glide keeps the ankles alive without continuously folding.
 if(!motion.swimStyle&&(motion.strokeStage==='kick'||motion.strokeStage==='glide')){
  const strength=motion.strokeStage==='kick'?1:.5,strokePhase=(motion.phase??time*1.3)*5.2;
  for(const [prefix,offset]of [['l_',0],['r_',Math.PI]]){
   const wave=Math.sin(strokePhase+offset);sampled.setFromEuler(new THREE.Euler(wave*.16*strength,0,0));bones[prefix+'thigh'].quaternion.multiply(sampled);
   sampled.setFromEuler(new THREE.Euler(Math.max(0,-wave)*.30*strength,0,0));bones[prefix+'knee'].quaternion.multiply(sampled);
   sampled.setFromEuler(new THREE.Euler(-.10*strength+wave*.06,0,0));bones[prefix+'ankle'].quaternion.multiply(sampled);
  }
 }
 // A travelling body wave articulates the pelvis, waist and upper torso.
 // The chest counter-rotates, so steering never becomes just a root rotation.
 const phase=motion.phase??time*1.3,swim=motion.state!=='float';
 const speed=THREE.MathUtils.clamp(motion.speed||0,0,3),turn=THREE.MathUtils.clamp(motion.turn||0,-1,1);
 const acceleration=THREE.MathUtils.clamp((motion.acceleration?.x||0)*.035,-.18,.18);
 const activity=swim?(.65+speed*.12):.12;
 const waistPitch=Math.sin(phase-.45)*.17*activity;
 const waistTwist=(Math.sin(phase)*.23+turn*.24+acceleration)*activity;
 const waistRoll=(Math.sin(phase*.85+.5)*.10-turn*.12)*activity;
 sampled.setFromEuler(new THREE.Euler(waistPitch,waistTwist,waistRoll));bones.spine.quaternion.multiply(sampled);
 sampled.setFromEuler(new THREE.Euler(-waistPitch*.55,-waistTwist*.66,-waistRoll*.60));bones.chest.quaternion.multiply(sampled);
 sampled.setFromEuler(new THREE.Euler(Math.sin(phase-.85)*.08*activity,-waistTwist*.24,Math.sin(phase-.6)*.07*activity));bones.hips.quaternion.multiply(sampled);
 root.userData.bodyWave={pitch:waistPitch,twist:waistTwist,roll:waistRoll};
 const diveTarget=motion.state==='float'?0:THREE.MathUtils.clamp(Math.max(motion.diveWeight||0,motion.ascentWeight||0),0,1);
 root.userData.diveBlend=THREE.MathUtils.lerp(root.userData.diveBlend||0,diveTarget,1-Math.exp(-dt*1.65));
 // Creature attention is layered onto the baked stroke, using the live head
 // parent orientation, including during a head-first dive.
 root.updateMatrixWorld(true);
 if(motion.lookAt&&root.userData.sleepBlend<.1){
  bones.head.getWorldPosition(direction);direction.subVectors(motion.lookAt,direction);
  bones.head.parent.getWorldQuaternion(inverse).invert();direction.applyQuaternion(inverse).normalize();
  const yaw=THREE.MathUtils.clamp(Math.atan2(direction.x,direction.z),-.55,.55),pitch=THREE.MathUtils.clamp(-Math.asin(direction.y),-.25,.25);
  sampled.setFromEuler(new THREE.Euler(pitch,yaw,0));bones.head.quaternion.slerp(sampled,.55*(1-root.userData.diveBlend*.88));
 }
 if(root.userData.sleepBlend<.1&&!motion.controlled&&motion.intent==='probe'&&motion.lookAt){
  const side=motion.lookAt.clone();root.worldToLocal(side);pointHand(root,side.x>=0?'l_':'r_',motion.lookAt);
 }
 const steer=THREE.MathUtils.clamp(motion.turn||0,-1,1);
 sampled.setFromEuler(new THREE.Euler(0,steer*.12,-steer*.08));bones.hips.quaternion.multiply(sampled);
 root.updateMatrixWorld(true);
 const dive=root.userData.diveBlend;
 if(dive>.001){
  const hp=bones.hips.getWorldPosition(new THREE.Vector3()),hd=bones.head.getWorldPosition(new THREE.Vector3());
  bones.hips.parent.getWorldQuaternion(inverse).invert();const from=hd.sub(hp).normalize().applyQuaternion(inverse);
  const to=new THREE.Vector3(-steer*.16,(motion.ascentWeight||0)>(motion.diveWeight||0)?1:-1,.18).normalize().applyQuaternion(inverse);
  const aim=root.userData.verticalAim||(root.userData.verticalAim=to.clone());aim.lerp(to,1-Math.exp(-dt*1.6)).normalize();
  const correction=new THREE.Quaternion().setFromUnitVectors(from,aim);correction.slerp(new THREE.Quaternion(),1-dive);bones.hips.quaternion.premultiply(correction);root.updateMatrixWorld(true);
 }
 // Directed swimming uses an alternating arm cycle or synchronized frog kick.
 const directed=!!motion.controlled&&!!motion.swimStyle&&!motion.sleeping;
 root.userData.directedWeight=THREE.MathUtils.lerp(root.userData.directedWeight||0,directed?1:0,1-Math.exp(-dt*4));
 if(directed)root.userData.lastDirectedStroke={style:motion.swimStyle,time:motion.strokeTime??time,direction:motion.swimDirection.clone(),seed:motion.strokeSeed??1,forced:motion.legAccent??null};else if(root.userData.lastDirectedStroke)root.userData.lastDirectedStroke.time+=dt;
 const remembered=root.userData.lastDirectedStroke,weight=Math.max(root.userData.directedWeight,root.userData.swimTurn?.active?.6:0);
 if(remembered&&(weight>.001||root.userData.swimTurn?.active)&&!motion.sleeping){
  const clock=remembered.time,freestyle=remembered.style==='freestyle',cycle=freestyle?2.4:3.4,phi=clock/cycle*Math.PI*2;
  if(freestyle){
   for(const [prefix,side,offset]of [['l_',1,0],['r_',-1,Math.PI]]){
    const armPhase=phi+offset,armDirection=new THREE.Vector3(side*.48,Math.cos(armPhase),Math.sin(armPhase)*.78).normalize();
    sampled.setFromUnitVectors(bones[prefix+'elbow'].position.clone().normalize(),armDirection);bones[prefix+'shoulder'].quaternion.slerp(sampled,weight);
    sampled.setFromEuler(new THREE.Euler(.18+Math.max(0,Math.sin(armPhase))*.7,side*.10,0));bones[prefix+'elbow'].quaternion.slerp(sampled,weight);
    sampled.setFromEuler(new THREE.Euler(Math.sin(phi*3+offset)*.23,0,side*.025));bones[prefix+'thigh'].quaternion.slerp(sampled,weight);
    sampled.setFromEuler(new THREE.Euler(.12+Math.max(0,-Math.sin(phi*3+offset))*.42,0,0));bones[prefix+'knee'].quaternion.slerp(sampled,weight);
    sampled.setFromEuler(new THREE.Euler(-.22+Math.sin(phi*3+offset)*.09,0,0));bones[prefix+'ankle'].quaternion.slerp(sampled,weight);
   }
  }
  applySwimAccents(root,clock,{seed:remembered.seed,weight:Math.max(weight,.68*(1-root.userData.directedWeight)),style:remembered.style,forced:remembered.forced,dt});
  prepareSwimTurn(root,dt,remembered.direction,{controlled:directed,seed:remembered.seed,weight});
  root.updateMatrixWorld(true);
  const hip=bones.hips.getWorldPosition(new THREE.Vector3()),head=bones.head.getWorldPosition(new THREE.Vector3());bones.hips.parent.getWorldQuaternion(inverse).invert();
  const from=head.sub(hip).normalize().applyQuaternion(inverse),to=remembered.direction.clone();to.z=.16;to.normalize();const aim=root.userData.swimHeading||(root.userData.swimHeading=to.clone());const steering=new THREE.Quaternion().setFromUnitVectors(aim,to).slerp(new THREE.Quaternion(),Math.exp(-dt*3.2));aim.applyQuaternion(steering).normalize();to.copy(aim).applyQuaternion(inverse);
  const correction=new THREE.Quaternion().setFromUnitVectors(from,to);root.userData.headingBlend=THREE.MathUtils.lerp(root.userData.headingBlend||0,directed?1:0,1-Math.exp(-dt*2.7));correction.slerp(new THREE.Quaternion(),1-root.userData.headingBlend);bones.hips.quaternion.premultiply(correction);root.updateMatrixWorld(true);
  finishSwimTurn(root,remembered.direction);
  root.userData.directedSwim={style:remembered.style,time:clock,direction:remembered.direction.toArray(),fading:!directed,headingBlend:root.userData.headingBlend};
 }else{root.userData.headingBlend=0;root.userData.directedSwim=null;if(!motion.sleeping&&root.userData.sleepBlend<.01){applySwimAccents(root,remembered?.time??time,{seed:remembered?.seed??motion.strokeSeed??7,weight:.68,style:remembered?.style??'freestyle',dt});}else root.userData.legAccent=null;if(root.userData.swimTurn){root.userData.swimTurn.active=false;root.userData.swimTurn.cooldown=0;}}
 hugSleepLegs(root,root.userData.sleepBlend);
 const hp=bones.hips.getWorldPosition(new THREE.Vector3()),hd=bones.head.getWorldPosition(new THREE.Vector3());
 root.userData.diveStats={blend:dive,headBelowHips:hd.y<hp.y,verticalAlignment:hd.clone().sub(hp).normalize().dot(new THREE.Vector3(0,-1,0))};
 root.userData.swimState=motion.state==='float'?'float':'swim';root.userData.swimAction=motion.sleeping?'sleep-curl':intent.action;
 root.userData.swimActionWeights={...state};root.userData.animationSource=motion.swimStyle==='freestyle'?'Procedural alternating arm strokes and flutter kick over Blender rig':'Blender + Rigify evaluated/baked local quaternions';
}
