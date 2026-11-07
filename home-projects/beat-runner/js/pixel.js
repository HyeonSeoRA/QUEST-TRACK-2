'use strict';
/* 픽셀 그림 엔진
 * - 모양(타원, 캡슐, 다각형)을 겹쳐 놓으면, 빛 방향(왼쪽 위)에 맞춰 입체 그늘을 자동으로 칠해요.
 * - 색은 '램프'(어두움→밝음 5단계)로 칠하고, 그늘은 푸르게 / 밝은 곳은 노랗게 살짝 색을 돌려요.
 * - 바깥 테두리와 겹친 부분의 안쪽 선도 자동으로 그려요. */

/* ---------- 색 ---------- */
const _cc = new Map();
function rgbOf(hex) { const n = parseInt(hex.slice(1, 7), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function hexOf(r, g, b) { return '#' + [r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join(''); }
function C32(hex, a = 255) {
  const k = a === 255 ? hex : hex + a; let v = _cc.get(k);
  if (v === undefined) { const [r, g, b] = rgbOf(hex); v = ((a << 24) | (b << 16) | (g << 8) | r) >>> 0; _cc.set(k, v); }
  return v;
}
function mixHex(h1, h2, t) { const a = rgbOf(h1), b = rgbOf(h2); return hexOf(lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)); }
function rgb2hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  if (mx === mn) return [0, 0, l];
  const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}
function hsl2hex(h, s, l) {
  h = ((h % 1) + 1) % 1;
  if (s === 0) return hexOf(l * 255, l * 255, l * 255);
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
  const f = t => { t = ((t % 1) + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  return hexOf(f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255);
}
function hueToward(h, target, t) { let d = target - h; if (d > 0.5) d -= 1; if (d < -0.5) d += 1; return h + d * t; }

// 램프: 기본색 하나로 어두움→밝음 n단계를 만들어요
function ramp(hex, n = 5, o = {}) {
  const [h, s, l] = rgb2hsl(...rgbOf(hex));
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = (i / (n - 1)) * 2 - 1;
    let nl, nh, ns;
    if (t < 0) { nl = l * (1 + (o.dark || 0.62) * t); nh = hueToward(h, o.shadowHue != null ? o.shadowHue : 0.72, -t * 0.14); ns = clamp(s + 0.06 * -t, 0, 1); }
    else { nl = l + (1 - l) * (o.light || 0.5) * t; nh = hueToward(h, 0.13, t * 0.07); ns = clamp(s - 0.08 * t, 0, 1); }
    out.push(hsl2hex(nh, ns, clamp(nl, 0.02, 0.98)));
  }
  return out;
}
const RAMP_CACHE = {};
function R(hex, o) { const k = hex + JSON.stringify(o || {}); return RAMP_CACHE[k] || (RAMP_CACHE[k] = ramp(hex, 5, o)); }

/* ---------- 픽셀 버퍼 ---------- */
class PB {
  constructor(w, h) { this.w = w; this.h = h; this.d = new Uint32Array(w * h); this.glows = []; this.frames = []; }
  set(x, y, hex, a = 255) {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    this.d[y * this.w + x] = C32(hex, a);
  }
  setC(x, y, c) { if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.d[y * this.w + x] = c; }
  get(x, y) { return (x < 0 || y < 0 || x >= this.w || y >= this.h) ? 0 : this.d[y * this.w + x]; }
  // 반투명 덧칠
  blend(x, y, hex, a) {
    x = Math.floor(x); y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || a <= 0) return;
    const i = y * this.w + x, o = this.d[i], oa = (o >>> 24) / 255;
    const [r, g, b] = rgbOf(hex);
    if (oa === 0) { this.d[i] = C32(hex, Math.round(a * 255)); return; }
    const or = o & 255, og = (o >> 8) & 255, ob = (o >> 16) & 255;
    const na = a + oa * (1 - a);
    const mixc = (c, oc) => (c * a + oc * oa * (1 - a)) / na;
    this.d[i] = ((Math.round(na * 255) << 24) | (Math.round(mixc(b, ob)) << 16) | (Math.round(mixc(g, og)) << 8) | Math.round(mixc(r, or))) >>> 0;
  }
  // 상자 흐림 (가로로 이어지는 그림이면 wrap=true)
  blur(r, wrap = false) {
    if (r <= 0) return this;
    const { w, h, d } = this, n = w * h;
    const ch = [new Float32Array(n), new Float32Array(n), new Float32Array(n), new Float32Array(n)];
    for (let i = 0; i < n; i++) { const c = d[i], a = (c >>> 24) / 255; ch[0][i] = (c & 255) * a; ch[1][i] = ((c >> 8) & 255) * a; ch[2][i] = ((c >> 16) & 255) * a; ch[3][i] = a; }
    const pass = (src, horiz) => {
      const dst = new Float32Array(n), len = horiz ? w : h, cnt = horiz ? h : w;
      for (let line = 0; line < cnt; line++) {
        let sum = 0;
        const at = k => { if (wrap && horiz) k = ((k % len) + len) % len; else k = clamp(k, 0, len - 1); return horiz ? line * w + k : k * w + line; };
        for (let k = -r; k <= r; k++) sum += src[at(k)];
        for (let k = 0; k < len; k++) { dst[at(k)] = sum / (2 * r + 1); sum += src[at(k + r + 1)] - src[at(k - r)]; }
      }
      return dst;
    };
    for (let c = 0; c < 4; c++) ch[c] = pass(pass(ch[c], true), false);
    for (let i = 0; i < n; i++) {
      const a = ch[3][i];
      if (a < 0.004) { d[i] = 0; continue; }
      d[i] = ((Math.round(a * 255) << 24) | (clamp(Math.round(ch[2][i] / a), 0, 255) << 16) | (clamp(Math.round(ch[1][i] / a), 0, 255) << 8) | clamp(Math.round(ch[0][i] / a), 0, 255)) >>> 0;
    }
    return this;
  }
  rect(x, y, w, h, hex, a = 255) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, hex, a); }
  glow(x, y, r, css, a = 0.6) { this.glows.push({ x, y, r, css, a }); }
  frame(name, x, y, w, h) { this.frames.push({ name, x, y, w, h }); }
  toTexture(scene, key) {
    if (scene.textures.exists(key)) scene.textures.remove(key);
    const t = scene.textures.createCanvas(key, this.w, this.h);
    const ctx = t.getContext();
    const img = ctx.createImageData(this.w, this.h);
    new Uint32Array(img.data.buffer).set(this.d);
    ctx.putImageData(img, 0, 0);
    if (this.glows.length) {
      ctx.globalCompositeOperation = 'lighter';
      for (const g of this.glows) {
        const gr = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, g.r);
        const [r, gg, b] = rgbOf(g.css);
        gr.addColorStop(0, `rgba(${r},${gg},${b},${g.a})`);
        gr.addColorStop(0.4, `rgba(${r},${gg},${b},${g.a * 0.35})`);
        gr.addColorStop(1, `rgba(${r},${gg},${b},0)`);
        ctx.fillStyle = gr; ctx.fillRect(g.x - g.r, g.y - g.r, g.r * 2, g.r * 2);
      }
      ctx.globalCompositeOperation = 'source-over';
    }
    for (const f of this.frames) t.add(f.name, 0, f.x, f.y, f.w, f.h);
    t.refresh();
    return t;
  }
}

