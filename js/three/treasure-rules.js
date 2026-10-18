// Shared immutable rules. Only the authoritative simulation awards pickups.
export const GEM_TYPES = Object.freeze([
  Object.freeze({
    id: "gold",
    name: "金曜石",
    color: 0xffcc54,
    glow: 0xffbb33,
    value: 10,
    weight: 0.5,
  }),
  Object.freeze({
    id: "green",
    name: "翡翠晶",
    color: 0x55edb1,
    glow: 0x29ffc0,
    value: 25,
    weight: 0.32,
  }),
  Object.freeze({
    id: "purple",
    name: "紫星晶",
    color: 0xc591ff,
    glow: 0xb768ff,
    value: 60,
    weight: 0.18,
  }),
]);
export const gemType = (id) =>
  GEM_TYPES.find((g) => g.id === id) || GEM_TYPES[0];
export function chooseGem(roll = Math.random()) {
  let r = Number.isFinite(roll) ? Math.max(0, Math.min(0.999999, roll)) : 0;
  for (const gem of GEM_TYPES) {
    r -= gem.weight;
    if (r < 0) return gem;
  }
  return GEM_TYPES.at(-1);
}
export function freshScore() {
  return { treasures: 0, points: 0, byType: { gold: 0, green: 0, purple: 0 } };
}
export function awardGem(entity, player) {
  if (!entity || entity.dead || entity.claimedBy || !player) return null;
  const gem = gemType(entity.mesh?.userData?.gemId);
  entity.claimedBy = player.id;
  const score = player.score;
  score.treasures++;
  score.points += gem.value;
  score.byType[gem.id]++;
  return gem;
}
export function nearestCollector(entity, players, distance) {
  let winner = null,
    best = 0.38;
  for (const player of players) {
    const d = distance(player, entity);
    if (Number.isFinite(d) && d < best) {
      best = d;
      winner = player;
    }
  }
  return winner;
}
