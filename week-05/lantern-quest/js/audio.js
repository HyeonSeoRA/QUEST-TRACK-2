'use strict';
// 소리 — 효과음과 배경 음악을 Web Audio 로 그 자리에서 만든다 (소리 파일 없음)

const AC = { ctx: null, sfx: null, mus: null, noise: null };

function audioInit() {
  if (AC.ctx) { if (AC.ctx.state === 'suspended') AC.ctx.resume(); return; }
  const C = window.AudioContext || window.webkitAudioContext;
  if (!C) return;
  const ctx = new C();
  AC.ctx = ctx;
  const comp = ctx.createDynamicsCompressor();
  comp.connect(ctx.destination);
  AC.sfx = ctx.createGain(); AC.sfx.connect(comp);
  AC.mus = ctx.createGain(); AC.mus.connect(comp);
  setVolumes();
  const len = ctx.sampleRate;
  AC.noise = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = AC.noise.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
}
function setVolumes() {
  if (!AC.ctx) return;
  AC.sfx.gain.value = Settings.sfx * 0.6;
  AC.mus.gain.value = Settings.music * 0.35;
}
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

function tone(type, f, t, dur, vol, o = {}) {
  const ctx = AC.ctx, osc = ctx.createOscillator(), g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f, t);
  if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + (o.atk || 0.005));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g); g.connect(o.dest || AC.sfx);
  osc.start(t); osc.stop(t + dur + 0.02);
}
function noise(t, dur, vol, freq = 1000, type = 'lowpass', to, dest) {
  const ctx = AC.ctx, src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  src.buffer = AC.noise;
  f.type = type; f.frequency.setValueAtTime(freq, t);
  if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(dest || AC.sfx);
  src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.02);
}

