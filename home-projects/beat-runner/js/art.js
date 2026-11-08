'use strict';
/* 캐릭터·적·보스·초상화·아이콘·효과 그림 (모두 pixel.js 엔진으로 그려요) */

const dirv = (a, l) => [Math.sin(a) * l, Math.cos(a) * l];
// 피부 선 색: 램프의 가장 어두운 색(주황빛) 대신 부드러운 갈색
const vadd = (...vs) => vs.reduce((s, v) => [s[0] + v[0], s[1] + v[1]], [0, 0]);
const vmul = (v, k) => [v[0] * k, v[1] * k];

const PAL = {
  skin: R('#f2c6a4'), hair: R('#dfe2f4', { light: 0.6 }), tunic: R('#34508f'), cape: R('#b8323e'),
  pants: R('#4b405f'), boot: R('#7a4c30'), belt: R('#5a3a22'), gold: R('#e6b44c', { light: 0.6 }),
  steel: R('#b4c4dc', { light: 0.7 }), glove: R('#6a4636'), cloth: R('#ece4d2'), dark: R('#1c1424'),
};
// 피부 색은 손으로 고른 5단계 (자동 램프는 그늘이 주황빛으로 쏠려서)
PAL.skin = ['#6e4048', '#c98c80', '#f2c6a4', '#ffdcc6', '#fff0e6'];
PAL.skin.lc = '#c08676'; PAL.skin.olc = '#4a2a3a';

/* ================= 주인공 리아 ================= */
// 재질별 질감: 머리카락은 세로 결, 망토는 가로 주름, 장화는 가죽 얼룩
const HERO_MAT = new Map();
function heroParts(ps, s = 1, ox = 24, oy = 0) {
  if (!HERO_MAT.size) { HERO_MAT.set(PAL.hair, { tex: 0.22, ts: [1.3, 3.4] }); HERO_MAT.set(PAL.cape, { tex: 0.14, ts: [3, 1.3] }); HERO_MAT.set(PAL.boot, { tex: 0.12, ts: [2, 2] }); HERO_MAT.set(PAL.tunic, { tex: 0.06, ts: [2, 2] }); }
  const mo = (r, o) => (s < 0.9 ? o : Object.assign({}, HERO_MAT.get(r) || {}, o || {}));
  const T = q => [ox + (q[0] - 24) * s, oy + q[1] * s];
  const e = (q, rx, ry, r, o) => E(...T(q), rx * s, ry * s, r, mo(r, o));
  const c = (a, b, r1, r2, r, o) => Cap(...T(a), ...T(b), r1 * s, r2 * s, r, mo(r, o));
  const p = (pts, r, o) => Poly(pts.map(T), r, mo(r, o));
  const dim = { bright: 0.76 };
  const P = [];
  const hip = [24, 31 + (ps.hy || 0)], lean = ps.lean || 0;
  const neck = vadd(hip, dirv(Math.PI - lean, 10.5));
  const head = vadd(neck, dirv(Math.PI - lean * 0.4, 6.4), [0.8, 0]);
  const shB = vadd(neck, [-1.2, 1.6]), shF = vadd(neck, [1.6, 1.6]);
  const hipB = vadd(hip, [-1.4, 0]), hipF = vadd(hip, [1.4, 0]);
  const knB = vadd(hipB, dirv(ps.tB, 7.2)), ftB = vadd(knB, dirv(ps.sB, 7.2));
  const knF = vadd(hipF, dirv(ps.tF, 7.2)), ftF = vadd(knF, dirv(ps.sF, 7.2));
  const elB = vadd(shB, dirv(ps.uB, 5.4)), hdB = vadd(elB, dirv(ps.fB, 4.8));
  const elF = vadd(shF, dirv(ps.uF, 5.4)), hdF = vadd(elF, dirv(ps.fF, 4.8));
  const cp = ps.cape || 0, w0 = Math.sin(cp), w1 = Math.sin(cp + 1) * 2.5, w2 = Math.cos(cp + 0.5) * 2, w3 = Math.sin(cp + 2) * 1.5;

  const sword = () => {
    const d = dirv(ps.sw, 1), q = [-d[1], d[0]];
    const b = vadd(hdF, vmul(d, 2));
    P.push(c(vadd(hdF, vmul(d, -2.6)), vadd(hdF, vmul(d, 0.8)), 0.9, 0.9, PAL.belt));
    P.push(e(vadd(hdF, vmul(d, -3.3)), 1.2, 1.2, PAL.gold));
    P.push(p([vadd(b, vmul(q, 1.35)), vadd(b, vmul(d, 12), vmul(q, 1.15)), vadd(b, vmul(d, 16.5)), vadd(b, vmul(d, 12), vmul(q, -1.15)), vadd(b, vmul(q, -1.35))], PAL.steel, { bevel: 1.1 }));
    if (s > 0.9) P.push(c(vadd(b, vmul(d, 1.5)), vadd(b, vmul(d, 11)), 0.3, 0.3, PAL.steel, { flat: 4, line: false, ol: false, hl: false }));
    P.push(c(vadd(hdF, vmul(d, 1.4), vmul(q, 3)), vadd(hdF, vmul(d, 1.4), vmul(q, -3)), 0.95, 0.95, PAL.gold));
  };

  // 망토
  if (ps.hang) P.push(p([vadd(neck, [-1, -0.5]), vadd(neck, [2, 1]), vadd(hip, [-1, 9]), vadd(hip, [-7, 9 + w1 * 0.3]), vadd(neck, [-5, 3])], PAL.cape));
  else P.push(p([vadd(neck, [-1, -0.5]), vadd(neck, [2.5, 1]), vadd(hip, [-3 + w0, 3]), vadd(hip, [-12 + w1, 1 + w2]), vadd(neck, [-8 + w3, 5])], PAL.cape));
  // 뒤쪽 팔·다리
  P.push(c(shB, elB, 2.1, 1.9, PAL.tunic, dim), c(elB, hdB, 1.7, 1.5, PAL.glove, dim));
  P.push(c(hipB, knB, 2.6, 2.2, PAL.pants, dim), c(knB, ftB, 2.3, 2.0, PAL.boot, dim), c(ftB, vadd(ftB, [3.2, 0.4]), 1.8, 1.5, PAL.boot, dim));
  if (ps.back) sword();
  // 머리 꼬리
  const hw = Math.sin((ps.hair || 0) + 0.6) * 2, hw2 = Math.cos(ps.hair || 0) * 1.5;
  P.push(c(vadd(head, [-4.5, -2.5]), vadd(head, [-11 + hw, 2 + hw2]), 2.7, 1.0, PAL.hair));
  P.push(e(vadd(head, [-5, -2.6]), 1.7, 1.5, PAL.cape));
  // 몸통
  P.push(c(hip, neck, 4.2, 4.5, PAL.tunic));
  P.push(p([vadd(hip, [-4.6, -2]), vadd(hip, [4.6, -2]), vadd(hip, [5.6, 4.5]), vadd(hip, [0, 5.6]), vadd(hip, [-6.5 + w0, 4.5])], PAL.tunic));
  P.push(p([vadd(neck, [0.5, 0.6]), vadd(neck, [3.6, 1.2]), vadd(neck, [2.4, 4.6])], PAL.cloth));
  if (s > 0.9) P.push(c(vadd(hip, [-6, 4.3]), vadd(hip, [5.3, 4.2]), 0.45, 0.45, PAL.gold, { line: false }));
  P.push(c(vadd(hip, [-4.3, -1.6]), vadd(hip, [4.6, -1.6]), 1.2, 1.2, PAL.belt));
  if (s > 0.9) P.push(e(vadd(hip, [-3, 0.6]), 1.5, 1.8, PAL.belt));
  P.push(e(vadd(hip, [3.6, -1.6]), 1.1, 1.1, PAL.gold));
  P.push(e(vadd(neck, [0.2, 1.1]), 3.4, 1.6, PAL.cape));
  P.push(c(vadd(neck, [-2, 0.6]), vadd(neck, [-7 + w1 * 0.6, 3 + w2 * 0.4]), 1.5, 0.8, PAL.cape));
  // 앞 다리
  P.push(c(hipF, knF, 2.7, 2.3, PAL.pants), c(knF, ftF, 2.4, 2.1, PAL.boot), c(ftF, vadd(ftF, [3.4, 0.4]), 1.9, 1.6, PAL.boot));
  P.push(e(vadd(knF, dirv(ps.sF, 1)), 1.6, 1.2, PAL.gold, { bright: 0.9 }));
  // 머리
  P.push(e(head, 6.1, 6.0, PAL.skin));
  P.push(e(vadd(head, [-2.2, -0.6]), 5.4, 6.0, PAL.hair));
  P.push(e(vadd(head, [0.3, -3.4]), 6.4, 3.6, PAL.hair));
  P.push(p([vadd(head, [0.5, -4.6]), vadd(head, [7, -3.2]), vadd(head, [6.3, 0.9]), vadd(head, [4.6, -1.5]), vadd(head, [3.2, 0.6]), vadd(head, [2.1, -1.8])], PAL.hair));
  P.push(c(vadd(head, [1.1, -1]), vadd(head, [0.5, 5.6]), 1.3, 0.8, PAL.hair));
  P.push(c(vadd(head, [-4.6, -3.9]), vadd(head, [5.8, -4.4]), 0.8, 0.8, PAL.gold));
  if (!ps.back) sword();
  // 앞 팔
  P.push(c(shF, elF, 2.3, 2.0, PAL.tunic), c(elF, hdF, 1.8, 1.6, PAL.glove), e(hdF, 1.9, 1.8, PAL.glove));
  P.push(e(vadd(shF, [0.2, 0]), 2.9, 2.4, PAL.steel));
  return { parts: P, head: T(head), s };
}

