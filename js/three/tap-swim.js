// A tap is a bounded journey, independent of how long the pointer stays down.
export const swimArea=Object.freeze({left:-3.1,right:3.1,bottom:-1.12,top:1.72});
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export class TapSwim{
 constructor(){this.reset()}
 reset(){this.command=null;this.sequence=0;this.last=null;}
 setAspect(aspect){this.extentX=clamp((8.5*Math.tan(26*Math.PI/180)*aspect-.85)/.9,.65,3.1);if(this.command)this.command.target.x=clamp(this.command.target.x,-this.extentX,this.extentX);}
 cancel(reason='cancelled'){if(this.command)this.last={...this.command,reason};this.command=null;}
 tap(x,y,position){const target={x:clamp(x,-1,1)*(this.extentX??3.1),y:.30+clamp(y,-1,1)*1.42},dx=target.x-position.x,dy=target.y-position.y,duration=clamp(Math.max(Math.abs(dx)/.9,Math.abs(dy)/.54)+1.25,3.4,7.4);const style=this.sequence++%2===0?'freestyle':'breaststroke';this.command={target,style,motionSeed:Math.floor(Math.random()*4294967295),elapsed:0,duration,remaining:duration};return this.command;}
 retarget(x,y,position){if(!this.command)return this.tap(x,y,position);this.command.target={x:clamp(x,-1,1)*(this.extentX??3.1),y:.30+clamp(y,-1,1)*1.42};this.command.duration=this.command.elapsed+Math.max(3.4,Math.min(7.4,Math.hypot(this.command.target.x-position.x,this.command.target.y-position.y)/.55+1));}
 update(dt,position,{sleeping=false}={}){if(sleeping)this.cancel('sleep');const c=this.command;if(!c)return{active:false,x:0,y:0};c.elapsed+=Math.max(0,dt);c.remaining=Math.max(0,c.duration-c.elapsed);const dx=c.target.x-position.x,dy=c.target.y-position.y,distance=Math.hypot(dx,dy);if(c.remaining<=0||distance<.14){this.cancel(distance<.14?'arrived':'finished');return{active:false,x:0,y:0};}const ease=Math.min(1,c.remaining/.65);return{active:true,x:clamp(dx*1.65,-1.45,1.45)*ease,y:clamp(dy*1.65,-.90,.85)*ease,style:c.style,motionSeed:c.motionSeed,elapsed:c.elapsed,remaining:c.remaining,target:c.target};}
}
