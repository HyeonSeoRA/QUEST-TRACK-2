'use strict';
// 공용 도구: 고정 시드 난수, 노이즈, 캔버스 만들기

const U = {
  // 같은 시드면 항상 같은 순서의 난수 → 모두가 같은 미로에서 겨룬다
  rng(seed) {
    let s = seed >>> 0;
    return () => {
      s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },

  hash(x, y, s = 0) {
    let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 1274126177);
    h = Math.imul(h ^ (h >>> 13), 1103515245);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  },

  noise(x, y, s = 0) {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = U.hash(xi, yi, s), b = U.hash(xi + 1, yi, s);
    const c = U.hash(xi, yi + 1, s), d = U.hash(xi + 1, yi + 1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  },

  fbm(x, y, oct = 4, s = 0) {
    let f = 0, amp = 0.5, n = 0;
    for (let i = 0; i < oct; i++) {
      f += amp * U.noise(x, y, s + i * 17);
      n += amp;
      x *= 2.03; y *= 2.03; amp *= 0.5;
    }
    return f / n;
  },

  clamp(v, a, b) { return v < a ? a : v > b ? b : v; },
  lerp(a, b, t) { return a + (b - a) * t; },
  smooth(a, b, x) {
    const t = U.clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  },
  angDiff(a, b) {
    let d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return d;
  },

  canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  },
};
