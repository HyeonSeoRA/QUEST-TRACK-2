'use strict';
/*
 * 박자 시계 + 노트 악보 + 신시사이저 (소리 파일 없이 Web Audio 로 그 자리에서 만든다).
 * 화면의 노트와 스피커의 멜로디가 같은 악보에서 나오기 때문에 박자가 정확히 맞는다.
 */

/* ---------- 박자 <-> 시간 (BPM 이 바뀌어도 맞게 구간으로 기록) ---------- */
class Conductor {
  constructor(bpm) { this.segs = [{ bar: 0, sec: 0, bpm, prog: 0, intensity: 0 }]; }
  segForBeat(beat) {
    let s = this.segs[0];
    for (const x of this.segs) { if (x.bar * 4 <= beat) s = x; else break; }
    return s;
  }
  secOfBeat(beat) { const s = this.segForBeat(beat); return s.sec + (beat - s.bar * 4) * 60 / s.bpm; }
  beatOfSec(sec) {
    let s = this.segs[0];
    for (const x of this.segs) { if (x.sec <= sec) s = x; else break; }
    return s.bar * 4 + (sec - s.sec) * s.bpm / 60;
  }
  segAtBar(bar) { return this.segForBeat(bar * 4); }
  /** bar 번째 마디부터 새 BPM · 코드 진행 · 세기 */
  change(bar, bpm, prog, intensity) {
    while (this.segs.length > 1 && this.segs[this.segs.length - 1].bar >= bar) this.segs.pop();
    const sec = this.secOfBeat(bar * 4);
    this.segs.push({ bar, sec, bpm, prog, intensity });
    while (this.segs.length > 8) this.segs.shift();
  }
}

/* ---------- 코드 진행과 노트 악보 ---------- */
const Chart = {
  // {음이름(0=C), 장조1/단조0} x 4마디
  PROGS: [
    [[9, 0], [5, 1], [2, 0], [4, 1]],   // Am F Dm E
    [[0, 0], [8, 1], [5, 0], [7, 1]],   // Cm Ab Fm G
    [[4, 0], [0, 1], [9, 0], [11, 1]],  // Em C Am B
    [[2, 0], [10, 1], [7, 0], [9, 1]],  // Dm Bb Gm A
  ],
  chord(prog, bar) { const p = this.PROGS[((prog % 4) + 4) % 4]; return p[((bar % 4) + 4) % 4]; },
  /** 줄(0~3) 의 멜로디 음. 오른쪽 줄일수록 높은 음 */
  leadNote(prog, bar, lane) {
    const [pc, maj] = this.chord(prog, bar);
    let root = 60 + pc; if (root > 66) root -= 12;
    return root + 12 + [0, maj ? 4 : 3, 7, 12][lane];
  },
  bassNote(prog, bar) { return 36 + this.chord(prog, bar)[0]; },
  padNotes(prog, bar) {
    const [pc, maj] = this.chord(prog, bar);
    let root = 48 + pc; if (root > 54) root -= 12;
    return [root + 12, root + 12 + (maj ? 4 : 3), root + 19];
  },
  hz: m => 440 * Math.pow(2, (m - 69) / 12),

  /** 한 마디의 노트: [step(0~15), lane] 목록. 같은 씨앗이면 항상 같은 악보 */
  notes(spec, bar) {
    if (!spec || bar < spec.startBar) return [];
    const r = bar - spec.startBar, d = spec.level;
    const rnd = rng(spec.seed * 1000003 + bar * 7919);
    const out = [];
    let lane = Math.floor(rnd() * 4), same = 0;
    const fill = r % 4 === 3 && d >= 1.5, fillUp = rnd() < .5;
    const busy = [-1, -1, -1, -1];   // 롱노트가 끝나는 칸 (그 전까지 그 줄은 비움)
    for (let s = 0; s < 16; s++) {
      if (r === 0 && s < 8) continue;               // 첫 마디 앞부분은 준비 시간
      let p;
      if (s % 4 === 0) p = Math.min(.95, .72 + .05 * d);
      else if (s % 2 === 0) p = Math.min(.72, .16 + .09 * d);
      else p = d < 2.5 ? 0 : Math.min(.28, .05 * (d - 2));
      if (s === 0 && r % 4 === 0) p = 1;
      const inFill = fill && s >= 12 && (d >= 3 || s % 2 === 0);
      if (inFill) p = 1;
      if (rnd() >= p) continue;
      let next;
      if (inFill) next = fillUp ? s - 12 : 15 - s;
      else if (rnd() < .6) {
        let st = rnd() < .5 ? 1 : -1;
        if (rnd() < .3) st *= 2;
        next = lane + st;
        if (next < 0 || next > 3) next = lane - st;
        next = clamp(next, 0, 3);
      } else next = Math.floor(rnd() * 4);
      if (next === lane) same++; else same = 0;
      if (same >= 2) { next = (lane + 1 + Math.floor(rnd() * 3)) % 4; same = 0; }
      // 롱노트를 누르고 있는 줄은 피한다
      if (busy[next] >= s) {
        const free = [0, 1, 2, 3].filter(l => busy[l] < s);
        if (!free.length) continue;
        next = free[Math.floor(rnd() * free.length)];
      }
      lane = next;
      // 롱노트: 정박에서, 마디 안에 끝나도록 1박 또는 2박 길이
      let len = 0;
      if (!inFill && s % 4 === 0 && s <= 11 && d >= .8 && rnd() < Math.min(.22, .05 + .035 * d)) {
        len = s <= 7 && rnd() < .5 ? 8 : 4;
        busy[lane] = s + len;
      }
      out.push([s, lane, len]);
      if (!len && !inFill && s % 4 === 0 && rnd() < Math.min(.3, .04 + .035 * d)) {
        const other = (lane + 1 + Math.floor(rnd() * 3)) % 4;
        if (busy[other] < s) out.push([s, other, 0]);   // 두 줄 동시 노트
      }
    }
    return out;
  },
};

