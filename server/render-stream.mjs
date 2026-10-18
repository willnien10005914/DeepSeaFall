import {spawn} from 'node:child_process';
import {FragmentedMP4} from './mp4-stream.mjs';
import {WebSocket} from 'ws';
const WIDTH=480,HEIGHT=864,FPS=20;
export function cloudSnapshot(s,screen=[]){
  const {tick,generation,t,runId,scoreboard,depth,running,stamina,loot,affection,seaweed,dressDamage,sleeping,boost,whaleCd,magicCd,combat,events,collisions,minimumClearance}=s;
  return {tick,generation,t,runId,scoreboard,depth,running,stamina,loot,affection,seaweed,dressDamage,sleeping,boost,whaleCd,magicCd,combat,events,collisions,minimumClearance,biome:s.biome,whale:{state:s.whale.state},screen,
    players:s.players.map(({id,name,color,treasures,points})=>({id,name,color,treasures,points}))};
}
export class RenderStream {
  constructor({room,url,seed}){Object.assign(this,{room,url,seed});this.viewers=new Map();this.screen=[];this.ready=false;this.frames=0;this.fragments=0;this.gop=[];this.latest=null;this.error=null;}
  health(){return {ready:this.ready,renderer:this.renderer||null,width:WIDTH,height:HEIGHT,fps:FPS,viewers:this.viewers.size,capturedFrames:this.frames,fragments:this.fragments,codec:this.encoder?'h264':'jpeg',error:this.error};}
  async start(browser){
    this.page=await browser.newPage({viewport:{width:WIDTH,height:HEIGHT},deviceScaleFactor:1});
    this.page.on('pageerror',e=>{this.error=e.message;console.error('Cloud renderer:',e.message);});
    await this.page.addInitScript(seed=>{
      window.__MP_RENDERER=true;window.__MP_SEED=seed;window.__cloudActive=false;
      const raf=window.requestAnimationFrame.bind(window),cancel=window.cancelAnimationFrame.bind(window);
      const pending=new Set();let scheduled=0;
      const schedule=()=>{
        if(!window.__cloudActive||scheduled||!pending.size)return;
        scheduled=raf(t=>{scheduled=0;if(!window.__cloudActive)return;const callbacks=[...pending];pending.clear();for(const cb of callbacks)cb(t);schedule();});
      };
      window.requestAnimationFrame=cb=>{pending.add(cb);schedule();return 0;};
      window.__setCloudActive=active=>{window.__cloudActive=active;if(!active&&scheduled){cancel(scheduled);scheduled=0;}schedule();};
    },this.seed);
    await this.page.goto(this.url+'?render=local');
    await this.page.waitForFunction(()=>window.__deepSeaFall?._authoredAssets,null,{timeout:90000,polling:100});
    this.renderer=await this.page.evaluate(async()=>{
      const g=window.__deepSeaFall,{SeaReplica}=await import('/js/multiplayer/replica.js?v=50'),T=await import('three');
      g.sun.shadow.mapSize.set(512,512);
      await g.start('manual');g.audio.track.pause();g.audio.ctx?.suspend();
      const replica=window.__cloudReplica=new SeaReplica(g,'shared-camera',()=>{});
      window.__acceptCloud=s=>{replica.receive(s);return [...replica.avatars].map(([id,a])=>{
        const p=a.root.userData.bones.head.getWorldPosition(new T.Vector3()).add(new T.Vector3(0,.25,0)).project(g.camera);
        return {id,x:p.x*.5+.5,y:-p.y*.5+.5,visible:p.z<1&&Math.abs(p.x)<1.2&&Math.abs(p.y)<1.2};
      });};
      const style=document.createElement('style');style.textContent='body{background:#061a28} #app{box-shadow:none} #hud,#bottomDock,#aiPanel,.screen,.mp-label-layer,#gameFeedback{display:none!important}';document.head.append(style);
      const gl=g.renderer.getContext(),x=gl.getExtension('WEBGL_debug_renderer_info');
      return x?gl.getParameter(x.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);
    });
    this.cdp=await this.page.context().newCDPSession(this.page);
    this.cdp.on('Page.screencastFrame',e=>{
      void this.cdp.send('Page.screencastFrameAck',{sessionId:e.sessionId}).catch(()=>{});
      if(!this.viewers.size)return;
      const now=performance.now();if(now-(this.lastCapture||0)<45)return;this.lastCapture=now;
      this.jpeg=Buffer.from(e.data,'base64');this.frames++;
      for(const [ws,v] of this.viewers)if(v.codec==='jpeg'&&now-(v.lastJPEG||0)>95&&ws.bufferedAmount<192*1024){v.lastJPEG=now;this.binary(ws,2,this.jpeg);}
    });
    this.startEncoder();
    this.ready=true;
    if(this.viewers.size)this.setActive();
    if(this.latest)this.push(this.latest);
  }
  startEncoder(){
    const parser=new FragmentedMP4();
    const child=this.encoder=spawn(process.env.FFMPEG||'ffmpeg',[
      '-hide_banner','-loglevel','error','-f','image2pipe','-probesize','32','-analyzeduration','0','-fpsprobesize','0','-c:v','mjpeg','-framerate',String(FPS),'-i','pipe:0','-an',
      '-c:v','libx264','-preset','ultrafast','-tune','zerolatency','-threads','2','-pix_fmt','yuv420p','-profile:v','baseline','-level','3.0','-bf','0',
      '-g',String(FPS),'-keyint_min',String(FPS),'-sc_threshold','0','-b:v','1000k','-maxrate','1400k','-bufsize','600k',
      '-movflags','empty_moov+default_base_moof+frag_keyframe','-frag_duration','100000','-f','mp4','pipe:1',
    ],{stdio:['pipe','pipe','pipe']});
    child.on('error',e=>this.encoderFailed(e.message));
    child.on('exit',code=>{if(!this.closing)this.encoderFailed('Video encoder exited '+code);});
    child.stderr.on('data',b=>console.warn('Cloud encoder:',b.toString().slice(0,500)));
    child.stdin.on('error',()=>{});
    child.stdout.on('data',b=>{try{parser.push(b);}catch(e){this.encoderFailed(e.message);}});
    parser.on('init',data=>{this.init=data;for(const [ws,v]of this.viewers)if(v.codec==='mp4')this.binary(ws,0,data);});
    parser.on('fragment',(data,key)=>{
      if(key)this.gop=[];this.gop.push(data);if(this.gop.length>24)this.gop=[];
      this.fragments++;
      for(const [ws,v]of this.viewers)if(v.codec==='mp4'){
        if(ws.bufferedAmount>512*1024){ws.close(1013,'Video connection behind live');continue;}
        if(!v.started){if(!key)continue;v.started=true;}
        this.binary(ws,1,data);
      }
    });
    child.stdin.on('drain',()=>this.encoderBlocked=false);
    this.encodeTimer=setInterval(()=>{
      if(!this.viewers.size||!this.jpeg||this.encoderBlocked||!this.encoder)return;
      this.encoderBlocked=!child.stdin.write(this.jpeg);
    },1000/FPS);
  }
  encoderFailed(message){if(!this.encoder)return;this.error=message;const child=this.encoder;this.encoder=null;child.kill('SIGTERM');clearInterval(this.encodeTimer);for(const [ws,v] of this.viewers)if(v.codec==='mp4')ws.send(JSON.stringify({type:'stream-info',codec:'jpeg'}));}
  binary(ws,kind,data){if(ws.readyState===WebSocket.OPEN)ws.send(Buffer.concat([Buffer.from([kind]),data]));}
  subscribe(ws,m){
    const p=this.room.authenticate(m.token);if(!p){ws.close(1008,'Join sea first');return;}
    for(const [peer,v]of this.viewers)if(v.id===p.id&&peer!==ws)peer.close(1000,'Video replaced');
    const first=this.viewers.size===0;
    const codec=m.codec==='mp4'&&this.encoder?'mp4':'jpeg',v={id:p.id,codec,started:false};this.viewers.set(ws,v);
    ws.send(JSON.stringify({type:'stream-info',codec,width:WIDTH,height:HEIGHT,fps:FPS}));
    if(codec==='mp4'&&this.init){
      // A new room still needs the encoder's MP4 header. Only cached picture
      // fragments belong to a generation; omitting init breaks later joins.
      this.binary(ws,0,this.init);
      if(this.latest?.generation===this.room.generation){for(const data of this.gop)this.binary(ws,1,data);v.started=this.gop.length>0;}
    }
    if(codec==='jpeg'&&this.jpeg)this.binary(ws,2,this.jpeg);
    if(first)this.setActive();
    if(this.latest)this.push(this.latest);
    const timer=setInterval(()=>{if(ws.readyState===WebSocket.OPEN)ws.ping();},15000);
    ws.once('close',()=>{clearInterval(timer);this.viewers.delete(ws);if(!this.viewers.size){this.gop=[];this.jpeg=null;this.setActive();}});
  }
  setActive(){
    if(!this.ready)return;
    // CDP screencast is restarted after idle, alongside the parked render loop.
    // Serializing these transitions prevents a last close overtaking a join.
    this.activation=(this.activation||Promise.resolve()).catch(()=>{}).then(async()=>{
      const active=this.viewers.size>0;
      if(!active){await this.cdp.send('Page.stopScreencast');await this.page.evaluate(()=>window.__setCloudActive(false));}
      else {await this.cdp.send('Page.startScreencast',{format:'jpeg',quality:72,maxWidth:WIDTH,maxHeight:HEIGHT,everyNthFrame:1});await this.page.evaluate(()=>window.__setCloudActive(true));}
    }).catch(e=>{if(!this.closing)this.error=e.message;});
  }
  remove(id){for(const [ws,v]of this.viewers)if(v.id===id)ws.close(1000,'Swimmer disconnected');}
  push(state){
    if(this.latest?.generation!==state.generation){this.gop=[];this.jpeg=null;this.screen=[];}
    this.latest=state;
    if(!this.ready||!this.viewers.size||this.pushing)return;
    this.pushing=true;
    this.page.evaluate(s=>window.__acceptCloud(s),state).then(screen=>{this.screen=screen;}).catch(e=>{this.error=e.message;}).finally(()=>this.pushing=false);
  }
  async close(){this.closing=true;clearInterval(this.encodeTimer);for(const ws of this.viewers.keys())ws.close(1001,'Server restarting');this.encoder?.kill('SIGTERM');await this.page?.close().catch(()=>{});}
}
