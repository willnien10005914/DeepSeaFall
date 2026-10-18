import test from "node:test";
import assert from "node:assert/strict";
import { scheduleAt, DEEP_THEMES } from "../js/three/biome-schedule.js";
import {
  GEM_TYPES,
  gemType,
  chooseGem,
  freshScore,
  awardGem,
  nearestCollector,
} from "../js/three/treasure-rules.js";
test("ruins, return to rock, volcano and every subsequent 30m band meet boundaries", () => {
  for (const [d, key, range] of [
    [49.99, null, [40, 50]],
    [50, "mythic-ruins", [50, 70]],
    [69.99, "mythic-ruins", [50, 70]],
    [70, "stone-canyon", [70, 100]],
    [99.99, "stone-canyon", [70, 100]],
    [100, "volcanic-rift", [100, 130]],
    [129.99, "volcanic-rift", [100, 130]],
    [130, "star-drift", [130, 160]],
    [160, "jade-forest", [160, 190]],
    [190, "violet-bloom", [190, 220]],
    [220, "crimson-reef", [220, 250]],
    [250, "amber-grove", [250, 280]],
    [280, "black-trench", [280, 310]],
    [310, "star-drift", [310, 340]],
  ]) {
    const b = scheduleAt(d);
    assert.equal(b.key, key);
    assert.deepEqual([b.start, b.end], range);
  }
  assert.equal(new Set(DEEP_THEMES).size, 6);
  assert.equal(scheduleAt(NaN).start, 0);
});
test("different jewel values are awarded to one collector exactly once", () => {
  const a = { id: "a", score: freshScore() },
    b = { id: "b", score: freshScore() };
  for (const type of GEM_TYPES) {
    const gem = { mesh: { userData: { gemId: type.id } } };
    assert.equal(awardGem(gem, a).value, type.value);
    assert.equal(awardGem(gem, b), null);
  }
  assert.equal(a.score.treasures, 3);
  assert.equal(a.score.points, 95);
  assert.equal(b.score.points, 0);
  assert.deepEqual(a.score.byType, { gold: 1, green: 1, purple: 1 });
  assert.equal(awardGem({ dead: true }, b), null);
});
test("nearest eligible body wins independently of player order; no out-of-range pickup", () => {
  const a = { id: "a", distance: 0.3 },
    b = { id: "b", distance: 0.05 },
    e = {};
  assert.equal(
    nearestCollector(e, [a, b], (p) => p.distance),
    b,
  );
  assert.equal(
    nearestCollector(e, [b, a], (p) => p.distance),
    b,
  );
  assert.equal(
    nearestCollector(e, [{ distance: 0.5 }], (p) => p.distance),
    null,
  );
  assert.equal(
    nearestCollector(e, [{ distance: NaN }], (p) => p.distance),
    null,
  );
  assert.equal(chooseGem(0.1).id, "gold");
  assert.equal(chooseGem(0.6).id, "green");
  assert.equal(chooseGem(0.95).id, "purple");
  assert.equal(gemType("forged-score").value, 10);
});
