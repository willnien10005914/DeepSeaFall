/** Endless depth biomes — palette, fauna, music mood. */

export const ZONES = [
  {
    id: "surface",
    from: 0,
    to: 40,
    name: "水光表層",
    top: "#7ad7f0",
    bottom: "#1f6f9a",
    particle: "#dff9ff",
    mood: "surface",
    fauna: ["school", "clown", "turtle"],
  },
  {
    id: "sunlit",
    from: 40,
    to: 120,
    name: "陽光帶",
    top: "#2f8fb8",
    bottom: "#0f3f66",
    particle: "#b8ecff",
    mood: "sunlit",
    fauna: ["school", "tuna", "ray"],
  },
  {
    id: "coral",
    from: 120,
    to: 220,
    name: "珊瑚夢境",
    top: "#1d6a8a",
    bottom: "#12324a",
    particle: "#ffd6e8",
    mood: "coral",
    fauna: ["school", "angelfish", "jellyfish"],
  },
  {
    id: "twilight",
    from: 220,
    to: 400,
    name: "暮光層",
    top: "#12324a",
    bottom: "#0a1c33",
    particle: "#7cf0ff",
    mood: "twilight",
    fauna: ["lantern", "squid", "school"],
  },
  {
    id: "midnight",
    from: 400,
    to: 700,
    name: "午夜層",
    top: "#0a1c33",
    bottom: "#050d1c",
    particle: "#5ce1ff",
    mood: "midnight",
    fauna: ["angler", "viper", "jelly"],
  },
  {
    id: "vent",
    from: 700,
    to: 1000,
    name: "熱泉火山",
    top: "#1a1020",
    bottom: "#2a0f12",
    particle: "#ff8f5c",
    mood: "vent",
    fauna: ["crab", "eel", "lavaRock"],
  },
  {
    id: "abyss",
    from: 1000,
    to: 1600,
    name: "深淵",
    top: "#050d1c",
    bottom: "#02060f",
    particle: "#9dffb0",
    mood: "abyss",
    fauna: ["gulper", "ghost", "school"],
  },
  {
    id: "hadal",
    from: 1600,
    to: Infinity,
    name: "超深淵回廊",
    top: "#02060f",
    bottom: "#12081f",
    particle: "#c9a7ff",
    mood: "hadal",
    fauna: ["monster", "biolume", "ghost"],
  },
];

export function zoneAt(depth) {
  for (const z of ZONES) {
    if (depth >= z.from && depth < z.to) return z;
  }
  return ZONES[ZONES.length - 1];
}

export function lerpColor(a, b, t) {
  const pa = hexToRgb(a);
  const pb = hexToRgb(b);
  const r = Math.round(pa.r + (pb.r - pa.r) * t);
  const g = Math.round(pa.g + (pb.g - pa.g) * t);
  const bl = Math.round(pa.b + (pb.b - pa.b) * t);
  return `rgb(${r},${g},${bl})`;
}

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}
