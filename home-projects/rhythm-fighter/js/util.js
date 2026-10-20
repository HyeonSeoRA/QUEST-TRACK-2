'use strict';
/*
 * 다크 판타지 디자인 도구: 색, 세리프 글꼴, 금테 패널, 게이지, 아이콘, 그림 같은 배경.
 * 무거운 그림(배경·패널)은 처음에 한 번만 그려 두고, 매 프레임에는 가벼운 것만 그린다.
 */

const W = 1280, H = 720;

/* 어두운 판타지 색 (검은 가죽 · 금 장식 · 핏빛 · 양피지) */
const P = {
  ink: '#050407', bg: '#0d0b0a', navy: '#16141a', blue: '#1f2a3a', sky: '#6f8fb0', cyan: '#a9c4d6',
  white: '#efe6d2', silver: '#a79c86', slate: '#4a4236', steel: '#231f1a',
  plum: '#2a1420', red: '#9b1b1b', orange: '#c8642a', yellow: '#d9b25f', lime: '#8a9a5b', green: '#3f5a2e', teal: '#20393a',
  blood: '#4a0a0a', ember: '#ff8a3d', gold: '#c9a24a', goldLight: '#f2d48a', goldDark: '#6b4e1e',
};
/* 네 줄은 보석 색: 사파이어 · 에메랄드 · 토파즈 · 루비 */
const LANE_COLORS = ['#4a7cc9', '#3fa070', '#d9a441', '#c43a44'];

const SERIF = '"Nanum Myeongjo", "Batang", serif';
const DISPLAY = 'Cinzel, "Nanum Myeongjo", serif';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = t => 1 - Math.pow(1 - clamp(t, 0, 1), 3);
const comma = n => Math.round(n).toLocaleString('en-US');
const snap = v => Math.round(v);

/* ---------- 색 ---------- */
function hexRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [n >> 16 & 255, n >> 8 & 255, n & 255];
}
function toRgb(c) {
  if (Array.isArray(c)) return c;
  if (c[0] === '#') return hexRgb(c);
  return c.match(/[\d.]+/g).slice(0, 3).map(Number);
}
function rgba(c, a) { const [r, g, b] = toRgb(c); return `rgba(${r},${g},${b},${a})`; }
function mixRgb(a, b, t) { return [0, 1, 2].map(i => Math.round(a[i] + (b[i] - a[i]) * t)); }
function mix(a, b, t) { return rgba(mixRgb(toRgb(a), toRgb(b), t), 1); }
function hsb(h, s, v) {
  h = ((h % 1) + 1) % 1; s = clamp(s, 0, 1); v = clamp(v, 0, 1);
  const i = Math.floor(h * 6), f = h * 6 - i;
  const p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  const m = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i % 6];
  return m.map(x => Math.round(x * 255));
}
const hsbCss = (h, s, v, a = 1) => rgba(hsb(h, s, v), a);

/** 금속 같은 금색 그라데이션 (위 밝고 아래 어두움) */
function goldGrad(ctx, y0, y1) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, '#fff1c4');
  g.addColorStop(.35, P.goldLight);
  g.addColorStop(.6, P.gold);
  g.addColorStop(1, '#7a5a24');
  return g;
}

/* ---------- 빛 번짐 (미리 그려 둔 둥근 빛을 재사용) ---------- */
const glowCache = new Map();
function glowSprite(color) {
  let c = glowCache.get(color);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, rgba(color, .9)); gr.addColorStop(.3, rgba(color, .4)); gr.addColorStop(1, rgba(color, 0));
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  glowCache.set(color, c);
  return c;
}
function glow(ctx, color, x, y, rx, ry, a = 1) {
  if (a <= .02) return;
  const op = ctx.globalCompositeOperation, ga = ctx.globalAlpha, sm = ctx.imageSmoothingEnabled;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = ga * Math.min(1, a);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(glowSprite(color), x - rx, y - ry, rx * 2, ry * 2);
  ctx.globalCompositeOperation = op; ctx.globalAlpha = ga; ctx.imageSmoothingEnabled = sm;
}