function heroFace(pb, info) {
  const s = info.s;
  if (s < 0.9) return;
  const [hx, hy] = info.head;
  const ex = Math.round(hx + 3.0 * s), ey = Math.round(hy - 0.8 * s);
  const pal = { K: '#20142c', P: '#1a2c6a', I: '#4a8ae8', W: '#ffffff', i: '#2c5ab0', B: '#8a7aa8' };
  const big = s > 1.2;
  const rows = big ? ['.BB', 'KKK', 'PIW', 'PII', '.i.'] : ['KK', 'IW', 'iI'];
  rows.forEach((r, j) => [...r].forEach((ch, k) => { if (ch !== '.') pb.set(ex - (big ? 1 : 0) + k, ey - (big ? 1 : 0) + j, pal[ch]); }));
  pb.set(Math.round(hx + 4.8 * s), Math.round(hy + 3.6 * s), '#b85a5a');
  pb.set(Math.round(hx + 5.6 * s), Math.round(hy + 1.4 * s), mixHex('#f2c6a4', '#a06050', 0.4));
  pb.blend(Math.round(hx + 2.6 * s), Math.round(hy + 2.6 * s), '#ff7a8a', 0.3);
}

const HERO_POSES = (() => {
  const P = {};
  for (let i = 0; i < 8; i++) {
    const ph = i / 8 * Math.PI * 2;
    const bend = q => 0.25 + 1.15 * Math.max(0, Math.sin(q + 1.3));
    const tF = 0.85 * Math.sin(ph), tB = 0.85 * Math.sin(ph + Math.PI);
    const uF = -0.35 - 0.35 * Math.sin(ph);
    P['run' + i] = { tF, sF: tF - bend(ph), tB, sB: tB - bend(ph + Math.PI), hy: -Math.abs(Math.cos(ph)) * 1.4 + 0.5,
      uB: 0.9 * Math.sin(ph), fB: 0.9 * Math.sin(ph) + 1.1, uF, fF: uF - 0.5, sw: -1.95, back: true, lean: 0.28, cape: ph, hair: ph };
  }
  const jumpL = { tF: 1.2, sF: 0.1, tB: 0.5, sB: -0.9 };
  const atkA = { uB: -0.9, fB: -0.4, uF: 1.55, fF: 1.62, sw: 1.9 };
  const atkB = { uB: -0.9, fB: -0.4, uF: 1.25, fF: 1.1, sw: 1.15 };
  P.jump = { ...jumpL, uB: -1.1, fB: -0.5, uF: -0.7, fF: -1.2, sw: -2.1, back: true, lean: 0.2, hy: -1, cape: 2 };
  P.fall = { tF: 0.6, sF: 0.2, tB: -0.1, sB: -0.6, uB: -2.0, fB: -2.4, uF: -0.9, fF: -1.3, sw: -2.2, back: true, lean: 0.1, cape: 4 };
  P.atk = { tF: 0.9, sF: 0.4, tB: -0.7, sB: -1.1, ...atkA, lean: 0.4, hy: 0.5, cape: 1.5 };
  P.atk2 = { tF: 0.9, sF: 0.4, tB: -0.7, sB: -1.1, ...atkB, lean: 0.45, hy: 0.5, cape: 2.5 };
  P.atkA = { ...jumpL, ...atkA, lean: 0.3, hy: -1, cape: 1 };
  P.atkA2 = { ...jumpL, ...atkB, lean: 0.35, hy: -1, cape: 3 };
  P.hurt = { tF: 0.35, sF: 0.1, tB: -0.45, sB: -0.2, uB: -2.3, fB: -2.6, uF: 2.2, fF: 2.5, sw: 2.8, lean: -0.3, cape: 5 };
  P.idle0 = { tF: 0.12, sF: 0.05, tB: -0.12, sB: -0.12, uB: -0.12, fB: 0.05, uF: 0.25, fF: 0.55, sw: 0.35, lean: 0.06, hang: true, cape: 0 };
  P.idle1 = { ...P.idle0, hy: 0.6, uF: 0.22, cape: 1 };
  P.win = { tF: 0.25, sF: 0.2, tB: -0.3, sB: -0.3, uB: -0.6, fB: 0.9, uF: 2.75, fF: 2.95, sw: 3.05, lean: -0.05, hang: true, cape: 2 };
  for (let i = 0; i < 4; i++) {
    const ph = i / 4 * Math.PI * 2, tF = 0.5 * Math.sin(ph), tB = -tF;
    P['walk' + i] = { tF, sF: tF - 0.1 - 0.5 * Math.max(0, Math.sin(ph + 1.3)), tB, sB: tB - 0.1 - 0.5 * Math.max(0, Math.sin(ph + Math.PI + 1.3)),
      uB: 0.4 * Math.sin(ph), fB: 0.4 * Math.sin(ph) + 0.3, uF: 0.25 - 0.3 * Math.sin(ph), fF: 0.5, sw: 0.4, lean: 0.1, hang: true, hy: -Math.abs(Math.sin(ph)) * 0.8 };
  }
  return P;
})();

