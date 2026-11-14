'use strict';
// 지역 배경 — 하늘, 먼 산, 중간 풍경, 땅, 앞쪽 장식을 층층이 그린다. 한 번 그려 두고 다시 쓴다.

function hash(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
function vnoise(x, seed) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return lerp(hash(i + seed * 57), hash(i + 1 + seed * 57), u);
}
function fbm(x, seed) { return vnoise(x, seed) * 0.6 + vnoise(x * 2.1, seed + 3) * 0.28 + vnoise(x * 4.3, seed + 7) * 0.12; }
// 능선 아래를 칠한다
function ridge(g, y0, amp, scale, seed, color, bottom = 270) {
  g.fillStyle = color;
  const st = 1 / R;
  for (let x = 0; x < W; x += st) {
    const y = Math.round((y0 - fbm(x / scale, seed) * amp) * R) / R;
    g.fillRect(x, y, st, bottom - y);
  }
}

const BG = {};
function getBG(id) {
  if (!BG[id]) BG[id] = makeBG(id);
  return BG[id];
}

function makeBG(id) {
  const c = newCanvas(W * R, H * R), g = c.getContext('2d');
  g.setTransform(R, 0, 0, R, 0, 0);
  const P = painter(g);
  const HZ = 128; // 땅이 시작하는 높이
  if (id === 'forest' || id === 'title') {
    ditherGrad(g, 0, 0, W, HZ + 10, ['#0b1526', '#12283e', '#1c4252', '#2e6a66', '#4a8a72']);
    ditherGlow(g, 380, 40, 46, '#bfe8d0', 0.35);
    P.ell(380, 40, 13, 13, '#e8f4dc'); P.ell(376, 37, 11, 11, '#ffffff'); P.ell(384, 44, 3, 2, '#cfe4cc'); P.ell(374, 44, 2, 1.5, '#cfe4cc');
    for (let i = 0; i < 40; i++) P.px(hash(i) * W, hash(i + 9) * 70, hash(i + 3) > 0.5 ? '#e8f4dc' : '#7fa8b8');
    ridge(g, 112, 30, 70, 1, '#1a3a48', HZ + 20);
    // 먼 전나무 숲
    for (let x = -8; x < W + 8; x += 7) {
      const h = 18 + fbm(x / 30, 4) * 26, by = 124;
      P.poly([[x, by], [x + 5, by - h], [x + 10, by]], '#16323e');
    }
    for (let x = -10; x < W + 10; x += 11) {
      const h = 24 + fbm(x / 22, 6) * 30, by = 134;
      P.poly([[x, by], [x + 7, by - h], [x + 14, by]], '#173a36');
      P.poly([[x + 7, by - h], [x + 9, by - h * 0.6], [x + 7, by - h * 0.55]], '#22504a');
    }
    // 빛줄기
    g.globalAlpha = 0.08;
    g.fillStyle = '#d8ffd0';
    for (const [x0, w] of [[300, 16], [340, 10], [250, 8]]) { g.beginPath(); g.moveTo(x0, 0); g.lineTo(x0 + w, 0); g.lineTo(x0 - 60 + w, HZ + 20); g.lineTo(x0 - 70, HZ + 20); g.fill(); }
    g.globalAlpha = 1;
    ditherGrad(g, 0, HZ, W, H - HZ, ['#2e5a34', '#244a2a', '#1a3820', '#122818']);
    P.ell(250, 176, 150, 26, '#3a5a34'); P.ell(250, 176, 140, 22, '#456838');
    for (let i = 0; i < 260; i++) {
      const x = hash(i * 3) * W, y = HZ + 4 + hash(i * 7) * (H - HZ - 6), col = y > 200 ? '#2a5a2a' : '#4a8a3e';
      P.px(x, y, col); P.px(x + 1, y - 1, light(col, 0.2)); P.px(x - 1, y - 1, col);
    }
    for (let i = 0; i < 26; i++) P.px(hash(i * 13) * W, HZ + 8 + hash(i * 17) * 60, ['#f2a0c0', '#fff4dc', '#ffe066'][i % 3]);
    // 앞쪽 큰 나무
    P.rect(0, 0, 18, H, '#0e1e16'); P.rect(18, 0, 4, H, '#16281c'); P.ell(10, 10, 46, 26, '#0e2418'); P.ell(470, 6, 60, 24, '#0e2418');
    for (let i = 0; i < 12; i++) P.line(440 + i * 4, 10, 438 + i * 4, 30 + hash(i) * 30, '#173a26');
  } else if (id === 'sands') {
    ditherGrad(g, 0, 0, W, HZ + 10, ['#24183a', '#5a2e5a', '#b04e5a', '#e8805a', '#f8c070']);
    ditherGlow(g, 330, 92, 60, '#ffe0a0', 0.45);
    P.ell(330, 92, 30, 30, '#ffd890');
    for (let k = 0; k < 4; k++) P.rect(296, 98 + k * 5, 70, 1 + (k >> 1), '#e8805a');
    for (let i = 0; i < 18; i++) P.px(hash(i + 2) * W, hash(i + 5) * 40, '#f8d8c0');
    ridge(g, 120, 16, 90, 2, '#9a4a4a', HZ + 20);
    for (const [x, s] of [[70, 34], [120, 22], [420, 28]]) { P.poly([[x - s, 124], [x, 124 - s], [x + s, 124]], '#7a3a46'); P.poly([[x, 124 - s], [x + s, 124], [x + 2, 124]], '#5e2c3c'); }
    ridge(g, 132, 14, 60, 5, '#c0704a', HZ + 30);
    // 무너진 기둥과 아치
    for (const [x, h] of [[30, 54], [58, 30], [400, 46], [450, 62]]) {
      P.rect(x, 140 - h, 12, h, '#a8644a'); P.rect(x + 8, 140 - h, 4, h, '#7a4438'); P.rect(x - 2, 140 - h, 16, 4, '#c08060');
      for (let y = 140 - h + 8; y < 140; y += 8) P.rect(x, y, 12, 1, '#7a4438');
    }
    P.rect(160, 90, 8, 46, '#8a5444'); P.rect(212, 90, 8, 46, '#8a5444'); P.ell(190, 92, 30, 14, '#8a5444'); P.ell(190, 96, 22, 12, '#c0704a');
    P.rect(156, 86, 68, 6, '#a8644a');
    ditherGrad(g, 0, HZ + 6, W, H - HZ - 6, ['#e0a060', '#d08a4e', '#b06e3e', '#8a5232']);
    for (let i = 0; i < 46; i++) {
      const y = HZ + 14 + i * 3 + hash(i) * 3, x0 = hash(i * 5) * W;
      P.line(x0, y, x0 + 30 + hash(i * 7) * 50, y + hash(i * 3) * 2 - 1, '#f0c080');
    }
    P.ell(80, 200, 6, 3, '#f4ecd8'); P.rect(74, 200, 12, 2, '#e8dcc0'); P.px(78, 199, EYE); P.px(82, 199, EYE);
    P.rect(390, 220, 16, 2, '#e8dcc0'); P.ell(390, 221, 2, 2, '#f4ecd8'); P.ell(406, 221, 2, 2, '#f4ecd8');
  } else if (id === 'frost') {
    ditherGrad(g, 0, 0, W, HZ + 10, ['#04060f', '#0a1428', '#12223e', '#1a3256', '#24426a']);
    for (let i = 0; i < 30; i++) P.ell(hash(i) * W, 30 + hash(i + 4) * 90, 10 + hash(i + 8) * 22, 8 + hash(i + 9) * 14, i % 2 ? '#0e1a32' : '#142640');
    // 빛나는 수정
    for (const [x, y, s] of [[60, 120, 1.2], [140, 112, 0.8], [330, 118, 1], [420, 122, 1.4], [250, 108, 0.6]]) {
      ditherGlow(g, x, y - 18 * s, 40 * s, '#5ad8ff', 0.4);
      P.poly([[x - 8 * s, y], [x - 3 * s, y - 34 * s], [x + 2 * s, y]], '#3a9ad0');
      P.poly([[x - 2 * s, y], [x + 5 * s, y - 46 * s], [x + 10 * s, y]], '#6ad8ff');
      P.poly([[x + 5 * s, y - 46 * s], [x + 10 * s, y], [x + 6 * s, y]], '#bff0ff');
      P.poly([[x + 8 * s, y], [x + 14 * s, y - 22 * s], [x + 17 * s, y]], '#3a9ad0');
    }
    // 종유석
    for (let x = 0; x < W; x += 9) {
      const h = 10 + fbm(x / 14, 9) * 40;
      P.poly([[x, 0], [x + 9, 0], [x + 4.5, h]], '#0c1630');
      P.poly([[x + 4.5, h], [x + 6, 0], [x + 7, 0]], '#2a4a7a');
    }
    ridge(g, 134, 10, 40, 4, '#22406a', HZ + 20);
    ditherGrad(g, 0, HZ + 4, W, H - HZ - 4, ['#4a6a9a', '#38588a', '#2a4472', '#1a2e52']);
    for (let i = 0; i < 30; i++) { const x = hash(i * 11) * W, y = HZ + 12 + hash(i * 3) * 120; P.line(x, y, x + 10 + hash(i) * 26, y, '#7aa0d0'); }
    for (const [x, y, r] of [[40, 160, 30], [460, 200, 40], [200, 240, 26]]) { P.ell(x, y, r, r * 0.3, '#c8dcf0'); P.ell(x - r * 0.2, y - 2, r * 0.7, r * 0.18, '#eef6ff'); }
  } else if (id === 'ash') {
    ditherGrad(g, 0, 0, W, HZ + 10, ['#0c0610', '#22080e', '#40101a', '#70201a', '#b04a1e']);
    ditherGlow(g, 120, 46, 40, '#ff8a3a', 0.5);
    P.ell(120, 46, 20, 20, '#ffb060'); P.ell(120, 46, 17, 17, '#0c0610'); P.ell(117, 43, 4, 3, '#22080e');
    for (let i = 0; i < 22; i++) P.px(hash(i + 1) * W, hash(i + 7) * 60, '#a84a3a');
    ridge(g, 118, 24, 50, 3, '#2a0e14', HZ + 20);
    // 성
    const cast = '#14080e';
    for (const [x, w, h] of [[240, 34, 80], [282, 22, 60], [210, 20, 50], [320, 40, 54], [360, 16, 74], [190, 14, 36]]) {
      P.rect(x, 124 - h, w, h, cast);
      for (let k = 0; k < w; k += 6) P.rect(x + k, 120 - h, 4, 4, cast);
      for (let k = 0; k < 3; k++) if (hash(x + k) > 0.3) P.rect(x + 4 + hash(x * k + 1) * (w - 8), 124 - h + 10 + k * 14, 2, 3, '#ff9a3a');
    }
    P.poly([[251, 44], [257, 20], [263, 44]], cast); P.px(257, 18, '#ff4a2a');
    // 용암 강
    P.rect(0, 126, W, 6, '#ff6a1a'); P.rect(0, 127, W, 2, '#ffd34d');
    ditherGlow(g, 240, 128, 240, '#ff6a1a', 0.12);
    ditherGrad(g, 0, HZ + 4, W, H - HZ - 4, ['#2a1a22', '#22141c', '#1a0e16', '#120a10']);
    for (let r = 0; r < 7; r++) { const y = HZ + 8 + r * r * 3.2; P.rect(0, Math.round(y), W, 1, '#0e060c'); }
    for (let k = -14; k <= 14; k++) P.line(240 + k * 12, HZ + 6, 240 + k * 44, H, '#0e060c');
    for (let i = 0; i < 16; i++) {
      let x = hash(i * 9) * W, y = HZ + 20 + hash(i * 4) * 120;
      for (let s = 0; s < 6; s++) { const nx = x + (hash(i * 10 + s) - 0.5) * 16, ny = y + hash(i * 10 + s + 3) * 6; P.line(x, y, nx, ny, '#ff6a1a'); x = nx; y = ny; }
    }
    for (const x of [10, 450]) { P.rect(x, 0, 20, 110, '#2a0e14'); P.rect(x + 2, 0, 16, 104, '#6a1a2a'); P.poly([[x + 2, 104], [x + 10, 112], [x + 18, 104]], '#6a1a2a'); P.rect(x + 7, 30, 6, 6, '#d9a92e'); }
  }
  // 도트 그림처럼: 경계의 어중간한 색을 정리
  const img = g.getImageData(0, 0, c.width, c.height);
  snapPalette(img.data, 12);
  g.putImageData(img, 0, 0);
  return c;
}

