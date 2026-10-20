'use strict';
/* 스킬 트리 · 스테이지 · 저장 */

/* ---------- 저장 (브라우저에 저장, 안 되면 이번 판만 기억) ---------- */
const Save = (() => {
  const KEY = 'rhythm-fighter-save-v1';
  const def = () => ({ dust: 0, skills: {}, stages: {}, speed: 700, offset: 0, volume: .8, music: 1, last: 0, quality: 'sharp', towerBest: 0, seenHold: false });
  let data = def();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) data = Object.assign(def(), JSON.parse(raw));
  } catch (e) { /* 저장소를 못 쓰는 환경이면 그냥 진행 */ }
  return {
    get d() { return data; },
    write() { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { } },
    reset() {
      const keep = { speed: data.speed, offset: data.offset, volume: data.volume, music: data.music, quality: data.quality };
      data = Object.assign(def(), keep);
      this.write();
    },
    skill(id) { return data.skills[id] || 0; },
    stage(i) { return data.stages[i] || { stars: 0, best: 0, rank: '-' }; },
    setStage(i, v) { data.stages[i] = v; },
  };
})();

/* ---------- 스킬 트리 (별자리) ---------- */
const BR = { ATK: 0, DEF: 1, RHY: 2, LUCK: 3, CORE: 4 };
const BRANCH_NAME = ['공격', '방어', '리듬', '행운', '코어'];
const BRANCH_COLOR = [P.orange, P.sky, P.lime, P.yellow, P.white];

const node = (id, name, branch, max, baseCost, req, reqLv, dx, dy, per, unit, desc) =>
  ({ id, name, branch, max, baseCost, req, reqLv, dx, dy, per, unit, desc });