function buildHero(scene) {
  const big = ['run0', 'run1', 'run2', 'run3', 'run4', 'run5', 'run6', 'run7', 'jump', 'fall', 'atk', 'atk2', 'atkA', 'atkA2', 'hurt', 'idle0', 'idle1', 'win', 'walk0', 'walk1', 'walk2', 'walk3'];
  const F = 64, S = 1.3;
  const pb = new PB(F * big.length, F);
  big.forEach((n, i) => {
    const info = heroParts(HERO_POSES[n], S, F / 2, 1.5);
    renderParts(pb, i * F, 0, F, F, info.parts);
    heroFace(pb, { head: [info.head[0] + i * F, info.head[1]], s: S });
    pb.frame(n, i * F, 0, F, F);
  });
  pb.toTexture(scene, 'hero');
  const mini = ['walk0', 'walk1', 'walk2', 'walk3', 'idle0'];
  const pm = new PB(24 * mini.length, 26);
  mini.forEach((n, i) => {
    const info = heroParts(HERO_POSES[n], 0.52, 12, 1);
    renderParts(pm, i * 24, 0, 24, 26, info.parts);
    pm.frame(n, i * 24, 0, 24, 26);
  });
  pm.toTexture(scene, 'heroMini');
}

/* ================= 요정 루미 ================= */
function buildLumi(scene) {
  const pb = new PB(22 * 4, 22);
  for (let f = 0; f < 4; f++) {
    const ox = f * 22, wy = [-4, -1, 3, -1][f];
    const wing = R('#c6f0ff', { light: 0.8 });
    const P = [
      Poly([[11, 11], [2, 4 + wy], [4, 12 + wy * 0.3]], wing, { alpha: 0.75, ol: false }),
      Poly([[11, 11], [20, 4 + wy], [18, 12 + wy * 0.3]], wing, { alpha: 0.75, ol: false }),
      E(11, 14, 2.6, 3.6, R('#9ef0c8')),
      E(11, 8.5, 3.2, 3.2, PAL.skin),
      E(10.5, 7, 3.6, 2.4, R('#ffd462')),
      Poly([[13, 7], [16, 4], [14, 8]], R('#ffd462')),
    ];
    renderParts(pb, ox, 0, 22, 22, P);
    pb.set(ox + 12, 9, '#2a6a4a'); pb.set(ox + 9, 9, '#2a6a4a');
    pb.glow(ox + 11, 11, 10, '#fff2a0', 0.55);
    pb.frame(f, ox, 0, 22, 22);
  }
  pb.toTexture(scene, 'lumi');
}

