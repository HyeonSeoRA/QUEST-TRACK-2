'use strict';
// 그림 도구 — 점·사각형·타원·다각형으로 그리고, 그림자·반사광·테두리를 자동으로 넣어서 스프라이트를 만든다

function newCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

// 도트 해상도: 게임 좌표 1칸 = 도트 2x2 칸 (화면 960x540 도트). 이 캔버스를 창 크기에 맞게 네모 블록 그대로 키운다
const R = 2;
// 캐릭터 그림은 게임 좌표 1칸 = 도트 1칸 (화면에서는 2x2 블록). 영웅은 직접 찍은 24x32 도트 그림
const GS = 1;
const UNIT = GS / R;
// 전투에서 그림을 그리는 크기 (게임 좌표 배율)
const BODY = 1;

// 모든 좌표는 게임 좌표(작은 칸)로 받고, 캔버스는 R배로 늘어나 있다. 둥근 모양은 부드럽게 그린다.
function painter(g) {
  const TAU = Math.PI * 2;
  const P = {
    g,
    px(x, y, c) { if (!c) return; g.fillStyle = c; g.beginPath(); g.arc(Math.floor(x) + 0.5, Math.floor(y) + 0.5, 0.62, 0, TAU); g.fill(); },
    rect(x, y, w, h, c) { if (w <= 0 || h <= 0) return; g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); },
    ell(cx, cy, rx, ry, c) {
      if (rx <= 0 || ry <= 0) return;
      g.fillStyle = c; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, TAU); g.fill();
    },
    // 둥근 덩어리를 어두운 바탕 → 본색 → 밝은 면 → 반짝임 순서로 칠해서 입체감을 준다
    ball(cx, cy, rx, ry, r) {
      P.ell(cx, cy, rx, ry, r[0]);
      P.ell(cx - rx * 0.1, cy - ry * 0.12, rx * 0.88, ry * 0.86, r[1]);
      if (r[2]) {
        g.globalAlpha = 0.55; P.ell(cx - rx * 0.22, cy - ry * 0.26, rx * 0.62, ry * 0.55, r[2]);
        g.globalAlpha = 1; P.ell(cx - rx * 0.3, cy - ry * 0.34, rx * 0.44, ry * 0.36, r[2]);
      }
      if (r[3]) P.ell(cx - rx * 0.42, cy - ry * 0.52, Math.max(0.6, rx * 0.14), Math.max(0.6, ry * 0.12), r[3]);
    },
    poly(pts, c) {
      g.fillStyle = c; g.beginPath();
      pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.closePath(); g.fill();
    },
    line(x0, y0, x1, y1, c, w = 1) {
      g.strokeStyle = c; g.lineWidth = w <= 1 ? 1 : w; g.lineCap = 'round';
      g.beginPath();
      const o = w <= 1 ? 0.5 : 0;
      g.moveTo(x0 + o, y0 + o); g.lineTo(x1 + o, y1 + o); g.stroke();
    },
    dith(x, y, w, h, c) { g.globalAlpha = 0.5; P.rect(x, y, w, h, c); g.globalAlpha = 1; },
    cut(cx, cy, rx, ry) { g.save(); g.globalCompositeOperation = 'destination-out'; P.ell(cx, cy, rx, ry, '#000'); g.restore(); },
  };
  return P;
}

// 반쯤 투명한 가장자리를 정리한다 (도트 그림은 반투명 픽셀이 없다)
function harden(d) { for (let i = 3; i < d.length; i += 4) d[i] = d[i] >= 128 ? 255 : 0; }

// 그림에 넓게 쓰인 색만 남기고, 경계에 생긴 어중간한 색은 가장 가까운 색으로 바꾼다
function snapPalette(d, minCount = 4) {
  const cnt = new Map();
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const k = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
    cnt.set(k, (cnt.get(k) || 0) + 1);
  }
  const pal = [];
  for (const [k, c] of cnt) if (c >= minCount) pal.push([(k >> 16) & 255, (k >> 8) & 255, k & 255]);
  if (!pal.length) return;
  const memo = new Map();
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const k = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
    if (cnt.get(k) >= minCount) continue;
    let best = memo.get(k);
    if (!best) {
      let bd = 1e9;
      for (const p of pal) { const dd = (p[0] - d[i]) ** 2 + (p[1] - d[i + 1]) ** 2 + (p[2] - d[i + 2]) ** 2; if (dd < bd) { bd = dd; best = p; } }
      memo.set(k, best);
    }
    d[i] = best[0]; d[i + 1] = best[1]; d[i + 2] = best[2];
  }
}

