/** Requested piano soundtrack with procedural underwater game sound effects. */

export class SeaAudio {
  constructor() {
    this.track=new Audio("assets/audio/requested-bgm.mp3?v=42");this.track.loop=true;this.track.preload="auto";this.musicEnabled=true;this.musicAvailable=false;
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.mood = "surface";
    this.prompt = "proactive";
    this._nodes = [];
    this._started = false;
    this._tick = 0;
    this._timer = null;
  }

  async unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.85;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.musicEnabled?.72:0;
      this.musicGain.connect(this.master);
      this.trackSource=this.ctx.createMediaElementSource(this.track);this.trackSource.connect(this.musicGain);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.55;
      this.sfxGain.connect(this.master);
    }
    const resumed=this.ctx.state === "suspended"?this.ctx.resume():Promise.resolve();
    const playing=this.musicEnabled?this.track.play():Promise.resolve();
    await resumed;
    if (!this._started) {
      this._started = true;

    }
    if(this.musicEnabled){try{await playing;this.musicAvailable=true}catch(error){this.musicAvailable=false;console.info('Requested background music is not yet playing',error.message)}}
  }

  async toggleMusic(){
    this.musicEnabled=!this.musicEnabled;
    if(this.musicGain)this.musicGain.gain.setTargetAtTime(this.musicEnabled?.72:0,this.ctx.currentTime,.15);
    if(this.musicEnabled)await this.unlock();else this.track.pause();
    return this.musicEnabled;
  }

  setMood(mood) {
    if (mood === this.mood) return;
    this.mood = mood;
    this._retune();
  }

  setPrompt(prompt) {
    this.prompt = prompt;
    this._retune();
  }

  _scale() {
    const scales = {
      surface: [261.63, 329.63, 392.0, 493.88, 523.25],
      sunlit: [293.66, 349.23, 440.0, 523.25, 587.33],
      twilight: [220.0, 261.63, 329.63, 415.3, 493.88],
      midnight: [174.61, 207.65, 261.63, 311.13, 392.0],
      abyss: [130.81, 155.56, 196.0, 233.08, 311.13],
      hadal: [110.0, 130.81, 164.81, 196.0, 246.94],
      coral: [277.18, 349.23, 415.3, 554.37, 659.25],
      vent: [146.83, 174.61, 220.0, 277.18, 349.23],
    };
    return scales[this.mood] || scales.midnight;
  }

  _tempo() {
    const base = {
      proactive: 1.15,
      careful: 0.82,
      treasure: 1.0,
      explore: 0.95,
    }[this.prompt] || 1;
    const depthMul = {
      surface: 1.1,
      sunlit: 1.05,
      twilight: 0.95,
      midnight: 0.88,
      abyss: 0.78,
      hadal: 0.7,
      coral: 1.12,
      vent: 0.85,
    }[this.mood] || 1;
    return base * depthMul;
  }

  _startBed() {
    this._clearNodes();
    const ctx = this.ctx;
    const scale = this._scale();

    // soft pad
    for (let i = 0; i < 3; i++) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      const f = ctx.createBiquadFilter();
      o.type = i === 0 ? "sine" : "triangle";
      o.frequency.value = scale[i] / (i === 0 ? 2 : 1);
      f.type = "lowpass";
      f.frequency.value = 700 + i * 180;
      g.gain.value = 0.045 - i * 0.008;
      o.connect(f);
      f.connect(g);
      g.connect(this.musicGain);
      o.start();
      this._nodes.push({ o, g, f, kind: "pad", idx: i });
    }

    // bubbly LFO noise bed
    const bufferSize = 2 * ctx.sampleRate;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.15;
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;
    noise.loop = true;
    const ng = ctx.createGain();
    ng.gain.value = 0.035;
    const nf = ctx.createBiquadFilter();
    nf.type = "bandpass";
    nf.frequency.value = 900;
    nf.Q.value = 0.6;
    noise.connect(nf);
    nf.connect(ng);
    ng.connect(this.musicGain);
    noise.start();
    this._nodes.push({ o: noise, g: ng, f: nf, kind: "noise" });
  }

  _clearNodes() {
    for (const n of this._nodes) {
      try { n.o.stop(); } catch {}
      try { n.o.disconnect(); } catch {}
      try { n.g.disconnect(); } catch {}
    }
    this._nodes = [];
  }

  _retune() {
    if (!this._started) return;
    const scale = this._scale();
    for (const n of this._nodes) {
      if (n.kind === "pad" && n.o.frequency) {
        const target = scale[n.idx] / (n.idx === 0 ? 2 : 1);
        n.o.frequency.setTargetAtTime(target, this.ctx.currentTime, 0.8);
      }
      if (n.kind === "noise" && n.f) {
        const freq = this.mood === "hadal" || this.mood === "abyss" ? 420 : 900;
        n.f.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.6);
        n.g.gain.setTargetAtTime(this.mood === "vent" ? 0.05 : 0.03, this.ctx.currentTime, 0.5);
      }
    }
  }

  _pulse() {
    if (!this._started || this.ctx.state !== "running") return;
    this._tick++;
    const scale = this._scale();
    const t = this.ctx.currentTime;
    const note = scale[this._tick % scale.length];
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = this.prompt === "careful" ? "sine" : "triangle";
    o.frequency.value = note * (this._tick % 7 === 0 ? 0.5 : 1);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05 * this._tempo(), t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35 / this._tempo());
    o.connect(g);
    g.connect(this.musicGain);
    o.start(t);
    o.stop(t + 0.4);
  }

  _beep({ freq = 440, dur = 0.2, type = "sine", gain = 0.2, slide = 0 }) {
    if (!this._started) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.sfxGain);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  _noiseBurst({ dur = 0.18, gain = 0.18, freq = 600, q = 1 }) {
    if (!this._started) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.sfxGain);
    src.start(t);
  }

  sfxHit() {
    this._noiseBurst({ dur: 0.22, gain: 0.28, freq: 280, q: 0.8 });
    this._beep({ freq: 180, dur: 0.18, type: "square", gain: 0.12, slide: -80 });
  }

  sfxRock() {
    this._noiseBurst({ dur: 0.28, gain: 0.32, freq: 160, q: 0.5 });
    this._beep({ freq: 90, dur: 0.25, type: "sawtooth", gain: 0.1, slide: -40 });
  }

  sfxTreasure() {
    this._beep({ freq: 660, dur: 0.12, type: "sine", gain: 0.18 });
    setTimeout(() => this._beep({ freq: 880, dur: 0.14, type: "sine", gain: 0.16 }), 70);
    setTimeout(() => this._beep({ freq: 1175, dur: 0.2, type: "triangle", gain: 0.14 }), 140);
  }

  sfxSeaweed() {
    this._beep({ freq: 392, dur: 0.2, type: "sine", gain: 0.14, slide: 120 });
    this._noiseBurst({ dur: 0.2, gain: 0.1, freq: 1200, q: 2 });
  }

  sfxWhale() {
    this._beep({ freq: 120, dur: 0.55, type: "sine", gain: 0.22, slide: -50 });
    setTimeout(() => this._beep({ freq: 90, dur: 0.7, type: "triangle", gain: 0.16, slide: 40 }), 180);
  }

  sfxWhalePass() {
    this._beep({ freq: 140, dur: 0.9, type: "sine", gain: 0.14, slide: -70 });
    this._noiseBurst({ dur: 0.5, gain: 0.08, freq: 220, q: 0.4 });
  }

  sfxMagic() {
    this._beep({ freq: 520, dur: 0.25, type: "sine", gain: 0.16, slide: 260 });
    this._beep({ freq: 780, dur: 0.35, type: "triangle", gain: 0.1, slide: 180 });
  }

  sfxAttack() {
    this._noiseBurst({ dur: 0.15, gain: 0.22, freq: 900, q: 3 });
    this._beep({ freq: 340, dur: 0.12, type: "square", gain: 0.12, slide: 200 });
  }

  sfxBoost() {
    this._beep({ freq: 240, dur: 0.3, type: "sawtooth", gain: 0.1, slide: 400 });
  }

  sfxSleep() {
    this._beep({ freq: 330, dur: 0.4, type: "sine", gain: 0.1, slide: -100 });
  }

  sfxDeath() {
    this._beep({ freq: 220, dur: 0.8, type: "triangle", gain: 0.18, slide: -160 });
    this._noiseBurst({ dur: 0.7, gain: 0.15, freq: 180, q: 0.5 });
  }

  sfxRevive() {
    this._beep({ freq: 440, dur: 0.2, type: "sine", gain: 0.16 });
    setTimeout(() => this._beep({ freq: 554, dur: 0.25, type: "sine", gain: 0.14 }), 100);
    setTimeout(() => this._beep({ freq: 659, dur: 0.35, type: "triangle", gain: 0.14 }), 220);
  }

  sfxEquip() {
    this._beep({ freq: 500, dur: 0.15, type: "square", gain: 0.1 });
    this._beep({ freq: 750, dur: 0.2, type: "sine", gain: 0.12 });
  }
}