/* ---------- 각진 패널 · 칩 · 게이지 (디지털한 모양, 따뜻한 금색) ---------- */
/** 네 모서리를 비스듬히 깎은 팔각형 경로 */
function chamfer(ctx, x, y, w, h, c) {
  ctx.beginPath();
  ctx.moveTo(x + c, y); ctx.lineTo(x + w - c, y); ctx.lineTo(x + w, y + c); ctx.lineTo(x + w, y + h - c);
  ctx.lineTo(x + w - c, y + h); ctx.lineTo(x + c, y + h); ctx.lineTo(x, y + h - c); ctx.lineTo(x, y + c);
  ctx.closePath();
}
/** 모서리 장식 (예전 이름 그대로 남겨 둠): 깎인 모서리 금선 + 꺾쇠 */
function cornerOrn(ctx, x, y, sx, sy, col) {
  ctx.strokeStyle = col; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + sx * 4, y + sy * 18); ctx.lineTo(x + sx * 4, y + sy * 4); ctx.lineTo(x + sx * 18, y + sy * 4);
  ctx.stroke();
  ctx.fillStyle = col; ctx.fillRect(x + sx * 7 - 1.5, y + sy * 7 - 1.5, 3, 3);
}
/** 각진 패널: 깎인 모서리 + 이중 금선 + 눈금 + 위 가운데 탭 */
function box(ctx, x, y, w, h, o = {}) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  const edge = o.border || P.gold;
  const big = w >= 120 && h >= 60;
  const c = o.cut ?? (big ? 14 : Math.min(7, h / 3));
  if (o.shadow !== false) { ctx.fillStyle = 'rgba(0,0,0,0.55)'; chamfer(ctx, x + 4, y + 6, w, h, c); ctx.fill(); }
  ctx.fillStyle = o.fill || 'rgba(14,11,10,0.93)';
  chamfer(ctx, x, y, w, h, c); ctx.fill();
  if (o.hi !== false && h > 30) {
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, 'rgba(255,215,150,0.07)'); g.addColorStop(.35, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.3)');
    ctx.fillStyle = g; ctx.fill();
  }
  // 은은한 사선 무늬 (큰 패널만)
  if (o.texture !== false && w >= 300 && h >= 200) {
    ctx.save(); chamfer(ctx, x, y, w, h, c); ctx.clip();
    ctx.strokeStyle = 'rgba(201,162,74,0.025)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let k = -h; k < w; k += 7) { ctx.moveTo(x + k, y + h); ctx.lineTo(x + k + h, y); }
    ctx.stroke();
    ctx.restore();
  }
  ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(0,0,0,0.95)';
  chamfer(ctx, x - 1.5, y - 1.5, w + 3, h + 3, c + 1); ctx.stroke();
  ctx.lineWidth = (o.t || 3) >= 3 ? 1.6 : 1.1; ctx.strokeStyle = edge;
  chamfer(ctx, x + .5, y + .5, w - 1, h - 1, c); ctx.stroke();
  if ((o.t || 3) >= 3 && w > 40 && h > 30) {
    ctx.lineWidth = 1; ctx.strokeStyle = rgba(edge, .28);
    chamfer(ctx, x + 5.5, y + 5.5, w - 11, h - 11, Math.max(2, c - 3)); ctx.stroke();
  }
  if (o.rivets !== false && big) {
    const lc = edge === P.gold ? P.goldLight : edge;
    // 깎인 모서리를 굵게
    ctx.strokeStyle = lc; ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, y + c); ctx.lineTo(x + c, y);
    ctx.moveTo(x + w - c, y); ctx.lineTo(x + w, y + c);
    ctx.moveTo(x + w, y + h - c); ctx.lineTo(x + w - c, y + h);
    ctx.moveTo(x + c, y + h); ctx.lineTo(x, y + h - c);
    ctx.stroke();
    // 눈금
    ctx.fillStyle = rgba(lc, .8);
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(x + c + 8 + i * 6, y - 1, 2, 5); ctx.fillRect(x + w - c - 10 - i * 6, y - 1, 2, 5);
      ctx.fillRect(x + c + 8 + i * 6, y + h - 4, 2, 5); ctx.fillRect(x + w - c - 10 - i * 6, y + h - 4, 2, 5);
    }
    // 위 가운데 탭
    if (w >= 200) {
      ctx.fillStyle = lc;
      ctx.beginPath(); ctx.moveTo(x + w / 2 - 34, y - 1); ctx.lineTo(x + w / 2 + 34, y - 1); ctx.lineTo(x + w / 2 + 28, y + 3); ctx.lineTo(x + w / 2 - 28, y + 3); ctx.fill();
    }
  }
}
function chip(ctx, x, y, w, h, color) {
  const c = color || P.gold;
  chamfer(ctx, x, y, w, h, Math.min(6, h / 3));
  ctx.fillStyle = rgba(mixRgb(toRgb(c), [0, 0, 0], .82), .92); ctx.fill();
  ctx.lineWidth = 1; ctx.strokeStyle = rgba(c, .75); ctx.stroke();
}
/** 칸으로 나뉜 게이지 + 양 끝 화살 장식 (채우기는 한 번만 해서 가볍게) */
const barGradCache = new Map();
function bar(ctx, x, y, w, h, ratio, color, ghost = 0) {
  ratio = clamp(ratio, 0, 1);
  ghost = clamp(Math.max(ratio, ghost), 0, 1);
  ctx.fillStyle = '#000'; ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
  ctx.fillStyle = P.goldDark;
  ctx.beginPath(); ctx.moveTo(x - 4, y - 3); ctx.lineTo(x - 10, y + h / 2); ctx.lineTo(x - 4, y + h + 3); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x + w + 4, y - 3); ctx.lineTo(x + w + 10, y + h / 2); ctx.lineTo(x + w + 4, y + h + 3); ctx.fill();
  ctx.fillStyle = '#17110d'; ctx.fillRect(x, y, w, h);
  if (ghost > ratio) { ctx.fillStyle = 'rgba(240,220,190,0.5)'; ctx.fillRect(x + w * ratio, y, w * (ghost - ratio), h); }
  if (ratio > 0) {
    const key = color + y + h;
    let g = barGradCache.get(key);
    if (!g) {
      const c = toRgb(color);
      g = ctx.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, rgba(mixRgb(c, [255, 255, 255], .45), 1)); g.addColorStop(.45, rgba(c, 1)); g.addColorStop(1, rgba(mixRgb(c, [0, 0, 0], .55), 1));
      if (barGradCache.size > 64) barGradCache.clear();
      barGradCache.set(key, g);
    }
    ctx.fillStyle = g; ctx.fillRect(x, y, w * ratio, h);
  }
  // 칸 사이 틈
  const n = Math.max(8, Math.round(w / 12)), step = w / n;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  for (let i = 1; i < n; i++) ctx.rect(Math.round(x + i * step) - 1, y, 2, h);
  ctx.fill();
  ctx.lineWidth = 1; ctx.strokeStyle = P.goldDark; ctx.strokeRect(x - 2.5, y - 2.5, w + 5, h + 5);
}

