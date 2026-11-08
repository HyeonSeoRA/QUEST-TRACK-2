'use strict';
// 데이터와 공용 도구 — 오라 목록, 상점, 숫자 표시

const $ = s => document.querySelector(s);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const DEMO = new URLSearchParams(location.search).has('demo'); // ?demo 를 붙이면 도감에서 모든 연출을 미리 볼 수 있음

// ---------- 오라 목록 (odds = 몇 분의 1) ----------
const AURAS = [
  { id: 'dust',       name: '먼지',     en: 'Dust',         odds: 2,    tier: 0, c: ['#8b949e', '#c9d1d9'], desc: '어디에나 있다. 정말 어디에나.' },
  { id: 'dew',        name: '이슬',     en: 'Dew',          odds: 4,    tier: 0, c: ['#5fb8e0', '#d5f1ff'], desc: '새벽에 맺힌 작은 물방울.' },
  { id: 'breeze',     name: '산들바람', en: 'Breeze',       odds: 8,    tier: 0, c: ['#6fd69a', '#e6fff0'], desc: '스쳐 지나가는 바람.' },
  { id: 'ember',      name: '불씨',     en: 'Ember',        odds: 16,   tier: 1, c: ['#ff6a2b', '#ffd27a'], desc: '꺼지지 않는 작은 불.' },
  { id: 'frost',      name: '서리',     en: 'Frost',        odds: 32,   tier: 1, c: ['#7fd6ff', '#ffffff'], desc: '닿는 것마다 하얗게 얼린다.' },
  { id: 'thunder',    name: '번개',     en: 'Thunder',      odds: 64,   tier: 1, c: ['#8ab4ff', '#ffe95c'], desc: '하늘이 갈라지는 소리.' },
  { id: 'jade',       name: '비취',     en: 'Jade',         odds: 128,  tier: 2, c: ['#0fa86c', '#a7ffda'], desc: '천 년 동안 다듬어진 돌.' },
  { id: 'amethyst',   name: '자수정',   en: 'Amethyst',     odds: 256,  tier: 2, c: ['#8a2be2', '#f0c8ff'], desc: '보랏빛으로 빛나는 결정.' },
  { id: 'solar',      name: '태양',     en: 'Solar',        odds: 1e3,  tier: 2, c: ['#ff8c00', '#fff3b0'], desc: '눈을 뜰 수 없을 만큼 밝다.' },
  { id: 'eclipse',    name: '월식',     en: 'Eclipse',      odds: 5e3,  tier: 3, c: ['#3a1f5e', '#ff4d6d'], desc: '달이 해를 삼키는 순간.' },
  { id: 'aurora',     name: '오로라',   en: 'Aurora',       odds: 25e3, tier: 3, c: ['#8b5cff', '#2affc6', '#ff5ce1'], desc: '북쪽 하늘에 걸린 빛의 커튼.' },
  { id: 'abyss',      name: '심연',     en: 'Abyss',        odds: 1e5,  tier: 3, c: ['#003a66', '#00e5ff'], desc: '들여다보면, 들여다본다.' },
  { id: 'supernova',  name: '초신성',   en: 'Supernova',    odds: 1e6,  tier: 4, c: ['#ff2e63', '#ffffff', '#ff9d00'], desc: '별이 죽으며 남긴 마지막 빛.' },
  { id: 'nebula',     name: '성운',     en: 'Nebula',       odds: 1e7,  tier: 4, c: ['#5c7cff', '#ff5ce1', '#2affc6'], desc: '별들이 태어나는 요람.' },
  { id: 'blackhole',  name: '블랙홀',   en: 'Black Hole',   odds: 1e8,  tier: 5, c: ['#7a00ff', '#ff8a00', '#ffd9a0'], desc: '빛조차 빠져나갈 수 없다.' },
  { id: 'quasar',     name: '퀘이사',   en: 'Quasar',       odds: 1e9,  tier: 5, c: ['#3d5afe', '#9ffcff', '#ffffff'], desc: '우주에서 가장 밝은 심장.' },
  { id: 'bigbang',    name: '빅뱅',     en: 'Big Bang',     odds: 1e12, tier: 6, c: ['rainbow'], desc: '모든 것이 시작된 한 점.' },
  { id: 'multiverse', name: '다중우주', en: 'Multiverse',   odds: 1e15, tier: 6, c: ['rainbow'], desc: '다른 우주의 내가 손을 흔든다.' },
  { id: 'infinity',   name: '무한',     en: '∞ Infinity',   odds: 1e18, tier: 7, c: ['white'], desc: '끝이 없다는 것을 보았다.' },
  { id: 'genesis',    name: '창세',     en: 'Ω Genesis',    odds: 1e21, tier: 7, c: ['white'], desc: '이 세계를 만든 손.' },
];
const TIER_NAME = ['일반', '고급', '희귀', '에픽', '전설', '신화', '우주', '초월'];
const TIER_EN = ['COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC', 'COSMIC', 'TRANSCENDENT'];
const AURA_BONUS = [0, 0.1, 0.25, 0.5, 1, 2, 4, 8]; // 장착한 오라 등급별 행운 보너스
const byId = id => AURAS.find(a => a.id === id) || AURAS[0];

