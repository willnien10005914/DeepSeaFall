import { chromium } from "playwright";
export class Simulation {
  constructor({ url, seed, gpuUrl }) {
    Object.assign(this, {
      url,
      seed,
      gpuUrl,
      actions: {},
      gpuBusy: false,
      gpuBatches: 0,
    });
  }
  async start() {
    this.browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--use-gl=angle",
        "--use-angle=gl-egl",
        "--enable-gpu",
        "--ignore-gpu-blocklist",
      ],
    });
    this.page = await this.browser.newPage({
      viewport: { width: 480, height: 960 },
    });
    this.page.on("pageerror", (e) => console.error("Simulation:", e.message));
    await this.page.addInitScript((seed) => {
      window.__MP_SIMULATION = true;
      window.__MP_SEED = seed;
      window.requestAnimationFrame = () => 0;
      let s = seed;
      Math.random = () =>
        (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
    }, this.seed);
    await this.page.goto(this.url);
    await this.page.waitForFunction(() => !!window.__deepSeaFall, null, {
      timeout: 90000,
      polling: 100,
    });
    await this.page.evaluate(async () => {
      const { AuthoritativeDive } =
        await import("/js/multiplayer/authoritative.js?v=48");
      window.diveSimulation = new AuthoritativeDive(window.__deepSeaFall);
      await diveSimulation.start();
    });
  }
  async step(roster, commands, dt) {
    const data = await this.page.evaluate(
      async (a) => diveSimulation.step(a, a.dt),
      { roster, commands, actions: this.actions, dt },
    );
    if (data && !this.gpuBusy) {
      const active = data.players.filter((p) => p.observation);
      if (active.length) {
        this.gpuBusy = true;
        fetch(this.gpuUrl + "/policy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            observations: active.map((p) => p.observation),
          }),
          signal: AbortSignal.timeout(2000),
        })
          .then((r) => {
            if (!r.ok) throw Error("GPU inference " + r.status);
            return r.json();
          })
          .then((r) => {
            this.actions = Object.fromEntries(
              active.map((p, i) => [p.id, r.actions[i]]),
            );
            this.gpuBatches++;
          })
          .catch((e) => {
            this.actions = {};
            console.warn("GPU policy fallback:", e.message);
          })
          .finally(() => (this.gpuBusy = false));
      }
    }
    if (data) for (const p of data.players) delete p.observation;
    return data;
  }
  async close() {
    await this.browser?.close();
  }
}
