'use strict';
/* 배경 (2.5D)
 * - 하늘·구름·산·먼 숲 : 멀리 있는 그림 겹 (미리 흐리게 구워 둠 → 실행 중엔 가벼움)
 * - 원근 바닥 : 셰이더로 그려요. 멀수록 촘촘하고 안개가 껴요.
 * - 소품 : 바닥 위 여러 깊이에 세워 둔 풀숲·바위·수정… 멀수록 작고 느리게 지나가요.
 * 그림은 그 장소에 처음 갈 때 한 번만 만들어요. */

const TW = 512;               // 겹 그림 가로 크기 (이어 붙여 반복)
const YH = 150;               // 원근 소실선 높이
const PK = 64;                // 깊이 계산 상수: 깊이 z 인 곳의 화면 높이 = YH + PK / z  (z=1 → 땅 214)
const FLOOR_TOP = 170;        // 바닥이 시작되는 화면 높이 (z ≈ 3.2)
const VCX = GW / 2;           // 소실점 x
const zToY = z => YH + PK / z;

/* 가로로 반복되는 그림이 끊기지 않게, 경계 근처 모양은 왼쪽/오른쪽에 한 번 더 그려요 */
function wrapParts(parts, W = TW) {
  const out = [];
  for (const p of parts) {
    out.push(p);
    for (const dx of [-W, W]) {
      const q = Object.assign({}, p);
      if (q.t === 'e') q.x += dx;
      else if (q.t === 'c') { q.x1 += dx; q.x2 += dx; }
      else q.pts = q.pts.map(([x, y]) => [x + dx, y]);
      out.push(q);
    }
  }
  return out;
}
// 가로로 이어지는 노이즈 (끝과 처음이 자연스럽게 이어짐)
function tileN(n, x, y, W, sc, oct = 3) {
  const t = x / W;
  return n(x / sc, y / sc, oct) * (1 - t) + n((x - W) / sc, y / sc, oct) * t;
}

function skyTex(scene, key, stops, extra) {
  const t = scene.textures.createCanvas(key, GW, GH), c = t.getContext();
  const g = c.createLinearGradient(0, 0, 0, GH);
  stops.forEach(([o, col]) => g.addColorStop(o, col));
  c.fillStyle = g; c.fillRect(0, 0, GW, GH);
  if (extra) extra(c);
  t.refresh();
}
function radial(c, x, y, r, rgba0) {
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, rgba0); g.addColorStop(1, rgba0.replace(/[\d.]+\)$/, '0)'));
  c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
}
function starsOn(c, n, seed, maxY) {
  const r = mulberry32(seed);
  for (let i = 0; i < n; i++) {
    const a = 0.3 + r() * 0.7, x = Math.floor(r() * GW), y = Math.floor(r() * maxY);
    c.fillStyle = `rgba(255,255,255,${a.toFixed(2)})`; c.fillRect(x, y, 1, 1);
    if (r() < 0.08) { c.fillStyle = `rgba(255,255,255,${(a * 0.35).toFixed(2)})`; c.fillRect(x - 1, y, 3, 1); c.fillRect(x, y - 1, 1, 3); }
  }
}

/* 산맥: 비탈 방향에 따라 밝기를 바꾸고, 아래로 갈수록 안개 색 */
function mountainPB(h, seed, col, fog, snow, amp = 1) {
  const pb = new PB(TW, h), r = mulberry32(seed), ph = [r() * 6, r() * 6, r() * 6], n = makeNoise(seed);
  const H = x => {
    const a = 2 * Math.PI * x / TW;
    return (0.5 + 0.22 * Math.sin(a * 2 + ph[0]) + 0.13 * Math.sin(a * 5 + ph[1]) + 0.06 * Math.sin(a * 13 + ph[2]) + 0.03 * Math.sin(a * 29)) * h * 0.8 * amp;
  };
  const lit = mixHex(col, '#fff6e8', 0.22), shd = mixHex(col, '#000020', 0.2);
  for (let x = 0; x < TW; x++) {
    const hx = H(x), top = Math.round(h - hx), slope = H(x + 1.5) - H(x - 1.5);
    for (let y = Math.max(0, top); y < h; y++) {
      const depth = (y - top) / Math.max(1, h - top);
      const rid = tileN(n, x, y * 2, TW, 9) - 0.5;     // 능선 무늬
      let cc = slope + rid * 2 > 0.2 ? lit : slope + rid * 2 < -0.2 ? shd : col;
      if (snow && hx > h * 0.45 && y - top < 3 + rid * 8 + (x % 3)) cc = snow;
      pb.set(x, y, mixHex(cc, fog, clamp(depth * 0.8, 0, 0.8)));
    }
  }
  return pb;
}

/* 나무: 잎 덩어리 가장자리가 울퉁불퉁하고, 껍질에 세로 결이 있어요 */
function treeParts(x, base, s, R1, R2, bark, rnd) {
  const P = [], bk = { grad: 0.4, tex: 0.35, ts: [1.2, 5] };
  P.push(Poly([[x - 5 * s, base], [x - 3.5 * s, base - 40 * s], [x - 3 * s, base - 72 * s], [x + 3 * s, base - 72 * s], [x + 4 * s, base - 40 * s], [x + 5 * s, base]], bark, bk));
  P.push(Cap(x - 2 * s, base - 4, x - 13 * s, base + 1, 3.4 * s, 1.4, bark, bk), Cap(x + 2 * s, base - 4, x + 14 * s, base + 1, 3.4 * s, 1.4, bark, bk));
  P.push(Cap(x, base - 48 * s, x - 22 * s, base - 72 * s, 2.8 * s, 1.2, bark, bk), Cap(x, base - 56 * s, x + 21 * s, base - 82 * s, 2.8 * s, 1.2, bark, bk));
  const lf = { amb: 0.28, rough: 0.16, rs: 2.4, tex: 0.3, ts: [2, 2] };
  for (let i = 0; i < 15; i++) {
    const a = rnd() * Math.PI * 2, d = rnd() * 26 * s;
    P.push(E(x + Math.cos(a) * d * 1.3, base - 84 * s + Math.sin(a) * d * 0.7, (13 + rnd() * 12) * s, (10 + rnd() * 8) * s, i < 5 ? R2 : R1, lf));
  }
  return P;
}

