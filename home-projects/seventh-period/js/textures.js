'use strict';
// 그림 파일 없이 캔버스에 직접 그리는 재질들 (벽, 바닥, 칠판, 얼굴...)

const Tex = (() => {
  const T = { aniso: 4 };
  const cache = {};

  function rng(a) {
    return () => {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  T.rng = rng;
  const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  T.smooth = smooth;

  // 가로로 이어지는 값 노이즈 (p = 가로 주기)
  function noise2(seed) {
    const r = rng(seed), P = new Float32Array(65536);
    for (let i = 0; i < 65536; i++) P[i] = r();
    const mod = (v, p) => ((v % p) + p) % p;
    const n = (x, y, p = 256) => {
      const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
      const x0 = mod(xi, p) & 255, x1 = mod(xi + 1, p) & 255, y0 = yi & 255, y1 = (yi + 1) & 255;
      const a = P[(y0 << 8) | x0], b = P[(y0 << 8) | x1], c = P[(y1 << 8) | x0], d = P[(y1 << 8) | x1];
      const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    };
    const fbm = (x, y, o = 4, p = 256) => {
      let s = 0, amp = 0.5, f = 1, t = 0;
      for (let i = 0; i < o; i++) { s += amp * n(x * f, y * f, p * f); t += amp; amp *= 0.5; f *= 2; }
      return s / t;
    };
    return { n, fbm };
  }
  T.noise2 = noise2;

  function cv(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return [c, c.getContext('2d')];
  }
  T.cv = cv;
  // 픽셀마다 색을 계산한다. fn(x, y, out) 에서 out[0..3] 을 0~1 로 채운다
  function pix(g, w, h, fn) {
    const img = g.createImageData(w, h), d = img.data, o = [0, 0, 0, 1];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      o[3] = 1; fn(x, y, o);
      const i = (y * w + x) * 4;
      d[i] = o[0] * 255; d[i + 1] = o[1] * 255; d[i + 2] = o[2] * 255; d[i + 3] = o[3] * 255;
    }
    g.putImageData(img, 0, 0);
  }
  function tex(c, rx = 1, ry = 1) {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rx, ry);
    t.anisotropy = T.aniso;
    return t;
  }
  T.tex = tex;
  const PEN = '"Nanum Pen Script", "Nanum Myeongjo", serif';
  const SERIF = '"Nanum Myeongjo", serif';
  const SANS = '"Noto Sans KR", sans-serif';
  T.PEN = PEN;

  function crack(g, r, x, y, len, w, col) {
    g.strokeStyle = col; g.lineWidth = w; g.beginPath(); g.moveTo(x, y);
    let a = r() * Math.PI * 2;
    for (let i = 0; i < len; i++) {
      a += (r() - 0.5) * 1.1; x += Math.cos(a) * 6; y += Math.sin(a) * 6; g.lineTo(x, y);
      if (r() < 0.08) crack(g, r, x, y, len / 3 | 0, w * 0.6, col);
    }
    g.stroke();
  }
  function handprint(g, r, x, y, s, col) {
    g.fillStyle = col;
    g.beginPath(); g.ellipse(x, y, 16 * s, 20 * s, 0, 0, Math.PI * 2); g.fill();
    const fingers = [[-14, -26, 5, 15, -0.3], [-5, -34, 5, 18, -0.08], [5, -35, 5, 19, 0.05], [14, -30, 4.5, 16, 0.25], [22, -6, 4.5, 12, 0.9]];
    fingers.forEach(([fx, fy, fw, fh, rot]) => { g.beginPath(); g.ellipse(x + fx * s, y + fy * s, fw * s, fh * s, rot, 0, Math.PI * 2); g.fill(); });
    for (let i = 0; i < 3; i++) { // 흘러내림
      const dx = x + (r() - 0.5) * 24 * s;
      g.fillRect(dx, y, 2.5 * s, (20 + r() * 60) * s);
    }
  }
  T.handprint = handprint;

  // ---------- 벽 (1m x 3m 한 칸) ----------
  T.wall = (style, variant) => {
    const key = 'wall' + style + variant;
    if (cache[key]) return cache[key];
    const W = 256, H = 768, [c, g] = cv(W, H);
    const N = noise2(11), N2 = noise2(300 + variant * 17 + style.length * 5);
    const r = rng(500 + variant * 31 + style.length * 7);
    const wainPx = style === 'tile' ? 480 : 235;
    const wainTop = H - wainPx;
    pix(g, W, H, (x, y, o) => {
      const u = x / W, v = y / H;
      const edge = smooth(0, 0.1, u) * smooth(1, 0.9, u);
      const base = N.fbm(u * 4, v * 12, 5, 4);
      const fine = N.n(u * 64, v * 192, 64);
      let R = 0.6, G = 0.58, B = 0.52;
      if (style === 'music') { // 구멍 뚫린 방음판
        R = 0.55; G = 0.52; B = 0.45;
        const hx = (x % 12) - 6, hy = (y % 12) - 6;
        if (hx * hx + hy * hy < 5) { R *= 0.3; G *= 0.3; B *= 0.3; }
        if (y % 192 < 3 || x < 2) { R *= 0.5; G *= 0.5; B *= 0.5; }
      }
      let k = 0.68 + base * 0.45 + (fine - 0.5) * 0.07;
      // 위에서 흘러내린 물 얼룩
      const drip = N2.fbm(u * 16, v * 1.4, 3, 16);
      const dripM = smooth(0.56, 0.74, drip) * (0.35 + 0.65 * (1 - v)) * edge;
      R = R * (1 - dripM * 0.45) + 0.3 * dripM * 0.45; G = G * (1 - dripM * 0.5) + 0.24 * dripM * 0.5; B = B * (1 - dripM * 0.6) + 0.12 * dripM * 0.6;
      // 큰 누런 얼룩
      const st = N2.fbm(u * 3 + 7, v * 3, 4, 3);
      const stM = smooth(0.55, 0.7, st) * 0.5;
      R -= stM * 0.08; G -= stM * 0.12; B -= stM * 0.2;
      // 곰팡이
      const mold = N2.fbm(u * 7 + 3, v * 14, 4, 7);
      const moldM = smooth(0.62, 0.78, mold) * (smooth(0.25, 0, v) + smooth(0.55, 0.69, v)) * 0.8;
      k *= 1 - moldM * 0.7;
      // 위아래 그을음
      k *= 0.75 + 0.25 * smooth(0, 0.12, v);
      if (y > wainTop) {
        if (style === 'tile') {
          const tx = x % 40, ty = (y - wainTop) % 40;
          const grout = tx < 3 || ty < 3;
          const tn = N.n(Math.floor(x / 40) * 3.1, Math.floor((y - wainTop) / 40) * 2.7, 64);
          R = grout ? 0.32 : 0.78 + tn * 0.08; G = grout ? 0.3 : 0.8 + tn * 0.08; B = grout ? 0.26 : 0.8 + tn * 0.06;
          k = 0.75 + base * 0.3;
          if (grout) k *= 0.8 + mold * 0.3;
        } else {
          const peel = N2.fbm(u * 9, v * 26, 4, 9);
          if (peel < 0.63) {
            R = 0.17 + base * 0.08; G = 0.27 + base * 0.08; B = 0.22 + base * 0.06;
            if (style === 'music') { R = 0.32; G = 0.2; B = 0.12; }
            k = 0.8 + fine * 0.25;
          } else k *= 0.9;
          if (peel > 0.6 && peel < 0.63) k *= 0.55; // 벗겨진 가장자리
        }
        if (y < wainTop + 10) { R = 0.3; G = 0.2; B = 0.12; k = 0.7 + fine * 0.3; }
        if (y > H - 22) { R = 0.12; G = 0.1; B = 0.09; k = 0.8 + fine * 0.3; }
        k *= 1 - smooth(0.82, 1, v) * 0.3;
      }
      if (style === 'burnt' || variant === 2) { // 불에 그을림
        const s = (1 - v) * 0.8 + (N2.fbm(u * 5, v * 3 + 2, 4, 5) - 0.5) * 0.9;
        const heavy = style === 'burnt' ? 0.15 : 0.35;
        const burn = smooth(heavy + 0.25, heavy + 0.45, 1 - s);
        k *= 1 - burn * 0.88;
        R += burn * 0.05;
      }
      o[0] = R * k; o[1] = G * k; o[2] = B * k;
    });
    // 덧그림
    const crackN = style === 'burnt' ? 4 : variant === 1 ? 5 : 1;
    for (let i = 0; i < crackN; i++) crack(g, r, 40 + r() * 176, 60 + r() * 400, 12 + r() * 20 | 0, 1.4, 'rgba(20,16,12,0.7)');
    if (variant === 3 && style !== 'tile') { // 피 손자국
      g.globalAlpha = 0.85;
      handprint(g, r, 90 + r() * 80, 300 + r() * 150, 1.1, 'rgba(70,4,4,0.9)');
      if (r() < 0.6) handprint(g, r, 60 + r() * 120, 380 + r() * 120, 0.9, 'rgba(55,3,3,0.8)');
      g.globalAlpha = 1;
    }
    if (variant === 1 && style !== 'tile') { // 바를 정(正)으로 센 날짜 자국
      g.strokeStyle = 'rgba(200,195,180,0.35)'; g.lineWidth = 2;
      const x0 = 60 + r() * 100, y0 = 420 + r() * 60;
      for (let k = 0; k < 4; k++) {
        const ox = x0 + k * 30;
        g.beginPath();
        g.moveTo(ox, y0); g.lineTo(ox + 22, y0);
        g.moveTo(ox + 11, y0); g.lineTo(ox + 11, y0 + 24);
        g.moveTo(ox + 11, y0 + 12); g.lineTo(ox + 20, y0 + 12);
        g.moveTo(ox + 4, y0 + 8); g.lineTo(ox + 4, y0 + 24);
        g.moveTo(ox, y0 + 24); g.lineTo(ox + 22, y0 + 24);
        g.stroke();
      }
    }
    const t = tex(c);
    cache[key] = t;
    return t;
  };

  // ---------- 바닥과 천장 ----------
  T.floor = kind => {
    if (cache['f' + kind]) return cache['f' + kind];
    const S = 512, [c, g] = cv(S, S), N = noise2(77), r = rng(9 + kind.length);
    if (kind === 'wood') {
      pix(g, S, S, (x, y, o) => {
        const u = x / S, v = y / S;
        const plank = Math.floor(v * 8);
        const off = (plank * 0.37) % 1;
        const pu = (u + off) % 1;
        const tone = N.n(plank * 3.3, 0.5, 64);
        const grain = N.fbm(pu * 3 + plank * 10, v * 60, 4, 3);
        const ring = Math.sin(grain * 40) * 0.5 + 0.5;
        let k = 0.55 + tone * 0.35 + ring * 0.12;
        const seam = (y % 64) < 2 || Math.abs(((pu * 2) % 1) - 0.0) < 0.004;
        if (seam) k *= 0.3;
        const dirt = N.fbm(u * 4 + 9, v * 4, 4, 4);
        k *= 0.7 + dirt * 0.5;
        o[0] = 0.42 * k; o[1] = 0.27 * k; o[2] = 0.15 * k;
      });
      for (let i = 0; i < 40; i++) { // 긁힌 자국
        g.strokeStyle = `rgba(${r() < 0.5 ? '230,210,180' : '20,10,5'},${0.08 + r() * 0.12})`;
        g.lineWidth = 1; g.beginPath();
        const x = r() * S, y = r() * S; g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 120, y + (r() - 0.5) * 30); g.stroke();
      }
    } else if (kind === 'hall') { // 테라조 바닥 (0.5m 타일)
      pix(g, S, S, (x, y, o) => {
        const u = x / S, v = y / S;
        const tx = Math.floor(u * 2), ty = Math.floor(v * 2);
        const tn = N.n(tx * 5.1 + 3, ty * 4.3, 64);
        const sp = N.n(x * 0.9, y * 0.9, 461);
        let k = 0.45 + tn * 0.15 + (sp > 0.82 ? 0.25 : sp < 0.12 ? -0.2 : 0);
        if (x % 256 < 3 || y % 256 < 3) k = 0.18;
        const dirt = N.fbm(u * 3, v * 3, 5, 3);
        k *= 0.6 + dirt * 0.6;
        o[0] = 0.62 * k; o[1] = 0.6 * k; o[2] = 0.56 * k;
      });
      for (let i = 0; i < 6; i++) crack(g, r, r() * S, r() * S, 10 + r() * 15 | 0, 1.2, 'rgba(10,8,6,0.6)');
    } else if (kind === 'tile') { // 작은 화장실 타일
      pix(g, S, S, (x, y, o) => {
        const u = x / S, v = y / S;
        const grout = x % 64 < 4 || y % 64 < 4;
        const tn = N.n(Math.floor(x / 64) * 2.3, Math.floor(y / 64) * 1.7, 64);
        const dirt = N.fbm(u * 3 + 5, v * 3, 5, 3);
        let k = grout ? 0.25 + dirt * 0.15 : 0.62 + tn * 0.15;
        k *= 0.6 + dirt * 0.55;
        o[0] = 0.78 * k; o[1] = 0.82 * k; o[2] = 0.82 * k;
      });
    } else if (kind === 'lino') { // 연두색 장판
      pix(g, S, S, (x, y, o) => {
        const u = x / S, v = y / S;
        const n = N.fbm(u * 6, v * 6, 5, 6), sp = N.n(x * 1.3, y * 1.3, 666);
        let k = 0.55 + n * 0.35 + (sp - 0.5) * 0.08;
        if (x % 256 < 2) k *= 0.4;
        const dirt = N.fbm(u * 2 + 4, v * 2, 4, 2);
        k *= 0.65 + dirt * 0.45;
        o[0] = 0.45 * k; o[1] = 0.55 * k; o[2] = 0.45 * k;
      });
    } else if (kind === 'ceil') { // 천장 텍스 (두 장)
      const miss = -1; // 빠진 천장 판은 world.js 에서 군데군데 따로 만든다
      pix(g, S, S, (x, y, o) => {
        const u = x / S, v = y / S;
        const t = Math.floor(u * 2) + Math.floor(v * 2) * 2;
        const lx = x % 256, ly = y % 256;
        let k = 0.62 + N.n(x * 0.5, y * 0.5, 256) * 0.1;
        if ((lx * 7 + ly * 13) % 23 < 2 && N.n(x * 2, y * 2, 1024) > 0.5) k *= 0.6; // 바늘구멍 무늬
        if (lx < 4 || ly < 4) k = 0.25;
        const stain = N.fbm(u * 2 + 8, v * 2, 5, 2);
        const sm = smooth(0.55, 0.7, stain);
        let R = 0.72, G = 0.7, B = 0.64;
        R -= sm * 0.15; G -= sm * 0.25; B -= sm * 0.35;
        if (Math.abs(stain - 0.6) < 0.006) k *= 0.6; // 얼룩 테두리
        if (t === miss && lx >= 4 && ly >= 4) { k = 0.03; }
        o[0] = R * k; o[1] = G * k; o[2] = B * k;
      });
    }
    const t = tex(c);
    cache['f' + kind] = t;
    return t;
  };

  // ---------- 칠판 ----------
  T.board = (lines, side) => {
    const W = 1024, H = 320, [c, g] = cv(W, H), N = noise2(5), r = rng(lines.join('').length);
    pix(g, W, H, (x, y, o) => {
      const u = x / W, v = y / H;
      const sm = N.fbm(u * 5, v * 2, 5, 5);
      const k = 0.85 + sm * 0.3;
      const chalk = smooth(0.5, 0.75, N.fbm(u * 3 + 4, v * 1.5, 4, 3)) * 0.22;
      o[0] = (0.11 + chalk) * k; o[1] = (0.2 + chalk) * k; o[2] = (0.15 + chalk) * k;
    });
    g.fillStyle = 'rgba(235,235,225,0.85)';
    g.textBaseline = 'top';
    lines.forEach((l, i) => {
      g.font = `${l.size || 64}px ${PEN}`;
      g.fillStyle = l.color || 'rgba(232,232,222,0.86)';
      g.save(); g.translate(l.x ?? 60, l.y ?? 40 + i * 80); g.rotate((r() - 0.5) * 0.03);
      g.shadowColor = 'rgba(230,230,220,0.35)'; g.shadowBlur = 4;
      g.fillText(l.t, 0, 0); g.fillText(l.t, 1.5, 0.5); g.restore();
    });
    if (side) {
      g.font = `40px ${PEN}`; g.fillStyle = 'rgba(232,232,222,0.75)';
      side.forEach((s, i) => g.fillText(s, W - 210, 30 + i * 52));
    }
    g.strokeStyle = 'rgba(60,40,20,1)'; g.lineWidth = 10; g.strokeRect(0, 0, W, H);
    return tex(c);
  };

  // ---------- 미닫이문 (위쪽 유리) ----------
  T.door = () => {
    if (cache.door) return cache.door;
    const W = 256, H = 512, [c, g] = cv(W, H), N = noise2(33);
    pix(g, W, H, (x, y, o) => {
      const u = x / W, v = y / H;
      const grain = N.fbm(u * 3, v * 30, 4, 3);
      let k = 0.6 + grain * 0.45;
      let R = 0.42, G = 0.3, B = 0.19;
      const inGlass = x > 30 && x < W - 30 && y > 40 && y < 210;
      if (inGlass) {
        R = 0.06; G = 0.07; B = 0.08; k = 0.7 + N.fbm(u * 4, v * 4, 3, 4) * 0.6;
        if (Math.abs((x - y * 0.6) % 90) < 6) k += 0.4; // 반사
        if (Math.abs(x - W / 2) < 3) { R = 0.3; G = 0.2; B = 0.12; k = 0.7; }
      }
      if (x < 14 || x > W - 14 || y < 14 || y > H - 14 || (y > 210 && y < 224)) k *= 0.7;
      k *= 0.7 + N.fbm(u * 2 + 3, v * 2, 4, 2) * 0.5;
      o[0] = R * k; o[1] = G * k; o[2] = B * k;
    });
    g.fillStyle = 'rgba(15,10,6,0.9)'; g.fillRect(W - 46, 300, 18, 60); // 손잡이 홈
    const t = tex(c);
    cache.door = t;
    return t;
  };

  T.locker = () => {
    if (cache.locker) return cache.locker;
    const W = 256, H = 512, [c, g] = cv(W, H), N = noise2(44);
    pix(g, W, H, (x, y, o) => {
      const u = x / W, v = y / H;
      let k = 0.6 + N.fbm(u * 4, v * 8, 4, 4) * 0.3;
      if (x % 128 < 4 || y % 256 < 4) k = 0.25;
      const vent = (y % 256) > 30 && (y % 256) < 80 && (x % 128) > 34 && (x % 128) < 94 && (y % 8) < 3;
      if (vent) k = 0.08;
      const rust = smooth(0.62, 0.75, N.fbm(u * 6 + 5, v * 6, 4, 6));
      o[0] = (0.3 + rust * 0.25) * k; o[1] = (0.36 - rust * 0.05) * k; o[2] = (0.42 - rust * 0.2) * k;
    });
    g.fillStyle = 'rgba(20,20,22,1)';
    [0, 1].forEach(i => [0, 1].forEach(j => g.fillRect(i * 128 + 100, j * 256 + 140, 8, 30)));
    const t = tex(c);
    cache.locker = t;
    return t;
  };

  // ---------- 작은 그림들 ----------
  T.sign = text => {
    const [c, g] = cv(256, 72), N = noise2(text.length);
    pix(g, 256, 72, (x, y, o) => { const k = 0.65 + N.fbm(x / 64, y / 32, 4, 4) * 0.35; o[0] = 0.86 * k; o[1] = 0.84 * k; o[2] = 0.76 * k; });
    g.fillStyle = '#1a1612'; g.font = `700 40px ${SANS}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 128, 38);
    g.strokeStyle = '#2a2420'; g.lineWidth = 4; g.strokeRect(2, 2, 252, 68);
    return tex(c);
  };

  T.paper = (seed = 1, red) => {
    const [c, g] = cv(256, 320), N = noise2(seed), r = rng(seed);
    pix(g, 256, 320, (x, y, o) => {
      const k = 0.75 + N.fbm(x / 64, y / 64, 4, 4) * 0.3;
      const edge = Math.min(x, y, 255 - x, 319 - y) < 8 ? 0.75 : 1;
      o[0] = 0.86 * k * edge; o[1] = 0.8 * k * edge; o[2] = 0.64 * k * edge;
    });
    g.strokeStyle = 'rgba(80,100,140,0.35)'; g.lineWidth = 1;
    for (let y = 40; y < 310; y += 22) { g.beginPath(); g.moveTo(14, y); g.lineTo(242, y); g.stroke(); }
    g.strokeStyle = red ? 'rgba(120,10,10,0.85)' : 'rgba(30,30,50,0.75)'; g.lineWidth = 1.6;
    for (let y = 34; y < 300; y += 22) { // 알아볼 수 없는 글씨
      g.beginPath(); let x = 20; g.moveTo(x, y);
      const end = 120 + r() * 110;
      while (x < end) { x += 3 + r() * 4; g.lineTo(x, y - r() * 8); }
      g.stroke();
    }
    return tex(c);
  };

  T.calendar = () => {
    const [c, g] = cv(256, 320);
    g.fillStyle = '#cfc6b0'; g.fillRect(0, 0, 256, 320);
    g.fillStyle = '#8a1010'; g.fillRect(0, 0, 256, 70);
    g.fillStyle = '#f0e6d0'; g.font = `700 40px ${SANS}`; g.textAlign = 'center';
    g.fillText('2006  11월', 128, 50);
    g.font = `20px ${SANS}`; g.fillStyle = '#2a2420';
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    days.forEach((d, i) => g.fillText(d, 22 + i * 35, 100));
    let day = 1;
    for (let w = 0; w < 5; w++) for (let i = 0; i < 7; i++) {
      if (w === 0 && i < 3) continue;
      if (day > 30) break;
      g.fillStyle = i === 0 ? '#9a1a1a' : '#2a2420';
      g.fillText(String(day), 22 + i * 35, 140 + w * 38);
      if (day === 1) { g.strokeStyle = '#a00'; g.lineWidth = 3; g.beginPath(); g.ellipse(22 + i * 35, 133, 16, 15, 0, 0, 7); g.stroke(); }
      if (day > 1) { g.strokeStyle = 'rgba(60,0,0,0.6)'; g.lineWidth = 2; g.beginPath(); g.moveTo(8 + i * 35, 120 + w * 38); g.lineTo(36 + i * 35, 146 + w * 38); g.stroke(); }
      day++;
    }
    return tex(c);
  };

  T.timetable = () => {
    const [c, g] = cv(320, 300);
    g.fillStyle = '#d8d0b8'; g.fillRect(0, 0, 320, 300);
    g.fillStyle = '#222'; g.font = `700 24px ${SANS}`; g.textAlign = 'center';
    g.fillText('2학년 3반 시간표', 160, 30);
    const subj = ['국어', '수학', '영어', '과학', '사회', '음악'];
    g.font = `18px ${SANS}`;
    for (let i = 0; i < 7; i++) {
      const y = 62 + i * 33;
      g.strokeStyle = '#555'; g.strokeRect(20, y - 22, 280, 33);
      g.fillStyle = '#222';
      g.fillText(`${i + 1}교시`, 60, y);
      if (i < 6) g.fillText(subj[i], 200, y);
    }
    g.fillStyle = '#9a0808'; g.font = `34px ${PEN}`; g.fillText('자습 — 끝나지 않음', 196, 264);
    return tex(c);
  };

  T.poster = (title, sub, seed) => {
    const [c, g] = cv(256, 360), N = noise2(seed), r = rng(seed);
    pix(g, 256, 360, (x, y, o) => {
      const k = 0.55 + N.fbm(x / 64, y / 64, 5, 4) * 0.45;
      o[0] = 0.75 * k; o[1] = 0.72 * k; o[2] = 0.62 * k;
    });
    g.fillStyle = '#5a1010'; g.font = `800 64px ${SERIF}`; g.textAlign = 'center';
    g.fillText(title, 128, 120);
    g.fillStyle = '#2a2420'; g.font = `22px ${SANS}`; g.fillText(sub, 128, 170);
    g.fillStyle = 'rgba(40,30,25,0.8)'; g.beginPath(); g.ellipse(128, 260, 50, 62, 0, 0, 7); g.fill();
    g.strokeStyle = 'rgba(230,220,200,0.8)'; g.lineWidth = 3; // 얼굴을 긁어 지움
    for (let i = 0; i < 26; i++) { g.beginPath(); g.moveTo(80 + r() * 20, 210 + r() * 100); g.lineTo(160 + r() * 20, 210 + r() * 100); g.stroke(); }
    return tex(c);
  };

  T.windowNight = () => {
    if (cache.win) return cache.win;
    const [c, g] = cv(256, 256), r = rng(4);
    const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#0c1424'); gr.addColorStop(1, '#03050a');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    const mg = g.createRadialGradient(190, 50, 2, 190, 50, 90);
    mg.addColorStop(0, 'rgba(160,170,200,0.55)'); mg.addColorStop(1, 'rgba(160,170,200,0)');
    g.fillStyle = mg; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = '#010101'; // 나뭇가지
    for (let i = 0; i < 5; i++) {
      g.lineWidth = 4 - i * 0.6; g.beginPath();
      let x = -10, y = 120 + r() * 120; g.moveTo(x, y);
      for (let k = 0; k < 10; k++) { x += 14 + r() * 20; y -= 6 + r() * 14; g.lineTo(x, y); }
      g.stroke();
    }
    g.strokeStyle = 'rgba(170,180,210,0.12)'; g.lineWidth = 1;
    for (let i = 0; i < 160; i++) { const x = r() * 256, y = r() * 256; g.beginPath(); g.moveTo(x, y); g.lineTo(x - 3, y + 14 + r() * 10); g.stroke(); }
    const t = tex(c);
    cache.win = t;
    return t;
  };

  // 투명 바탕 피 얼룩
  T.blood = seed => {
    const key = 'blood' + seed;
    if (cache[key]) return cache[key];
    const [c, g] = cv(256, 256), r = rng(seed * 13 + 1);
    const col = a => `rgba(${70 + r() * 30 | 0},${2 + r() * 6 | 0},${4 + r() * 6 | 0},${a})`;
    g.fillStyle = col(0.9);
    g.beginPath();
    for (let i = 0; i <= 24; i++) { const a = i / 24 * Math.PI * 2, rr = 40 + r() * 30; g.lineTo(128 + Math.cos(a) * rr, 128 + Math.sin(a) * rr); }
    g.fill();
    for (let i = 0; i < 40; i++) {
      const a = r() * Math.PI * 2, d = 60 + r() * 60, s = 1 + r() * 7;
      g.fillStyle = col(0.7 + r() * 0.3);
      g.beginPath(); g.arc(128 + Math.cos(a) * d, 128 + Math.sin(a) * d, s, 0, 7); g.fill();
    }
    const gr = g.createRadialGradient(128, 128, 10, 128, 128, 80);
    gr.addColorStop(0, 'rgba(20,0,0,0.5)'); gr.addColorStop(1, 'rgba(20,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    const t = tex(c);
    cache[key] = t;
    return t;
  };
  // 벽 낙서 / 바닥 글씨
  T.writing = (text, color = 'rgba(120,6,6,0.9)', size = 90, w = 512, h = 160) => {
    const [c, g] = cv(w, h), r = rng(text.length * 7);
    g.font = `${size}px ${PEN}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = color;
    g.fillText(text, w / 2, h / 2);
    g.fillStyle = color;
    for (let i = 0; i < 18; i++) g.fillRect(w * 0.15 + r() * w * 0.7, h / 2 + 10, 2 + r() * 2, 10 + r() * 60);
    return tex(c);
  };
  T.handTex = () => {
    const [c, g] = cv(128, 160), r = rng(8);
    handprint(g, r, 64, 100, 1.4, 'rgba(80,4,4,0.85)');
    return tex(c);
  };

  T.portrait = seed => {
    const [c, g] = cv(200, 260), N = noise2(seed), r = rng(seed);
    pix(g, 200, 260, (x, y, o) => {
      const u = x / 200 - 0.5, v = y / 260 - 0.45;
      const head = (u * u) / 0.04 + (v * v) / 0.06 < 1;
      const body = v > 0.28 && Math.abs(u) < 0.4 - (v - 0.28) * -0.4;
      const n = N.fbm(x / 40, y / 40, 4, 5);
      let k = 0.15 + n * 0.12, R = 0.35, G = 0.25, B = 0.15;
      if (head) { k = 0.45 + n * 0.2 - (u + 0.1) * 0.6; R = 0.7; G = 0.55; B = 0.42; }
      else if (body) { k = 0.12 + n * 0.1; R = 0.3; G = 0.3; B = 0.35; }
      o[0] = R * k; o[1] = G * k; o[2] = B * k;
    });
    g.strokeStyle = 'rgba(240,230,210,0.9)'; g.lineWidth = 3; // 눈을 긁어냄
    [[76, 108], [124, 108]].forEach(([ex, ey]) => {
      for (let i = 0; i < 9; i++) { g.beginPath(); g.moveTo(ex - 12 + r() * 6, ey - 8 + r() * 4); g.lineTo(ex + 8 + r() * 6, ey + 6 + r() * 4); g.stroke(); }
    });
    g.strokeStyle = '#3a2a14'; g.lineWidth = 14; g.strokeRect(0, 0, 200, 260);
    return tex(c);
  };

  T.nametag = () => {
    const [c, g] = cv(160, 48);
    g.fillStyle = '#e8e2d0'; g.fillRect(0, 0, 160, 48);
    g.fillStyle = '#1a3a7a'; g.fillRect(0, 0, 160, 10);
    g.fillStyle = '#111'; g.font = `700 26px ${SANS}`; g.textAlign = 'center'; g.fillText('윤서하', 80, 38);
    g.fillStyle = 'rgba(20,10,5,0.55)'; g.beginPath(); g.ellipse(140, 40, 30, 18, 0, 0, 7); g.fill(); // 그을음
    return tex(c);
  };

  T.cloth = () => {
    if (cache.cloth) return cache.cloth;
    const [c, g] = cv(128, 256), N = noise2(66);
    pix(g, 128, 256, (x, y, o) => {
      const k = 0.55 + N.fbm(x / 32, y / 64, 4, 4) * 0.35 + Math.sin(x * 0.4) * 0.04;
      const stain = smooth(0.6, 0.72, N.fbm(x / 40 + 3, y / 40, 4, 3));
      o[0] = (0.8 - stain * 0.3) * k; o[1] = (0.8 - stain * 0.45) * k; o[2] = (0.76 - stain * 0.5) * k;
      o[3] = (y > 230 && N.n(x * 0.3, 3, 128) > 0.5) ? 0 : 1; // 찢어진 끝
    });
    const t = tex(c);
    cache.cloth = t;
    return t;
  };

  // 은은한 빛 번짐 (아이템 표시용)
  T.glow = (r = 255, gg = 220, b = 150) => {
    const key = `glow${r},${gg},${b}`;
    if (cache[key]) return cache[key];
    const [c, g] = cv(64, 64);
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, `rgba(${r},${gg},${b},1)`); gr.addColorStop(0.3, `rgba(${r},${gg},${b},0.35)`); gr.addColorStop(1, `rgba(${r},${gg},${b},0)`);
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    cache[key] = t;
    return t;
  };

  // ---------- 얼굴 (픽셀마다 입체·빛·피부를 계산) ----------
  // kind: hollow(텅 빈 눈, 벌어진 입) / grin(찢어진 웃음) / teacher(눈 없는 얼굴) / girl(서하, 머리카락에 가려짐) / child
  T.face = (kind, size = 256, seed = 1) => {
    const key = `face${kind}${size}${seed}`;
    if (cache[key]) return cache[key];
    const [c, g] = cv(size, size), N = noise2(seed * 7 + 3), r = rng(seed);
    const tears = [];
    for (let i = 0; i < 7; i++) tears.push({ x: (r() < 0.5 ? -1 : 1) * (0.24 + r() * 0.14), len: 0.15 + r() * 0.65, w: 0.01 + r() * 0.018 });
    const g2 = (u, v, cx, cy, sx, sy) => { const dx = (u - cx) / sx, dy = (v - cy) / sy; return Math.exp(-(dx * dx + dy * dy)); };
    const eyeY = -0.08;
    pix(g, size, size, (px, py, o) => {
      const u = (px / size) * 2 - 1, v = (py / size) * 2 - 1;
      const narrow = 0.72 - 0.2 * smooth(0.2, 1.0, v);
      const hx = u / narrow, hy = (v + 0.02) / 0.95;
      const r2 = hx * hx + hy * hy;
      let a = 1 - smooth(0.82, 1.0, r2);
      // 머리카락 (얼굴 밖까지)
      const strand = N.n(u * 70, v * 2.5, 512);
      const hairSide = (kind === 'girl' || kind === 'hollow' || kind === 'child');
      let hair = 0;
      if (hairSide) {
        hair = smooth(-0.45, -0.75, v) * smooth(0.3, 0.6, strand + 0.2);
        hair = Math.max(hair, smooth(0.5, 0.8, Math.abs(u) / (narrow + 0.05)) * (v > -0.6 ? 1 : 0.5));
        if (kind === 'girl') hair = Math.max(hair, smooth(0.25, 0.05, Math.abs(u + 0.12 * Math.sin(v * 3))) * smooth(0.35, 0.65, strand) * smooth(0.9, -0.2, v) * 0.97);
        if (r2 > 0.8 && Math.abs(u) < 0.98 && v > -0.95) { a = Math.max(a, smooth(0.25, 0.6, strand) * smooth(1, 0.7, Math.abs(u)) * smooth(-0.95, -0.6, v)); }
      }
      if (a <= 0.001) { o[3] = 0; return; }
      const rr = Math.min(r2, 1);
      const nz = Math.sqrt(1 - rr), nx = hx * 0.9, ny = hy * 0.9;
      let L = 0.18 + 0.82 * Math.max(0, nx * 0.15 + ny * 0.42 + nz * 0.88); // 아래에서 비추는 손전등
      const m = N.fbm(u * 6 + 10, v * 6 + 10, 4, 512);
      let R = 0.82, G = 0.78, B = 0.72;
      if (kind === 'teacher') { R = 0.72; G = 0.72; B = 0.7; }
      if (kind === 'hollow' || kind === 'child') { R = 0.76; G = 0.78; B = 0.74; }
      const vein = Math.abs(N.fbm(u * 8 + 2, v * 8, 3, 512) - 0.5);
      const vm = (1 - smooth(0, 0.025, vein)) * 0.4;
      R -= vm * 0.25; G -= vm * 0.18; B += vm * 0.03;
      R *= 0.82 + 0.32 * m; G *= 0.82 + 0.3 * m; B *= 0.84 + 0.26 * m;
      // 그늘: 눈구멍, 볼, 코밑
      const sock = Math.max(g2(u, v, -0.3, eyeY, 0.19, 0.14), g2(u, v, 0.3, eyeY, 0.19, 0.14));
      let dark = kind === 'teacher' ? sock * 0.3 : sock * 0.88;
      dark += (g2(u, v, -0.42, 0.3, 0.14, 0.2) + g2(u, v, 0.42, 0.3, 0.14, 0.2)) * 0.32;
      dark += g2(u, v, 0, 0.25, 0.1, 0.035) * 0.5 + (g2(u, v, -0.055, 0.22, 0.028, 0.02) + g2(u, v, 0.055, 0.22, 0.028, 0.02)) * 0.85;
      L += g2(u, v, 0, 0.05, 0.05, 0.17) * 0.15;
      L += (g2(u, v, -0.3, -0.27, 0.16, 0.05) + g2(u, v, 0.3, -0.27, 0.16, 0.05)) * 0.12;
      let k = L * (1 - Math.min(0.97, dark));
      // 눈
      const ex = Math.abs(u) - 0.3, ey = v - eyeY;
      if (kind === 'hollow' || kind === 'child') {
        if (ex * ex / 0.012 + ey * ey / 0.006 < 1) k *= 0.05;
        if (ex * ex + ey * ey < 0.0007) { R = 1; G = 1; B = 0.95; k = 1.1; } // 바늘 같은 눈동자
      } else if (kind === 'grin') {
        const e = ex * ex / 0.016 + ey * ey / 0.0055;
        if (e < 1) {
          R = 0.9; G = 0.82 - (1 - e) * 0.0; B = 0.78; k = 0.85 - e * 0.3;
          const vv = Math.abs(N.n(u * 80, v * 80, 512) - 0.5) < 0.04; if (vv) { G *= 0.4; B *= 0.4; }
          if (ex * ex + (ey + 0.005) * (ey + 0.005) < 0.0009) { R = G = B = 0.02; }
        }
      } else if (kind === 'girl') {
        if (ex * ex / 0.01 + ey * ey / 0.004 < 1) { k *= 0.12; }
        if (ex * ex + ey * ey < 0.0005) { R = 0.6; G = 0.6; B = 0.65; k = 0.6; }
      }
      // 입
      if (kind === 'hollow' || kind === 'child') {
        const mo = (u * u) / 0.012 + Math.pow(v - 0.52, 2) / 0.04;
        if (mo < 1) { k *= 0.04 + mo * 0.1; R = 0.4; }
        else if (mo < 1.5) { R *= 0.85; G *= 0.6; B *= 0.6; }
      } else if (kind === 'grin') {
        const yc = 0.5 - 0.2 * u * u, h = 0.075 * Math.max(0, 1 - Math.abs(u) / 0.72);
        const dv = v - yc;
        if (Math.abs(u) < 0.72 && Math.abs(dv) < h) {
          const teeth = dv < -h * 0.15 || dv > h * 0.55;
          if (teeth && Math.sin(u * 70) > -0.4) { R = 0.82; G = 0.76; B = 0.55; k = 0.75; }
          else { R = 0.25; G = 0.02; B = 0.02; k = 0.25; }
        } else if (Math.abs(u) < 0.78 && Math.abs(dv) < h + 0.02) { R = 0.45; G = 0.08; B = 0.08; k *= 0.8; }
      } else if (kind === 'teacher') {
        if (Math.abs(u) < 0.48 && Math.abs(v - 0.48 + u * 0.05) < 0.012) { k = 0.03; }
        if (Math.abs(u) < 0.5 && Math.abs(v - 0.48) < 0.06) dark += 0.1;
      } else if (kind === 'girl') {
        if (Math.abs(u) < 0.12 && Math.abs(v - 0.5) < 0.012) { R = 0.35; G = 0.15; B = 0.15; k *= 0.6; }
      }
      // 눈물 / 피
      for (const t of tears) {
        if (kind === 'teacher') break;
        const top = eyeY + 0.04;
        if (Math.abs(u - t.x - Math.sin(v * 9) * 0.01) < t.w && v > top && v < top + t.len) {
          const fade = 1 - (v - top) / t.len;
          if (kind === 'grin') { R = R * 0.3 + 0.35; G *= 0.1; B *= 0.1; }
          else { R *= 0.15; G *= 0.15; B *= 0.15; }
          k *= 1 - fade * 0.3;
        }
      }
      // 머리카락 덮기
      const hairCol = 0.025 + strand * 0.03;
      R = R * k * (1 - hair) + hairCol * hair; G = G * k * (1 - hair) + hairCol * hair; B = B * k * (1 - hair) + hairCol * 1.1 * hair;
      const grain = (N.n(px * 1.7, py * 1.7, 4096) - 0.5) * 0.05;
      o[0] = Math.max(0, R + grain); o[1] = Math.max(0, G + grain); o[2] = Math.max(0, B + grain);
      o[3] = Math.max(a, hair);
    });
    const t = new THREE.CanvasTexture(c);
    cache[key] = t;
    return t;
  };

  return T;
})();
