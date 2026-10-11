/**
 * Headless demo capture with Playwright video + WebAudio unlocked.
 * Produces demo/deep_sea_fall_demo.webm and (if ffmpeg available) .mp4
 */
import { createServer } from "http";
import { readFile } from "fs/promises";
import { createWriteStream, existsSync, mkdirSync, copyFileSync } from "fs";
import { extname, join, dirname } from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import { chromium } from "playwright";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const demoDir = join(root, "demo");
const PORT = 8765;
const RECORD_MS = 20000;

const mime = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

function startStaticServer() {
  return new Promise((resolve) => {
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
    server.listen(PORT, "127.0.0.1", () => resolve(server));
  });
}

async function convertToMp4(webmPath, mp4Path) {
  const ffmpeg = process.env.FFMPEG || "ffmpeg";
  return new Promise((resolve) => {
    const p = spawn(ffmpeg, [
      "-y", "-i", webmPath,
      "-c:v", "libx264", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "128k",
      "-movflags", "+faststart",
      mp4Path,
    ], { stdio: "inherit" });
    p.on("exit", (code) => resolve(code === 0));
    p.on("error", () => resolve(false));
  });
}

async function main() {
  if (!existsSync(demoDir)) mkdirSync(demoDir, { recursive: true });
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
    // Force audio context not to be blocked
    hasTouch: true,
    isMobile: true,
  });

  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${PORT}/?demo=1&t=18`, { waitUntil: "networkidle" });

  // Unlock audio + ensure demo started
  await page.evaluate(async () => {
    const g = window.__deepSeaFall;
    if (g) {
      await g.audio.unlock();
      if (!g.running) await g.start("demo");
      // poke a few SFX so waveform is audible in capture environments that mix tab audio
      g.audio.sfxWhale();
      g.audio.sfxTreasure();
      g.audio.sfxMagic();
    }
    // Also click canvas to satisfy autoplay policies
    document.getElementById("game")?.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: 200, clientY: 400 }));
  });

  // Periodically trigger expressive actions while recording
  const actions = [
    () => page.evaluate(() => window.__deepSeaFall?.summonWhale()),
    () => page.evaluate(() => window.__deepSeaFall?.triggerBoost()),
    () => page.evaluate(() => window.__deepSeaFall?.placeMagic()),
    () => page.evaluate(() => window.__deepSeaFall?.attack()),
    () => page.evaluate(() => window.__deepSeaFall?.setPrompt("treasure")),
    () => page.evaluate(() => window.__deepSeaFall?.audio.sfxRock()),
    () => page.evaluate(() => window.__deepSeaFall?.setPrompt("careful")),
    () => page.evaluate(() => window.__deepSeaFall?.toggleSleep()),
  ];

  const started = Date.now();
  let i = 0;
  while (Date.now() - started < RECORD_MS) {
    await actions[i % actions.length]();
    i += 1;
    await page.waitForTimeout(2200);
  }

  const video = page.video();
  await page.close();
  const rawPath = await video.path();
  await context.close();
  await browser.close();
  server.close();

  const outWebm = join(demoDir, "deep_sea_fall_demo.webm");
  copyFileSync(rawPath, outWebm);
  console.log("Saved", outWebm);

  // Generate matching soundtrack and mux (Playwright video has no audio track)
  await new Promise((resolve, reject) => {
    const p = spawn(process.execPath, [join(__dirname, "gen-demo-audio.mjs")], { stdio: "inherit" });
    p.on("exit", (code) => (code === 0 ? resolve() : reject(new Error("audio gen failed"))));
  });

  const wav = join(demoDir, "deep_sea_fall_demo_audio.wav");
  const outMp4 = join(demoDir, "deep_sea_fall_demo.mp4");
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
  if (muxed) console.log("Saved", outMp4, "(with music + SFX)");
  else {
    const ok = await convertToMp4(outWebm, outMp4);
    console.log(ok ? `Saved ${outMp4} (silent video)` : "ffmpeg convert skipped/failed — webm is available");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
