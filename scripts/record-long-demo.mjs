/**
 * 3–5 minute gameplay capture showing all major features + muxed music/SFX.
 * Output: demo/deep_sea_fall_playthrough.mp4
 */
import { createServer } from "http";
import { readFile } from "fs/promises";
import { existsSync, mkdirSync, copyFileSync, unlinkSync } from "fs";
import { extname, join, dirname } from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import { chromium } from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const demoDir = join(root, "demo");
const PORT = Number(process.env.PORT || 8766);
const RECORD_MS = Number(process.env.RECORD_MS || 240000); // 4 minutes

const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

function startStaticServer() {
  return new Promise((resolve, reject) => {
    const server = createServer(async (req, res) => {
      try {
        let path = req.url.split("?")[0];
        if (path === "/") path = "/index.html";
        const file = join(root, path);
        if (!file.startsWith(root)) {
          res.writeHead(403); res.end(); return;
        }
        const data = await readFile(file);
        res.writeHead(200, { "Content-Type": mime[extname(file)] || "application/octet-stream" });
        res.end(data);
      } catch {
        res.writeHead(404); res.end("missing");
      }
    });
    server.on("error", reject);
    server.listen(PORT, "127.0.0.1", () => resolve(server));
  });
}

async function main() {
  if (!existsSync(demoDir)) mkdirSync(demoDir, { recursive: true });
  console.log(`Recording ${RECORD_MS / 1000}s on :${PORT}`);
  const server = await startStaticServer();

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--autoplay-policy=no-user-gesture-required",
      "--use-fake-ui-for-media-stream",
      "--disable-web-security",
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    recordVideo: { dir: demoDir, size: { width: 390, height: 844 } },
    hasTouch: true,
    isMobile: true,
  });

  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${PORT}/?demo=1&t=${Math.floor(RECORD_MS / 1000)}`, {
    waitUntil: "networkidle",
  });

  // Smoke: ensure game boots
  const ok = await page.evaluate(async () => {
    const g = window.__deepSeaFall;
    if (!g) return false;
    await g.audio.unlock();
    if (!g.running) await g.start("demo");
    g.audio.sfxWhale();
    document.getElementById("game")?.dispatchEvent(
      new PointerEvent("pointerdown", { bubbles: true, clientX: 200, clientY: 400 }),
    );
    return !!(g.running && g.girl && g.whale);
  });
  if (!ok) throw new Error("Game failed smoke check — not playable");
  console.log("Smoke OK: game running with girl + whale");

  const outfits = [
    { id: "diver", label: "潛水衣", main: "#1aa7a0", accent: "#ffd166" },
    { id: "kimono", label: "海紋浴衣", main: "#ff6b6b", accent: "#fff0e6" },
    { id: "armor", label: "珊瑚甲", main: "#d4a373", accent: "#5ce1ff" },
    { id: "mage", label: "氣功袍", main: "#c9a7ff", accent: "#9dffb0" },
    { id: "shadow", label: "深淵披風", main: "#1b2433", accent: "#5ce1ff" },
  ];
  const hairs = [
    { id: "twin", label: "雙馬尾", color: "#5a2a1a" },
    { id: "glow", label: "螢光藍", color: "#5ce1ff" },
    { id: "coral", label: "珊瑚粉", color: "#ff8fab" },
    { id: "abyss", label: "深淵紫", color: "#8b6cff" },
    { id: "short", label: "短俏髮", color: "#1c2430" },
  ];
  const weapons = [
    { id: "finblade", label: "鰭刃", color: "#5ce1ff", reach: 54, dmg: 14 },
    { id: "coralstaff", label: "珊瑚杖", color: "#ff8fab", reach: 62, dmg: 12 },
    { id: "abyssspear", label: "深淵矛", color: "#9dffb0", reach: 70, dmg: 18 },
    { id: "auraring", label: "氣功環", color: "#ffd166", reach: 80, dmg: 16 },
  ];
  const prompts = ["proactive", "careful", "treasure", "explore"];

  const steps = [
    async () => page.evaluate(() => { window.__deepSeaFall.setPrompt("proactive"); window.__deepSeaFall._toast("手動示範：主動前進"); }),
    async () => page.evaluate(() => window.__deepSeaFall.summonWhale()),
    async () => page.evaluate(() => window.__deepSeaFall.triggerBoost()),
    async () => page.evaluate(() => window.__deepSeaFall.placeMagic()),
    async () => page.evaluate(() => window.__deepSeaFall.attack()),
    async () => page.evaluate(() => { window.__deepSeaFall.setPrompt("treasure"); window.__deepSeaFall._toast("尋寶模式"); }),
    async () => page.evaluate(({ o, w }) => {
      const g = window.__deepSeaFall;
      g.girl.outfit = o; g.girl.weapon = w; g.ui.setEquip(g.girl);
      g.audio.sfxEquip(); g._toast(`換裝：${o.label} / ${w.label}`);
      g.lootCount += 2;
    }, { o: outfits[0], w: weapons[0] }),
    async () => page.evaluate(() => { window.__deepSeaFall.audio.sfxTreasure(); window.__deepSeaFall._toast("取得海中寶物"); }),
    async () => page.evaluate(() => window.__deepSeaFall.setPrompt("careful")),
    async () => page.evaluate(() => { if (!window.__deepSeaFall.sleeping) window.__deepSeaFall.toggleSleep(); }),
    async () => page.evaluate(() => window.__deepSeaFall.summonWhale()),
    async () => page.evaluate((h) => {
      const g = window.__deepSeaFall;
      g.girl.hair = h; g.ui.setEquip(g.girl);
      g.audio.sfxEquip(); g._toast(`新髮型：${h.label}`);
    }, hairs[1]),
    async () => page.evaluate(() => { if (window.__deepSeaFall.sleeping) window.__deepSeaFall.toggleSleep(); }),
    async () => page.evaluate(() => { window.__deepSeaFall.setPrompt("explore"); window.__deepSeaFall.triggerBoost(); }),
    async () => page.evaluate(() => { window.__deepSeaFall.audio.sfxRock(); window.__deepSeaFall._toast("石頭撞擊！"); window.__deepSeaFall._hurt(8, "rock"); }),
    async () => page.evaluate(() => { window.__deepSeaFall.seaweed += 1; window.__deepSeaFall.audio.sfxSeaweed(); window.__deepSeaFall._toast("海草！可復活"); }),
    async () => page.evaluate(({ o, w }) => {
      const g = window.__deepSeaFall;
      g.girl.outfit = o; g.girl.weapon = w; g.ui.setEquip(g.girl);
      g.audio.sfxEquip(); g.attack();
    }, { o: outfits[2], w: weapons[2] }),
    async () => page.evaluate(() => window.__deepSeaFall.placeMagic()),
    async () => page.evaluate((h) => {
      const g = window.__deepSeaFall;
      g.girl.hair = h; g.ui.setEquip(g.girl); g.audio.sfxMagic();
    }, hairs[2]),
    async () => page.evaluate(() => window.__deepSeaFall.setPrompt("proactive")),
    async () => page.evaluate(({ o, w }) => {
      const g = window.__deepSeaFall;
      g.girl.outfit = o; g.girl.weapon = w; g.ui.setEquip(g.girl);
      g.audio.sfxEquip(); g.summonWhale(); g.attack();
    }, { o: outfits[3], w: weapons[3] }),
    async () => page.evaluate(() => window.__deepSeaFall.triggerBoost()),
    async () => page.evaluate(() => { window.__deepSeaFall.audio.sfxWhalePass(); window.__deepSeaFall._whaleSay("跟著我，再深一點。"); }),
    async () => page.evaluate(({ h, o }) => {
      const g = window.__deepSeaFall;
      g.girl.hair = h; g.girl.outfit = o; g.ui.setEquip(g.girl);
      g.audio.sfxTreasure(); g._toast("深淵裝備齊全");
    }, { h: hairs[3], o: outfits[4] }),
    async () => page.evaluate(() => { if (!window.__deepSeaFall.sleeping) window.__deepSeaFall.toggleSleep(); }),
    async () => page.evaluate(() => window.__deepSeaFall.setPrompt("careful")),
    async () => page.evaluate(() => { if (window.__deepSeaFall.sleeping) window.__deepSeaFall.toggleSleep(); }),
    async () => page.evaluate(() => { window.__deepSeaFall.placeMagic(); window.__deepSeaFall.attack(); }),
    async () => page.evaluate(() => window.__deepSeaFall.summonWhale()),
    async () => page.evaluate(() => {
      const g = window.__deepSeaFall;
      g._toast(`深度 ${Math.floor(g.depth)}m · 寶物 ${g.lootCount}`);
      g.audio.sfxTreasure();
    }),
  ];

  // Also cycle prompts / cosmetics periodically for remaining time
  const started = Date.now();
  let i = 0;
  while (Date.now() - started < RECORD_MS) {
    const step = steps[i % steps.length];
    try { await step(); } catch (e) { console.warn("step warn", e.message); }
    // Extra ambient actions every few cycles
    if (i % 4 === 0) {
      await page.evaluate(({ prompt, outfit, hair, weapon }) => {
        const g = window.__deepSeaFall;
        if (!g?.running) return;
        g.setPrompt(prompt);
        g.girl.outfit = outfit;
        g.girl.hair = hair;
        g.girl.weapon = weapon;
        g.ui.setEquip(g.girl);
        g.entities.push({
          tag: "loot", type: "treasure",
          x: 80 + Math.random() * 220, y: g.h * 0.7,
          phase: Math.random() * 6, vy: -10,
        });
        g.entities.push({
          tag: "loot", type: "seaweed",
          x: 60 + Math.random() * 260, y: g.h * 0.75,
          phase: Math.random() * 6, vy: -8,
        });
      }, {
        prompt: prompts[i % prompts.length],
        outfit: outfits[i % outfits.length],
        hair: hairs[i % hairs.length],
        weapon: weapons[i % weapons.length],
      });
    }
    if (i % 7 === 0) {
      // drag a bit to show manual swim
      await page.touchscreen.tap(120 + (i % 5) * 40, 380 + (i % 3) * 30);
    }
    i += 1;
    const elapsed = Date.now() - started;
    if (i % 5 === 0) console.log(`... ${Math.floor(elapsed / 1000)}s / ${RECORD_MS / 1000}s`);
    await page.waitForTimeout(4500);
  }

  // Final stats toast
  await page.evaluate(() => {
    const g = window.__deepSeaFall;
    g._toast(`示範結束 · 最深 ${Math.floor(g.maxDepth)}m`);
    g.audio.sfxWhale();
  });
  await page.waitForTimeout(2000);

  const video = page.video();
  await page.close();
  const rawPath = await video.path();
  await context.close();
  await browser.close();
  server.close();

  const outWebm = join(demoDir, "deep_sea_fall_playthrough.webm");
  copyFileSync(rawPath, outWebm);
  try { unlinkSync(rawPath); } catch {}
  console.log("Saved", outWebm);

  // Generate long soundtrack matching duration
  await new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [join(__dirname, "gen-long-audio.mjs")], {
      stdio: "inherit",
      env: { ...process.env, AUDIO_SECS: String(Math.ceil(RECORD_MS / 1000) + 2) },
    });
    p.on("exit", (code) => (code === 0 ? resolve() : reject(new Error("audio gen failed"))));
  });

  const wav = join(demoDir, "deep_sea_fall_playthrough_audio.wav");
  const outMp4 = join(demoDir, "deep_sea_fall_playthrough.mp4");
  const ffmpeg = process.env.FFMPEG || "ffmpeg";
  const muxed = await new Promise((resolve) => {
    const p = spawn(ffmpeg, [
      "-y",
      "-i", outWebm,
      "-i", wav,
      "-c:v", "libx264", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "160k",
      "-shortest",
      "-movflags", "+faststart",
      outMp4,
    ], { stdio: "inherit" });
    p.on("exit", (code) => resolve(code === 0));
    p.on("error", () => resolve(false));
  });
  if (!muxed) throw new Error("ffmpeg mux failed");
  console.log("Saved", outMp4, "(with music + SFX)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