/* ---------- 소품 그림 (바닥 위에 세워 둠). 아래쪽에 그림자도 같이 구워요 ---------- */
function propTex(scene, key, w, h, parts, o = {}) {
  const pb = new PB(w, h);
  // 바닥 그림자
  const sw = o.shw || w * 0.42;
  for (let y = h - 5; y < h; y++) for (let x = 0; x < w; x++) {
    const u = (x + 0.5 - w / 2) / sw, v = (y + 0.5 - (h - 2.5)) / 2.5, d = u * u + v * v;
    if (d < 1) pb.blend(x, y, '#000000', 0.35 * (1 - d));
  }
  renderParts(pb, 0, 0, w, h, parts);
  if (o.glow) o.glow.forEach(g => pb.glow(...g));
  pb.toTexture(scene, key);
  const pb2 = new PB(w, h); pb2.d.set(pb.d); pb2.glows = pb.glows; pb2.blur(1).toTexture(scene, key + '_b');
}

const PROP_DEFS = {
  forest(scene, k, r) {
    const leaf = R('#4a9a3c', { light: 0.55 }), leaf2 = R('#2f7a34', { light: 0.5 }), lf = { amb: 0.3, rough: 0.2, rs: 2, tex: 0.3, ts: [2, 2] };
    const bush = (key, n) => { const P = []; for (let i = 0; i < n; i++) P.push(E(10 + i * 7 + r() * 4, 24 - r() * 8, 8 + r() * 4, 7 + r() * 3, i % 2 ? leaf2 : leaf, lf)); propTex(scene, k + key, 14 + n * 7, 34, P); };
    bush('bush1', 3); bush('bush2', 4);
    { const P = []; for (let i = 0; i < 7; i++) { const x = 4 + i * 3 + r() * 2, hh = 8 + r() * 8; P.push(Cap(x, 22, x + (r() - 0.5) * 3, 22 - hh, 0.6, 0.4, R('#3a8a34'), { line: false })); P.push(E(x + (r() - 0.5) * 3, 22 - hh, 1.8, 1.6, R(pick(r, ['#ff8ab0', '#ffe070', '#ffffff', '#b8a0ff'])), { add: 0.05 })); } propTex(scene, k + 'flower', 26, 26, P); }
    propTex(scene, k + 'mush', 22, 22, [Cap(8, 19, 8, 12, 1.8, 1.5, R('#f0e8d8')), E(8, 11, 6, 3.6, R('#d8402e', { light: 0.6 })), Cap(15, 19, 15, 14, 1.3, 1.1, R('#f0e8d8')), E(15, 13.5, 4, 2.6, R('#d8402e', { light: 0.6 }))]);
    propTex(scene, k + 'rock', 28, 22, [E(14, 14, 11, 7, R('#8a8478'), { rough: 0.1, rs: 2, tex: 0.25, amb: 0.3 }), E(9, 9, 3, 1.5, R('#6aa84a'), { tex: 0.3, rough: 0.2, line: false })]);
    { const P = []; for (let i = 0; i < 9; i++) { const x = 3 + i * 2.2, hh = 8 + r() * 10; P.push(Poly([[x - 1.2, 22], [x + (r() - 0.5) * 6, 22 - hh], [x + 1.2, 22]], i % 2 ? R('#4aa040') : R('#3a8034'), { ol: false })); } propTex(scene, k + 'tuft', 24, 24, P, { shw: 8 }); }
    propTex(scene, k + 'stump', 26, 22, [Cap(13, 18, 13, 9, 7, 7, R('#6e4a30'), { tex: 0.3, ts: [1, 4] }), E(13, 9, 7, 2.6, R('#c8a070'), { tex: 0.2 }), Cap(5, 18, 2, 20, 2, 1, R('#6e4a30'))]);
    return { back: ['bush1', 'bush2', 'flower', 'mush', 'rock', 'tuft', 'stump', 'bush1', 'flower', 'tuft'], front: ['tuft', 'flower'] };
  },
  cave(scene, k, r) {
    const cr = col => R(col, { light: 0.78 });
    const crystal = (key, col, n) => {
      const P = [E(16, 30, 12, 4, R('#2e2a58'), { rough: 0.15 })];
      for (let i = 0; i < n; i++) { const a = (r() - 0.5) * 1.1, len = 10 + r() * 18, w = 2.5 + r() * 2.5, bx = 16 + (r() - 0.5) * 14, d = dirv(Math.PI + a, len); P.push(Poly([[bx - w, 30], [bx - w * 0.7 + d[0], 30 + d[1] * 0.85], [bx + d[0], 30 + d[1]], [bx + w * 0.7 + d[0], 30 + d[1] * 0.85], [bx + w, 30]], cr(col), { add: 0.08, bevel: 2 })); }
      propTex(scene, k + key, 32, 34, P, { glow: [[16, 18, 18, col, 0.45]] });
    };
    crystal('crysA', '#6ad8ff', 5); crystal('crysB', '#d07aff', 4); crystal('crysC', '#6ad8ff', 3);
    propTex(scene, k + 'stalag', 20, 40, [Poly([[2, 38], [8, 12], [10, 2], [12, 14], [18, 38]], R('#3a3666'), { tex: 0.3, ts: [1, 4], grad: 0.3 })]);
    propTex(scene, k + 'rock', 28, 20, [E(14, 13, 11, 6.5, R('#3a3666'), { rough: 0.12, tex: 0.3, amb: 0.3 })]);
    { const P = []; for (let i = 0; i < 3; i++) { const x = 6 + i * 6; P.push(Cap(x, 18, x, 12 - i, 1, 0.8, R('#a0b8e0'))); P.push(E(x, 11 - i, 3.4, 2, R('#5ae0ff', { light: 0.8 }), { add: 0.15 })); } propTex(scene, k + 'shroom', 24, 22, P, { glow: [[12, 12, 12, '#5ae0ff', 0.55]] }); }
    return { back: ['crysA', 'crysB', 'stalag', 'rock', 'shroom', 'crysC', 'rock', 'shroom'], front: ['shroom', 'rock'] };
  },
  castle(scene, k, r) {
    const st = R('#5a5878', { light: 0.5 }), stt = { tex: 0.3, ts: [2, 2], amb: 0.3 };
    propTex(scene, k + 'grave1', 20, 30, [Poly([[3, 28], [3, 9], [6, 4], [14, 4], [17, 9], [17, 28]], st, stt), Cap(10, 9, 10, 18, 0.8, 0.8, R('#3a3850'), { flat: 1, line: false }), Cap(7, 12, 13, 12, 0.8, 0.8, R('#3a3850'), { flat: 1, line: false }), E(5, 26, 4, 2, R('#4a6a3a'), { rough: 0.3 })]);
    propTex(scene, k + 'grave2', 24, 24, [Poly([[2, 22], [3, 8], [12, 3], [21, 8], [22, 22]], st, stt)]);
    propTex(scene, k + 'pillar', 22, 46, [Poly([[4, 44], [4, 8], [8, 4], [12, 7], [18, 2], [18, 44]], st, { ...stt, grad: 0.3 }), Poly([[1, 44], [21, 44], [21, 39], [1, 39]], st, stt), Cap(6, 30, 16, 20, 1.6, 1.2, R('#3a5a32'), { rough: 0.3, line: false })]);
    { const P = [], dk = R('#2c2236'); const br = (x, y, a, l, w, d) => { const e2 = vadd([x, y], dirv(a, l)); P.push(Cap(x, y, e2[0], e2[1], w, w * 0.6, dk, { grp: 1 })); if (d) { br(e2[0], e2[1], a - 0.5, l * 0.7, w * 0.6, d - 1); br(e2[0], e2[1], a + 0.45, l * 0.7, w * 0.6, d - 1); } }; br(14, 28, Math.PI, 9, 1.8, 3); propTex(scene, k + 'dead', 28, 30, P); }
    propTex(scene, k + 'lamp', 14, 40, [Cap(7, 38, 7, 12, 1.2, 1, R('#1a1420')), Poly([[3, 12], [11, 12], [9, 4], [5, 4]], R('#2a2030')), E(7, 9, 2.4, 3, R('#ffc060', { light: 0.85 }), { add: 0.25, ol: false })], { glow: [[7, 9, 14, '#ffa040', 0.6]] });
    propTex(scene, k + 'rock', 26, 18, [E(13, 11, 10, 6, R('#4a4660'), { rough: 0.12, tex: 0.3, amb: 0.3 })]);
    return { back: ['grave1', 'grave2', 'pillar', 'dead', 'lamp', 'rock', 'grave1', 'dead'], front: ['rock'] };
  },
  town(scene, k, r) {
    const wood = R('#8a5a34', { light: 0.5 }), wd = { tex: 0.3, ts: [1, 4] };
    propTex(scene, k + 'barrel', 20, 26, [Cap(10, 22, 10, 8, 7, 7, wood, wd), Cap(3.5, 11, 16.5, 11, 0.9, 0.9, R('#4a4a50'), { line: false }), Cap(3.5, 19, 16.5, 19, 0.9, 0.9, R('#4a4a50'), { line: false }), E(10, 7, 6.6, 2.2, R('#6a4428'))]);
    propTex(scene, k + 'crate', 22, 24, [Poly([[2, 22], [2, 6], [20, 6], [20, 22]], wood, wd), Cap(3, 7, 19, 21, 1, 1, R('#6a4428'), { line: false }), Cap(19, 7, 3, 21, 1, 1, R('#6a4428'), { line: false })]);
    { const P = [Poly([[5, 24], [4, 15], [18, 15], [17, 24]], R('#b8603a'))]; for (let i = 0; i < 5; i++) P.push(E(6 + i * 2.6, 12 - (i % 2) * 2, 2.4, 2.2, R(pick(r, ['#ff8ab0', '#ffe070', '#ff6a5a'])))); P.push(E(11, 14, 7, 2, R('#4a9a3c'), { rough: 0.3 })); propTex(scene, k + 'pot', 22, 26, P); }
    const leaf = R('#4a9a3c', { light: 0.55 });
    propTex(scene, k + 'bush', 30, 28, [E(9, 19, 8, 7, leaf, { rough: 0.2, tex: 0.3 }), E(20, 18, 9, 8, leaf, { rough: 0.2, tex: 0.3 }), E(14, 13, 7, 6, leaf, { rough: 0.2, tex: 0.3 })]);
    return { back: ['barrel', 'crate', 'pot', 'bush', 'pot', 'barrel'], front: ['pot'] };
  },
};