/* ================= 적 ================= */
const ENEMY_SIZE = { slime: [32, 30], bat: [34, 26], beetle: [36, 28], shard: [30, 30], knight: [32, 38], wraith: [32, 34] };
const ENEMY_DRAW = {
  slime(pb, ox, f) {
    const sq = [1, 0.9, 1.08, 0.95][f], rx = 11.5 * (2 - sq) * 0.96, ry = 10 * sq, cy = 29 - ry;
    const body = R('#58c860', { light: 0.6 });
    renderParts(pb, ox, 0, 32, 30, [
      E(16, cy, rx, ry, body, { amb: 0.35 }),
      E(18, cy + ry * 0.25, rx * 0.5, ry * 0.45, R('#3ea558'), { line: false, ol: false, dither: 1 }),
      E(11, cy - ry * 0.45, 3.2, 1.9, R('#f2fff0'), { flat: 4, line: false, ol: false }),
      Poly([[16, cy - ry + 1.5], [23, cy - ry - 4], [20, cy - ry + 1.5]], R('#3a8a3a')),
      E(9.5, cy + 0.5, 1.8, 2.5, PAL.dark, { flat: 1, line: false, ol: false }),
      E(15.5, cy + 0.5, 1.8, 2.5, PAL.dark, { flat: 1, line: false, ol: false }),
      Cap(10.5, cy + 5, 14, cy + 5.4, 0.7, 0.7, PAL.dark, { flat: 1, line: false, ol: false }),
    ]);
    pb.set(ox + 9, Math.round(cy - 1), '#ffffff'); pb.set(ox + 15, Math.round(cy - 1), '#ffffff');
  },
  bat(pb, ox, f) {
    const wy = [-7, -2, 4, -2][f], wing = R('#5a3a78'), bone = R('#3a2450');
    const wingP = s => [[17 + s * 3, 10], [17 + s * 9, 8 + wy], [17 + s * 16, 10 + wy * 1.3], [17 + s * 13, 15 + wy * 0.6], [17 + s * 10, 13 + wy * 0.4], [17 + s * 7, 16 + wy * 0.3], [17 + s * 4, 14]];
    renderParts(pb, ox, 0, 34, 26, [
      Poly(wingP(-1), wing), Poly(wingP(1), wing),
      Cap(14, 10, 1, 10 + wy * 1.3, 0.5, 0.4, bone, { line: false, ol: false }),
      Cap(20, 10, 33, 10 + wy * 1.3, 0.5, 0.4, bone, { line: false, ol: false }),
      Poly([[13, 10], [12, 3], [16, 8]], R('#6a4a8a')), Poly([[19, 8], [22, 3], [22, 10]], R('#6a4a8a')),
      E(17, 13, 5.5, 6, R('#6a4a8a'), { tex: 0.2, ts: [1.5, 1.5] }),
      E(16, 15.5, 3.2, 3.4, R('#9a7ab0')),
    ]);
    pb.set(ox + 14, 12, '#ff5050'); pb.set(ox + 19, 12, '#ff5050');
    pb.set(ox + 15, 17, '#ffffff'); pb.set(ox + 18, 17, '#ffffff');
    pb.glow(ox + 16.5, 12, 5, '#ff4040', 0.45);
  },
  beetle(pb, ox, f) {
    const leg = R('#1e2440'), P = [];
    for (let k = 0; k < 3; k++) { const x = 11 + k * 8, off = ((f + k) % 2) ? 2.5 : -1.5; P.push(Cap(x, 20, x - 3 + off, 27, 1.2, 0.9, leg)); }
    const cr = R('#7ff0ff', { light: 0.75 });
    P.push(Poly([[11, 10], [14, 2], [17, 9]], cr, { add: 0.1 }), Poly([[16, 8], [20, 0.5], [23, 8]], cr, { add: 0.1 }), Poly([[22, 9], [27, 3], [28, 11]], cr, { add: 0.1 }));
    P.push(E(20, 15, 13, 8.5, R('#3e4e86')));
    P.push(Cap(9, 13, 30, 12, 0.6, 0.6, R('#6a7ab0'), { line: false, ol: false, flat: 3 }));
    P.push(E(6.5, 18, 5, 4.6, R('#2c3460')));
    P.push(Poly([[0.5, 20], [4, 16.5], [5, 21]], R('#c8d0e8')));
    renderParts(pb, ox, 0, 36, 28, P);
    pb.set(ox + 5, 17, '#ffe060'); pb.glow(ox + 5, 17, 4, '#ffe060', 0.5);
    pb.glow(ox + 19, 6, 10, '#7ff0ff', 0.35);
  },
  shard(pb, ox, f) {
    const core = R('#c890ff', { light: 0.75 }), P = [Poly([[15, 5], [22, 15], [15, 25], [8, 15]], core, { add: 0.12, bevel: 2 })];
    P.push(Poly([[15, 8], [18.5, 15], [15, 13]], R('#ffffff'), { flat: 4, line: false, ol: false }));
    for (let k = 0; k < 3; k++) {
      const a = f * Math.PI / 6 + k * Math.PI * 2 / 3, cx = 15 + Math.cos(a) * 11, cy = 15 + Math.sin(a) * 8;
      P.push(Poly([[cx, cy - 3], [cx + 2, cy], [cx, cy + 3], [cx - 2, cy]], R('#9ad8ff', { light: 0.7 }), { add: 0.1 }));
    }
    renderParts(pb, ox, 0, 30, 30, P);
    pb.glow(ox + 15, 15, 13, '#c890ff', 0.5);
  },
  knight(pb, ox, f) {
    const st = R('#6a6a86', { light: 0.6 }), dk = R('#3a3a52'), red = R('#8a2a3a');
    const a = [0.35, 0, -0.35, 0][f];
    renderParts(pb, ox, 0, 32, 38, [
      Cap(20, 8, 28, 4 + f % 2, 1.6, 0.8, red),
      Cap(16, 24, 16 + Math.sin(a) * 6, 31, 2.6, 2.2, dk, { bright: 0.8 }), Cap(16 + Math.sin(a) * 6, 31, 15 + Math.sin(a) * 6, 37, 2.2, 2, dk, { bright: 0.8 }),
      Cap(24, 22, 30, 10, 1, 0.8, PAL.steel),
      Cap(17, 25, 17, 13, 6, 6.6, st),
      Poly([[13, 15], [21, 15], [20, 28], [14, 28]], red),
      Cap(18, 24, 18 - Math.sin(a) * 6, 31, 2.7, 2.3, dk), Cap(18 - Math.sin(a) * 6, 31, 17 - Math.sin(a) * 6, 37, 2.3, 2.1, dk),
      E(16, 8.5, 6.2, 6.6, st),
      Cap(10, 9, 15, 9, 0.9, 0.9, R('#0a0810'), { flat: 0, line: false }),
      Poly([[3.5, 14], [12.5, 12.5], [12.5, 26], [8, 31], [3.5, 26]], PAL.gold),
      Poly([[5, 15], [11, 14], [11, 25.5], [8, 29], [5, 25.5]], R('#5a2030')),
    ]);
    pb.set(ox + 11, 9, '#ff4a4a'); pb.set(ox + 13, 9, '#ff4a4a');
    pb.glow(ox + 12, 9, 5, '#ff3a3a', 0.5);
  },
  wraith(pb, ox, f) {
    const cl = R('#3e2e62'), t = f * 1.3;
    const bottom = [];
    for (let k = 0; k <= 6; k++) bottom.push([27 - k * 3.6, 30 + ((k % 2) ? -4 : 0) + Math.sin(t + k) * 1.5]);
    renderParts(pb, ox, 0, 32, 34, [
      Cap(9, 17, 2, 21 + (f % 2), 1.8, 0.6, cl),
      Poly([[15, 1.5], [23, 6], [27, 18], ...bottom, [5, 20], [8, 6]], cl, { grad: 0.6 }),
      E(14, 10, 5.2, 5.6, R('#0c0818'), { flat: 0, line: false }),
      Cap(24, 16, 30, 20 + (f % 2), 1.8, 0.6, cl),
    ]);
    pb.set(ox + 12, 10, '#9affd8'); pb.set(ox + 16, 10, '#9affd8'); pb.set(ox + 12, 11, '#4ad8a0'); pb.set(ox + 16, 11, '#4ad8a0');
    pb.glow(ox + 14, 10.5, 7, '#7affd0', 0.55);
  },
};
// 땅 적은 금색, 공중 적은 하늘색 테두리 (어느 키를 눌러야 하는지 한눈에)
const ENEMY_LANE = { slime: '#ffd27a', beetle: '#ffd27a', knight: '#ffd27a', bat: '#a8ecff', shard: '#a8ecff', wraith: '#a8ecff' };
const ENEMY_SCALE = 1.5, ENEMY_PAD = 2;
function buildEnemies(scene) {
  const S = ENEMY_SCALE, P = ENEMY_PAD;
  for (const k in ENEMY_DRAW) {
    const [w, h] = ENEMY_SIZE[k], FW = Math.round(w * S) + P * 2, FH = Math.round(h * S) + P * 2;
    const pb = new PB(FW * 4, FH);
    for (let f = 0; f < 4; f++) { ENEMY_DRAW[k](scaledPB(pb, S, f * w, f * FW + P, P), f * w, f); pb.frame(f, f * FW, 0, FW, FH); }
    stickerOutline(pb, ENEMY_LANE[k]);
    pb.toTexture(scene, 'en_' + k);
  }
}

