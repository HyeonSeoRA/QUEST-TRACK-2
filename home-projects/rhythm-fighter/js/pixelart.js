'use strict';
/*
 * 도트 그림판 + 몬스터 9종 + 파일럿.
 * 타원·막대·다각형을 "재질"로 칠하면, 빛 방향(왼쪽 위)을 계산해 두었다가
 * 4단계 명암 + 바둑판 디더링 + 테두리 + 오른쪽 림 라이트를 넣어 도트 그림으로 완성한다.
 * 몸을 찌그러뜨리기(sq)·기울이기(lean)를 지원해서 애니메이션 프레임을 만든다.
 */

const PX_SHADED = 0, PX_FLAT = 1, PX_GLOW = 2;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** 색상 h 를 target 쪽으로 amt 만큼 돌림 (그림자는 파랑, 밝은 곳은 노랑 쪽으로) */
function hueShift(h, target, amt) {
  let d = target - h;
  d -= Math.floor(d + 0.5);
  return h + Math.sign(d) * Math.min(Math.abs(d), amt);
}
/** 색 6단계: [테두리, 어둠, 그림자, 기본, 밝음, 반짝] */
function ramp(h, s, v) {
  h = ((h % 1) + 1) % 1;
  return [
    hsb(hueShift(h, .70, .10), Math.min(1, s * .8 + .3), v * .17),
    hsb(hueShift(h, .72, .08), Math.min(1, s * 1.08 + .05), v * .40),
    hsb(hueShift(h, .72, .04), Math.min(1, s * 1.02), v * .63),
    hsb(h, s, v * .86),
    hsb(hueShift(h, .14, .05), s * .75, Math.min(1, v * 1.04)),
    hsb(hueShift(h, .14, .08), s * .3, 1),
  ];
}
const mat = (ramp, mode, rim) => ({ ramp, mode, rim });

/** 도트 해상도 배율: 설계 크기(60칸)를 이만큼 줄여서 그린다 → 칸 수가 약 1/3 (60x60 → 35x35) */
const PIX_K = 35 / 60;
/** 화면에 그릴 때 한 칸의 크기 (35칸 x 7 = 245 픽셀) */
const PIX_SCALE = 7;