/* ---------- 모양 ---------- */
const LIGHT = (() => { const v = [-0.55, -0.72, 0.55], l = Math.hypot(...v); return v.map(x => x / l); })();
const BAYER4 = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];

function E(x, y, rx, ry, r, o = {}) { return Object.assign({ t: 'e', x, y, rx, ry, r }, o); }
function Cap(x1, y1, x2, y2, r1, r2, r, o = {}) { return Object.assign({ t: 'c', x1, y1, x2, y2, r1, r2, r }, o); }
function Poly(pts, r, o = {}) { return Object.assign({ t: 'p', pts, r }, o); }

function prepPart(p) {
  if (p.t === 'e') {
    const m = Math.max(p.rx, p.ry) * (1 + (p.rough || 0)) + 1;
    p.bb = [p.x - m, p.y - m, p.x + m, p.y + m];
    if (p.rot) { p.cs = Math.cos(-p.rot); p.sn = Math.sin(-p.rot); }
  } else if (p.t === 'c') {
    const m = Math.max(p.r1, p.r2) * (1 + (p.rough || 0)) + 1;
    p.bb = [Math.min(p.x1, p.x2) - m, Math.min(p.y1, p.y2) - m, Math.max(p.x1, p.x2) + m, Math.max(p.y1, p.y2) + m];
    p.vx = p.x2 - p.x1; p.vy = p.y2 - p.y1; p.L2 = p.vx * p.vx + p.vy * p.vy;
  } else {
    const xs = p.pts.map(q => q[0]), ys = p.pts.map(q => q[1]);
    p.bb = [Math.min(...xs) - 1, Math.min(...ys) - 1, Math.max(...xs) + 1, Math.max(...ys) + 1];
    const cx = xs.reduce((a, b) => a + b, 0) / xs.length, cy = ys.reduce((a, b) => a + b, 0) / ys.length;
    p.edges = p.pts.map((a, i) => {
      const b = p.pts[(i + 1) % p.pts.length];
      const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1;
      let nx = dy / L, ny = -dx / L;
      const mx = (a[0] + b[0]) / 2 - cx, my = (a[1] + b[1]) / 2 - cy;
      if (nx * mx + ny * my < 0) { nx = -nx; ny = -ny; }
      return { ax: a[0], ay: a[1], dx, dy, L2: L * L, nx, ny };
    });
    p.h0 = Math.min(...ys); p.hh = Math.max(...ys) - p.h0 || 1;
  }
  return p;
}

