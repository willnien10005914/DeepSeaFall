import {SeaAudio} from '../audio.js?v=50';
import {StreamPlayer} from './player.js?v=50';
import {moves} from './moves.js?v=50';

export class CloudGame {
  constructor(canvas, ui) {
    this.remote = true;
    this.ui = ui;
    this.audio = new SeaAudio({preload:'none'});
    this.mode = 'manual';
    this.running = false;
    try{this.best=Number(localStorage.getItem('deepSeaFall3dBest')||0);}catch{this.best=0;}
    this.camera = {aspect:480/864};
    this.tapSwim = {retarget() {}};
    this.assetsReady = Promise.resolve();
    this._authoredAssets = true;
    canvas.hidden = true;
    this.surface = document.createElement('div');
    this.surface.className = 'cloud-surface';
    this.surface.id = 'cloudSurface';
    this.canvas = this.surface;
    canvas.after(this.surface);
    this.player = new StreamPlayer(this.surface);
    let pressed = false;
    const point = e => {
      const r = this.viewRect();
      return {x:Math.max(-1,Math.min(1,(e.clientX-r.left)/r.width*2-1)),y:Math.max(-1,Math.min(1,1-(e.clientY-r.top)/r.height*2))};
    };
    this.surface.addEventListener('pointerdown',e=>{
      pressed=true;
      this.surface.setPointerCapture(e.pointerId);
      this._tapToSwim?.(point(e));
      void this.player.video.play().catch(()=>{});
    });
    this.surface.addEventListener('pointermove',e=>{if(pressed)this._tapToSwim?.(point(e));});
    for(const event of ['pointerup','pointercancel'])this.surface.addEventListener(event,()=>pressed=false);
    for(const [id,method] of Object.entries({btnSleep:'toggleSleep',btnWhale:'summonWhale',btnBoost:'triggerBoost',btnMagic:'placeMagic',btnAttack:'attack'}))
      document.getElementById(id).addEventListener('click',()=>this[method]?.());
    document.getElementById('btnMusic').addEventListener('click',async()=>{
      const enabled = await this.audio.toggleMusic();
      ui.btnMusic.textContent=enabled?'音樂：開':'音樂：關';
    });
    const select=document.getElementById('attackStyle');
    for(const [id,name,,cooldown] of moves){const o=document.createElement('option');o.value=id;o.textContent=`${name} · ${cooldown}秒起`;select.append(o);}
    const hint=document.querySelector('#titleScreen .hint');
    hint.textContent='輕點海域控制游泳 · 點聊天與大家說話 · 收合操作可放大視野';
    const mode=document.createElement('a');
    mode.href='?render=local';mode.className='render-choice';mode.textContent='改用本機 3D';hint.append(' · ',mode);
  }
  async start() {
    this.running=true;
    this.player.prime();
    void this.audio.unlock().catch(()=>{});
    this.ui.showGame();
  }
  viewRect() {
    const r=this.surface.getBoundingClientRect(), aspect=this.camera.aspect;
    const width=Math.min(r.width,r.height*aspect),height=width/aspect;
    return {left:r.left+(r.width-width)/2,top:r.top+(r.height-height)/2,width,height};
  }
  connectStream(token){this.player.start(token);}
  stopStream(){this.player.stop();}
}