/* ================= 보스 ================= */
const BOSS_DRAW = {
  treant(pb, ox, f) {
    const bark = R('#6e4a30'), leaf = R('#4a9a3c', { light: 0.55 }), sw = f ? 3 : 0, P = [];
    for (const [x, y] of [[26, 127], [100, 127], [46, 127], [82, 127]]) P.push(Cap(64, 104, x, y, 8, 2.5, bark));
    P.push(Cap(46, 66, 16, 50 + sw, 5.5, 2.5, bark), Cap(20, 52 + sw, 8, 38 + sw, 2.2, 1, bark));
    P.push(Cap(82, 64, 112, 46 - sw, 5.5, 2.5, bark), Cap(108, 48 - sw, 120, 36 - sw, 2.2, 1, bark));
    P.push(Poly([[42, 127], [86, 127], [80, 92], [88, 60], [72, 38], [56, 38], [40, 60], [48, 92]], bark, { grad: 0.5 }));
    for (const [x1, y1, x2, y2] of [[54, 96, 52, 122], [74, 94, 77, 122], [62, 104, 63, 126], [48, 62, 52, 80], [80, 62, 77, 80]]) P.push(Cap(x1, y1, x2, y2, 0.8, 0.6, R('#4a2e1c'), { line: false, ol: false, flat: 1 }));
    for (const [x, y, rx, ry] of [[38, 34, 21, 15], [90, 34, 21, 15], [64, 20, 26, 17], [50, 46, 18, 10], [78, 46, 18, 10], [64, 7, 15, 8]]) P.push(E(x + sw * (x < 64 ? -0.5 : 0.5), y + (f ? 1 : 0), rx, ry, leaf, { amb: 0.3 }));
    for (const [x, y] of [[50, 100], [77, 84], [58, 60]]) P.push(E(x, y, 4, 2.4, R('#6ab84a'), { line: false }));
    P.push(Poly([[46, 62], [60, 64], [58, 67], [46, 66]], R('#4a2e1c')), Poly([[82, 62], [68, 64], [70, 67], [82, 66]], R('#4a2e1c')));
    P.push(E(54, 71, 5, 4, R('#1e120a'), { flat: 0 }), E(74, 71, 5, 4, R('#1e120a'), { flat: 0 }));
    P.push(E(54, 71, 2.2, 2, R('#ffd060'), { flat: 4, ol: false, line: false }), E(74, 71, 2.2, 2, R('#ffd060'), { flat: 4, ol: false, line: false }));
    P.push(E(64, 88, 8, 4.6 + f, R('#1e120a'), { flat: 0 }));
    for (const q of P) { if (q.r === bark) Object.assign(q, { tex: 0.35, ts: [1.3, 5] }); if (q.r === leaf) Object.assign(q, { rough: 0.14, rs: 3, tex: 0.3, ts: [2, 2] }); }
    renderParts(pb, ox, 0, 128, 128, P);
    pb.glow(ox + 54, 71, 8, '#ffc040', 0.7); pb.glow(ox + 74, 71, 8, '#ffc040', 0.7);
    pb.glow(ox + 64, 88, 8, '#ff9020', 0.25);
  },
  wyrm(pb, ox, f) {
    const sc = R('#3a5aa8', { light: 0.55 }), cr = R('#9ff6ff', { light: 0.8 }), P = [];
    const wv = f ? 3 : 0;
    P.push(Poly([[92, 62], [124, 18 + wv], [118, 46], [127, 60], [104, 76]], R('#2a3a7a'), { alpha: 0.95 }));
    const chain = [[124, 124], [106, 114], [92, 96 + wv], [100, 76], [88, 58 - wv * 0.5], [66, 48], [50, 48]];
    for (let i = 0; i < chain.length - 1; i++) {
      const r1 = 10 - i * 0.6, r2 = 10 - (i + 1) * 0.6;
      P.push(Cap(...chain[i], ...chain[i + 1], r1, r2, sc, { grp: 1 }));
    }
    for (let i = 1; i < chain.length - 1; i++) { const [x, y] = chain[i]; P.push(Poly([[x - 3, y - 7], [x + 2, y - 17], [x + 4, y - 6]], cr, { add: 0.1 })); }
    P.push(E(40, 50, 17, 9.5, sc, { rot: -0.12, grp: 1 }));
    P.push(Poly([[24, 54], [46, 56], [52, 62], [30, 62]], R('#2a4280')));
    P.push(Poly([[50, 42], [66, 20], [60, 44]], cr, { add: 0.1 }), Poly([[42, 42], [48, 24], [48, 42]], cr, { add: 0.1 }));
    P.push(E(36, 45, 3.4, 2.3, R('#fff070'), { flat: 4, ol: false, line: false }));
    for (const q of P) if (q.r === sc) Object.assign(q, { tex: 0.18, ts: [2, 2] });
    renderParts(pb, ox, 0, 128, 128, P);
    for (let i = 0; i < 4; i++) pb.set(ox + 28 + i * 4, 56, '#ffffff');
    pb.set(ox + 25, 49, '#0a1020');
    pb.glow(ox + 36, 45, 9, '#fff070', 0.6);
    for (let i = 1; i < chain.length - 1; i++) pb.glow(ox + chain[i][0] + 1, chain[i][1] - 10, 9, '#9ff6ff', 0.35);
  },
  lord(pb, ox, f) {
    const ar = R('#3c3c58', { light: 0.6 }), cape = R('#2c1a40'), lin = R('#7a1a2a'), bone = R('#d8d0c0');
    const w = f ? 3 : 0, P = [];
    P.push(Poly([[64, 30], [102, 40], [120, 122 - w], [98, 112], [82, 126 + w], [64, 114], [46, 126 - w], [28, 112], [8, 122 + w], [26, 40]], cape));
    P.push(Poly([[64, 44], [92, 52], [100, 112], [64, 104], [30, 112], [38, 52]], lin));
    P.push(Poly([[48, 86], [80, 86], [86, 116], [64, 110], [42, 116]], ar));
    P.push(Cap(64, 90, 64, 56, 13, 15, ar));
    P.push(Poly([[58, 60], [70, 60], [68, 82], [60, 82]], R('#8a1a3a')));
    P.push(Cap(80, 58, 92, 80, 4, 3.4, ar), E(93, 83, 4, 4, ar));
    P.push(E(46, 55, 9, 7, ar), E(82, 55, 9, 7, ar));
    P.push(Poly([[40, 50], [34, 38], [46, 48]], bone), Poly([[88, 50], [94, 38], [82, 48]], bone));
    P.push(E(64, 36, 9.5, 10.5, R('#2a2a40')));
    P.push(Poly([[56, 30], [38, 4], [59, 24]], bone), Poly([[72, 30], [90, 4], [69, 24]], bone));
    P.push(E(62, 39, 6, 5, R('#08040c'), { flat: 0, line: false }));
    P.push(Cap(48, 58, 30, 72, 4.2, 3.3, ar), E(28, 74, 3.6, 3.6, ar));
    P.push(E(22, 74, 7 + f * 0.5, 7 + f * 0.5, R('#d060ff', { light: 0.75 }), { add: 0.12 }));
    for (const q of P) { if (q.r === cape) Object.assign(q, { tex: 0.12, ts: [1.5, 4] }); if (q.r === ar) Object.assign(q, { tex: 0.08 }); }
    renderParts(pb, ox, 0, 128, 128, P);
    pb.set(ox + 59, 38, '#ff4a9a'); pb.set(ox + 60, 38, '#ff4a9a'); pb.set(ox + 65, 38, '#ff4a9a'); pb.set(ox + 66, 38, '#ff4a9a');
    pb.glow(ox + 62, 38, 9, '#ff3a8a', 0.6);
    pb.glow(ox + 22, 74, 20, '#d060ff', 0.6);
  },
};
function buildBosses(scene) {
  for (const k in BOSS_DRAW) {
    const pb = new PB(256, 128);
    for (let f = 0; f < 2; f++) { BOSS_DRAW[k](pb, f * 128, f); pb.frame(f, f * 128, 0, 128, 128); }
    pb.toTexture(scene, 'boss_' + k);
  }
}

/* ================= 초상화 (대화창용 64x64) =================
 * 얼굴은 뾰족한 턱선, 앞머리는 갈래, 머리카락엔 빛 띠, 눈은 흰자·홍채·동공·반짝임·속눈썹으로 정성껏 그려요.
 * 피부는 평평한 3단 명암(셀 셰이딩)으로 깔끔하게. */
const NOLINE = { ol: false, line: false, hl: false };
/* 눈: 7x7 점을 손으로 찍은 무늬 (오른쪽 눈 기준, 왼쪽 눈은 좌우로 뒤집어요)
 * K 속눈썹 · 1/2/3 홍채(어두움→밝음) · P 동공 · W 반짝임 · S 흰자 · L 아래 눈꺼풀 */
