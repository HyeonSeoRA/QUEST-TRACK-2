'use strict';
/* 소리 엔진: Web Audio 로 악기를 직접 만들어 연주해요 (음악 파일 없음) */

const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

const AE = {
  ctx: null,

  init() {
    if (this.ctx) { this.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = this.ctx = new AC({ latencyHint: 'interactive' });
    this.master = c.createGain();
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 4;
    comp.attack.value = 0.003; comp.release.value = 0.15;
    this.analyser = c.createAnalyser();
    this.analyser.fftSize = 128; this.analyser.smoothingTimeConstant = 0.7;
    this.freq = new Uint8Array(this.analyser.frequencyBinCount);
    this.master.connect(comp); comp.connect(this.analyser); this.analyser.connect(c.destination);

    this.music = c.createGain(); this.music.connect(this.master);
    this.sfx = c.createGain(); this.sfx.gain.value = 0.75; this.sfx.connect(this.master);

    // 메아리 (점8분음표 딜레이)
    this.dly = c.createDelay(1.5); this.dly.delayTime.value = 0.3;
    const fb = c.createGain(); fb.gain.value = 0.33;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
    this.dly.connect(lp); lp.connect(fb); fb.connect(this.dly);
    const dOut = c.createGain(); dOut.gain.value = 0.55; lp.connect(dOut); dOut.connect(this.master);
    this.dlyIn = c.createGain(); this.dlyIn.gain.value = 0.32; this.dlyIn.connect(this.dly);

    // 잔향
    const conv = c.createConvolver(); conv.buffer = this.makeIR(1.8);
    this.revIn = c.createGain(); this.revIn.gain.value = 0.25; this.revIn.connect(conv);
    const rOut = c.createGain(); rOut.gain.value = 0.4; conv.connect(rOut); rOut.connect(this.master);

    // 잡음 (드럼용)
    const nb = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = nb.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noise = nb;
    this.setVolume(Store.data.settings.vol);
  },
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
  now() { return this.ctx ? this.ctx.currentTime : performance.now() / 1000; },
  latency() { const c = this.ctx; return c ? Math.min(0.15, (c.outputLatency || 0) + (c.baseLatency || 0)) : 0; },
  setVolume(v) { if (this.master) this.master.gain.value = Math.pow(v / 10, 1.5) * 0.95; },
  setBeat(spb) { if (this.ctx) this.dly.delayTime.setValueAtTime(spb * 0.75, this.ctx.currentTime); },
  spectrum() { if (!this.analyser) return null; this.analyser.getByteFrequencyData(this.freq); return this.freq; },

  makeIR(sec) {
    const c = this.ctx, len = Math.floor(c.sampleRate * sec), b = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    return b;
  },

  /* ---- 기본 부품 ---- */
  nz(t, type, freq, q, gain, decay, dest) {
    const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t + decay);
    s.connect(f); f.connect(g); g.connect(dest);
    s.start(t, Math.random() * 1.5); s.stop(t + decay + 0.03);
    return g;
  },
  tone(t, type, f0, f1, gain, decay, dest, glide = decay) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + glide);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.001, t + decay);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + decay + 0.03);
    return g;
  },

  /* ---- 드럼 ---- */
  kick(ch, t, v = 1) {
    this.tone(t, 'sine', 165, 42, 1.0 * v, 0.38, ch.out, 0.13);
    this.nz(t, 'highpass', 3000, 0.7, 0.18 * v, 0.015, ch.out);
    // 사이드체인: 킥이 울릴 때 패드 소리를 잠깐 줄인다 (두근거리는 느낌)
    const g = ch.pad.gain;
    g.cancelScheduledValues(t); g.setValueAtTime(0.22, t); g.linearRampToValueAtTime(1, t + 0.24);
  },
  snare(ch, t, v = 1) {
    const g = this.nz(t, 'bandpass', 1900, 0.8, 0.5 * v, 0.18, ch.out);
    g.connect(this.revIn);
    this.tone(t, 'triangle', 230, 140, 0.32 * v, 0.1, ch.out);
  },
  hat(ch, t, v = 0.6, open = false) {
    this.nz(t, 'highpass', 7500, 0.6, 0.16 * v, open ? 0.22 : 0.035, ch.out);
  },
  crash(ch, t, v = 1) {
    const g = this.nz(t, 'highpass', 4500, 0.5, 0.2 * v, 1.5, ch.out);
    g.connect(this.revIn);
  },
  riser(ch, t, dur) {
    const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; s.loop = true; f.type = 'bandpass'; f.Q.value = 2;
    f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(7000, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.16, t + dur); g.gain.linearRampToValueAtTime(0, t + dur + 0.02);
    s.connect(f); f.connect(g); g.connect(ch.out); g.connect(this.revIn);
    s.start(t); s.stop(t + dur + 0.05);
  },

  /* ---- 악기 ---- */
  bass(ch, t, m, dur) {
    const c = this.ctx, f = c.createBiquadFilter(), g = c.createGain();
    f.type = 'lowpass'; f.Q.value = 5;
    f.frequency.setValueAtTime(1300, t); f.frequency.exponentialRampToValueAtTime(320, t + 0.14);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.26, t + 0.006);
    g.gain.setValueAtTime(0.2, t + Math.max(0.02, dur - 0.02)); g.gain.exponentialRampToValueAtTime(0.001, t + dur + 0.06);
    for (const [type, mul] of [['sawtooth', 1], ['sine', 0.5]]) {
      const o = c.createOscillator(); o.type = type; o.frequency.value = mtof(m) * mul;
      o.connect(f); o.start(t); o.stop(t + dur + 0.1);
    }
    f.connect(g); g.connect(ch.out);
  },
  pad(ch, t, ms, dur, v = 1) {
    const c = this.ctx, f = c.createBiquadFilter(), g = c.createGain();
    f.type = 'lowpass'; f.frequency.value = 1500; f.Q.value = 0.6;
    const a = Math.min(0.25, dur * 0.3);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.03 * v, t + a);
    g.gain.setValueAtTime(0.03 * v, t + dur); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.45);
    for (const m of ms) for (const det of [-9, 9]) {
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = det;
      o.connect(f); o.start(t); o.stop(t + dur + 0.5);
    }
    f.connect(g); g.connect(ch.pad); g.connect(this.revIn);
  },
  lead(ch, t, m, dur, v = 1) {
    const c = this.ctx, f = c.createBiquadFilter(), g = c.createGain();
    const long = dur > 0.3;
    f.type = 'lowpass'; f.Q.value = 6;
    f.frequency.setValueAtTime(4200, t); f.frequency.exponentialRampToValueAtTime(long ? 1700 : 900, t + 0.25);
    const peak = 0.085 * v;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + 0.005);
    if (long) { g.gain.setValueAtTime(peak * 0.75, t + dur); g.gain.exponentialRampToValueAtTime(0.001, t + dur + 0.12); }
    else { g.gain.exponentialRampToValueAtTime(peak * 0.25, t + dur); g.gain.exponentialRampToValueAtTime(0.001, t + dur + 0.08); }
    const lfo = c.createOscillator(), lg = c.createGain();
    lfo.frequency.value = 6; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(long ? 14 : 0, t + 0.25);
    lfo.connect(lg);
    for (const [type, det] of [['square', 0], ['sawtooth', 8]]) {
      const o = c.createOscillator(); o.type = type; o.frequency.value = mtof(m); o.detune.value = det;
      lg.connect(o.detune); o.connect(f); o.start(t); o.stop(t + dur + 0.15);
    }
    lfo.start(t); lfo.stop(t + dur + 0.15);
    f.connect(g); g.connect(ch.out); g.connect(this.dlyIn); g.connect(this.revIn);
  },
  arp(ch, t, m, v = 1) {
    const g = this.tone(t, 'square', mtof(m), mtof(m), 0.028 * v, 0.11, ch.out);
    g.connect(this.dlyIn);
  },

  flute(ch, t, m, dur, v = 1) {
    const c = this.ctx, f = mtof(m), g = c.createGain(), lp = c.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 3200;
    const peak = 0.11 * v, a = Math.min(0.05, dur * 0.3);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.setValueAtTime(peak * 0.85, t + Math.max(a, dur)); g.gain.exponentialRampToValueAtTime(0.001, t + dur + 0.18);
    const lfo = c.createOscillator(), lg = c.createGain();
    lfo.frequency.value = 5.2; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(dur > 0.3 ? 12 : 3, t + 0.3);
    lfo.connect(lg);
    for (const [type, mul, gv] of [['sine', 1, 1], ['triangle', 2, 0.18]]) {
      const o = c.createOscillator(), og = c.createGain(); o.type = type; o.frequency.value = f * mul; og.gain.value = gv;
      lg.connect(o.detune); o.connect(og); og.connect(lp); o.start(t); o.stop(t + dur + 0.25);
    }
    lfo.start(t); lfo.stop(t + dur + 0.25);
    this.nz(t, 'bandpass', f * 2, 3, 0.03 * v, Math.min(0.12, dur), lp);
    lp.connect(g); g.connect(ch.out); g.connect(this.dlyIn); g.connect(this.revIn);
  },
  bell(ch, t, m, dur, v = 1) {
    const c = this.ctx, f = mtof(m), g = c.createGain();
    const len = Math.max(0.6, dur + 0.5);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.1 * v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.001, t + len);
    for (const [mul, gv, dec] of [[1, 1, 1], [2.76, 0.35, 0.4], [5.4, 0.18, 0.2], [2, 0.3, 0.7]]) {
      const o = c.createOscillator(), og = c.createGain(); o.type = 'sine'; o.frequency.value = f * mul;
      og.gain.setValueAtTime(gv, t); og.gain.exponentialRampToValueAtTime(0.001, t + len * dec);
      o.connect(og); og.connect(g); o.start(t); o.stop(t + len);
    }
    g.connect(ch.out); g.connect(this.revIn); g.connect(this.dlyIn);
  },
  pluck(ch, t, m, v = 1) {
    const c = this.ctx, f = mtof(m), lp = c.createBiquadFilter(), g = c.createGain();
    lp.type = 'lowpass'; lp.Q.value = 2; lp.frequency.setValueAtTime(3500, t); lp.frequency.exponentialRampToValueAtTime(400, t + 0.3);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.06 * v, t + 0.003); g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    for (const [type, det] of [['triangle', 0], ['square', 5]]) { const o = c.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = det; o.connect(lp); o.start(t); o.stop(t + 0.55); }
    lp.connect(g); g.connect(ch.out); g.connect(this.revIn);
  },
  shaker(ch, t, v = 0.6) { this.nz(t, 'bandpass', 6500, 1.5, 0.09 * v, 0.05, ch.out); },
  tom(ch, t, v = 1) { this.tone(t, 'sine', 140, 70, 0.5 * v, 0.3, ch.out, 0.2); },

  /* ---- 효과음 (지금 바로 울림) ---- */
  hit(lane, grade) {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    // 검 휘두르는 바람 소리 + 맞는 소리 + 쇳소리
    const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; f.type = 'bandpass'; f.Q.value = 1.4;
    f.frequency.setValueAtTime(lane ? 1200 : 2200, t); f.frequency.exponentialRampToValueAtTime(lane ? 4000 : 6000, t + 0.07);
    g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    s.connect(f); f.connect(g); g.connect(this.sfx); s.start(t, Math.random()); s.stop(t + 0.1);
    this.tone(t, 'sine', lane ? 180 : 320, lane ? 60 : 120, 0.32, 0.1, this.sfx);
    if (grade === 'P') { this.tone(t, 'triangle', 2637, 2637, 0.05, 0.15, this.sfx).connect(this.revIn); }
  },
  whiff() { if (!this.ctx) return; this.nz(this.ctx.currentTime, 'bandpass', 2400, 1.2, 0.06, 0.05, this.sfx); },
  miss() {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    this.tone(t, 'square', 140, 55, 0.08, 0.22, this.sfx);
    this.nz(t, 'lowpass', 600, 1, 0.25, 0.12, this.sfx);
  },
  tick() { if (!this.ctx) return; this.tone(this.ctx.currentTime, 'sine', 2600, 2600, 0.025, 0.03, this.sfx); },
  heart() {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    [1046, 1318, 1568].forEach((f, i) => this.tone(t + i * 0.06, 'triangle', f, f, 0.12, 0.25, this.sfx));
  },
  fever() {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    this.tone(t, 'sawtooth', 220, 1760, 0.08, 0.5, this.sfx, 0.45);
    [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(t + i * 0.05, 'square', f, f, 0.05, 0.2, this.sfx));
  },
  combo() {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    [784, 988, 1318].forEach((f, i) => this.tone(t + i * 0.045, 'square', f, f, 0.045, 0.14, this.sfx));
  },
  ui(kind = 'move') {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    if (kind === 'move') this.tone(t, 'triangle', 1320, 1320, 0.06, 0.05, this.sfx);
    else if (kind === 'ok') { this.tone(t, 'triangle', 988, 988, 0.08, 0.1, this.sfx); this.tone(t + 0.05, 'triangle', 1480, 1480, 0.07, 0.25, this.sfx).connect(this.revIn); }
    else if (kind === 'back') { this.tone(t, 'triangle', 740, 520, 0.07, 0.12, this.sfx); }
    else if (kind === 'buy') { [1318, 1760].forEach((f, i) => this.tone(t + i * 0.07, 'square', f, f, 0.04, 0.2, this.sfx)); }
    else if (kind === 'no') { this.tone(t, 'square', 200, 160, 0.06, 0.15, this.sfx); }
    else if (kind === 'text') { this.tone(t, 'triangle', 880 + Math.random() * 80, 880, 0.02, 0.025, this.sfx); }
    else if (kind === 'open') { this.nz(t, 'bandpass', 1800, 1, 0.08, 0.12, this.sfx); this.tone(t, 'sine', 520, 780, 0.05, 0.12, this.sfx); }
  },
  levelup() {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    [[523, 0], [659, 0.08], [784, 0.16], [1046, 0.24], [784, 0.36], [1046, 0.44], [1318, 0.52]].forEach(([f, d]) => {
      this.tone(t + d, 'square', f, f, 0.05, d > 0.5 ? 0.8 : 0.12, this.sfx).connect(this.revIn);
      this.tone(t + d, 'triangle', f * 2, f * 2, 0.03, 0.2, this.sfx);
    });
  },
  coin() { if (!this.ctx) return; const t = this.ctx.currentTime; this.tone(t, 'square', 1975, 1975, 0.025, 0.05, this.sfx); this.tone(t + 0.04, 'square', 2637, 2637, 0.025, 0.12, this.sfx); },
  bossHit() { if (!this.ctx) return; const t = this.ctx.currentTime; this.tone(t, 'sine', 120, 50, 0.3, 0.15, this.sfx); this.nz(t, 'lowpass', 1500, 1, 0.2, 0.08, this.sfx); },
  warning() {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    for (let i = 0; i < 4; i++) this.tone(t + i * 0.22, 'sawtooth', i % 2 ? 330 : 440, i % 2 ? 330 : 440, 0.05, 0.18, this.sfx);
  },
  explode() {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    this.nz(t, 'lowpass', 900, 0.8, 0.6, 1.3, this.sfx).connect(this.revIn);
    this.tone(t, 'sine', 90, 28, 0.6, 0.9, this.sfx);
  },
  clear() {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    [[523, 0], [659, 0.1], [784, 0.2], [1046, 0.3], [1318, 0.45]].forEach(([f, d]) => {
      this.tone(t + d, 'square', f, f, 0.06, d > 0.4 ? 0.6 : 0.15, this.sfx).connect(this.dlyIn);
    });
  },
  fail() {
    if (!this.ctx) return; const t = this.ctx.currentTime;
    [[392, 0], [330, 0.18], [262, 0.36], [196, 0.54]].forEach(([f, d]) => this.tone(t + d, 'square', f, f * 0.98, 0.06, 0.3, this.sfx));
  },
};

