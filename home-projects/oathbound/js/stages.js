'use strict';
// =============================================================
//  전투장 배경 — 도트 느낌으로 코드로 직접 그려요.
//  층(레이어)마다 움직이는 속도가 달라서 깊이감이 생겨요.
//  [먼 하늘, 먼 풍경, 가까운 풍경, 땅] + 캐릭터 앞에 그리는 어두운 실루엣 층
//  배경은 전투를 시작할 때 한 번만 그려 두고 계속 재사용해서 렉이 없어요.
// =============================================================

// 매번 같은 모양이 나오게 하는 난수
function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

const FG_W = 1100;   // 앞 실루엣 층은 더 빨리 움직여서 조금 더 넓어요

function makeLayer(w = ARENA_W) {
  const c = document.createElement('canvas');
  c.width = w * RES; c.height = H * RES;      // 2배 해상도로 그려요
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.scale(RES, RES);
  return { c, g, w };
}

// ---------------- 그리기 도우미 ----------------

// 계단식 하늘 + 띠 사이 점무늬(디더링)로 도트 느낌
function skyBands(g, cols, top = 0, bottom = H, bands = 28) {
  const bh = (bottom - top) / bands;
  for (let i = 0; i < bands; i++) {
    const k = i / (bands - 1);
    const seg = k * (cols.length - 1), j = Math.min(cols.length - 2, Math.floor(seg));
    const c0 = mixColor(cols[j], cols[j + 1], seg - j);
    const k2 = Math.min(1, (i + 1) / (bands - 1));
    const seg2 = k2 * (cols.length - 1), j2 = Math.min(cols.length - 2, Math.floor(seg2));
    const c1 = mixColor(cols[j2], cols[j2 + 1], seg2 - j2);
    const y = top + i * bh;
    g.fillStyle = c0; g.fillRect(0, y, ARENA_W, bh + 0.5);
    g.fillStyle = c1;
    for (let x = 0; x < ARENA_W; x += 2) g.fillRect(x + ((i % 2) ? 1 : 0), y + bh - 1, 1, 1);
  }
}

function stars(g, r, n, maxY) {
  for (let i = 0; i < n; i++) {
    const x = Math.floor(r() * ARENA_W), y = Math.floor(r() * maxY);
    const big = r() < 0.08;
    g.fillStyle = r() < 0.25 ? '#ffffff' : 'rgba(200,210,255,0.55)';
    g.fillRect(x, y, big ? 1 : 0.5, big ? 1 : 0.5);
    if (big) { g.fillStyle = 'rgba(220,230,255,0.35)'; g.fillRect(x - 1, y + 0.25, 3, 0.5); g.fillRect(x + 0.25, y - 1, 0.5, 3); }
  }
}

function glowOn(g, x, y, r, color) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
}

// 달: 둥근 몸 + 얼룩(분화구) + 빛무리
function moon(g, r, x, y, rad, color, shade, glow) {
  glowOn(g, x, y, rad * 4.5, glow);
  g.fillStyle = color;
  for (let dy = -rad; dy <= rad; dy += 0.5) {
    const w = Math.sqrt(Math.max(0, rad * rad - dy * dy));
    g.fillRect(x - w, y + dy, w * 2, 0.5);
  }
  g.fillStyle = shade;
  for (let i = 0; i < 7; i++) {
    const a = r() * TAU, d = r() * rad * 0.7, cr = 1 + r() * rad * 0.22;
    const cx = x + Math.cos(a) * d, cy = y + Math.sin(a) * d;
    for (let dy = -cr; dy <= cr; dy += 0.5) {
      const w = Math.sqrt(Math.max(0, cr * cr - dy * dy));
      g.fillRect(cx - w, cy + dy, w * 2, 0.5);
    }
  }
}

// 구름 띠 (얇은 가로 덩어리 여러 개)
function clouds(g, r, y, n, color, spread = 30) {
  g.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const cx = r() * ARENA_W, cy = y + (r() - 0.5) * spread, w = 30 + r() * 90;
    for (let k = 0; k < 5; k++) {
      const ww = w * (1 - k * 0.17), yy = cy - k * 1.5;
      g.fillRect(cx - ww / 2 + (r() - 0.5) * 6, yy, ww, 1.5);
    }
  }
}

// 들쭉날쭉한 산/언덕 실루엣 + 위쪽 밝은 테두리
function ridge(g, r, base, amp, step, color, edge) {
  let y = base;
  for (let x = 0; x < ARENA_W; x += step) {
    y += (r() - 0.5) * amp;
    y = clamp(y, base - amp * 2, base + amp);
    g.fillStyle = color; g.fillRect(x, Math.round(y), step, H - Math.round(y));
    if (edge) { g.fillStyle = edge; g.fillRect(x, Math.round(y), step, 1); }
  }
}

function deadTree(g, r, x, y, len, ang, depth, color) {
  if (depth <= 0 || len < 2) return;
  const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
  g.strokeStyle = color; g.lineWidth = Math.max(0.6, depth * 0.85);
  g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
  const n = depth > 3 ? 2 : (r() < 0.6 ? 2 : 1);
  for (let i = 0; i < n; i++) deadTree(g, r, x2, y2, len * (0.62 + r() * 0.2), ang + (r() - 0.5) * 1.3, depth - 1, color);
}

// 돌 벽돌 무늬
function bricks(g, r, x, y, w, h, base, dark, light, bw = 10, bh = 5) {
  g.fillStyle = base; g.fillRect(x, y, w, h);
  for (let row = 0; row * bh < h; row++) {
    const yy = y + row * bh;
    g.fillStyle = dark; g.fillRect(x, yy, w, 0.5);
    for (let xx = x + ((row % 2) ? bw / 2 : 0); xx < x + w; xx += bw) {
      g.fillStyle = dark; g.fillRect(xx, yy, 0.5, bh);
      if (r() < 0.3) { g.fillStyle = light; g.fillRect(xx + 1, yy + 1, bw - 2, 0.5); }
    }
  }
}

