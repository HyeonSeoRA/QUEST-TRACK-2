'use strict';
/* 곡 만들기: 음악(드럼·베이스·화음·멜로디)과 채보(노트)를 같은 규칙으로 함께 만들어요.
 * 멜로디가 노트 자리에서 울리기 때문에, 노트를 치는 박자 = 들리는 박자 예요. */

// 16칸 = 한 마디(16분음표). x = 노트, . = 쉼
const POOL = [
  ['x.......x.......', 'x...x...x.......', 'x.......x...x...'],
  ['x...x...x...x...', 'x...x...x.x.x...', 'x.......x...x...', 'x...x.x.x...x...'],
  ['x.x.x...x.x.x...', 'x...x.x.x.x.x...', 'x..x..x.x...x...', 'x.x.x.x.x...x.x.', 'x...x..xx...x.x.'],
  ['x.x.x.x.x.x.x.x.', 'x..x..x.x.x.x.x.', 'xx..x.xxx...x.x.', 'x.xxx.x.x.xxx.x.', 'x.x.xx.xx.x.xx.x'],
  ['x.xxx.xxx.x.xxx.', 'xx.xx.xx.x.xx.x.', 'x.x.xxxxx.x.x.x.', 'xxx.x.xxx.x.xxxx'],
];
const SECT_BASE = { intro: 0, A: 1, B: 2, brk: 1, drop: 3, outro: 0 };