// 도트식 명암: 왼쪽 위 가장자리 한 칸은 밝게, 오른쪽 아래 가장자리 한 칸은 어둡게,
// 밝은 색 위에 어두운 색이 얹힌 경계 아래 한 칸에 그림자
function shadeEdges(d, w, h) {
  const out = new Uint8ClampedArray(d);
  const A = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? 0 : d[(y * w + x) * 4 + 3]);
  const toward = (i, f, r, g, b) => { out[i] += (r - d[i]) * f; out[i + 1] += (g - d[i + 1]) * f; out[i + 2] += (b - d[i + 2]) * f; };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (!d[i + 3]) continue;
      if (!A(x - 1, y - 1) || !A(x, y - 1)) toward(i, 0.28, 255, 244, 214);
      else if (!A(x + 1, y + 1) || !A(x, y + 1)) toward(i, 0.32, 20, 12, 28);
      else if (y > 0) {
        const j = i - w * 4;
        const lumJ = d[j] + d[j + 1] + d[j + 2], lumI = d[i] + d[i + 1] + d[i + 2];
        if (Math.abs(d[j] - d[i]) + Math.abs(d[j + 1] - d[i + 1]) + Math.abs(d[j + 2] - d[i + 2]) > 90 && lumJ < lumI) toward(i, 0.22, 20, 12, 28);
      }
    }
  }
  d.set(out);
}

// 투명한 칸 바로 옆(위아래좌우)에 색이 있으면, 그 색을 아주 어둡게 한 색으로 테두리를 그린다
const RING = [];
for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && dx * dx + dy * dy <= 1) RING.push([dx, dy, dx * dx + dy * dy]);
RING.sort((a, b) => a[2] - b[2]);
function outlineData(d, w, h) {
  const out = new Uint8ClampedArray(d);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (d[i + 3]) continue;
      let n = -1;
      for (const [dx, dy] of RING) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const j = (yy * w + xx) * 4;
        if (d[j + 3] > 200) { n = j; break; }
      }
      if (n < 0) continue;
      out[i] = d[n] * 0.25 + 20 * 0.75;
      out[i + 1] = d[n + 1] * 0.2 + 12 * 0.8;
      out[i + 2] = d[n + 2] * 0.25 + 30 * 0.75;
      out[i + 3] = 255;
    }
  }
  d.set(out);
}
function finishSprite(c, opts) {
  const g = c.getContext('2d'), w = c.width, h = c.height;
  const id = g.getImageData(0, 0, w, h), d = id.data;
  harden(d);
  snapPalette(d);
  if (opts.shade !== false) shadeEdges(d, w, h);
  if (opts.outline !== false) outlineData(d, w, h);
  g.putImageData(id, 0, 0);
}
// 스프라이트를 게임 좌표 크기로 그리기
function dimg(g, img, x, y, k = 1) { g.drawImage(img, Math.round(x * R) / R, Math.round(y * R) / R, (img.width / GS) * k, (img.height / GS) * k); }

function silhouette(c, color) {
  const s = newCanvas(c.width, c.height), g = s.getContext('2d');
  g.drawImage(c, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  return s;
}

// ---------- 스프라이트 목록 ----------
const SPR_DEF = {}, SPR = {};
function defSprite(name, w, h, frames, draw, opts = {}) { SPR_DEF[name] = { w, h, frames, draw, opts }; }
function getSprite(name) {
  if (SPR[name]) return SPR[name];
  const d = SPR_DEF[name];
  if (!d) throw new Error('없는 그림: ' + name);
  const frames = [];
  for (let f = 0; f < d.frames; f++) {
    const c = newCanvas(d.w * GS, d.h * GS), g = c.getContext('2d');
    g.setTransform(GS, 0, 0, GS, 0, 0);
    d.draw(painter(g), f);
    g.setTransform(1, 0, 0, 1, 0, 0);
    finishSprite(c, d.opts);
    frames.push(c);
  }
  const s = { name, w: d.w, h: d.h, frames, white: frames.map(c => silhouette(c, '#ffffff')), tint: {} };
  SPR[name] = s;
  return s;
}
function tintOf(s, f, color) {
  const k = color + f;
  if (!s.tint[k]) s.tint[k] = silhouette(s.frames[f], color);
  return s.tint[k];
}
// 화면 위 HTML 에 넣을 그림 주소
const _urlCache = {};
function sprURL(name, f = 0) {
  const k = name + ':' + f;
  if (!_urlCache[k]) _urlCache[k] = getSprite(name).frames[f].toDataURL();
  return _urlCache[k];
}
function sprImg(name, scale = 1, cls = '') {
  const s = getSprite(name);
  return `<img class="pix ${cls}" src="${sprURL(name)}" style="width:${s.w * scale}px;height:${s.h * scale}px" alt="">`;
}

// ---------- 숫자 글꼴 (3x5) ----------
const DIGITS = {
  0: '111101101101111', 1: '010110010010111', 2: '111001111100111', 3: '111001111001111', 4: '101101111001001',
  5: '111100111001111', 6: '111100111101111', 7: '111001010010010', 8: '111101111101111', 9: '111101111001111',
  '+': '000010111010000', '-': '000000111000000',
};
function numWidth(str, s) { return str.length * 4 * s - s; }
function drawNum(g, str, x, y, color, s = 2, edge = '#140c1c') {
  str = String(str);
  x = Math.round(x - numWidth(str, s) / 2); y = Math.round(y);
  const draw = (ox, oy, col) => {
    g.fillStyle = col;
    for (let k = 0; k < str.length; k++) {
      const m = DIGITS[str[k]];
      if (!m) continue;
      for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) if (m[j * 3 + i] === '1') g.fillRect(x + ox + (k * 4 + i) * s, y + oy + j * s, s, s);
    }
  };
  for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1]]) draw(ox, oy, edge);
  draw(0, 0, color);
}

