/** Generate multi-minute demo soundtrack with evolving moods + SFX hits. */
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "demo");
const SR = 44100;
const SECS = Number(process.env.AUDIO_SECS || 242);
const N = SR * SECS;

function clamp(v, a = -1, b = 1) { return Math.max(a, Math.min(b, v)); }
function env(i, a, d, total) {
  const at = Math.floor(SR * a);
  const dt = Math.floor(SR * d);
  if (i < at) return i / Math.max(1, at);
  if (i > total - dt) return Math.max(0, (total - i) / Math.max(1, dt));
  return 1;
}

function tone(buf, startSec, dur, freq, amp = 0.12, type = "sine", slide = 0) {
  const start = Math.floor(startSec * SR);
  const len = Math.floor(dur * SR);
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    const f = Math.max(40, freq + slide * (i / len));
    const phase = 2 * Math.PI * f * t;
    let s;
    if (type === "square") s = Math.sign(Math.sin(phase));
    else if (type === "triangle") s = 2 * Math.asin(Math.sin(phase)) / Math.PI;
    else if (type === "saw") s = 2 * ((t * f) % 1) - 1;
    else s = Math.sin(phase);
    const e = env(i, 0.02, 0.08, len);
    const idx = start + i;
    if (idx >= 0 && idx < buf.length) buf[idx] += s * amp * e;
  }
}

function noise(buf, startSec, dur, amp = 0.08, hp = 0.1) {
  const start = Math.floor(startSec * SR);
  const len = Math.floor(dur * SR);
  let prev = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    const filtered = prev + hp * (white - prev);
    prev = filtered;
    const e = env(i, 0.005, 0.12, len);
    const idx = start + i;
    if (idx >= 0 && idx < buf.length) buf[idx] += filtered * amp * e;
  }
}

const scales = [
  [261.63, 329.63, 392.0, 493.88],
  [293.66, 349.23, 440.0, 523.25],
  [220.0, 261.63, 329.63, 415.3],
  [174.61, 207.65, 261.63, 311.13],
  [146.83, 174.61, 220.0, 277.18],
  [130.81, 164.81, 196.0, 246.94],
  [110.0, 138.59, 164.81, 207.65],
];

const buf = new Float32Array(N);

// evolving pad / melody
for (let s = 0; s < SECS; s += 0.48) {
  const scale = scales[Math.min(scales.length - 1, Math.floor(s / 35))];
  const note = scale[Math.floor(s * 2) % scale.length];
  const tempo = s > 120 ? 0.9 : 1.05;
  tone(buf, s, 0.42 * tempo, note / 2, 0.035, "sine");
  tone(buf, s + 0.1, 0.32 * tempo, note, 0.03, "triangle");
  if (Math.floor(s) % 8 === 0) tone(buf, s, 0.55, note * 1.5, 0.02, "sine");
}

for (let s = 0; s < SECS; s += 0.85) {
  noise(buf, s, 0.45, 0.025 + (s / SECS) * 0.02, 0.18);
}

// Scheduled SFX every ~4.5s matching recorder actions
for (let s = 0.5; s < SECS - 2; s += 4.5) {
  const kind = Math.floor(s / 4.5) % 10;
  if (kind === 0) { // whale
    tone(buf, s, 0.55, 120, 0.14, "sine", -50);
    tone(buf, s + 0.2, 0.7, 90, 0.1, "triangle", 40);
  } else if (kind === 1) { // boost
    tone(buf, s, 0.3, 240, 0.09, "saw", 400);
  } else if (kind === 2) { // magic
    tone(buf, s, 0.25, 520, 0.11, "sine", 260);
    tone(buf, s + 0.05, 0.35, 780, 0.07, "triangle", 180);
  } else if (kind === 3) { // attack
    noise(buf, s, 0.15, 0.16, 0.35);
    tone(buf, s, 0.12, 340, 0.09, "square", 200);
  } else if (kind === 4) { // treasure
    tone(buf, s, 0.12, 660, 0.12, "sine");
    tone(buf, s + 0.08, 0.14, 880, 0.1, "sine");
    tone(buf, s + 0.16, 0.2, 1175, 0.08, "triangle");
  } else if (kind === 5) { // equip
    tone(buf, s, 0.15, 500, 0.09, "square");
    tone(buf, s + 0.08, 0.2, 750, 0.1, "sine");
  } else if (kind === 6) { // rock
    noise(buf, s, 0.28, 0.18, 0.15);
    tone(buf, s, 0.25, 90, 0.09, "saw", -40);
  } else if (kind === 7) { // seaweed
    tone(buf, s, 0.2, 392, 0.11, "sine", 120);
    noise(buf, s, 0.2, 0.08, 0.25);
  } else if (kind === 8) { // sleep
    tone(buf, s, 0.4, 330, 0.08, "sine", -100);
  } else { // whale pass
    tone(buf, s, 0.9, 140, 0.11, "sine", -70);
    noise(buf, s, 0.5, 0.06, 0.12);
  }
}

let peak = 0;
for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(buf[i]));
const norm = peak > 0 ? 0.88 / peak : 1;
const pcm = Buffer.alloc(N * 2);
for (let i = 0; i < N; i++) {
  pcm.writeInt16LE(Math.floor(clamp(buf[i] * norm) * 32767), i * 2);
}

const header = Buffer.alloc(44);
header.write("RIFF", 0);
header.writeUInt32LE(36 + pcm.length, 4);
header.write("WAVE", 8);
header.write("fmt ", 12);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);
header.writeUInt16LE(1, 22);
header.writeUInt32LE(SR, 24);
header.writeUInt32LE(SR * 2, 28);
header.writeUInt16LE(2, 32);
header.writeUInt16LE(16, 34);
header.write("data", 36);
header.writeUInt32LE(pcm.length, 40);

if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
const out = join(outDir, "deep_sea_fall_playthrough_audio.wav");
writeFileSync(out, Buffer.concat([header, pcm]));
console.log("Wrote", out, `(${SECS}s)`);
