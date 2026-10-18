import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFile, mkdir } from "node:fs/promises";
const base = process.env.TEST_URL || "http://127.0.0.1:8897",
  out = process.env.TEST_OUT || ".runtime/test";
await mkdir(out, { recursive: true });
const audio = process.env.TEST_AUDIO || "/tmp/deepsea-asr-test.wav";
const b = await chromium.launch({
  headless: true,
  args: [
    "--no-sandbox",
    "--use-gl=angle",
    "--use-angle=gl-egl",
    "--enable-gpu",
    "--ignore-gpu-blocklist",
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
    `--use-file-for-fake-audio-capture=${audio}`,
  ],
});
try {
  const c = await b.newContext({
      viewport: { width: 480, height: 960 },
      permissions: ["microphone"],
    }),
    p = await c.newPage(),
    errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  await p.goto(base);
  await p.fill("#playerName", "Freyja 語音測試");
  await p.click("#btnStartManual");
  await p.waitForFunction(
    () =>
      __multiplayer?.lastState?.players.some((p) => p.id === __multiplayer.id),
    null,
    { timeout: 120000 },
  );
  await p.locator(".mp-chat-toggle").click();
  await p.locator(".mp-mic").click();
  await p.waitForTimeout(4500);
  await p.locator(".mp-mic").click();
  await p.waitForFunction(
    () => document.querySelector(".mp-chat-form input").value.length > 3,
    null,
    { timeout: 65000 },
  );
  const text = await p.locator(".mp-chat-form input").inputValue();
  assert.match(text.toLowerCase(), /fellow|american|country/);
  await p.locator(".mp-chat-form button[type=submit]").click();
  await p.waitForFunction(() =>
    document.querySelector(".mp-messages").textContent.includes("Freyja"),
  );
  await p.screenshot({ path: out + "/microphone.png" });
  assert.deepEqual(errors, []);
  const health = await (await fetch(base + "/api/health")).json();
  await writeFile(
    out + "/microphone.json",
    JSON.stringify(
      {
        microphone:
          "MediaRecorder → same-origin authenticated upload → Whisper CUDA → editable draft → shared chat",
        text,
        health,
        errors,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ text, cuda: health.gpu.cuda, errors }));
} finally {
  await b.close();
}