/* ---------- 바닥 무늬 (위에서 내려다본 그림, 256x256) ---------- */
// v=64 줄 근처(깊이 1)가 캐릭터가 달리는 길이에요
const FLOOR_DEFS = {
  forest(pb, n, r) {
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
      const v = tileN(n, x, y, 256, 14), v2 = tileN(n, x + 70, y * 3, 256, 4);
      const edge = 18 + (tileN(n, x, 7, 256, 10) - 0.5) * 12;
      const onRoad = Math.abs(y - 64) < edge;
      let c;
      if (onRoad) {
        c = mixHex('#a07850', '#7a5434', clamp(v + (v2 - 0.5) * 0.5, 0, 1));
        if (Math.abs(Math.abs(y - 64) - 8) < 1.2 && v2 > 0.35) c = mixHex(c, '#5e4028', 0.5);   // 바퀴 자국
      } else {
        c = mixHex('#6ab84a', '#3a7a30', clamp(v * 1.1 + (v2 - 0.5) * 0.6, 0, 1));
        if (v2 > 0.72) c = '#86cc5a';
        if (Math.abs(Math.abs(y - 64) - edge) < 1.5) c = mixHex(c, '#3a6a28', 0.4);
      }
      pb.set(x, y, c);
    }
    const P = [];
    for (let i = 0; i < 16; i++) { const y = 64 + (r() - 0.5) * 28; P.push(E(r() * 256, y, 1.2 + r() * 1.4, 0.8 + r() * 0.6, R('#7e7464'), { amb: 0.35, hl: false })); }
    renderParts(pb, 0, 0, 256, 256, wrapParts(P, 256), { ol: '#5a4030' });
    for (let i = 0; i < 260; i++) { const x = r() * 256, y = r() * 256; if (Math.abs(y - 64) < 26) continue; pb.set(x, y, pick(r, ['#ffffff', '#ffe070', '#ff9ac0', '#c8b0ff'])); }
  },
  cave(pb, n, r) {
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
      const v = tileN(n, x, y, 256, 12), v2 = tileN(n, x + 30, y * 2, 256, 3);
      let c = mixHex('#3e3a6c', '#1a1834', clamp(v * 1.2 + (v2 - 0.5) * 0.5, 0, 1));
      if (Math.abs(y - 64) < 20) c = mixHex(c, '#4a467a', 0.35);
      if (Math.abs(v - 0.5) < 0.012) c = '#141228';                     // 갈라진 금
      pb.set(x, y, c);
    }
    for (let i = 0; i < 60; i++) { const x = r() * 256, y = r() * 256, col = r() < 0.5 ? '#7ae8ff' : '#e090ff'; pb.set(x, y, col); pb.set(x + 1, y, mixHex(col, '#000000', 0.4)); if (r() < 0.4) pb.glow(x, y, 5, col, 0.35); }
  },
  castle(pb, n, r) {
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
      const v = tileN(n, x, y, 256, 10);
      pb.set(x, y, mixHex('#2c2838', '#1a1622', clamp(v, 0, 1)));
    }
    const P = [], stn = R('#5a5670', { light: 0.45 });
    for (let row = 0; row < 7; row++) for (let i = 0; i < 16; i++) { const x = i * 16 + (row % 2) * 8, y = 40 + row * 7; P.push(E(x, y, 7, 3, stn, { amb: 0.35, tex: 0.25, rough: 0.08 })); }
    renderParts(pb, 0, 0, 256, 256, wrapParts(P, 256), { ol: '#100e18' });
    for (let i = 0; i < 80; i++) { const x = r() * 256, y = r() * 256; if (y > 34 && y < 94) continue; pb.set(x, y, '#4a4060'); }
  },
  town(pb, n, r) {
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) pb.set(x, y, mixHex('#5a4c40', '#3a3028', tileN(n, x, y, 256, 10)));
    const P = [], stn = R('#b0a088', { light: 0.5 });
    for (let row = 0; row < 36; row++) for (let i = 0; i < 18; i++) { const x = i * 14.2 + (row % 2) * 7, y = row * 7.1; P.push(E(x, y, 6, 3, stn, { amb: 0.35, tex: 0.25, rough: 0.08 })); }
    renderParts(pb, 0, 0, 256, 256, wrapParts(P, 256), { ol: '#2a221c' });
  },
};