// 점(x,y)가 모양 안이면 법선(빛 계산용)을, 아니면 null
function hitPart(p, x, y) {
  if (p.t === 'e') {
    let dx = x - p.x, dy = y - p.y;
    if (p.rot) { const a = dx * p.cs - dy * p.sn, b = dx * p.sn + dy * p.cs; dx = a; dy = b; }
    const u = dx / p.rx, v = dy / p.ry;
    let d = u * u + v * v;
    if (p.rough) { if (d > (1 + p.rough) * (1 + p.rough)) return null; const thr = 1 + p.rough * (PNOISE((x + p.x * 7) / (p.rs || 3), (y + p.y * 5) / (p.rs || 3), 2) - 0.5) * 2; if (d > thr * thr) return null; d = Math.min(d / (thr * thr), 0.999); }
    else if (d > 1) return null;
    let nx = u, ny = v;
    if (p.rot) { const c = Math.cos(p.rot), s = Math.sin(p.rot); const a = nx * c - ny * s, b = nx * s + ny * c; nx = a; ny = b; }
    return [nx, ny, Math.sqrt(1 - d)];
  }
  if (p.t === 'c') {
    let t = p.L2 ? ((x - p.x1) * p.vx + (y - p.y1) * p.vy) / p.L2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const qx = p.x1 + p.vx * t, qy = p.y1 + p.vy * t;
    let r = p.r1 + (p.r2 - p.r1) * t;
    if (p.rough) r *= 1 + p.rough * (PNOISE((x + p.x1 * 3) / (p.rs || 3), (y + p.y1 * 3) / (p.rs || 3), 2) - 0.5) * 2;
    const dx = x - qx, dy = y - qy, d2 = dx * dx + dy * dy;
    if (d2 > r * r) return null;
    const nx = dx / r, ny = dy / r;
    return [nx, ny, Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny))];
  }
  // 다각형: 짝수-홀수 규칙
  let inside = false;
  const pts = p.pts;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
  }
  if (!inside) return null;
  const bev = p.bevel != null ? p.bevel : 1.6;
  let md = 1e9, en = null;
  for (const e of p.edges) {
    let t = ((x - e.ax) * e.dx + (y - e.ay) * e.dy) / e.L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const d = Math.hypot(x - (e.ax + e.dx * t), y - (e.ay + e.dy * t));
    if (d < md) { md = d; en = e; }
  }
  const tilt = p.tilt || [0, -0.25];
  let nx = tilt[0] - (p.grad ? 0 : 0), ny = tilt[1] + (p.grad ? ((y - p.h0) / p.hh - 0.5) * p.grad : 0), nz = 1;
  if (md < bev && en) { const k = 1 - md / bev; nx += en.nx * k * 0.9; ny += en.ny * k * 0.9; nz = 1 - k * 0.3; }
  const L = Math.hypot(nx, ny, nz);
  return [nx / L, ny / L, nz / L];
}

