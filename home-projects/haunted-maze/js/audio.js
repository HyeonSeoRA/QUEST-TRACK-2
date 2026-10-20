'use strict';
// 모든 소리는 Web Audio 로 그 자리에서 만든다 (소리 파일 없음)

const SFX = (() => {
  let ctx = null, master = null, noiseBuf = null, muted = false;
  let amb = null; // 지금 깔려 있는 배경음

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12; comp.ratio.value = 5;
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.9;
    master.connect(comp); comp.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const ok = () => ctx && ctx.state === 'running';

  function out(vol = 1, pan = 0) {
    const g = ctx.createGain();
    g.gain.value = vol;
    if (pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = U.clamp(pan, -1, 1);
      g.connect(p); p.connect(master);
    } else g.connect(master);
    return g;
  }
  function noise(t, dur) {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf; s.loop = true;
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
    return s;
  }
  function osc(type, f, t, dur) {
    const o = ctx.createOscillator();
    o.type = type; o.frequency.setValueAtTime(f, t);
    o.start(t); o.stop(t + dur + 0.05);
    return o;
  }
  function filt(type, f, q = 1) {
    const b = ctx.createBiquadFilter();
    b.type = type; b.frequency.value = f; b.Q.value = q;
    return b;
  }
  function envGain(t, a, peak, dur) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    return g;
  }
  let curve = null;
  function shaper() {
    if (!curve) {
      curve = new Float32Array(1024);
      for (let i = 0; i < 1024; i++) { const x = i / 512 - 1; curve[i] = Math.tanh(x * 6); }
    }
    const w = ctx.createWaveShaper(); w.curve = curve;
    return w;
  }

  // ---------- 효과음 ----------
  function scream(power = 1) {
    if (!ok()) return;
    const t = ctx.currentTime, dur = 1.5;
    const sh = shaper(), bp = filt('bandpass', 2300, 0.6), g = envGain(t, 0.012, 0.32 * power, dur);
    sh.connect(bp); bp.connect(g); g.connect(out(1));
    for (let i = 0; i < 5; i++) {
      const o = osc('sawtooth', 420 + i * 90, t, dur);
      o.frequency.exponentialRampToValueAtTime(1150 + i * 160, t + 0.12);
      o.frequency.linearRampToValueAtTime(760 + i * 110, t + dur);
      const lfo = osc('sine', 26 + i * 3.3, t, dur), lg = ctx.createGain();
      lg.gain.value = 70; lfo.connect(lg); lg.connect(o.frequency);
      o.connect(sh);
    }
    const n = noise(t, dur), nb = filt('bandpass', 3200, 0.8), ng = envGain(t, 0.008, 0.55 * power, dur * 0.9);
    n.connect(nb); nb.connect(ng); ng.connect(out(1));
    const b = osc('sine', 110, t, 0.8), bg = envGain(t, 0.005, 0.9 * power, 0.8);
    b.frequency.exponentialRampToValueAtTime(32, t + 0.7);
    b.connect(bg); bg.connect(out(1));
  }

  function stinger(power = 1) {
    if (!ok()) return;
    const t = ctx.currentTime, dur = 2.4;
    const lp = filt('lowpass', 9000, 0.7);
    lp.frequency.setValueAtTime(9000, t);
    lp.frequency.exponentialRampToValueAtTime(500, t + dur);
    const g = envGain(t, 0.006, 0.2 * power, dur);
    lp.connect(g); g.connect(out(1));
    [55, 58.27, 82.41, 110, 116.54, 164.81, 233.08, 349.23, 466.16, 698.46].forEach((f, i) => {
      const o = osc(i % 2 ? 'square' : 'sawtooth', f * (1 + (Math.random() - 0.5) * 0.01), t, dur);
      o.connect(lp);
    });
    const n = noise(t, 0.6), hp = filt('highpass', 2500), ng = envGain(t, 0.003, 0.4 * power, 0.6);
    n.connect(hp); hp.connect(ng); ng.connect(out(1));
  }

  function heartbeat(vol = 0.5) {
    if (!ok()) return;
    const t = ctx.currentTime;
    [0, 0.17].forEach((dt, i) => {
      const o = osc('sine', 72, t + dt, 0.2);
      o.frequency.exponentialRampToValueAtTime(38, t + dt + 0.16);
      const g = envGain(t + dt, 0.01, vol * (i ? 0.7 : 1), t + dt + 0.2 - t - dt);
      o.connect(g); g.connect(out(1));
    });
  }

  function footstep(vol = 0.15, pan = 0, low = 1) {
    if (!ok()) return;
    const t = ctx.currentTime;
    const n = noise(t, 0.09), lp = filt('lowpass', 520 * low), g = envGain(t, 0.004, vol, 0.09);
    n.connect(lp); lp.connect(g); g.connect(out(1, pan));
    const o = osc('sine', 130 * low, t, 0.1), og = envGain(t, 0.004, vol * 0.8, 0.1);
    o.frequency.exponentialRampToValueAtTime(55, t + 0.09);
    o.connect(og); og.connect(out(1, pan));
  }

  function whoosh(fromPan = -1, toPan = 1) {
    if (!ok()) return;
    const t = ctx.currentTime, dur = 0.55;
    const n = noise(t, dur), bp = filt('bandpass', 400, 1.2);
    bp.frequency.setValueAtTime(350, t);
    bp.frequency.exponentialRampToValueAtTime(2600, t + dur * 0.45);
    bp.frequency.exponentialRampToValueAtTime(500, t + dur);
    const g = envGain(t, dur * 0.4, 0.6, dur);
    n.connect(bp); bp.connect(g);
    if (ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.setValueAtTime(fromPan, t); p.pan.linearRampToValueAtTime(toPan, t + dur);
      g.connect(p); p.connect(master);
    } else g.connect(master);
  }

  function whisper(dur = 1.6, pan = 0, vol = 0.35) {
    if (!ok()) return;
    const t = ctx.currentTime;
    const n = noise(t, dur), g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    const fs = [filt('bandpass', 800, 7), filt('bandpass', 1400, 9), filt('bandpass', 2700, 9)];
    for (let k = 0; k < dur; k += 0.09) {
      g.gain.linearRampToValueAtTime(Math.random() < 0.3 ? 0.02 : vol * (0.4 + Math.random() * 0.6), t + k);
      if (Math.random() < 0.5) fs.forEach((f, i) => f.frequency.setValueAtTime([500, 1100, 2400][i] * (0.7 + Math.random() * 0.7), t + k));
    }
    g.gain.linearRampToValueAtTime(0, t + dur);
    const o = out(1, pan);
    fs.forEach(f => { n.connect(f); f.connect(g); });
    const hp = filt('highpass', 5500); n.connect(hp); hp.connect(g);
    g.connect(o);
  }

  function bang(vol = 0.8, pan = 0) {
    if (!ok()) return;
    const t = ctx.currentTime;
    const n = noise(t, 0.35), lp = filt('lowpass', 420), g = envGain(t, 0.003, vol, 0.35);
    n.connect(lp); lp.connect(g); g.connect(out(1, pan));
    const o = osc('sine', 75, t, 0.45), og = envGain(t, 0.003, vol, 0.45);
    o.frequency.exponentialRampToValueAtTime(30, t + 0.4);
    o.connect(og); og.connect(out(1, pan));
  }

  function creak(dur = 1.2, vol = 0.25) {
    if (!ok()) return;
    const t = ctx.currentTime;
    const o = osc('sawtooth', 90, t, dur);
    for (let k = 0; k < dur; k += 0.025) o.frequency.setValueAtTime(85 + (k / dur) * 70 + Math.random() * 25, t + k);
    const bp = filt('bandpass', 1000, 5), g = envGain(t, 0.15, vol, dur);
    o.connect(bp); bp.connect(g); g.connect(out(1));
  }

  function pickup() {
    if (!ok()) return;
    const t = ctx.currentTime;
    [1318.5, 1244.5, 987.8, 739.99, 698.46].forEach((f, i) => {
      const s = t + i * 0.16;
      const o = osc('sine', f * 0.985, s, 1.2), o2 = osc('sine', f * 3.01, s, 0.5);
      const g = envGain(s, 0.004, 0.14, 1.2), g2 = envGain(s, 0.003, 0.03, 0.4);
      o.connect(g); g.connect(out(1)); o2.connect(g2); g2.connect(out(1));
    });
  }

  function thunder() {
    if (!ok()) return;
    const t = ctx.currentTime + 0.4 + Math.random() * 0.8, dur = 3.5;
    const n = noise(t, dur), lp = filt('lowpass', 260), g = envGain(t, 0.08, 0.5, dur);
    lp.frequency.setValueAtTime(600, t); lp.frequency.exponentialRampToValueAtTime(120, t + dur);
    n.connect(lp); lp.connect(g); g.connect(out(1));
  }

  function moan(pan = 0, vol = 0.12) {
    if (!ok()) return;
    const t = ctx.currentTime, dur = 1.8;
    const o = osc('sawtooth', 160, t, dur);
    o.frequency.linearRampToValueAtTime(120, t + dur);
    const f1 = filt('bandpass', 600, 8), f2 = filt('bandpass', 1000, 8), g = envGain(t, 0.5, vol, dur);
    o.connect(f1); o.connect(f2); f1.connect(g); f2.connect(g); g.connect(out(1, pan));
  }

  function static_(dur = 0.4, vol = 0.25) {
    if (!ok()) return;
    const t = ctx.currentTime;
    const n = noise(t, dur), hp = filt('highpass', 1200), g = envGain(t, 0.005, vol, dur);
    n.connect(hp); hp.connect(g); g.connect(out(1));
  }

  // ---------- 단계별 배경음 ----------
  function ambient(stage) {
    stopAmbient();
    if (!ctx) return;
    const t = ctx.currentTime;
    const bus = ctx.createGain();
    bus.gain.setValueAtTime(0.0001, t);
    bus.gain.exponentialRampToValueAtTime(1, t + 2);
    bus.connect(master);
    const nodes = [];
    const keep = n => { nodes.push(n); return n; };

    // 깊은 저음
    const lp = keep(filt('lowpass', 380));
    const dg = ctx.createGain(); dg.gain.value = [0.05, 0.07, 0.09][stage];
    lp.connect(dg); dg.connect(bus);
    const freqs = [[55, 55.4, 82.4], [55, 58.27, 87.3], [41.2, 43.65, 61.7, 65.4]][stage];
    freqs.forEach(f => { const o = keep(ctx.createOscillator()); o.type = 'triangle'; o.frequency.value = f; o.connect(lp); o.start(); });
    const lfo = keep(ctx.createOscillator()), lfg = ctx.createGain();
    lfo.frequency.value = 0.08; lfg.gain.value = 180; lfo.connect(lfg); lfg.connect(lp.frequency); lfo.start();

    // 바람
    const wind = keep(ctx.createBufferSource()); wind.buffer = noiseBuf; wind.loop = true;
    const wbp = filt('bandpass', 450, 0.7), wg = ctx.createGain(); wg.gain.value = 0.06;
    const wl = keep(ctx.createOscillator()), wlg = ctx.createGain();
    wl.frequency.value = 0.06; wlg.gain.value = 280; wl.connect(wlg); wlg.connect(wbp.frequency); wl.start();
    wind.connect(wbp); wbp.connect(wg); wg.connect(bus); wind.start();

    let buzzGain = null;
    if (stage === 1) {
      // 깜빡이는 형광등 소리
      const b = keep(ctx.createOscillator()); b.type = 'sawtooth'; b.frequency.value = 120;
      const bf = filt('bandpass', 1800, 2); buzzGain = ctx.createGain(); buzzGain.gain.value = 0.012;
      b.connect(bf); bf.connect(buzzGain); buzzGain.connect(bus); b.start();
    }
    if (stage === 2) {
      // 웅얼거리는 합창
      const f1 = filt('bandpass', 780, 9), f2 = filt('bandpass', 1150, 9), cg = ctx.createGain();
      cg.gain.value = 0.05;
      [110, 130.8, 155.6, 164.8].forEach(f => {
        const o = keep(ctx.createOscillator()); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = (Math.random() - 0.5) * 30;
        o.connect(f1); o.connect(f2); o.start();
      });
      f1.connect(cg); f2.connect(cg); cg.connect(bus);
    }

    // 1단계: 고장 난 오르골
    const melody = [659.3, 587.3, 523.3, 493.9, 523.3, 440, 0, 415.3, 440, 493.9, 329.6, 0, 0];
    let step = 0;
    const timer = setInterval(() => {
      if (!ok()) return;
      const now = ctx.currentTime;
      if (stage === 0) {
        const f = melody[step++ % melody.length];
        if (f && Math.random() > 0.08) {
          const o = osc('sine', f * (0.97 + Math.random() * 0.01), now, 1.4), o2 = osc('sine', f * 2.99, now, 0.4);
          const g = envGain(now, 0.004, 0.05, 1.4), g2 = envGain(now, 0.003, 0.012, 0.4);
          o.connect(g); g.connect(bus); o2.connect(g2); g2.connect(bus);
        }
      }
      // 아무 이유 없이 멀리서 나는 소리
      const r = Math.random();
      const chance = [0.025, 0.04, 0.06][stage];
      if (r < chance) bang(0.12 + Math.random() * 0.15, Math.random() * 2 - 1);
      else if (r < chance * 2) whisper(1.2, Math.random() * 2 - 1, 0.12);
      else if (r < chance * 2.6) creak(1.4, 0.12);
    }, 520);

    // 쫓길 때 커지는 현악기 같은 불협화음
    const chaseGain = ctx.createGain(); chaseGain.gain.value = 0;
    const cbp = filt('bandpass', 900, 1.5);
    const trem = keep(ctx.createOscillator()), tg = ctx.createGain();
    trem.frequency.value = 9; tg.gain.value = 0.5; trem.connect(tg); trem.start();
    const tremNode = ctx.createGain(); tremNode.gain.value = 1; tg.connect(tremNode.gain); tremNode.connect(chaseGain);
    [207.65, 220, 311.13, 329.63, 466.16].forEach((f, i) => {
      const o = keep(ctx.createOscillator()); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = (i - 2) * 9;
      const v = keep(ctx.createOscillator()), vg = ctx.createGain();
      v.frequency.value = 5 + i * 0.7; vg.gain.value = f * 0.012; v.connect(vg); vg.connect(o.frequency); v.start();
      o.connect(cbp); o.start();
    });
    cbp.connect(tremNode); chaseGain.connect(bus);
    const pulse = keep(ctx.createOscillator()); pulse.type = 'square'; pulse.frequency.value = 41.2;
    const pg = ctx.createGain(); pg.gain.value = 0; const plp = filt('lowpass', 140);
    pulse.connect(plp); plp.connect(pg); pg.connect(bus); pulse.start();

    amb = { bus, nodes, timer, buzzGain, chaseGain, cbp, pg };
  }

  function stopAmbient() {
    if (!amb) return;
    const a = amb; amb = null;
    clearInterval(a.timer);
    const t = ctx.currentTime;
    a.bus.gain.cancelScheduledValues(t);
    a.bus.gain.setValueAtTime(a.bus.gain.value, t);
    a.bus.gain.linearRampToValueAtTime(0, t + 0.6);
    setTimeout(() => { a.nodes.forEach(n => { try { n.stop && n.stop(); } catch (e) { /* 이미 멈춤 */ } }); a.bus.disconnect(); }, 800);
  }

  function setChase(level) {
    if (!amb || !amb.chaseGain) return;
    const t = ctx.currentTime;
    amb.chaseGain.gain.setTargetAtTime(level * 0.09, t, 0.25);
    amb.cbp.frequency.setTargetAtTime(700 + level * 1600, t, 0.3);
    amb.pg.gain.setTargetAtTime(level * 0.12, t, 0.3);
  }

  // 유령이 나를 발견했을 때의 날카로운 비명
  function shriek(pan = 0) {
    if (!ok()) return;
    const t = ctx.currentTime, dur = 0.55;
    const sh = shaper(), hp = filt('highpass', 700), g = envGain(t, 0.01, 0.22, dur);
    sh.connect(hp); hp.connect(g); g.connect(out(1, pan));
    [0, 1, 2].forEach(i => {
      const o = osc('sawtooth', 500 + i * 70, t, dur);
      o.frequency.exponentialRampToValueAtTime(2300 + i * 260, t + 0.18);
      o.frequency.exponentialRampToValueAtTime(1500 + i * 200, t + dur);
      o.connect(sh);
    });
    const n = noise(t, dur * 0.6), nb = filt('bandpass', 3500, 1), ng = envGain(t, 0.005, 0.25, dur * 0.6);
    n.connect(nb); nb.connect(ng); ng.connect(out(1, pan));
  }

  // 촛불이 훅 꺼지는 소리
  function blowout(pan = 0) {
    if (!ok()) return;
    const t = ctx.currentTime;
    const n = noise(t, 0.35), bp = filt('bandpass', 600, 0.8), g = envGain(t, 0.02, 0.12, 0.35);
    bp.frequency.setValueAtTime(1200, t); bp.frequency.exponentialRampToValueAtTime(250, t + 0.35);
    n.connect(bp); bp.connect(g); g.connect(out(1, pan));
  }

  function setBuzz(level) {
    if (amb && amb.buzzGain) amb.buzzGain.gain.setTargetAtTime(0.004 + level * 0.03, ctx.currentTime, 0.02);
  }

  function toggleMute() {
    muted = !muted;
    if (master) master.gain.setTargetAtTime(muted ? 0 : 0.9, ctx.currentTime, 0.05);
    return muted;
  }

  return { init, scream, stinger, heartbeat, footstep, whoosh, whisper, bang, creak, pickup, thunder, moan, shriek, blowout, setChase,
    static: static_, ambient, stopAmbient, setBuzz, toggleMute, get muted() { return muted; } };
})();
