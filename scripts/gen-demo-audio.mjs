/**
 * Generate a ~20s demo soundtrack WAV with BGM bed + SFX stingers
 * (mirrors in-game WebAudio moods for the walkthrough video).
 */
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "..", "demo");
const SR = 44100;
const SECS = 20;
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
    const f = freq + slide * (i / len);
    const phase = 2 * Math.PI * f * t;
    let s;
    if (type === "square") s = Math.sign(Math.sin(phase));
    else if (type === "triangle") s = 2 * Math.asin(Math.sin(phase)) / Math.PI;
    else if (type === "saw") s = 2 * ((t * f) % 1) - 1;
    else s = Math.sin(phase);
    const e = env(i, 0.02, 0.08, len);
    const idx = start + i;
    if (idx < buf.length) buf[idx] += s * amp * e;
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
    const e = env(i, 0.005, 0.1, len);
    const idx = start + i;
    if (idx < buf.length) buf[idx] += filtered * amp * e;
  }
}

const buf = new Float32Array(N);
const scales = [
  [261.63, 329.63, 392.0, 493.88],
  [220.0, 261.63, 329.63, 415.3],
  [174.61, 207.65, 261.63, 311.13],
  [130.81, 164.81, 196.0, 246.94],
];

// ambient pads
for (let s = 0; s < SECS; s += 0.5) {
  const scale = scales[Math.min(3, Math.floor(s / 5))];
  const note = scale[Math.floor(s * 2) % scale.length];
  tone(buf, s, 0.45, note / 2, 0.04, "sine");
  tone(buf, s + 0.12, 0.35, note, 0.035, "triangle");
}

// soft bubble noise bed
for (let s = 0; s < SECS; s += 0.8) {
  noise(buf, s, 0.5, 0.03, 0.2);
}

// SFX timeline matching demo actions
tone(buf, 0.4, 0.55, 120, 0.16, "sine", -50); // whale
tone(buf, 0.6, 0.7, 90, 0.12, "triangle", 40);
tone(buf, 2.2, 0.12, 660, 0.14, "sine"); // treasure
tone(buf, 2.35, 0.14, 880, 0.12, "sine");
tone(buf, 2.5, 0.2, 1175, 0.1, "triangle");
tone(buf, 4.5, 0.25, 520, 0.12, "sine", 260); // magic
tone(buf, 4.6, 0.35, 780, 0.08, "triangle", 180);
tone(buf, 6.8, 0.3, 240, 0.1, "saw", 400); // boost
noise(buf, 9.0, 0.28, 0.2, 0.15); // rock
tone(buf, 9.0, 0.25, 90, 0.1, "saw", -40);
noise(buf, 11.2, 0.15, 0.16, 0.35); // attack
tone(buf, 11.2, 0.12, 340, 0.1, "square", 200);
tone(buf, 13.5, 0.4, 330, 0.08, "sine", -100); // sleep
tone(buf, 15.5, 0.55, 120, 0.14, "sine", -50); // whale again
tone(buf, 17.8, 0.12, 660, 0.12, "sine");
tone(buf, 18.0, 0.2, 880, 0.1, "triangle");

// normalize
let peak = 0;
for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(buf[i]));
const norm = peak > 0 ? 0.9 / peak : 1;
const pcm = Buffer.alloc(N * 2);
for (let i = 0; i < N; i++) {
  const v = clamp(buf[i] * norm);
  pcm.writeInt16LE(Math.floor(v * 32767), i * 2);
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
const out = join(outDir, "deep_sea_fall_demo_audio.wav");
writeFileSync(out, Buffer.concat([header, pcm]));
console.log("Wrote", out);