function shadeIdx(p, n, gx, gy) {
  if (p.flat != null) return p.flat;
  const amb = p.amb != null ? p.amb : 0.24;
  const I = Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]);
  let v = (amb + (1 - amb) * I) * (p.bright || 1) + (p.add || 0);
  // 덩어리진 질감: 규칙적인 점 대신 자연스러운 얼룩 (잎사귀, 나무껍질, 흙)
  if (p.tex) { const ts = p.ts || [3, 3]; v += (PNOISE(gx / ts[0], gy / ts[1], 2) - 0.5) * p.tex; }
  const N = p.r.length;
  const k = v * (N - 1) + (BAYER4[gy & 3][gx & 3] / 16 - 0.5) * (p.dither != null ? p.dither : 0.3);
  return clamp(Math.round(k), 0, N - 1);
}

/* 그리기: pb 의 (ox,oy) 에서 w×h 칸 안에 parts 를 차례로 그려요 */
function scalePart(p, S) {
  const q = Object.assign({}, p);
  if (q.t === 'e') { q.x *= S; q.y *= S; q.rx *= S; q.ry *= S; }
  else if (q.t === 'c') { q.x1 *= S; q.y1 *= S; q.x2 *= S; q.y2 *= S; q.r1 *= S; q.r2 *= S; }
  else q.pts = q.pts.map(([x, y]) => [x * S, y * S]);
  if (q.rs) q.rs *= S;
  if (q.bevel) q.bevel *= S;
  return q;
}
/* 크게 그리는 붓: 원래 좌표로 그린 그림을 S배 크기로 '다시' 그려요 (늘리는 게 아니라 더 세밀하게) */
function scaledPB(real, S, ox0, dx, dy) {
  const X = x => dx + (x - ox0) * S, Y = y => dy + y * S, n = Math.max(1, Math.round(S));
  return {
    __s: S, real, ox0, dx, dy,
    set(x, y, c, a = 255) { real.rect(Math.floor(X(x)), Math.floor(Y(y)), n, n, c, a); },
    blend(x, y, c, a) { for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) real.blend(Math.floor(X(x)) + i, Math.floor(Y(y)) + j, c, a); },
    rect(x, y, w, h, c, a = 255) { real.rect(Math.floor(X(x)), Math.floor(Y(y)), Math.round(w * S), Math.round(h * S), c, a); },
    glow(x, y, r, c, a) { real.glow(X(x), Y(y), r * S, c, a); },
  };
}
/* 스티커 테두리: 그림 바깥에 밝은 선 1칸 + 옅은 선 1칸 (어떤 배경에서도 잘 보여요) */
function stickerOutline(pb, hex) {
  const { w, h, d } = pb, filled = i => (d[i] >>> 24) > 40;
  const ring = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; if (filled(i)) continue;
    if ((x > 0 && filled(i - 1)) || (x < w - 1 && filled(i + 1)) || (y > 0 && filled(i - w)) || (y < h - 1 && filled(i + w))) ring[i] = 1;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; if (filled(i) || ring[i]) continue;
    let near = false;
    for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx >= 0 && yy >= 0 && xx < w && yy < h && ring[yy * w + xx] === 1) { near = true; break; } }
    if (near) ring[i] = 2;
  }
  for (let i = 0; i < w * h; i++) if (ring[i]) d[i] = C32(hex, ring[i] === 1 ? 255 : 105);
}
function renderParts(pb, ox, oy, w, h, parts, opt = {}) {
  if (pb.__s) { const S = pb.__s; return renderParts(pb.real, pb.dx + (ox - pb.ox0) * S, pb.dy + oy * S, Math.round(w * S), Math.round(h * S), parts.map(p => scalePart(p, S)), opt); }
  const ids = new Int16Array(w * h).fill(-1);
  const idx = new Int8Array(w * h);
  parts.forEach((p, i) => {
    prepPart(p);
    const x0 = Math.max(0, Math.floor(p.bb[0])), y0 = Math.max(0, Math.floor(p.bb[1]));
    const x1 = Math.min(w - 1, Math.ceil(p.bb[2])), y1 = Math.min(h - 1, Math.ceil(p.bb[3]));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const n = hitPart(p, x + 0.5, y + 0.5);
      if (!n) continue;
      ids[y * w + x] = i;
      idx[y * w + x] = shadeIdx(p, n, ox + x, oy + y);
    }
  });
  const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const out = new Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = y * w + x, i = ids[k]; if (i < 0) continue;
    const p = parts[i];
    let c = idx[k];
    // 빛이 오는 쪽(왼쪽 위) 가장자리는 한 단계 밝게: 또렷하고 입체적으로 보여요
    if (p.hl !== false && p.flat == null) {
      const L1 = x > 0 ? ids[k - 1] : -1, L2 = y > 0 ? ids[k - w] : -1;
      if ((L1 !== i && (L1 < 0 || L1 < i)) || (L2 !== i && (L2 < 0 || L2 < i))) c = Math.min(p.r.length - 1, c + 1);
    }
    let col = p.r[c];
    // 안쪽 선: 앞 모양이 뒤 모양(다른 재질) 위에 겹친 경계
    if (opt.inner !== false && p.line !== false) {
      for (const [dx, dy] of N4) {
        const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const j = ids[yy * w + xx];
        if (j >= 0 && j < i && parts[j].r !== p.r && parts[j].line !== false && (p.grp == null || p.grp !== parts[j].grp)) { col = p.lc || p.r.lc || (dx > 0 || dy > 0 ? p.r[0] : p.r[Math.max(0, Math.min(1, c - 1))]); break; }
      }
    }
    out[k] = col;
  }
  for (let k = 0; k < w * h; k++) {
    if (ids[k] < 0) continue;
    const p = parts[ids[k]];
    pb.set(ox + (k % w), oy + Math.floor(k / w), out[k], p.alpha != null ? Math.round(p.alpha * 255) : 255);
  }
  // 바깥 테두리: 빛을 받는 쪽은 조금 밝은 색, 그늘 쪽은 진한 색 (선택적 테두리)
  if (opt.outline !== false) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (ids[y * w + x] >= 0) continue;
      for (const [dx, dy] of N4) {
        const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
        const j = ids[yy * w + xx];
        if (j >= 0 && parts[j].ol !== false) {
          const pr = parts[j];
          const lit = dx > 0 || dy > 0;
          pb.set(ox + x, oy + y, opt.ol || pr.olc || pr.r.olc || (lit ? mixHex(pr.r[1], '#0a0614', 0.45) : mixHex(pr.r[0], '#06030c', 0.6)));
          break;
        }
      }
    }
  }
  return ids;
}