class PixelArt {
  /** w, h: 설계 크기. k: 실제로 칠할 칸의 배율 (1 이면 설계 크기 그대로) */
  constructor(w, h, k = 1) {
    this.k = k; this.dh = h;
    this.w = Math.round(w * k); this.h = Math.round(h * k);
    this.m = new Int8Array(this.w * this.h).fill(-1);
    this.l = new Float32Array(this.w * this.h);
    this.flat = new Uint8Array(this.w * this.h);
    this.cx = w / 2; this.base = h - 3;
    this.minR = .62 / k;   // 너무 가는 선도 최소 한 칸은 보이게
    this.sq = 0; this.lean = 0; this.dy = 0;
  }
  pose(sq, lean, dy = 0) { this.sq = sq; this.lean = lean; this.dy = dy; }
  // 화면 칸 (x,y) 가 원래 그림의 어디인지 (찌그러짐·기울기를 거꾸로 계산)
  local(x, y) {
    const v = this.base + (y - this.dy - this.base) / (1 - this.sq);
    const u = this.cx + (x - this.lean * 8 * (this.base - v) / this.dh - this.cx) / (1 + this.sq);
    return [u, v];
  }
  static light(nx, ny, nz) { return clamp(-0.45 * nx - 0.55 * ny + 0.70 * nz, 0, 1); }
  set(i, m, l, flat = 0) { this.m[i] = m; this.l[i] = l; this.flat[i] = flat; }
  each(fn) {
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const [u, v] = this.local((x + .5) / this.k, (y + .5) / this.k);
      fn(y * this.w + x, u, v);
    }
  }
  ellipse(ex, ey, rx, ry, m, taper = 0) {
    rx = Math.max(rx, this.minR); ry = Math.max(ry, this.minR);
    this.each((i, u, v) => {
      const ny = (v - ey) / ry, rxx = rx * (1 + taper * ny);
      if (rxx <= 0) return;
      const nx = (u - ex) / rxx, d = nx * nx + ny * ny;
      if (d > 1) return;
      this.set(i, m, PixelArt.light(nx, ny, Math.sqrt(1 - d)));
    });
  }
  capsule(x0, y0, x1, y1, r0, r1, m) {
    r0 = Math.max(r0, this.minR); r1 = Math.max(r1, this.minR);
    const dx = x1 - x0, dy = y1 - y0, len2 = dx * dx + dy * dy;
    this.each((i, u, v) => {
      let t = len2 ? ((u - x0) * dx + (v - y0) * dy) / len2 : 0;
      t = clamp(t, 0, 1);
      const r = r0 + (r1 - r0) * t, ex = u - (x0 + dx * t), ey = v - (y0 + dy * t);
      if (ex * ex + ey * ey > r * r) return;
      const nx = ex / r, ny = ey / r;
      this.set(i, m, PixelArt.light(nx, ny, Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny))));
    });
  }
  line(x0, y0, x1, y1, r, m) { this.capsule(x0, y0, x1, y1, r, r, m); }
  dot(x, y, m) { this.ellipse(x, y, .8, .8, m); }
  poly(m, ...xy) { this._poly(m, -1, xy); }
  /** 수정처럼 각진 면: 면 전체가 같은 밝기 */
  facet(m, l, ...xy) { this._poly(m, l, xy); }
  _poly(m, fixed, xy) {
    const n = xy.length / 2;
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (let i = 0; i < n; i++) {
      x0 = Math.min(x0, xy[i * 2]); x1 = Math.max(x1, xy[i * 2]);
      y0 = Math.min(y0, xy[i * 2 + 1]); y1 = Math.max(y1, xy[i * 2 + 1]);
    }
    const bx = (x0 + x1) / 2, by = (y0 + y1) / 2, bw = Math.max(1, (x1 - x0) / 2), bh = Math.max(1, (y1 - y0) / 2);
    this.each((i, u, v) => {
      if (u < x0 - 1 || u > x1 + 1 || v < y0 - 1 || v > y1 + 1) return;
      let inside = false;
      for (let a = 0, b = n - 1; a < n; b = a++) {
        const xa = xy[a * 2], ya = xy[a * 2 + 1], xb = xy[b * 2], yb = xy[b * 2 + 1];
        if ((ya > v) !== (yb > v) && u < (xb - xa) * (v - ya) / (yb - ya) + xa) inside = !inside;
      }
      if (!inside) return;
      if (fixed >= 0) { this.set(i, m, fixed, 1); return; }
      const nx = (u - bx) / bw * .8, ny = (v - by) / bh * .8, d = Math.min(.9, nx * nx + ny * ny);
      this.set(i, m, PixelArt.light(nx, ny, Math.sqrt(1 - d)));
    });
  }
  /** 타원 고리. half: 0 전체, 1 앞(아래 절반), -1 뒤(위 절반) */
  ring(ex, ey, rx, ry, th, m, half) {
    th = Math.max(th, this.minR * 1.6);
    this.each((i, u, v) => {
      if (half === 1 && v < ey) return;
      if (half === -1 && v >= ey) return;
      const nx = (u - ex) / rx, ny = (v - ey) / ry;
      const ix = (u - ex) / (rx - th), iy = (v - ey) / (ry - th);
      if (nx * nx + ny * ny > 1 || ix * ix + iy * iy < 1) return;
      this.set(i, m, PixelArt.light(0, ny * .6, .8));
    });
  }
  empty(x, y) { return x < 0 || y < 0 || x >= this.w || y >= this.h || this.m[y * this.w + x] < 0; }

  /** 완성: 캔버스(도트 그림) 를 돌려준다 */
  render(mats) {
    const { w, h } = this;
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const g = cv.getContext('2d');
    const img = g.createImageData(w, h);
    const d = img.data;
    const put = (i, c) => { d[i * 4] = c[0]; d[i * 4 + 1] = c[1]; d[i * 4 + 2] = c[2]; d[i * 4 + 3] = 255; };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, m = this.m[i];
      if (m < 0) continue;
      const mt = mats[m], l = this.l[i], th = BAYER[(y & 3) * 4 + (x & 3)] / 16;
      let c;
      if (mt.mode === PX_GLOW) c = l > .62 ? mt.ramp[5] : mt.ramp[4];
      else if (mt.mode === PX_FLAT) c = (l * 2 + (th - .5) * .6) > .9 ? mt.ramp[4] : mt.ramp[3];
      else {
        const val = this.flat[i] ? l * 3.99 : l * 3 + (th - .5) * .6;
        let tone = clamp(Math.floor(val), 0, 3) + 1;
        if (l > .95 && !this.flat[i]) tone = 5;
        c = mt.ramp[tone];
        if (mt.rim && l < .7 && (this.empty(x + 1, y) || this.empty(x + 1, y + 1)) && !this.empty(x - 1, y)) {
          c = mixRgb(c, mt.rim, .55);
        }
      }
      put(i, c);
    }
    // 테두리
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (this.m[i] >= 0) continue;
      let best = -1;
      for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + ox, ny = y + oy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const m = this.m[ny * w + nx];
        if (m >= 0 && (best < 0 || m < best)) best = m;
      }
      if (best >= 0) put(i, mats[best].ramp[0]);
    }
    g.putImageData(img, 0, 0);
    return cv;
  }
}