/* ---------- 글자 ---------- */
/** 한글 명조 글자 + 아래로 떨어지는 그림자 */
function text(ctx, s, x, y, size, color, align = 'left', shadow = true, weight = 700) {
  ctx.font = `${weight} ${size}px ${SERIF}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  if (shadow) { ctx.fillStyle = 'rgba(0,0,0,0.9)'; ctx.fillText(s, x + 1, y + 2); }
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}
/** 영어 제목 글자 (Cinzel). color 가 P.yellow 나 'gold' 면 금속 금색 */
function disp(ctx, s, x, y, size, color, align = 'left', depth = 0) {
  ctx.font = `700 ${size}px ${DISPLAY}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  if (depth) { ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fillText(s, x + Math.max(1, depth / 2), y + depth); }
  ctx.lineWidth = Math.max(2, size / 9);
  ctx.strokeStyle = 'rgba(0,0,0,0.9)';
  ctx.strokeText(s, x, y);
  ctx.fillStyle = (color === 'gold' || color === P.yellow) ? goldGrad(ctx, y - size * .8, y) : color;
  ctx.fillText(s, x, y);
}
/** 굵은 테두리 글자 (대미지 숫자 등) */
function outlined(ctx, s, x, y, size, color, display = false) {
  ctx.font = display ? `700 ${size}px ${DISPLAY}` : `800 ${size}px ${SERIF}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(3, size / 6);
  ctx.strokeStyle = 'rgba(0,0,0,0.92)';
  ctx.strokeText(s, x, y);
  ctx.fillStyle = (color === 'gold' || color === P.yellow) ? goldGrad(ctx, y - size * .8, y) : color;
  ctx.fillText(s, x, y);
}
function textW(ctx, s, size, display = false) {
  ctx.font = display ? `700 ${size}px ${DISPLAY}` : `700 ${size}px ${SERIF}`;
  return ctx.measureText(s).width;
}
function wrapText(ctx, s, x, y, maxW, size, color, lh) {
  ctx.font = `700 ${size}px ${SERIF}`;
  let line = '';
  for (const word of s.split(' ')) {
    const t = line ? line + ' ' + word : word;
    if (ctx.measureText(t).width > maxW && line) { text(ctx, line, x, y, size, color); y += lh; line = word; }
    else line = t;
  }
  if (line) text(ctx, line, x, y, size, color);
}
/** 가운데 제목 양옆의 각진 장식선  ‹──◆──› */
function ornLine(ctx, cx, y, half, color = P.gold) {
  const g = ctx.createLinearGradient(cx - half, 0, cx + half, 0);
  g.addColorStop(0, rgba(color, 0)); g.addColorStop(.25, rgba(color, .9)); g.addColorStop(.75, rgba(color, .9)); g.addColorStop(1, rgba(color, 0));
  ctx.fillStyle = g; ctx.fillRect(cx - half, y - .75, half * 2, 1.5);
  ctx.fillStyle = color;
  for (const s of [-1, 1]) {
    ctx.fillRect(cx + s * 12 - (s < 0 ? 2 : 0), y - 4, 2, 8);
    ctx.beginPath(); ctx.moveTo(cx + s * half * .55, y - 4); ctx.lineTo(cx + s * (half * .55 + 5), y); ctx.lineTo(cx + s * half * .55, y + 4); ctx.fill();
  }
  ctx.beginPath(); ctx.moveTo(cx, y - 6); ctx.lineTo(cx + 6, y); ctx.lineTo(cx, y + 6); ctx.lineTo(cx - 6, y); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#000'; ctx.fillRect(cx - 1.5, y - 1.5, 3, 3);
}
/** 각진 명판: 양끝이 뾰족한 금테 판 + 가운데 글자 */
function plaque(ctx, cx, y, w, label, color = P.goldLight, h = 30) {
  const x = cx - w / 2, p = h / 2;
  const path = (o) => {
    ctx.beginPath();
    ctx.moveTo(x - o, y + p); ctx.lineTo(x + p - o, y - o); ctx.lineTo(x + w - p + o, y - o); ctx.lineTo(x + w + o, y + p);
    ctx.lineTo(x + w - p + o, y + h + o); ctx.lineTo(x + p - o, y + h + o); ctx.closePath();
  };
  path(2); ctx.fillStyle = '#000'; ctx.fill();
  path(0);
  const g = ctx.createLinearGradient(0, y, 0, y + h);
  g.addColorStop(0, '#2a2016'); g.addColorStop(1, '#0d0907');
  ctx.fillStyle = g; ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = P.gold; ctx.stroke();
  ctx.fillStyle = P.goldLight;
  ctx.fillRect(x - 14, y + p - 1, 8, 2); ctx.fillRect(x + w + 6, y + p - 1, 8, 2);
  text(ctx, label, cx, y + h / 2 + 6, 15, color, 'center', true, 800);
}
/** 화면 전체를 감싸는 웅장한 금테 (모든 화면 맨 위에 그림) */
function screenFrame(ctx) {
  const m = 5, c = 22;
  ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(201,162,74,0.55)';
  chamfer(ctx, m + .5, m + .5, W - m * 2 - 1, H - m * 2 - 1, c); ctx.stroke();
  ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(0,0,0,0.9)';
  chamfer(ctx, m - 1.5, m - 1.5, W - m * 2 + 3, H - m * 2 + 3, c + 1); ctx.stroke();
  for (const [x, y, sx, sy] of [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]]) {
    ctx.strokeStyle = P.goldLight; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(x, y + sy * c); ctx.lineTo(x + sx * c, y); ctx.stroke();
    ctx.fillStyle = P.gold;
    ctx.beginPath(); ctx.moveTo(x + sx * 6, y + sy * 6); ctx.lineTo(x + sx * 16, y + sy * 6); ctx.lineTo(x + sx * 6, y + sy * 16); ctx.fill();
  }
  for (const y of [m, H - m]) {
    ctx.fillStyle = P.gold;
    ctx.beginPath(); ctx.moveTo(W / 2 - 60, y); ctx.lineTo(W / 2 + 60, y); ctx.lineTo(W / 2 + 50, y + (y === m ? 4 : -4)); ctx.lineTo(W / 2 - 50, y + (y === m ? 4 : -4)); ctx.fill();
    ctx.beginPath(); ctx.moveTo(W / 2, y - 5); ctx.lineTo(W / 2 + 5, y); ctx.lineTo(W / 2, y + 5); ctx.lineTo(W / 2 - 5, y); ctx.fill();
  }
}

/* ---------- 아이콘 (선으로 그린 문장) ---------- */
/** s: 크기 단계 (예전 도트 아이콘과 같은 값을 받아 비슷한 크기로 그린다) */
function icon(ctx, name, cx, cy, s, color, outline = '#000') {
  const r = s * 3.6;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.beginPath();
  switch (name) {
    case 'star':
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r * .45 : r;
        ctx.lineTo(Math.cos(a) * q, Math.sin(a) * q);
      }
      ctx.closePath(); break;
    case 'gem':
      ctx.moveTo(-r, -r * .3); ctx.lineTo(-r * .5, -r * .8); ctx.lineTo(r * .5, -r * .8); ctx.lineTo(r, -r * .3); ctx.lineTo(0, r); ctx.closePath(); break;
    case 'lock':
      ctx.rect(-r * .7, -r * .1, r * 1.4, r * 1.05); break;
    case 'sword':
      ctx.moveTo(r * .9, -r * .9); ctx.lineTo(r * .55, -r * .25); ctx.lineTo(-r * .25, r * .55); ctx.lineTo(-r * .45, r * .35); ctx.lineTo(r * .35, -r * .45); ctx.closePath();
      ctx.moveTo(-r * .55, r * .05); ctx.lineTo(-r * .05, r * .55); ctx.lineTo(-r * .15, r * .65); ctx.lineTo(-r * .65, r * .15); ctx.closePath();
      ctx.moveTo(-r * .35, r * .5); ctx.lineTo(-r * .85, r); ctx.lineTo(-r, r * .85); ctx.lineTo(-r * .5, r * .35); ctx.closePath(); break;
    case 'shield':
      ctx.moveTo(-r * .8, -r * .85); ctx.lineTo(r * .8, -r * .85); ctx.lineTo(r * .8, -r * .1);
      ctx.quadraticCurveTo(r * .75, r * .6, 0, r); ctx.quadraticCurveTo(-r * .75, r * .6, -r * .8, -r * .1); ctx.closePath(); break;
    case 'note':
      ctx.ellipse(-r * .35, r * .55, r * .38, r * .28, -.4, 0, Math.PI * 2);
      ctx.rect(-r * .02, -r * .9, r * .18, r * 1.45);
      ctx.moveTo(r * .1, -r * .9); ctx.lineTo(r * .75, -r * .55); ctx.lineTo(r * .75, -r * .3); ctx.lineTo(r * .1, -r * .6); ctx.closePath(); break;
    case 'heart':
      ctx.moveTo(0, r * .9);
      ctx.bezierCurveTo(-r * 1.2, 0, -r * .6, -r * 1.1, 0, -r * .35);
      ctx.bezierCurveTo(r * .6, -r * 1.1, r * 1.2, 0, 0, r * .9); break;
    case 'crown':
      ctx.moveTo(-r, r * .6); ctx.lineTo(-r, -r * .5); ctx.lineTo(-r * .5, 0); ctx.lineTo(0, -r * .8); ctx.lineTo(r * .5, 0); ctx.lineTo(r, -r * .5); ctx.lineTo(r, r * .6); ctx.closePath(); break;
    case 'play':
      ctx.moveTo(-r * .6, -r * .8); ctx.lineTo(r * .8, 0); ctx.lineTo(-r * .6, r * .8); ctx.closePath(); break;
    default: // core: 겹친 원 문장
      ctx.arc(0, 0, r, 0, Math.PI * 2);
  }
  ctx.lineWidth = Math.max(1.5, r * .22);
  ctx.strokeStyle = outline;
  ctx.stroke();
  ctx.fillStyle = (color === P.yellow || color === 'gold') ? goldGrad(ctx, -r, r) : color;
  ctx.fill();
  if (name === 'lock') {
    ctx.beginPath(); ctx.arc(0, -r * .1, r * .45, Math.PI, 0);
    ctx.lineWidth = Math.max(1.5, r * .2); ctx.strokeStyle = color; ctx.stroke();
  }
  if (name === 'core') {
    ctx.beginPath(); ctx.arc(0, 0, r * .55, 0, Math.PI * 2);
    ctx.lineWidth = Math.max(1, r * .14); ctx.strokeStyle = outline; ctx.stroke();
  }
  ctx.restore();
}

/* ---------- 씨앗 있는 난수 ---------- */
function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/** 캔버스 하나를 새로 만들어 그 위에 그린다 */
function makeCanvas(w, h, s, draw) {
  const c = document.createElement('canvas');
  c.width = Math.ceil(w * s); c.height = Math.ceil(h * s);
  const g = c.getContext('2d');
  g.scale(s, s);
  draw(g);
  return c;
}

/* ---------- 그림 같은 배경 (처음 한 번만 그림) ---------- */
const THEMES = [
  { // 1장: 버려진 묘지 — 차가운 달빛
    sky: ['#05070b', '#0c1420', '#1a2a38', '#34485a'], moon: '#d8dccf', moonGlow: '#8fb0c8', fog: '#4c6274',
    far: '#0d141c', mid: '#080c12', near: '#030407', light: '#e0b35a', ground: ['#0b0e12', '#040506'], feature: 'grave',
  },
  { // 2장: 핏빛 성채 — 붉은 달
    sky: ['#060304', '#1a0608', '#3f0b0e', '#72201a'], moon: '#e0563a', moonGlow: '#ff6a3a', fog: '#6a1a16',
    far: '#1c0709', mid: '#100405', near: '#050203', light: '#ff9a3c', ground: ['#120607', '#050203'], feature: 'citadel',
  },
  { // 3장: 심연의 균열 — 하늘이 찢어진 곳
    sky: ['#040306', '#0e0a16', '#1d1428', '#2f1f3c'], moon: '#c9b6ff', moonGlow: '#8a5cff', fog: '#3a2850',
    far: '#130e1c', mid: '#0a0710', near: '#040306', light: '#b48cff', ground: ['#0d0a12', '#040306'], feature: 'rift',
  },
];

/**
 * w x h 크기의 풍경. opt.horizon: 땅이 시작되는 높이(0~1), opt.moon: [x, y, r] (0~1 비율), opt.castle: 가운데 큰 성
 */
function sceneBg(w, h, theme, seed, opt = {}) {
  const T = THEMES[theme];
  const r = rng(seed);
  const hz = Math.round(h * (opt.horizon ?? .72));
  return makeCanvas(w, h, opt.scale || 1, g => {
    // 하늘
    let gr = g.createLinearGradient(0, 0, 0, hz);
    T.sky.forEach((c, i) => gr.addColorStop(i / (T.sky.length - 1), c));
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    // 별
    for (let i = 0; i < w * h / 2600; i++) {
      g.fillStyle = `rgba(235,225,210,${.15 + r() * .55})`;
      g.fillRect(r() * w, r() * hz * .75, r() < .9 ? 1 : 2, 1);
    }
    // 달 (또는 하늘의 균열)
    const [mx, my, mr] = opt.moon || [.72, .26, .11];
    const X = mx * w, Y = my * hz, R = mr * Math.min(w, h * 1.6);
    if (T.feature === 'rift') {
      g.save();
      g.globalCompositeOperation = 'lighter';
      gr = g.createRadialGradient(X, Y, 0, X, Y, R * 4);
      gr.addColorStop(0, rgba(T.moonGlow, .45)); gr.addColorStop(1, rgba(T.moonGlow, 0));
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.filter = 'blur(6px)';
      const crack = width => {
        g.beginPath();
        let cx = X - R * .3, cy = Y - R * 2;
        g.moveTo(cx, cy);
        const rr = rng(seed + 9);
        for (let i = 0; i < 14; i++) { cx += (rr() - .5) * R * .6; cy += R * .3; g.lineTo(cx, cy); }
        g.lineWidth = width; g.stroke();
      };
      g.strokeStyle = rgba(T.moonGlow, .9); crack(R * .5);
      g.filter = 'none';
      g.strokeStyle = T.moon; crack(R * .12);
      g.strokeStyle = '#ffffff'; crack(R * .04);
      g.restore();
    } else {
      g.save();
      g.globalCompositeOperation = 'lighter';
      gr = g.createRadialGradient(X, Y, R * .8, X, Y, R * 4.2);
      gr.addColorStop(0, rgba(T.moonGlow, .38)); gr.addColorStop(1, rgba(T.moonGlow, 0));
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.restore();
      gr = g.createRadialGradient(X - R * .3, Y - R * .35, R * .1, X, Y, R);
      gr.addColorStop(0, mix(T.moon, '#ffffff', .4)); gr.addColorStop(.7, T.moon); gr.addColorStop(1, mix(T.moon, '#000000', .35));
      g.fillStyle = gr; g.beginPath(); g.arc(X, Y, R, 0, Math.PI * 2); g.fill();
      g.save(); g.beginPath(); g.arc(X, Y, R, 0, Math.PI * 2); g.clip();
      for (let i = 0; i < 9; i++) {
        g.fillStyle = `rgba(0,0,0,${.06 + r() * .1})`;
        g.beginPath(); g.arc(X + (r() - .5) * R * 1.4, Y + (r() - .5) * R * 1.4, R * (.08 + r() * .22), 0, Math.PI * 2); g.fill();
      }
      g.restore();
      // 달빛 줄기
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.filter = 'blur(14px)';
      for (let i = 0; i < 5; i++) {
        const a = Math.PI * (.35 + i * .08 + r() * .03), len = h * 1.2, wd = .025 + r() * .03;
        g.fillStyle = rgba(T.moonGlow, .06 + r() * .05);
        g.beginPath(); g.moveTo(X, Y);
        g.lineTo(X + Math.cos(a - wd) * len, Y + Math.sin(a - wd) * len);
        g.lineTo(X + Math.cos(a + wd) * len, Y + Math.sin(a + wd) * len);
        g.closePath(); g.fill();
      }
      g.restore();
    }
    // 구름
    g.save();
    g.filter = 'blur(10px)';
    for (let i = 0; i < 8; i++) {
      g.fillStyle = rgba(mix(T.sky[1], '#000000', .3), .55 + r() * .3);
      g.beginPath(); g.ellipse(r() * w, hz * (.1 + r() * .5), w * (.12 + r() * .18), 10 + r() * 22, 0, 0, Math.PI * 2); g.fill();
    }
    g.restore();
    // 먼 산
    const ridge = (base, amp, col, step) => {
      g.fillStyle = col; g.beginPath(); g.moveTo(0, h);
      let y = base;
      for (let x = 0; x <= w + step; x += step) { y = clamp(y + (r() - .5) * amp, base - amp * 2, base + amp); g.lineTo(x, y); }
      g.lineTo(w, h); g.closePath(); g.fill();
    };
    ridge(hz - h * .12, h * .035, T.far, w / 40);
    // 안개 1
    gr = g.createLinearGradient(0, hz - h * .2, 0, hz);
    gr.addColorStop(0, rgba(T.fog, 0)); gr.addColorStop(1, rgba(T.fog, .45));
    g.fillStyle = gr; g.fillRect(0, hz - h * .2, w, h * .2);
    // 중간 실루엣: 성 · 묘비 · 부서진 기둥
    const tower = (x, base, tw, th, roof) => {
      g.fillStyle = T.mid;
      g.fillRect(x, base - th, tw, th);
      if (roof) { g.beginPath(); g.moveTo(x - tw * .15, base - th); g.lineTo(x + tw / 2, base - th - tw * 1.6); g.lineTo(x + tw * 1.15, base - th); g.fill(); }
      else for (let k = 0; k < tw; k += tw / 4) g.fillRect(x + k, base - th - tw * .18, tw / 8, tw * .18);
      for (let k = 0; k < 3; k++) if (r() < .55) {
        g.fillStyle = T.light;
        g.globalAlpha = .55 + r() * .45;
        g.fillRect(x + tw * (.3 + r() * .3), base - th * (.25 + r() * .6), Math.max(1.5, tw * .12), Math.max(2.5, tw * .2));
        g.globalAlpha = 1;
      }
    };
    if (T.feature === 'citadel' || opt.castle) {
      const cx = opt.castleX ?? w * .3, base = hz, s = h / 720;
      tower(cx - 160 * s, base, 40 * s, 120 * s, false);
      tower(cx - 110 * s, base, 30 * s, 190 * s, true);
      g.fillStyle = T.mid; g.fillRect(cx - 120 * s, base - 90 * s, 260 * s, 90 * s);
      tower(cx - 30 * s, base, 60 * s, 250 * s, true);
      tower(cx + 50 * s, base, 34 * s, 170 * s, true);
      tower(cx + 110 * s, base, 44 * s, 110 * s, false);
      for (let i = 0; i < 6; i++) tower(r() * w, base, (14 + r() * 18) * s, (40 + r() * 90) * s, r() < .6);
    } else if (T.feature === 'grave') {
      for (let i = 0; i < 4; i++) tower(r() * w, hz, (16 + r() * 22) * h / 720, (50 + r() * 110) * h / 720, r() < .5);
      g.fillStyle = T.mid;
      for (let i = 0; i < 26; i++) {
        const x = r() * w, gw = (8 + r() * 10) * h / 720, gh = (14 + r() * 18) * h / 720;
        g.beginPath(); g.moveTo(x, hz); g.lineTo(x, hz - gh); g.arc(x + gw / 2, hz - gh, gw / 2, Math.PI, 0); g.lineTo(x + gw, hz); g.fill();
        if (r() < .3) { g.fillRect(x + gw / 2 - 1, hz - gh - gw * 1.6, 2.5, gw * 1.2); g.fillRect(x + gw * .1, hz - gh - gw, gw * .8, 2.5); }
      }
      // 마른 나무
      g.strokeStyle = T.mid; g.lineCap = 'round';
      const branch = (x, y, len, a, d) => {
        if (d > 5 || len < 3) return;
        const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len;
        g.lineWidth = Math.max(1, 7 - d * 1.3) * h / 720;
        g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
        branch(x2, y2, len * .72, a - .35 - r() * .3, d + 1);
        branch(x2, y2, len * .7, a + .3 + r() * .3, d + 1);
      };
      branch(w * .08, hz + 2, 70 * h / 720, -Math.PI / 2 - .1, 0);
      branch(w * .9, hz + 2, 60 * h / 720, -Math.PI / 2 + .15, 0);
    } else {
      for (let i = 0; i < 7; i++) {
        const x = r() * w, pw = (14 + r() * 16) * h / 720, ph = (40 + r() * 120) * h / 720;
        g.fillStyle = T.mid;
        g.beginPath(); g.moveTo(x, hz); g.lineTo(x, hz - ph); g.lineTo(x + pw * .4, hz - ph - pw * .5); g.lineTo(x + pw, hz - ph + pw * .3); g.lineTo(x + pw, hz); g.fill();
      }
      for (let i = 0; i < 10; i++) {
        g.fillStyle = T.far;
        const x = r() * w, y = hz * (.25 + r() * .5), s = (6 + r() * 16) * h / 720;
        g.beginPath(); g.moveTo(x - s, y); g.lineTo(x - s * .3, y - s * .7); g.lineTo(x + s, y - s * .2); g.lineTo(x + s * .4, y + s * .6); g.closePath(); g.fill();
      }
    }
    // 안개 2
    g.save(); g.filter = 'blur(12px)';
    for (let i = 0; i < 6; i++) {
      g.fillStyle = rgba(T.fog, .18 + r() * .12);
      g.beginPath(); g.ellipse(r() * w, hz - 6 + r() * 14, w * (.15 + r() * .2), 12 + r() * 10, 0, 0, Math.PI * 2); g.fill();
    }
    g.restore();
    // 땅: 돌바닥
    gr = g.createLinearGradient(0, hz, 0, h);
    gr.addColorStop(0, T.ground[0]); gr.addColorStop(1, T.ground[1]);
    g.fillStyle = gr; g.fillRect(0, hz, w, h - hz);
    if (opt.floor !== false && h - hz > 40) {
      g.strokeStyle = 'rgba(255,230,190,0.05)'; g.lineWidth = 1;
      for (let i = 1; i < 7; i++) {
        const y = hz + Math.pow(i / 7, 1.7) * (h - hz);
        g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
      }
      for (let i = -12; i <= 12; i++) {
        g.beginPath(); g.moveTo(w / 2 + i * w * .04, hz); g.lineTo(w / 2 + i * w * .16, h); g.stroke();
      }
      gr = g.createLinearGradient(0, hz, 0, hz + 30);
      gr.addColorStop(0, rgba(T.fog, .5)); gr.addColorStop(1, rgba(T.fog, 0));
      g.fillStyle = gr; g.fillRect(0, hz, w, 30);
    }
    // 가까운 실루엣 (화면 가장자리 바위)
    g.fillStyle = T.near;
    g.beginPath(); g.moveTo(0, h); g.lineTo(0, h * .82); g.lineTo(w * .05, h * .86); g.lineTo(w * .09, h * .93); g.lineTo(w * .14, h); g.fill();
    g.beginPath(); g.moveTo(w, h); g.lineTo(w, h * .8); g.lineTo(w * .95, h * .87); g.lineTo(w * .9, h); g.fill();
    // 가장자리 어둡게
    gr = g.createRadialGradient(w / 2, h * .45, Math.min(w, h) * .3, w / 2, h / 2, Math.max(w, h) * .75);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.82)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
}

/** 화면 가장자리를 어둡게 (배경 위에 덧씌울 때) */
let vignetteCache = null;
function drawVignette(g, x = 0, y = 0, w = W, h = H) {
  if (!vignetteCache) {
    vignetteCache = makeCanvas(320, 180, 1, c => {
      const gr = c.createRadialGradient(160, 90, 50, 160, 90, 200);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.78)');
      c.fillStyle = gr; c.fillRect(0, 0, 320, 180);
    });
  }
  const s = g.imageSmoothingEnabled;
  g.imageSmoothingEnabled = true;
  g.drawImage(vignetteCache, x, y, w, h);
  g.imageSmoothingEnabled = s;
}

/* ---------- 움직이는 분위기 재료 (한 번만 만들어 두고 흘려보내기만 해서 가벼움) ---------- */
const texCache = new Map();

/** 옆으로 이어 붙여도 끊기지 않는 안개 띠 */
function fogTexture(w, h, color, seed, density = 1) {
  const key = `fog|${w}|${h}|${color}|${seed}|${density}`;
  if (texCache.has(key)) return texCache.get(key);
  const c = makeCanvas(w, h, 1, g => {
    const r = rng(seed);
    g.filter = 'blur(16px)';
    for (let i = 0; i < 26 * density; i++) {
      const x = r() * w, y = h * (.2 + r() * .6), rx = 60 + r() * 170, ry = 10 + r() * 28;
      g.fillStyle = rgba(color, .12 + r() * .22);
      for (const ox of [-w, 0, w]) { g.beginPath(); g.ellipse(x + ox, y, rx, ry, 0, 0, Math.PI * 2); g.fill(); }
    }
  });
  texCache.set(key, c);
  return c;
}
/** 텍스처를 가로로 흘려보내며 그린다 (끝이 이어지게 두 번) */
function drawScroll(ctx, img, x, y, w, h, offset, alpha) {
  const o = ((offset % w) + w) % w;
  const sm = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = true;
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, x - o, y, w, h);
  ctx.drawImage(img, x - o + w, y, w, h);
  ctx.globalAlpha = 1;
  ctx.imageSmoothingEnabled = sm;
}

/** 리듬 줄 뒤에서 흐르는 금빛 룬 문자 */
function runeTexture(w, h) {
  const key = `rune|${w}|${h}`;
  if (texCache.has(key)) return texCache.get(key);
  const c = makeCanvas(w, h, 1, g => {
    const r = rng(42);
    g.strokeStyle = P.goldLight; g.lineWidth = 1.6; g.lineCap = 'round';
    const cols = 4, cw = w / cols;
    for (let col = 0; col < cols; col++) {
      for (let y = 18; y < h; y += 44) {
        const cx = col * cw + cw / 2 + (r() - .5) * 20, cy = y + (r() - .5) * 10;
        g.beginPath();
        g.moveTo(cx, cy - 10); g.lineTo(cx, cy + 10);
        for (let k = 0; k < 3; k++) {
          const yy = cy - 10 + r() * 20, d = r() < .5 ? -1 : 1;
          g.moveTo(cx, yy); g.lineTo(cx + d * (4 + r() * 5), yy + (r() - .5) * 10);
        }
        if (r() < .4) { g.moveTo(cx - 5, cy + 10); g.lineTo(cx + 5, cy + 10); }
        g.stroke();
      }
    }
  });
  texCache.set(key, c);
  return c;
}

/** 영화 같은 필름 질감 (아주 옅은 잡티) */
let grainCanvas = null;
const grainPatterns = new WeakMap();
function drawGrain(ctx, a) {
  if (!grainCanvas) {
    grainCanvas = makeCanvas(160, 160, 1, g => {
      const img = g.createImageData(160, 160), d = img.data;
      for (let i = 0; i < d.length; i += 4) { const v = Math.random() * 255; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
      g.putImageData(img, 0, 0);
    });
  }
  let pat = grainPatterns.get(ctx);
  if (!pat) { pat = ctx.createPattern(grainCanvas, 'repeat'); grainPatterns.set(ctx, pat); }
  ctx.save();
  ctx.globalAlpha = a;
  ctx.globalCompositeOperation = 'overlay';
  ctx.translate(-Math.random() * 160, -Math.random() * 160);
  ctx.fillStyle = pat;
  ctx.fillRect(0, 0, W + 160, H + 160);
  ctx.restore();
}

/** 금테를 따라 빛 한 줄기가 스쳐 지나감 (phase 가 0→1 로 흐를 때 한 번) */
function shine(ctx, x, y, w, phase) {
  const p = (((phase % 1) + 1) % 1) * 1.8 - .4;
  if (p < 0 || p > 1) return;
  const cx = x + p * w;
  const g = ctx.createLinearGradient(cx - 90, 0, cx + 90, 0);
  g.addColorStop(0, 'rgba(255,236,190,0)'); g.addColorStop(.5, 'rgba(255,244,214,0.95)'); g.addColorStop(1, 'rgba(255,236,190,0)');
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = g;
  ctx.fillRect(cx - 90, y - 1, 180, 2.5);
  ctx.restore();
  glow(ctx, P.goldLight, cx, y, 26, 8, .7);
}

/** 화로 받침 (움직이지 않는 부분, 미리 그린 그림에 넣음) */
function brazierBase(g, x, y, s) {
  g.fillStyle = '#000';
  g.fillRect(x - 3 * s, y, 6 * s, 30 * s);
  g.beginPath(); g.moveTo(x - 16 * s, y + 30 * s); g.lineTo(x + 16 * s, y + 30 * s); g.lineTo(x + 10 * s, y + 24 * s); g.lineTo(x - 10 * s, y + 24 * s); g.fill();
  const gr = g.createLinearGradient(0, y - 14 * s, 0, y);
  gr.addColorStop(0, '#5a4630'); gr.addColorStop(1, '#16110c');
  g.fillStyle = gr;
  g.beginPath(); g.moveTo(x - 22 * s, y - 14 * s); g.lineTo(x + 22 * s, y - 14 * s); g.lineTo(x + 14 * s, y + 2 * s); g.lineTo(x - 14 * s, y + 2 * s); g.closePath(); g.fill();
  g.strokeStyle = P.goldDark; g.lineWidth = 1.5; g.stroke();
  g.fillStyle = '#ffb060'; g.fillRect(x - 20 * s, y - 15 * s, 40 * s, 2 * s);
}
/** 화로 불꽃 (매 프레임 일렁임) */
function brazierFire(ctx, x, y, s, t) {
  glow(ctx, P.ember, x, y - 20 * s, 120 * s, 90 * s, .32 + .08 * Math.sin(t * 13) + .05 * Math.sin(t * 29));
  const flame = (w, h, sway, col) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(x - w, y - 14 * s);
    ctx.quadraticCurveTo(x - w * 1.1, y - 14 * s - h * .55, x + sway, y - 14 * s - h);
    ctx.quadraticCurveTo(x + w * 1.1, y - 14 * s - h * .55, x + w, y - 14 * s);
    ctx.closePath(); ctx.fill();
  };
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  flame(16 * s, (34 + 6 * Math.sin(t * 11)) * s, 5 * s * Math.sin(t * 7), 'rgba(200,60,20,0.75)');
  flame(11 * s, (26 + 5 * Math.sin(t * 17 + 1)) * s, 4 * s * Math.sin(t * 9 + 2), 'rgba(255,140,40,0.8)');
  flame(6 * s, (16 + 4 * Math.sin(t * 23 + 2)) * s, 3 * s * Math.sin(t * 13 + 1), 'rgba(255,230,150,0.9)');
  ctx.restore();
}
