import * as THREE from 'three';
const clamp=THREE.MathUtils.clamp,smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t)},q=new THREE.Quaternion(),inverse=new THREE.Quaternion();
export function beginSwimTurn(root,kind='pirouette',sign=1){if(root.userData.swimPPO)return false;const s=root.userData.swimTurn||(root.userData.swimTurn={age:0,cooldown:0,count:0,active:false,sign:1});if(s.active)return false;Object.assign(s,{kind,sign:Math.sign(sign)||1,age:0,duration:kind==='pirouette'?2.6:3.0,active:true,cooldown:3.6,count:s.count+1});return true;}
export function prepareSwimTurn(root,dt,direction,{controlled=true,seed=1,weight=1}={}){
 const bones=root.userData.bones,s=root.userData.swimTurn||(root.userData.swimTurn={age:0,cooldown:0,count:0,active:false,sign:1});s.cooldown=Math.max(0,s.cooldown-dt);
 const desired=direction.clone().normalize(),heading=(root.userData.swimHeading||desired).clone().normalize(),cross=heading.x*desired.y-heading.y*desired.x,dot=clamp(heading.dot(desired),-1,1),angle=Math.acos(dot);
 if(controlled&&!s.active&&s.cooldown===0&&angle>1.35){const kinds=angle>2.2?['frontflip','backflip','pirouette']:['pirouette','backflip','pirouette'];beginSwimTurn(root,kinds[((seed>>>0)+s.count)%3],Math.sign(cross)||(s.count%2?1:-1));}
 if(s.active){s.age+=dt;if(s.age>=s.duration){s.active=false;s.age=s.duration;}}
 const progress=s.active?clamp(s.age/s.duration,0,1):0,envelope=s.active?Math.sin(Math.PI*progress):0,steer=clamp(cross*1.8,-1,1),effort=Math.max(Math.sin(angle)*.7,envelope),fold=s.kind==='frontflip'?.30:s.kind==='backflip'?-.28:-.12;
 q.setFromEuler(new THREE.Euler((.12*effort+fold*envelope)*weight,steer*.28*weight,(steer*.30+(s.sign||1)*envelope*.13)*weight));bones.spine.quaternion.multiply(q);
 q.setFromEuler(new THREE.Euler(fold*envelope*.45*weight,-steer*.17*weight,-steer*.11*weight));bones.chest.quaternion.multiply(q);
 if(envelope>.001){for(const [index,prefix]of ['l_','r_'].entries()){const side=index? -1:1,asymmetric=s.kind==='pirouette'?(index?.50:1):1,hook=(.50+envelope*.65)*asymmetric;
  q.setFromEuler(new THREE.Euler(s.kind==='frontflip'?-.32:.20,0,side*(.12+envelope*.17)));bones[prefix+'thigh'].quaternion.slerp(q,envelope*.72);
  q.setFromEuler(new THREE.Euler(hook,0,0));bones[prefix+'knee'].quaternion.slerp(q,envelope*.90);
  q.setFromEuler(new THREE.Euler(-.33,0,0));bones[prefix+'ankle'].quaternion.slerp(q,envelope*.8);
 }}
 root.userData.turnStats={active:s.active,kind:s.kind||null,progress,envelope,waistEffort:effort,steer,angle,count:s.count};return root.userData.turnStats;
}
export function finishSwimTurn(root,direction){if(root.userData.swimPPO)return;const s=root.userData.swimTurn;if(!s?.active)return;const bones=root.userData.bones,progress=clamp(s.age/s.duration,0,1),angle=s.sign*Math.PI*2*smooth(progress),axis=s.kind==='pirouette'?direction.clone():new THREE.Vector3(direction.y,-direction.x,.16);axis.normalize();bones.hips.parent.getWorldQuaternion(inverse).invert();axis.applyQuaternion(inverse);q.setFromAxisAngle(axis,angle);bones.hips.quaternion.premultiply(q);root.updateMatrixWorld(true);}