const EYE_MAP = [
  '.KKKKKK',
  'K11111K',
  'S1WW21S',
  'S1W2P2S',
  'S22P23S',
  '.23332.',
  '..LLL..',
];
function drawEye(pb, x, y, iris, mirror) {
  const r = R(iris, { light: 0.7 });
  const pal = { K: '#2a1830', 1: r[0], 2: r[2], 3: r[3], P: '#1a1024', W: '#ffffff', S: '#f4f0ff', L: '#b07a80' };
  EYE_MAP.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.') pb.set(mirror ? x + 6 - i : x + i, y + j, pal[ch]); }));
}
function blush(pb, pts, a = 0.35) { for (const [x, y] of pts) pb.blend(x, y, '#ff7a8a', a); }
const PORTRAITS = {
  ria(pb) {
    const H = PAL.hair, S = PAL.skin, hs = { amb: 0.45, dither: 0.15 };
    renderParts(pb, 0, 0, 64, 64, [
      Poly([[12, 18], [18, 7], [32, 2], [46, 7], [53, 19], [55, 36], [53, 52], [47, 46], [45, 27], [19, 27], [17, 46], [11, 52], [9, 36]], H, hs),
      Poly([[4, 64], [10, 54], [22, 49], [42, 49], [54, 54], [60, 64]], PAL.tunic, { amb: 0.4 }),
      Poly([[4, 64], [9, 53], [21, 49], [17, 64]], PAL.cape), Poly([[60, 64], [55, 53], [43, 49], [47, 64]], PAL.cape),
      Poly([[25, 49], [39, 49], [32, 58]], PAL.cloth),
      Poly([[28, 40], [37, 40], [38, 50], [27, 50]], S, { flat: 2 }),
      Poly([[28, 40], [37, 40], [37, 44], [28, 45]], S, { flat: 1, line: false }),
      E(32, 51.5, 1.7, 1.7, PAL.gold),
      E(18.5, 31, 2.2, 3.4, S, { flat: 2 }),
      Poly([[19, 19], [45, 19], [47, 28], [45, 36], [40, 42], [34, 46], [30, 46], [24, 42], [20, 36], [18, 28]], S, { flat: 2 }),
      Poly([[18, 28], [20, 36], [24, 42], [28, 45], [23, 35], [21.5, 27]], S, { flat: 1, line: false }),
      Poly([[19, 19], [45, 19], [45.5, 24], [19, 25]], S, { flat: 1, line: false }),
      Cap(15, 15.5, 49, 13.5, 1.1, 1.1, PAL.gold),
      Poly([[14, 22], [16, 10], [25, 5], [38, 5], [48, 10], [51, 21], [48, 29], [45, 21], [42, 30], [38, 20], [34, 28], [30, 19], [26, 29], [23, 20], [19, 30]], H, hs),
      Poly([[16, 22], [21, 24], [20, 41], [16, 47], [14, 35]], H, hs), Poly([[47, 22], [51, 24], [51, 39], [48, 45], [46, 34]], H, hs),
      Cap(20, 11, 27, 8.6, 0.7, 0.7, H, { ...NOLINE, flat: 4 }), Cap(27, 8.6, 37, 8.2, 0.7, 0.7, H, { ...NOLINE, flat: 4 }), Cap(37, 8.2, 44, 10.6, 0.7, 0.7, H, { ...NOLINE, flat: 4 }),
      E(32, 13.6, 1.9, 1.9, R('#5ad0ff', { light: 0.8 }), { flat: 4 }),
    ]);
    renderParts(pb, 0, 0, 64, 64, [
      Cap(23, 26.4, 29, 25.8, 0.55, 0.45, R('#8a8ab0'), { ...NOLINE, flat: 1 }), Cap(36, 25.8, 41.5, 26.4, 0.55, 0.45, R('#8a8ab0'), { ...NOLINE, flat: 1 }),
      Cap(31, 41.2, 35, 41.2, 0.5, 0.5, R('#c05a5a'), { ...NOLINE, flat: 1 }),
    ], { outline: false, inner: false });
    drawEye(pb, 23, 29, '#4a8ae8', true); drawEye(pb, 36, 29, '#4a8ae8', false);
    pb.set(34, 37, '#d89a80');
    blush(pb, [[22, 37], [23, 37], [24, 37], [41, 37], [42, 37], [43, 37]]);
  },
  lumi(pb) {
    const H = R('#ffd462', { light: 0.6 }), S = PAL.skin, wing = R('#c6f0ff', { light: 0.85 }), hs = { amb: 0.45, dither: 0.15 };
    renderParts(pb, 0, 0, 64, 64, [
      Poly([[26, 42], [2, 12], [3, 30], [12, 46]], wing, { alpha: 0.7, ol: false }),
      Poly([[38, 42], [62, 12], [61, 30], [52, 46]], wing, { alpha: 0.7, ol: false }),
      E(14, 14, 6, 6, H, hs), E(50, 14, 6, 6, H, hs),
      E(32, 27, 18, 17, H, hs),
      Poly([[14, 64], [20, 52], [44, 52], [50, 64]], R('#7ee0b8'), { amb: 0.4 }),
      Poly([[29, 42], [35, 42], [36, 52], [28, 52]], S, { flat: 2 }),
      Poly([[21, 22], [43, 22], [45, 30], [43, 37], [38, 43], [32, 46], [26, 43], [21, 37], [19, 30]], S, { flat: 2 }),
      Poly([[19, 30], [21, 37], [26, 43], [29, 45], [24, 36], [22, 28]], S, { flat: 1, line: false }),
      Poly([[21, 22], [43, 22], [43.5, 26], [21, 26.5]], S, { flat: 1, line: false }),
      Poly([[16, 25], [19, 11], [32, 7], [45, 11], [48, 25], [45, 31], [42, 23], [38, 30], [34, 22], [30, 30], [26, 22], [22, 31], [19, 29]], H, hs),
      Cap(22, 13, 30, 10, 0.7, 0.7, H, { ...NOLINE, flat: 4 }), Cap(30, 10, 40, 10.5, 0.7, 0.7, H, { ...NOLINE, flat: 4 }),
      E(47, 12, 3.4, 3.4, R('#ff8ab0'), { flat: 3 }), E(47, 12, 1.2, 1.2, R('#ffe070'), { flat: 4, line: false }),
    ]);
    renderParts(pb, 0, 0, 64, 64, [
    ], { outline: false, inner: false });
    drawEye(pb, 23, 30, '#3ad08a', true); drawEye(pb, 35, 30, '#3ad08a', false);
    for (const [x, y] of [[29, 41], [30, 42], [31, 42], [32, 42], [33, 42], [34, 41]]) pb.set(x, y, '#b0505a');   // 웃는 입
    blush(pb, [[22, 38], [23, 38], [24, 38], [40, 38], [41, 38], [42, 38]], 0.45);
    pb.glow(32, 30, 32, '#fff2a0', 0.22);
  },
  elder(pb) {
    const S = ['#6a4440', '#b88a74', '#e0b090', '#f2cca8', '#fbe4cc'], Wt = R('#ecebf2', { light: 0.8 }); S.lc = '#a87a66'; S.olc = '#4a2a3a'; const beard = { tex: 0.25, ts: [1, 3], amb: 0.45 };
    renderParts(pb, 0, 0, 64, 64, [
      Poly([[2, 64], [10, 50], [32, 45], [54, 50], [62, 64]], R('#4a7a4a'), { amb: 0.4 }),
      Cap(14, 55, 50, 55, 1, 1, PAL.gold),
      E(18, 31, 2.6, 4, S, { flat: 2 }), E(46, 31, 2.6, 4, S, { flat: 2 }),
      E(32, 28, 14, 16, S, { amb: 0.45, dither: 0.15 }),
      E(27, 18, 3, 2, S, { ...NOLINE, flat: 4 }),
      Cap(26, 21, 38, 21, 0.4, 0.4, S, { ...NOLINE, flat: 1 }),
      Poly([[19, 34], [24, 38], [32, 40], [40, 38], [45, 34], [44, 48], [38, 58], [32, 62], [26, 58], [20, 48]], Wt, beard),
      Poly([[23, 38], [32, 35], [41, 38], [37, 41.5], [32, 39], [27, 41.5]], Wt, { amb: 0.5 }),
      E(32, 33, 2.6, 3, S, { amb: 0.5 }),
      E(25, 25, 5, 2.2, Wt, { rough: 0.3, rs: 1.5 }), E(39, 25, 5, 2.2, Wt, { rough: 0.3, rs: 1.5 }),
    ]);
    renderParts(pb, 0, 0, 64, 64, [
      Cap(22, 29.5, 28, 30.5, 0.55, 0.55, R('#4a2a2a'), { ...NOLINE, flat: 0 }), Cap(36, 30.5, 42, 29.5, 0.55, 0.55, R('#4a2a2a'), { ...NOLINE, flat: 0 }),
    ], { outline: false, inner: false });
    blush(pb, [[22, 33], [23, 33], [41, 33], [42, 33]], 0.3);
  },
  lord(pb) {
    const ar = R('#3c3c58', { light: 0.6 }), bone = R('#d8d0c0'), hm = R('#2c2c44', { light: 0.5 });
    renderParts(pb, 0, 0, 64, 64, [
      Poly([[2, 64], [6, 40], [18, 46], [32, 44], [46, 46], [58, 40], [62, 64]], R('#2c1a40'), { tex: 0.12, ts: [1.5, 4] }),
      Poly([[10, 64], [16, 50], [32, 48], [48, 50], [54, 64]], R('#7a1a2a')),
      Poly([[18, 64], [22, 52], [32, 50], [42, 52], [46, 64]], ar),
      E(14, 48, 9, 6, ar), E(50, 48, 9, 6, ar),
      Poly([[8, 46], [4, 38], [12, 43]], bone), Poly([[56, 46], [60, 38], [52, 43]], bone),
      Cap(22, 20, 14, 13, 3.4, 2.4, bone, { grp: 5 }), Cap(14, 13, 11, 3, 2.4, 0.8, bone, { grp: 5 }),
      Cap(42, 20, 50, 13, 3.4, 2.4, bone, { grp: 5 }), Cap(50, 13, 53, 3, 2.4, 0.8, bone, { grp: 5 }),
      Poly([[18, 20], [24, 10], [32, 7], [40, 10], [46, 20], [46, 36], [40, 44], [32, 46], [24, 44], [18, 36]], hm, { amb: 0.4 }),
      Poly([[21, 28], [43, 28], [41, 34], [23, 34]], R('#06030a'), { flat: 0, line: false }),
      Cap(32, 36, 32, 44, 0.5, 0.5, R('#1a1a2a'), { ...NOLINE, flat: 0 }), Cap(28, 37, 28.5, 43, 0.5, 0.5, R('#1a1a2a'), { ...NOLINE, flat: 0 }), Cap(36, 37, 35.5, 43, 0.5, 0.5, R('#1a1a2a'), { ...NOLINE, flat: 0 }),
      E(32, 15, 2.4, 2.4, R('#d060ff', { light: 0.8 }), { flat: 4 }),
    ]);
    pb.rect(25, 30, 4, 2, '#ff4a9a'); pb.rect(35, 30, 4, 2, '#ff4a9a'); pb.rect(26, 30, 2, 1, '#ffd0e8'); pb.rect(36, 30, 2, 1, '#ffd0e8');
    pb.glow(32, 31, 14, '#ff3a8a', 0.55); pb.glow(32, 15, 6, '#d060ff', 0.5);
  },
};
function buildPortraits(scene) {
  for (const k in PORTRAITS) { const pb = new PB(64, 64); PORTRAITS[k](pb); pb.toTexture(scene, 'pt_' + k); }
  // 보스 초상화와 작은 얼굴: 원래 크기 그대로 잘라 써요 (줄이면 점이 고르지 않게 빠져요)
  const crop = (key, srcKey, sx, sy, w, h) => {
    const src = scene.textures.get(srcKey).getSourceImage();
    const t = scene.textures.createCanvas(key, w, h), c = t.getContext();
    c.imageSmoothingEnabled = false;
    c.drawImage(src, sx, sy, w, h, 0, 0, w, h);
    t.refresh();
  };
  crop('pt_treant', 'boss_treant', 32, 44, 64, 64);
  crop('pt_wyrm', 'boss_wyrm', 4, 18, 64, 64);
  crop('face_ria', 'pt_ria', 18, 15, 28, 28);
}

