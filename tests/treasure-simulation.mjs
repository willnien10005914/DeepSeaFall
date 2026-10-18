import { Simulation } from "../server/simulation.mjs";
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
const out = process.env.TEST_OUT || ".runtime/relics";
await mkdir(out, { recursive: true });
const sim = new Simulation({
  url: process.env.TEST_URL || "http://127.0.0.1:8897/",
  seed: 518,
  gpuUrl: "http://127.0.0.1:8877",
});
try {
  await sim.start();
  const roster = [
    { id: "qa-a", name: "Athena", color: "#b4d88e" },
    { id: "qa-b", name: "Selene", color: "#c591ff" },
  ];
  await sim.step(roster, [], 0.05);
  const result = await sim.page.evaluate(async (roster) => {
    const s = diveSimulation,
      g = s.g;
    for (const e of g.entities) g.world.remove(e.mesh);
    g.entities = [];
    g.stamina = 25;
    const [a, b] = [...s.players.values()];
    const award = async (p, type) => {
      const e = g._spawnGem(type);
      e.mesh.position.copy(g.rockContacts.body(p.girl)[2].center);
      return s.step({ roster }, 0.05);
    };
    const first = await award(a, "gold"),
      second = await award(b, "purple");
    const again = await s.step({ roster }, 0.05);
    const away = await s.step({ roster: [roster[1]] }, 0.05);
    const back = await s.step({ roster }, 0.05);
    g.running = false;
    const restart = await s.step(
      { roster, commands: [{ id: "qa-a", type: "action", action: "restart" }] },
      0.05,
    );
    // The room changes generation only when everybody leaves. Start from an
    // abandoned dead dive to verify its depth, scores and cooldowns cannot leak.
    await s.step({ roster, generation: "old-room" }, 0.05);
    g.depth = 180;
    g.running = false;
    g.stamina = 0;
    g.whaleCd = 10;
    a.score.points = 500;
    const freshRoster = [{ id: "qa-new", name: "Athena", color: "#b4d88e" }];
    const fresh = await s.step({ roster: freshRoster, generation: "new-room" }, 0.05);
    return { first, second, again, away, back, restart, fresh };
  }, roster);
  const score = (s, id) => s.players.find((p) => p.id === id);
  assert.equal(score(result.first, "qa-a").points, 10);
  assert.equal(score(result.first, "qa-b").points, 0);
  assert.equal(score(result.second, "qa-b").points, 60);
  assert.equal(score(result.second, "qa-a").points, 10);
  assert.equal(score(result.again, "qa-b").points, 60);
  assert(result.second.stamina > 60);
  assert.equal(result.away.scoreboard.find((p) => p.id === "qa-a").points, 10);
  assert.equal(score(result.back, "qa-a").points, 10);
  assert(
    result.restart.players.every((p) => p.points === 0 && p.treasures === 0),
  );
  assert.equal(result.restart.runId, 2);
  assert(result.fresh.running && result.fresh.depth < 1);
  assert(result.fresh.stamina > 99);
  assert.equal(result.fresh.whaleCd, 0);
  assert.equal(result.fresh.combat.stage, "ready");
  assert.equal(result.fresh.scoreboard.length, 1);
  assert.equal(result.fresh.scoreboard[0].id, "qa-new");
  assert(result.fresh.players[0].points <= 60);
  assert(result.fresh.players[0].treasures <= 1);
  assert.equal(result.fresh.runId, 3);
  const report = {
    personalScores: [
      { name: "Athena", points: 10, treasures: 1 },
      { name: "Selene", points: 60, treasures: 1 },
    ],
    sharedStaminaAfter: result.second.stamina,
    duplicateAwardPrevented: true,
    reconnectPreservesScore: true,
    restartClearsRun: true,
    emptyRoomReplacesDeadRunAndClearsCooldowns: true,
    authority: "actual server-owned game, with test-positioned jewels",
  };
  await writeFile(
    out + "/treasure-simulation.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report));
} finally {
  await sim.close();
}