const FLOOR_FRAG = `
precision mediump float;
uniform vec2 resolution;
uniform sampler2D iChannel0;
uniform float uScroll;
uniform float uCam;
uniform vec3 uFog;
varying vec2 fragCoord;
void main() {
  float sy = ${FLOOR_TOP.toFixed(1)} + (resolution.y - fragCoord.y);
  float z = ${PK.toFixed(1)} / max(sy - ${YH.toFixed(1)}, 1.0);
  vec2 uv = vec2((fragCoord.x - ${VCX.toFixed(1)} - uCam * (1.0 - 1.0 / z)) * z + uScroll, z * 64.0) / 256.0;
  vec3 c;
  if (z < 1.3) {
    c = texture2D(iChannel0, (floor(fract(uv) * 256.0) + 0.5) / 256.0).rgb;
  } else {
    float o = z / 768.0;
    c = (texture2D(iChannel0, fract(uv)).rgb + texture2D(iChannel0, fract(uv + vec2(o, 0.0))).rgb + texture2D(iChannel0, fract(uv - vec2(o, 0.0))).rgb) / 3.0;
  }
  c = mix(c, uFog, clamp((z - 1.15) / 2.1, 0.0, 1.0) * 0.7);
  c *= mix(1.0, 0.7, clamp((sy - 232.0) / 38.0, 0.0, 1.0));
  gl_FragColor = vec4(c, 1.0);
}`;