// ---------- 떠다니는 것들 ----------
function makeAmbient(id) {
  const parts = [];
  const spawn = (init) => {
    const p = { x: rnd(0, W), y: rnd(0, 200), t: rnd(0, 10), life: 1 };
    if (id === 'forest') Object.assign(p, { kind: chance(0.7) ? 'fly' : 'leaf', vx: rnd(-6, 6), vy: rnd(-4, 4) });
    if (id === 'title') Object.assign(p, { kind: chance(0.6) ? 'lamp' : 'fly', vx: rnd(-3, 3), vy: rnd(-10, -4), y: init ? rnd(0, 270) : 280 });
    if (id === 'sands') Object.assign(p, { kind: 'sand', vx: rnd(40, 90), vy: rnd(-2, 4), x: init ? rnd(0, W) : -10 });
    if (id === 'frost') Object.assign(p, { kind: chance(0.75) ? 'snow' : 'twinkle', vx: rnd(-6, 4), vy: rnd(8, 18), y: init ? rnd(0, 200) : -4 });
    if (id === 'ash') Object.assign(p, chance(0.6) ? { kind: 'ember', vx: rnd(-6, 6), vy: rnd(-20, -8), y: init ? rnd(0, 270) : 274 } : { kind: 'ashf', vx: rnd(-4, 8), vy: rnd(6, 14), y: init ? rnd(0, 200) : -4 });
    return p;
  };
  const N = { forest: 34, title: 30, sands: 40, frost: 60, ash: 50 }[id] || 0;
  for (let i = 0; i < N; i++) parts.push(spawn(true));
  return {
    update(dt) {
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        p.t += dt;
        if (p.kind === 'fly') { p.vx += rnd(-20, 20) * dt; p.vy += rnd(-20, 20) * dt; p.vx = clamp(p.vx, -10, 10); p.vy = clamp(p.vy, -8, 8); }
        if (p.kind === 'leaf' || p.kind === 'snow') p.vx += Math.sin(p.t * 2) * 6 * dt;
        p.x += p.vx * dt; p.y += (p.kind === 'leaf' ? 10 : p.vy) * dt;
        if (p.x < -12 || p.x > W + 12 || p.y < -12 || p.y > H + 12) parts[i] = spawn(false);
      }
    },
    draw(g) {
      for (const p of parts) {
        const x = p.x, y = p.y;
        switch (p.kind) {
          case 'fly': {
            const a = 0.5 + 0.5 * Math.sin(p.t * 3);
            softGlow(g, x, y, 4, '#d8ff8a', a * 0.6);
            g.globalAlpha = a; g.fillStyle = '#f4ffc0'; g.fillRect(x - 0.4, y - 0.4, 0.8, 0.8);
            g.globalAlpha = 1; break;
          }
          case 'leaf': g.fillStyle = Math.sin(p.t * 4) > 0 ? '#5fa04e' : '#3f7d3a'; g.fillRect(x, y, 1.5, 0.75); break;
          case 'lamp': {
            const fl = 0.8 + 0.2 * Math.sin(p.t * 7);
            softGlow(g, x, y + 1, 8, '#ffb040', 0.45 * fl);
            g.fillStyle = '#ff9a3a'; g.fillRect(x - 1.25, y - 1, 2.5, 3.5); g.fillStyle = '#ffe8a0'; g.fillRect(x - 0.5, y - 0.25, 1, 2); g.fillStyle = '#4a3a2a'; g.fillRect(x - 1.5, y - 1.5, 3, 0.5);
            break;
          }
          case 'sand': g.fillStyle = '#f8d8a0'; g.globalAlpha = 0.6; g.fillRect(x, y, 3, 0.5); g.globalAlpha = 1; break;
          case 'snow': g.fillStyle = '#e8f4ff'; g.beginPath(); g.arc(x, y, 0.6, 0, 6.3); g.fill(); break;
          case 'twinkle': { const a = Math.max(0, Math.sin(p.t * 2)); g.globalAlpha = a; g.fillStyle = '#bff0ff'; g.fillRect(x - 1.5, y - 0.25, 3, 0.5); g.fillRect(x - 0.25, y - 1.5, 0.5, 3); g.globalAlpha = 1; break; }
          case 'ember': softGlow(g, x, y, 2.5, '#ff6a1a', 0.5); g.fillStyle = Math.sin(p.t * 9) > 0 ? '#ffd34d' : '#ff6a1a'; g.fillRect(x - 0.4, y - 0.4, 0.8, 0.8); break;
          case 'ashf': g.fillStyle = '#6a5a60'; g.fillRect(x, y, 1.25, 0.6); break;
        }
      }
    },
  };
}
