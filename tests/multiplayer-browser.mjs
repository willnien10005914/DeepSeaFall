import { chromium } from "playwright";
import assert from "node:assert/strict";
import { writeFile, mkdir } from "node:fs/promises";
const base = process.env.TEST_URL || "http://127.0.0.1:8897",
  out = process.env.TEST_OUT || ".runtime/test";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: [
    "--no-sandbox",
    "--use-gl=angle",
    "--use-angle=gl-egl",
    "--enable-gpu",
    "--ignore-gpu-blocklist",
  ],
});
const contexts = [],
  errors = [];
try {
  async function player(name) {
    const c = await browser.newContext({
      viewport: { width: 480, height: 960 },
      hasTouch: true,
    });
    contexts.push(c);
    const p = await c.newPage();
    p.on("pageerror", (e) => errors.push(e.message));
    await p.goto(base);
    await p.locator("#playerName").waitFor();
    await p.fill("#playerName", name);
    await p.click("#btnStartManual");
    await p.waitForFunction(
      () =>
        window.__multiplayer?.lastState?.players.some(
          (p) => p.id === window.__multiplayer.id,
        ),
      null,
      { timeout: 120000 },
    );
    if (!(await p.evaluate(() => __multiplayer.lastState.running))) {
      await p.evaluate(() =>
        __multiplayer.send({ type: "action", action: "restart" }),
      );
      await p.waitForFunction(() => __multiplayer.lastState.running);
    }
    return p;
  }
  const a = await player("Athena 測試"),
    before = await a.evaluate(() => __multiplayer.lastState.depth);
  await a.waitForTimeout(1500);
  const b = await player("Mazu 測試");
  await a.waitForFunction(
    () => __multiplayer.lastState.players.length === 2,
    null,
    { timeout: 120000 },
  );
  await b.waitForFunction(
    () => __multiplayer.replica.avatars.size === 2,
    null,
    { timeout: 120000 },
  );
  await a.waitForFunction(
    () => __multiplayer.replica.avatars.size === 2,
    null,
    { timeout: 120000 },
  );
  const late = await b.evaluate(() => ({
    depth: __multiplayer.lastState.depth,
    stamina: __multiplayer.lastState.stamina,
    players: __multiplayer.lastState.players.map((p) => ({
      name: p.name,
      color: p.color,
      id: p.id,
    })),
  }));
  assert(late.depth > before);
  assert.equal(new Set(late.players.map((p) => p.name)).size, 2);
  assert.equal(new Set(late.players.map((p) => p.color)).size, 2);
  await a.locator(".mp-chat-toggle").click();
  await b.locator(".mp-chat-toggle").click();
  await a.fill(".mp-chat-form input", "一起下潛！<img src=x onerror=alert(1)>");
  await a.locator(".mp-chat-form button[type=submit]").click();
  await b.waitForFunction(() =>
    document.querySelector(".mp-messages").textContent.includes("一起下潛！"),
  );
  assert.equal(await b.locator(".mp-messages img").count(), 0);
  await a.touchscreen.tap(240, 480);
  await b.touchscreen.tap(240, 480);
  await a.waitForTimeout(3000);
  const collisions = await a.evaluate(() => __multiplayer.lastState.collisions);
  const clearance = await a.evaluate(
    () => __multiplayer.lastState.minimumClearance,
  );
  assert(clearance >= 0.035);
  await a.locator("#btnWhale").click();
  await b.waitForFunction(
    () => __multiplayer.lastState.whale.state !== "hidden",
    null,
    { timeout: 30000 },
  );
  await a.locator("#attackStyle").selectOption("spiral-kick");
  await a.locator("#btnAttack").click();
  await b.waitForFunction(
    () => __multiplayer.lastState.combat.stage !== "ready",
    null,
    { timeout: 30000 },
  );
  const attack = await b.evaluate(() => ({
    state: __multiplayer.lastState.combat.stage,
    disabled: document.querySelector("#btnAttack").disabled,
  }));
  assert(attack.disabled);
  await a.screenshot({ path: out + "/two-players.png" });
  const personalUI = [];
  for (const page of [a, b]) {
    const row = await page.evaluate(() => {
      const m = __multiplayer,
        p = m.lastState.players.find((p) => p.id === m.id);
      return {
        points: p.points,
        count: p.treasures,
        hudPoints: Number(document.querySelector("#scoreCount").textContent),
        hudCount: Number(document.querySelector("#treasureCount").textContent),
        labels: [
          ...document.querySelectorAll(".mp-avatar-label>span:first-child"),
        ].map((e) => e.textContent),
        roster: m.lastState.players,
      };
    });
    assert.equal(row.hudPoints, row.points);
    assert.equal(row.hudCount, row.count);
    for (const peer of row.roster)
      assert(
        row.labels.some(
          (text) =>
            text.includes(peer.name) && text.includes(`${peer.points} 分`),
        ),
      );
    personalUI.push(row);
  }
  const health = await (await fetch(base + "/api/health")).json();
  assert(health.ready && health.gpu.cuda && health.gpuBatches > 0);
  assert.equal(health.players, 2);
  assert.equal(health.error, null);
  await contexts[0].close();
  await b.waitForFunction(
    () => __multiplayer.lastState.players.length === 1,
    null,
    { timeout: 30000 },
  );
  await b.waitForFunction(
    () => document.querySelector(".mp-notice").textContent.includes("Athena"),
    null,
    { timeout: 10000 },
  );
  const leave = await b.locator(".mp-notice").textContent();
  assert.match(leave, /Athena/);
  assert.deepEqual(errors, []);
  const report = {
    lateJoin: late,
    personalUI,
    beforeDepth: before,
    collisions,
    clearance,
    attack,
    health,
    leave,
    errors,
  };
  await writeFile(out + "/browser.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally {
  for (const c of contexts) await c.close().catch(() => {});
  await browser.close();
}