const SHOP = [
  { id: 'p1', name: '행운 물약',      icon: '🍀', desc: '50번 동안 행운 ×2',            cost: 150,   mult: 2,   rolls: 50 },
  { id: 'p2', name: '강한 행운 물약', icon: '🧪', desc: '50번 동안 행운 ×5',            cost: 1500,  mult: 5,   rolls: 50 },
  { id: 'p3', name: '별빛 물약',      icon: '✨', desc: '30번 동안 행운 ×25',           cost: 25e3,  mult: 25,  rolls: 30 },
  { id: 'p4', name: '신의 물약',      icon: '👁️', desc: '다음 1번만 행운 ×1,000',       cost: 25e4,  mult: 1e3, rolls: 1 },
  { id: 'p5', name: '우주의 물약',    icon: '🌌', desc: '다음 1번만 행운 ×1,000,000',   cost: 5e7,   mult: 1e6, rolls: 1 },
];
const UPGRADES = [
  { id: 'clover',    name: '네잎클로버', icon: '☘️', desc: '영원히 행운 +0.5',     base: 300, grow: 1.8, max: 40 },
  { id: 'hourglass', name: '모래시계',   icon: '⏳', desc: '자동 굴리기가 빨라짐', base: 500, grow: 2.2, max: 6 },
];

// ---------- 숫자 표시 ----------
const fmt = n => n.toLocaleString('en-US');
function kor(n) {
  for (const [v, u] of [[1e20, '해'], [1e16, '경'], [1e12, '조'], [1e8, '억'], [1e4, '만']]) {
    if (n >= v) return fmt(Math.round(n / v * 10) / 10) + u;
  }
  return fmt(n);
}
const fmtLuck = m => m < 1000 ? String(Math.round(m * 100) / 100) : fmt(Math.round(m));
function fmtTime(ms) {
  const m = Math.floor(ms / 60000), h = Math.floor(m / 60);
  return h ? `${h}시간 ${m % 60}분` : `${m}분`;
}

// ---------- 색 ----------
function mainColor(a) {
  if (a.c[0] === 'rainbow') return '#ff5ce1';
  if (a.c[0] === 'white') return '#ffffff';
  return a.c[1] || a.c[0];
}
function cssPair(a) {
  if (a.c[0] === 'rainbow') return ['#5cc8ff', '#ff5ce1'];
  if (a.c[0] === 'white') return ['#ffd36b', '#ffffff'];
  return [a.c[0], a.c[1] || a.c[0]];
}
function pc(a) { // 파티클 색
  if (a.c[0] === 'rainbow') return `hsl(${Math.random() * 360 | 0},100%,65%)`;
  if (a.c[0] === 'white') return ['#ffffff', '#fff2b8', '#cfeaff', '#ffd6f5'][Math.random() * 4 | 0];
  return a.c[Math.random() * a.c.length | 0];
}
