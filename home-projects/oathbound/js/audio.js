'use strict';
// =============================================================
//  효과음 — 소리 파일 없이 Web Audio 로 직접 만들어요.
// =============================================================

const Sfx = (() => {
  let ac = null, master = null, noiseBuf = null;
  let muted = false;

  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = 0.45;
    master.connect(ac.destination);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  function env(g, t0, vol, attack, dur) {
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  }

  // 쉬익 / 쾅 같은 잡음 소리
  function noise(dur, o = {}) {
    if (!ac || muted) return;
    const t0 = ac.currentTime + (o.delay || 0);
    const src = ac.createBufferSource();
    src.buffer = noiseBuf;
    const f = ac.createBiquadFilter();
    f.type = o.type || 'bandpass';
    f.frequency.setValueAtTime(o.freq || 1000, t0);
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t0 + dur);
    f.Q.value = o.q || 1;
    const g = ac.createGain();
    env(g, t0, o.vol || 0.4, o.attack || 0.004, dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0, Math.random() * 0.5, dur + 0.05);
  }

  // 삐 / 띵 같은 음 소리
  function tone(freq, dur, o = {}) {
    if (!ac || muted) return;
    const t0 = ac.currentTime + (o.delay || 0);
    const osc = ac.createOscillator();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(freq, t0);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t0 + dur);
    const g = ac.createGain();
    env(g, t0, o.vol || 0.2, o.attack || 0.004, dur);
    osc.connect(g); g.connect(master);
    osc.start(t0); osc.stop(t0 + dur + 0.05);
  }

  return {
    init,
    toggleMute() { muted = !muted; return muted; },
    slash(big) {
      noise(big ? 0.22 : 0.14, { freq: 4000, to: 700, q: 0.7, vol: big ? 0.5 : 0.35 });
    },
    hit(big) {
      const v = 0.85 + Math.random() * 0.3;
      noise(0.12, { freq: 900 * v, to: 200, q: 1.5, vol: 0.6, type: 'lowpass' });
      noise(0.05, { freq: 3500 * v, q: 2, vol: big ? 0.35 : 0.22 });
      tone((big ? 90 : 140) * v, 0.12, { type: 'square', to: 50, vol: 0.18 });
      if (big) tone(55, 0.25, { type: 'sine', to: 35, vol: 0.3 });
    },
    parry() {
      tone(1800, 0.35, { type: 'triangle', vol: 0.35, to: 1500 });
      tone(2700, 0.25, { type: 'sine', vol: 0.25 });
      tone(900, 0.4, { type: 'square', vol: 0.08, to: 880 });
      noise(0.08, { freq: 6000, q: 2, vol: 0.4 });
    },
    wave() {
      noise(0.35, { freq: 1500, to: 5000, q: 0.6, vol: 0.4 });
      tone(500, 0.3, { type: 'sawtooth', to: 1400, vol: 0.08 });
      tone(1200, 0.25, { type: 'sine', to: 600, vol: 0.1 });
    },
    clink() { tone(2400, 0.12, { type: 'triangle', vol: 0.15 }); noise(0.05, { freq: 7000, q: 3, vol: 0.2 }); },
    whiff() { noise(0.1, { freq: 2500, to: 1200, q: 1, vol: 0.15 }); },
    hurt() {
      tone(220, 0.25, { type: 'sawtooth', to: 80, vol: 0.22 });
      noise(0.15, { freq: 600, q: 1, vol: 0.4, type: 'lowpass' });
    },
    jump() { tone(300, 0.1, { type: 'square', to: 520, vol: 0.06 }); },
    land() { noise(0.06, { freq: 300, q: 1, vol: 0.15, type: 'lowpass' }); },
    dash() { noise(0.2, { freq: 1200, to: 3500, q: 0.6, vol: 0.25 }); },
    heal() {
      [523, 659, 784].forEach((f, i) => tone(f, 0.25, { type: 'triangle', vol: 0.12, delay: i * 0.08 }));
    },
    tellParry() { tone(1500, 0.15, { type: 'triangle', vol: 0.18, to: 2200 }); },
    tellDanger() { tone(110, 0.3, { type: 'sawtooth', vol: 0.18, to: 70 }); tone(116, 0.3, { type: 'square', vol: 0.06 }); },
    boom() {
      noise(0.6, { freq: 400, to: 60, q: 0.8, vol: 0.7, type: 'lowpass' });
      tone(70, 0.5, { type: 'sine', to: 30, vol: 0.4 });
    },
    fire() { noise(0.35, { freq: 700, to: 1800, q: 0.5, vol: 0.3 }); },
    magic() { tone(600, 0.3, { type: 'sine', to: 1200, vol: 0.12 }); tone(900, 0.3, { type: 'triangle', to: 300, vol: 0.06 }); },
    bone() { tone(800, 0.06, { type: 'square', vol: 0.08 }); noise(0.05, { freq: 3000, q: 4, vol: 0.2 }); },
    roar() {
      noise(1.1, { freq: 200, to: 90, q: 0.6, vol: 0.6, type: 'lowpass' });
      tone(80, 1.0, { type: 'sawtooth', to: 55, vol: 0.2 });
    },
    breakPosture() {
      tone(400, 0.6, { type: 'square', to: 60, vol: 0.2 });
      noise(0.4, { freq: 2000, to: 200, q: 0.5, vol: 0.6 });
    },
    victory() {
      [392, 523, 659, 784, 1046].forEach((f, i) => tone(f, 0.5, { type: 'triangle', vol: 0.14, delay: i * 0.12 }));
    },
    defeat() {
      [392, 330, 262, 196].forEach((f, i) => tone(f, 0.5, { type: 'sawtooth', vol: 0.08, delay: i * 0.22 }));
    },
    click() { tone(700, 0.05, { type: 'square', vol: 0.05 }); },
  };
})();