/* ================= 아이템 아이콘 (16x16) ================= */
function iconParts(kind, col) {
  const r = R(col, { light: 0.65 });
  switch (kind) {
    case 'sword': return [
      Poly([[4.5, 10], [12.5, 2], [14, 3.5], [6, 11.5]], r, { bevel: 1 }),
      Cap(2, 9, 7, 14, 1, 1, PAL.gold), Cap(2.5, 13.5, 4.8, 11.2, 1, 1, PAL.belt), E(2, 14, 1.2, 1.2, PAL.gold)];
    case 'armor': return [
      Poly([[3, 4], [6, 2], [10, 2], [13, 4], [12, 13], [8, 15], [4, 13]], r),
      Poly([[6.5, 2], [9.5, 2], [8, 6]], PAL.cloth), Cap(5, 9, 11, 9, 0.8, 0.8, PAL.gold)];
    case 'ring': {
      const P = [];
      for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2, b = (i + 1) / 10 * Math.PI * 2; P.push(Cap(8 + Math.cos(a) * 4.5, 9.5 + Math.sin(a) * 4, 8 + Math.cos(b) * 4.5, 9.5 + Math.sin(b) * 4, 1.3, 1.3, PAL.gold, { grp: 1 })); }
      P.push(E(8, 4.5, 2.6, 2.4, r, { add: 0.1 })); return P;
    }
    case 'feather': return [Poly([[3, 14], [6, 7], [11, 2], [13, 3], [10, 9]], r, { grad: 0.5 }), Cap(2.5, 14.5, 11, 4, 0.5, 0.4, R('#f0f0f0'), { line: false })];
    case 'amulet': return [Cap(3, 2, 8, 7, 0.6, 0.6, PAL.gold), Cap(13, 2, 8, 7, 0.6, 0.6, PAL.gold), Poly([[8, 6], [12.5, 10], [8, 15], [3.5, 10]], r, { add: 0.1 })];
    case 'coin': return [E(8, 8, 6, 6, PAL.gold), E(8, 8, 3.6, 3.6, R('#c08a2a'), { flat: 2, line: false })];
    case 'potion': return [Cap(8, 3, 8, 6, 1.6, 1.6, R('#d8e8f0')), E(8, 2, 1.8, 1.2, PAL.belt), E(8, 10.5, 5, 4.8, r, { add: 0.05 })];
    default: return [Poly([[8, 1], [13, 8], [8, 15], [3, 8]], r, { add: 0.12 })];
  }
}
function buildIcons(scene) {
  const list = Object.entries(ITEMS);
  const extra = [['coin', { icon: 'coin', col: '#e6b44c' }], ['potion', { icon: 'potion', col: '#ff4a6a' }], ['crystal0', { icon: 'crystal', col: '#8aff9a' }], ['crystal1', { icon: 'crystal', col: '#8ae0ff' }], ['crystal2', { icon: 'crystal', col: '#d48aff' }]];
  const all = [...list, ...extra];
  const pb = new PB(16 * all.length, 16);
  all.forEach(([id, it], i) => { renderParts(pb, i * 16, 0, 16, 16, iconParts(it.icon, it.col)); pb.frame(id, i * 16, 0, 16, 16); });
  pb.toTexture(scene, 'icons');
}