/* 부드러운 빛 텍스처 (점 그림이 아닌 매끈한 빛) */
function softTex(scene, key, size, stops) {
  const t = scene.textures.createCanvas(key, size, size), c = t.getContext();
  const g = c.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  stops.forEach(([o, a]) => g.addColorStop(o, `rgba(255,255,255,${a})`));
  c.fillStyle = g; c.fillRect(0, 0, size, size); t.refresh();
}

/* 값 노이즈 (지도, 땅 무늬용) */
function makeNoise(seed) {
  const r = mulberry32(seed), N = 256, perm = new Uint8Array(512), val = new Float32Array(N);
  for (let i = 0; i < N; i++) { perm[i] = i; val[i] = r(); }
  for (let i = N - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  for (let i = 0; i < N; i++) perm[i + N] = perm[i];
  const sm = t => t * t * (3 - 2 * t);
  const n2 = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const a = val[perm[(xi & 255) + perm[yi & 255]]], b = val[perm[((xi + 1) & 255) + perm[yi & 255]]];
    const c = val[perm[(xi & 255) + perm[(yi + 1) & 255]]], d = val[perm[((xi + 1) & 255) + perm[(yi + 1) & 255]]];
    const u = sm(xf), v = sm(yf);
    return lerp(lerp(a, b, u), lerp(c, d, u), v);
  };
  return (x, y, oct = 4) => { let s = 0, a = 1, f = 1, t = 0; for (let i = 0; i < oct; i++) { s += n2(x * f, y * f) * a; t += a; a *= 0.5; f *= 2; } return s / t; };
}

const PNOISE = makeNoise(4321);