// 고딕 창문 (뾰족 아치 + 창살 + 색유리)
function gothicWindow(g, r, x, y, w, h, frame, glass) {
  g.fillStyle = frame;
  g.fillRect(x - 1.5, y - 1, w + 3, h + 2);
  for (let i = 0; i < w / 2 + 2; i++) g.fillRect(x + w / 2 - (w / 2 + 1.5 - i), y - w * 0.6 + i * 0.6 * 1.2, (w / 2 + 1.5 - i) * 2, 1);
  for (let yy = 0; yy < h; yy += 2) {
    for (let xx = 0; xx < w; xx += 2) {
      g.fillStyle = glass[Math.floor(r() * glass.length)];
      g.fillRect(x + xx, y + yy, 2, 2);
    }
  }
  for (let i = 0; i < w / 2; i++) {
    g.fillStyle = glass[Math.floor(r() * glass.length)];
    g.fillRect(x + i, y - (i < w / 4 ? i : w / 2 - i) * 0.9, w - i * 2, 1);
  }
  g.fillStyle = frame;
  g.fillRect(x + w / 2 - 0.5, y - w * 0.5, 1, h + w * 0.5);
  for (let yy = y + 6; yy < y + h; yy += 8) g.fillRect(x, yy, w, 1);
}

// 묘비 여러 종류
function tomb(g, r, x, y, s, color, light, moss) {
  const t = Math.floor(r() * 5);
  g.fillStyle = color;
  if (t === 0) {              // 둥근 묘비
    g.fillRect(x, y - 16 * s, 12 * s, 16 * s); g.fillRect(x + 1 * s, y - 18 * s, 10 * s, 2 * s); g.fillRect(x + 3 * s, y - 19 * s, 6 * s, 1 * s);
    g.fillStyle = light; g.fillRect(x + 1 * s, y - 17 * s, 1, 15 * s);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(x + 4 * s, y - 13 * s, 4 * s, 0.5); g.fillRect(x + 3 * s, y - 11 * s, 6 * s, 0.5);
  } else if (t === 1) {       // 십자가
    g.fillRect(x + 4 * s, y - 26 * s, 4 * s, 26 * s); g.fillRect(x, y - 20 * s, 12 * s, 4 * s);
    g.fillStyle = light; g.fillRect(x + 4 * s, y - 26 * s, 1, 26 * s); g.fillRect(x, y - 20 * s, 12 * s, 0.5);
  } else if (t === 2) {       // 기울어진 묘비
    for (let i = 0; i < 14 * s; i++) g.fillRect(x + i * 0.2, y - i, 10 * s, 1);
    g.fillStyle = light; g.fillRect(x, y - 13 * s, 1, 12 * s);
  } else if (t === 3) {       // 오벨리스크
    g.fillRect(x + 2 * s, y - 30 * s, 7 * s, 30 * s);
    for (let i = 0; i < 4 * s; i++) g.fillRect(x + 2 * s + i * 0.9, y - 30 * s - i, 7 * s - i * 1.8, 1);
    g.fillRect(x, y - 4 * s, 11 * s, 4 * s);
    g.fillStyle = light; g.fillRect(x + 2 * s, y - 30 * s, 1, 26 * s);
  } else {                    // 넓은 석판
    g.fillRect(x - 2 * s, y - 10 * s, 18 * s, 10 * s); g.fillRect(x - 3 * s, y - 11 * s, 20 * s, 2 * s);
    g.fillStyle = light; g.fillRect(x - 3 * s, y - 11 * s, 20 * s, 0.5);
  }
  if (moss) { g.fillStyle = moss; for (let i = 0; i < 6; i++) g.fillRect(x + r() * 10 * s, y - r() * 6 * s - 1, 1.5, 1); }
}

// 풀 포기 (가는 잎 여러 개)
function grass(g, r, x, y, n, color, hgt = 6) {
  g.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const h = hgt * (0.4 + r() * 0.8), lean = (r() - 0.5) * 3;
    for (let k = 0; k < h; k++) g.fillRect(x + i * 1.2 + lean * (k / h), y - k, 0.7, 1);
  }
}

// 땅 (위 가장자리, 흙 알갱이, 돌, 벽돌 줄)
function groundTiles(g, r, top, body, edge, speck) {
  g.fillStyle = body; g.fillRect(0, GROUND, ARENA_W, H - GROUND);
  // 아래로 갈수록 어두워짐
  const gr = g.createLinearGradient(0, GROUND, 0, H);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.55)');
  g.fillStyle = edge; g.fillRect(0, GROUND, ARENA_W, 1.5);
  g.fillStyle = top; g.fillRect(0, GROUND + 1.5, ARENA_W, 2.5);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = r() < 0.5 ? speck : top;
    const x = r() * ARENA_W, y = GROUND + 5 + r() * (H - GROUND - 5);
    g.fillRect(x, y, 0.5 + r() * 3, 0.5);
  }
  // 박힌 돌
  for (let i = 0; i < 60; i++) {
    const x = r() * ARENA_W, y = GROUND + 6 + r() * 40, w = 3 + r() * 6;
    g.fillStyle = speck; g.fillRect(x, y, w, 2.5);
    g.fillStyle = top; g.fillRect(x, y, w, 0.5);
  }
  g.fillStyle = 'rgba(0,0,0,0.25)';
  for (let row = 0; row < 4; row++) {
    const y = GROUND + 10 + row * 14;
    g.fillRect(0, y, ARENA_W, 0.5);
    for (let x = (row % 2) * 16; x < ARENA_W; x += 32) g.fillRect(x, y, 0.5, 14);
  }
  g.fillStyle = gr; g.fillRect(0, GROUND, ARENA_W, H - GROUND);
}