/** 맞았을 때 하얗게 번쩍이는 그림 */
function flashImage(src) {
  const cv = document.createElement('canvas');
  cv.width = src.width; cv.height = src.height;
  const g = cv.getContext('2d');
  g.drawImage(src, 0, 0);
  const img = g.getImageData(0, 0, cv.width, cv.height), d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const dark = (d[i] + d[i + 1] + d[i + 2]) / 3 < 40;
    d[i] = dark ? 216 : 255; d[i + 1] = dark ? 200 : 255; d[i + 2] = 255;
  }
  g.putImageData(img, 0, 0);
  return cv;
}

/** 도트 그림의 칸 목록 (쓰러질 때 픽셀이 흩어지는 효과에 씀) */
function pixelsOf(cv, step = 2) {
  const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
  const out = [];
  for (let y = 0; y < cv.height; y += step) for (let x = 0; x < cv.width; x += step) {
    const i = (y * cv.width + x) * 4;
    if (d[i + 3]) out.push({ x, y, c: `rgb(${d[i]},${d[i + 1]},${d[i + 2]})` });
  }
  return out;
}

/* ===================================================================== 몬스터 */

const M = { BODY: 0, BELLY: 1, DARK: 2, EYE: 3, PUPIL: 4, MOUTH: 5, TEETH: 6, GLOW: 7, HORN: 8, METAL: 9 };

function monsterMats(hue) {
  const rim = hsb(.02, .55, .75);   // 희미한 핏빛 림 라이트
  return [
    mat(ramp(hue, .42, .72), PX_SHADED, rim),
    mat(ramp(hueShift(hue, .1, .05), .25, .82), PX_SHADED, rim),
    mat(ramp(hue + .03, .5, .42), PX_SHADED, rim),
    mat(ramp(.12, .18, .9), PX_FLAT),        // 누렇게 바랜 흰자
    mat(ramp(0, .9, .35), PX_FLAT),          // 검붉은 눈동자
    mat(ramp(.98, .8, .28), PX_FLAT),
    mat(ramp(.1, .2, .88), PX_FLAT),
    mat(ramp(.03, .85, 1), PX_GLOW),         // 불씨처럼 빛나는 부분
    mat(ramp(.09, .3, .75), PX_SHADED, rim),
    mat(ramp(hue, .14, .72), PX_SHADED, rim),
  ];
}

/** 눈 한 쌍 (플레이어가 있는 왼쪽을 바라봄). 깜빡임·아픔 표정 포함 */
function eyes(p, o, x1, x2, y, rx, ry) {
  for (const x of [x1, x2]) {
    if (o.hurt) {
      p.line(x - rx * .8, y - ry * .6, x + rx * .8, y + ry * .6, .7, M.PUPIL);
      p.line(x - rx * .8, y + ry * .6, x + rx * .8, y - ry * .6, .7, M.PUPIL);
    } else if (o.blink) {
      p.line(x - rx, y + .5, x + rx, y + .5, 1, M.PUPIL);
    } else {
      p.ellipse(x, y, rx, ry, M.EYE);
      p.ellipse(x - rx * .3, y + ry * .15, rx * .5, ry * .62, M.PUPIL);
      p.dot(x - rx * .45, y - ry * .2, M.EYE);
    }
  }
}