function buildSong(def) {
  const R = mulberry32(def.seed);
  const spb = 60 / def.bpm, step = spb / 4, barD = spb * 4;
  const ev = [], hard = [];
  const E = (t, f, ...a) => ev.push({ t, f, a });
  const secs = [];
  const dr = def.drums || 'normal';
  let bar = 0, mel = 2;

  def.sections.forEach(([name, len], si) => {
    const next = (def.sections[si + 1] || [])[0];
    secs.push({ name, bar, t: bar * barD, len });
    for (let i = 0; i < len; i++, bar++) {
      const t0 = bar * barD, last = i === len - 1;
      const [deg, q] = def.prog[bar % def.prog.length];
      const root = def.root + deg, tones = q === 'm' ? [0, 3, 7] : [0, 4, 7];
      const at = s => t0 + s * step;
      const kv = dr === 'light' ? 0.7 : 1;
      const k = s => E(at(s), 'kick', kv);
      const sn = (s, v = 1) => E(at(s), 'snare', v * (dr === 'light' ? 0.55 : 1));
      const hh = (s, v = 0.6, o = false) => dr === 'light' ? E(at(s), 'shaker', v) : E(at(s), 'hat', v, o);
      const strong = name === 'drop' || name === 'B';

      /* --- 드럼 --- */
      if (dr !== 'none') {
        if (name === 'intro') {
          k(0); if (dr !== 'light') k(8); if (i >= 2) { k(4); k(12); }
          if (i >= 1) for (let s = 2; s < 16; s += 4) hh(s, 0.5);
          if (last) for (let s = 12; s < 16; s++) sn(s, 0.35 + 0.15 * (s - 12));
        } else if (name === 'A') {
          if (dr === 'light') { k(0); k(8); sn(12, 0.8); for (let s = 0; s < 16; s += 2) hh(s, s % 4 ? 0.6 : 0.3); }
          else { [0, 4, 8, 12].forEach(k); sn(4); sn(12); for (let s = 2; s < 16; s += 4) hh(s, 0.7); if (i % 2) hh(14, 0.4, true); }
        } else if (name === 'B') {
          if (dr === 'light') { k(0); k(6); k(8); sn(4); sn(12); for (let s = 0; s < 16; s++) hh(s, s % 2 ? 0.25 : 0.55); }
          else { [0, 4, 8, 12].forEach(k); sn(4); sn(12); for (let s = 0; s < 16; s++) hh(s, s % 4 === 2 ? 0.7 : 0.28, s % 4 === 2); }
        } else if (name === 'brk') {
          k(0); if (i % 2) k(10);
          for (let s = 2; s < 16; s += 4) hh(s, 0.35);
          if (last) { for (let s = 0; s < 16; s++) sn(s, 0.15 + (s / 16) * 0.85); E(t0, 'riser', barD); }
        } else if (name === 'drop') {
          [0, 4, 8, 12].forEach(k); sn(4); sn(12);
          for (let s = 0; s < 16; s++) hh(s, s % 4 === 2 ? 0.8 : 0.35, s % 4 === 2);
          if (i % 4 === 0) E(t0, 'crash', 1);
          if (dr === 'heavy') { if (i % 2) k(14); if (i % 4 === 3) [10, 12, 14].forEach(s => E(at(s), 'tom', 0.8)); }
        } else if (name === 'outro' && i === 0) { k(0); E(t0, 'crash', 1); }
        if (i === 0 && (name === 'A' || name === 'B' || name === 'brk')) E(t0, 'crash', 0.6);
        if (last && (name === 'A' || name === 'B')) {
          sn(13, 0.6); sn(14, 0.8); sn(15, 1);
          if (next === 'drop' || next === 'brk') E(t0, 'riser', barD);
        }
      }

      /* --- 베이스 --- */
      const bR = root - 24;
      if (dr === 'none') { if (i % 2 === 0) E(t0, 'bass', bR, barD * 1.8); }
      else if (name === 'intro' && i >= 2) E(t0, 'bass', bR, barD * 0.95);
      else if (name === 'A') [0, 3, 6, 8, 11, 14].forEach(s => E(at(s), 'bass', bR, step * 1.6));
      else if (strong) for (let s = 0; s < 16; s += 2) E(at(s), 'bass', s % 4 === 2 ? bR + 12 : bR, step * 1.5);
      else if (name === 'brk' && i % 2 === 0) E(t0, 'bass', bR, barD * 1.9);
      else if (name === 'outro' && i === 0) E(t0, 'bass', bR, barD * 1.5);

      /* --- 화음 (현악 패드) --- */
      const padV = { intro: 0.8, A: 0.6, B: 1, brk: 1.4, drop: 1.1, outro: 1.2 }[name];
      E(t0, 'pad', tones.map(x => root + x), name === 'outro' ? barD * 2 : barD, padV);

      /* --- 하프 / 아르페지오 --- */
      if (strong || dr === 'none' || name === 'brk') {
        const seq = [0, 1, 2, 1], every = name === 'drop' ? 1 : 2;
        for (let s = 0; s < 16; s += every) {
          const n = s % 8 === 7 ? tones[0] + 24 : tones[seq[(s / every) % 4]] + 12;
          E(at(s), def.arp || 'arp', root + n, name === 'drop' ? 1 : 0.8);
        }
      }

      /* --- 채보 + 멜로디 --- */
      let pat = null;
      const lvl = clamp((SECT_BASE[name] || 0) + (def.pw || 0) - 1, 0, 4);
      if (name === 'intro') pat = i < 2 ? null : last ? 'x...x...x.x.x...' : 'x.......x.......';
      else if (name === 'A') pat = pick(R, POOL[lvl]);
      else if (name === 'B') pat = (i % 4 === 3 && !last) ? 'H-------x.x.x...' : pick(R, POOL[lvl]);
      else if (name === 'drop') pat = pick(R, POOL[lvl]);
      else if (name === 'brk') pat = last ? 'x...x...x.x.xxxx' : (i % 2 === 0 ? 'H-------x...x...' : 'x...x...H-------');
      else if (name === 'outro') pat = i === 0 ? 'D...............' : null;
      if (!pat) continue;

      const flip = name !== 'brk' && R() < 0.25;
      let prev = 1, holdLane = -1, holdEnd = -1;
      const arr = [...tones, ...tones.map(x => x + 12)];
      const nextPitch = () => { mel = clamp(mel + pick(R, [-1, 0, 1, 1, -1, 2, -2]), 0, 5); return root + arr[mel]; };
      const base = { sect: name, bar: i };
      const lead = def.lead || 'lead';

      for (let s = 0; s < 16; s++) {
        const ch = pat[s];
        if (ch === '.' || ch === '-') continue;
        const t = at(s);
        if (ch === 'H') {
          let L = 1; while (pat[s + L] === '-') L++;
          const lane = name === 'brk' ? (i % 2 === 0 ? 1 : 0) : (R() < 0.5 ? 0 : 1);
          holdLane = lane; holdEnd = s + L;
          hard.push({ ...base, t, end: at(s + L), lane, type: 'hold', s });
          E(t, lead, nextPitch() + (lane === 0 ? 12 : 0), L * step, 0.9);
          continue;
        }
        const dbl = ch === 'D' || (name === 'drop' && s === 0 && i % 2 === 0) || (name === 'B' && s === 0 && i % 4 === 0);
        if (dbl) {
          const p = nextPitch();
          hard.push({ ...base, t, lane: 0, type: 'tap', dbl: true, s });
          hard.push({ ...base, t, lane: 1, type: 'tap', dbl: true, s });
          E(t, lead, p, step * 2, 0.6); E(t, lead, p + 12, step * 2, 0.6);
          continue;
        }
        let lane;
        if (holdLane >= 0 && s <= holdEnd) lane = 1 - holdLane;
        else if (s % 8 === 0) lane = flip ? 0 : 1;
        else if (s % 8 === 4) lane = flip ? 1 : 0;
        else lane = R() < 0.6 ? prev : 1 - prev;
        prev = lane;
        hard.push({ ...base, t, lane, type: 'tap', s });
        E(t, lead, nextPitch() + (lane === 0 ? 12 : 0), step * 1.8, 0.8);
      }
    }
  });

  /* --- 보통 난이도: 어려움 채보에서 일부만 남겨요 --- */
  const normal = [];
  for (const n of hard) {
    const s = n.s;
    let keep;
    if (n.type === 'hold' || n.sect === 'intro' || n.sect === 'outro') keep = true;
    else if (n.sect === 'brk') keep = s % 4 === 0;
    else if (n.sect === 'A') keep = s % 4 === 0 || (s % 2 === 0 && R() < 0.45);
    else keep = s % 4 === 0 || (s % 2 === 0 && R() < (n.sect === 'drop' ? 0.4 : 0.3));
    if (!keep) continue;
    if (n.dbl && n.sect !== 'drop' && n.sect !== 'outro') { if (n.lane === 1) normal.push({ ...n, dbl: false }); continue; }
    normal.push({ ...n });
  }
  for (let i = normal.length - 1; i >= 0; i--) {
    const n = normal[i];
    if (n.type !== 'tap') continue;
    const h = normal.find(o => o.type === 'hold' && o.lane !== n.lane && n.t > o.t && n.t < o.end);
    if (h && n.s % 4 !== 0) normal.splice(i, 1);
  }

  /* --- 회복 물약 --- */
  const addHeart = (chart, t) => {
    for (const lane of [0, 1]) {
      const busy = chart.some(o => o.lane === lane && (Math.abs(o.t - t) < step * 0.9 || (o.type === 'hold' && t >= o.t - step && t <= o.end + step)));
      if (!busy) { chart.push({ t, lane, type: 'heart' }); return; }
    }
  };
  const brk = secs.find(s => s.name === 'brk');
  const drops = secs.filter(s => s.name === 'drop');
  const Bs = secs.filter(s => s.name === 'B');
  for (const chart of [hard, normal]) {
    if (brk) addHeart(chart, brk.t + 14 * step);
    if (drops.length) addHeart(chart, drops[drops.length - 1].t + barD * 4 + 15 * step);
    if (Bs.length) addHeart(chart, Bs[0].t + barD * 4 + 14 * step);
    chart.sort((a, b) => a.t - b.t || a.lane - b.lane);
  }
  ev.sort((a, b) => a.t - b.t);

  const duration = bar * barD;
  return {
    def, spb, step, barD, duration, events: ev, secs,
    charts: { normal, hard },
    bossStart: def.boss ? secs[1].t : Infinity,
  };
}

const SONGDATA = STAGES.map(buildSong);
const BGM = {};
for (const k in BGM_DEFS) { const s = buildSong(BGM_DEFS[k]); BGM[k] = { events: s.events, len: s.duration, spb: s.spb }; }
function playBgm(key, vol = 0.7) {
  if (!AE.ctx) return;
  if (SEQ.bgmKey === key && SEQ.ch) return;
  const b = BGM[key];
  AE.setBeat(b.spb);
  SEQ.play(b.events, AE.now() + 0.1, b.len, vol);
  SEQ.bgmKey = key;
}
function stopBgm(fade) { SEQ.stop(fade); SEQ.bgmKey = null; }