// 안개 띠
function fogBand(g, y, h, color) {
  const gr = g.createLinearGradient(0, y - h, 0, y + h);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.5, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, y - h, ARENA_W, h * 2);
}

// 빛 기둥 (창문·달빛이 비추는 빛)
function lightShaft(g, x, y, w, len, slant, color) {
  const gr = g.createLinearGradient(x, y, x + slant, y + len);
  gr.addColorStop(0, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.beginPath(); g.moveTo(x, y); g.lineTo(x + w, y); g.lineTo(x + w + slant * 1.4, y + len); g.lineTo(x + slant * 0.6, y + len); g.fill();
}

// 뾰족 바위 (아래가 넓고 위가 뾰족)
function spire(g, x, base, w, h, color, edge) {
  for (let i = 0; i < h; i++) {
    const ww = w * (1 - i / h) * (0.85 + 0.15 * Math.sin(i * 0.7));
    g.fillStyle = color; g.fillRect(x - ww / 2, base - i, ww, 1);
    if (edge) { g.fillStyle = edge; g.fillRect(x - ww / 2, base - i, 0.7, 1); }
  }
}

// 촛불/화로 불꽃 + 빛
function flameDot(g, x, y, s, core, outer, glow) {
  glowOn(g, x, y - s, s * 10, glow);
  g.fillStyle = outer; g.fillRect(x - s, y - s * 2.5, s * 2, s * 2.5); g.fillRect(x - s * 0.5, y - s * 3.5, s, s);
  g.fillStyle = core; g.fillRect(x - s * 0.5, y - s * 1.8, s, s * 1.6);
}

// ---------- 전투장 5곳 ----------
const STAGES = [
  {
    name: '달빛 묘지',
    grade: '#3a5ad0',
    build(L, r, F) {
      const [g0, g1, g2, g3] = L.map(l => l.g);
      skyBands(g0, ['#04061a', '#0f1a44', '#2a3d72', '#46608e']);
      stars(g0, r, 260, 210);
      moon(g0, r, 520, 70, 22, '#eef0ff', 'rgba(170,180,220,0.45)', 'rgba(170,190,255,0.32)');
      clouds(g0, r, 80, 14, 'rgba(40,50,90,0.55)', 60);
      clouds(g0, r, 150, 18, 'rgba(25,32,64,0.7)', 40);
      ridge(g0, r, 225, 10, 4, '#121a3a', '#1d2a55');
      // 먼 언덕 위 성당 (불 켜진 창문)
      const g = g1;
      ridge(g, r, 250, 8, 3, '#0d1330', '#18224a');
      for (const cx of [260, 760]) {
        g.fillStyle = '#0a0f26';
        g.fillRect(cx - 40, 190, 80, 60); g.fillRect(cx - 10, 150, 20, 40);
        for (let i = 0; i < 30; i++) g.fillRect(cx - 10 + i / 3, 150 - i, 20 - i * 0.66, 1);
        g.fillRect(cx - 1, 105, 2, 18); g.fillRect(cx - 5, 110, 10, 2);
        g.fillRect(cx - 48, 205, 8, 45); g.fillRect(cx + 40, 205, 8, 45);
        for (let i = 0; i < 4; i++) { g.fillStyle = r() < 0.7 ? '#e8b850' : '#5a4420'; g.fillRect(cx - 30 + i * 18, 210, 4, 8); }
        g.fillStyle = '#e8b850'; g.fillRect(cx - 2, 165, 4, 7);
        glowOn(g, cx, 214, 40, 'rgba(255,190,80,0.12)');
      }
      for (let i = 0; i < 10; i++) deadTree(g, r, 30 + i * 100 + r() * 50, 262, 24 + r() * 12, -Math.PI / 2 + (r() - 0.5) * 0.2, 7, '#080c1e');
      fogBand(g, 258, 18, 'rgba(120,140,200,0.12)');
      // 가까운 묘지: 철책, 묘비, 납골당, 가로등
      const h = g2;
      h.fillStyle = '#141a30';
      for (let x = 0; x < ARENA_W; x += 6) { h.fillRect(x, GROUND - 30, 1, 30); h.fillRect(x - 1, GROUND - 32, 3, 2); h.fillRect(x, GROUND - 34, 1, 2); }
      h.fillRect(0, GROUND - 24, ARENA_W, 1); h.fillRect(0, GROUND - 8, ARENA_W, 1);
      for (const mx of [140, 640]) {      // 납골당
        bricks(h, r, mx, GROUND - 70, 70, 70, '#232b48', '#151a30', '#323c62', 9, 5);
        h.fillStyle = '#1a2038';
        for (let i = 0; i < 18; i++) h.fillRect(mx - 4 + i * 2.3, GROUND - 70 - i, 78 - i * 4.6, 1);
        h.fillStyle = '#2c365a'; h.fillRect(mx + 6, GROUND - 62, 5, 62); h.fillRect(mx + 59, GROUND - 62, 5, 62);
        h.fillStyle = '#05070f'; h.fillRect(mx + 24, GROUND - 40, 22, 40);
        for (let i = 0; i < 11; i++) h.fillRect(mx + 24 + i, GROUND - 40 - i * 0.8, 22 - i * 2, 1);
        h.fillStyle = '#3d4a78'; h.fillRect(mx + 30, GROUND - 76, 10, 2);
      }
      for (let x = 10; x < ARENA_W; x += 18 + Math.floor(r() * 30)) {
        if ((x > 130 && x < 220) || (x > 630 && x < 720)) continue;
        tomb(h, r, x, GROUND, 0.9 + r() * 0.4, '#2a3356', '#46548a', 'rgba(70,110,70,0.6)');
      }
      for (const lx of [90, 420, 900]) {   // 가로등
        h.fillStyle = '#0e1224'; h.fillRect(lx, GROUND - 80, 2, 80); h.fillRect(lx - 4, GROUND - 82, 10, 2);
        h.fillRect(lx - 3, GROUND - 92, 8, 10);
        h.fillStyle = '#ffd27a'; h.fillRect(lx - 1, GROUND - 90, 4, 6);
        glowOn(h, lx + 1, GROUND - 87, 34, 'rgba(255,200,110,0.3)');
      }
      for (let x = 0; x < ARENA_W; x += 4 + r() * 8) grass(h, r, x, GROUND, 3, '#1c2a3a', 5);
      groundTiles(g3, r, '#2c3555', '#151a2e', '#4a5a86', '#222a44');
      for (let i = 0; i < 25; i++) {        // 흩어진 해골·뼈
        const x = r() * ARENA_W, y = GROUND + 4 + r() * 20;
        g3.fillStyle = '#9a9478'; g3.fillRect(x, y, 3, 2.5); g3.fillStyle = '#1a1a1a'; g3.fillRect(x + 0.5, y + 1, 0.7, 0.7); g3.fillRect(x + 1.8, y + 1, 0.7, 0.7);
      }
      // 앞 실루엣: 풀과 묘비 윗부분, 위쪽 마른 가지
      F.fillStyle = '#03040a';
      for (let x = 0; x < FG_W; x += 2 + r() * 5) grass(F, r, x, H, 4, '#03040a', 18);
      for (let x = 40; x < FG_W; x += 140 + r() * 160) tomb(F, r, x, H + 4, 1.6, '#04050c', '#0b0e1c', null);
      for (const x of [0, FG_W * 0.55]) deadTree(F, r, x, -10, 40, 0.5, 6, '#03040a');
    },
    ambient(g, dt) {
      if (Math.random() < dt * 6) FX.particle({ x: g.camX + rand(-20, W + 20), y: rand(GROUND - 40, GROUND), vx: rand(6, 16), vy: 0, life: 4, size: rand(10, 22), color: 'rgba(150,170,230,0.06)', glow: false, shrink: false, floor: false, square: true });
      if (Math.random() < dt * 1.5) FX.particle({ x: g.camX + rand(0, W), y: rand(120, GROUND), vx: rand(-8, 8), vy: rand(-8, 8), life: 3, size: 2, color: '#9fe8ff', glow: true, floor: false });
    },
  },
  {
    name: '무너진 예배당',
    grade: '#a040c0',
    build(L, r, F) {
      const [g0, g1, g2, g3] = L.map(l => l.g);
      skyBands(g0, ['#08030c', '#1c0b26', '#2e1238', '#3a1840']);
      // 큰 장미창과 비추는 빛
      for (const cx of [300, 760]) {
        const cy = 85, R = 46;
        g0.fillStyle = '#12061a';
        for (let dy = -R - 4; dy <= R + 4; dy += 0.5) { const w = Math.sqrt(Math.max(0, (R + 4) * (R + 4) - dy * dy)); g0.fillRect(cx - w, cy + dy, w * 2, 0.5); }
        const pal = ['#c03060', '#3050c0', '#d0a030', '#8030a0', '#2a8090'];
        for (let ring = 0; ring < 4; ring++) {
          for (let a = 0; a < 16; a++) {
            const ang = (a / 16) * TAU, rr = R * (0.25 + ring * 0.22);
            g0.fillStyle = pal[(a + ring) % pal.length];
            g0.fillRect(cx + Math.cos(ang) * rr - 3, cy + Math.sin(ang) * rr - 3, 6, 6);
          }
        }
        g0.strokeStyle = '#12061a'; g0.lineWidth = 1.2;
        for (let a = 0; a < 8; a++) { const ang = (a / 8) * TAU; g0.beginPath(); g0.moveTo(cx, cy); g0.lineTo(cx + Math.cos(ang) * R, cy + Math.sin(ang) * R); g0.stroke(); }
        glowOn(g0, cx, cy, R * 2.2, 'rgba(200,90,200,0.18)');
        lightShaft(g0, cx - 30, cy, 60, 260, -40, 'rgba(230,140,230,0.10)');
      }
      // 뒤쪽 벽과 높은 창문들
      const g = g1;
      bricks(g, r, 0, 140, ARENA_W, 170, '#1a0c22', '#10061a', '#24122e', 14, 7);
      for (let i = 0; i < 7; i++) {
        const x = 40 + i * 140;
        gothicWindow(g, r, x, 170, 22, 70, '#0c0412', ['#7a2a5a', '#4a2a8a', '#a04a3a', '#3a1438', '#8a5a2a']);
        glowOn(g, x + 11, 205, 40, 'rgba(200,80,160,0.12)');
        g.fillStyle = '#0c0412'; g.fillRect(x + 60, 140, 14, 170);
        g.fillStyle = '#241030'; g.fillRect(x + 60, 140, 2, 170);
      }
      // 가까운 기둥, 부서진 의자, 촛대, 샹들리에
      const h = g2;
      for (let x = 30; x < ARENA_W; x += 150 + Math.floor(r() * 50)) {
        const hgt = 90 + Math.floor(r() * 120);
        h.fillStyle = '#2b1834'; h.fillRect(x, GROUND - hgt, 22, hgt);
        h.fillStyle = '#3f2550'; h.fillRect(x + 2, GROUND - hgt, 2, hgt); h.fillRect(x + 10, GROUND - hgt, 1, hgt);
        h.fillStyle = '#1e1026'; h.fillRect(x + 16, GROUND - hgt, 2, hgt);
        h.fillStyle = '#35203f'; h.fillRect(x - 4, GROUND - hgt, 30, 5); h.fillRect(x - 3, GROUND - 6, 28, 6);
        // 깨진 윗부분
        h.fillStyle = '#2b1834'; for (let i = 0; i < 5; i++) h.fillRect(x + r() * 18, GROUND - hgt - r() * 6, 4, 6);
        // 촛대
        const cx = x + 40;
        h.fillStyle = '#8a7a50'; h.fillRect(cx, GROUND - 26, 1.5, 26); h.fillRect(cx - 5, GROUND - 26, 11, 1.5);
        for (const dx of [-5, 0, 5]) { h.fillStyle = '#e8d8b0'; h.fillRect(cx + dx - 0.5, GROUND - 32, 2, 6); flameDot(h, cx + dx + 0.5, GROUND - 32, 1, '#fff6c0', '#ff9a2a', 'rgba(255,160,60,0.18)'); }
      }
      for (let x = 60; x < ARENA_W; x += 110 + r() * 80) {   // 부서진 의자
        h.fillStyle = '#2a1608'; h.fillRect(x, GROUND - 10, 34, 3); h.fillRect(x, GROUND - 18, 3, 18); h.fillRect(x + 31, GROUND - 14, 3, 14);
        h.fillStyle = '#3a2210'; h.fillRect(x, GROUND - 10, 34, 0.7);
      }
      for (const cx of [200, 600, 880]) {    // 샹들리에
        h.fillStyle = '#100816'; h.fillRect(cx, 0, 1, 60); h.fillRect(cx - 18, 60, 36, 2); h.fillRect(cx - 12, 66, 24, 2);
        for (let i = -2; i <= 2; i++) flameDot(h, cx + i * 8, 59, 1, '#fff6c0', '#ff9a2a', 'rgba(255,170,80,0.16)');
      }
      groundTiles(g3, r, '#3a2444', '#1a0f20', '#5c3a6a', '#2c1a34');
      for (let x = 0; x < ARENA_W; x += 24) {    // 바둑판 바닥 무늬
        g3.fillStyle = (x / 24) % 2 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.12)';
        g3.fillRect(x, GROUND + 4, 24, 10);
      }
      g3.fillStyle = 'rgba(120,20,40,0.35)'; g3.fillRect(0, GROUND + 14, ARENA_W, 8);   // 붉은 카펫
      // 앞 실루엣: 기둥 받침과 늘어진 깃발
      for (let x = 60; x < FG_W; x += 260 + r() * 120) { F.fillStyle = '#05020a'; F.fillRect(x, H - 34, 40, 34); F.fillRect(x - 6, H - 38, 52, 6); }
      for (let x = 20; x < FG_W; x += 220 + r() * 140) {
        F.fillStyle = '#0a0310'; F.fillRect(x, 0, 18, 46);
        for (let i = 0; i < 8; i++) F.fillRect(x + i * 1.1, 46 + i, 18 - i * 2.2, 1);
        F.fillStyle = '#2a0818'; F.fillRect(x + 7, 14, 4, 16);
      }
    },
    ambient(g, dt) {
      if (Math.random() < dt * 4) FX.particle({ x: g.camX + rand(0, W), y: rand(80, GROUND), vx: rand(-5, 5), vy: rand(-12, -4), life: 3, size: 2, color: '#c58aff', glow: true, floor: false });
      if (Math.random() < dt * 3) FX.particle({ x: g.camX + rand(-20, W), y: rand(GROUND - 30, GROUND), vx: rand(5, 12), vy: 0, life: 4, size: rand(12, 20), color: 'rgba(160,90,200,0.05)', glow: false, shrink: false, floor: false });
    },
  },
  {
    name: '푸른 불꽃의 폐허',
    grade: '#10a0b0',
    build(L, r, F) {
      const [g0, g1, g2, g3] = L.map(l => l.g);
      skyBands(g0, ['#020a10', '#062230', '#0d3e4e', '#1a5a66']);
      stars(g0, r, 240, 220);
      // 오로라 띠
      for (let i = 0; i < 3; i++) {
        g0.fillStyle = ['rgba(60,240,220,0.06)', 'rgba(80,200,255,0.05)', 'rgba(120,255,200,0.04)'][i];
        let y = 50 + i * 18;
        for (let x = 0; x < ARENA_W; x += 2) { y += Math.sin(x * 0.02 + i) * 0.6; g0.fillRect(x, y, 2, 14 + Math.sin(x * 0.05) * 6); }
      }
      moon(g0, r, 180, 80, 30, '#c8f8ff', 'rgba(120,200,220,0.4)', 'rgba(80,220,255,0.28)');
      // 눈 덮인 먼 산
      let y = 200;
      for (let x = 0; x < ARENA_W; x += 3) {
        y += (r() - 0.5) * 16; y = clamp(y, 150, 215);
        g0.fillStyle = '#082230'; g0.fillRect(x, y, 3, H - y);
        g0.fillStyle = 'rgba(200,240,255,0.35)'; g0.fillRect(x, y, 3, Math.max(0, (210 - y) * 0.25));
      }
      // 무너진 성 실루엣
      const g = g1;
      ridge(g, r, 245, 8, 4, '#061a24', '#0c2a38');
      for (const cx of [300, 820]) {
        g.fillStyle = '#05151e';
        g.fillRect(cx - 70, 170, 140, 80);
        for (const tx of [-70, 50]) { g.fillRect(cx + tx, 120, 20, 60); for (let i = 0; i < 4; i++) g.fillRect(cx + tx + i * 6, 114, 3, 6); }
        for (let i = 0; i < 8; i++) g.fillRect(cx - 50 + i * 12, 164, 6, 6);
        g.fillStyle = 'rgba(80,230,255,0.6)'; g.fillRect(cx - 62, 140, 3, 5); g.fillRect(cx + 58, 132, 3, 5);
      }
      fogBand(g, 255, 20, 'rgba(80,200,220,0.10)');
      // 가까운 폐허: 아치, 기사 석상, 푸른 화로, 담쟁이
      const h = g2;
      for (let x = 20; x < ARENA_W; x += 160 + Math.floor(r() * 60)) {
        const hgt = 70 + Math.floor(r() * 60);
        bricks(h, r, x, GROUND - hgt, 18, hgt, '#0d2a36', '#071a22', '#1a4656', 6, 4);
        bricks(h, r, x + 70, GROUND - hgt * 0.8, 18, hgt * 0.8, '#0d2a36', '#071a22', '#1a4656', 6, 4);
        h.fillStyle = '#0d2a36';
        for (let a = 0; a <= 20; a++) { const ang = Math.PI + (a / 20) * Math.PI * 0.75; h.fillRect(x + 44 + Math.cos(ang) * 35, GROUND - hgt + 8 + Math.sin(ang) * 30, 6, 6); }
        h.fillStyle = '#1c5a40'; for (let i = 0; i < 14; i++) h.fillRect(x + r() * 18, GROUND - hgt + r() * hgt, 2, 3);
      }
      for (const sx of [250, 700]) {            // 기사 석상
        h.fillStyle = '#123444'; h.fillRect(sx - 12, GROUND - 14, 24, 14);
        h.fillStyle = '#1a4656'; h.fillRect(sx - 5, GROUND - 52, 10, 38); h.fillRect(sx - 4, GROUND - 60, 8, 8); h.fillRect(sx - 9, GROUND - 48, 18, 6);
        h.fillRect(sx + 8, GROUND - 70, 2, 56); h.fillRect(sx + 5, GROUND - 52, 8, 2);
        h.fillStyle = '#245a6a'; h.fillRect(sx - 5, GROUND - 52, 1, 38);
      }
      for (const bx of [120, 480, 860]) {        // 푸른 화로
        h.fillStyle = '#0a1c24'; h.fillRect(bx - 1, GROUND - 26, 2, 26); h.fillRect(bx - 6, GROUND - 30, 12, 4);
        flameDot(h, bx, GROUND - 30, 2.4, '#e0ffff', '#40e0ff', 'rgba(60,220,255,0.25)');
      }
      groundTiles(g3, r, '#174452', '#08202a', '#2f7a8c', '#0f303c');
      for (let i = 0; i < 12; i++) {             // 물웅덩이 (하늘이 비쳐요)
        const x = r() * ARENA_W, w = 16 + r() * 30;
        g3.fillStyle = 'rgba(120,220,240,0.18)'; g3.fillRect(x, GROUND + 6 + r() * 20, w, 2);
      }
      // 앞 실루엣: 돌무더기, 위쪽 담쟁이
      for (let x = 0; x < FG_W; x += 90 + r() * 120) {
        F.fillStyle = '#010608';
        for (let i = 0; i < 6; i++) F.fillRect(x + r() * 50, H - 6 - r() * 22, 10 + r() * 16, 30);
      }
      for (let x = 0; x < FG_W; x += 6 + r() * 20) { F.fillStyle = '#020a0c'; const len = 10 + r() * 40; F.fillRect(x, 0, 1.5, len); F.fillRect(x - 1, len - 2, 3, 2); }
    },
    ambient(g, dt) {
      if (Math.random() < dt * 5) FX.particle({ x: g.camX + rand(0, W), y: rand(100, GROUND), vx: rand(-6, 6), vy: rand(-14, -4), life: 2.5, size: 2, color: '#4ff0ff', glow: true, floor: false });
    },
  },
  {
    name: '지옥의 문턱',
    grade: '#e04010',
    build(L, r, F) {
      const [g0, g1, g2, g3] = L.map(l => l.g);
      skyBands(g0, ['#0e0100', '#3a0702', '#7a1a06', '#b0400c']);
      moon(g0, r, 520, 120, 40, '#ff6a2a', 'rgba(200,40,10,0.5)', 'rgba(255,90,20,0.35)');
      clouds(g0, r, 60, 16, 'rgba(30,5,2,0.6)', 50);
      clouds(g0, r, 140, 18, 'rgba(60,10,4,0.5)', 40);
      // 먼 화산과 용암 폭포
      const g = g1;
      for (const vx of [200, 780]) {
        for (let i = 0; i < 90; i++) { const w = 30 + i * 2.2; g.fillStyle = '#1e0400'; g.fillRect(vx - w / 2, 150 + i, w, 1); }
        glowOn(g, vx, 150, 60, 'rgba(255,120,30,0.35)');
        g.fillStyle = '#ff7a2a'; g.fillRect(vx - 6, 148, 12, 3);
        for (let i = 0; i < 3; i++) { const lx = vx - 20 + i * 18; g.fillStyle = 'rgba(255,110,30,0.7)'; g.fillRect(lx, 160 + i * 6, 2, 70); }
      }
      ridge(g, r, 238, 12, 3, '#180300', '#3a0a02');
      for (let x = 0; x < ARENA_W; x += 40 + Math.floor(r() * 60)) spire(g, x, 240, 18 + r() * 14, 40 + r() * 70, '#1a0300', '#3a0a04');
      fogBand(g, 245, 16, 'rgba(255,90,20,0.12)');
      // 가까운: 사슬 기둥, 해골 무더기, 매달린 철창, 화로
      const h = g2;
      for (let x = 0; x < ARENA_W; x += 90 + Math.floor(r() * 70)) {
        const hgt = 80 + Math.floor(r() * 90);
        h.fillStyle = '#2a0a06'; h.fillRect(x, GROUND - hgt, 12, hgt);
        h.fillStyle = '#5a1a0a'; h.fillRect(x, GROUND - hgt, 1.5, hgt);
        h.fillStyle = '#1a0604'; h.fillRect(x - 3, GROUND - hgt - 4, 18, 4);
        h.fillStyle = '#4a3a3a';
        for (let cy = GROUND - hgt + 10; cy < GROUND - 20; cy += 5) h.fillRect(x + 13 + Math.sin(cy * 0.1) * 3, cy, 2, 3);
        flameDot(h, x + 6, GROUND - hgt - 4, 2, '#fff0a0', '#ff6a1a', 'rgba(255,100,20,0.25)');
      }
      for (let x = 50; x < ARENA_W; x += 130 + r() * 90) {   // 해골 무더기
        for (let i = 0; i < 9; i++) {
          const sx = x + (i % 4) * 5 + (i > 3 ? 2.5 : 0) + (i > 6 ? 2.5 : 0), sy = GROUND - 4 - Math.floor(i / 4) * 4;
          h.fillStyle = '#a89878'; h.fillRect(sx, sy, 4.5, 4); h.fillStyle = '#1a0604'; h.fillRect(sx + 0.8, sy + 1.2, 1, 1); h.fillRect(sx + 2.6, sy + 1.2, 1, 1);
        }
      }
      for (const cx of [330, 720]) {             // 매달린 철창
        h.fillStyle = '#100402'; h.fillRect(cx, 0, 1, 70);
        for (let i = 0; i < 6; i++) h.fillRect(cx - 12 + i * 5, 70, 1, 30);
        h.fillRect(cx - 12, 70, 26, 2); h.fillRect(cx - 12, 100, 26, 2);
      }
      const g3x = g3;
      groundTiles(g3x, r, '#4a1206', '#1c0502', '#ff6a1a', '#2e0a04');
      g3x.fillStyle = '#ff5a10';                  // 용암 틈
      for (let i = 0; i < 50; i++) {
        let x = r() * ARENA_W, y = GROUND + 6 + r() * 40;
        for (let k = 0; k < 12; k++) { g3x.fillRect(x, y, 2, 0.8); x += 2; y += Math.floor(r() * 3) - 1; }
      }
      for (let i = 0; i < 6; i++) {               // 용암 웅덩이
        const x = r() * ARENA_W, w = 30 + r() * 40, y = GROUND + 20 + r() * 25;
        g3x.fillStyle = '#ff7a20'; g3x.fillRect(x, y, w, 3);
        g3x.fillStyle = '#ffd060'; g3x.fillRect(x + 4, y + 1, w - 8, 1);
        glowOn(g3x, x + w / 2, y, w, 'rgba(255,120,30,0.3)');
      }
      // 앞 실루엣: 뾰족 바위, 늘어진 사슬
      for (let x = 0; x < FG_W; x += 70 + r() * 90) spire(F, x, H + 2, 26 + r() * 20, 30 + r() * 40, '#070000', null);
      for (let x = 30; x < FG_W; x += 160 + r() * 120) { F.fillStyle = '#0a0202'; for (let y = 0; y < 30 + r() * 40; y += 4) F.fillRect(x + Math.sin(y * 0.2) * 2, y, 3, 3); }
    },
    ambient(g, dt) {
      if (Math.random() < dt * 14) FX.particle({ x: g.camX + rand(0, W), y: GROUND + rand(0, 20), vx: rand(-10, 10), vy: rand(-50, -20), life: rand(1.5, 3), size: rand(1, 3), color: pick(['#ff9a2a', '#ff5a10', '#ffd060']), glow: true, floor: false });
      if (Math.random() < dt * 4) FX.particle({ x: g.camX + rand(0, W), y: rand(0, 40), vx: rand(-6, 6), vy: rand(15, 30), life: 5, size: 1, color: '#3a3030', glow: false, floor: true });
    },
  },
  {
    name: '용의 둥지',
    grade: '#c08030',
    build(L, r, F) {
      const [g0, g1, g2, g3] = L.map(l => l.g);
      skyBands(g0, ['#070503', '#140d07', '#22160c', '#33220f']);
      // 동굴 벽 질감
      for (let i = 0; i < 400; i++) { g0.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.25)' : 'rgba(80,60,40,0.12)'; g0.fillRect(r() * ARENA_W, r() * H, 4 + r() * 14, 2 + r() * 5); }
      glowOn(g0, 500, 170, 200, 'rgba(255,170,60,0.16)');
      for (let x = 0; x < ARENA_W; x += 5) {     // 천장 고드름
        const hgt = 20 + Math.floor(r() * 70);
        for (let i = 0; i < hgt; i++) { g0.fillStyle = '#100a05'; g0.fillRect(x + i / 12, i, Math.max(0.5, 5 - i / 14), 1); }
      }
      // 빛나는 수정과 거대한 갈비뼈
      const g = g1;
      ridge(g, r, 228, 14, 4, '#1a120a', '#2e2012');
      for (const bx of [260, 720]) {
        g.strokeStyle = '#3a3020'; g.lineWidth = 5;
        g.beginPath(); g.moveTo(bx - 120, 236); g.lineTo(bx + 120, 236); g.stroke();
        g.lineWidth = 3.5;
        for (let i = 0; i < 9; i++) {
          const x = bx - 100 + i * 25;
          g.beginPath(); g.moveTo(x, 236); g.quadraticCurveTo(x + 18, 160 - (i % 2) * 10, x - 4, 120 + Math.abs(i - 4) * 10); g.stroke();
        }
        g.fillStyle = '#4a3e2a'; g.fillRect(bx + 120, 222, 26, 18); g.fillStyle = '#100a05'; g.fillRect(bx + 126, 226, 5, 5); g.fillRect(bx + 136, 226, 5, 5);
      }
      for (let i = 0; i < 18; i++) {             // 수정
        const x = r() * ARENA_W, y = 225 + r() * 15, hgt = 8 + r() * 18;
        const col = r() < 0.5 ? '#ff9a3c' : '#e0c060';
        g.fillStyle = col;
        for (let k = 0; k < hgt; k++) g.fillRect(x - (hgt - k) * 0.18, y - k, (hgt - k) * 0.36 + 0.5, 1);
        g.fillStyle = '#fff2c0'; g.fillRect(x - 0.3, y - hgt * 0.8, 0.6, hgt * 0.6);
        glowOn(g, x, y - hgt / 2, 18, 'rgba(255,170,60,0.22)');
      }
      // 가까운: 금화 더미, 보물상자, 꽂힌 칼, 바위 기둥
      const h = g2;
      for (let x = 0; x < ARENA_W; x += 120 + Math.floor(r() * 100)) {
        const hgt = 80 + Math.floor(r() * 100), w = 24 + Math.floor(r() * 14);
        h.fillStyle = '#2a1d10'; h.fillRect(x, GROUND - hgt, w, hgt);
        h.fillStyle = '#3e2c18'; h.fillRect(x, GROUND - hgt, 3, hgt);
        for (let i = 0; i < 6; i++) { h.fillStyle = 'rgba(0,0,0,0.3)'; h.fillRect(x + r() * w, GROUND - r() * hgt, 4, 1); }
        for (let i = 0; i < 10; i++) h.fillRect(x + i / 3, GROUND - hgt - i, w - i * 0.66, 1);
      }
      for (let x = 30; x < ARENA_W; x += 150 + r() * 80) {   // 금화 언덕
        const w = 50 + r() * 50, hgt = 10 + r() * 12;
        for (let i = 0; i < hgt; i++) {
          const ww = w * Math.sqrt(1 - (i / hgt) * (i / hgt));
          h.fillStyle = i % 3 ? '#b07818' : '#d09a28'; h.fillRect(x + (w - ww) / 2, GROUND - i, ww, 1);
        }
        h.fillStyle = '#fff0a0';
        for (let k = 0; k < 14; k++) h.fillRect(x + w * 0.15 + r() * w * 0.7, GROUND - r() * hgt * 0.9, 1, 1);
        glowOn(h, x + w / 2, GROUND - hgt / 2, w * 0.6, 'rgba(255,190,60,0.15)');
        if (r() < 0.6) {                          // 꽂힌 칼
          const sx = x + w * (0.3 + r() * 0.4);
          h.fillStyle = '#9aa0b0'; h.fillRect(sx, GROUND - hgt - 20, 1.5, 20); h.fillStyle = '#5a3a1a'; h.fillRect(sx - 3, GROUND - hgt - 20, 7.5, 1.5); h.fillRect(sx, GROUND - hgt - 26, 1.5, 6);
        }
      }
      for (const cx of [360, 820]) {             // 보물상자
        h.fillStyle = '#4a2a10'; h.fillRect(cx, GROUND - 12, 20, 12); h.fillRect(cx + 1, GROUND - 16, 18, 4);
        h.fillStyle = '#d0a030'; h.fillRect(cx, GROUND - 12, 20, 1); h.fillRect(cx + 9, GROUND - 14, 2, 4);
      }
      groundTiles(g3, r, '#4a3620', '#1e150c', '#7a5a34', '#2e2214');
      for (let i = 0; i < 160; i++) { g3.fillStyle = r() < 0.5 ? '#c09028' : '#fff0a0'; g3.fillRect(r() * ARENA_W, GROUND + 3 + r() * 30, 1, 0.7); }
      // 앞 실루엣: 석순과 고드름
      for (let x = 0; x < FG_W; x += 60 + r() * 100) spire(F, x, H + 2, 18 + r() * 16, 40 + r() * 50, '#040201', null);
      for (let x = 0; x < FG_W; x += 30 + r() * 60) { const hgt = 20 + r() * 50; for (let i = 0; i < hgt; i++) { F.fillStyle = '#050302'; F.fillRect(x + i / 10, i, Math.max(0.5, 10 - i / 5), 1); } }
    },
    ambient(g, dt) {
      if (Math.random() < dt * 3) FX.particle({ x: g.camX + rand(0, W), y: rand(0, 60), vx: rand(-4, 4), vy: rand(20, 40), life: 4, size: 1, color: '#8a7050', glow: false, floor: true });
      if (Math.random() < dt * 2) FX.particle({ x: g.camX + rand(0, W), y: rand(150, GROUND), vx: rand(-4, 4), vy: rand(-10, -2), life: 3, size: 2, color: '#ffb050', glow: true, floor: false });
    },
  },
];