const KINDS = {
  slime: {
    name: '독액 슬라임', desc: '썩은 늪에서 기어 나온 독 덩어리', size: 60, floaty: .6,
    paint(p, o) {
      const { BODY, GLOW, MOUTH, TEETH } = M, wob = Math.sin(o.t * Math.PI * 2);
      p.ellipse(13, 53, 4, 4, BODY);
      p.ellipse(47, 54, 3, 3, BODY);
      p.ellipse(30, 40, 22, 17, BODY, .28);
      p.ellipse(30, 26, 3 + wob * .4, 3, BODY);
      p.dot(20, 40, GLOW); p.dot(39, 48, GLOW); p.dot(33, 52, GLOW);
      p.line(41, 34, 41, 38, .5, GLOW); p.line(39, 36, 43, 36, .5, GLOW);
      eyes(p, o, 23, 37, 37, 4.2, 4.8);
      const mo = o.mouth;
      p.ellipse(30, 46 + mo, 3.5 + mo * 3, 1.6 + mo * 4.2, MOUTH);
      if (mo > .5) { p.ellipse(27.5, 43.5, 1.2, 1.3, TEETH); p.ellipse(32.5, 43.5, 1.2, 1.3, TEETH); }
    },
  },
  bat: {
    name: '흡혈 박쥐', desc: '피 냄새를 맡고 날아드는 외눈 박쥐', size: 60, floaty: 3,
    paint(p, o) {
      const { BODY, BELLY, DARK, EYE, PUPIL, GLOW, MOUTH, TEETH } = M, f = Math.sin(o.t * Math.PI * 4);
      for (const s of [-1, 1]) {
        const sx = 30 + s * 9, tx = 30 + s * 28, ty = 18 + f * 9;
        p.poly(DARK, sx, 26, tx, ty, 30 + s * 27, 33 + f * 5, 30 + s * 21, 32 + f * 3,
          30 + s * 19, 40 + f * 2, 30 + s * 13, 38 + f, sx, 42);
        p.line(sx, 28, tx, ty, .9, BODY);
        p.line(30 + s * 17, 28 + f * 4, 30 + s * 21, 32 + f * 3, .7, BODY);
        p.poly(BODY, 30 + s * 5, 22, 30 + s * 11, 7, 30 + s * 11.5, 24);
        p.poly(BELLY, 30 + s * 7, 20, 30 + s * 10, 12, 30 + s * 10, 21);
        p.capsule(30 + s * 4, 46, 30 + s * 5, 52, 1.6, 1.2, DARK);
      }
      p.ellipse(30, 34, 12, 13, BODY);
      p.ellipse(30, 40, 7, 6, BELLY);
      if (o.hurt) { p.line(25, 28, 35, 36, .9, PUPIL); p.line(25, 36, 35, 28, .9, PUPIL); }
      else if (o.blink) p.line(23, 32, 37, 32, .9, PUPIL);
      else {
        p.ellipse(30, 31, 7, 5.5, EYE);
        p.ellipse(28.5, 31, 4, 4, GLOW);
        p.ellipse(28.2, 31, 1.2, 3.4, PUPIL);
        p.dot(26.5, 29.5, EYE);
      }
      const mo = o.mouth;
      p.ellipse(30, 42, 4 + mo * 2, .8 + mo * 3, MOUTH);
      p.poly(TEETH, 26.5, 41.5, 28.5, 41.5, 27.5, 45.5 + mo);
      p.poly(TEETH, 31.5, 41.5, 33.5, 41.5, 32.5, 45.5 + mo);
    },
  },
  squid: {
    name: '심연의 촉수', desc: '검은 호수 밑바닥에 사는 촉수 괴물', size: 60, floaty: 2,
    paint(p, o) {
      const { BODY, DARK, GLOW, MOUTH } = M;
      for (let i = 0; i < 6; i++) {
        const bx = 19 + i * 4.4;
        let px = bx, py = 38;
        for (let s = 1; s <= 6; s++) {
          const sway = Math.sin(o.t * Math.PI * 2 + i * .9 + s * .7) * s * .55;
          const nx = bx + (i - 2.5) * s * .7 + sway - o.mouth * s * 1.4;
          const ny = 38 + s * 3 - o.mouth * s * .5;
          const r = 3 - s * .32;
          p.capsule(px, py, nx, ny, r + .3, r, i % 2 ? DARK : BODY);
          px = nx; py = ny;
        }
      }
      p.poly(BODY, 15, 26, 9, 18, 17, 17);
      p.poly(BODY, 45, 26, 51, 18, 43, 17);
      p.ellipse(30, 22, 15, 18, BODY, .35);
      p.ellipse(30, 38, 13, 6, BODY);
      p.ellipse(23, 16, 2, 2, GLOW); p.ellipse(35, 11, 1.4, 1.4, GLOW);
      p.ellipse(37, 21, 1.6, 1.6, GLOW); p.dot(29, 8, GLOW);
      eyes(p, o, 24, 36, 33, 3.8, 4.2);
      if (o.mouth > .2) p.ellipse(30, 39.5, 2 + o.mouth * 2, o.mouth * 2.2, MOUTH);
    },
  },
  golem: {
    name: '바위 골렘', desc: '고대 주술로 깨어난 바위 거인', size: 60, floaty: .3,
    paint(p, o) {
      const { BODY, DARK, GLOW, PUPIL, MOUTH } = M, k = o.mouth;
      p.ellipse(22, 52, 6, 5, DARK); p.ellipse(38, 52, 6, 5, DARK);
      p.ellipse(30, 38, 17, 15, BODY);
      p.ellipse(15, 28, 8, 7, BODY); p.ellipse(45, 28, 8, 7, BODY);
      p.ellipse(30, 22, 10, 9, BODY);
      p.ellipse(25, 44, 6, 5, DARK); p.ellipse(37, 34, 4, 3, DARK);
      p.line(24, 32, 28, 38, .6, GLOW); p.line(28, 38, 26, 45, .6, GLOW); p.line(37, 40, 34, 46, .6, GLOW);
      p.facet(GLOW, .9, 42, 24, 45, 13, 48, 24);
      p.facet(GLOW, .5, 47, 25, 50, 16, 52, 26);
      p.facet(GLOW, .8, 11, 24, 13, 15, 16, 23);
      p.ellipse(10 - k * 9, 44 - k * 4, 7 + k, 7 + k, BODY);
      p.ellipse(50, 45, 7, 7, BODY);
      p.line(7 - k * 9, 42 - k * 4, 12 - k * 9, 41 - k * 4, .5, DARK);
      if (o.hurt) {
        p.line(24, 20, 28, 24, .6, PUPIL); p.line(24, 24, 28, 20, .6, PUPIL);
        p.line(32, 20, 36, 24, .6, PUPIL); p.line(32, 24, 36, 20, .6, PUPIL);
      } else if (o.blink) p.line(23, 22, 37, 22, .6, DARK);
      else { p.ellipse(26, 22, 2.6, 1.6, GLOW); p.ellipse(34, 22, 2.6, 1.6, GLOW); }
      p.line(26, 27.5, 34, 27.5, .6 + k * .8, MOUTH);
    },
  },
  wraith: {
    name: '망령', desc: '원한을 품고 떠도는 기사의 혼', size: 60, floaty: 3.5,
    paint(p, o) {
      const { BODY, DARK, PUPIL, GLOW, HORN } = M, a = o.t * Math.PI * 2, k = o.mouth;
      p.capsule(18, 33, 9 - k * 8, 40 + Math.sin(a) * 2 - k * 6, 3.2, 2, BODY);
      p.capsule(42, 33, 51, 40 + Math.cos(a) * 2, 3.2, 2, BODY);
      p.poly(HORN, 7 - k * 8, 40 - k * 6, 4 - k * 8, 44 - k * 6, 8 - k * 8, 43 - k * 6);
      const pts = [15, 30, 45, 30];
      for (let i = 0; i <= 5; i++) pts.push(45 - i * 6, 50 + Math.sin(a + i * 1.3) * 3 + (i % 2 ? -1 : 3));
      p.poly(BODY, ...pts);
      p.ellipse(30, 27, 15, 16, BODY, .1);
      p.ellipse(30, 28, 9.5, 10, DARK);
      p.ellipse(30, 30, 7, 7, PUPIL);
      if (o.hurt) {
        p.line(24, 26, 29, 31, .6, GLOW); p.line(24, 31, 29, 26, .6, GLOW);
        p.line(31, 26, 36, 31, .6, GLOW); p.line(31, 31, 36, 26, .6, GLOW);
      } else if (!o.blink) { p.ellipse(26.5, 28, 1.8, 2.8, GLOW); p.ellipse(33.5, 28, 1.8, 2.8, GLOW); }
      else p.line(25, 28.5, 35, 28.5, .5, GLOW);
      if (k > .1) p.ellipse(30, 34, 2.4, k * 2.6, GLOW);
      for (let i = 0; i < 3; i++) {
        const ang = a + i * Math.PI * 2 / 3;
        p.ellipse(30 + Math.cos(ang) * 20, 14 + Math.sin(ang) * 5, 1.3, 1.3, GLOW);
      }
    },
  },
  drone: {
    name: '저주의 눈', desc: '흑마법사가 남긴 떠다니는 감시 구체', size: 60, floaty: 2.5,
    paint(p, o) {
      const { BELLY, DARK, EYE, PUPIL, GLOW, METAL } = M, k = o.mouth;
      const fl = (Math.sin(o.t * Math.PI * 16) + 1) / 2;
      p.ring(30, 31, 26, 7, 2.2, GLOW, -1);
      p.poly(GLOW, 24, 45, 28, 45, 26, 51 + fl * 3);
      p.poly(GLOW, 32, 45, 36, 45, 34, 51 + fl * 3);
      p.ellipse(26, 45, 3.4, 2.4, DARK); p.ellipse(34, 45, 3.4, 2.4, DARK);
      p.line(30, 17, 30, 8, .7, DARK);
      p.ellipse(30, 7, 2 + k, 2 + k, GLOW);
      p.ellipse(30, 31, 15, 15, METAL);
      p.ellipse(30, 31, 15, 3, DARK);
      p.ellipse(30, 31, 15, 1.5, METAL);
      p.ellipse(28, 31, 8, 8, DARK);
      if (o.hurt) { p.line(24, 27, 32, 35, .8, GLOW); p.line(24, 35, 32, 27, .8, GLOW); }
      else if (o.blink) p.line(22, 31, 34, 31, .8, PUPIL);
      else { p.ellipse(27.5, 31, 5 + k * 1.5, 5 + k * 1.5, GLOW); p.ellipse(27, 31, 2, 2, PUPIL); p.dot(25, 29, EYE); }
      p.ring(30, 31, 26, 7, 2.2, GLOW, 1);
      p.dot(41, 24, BELLY); p.dot(42, 38, BELLY);
    },
  },
  lord: {
    name: '세 눈의 마왕', desc: '지옥 성채를 다스리는 뿔 달린 왕', size: 72, floaty: 1.5, boss: true,
    paint(p, o) {
      const { BODY, BELLY, DARK, PUPIL, MOUTH, TEETH, GLOW, HORN } = M, k = o.mouth;
      p.poly(DARK, 20, 36, 52, 36, 60, 50, 64, 68, 8, 68, 12, 50);
      for (const s of [-1, 1]) {
        const hx = 36 + s * 21 - (s < 0 ? k * 9 : 0), hy = 56 - (s < 0 ? k * 8 : 0);
        p.capsule(36 + s * 15, 40, hx, hy, 5, 4, BODY);
        p.poly(HORN, hx - 3, hy + 2, hx - 4 + s, hy + 8, hx - 1, hy + 4);
        p.poly(HORN, hx + 1, hy + 3, hx + 2 + s, hy + 9, hx + 3, hy + 3);
        p.poly(HORN, 36 + s * 8, 25, 36 + s * 12, 15, 36 + s * 17, 8, 36 + s * 24, 2,
          36 + s * 22, 10, 36 + s * 18, 17, 36 + s * 14, 25);
      }
      p.ellipse(36, 50, 18, 16, BODY, .18);
      p.ellipse(36, 53, 10, 9, BELLY);
      p.ellipse(36, 50, 3.5, 4.5, GLOW);
      p.ellipse(36, 29, 14, 13, BODY);
      p.poly(GLOW, 29, 18, 31, 9, 33, 17);
      p.poly(GLOW, 34, 17, 36, 5, 38, 17);
      p.poly(GLOW, 39, 17, 41, 9, 43, 18);
      if (o.hurt) eyes(p, o, 30, 42, 28, 3, 2.6);
      else if (o.blink) p.line(26, 28, 46, 28, .7, PUPIL);
      else {
        for (const ex of [29.5, 42.5]) { p.ellipse(ex, 28, 3.3, 2.6, GLOW); p.ellipse(ex - .8, 28, 1, 2, PUPIL); }
        p.ellipse(36, 22, 2.6, 2.2, GLOW); p.ellipse(35.6, 22, .8, 1.8, PUPIL);
      }
      p.ellipse(36, 36, 6.5, 1.8 + k * 4, MOUTH);
      for (let i = -2; i <= 2; i++) p.poly(TEETH, 36 + i * 2.5 - .9, 34.4 - k, 36 + i * 2.5 + .9, 34.4 - k, 36 + i * 2.5, 36.5);
    },
  },
  maw: {
    name: '심연의 아귀', desc: '모든 것을 삼키는 거대한 입', size: 72, floaty: 1.2, boss: true,
    paint(p, o) {
      const { BODY, BELLY, DARK, EYE, PUPIL, MOUTH, TEETH, GLOW, HORN } = M, k = o.mouth, a = o.t * Math.PI * 2;
      for (let i = 0; i < 4; i++) { const bx = 16 + i * 13; p.capsule(bx, 56, bx - 4 + Math.sin(a + i) * 3, 68, 4, 2, DARK); }
      for (let i = 0; i < 7; i++) {
        const ang = Math.PI + .25 + i * (Math.PI - .5) / 6;
        const sx = 36 + Math.cos(ang) * 26, sy = 38 + Math.sin(ang) * 25;
        p.poly(HORN, sx - 3, sy, 36 + Math.cos(ang) * 34, 38 + Math.sin(ang) * 33, sx + 3, sy);
      }
      p.ellipse(36, 39, 28, 26, BODY);
      p.ellipse(36, 50, 18, 9, BELLY);
      const mh = 7 + k * 6;
      p.ellipse(36, 42, 19, mh, MOUTH);
      p.ring(36, 42, 11, 2.5 + k * 2, 1.4, GLOW, 0);
      p.ellipse(36, 42, 3, 1.5 + k, PUPIL);
      for (let i = 0; i < 7; i++) {
        const x = 22 + i * 4.7, e = Math.sqrt(Math.max(0, 1 - ((x - 36) / 19) ** 2));
        const ty = 42 - mh * e, by = 42 + mh * e;
        p.poly(TEETH, x - 1.8, ty - .5, x + 1.8, ty - .5, x, ty + 4);
        p.poly(TEETH, x - 1.8, by + .5, x + 1.8, by + .5, x, by - 4);
      }
      eyes(p, { blink: o.blink, hurt: o.hurt }, 24, 48, 24, 3.4, 3.4);
      if (!o.hurt && !o.blink) { p.ellipse(36, 18, 4.4, 4.4, EYE); p.ellipse(35, 18.5, 2.2, 2.8, PUPIL); p.dot(34.4, 16.8, EYE); }
    },
  },
  titan: {
    name: '수정 거인', desc: '균열에서 자라난 수정의 거신', size: 72, floaty: 2, boss: true,
    paint(p, o) {
      const { BODY, BELLY, DARK, PUPIL, GLOW } = M, k = o.mouth, bob = Math.sin(o.t * Math.PI * 2) * 1.5;
      const lx = 10 - k * 8, ly = 44 + bob - k * 6;
      p.facet(BODY, .95, lx, ly - 8, lx + 6, ly, lx, ly + 8);
      p.facet(BODY, .45, lx, ly - 8, lx - 6, ly, lx, ly + 8);
      p.facet(BODY, .95, 62, 44 - bob - 8, 68, 44 - bob, 62, 44 - bob + 8);
      p.facet(BODY, .45, 62, 44 - bob - 8, 56, 44 - bob, 62, 44 - bob + 8);
      p.facet(DARK, .6, 26, 54, 32, 54, 30, 68, 22, 68);
      p.facet(DARK, .35, 40, 54, 46, 54, 50, 68, 42, 68);
      p.facet(BODY, .98, 36, 26, 24, 34, 28, 46, 36, 44);
      p.facet(BODY, .62, 36, 26, 48, 34, 44, 46, 36, 44);
      p.facet(BODY, .72, 28, 46, 36, 44, 36, 58, 26, 54);
      p.facet(BODY, .38, 44, 46, 36, 44, 36, 58, 46, 54);
      p.facet(GLOW, .9, 22, 34, 14, 16, 26, 30);
      p.facet(GLOW, .5, 18, 32, 10, 24, 20, 34);
      p.facet(GLOW, .5, 50, 34, 58, 16, 46, 30);
      p.facet(GLOW, .9, 54, 32, 62, 24, 52, 34);
      p.ellipse(36, 42, 3.4 + k, 3.4 + k, GLOW);
      p.facet(BODY, 1, 36, 8, 28, 18, 36, 24);
      p.facet(BODY, .55, 36, 8, 44, 18, 36, 24);
      p.facet(BELLY, .9, 36, 4, 34, 10, 36, 12, 38, 10);
      if (o.hurt) {
        p.line(31, 15, 34, 19, .6, PUPIL); p.line(31, 19, 34, 15, .6, PUPIL);
        p.line(38, 15, 41, 19, .6, PUPIL); p.line(38, 19, 41, 15, .6, PUPIL);
      } else if (o.blink) p.line(31, 17, 41, 17, .5, PUPIL);
      else { p.line(30.5, 17, 34.5, 17, .9, GLOW); p.line(37.5, 17, 41.5, 17, .9, GLOW); }
    },
  },
};
for (const [id, k] of Object.entries(KINDS)) k.id = id;