const SKILLS = [
  node('core', '기사의 맹세', BR.CORE, 1, 0, null, 0, 0, 0, 0, '', '모든 힘의 시작. 처음부터 열려 있어요.'),

  node('atk', '영혼의 검', BR.ATK, 5, 30, 'core', 1, 0, -100, 10, '공격력 +#%', '검기의 위력이 강해져요.'),
  node('crit', '필살 일격', BR.ATK, 4, 60, 'atk', 1, -85, -170, 5, '치명타 확률 +#%', '가끔 두 배 가까운 피해를 줘요.'),
  node('critdmg', '파멸의 일격', BR.ATK, 3, 120, 'crit', 2, -135, -255, 25, '치명타 피해 +#%', '치명타가 더 아프게 들어가요.'),
  node('combo', '연쇄 공명', BR.ATK, 3, 80, 'atk', 2, 85, -170, 25, '콤보 보너스 +#%', '콤보가 쌓일수록 공격력이 더 크게 올라요.'),
  node('execute', '처형자', BR.ATK, 2, 150, 'combo', 1, 135, -255, 30, '빈사 적에게 피해 +#%', '체력 25% 이하의 몬스터를 빠르게 끝내요.'),

  node('hp', '강철 갑옷', BR.DEF, 5, 30, 'core', 1, 115, 0, 15, '최대 체력 +#', '버틸 수 있는 체력이 늘어나요.'),
  node('def', '수호의 방패', BR.DEF, 4, 60, 'hp', 1, 205, -70, 6, '받는 피해 -#%', '몬스터의 공격을 막아 줘요.'),
  node('guard', '콤보 보호막', BR.DEF, 2, 140, 'def', 2, 305, -70, 1, '스테이지마다 #번 콤보 유지', '실수해도 콤보가 끊기지 않아요.'),
  node('regen', '생명의 샘', BR.DEF, 3, 70, 'hp', 2, 205, 70, 8, '처치할 때 체력 +#', '적을 쓰러뜨릴 때마다 회복해요.'),
  node('revive', '불사조의 가호', BR.DEF, 1, 300, 'regen', 2, 305, 70, 0, '', '쓰러져도 한 번 체력 40%로 다시 일어나요.'),

  node('judge', '매의 눈', BR.RHY, 3, 50, 'core', 1, -115, 0, 6, '판정 범위 +#ms', '조금 어긋나도 맞은 것으로 쳐 줘요.'),
  node('perfect', '완벽주의', BR.RHY, 3, 70, 'judge', 1, -205, -70, 15, 'PERFECT 피해 +#%', '정확히 맞출수록 더 강해져요.'),
  node('vamp', '흡혈 리듬', BR.RHY, 3, 110, 'perfect', 1, -305, -70, .5, 'PERFECT 마다 체력 +#', '완벽한 박자로 생명을 훔쳐요.'),
  node('drive', '각성', BR.RHY, 1, 120, 'judge', 1, -205, 70, 0, '', '게이지가 차면 SPACE: 잠깐 동안 피해 2배!'),
  node('fever', '광전사의 혼', BR.RHY, 3, 90, 'drive', 1, -305, 70, 25, '각성 충전 +#%', '각성을 더 자주 써요.'),

  node('dust', '영혼 수집가', BR.LUCK, 5, 40, 'core', 1, 0, 100, 15, '영혼석 보상 +#%', '스테이지 보상이 늘어나요.'),
  node('bounty', '현상금 사냥꾼', BR.LUCK, 2, 120, 'dust', 2, -85, 170, 50, '보스 보상 +#%', '보스 스테이지를 깨면 더 많이 받아요.'),
  node('start', '선제 공격', BR.LUCK, 3, 80, 'dust', 1, 85, 170, 10, '시작 콤보 +#', '콤보를 쌓은 채로 싸움을 시작해요.'),
];
const skillById = id => SKILLS.find(n => n.id === id);
const skillLevel = n => n.branch === BR.CORE ? 1 : Save.skill(n.id);
const skillOpen = n => !n.req || skillLevel(skillById(n.req)) >= n.reqLv;
const skillCost = (n, lv) => Math.round(n.baseCost * Math.pow(1.7, lv) / 5) * 5;
function skillEffect(n, lv) {
  if (!n.unit) return lv > 0 ? '사용 가능' : '아직 없음';
  const v = n.per * lv;
  return n.unit.replace('#', Number.isInteger(v) ? v : v.toFixed(1));
}
function skillSpent() {
  let sum = 0;
  for (const n of SKILLS) if (n.branch !== BR.CORE) for (let i = 0; i < Save.skill(n.id); i++) sum += skillCost(n, i);
  return sum;
}
/** 전투 능력치 */
function stats() {
  const s = id => Save.skill(id);
  return {
    atkMul: 1 + .10 * s('atk'),
    critChance: .03 + .05 * s('crit'),
    critMul: 1.75 + .25 * s('critdmg'),
    comboBonus: .005 * (1 + .25 * s('combo')),
    execute: .30 * s('execute'),
    maxHp: 100 + 15 * s('hp'),
    def: .06 * s('def'),
    guard: s('guard'),
    regen: 8 * s('regen'),
    revive: s('revive'),
    window: .006 * s('judge'),
    perfectMul: 1 + .15 * s('perfect'),
    vamp: .5 * s('vamp'),
    drive: s('drive') > 0,
    feverMul: 1 + .25 * s('fever'),
    dustMul: 1 + .15 * s('dust'),
    bountyMul: 1 + .5 * s('bounty'),
    startCombo: 10 * s('start'),
  };
}

/* ---------- 스테이지 12개 (구역 3 x 4, 구역 끝마다 보스) ---------- */
const SECTOR = ['버려진 묘지', '핏빛 성채', '심연의 균열'];
const SECTOR_EN = ['CURSED GRAVEYARD', 'CRIMSON CITADEL', 'ABYSSAL RIFT'];
const SECTOR_HUE = [.62, .93, .76];