// 배경 4층 + 앞 실루엣 층을 만들어서 돌려줘요
function buildStage(index) {
  const st = STAGES[index];
  const r = seeded(1234 + index * 777);
  const L = [makeLayer(), makeLayer(), makeLayer(), makeLayer()];
  const fg = makeLayer(FG_W);
  st.build(L, r, fg.g);
  return {
    def: st,
    layers: [{ c: L[0].c, f: 0.15 }, { c: L[1].c, f: 0.4 }, { c: L[2].c, f: 0.75 }, { c: L[3].c, f: 1 }],
    front: { c: fg.c, f: 1.15 },
  };
}

function mixColor(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const ch = s => [(s >> 16) & 255, (s >> 8) & 255, s & 255];
  const A = ch(pa), B = ch(pb);
  return 'rgb(' + A.map((v, i) => Math.round(lerp(v, B[i], t))).join(',') + ')';
}

function drawStageBack(ctx, stage, camX) {
  for (const l of stage.layers) ctx.drawImage(l.c, snap(-camX * l.f), 0, ARENA_W, H);
}

// 캐릭터 앞에 그리는 어두운 실루엣 (가장 빨리 움직여서 깊이감이 생겨요)
function drawStageFront(ctx, stage, camX) {
  if (!stage.front) return;
  ctx.drawImage(stage.front.c, snap(-camX * stage.front.f), 0, FG_W, H);
}
