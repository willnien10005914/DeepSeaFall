const MIME = 'video/mp4; codecs="avc1.42C01E"';
export class StreamPlayer {
  constructor(surface) {
    this.surface=surface;
    this.video=document.createElement('video');this.video.id='cloudVideo';
    this.video.muted=true;this.video.autoplay=true;this.video.playsInline=true;this.video.disableRemotePlayback=true;
    this.video.setAttribute('playsinline','');this.video.setAttribute('webkit-playsinline','');
    this.image=document.createElement('img');this.image.id='cloudImage';this.image.alt='即時海底畫面';this.image.hidden=true;
    this.status=document.createElement('p');this.status.className='cloud-status';this.status.setAttribute('role','status');this.status.textContent='加入後開始接收海底畫面';
    surface.append(this.video,this.image,this.status);
    this.stats={bytes:0,frames:0,codec:null,reconnects:0};
    this.video.addEventListener('playing',()=>this.showFrame());
    this.video.addEventListener('loadeddata',()=>this.showFrame());
    this.video.addEventListener('error',()=>{if(this.active && this.codec==='mp4')this.fallback();});
  }
  prime(){void this.video.play().catch(()=>{});}
  start(token, force) {
    this.stop();this.active=true;this.token=token;this.queue=[];this.queuedBytes=0;
    const Media=window.ManagedMediaSource||window.MediaSource;
    this.codec=force||(new URLSearchParams(location.search).get('stream')==='jpeg'?'jpeg':Media?.isTypeSupported?.(MIME)?'mp4':'jpeg');
    this.stats.codec=this.codec;
    this.status.hidden=false;this.status.textContent='正在接收海底畫面…';
    this.image.hidden=this.codec!=='jpeg';this.video.hidden=this.codec==='jpeg';
    this.startedAt=performance.now();this.lastFrameAt=0;this.lastVideoTime=-1;
    if(this.codec==='mp4') {
      try {
        this.media=new Media();this.videoURL=URL.createObjectURL(this.media);this.video.src=this.videoURL;
        this.media.addEventListener('sourceopen',()=>{
          if(!this.active || this.codec!=='mp4')return;
          try {
            this.buffer=this.media.addSourceBuffer(MIME);
            this.buffer.addEventListener('updateend',()=>this.flush());
            this.buffer.addEventListener('error',()=>this.fallback());
            this.flush();void this.video.play().catch(()=>{this.status.hidden=false;this.status.textContent='輕點海面開始播放';});
          } catch {this.fallback();}
        },{once:true});
      } catch {this.codec='jpeg';this.stats.codec='jpeg';this.image.hidden=false;this.video.hidden=true;}
    }
    const ws=this.ws=new WebSocket(`${location.protocol==='https:'?'wss:':'ws:'}//${location.host}/stream`);
    ws.binaryType='arraybuffer';
    ws.onopen=()=>ws.send(JSON.stringify({type:'subscribe',token:this.token,codec:this.codec}));
    ws.onmessage=e=>{
      if(ws!==this.ws)return;
      if(typeof e.data==='string'){
        const m=JSON.parse(e.data);
        if(m.type==='stream-error'){this.status.hidden=false;this.status.textContent=m.message;}
        if(m.type==='stream-info' && m.codec==='jpeg' && this.codec==='mp4')this.fallback();
        return;
      }
      const data=new Uint8Array(e.data);this.stats.bytes+=data.byteLength;
      if(data[0]===2 && this.codec==='jpeg')this.jpeg(data.subarray(1));
      else if((data[0]===0||data[0]===1) && this.codec==='mp4'){
        this.queue.push(data.subarray(1));this.queuedBytes+=data.length-1;
        if(this.queuedBytes>2*1024*1024){this.reconnect();return;}
        this.flush();
      }
    };
    ws.onclose=()=>{if(ws===this.ws && this.active)this.reconnect();};
    ws.onerror=()=>{};
    this.monitor=setInterval(()=>{
      if(this.codec==='mp4'){
        const b=this.video.buffered;
        if(b.length){const edge=b.end(b.length-1),start=b.start(b.length-1);this.stats.bufferSeconds=edge-this.video.currentTime;
          if(this.video.currentTime<start || edge-this.video.currentTime>1.4)this.video.currentTime=Math.max(start,edge-.28);
          if(this.video.readyState>=2 && this.video.currentTime>this.lastVideoTime+.001){this.lastFrameAt=performance.now();this.lastVideoTime=this.video.currentTime;this.stats.frames=this.video.getVideoPlaybackQuality?.().totalVideoFrames||this.stats.frames;}
        }
        if(!document.hidden && performance.now()-(this.lastFrameAt||this.startedAt)>15000)this.fallback();
      }
    },300);
  }
  flush(){
    const b=this.buffer;if(!b||b.updating||!this.active)return;
    try {
      if(b.buffered.length && this.video.currentTime-b.buffered.start(0)>6){b.remove(0,this.video.currentTime-3);return;}
      if(this.queue.length){const data=this.queue.shift();this.queuedBytes-=data.length;b.appendBuffer(data);}
    }catch{this.fallback();}
  }
  showFrame(){if(!this.active)return;this.lastFrameAt=performance.now();this.status.hidden=true;this.stats.firstFrameMs??=performance.now()-this.startedAt;}
  jpeg(data){
    if(this.decodingImage)return;
    this.decodingImage=true;const url=URL.createObjectURL(new Blob([data],{type:'image/jpeg'}));
    this.image.onload=()=>{this.decodingImage=false;URL.revokeObjectURL(this.imageURL);this.imageURL=url;this.stats.frames++;this.showFrame();};
    this.image.onerror=()=>{this.decodingImage=false;URL.revokeObjectURL(url);};this.image.src=url;
  }
  reconnect(){if(!this.active||this.retryTimer)return;this.status.hidden=false;this.status.textContent='正在重新連線畫面…';this.stats.reconnects++;this.retryTimer=setTimeout(()=>{this.retryTimer=null;this.start(this.token,this.codec);},750);}
  fallback(){if(!this.active||this.codec==='jpeg')return;this.start(this.token,'jpeg');}
  stop(){
    this.active=false;clearInterval(this.monitor);clearTimeout(this.retryTimer);this.retryTimer=null;
    const ws=this.ws;this.ws=null;if(ws)ws.close();
    this.buffer=null;this.queue=[];this.queuedBytes=0;
    this.video.pause();this.video.removeAttribute('src');this.video.load();
    if(this.videoURL)URL.revokeObjectURL(this.videoURL);this.videoURL=null;
    if(this.imageURL)URL.revokeObjectURL(this.imageURL);this.imageURL=null;this.decodingImage=false;
  }
}
