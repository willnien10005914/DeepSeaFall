import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import {mkdir,writeFile} from 'node:fs/promises';
const base=process.env.TEST_URL||'http://127.0.0.1:8897',out=process.env.TEST_OUT||'.runtime/cloud';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-webgl']});
const contexts=[],errors=[],forbidden=[],requests=[];
const report={browser:'Chromium mobile emulation, WebGL disabled; not a physical iPhone test'};
const health=async()=>(await fetch(base+'/api/health')).json();
async function phone(name,legacy=false){
 const c=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true});contexts.push(c);
 if(legacy)await c.addInitScript(()=>{window.MediaSource=undefined;window.ManagedMediaSource=undefined;});
 await c.route('**/*',route=>{
  const url=route.request().url();requests.push(url);
  if(/\.glb(?:\?|$)|\/vendor\/|\/game3d\.js|\/authored\.js/.test(url)){forbidden.push(url);return route.abort();}
  return route.continue();
 });
 const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));
 // Model downloading remains blocked regardless of the network condition.
 const network=await c.newCDPSession(p);
 await network.send('Network.enable');
 await network.send('Network.emulateNetworkConditions',{offline:false,latency:100,downloadThroughput:300000,uploadThroughput:100000});
 const start=performance.now();
 await p.goto(base);await p.locator('#playerName').waitFor();
 await p.fill('#playerName',name);await p.click('#btnStartManual');
 await p.waitForFunction(()=>__deepSeaFall.player?.stats.frames>3,null,{timeout:45000});
 assert(await p.evaluate(()=>__deepSeaFall.remote));
 return {p,elapsed:performance.now()-start};
}
try{
 for(let n=0;n<100;n++){if((await health()).streaming.ready)break;await new Promise(r=>setTimeout(r,100));}
 const a=await phone('Athena 串流'),b=await phone('Mazu 舊機',true);
 await a.p.waitForFunction(()=>__multiplayer.lastState.players.length===2);
 const video=await a.p.evaluate(()=>({stats:{...__deepSeaFall.player.stats},ready:cloudVideo.readyState,paused:cloudVideo.paused,width:cloudVideo.videoWidth,height:cloudVideo.videoHeight}));
 assert.equal(video.stats.codec,'mp4');assert(video.ready>=2&&!video.paused);assert.equal(video.width,480);
 const fallback=await b.p.evaluate(()=>({stats:{...__deepSeaFall.player.stats},width:cloudImage.naturalWidth,height:cloudImage.naturalHeight}));
 assert.equal(fallback.stats.codec,'jpeg');assert.equal(fallback.width,480);
 await a.p.locator('.mp-chat-toggle').click();await b.p.locator('.mp-chat-toggle').click();
 await a.p.fill('.mp-chat-form input','手機不用下載模型也能一起游！');await a.p.locator('button[type=submit]').click();
 await b.p.waitForFunction(()=>document.querySelector('.mp-messages').textContent.includes('不用下載模型'));
 const previous=await a.p.evaluate(()=>({frame:__deepSeaFall.player.stats.frames,bytes:__deepSeaFall.player.stats.bytes,x:__multiplayer.lastState.screen.find(p=>p.id===__multiplayer.id)?.x}));
 await a.p.touchscreen.tap(330,260);await a.p.waitForTimeout(3000);
 const moved=await a.p.evaluate(()=>__multiplayer.lastState.screen.find(p=>p.id===__multiplayer.id)?.x);
 assert(Number.isFinite(moved));
 await a.p.locator('#btnWhale').click();await b.p.waitForFunction(()=>__multiplayer.lastState.whale.state!=='hidden');
 await a.p.selectOption('#attackStyle','spiral-kick');await a.p.locator('#btnAttack').click();
 await b.p.waitForFunction(()=>__multiplayer.lastState.combat.stage!=='ready');assert(await b.p.locator('#btnAttack').isDisabled());
 const now=await a.p.evaluate(()=>({frames:__deepSeaFall.player.stats.frames,bytes:__deepSeaFall.player.stats.bytes}));
 assert(now.frames>previous.frame+10);
 const id=await a.p.evaluate(()=>__multiplayer.id),beforeReconnect=await a.p.evaluate(()=>__deepSeaFall.player.startedAt);
 await a.p.evaluate(()=>__deepSeaFall.player.ws.close());
 await a.p.waitForFunction(old=>__deepSeaFall.player.startedAt>old && __deepSeaFall.player.ws.readyState===1 && cloudVideo.currentTime>0 && !cloudVideo.paused && cloudVideo.readyState>=2,beforeReconnect,{timeout:20000});
 assert.equal(await a.p.evaluate(()=>__multiplayer.id),id);
 await a.p.screenshot({path:out+'/h264-phone.png'});await b.p.screenshot({path:out+'/jpeg-fallback.png'});
 const h=await health();assert(h.streaming.ready&&h.streaming.viewers===2);assert.match(h.streaming.renderer,/NVIDIA GB10/);assert.equal(h.streaming.error,null);
 report.h264={...video,totalEntryMs:a.elapsed};report.fallback={...fallback,totalEntryMs:b.elapsed};
 report.sharedControls={chat:true,whale:true,attack:true,videoReconnectKeepsIdentity:true,projectedPositionBefore:previous.x,projectedPositionAfter:moved};
 report.health=h;report.forbiddenAssetRequests=forbidden;report.requestedResources=requests.map(u=>new URL(u).pathname);
 assert.deepEqual(forbidden,[]);assert.deepEqual(errors,[]);report.errors=errors;
 for(const c of contexts)await c.close();
 for(let n=0;n<100;n++){if(!(await health()).players)break;await new Promise(r=>setTimeout(r,100));}
 const idle=(await health()).streaming;assert.equal(idle.viewers,0);
 await new Promise(r=>setTimeout(r,1000));const after=(await health()).streaming;
 assert(after.capturedFrames-idle.capturedFrames<=2);report.idleRenderingPauses=true;
 await writeFile(out+'/verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{for(const c of contexts)await c.close().catch(()=>{});await browser.close();}