const THEMES = {
  forest: {
    mist: 0xfff4e0, rays: 0xfff2c0, amb: 'pollen', fog: '#c0d8e8', light: 'rgba(255,230,170,0.22)', ambient: 0xfff6ea,
    build(scene, k) {
      skyTex(scene, k + 'sky', [[0, '#3a7cc8'], [0.45, '#86bfe8'], [0.62, '#d8e8f0'], [1, '#d8e8f0']], c => {
        radial(c, 380, 52, 130, 'rgba(255,240,200,0.7)'); radial(c, 380, 52, 22, 'rgba(255,255,240,1)');
      });
      const r = mulberry32(11);
      { const pb = new PB(TW, 120), P = [];
        for (let k2 = 0; k2 < 7; k2++) { const cx = r() * TW, cy = 30 + r() * 50; for (let i = 0; i < 8; i++) P.push(E(cx + (r() - 0.5) * 64, cy + (r() - 0.5) * 12 - i, 11 + r() * 14, 7 + r() * 6, R('#fff4ea', { light: 0.7, dark: 0.28, shadowHue: 0.62 }), { amb: 0.55, ol: false, line: false, rough: 0.1, rs: 4 })); }
        renderParts(pb, 0, 0, TW, 120, wrapParts(P), { outline: false }); pb.blur(1, true).toTexture(scene, k + 'cloud'); }
      mountainPB(110, 3, '#6f8fbf', '#b8d0e8', '#f4f8ff').blur(1, true).toTexture(scene, k + 'mtn');
      { const pb = new PB(TW, 110), P = [], tr = R('#6a9a88', { light: 0.35, dark: 0.35 });
        for (let x = 0; x < TW; x += 8 + r() * 8) { const h = 36 + r() * 44; P.push(E(x, 110 - h, 9 + r() * 7, h * 0.5, tr, { amb: 0.55, line: false, rough: 0.12, rs: 3 })); }
        renderParts(pb, 0, 0, TW, 110, wrapParts(P), { outline: false, inner: false });
        pb.rect(0, 100, TW, 10, '#6a9a88'); pb.toTexture(scene, k + 'far'); }
      { const pb = new PB(TW, 214), P = [], bark = R('#5a3e2c'), l1 = R('#4a8a3e', { light: 0.5 }), l2 = R('#336a36', { light: 0.45 });
        for (const x of [30, 140, 230, 340, 440]) P.push(...treeParts(x + r() * 20, 214, 0.85 + r() * 0.3, l1, l2, bark, r));
        for (let x = 0; x < TW; x += 18) P.push(E(x + r() * 10, 212, 13 + r() * 8, 9 + r() * 4, l2, { amb: 0.3, rough: 0.2, rs: 2, tex: 0.3 }));
        renderParts(pb, 0, 0, TW, 214, wrapParts(P)); pb.toTexture(scene, k + 'near'); }
    },
    layers: [
      { key: 'cloud', y: 6, sp: 0.03, drift: 6 },
      { key: 'mtn', y: 86, sp: 0.05 },
      { key: 'far', y: 96, sp: 0.12 },
      { key: 'near', y: FLOOR_TOP + 4 - 214, sp: 0.3 },
      { key: 'mist', y: FLOOR_TOP - 26, sp: 0.2, alpha: 0.55, mist: true },
    ],
  },
  cave: {
    mist: 0x6a7ad8, amb: 'sparkle', fog: '#2a2a5a', ambient: 0xc8d4ff, light: 'rgba(120,180,255,0.16)',
    build(scene, k) {
      skyTex(scene, k + 'sky', [[0, '#04050e'], [0.5, '#121034'], [1, '#1e1a46']], c => {
        radial(c, 120, 140, 140, 'rgba(90,140,255,0.25)'); radial(c, 380, 120, 120, 'rgba(200,100,255,0.2)');
      });
      const r = mulberry32(21);
      { const pb = new PB(TW, GH), P = [], rock = R('#262452', { light: 0.3 });
        for (let x = 0; x < TW; x += 14 + r() * 16) { const h = 30 + r() * 60; P.push(Poly([[x - 9, 0], [x + 9, 0], [x + 1, h]], rock, { amb: 0.5, tex: 0.3, ts: [1, 4] })); }
        for (let x = 0; x < TW; x += 16 + r() * 18) { const h = 40 + r() * 80; P.push(Poly([[x - 11, 200], [x + 11, 200], [x + 1, 200 - h]], rock, { amb: 0.5, tex: 0.3, ts: [1, 4] })); }
        renderParts(pb, 0, 0, TW, GH, wrapParts(P), { outline: false, inner: false });
        pb.rect(0, 196, TW, 74, '#262452');
        for (let i = 0; i < 30; i++) { const x = r() * TW, y = r() < 0.5 ? 20 + r() * 40 : 120 + r() * 60; pb.set(x, y, '#9ae8ff'); pb.glow(x, y, 6, r() < 0.5 ? '#6ad8ff' : '#d07aff', 0.4); }
        pb.blur(1, true).toTexture(scene, k + 'far'); }
      { const pb = new PB(TW, GH), P = [], rk = R('#1e1a3c', { light: 0.35 }), gl = [];
        for (const x of [60, 250, 420]) { const w = 18 + r() * 14; P.push(Poly([[x - w, 200], [x - w * 0.6, 150], [x - w * 0.4, 60], [x - w * 0.7, 0], [x + w * 0.7, 0], [x + w * 0.5, 70], [x + w * 0.7, 160], [x + w, 200]], rk, { grad: 0.3, tex: 0.3, ts: [1.5, 5] })); }
        for (let x = 0; x < TW; x += 30 + r() * 30) P.push(Poly([[x - 8, 0], [x + 8, 0], [x + 1, 20 + r() * 28]], rk, { tex: 0.3, ts: [1, 4] }));
        for (let i = 0; i < 5; i++) { const x = 60 + i * 100 + r() * 30, col = r() < 0.5 ? '#6ad8ff' : '#d07aff'; for (let j = 0; j < 4; j++) { const a = (r() - 0.5) * 1.2, len = 10 + r() * 22, w = 2.5 + r() * 2.5, bx = x + (r() - 0.5) * 16, d = dirv(a, len); P.push(Poly([[bx - w, 4], [bx - w * 0.7 + d[0], 4 + d[1] * 0.85], [bx + d[0], 4 + d[1]], [bx + w * 0.7 + d[0], 4 + d[1] * 0.85], [bx + w, 4]], R(col, { light: 0.75 }), { add: 0.06, bevel: 2 })); } gl.push([x, 22, col]); }
        renderParts(pb, 0, 0, TW, GH, wrapParts(P));
        for (const [x, y, col] of gl) pb.glow(x, y, 34, col, 0.35);
        pb.toTexture(scene, k + 'near'); }
    },
    layers: [
      { key: 'far', y: 0, sp: 0.08 },
      { key: 'near', y: FLOOR_TOP + 4 - 200, sp: 0.28 },
      { key: 'mist', y: FLOOR_TOP - 26, sp: 0.15, alpha: 0.4, mist: true },
    ],
  },
  castle: {
    mist: 0x9a7ad8, rays: 0xc8b8ff, amb: 'petal', fog: '#3a2c58', ambient: 0xd8ccf4, light: 'rgba(200,190,255,0.14)',
    build(scene, k) {
      skyTex(scene, k + 'sky', [[0, '#05040f'], [0.5, '#1c1240'], [0.85, '#4a2858'], [1, '#4a2858']], c => {
        starsOn(c, 160, 31, 150);
        radial(c, 110, 58, 110, 'rgba(220,200,255,0.35)');
      });
      const r = mulberry32(31);
      { const pb = new PB(64, 64);
        renderParts(pb, 0, 0, 64, 64, [E(32, 32, 26, 26, R('#f0ecd8', { light: 0.8, dark: 0.35 }), { amb: 0.6, ol: false, tex: 0.15, ts: [5, 5] }), E(24, 24, 5, 4, R('#d8d0c0'), { flat: 2, line: false, ol: false, rough: 0.2 }), E(40, 38, 7, 5, R('#d8d0c0'), { flat: 2, line: false, ol: false, rough: 0.2 }), E(36, 18, 3, 3, R('#d8d0c0'), { flat: 2, line: false, ol: false })], { outline: false });
        pb.toTexture(scene, k + 'moon'); }
      { const pb = new PB(TW, 120), P = [];
        for (let i = 0; i < 9; i++) { const cx = r() * TW, cy = 20 + r() * 80; for (let j = 0; j < 4; j++) P.push(E(cx + j * 20 - 30, cy + (r() - 0.5) * 6, 26 + r() * 20, 3 + r() * 3, R('#3a2c5a', { light: 0.45 }), { amb: 0.5, ol: false, line: false, alpha: 0.85, rough: 0.15, rs: 4 })); }
        renderParts(pb, 0, 0, TW, 120, wrapParts(P), { outline: false }); pb.blur(1, true).toTexture(scene, k + 'cloud'); }
      { const pb = mountainPB(150, 9, '#241a3c', '#4a2c5a', null, 0.8), P = [], st = R('#2a2040', { light: 0.3 });
        const cx = 300, base = 70;
        P.push(Poly([[cx - 50, 150], [cx - 50, base], [cx + 50, base], [cx + 50, 150]], st));
        for (const [tx2, th, tw] of [[-46, 60, 9], [-20, 80, 11], [8, 96, 13], [34, 70, 9], [50, 52, 8]]) {
          P.push(Poly([[cx + tx2 - tw, base + 10], [cx + tx2 - tw, base + 10 - th], [cx + tx2 + tw, base + 10 - th], [cx + tx2 + tw, base + 10]], st));
          P.push(Poly([[cx + tx2 - tw - 2, base + 10 - th], [cx + tx2, base - th - 14], [cx + tx2 + tw + 2, base + 10 - th]], R('#3a2a58')));
        }
        renderParts(pb, 0, 0, TW, 150, P);
        for (let i = 0; i < 26; i++) { const x = cx - 48 + r() * 96, y = base - 60 + r() * 90; pb.rect(x, y, 1, 2, '#ffd070'); pb.glow(x, y, 4, '#ffb040', 0.4); }
        pb.blur(1, true).toTexture(scene, k + 'far'); }
      { const pb = new PB(TW, 214), P = [], stn = R('#5a5878', { light: 0.5 }), arch = R('#46445e', { light: 0.45 }), stt = { grad: 0.3, tex: 0.3, ts: [2, 2] };
        for (const x of [40, 170, 300, 420]) {
          const h = 90 + r() * 50;
          P.push(Poly([[x - 9, 214], [x - 9, 214 - h], [x - 6, 214 - h - 6], [x + 2, 214 - h - 2], [x + 9, 214 - h - 8], [x + 9, 214]], stn, stt));
          P.push(Poly([[x - 12, 214 - h + 4], [x + 12, 214 - h + 4], [x + 12, 214 - h + 10], [x - 12, 214 - h + 10]], stn, stt));
          if (r() < 0.7) for (let i = 0; i < 7; i++) { const a = Math.PI + i / 6 * Math.PI, b = Math.PI + (i + 1) / 6 * Math.PI; P.push(Cap(x + 36 + Math.cos(a) * 34, 214 - h + 38 + Math.sin(a) * 28, x + 36 + Math.cos(b) * 34, 214 - h + 38 + Math.sin(b) * 28, 2.6, 2.6, arch, { grp: 2, tex: 0.3 })); }
        }
        const dk = R('#241a2e', { light: 0.3 });
        const branch = (x, y, a, len, w, d) => { const e2 = vadd([x, y], dirv(a, len)); P.push(Cap(x, y, e2[0], e2[1], w, w * 0.6, dk, { grp: 3, tex: 0.25, ts: [1, 3] })); if (d > 0) { branch(e2[0], e2[1], a - 0.45 - r() * 0.3, len * 0.7, w * 0.6, d - 1); branch(e2[0], e2[1], a + 0.4 + r() * 0.3, len * 0.65, w * 0.6, d - 1); } };
        for (const x of [100, 370]) branch(x, 214, Math.PI + (r() - 0.5) * 0.2, 60, 6, 4);
        renderParts(pb, 0, 0, TW, 214, wrapParts(P)); pb.toTexture(scene, k + 'near'); }
    },
    layers: [
      { key: 'moon', y: 26, x: 78, sp: 0, fixed: true },
      { key: 'cloud', y: 10, sp: 0.03, drift: 4 },
      { key: 'far', y: 40, sp: 0.06 },
      { key: 'near', y: FLOOR_TOP + 4 - 214, sp: 0.26 },
      { key: 'mist', y: FLOOR_TOP - 26, sp: 0.18, alpha: 0.5, mist: true },
    ],
  },
  town: {
    mist: 0xfff4e0, rays: 0xfff2c0, amb: 'pollen', fog: '#c0d8e8', light: 'rgba(255,230,170,0.22)', sky: 'forest', ambient: 0xfff6ea,
    build(scene, k) {
      ensureTheme(scene, 'forest');
      const r = mulberry32(41);
      const pb = new PB(TW, 214), P = [], gl = [];
      const wall = R('#e8dcc0', { light: 0.5 }), tim = R('#6a4630'), roofs = [R('#b84a3a'), R('#4a6ab0'), R('#5a8a4a')];
      const tree = R('#4a8a3e', { light: 0.55 }), wl = { grad: 0.2, tex: 0.12, ts: [3, 3] }, rf = { grad: 0.4, tex: 0.25, ts: [1.5, 1] };
      let x = 10;
      while (x < TW - 40) {
        const w = 56 + r() * 30, h = 50 + r() * 26, base = 214, top = base - h, roof = pick(r, roofs);
        P.push(Poly([[x, base], [x, top], [x + w, top], [x + w, base]], wall, wl));
        for (const fx of [0, w / 2, w]) P.push(Cap(x + fx, base, x + fx, top, 1.6, 1.6, tim));
        P.push(Cap(x, top + h * 0.45, x + w, top + h * 0.45, 1.4, 1.4, tim));
        P.push(Poly([[x - 6, top + 2], [x + w / 2, top - 30 - r() * 10], [x + w + 6, top + 2]], roof, rf));
        P.push(Poly([[x + w * 0.7, top - 14], [x + w * 0.7, top - 30], [x + w * 0.7 + 8, top - 30], [x + w * 0.7 + 8, top - 8]], R('#8a5a4a'), { tex: 0.2 }));
        for (const wx of [w * 0.22, w * 0.72]) { P.push(Poly([[x + wx - 5, top + 12], [x + wx + 5, top + 12], [x + wx + 5, top + 24], [x + wx - 5, top + 24]], R('#ffd870', { light: 0.8 }), { flat: 3 })); P.push(Cap(x + wx, top + 12, x + wx, top + 24, 0.6, 0.6, tim, { line: false })); gl.push([x + wx, top + 18]); }
        P.push(Poly([[x + w / 2 - 6, base], [x + w / 2 - 6, base - 22], [x + w / 2 + 6, base - 22], [x + w / 2 + 6, base]], R('#7a4a2a'), { tex: 0.3, ts: [1, 4] }));
        x += w + 14;
        P.push(...treeParts(x - 7, 214, 0.55, tree, tree, tim, r));
        x += 14;
      }
      renderParts(pb, 0, 0, TW, 214, P);
      for (const [gx, gy] of gl) pb.glow(gx, gy, 14, '#ffc860', 0.45);
      pb.toTexture(scene, k + 'near');
    },
    layers: [
      { key: 'cloud', y: 6, sp: 0.03, drift: 6, from: 'forest' },
      { key: 'mtn', y: 86, sp: 0.05, from: 'forest' },
      { key: 'far', y: 96, sp: 0.12, from: 'forest' },
      { key: 'near', y: FLOOR_TOP + 4 - 214, sp: 0.3 },
      { key: 'mist', y: FLOOR_TOP - 26, sp: 0.2, alpha: 0.45, mist: true },
    ],
  },
};

