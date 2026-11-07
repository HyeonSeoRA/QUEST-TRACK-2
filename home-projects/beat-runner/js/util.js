'use strict';
/* 공통 상수와 도우미 함수 */

const GW = 480, GH = 270;           // 게임 화면 크기 (도트 기준 픽셀)
let RES = 3;                        // 실제로 그리는 배율 (main.js 에서 정함)
const PX = 82;                      // 주인공 x
const JX = 124;                     // 판정선 x
const GROUND = 214;                 // 땅 높이
const AIR_FEET = 170;               // 공중에 떴을 때 발 높이
const LANE_Y = [146, 196];          // 0: 공중 줄, 1: 땅 줄
const LANE_C = [0x8fe0ff, 0xffc46a];// 공중 하늘색, 땅 황금색
const LANE_KEYS = [
  ['KeyD', 'KeyF', 'ArrowUp', 'KeyW'],
  ['KeyJ', 'KeyK', 'ArrowDown', 'KeyS'],
];
const OK_KEYS = ['Enter', 'Space', 'KeyZ'];
const BACK_KEYS = ['Escape', 'KeyX', 'Backspace'];

const JUDGE = {
  P: { w: 0.045, name: 'PERFECT', c: 0xffe08a, css: '#ffe08a', base: 300, acc: 1.0, dmg: 1.0, fever: 2.5 },
  G: { w: 0.090, name: 'GREAT',   c: 0x8fe0ff, css: '#8fe0ff', base: 200, acc: 0.7, dmg: 0.8, fever: 1.5 },
  D: { w: 0.135, name: 'GOOD',    c: 0x9dffa0, css: '#9dffa0', base: 100, acc: 0.4, dmg: 0.5, fever: 0.5 },
  M: { name: 'MISS', c: 0x9a92b0, css: '#9a92b0' },
};
const RANK_CSS = { S: '#ffe08a', A: '#ff9ab8', B: '#8fe0ff', C: '#9dffa0', D: '#b8b0d0', F: '#ff6a6a' };
const RANK_ORDER = 'FDCBAS';

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function pick(r, arr) { return arr[Math.floor(r() * arr.length)]; }
function pad(n, len) { return String(Math.max(0, Math.floor(n))).padStart(len, '0'); }
function fmtTime(sec) { sec = Math.round(sec); return Math.floor(sec / 60) + ':' + pad(sec % 60, 2); }
function comma(n) { return Math.floor(n).toLocaleString('en-US'); }
function hueC(h, s = 0.6, v = 1) { return Phaser.Display.Color.HSVToRGB(((h % 1) + 1) % 1, s, v).color; }

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- 저장 (브라우저에만 저장돼요) ---------- */
function newSave() {
  return {
    lv: 1, exp: 0, gold: 0,
    weapon: 'w0', armor: 'a0', acc: null,
    inv: ['w0', 'a0'],
    cleared: {}, best: {}, seen: {},
    node: 0, playTime: 0, ending: false,
    enh: {}, stones: 0,
  };
}
const Store = {
  data: { settings: { speed: 3, offset: 0, vol: 8, gfx: 1 }, save: null },
  load() {
    try {
      const s = JSON.parse(localStorage.getItem('beatrunner.rpg.v1'));
      if (s) { Object.assign(this.data.settings, s.settings || {}); this.data.save = s.save || null; }
      if (this.data.save) { this.data.save.enh = this.data.save.enh || {}; this.data.save.stones = this.data.save.stones || 0; }   // 예전 기록도 강화를 쓸 수 있게
    } catch (e) { /* 저장소를 못 쓰면 기본값으로 */ }
  },
  save() {
    try { localStorage.setItem('beatrunner.rpg.v1', JSON.stringify(this.data)); } catch (e) { /* 무시 */ }
  },
  get s() { return this.data.save; },
};
Store.load();

/* ---------- 키보드: 장면이 끝나면 자동으로 해제 ---------- */
const BLOCK_KEYS = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Backspace'];
function onKeys(scene, down, up) {
  const d = e => { if (BLOCK_KEYS.includes(e.code)) e.preventDefault(); down(e); };
  const u = e => { if (up) up(e); };
  window.addEventListener('keydown', d);
  window.addEventListener('keyup', u);
  scene.events.once('shutdown', () => {
    window.removeEventListener('keydown', d);
    window.removeEventListener('keyup', u);
  });
}

/* ---------- 카메라: 480x270 세상을 RES 배로 확대해서 보여 줘요 ---------- */
function fitCam(scene) { scene._leaving = false; scene.cameras.main.setOrigin(0, 0).setZoom(RES); }

/* ---------- 장면 전환 (페이드) ---------- */
function goScene(scene, key, data, ms = 350) {
  if (scene._leaving) return;
  scene._leaving = true;
  scene.cameras.main.fadeOut(ms, 0, 0, 0);
  scene.cameras.main.once('camerafadeoutcomplete', () => scene.scene.start(key, data));
}
