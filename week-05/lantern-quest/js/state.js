'use strict';
// 여정 상태 — 동료, 장비 만들기, 지도 만들기, 저장

const SAVE_KEY = 'lantern-run-v1', RECORD_KEY = 'lantern-record-v1';
let Run = null;
let uidSeq = 1;
const newUid = () => Date.now().toString(36) + (uidSeq++);

// ---------- 동료 ----------
function makeHero(cls) {
  const h = { cls, name: CLASSES[cls].hero, lvl: 1, xp: 0, hp: 1, mp: 1, equip: { weapon: null, armor: null, acc: null }, perm: {} };
  const k = CLASSES[cls];
  h.equip.weapon = genEquip(0, 0, k.weapon);
  const s = heroStats(h);
  h.hp = s.hp; h.mp = s.mp;
  return h;
}

function heroStats(h) {
  const c = CLASSES[h.cls], L = h.lvl - 1, s = {};
  for (const k in c.base) s[k] = c.base[k] + c.grow[k] * L;
  s.eva = 3;
  s.fx = {};
  for (const slot of ['weapon', 'armor', 'acc']) {
    const e = h.equip[slot];
    if (!e) continue;
    for (const k in e.stats) s[k] = (s[k] || 0) + e.stats[k];
    if (e.fx) s.fx[e.fx] = 1;
  }
  for (const k in h.perm) s[k] = (s[k] || 0) + h.perm[k];
  for (const k of ['hp', 'mp', 'atk', 'mag', 'def', 'res', 'spd', 'crit', 'eva']) s[k] = Math.max(k === 'hp' ? 1 : 0, Math.round(s[k] || 0));
  return s;
}

function heroSkills(h) {
  return CLASSES[h.cls].skills.filter(([l]) => h.lvl >= l).map(([, id]) => id);
}

// 경험치를 더하고, 오른 레벨 목록과 새로 배운 기술을 돌려준다
function gainXp(h, n) {
  const ups = [];
  if (h.hp <= 0 || h.lvl >= MAX_LVL) return ups;
  h.xp += n;
  while (h.lvl < MAX_LVL && h.xp >= xpNeed(h.lvl)) {
    h.xp -= xpNeed(h.lvl);
    const before = heroStats(h);
    h.lvl++;
    const after = heroStats(h);
    h.hp = Math.min(after.hp, h.hp + (after.hp - before.hp) + Math.round(after.hp * 0.25));
    h.mp = Math.min(after.mp, h.mp + (after.mp - before.mp) + Math.round(after.mp * 0.25));
    const learned = CLASSES[h.cls].skills.filter(([l]) => l === h.lvl).map(([, id]) => SKILLS[id].name);
    ups.push({ lvl: h.lvl, learned });
  }
  if (h.lvl >= MAX_LVL) h.xp = 0;
  return ups;
}

// ---------- 장비 ----------
function genEquip(T, rarity, kind) {
  const K = EQUIP_KIND[kind], R = RARITY[rarity];
  const stats = {};
  const base = K.base(T);
  for (const k in base) stats[k] = Math.round(base[k] * R.mult);
  if (kind === 'heavy') stats.spd = (stats.spd || 0) - 1;
  const pool = shuffle(Object.keys(STAT_NAME).filter(k => !(k in base)));
  const af = AFFIX(T);
  for (let i = 0; i < R.affix; i++) { const k = pool[i]; stats[k] = (stats[k] || 0) + Math.round(af[k] * rnd(0.8, 1.2)); }
  let fx = null, name = K.names[T];
  if (rarity === 3) {
    const opts = Object.keys(SPECIAL_FX).filter(k => !((k === 'fireEdge' || k === 'holyEdge') && K.slot !== 'weapon'));
    fx = pick(opts);
    name = SPECIAL_FX[fx].pre + ' ' + name;
  }
  return { uid: newUid(), kind, slot: K.slot, icon: K.icon, cls: K.cls || null, name, rarity, tier: T, stats, fx, value: Math.round((12 + T * 34) * (1 + rarity * 0.9)) };
}
function rollRarity(T, luck = 0) {
  const r = Math.random() - luck;
  if (r < 0.04 + T * 0.02) return 3;
  if (r < 0.2 + T * 0.04) return 2;
  if (r < 0.55) return 1;
  return 0;
}
// 지금 동료가 쓸 수 있는 장비를 무작위로 하나
function randomEquip(T, rarity = rollRarity(T)) {
  const kinds = Object.keys(EQUIP_KIND).filter(k => {
    const K = EQUIP_KIND[k];
    return K.slot !== 'weapon' || (Run && Run.party.some(h => h.cls === K.cls));
  });
  return genEquip(T, rarity, pick(kinds));
}
function canEquip(h, e) { return !e.cls || e.cls === h.cls; }
function equipLine(e) {
  const parts = Object.entries(e.stats).filter(([, v]) => v).map(([k, v]) => `${STAT_NAME[k]} ${v > 0 ? '+' : ''}${v}`);
  if (e.fx) parts.push(SPECIAL_FX[e.fx].desc);
  return parts.join(' · ');
}