/* 순서기: 미리 만든 음표 목록을 시간에 맞춰 조금씩 앞서 예약해요 */
class Sequencer {
  constructor() { this.timer = null; this.ch = null; }
  play(events, start, loopLen = 0, vol = 1) {
    this.stop();
    this.bgmKey = null;
    if (!AE.ctx) return;
    const c = AE.ctx, out = c.createGain(), pad = c.createGain();
    out.gain.setValueAtTime(0, c.currentTime);
    out.gain.linearRampToValueAtTime(vol, Math.max(c.currentTime + 0.05, start));
    out.connect(AE.music); pad.connect(out);
    this.ch = { out, pad };
    this.ev = events; this.i = 0; this.start = start; this.loop = loopLen; this.n = 0;
    this.timer = setInterval(() => this.tick(), 20);
    this.tick();
  }
  tick() {
    if (!this.ch) return;
    const now = AE.ctx.currentTime, horizon = now + 0.2;
    for (let guard = 0; guard < 400; guard++) {
      if (this.i >= this.ev.length) {
        if (this.loop > 0 && this.ev.length) { this.i = 0; this.n++; } else break;
      }
      const e = this.ev[this.i], t = this.start + e.t + this.n * this.loop;
      if (t > horizon) break;
      if (t >= now - 0.03) AE[e.f](this.ch, Math.max(t, now), ...e.a);
      this.i++;
    }
  }
  stop(fade = 0.15) {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    if (this.ch && AE.ctx) {
      const out = this.ch.out, t = AE.ctx.currentTime;
      out.gain.cancelScheduledValues(t); out.gain.setValueAtTime(out.gain.value, t);
      out.gain.linearRampToValueAtTime(0, t + fade);
      setTimeout(() => { try { out.disconnect(); } catch (e) { /* 이미 끊김 */ } }, fade * 1000 + 600);
    }
    this.ch = null;
  }
}
const SEQ = new Sequencer();