const wv = (kind, hue) => ({ kind, hue });
const STAGES = [
  ['묘지의 첫 울림', 100, 0, 0, .4, 110, 470, [wv('slime', .5), wv('slime', .4)]],
  ['굶주린 날개', 104, 0, 1, .9, 200, 360, [wv('slime', .55), wv('bat', .76)]],
  ['검은 호수', 108, 3, 1, 1.4, 160, 240, [wv('bat', .7), wv('squid', .88), wv('slime', .33)]],
  ['세 눈의 왕좌', 112, 1, 1, 1.9, 280, 160, [wv('squid', .58), wv('lord', .8)]],
  ['무너진 성벽', 118, 2, 1, 2.2, 420, 210, [wv('golem', .07), wv('bat', .97)]],
  ['망령의 회랑', 122, 0, 2, 2.6, 400, 340, [wv('wraith', .6), wv('golem', .12)]],
  ['감시탑', 126, 3, 2, 3.0, 500, 450, [wv('drone', .33), wv('wraith', .92), wv('golem', .03)]],
  ['아귀의 연회', 130, 1, 2, 3.4, 600, 360, [wv('drone', .98), wv('wraith', .85), wv('maw', .98)]],
  ['균열의 입구', 136, 2, 2, 3.7, 640, 230, [wv('drone', .68), wv('squid', .75), wv('wraith', .52)]],
  ['뒤틀린 대지', 142, 0, 3, 4.1, 740, 150, [wv('golem', .8), wv('bat', .45), wv('drone', .88)]],
  ['어둠의 군단', 148, 3, 3, 4.6, 790, 290, [wv('wraith', .72), wv('slime', .8), wv('squid', .95), wv('golem', .66)]],
  ['최후의 균열', 156, 1, 3, 5.1, 730, 440, [wv('lord', .95), wv('titan', .52)]],
].map(([name, bpm, prog, intensity, level, mapX, mapY, waves], index) => ({
  index, name, bpm, prog, intensity, level, mapX, mapY, waves,
  seedBase: index * 131,
  sector: Math.floor(index / 4),
  boss: !!KINDS[waves[waves.length - 1].kind].boss,
  code: `${Math.floor(index / 4) + 1}-${index % 4 + 1}`,
  reward: 50 + index * 30,
  difficulty: Math.min(5, 1 + Math.round(level * .8)),
  monsterHp(w) {
    const base = 240 * Math.pow(1.2, index) * (1 + w * .12);
    return Math.round(base * (KINDS[waves[w].kind].boss ? 2.6 : 1));
  },
  monsterAtk(w) {
    const a = 7 + index * 1.6;
    return KINDS[waves[w].kind].boss ? a * 1.5 : a;
  },
}));
const stageUnlocked = i => i === TOWER ? Save.stage(3).stars > 0 : i === 0 || Save.stage(i - 1).stars > 0;

/* ---------- 심연의 탑: 끝없이 올라가는 도전 (1장 보스를 깨면 열림) ---------- */
const TOWER = STAGES.length;          // 원정 지도에서 탑을 고를 때 쓰는 번호
const TOWER_NORMAL = ['slime', 'bat', 'squid', 'golem', 'wraith', 'drone'];
const TOWER_BOSS = ['lord', 'maw', 'titan'];

/** floor 층의 스테이지. 5층마다 보스, 위로 갈수록 빠르고 단단해진다 */
function towerStage(floor) {
  const r = rng(floor * 7717 + 3);
  const boss = floor % 5 === 0;
  const n = boss ? 2 : 3;
  const waves = [];
  for (let i = 0; i < n; i++) {
    const last = boss && i === n - 1;
    waves.push(wv(last ? TOWER_BOSS[(floor / 5 - 1) % 3] : TOWER_NORMAL[Math.floor(r() * 6)], Math.round(r() * 100) / 100));
  }
  const power = Math.min(18, 2 + floor);          // 몬스터 세기 (스테이지 번호처럼 씀)
  const level = Math.min(6, 1.2 + floor * .3);
  return {
    tower: true, floor, index: power, name: `심연의 탑 ${floor}층`, waves, boss,
    bpm: Math.min(168, 112 + floor * 3), prog: floor % 4, intensity: Math.min(3, 1 + Math.floor(floor / 3)), level,
    seedBase: 5000 + floor * 131, sector: 2, code: `탑 ${floor}층`,
    reward: 30 + floor * 22, difficulty: Math.min(5, 1 + Math.round(level * .8)),
    monsterHp(w) {
      const base = 240 * Math.pow(1.2, power) * (1 + w * .12);
      return Math.round(base * (KINDS[waves[w].kind].boss ? 2.6 : 1));
    },
    monsterAtk(w) {
      const a = 7 + power * 1.6;
      return KINDS[waves[w].kind].boss ? a * 1.5 : a;
    },
  };
}
