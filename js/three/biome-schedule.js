export const EARLY_BIOME_METRES = 10;
export const DEEP_BIOME_METRES = 30;
export const DEEP_THEMES = Object.freeze([
  "star-drift",
  "jade-forest",
  "violet-bloom",
  "crimson-reef",
  "amber-grove",
  "black-trench",
]);
export function scheduleAt(value) {
  const depth = Number.isFinite(value) ? Math.max(0, value) : 0;
  if (depth < 50) {
    const segment = Math.floor(depth / 10);
    return { segment, start: segment * 10, end: (segment + 1) * 10, key: null };
  }
  if (depth < 70)
    return { segment: 5, start: 50, end: 70, key: "mythic-ruins" };
  if (depth < 100)
    return { segment: 6, start: 70, end: 100, key: "stone-canyon" };
  if (depth < 130)
    return { segment: 7, start: 100, end: 130, key: "volcanic-rift" };
  const band = Math.floor((depth - 130) / 30);
  return {
    segment: 8 + band,
    start: 130 + band * 30,
    end: 160 + band * 30,
    key: DEEP_THEMES[band % DEEP_THEMES.length],
  };
}
