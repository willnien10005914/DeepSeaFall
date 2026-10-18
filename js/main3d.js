import {bootstrap,MultiplayerClient} from './multiplayer/client.js?v=50';
import { setupBottomDock } from "./three/bottom-dock.js?v=50";
import { createGameUI } from "./game-ui.js?v=50";

const canvas = document.getElementById("game");
const $ = (id) => document.getElementById(id);

setupBottomDock();

let game;
const ui = createGameUI(() => game);

const roomInfo=await bootstrap();
const params = new URLSearchParams(location.search);
const internal = window.__MP_SIMULATION || window.__MP_RENDERER;
const mobile = matchMedia("(pointer: coarse)").matches || /Android|iPhone|iPad/i.test(navigator.userAgent);
const cloud = !internal && (params.get("render") === "cloud" || (!params.has("render") && mobile));
let makeReplica;
if (cloud) {
  const { CloudGame, CloudReplica } = await import("./stream/cloud-game.js?v=50");
  game = new CloudGame(canvas, ui);
  makeReplica = CloudReplica;
} else {
  const [{Game3D}, {SeaReplica}, {seeded}] = await Promise.all([
    import("./three/game3d.js?v=50"), import("./multiplayer/replica.js?v=50"), import("./multiplayer/common.js?v=50"),
  ]);
  if(roomInfo || internal) Math.random=seeded(roomInfo?.seed ?? window.__MP_SEED);
  game = new Game3D(canvas, ui);
  makeReplica = SeaReplica;
}
window.__deepSeaFall = game;
const multiplayer=roomInfo?new MultiplayerClient(game,roomInfo,{makeReplica}):null;
window.__multiplayer=multiplayer;

if(cloud && !roomInfo){
  $("btnStartManual").textContent="重新連線";
  document.querySelector("#titleScreen .tagline").textContent="暫時無法連上海域，請重試。";
}
$("btnStartManual").addEventListener("click", () => multiplayer?multiplayer.join():cloud?location.reload():game.start("manual"));
$("btnStartAI").addEventListener("click", () => { game.prompt = "proactive"; game.start("ai"); });
$("btnDemo").addEventListener("click", () => game.start("demo"));
$("btnRetry").addEventListener("click", () => multiplayer?multiplayer.join():game.start(game.mode === "demo" ? "demo" : "manual"));
$("btnRevive").addEventListener("click", () => game.revive());

if (params.get("demo") === "1") {
  window.addEventListener("load", async () => {
    await game.start("demo");
  });
}
