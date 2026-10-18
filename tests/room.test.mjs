import test from "node:test";
import assert from "node:assert/strict";
import { DiveRoom } from "../server/room.mjs";

test("unique international goddess names, colours, capacity and duplicate validation", () => {
  const r = new DiveRoom({ maxPlayers: 8 });
  const a = r.join({}),
    b = r.join({});
  assert.notEqual(a.name, b.name);
  assert.notEqual(a.color, b.color);
  assert.throws(() => r.join({}, { name: a.name.toUpperCase() }), /名字/);
  for (let n = 2; n < 8; n++) r.join({});
  assert.equal(new Set(r.roster().map((p) => p.color)).size, 8);
  assert.throws(() => r.join({}), /已滿/);
});
test("disconnect announcements vary; a token resumes only its own identity", () => {
  let t = 10000;
  const events = [],
    r = new DiveRoom({ now: () => t, broadcast: (e) => events.push(e) }),
    a = r.join({}, { name: "Selene" }),
    b = r.join({}, { name: "Mazu" });
  r.join({}, { name: "Artemis" });
  r.leave(a.id);
  r.leave(b.id);
  const notices = events.filter((e) => e.event === "leave");
  assert.notEqual(
    notices[0].text.replace("Selene", ""),
    notices[1].text.replace("Mazu", ""),
  );
  const resumed = r.join({}, { resumeToken: a.token });
  assert.equal(resumed.id, a.id);
  assert.equal(resumed.name, a.name);
  assert.throws(() => r.join({}, { name: "Selene" }));
  r.leave(resumed.id);
  t += 31000;
  r.prune();
  assert.equal(r.reservations.size, 0);
});
test("only bounded destinations and allowlisted actions enter simulation; stale or hostile state is ignored", () => {
  let t = 10000;
  const r = new DiveRoom({ now: () => t }),
    p = r.join({});
  r.receive(p, {
    type: "input",
    seq: 1,
    x: 999,
    y: -999,
    stamina: 99999,
    depth: 900,
  });
  const [c] = r.takeCommands();
  assert.deepEqual([c.x, c.y], [1, -1]);
  assert.equal(c.stamina, undefined);
  t += 100;
  r.receive(p, { type: "input", seq: 1, x: 0, y: 0 });
  r.receive(p, { type: "input", seq: 2, x: NaN, y: 0 });
  r.receive(p, { type: "state", stamina: 999 });
  r.receive(p, { type: "action", action: "resetCooldown" });
  assert.equal(r.takeCommands().length, 0);
  r.receive(p, { type: "action", action: "attack", move: "cross-blades" });
  assert.equal(r.takeCommands()[0].move, "cross-blades");
});
test("chat has bounded history, rate limit and safe text without HTML execution", () => {
  let t = 10000;
  const sent = [],
    r = new DiveRoom({ now: () => t, broadcast: (e) => sent.push(e) }),
    p = r.join({});
  r.receive(p, { type: "chat", text: "<img src=x onerror=alert(1)>" });
  r.receive(p, { type: "chat", text: "spam" });
  assert.equal(r.history.length, 1);
  assert.match(r.history[0].text, /<img/);
  for (let i = 0; i < 50; i++) {
    t += 1000;
    r.receive(p, { type: "chat", text: "a".repeat(500) });
  }
  assert.equal(r.history.length, 40);
  assert.equal(r.history.at(-1).text.length, 180);
});


test("last disconnect ends the run, clears stale commands/chat/reservations and releases names", () => {
  const room = new DiveRoom();
  const a = room.join({}, { name: "Athena" });
  const b = room.join({}, { name: "Mazu" });
  const generation = room.generation;
  room.snapshot = { depth: 120, running: false };
  room.receive(a, { type: "chat", text: "Previous dive" });
  room.receive(a, { type: "action", action: "attack" });
  room.leave(a.id);
  assert.equal(room.generation, generation, "a remaining swimmer keeps the same run");
  assert.equal(room.reservations.size, 1);
  room.leave(b.id);
  assert.notEqual(room.generation, generation);
  assert.equal(room.snapshot, null);
  assert.equal(room.reservations.size, 0);
  assert.deepEqual(room.takeCommands(), []);
  assert.deepEqual(room.history, []);
  assert.deepEqual(room.notices, []);
  assert(room.available().includes("Athena 雅典娜"));
  const fresh = room.join({}, { name: "Athena", resumeToken: a.token });
  assert.notEqual(fresh.id, a.id, "an empty sea does not resume the abandoned identity");
  assert.equal(fresh.name, "Athena");
});