const frameCache = new Map();
/** 몬스터 프레임 묶음: 숨쉬기 8 · 깜빡임 · 공격 4 · 맞음(+번쩍) */
function monsterFrames(kindId, hue) {
  const key = kindId + '@' + hue;
  let f = frameCache.get(key);
  if (f) return f;
  const k = KINDS[kindId], mats = monsterMats(hue);
  const draw = o => {
    const p = new PixelArt(k.size, k.size, PIX_K);
    p.pose(o.sq || 0, o.lean || 0);
    k.paint(p, Object.assign({ t: 0, mouth: 0 }, o));
    return p.render(mats);
  };
  // res: 실제 칸 수, scale: 화면에서 한 칸 크기, base: 발이 닿는 줄
  f = { size: k.size, res: Math.round(k.size * PIX_K), scale: PIX_SCALE, base: Math.round((k.size - 3) * PIX_K),
    glow: hsbCss(hue, .5, .85), idle: [], attack: [] };
  for (let i = 0; i < 8; i++) f.idle.push(draw({ t: i / 8, sq: .045 * Math.sin(i / 8 * Math.PI * 2) }));
  f.blink = draw({ blink: true });
  [[.3, -.08, .3], [-1, .1, 1], [-.75, .06, .85], [-.25, 0, .3]].forEach(([lean, sq, mouth], i) =>
    f.attack.push(draw({ t: i / 4, lean, sq, mouth })));
  f.hurt = draw({ hurt: true, lean: .5, sq: .1, mouth: .35 });
  f.hurtFlash = flashImage(f.hurt);
  frameCache.set(key, f);
  return f;
}

