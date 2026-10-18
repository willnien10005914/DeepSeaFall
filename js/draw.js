/** Procedural lively drawings — girl, whale, fauna, hazards, loot. */

export const HAIR = [
  { id: "long", label: "長波浪", color: "#2b1b12" },
  { id: "twin", label: "雙馬尾", color: "#5a2a1a" },
  { id: "short", label: "短俏髮", color: "#1c2430" },
  { id: "glow", label: "螢光藍", color: "#5ce1ff" },
  { id: "coral", label: "珊瑚粉", color: "#ff8fab" },
  { id: "abyss", label: "深淵紫", color: "#8b6cff" },
];

export const OUTFITS = [
  { id: "dress", label: "水色洋裝", main: "#7ad7f0", accent: "#ffffff" },
  { id: "diver", label: "潛水衣", main: "#1aa7a0", accent: "#ffd166" },
  { id: "kimono", label: "海紋浴衣", main: "#ff6b6b", accent: "#fff0e6" },
  { id: "armor", label: "珊瑚甲", main: "#d4a373", accent: "#5ce1ff" },
  { id: "mage", label: "氣功袍", main: "#c9a7ff", accent: "#9dffb0" },
  { id: "shadow", label: "深淵披風", main: "#1b2433", accent: "#5ce1ff" },
];

export const WEAPONS = [
  { id: "hand", label: "空手", color: "#fff", reach: 36, dmg: 8 },
  { id: "finblade", label: "鰭刃", color: "#5ce1ff", reach: 54, dmg: 14 },
  { id: "coralstaff", label: "珊瑚杖", color: "#ff8fab", reach: 62, dmg: 12 },
  { id: "abyssspear", label: "深淵矛", color: "#9dffb0", reach: 70, dmg: 18 },
  { id: "auraring", label: "氣功環", color: "#ffd166", reach: 80, dmg: 16 },
];

