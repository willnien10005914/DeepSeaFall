import * as THREE from 'three';
import {reactionWeights} from './reaction-weights.js?v=42';
export function inferReaction(observation){
 let values=observation;
 reactionWeights.layers.forEach((layer,index)=>{
  values=layer.bias.map((bias,row)=>{
   let sum=bias;for(let k=0;k<values.length;k++)sum+=layer.weights[row][k]*values[k];
   return index<2||row<2?Math.tanh(sum):1/(1+Math.exp(-sum));
  });
 });return values;
}
const clamp=THREE.MathUtils.clamp;
export class SwimReactions{
 constructor(){this.reset()}
 reset(){this.target=null;this.intent='cruise';this.targetSince=0;this.lastMessageTime=-10;this.status={intent:'cruise',source:'trained local imitation policy'}}
 update(game,dt){
  const centre=game.girl.position.clone().add(new THREE.Vector3(0,.70,0)),candidates=[];
  for(const e of game.entities){
   if(e.dead||!['rock','creature','loot','predator','wildlife'].includes(e.kind))continue;
   const jelly=e.mesh.userData.marine?.kind==='jelly',danger=e.hostile||jelly||e.kind==='rock';
   const radius=e.kind==='wildlife'?(e.mesh.userData.exotic.species==='kraken'?2.2:e.hostile?1.3:.25):e.kind==='predator'?1.25:e.kind==='rock'?1.1:jelly?.7:e.kind==='loot'?.12:.22;
   const distance=e.mesh.position.distanceTo(centre);
   if(distance>6.2)continue;
   const position=e.mesh.position.clone(),vy=.85*(game.sleeping?.75:1)*(1+game.boost)+(jelly?.12:0);
   candidates.push({object:e.mesh,position,danger,radius,distance,vx:e.mesh.userData.vx||0,vy,kind:e.kind==='wildlife'?e.mesh.userData.exotic.species:e.kind==='rock'?'rock':jelly?'jelly':e.kind==='loot'?'loot':'fish'});
  }
  if(game.whaleState==='following'){
   // A flank surface, rather than the giant animal's origin inside its body.
   const position=game.whale.localToWorld(new THREE.Vector3(1.8,.45,1.65)),distance=position.distanceTo(centre);
   if(distance<6)candidates.push({object:game.whale,position,danger:false,radius:.45,distance,vx:game.swimVelocity.x*.65,vy:game.swimVelocity.y*.65,kind:'whale'});
  }
  const curiosity=game.prompt==='careful'?.45:game.prompt==='explore'?1:.8;
  for(const c of candidates){
   const delta=c.position.clone().sub(centre);
   c.output=inferReaction([delta.x/4,delta.y/4,delta.z/4,c.vx/2,c.vy/2,game.swimVelocity.x/2,game.swimVelocity.y/2,c.danger?1:0,c.radius/1.4,curiosity]);
   c.score=c.danger?c.output[3]:c.output[2]*Math.exp(-c.distance*.12)+(this.target===c.object ? .16 : 0)+(game.prompt==='treasure'&&c.kind==='loot' ? .4 : 0);
   c.velocity=new THREE.Vector3(c.output[0]*2,c.output[1]*2,0);
  }
  const dangers=candidates.filter(c=>c.danger&&c.score>.16).sort((a,b)=>b.score-a.score);
  const friendly=candidates.filter(c=>!c.danger&&c.score>.10).sort((a,b)=>b.score-a.score);
  let selected=dangers[0]||friendly[0],velocity=new THREE.Vector3(),intent='cruise';
  if(selected){
   velocity.copy(selected.velocity);
   if(selected.danger){
    intent='avoid';
    for(const c of dangers.slice(1,3))velocity.addScaledVector(c.velocity,.45);
    // A deterministic last-metre safety layer backs up the learned policy;
    // this is deliberately documented separately from training.
    for(const c of dangers){
     const delta=centre.clone().sub(c.position),edge=c.distance-c.radius;
     if(edge<.8&&Math.abs(delta.z)<c.radius+.6){delta.z=0;if(delta.lengthSq()<.001)delta.set(1,0,0);delta.normalize();
      const inward=velocity.dot(delta);if(inward<.55)velocity.addScaledVector(delta,.55-inward);}
    }
   }else{
    if(this.target!==selected.object){this.targetSince=game.t;this.target=selected.object}
    const probe=selected.distance<selected.radius+1.65&&game.t-this.targetSince>.9;
    intent=probe?'probe':'approach';
    // Observe at a comfortable distance and gently match the animal's drift.
    if(probe)velocity.multiplyScalar(.50).add(new THREE.Vector3(selected.vx*.30,selected.vy*.22,0));
   }
  }else this.target=null;
  if(game.sleeping){velocity.set(0,0,0);intent='float';selected=null}
  if(game.girl.position.x>2.8&&velocity.x>0)velocity.x*=clamp((3.2-game.girl.position.x)/.4,0,1);
  if(game.girl.position.x<-2.8&&velocity.x<0)velocity.x*=clamp((game.girl.position.x+3.2)/.4,0,1);
  if(game.girl.position.y>1.4&&velocity.y>0)velocity.y*=clamp((1.8-game.girl.position.y)/.4,0,1);
  if(game.girl.position.y<-.8&&velocity.y<0)velocity.y*=clamp((game.girl.position.y+1.2)/.4,0,1);
  velocity.clampLength(0,intent==='avoid'?2.5:1.25);
  const changed=intent!==this.intent;this.intent=intent;
  if(selected&&changed&&game.t-this.lastMessageTime>3){
   this.lastMessageTime=game.t;
   const names={fish:'小魚',jelly:'水母',whale:'座頭鯨',rock:'岩石',loot:'海中寶物',clownfish:'小丑魚',cutlassfish:'白帶魚','sea-snake':'海蛇',kraken:'深海海怪'};
   game.ui.whaleLine(intent==='avoid'?'轉身繞開'+names[selected.kind]+'，保持距離。':intent==='probe'?'停一下，伸手觀察'+names[selected.kind]+'。':'慢慢靠近'+names[selected.kind]+'，看看牠的反應。');
  }
  this.status={intent,kind:selected?.kind||null,distance:selected?.distance??null,target:selected?.object.name||null,source:'trained local imitation policy',modelVersion:8};
  game.girl.userData.reaction={...this.status};
  return {velocity,intent,lookAt:selected?.position||null};
 }
}
