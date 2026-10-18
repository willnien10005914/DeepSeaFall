import {animateGemstone} from './gemstones.js?v=48';
import {gemType} from './treasure-rules.js?v=48';
import {LearnedSwimmer,loadSwimPPO} from './ppo-swimmer.js?v=48';
import {OceanDetails} from './ocean-details.js?v=48';
import {CombatActor,loadCombatPPO} from './combat-ppo.js?v=48';
import {CombatSystem} from './combat.js?v=48';
import {combatMoves} from './combat-moves.js?v=48';
import {descentTravel} from './descent-motion.js?v=48';
import {DepthBiomes} from './depth-biomes.js?v=48';
import {resolveGirlShark} from './shark-contacts.js?v=48';
import {makeMarineEncounter,updateMarineEncounter} from './marine-encounters.js?v=48';
import {TapSwim} from './tap-swim.js?v=48';
import {makePredator,updatePredator,preparePredatorEntry,predatorBodySpheres,scarePredator} from './predators.js?v=48';
import {InjuryEffects} from './injury-effects.js?v=48';
import {WhaleEncounter} from './whale-encounter.js?v=48';
import {WhaleContacts} from './whale-contacts.js?v=48';
import {RockFragments} from './rock-fragments.js?v=48';
import {SwimPropulsion} from './swim-propulsion.js?v=48';
import {GameFeedback} from './game-feedback.js?v=48';
import {RockContacts} from './rock-contacts.js?v=48';
import {WaterSwipe} from './water-swipe.js?v=48';
import {SwimReactions} from './swim-reactions.js?v=48';
import * as THREE from "three";
import {SwimBubbles} from "./swim-bubbles.js?v=48";
import {animateMarine} from "./marine-life.js?v=48";
import { prepareCharacter, animateCharacter } from "./authored.js?v=48";
import { makeOcean, oceanEnvironment } from "./ocean-real.js?v=48";
import { WaterRenderer } from "./water.js?v=48";
import { SeaAudio } from "../audio.js?v=48";
import { zoneAt } from "../zones.js";
import {
  makeFish, makeJelly, makeRock, makeTreasure,
  loadGlb, HAIR_COLORS, DRESS_COLORS,
} from "./meshes.js?v=48";

const BEST_KEY = "deepSeaFall3dBest";
const WHALE_LINES = [
  "我在這裡，抓住我的背。",
  "左邊有石頭，我推開它！",
  "跟著氣泡，再深一點。",
  "累了就睡一會兒，我守著你。",
  "那裡有光——是寶物嗎？",
];

function rand(a, b) { return a + Math.random() * (b - a); }
function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function disposeEntity(entity){
  if(entity.mesh.userData.disposedEntity)return;
  const materials=new Set();
  entity.mesh.traverse(o=>{if(!o.isMesh&&!o.isLineSegments)return;if(entity.kind!=='creature')o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])if(!m.userData.sharedScanned)materials.add(m)});
  materials.forEach(m=>m.dispose());entity.mesh.userData.disposedEntity=true;
}

