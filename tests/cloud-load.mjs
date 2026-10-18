import WebSocket from 'ws';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
const base=process.env.TEST_URL||'http://127.0.0.1:8897',out=process.env.TEST_OUT||'.runtime/cloud';
const controls=[],videos=[],stats=[];let latest;
const delay=ms=>new Promise(r=>setTimeout(r,ms));
const health=async()=>(await fetch(base+'/api/health')).json();
function socket(path){return new WebSocket(base.replace(/^http/,'ws')+path,{headers:{Origin:base}});}
try{
 assert.equal((await health()).players,0,'Use an isolated idle room');
 // A video connection alone cannot claim an avatar or watch without joining.
 const denied=socket('/stream');
 const deniedCode=await new Promise((resolve,reject)=>{denied.on('open',()=>denied.send(JSON.stringify({type:'subscribe',token:'invalid',codec:'mp4'})));denied.on('close',resolve);denied.on('error',reject);});
 assert.equal(deniedCode,1008);
 for(let i=0;i<8;i++){
  const ws=socket('/ws');controls.push(ws);
  const welcome=await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error('Join timeout')),15000);
   ws.on('open',()=>ws.send(JSON.stringify({type:'join',name:`Stream ${i+1}`,render:'cloud'})));
   ws.on('message',raw=>{const m=JSON.parse(raw);if(m.type==='welcome'){clearTimeout(timer);resolve(m);}if(m.type==='snapshot')latest=m.state;if(m.type==='error')reject(Error(m.message));});ws.on('error',reject);
  });
  const view=socket('/stream'),row={init:0,fragments:0,bytes:0};videos.push(view);stats.push(row);
  await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error('First video fragment timeout')),30000);
   view.on('open',()=>view.send(JSON.stringify({type:'subscribe',token:welcome.token,codec:'mp4'})));
   view.on('message',(raw,binary)=>{if(!binary)return;row.bytes+=raw.length;if(raw[0]===0)row.init++;if(raw[0]===1){row.fragments++;clearTimeout(timer);resolve();}});view.on('error',reject);
  });
 }
 const before=await health();await delay(3000);const after=await health();
 assert.equal(after.players,8);assert.equal(after.streaming.viewers,8);
 assert(after.streaming.capturedFrames>before.streaming.capturedFrames+2);
 assert.equal(after.streaming.error,null);assert.equal(after.error,null);
 assert.equal(latest.players.length,8);assert.equal(latest.entities,undefined);
 assert(stats.every(s=>s.init===1&&s.fragments>1),JSON.stringify(stats));
 const report={clients:8,viewers:8,unauthorizedVideoRejected:true,sharedRenderer:after.streaming.renderer,captureFPSDuringSample:(after.streaming.capturedFrames-before.streaming.capturedFrames)/3,encodedFPS:after.streaming.fps,video:stats,health:after,validation:'Eight independent authenticated control/video socket pairs; browser video decoding is tested separately in cloud-browser.mjs.'};
 await mkdir(out,{recursive:true});await writeFile(out+'/load.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{for(const ws of [...videos,...controls])ws.close();}