const SFX = {
  play(name) {
    if (!AC.ctx || Settings.sfx <= 0) return;
    const t = AC.ctx.currentTime;
    switch (name) {
      case 'move': tone('square', 660, t, 0.04, 0.05); break;
      case 'select': tone('square', 880, t, 0.06, 0.07); tone('square', 1320, t + 0.05, 0.08, 0.06); break;
      case 'cancel': tone('square', 440, t, 0.06, 0.06, { slide: 300 }); break;
      case 'error': tone('square', 160, t, 0.12, 0.08); tone('square', 150, t + 0.12, 0.12, 0.08); break;
      case 'slash': noise(t, 0.12, 0.3, 2500, 'highpass'); tone('square', 320, t, 0.08, 0.05, { slide: 120 }); break;
      case 'smash': noise(t, 0.2, 0.45, 500); tone('sine', 140, t, 0.2, 0.3, { slide: 40 }); break;
      case 'bite': noise(t, 0.08, 0.3, 1400, 'bandpass'); noise(t + 0.08, 0.08, 0.3, 1100, 'bandpass'); break;
      case 'arrow': noise(t, 0.1, 0.2, 3500, 'highpass', 1500); tone('triangle', 1400, t, 0.08, 0.06, { slide: 600 }); break;
      case 'fire': noise(t, 0.35, 0.3, 900, 'lowpass', 200); break;
      case 'boom': noise(t, 0.5, 0.5, 400, 'lowpass', 60); tone('sine', 90, t, 0.4, 0.35, { slide: 30 }); break;
      case 'ice': [1568, 2093, 2637, 3136].forEach((f, i) => tone('triangle', f, t + i * 0.04, 0.12, 0.08)); noise(t, 0.2, 0.1, 5000, 'highpass'); break;
      case 'bolt': noise(t, 0.3, 0.4, 3000, 'bandpass', 800); tone('square', 60, t, 0.25, 0.12); break;
      case 'holy': [523, 659, 784, 1047].forEach((f, i) => tone('sine', f, t + i * 0.06, 0.6, 0.08, { atk: 0.05 })); break;
      case 'dark': tone('sawtooth', 220, t, 0.5, 0.12, { slide: 50 }); noise(t, 0.4, 0.15, 300); break;
      case 'poison': for (let i = 0; i < 4; i++) tone('sine', rnd(300, 700), t + i * 0.05, 0.06, 0.1, { slide: rnd(700, 1000) }); break;
      case 'heal': [523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, t + i * 0.06, 0.2, 0.09)); break;
      case 'buff': tone('square', 392, t, 0.12, 0.06, { slide: 784 }); tone('square', 523, t + 0.1, 0.12, 0.05, { slide: 1047 }); break;
      case 'debuff': tone('square', 600, t, 0.2, 0.06, { slide: 200 }); break;
      case 'roar': tone('sawtooth', 110, t, 0.5, 0.2, { slide: 60 }); noise(t, 0.5, 0.2, 400); break;
      case 'wind': noise(t, 0.45, 0.25, 800, 'bandpass', 2000); break;
      case 'hit': noise(t, 0.08, 0.35, 1200); tone('square', 160, t, 0.07, 0.1, { slide: 80 }); break;
      case 'crit': noise(t, 0.12, 0.45, 2000); tone('square', 1200, t, 0.1, 0.1, { slide: 400 }); tone('sine', 100, t, 0.2, 0.3, { slide: 40 }); break;
      case 'miss': tone('triangle', 600, t, 0.12, 0.08, { slide: 300 }); break;
      case 'guard': tone('square', 300, t, 0.06, 0.08); noise(t, 0.06, 0.2, 3000, 'highpass'); break;
      case 'death': tone('square', 300, t, 0.35, 0.1, { slide: 50 }); noise(t, 0.3, 0.2, 600, 'lowpass', 100); break;
      case 'coin': tone('square', 988, t, 0.06, 0.07); tone('square', 1319, t + 0.06, 0.15, 0.07); break;
      case 'open': tone('triangle', 392, t, 0.1, 0.1); [523, 659, 784, 1047, 1319].forEach((f, i) => tone('square', f, t + 0.1 + i * 0.05, 0.1, 0.05)); break;
      case 'levelup': [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone('square', f, t + i * 0.07, 0.14, 0.07)); break;
      case 'victory': [[523, 0], [523, 0.12], [523, 0.24], [523, 0.36], [415, 0.6], [466, 0.84], [523, 1.08], [466, 1.26], [523, 1.38]].forEach(([f, d]) => tone('square', f, t + d, d === 1.38 ? 0.6 : 0.14, 0.08)); break;
      case 'defeat': [392, 370, 349, 330].forEach((f, i) => tone('triangle', f, t + i * 0.3, 0.4, 0.12)); break;
      case 'step': noise(t, 0.05, 0.1, 700); break;
      case 'boss': tone('sawtooth', 55, t, 1.2, 0.2, { atk: 0.2 }); tone('sawtooth', 58, t, 1.2, 0.15, { atk: 0.2 }); noise(t, 1, 0.15, 200); break;
    }
  },
};