/* ===================================================================== 파일럿 */

const Pilot = (() => {
  const SUIT = 0, METAL = 1, VISOR = 2, CAPE = 3, DARK = 4, BLADE = 5;
  const W_ = 48, H_ = 46;
  let mats = null;
  const getMats = () => mats || (mats = [
    mat(ramp(.66, .18, .6), PX_SHADED, hexRgb(P.red)),     // 강철 갑옷
    mat(ramp(.08, .12, .82), PX_SHADED, hexRgb(P.red)),    // 무쇠 투구
    mat(ramp(.07, .85, 1), PX_GLOW),                       // 호박색 바이저
    mat(ramp(.99, .75, .62), PX_SHADED, hexRgb(P.orange)), // 핏빛 망토
    mat(ramp(.7, .3, .3), PX_SHADED, hexRgb(P.red)),
    mat(ramp(.04, .75, 1), PX_GLOW),                       // 달군 쇠처럼 빛나는 검
  ]);
  function draw(t, deg, lean, hurt) {
    const p = new PixelArt(W_, H_, PIX_K);
    p.pose(.03 * Math.sin(t * Math.PI * 2), lean);
    const wave = Math.sin(t * Math.PI * 2) * 2;
    p.poly(CAPE, 15, 17, 5, 22 + wave, 3, 33 + wave, 10, 31 + wave * .5, 16, 27);
    p.capsule(16, 30, 14, 39, 2.4, 2.1, DARK);
    p.capsule(21, 30, 23, 39, 2.4, 2.1, DARK);
    p.ellipse(14, 40.5, 3.2, 2, METAL); p.ellipse(24, 40.5, 3.2, 2, METAL);
    p.capsule(15, 20, 13, 27, 1.9, 1.7, SUIT);
    p.ellipse(13, 21, 3, 5, METAL);
    p.ellipse(18, 24, 6.5, 7, SUIT);
    p.ellipse(16, 18.5, 4.6, 3.2, METAL);                    // 어깨 갑옷
    p.line(12, 27.5, 24, 27.5, .8, DARK);
    p.dot(20, 21.5, VISOR);
    p.capsule(17, 6, 8 + wave * .6, 2, 2.4, 1.2, CAPE);      // 투구 깃털
    p.capsule(14, 5, 5 + wave * .8, 7, 1.8, .8, CAPE);
    p.ellipse(19, 12, 7, 7.6, METAL);                        // 투구
    p.ellipse(19.5, 17.5, 6, 2.6, METAL);
    p.line(19, 4.8, 19, 9, .55, DARK);
    if (hurt) {
      p.line(17, 12.5, 25.5, 12.5, 1, DARK);
      p.line(19.5, 10.5, 23.5, 14.5, .5, CAPE); p.line(19.5, 14.5, 23.5, 10.5, .5, CAPE);
    } else {
      p.line(17, 12.5, 25.5, 12.5, .95, DARK);
      p.line(18.5, 12.5, 25, 12.5, .5, VISOR);              // 투구 틈으로 빛나는 눈
    }
    p.dot(22.5, 15.5, DARK); p.dot(24.5, 15.5, DARK);
    const a = deg * Math.PI / 180, sx = 21, sy = 19;
    const hx = sx + Math.cos(a + .9) * 5.5, hy = sy + Math.sin(a + .9) * 5.5 + 2;
    p.line(hx, hy, hx + Math.cos(a) * 17, hy + Math.sin(a) * 17, 1.25, BLADE);
    p.line(hx - Math.sin(a) * 2.5, hy + Math.cos(a) * 2.5, hx + Math.sin(a) * 2.5, hy - Math.cos(a) * 2.5, .8, DARK);
    p.capsule(sx, sy, hx, hy, 2, 1.8, SUIT);
    p.ellipse(hx, hy, 1.7, 1.7, METAL);
    return p.render(getMats());
  }
  let cache = null;
  return {
    // W, H: 실제 칸 수 · SCALE: 화면 한 칸 크기 · CX, BASE: 발 위치(칸)
    W: Math.round(W_ * PIX_K), H: Math.round(H_ * PIX_K), SCALE: 5,
    CX: Math.round(19 * PIX_K), BASE: Math.round(42 * PIX_K),
    get frames() {
      if (cache) return cache;
      cache = { idle: [], slash: [] };
      for (let i = 0; i < 4; i++) cache.idle.push(draw(i / 4, -60 + Math.sin(i / 4 * Math.PI * 2) * 4, 0, false));
      const deg = [-150, -45, 15, 40], lean = [-.2, .5, .6, .35];
      for (let i = 0; i < 4; i++) cache.slash.push(draw(.25, deg[i], lean[i], false));
      cache.hurt = draw(.5, -110, -.6, true);
      cache.hurtFlash = flashImage(cache.hurt);
      return cache;
    },
  };
})();
