import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {FragmentedMP4} from '../server/mp4-stream.mjs';
import {cloudSnapshot,RenderStream} from '../server/render-stream.mjs';
import {EventEmitter} from 'node:events';

test('H.264 init and keyframe fragments survive arbitrary pipe chunk boundaries',()=>{
 const r=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-f','lavfi','-i','color=c=blue:s=64x64:r=20','-t','1.25','-an','-c:v','libx264','-threads','1','-tune','zerolatency','-g','20','-keyint_min','20','-sc_threshold','0','-movflags','empty_moov+default_base_moof+frag_keyframe','-frag_duration','100000','-f','mp4','pipe:1'],{maxBuffer:4*1024*1024});
 assert.equal(r.status,0,r.stderr?.toString());
 const p=new FragmentedMP4(),fragments=[];let init;
 p.on('init',b=>init=b);p.on('fragment',(b,key)=>fragments.push({b,key}));
 for(let i=0;i<r.stdout.length;i+=37)p.push(r.stdout.subarray(i,i+37));
 assert(init.includes(Buffer.from('ftyp'))&&init.includes(Buffer.from('moov')));
 assert(fragments.length>=10);
 assert.equal(fragments.filter(f=>f.key).length,2);
 assert(fragments[0].key);
 const lastKey=fragments.findLastIndex(f=>f.key);
 const lateJoin=Buffer.concat([init,...fragments.slice(lastKey).map(f=>f.b)]);
 const decode=spawnSync('ffmpeg',['-hide_banner','-loglevel','error','-i','pipe:0','-f','null','-'],{input:lateJoin,maxBuffer:1024*1024});
 assert.equal(decode.status,0,decode.stderr?.toString());
});

test('streaming snapshots keep gameplay HUD and omit geometry/bones/entity recipes',()=>{
 const s={tick:4,generation:'new',players:[{id:'a',name:'Athena',color:'#fff',treasures:2,points:70,bones:{head:[0,0,0,1]},p:[0,1,0],observation:[1]}],entities:[{mesh:'large'}],whale:{state:'following',p:[1,2,3]},scoreboard:[{points:70}],stamina:80,combat:{stage:'ready'}};
 const data=cloudSnapshot(s,[{id:'a',x:.5,y:.4}]);
 assert.equal(data.players[0].points,70);assert.equal(data.stamina,80);
 assert.equal(data.players[0].bones,undefined);assert.equal(data.entities,undefined);
 assert.deepEqual(data.whale,{state:'following'});assert.equal(data.screen[0].id,'a');
});


test('first viewer in a new room gets MP4 init but no abandoned picture fragments',()=>{
 class Socket extends EventEmitter {
  readyState=1;bufferedAmount=0;sent=[];
  send(data){this.sent.push(data);}
 }
 const room={generation:'new-room',authenticate:()=>({id:'girl'})};
 const stream=new RenderStream({room,url:'unused',seed:1});
 stream.encoder={};stream.init=Buffer.from('mp4-init');stream.gop=[Buffer.from('old-pictures')];
 stream.latest={generation:'abandoned-room'};
 const ws=new Socket();stream.subscribe(ws,{token:'active',codec:'mp4'});
 const binary=ws.sent.filter(Buffer.isBuffer);
 assert.equal(binary.length,1);
 assert.equal(binary[0][0],0);assert.equal(binary[0].subarray(1).toString(),'mp4-init');
 ws.emit('close');
});