/* ---------- 소리 엔진 ---------- */
const SFX = { HIT: 1, CRIT: 2, MISS: 3, KILL: 4, PICK: 5, HURT: 6, MOVE: 7, DENY: 8, DRIVE: 9, CLEAR: 10, THUNDER: 11, GONG: 12, COMBO: 13 };

class Sound {
  constructor() {
    this.cond = new Conductor(96);
    this.ctx = null;
    this.audioOffset = 0;
    this.perfBase = performance.now();
    this.pausedAt = null;
    this.pausedTotal = 0;
    this.nextStep = 0;
    this.lead = null; this.leadFrom = Infinity; this.leadTo = Infinity;
    this.volume = 0.8; this.music = 1;
    this.lastSong = 0;
    setInterval(() => this.tick(), 25);
  }

  /** 첫 클릭/키 입력 때 소리 장치를 켠다 (브라우저 규칙) */
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended' && this.pausedAt === null) this.ctx.resume(); return; }
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
      const before = this.now();
      this.ctx = ctx;
      this.audioOffset = ctx.currentTime - before;
      this.build();
      ctx.resume();
    } catch (e) { this.ctx = null; }
  }

  build() {
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = .003; comp.release.value = .2;
    this.master.connect(comp).connect(ctx.destination);
    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = this.music;
    this.musicBus.connect(this.master);
    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = .8;
    this.sfxBus.connect(this.master);
    // 우주 같은 잔향
    const len = Math.floor(ctx.sampleRate * 2), ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = ir;
    const wet = ctx.createGain(); wet.gain.value = .4;
    this.reverb.connect(wet).connect(this.master);
    // 멜로디 메아리
    this.delay = ctx.createDelay(2);
    this.delay.delayTime.value = .45;
    const fb = ctx.createGain(); fb.gain.value = .36;
    const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 2600;
    this.delay.connect(dlp).connect(fb).connect(this.delay);
    const dOut = ctx.createGain(); dOut.gain.value = .45;
    dlp.connect(dOut).connect(this.musicBus);
    // 베이스를 거칠게 일그러뜨리는 장치
    this.dist = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; curve[i] = Math.tanh(x * 3.2); }
    this.dist.curve = curve;
    this.dist.oversample = '2x';
    const dg = ctx.createGain(); dg.gain.value = .45;
    this.dist.connect(dg).connect(this.musicBus);
    // 소음 재료
    const nb = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), nd = nb.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    this.noiseBuf = nb;
  }

  setVolume(v) { this.volume = v; if (this.master) this.master.gain.value = v; }
  setMusic(v) { this.music = v; if (this.musicBus) this.musicBus.gain.value = v; }

  /** 지금 "들리고 있는" 노래 시간(초) */
  now() {
    let t;
    if (this.ctx) {
      const ts = this.ctx.getOutputTimestamp ? this.ctx.getOutputTimestamp() : null;
      if (ts && ts.contextTime > 0 && this.ctx.state === 'running') {
        t = ts.contextTime + Math.min(.05, Math.max(0, (performance.now() - ts.performanceTime) / 1000));
      } else {
        t = this.ctx.currentTime - (this.ctx.outputLatency || this.ctx.baseLatency || 0);
      }
      t -= this.audioOffset;
    } else {
      const p = this.pausedAt !== null ? this.pausedAt : performance.now();
      t = (p - this.perfBase - this.pausedTotal) / 1000;
    }
    if (t < this.lastSong) t = this.lastSong;   // 시간은 앞으로만
    this.lastSong = t;
    return t;
  }
  /** 키를 누른 그 순간의 노래 시간 (이벤트가 처리되기까지의 지연을 빼 줌) */
  timeAt(eventStamp) {
    const lag = Math.max(0, Math.min(.05, (performance.now() - eventStamp) / 1000));
    return this.now() - lag;
  }

  pause(on) {
    if (on) {
      if (this.pausedAt !== null) return;
      this.pausedAt = performance.now();
      if (this.ctx) this.ctx.suspend();
    } else {
      if (this.pausedAt === null) return;
      this.pausedTotal += performance.now() - this.pausedAt;
      this.pausedAt = null;
      if (this.ctx) this.ctx.resume();
    }
  }

  /** 소리를 미리 만들어 둔 마디 번호 (화면보다 조금 앞섬) */
  renderedBar() { return Math.floor(this.nextStep / 16); }
  setLead(spec, from, to) { this.lead = spec; this.leadFrom = from; this.leadTo = to; }
  stopLead() { this.leadTo = Math.min(this.leadTo, this.renderedBar() + 1); }
  menuMusic() {
    this.setLead(null, Infinity, Infinity);
    this.cond.change(this.renderedBar() + 1, 84, 0, 0);
  }

  /** 0.15초 앞까지 16분음표 단위로 소리를 예약한다 */
  tick() {
    if (this.pausedAt !== null) return;
    const now = this.now();
    let guard = 0;
    while (this.cond.secOfBeat(this.nextStep / 4) < now + .15 && guard++ < 64) {
      const songT = this.cond.secOfBeat(this.nextStep / 4);
      if (this.ctx && this.ctx.state === 'running' && songT >= now - .02) {
        this.step(this.nextStep, songT + this.audioOffset);
      }
      this.nextStep++;
    }
  }

  step(st, t) {
    const bar = Math.floor(st / 16), s = st % 16;
    const seg = this.cond.segAtBar(bar), prog = seg.prog, inten = seg.intensity, beat = 60 / seg.bpm;
    this.delay.delayTime.setValueAtTime(Math.min(1.9, beat * .75), t);
    const fight = bar >= this.leadFrom && bar < this.leadTo;

    const root = Chart.hz(Chart.bassNote(prog, bar));
    // 심벌 + 큰북: 8마디마다 웅장하게
    if (s === 0 && fight && (bar - this.leadFrom) % 8 === 0) { this.crash(t, .35); this.taiko(t, 1); }
    // 팀파니: 마디의 첫 박 (전투 중엔 셋째 박도)
    if (s === 0) this.timpani(t, root, fight ? .9 : .6);
    if (s === 8 && (fight || inten >= 2)) this.timpani(t, root * 1.5, .5);
    // 박자를 잡아 주는 북 (전투 중에만 또렷하게)
    let kick = fight && (s === 0 || s === 8 || (inten >= 1 && (s === 4 || s === 12)));
    if (kick) this.kick(t);
    if (fight && (s === 4 || s === 12)) this.snare(t, inten === 0 ? .35 : .5);
    // 마디 끝 작은북 롤
    if (fight && inten >= 2 && bar % 4 === 3 && s >= 12) this.snare(t, .12 + (s - 12) * .06);
    if (fight && s % 2 === 0) this.hat(t, inten >= 2 ? .14 : .09, false);
    // 첼로 · 콘트라베이스
    if (s % 4 === 0 && (fight || s === 0)) this.bass(t, root * (s % 8 === 4 ? 2 : 1), beat * (fight ? .9 : 3.5));
    // 현악 화음 + 합창 + 금관
    if (s === 0) {
      const fs = Chart.padNotes(prog, bar).map(Chart.hz);
      this.pad(t, fs, beat * 4);
      if (!fight || inten >= 1) this.choir(t, fs, beat * 4);
      if (fight && inten >= 1) this.brass(t, root * 2, beat * 1.4);
    }
    if (fight && inten >= 2 && s === 8 && bar % 2 === 1) this.brass(t, root * 3, beat * .9);
    if (fight) {
      for (const [ns, lane] of this.cachedNotes(bar)) {
        if (ns === s) this.leadTone(t, Chart.hz(Chart.leadNote(prog, bar, lane)));
      }
    } else if (s % 4 === 2 && bar % 2 === 1) {
      this.tickTone(t, Chart.hz(Chart.leadNote(prog, bar, (s >> 2) % 4) + 12));
    }
  }
  cachedNotes(bar) {
    if (this._nb !== bar || this._ns !== this.lead) { this._nb = bar; this._ns = this.lead; this._nn = Chart.notes(this.lead, bar); }
    return this._nn;
  }

  /* ----- 악기 ----- */
  env(t, a, attack, decay, dest) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(a, t + attack);
    g.gain.exponentialRampToValueAtTime(.0008, t + attack + decay);
    g.connect(dest);
    return g;
  }
  osc(type, f, t, dur, dest) {
    const o = this.ctx.createOscillator();
    o.type = type; o.frequency.setValueAtTime(f, t);
    o.connect(dest); o.start(t); o.stop(t + dur + .05);
    return o;
  }
  noise(t, dur, dest) {
    const n = this.ctx.createBufferSource();
    n.buffer = this.noiseBuf;
    n.connect(dest); n.start(t, Math.random() * .5); n.stop(t + dur + .05);
  }
  filt(type, f, q, dest) {
    const b = this.ctx.createBiquadFilter();
    b.type = type; b.frequency.value = f; b.Q.value = q || .7;
    b.connect(dest);
    return b;
  }
  kick(t) {
    const g = this.env(t, 1.15, .002, .55, this.musicBus);
    const o = this.osc('sine', 125, t, .6, g);
    o.frequency.exponentialRampToValueAtTime(36, t + .16);
    this.noise(t, .01, this.env(t, .25, .001, .015, this.filt('highpass', 3000, 1, this.musicBus)));
  }
  snare(t, a) {
    this.noise(t, .2, this.env(t, a * .8, .001, .16, this.filt('bandpass', 1800, .6, this.musicBus)));
    this.osc('triangle', 180, t, .1, this.env(t, a * .4, .001, .08, this.musicBus));
    this.noise(t, .25, this.env(t, a * .25, .001, .25, this.reverb));
  }
  hat(t, a, open) {
    this.noise(t, open ? .3 : .05, this.env(t, a, .001, open ? .28 : .04, this.filt('highpass', 7500, .7, this.musicBus)));
  }
  /** 팀파니: 음정이 있는 큰 북 */
  timpani(t, f, a) {
    while (f > 110) f /= 2;
    const g = this.env(t, a, .004, 1.4, this.musicBus);
    const o = this.osc('sine', f * 1.12, t, 1.5, g);
    o.frequency.exponentialRampToValueAtTime(f, t + .08);
    this.osc('sine', f * 1.5, t, .6, this.env(t, a * .3, .004, .5, this.musicBus));
    this.noise(t, .08, this.env(t, a * .3, .001, .07, this.filt('lowpass', 900, .8, this.musicBus)));
    const send = this.ctx.createGain(); send.gain.value = .5; g.connect(send).connect(this.reverb);
  }
  /** 큰북(타이코): 아주 낮고 묵직한 한 방 */
  taiko(t, a) {
    const g = this.env(t, a, .003, 1.2, this.musicBus);
    const o = this.osc('sine', 90, t, 1.3, g);
    o.frequency.exponentialRampToValueAtTime(42, t + .3);
    this.noise(t, .3, this.env(t, a * .5, .002, .3, this.filt('lowpass', 400, .7, this.musicBus)));
    const send = this.ctx.createGain(); send.gain.value = .8; g.connect(send).connect(this.reverb);
  }
  /** 합창: 톱니파를 '아—' 소리 모양(포먼트) 필터 두 개에 통과시킴 */
  choir(t, fs, dur) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(.05, t + .8);
    g.gain.setValueAtTime(.05, t + dur - .1);
    g.gain.linearRampToValueAtTime(0, t + dur + .8);
    g.connect(this.musicBus);
    const send = this.ctx.createGain(); send.gain.value = 1.2; g.connect(send).connect(this.reverb);
    const f1 = this.filt('bandpass', 750, 5, g), f2 = this.filt('bandpass', 1150, 7, g);
    for (const f of fs) {
      for (const det of [-9, 0, 9]) {
        const o = this.osc('sawtooth', f, t, dur + 1, f1);
        o.connect(f2);
        o.detune.value = det;
      }
    }
  }
  /** 금관: 소리가 열리면서 커지는 굵은 음 */
  brass(t, f, dur) {
    while (f > 300) f /= 2;
    const g = this.env(t, .16, .06, dur, this.musicBus);
    const lp = this.filt('lowpass', 500, 2, g);
    lp.frequency.setValueAtTime(400, t);
    lp.frequency.linearRampToValueAtTime(2200, t + .09);
    lp.frequency.exponentialRampToValueAtTime(700, t + dur);
    for (const [m, det] of [[1, -6], [1, 6], [1.5, 0], [2, 3]]) {
      const o = this.osc('sawtooth', f * m, t, dur + .1, lp);
      o.detune.value = det;
    }
    const send = this.ctx.createGain(); send.gain.value = .5; g.connect(send).connect(this.reverb);
  }
  crash(t, a) {
    const g = this.env(t, a, .002, 1.6, this.filt('highpass', 4200, .5, this.musicBus));
    this.noise(t, 1.7, g);
    this.noise(t, 1, this.env(t, a * .4, .002, .9, this.reverb));
  }
  /** 첼로 · 콘트라베이스: 활로 긋는 듯 천천히 커지는 낮은 현 */
  bass(t, f, dur) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(.32, t + .05);
    g.gain.exponentialRampToValueAtTime(.001, t + dur + .2);
    const lp = this.filt('lowpass', 520, 1.5, g);
    g.connect(this.dist);
    this.osc('sawtooth', f, t, dur + .25, lp);
    const sub = this.osc('sawtooth', f / 2, t, dur + .25, lp);
    sub.detune.value = 5;
  }
  /** 현악 화음: 여러 대의 바이올린처럼 살짝 어긋난 톱니파 + 떨림 */
  pad(t, fs, dur) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(.07, t + .5);
    g.gain.setValueAtTime(.07, t + dur - .1);
    g.gain.linearRampToValueAtTime(0, t + dur + .6);
    const lp = this.filt('lowpass', 1500, .5, g);
    g.connect(this.musicBus);
    const send = this.ctx.createGain(); send.gain.value = .8; g.connect(send).connect(this.reverb);
    const lfo = this.ctx.createOscillator(), depth = this.ctx.createGain();
    lfo.frequency.value = 5.2; depth.gain.value = 6;
    lfo.connect(depth); lfo.start(t); lfo.stop(t + dur + .7);
    this.osc('sawtooth', fs[0] / 2, t, dur + .7, lp).detune.value = -4;
    for (const f of fs) {
      for (const det of [-14, 0, 14]) {
        const o = this.osc('sawtooth', f, t, dur + .7, lp);
        o.detune.value = det;
        depth.connect(o.detune);
      }
    }
  }
  leadTone(t, f) {
    const g = this.env(t, .2, .003, .42, this.musicBus);
    const lp = this.filt('lowpass', 1200, 4, g);
    lp.frequency.setValueAtTime(3200, t);
    lp.frequency.exponentialRampToValueAtTime(700, t + .25);
    const sq = this.osc('square', f, t, .5, lp);
    const sw = this.osc('sawtooth', f * 1.003, t, .5, lp);
    sq.detune.value = -4; sw.detune.value = 4;
    const send = this.ctx.createGain(); send.gain.value = .5; g.connect(send);
    send.connect(this.delay); send.connect(this.reverb);
  }
  tickTone(t, f) {
    const g = this.env(t, .07, .002, .5, this.musicBus);
    this.osc('sine', f, t, .55, g);
    const send = this.ctx.createGain(); send.gain.value = 1; g.connect(send).connect(this.reverb);
  }
  chime(t, f, a, dur = 1.1) {
    const g = this.env(t, a, .002, dur, this.sfxBus);
    this.osc('sine', f, t, dur, g);
    this.osc('sine', f * 2, t, dur * .5, this.env(t, a * .25, .002, dur * .4, this.sfxBus));
    const send = this.ctx.createGain(); send.gain.value = .7; g.connect(send).connect(this.reverb);
  }

  /** 노래 시간 songT 에 딸깍 소리를 예약 (박자 맞추기용) */
  clickAt(songT, accent) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const t = Math.max(this.ctx.currentTime, songT + this.audioOffset);
    this.osc('square', accent ? 1760 : 1320, t, .04, this.env(t, accent ? .3 : .22, .001, .035, this.filt('highpass', 600, .7, this.sfxBus)));
  }

  /** 효과음 */
  play(kind, param = 0) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime + .005;
    switch (kind) {
      case SFX.HIT:
        this.osc('sine', 1320 + param * 220, t, .12, this.env(t, .22, .001, .1, this.sfxBus));
        this.noise(t, .02, this.env(t, .12, .001, .02, this.filt('highpass', 5000, 1, this.sfxBus)));
        break;
      case SFX.CRIT:
        this.chime(t, 1760, .22, .35); this.chime(t, 2637, .14, .3);
        break;
      case SFX.MISS: {
        const o = this.osc('sine', 110, t, .3, this.env(t, .45, .002, .25, this.sfxBus));
        o.frequency.exponentialRampToValueAtTime(45, t + .2);
        break;
      }
      case SFX.HURT: {
        const o = this.osc('sine', 90, t, .35, this.env(t, .7, .002, .3, this.sfxBus));
        o.frequency.exponentialRampToValueAtTime(38, t + .25);
        this.noise(t, .25, this.env(t, .4, .001, .22, this.filt('lowpass', 900, 1, this.sfxBus)));
        break;
      }
      case SFX.KILL: {
        const lp = this.filt('lowpass', 3000, 3, this.env(t, .3, .01, .9, this.sfxBus));
        const o = this.osc('sawtooth', 260, t, 1, lp);
        o.frequency.exponentialRampToValueAtTime(1800, t + .5);
        this.crash(t, .45);
        this.chime(t + .08, 1318.5, .18); this.chime(t + .16, 1975.5, .14);
        break;
      }
      case SFX.PICK: this.chime(t, 1046.5, .25); this.chime(t + .06, 1568, .18); break;
      case SFX.MOVE: this.chime(t, 1318.5, .08, .25); break;
      case SFX.DENY: this.osc('square', 140, t, .15, this.env(t, .12, .002, .12, this.filt('lowpass', 800, 1, this.sfxBus))); break;
      case SFX.DRIVE: {
        const lp = this.filt('lowpass', 4000, 4, this.env(t, .3, .02, 1, this.sfxBus));
        const o = this.osc('sawtooth', 180, t, 1.1, lp);
        o.frequency.exponentialRampToValueAtTime(1400, t + .6);
        [784, 987.8, 1175, 1568].forEach((f, i) => this.chime(t + i * .07, f, .16));
        break;
      }
      case SFX.GONG: {
        // 징: 낮은 울림 + 어긋난 배음이 길게 퍼짐
        for (const [m, a, d] of [[1, .5, 4], [2.4, .22, 3], [3.9, .14, 2.2], [5.6, .08, 1.5]]) {
          const g = this.env(t, a, .005, d, this.sfxBus);
          this.osc('sine', 62 * m, t, d + .2, g);
          const send = this.ctx.createGain(); send.gain.value = .9; g.connect(send).connect(this.reverb);
        }
        this.taiko(t, 1.1);
        this.noise(t, .4, this.env(t, .3, .002, .35, this.filt('lowpass', 1200, .7, this.sfxBus)));
        break;
      }
      case SFX.COMBO:
        [523.3, 659.3, 784, 1046.5].forEach((f, i) => this.chime(t + i * .05, f, .16, 1.2));
        this.brass(t, 196, .8);
        break;
      case SFX.THUNDER: {
        const lp = this.filt('lowpass', 500, .8, this.env(t, .7, .01, 1.8, this.sfxBus));
        this.noise(t, 2, lp);
        this.noise(t, .3, this.env(t, .4, .001, .25, this.filt('highpass', 2000, .7, this.sfxBus)));
        break;
      }
      case SFX.CLEAR:
        [784, 987.8, 1175, 1568, 1975.5].forEach((f, i) => this.chime(t + i * .09, f, .2, 1.4));
        this.crash(t, .4);
        break;
    }
  }
}