export class Game3D {
  constructor(canvas, ui) {
    this.canvas = canvas;
    this.ui = ui;
    this.audio = new SeaAudio();
    this.running = false;
    this.mode = "manual";
    this.prompt = "proactive";
    this.t = 0;
    this.swimPhase=0;
    this.depth = 0;this.depthBiomes?.reset();
    this.maxDepth = 0;
    this.best = Number(localStorage.getItem(BEST_KEY) || 0);
    this.stamina = 100;
    this.lootCount = 0;this.score=0;this.ui.setScore?.(0);
    this.ui.setTreasure?.(0);
    this.seaweed = 0;
    this.boost = 0;
    this.sleeping = false;
    if(this.ui.btnSleep)this.ui.btnSleep.textContent='睡著補力';
    this.attackT = 0;this.combat?.reset(this);
    this.whaleCd = 0;
    this.whaleState = 'hidden';
    this.whaleTime = 0;this.whaleNear=0;
    this.whaleSwimPhase=0;this.whaleEffort=.65;this.whaleTurn=0;this.whaleLift=0;
    this.swimVelocity = new THREE.Vector3();
    this.cameraTarget = new THREE.Vector3(0,.8,-1);
    this.magicCd = 0;
    this.spawnAcc = 0;
    this.pointer = null;this.tapSwim=new TapSwim();this.tapMotion={active:false};
    this.entities = [];
    this.swimMotor=new SwimPropulsion();this.rockContacts=new RockContacts();this.feedback=new GameFeedback();this.hurtCooldown=0;this.hurtTime=0;this.whaleEncounter=new WhaleEncounter();this.whaleContacts=new WhaleContacts(this.rockContacts.cache);this.brokenWhaleRocks=new Set();this.affection=0;this.bondCooldown=0;this.bondSeparated=.5;this.visitBondCount=0;this.dressDamage=0;this.nextPredatorAt=8;this.predatorSpawns=0;this.sharksScared=0;this.lastSharkContact=null;
    this.reactions=new SwimReactions();
    this.waypoints = [];

    this._initThree();
    this._bindUI();
    this._onResize();
    window.addEventListener("resize", () => this._onResize());
    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  _initThree() {
    const w = this.canvas.clientWidth || 390;
    const h = this.canvas.clientHeight || 844;
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(w, h, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.13;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x061a28);
    this.scene.fog = null;
    this.environmentTarget = oceanEnvironment(this.renderer);
    this.scene.environment = this.environmentTarget.texture;
    this.scene.environmentIntensity = .65;

    this.camera = new THREE.PerspectiveCamera(52, w / h, 0.1, 200);
    this.camera.position.set(.8, 2.5, 11.5);

    this.hemi = new THREE.HemisphereLight(0x9fc5d7, 0x102535, .55);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xdaeff7, 3.1);
    this.sun.position.set(-5, 14, 6);
    this.sun.target.position.set(0,0,-4);this.scene.add(this.sun.target);
    this.sun.castShadow=true;this.sun.shadow.mapSize.set(1536,1536);
    Object.assign(this.sun.shadow.camera,{left:-23,right:23,top:28,bottom:-28,near:.5,far:85});
    this.sun.shadow.bias=-.0004;this.sun.shadow.normalBias=.012;
    this.scene.add(this.sun);
    this.rim=new THREE.DirectionalLight(0x84afc9,.65);this.rim.position.set(7,3,-8);this.scene.add(this.rim);
    this.key = new THREE.PointLight(0x5ce1ff, 1.4, 30);
    this.key.position.set(0, 2, 3);
    this.scene.add(this.key);
    this.ocean = makeOcean(this.scene);
    this.rockFragments=new RockFragments(this.scene,this.ocean.textures);
    this.injuryEffects=new InjuryEffects(this.scene);

    // volumetric-ish columns of light near surface via translucent planes
    this.shaftGroup = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const shaft = new THREE.Mesh(
        new THREE.PlaneGeometry(0.8, 18),
        new THREE.MeshBasicMaterial({
          color: 0xdff9ff,
          transparent: true,
          opacity: 0.04,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      shaft.position.set(-3 + i * 1.5, 2, -2 - i * 0.3);
      shaft.rotation.y = 0.2;
      this.shaftGroup.add(shaft);
    }
    this.scene.add(this.shaftGroup);

    // caustic plane under camera
    this.caustic = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40),
      new THREE.MeshBasicMaterial({
        color: 0x1aa7a0,
        transparent: true,
        opacity: 0.04,
        depthWrite: false,
      }),
    );
    this.caustic.rotation.x = -Math.PI / 2;
    this.caustic.position.y = -6;
    this.scene.add(this.caustic);
    this.caustic.visible=false;this.shaftGroup.visible=false;

    this.world = new THREE.Group();
    this.scene.add(this.world);

    this.girl = new THREE.Group();
    this.girl.visible = false;
    this.girl.position.set(0, 0.2, 0);
    this.scene.add(this.girl);

    this.whale = new THREE.Group();
    this.whale.visible = false;
    this.whale.position.set(2.2, -0.6, -1.2);
    this.scene.add(this.whale);

    this.swimBubbles = new SwimBubbles(this.scene);
    this.whaleBubbles=new SwimBubbles(this.scene,640);this.whaleBubbles.mesh.name='Whale arrival entrained bubbles';
    this.waterSwipe=new WaterSwipe(this.scene,this.swimBubbles);
    this.previousMotionVelocity=new THREE.Vector3();this.swimAcceleration=new THREE.Vector3();

    // distant particle stars / biolume
    const pGeo = new THREE.BufferGeometry();
    const n = 400;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = rand(-12, 12);
      pos[i * 3 + 1] = rand(-20, 10);
      pos[i * 3 + 2] = rand(-18, 4);
    }
    pGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    this.bio = new THREE.Points(
      pGeo,
      new THREE.PointsMaterial({ color: 0x9dffb0, size: 0.06, transparent: true, opacity: 0.55 }),
    );
    this.scene.add(this.bio);
    this.bio.visible=false;
    this.water=new WaterRenderer(this.renderer,this.scene,this.camera,this.sun);
    this.depthBiomes=new DepthBiomes(this.scene);this.water.apply(this.depthBiomes.landmarks.group);this.combat=new CombatSystem(this.scene);this.oceanDetails=new OceanDetails(this.scene,this.ocean);
    this.assetsReady = this._tryLoadAuthoredAssets();
    this.water.apply(this.ocean.group);
  }

  async _tryLoadAuthoredAssets() {
    try {
      const [girlScene, whaleScene,swimPolicy,combatPolicy] = await Promise.all([
        loadGlb("assets/usd/girl.glb?v=48"),
        loadGlb("assets/usd/whale.glb?v=48"),
        loadSwimPPO(),
        loadCombatPPO(),
        this.combat.dynamicsReady,
      ]);
      // Replace procedural proxies while keeping animation hooks
      this.scene.remove(this.girl);
      this.scene.remove(this.whale);
      this.multiplayerTemplate=girlScene.clone(true);
      prepareCharacter(girlScene, 'girl');
      girlScene.userData.swimPPO=new LearnedSwimmer(swimPolicy);
      girlScene.userData.combatPPO=new CombatActor(combatPolicy);
      girlScene.position.set(0, -.6, 0);
      prepareCharacter(whaleScene, 'whale');
      whaleScene.scale.setScalar(.78);
      whaleScene.position.set(-8.6,-3.8,-8);
      whaleScene.rotation.set(-.60,-1.24,-.47);
      whaleScene.visible=false;
      this.girl = girlScene;
      this.whale = whaleScene;
      this.scene.add(this.girl, this.whale);
      this.water.apply(this.girl);this.water.apply(this.whale);
      this._authoredAssets = true;
      console.info("[DeepSeaFall] Loaded authored GLB girl/whale assets");
    } catch (err) {
      console.error("[DeepSeaFall] Authored models failed to load", err);
      this._authoredAssets = false;
      this.ui.toast('3D 模型載入失敗，請重新整理');
      const message=document.querySelector('#titleScreen .tagline');
      if(message)message.textContent='3D 模型載入失敗，請重新整理';
    }
  }

  _onResize() {
    const w = this.canvas.clientWidth || 390;
    const h = this.canvas.clientHeight || 844;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.water?.resize();this.tapSwim?.setAspect(this.camera.aspect);
  }

  _bindUI() {
    const { btnSleep, btnWhale, btnBoost, btnMagic, btnAttack, btnMode, btnMusic } = this.ui;
    btnMusic?.addEventListener("click",async()=>{const enabled=await this.audio.toggleMusic();btnMusic.textContent=enabled?"音樂：開":"音樂：關"});
    btnSleep?.addEventListener("click", () => this.toggleSleep());
    btnWhale?.addEventListener("click", () => this.summonWhale());
    btnBoost?.addEventListener("click", () => this.triggerBoost());
    btnMagic?.addEventListener("click", () => this.placeMagic());
    btnAttack?.addEventListener("click", () => this.attack());
    const selector=document.getElementById('attackStyle');if(selector){for(const move of combatMoves){const option=document.createElement('option');option.value=move.id;option.textContent=move.name+' · '+move.cooldown+'秒起';selector.append(option);}}
    btnMode?.addEventListener("click", () => this.cycleMode());
    this.ui.aiPanel?.querySelectorAll(".prompt-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.ui.aiPanel.querySelectorAll(".prompt-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        this.setPrompt(btn.dataset.prompt);
      });
    });

    const el = this.canvas;
    el.addEventListener("pointerdown", (e) => {
      el.setPointerCapture(e.pointerId);
      this.pointer = this._pos(e);
      this.pointer.active = true;
      this._tapToSwim(this.pointer);
      this.audio.unlock();
    });
    el.addEventListener("pointermove", (e) => {
      if (!this.pointer?.active) return;
      this.pointer = { ...this._pos(e), active: true };
      if(this.running&&this.mode==='manual')this.tapSwim.retarget(this.pointer.x,this.pointer.y,this.girl.position);
    });
    el.addEventListener("pointerup", () => { if (this.pointer) this.pointer.active = false; });
    el.addEventListener("pointercancel", () => { if (this.pointer) this.pointer.active = false;this.tapSwim.cancel(); });
  }

  _tapToSwim(pointer){
    if(!this.running||this.mode!=='manual'||this.sleeping)return;
    this.tapSwim.setAspect(this.camera.aspect);
    const command=this.tapSwim.tap(pointer.x,pointer.y,this.girl.position);
    this.ui.whaleLine(command.style==='freestyle'?'伸手划水、交替打水，慢慢游向那裡。':'先收身轉向，再伸展划水前進。');
  }

  _pos(e) {
    const r = this.canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) / r.width * 2 - 1,
      y: -((e.clientY - r.top) / r.height * 2 - 1),
    };
  }

  async start(mode = "manual") {
    if(this.starting)return;
    this.starting=true;
    const startButtons=[...document.querySelectorAll('#titleScreen button')];
    startButtons.forEach(button=>button.disabled=true);
    const tagline=document.querySelector('#titleScreen .tagline');
    if(tagline)tagline.textContent='正在載入海底旅程…';
    try{
    const audioUnlocked=this.audio.unlock().catch(error=>console.info('Audio unavailable; the game remains playable',error.message));
    await this.assetsReady;
    if (!this._authoredAssets){this.audio.track.pause();return}
    await audioUnlocked;
    this.mode = mode;
    this.t=0;this.swimPhase=0;this.lastDemoSecond=undefined;this.swimMotor.reset();this.feedback.clear();this.hurtCooldown=0;this.hurtTime=0;if(this.girl?.userData.aura)this.girl.userData.aura.visible=false;this.lastDamage=null;this.lastPickup=null;
    this.running = true;
    this.whaleEncounter.reset();this.whaleContacts.reset();this.rockFragments.clear();for(const rock of this.brokenWhaleRocks)rock.visible=true;this.brokenWhaleRocks.clear();this.affection=0;this.ui.setAffection?.(0);this.bondCooldown=0;this.bondSeparated=.5;this.visitBondCount=0;this.rocksBroken=0;this.dressDamage=0;this._setDressDamage(0);this.injuryEffects.clear();this.nextPredatorAt=8;this.predatorSpawns=0;this.sharksScared=0;this.lastSharkContact=null;this.lastBite=null;this.lastWhaleTouch=null;this.lastWhaleImpact=null;this.lastShatterSound=0;
    this.depth = 0;this.depthBiomes?.reset();
    this.maxDepth = 0;
    this.stamina = 100;
    this.lootCount = 0;this.score=0;this.ui.setScore?.(0);
    this.ui.setTreasure?.(0);
    this.seaweed = 0;
    this.boost = 0;
    this.sleeping = false;
    if(this.ui.btnSleep)this.ui.btnSleep.textContent='睡著補力';
    this.attackT = 0;this.combat?.reset(this);
    this.whaleCd = 0;
    this.whaleState='hidden';this.whaleTime=0;this.whaleNear=0;this.whaleSwimPhase=0;this.whaleEffort=.65;this.whaleTurn=0;this.whaleLift=0;this.whale.visible=false;this.girl.visible=true;
    if(this.ui.btnWhale){this.ui.btnWhale.disabled=false;this.ui.btnWhale.textContent='召喚鯨'}
    this.swimVelocity.set(0,0,0);this.pointer=null;this.tapSwim.reset();this.tapMotion={active:false};this.swimBubbles.clear();this.whaleBubbles.clear();this.waterSwipe.clear();this.previousMotionVelocity.set(0,0,0);this.swimAcceleration.set(0,0,0);delete this.girl.userData.secondaryMotion;this.girl.userData.diveBlend=0;this.girl.userData.sleepBlend=0;this.girl.userData.sleepCloth?.reset();delete this.girl.userData.verticalAim;delete this.girl.userData.swimHeading;delete this.girl.userData.lastDirectedStroke;delete this.girl.userData.legAccentPose;delete this.girl.userData.legAccent;delete this.girl.userData.swimTurn;delete this.girl.userData.turnStats;this.lastGirlSharkContact=null;this.girl.userData.directedWeight=0;this.girl.userData.headingBlend=0;this.girl.userData.clothContact?.reset();this.reactions.reset();this.nextVisitorAt=4;this.visitorCount=0;this.wildlifeCount=0;
    delete this.girl.userData.clipBlend;delete this.girl.userData.clipSampleTime;this.girl.userData.swimPPO?.reset();this.girl.userData.motionGarment?.reset();
    this.magicCd = 0;
    this.spawnAcc = 0;
    this.entities.forEach((e) => {this.world.remove(e.mesh);disposeEntity(e)});
    this.entities = [];
    this.waypoints = [];
    this.girl.position.set(0,-.4,0);
    this.whale.position.set(-8.6,-4,-8);
    this.audio.setPrompt(this.prompt);
    this.ui.whaleLine('點「召喚鯨」，讓座頭鯨游近你。');
    this.ui.showGame();
    this.ui.setModeLabel(this.mode);
    this.ui.setBest(this.best);
    this.ui.toast("3D 深海旅程開始");
    this._applyLook("long", "dress");
    const welcome=makeTreasure();welcome.position.set(.45,-1.1,.08);this.world.add(welcome);this.entities.push({mesh:welcome,kind:'loot',hostile:false,hp:1});
    this._spawnMarine('clownfish',true);
    }finally{
      this.starting=false;startButtons.forEach(button=>button.disabled=false);
      if(tagline)tagline.textContent=this._authoredAssets?'與座頭鯨一同潛入深海':'3D 角色載入失敗，請重新整理';
    }
  }

  _applyLook(hairId, dressId) {
    const hc = HAIR_COLORS[hairId] ?? HAIR_COLORS.long;
    const dc = DRESS_COLORS[dressId] ?? DRESS_COLORS.dress;
    const { hairMat, dressMat } = this.girl.userData;
    for(const material of this.girl.userData.hairMaterials||[hairMat])material.color.setHex(hairId==='long'?0xffffff:hc);
    if (hairId === "glow" || hairId === "abyss" || hairId === "coral") {
      hairMat.emissive.setHex(hc);
      hairMat.emissiveIntensity = 0.35;
    } else {
      hairMat.emissive.setHex(0x000000);
      hairMat.emissiveIntensity = 0;
    }
    dressMat.color.setHex(dc);
    // Ivory fabric by default; lighting supplies colour instead of self illumination.
    dressMat.color.setHex(dressId === 'dress' ? 0xaeb984 : dc);
    dressMat.emissive.setHex(0x000000);
    dressMat.emissiveIntensity = 0;
    this.look = {
      hair: { id: hairId, label: hairId },
      outfit: { id: dressId, label: dressId },
      weapon: { id: "hand", label: "空手", color: "#fff" },
    };
    const labels = {
      long: "深色長直髮", twin: "暖棕髮色", short: "深棕髮色", glow: "螢光藍", coral: "珊瑚粉", abyss: "深淵紫",
      dress: "淡綠洋裝", diver: "潛水衣", kimono: "海紋浴衣", armor: "珊瑚甲", mage: "氣功袍", shadow: "深淵披風",
    };
    this.look.hair.label = labels[hairId] || hairId;
    this.look.outfit.label = labels[dressId] || dressId;
    this.ui.setEquip({
      hair: this.look.hair,
      outfit: this.look.outfit,
      weapon: this.look.weapon,
    });
  }

  setPrompt(p) {
    this.prompt = p;
    this.audio.setPrompt(p);
    const map = {
      proactive: "主動前進，積極搜集與戰鬥",
      careful: "小心迴避，優先保命與標記",
      treasure: "優先尋寶與裝備",
      explore: "深入未知層，不怕黑暗",
    };
    this.ui.setAiStatus(map[p] || p);
    this.ui.toast(`Agent: ${p}`);
  }

  cycleMode() {
    this.tapSwim.cancel('mode');this.mode = this.mode === "manual" ? "ai" : "manual";
    this.ui.setModeLabel(this.mode);
    this.ui.toggleAi(this.mode === "ai" || this.mode === "demo");
    this.ui.toast(this.mode === "ai" ? "AI Mode 啟動" : "手動操作");
  }

  toggleSleep() {
    if (!this.running) return;
    this.sleeping = !this.sleeping;
    if(this.ui.btnSleep)this.ui.btnSleep.textContent=this.sleeping?'醒來游泳':'睡著補力';
    if (this.sleeping) {
      this.tapSwim.cancel('sleep');
      this.audio.sfxSleep();
      this.ui.toast("抱膝漂流・回復體力");
    }
  }

  summonWhale() {
    if(!this.running)return false;
    if(this.whaleState!=='hidden'||this.whaleCd>0){this.ui.toast(this.whaleState==='departing'?'鯨魚正游回深海':'鯨魚正在與你相遇');return false;}
    if(!this.whaleEncounter.start(performance.now()/1000))return false;
    const profile=this.whaleEncounter.profile;this.whaleApproach=profile;this.whaleApproachIndex=this.whaleEncounter.lastIndex;this.whaleState='approaching';this.whaleTime=0;this.whaleNear=0;this.whaleCd=16.8;this.whale.visible=true;this.whaleSummonedAt=performance.now()/1000;this.whale.scale.setScalar(profile.scale);
    this.whaleAnchor=this.girl.position.clone();this.whaleArrivalStart=this.whaleAnchor.clone().add(new THREE.Vector3(...profile.start));this.whaleArrivalControl=this.whaleAnchor.clone().add(new THREE.Vector3(...profile.bend));this.whaleArrivalEnd=this.whaleAnchor.clone().add(new THREE.Vector3(...profile.stop));
    this.whale.position.copy(this.whaleArrivalStart);this.whaleContacts.reset();this.whaleBubbleAcc=0;this.whaleArrivalBurst=false;this.whaleDepartureStart=null;this.visitBondCount=0;this.bondSeparated=.5;
    this.whaleBubbles.burst(this.whale.position,new THREE.Vector3(),60,2.2,1.6);this.water.flow.disturb(this.girl.position.x,this.whaleArrivalStart.z,2);
    this.ui.toast('座頭鯨游向'+profile.name+'，停留約十秒');this.audio.sfxWhale();return true;
  }

  _breakWhaleRock(mesh,point,direction){
    if(!mesh.visible)return;mesh.visible=false;this.rocksBroken=(this.rocksBroken||0)+1;
    const entity=this.entities.find(e=>e.mesh===mesh);if(entity)entity.dead=true;else this.brokenWhaleRocks.add(mesh);
    this.rockFragments.burst(point,direction,1);this.whaleBubbles.burst(point,direction,40,.9,1.3);this.water.flow.disturb(point.x,point.z,1.2);
    this.feedback.label(this._screenPoint(point),'礁石碎裂','shatter');if(!this.lastShatterSound||this.t-this.lastShatterSound>.18){this.audio.sfxRock();this.lastShatterSound=this.t;}
    this.lastWhaleImpact={point:point.toArray(),rock:mesh.name,time:this.whaleTime};
  }

  _whaleTouch(dt){
    const spheres=this.rockContacts.body(this.girl),bones=this.girl.userData.bones;for(const side of ['l_','r_'])for(const [part,radius]of [['wrist',.065],['ankle',.075],['knee',.09],['shoulder',.105]])spheres.push({center:bones[side+part].getWorldPosition(new THREE.Vector3()),radius});
    const contact=this.whaleContacts.resolveGirl(this.girl,spheres);this.bondCooldown=Math.max(0,this.bondCooldown-dt);
    if(contact.touching){if(this.bondSeparated>=.4)this.swimMotor.impulse(contact.direction.x*.16,Math.max(-.10,contact.direction.y*.14),contact.direction.z*.05);
      if(this.bondCooldown<=0&&this.bondSeparated>=.4&&this.visitBondCount<3){const before=this.affection;this.affection=Math.min(100,this.affection+5);this.ui.setAffection?.(this.affection);this.feedback.hearts(this._screenPoint(contact.point),this.affection-before);this.visitBondCount++;this.bondCooldown=1.8;this.lastWhaleTouch={affection:this.affection,correction:contact.correction,time:this.whaleTime};}this.bondSeparated=0;
    }else this.bondSeparated+=dt;
    return contact;
  }

  triggerBoost() {
    if (!this.running) return;
    this.boost = 2.0;
    this.stamina = Math.max(0, this.stamina - 4);
    this.audio.sfxBoost();
    this.ui.toast("加速下潛！");
  }

  placeMagic() {
    if (!this.running || this.magicCd > 0) return;
    this.magicCd = 2.2;
    const rune = new THREE.Mesh(
      new THREE.TorusGeometry(0.35, 0.05, 8, 24),
      new THREE.MeshStandardMaterial({
        color: 0xffd166,
        emissive: 0x5ce1ff,
        emissiveIntensity: 0.8,
      }),
    );
    rune.position.copy(this.girl.position);
    rune.position.y -= 0.8;
    rune.userData = { kind: "rune", vy: 0 };
    this.world.add(rune);
    this.entities.push({ mesh: rune, kind: "rune", hostile: false });
    this.waypoints.push({ depth: this.depth });
    this.audio.sfxMagic();
    this.ui.toast(`氣功標記 @ ${Math.floor(this.depth)}m`);
  }

  attack() {return this.combat.start(this,document.getElementById('attackStyle')?.value||'auto');}


  _spawn() {
    const zone = zoneAt(this.depth);
    const roll = Math.random();
    if (roll < 0.3) {
      const volcanic = zone.id === "vent" || this.depth > 700;
      const mesh = makeRock(volcanic);
      mesh.position.set(rand(-3,3),rand(-4.4,-3.2),rand(-.35,.35));
      this.world.add(mesh);this.water.apply(mesh);
      this.entities.push({ mesh, kind: "rock", hostile: true, hp: 999, volcanic });
    } else if (roll < 0.75) {
      const hostile = Math.random() < 0.25 || ["midnight", "abyss", "hadal", "vent"].includes(zone.id);
      const remaining=20-this.entities.filter(e=>e.kind==='creature').length;if(remaining<=0)return;
      const colors=[0xa4b8c0,0x8b9ca5,0xb0bab8];
      const jelly=Math.random()<.22,school=Math.min(remaining,jelly?1:(Math.random()<.6?4+Math.floor(Math.random()*4):1));
      const baseX=rand(-3.7,3.7),baseZ=Math.random()<.55?rand(-2.4,-.45):rand(-6,-2.5),vx=(Math.random()<.5?-1:1)*(jelly?.15:rand(.36,.72));
      const phase=Math.random()*Math.PI*2;
      for(let i=0;i<school;i++){
        const mesh=jelly?makeJelly():makeFish(pick(colors),rand(.65,1.12));
        mesh.position.set(baseX+(i%3)*.65,-9-Math.floor(i/3)*.4+rand(-.08,.08),baseZ+(i%2)*.35);
        mesh.userData.vx=vx;mesh.userData.marine.uniforms.uCreaturePhase.value=phase+i*.37;
        mesh.rotation.y=vx<0?Math.PI:0;
        this.world.add(mesh);this.water.apply(mesh);
        this.entities.push({mesh,kind:'creature',hostile:hostile||jelly,hp:hostile||jelly?22:8});
      }
    } else {
      const mesh = makeTreasure();
      mesh.position.set(rand(-2.8,2.8),rand(-3.2,-2.5),rand(-.18,.18));
      this.world.add(mesh);
      this.entities.push({ mesh, kind: "loot", hostile: false, hp: 1 });
    }
  }

  _spawnGem(id=null){const mesh=makeTreasure(id);mesh.position.set(rand(-2.8,2.8),rand(-4.0,-2.8),rand(-.18,.18));this.world.add(mesh);const e={mesh,kind:'loot',hostile:false,hp:1};this.entities.push(e);return e;}

  _setDressDamage(value){this.dressDamage=clamp(value,0,.75);if(this.girl?.userData.fabricDamage)this.girl.userData.fabricDamage.value=this.dressDamage;this.ui.setDressCondition?.(this.dressDamage);}

  _predatorBite(entity,point){
    if(this.whale.visible&&this.whaleState!=='hidden')this._whaleSharkContacts();
    if(entity.mesh.userData.predator.stage==='flee')return false;
    if(!this._hurt(entity.mesh.userData.predator.damage,point,'bite'))return false;
    this._setDressDamage(this.dressDamage+.36);this.injuryEffects.emit(point);this.audio.sfxHit();this.lastBite={species:entity.mesh.userData.predator.species,time:this.t,point:point.toArray(),dressDamage:this.dressDamage};this.ui.toast('遭到咬擊！收集寶石修復洋裝');return true;
  }

  _spawnPredator(species=null){
    if(this.entities.filter(e=>e.kind==='predator'&&!e.dead).length>=2)return null;
    const serial=this.predatorSpawns++;const mesh=makePredator(species||(serial%2===0?'great-white':'reef'));const centre=this.girl.userData.bones.chest.getWorldPosition(new THREE.Vector3());preparePredatorEntry(mesh,centre,serial);this.world.add(mesh);this.water.apply(mesh);const e={mesh,kind:'predator',hostile:true,hp:48};this.entities.push(e);this.ui.toast(mesh.name==='Great white shark'?'大白鯊正在接近，留意牠的嘴部':'灰礁鯊游近，小心衝刺');return e;
  }

  _spawnMarine(species=null,welcome=false){
    if(this.entities.filter(e=>e.kind==='wildlife'&&!e.dead).length>=7)return null;
    const bag=['clownfish','cutlassfish','clownfish','sea-snake','clownfish','kraken'];
    species=species||bag[(this.wildlifeCount||0)%bag.length];this.wildlifeCount=(this.wildlifeCount||0)+1;
    const mesh=makeMarineEncounter(species),p=mesh.userData.exotic,side=p.vx<0?1:-1;
    mesh.position.set(welcome?-.85:side*(species==='kraken'?4.7:3.7),this.girl.position.y+(species==='kraken'?1.1:.15),species==='kraken'?-2.6:welcome?-1.1:-.5);
    mesh.userData.vx=p.vx;this.world.add(mesh);this.water.apply(mesh);
    const entity={mesh,kind:'wildlife',hostile:p.danger,hp:species==='kraken'?120:25};this.entities.push(entity);
    if(p.danger)this.ui.toast(species==='kraken'?'深海海怪游近，留意觸手！':species==='sea-snake'?'環紋海蛇出現，保持距離！':'白帶魚從峽谷游來。');
    return entity;
  }

  _spawnVisitor() {
    if(this.visitorCount%3!==2){this.visitorCount++;this._spawnMarine();return;}
    if(this.entities.filter(e=>e.kind==='creature').length>=18)return;
    const jelly=this.visitorCount++%2===0,side=this.visitorCount%2?1:-1;
    const mesh=jelly?makeJelly():makeFish(0xaebbc3,.95);
    mesh.name=jelly?'Drifting near-field jellyfish':'Curious reef fish';
    mesh.position.set(clamp(this.girl.position.x+side*2.3,-4,4),this.girl.position.y+.12,-.65);
    mesh.userData.vx=-side*(jelly?.12:.26);mesh.rotation.y=side>0?Math.PI:0;
    this.world.add(mesh);this.water.apply(mesh);
    this.entities.push({mesh,kind:'creature',hostile:jelly,hp:jelly?22:8});
  }

  _ai(dt) {
    if(this.sleeping&&this.stamina>75)this.toggleSleep();
    if(this.stamina<25&&!this.sleeping)this.toggleSleep();
    const reaction=this.currentReaction;
    if(reaction.intent==='avoid'&&this.reactions.status.distance<2.4&&this.prompt==='careful'&&this.whaleState==='hidden')this.summonWhale();
    return reaction.velocity.clone();
  }

  _screenPoint(position){const p=position.clone().project(this.camera),rect=this.canvas.getBoundingClientRect();return{x:rect.left+(p.x*.5+.5)*rect.width,y:rect.top+(-p.y*.5+.5)*rect.height};}

  _collectLoot(e){
    if(e.dead)return;
    const point=this._screenPoint(e.mesh.getWorldPosition(new THREE.Vector3())),before=this.stamina;
    this.stamina=Math.min(100,this.stamina+(e.mesh.userData.staminaRestore||20));const repaired=this.dressDamage>0;this._setDressDamage(0);if(repaired)this.ui.toast('寶石修復洋裝，體力回復');
    e.dead=true;this.lootCount++;this.score+=gemType(e.mesh.userData.gemId).value;this.ui.setScore?.(this.score);this.ui.setTreasure?.(this.lootCount);this.ui.setStamina(this.stamina);this.audio.sfxTreasure();
    if(this.lootCount%5===0){this.seaweed++;this.ui.toast('收集 5 顆寶石：獲得一次海草復活');}
    this.feedback.collect(point,Math.round(this.stamina-before),e.mesh.userData.gemId);this.feedback.label({x:point.x,y:point.y-20},`+${gemType(e.mesh.userData.gemId).value} 分`);this.lastPickup={count:this.lootCount,staminaBefore:before,staminaAfter:this.stamina,repaired,point};
  }

  _update(dt) {
    if (!this.running) return;
    this.t += dt;this.combat.tick(dt,this);
    this.hurtCooldown=Math.max(0,this.hurtCooldown-dt);this.hurtTime=Math.max(0,this.hurtTime-dt);
    if(this.girl.userData.aura){this.girl.userData.aura.visible=this.hurtTime>0;this.girl.userData.aura.material.opacity=this.hurtTime*.4;}
    const zone = zoneAt(this.depth);
    this.audio.setMood(zone.mood);

    // Wavelength dependent absorption is applied by the actual scene-depth water pass.
    const deep = clamp(this.depth / 1600, 0, 1);
    this.hemi.intensity = .55-deep*.22;
    this.sun.intensity = 3.1-deep*1.65;
    this.key.color.set(0xb1dce9);
    this.shaftGroup.visible = false;
    this.ocean.rays.visible = this.depth < 400;
    this.bio.material.opacity = 0.2 + deep * 0.55;

    const speed = .30 * (this.sleeping ? .75 : 1) * (1 + this.boost) * (this.prompt === "careful" ? .85 : 1.0);
    this.depth += speed * dt * 3;
    this.maxDepth = Math.max(this.maxDepth, this.depth);
    this.depthBiomes.update(dt,this.t,this.depth,this);
    if (this.boost > 0) this.boost = Math.max(0, this.boost - dt * 0.9);
    if (this.whaleCd > 0) this.whaleCd = Math.max(0,this.whaleCd-dt);
    if (this.magicCd > 0) this.magicCd -= dt;
    if (this.attackT > 0) this.attackT -= dt;

    this.injuryEffects.update(dt);
    if (this.sleeping) this.stamina = Math.min(100, this.stamina + 12 * dt);
    else this.stamina=clamp(this.stamina+(this.swimMotor.active?-.30:.35)*dt,0,100);

    for(const entity of this.entities)if(entity.kind==='predator'&&!entity.dead)updatePredator(entity,this,dt);
    if(this.t>=this.nextPredatorAt){this._spawnPredator();this.nextPredatorAt=this.t+22+Math.random()*8;}
    this.currentReaction=this.reactions.update(this,dt);
    const previous=this.girl.position.clone();
    const aiMode=this.mode==='ai'||this.mode==='demo';
    this.tapMotion=this.tapSwim.update(dt,this.girl.position,{sleeping:this.sleeping});
    const desired=aiMode?this._ai(dt):new THREE.Vector3(this.tapMotion.x,this.tapMotion.y,0);
    if(!this.girl.userData.swimPPO&&this.girl.userData.turnStats?.active){const u=this.girl.userData.turnStats.progress;desired.multiplyScalar(.35+.45*Math.abs(Math.cos(Math.PI*u)));}
    this.policyCommand=desired.clone();if(this.girl.userData.swimPPO&&!this.sleeping&&!this.combat.active)desired.multiplyScalar(this.girl.userData.swimPPO.locomotionGain(desired));
    if(this.sleeping)desired.set(0,0,0);if(this.combat.active)desired.multiplyScalar(.15);
    const velocity=this.swimMotor.update(dt,desired,{sleeping:this.sleeping,style:!aiMode&&this.tapMotion.active?this.tapMotion.style:null});this.swimVelocity.copy(velocity);if(this.sleeping){this.swimVelocity.x+=Math.sin(this.t*.23)*.035;this.swimVelocity.y+=Math.sin(this.t*.31+.8)*.025;this.swimVelocity.z+=Math.sin(this.t*.19)*.012;}this.girl.position.addScaledVector(this.swimVelocity,dt);
    this.girl.position.x=clamp(this.girl.position.x,-3.2,3.2);this.girl.position.y=clamp(this.girl.position.y,-1.2,1.8);this.girl.position.z=clamp(this.girl.position.z,this.multiplayerAuthority?-1.2:-.35,this.multiplayerAuthority?1.2:.35);
    if((this.girl.position.y<=-1.2&&velocity.y<0)||(this.girl.position.y>=1.8&&velocity.y>0))this.swimMotor.velocity.y=0;

    const actualVelocity=this.girl.position.clone().sub(previous).multiplyScalar(1/Math.max(dt,.001));
    const acceleration=actualVelocity.clone().sub(this.previousMotionVelocity).multiplyScalar(1/Math.max(dt,.001)).clampLength(0,12);
    this.swimAcceleration.lerp(acceleration,1-Math.exp(-dt*6));this.previousMotionVelocity.copy(actualVelocity);
    // Steering drives the articulated waist and the delayed hair response.
    const swimmingSpeed=this.swimVelocity.length();
    this.swimPhase+=dt*(1.30+swimmingSpeed*.20);
    const easing=1-Math.exp(-dt*3.5);
    const activity=this.sleeping?0:clamp(.88+swimmingSpeed*.10,.88,1);
    this.girl.rotation.z=THREE.MathUtils.lerp(this.girl.rotation.z,-.10-this.swimVelocity.x*.20+Math.sin(this.t*.6)*.025,easing);
    this.girl.rotation.y=THREE.MathUtils.lerp(this.girl.rotation.y,.42+this.swimVelocity.x*.22,easing);
    this.girl.rotation.x=THREE.MathUtils.lerp(this.girl.rotation.x,this.sleeping?.10+Math.sin(this.t*.35)*.16:-.12-this.swimVelocity.y*.04,easing);
    const stroke=this.swimMotor.last,diveWeight=this.sleeping||this.tapMotion.active?0:stroke.diveWeight,ascentWeight=this.sleeping||this.tapMotion.active?0:stroke.ascentWeight;
    animateCharacter(this.girl,this.t,{commandVelocity:this.policyCommand,sleeping:this.sleeping,diveWeight,ascentWeight,strokeStage:stroke.stage,strokeProgress:stroke.progress,state:this.sleeping||stroke.stage==='idle'?'float':'swim',activity,speed:swimmingSpeed,phase:this.swimPhase,turn:this.swimVelocity.x*.4,intent:this.currentReaction.intent,lookAt:!aiMode&&this.tapMotion.active?null:this.currentReaction.lookAt,velocity:actualVelocity,acceleration:this.swimAcceleration,controlled:!aiMode&&this.tapMotion.active,swimStyle:!aiMode&&this.tapMotion.active?this.tapMotion.style:null,strokeTime:this.tapMotion.elapsed,strokeSeed:this.tapMotion.motionSeed,swimDirection:!aiMode&&this.tapMotion.active?desired.clone().normalize():null});
    this.combat.afterPose(this);
    // Include the visible canyon/foreground stones, not only spawned hazards.
    const solids=[];this.ocean.group.updateMatrixWorld(true);this.ocean.group.traverse(o=>{if(o.isMesh&&o.material===this.ocean.material)solids.push(o)});for(const e of this.entities)if(e.kind==='rock')solids.push(e.mesh);
    const contacts=this.rockContacts.resolve(this.girl,solids);
    if(contacts.length){const hit=contacts.reduce((a,b)=>a.penetration>b.penetration?a:b);if(hit.penetration>.025||this.swimVelocity.dot(hit.normal)<-.06){if(this._hurt(this.entities.find(e=>e.mesh===hit.mesh)?.volcanic?14:10,hit.point,'rock')){this.swimMotor.impulse(hit.normal.x*.5,hit.normal.y*.4,hit.normal.z*.1);this.audio.sfxRock();}}}
    resolveGirlShark(this,dt);
    this.waterSwipe.update(dt,this.t,this.girl,this.camera,this.mode==='manual'&&this.tapMotion.active?{x:this.pointer?.x||0,y:this.pointer?.y||0,active:true}:null,actualVelocity,!this.sleeping);
    this.swimBubbles.update(dt,this.t,this.girl,{swimming:!this.sleeping,boost:this.boost,velocity:this.swimVelocity,phase:this.swimPhase,turn:this.swimVelocity.x*.4});
    this._updateWhale(dt);this._updateCamera(dt);

    if(this.t>=this.nextVisitorAt){this._spawnVisitor();this.nextVisitorAt=this.t+6.5+Math.random()*2.5}
    this.spawnAcc += dt;
    if (this.spawnAcc > (this.prompt === "careful" ? 2.0 : 1.5)) {
      this.spawnAcc = 0;
      this._spawn();
    }

    // move world up (falling feeling)
    const rise = descentTravel(speed * dt * 3);
    for (const e of this.entities) {
      if(e.dead)continue;
      if(e.kind!=='predator')e.mesh.position.y += rise;
      if(e.kind==='wildlife')updateMarineEncounter(e,this,dt);if(e.combatFlee){e.combatFlee.age+=dt;e.mesh.position.addScaledVector(e.combatFlee.direction,dt*2.4);e.mesh.rotation.z+=dt*.5;animateMarine(e.mesh,this.t);if(e.combatFlee.age>3.5)e.dead=true;continue;}
      if (e.kind === "creature") {
        e.mesh.position.x += (e.mesh.userData.vx || 0) * dt;
        const creature=e.mesh.userData.marine;
        if(Math.abs(e.mesh.position.x)>5.8){e.mesh.position.x=clamp(e.mesh.position.x,-5.8,5.8);e.mesh.userData.vx*=-1}
        if(creature?.kind==='fish'){
          const heading=e.mesh.userData.vx<0?Math.PI:0;
          e.mesh.rotation.y+=Math.atan2(Math.sin(heading-e.mesh.rotation.y),Math.cos(heading-e.mesh.rotation.y))*Math.min(dt*2,1);
          e.mesh.rotation.z=Math.sin(this.t*.8+creature.uniforms.uCreaturePhase.value)*.024;
        }else if(creature?.kind==='jelly')e.mesh.position.y+=dt*(.04+Math.max(0,Math.sin(this.t*2.55+creature.uniforms.uCreaturePhase.value))*.09);
        animateMarine(e.mesh,this.t,e.mesh.userData.vx);
      }
      if (e.kind === "loot") {
        animateGemstone(e.mesh,this.t);
        e.mesh.rotation.y += dt*.65;
        e.mesh.rotation.z=Math.sin(this.t*1.8+e.mesh.position.x)*.10;
      }
      if (e.kind === "rune") e.mesh.rotation.z += dt * 1.5;

      const d = e.mesh.position.distanceTo(this.girl.position);
      if(e.kind==='creature'&&e.hostile&&this.rockContacts.pickupDistance(this.girl,e.mesh.position)<.20){
        if(this._hurt(8,e.mesh.position,'creature'))this.audio.sfxHit();
      }else if(e.kind==='loot'&&this.rockContacts.pickupDistance(this.girl,e.mesh.position)<.38){this._collectLoot(e);}

      if (e.mesh.position.y > 12) e.dead = true;
    }
    this.entities = this.entities.filter((e) => {
      if (e.dead) {
        this.world.remove(e.mesh);disposeEntity(e);
        return false;
      }
      return true;
    });

    this.bio.rotation.y += dt * 0.05;

    if (this.mode === "demo") {
      const second=Math.floor(this.t);
      if(second!==this.lastDemoSecond){
        this.lastDemoSecond=second;
        if(second%11===3)this.summonWhale();
        if(second%13===5)this.placeMagic();
        if(second%17===7)this.triggerBoost();
        const prompts=['proactive','treasure','careful','explore'],prompt=prompts[Math.floor(this.t/12)%prompts.length];
        if(prompt!==this.prompt)this.setPrompt(prompt);
      }
    }

    if (this.stamina <= 0) this._die();

    this.ui.setDepth(this.depth, this.best);
    this.ui.setStamina(this.stamina);
  }

  _hurt(n,point=null,source='impact') {
    if(this.hurtCooldown>0||!this.running||this.combat?.stage==='strike')return false;
    const amount=Math.round(this.whaleState==='following'?n*.35:n);this.stamina=clamp(this.stamina-amount,0,100);this.hurtCooldown=.95;this.hurtTime=.45;
    const aura=this.girl.userData.aura;if(aura){aura.visible=true;aura.material.color.setHex(0xff6868);aura.material.opacity=.22;}
    const location=point||this.girl.userData.bones.head.getWorldPosition(new THREE.Vector3());
    this.feedback.damage(this._screenPoint(location),amount);this.ui.setStamina(this.stamina);this.lastDamage={amount,source,time:this.t,stamina:this.stamina};return true;
  }

  _die() {
    if (!this.running) return;
    this.running = false;
    this.combat.interrupt(this);this.audio.sfxDeath();
    this.best = Math.max(this.best, Math.floor(this.maxDepth));
    localStorage.setItem(BEST_KEY, String(this.best));
    this.ui.showGameOver({
      depth: Math.floor(this.maxDepth),
      loot: this.lootCount,score:this.score,
      canRevive: this.seaweed > 0,
    });
  }

  revive() {
    if (this.seaweed <= 0) return;
    this.seaweed -= 1;
    this.stamina = 60;
    this.running = true;
    this.audio.sfxRevive();
    this.ui.showGame();
    this.ui.toast("海草復活！");
    this.summonWhale();
  }

  _loop(ts) {
    if (!this._last) this._last = ts;
    let dt = Math.min(.12, (ts - this._last) / 1000);
    this._last = ts;
    this.feedback.update(dt);
    if (this.running) this._update(dt);
    else {
      this.t += dt;
      this.girl.rotation.y = Math.sin(this.t * 0.5) * 0.3;
      animateCharacter(this.girl, this.t);
      animateCharacter(this.whale, this.t);
      this.camera.lookAt(0,.8,-1);
    }
    this.ocean.update(this.t,{depth:this.depth});this.oceanDetails.update(this.t,this.depth,this);
    this.water.render(this.t,{depth:this.depth,light:this.depthBiomes.current?.light??1,biome:this.depthBiomes.current});
    this.combat?.elemental?.renderOverlay(this.renderer, this.camera);
    requestAnimationFrame(this._loop);
  }

  _updateWhale(dt){
    this.whaleBubbles.updateExternal(dt,this.t);this.rockFragments.update(dt);
    const visit=this.whaleEncounter.advance(dt,performance.now()/1000),previous=this.whaleState;this.whaleState=visit.state;this.whaleTime=visit.elapsed;
    if(this.ui.btnWhale){this.ui.btnWhale.disabled=this.whaleState!=='hidden'||this.whaleCd>0;this.ui.btnWhale.textContent=this.whaleState==='approaching'?'鯨魚游來中…':this.whaleState==='following'?'相伴 '+Math.max(0,Math.ceil(10-visit.stay))+' 秒':this.whaleState==='departing'?'鯨魚離開中…':this.whaleCd>0?'稍候再呼喚':'呼喚鯨魚';}
    if(this.whaleState==='hidden'){this.whale.visible=false;this.whaleNear=0;return;}
    this.whale.visible=true;const profile=visit.profile,approaching=this.whaleState==='approaching',departing=this.whaleState==='departing';
    const inertia=1-Math.exp(-dt*1.6),phase=visit.elapsed*profile.tempo+profile.phase;this.whaleNear=THREE.MathUtils.lerp(this.whaleNear,profile.near*(approaching?visit.arrival:departing?1-visit.departure:1),inertia);
    const old=this.whale.position.clone();let tangent=new THREE.Vector3();const pose=new THREE.Quaternion().setFromEuler(new THREE.Euler(...profile.pose,'YZX'));
    if(approaching){const u=THREE.MathUtils.smoothstep(visit.arrival,0,1),path=new THREE.QuadraticBezierCurve3(this.whaleArrivalStart,this.whaleArrivalControl,this.whaleArrivalEnd);this.whale.position.copy(path.getPoint(u));tangent.copy(path.getTangent(Math.min(u,.998))).normalize();const incoming=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1,0,0),tangent);this.whale.quaternion.copy(incoming).slerp(pose,THREE.MathUtils.smoothstep(u,.36,1));}
    else if(departing){if(!this.whaleDepartureStart){this.whaleDepartureStart=old.clone();this.whaleDepartureControl=old.clone().add(new THREE.Vector3(profile.exit[0]*.45,3,-4));this.whaleDepartureEnd=this.whaleAnchor.clone().add(new THREE.Vector3(...profile.exit));this.whaleDepartureRotation=this.whale.quaternion.clone();this.ui.whaleLine('我們下次再一起游。');}const u=THREE.MathUtils.smoothstep(visit.departure,0,1),path=new THREE.QuadraticBezierCurve3(this.whaleDepartureStart,this.whaleDepartureControl,this.whaleDepartureEnd);this.whale.position.copy(path.getPoint(u));tangent.copy(path.getTangent(u)).normalize();const outgoing=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1,0,0),tangent);this.whale.quaternion.copy(this.whaleDepartureRotation).slerp(outgoing,THREE.MathUtils.smoothstep(u,0,.8));}
    else{if(previous==='approaching')this.ui.whaleLine('我在這裡，輕輕碰一下。');this.whaleAnchor.lerp(this.girl.position,1-Math.exp(-dt*.35));const target=this.whaleAnchor.clone().add(new THREE.Vector3(...profile.stop));target.y+=Math.sin(phase*.72)*.10;target.x+=Math.sin(phase*.43)*.12;this.whale.position.lerp(target,1-Math.exp(-dt*1.3));const sway=new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.sin(phase*.6)*.07,Math.sin(phase*.43)*.08,Math.sin(phase*.55)*.05));this.whale.quaternion.slerp(pose.multiply(sway),inertia);}
    const velocity=this.whale.position.clone().sub(old).multiplyScalar(1/Math.max(dt,.001));this.whaleTurn=profile.bias*.45+Math.sin(phase*.56)*.2;this.whaleLift=profile.stop[1]*.12+Math.sin(phase*.67)*.15;this.whaleEffort=approaching||departing?.88:.58;this.whaleSwimPhase=phase;
    animateCharacter(this.whale,this.t,{phase,effort:this.whaleEffort,turn:this.whaleTurn,lift:this.whaleLift,asymmetry:profile.bias,waveScale:profile.wave});
    this.whale.updateMatrixWorld(true);this.whaleContacts.refresh(this.whale);
    this._whaleSharkContacts();
    const rocks=this.entities.filter(e=>e.kind==='rock'&&!e.dead).map(e=>e.mesh);this.ocean.group.updateMatrixWorld(true);this.ocean.group.traverse(o=>{if(o.isMesh&&o.material===this.ocean.material&&!o.name.startsWith('continuous_cliff'))rocks.push(o)});
    this.whaleContacts.strikeRocks(this.whale,rocks,(mesh,point,direction)=>this._breakWhaleRock(mesh,point,direction));this._whaleTouch(dt);
    this.whaleBubbleAcc+=dt*(approaching||departing?38:8);while(this.whaleBubbleAcc>=1){this.whaleBubbles.burst(this.whale.position,velocity,1,1.7,1.2);this.whaleBubbleAcc--;}
    this.whaleVisitStats={state:this.whaleState,elapsed:visit.elapsed,stay:visit.stay,profile:profile.name,position:this.whale.position.toArray(),scale:profile.scale,rocksBroken:this.rocksBroken,affection:this.affection};
  }

  _whaleSharkContacts(){
    for(const e of this.entities){if(e.kind!=='predator'||e.dead)continue;
      // The whale is massive: the smaller fish yields against its posed skin.
      if(e.mesh.position.distanceTo(this.whale.position)>11)continue;
      const hit=this.whaleContacts.resolveGirl(e.mesh,predatorBodySpheres(e.mesh));
      if(!hit.touching)continue;
      if(scarePredator(e,hit.point,hit.direction)){
        this.whaleBubbles.burst(hit.point,hit.direction.clone().multiplyScalar(1.8),22,1.3,.75);
        this.sharksScared=(this.sharksScared||0)+1;
        this.lastSharkContact={time:this.t,correction:hit.correction,point:hit.point.toArray(),direction:hit.direction.toArray()};
        this.ui.toast('鯨魚擋住鯊魚，牠受驚游走了！');
      }else e.mesh.userData.predator.fleeDirection.lerp(hit.direction,.35).normalize();
    }
  }

  _updateCamera(dt){
    const encounter=this.whaleState!=='hidden',near=this.whaleNear||0,blend=1-Math.exp(-dt*1.8);
    const manual=this.mode==='manual'&&!encounter,follow=manual?.10:1;
    const target=new THREE.Vector3(this.girl.position.x*(manual?.10:.65)+(encounter?.4:0)+near*.70,this.girl.position.y*follow+(encounter?-.90:.42)+near*.50,encounter?-2.5+near*1.6:-1.0);
    this.cameraTarget.lerp(target,blend);
    this.camera.position.lerp(new THREE.Vector3(.8+this.girl.position.x*(manual?.10:.35)-near*.35,this.girl.position.y*follow+(encounter?2.6:1.7)+near*.1,encounter?12.5-near*2.6:manual?8.5:10.0),blend);
    this.camera.lookAt(this.cameraTarget);
  }
}
