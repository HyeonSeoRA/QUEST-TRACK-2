'use strict';
// 저장과 난수

const KEY = 'rng-fate-v1';
const fresh = () => ({
  rolls: 0, coins: 0, coinsEarned: 0, found: {}, equipped: 'dust', best: null,
  clover: 0, hourglass: 0, potions: [], potionsUsed: 0, log: [],
  sound: true, fast: false,
  pity: 0, pityUsed: 0, ach: {}, eventRolls: 0, eventsSeen: 0, streak: { id: null, n: 0 }, playMs: 0,
  auto: { stopTier: 4, stopNew: false, shortKnown: true, limit: 0, autoBuy: '' },
});
let S = load();
function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d) return Object.assign(fresh(), d, { auto: Object.assign(fresh().auto, d.auto) });
  } catch (e) {}
  return fresh();
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
setInterval(() => { if (!document.hidden) S.playMs += 1000; }, 1000);
setInterval(save, 10000);

const upCost = u => Math.round(u.base * Math.pow(u.grow, S[u.id]));

// Math.random 은 1/9,000조 보다 작은 확률을 못 다뤄서, 아주 작은 확률은 여러 번 나눠서 굴린다
function rand() {
  const a = new Uint32Array(2);
  crypto.getRandomValues(a);
  return (a[0] * 2 ** 21 + (a[1] >>> 11)) / 2 ** 53;
}
function chance(p) {
  if (p >= 1) return true;
  if (p < 1e-6) return rand() < 1e-6 && chance(p * 1e6);
  return rand() < p;
}
