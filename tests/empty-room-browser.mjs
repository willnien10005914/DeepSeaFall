import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";

const base = process.env.TEST_URL || "http://127.0.0.1:8897";
const out = process.env.TEST_OUT || ".runtime/empty-room";
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, args: [
  "--no-sandbox", "--use-gl=angle", "--use-angle=gl-egl", "--enable-gpu", "--ignore-gpu-blocklist",
] });
const contexts = [], errors = [], report = {};
const health = async () => (await fetch(base + "/api/health")).json();
async function empty() {
  for (let i = 0; i < 100; i++) {
    const h = await health();
    if (!h.players) { assert.equal(h.depth, 0); return; }
    await new Promise(r => setTimeout(r, 100));
  }
  throw Error("Room did not empty");
}
async function join(page, name) {
  await page.locator("#playerName").waitFor();
  await page.fill("#playerName", name);
  await page.click("#btnStartManual");
  await page.waitForFunction(() => __multiplayer.lastState?.players.some(p => p.id === __multiplayer.id), null, { timeout: 120000 });
  return page.evaluate(() => ({ id: __multiplayer.id, state: __multiplayer.lastState }));
}
async function client() {
  const c = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  contexts.push(c);
  const p = await c.newPage();
  p.on("pageerror", e => errors.push(e.message));
  return p;
}
try {
  assert.equal((await health()).players, 0, "Use an isolated, idle server");
  const a = await client();
  let failJoin = true;
  await a.routeWebSocket(/\/ws$/, route => {
    if (failJoin) route.close({ code: 1013, reason: "QA connection interrupted before welcome" });
    else route.connectToServer();
  });
  await a.goto(base);
  await a.locator("#playerName").waitFor();
  // Reproduce a browser that never resolves its music permission/play promise.
  await a.evaluate(() => { __deepSeaFall.audio.unlock = () => new Promise(() => {}); });
  await a.click("#btnStartManual");
  await a.waitForFunction(() => !__multiplayer.joining && document.querySelector("#mpStatus").textContent.includes("再試一次"), null, { timeout: 120000 });
  assert(await a.locator("#titleScreen").isVisible());
  failJoin = false;
  const first = await join(a, "Athena 重進測試");
  report.initialConnectionFailureIsRetryable = true;
  report.unresolvedAudioDoesNotBlockJoin = true;
  await a.waitForFunction(() => __multiplayer.lastState.depth > 1);

  // Same tab reload retains its resume token. With nobody else left, it must
  // receive a fresh identity and run rather than resume the abandoned dive.
  await a.reload();
  await empty();
  const second = await join(a, "Athena 重進測試");
  assert.notEqual(second.id, first.id);
  assert.notEqual(second.state.generation, first.state.generation);
  assert.equal(second.state.runId, first.state.runId + 1);
  assert(second.state.depth < 1 && second.state.running);
  assert.equal(second.state.scoreboard.length, 1);
  assert.equal(second.state.scoreboard[0].id, second.id);
  // A fresh run may immediately collect its intentionally nearby welcome gem.
  assert(second.state.players[0].treasures <= 1);
  assert(second.state.players[0].points <= 60);
  assert.equal(second.state.whaleCd, 0);
  assert.equal(second.state.combat.stage, "ready");
  assert(second.state.stamina > 99);
  report.emptyRoomRejoin = { depth: second.state.depth, runId: second.state.runId, running: second.state.running, points: second.state.players[0].points };

  await a.waitForFunction(() => __multiplayer.replica.avatars.size === 1);
  assert.equal(await a.locator(".mp-chat-toggle").getAttribute("aria-expanded"), "false");
  const fullHeight = await a.locator("#bottomDock").evaluate(e => e.getBoundingClientRect().height);
  await a.locator("#btnToggleControls").click();
  assert.equal(await a.locator("#btnToggleControls").getAttribute("aria-expanded"), "false");
  assert(!(await a.locator("#controls").isVisible()));
  const foldedHeight = await a.locator("#bottomDock").evaluate(e => e.getBoundingClientRect().height);
  assert(fullHeight - foldedHeight > 100);
  await a.locator(".mp-chat-toggle").click();
  await a.fill(".mp-chat-form input", "底部聊天仍可送出");
  await a.locator(".mp-chat-form button[type=submit]").click();
  await a.waitForFunction(() => document.querySelector(".mp-messages").textContent.includes("底部聊天仍可送出"));
  const layouts = [];
  for (const [width, height] of [[390,844], [360,640], [320,568], [844,390]]) {
    await a.setViewportSize({ width, height });
    const box = await a.evaluate(() => {
      const rect = e => { const b = document.querySelector(e).getBoundingClientRect(); return { x: b.x, y: b.y, right: b.right, bottom: b.bottom, height: b.height }; };
      return { panel: rect(".mp-chat-contents"), toolbar: rect("#dockToolbar"), app: rect("#app") };
    });
    assert(box.panel.x >= box.app.x && box.panel.right <= box.app.right);
    assert(box.panel.y >= 0 && box.toolbar.bottom <= height);
    if (height > width) assert(box.panel.y > height * 0.5);
    layouts.push({ width, height, ...box });
  }
  await a.setViewportSize({ width: 390, height: 844 });
  await a.screenshot({ path: out + "/mobile-chat-folded.png" });
  await a.locator(".mp-chat-toggle").click();
  await a.screenshot({ path: out + "/mobile-clear-view.png" });
  await a.locator("#btnToggleControls").click();
  assert(await a.locator("#btnAttack").isVisible());
  await a.screenshot({ path: out + "/mobile-actions-expanded.png" });
  await a.locator("#btnToggleControls").click();
  report.mobileDock = { fullHeight, foldedHeight, chatWorksWhenControlsFolded: true, layouts };

  // Partial disconnect must retain the shared run and the returning identity.
  const b = await client();
  await b.goto(base);
  const peer = await join(b, "Mazu 同游測試");
  await a.waitForFunction(() => __multiplayer.lastState.players.length === 2);
  const before = await a.evaluate(() => __multiplayer.lastState);
  await a.reload();
  const back = await join(a, "Athena 重進測試");
  assert.equal(back.id, second.id);
  assert.equal(back.state.generation, before.generation);
  assert.equal(back.state.runId, before.runId);
  assert(back.state.depth >= before.depth);
  assert.equal(await a.locator("#btnToggleControls").getAttribute("aria-expanded"), "false");
  report.partialDisconnectResumesRun = true;
  report.controlsPreferencePersists = true;
  await contexts[0].close();
  await contexts[1].close();
  await empty();

  const c = await client();
  await c.goto(base);
  const third = await join(c, "Athena 重進測試");
  assert(third.state.depth < 1 && third.state.running);
  assert.notEqual(third.state.generation, back.state.generation);
  assert.equal(third.state.scoreboard.length, 1);
  assert.equal(third.state.players.length, 1);
  report.newVisitorAfterAllQuit = true;
  report.health = await health();
  assert.equal(report.health.error, null);
  assert.deepEqual(errors, []);
  report.errors = errors;
  await writeFile(out + "/verification.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally {
  for (const c of contexts) await c.close().catch(() => {});
  await browser.close();
}