export class CloudReplica {
  constructor(game,id,onRoster){
    this.g=game;this.id=id;this.onRoster=onRoster;
    this.avatars=new Map();this.labels=new Map();
    this.layer=document.createElement('div');this.layer.className='mp-label-layer';
    document.getElementById('app').append(this.layer);
    window.addEventListener('resize',()=>this.positionLabels());
  }
  receive(s){
    if(this.latest?.generation===s.generation && s.tick<=this.latest.tick)return;
    this.latest=s;
    this.onRoster(s.players,s.scoreboard);
    const g=this.g,ui=g.ui,p=s.players.find(p=>p.id===this.id);
    if(s.biome?.name)document.querySelector('.depth-pill .label').textContent=s.biome.name;
    if(this.biomeId!==s.biome?.id){this.biomeId=s.biome?.id;if(s.biome?.range?.[0]>0)ui.toast(`${s.biome.range[0]}m · ${s.biome.name}`);}
    ui.setDepth(s.depth,Math.max(s.depth,g.best||0));ui.setStamina(s.stamina);
    ui.setTreasure(p?.treasures||0);ui.setScore(p?.points||0);ui.setAffection(s.affection);ui.setDressCondition(s.dressDamage);
    g.sleeping=s.sleeping;g.depth=s.depth;
    ui.btnSleep.textContent=s.sleeping?'一起醒來':'一起抱膝補力';
    ui.btnWhale.disabled=s.whale.state!=='hidden'||s.whaleCd>0;
    ui.btnWhale.textContent=s.whale.state==='hidden'?(s.whaleCd>0?'稍候再呼喚':'一起呼喚鯨魚'):s.whale.state==='approaching'?'鯨魚游來中…':s.whale.state==='departing'?'鯨魚離開中…':'鯨魚相伴中';
    const c=s.combat,active=['charge','strike','recover'].includes(c.stage),m=moves.find(m=>m[0]===c.move),cd=c.cooldown;
    ui.btnAttack.disabled=active||cd>0;ui.btnSleep.disabled=active;ui.btnBoost.disabled=active;
    ui.btnAttack.setAttribute('aria-busy',String(active));
    ui.btnAttack.classList.toggle('charging',c.stage==='charge');
    const progress=Math.min(100,Math.round(c.age/(m?.[2]||1)*100));
    ui.btnAttack.style.setProperty('--attack-fill',c.stage==='charge'?`${progress}%`:'0%');
    ui.btnAttack.textContent=c.stage==='charge'?`蓄力 ${progress}%`:c.stage==='strike'?(m?.[1]||'出招'):c.stage==='recover'?'收勢中':cd>0?`冷卻 ${Math.floor(Math.ceil(cd)/60)}:${String(Math.ceil(cd)%60).padStart(2,'0')}`:'蓄力攻擊';
    document.getElementById('attackStyle').disabled=active||cd>0;
    document.getElementById('attackStatus').textContent=active?`${m?.[4]||''} · ${m?.[1]||''}`:cd>0?`${Math.ceil(cd)} 秒後可再出招`:'選招式後點攻擊，蓄力完成會自動出招';
    const live=new Set(s.players.map(p=>p.id));
    for(const [id,l] of this.labels)if(!live.has(id)){l.label.remove();this.labels.delete(id);this.avatars.delete(id);}
    for(const p of s.players){
      this.avatars.set(p.id,p);
      let l=this.labels.get(p.id);
      if(!l){const label=document.createElement('div');label.className='mp-avatar-label';const name=document.createElement('span'),chat=document.createElement('span');chat.className='mp-bubble';label.append(name,chat);this.layer.append(label);l={label,name,chat};this.labels.set(p.id,l);}
      l.label.style.setProperty('--girl-color',p.color);
      l.name.textContent=`${p.name}${p.id===this.id?' · 妳':''} · ◆${p.treasures} · ${p.points} 分`;
    }
    this.positionLabels();
    if(s.running!==this.wasRunning){this.wasRunning=s.running;if(s.running)ui.showGame();else {g.best=Math.max(g.best,s.depth);try{localStorage.setItem('deepSeaFall3dBest',String(g.best));}catch{}ui.showGameOver({depth:Math.floor(s.depth),loot:p?.treasures||0,score:p?.points||0,canRevive:s.seaweed>0});}}
  }
  positionLabels(){
    if(!this.latest)return;
    const r=this.g.viewRect(),app=this.g.surface.getBoundingClientRect();
    for(const [id,l] of this.labels){const p=this.latest.screen?.find(p=>p.id===id);l.label.hidden=!p||!p.visible;if(p)l.label.style.transform=`translate(${r.left-app.left+p.x*r.width}px,${r.top-app.top+p.y*r.height}px) translate(-50%,-100%)`;}
  }
  chat(m){const l=this.labels.get(m.playerId);if(l){l.chat.textContent=m.text;l.chat.classList.add('show');clearTimeout(l.timer);l.timer=setTimeout(()=>l.chat.classList.remove('show'),7000);}}
}
