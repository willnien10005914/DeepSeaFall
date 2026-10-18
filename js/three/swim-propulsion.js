// Kinematic stroke timing: gather -> reach -> kick -> glide. Metres/seconds.
export const swimLimits=Object.freeze({horizontal:1.45,up:.46,down:.54,acceleration:.95,cycle:2.05});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const approach=(v,target,amount)=>v+clamp(target-v,-amount,amount);
export class SwimPropulsion{
 constructor(){this.reset()}
 reset(){this.velocity={x:0,y:0,z:0};this.knockback={x:0,y:0,z:0};this.elapsed=0;this.sign=0;this.active=false;this.last={stage:'idle',progress:0,diveWeight:0,ascentWeight:0};}
 impulse(x,y,z=0){this.knockback.x=clamp(this.knockback.x+x,-.85,.85);this.knockback.y=clamp(this.knockback.y+y,-.65,.65);this.knockback.z=clamp(this.knockback.z+z,-.35,.35)}
 update(dt,desired,{sleeping=false,style=null}={}){
  dt=clamp(dt,0,.12);const target={x:clamp(desired.x,-swimLimits.horizontal,swimLimits.horizontal),y:clamp(desired.y,style?-.90:-swimLimits.down,style?.85:swimLimits.up),z:0};
  const active=!sleeping&&Math.hypot(target.x,target.y)>.07,sign=Math.abs(target.y)>.12?Math.sign(target.y):0;
  if(active&&(!this.active||(sign&&this.sign&&sign!==this.sign)))this.elapsed=0;
  if(active)this.elapsed+=dt;else this.elapsed=0;
  if(sign)this.sign=sign;this.active=active;
  const cycle=style==='breaststroke'?3.4:style==='freestyle'?2.4:swimLimits.cycle;const phase=this.elapsed%cycle*(swimLimits.cycle/cycle);let stage='idle',progress=0,gain=0;
  if(active){if(phase<.48){stage='gather';progress=phase/.48;gain=style?.32:.10}else if(phase<.88){stage='reach';progress=(phase-.48)/.4;gain=style?.65:.32}else if(phase<1.30){stage='kick';progress=(phase-.88)/.42;gain=1}else{stage='glide';progress=(phase-1.30)/.75;gain=style?.85:.72}}
  for(const axis of ['x','y']){const desiredSpeed=active?target[axis]*gain:0;this.velocity[axis]=approach(this.velocity[axis],desiredSpeed,dt*(active?swimLimits.acceleration:1.05));}
  const orient=stage==='gather'?0:stage==='reach'?progress*.72:stage==='idle'?0:1;
  const vertical=Math.abs(target.y)/(target.y<0?swimLimits.down:swimLimits.up),weight=orient*clamp((vertical-.22)/.78,0,1);
  const result={x:this.velocity.x+this.knockback.x,y:this.velocity.y+this.knockback.y,z:this.knockback.z};
  for(const axis of ['x','y','z'])this.knockback[axis]*=Math.exp(-dt*5);
  this.last={stage,progress,phase,active,style,diveWeight:target.y<0?weight:0,ascentWeight:target.y>0?weight:0,target:{...target},velocity:{...result}};return result;
 }
}