function ensureTheme(scene, id) {
  const k = 'bg_' + id + '_';
  if (scene.textures.exists(k + 'floor')) return;
  THEMES[id].build(scene, k);
  const r = mulberry32(77 + id.length * 13);
  THEMES[id].props = PROP_DEFS[id](scene, k, r);
  const fp = new PB(256, 256);
  FLOOR_DEFS[id](fp, makeNoise(91 + id.length), r);
  fp.toTexture(scene, k + 'floor').setFilter(Phaser.Textures.FilterMode.LINEAR);
}

/* 화면 가장자리를 어둡게 하는 그림 (매 프레임 효과 대신 그림 한 장) */
function ensureVignette(scene) {
  if (scene.textures.exists('vignette')) return;
  const t = scene.textures.createCanvas('vignette', GW, GH), c = t.getContext();
  const g = c.createRadialGradient(GW / 2, GH / 2, GH * 0.35, GW / 2, GH / 2, GW * 0.62);
  g.addColorStop(0, 'rgba(0,0,10,0)'); g.addColorStop(1, 'rgba(0,0,10,0.55)');
  c.fillStyle = g; c.fillRect(0, 0, GW, GH);
  const g2 = c.createLinearGradient(0, 0, 0, GH);
  g2.addColorStop(0, 'rgba(0,0,10,0.18)'); g2.addColorStop(0.2, 'rgba(0,0,10,0)'); g2.addColorStop(0.85, 'rgba(0,0,10,0)'); g2.addColorStop(1, 'rgba(0,0,10,0.3)');
  c.fillStyle = g2; c.fillRect(0, 0, GW, GH);
  t.refresh();
}

