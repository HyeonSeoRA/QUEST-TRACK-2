'use strict';
// 공용 도구 — 화면 크기, 난수, 색, 설정, 기다리기

const W = 480, H = 270;
const $ = (s, el = document) => el.querySelector(s);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a, b) => a + Math.random() * (b - a);
const ri = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const chance = p => Math.random() < p;
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function weighted(list, wf = x => x.w) {
  let t = 0;
  for (const x of list) t += Math.max(0, wf(x));
  let r = Math.random() * t;
  for (const x of list) { r -= Math.max(0, wf(x)); if (r <= 0) return x; }
  return list[list.length - 1];
}
const fmt = n => Math.round(n).toLocaleString('ko-KR');
const ease = {
  out: t => 1 - (1 - t) ** 3,
  in: t => t * t * t,
  inOut: t => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
  back: t => { const c = 1.70158; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; },
  lin: t => t,
};

// ---------- 색 ----------
function hexRgb(h) {
  h = h.replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgbHex(r, g, b) {
  return '#' + [r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
}
const _mixCache = new Map();
function mix(a, b, t) {
  const k = a + b + t;
  let v = _mixCache.get(k);
  if (!v) {
    const A = hexRgb(a), B = hexRgb(b);
    v = rgbHex(lerp(A[0], B[0], t), lerp(A[1], B[1], t), lerp(A[2], B[2], t));
    _mixCache.set(k, v);
  }
  return v;
}
// 그림자 색은 보라빛 검정, 빛 색은 따뜻한 흰색으로 섞어서 팔레트가 한 덩어리처럼 보이게
const dark = (c, t = 0.35) => mix(c, '#140c1c', t);
const light = (c, t = 0.35) => mix(c, '#fff4d6', t);
const ramp = c => [dark(c, 0.45), c, light(c, 0.3), light(c, 0.7)];

// ---------- 설정 ----------
const SETTINGS_KEY = 'lantern-settings-v1';
const Settings = Object.assign(
  { sfx: 0.7, music: 0.4, speed: 1, shake: true, uiK: 1.5 },
  (() => { try { return JSON.parse(localStorage.getItem(SETTINGS_KEY)) || {}; } catch (e) { return {}; } })()
);
function saveSettings() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(Settings)); } catch (e) {} }

// ---------- 시간 ----------
// 전투 속도(1배/2배)를 따르는 기다리기
function wait(ms) { return new Promise(r => setTimeout(r, ms / (Settings.speed || 1))); }
function tween(ms, fn, ez = ease.out) {
  return new Promise(res => {
    const t0 = performance.now(), d = ms / (Settings.speed || 1);
    (function step() {
      const t = Math.min(1, (performance.now() - t0) / d);
      fn(ez(t));
      if (t < 1) requestAnimationFrame(step); else res();
    })();
  });
}