export function drawGirl(ctx, girl, t) {
  const { x, y, facing, sleeping, hair, outfit, invuln } = girl;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(facing, 1);
  if (invuln > 0 && Math.floor(t * 20) % 2 === 0) ctx.globalAlpha = 0.45;

  const bob = Math.sin(t * (sleeping ? 2 : 6)) * (sleeping ? 1.5 : 3);
  ctx.translate(0, bob);

  // soft aura
  const grd = ctx.createRadialGradient(0, 0, 4, 0, 0, 46);
  grd.addColorStop(0, "rgba(255,255,255,0.35)");
  grd.addColorStop(1, "rgba(92,225,255,0)");
  ctx.fillStyle = grd;
  ctx.beginPath();
  ctx.arc(0, 0, 46, 0, Math.PI * 2);
  ctx.fill();

  // hair back
  ctx.fillStyle = hair.color;
  ctx.beginPath();
  if (hair.id === "twin") {
    ctx.ellipse(-10, 8, 7, 18, -0.2, 0, Math.PI * 2);
    ctx.ellipse(10, 8, 7, 18, 0.2, 0, Math.PI * 2);
  } else if (hair.id === "short") {
    ctx.ellipse(0, -2, 15, 14, 0, 0, Math.PI * 2);
  } else {
    ctx.moveTo(-14, -6);
    ctx.quadraticCurveTo(-22, 28 + Math.sin(t * 3) * 3, -8, 40);
    ctx.quadraticCurveTo(0, 28, 10, 42);
    ctx.quadraticCurveTo(22, 24 + Math.cos(t * 2.5) * 3, 14, -6);
    ctx.closePath();
  }
  ctx.fill();

  // head
  ctx.fillStyle = "#ffd7c2";
  ctx.beginPath();
  ctx.ellipse(0, -6, 12, 13, 0, 0, Math.PI * 2);
  ctx.fill();

  // bangs
  ctx.fillStyle = hair.color;
  ctx.beginPath();
  ctx.ellipse(0, -12, 13, 8, 0, Math.PI, Math.PI * 2);
  ctx.fill();

  // face
  ctx.fillStyle = "#2a1c18";
  if (sleeping) {
    ctx.beginPath();
    ctx.arc(-4, -6, 1.4, 0, Math.PI);
    ctx.arc(4, -6, 1.4, 0, Math.PI);
    ctx.strokeStyle = "#2a1c18";
    ctx.lineWidth = 1.4;
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(-4, -6, 1.6, 0, Math.PI * 2);
    ctx.arc(4, -6, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#e8899a";
  ctx.beginPath();
  ctx.ellipse(0, -1.5, 2.2, 1.2, 0, 0, Math.PI * 2);
  ctx.fill();

  // body / outfit
  ctx.fillStyle = outfit.main;
  ctx.beginPath();
  ctx.moveTo(-10, 6);
  ctx.quadraticCurveTo(-16, 24, -8, 38);
  ctx.lineTo(8, 38);
  ctx.quadraticCurveTo(16, 24, 10, 6);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = outfit.accent;
  ctx.fillRect(-3, 10, 6, 14);

  // arms
  ctx.strokeStyle = "#ffd7c2";
  ctx.lineWidth = 3.2;
  ctx.lineCap = "round";
  const arm = sleeping ? 0.4 : Math.sin(t * 5) * 0.5;
  ctx.beginPath();
  ctx.moveTo(-9, 12);
  ctx.quadraticCurveTo(-18, 18 + arm * 8, -14, 28);
  ctx.moveTo(9, 12);
  ctx.quadraticCurveTo(18, 18 - arm * 8, 14, 28);
  ctx.stroke();

  // legs / fins feel
  ctx.beginPath();
  ctx.moveTo(-5, 38);
  ctx.quadraticCurveTo(-8, 48, -3, 54);
  ctx.moveTo(5, 38);
  ctx.quadraticCurveTo(8, 48, 3, 54);
  ctx.stroke();

  // weapon sparkle
  if (girl.weapon && girl.weapon.id !== "hand") {
    ctx.strokeStyle = girl.weapon.color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(12, 8);
    ctx.lineTo(12 + girl.weapon.reach * 0.25, -4);
    ctx.stroke();
    ctx.fillStyle = girl.weapon.color;
    ctx.beginPath();
    ctx.arc(12 + girl.weapon.reach * 0.25, -4, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  if (sleeping) {
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.font = "10px Fredoka, sans-serif";
    ctx.fillText("z", 16, -18);
    ctx.fillText("z", 22, -26);
  }

  ctx.restore();
}

export function drawWhale(ctx, whale, t) {
  const { x, y, scale = 1, alpha = 1 } = whale;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale * (whale.facing || 1), scale);
  ctx.globalAlpha = alpha;

  // body
  const body = ctx.createLinearGradient(-80, 0, 80, 0);
  body.addColorStop(0, "#4d6d86");
  body.addColorStop(0.5, "#7fa3b8");
  body.addColorStop(1, "#3d5a70");
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.ellipse(0, 0, 78, 34, 0, 0, Math.PI * 2);
  ctx.fill();

  // belly
  ctx.fillStyle = "rgba(230,245,255,0.75)";
  ctx.beginPath();
  ctx.ellipse(5, 10, 48, 16, 0, 0, Math.PI * 2);
  ctx.fill();

  // tail
  const flap = Math.sin(t * 2.2) * 10;
  ctx.beginPath();
  ctx.moveTo(-70, 0);
  ctx.quadraticCurveTo(-100, -28 + flap, -118, -8 + flap);
  ctx.quadraticCurveTo(-95, 0, -118, 14 - flap);
  ctx.quadraticCurveTo(-100, 28 - flap, -70, 0);
  ctx.fillStyle = "#5f7f96";
  ctx.fill();

  // fin
  ctx.beginPath();
  ctx.moveTo(10, -20);
  ctx.quadraticCurveTo(0, -48, -20, -28);
  ctx.quadraticCurveTo(0, -24, 10, -20);
  ctx.fill();

  // eye
  ctx.fillStyle = "#102030";
  ctx.beginPath();
  ctx.arc(48, -6, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(49, -7, 1.4, 0, Math.PI * 2);
  ctx.fill();

  // glow trail
  const g = ctx.createRadialGradient(0, 0, 10, 0, 0, 100);
  g.addColorStop(0, "rgba(92,225,255,0.08)");
  g.addColorStop(1, "rgba(92,225,255,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 100, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

export function drawCreature(ctx, c, t) {
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.scale(c.facing || 1, 1);
  const pulse = 1 + Math.sin(t * 4 + c.phase) * 0.05;

  if (c.kind === "school" || c.kind === "clown" || c.kind === "angelfish" || c.kind === "tuna") {
    ctx.fillStyle = c.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, 10 * pulse, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-10, 0);
    ctx.lineTo(-16, -5);
    ctx.lineTo(-16, 5);
    ctx.closePath();
    ctx.fill();
    if (c.kind === "clown") {
      ctx.fillStyle = "#fff";
      ctx.fillRect(-3, -5, 3, 10);
    }
  } else if (c.kind === "jellyfish" || c.kind === "jelly" || c.kind === "biolume") {
    ctx.fillStyle = c.color;
    ctx.globalAlpha = 0.75;
    ctx.beginPath();
    ctx.arc(0, 0, 10, Math.PI, 0);
    ctx.fill();
    ctx.strokeStyle = c.color;
    ctx.lineWidth = 1.5;
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 2.5, 0);
      ctx.quadraticCurveTo(i * 2.5 + Math.sin(t * 3 + i) * 2, 12, i * 2, 20);
      ctx.stroke();
    }
  } else if (c.kind === "angler" || c.kind === "viper" || c.kind === "gulper" || c.kind === "monster") {
    ctx.fillStyle = c.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, c.kind === "monster" ? 28 : 16, c.kind === "monster" ? 18 : 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#ff5a5a";
    ctx.beginPath();
    ctx.arc(10, -2, 3, 0, Math.PI * 2);
    ctx.fill();
    if (c.kind === "angler" || c.kind === "monster") {
      ctx.strokeStyle = "#ffd166";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.quadraticCurveTo(8, -24, 14, -16);
      ctx.stroke();
      ctx.fillStyle = "#ffd166";
      ctx.beginPath();
      ctx.arc(14, -16, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (c.kind === "ray" || c.kind === "turtle") {
    ctx.fillStyle = c.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, 22, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(-6, 0, 8, 16, 0.2, 0, Math.PI * 2);
    ctx.ellipse(6, 0, 8, 16, -0.2, 0, Math.PI * 2);
    ctx.fill();
  } else if (c.kind === "squid" || c.kind === "eel" || c.kind === "ghost") {
    ctx.fillStyle = c.color;
    ctx.globalAlpha = c.kind === "ghost" ? 0.55 : 0.9;
    ctx.beginPath();
    ctx.ellipse(0, 0, 8, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(-4 + i * 2.5, 12);
      ctx.quadraticCurveTo(-4 + i * 2.5 + Math.sin(t * 5 + i) * 3, 24, -2 + i * 2, 30);
      ctx.strokeStyle = c.color;
      ctx.stroke();
    }
  } else if (c.kind === "crab") {
    ctx.fillStyle = c.color;
    ctx.fillRect(-8, -4, 16, 10);
    ctx.strokeStyle = c.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-8, 0);
    ctx.lineTo(-16, -8);
    ctx.moveTo(8, 0);
    ctx.lineTo(16, -8);
    ctx.stroke();
  } else {
    ctx.fillStyle = c.color || "#8cf";
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawRock(ctx, r) {
  ctx.save();
  ctx.translate(r.x, r.y);
  ctx.fillStyle = r.volcanic ? "#4a2218" : "#3a4654";
  ctx.beginPath();
  ctx.moveTo(-r.w * 0.5, r.h * 0.4);
  ctx.lineTo(-r.w * 0.3, -r.h * 0.5);
  ctx.lineTo(0, -r.h * 0.25);
  ctx.lineTo(r.w * 0.35, -r.h * 0.55);
  ctx.lineTo(r.w * 0.5, r.h * 0.4);
  ctx.closePath();
  ctx.fill();
  if (r.volcanic) {
    ctx.fillStyle = `rgba(255,${100 + Math.floor(Math.random() * 80)},40,0.85)`;
    ctx.beginPath();
    ctx.arc(0, -r.h * 0.2, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  if (r.rune) {
    ctx.strokeStyle = "#ffd166";
    ctx.shadowColor = "#5ce1ff";
    ctx.shadowBlur = 12;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.stroke();
    ctx.font = "12px Fredoka, sans-serif";
    ctx.fillStyle = "#ffd166";
    ctx.textAlign = "center";
    ctx.fillText(r.rune, 0, 4);
  }
  ctx.restore();
}

export function drawLoot(ctx, item, t) {
  ctx.save();
  ctx.translate(item.x, item.y + Math.sin(t * 3 + item.phase) * 3);
  if (item.type === "treasure") {
    ctx.fillStyle = "#ffd166";
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(8, 0);
    ctx.lineTo(0, 8);
    ctx.lineTo(-8, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#fff6cc";
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.fill();
  } else if (item.type === "seaweed") {
    ctx.strokeStyle = "#4ade80";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 10);
    ctx.quadraticCurveTo(6, 0, 0, -12);
    ctx.quadraticCurveTo(-6, 0, 0, 10);
    ctx.stroke();
  } else if (item.type === "equip") {
    ctx.fillStyle = item.color || "#5ce1ff";
    ctx.fillRect(-7, -7, 14, 14);
    ctx.strokeStyle = "#fff";
    ctx.strokeRect(-7, -7, 14, 14);
  } else if (item.type === "hair") {
    ctx.fillStyle = item.color || "#5a2a1a";
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function drawBubble(ctx, b) {
  ctx.save();
  ctx.strokeStyle = `rgba(220,250,255,${b.a})`;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

export function drawAttackArc(ctx, girl, tAttack) {
  if (tAttack <= 0) return;
  const p = 1 - tAttack;
  ctx.save();
  ctx.translate(girl.x, girl.y);
  ctx.strokeStyle = girl.weapon.color;
  ctx.globalAlpha = tAttack;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, girl.weapon.reach * (0.6 + p * 0.5), -1.2, 1.2);
  ctx.stroke();
  ctx.restore();
}