class BG2D {
  constructor(scene, id, o = {}) {
    ensureTheme(scene, id); ensureVignette(scene);
    const th = this.th = THEMES[id], s = this.s = scene, k = 'bg_' + id + '_';
    this.objs = []; this.layers = [];
    const add = obj => { this.objs.push(obj); return obj; };
    const base = -100;
    add(s.add.image(0, 0, 'bg_' + (th.sky || id) + '_sky').setOrigin(0).setDepth(base));
    th.layers.forEach((L, i) => {
      const key = L.mist ? 'mist' : 'bg_' + (L.from || id) + '_' + L.key;
      const src = s.textures.get(key).getSourceImage();
      const obj = L.fixed ? s.add.image(L.x, L.y, key).setOrigin(0) : s.add.tileSprite(0, L.y, GW, src.height, key).setOrigin(0);
      obj.setDepth(base + 1 + i);
      if (L.mist) obj.setTint(th.mist).setAlpha(L.alpha).setBlendMode('ADD');
      add(obj); this.layers.push({ L, obj });
    });
    if (id === 'castle') this.moonGlow = add(s.add.image(110, 58, 'glow').setScale(2.5).setTint(0xd8c8ff).setAlpha(0.35).setBlendMode('ADD').setDepth(base + 1));
    // 원근 바닥
    this.webgl = s.game.renderer.type === Phaser.WEBGL;
    if (this.webgl) {
      if (!s.cache.shader.exists('floor3d')) s.cache.shader.add('floor3d', new Phaser.Display.BaseShader('floor3d', FLOOR_FRAG, undefined, {
        uScroll: { type: '1f', value: 0 }, uCam: { type: '1f', value: 0 }, uFog: { type: '3f', value: { x: 0, y: 0, z: 0 } },
      }));
      this.floor = add(s.add.shader('floor3d', 0, FLOOR_TOP, GW, GH - FLOOR_TOP + 60, [k + 'floor']).setOrigin(0).setDepth(base + 20));
      const [fr, fg, fb] = rgbOf(th.fog);
      this.floor.setUniform('uFog.value', { x: fr / 255, y: fg / 255, z: fb / 255 });
    } else {
      this.floor = add(s.add.tileSprite(0, FLOOR_TOP, GW, GH - FLOOR_TOP, k + 'floor').setOrigin(0).setDepth(base + 20));
    }
    // 바닥과 먼 풍경 사이 안개 띠
    this.horizon = add(s.add.image(GW / 2, FLOOR_TOP + 2, 'glow').setScale(9, 0.5).setTint(Phaser.Display.Color.HexStringToColor(th.fog).color).setAlpha(0.55).setDepth(base + 21));
    // 깊이별 소품
    this.props = [];
    const r = mulberry32(5 + id.length);
    const mk = (zmin, zmax, n, front) => {
      for (let i = 0; i < n; i++) {
        const z = lerp(zmin, zmax, (i + r()) / n);
        const pr = { z, wx: r() * (GW + 120) * z, front, scale: 1 / z };
        const key = k + pick(r, front ? th.props.front : th.props.back) + (front ? '_b' : '');
        pr.spr = add(s.add.image(0, zToY(z), key).setOrigin(0.5, 1).setScale(pr.scale));
        const fogT = clamp((z - 1.1) / 2.2, 0, 0.75);
        const fc = Phaser.Display.Color.HexStringToColor(th.fog);
        const tint = Phaser.Display.Color.Interpolate.ColorWithColor(new Phaser.Display.Color(255, 255, 255), fc, 100, fogT * 100);
        pr.spr.setTint(Phaser.Display.Color.GetColor(tint.r, tint.g, tint.b));
        pr.spr.setDepth(front ? 62 : base + 22 + (3.5 - z) * 4);
        this.props.push(pr);
      }
    };
    if (!o.noProps) { mk(1.25, 3.0, Store.data.settings.gfx === 0 ? 10 : 18, false); mk(0.68, 0.78, 2, true); }
    // 빛 (햇살/수정 빛/달빛) + 빛줄기
    this.rays = [];
    if (th.rays) for (let i = 0; i < 4; i++) {
      const ray = add(s.add.image(220 + i * 70, -30, 'ray').setOrigin(0.5, 0).setScale(1.4 + i * 0.3, 1.3).setRotation(0.42).setTint(th.rays).setBlendMode('ADD').setAlpha(0.08).setDepth(base + 30));
      this.rays.push({ ray, ph: i * 1.7 });
    }
    // 떠다니는 입자
    const cfg = {
      pollen: { tint: [0xfff2b0, 0xffffff], speedX: { min: -30, max: -10 }, speedY: { min: -6, max: 6 }, scale: { start: 0.7, end: 0.2 }, alpha: { start: 0.9, end: 0 } },
      sparkle: { tint: [0x8fe8ff, 0xd8a0ff], speedX: { min: -14, max: -4 }, speedY: { min: -14, max: -4 }, scale: { start: 0.8, end: 0 }, alpha: { start: 1, end: 0 } },
      petal: { tint: [0xb8a0ff, 0xff9ad0], speedX: { min: -40, max: -15 }, speedY: { min: 8, max: 22 }, scale: { start: 0.8, end: 0.4 }, alpha: { start: 0.9, end: 0 }, rotate: { min: 0, max: 360 } },
    }[th.amb];
    this.particles = add(s.add.particles(0, 0, th.amb === 'petal' ? 'leaf' : 'px', Object.assign({
      x: { min: 0, max: GW + 60 }, y: { min: 0, max: 220 }, lifespan: { min: 3000, max: 6000 },
      frequency: 220, quantity: 1, blendMode: 'ADD',
    }, cfg)).setDepth(base + 31));
    this.scroll = 0; this.t = 0;
    this.burstFx = add(s.add.rectangle(0, 0, GW, GH, 0xffd070, 0).setOrigin(0).setDepth(base + 29).setBlendMode('ADD'));
    add(s.add.image(0, 0, 'vignette').setOrigin(0).setDepth(96).setScrollFactor(0));
    this.orbit = o.orbit != null ? o.orbit : 14; this.camX = 0;
    this.update(0, 0, 0);
  }
  update(dt, speed, pulse = 0, burst = false) {
    this.t += dt; this.scroll += speed * dt;
    const sc = this.scroll;
    // 카메라 궤도: 주인공이 달리는 줄(깊이 1)은 그대로, 먼 곳일수록 많이 옆으로 움직여 입체감이 생겨요
    const cam = this.camX = this.orbit * (Math.sin(this.t * 0.21) * 0.75 + Math.sin(this.t * 0.47 + 1) * 0.25);
    for (const { L, obj } of this.layers) {
      const zl = 1 / Math.max(L.sp || 0.02, 0.02), sh = cam * (1 - 1 / zl);
      if (L.fixed) obj.x = L.x + Math.round(sh); else obj.tilePositionX = Math.round(sc * L.sp + (L.drift || 0) * this.t - sh);
    }
    if (this.webgl) { this.floor.setUniform('uScroll.value', sc); this.floor.setUniform('uCam.value', cam); }
    else this.floor.tilePositionX = Math.round(sc);
    // 소품: 깊이 z 인 것은 1/z 속도로 지나가요
    const W2 = GW + 120;
    for (const p of this.props) {
      let x = ((p.wx - sc) / p.z) % W2; if (x < 0) x += W2;   // 왼쪽으로 나가면 오른쪽에서 다시 들어와요
      p.spr.x = Math.round(x - 60 + cam * (1 - 1 / p.z));
    }
    for (const r of this.rays) r.ray.setAlpha(0.05 + 0.04 * Math.sin(this.t * 0.7 + r.ph) + pulse * 0.03);
    if (this.moonGlow) this.moonGlow.setAlpha(0.3 + 0.05 * Math.sin(this.t));
    this.burstFx.setAlpha(burst ? 0.05 + pulse * 0.06 : 0);
    if (burst) this.burstFx.fillColor = hueC(this.t * 0.4, 0.4);
  }
  destroy() { this.objs.forEach(o => o.destroy()); }
}

