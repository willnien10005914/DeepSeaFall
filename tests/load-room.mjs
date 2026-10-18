import WebSocket from "ws";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const base = process.env.TEST_URL || "http://127.0.0.1:8897",
  out = process.env.TEST_OUT || ".runtime/test";
await mkdir(out, { recursive: true });
const clients = [],
  packets = [],
  wait = (ms) => new Promise((r) => setTimeout(r, ms));
let min = Infinity,
  seenEight = false;
try {
  for (let i = 0; i < 8; i++) {
    const ws = new WebSocket(base.replace(/^http/, "ws") + "/ws");
    clients.push(ws);
    await new Promise((resolve, reject) => {
      ws.on("error", reject);
      ws.on("open", () =>
        ws.send(JSON.stringify({ type: "join", name: `Load ${i + 1}` })),
      );
      ws.on("message", (raw) => {
        const m = JSON.parse(raw);
        if (m.type === "welcome") resolve();
        if (m.type === "error") reject(Error(m.message));
        if (m.type === "snapshot" && m.state.players.length === 8) {
          seenEight = true;
          packets.push(raw.length);
          if (m.state.minimumClearance !== null)
            min = Math.min(min, m.state.minimumClearance);
        }
      });
    });
  }
  for (let i = 0; i < 16; i++) {
    for (const ws of clients)
      ws.send(
        JSON.stringify({ type: "input", seq: i, x: 0, y: 0, aspect: 0.5 }),
      );
    await wait(500);
  }
  const health = await (await fetch(base + "/api/health")).json();
  assert(seenEight);
  assert.equal(health.players, 8);
  assert.equal(health.error, null);
  assert(min >= -0.005, `Peer penetration ${min}`);
  const report = {
    players: 8,
    snapshotSamples: packets.length,
    minimumBodyClearance: min,
    meanSnapshotBytes: Math.round(
      packets.reduce((a, b) => a + b, 0) / packets.length,
    ),
    health,
  };
  await writeFile(out + "/load.json", JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally {
  for (const ws of clients) ws.close();
}
