import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const out = process.env.TEST_OUT || ".runtime/relics",
  url = process.env.TEST_URL || "http://127.0.0.1:8897/";
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
  }),
  errors = [];
try {
  const p = await browser.newPage({
    viewport: { width: 480, height: 960 },
    deviceScaleFactor: 1,
  });
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text().slice(0, 600));
  });
  await p.addInitScript(() => {
    window.__MP_SIMULATION = true;
    window.__MP_SEED = 518;
    requestAnimationFrame = () => 0;
    window.qaTime = 0;
    performance.now = () => qaTime * 1000;
  });
  await p.goto(url);
  await p.waitForFunction(() => !!window.__deepSeaFall, null, {
    polling: 100,
    timeout: 90000,
  });
  await p.evaluate(async () => {
    await __deepSeaFall.start("manual");
    __deepSeaFall.audio.track.pause();
    __deepSeaFall.audio.ctx?.suspend();
  });
  const scenes = [];
  const quick = process.env.VISUAL_QUICK === "1";
  for (const depth of quick
    ? [55, 110]
    : [55, 75, 110, 140, 175, 205, 235, 265, 295]) {
    const state = await p.evaluate(async (depth) => {
      const g = __deepSeaFall,
        { animateCharacter } = await import("/js/three/authored.js?v=48");
      g.depth = depth;
      g.girl.position.set(0, -0.4, 0);
      for (let i = 0; i < 65; i++) {
        qaTime += 1 / 30;
        g.t += 1 / 30;
        g.depthBiomes.update(1 / 30, g.t, depth, g);
        g.ocean.update(g.t, { depth });
        g.oceanDetails.update(g.t, depth, g);
        animateCharacter(g.girl, g.t);
        g._updateCamera(1 / 30);
      }
      g.ui.setDepth(depth, g.best);
      g.water.render(g.t, {
        depth,
        light: g.depthBiomes.current.light,
        biome: g.depthBiomes.current,
      });
      return { depth, ...g.depthBiomes.status };
    }, depth);
    scenes.push(state);
    await p.screenshot({ path: `${out}/scene-${depth}m.png` });
  }
  if (quick) {
    assert.deepEqual(errors, []);
    await writeFile(
      out + "/landmarks-final.json",
      JSON.stringify({ scenes, errors }, null, 2),
    );
    console.log(JSON.stringify({ scenes, errors }));
    await browser.close();
    process.exit(0);
  }
  const gems = await p.evaluate(async () => {
    const { makeTreasure } = await import("/js/three/meshes.js?v=48"),
      { animateGemstone } = await import("/js/three/gemstones.js?v=48"),
      g = __deepSeaFall;
    g.depth = 12;
    g.depthBiomes.reset(518);
    for (let i = 0; i < 90; i++) g.depthBiomes.update(1 / 30, g.t, 12, g);
    g.depthBiomes.landmarks.update(g.t, 12, g.depthBiomes.current, g);
    const rows = [];
    for (const [i, id] of ["gold", "green", "purple"].entries()) {
      const m = makeTreasure(id);
      m.position.set((i - 1) * 1.0, 0.6, 1.1);
      m.scale.multiplyScalar(1.6);
      g.scene.add(m);
      animateGemstone(m, g.t);
      rows.push({
        id: m.userData.gemId,
        value: m.userData.value,
        hex: m.material.color.getHexString(),
      });
    }
    g.water.render(g.t, {
      depth: 12,
      light: g.depthBiomes.current.light,
      biome: g.depthBiomes.current,
    });
    return rows;
  });
  await p.screenshot({ path: out + "/gems.png" });
  assert.deepEqual(
    gems.map((g) => g.value),
    [10, 25, 60],
  );
  const attacks = [];
  for (const id of ["spiral-kick", "cross-blades", "lotus-burst"]) {
    await p.evaluate((id) => {
      const g = __deepSeaFall;
      g.combat.reset(g);
      document.querySelector("#attackStyle").value = id;
      g.attack();
    }, id);
    let row;
    for (let phase = 0; phase < 4; phase++) {
      row = await p.evaluate((phase) => {
        const g = __deepSeaFall,
          frames = [26, 30, 48, 24][phase];
        for (let i = 0; i < frames; i++) {
          qaTime += 1 / 30;
          g._update(1 / 30);
          g.ocean.update(g.t, { depth: g.depth });
          g.oceanDetails.update(g.t, g.depth, g);
        }
        g.water.render(g.t, {
          depth: g.depth,
          light: g.depthBiomes.current.light,
          biome: g.depthBiomes.current,
        });
        g.combat.elemental.renderOverlay(g.renderer, g.camera);
        return {
          stage: g.combat.stage,
          baseGrains: g.combat.elemental.grains.cursor,
          ...g.combat.elemental.flow.stats,
        };
      }, phase);
      attacks.push({ id, phase, ...row });
      if (phase === 1 || phase === 3)
        await p.screenshot({ path: `${out}/attack-${id}-${phase}.png` });
      assert(Number.isFinite(row.maxSpeed) && row.maxSpeed < 10.5);
    }
  }
  assert(
    scenes[0].landmarks.ruins > 0.9 &&
      scenes[1].landmarks.ruins === 0 &&
      scenes[2].landmarks.volcano > 0.9,
  );
  assert(scenes.slice(3).every((s) => s.landmarks.alienCreatures === 6));
  assert(attacks.some((a) => a.detached && a.alive > 0));
  assert(attacks.some((a) => a.baseGrains > 1000));
  assert.deepEqual(errors, []);
  const report = {
    preview:
      "Test-positioned depth previews using actual game renderer; not a recorded playthrough",
    scenes,
    gems,
    attacks,
    errors,
  };
  await writeFile(out + "/visual.json", JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify({
      scenes: scenes.map((s) => ({
        depth: s.depth,
        id: s.id,
        landmarks: s.landmarks,
      })),
      gems,
      attackSamples: attacks,
      errors,
    }),
  );
} finally {
  await browser.close();
}