/* ================= 효과 ================= */
function buildFx(scene) {
  softTex(scene, 'glow', 64, [[0, 1], [0.25, 0.55], [0.6, 0.15], [1, 0]]);
  softTex(scene, 'shadow', 32, [[0, 0.8], [0.6, 0.35], [1, 0]]);
  { // 충격파 고리
    const t = scene.textures.createCanvas('ring', 64, 64), c = t.getContext();
    c.strokeStyle = 'rgba(255,255,255,0.95)'; c.lineWidth = 3; c.beginPath(); c.arc(32, 32, 28, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 7; c.beginPath(); c.arc(32, 32, 26, 0, Math.PI * 2); c.stroke();
    t.refresh();
  }
  { // 검기 (부드러운 초승달)
    const t = scene.textures.createCanvas('slash', 56, 72), c = t.getContext();
    const g = c.createLinearGradient(0, 0, 56, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.6, 'rgba(255,255,255,0.75)'); g.addColorStop(1, 'rgba(255,255,255,1)');
    c.fillStyle = g; c.beginPath(); c.arc(14, 36, 34, -1.25, 1.25); c.arc(4, 36, 30, 1.2, -1.2, true); c.closePath(); c.fill();
    t.refresh();
  }
  { // 빛줄기
    const t = scene.textures.createCanvas('ray', 32, 256), c = t.getContext();
    const g = c.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    const h = c.createLinearGradient(0, 0, 32, 0); h.addColorStop(0, 'rgba(0,0,0,1)'); h.addColorStop(0.5, 'rgba(0,0,0,0)'); h.addColorStop(1, 'rgba(0,0,0,1)');
    c.fillStyle = g; c.fillRect(0, 0, 32, 256);
    c.globalCompositeOperation = 'destination-out'; c.fillStyle = h; c.fillRect(0, 0, 32, 256);
    t.refresh();
  }
  { // 줄 뒤 어두운 띠
    const t = scene.textures.createCanvas('laneDark', 64, 48), c = t.getContext();
    const g = c.createLinearGradient(0, 0, 0, 48); g.addColorStop(0, 'rgba(6,4,16,0)'); g.addColorStop(0.5, 'rgba(6,4,16,0.34)'); g.addColorStop(1, 'rgba(6,4,16,0)');
    c.fillStyle = g; c.fillRect(0, 0, 64, 48);
    // 왼쪽 끝은 부드럽게 사라지게 (딱 잘린 경계가 안 보이게)
    const h = c.createLinearGradient(0, 0, 16, 0); h.addColorStop(0, 'rgba(0,0,0,1)'); h.addColorStop(1, 'rgba(0,0,0,0)');
    c.globalCompositeOperation = 'destination-out'; c.fillStyle = h; c.fillRect(0, 0, 16, 48); t.refresh();
  }
  { // 줄 띠 (판정선에서 오른쪽으로 옅어짐)
    const t = scene.textures.createCanvas('lane', GW - JX, 22), c = t.getContext();
    const g = c.createLinearGradient(0, 0, GW - JX, 0); g.addColorStop(0, 'rgba(255,255,255,0.2)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, GW - JX, 22);
    const g2 = c.createLinearGradient(0, 0, GW - JX, 0); g2.addColorStop(0, 'rgba(255,255,255,0.5)'); g2.addColorStop(1, 'rgba(255,255,255,0.12)');
    c.fillStyle = g2; c.fillRect(0, 0, GW - JX, 1); c.fillRect(0, 21, GW - JX, 1);
    t.refresh();
  }
  { // 안개 띠
    const t = scene.textures.createCanvas('mist', 256, 48), c = t.getContext(), r = mulberry32(5);
    for (let i = 0; i < 26; i++) {
      const x = r() * 256, y = 16 + r() * 16, rad = 14 + r() * 18;
      for (const ox of [0, -256, 256]) { const g = c.createRadialGradient(x + ox, y, 0, x + ox, y, rad); g.addColorStop(0, 'rgba(255,255,255,0.22)'); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(x + ox - rad, y - rad, rad * 2, rad * 2); }
    }
    t.refresh();
  }
  { const pb = new PB(2, 2); pb.rect(0, 0, 2, 2, '#ffffff'); pb.toTexture(scene, 'px'); }
  { const pb = new PB(7, 7); pb.rect(3, 0, 1, 7, '#ffffff'); pb.rect(0, 3, 7, 1, '#ffffff'); pb.rect(2, 2, 3, 3, '#ffffff'); pb.toTexture(scene, 'spark'); }
  { const pb = new PB(5, 3); pb.rect(1, 0, 3, 1, '#ffffff'); pb.rect(0, 1, 5, 1, '#ffffff'); pb.rect(1, 2, 2, 1, '#ffffff'); pb.toTexture(scene, 'leaf'); }
  // 긴 노트 머리(룬 보석)와 꼬리
  [0, 1].forEach(l => {
    const col = l === 0 ? '#8fe0ff' : '#ffc46a';
    const pb = new PB(20, 20);
    renderParts(pb, 0, 0, 20, 20, [Poly([[10, 1.5], [18, 10], [10, 18.5], [2, 10]], R(col, { light: 0.75 }), { add: 0.1, bevel: 2.2 }), E(10, 10, 2.6, 2.6, R('#ffffff'), { flat: 4, line: false })]);
    pb.glow(10, 10, 10, col, 0.6); pb.toTexture(scene, 'rune' + l);
    const pt = new PB(12, 12);
    renderParts(pt, 0, 0, 12, 12, [Poly([[6, 1.5], [10.5, 6], [6, 10.5], [1.5, 6]], R(col, { light: 0.75 }), { add: 0.1 })]);
    pt.toTexture(scene, 'runeT' + l);
  });
  { // 회복 물약
    const pb = new PB(16, 18);
    renderParts(pb, 0, 0, 16, 18, [Cap(8, 3, 8, 7, 2, 2, R('#d8e8f0', { light: 0.8 })), E(8, 2.4, 2.4, 1.5, PAL.belt), E(8, 11.5, 6, 5.6, R('#ff4a6a', { light: 0.7 }), { add: 0.06 }), E(6, 9.5, 1.6, 1.2, R('#ffffff'), { flat: 4, ol: false, line: false })]);
    pb.glow(8, 11, 9, '#ff6a8a', 0.4); pb.toTexture(scene, 'potion');
  }
  { // 동전
    const pb = new PB(9, 9);
    renderParts(pb, 0, 0, 9, 9, [E(4.5, 4.5, 3.6, 3.6, PAL.gold), E(4.5, 4.5, 1.6, 2.2, R('#c08a2a'), { flat: 2, line: false })]);
    pb.toTexture(scene, 'coin');
  }
  { // 메뉴 커서 (보석 화살)
    const pb = new PB(10, 11);
    renderParts(pb, 0, 0, 10, 11, [Poly([[1, 1], [9, 5.5], [1, 10], [3, 5.5]], R('#ffd88a', { light: 0.75 }), { add: 0.1 })]);
    pb.toTexture(scene, 'cursor');
  }
}

function buildAllArt(scene) {
  buildFx(scene);
  buildHero(scene);
  buildLumi(scene);
  buildEnemies(scene);
  buildBosses(scene);
  buildPortraits(scene);
  buildIcons(scene);
}