// 캔버스에 한글 글자 (테두리 포함)
const FONT = "'Galmuri11', 'Galmuri9', 'DotGothic16', 'Malgun Gothic', sans-serif";
const FONT_B = "'Galmuri11 Bold', 'Galmuri11', 'Malgun Gothic', sans-serif";
function drawText(g, str, x, y, color, size = 11, align = 'center', edge = '#140c1c', bold) {
  g.font = `${size}px ${bold ? FONT_B : FONT}`;
  g.textAlign = align;
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  g.strokeStyle = edge; g.lineWidth = Math.max(1.5, size / 5);
  g.strokeText(str, x, y + 0.3);
  g.fillStyle = color;
  g.fillText(str, x, y);
}

// ---------- 디더 그라데이션 (게임 좌표로 받고, 실제 픽셀 단위로 곱게 찍는다) ----------
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];
function ditherGrad(g, x, y, w, h, cols) {
  const S = g.getTransform().a;
  const X = Math.round(x * S), Y = Math.round(y * S), Wd = Math.round(w * S), Hd = Math.round(h * S);
  const id = g.getImageData(X, Y, Wd, Hd), d = id.data, rgb = cols.map(hexRgb);
  for (let j = 0; j < Hd; j++) {
    const t = (j / Math.max(1, Hd - 1)) * (cols.length - 1), i0 = Math.min(cols.length - 2, Math.floor(t)), fr = t - i0;
    for (let i = 0; i < Wd; i++) {
      const th = (BAYER[(Y + j) & 3][(X + i) & 3] + 0.5) / 16;
      const c = rgb[fr > th ? i0 + 1 : i0], k = (j * Wd + i) * 4;
      d[k] = c[0]; d[k + 1] = c[1]; d[k + 2] = c[2]; d[k + 3] = 255;
    }
  }
  g.putImageData(id, X, Y);
}
// 부드러운 빛 덩어리를 고운 점으로 찍기 (배경 만들 때)
function ditherGlow(g, cx, cy, r, color, strength = 0.6) {
  const S = g.getTransform().a, c = hexRgb(color);
  const X0 = Math.max(0, Math.floor((cx - r) * S)), Y0 = Math.max(0, Math.floor((cy - r) * S));
  const X1 = Math.min(g.canvas.width, Math.ceil((cx + r) * S)), Y1 = Math.min(g.canvas.height, Math.ceil((cy + r) * S));
  if (X1 <= X0 || Y1 <= Y0) return;
  const id = g.getImageData(X0, Y0, X1 - X0, Y1 - Y0), d = id.data, w = X1 - X0;
  for (let Y = Y0; Y < Y1; Y++) {
    for (let X = X0; X < X1; X++) {
      const dd = Math.hypot((X + 0.5) / S - cx, (Y + 0.5) / S - cy) / r;
      if (dd > 1) continue;
      const v = (1 - dd) * strength;
      if (v * 16 > BAYER[Y & 3][X & 3] + 0.5) { const k = ((Y - Y0) * w + (X - X0)) * 4; d[k] = c[0]; d[k + 1] = c[1]; d[k + 2] = c[2]; }
    }
  }
  g.putImageData(id, X0, Y0);
}
// 매 프레임 쓰는 부드러운 빛
function softGlow(g, x, y, r, color, a = 0.5) {
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  const [cr, cg, cb] = hexRgb(color);
  gr.addColorStop(0, `rgba(${cr},${cg},${cb},${a})`);
  gr.addColorStop(0.5, `rgba(${cr},${cg},${cb},${a * 0.35})`);
  gr.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
  g.fillStyle = gr;
  g.fillRect(x - r, y - r, r * 2, r * 2);
}
