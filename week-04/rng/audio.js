'use strict';
// 소리 — 파일 없이 Web Audio 로 직접 만든다

let AC = null, master = null;
function ensureAudio() {
  if (AC) { if (AC.state === 'suspended') AC.resume(); return; }
  try {
    AC = new (window.AudioContext || window.webkitAudioContext)();
    master = AC.createGain(); master.gain.value = 0.35; master.connect(AC.destination);
  } catch (e) {}
}
function tone(f, dur, { type = 'sine', vol = 0.3, at = 0, slideTo = null, attack = 0.01 } = {}) {
  if (!AC || !S.sound) return;
  const t = AC.currentTime + at, o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
}
function noise(dur, { vol = 0.4, at = 0, lp = 800 } = {}) {
  if (!AC || !S.sound) return;
  const t = AC.currentTime + at, len = Math.floor(AC.sampleRate * dur);
  const buf = AC.createBuffer(1, len, AC.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = AC.createBufferSource(); src.buffer = buf;
  const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lp;
  const g = AC.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(master); src.start(t);
}
const SFX = {
  tick: i => tone(500 + i * 25, 0.04, { type: 'square', vol: 0.03 }),
  pop: t => tone(440 * Math.pow(2, t / 3), 0.18, { type: 'triangle', vol: 0.15 }),
  chime: () => [0, 4, 7, 12].forEach((s, i) => tone(784 * Math.pow(2, s / 12), 0.7, { vol: 0.1, at: i * 0.06 })),
  coin: () => { tone(988, 0.08, { type: 'square', vol: 0.05 }); tone(1319, 0.3, { type: 'square', vol: 0.05, at: 0.08 }); },
  ach: () => [0, 4, 7, 12, 16].forEach((s, i) => tone(523 * Math.pow(2, s / 12), 0.5, { type: 'triangle', vol: 0.12, at: i * 0.07 })),
  event: () => [0, 7, 12, 19, 24].forEach((s, i) => tone(330 * Math.pow(2, s / 12), 0.9, { vol: 0.1, at: i * 0.12, attack: 0.05 })),
  heartbeat: () => { tone(60, 0.18, { vol: 0.7, slideTo: 40 }); tone(52, 0.22, { vol: 0.55, at: 0.22, slideTo: 35 }); },
  riser: dur => { tone(80, dur, { type: 'sawtooth', vol: 0.07, slideTo: 1400, attack: dur * 0.8 }); noise(dur, { vol: 0.08, lp: 3000 }); },
  drone: dur => { tone(41, dur, { type: 'sawtooth', vol: 0.1, attack: dur * 0.5 }); tone(41.6, dur, { type: 'sawtooth', vol: 0.1, attack: dur * 0.5 }); },
  boom: () => { tone(70, 1.6, { vol: 0.8, slideTo: 25 }); noise(1.4, { vol: 0.6, lp: 700 }); },
  sparkle: () => tone(1500 + Math.random() * 1800, 0.25, { vol: 0.03 }),
  glitch: () => { for (let i = 0; i < 28; i++) tone(150 + Math.random() * 2500, 0.05, { type: 'square', vol: 0.05, at: i * 0.06 }); },
  fanfare(t) {
    const root = [0, 0, 0, 261.6, 220, 196, 174.6, 130.8][t];
    const notes = { 3: [0, 4, 7, 12], 4: [0, 4, 7, 11, 14], 5: [0, 3, 7, 10, 14, 17], 6: [0, 4, 7, 11, 14, 18, 21], 7: [0, 7, 12, 16, 19, 23, 26, 28, 31] }[t];
    const dur = 2 + t * 0.6;
    notes.forEach((s, i) => {
      const f = root * Math.pow(2, s / 12);
      tone(f, dur, { type: 'triangle', vol: 0.09, at: i * 0.09, attack: 0.05 });
      tone(f * 2, dur, { vol: 0.04, at: i * 0.09, attack: 0.05 });
    });
  },
};
