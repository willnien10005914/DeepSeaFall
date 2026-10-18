import * as THREE from 'three';

// Runtime flowmap adapter. Cell Fluids exports can replace the generated
// RG velocity map; no proprietary simulation code or unlicensed assets ship.
export class FluidFlow {
  constructor(size=64){
    this.size=size;this.accumulator=0;this.time=0;this.source='runtime incompressible flow';
    this.velocity=new Float32Array(size*size*2);this.next=new Float32Array(size*size*2);
    this.pressure=new Float32Array(size*size);this.pressureNext=new Float32Array(size*size);this.divergence=new Float32Array(size*size);
    this.pixels=new Uint8Array(size*size*4);this.texture=new THREE.DataTexture(this.pixels,size,size);this.texture.minFilter=this.texture.magFilter=THREE.LinearFilter;this.texture.wrapS=this.texture.wrapT=THREE.RepeatWrapping;this.texture.needsUpdate=true;
    this.external=null;this.disturbances=[];this.step(.04,0);
  }
  loadFlowMap(url,{source='Cell Fluids exported flowmap',flipY=false}={}){
    return new Promise((resolve,reject)=>new THREE.TextureLoader().load(url,t=>{t.wrapS=t.wrapT=THREE.RepeatWrapping;t.minFilter=t.magFilter=THREE.LinearFilter;t.flipY=flipY;this.external=t;this.source=source;resolve(t)},undefined,reject));
  }
  disturb(x,z,strength=1){this.disturbances.push({x,z,strength,age:0});if(this.disturbances.length>12)this.disturbances.shift();}
  update(dt,time){if(this.external)return;this.accumulator+=Math.min(dt,.12);if(this.accumulator>=.04){this.step(Math.min(this.accumulator,.08),time);this.accumulator=0}}
  step(dt,time){
    const n=this.size,v=this.velocity,next=this.next,p=this.pressure,pn=this.pressureNext,div=this.divergence;
    const idx=(x,y)=>((y+n)%n*n+(x+n)%n),sample=(x,y,k)=>{const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;return (v[idx(ix,iy)*2+k]*(1-fx)+v[idx(ix+1,iy)*2+k]*fx)*(1-fy)+(v[idx(ix,iy+1)*2+k]*(1-fx)+v[idx(ix+1,iy+1)*2+k]*fx)*fy};
    for(let y=0;y<n;y++)for(let x=0;x<n;x++){
      const i=y*n+x,a=i*2,px=x-v[a]*dt*n*.28,py=y-v[a+1]*dt*n*.28;
      const wx=x/n*32-16,wz=y/n*32-16;
      let fx=.22*Math.sin(wz*.26+time*.16)+.11*Math.cos((wx+wz)*.32-time*.09),fz=.20*Math.cos(wx*.26-time*.12)-.11*Math.cos((wx+wz)*.32-time*.09);
      for(const d of this.disturbances){const dx=wx-d.x,dz=wz-d.z,r=dx*dx+dz*dz+.8,force=Math.exp(-r/12)*d.strength*Math.exp(-d.age*1.4);fx+=(-dz/r)*force;fz+=(dx/r)*force;}
      next[a]=THREE.MathUtils.clamp(sample(px,py,0)*.985+fx*dt,-1,1);next[a+1]=THREE.MathUtils.clamp(sample(px,py,1)*.985+fz*dt,-1,1);
    }
    v.set(next);
    for(let y=0;y<n;y++)for(let x=0;x<n;x++){const i=y*n+x;div[i]=-.5*(v[idx(x+1,y)*2]-v[idx(x-1,y)*2]+v[idx(x,y+1)*2+1]-v[idx(x,y-1)*2+1]);p[i]=0;}
    for(let pass=0;pass<10;pass++){
      for(let y=0;y<n;y++)for(let x=0;x<n;x++){const i=y*n+x;pn[i]=(div[i]+p[idx(x-1,y)]+p[idx(x+1,y)]+p[idx(x,y-1)]+p[idx(x,y+1)])*.25;}
      p.set(pn);
    }
    for(let y=0;y<n;y++)for(let x=0;x<n;x++){
      const i=y*n+x,a=i*2;v[a]-=.5*(p[idx(x+1,y)]-p[idx(x-1,y)]);v[a+1]-=.5*(p[idx(x,y+1)]-p[idx(x,y-1)]);
      this.pixels[i*4]=Math.round((v[a]*.5+.5)*255);this.pixels[i*4+1]=Math.round((v[a+1]*.5+.5)*255);this.pixels[i*4+2]=Math.min(255,Math.round(Math.abs(div[i])*1800));this.pixels[i*4+3]=255;
    }
    this.disturbances=this.disturbances.filter(d=>(d.age+=dt)<4);this.time=time;this.texture.needsUpdate=true;
  }
}
