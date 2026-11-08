'use strict';
// 소리: Web Audio 로 그 자리에서 만든다 (소리 파일 없음)

const Sound = (() => {
  const S = { volume: 0.8 };
  let ctx = null, master, sfxBus, ambBus, revIn, noiseBuf;
  const listener = { x: 0, z: 0, yaw: 0 };
  const amb = {};

  function impulse(sec, decay) {
    const len = Math.floor(ctx.sampleRate * sec);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  S.init = () => {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = S.volume;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 5;
    comp.connect(master); master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.connect(comp);
    ambBus = ctx.createGain(); ambBus.gain.value = 0; ambBus.connect(comp);
    const rev = ctx.createConvolver(); rev.buffer = impulse(3.5, 2.4);
    revIn = ctx.createGain(); revIn.gain.value = 0.6; revIn.connect(rev); rev.connect(comp);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
  };
  S.ready = () => !!ctx;
  S.setVolume = v => { S.volume = v; if (master) master.gain.value = v; };
  S.setListener = (x, z, yaw) => { listener.x = x; listener.z = z; listener.yaw = yaw; };

  // 위치가 있으면 거리만큼 작게, 왼쪽/오른쪽으로 나눠서 들린다
  function route(o) {
    const g = ctx.createGain();
    let att = 1, pan = 0;
    if (o.pos) {
      const dx = o.pos.x - listener.x, dz = o.pos.z - listener.z;
      const dist = Math.hypot(dx, dz);
      att = 1 / (1 + dist * 0.22);
      if (dist > 0.01) pan = (dx * Math.cos(listener.yaw) - dz * Math.sin(listener.yaw)) / dist;
    }
    g.gain.value = att;
    let out = g;
    if (o.pos && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan * 0.85));
      g.connect(p); out = p;
    }
    out.connect(sfxBus);
    if (o.wet !== 0) {
      const w = ctx.createGain(); w.gain.value = o.wet ?? 0.25;
      out.connect(w); w.connect(revIn);
    }
    return g;
  }

  function env(t, o) {
    const e = ctx.createGain();
    const a = o.attack ?? 0.005, v = o.vol ?? 0.3;
    e.gain.setValueAtTime(0.0001, t);
    e.gain.exponentialRampToValueAtTime(v, t + a);
    e.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(a + 0.01, o.dur));
    return e;
  }

  function tone(o) {
    if (!ctx) return;
    const t = ctx.currentTime + (o.at || 0);
    const osc = ctx.createOscillator();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f, t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f2), t + o.dur);
    if (o.detune) osc.detune.value = o.detune;
    if (o.vib) {
      const l = ctx.createOscillator(), lg = ctx.createGain();
      l.frequency.value = o.vib; lg.gain.value = o.vibAmt || o.f * 0.03;
      l.connect(lg); lg.connect(osc.frequency); l.start(t); l.stop(t + o.dur + 0.05);
    }
    const e = env(t, o);
    osc.connect(e);
    let last = e;
    if (o.lp) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; e.connect(f); last = f; }
    if (o.bp) { const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = o.bp; f.Q.value = o.q || 4; last.connect(f); last = f; }
    last.connect(route(o));
    osc.start(t); osc.stop(t + o.dur + 0.05);
  }

  function noise(o) {
    if (!ctx) return;
    const t = ctx.currentTime + (o.at || 0);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf; src.loop = true;
    src.playbackRate.value = o.rate || 1;
    const f = ctx.createBiquadFilter();
    f.type = o.ft || 'bandpass';
    f.frequency.setValueAtTime(o.f || 1000, t);
    if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + o.dur);
    f.Q.value = o.q ?? 1;
    const e = env(t, o);
    src.connect(f); f.connect(e);
    let last = e;
    if (o.am) { // 떨리는 소리 (속삭임)
      const amp = ctx.createGain(); amp.gain.value = 0.5;
      const l = ctx.createOscillator(), lg = ctx.createGain();
      l.frequency.value = o.am; lg.gain.value = 0.5;
      l.connect(lg); lg.connect(amp.gain); l.start(t); l.stop(t + o.dur + 0.05);
      e.connect(amp); last = amp;
    }
    last.connect(route(o));
    src.start(t, Math.random() * 1.5); src.stop(t + o.dur + 0.05);
  }

  // ---------- 효과음 ----------
  S.step = (kind, run) => {
    const f = { wood: 420, hall: 900, tile: 1500 }[kind] || 800;
    const v = run ? 0.16 : 0.09;
    noise({ f: f * (0.85 + Math.random() * 0.3), q: 1.2, dur: 0.09, vol: v, wet: 0.15 });
    tone({ f: 90, f2: 50, dur: 0.07, vol: v * 0.9, wet: 0 });
  };
  S.swing = heavy => noise({ f: 500, f2: heavy ? 1600 : 2600, q: 2, dur: heavy ? 0.28 : 0.18, vol: 0.14, attack: 0.04, wet: 0.05 });
  S.hit = () => {
    tone({ f: 160, f2: 45, dur: 0.2, vol: 0.55, wet: 0.2 });
    noise({ ft: 'lowpass', f: 900, dur: 0.1, vol: 0.35, wet: 0.1 });
  };
  S.ghostHit = pos => {
    tone({ f: 700, f2: 180, dur: 0.25, type: 'sawtooth', lp: 1800, vol: 0.18, pos, wet: 0.4 });
    noise({ ft: 'highpass', f: 2500, dur: 0.15, vol: 0.12, pos });
  };
  S.hurt = () => {
    tone({ f: 200, f2: 90, dur: 0.3, type: 'sawtooth', lp: 700, vol: 0.28, wet: 0.1 });
    noise({ ft: 'lowpass', f: 300, dur: 0.25, vol: 0.5, wet: 0 });
  };
  S.groan = (pos, pitch = 1) => {
    const dur = 1.4 + Math.random();
    tone({ f: 85 * pitch, f2: 62 * pitch, dur, type: 'sawtooth', bp: 520 * pitch, q: 3, vol: 0.35, attack: 0.3, vib: 5, vibAmt: 4, pos, wet: 0.5 });
    tone({ f: 128 * pitch, f2: 90 * pitch, dur, type: 'sawtooth', bp: 900 * pitch, q: 5, vol: 0.14, attack: 0.4, vib: 7, vibAmt: 6, pos, wet: 0.5 });
  };
  S.shriek = pos => {
    noise({ f: 2600, f2: 1100, q: 6, dur: 1.0, vol: 0.5, attack: 0.02, pos, wet: 0.6 });
    tone({ f: 950, f2: 420, dur: 0.9, type: 'sawtooth', bp: 1400, q: 2, vol: 0.25, vib: 13, vibAmt: 40, pos, wet: 0.6 });
    tone({ f: 1330, f2: 610, dur: 0.8, type: 'sawtooth', bp: 2000, q: 2, vol: 0.18, vib: 11, vibAmt: 50, pos, wet: 0.6 });
  };
  S.scream = () => {
    [620, 890, 1210, 1570].forEach((f, i) => tone({ f, f2: f * 0.55, dur: 1.5, type: 'sawtooth', bp: f * 1.4, q: 1.5, vol: 0.32 - i * 0.04, vib: 9 + i * 3, vibAmt: f * 0.05, wet: 0.5 }));
    noise({ f: 2000, f2: 800, q: 1, dur: 1.4, vol: 0.55, wet: 0.5 });
    tone({ f: 70, f2: 30, dur: 0.8, vol: 0.8, wet: 0 });
  };
  S.whisper = (dur = 2) => {
    for (let i = 0; i < 3; i++) {
      const ang = Math.random() * Math.PI * 2;
      noise({ f: 1800 + Math.random() * 2400, q: 4, dur: dur * (0.6 + Math.random() * 0.5), vol: 0.13, attack: 0.3, am: 5 + Math.random() * 7,
        at: i * 0.35, pos: { x: listener.x + Math.cos(ang) * 1.5, z: listener.z + Math.sin(ang) * 1.5 }, wet: 0.5 });
    }
  };
  S.heartbeat = k => {
    tone({ f: 58, f2: 38, dur: 0.14, vol: 0.55 * k, wet: 0 });
    tone({ f: 52, f2: 34, dur: 0.12, vol: 0.38 * k, wet: 0, at: 0.22 });
  };
  // 학교 종 (딩동댕동). 일그러지게 치면 점점 낮아진다
  S.bell = (creepy = true) => {
    const notes = [659.25, 523.25, 587.33, 392, 392, 587.33, 659.25, 523.25];
    notes.forEach((f, i) => {
      const k = creepy ? 1 - i * 0.012 : 1, at = i * (creepy ? 0.95 : 0.7);
      [1, 2.76, 5.4].forEach((m, j) => tone({ f: f * k * m, dur: 2.2 / (j + 1), vol: [0.22, 0.07, 0.03][j], at, wet: 0.9, detune: creepy ? (Math.random() - 0.5) * 30 : 0 }));
    });
  };
  S.piano = (f, at = 0, vol = 0.25, pos) => {
    tone({ f, dur: 1.8, type: 'triangle', vol, at, pos, wet: 0.6 });
    tone({ f: f * 2.001, dur: 0.9, vol: vol * 0.3, at, pos, wet: 0.6 });
    tone({ f: f * 1.006, dur: 1.4, type: 'sine', vol: vol * 0.5, at, pos, wet: 0.6 });
  };
  S.door = pos => {
    noise({ ft: 'lowpass', f: 380, dur: 0.6, vol: 0.4, attack: 0.05, pos, wet: 0.2 });
    noise({ f: 1100, q: 8, dur: 0.5, vol: 0.06, attack: 0.1, pos, am: 18 });
  };
  S.locked = pos => {
    [0, 0.13, 0.26].forEach(at => tone({ f: 110, f2: 70, dur: 0.08, type: 'square', lp: 500, vol: 0.25, at, pos, wet: 0.1 }));
  };
  S.slam = pos => {
    noise({ ft: 'lowpass', f: 500, dur: 0.35, vol: 0.9, pos, wet: 0.6 });
    tone({ f: 70, f2: 35, dur: 0.4, vol: 0.7, pos, wet: 0.4 });
  };
  S.creak = pos => tone({ f: 340, f2: 220, dur: 1.2, type: 'sawtooth', bp: 900, q: 12, vol: 0.12, attack: 0.2, vib: 22, vibAmt: 25, pos, wet: 0.5 });
  S.pickup = () => { tone({ f: 660, dur: 0.18, vol: 0.12 }); tone({ f: 990, dur: 0.3, vol: 0.1, at: 0.08 }); };
  S.levelUp = () => [392, 523, 659, 784].forEach((f, i) => tone({ f, dur: 0.6, type: 'triangle', vol: 0.14, at: i * 0.09, wet: 0.6 }));
  S.save = () => [523, 659, 784].forEach((f, i) => tone({ f, dur: 1.4, vol: 0.09, at: i * 0.15, wet: 0.9 }));
  S.page = () => { noise({ ft: 'highpass', f: 3000, dur: 0.12, vol: 0.12 }); noise({ ft: 'highpass', f: 2500, dur: 0.14, vol: 0.1, at: 0.12 }); };
  S.chairs = pos => {
    for (let i = 0; i < 12; i++) noise({ f: 300 + Math.random() * 700, q: 6, dur: 0.25 + Math.random() * 0.4, vol: 0.18, at: Math.random() * 0.35, am: 30 + Math.random() * 30, pos, wet: 0.5 });
  };
  S.static = (dur = 1, vol = 0.18) => noise({ ft: 'highpass', f: 1600, dur, vol, attack: 0.02, wet: 0.1 });
  S.feedback = () => {
    tone({ f: 2300, f2: 3300, dur: 1.8, vol: 0.18, attack: 0.3, wet: 0.5 });
    tone({ f: 4610, f2: 6500, dur: 1.6, vol: 0.06, attack: 0.4, wet: 0.5 });
  };
  S.knock = (pos, n = 3) => {
    for (let i = 0; i < n; i++) {
      tone({ f: 120, f2: 70, dur: 0.1, vol: 0.5, at: i * 0.32, pos, wet: 0.5 });
      noise({ ft: 'lowpass', f: 700, dur: 0.06, vol: 0.35, at: i * 0.32, pos, wet: 0.4 });
    }
  };
  S.thumps = (n = 8) => { // 천장 위를 뛰어가는 발소리
    for (let i = 0; i < n; i++) noise({ ft: 'lowpass', f: 160, dur: 0.15, vol: 0.5 - i * 0.04, at: i * 0.24, wet: 0.5 });
  };
  S.vibrate = () => { for (let i = 0; i < 3; i++) tone({ f: 150, dur: 0.3, type: 'square', lp: 300, vol: 0.12, at: i * 0.45, wet: 0 }); };
  S.giggle = pos => {
    [880, 990, 840, 950, 800].forEach((f, i) => tone({ f, f2: f * 0.9, dur: 0.12, type: 'triangle', bp: 1500, q: 2, vol: 0.12, at: i * 0.13, vib: 30, vibAmt: 40, pos, wet: 0.8 }));
  };
  S.drip = () => tone({ f: 1400 + Math.random() * 500, f2: 600, dur: 0.12, vol: 0.06, wet: 0.9 });
  S.boom = () => { tone({ f: 55, f2: 25, dur: 2, vol: 0.8, wet: 0.6 }); noise({ ft: 'lowpass', f: 200, dur: 1.5, vol: 0.6, wet: 0.6 }); };
  S.salt = () => noise({ ft: 'highpass', f: 4000, dur: 0.4, vol: 0.25, wet: 0.3, am: 40 });
  S.flash = on => tone({ f: on ? 1800 : 1400, dur: 0.04, type: 'square', lp: 3000, vol: 0.05, wet: 0 });
  S.die = pos => {
    tone({ f: 400, f2: 60, dur: 1.4, type: 'sawtooth', bp: 600, q: 2, vol: 0.3, vib: 8, vibAmt: 30, pos, wet: 0.8 });
    noise({ f: 1500, f2: 200, q: 2, dur: 1.2, vol: 0.25, pos, wet: 0.7 });
  };
  S.sting = () => { // 무언가를 들킨 순간의 불협화음
    [146.8, 155.6, 207.7, 311.1].forEach(f => tone({ f, dur: 2.4, type: 'sawtooth', lp: 1200, vol: 0.09, attack: 0.02, wet: 0.7 }));
  };

  // ---------- 배경음 ----------
  S.startAmbient = () => {
    if (!ctx || amb.on) return;
    amb.on = true;
    const t = ctx.currentTime;
    ambBus.gain.setTargetAtTime(1, t, 2);
    // 낮은 웅웅거림
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 200; lp.Q.value = 3;
    const dg = ctx.createGain(); dg.gain.value = 0.05;
    [55, 55.35, 82.4, 110.7].forEach(f => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(lp); o.start(); });
    const lfo = ctx.createOscillator(), lfoG = ctx.createGain();
    lfo.frequency.value = 0.07; lfoG.gain.value = 90; lfo.connect(lfoG); lfoG.connect(lp.frequency); lfo.start();
    lp.connect(dg); dg.connect(ambBus);
    // 바람 + 빗소리
    const wind = ctx.createBufferSource(); wind.buffer = noiseBuf; wind.loop = true;
    const wf = ctx.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 380; wf.Q.value = 0.7;
    const wg = ctx.createGain(); wg.gain.value = 0.045;
    const wl = ctx.createOscillator(), wlg = ctx.createGain(); wl.frequency.value = 0.11; wlg.gain.value = 0.035;
    wl.connect(wlg); wlg.connect(wg.gain); wl.start();
    wind.connect(wf); wf.connect(wg); wg.connect(ambBus); wind.start();
    const rain = ctx.createBufferSource(); rain.buffer = noiseBuf; rain.loop = true; rain.playbackRate.value = 0.7;
    const rf = ctx.createBiquadFilter(); rf.type = 'highpass'; rf.frequency.value = 2500;
    const rg = ctx.createGain(); rg.gain.value = 0.02;
    rain.connect(rf); rf.connect(rg); rg.connect(ambBus); rain.start(0.3);
    amb.rain = rg;
    // 긴장 (쫓길 때 커지는 불협화음)
    const tg = ctx.createGain(); tg.gain.value = 0;
    const tf = ctx.createBiquadFilter(); tf.type = 'lowpass'; tf.frequency.value = 700;
    [233.1, 246.9, 349.2, 370].forEach(f => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = Math.random() * 20; o.connect(tf); o.start(); });
    tf.connect(tg); tg.connect(ambBus);
    amb.tension = tg;
  };
  S.setTension = v => { if (amb.tension) amb.tension.gain.setTargetAtTime(Math.min(1, v) * 0.05, ctx.currentTime, 0.6); };
  S.setRain = v => { if (amb.rain) amb.rain.gain.setTargetAtTime(v * 0.02, ctx.currentTime, 1); };

  // 낮고 느린 목소리 (컴퓨터에 한국어 음성이 있을 때만)
  S.speak = (text, pitch = 0.1, rate = 0.7) => {
    try {
      if (!window.speechSynthesis) return;
      const voices = speechSynthesis.getVoices();
      const ko = voices.find(v => v.lang && v.lang.toLowerCase().startsWith('ko'));
      if (!ko) return;
      const u = new SpeechSynthesisUtterance(text);
      u.voice = ko; u.lang = 'ko-KR'; u.pitch = pitch; u.rate = rate; u.volume = Math.min(1, S.volume * 0.9);
      speechSynthesis.speak(u);
    } catch (e) { /* 목소리 없음 */ }
  };
  if (window.speechSynthesis) speechSynthesis.getVoices();

  return S;
})();
