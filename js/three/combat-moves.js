import * as THREE from 'three';
export const combatMoves=Object.freeze([
 {id:'spiral-kick',name:'回旋踢',element:'fire',charge:1.0,duration:1.35,reach:3.1,cooldown:30,power:32,color:0xf56b1a,fx:'spin'},
 {id:'cross-blades',name:'十字光劍',element:'ice',charge:1.2,duration:1.35,reach:4.1,cooldown:65,power:45,color:0x9edbf5,fx:'cross'},
 {id:'diagonal-slash',name:'斜月劍',element:'ice',charge:.95,duration:1.25,reach:3.9,cooldown:50,power:38,color:0x9edbf5,fx:'diagonal'},
 {id:'crescent-kick',name:'月牙腿',element:'fire',charge:1.1,duration:1.4,reach:3.5,cooldown:60,power:36,color:0xf56b1a,fx:'crescent'},
 {id:'palm-wave',name:'破浪掌',element:'fire',charge:1.15,duration:1.3,reach:4.6,cooldown:75,power:42,color:0xf56b1a,fx:'palm'},
 {id:'lotus-burst',name:'蓮華氣爆',element:'cold-fire',charge:1.8,duration:1.65,reach:5.1,cooldown:110,power:56,color:0x8cc7f5,fx:'lotus'},
 {id:'halo-guard',name:'星環震波',element:'cold-fire',charge:1.5,duration:1.5,reach:4.7,cooldown:95,power:45,color:0x8cc7f5,fx:'halo'},
 {id:'twin-kick',name:'雙飛踢',element:'fire',charge:1.3,duration:1.5,reach:3.6,cooldown:70,power:44,color:0xf56b1a,fx:'twin'},
 {id:'sword-dance',name:'流光劍舞',element:'ice',charge:1.7,duration:1.85,reach:4.5,cooldown:100,power:52,color:0x9edbf5,fx:'dance'},
 {id:'tidal-release',name:'潮汐天光',element:'cold-fire',charge:2.0,duration:2.0,reach:5.8,cooldown:140,power:65,color:0x8cc7f5,fx:'tidal'}
]);
const smooth=THREE.MathUtils.smoothstep,q=new THREE.Quaternion(),yAxis=new THREE.Vector3(0,1,0);
function chargePose(){return {hips:[-.06,0,0],spine:[.16,0,0],chest:[.10,0,0],neck:[.08,0,0],l_shoulder:[.2,-1.0,.35],r_shoulder:[.2,1.0,-.35],l_elbow:[.35,0,0],r_elbow:[.35,0,0],l_wrist:[-.45,.35,.55],r_wrist:[-.45,-.35,-.55],l_thigh:[-.05,0,.10],r_thigh:[-.05,0,-.10],l_knee:[.25,0,0],r_knee:[.35,0,0],l_ankle:[-.30,0,0],r_ankle:[-.30,0,0]};}
function strikePose(id,u){const wave=Math.sin(Math.PI*u),a=Math.sin(u*Math.PI*2),p={hips:[-.08,0,0],spine:[-.10,0,.12*a],chest:[-.08,0,0],neck:[-.06,0,0],l_shoulder:[.1,-.1,-.35],r_shoulder:[.1,.1,.35],l_elbow:[.25,0,0],r_elbow:[.25,0,0],l_thigh:[.1,0,.14],r_thigh:[-.1,0,-.14],l_knee:[.22,0,0],r_knee:[.28,0,0],l_ankle:[-.35,0,0],r_ankle:[-.35,0,0]};
 if(id==='spiral-kick'){p.spine=[-.28,.25,.16*a];p.l_thigh=[-.85*wave,0,.55*wave];p.l_knee=[.14,0,0];p.r_thigh=[.30,0,-.10];p.r_knee=[.85,0,0];p.l_shoulder=[0,0,.3];p.r_shoulder=[0,0,-.3];}
 if(id==='cross-blades'){p.spine=[-.15,.45*a,.18*a];p.l_shoulder=[.25,-.75,.7-1.5*u];p.r_shoulder=[.25,.75,-.7+1.5*u];p.l_elbow=p.r_elbow=[.35,0,0];p.r_knee=[.65,0,0];}
 if(id==='diagonal-slash'){p.spine=[-.22,.35*a,.25*a];p.r_shoulder=[.2,.8,-.7+1.6*u];p.r_elbow=[.2+.4*(1-wave),0,0];p.l_thigh=[-.25,0,.25];p.r_thigh=[.3,0,-.2];}
 if(id==='crescent-kick'){p.spine=[-.12,0,-.10*wave];p.l_thigh=[-.8*wave,0,.8*wave];p.l_knee=[.12,0,0];p.r_knee=[.55,0,0];p.l_shoulder=[0,-.2,.7];}
 if(id==='palm-wave'){p.spine=[.12-.38*wave,0,0];p.l_shoulder=[.15,-1.4,-.12];p.r_shoulder=[.15,1.4,.12];p.l_elbow=p.r_elbow=[.85*(1-wave)+.12,0,0];p.l_thigh=[.28,0,.2];p.r_thigh=[.28,0,-.2];}
 if(id==='lotus-burst'){p.spine=[-.34*wave,0,0];p.l_shoulder=[0,-.25,.8*wave];p.r_shoulder=[0,.25,-.8*wave];p.l_thigh=[-.14,0,.55*wave];p.r_thigh=[-.14,0,-.55*wave];p.l_knee=p.r_knee=[.10,0,0];}
 if(id==='halo-guard'){p.l_shoulder=[.1,-.35,1.25];p.r_shoulder=[.1,.35,-1.25];p.l_elbow=p.r_elbow=[.65,0,0];p.spine=[-.24,.24*a,.26*a];p.r_knee=[.8,0,0];}
 if(id==='twin-kick'){p.spine=[-.25,0,.22*a];for(const [prefix,offset]of [['l_',0],['r_',Math.PI]]){const kick=.5+.5*Math.sin(u*Math.PI*3+offset);p[prefix+'thigh']=[-.9*kick,0,prefix==='l_'?.22:-.22];p[prefix+'knee']=[1.1*(1-kick)+.12,0,0];}p.l_shoulder=[0,0,.25];p.r_shoulder=[0,0,-.25];}
 if(id==='sword-dance'){p.spine=[-.18,.25*a,.18*a];p.l_shoulder=[.2,-.8,.7+Math.sin(u*9)*.5];p.r_shoulder=[.2,.8,-.7+Math.cos(u*9)*.5];p.l_elbow=[.3,0,0];p.r_elbow=[.4,0,0];p.l_thigh=[.25,0,.22];p.r_thigh=[-.25,0,-.2];p.l_knee=[.55,0,0];}
 if(id==='tidal-release'){p.spine=[-.36*wave,0,0];p.chest=[-.16,0,0];p.neck=[-.18,0,0];p.l_shoulder=[0,-.2,1.35*wave];p.r_shoulder=[0,.2,-1.35*wave];p.l_thigh=[0,0,.42*wave];p.r_thigh=[0,0,-.42*wave];p.l_knee=p.r_knee=[.12,0,0];}const extension=Math.pow(Math.sin(Math.PI*u),.7);for(const side of ['l_','r_']){if(id!=='palm-wave')p[side+'elbow'][0]*=1-extension*.55;if(['spiral-kick','crescent-kick','twin-kick'].includes(id)){p[side+'thigh'][0]*=1.20;p[side+'ankle'][0]=-.48;if(p[side+'knee'][0]<.3)p[side+'knee'][0]=THREE.MathUtils.lerp(p[side+'knee'][0],.055,extension);}}
 const element=combatMoves.find(move=>move.id===id)?.element;
 if(element==='fire'){p.l_wrist=[-.2,.45,.7];p.r_wrist=[-.2,-.45,-.7];}
 else if(element==='cold-fire'){p.l_wrist=[-.62,.28,.48*wave];p.r_wrist=[-.62,-.28,-.48*wave];}
 else {p.l_wrist=[.15,.2,.35];p.r_wrist=[.15,-.2,-.35];}
 return p;
}
export function applyCombatPose(root){const s=root.userData.combatPose;const actor=root.userData.combatPPO;if(!s){actor?.pause();return;}const b=root.userData.bones,c=chargePose(),u=s.stage==='strike'?s.progress:1,target=s.stage==='charge'?c:strikePose(s.id,u),blend=s.stage==='charge'?smooth(s.progress,0,1):s.stage==='recover'?1-smooth(s.progress,0,1):1,release=s.stage==='strike'?smooth(s.progress,0,.22):1;
 const posed={};for(const [name,angles]of Object.entries(target))posed[name]=s.stage==='strike'?angles.map((v,i)=>THREE.MathUtils.lerp(c[name]?.[i]||0,v,release)):angles.slice();
 if(actor?.pose(root,s,posed,blend)){if(posed.hips){q.setFromEuler(new THREE.Euler(...posed.hips));b.hips.quaternion.slerp(q,blend*.98);}if(s.stage!=='charge'&&['spiral-kick','sword-dance'].includes(s.id)){q.setFromAxisAngle(yAxis,Math.PI*2*u);b.hips.quaternion.multiply(q);}root.updateMatrixWorld(true);root.userData.combatPoseStats={...s,blend,source:root.userData.combatPPOStats?.source||'ppo',finite:Object.values(b).every(bone=>bone.quaternion.toArray().every(Number.isFinite))};return;}
 for(const [name,values]of Object.entries(posed)){q.setFromEuler(new THREE.Euler(...values));b[name].quaternion.slerp(q,blend*.98);}
 if(s.stage!=='charge'&&['spiral-kick','sword-dance'].includes(s.id)){q.setFromAxisAngle(yAxis,Math.PI*2*u);b.hips.quaternion.multiply(q);}root.updateMatrixWorld(true);root.userData.combatPoseStats={...s,blend,source:'authored',finite:Object.values(b).every(bone=>bone.quaternion.toArray().every(Number.isFinite))};}