// ---------- 배경 음악 ----------
// 8분음표 32칸 (4마디). chords: 마디마다 화음, lead: 멜로디
const NOTE = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
const parseNote = s => { const m = s.match(/^([A-G]#?)(\d)$/); return m ? NOTE[m[1]] + (+m[2] + 1) * 12 : null; };
const parseLead = s => s.trim().split(/\s+/).filter(x => x !== '|').map(x => (x === '.' ? null : parseNote(x)));
const TRACKS = {
  title: { bpm: 92, wave: 'triangle', chords: [[45, 48, 52], [41, 45, 48], [48, 52, 55], [43, 47, 50]], drum: '', lead: parseLead('E5 . D5 C5 . B4 C5 . | A4 . . . C5 . F5 . | E5 . . D5 C5 . G4 . | B4 . . . D5 . . .') },
  forest: { bpm: 108, wave: 'square', chords: [[50, 53, 57], [48, 52, 55], [46, 50, 53], [48, 52, 55]], drum: 'k...h...k.k.h...', lead: parseLead('F5 . E5 D5 . A4 . D5 | E5 . . C5 . G4 . . | D5 . F5 . A5 . G5 F5 | E5 . . . . . . .') },
  sands: { bpm: 100, wave: 'square', chords: [[40, 44, 47], [41, 45, 48], [40, 44, 47], [38, 42, 45]], drum: 'k..hk.h.k..hk.h.', lead: parseLead('E5 . F5 . G#5 . F5 E5 | F5 . E5 . D5 . C5 . | B4 . C5 . D5 . E5 . | F5 E5 D5 . E5 . . .') },
  frost: { bpm: 84, wave: 'triangle', chords: [[49, 52, 56], [45, 49, 52], [40, 44, 47], [47, 51, 54]], drum: '', lead: parseLead('G#5 . . . E5 . . . | C#6 . . . B5 . A5 . | G#5 . . . B5 . . . | F#5 . . . . . . .') },
  ash: { bpm: 132, wave: 'square', chords: [[48, 51, 55], [44, 48, 51], [46, 50, 53], [43, 47, 50]], drum: 'k.h.s.h.k.k.s.h.', lead: parseLead('C5 . C5 D#5 . G5 . F5 | D#5 . C5 . G#4 . . . | A#4 . D5 . F5 . D5 A#4 | B4 . D5 . G5 . . .') },
  battle: { bpm: 150, wave: 'square', chords: [[45, 48, 52], [45, 48, 52], [41, 45, 48], [43, 47, 50]], drum: 'k.h.s.h.k.k.s.hh', lead: parseLead('A4 . C5 E5 . A5 . G5 | E5 . D5 . C5 . B4 . | C5 . . A4 . . F5 . | D5 . B4 . G5 . . .') },
  boss: { bpm: 162, wave: 'sawtooth', chords: [[38, 41, 45], [46, 50, 53], [43, 46, 50], [45, 49, 52]], drum: 'k.hsk.hsk.hsk.ss', lead: parseLead('D5 D5 . F5 . A5 . G#5 | A5 . . . F5 . D5 . | G5 . A#5 . G5 . F5 . | E5 . C#5 . A4 . . .') },
};
const ARP = [0, 1, 2, 1, 0, 1, 2, 1];

const Music = {
  cur: null, step: 0, next: 0, timer: null,
  play(name) {
    if (this.cur === name) return;
    this.cur = name; this.step = 0;
    if (AC.ctx) this.next = AC.ctx.currentTime + 0.08;
    if (!this.timer) this.timer = setInterval(() => this.tick(), 30);
  },
  stop() { this.cur = null; },
  tick() {
    if (!AC.ctx || !this.cur || Settings.music <= 0) return;
    const tr = TRACKS[this.cur], spb = 60 / tr.bpm / 2, now = AC.ctx.currentTime;
    if (this.next < now) this.next = now + 0.05;
    while (this.next < now + 0.15) {
      this.sched(tr, this.step, this.next, spb);
      this.next += spb;
      this.step = (this.step + 1) % 32;
    }
  },
  sched(tr, s, t, spb) {
    const ch = tr.chords[s >> 3], i = s & 7, D = AC.mus;
    if (i === 0 || i === 4 || (tr.bpm > 120 && i % 2 === 0)) tone('triangle', mtof(ch[0] - 12 + 12), t, spb * 1.8, 0.22, { dest: D });
    tone(tr.wave === 'sawtooth' ? 'square' : tr.wave, mtof(ch[ARP[i]] + 12), t, spb * 0.9, 0.035, { dest: D });
    const n = tr.lead[s];
    if (n != null) {
      let len = 1;
      while (len < 4 && tr.lead[(s + len) % 32] == null) len++;
      tone(tr.wave, mtof(n), t, spb * len * 0.95, 0.07, { dest: D, atk: 0.01 });
    }
    const dr = tr.drum ? tr.drum[(s * 2) % tr.drum.length] : '';
    if (dr === 'k') tone('sine', 120, t, 0.12, 0.35, { slide: 40, dest: D });
    if (dr === 's') noise(t, 0.12, 0.18, 1800, 'bandpass', null, D);
    if (dr === 'h') noise(t, 0.04, 0.06, 7000, 'highpass', null, D);
    const dr2 = tr.drum ? tr.drum[(s * 2 + 1) % tr.drum.length] : '';
    if (dr2 === 'h') noise(t + spb / 2, 0.03, 0.05, 7000, 'highpass', null, D);
    if (dr2 === 's') noise(t + spb / 2, 0.1, 0.12, 1800, 'bandpass', null, D);
  },
};
