export function createGameUI(getGame) {
  const $ = id => document.getElementById(id);
  return {
  btnSleep: $("btnSleep"),
  btnWhale: $("btnWhale"),
  btnBoost: $("btnBoost"),
  btnMagic: $("btnMagic"),
  btnAttack: $("btnAttack"),
  btnMode: $("btnMode"),
  btnMusic: $("btnMusic"),
  aiPanel: $("aiPanel"),

  showGame() {
    $("titleScreen").classList.add("hidden");
    $("gameOver").classList.add("hidden");
    $("hud").classList.remove("hidden");
    $("controls").classList.remove("hidden");
    $("bottomDock").classList.remove("hidden");
    this.toggleAi(getGame().mode === "ai" || getGame().mode === "demo");
  },
  toggleAi(on) { $("aiPanel").classList.toggle("hidden", !on); },
  setModeLabel(mode) {
    $("btnMode").textContent =
      mode === "ai" ? "AI Mode（點此切手動）" :
      mode === "demo" ? "示範模式" : "手動（點此切 AI）";
  },
  setAiStatus(text) { $("aiStatus").textContent = text; },
  setDepth(depth, best) {
    $("depthValue").textContent = String(Math.floor(depth));
    $("bestValue").textContent = String(Math.floor(best));
  },
  setBest(best) { $("bestValue").textContent = String(Math.floor(best)); },
  setStamina(v) {
    $("staminaFill").style.width = `${Math.max(0, Math.min(100, v))}%`;
  },
  setDressCondition(v) { const el=$('dressCondition');if(el){el.textContent=v>0?'洋裝：裙擺破損':'洋裝：完好';el.classList.toggle('worn',v>0);} },
  setAffection(v) { $("affectionCount").textContent = String(v); },
  setTreasure(v) { $("treasureCount").textContent = String(v); },
  setScore(v){if($('scoreCount'))$('scoreCount').textContent=String(v);},
  setEquip(girl) {
    const strip = $("equipStrip");
    strip.innerHTML = "";
    for (const label of [girl.hair.label, girl.outfit.label, girl.weapon.label]) {
      const chip = document.createElement("span");
      chip.className = "equip-chip";
      chip.textContent = label;
      strip.appendChild(chip);
    }
  },
  toast(msg) {
    const el = $("toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.remove("show"), 1400);
  },
  whaleLine(msg) {
    const el = $("whaleLine");
    el.textContent = `🐋 ${msg}`;
    el.classList.add("show");
    clearTimeout(this._whaleTimer);
    this._whaleTimer = setTimeout(() => el.classList.remove("show"), 2200);
  },
  showGameOver({ depth, loot, score=0, canRevive }) {
    $("gameOver").classList.remove("hidden");
    $("controls").classList.add("hidden");
    $("bottomDock").classList.add("hidden");
    $("aiPanel").classList.add("hidden");
    $("finalDepth").textContent = String(depth);
    $("finalLoot").textContent = String(loot);
    if($("finalScore"))$("finalScore").textContent=String(score);
    $("btnRevive").classList.toggle("hidden", !canRevive);
    $("reviveHint").classList.toggle("hidden", !canRevive);
  },
};

}
