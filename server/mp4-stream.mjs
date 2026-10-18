import {EventEmitter} from 'node:events';
// ffmpeg writes arbitrary pipe chunks; publish complete init/fragment units.
export class FragmentedMP4 extends EventEmitter {
  constructor(){super();this.pending=Buffer.alloc(0);this.initial=[];this.fragment=[];}
  push(data){
    this.pending=Buffer.concat([this.pending,data]);
    while(this.pending.length>=8){
      let size=this.pending.readUInt32BE(0),header=8;
      if(size===1){if(this.pending.length<16)return;size=Number(this.pending.readBigUInt64BE(8));header=16;}
      if(size<header||size>32*1024*1024)throw Error('Invalid MP4 box');
      if(this.pending.length<size)return;
      const box=this.pending.subarray(0,size),type=box.toString('ascii',4,8);this.pending=this.pending.subarray(size);
      if(type==='ftyp'||type==='moov'){this.initial.push(box);if(type==='moov')this.emit('init',Buffer.concat(this.initial));}
      else if(type==='moof'){this.fragment=[box];this.keyframe=isKeyframe(box);}
      else if(type==='mdat'&&this.fragment.length){this.fragment.push(box);this.emit('fragment',Buffer.concat(this.fragment),this.keyframe);this.fragment=[];}
    }
  }
}
function boxes(buffer,offset=8){const out=[];while(offset+8<=buffer.length){const n=buffer.readUInt32BE(offset);if(n<8||offset+n>buffer.length)break;out.push(buffer.subarray(offset,offset+n));offset+=n;}return out;}
export function isKeyframe(moof){
  for(const traf of boxes(moof).filter(b=>b.toString('ascii',4,8)==='traf')){
    const children=boxes(traf),head=children.find(b=>b.toString('ascii',4,8)==='tfhd'),run=children.find(b=>b.toString('ascii',4,8)==='trun');
    if(!head||!run)continue;
    const hf=head.readUIntBE(9,3),rf=run.readUIntBE(9,3);let p=16,flags=0x10000;
    if(hf&1)p+=8;if(hf&2)p+=4;if(hf&8)p+=4;if(hf&16)p+=4;if(hf&32)flags=head.readUInt32BE(p);
    p=16;if(rf&1)p+=4;
    if(rf&4)flags=run.readUInt32BE(p);
    else if(rf&0x400){if(rf&0x100)p+=4;if(rf&0x200)p+=4;flags=run.readUInt32BE(p);}
    return !(flags&0x10000);
  }
  return false;
}