// ---------- 지도 ----------
// 왼쪽에서 오른쪽으로 7층, 마지막은 우두머리. 층마다 2~4칸, 이웃한 칸끼리 길로 잇는다.
function genMap(regionIdx) {
  const LAYERS = 7, nodes = [], layers = [];
  for (let l = 0; l < LAYERS; l++) {
    const n = l === 0 ? 2 + ri(0, 1) : l === LAYERS - 1 ? 2 : ri(2, 4);
    const row = [];
    for (let i = 0; i < n; i++) {
      const id = nodes.length;
      const y = n === 1 ? 118 : 56 + (i * 128) / (n - 1) + rnd(-7, 7);
      const node = { id, l, i, x: 40 + l * 54 + rnd(-6, 6), y: Math.round(y), type: 'battle', next: [] };
      nodes.push(node); row.push(node);
    }
    layers.push(row);
  }
  const boss = { id: nodes.length, l: LAYERS, i: 0, x: 440, y: 118, type: 'boss', next: [] };
  nodes.push(boss); layers.push([boss]);
  // 길 잇기
  for (let l = 0; l < LAYERS; l++) {
    const A = layers[l], B = layers[l + 1];
    A.forEach((a, i) => {
      const pos = A.length === 1 ? 0.5 : i / (A.length - 1);
      const j = Math.round(pos * (B.length - 1));
      a.next.push(B[j].id);
      if (chance(0.45)) { const j2 = clamp(j + (chance(0.5) ? 1 : -1), 0, B.length - 1); if (!a.next.includes(B[j2].id)) a.next.push(B[j2].id); }
    });
    B.forEach((b, j) => {
      if (!A.some(a => a.next.includes(b.id))) {
        const pos = B.length === 1 ? 0.5 : j / (B.length - 1);
        A[Math.round(pos * (A.length - 1))].next.push(b.id);
      }
    });
  }
  // 칸 종류 정하기
  for (let l = 1; l < LAYERS - 1; l++) {
    for (const nd of layers[l]) {
      nd.type = weighted([
        { t: 'battle', w: 46 },
        { t: 'event', w: 20 },
        { t: 'shop', w: l >= 1 ? 9 : 0 },
        { t: 'treasure', w: 7 },
        { t: 'elite', w: l >= 2 ? 12 : 0 },
        { t: 'rest', w: l >= 3 ? 8 : 0 },
      ]).t;
    }
  }
  layers[LAYERS - 1].forEach((nd, k) => { nd.type = k === 0 ? 'rest' : 'shop'; });
  if (!nodes.some(n => n.type === 'shop' && n.l < LAYERS - 1)) pick(layers[ri(2, 4)]).type = 'shop';
  if (!nodes.some(n => n.type === 'elite')) pick(layers[ri(3, 5)]).type = 'elite';
  return { region: regionIdx, nodes };
}

// ---------- 여정 ----------
function newRun(classes, diff = 1) {
  Run = {
    relics: [], diff, lamp: 0,
    party: classes.map(makeHero), gold: 60, items: { hp: 3, mp: 1, herb: 1, feather: 1 }, bag: [],
    region: 0, map: null, pos: null, visited: [], blessing: null, known: {}, seen: {},
    stats: { battles: 0, kills: 0, gold: 0, start: Date.now(), turns: 0 }, cleared: false,
  };
  Run.map = genMap(0);
  saveRun();
}
function saveRun() { try { if (Run) localStorage.setItem(SAVE_KEY, JSON.stringify(Run)); } catch (e) {} }
function loadRun() {
  try { const d = JSON.parse(localStorage.getItem(SAVE_KEY)); if (d && d.party) { Run = d; Run.relics = Run.relics || []; if (Run.diff == null) Run.diff = 1; Run.lamp = Run.lamp || 0; return true; } } catch (e) {}
  return false;
}
function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } }
function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} }
function getRecord() {
  try { return Object.assign({ runs: 0, wins: 0, best: 0, kills: 0 }, JSON.parse(localStorage.getItem(RECORD_KEY)) || {}); } catch (e) { return { runs: 0, wins: 0, best: 0, kills: 0 }; }
}
function saveRecord(win) {
  const r = getRecord();
  r.runs++; if (win) r.wins++;
  r.best = Math.max(r.best, Run.region + (win ? 1 : 0));
  r.kills += Run.stats.kills;
  try { localStorage.setItem(RECORD_KEY, JSON.stringify(r)); } catch (e) {}
}
const region = () => REGIONS[Run.region];
const aliveHeroes = () => Run.party.filter(h => h.hp > 0);
function addItem(id, n = 1) { Run.items[id] = (Run.items[id] || 0) + n; }