/* 배경 고르기: 3D 를 쓸 수 있으면 도트 3D 세계, 아니면 2.5D 그림 배경 */
class BG {
  constructor(scene, id, o = {}) {
    if (!W3.init()) return new BG2D(scene, id, o);
    ensureVignette(scene);
    const th = this.th = THEMES[id], s = this.s = scene;
    this.layers = []; this.objs = []; this.t = 0;
    const add = x => { this.objs.push(x); return x; };
    W3.show(id, o);
    const base = -100;
    // 빛줄기와 떠다니는 입자는 3D 위에 겹쳐 그려요
    this.rays = [];
    if (th.rays) for (let i = 0; i < 4; i++) {
      const ray = add(s.add.image(220 + i * 70, -30, 'ray').setOrigin(0.5, 0).setScale(1.4 + i * 0.3, 1.3).setRotation(0.42).setTint(th.rays).setBlendMode('ADD').setAlpha(0.06).setDepth(base + 30));
      this.rays.push({ ray, ph: i * 1.7 });
    }
    const cfg = {
      pollen: { tint: [0xfff2b0, 0xffffff], speedX: { min: -30, max: -10 }, speedY: { min: -6, max: 6 }, scale: { start: 0.7, end: 0.2 }, alpha: { start: 0.9, end: 0 } },
      sparkle: { tint: [0x8fe8ff, 0xd8a0ff], speedX: { min: -14, max: -4 }, speedY: { min: -14, max: -4 }, scale: { start: 0.8, end: 0 }, alpha: { start: 1, end: 0 } },
      petal: { tint: [0xb8a0ff, 0xff9ad0], speedX: { min: -40, max: -15 }, speedY: { min: 8, max: 22 }, scale: { start: 0.8, end: 0.4 }, alpha: { start: 0.9, end: 0 }, rotate: { min: 0, max: 360 } },
    }[th.amb];
    add(s.add.particles(0, 0, th.amb === 'petal' ? 'leaf' : 'px', Object.assign({ x: { min: 0, max: GW + 60 }, y: { min: 0, max: 220 }, lifespan: { min: 3000, max: 6000 }, frequency: 220, quantity: 1, blendMode: 'ADD' }, cfg)).setDepth(base + 31));
    this.burstFx = add(s.add.rectangle(0, 0, GW, GH, 0xffd070, 0).setOrigin(0).setDepth(base + 29).setBlendMode('ADD'));
    add(s.add.image(0, 0, 'vignette').setOrigin(0).setDepth(96).setScrollFactor(0));
  }
  update(dt, speed, pulse = 0, burst = false) {
    this.t += dt;
    W3.advance(dt, speed, pulse);
    for (const r of this.rays) r.ray.setAlpha(0.04 + 0.03 * Math.sin(this.t * 0.7 + r.ph) + pulse * 0.03);
    this.burstFx.setAlpha(burst ? 0.05 + pulse * 0.06 : 0);
    if (burst) this.burstFx.fillColor = hueC(this.t * 0.4, 0.4);
  }
  destroy() { this.objs.forEach(o => o.destroy()); }
}
