'use strict';
// 게임 데이터 — 직업, 기술, 몬스터, 지역, 아이템

const EL_NAME = { phys: '물리', fire: '불', ice: '얼음', bolt: '번개', holy: '빛', dark: '어둠', poison: '독' };
const EL_COLOR = { phys: '#f4ecd8', fire: '#ff7a2a', ice: '#7fd8ff', bolt: '#ffe066', holy: '#fff2a8', dark: '#c86aff', poison: '#6ad04a' };
const ST_NAME = {
  poison: '독', burn: '화상', freeze: '빙결', stun: '기절', bleed: '출혈',
  atkUp: '공격↑', atkDown: '공격↓', defUp: '방어↑', defDown: '방어↓', spdUp: '속도↑', spdDown: '속도↓',
  regen: '재생', taunt: '도발', evaUp: '회피↑', guard: '방어 자세', charge: '힘 모으기',
};
const BAD_ST = ['poison', 'burn', 'freeze', 'stun', 'bleed', 'atkDown', 'defDown', 'spdDown'];

// ---------- 직업 ----------
// 기술은 [배우는 레벨, 기술 이름]
const CLASSES = {
  knight: {
    name: '기사', hero: '레온', role: '방패', color: '#5577aa',
    desc: '튼튼한 몸으로 동료를 지킨다. 도발로 적의 공격을 자기에게 모은다.',
    base: { hp: 72, mp: 14, atk: 12, mag: 3, def: 10, res: 5, spd: 6, crit: 5 },
    grow: { hp: 10, mp: 1.6, atk: 2.3, mag: 0.4, def: 2, res: 1, spd: 0.5, crit: 0.2 },
    weapon: 'sword', armor: 'heavy',
    skills: [[1, 'bash'], [1, 'taunt'], [3, 'shieldWall'], [5, 'whirl'], [7, 'unbroken'], [10, 'judgment']],
  },
  mage: {
    name: '마법사', hero: '에르달', role: '마법 공격', color: '#6f5cc4',
    desc: '불, 얼음, 번개 마법으로 적의 약점을 찌른다. 몸이 약하다.',
    base: { hp: 42, mp: 34, atk: 4, mag: 14, def: 4, res: 9, spd: 8, crit: 5 },
    grow: { hp: 5.5, mp: 4, atk: 0.6, mag: 2.7, def: 0.8, res: 1.6, spd: 0.7, crit: 0.2 },
    weapon: 'staff', armor: 'robe',
    skills: [[1, 'fireball'], [1, 'iceLance'], [3, 'chainBolt'], [5, 'focus'], [7, 'meteor'], [10, 'absoluteZero']],
  },
  cleric: {
    name: '성직자', hero: '세라', role: '회복', color: '#d9a92e',
    desc: '동료를 치유하고 쓰러진 동료를 일으킨다. 빛 마법은 망령에게 강하다.',
    base: { hp: 52, mp: 30, atk: 7, mag: 11, def: 7, res: 10, spd: 7, crit: 4 },
    grow: { hp: 7, mp: 3.6, atk: 1.1, mag: 2.1, def: 1.2, res: 1.8, spd: 0.6, crit: 0.1 },
    weapon: 'mace', armor: 'robe',
    skills: [[1, 'heal'], [1, 'smite'], [3, 'purify'], [5, 'revive'], [7, 'sanctuary'], [10, 'blessAll']],
  },
  rogue: {
    name: '도적', hero: '키라', role: '치명타', color: '#a8323e',
    desc: '가장 빠르게 움직이고 급소를 노린다. 적에게서 금화를 훔친다.',
    base: { hp: 48, mp: 18, atk: 11, mag: 4, def: 6, res: 5, spd: 13, crit: 18 },
    grow: { hp: 6.5, mp: 2, atk: 2.2, mag: 0.5, def: 1, res: 0.9, spd: 1.1, crit: 0.6 },
    weapon: 'dagger', armor: 'leather',
    skills: [[1, 'backstab'], [1, 'venom'], [3, 'smokeVeil'], [5, 'steal'], [7, 'flurry'], [10, 'assassinate']],
  },
  ranger: {
    name: '궁수', hero: '린', role: '원거리', color: '#4a7a3a',
    desc: '빗나가지 않는 화살과 화살비로 적 무리를 정리한다.',
    base: { hp: 50, mp: 20, atk: 12, mag: 6, def: 6, res: 6, spd: 11, crit: 10 },
    grow: { hp: 6.5, mp: 2.4, atk: 2.2, mag: 0.9, def: 1, res: 1, spd: 0.9, crit: 0.4 },
    weapon: 'bow', armor: 'leather',
    skills: [[1, 'aimShot'], [1, 'arrowRain'], [3, 'snare'], [5, 'windSong'], [7, 'pierceShot'], [10, 'stormArrows']],
  },
  alchemist: {
    name: '연금술사', hero: '파샤', role: '방해', color: '#6a8a5a',
    desc: '산성과 폭탄으로 적을 약하게 만들고, 물약으로 동료를 돕는다.',
    base: { hp: 54, mp: 26, atk: 8, mag: 10, def: 7, res: 8, spd: 8, crit: 6 },
    grow: { hp: 7, mp: 3, atk: 1.2, mag: 2, def: 1.1, res: 1.3, spd: 0.7, crit: 0.2 },
    weapon: 'flask', armor: 'leather',
    skills: [[1, 'acid'], [1, 'tonic'], [3, 'firebomb'], [5, 'transmute'], [7, 'elixirRain'], [10, 'philosopher']],
  },
};
const MAX_LVL = 15;
const xpNeed = l => Math.round(12 * Math.pow(l, 1.5));

// ---------- 기술 ----------
// tgt: enemy(적 하나) enemies(적 모두) random(무작위 적, hits 번) ally allies self deadAlly
// kind: phys(공격력) mag(마력) heal buff special
const SKILLS = {
  attack: { name: '공격', mp: 0, tgt: 'enemy', kind: 'phys', el: 'phys', pow: 1, fx: 'slash', desc: '무기로 공격한다' },
  // 기사
  bash: { name: '강타', mp: 4, tgt: 'enemy', kind: 'phys', el: 'phys', pow: 1.7, st: [['stun', 0.2, 1]], fx: 'smash', desc: '힘껏 내려친다. 가끔 기절시킨다' },
  taunt: { name: '도발', mp: 3, tgt: 'self', kind: 'buff', self: [['taunt', 2], ['defUp', 2]], fx: 'roar', desc: '2턴 동안 적이 나만 노린다. 방어↑' },
  shieldWall: { name: '방패의 벽', mp: 7, tgt: 'allies', kind: 'buff', st: [['defUp', 1, 3]], fx: 'buff', desc: '모든 동료 방어↑ (3턴)' },
  whirl: { name: '회전 베기', mp: 8, tgt: 'enemies', kind: 'phys', el: 'phys', pow: 0.95, fx: 'slash', desc: '모든 적을 벤다' },
  unbroken: { name: '불굴', mp: 10, tgt: 'self', kind: 'heal', pct: 0.35, self: [['regen', 3]], fx: 'heal', desc: '체력 35% 회복 + 재생' },
  judgment: { name: '심판의 일격', mp: 14, tgt: 'enemy', kind: 'phys', el: 'holy', pow: 3, fx: 'holy', desc: '빛을 실은 큰 일격' },
  // 마법사
  fireball: { name: '화염구', mp: 5, tgt: 'enemy', kind: 'mag', el: 'fire', pow: 1.7, st: [['burn', 0.3, 3]], fx: 'fire', desc: '불 마법. 화상을 입힌다' },
  iceLance: { name: '얼음창', mp: 5, tgt: 'enemy', kind: 'mag', el: 'ice', pow: 1.6, st: [['freeze', 0.25, 1]], fx: 'ice', desc: '얼음 마법. 얼려서 한 턴 멈춘다' },
  chainBolt: { name: '연쇄 번개', mp: 9, tgt: 'enemies', kind: 'mag', el: 'bolt', pow: 1, st: [['stun', 0.1, 1]], fx: 'bolt', desc: '모든 적에게 번개' },
  focus: { name: '마나 집중', mp: 0, tgt: 'self', kind: 'special', fx: 'buff', desc: '마나 30% 회복, 공격↑' },
  meteor: { name: '유성 낙하', mp: 18, tgt: 'enemies', kind: 'mag', el: 'fire', pow: 1.8, st: [['burn', 0.3, 3]], fx: 'meteor', desc: '하늘에서 불덩이를 떨어뜨린다' },
  absoluteZero: { name: '절대 영도', mp: 22, tgt: 'enemies', kind: 'mag', el: 'ice', pow: 1.7, st: [['freeze', 0.35, 1]], fx: 'blizzard', desc: '모든 적을 얼린다' },
  // 성직자
  heal: { name: '치유', mp: 4, tgt: 'ally', kind: 'heal', pow: 2.4, fx: 'heal', desc: '동료 하나의 체력 회복' },
  smite: { name: '성광', mp: 5, tgt: 'enemy', kind: 'mag', el: 'holy', pow: 1.6, fx: 'holy', desc: '빛 마법. 망령에게 강하다' },
  purify: { name: '정화', mp: 8, tgt: 'allies', kind: 'heal', pow: 0.9, cure: true, fx: 'heal', desc: '모두의 나쁜 상태를 풀고 조금 회복' },
  revive: { name: '부활', mp: 14, tgt: 'deadAlly', kind: 'special', fx: 'holy', desc: '쓰러진 동료를 체력 50%로 일으킨다' },
  sanctuary: { name: '성역', mp: 18, tgt: 'allies', kind: 'heal', pow: 1.6, st: [['regen', 1, 3]], fx: 'heal', desc: '모두 회복 + 재생' },
  blessAll: { name: '여신의 축복', mp: 16, tgt: 'allies', kind: 'buff', st: [['atkUp', 1, 3], ['defUp', 1, 3]], fx: 'holy', desc: '모두 공격↑ 방어↑' },
  // 도적
  backstab: { name: '급소 찌르기', mp: 3, tgt: 'enemy', kind: 'phys', el: 'phys', pow: 1.3, crit: 40, fx: 'pierce', desc: '치명타가 잘 터진다' },
  venom: { name: '독날', mp: 4, tgt: 'enemy', kind: 'phys', el: 'phys', pow: 1, st: [['poison', 0.9, 3]], fx: 'poison', desc: '독을 바른 칼날' },
  smokeVeil: { name: '연막', mp: 6, tgt: 'allies', kind: 'buff', st: [['evaUp', 1, 3]], fx: 'smoke', desc: '모든 동료 회피↑' },
  steal: { name: '훔치기', mp: 4, tgt: 'enemy', kind: 'phys', el: 'phys', pow: 0.8, fx: 'pierce', special: 'steal', desc: '공격하면서 금화나 물건을 훔친다' },
  flurry: { name: '그림자 연격', mp: 12, tgt: 'random', kind: 'phys', el: 'phys', pow: 0.65, hits: 4, crit: 20, fx: 'slash', desc: '무작위 적을 4번 벤다' },
  assassinate: { name: '암살', mp: 15, tgt: 'enemy', kind: 'phys', el: 'dark', pow: 2, special: 'execute', fx: 'dark', desc: '체력이 30% 아래인 적에게 2.5배' },
  // 궁수
  aimShot: { name: '조준 사격', mp: 3, tgt: 'enemy', kind: 'phys', el: 'phys', pow: 1.5, crit: 15, acc: 100, fx: 'arrow', desc: '빗나가지 않는 화살' },
  arrowRain: { name: '화살비', mp: 7, tgt: 'enemies', kind: 'phys', el: 'phys', pow: 0.75, fx: 'arrows', desc: '모든 적에게 화살을 쏟는다' },
  snare: { name: '속박 덫', mp: 5, tgt: 'enemy', kind: 'phys', el: 'phys', pow: 0.8, st: [['spdDown', 1, 3], ['bleed', 0.7, 3]], fx: 'arrow', desc: '속도↓ + 출혈' },
  windSong: { name: '바람의 노래', mp: 8, tgt: 'allies', kind: 'buff', st: [['spdUp', 1, 3]], fx: 'buff', desc: '모든 동료 속도↑' },
  pierceShot: { name: '관통 화살', mp: 10, tgt: 'enemy', kind: 'phys', el: 'phys', pow: 2.2, pierce: true, acc: 100, fx: 'arrow', desc: '방어를 무시하는 화살' },
  stormArrows: { name: '폭풍 화살', mp: 16, tgt: 'random', kind: 'phys', el: 'bolt', pow: 0.6, hits: 6, fx: 'bolt', desc: '번개 화살 6발' },
  // 연금술사
  acid: { name: '산성 플라스크', mp: 4, tgt: 'enemy', kind: 'mag', el: 'poison', pow: 1.2, st: [['defDown', 0.85, 3]], fx: 'poison', desc: '방어↓를 건다' },
  tonic: { name: '회복 물약', mp: 4, tgt: 'ally', kind: 'heal', pow: 2, fx: 'heal', desc: '동료 하나 회복' },
  firebomb: { name: '화염 폭탄', mp: 8, tgt: 'enemies', kind: 'mag', el: 'fire', pow: 1.1, st: [['burn', 0.25, 3]], fx: 'fire', desc: '모든 적에게 불' },
  transmute: { name: '변성', mp: 7, tgt: 'enemy', kind: 'special', fx: 'dark', desc: '적에게 나쁜 상태 2개를 건다' },
  elixirRain: { name: '엘릭서 비', mp: 16, tgt: 'allies', kind: 'heal', pow: 1.3, mpGain: 8, fx: 'heal', desc: '모두 체력과 마나 회복' },
  philosopher: { name: '현자의 돌', mp: 20, tgt: 'enemies', kind: 'mag', el: 'dark', pow: 1.6, st: [['atkDown', 0.8, 3]], fx: 'dark', desc: '모든 적에게 어둠 + 공격↓' },
};

// 몬스터 기술
const ESKILLS = {
  tackle: { name: '몸통 박치기', tgt: 'enemy', kind: 'phys', el: 'phys', pow: 1, fx: 'smash' },
  sticky: { name: '끈적이 점액', tgt: 'enemy', kind: 'mag', el: 'poison', pow: 0.6, st: [['spdDown', 0.7, 2]], fx: 'poison' },
  charge: { name: '돌진', tgt: 'enemy', kind: 'phys', el: 'phys', pow: 1.6, fx: 'smash' },
  spore: { name: '독 포자', tgt: 'enemies', kind: 'mag', el: 'poison', pow: 0.45, st: [['poison', 0.5, 3]], fx: 'poison' },
  mend: { name: '버섯 치료', tgt: 'ally', kind: 'heal', pow: 2.2, fx: 'heal' },
  bite: { name: '물어뜯기', tgt: 'enemy', kind: 'phys', el: 'phys', pow: 1.15, st: [['bleed', 0.3, 3]], fx: 'bite' },
  howl: { name: '울부짖기', tgt: 'allies', kind: 'buff', st: [['atkUp', 1, 3]], fx: 'roar' },
  slamAll: { name: '땅 울리기', tgt: 'enemies', kind: 'phys', el: 'phys', pow: 0.8, fx: 'quake' },
  root: { name: '뿌리 감기', tgt: 'enemy', kind: 'phys', el: 'phys', pow: 0.9, st: [['stun', 0.4, 1]], fx: 'smash' },
  bark: { name: '나무껍질', tgt: 'self', kind: 'buff', self: [['regen', 3], ['defUp', 3]], fx: 'heal' },
  web: { name: '거미줄', tgt: 'enemies', kind: 'mag', el: 'phys', pow: 0.3, st: [['spdDown', 0.8, 3]], fx: 'web' },
  fang: { name: '독니', tgt: 'enemy', kind: 'phys', el: 'poison', pow: 1.4, st: [['poison', 0.7, 3]], fx: 'bite' },
  brood: { name: '알 깨우기', tgt: 'self', kind: 'special', special: 'summon', summon: 'spiderling', n: 2, fx: 'summon' },
  sting: { name: '독침', tgt: 'enemy', kind: 'phys', el: 'poison', pow: 1.05, st: [['poison', 0.7, 3]], fx: 'pierce' },
  pincer: { name: '집게 공격', tgt: 'enemy', kind: 'phys', el: 'phys', pow: 0.7, hits: 2, fx: 'claw' },
  curse: { name: '저주', tgt: 'enemy', kind: 'mag', el: 'dark', pow: 0.8, st: [['atkDown', 0.7, 3]], fx: 'dark' },
  wrap: { name: '붕대 감기', tgt: 'enemy', kind: 'phys', el: 'phys', pow: 0.8, st: [['stun', 0.3, 1]], fx: 'smash' },
  dive: { name: '급강하', tgt: 'enemy', kind: 'phys', el: 'phys', pow: 1.4, fx: 'claw' },
  peck: { name: '쪼기', tgt: 'weakest', kind: 'phys', el: 'phys', pow: 1, fx: 'pierce' },
  golemSlam: { name: '진흙 주먹', tgt: 'enemy', kind: 'phys', el: 'phys', pow: 1.5, fx: 'smash' },
  harden: { name: '굳히기', tgt: 'self', kind: 'buff', self: [['defUp', 3]], fx: 'buff' },
  curseAll: { name: '왕의 저주', tgt: 'enemies', kind: 'mag', el: 'dark', pow: 0.6, st: [['atkDown', 0.5, 3], ['defDown', 0.5, 3]], fx: 'dark' },
  darkBolt: { name: '어둠의 화살', tgt: 'enemy', kind: 'mag', el: 'dark', pow: 1.5, fx: 'dark' },
  raiseMummy: { name: '미라 깨우기', tgt: 'self', kind: 'special', special: 'summon', summon: 'mummy', n: 1, fx: 'summon' },
  burrow: { name: '모래 속으로', tgt: 'self', kind: 'buff', self: [['evaUp', 2]], charge: 'erupt', fx: 'sand' },
  erupt: { name: '모래 분출', tgt: 'enemies', kind: 'phys', el: 'phys', pow: 1.4, fx: 'quake' },
  sandstorm: { name: '모래 폭풍', tgt: 'enemies', kind: 'mag', el: 'phys', pow: 0.8, st: [['spdDown', 0.3, 2]], fx: 'sand' },
  wyrmBite: { name: '삼키기', tgt: 'enemy', kind: 'phys', el: 'phys', pow: 1.6, st: [['bleed', 0.5, 3]], fx: 'bite' },
  drainBite: { name: '흡혈', tgt: 'enemy', kind: 'phys', el: 'phys', pow: 1, drain: 0.5, fx: 'bite' },
  screech: { name: '초음파', tgt: 'enemies', kind: 'mag', el: 'phys', pow: 0.3, st: [['defDown', 0.5, 2]], fx: 'roar' },
  iceShard: { name: '얼음 조각', tgt: 'enemy', kind: 'mag', el: 'ice', pow: 1.25, st: [['freeze', 0.2, 1]], fx: 'ice' },
  shatter: { name: '자폭', tgt: 'enemies', kind: 'mag', el: 'ice', pow: 1.3, special: 'selfDestruct', fx: 'blizzard' },
  crush: { name: '수정 집게', tgt: 'enemy', kind: 'phys', el: 'phys', pow: 1.3, fx: 'claw' },
  slide: { name: '배 미끄럼', tgt: 'random', kind: 'phys', el: 'phys', pow: 0.8, hits: 2, fx: 'smash' },
  spear: { name: '창 찌르기', tgt: 'enemy', kind: 'phys', el: 'phys', pow: 1.3, st: [['bleed', 0.3, 3]], fx: 'pierce' },
  roarDown: { name: '포효', tgt: 'enemies', kind: 'buff', st: [['atkDown', 0.6, 3]], fx: 'roar' },
  avalanche: { name: '눈사태', tgt: 'enemies', kind: 'phys', el: 'ice', pow: 0.95, fx: 'blizzard' },
  smashStun: { name: '내려찍기', tgt: 'enemy', kind: 'phys', el: 'phys', pow: 1.8, st: [['stun', 0.4, 1]], fx: 'smash' },
  frostBreath: { name: '서리 숨결', tgt: 'enemies', kind: 'mag', el: 'ice', pow: 1.05, st: [['freeze', 0.2, 1]], fx: 'blizzard' },
  tailSweep: { name: '꼬리 휘두르기', tgt: 'enemies', kind: 'phys', el: 'phys', pow: 0.9, fx: 'slash' },
  wingGust: { name: '날개 돌풍', tgt: 'enemies', kind: 'mag', el: 'phys', pow: 0.4, st: [['spdDown', 0.6, 3]], fx: 'sand' },
  inhale: { name: '숨 들이마시기', tgt: 'self', kind: 'buff', self: [], charge: 'blizzardBreath', fx: 'buff' },
  blizzardBreath: { name: '눈보라 숨결', tgt: 'enemies', kind: 'mag', el: 'ice', pow: 1.7, st: [['freeze', 0.3, 1]], fx: 'blizzard' },
  impFire: { name: '불장난', tgt: 'enemy', kind: 'mag', el: 'fire', pow: 1.3, st: [['burn', 0.4, 3]], fx: 'fire' },
  giggle: { name: '킥킥', tgt: 'self', kind: 'buff', self: [['evaUp', 2]], fx: 'smoke' },
  cleave: { name: '휘둘러 베기', tgt: 'enemies', kind: 'phys', el: 'phys', pow: 0.75, fx: 'slash' },
  boneShield: { name: '뼈 방패', tgt: 'self', kind: 'buff', self: [['defUp', 3]], fx: 'buff' },
  boneSlash: { name: '녹슨 칼', tgt: 'enemy', kind: 'phys', el: 'phys', pow: 1.2, st: [['bleed', 0.3, 3]], fx: 'slash' },
  heatAura: { name: '열기', tgt: 'enemies', kind: 'mag', el: 'fire', pow: 0.6, st: [['burn', 0.4, 3]], fx: 'fire' },
  lavaTouch: { name: '용암 손', tgt: 'enemy', kind: 'phys', el: 'fire', pow: 1.2, st: [['burn', 0.5, 3]], fx: 'fire' },
  hex: { name: '그림자 묶기', tgt: 'enemy', kind: 'mag', el: 'dark', pow: 1, st: [['stun', 0.3, 1]], fx: 'dark' },
  shadowWard: { name: '그림자 장막', tgt: 'ally', kind: 'buff', st: [['defUp', 1, 3]], fx: 'dark' },
  fireBite: { name: '불 이빨', tgt: 'enemy', kind: 'phys', el: 'fire', pow: 1.25, st: [['burn', 0.4, 3]], fx: 'bite' },
  tripleBite: { name: '세 번 물기', tgt: 'random', kind: 'phys', el: 'phys', pow: 0.7, hits: 3, fx: 'bite' },
  ashSlash: { name: '잿빛 베기', tgt: 'enemy', kind: 'phys', el: 'phys', pow: 1.45, fx: 'slash' },
  decree: { name: '왕의 칙령', tgt: 'enemies', kind: 'mag', el: 'dark', pow: 0.5, st: [['atkDown', 0.6, 3], ['defDown', 0.6, 3]], fx: 'dark' },
  callGuard: { name: '근위병 소환', tgt: 'self', kind: 'special', special: 'summon', summon: 'skeletonKnight', n: 1, fx: 'summon' },
  flameSword: { name: '불꽃 대검', tgt: 'enemies', kind: 'phys', el: 'fire', pow: 1.1, st: [['burn', 0.4, 3]], fx: 'fire' },
  gather: { name: '어둠 모으기', tgt: 'self', kind: 'buff', self: [], charge: 'eclipse', fx: 'dark' },
  eclipse: { name: '일식', tgt: 'enemies', kind: 'mag', el: 'dark', pow: 2, fx: 'eclipse' },
  mimicBite: { name: '덥석', tgt: 'enemy', kind: 'phys', el: 'phys', pow: 1.5, fx: 'bite' },
  goldBump: { name: '통통', tgt: 'enemy', kind: 'phys', el: 'phys', pow: 0.4, fx: 'smash' },
  goldFlee: { name: '도망', tgt: 'self', kind: 'special', special: 'flee', fx: 'smoke' },
};

// ---------- 몬스터 ----------
// ai: [기술, 무게, 조건]
const ENEMIES = {
  // 이끼 숲
  mossSlime: { name: '이끼 슬라임', spr: 'mossSlime', hp: 30, atk: 8, mag: 6, def: 4, res: 5, spd: 5, xp: 9, gold: 6, weak: ['fire'], ai: [['tackle', 3], ['sticky', 1]] },
  boar: { name: '가시 멧돼지', spr: 'boar', hp: 44, atk: 11, mag: 2, def: 6, res: 3, spd: 7, xp: 11, gold: 8, weak: ['ice'], ai: [['tackle', 2], ['charge', 1]] },
  shroom: { name: '독버섯 꼬마', spr: 'shroom', hp: 28, atk: 6, mag: 9, def: 4, res: 8, spd: 6, xp: 10, gold: 7, weak: ['fire'], ai: [['spore', 2], ['tackle', 1], ['mend', 3, 'allyHurt']] },
  wolf: { name: '숲 늑대', spr: 'wolf', hp: 34, atk: 10, mag: 2, def: 4, res: 4, spd: 12, xp: 11, gold: 7, weak: ['fire'], ai: [['bite', 3], ['howl', 1, 'noBuff']] },
  treant: { name: '고목 수호자', spr: 'treant', hp: 165, atk: 12, mag: 10, def: 10, res: 8, spd: 4, xp: 45, gold: 40, weak: ['fire'], resist: ['poison'], elite: 1, ai: [['slamAll', 2], ['root', 2], ['bark', 1, 'hurt']] },
  spiderQueen: {
    name: '거미 여왕 실타래', spr: 'spiderQueen', hp: 300, atk: 12, mag: 12, def: 8, res: 8, spd: 9, xp: 90, gold: 90, weak: ['fire'], resist: ['poison'], boss: 1,
    ai: [['fang', 3], ['web', 1], ['brood', 2, 'fewAdds']],
    phase2: { at: 0.5, msg: '여왕이 분노해 몸을 일으켰다!', acts: 2, ai: [['fang', 3], ['web', 1], ['brood', 1, 'fewAdds'], ['tackle', 2]] },
  },
  spiderling: { name: '새끼 거미', spr: 'spiderling', hp: 22, atk: 9, mag: 4, def: 3, res: 3, spd: 10, xp: 3, gold: 2, weak: ['fire'], ai: [['bite', 1]] },
  // 모래 왕국
  scorpion: { name: '모래 전갈', spr: 'scorpion', hp: 64, atk: 17, mag: 4, def: 12, res: 4, spd: 8, xp: 22, gold: 15, weak: ['ice'], ai: [['sting', 2], ['pincer', 2]] },
  mummy: { name: '떠도는 미라', spr: 'mummy', hp: 72, atk: 15, mag: 11, def: 8, res: 6, spd: 5, xp: 22, gold: 14, weak: ['fire', 'holy'], resist: ['poison', 'dark'], undead: 1, ai: [['tackle', 2], ['curse', 1], ['wrap', 1]] },
  vulture: { name: '사막 독수리', spr: 'vulture', hp: 50, atk: 16, mag: 4, def: 6, res: 6, spd: 15, xp: 20, gold: 13, weak: ['bolt'], ai: [['dive', 2], ['peck', 2]] },
  clayGolem: { name: '진흙 거인', spr: 'clayGolem', hp: 96, atk: 18, mag: 4, def: 18, res: 4, spd: 3, xp: 26, gold: 18, weak: ['ice', 'bolt'], resist: ['phys', 'poison'], ai: [['golemSlam', 3], ['harden', 1, 'noBuff']] },
  pharaoh: { name: '저주받은 파라오', spr: 'pharaoh', hp: 320, atk: 18, mag: 19, def: 10, res: 14, spd: 9, xp: 85, gold: 70, weak: ['fire', 'holy'], resist: ['dark', 'poison'], undead: 1, elite: 1, ai: [['curseAll', 2], ['darkBolt', 3], ['raiseMummy', 2, 'fewAdds']] },
  sandWyrm: {
    name: '모래 왕뱀 아펩', spr: 'sandWyrm', hp: 700, atk: 24, mag: 18, def: 14, res: 10, spd: 10, xp: 170, gold: 160, weak: ['ice'], resist: ['fire'], boss: 1,
    ai: [['wyrmBite', 3], ['sandstorm', 2], ['burrow', 1]],
    phase2: { at: 0.5, msg: '왕뱀이 사납게 몸을 비튼다!', acts: 2, ai: [['wyrmBite', 3], ['sandstorm', 2], ['burrow', 2]] },
  },
  // 서리 동굴
  iceBat: { name: '얼음 박쥐', spr: 'iceBat', hp: 62, atk: 21, mag: 8, def: 8, res: 8, spd: 18, xp: 42, gold: 22, weak: ['fire', 'bolt'], resist: ['ice'], ai: [['drainBite', 3], ['screech', 1]] },
  frostWisp: { name: '서리 도깨비불', spr: 'frostWisp', hp: 58, atk: 8, mag: 27, def: 6, res: 20, spd: 12, xp: 42, gold: 22, weak: ['fire'], resist: ['ice', 'phys'], ai: [['iceShard', 3], ['shatter', 6, 'low']] },
  crystalCrab: { name: '수정 게', spr: 'crystalCrab', hp: 104, atk: 25, mag: 6, def: 28, res: 10, spd: 6, xp: 46, gold: 26, weak: ['bolt'], resist: ['ice'], ai: [['crush', 3], ['harden', 1, 'noBuff']] },
  penguinKnight: { name: '펭귄 창기사', spr: 'penguinKnight', hp: 88, atk: 26, mag: 6, def: 14, res: 10, spd: 10, xp: 44, gold: 24, weak: ['fire'], resist: ['ice'], ai: [['spear', 3], ['slide', 2]] },
  yeti: { name: '설인 우두머리', spr: 'yeti', hp: 620, atk: 32, mag: 14, def: 18, res: 12, spd: 8, xp: 150, gold: 110, weak: ['fire'], resist: ['ice'], elite: 1, ai: [['roarDown', 1, 'noDebuff'], ['avalanche', 2], ['smashStun', 2]] },
  frostDragon: {
    name: '서리 용 니블', spr: 'frostDragon', hp: 1050, atk: 28, mag: 30, def: 20, res: 22, spd: 12, xp: 320, gold: 260, weak: ['fire'], resist: ['ice'], boss: 1,
    ai: [['frostBreath', 2], ['tailSweep', 2], ['wingGust', 1], ['crush', 2]],
    phase2: { at: 0.5, msg: '서리 용의 눈이 새파랗게 타오른다!', acts: 2, ai: [['frostBreath', 2], ['tailSweep', 2], ['inhale', 2], ['crush', 2]] },
  },
  // 잿불 성채
  imp: { name: '불꽃 임프', spr: 'imp', hp: 84, atk: 18, mag: 36, def: 10, res: 16, spd: 17, xp: 72, gold: 34, weak: ['ice', 'holy'], resist: ['fire'], ai: [['impFire', 3], ['giggle', 1, 'noBuff']] },
  skeletonKnight: { name: '해골 근위병', spr: 'skeletonKnight', hp: 136, atk: 38, mag: 6, def: 26, res: 10, spd: 9, xp: 78, gold: 38, weak: ['holy'], resist: ['poison', 'dark'], undead: 1, reassemble: 1, ai: [['boneSlash', 3], ['cleave', 2], ['boneShield', 1, 'noBuff']] },
  lavaSlime: { name: '용암 슬라임', spr: 'lavaSlime', hp: 116, atk: 32, mag: 30, def: 14, res: 14, spd: 7, xp: 72, gold: 34, weak: ['ice'], resist: ['fire'], ai: [['lavaTouch', 3], ['heatAura', 1]] },
  shadowMage: { name: '그림자 마법사', spr: 'shadowMage', hp: 98, atk: 10, mag: 42, def: 10, res: 24, spd: 13, xp: 78, gold: 40, weak: ['holy'], resist: ['dark'], ai: [['darkBolt', 3], ['hex', 2], ['shadowWard', 1, 'allyNoBuff']] },
  hellhound: { name: '지옥 사냥개', spr: 'hellhound', hp: 760, atk: 42, mag: 20, def: 18, res: 14, spd: 16, xp: 260, gold: 180, weak: ['ice', 'holy'], resist: ['fire'], elite: 1, acts: 2, ai: [['fireBite', 3], ['tripleBite', 2], ['howl', 1, 'noBuff']] },
  ashKing: {
    name: '잿빛 왕', spr: 'ashKing', hp: 2300, atk: 44, mag: 42, def: 26, res: 24, spd: 14, xp: 0, gold: 0, weak: ['holy'], resist: ['fire', 'dark'], boss: 1, final: 1,
    ai: [['ashSlash', 3], ['decree', 1, 'noDebuff'], ['callGuard', 2, 'fewAdds'], ['flameSword', 2]],
    phase2: { at: 0.5, msg: '왕관이 타오르고, 하늘의 해가 검게 물든다!', acts: 2, ai: [['ashSlash', 3], ['flameSword', 3], ['gather', 2], ['decree', 1, 'noDebuff']] },
  },
  // 어디서나
  mimic: { name: '상자 괴물', spr: 'mimic', hp: 120, atk: 18, mag: 6, def: 14, res: 10, spd: 9, xp: 40, gold: 120, weak: ['fire'], ai: [['mimicBite', 3], ['tackle', 1]], scale: 1 },
  goldSlime: { name: '황금 슬라임', spr: 'goldSlime', hp: 40, atk: 6, mag: 4, def: 40, res: 40, spd: 14, xp: 60, gold: 250, ai: [['goldBump', 2], ['goldFlee', 2]], scale: 1 },
};

// ---------- 지역 ----------
const REGIONS = [
  {
    id: 'forest', name: '이끼 숲', tag: '1장', desc: '반딧불이 춤추는 오래된 숲. 등불의 빛이 아직 닿는 곳.',
    pool: ['mossSlime', 'boar', 'shroom', 'wolf'], elite: 'treant', boss: 'spiderQueen', tier: 0, music: 'forest',
  },
  {
    id: 'sands', name: '잊힌 모래 왕국', tag: '2장', desc: '모래 아래 잠든 왕들의 무덤. 낮에는 뜨겁고 밤에는 저주가 깨어난다.',
    pool: ['scorpion', 'mummy', 'vulture', 'clayGolem'], elite: 'pharaoh', boss: 'sandWyrm', tier: 1, music: 'sands',
  },
  {
    id: 'frost', name: '서리 수정 동굴', tag: '3장', desc: '얼음 수정이 스스로 빛나는 깊은 동굴. 숨결마저 얼어붙는다.',
    pool: ['iceBat', 'frostWisp', 'crystalCrab', 'penguinKnight'], elite: 'yeti', boss: 'frostDragon', tier: 2, music: 'frost',
  },
  {
    id: 'ash', name: '잿불 성채', tag: '4장', desc: '해를 삼킨 잿빛 왕의 성. 마지막 빛을 되찾아야 한다.',
    pool: ['imp', 'skeletonKnight', 'lavaSlime', 'shadowMage'], elite: 'hellhound', boss: 'ashKing', tier: 3, music: 'ash',
  },
];

// ---------- 아이템 ----------
const ITEMS = {
  hp: { name: '회복 물약', price: 22, tgt: 'ally', heal: 70, desc: '체력 70 회복' },
  hpBig: { name: '큰 회복 물약', price: 60, tgt: 'ally', heal: 220, desc: '체력 220 회복' },
  mp: { name: '마나 물약', price: 28, tgt: 'ally', mpGain: 25, desc: '마나 25 회복' },
  mpBig: { name: '큰 마나 물약', price: 70, tgt: 'ally', mpGain: 70, desc: '마나 70 회복' },
  herb: { name: '해독 약초', price: 16, tgt: 'ally', cure: true, heal: 25, desc: '나쁜 상태를 모두 풀고 체력 25 회복' },
  feather: { name: '불사조 깃털', price: 90, tgt: 'deadAlly', revive: 0.5, desc: '쓰러진 동료를 체력 50%로 일으킨다' },
  elixir: { name: '엘릭서', price: 180, tgt: 'ally', full: true, desc: '체력과 마나를 모두 회복' },
  bombFire: { name: '화염 폭탄', price: 45, tgt: 'enemies', dmg: 40, el: 'fire', st: [['burn', 0.4, 3]], battle: 1, desc: '모든 적에게 불 피해' },
  bombIce: { name: '얼음 폭탄', price: 48, tgt: 'enemies', dmg: 36, el: 'ice', st: [['freeze', 0.3, 1]], battle: 1, desc: '모든 적에게 얼음 피해, 얼릴 수 있다' },
  bombHoly: { name: '성수 폭탄', price: 52, tgt: 'enemies', dmg: 44, el: 'holy', battle: 1, desc: '모든 적에게 빛 피해' },
  smoke: { name: '연막탄', price: 32, tgt: 'allies', st: [['evaUp', 1, 3]], battle: 1, desc: '모든 동료 회피↑ (3턴)' },
};
const ITEM_ORDER = Object.keys(ITEMS);

// ---------- 장비 ----------
const RARITY = [
  { name: '보통', color: '#d8d0c0', mult: 1, affix: 0 },
  { name: '고급', color: '#6ae07a', mult: 1.2, affix: 1 },
  { name: '희귀', color: '#5aa8ff', mult: 1.45, affix: 2 },
  { name: '전설', color: '#ffa83a', mult: 1.8, affix: 2 },
];
const STAT_NAME = { hp: '체력', mp: '마나', atk: '공격', mag: '마력', def: '방어', res: '마법 방어', spd: '속도', crit: '치명', eva: '회피' };
const EQUIP_KIND = {
  sword: { slot: 'weapon', icon: 'sword', cls: 'knight', names: ['녹슨 장검', '기사의 장검', '룬 새긴 검', '태양의 대검'], base: T => ({ atk: 5 + 6 * T }) },
  staff: { slot: 'weapon', icon: 'staff', cls: 'mage', names: ['참나무 지팡이', '수정 지팡이', '별빛 지팡이', '창세의 홀'], base: T => ({ mag: 5 + 6 * T, mp: 4 + 3 * T }) },
  mace: { slot: 'weapon', icon: 'mace', cls: 'cleric', names: ['나무 철퇴', '은 철퇴', '성광 철퇴', '새벽의 망치'], base: T => ({ atk: 3 + 3 * T, mag: 4 + 5 * T }) },
  dagger: { slot: 'weapon', icon: 'dagger', cls: 'rogue', names: ['뼈 단검', '쌍단검', '그림자 송곳', '달그림자 비수'], base: T => ({ atk: 4 + 5 * T, crit: 4 + 2 * T }) },
  bow: { slot: 'weapon', icon: 'bow', cls: 'ranger', names: ['사냥 활', '장궁', '바람 활', '하늘 꿰는 활'], base: T => ({ atk: 4 + 5.5 * T, spd: 1 + T }) },
  flask: { slot: 'weapon', icon: 'flask', cls: 'alchemist', names: ['금 간 플라스크', '증류 플라스크', '현자의 플라스크', '무한 연성 플라스크'], base: T => ({ mag: 4 + 5 * T, atk: 2 + 2 * T }) },
  heavy: { slot: 'armor', icon: 'armorHeavy', names: ['철판 조끼', '사슬 갑옷', '수정 판금 갑옷', '용비늘 갑옷'], base: T => ({ def: 5 + 5 * T, hp: 10 + 12 * T }) },
  robe: { slot: 'armor', icon: 'robe', names: ['수련생 로브', '별무늬 로브', '서리실 로브', '해돋이 로브'], base: T => ({ res: 5 + 5 * T, mp: 6 + 5 * T, def: 1 + 2 * T }) },
  leather: { slot: 'armor', icon: 'leather', names: ['가죽 조끼', '사막 망토', '눈표범 가죽옷', '그림자 가죽옷'], base: T => ({ def: 3 + 3.5 * T, eva: 3 + T, spd: 1 + 0.5 * T }) },
  ring: { slot: 'acc', icon: 'ring', names: ['구리 반지', '은 반지', '수정 반지', '해의 반지'], base: T => (chance(0.5) ? { atk: 3 + 3 * T } : { mag: 3 + 3 * T }) },
  amulet: { slot: 'acc', icon: 'amulet', names: ['나무 목걸이', '푸른 목걸이', '얼음꽃 목걸이', '등불 목걸이'], base: T => ({ hp: 15 + 16 * T, res: 2 + 2 * T }) },
  charm: { slot: 'acc', icon: 'charm', names: ['낡은 부적', '모래 부적', '서리 부적', '봉인 부적'], base: T => ({ def: 2 + 2 * T, res: 3 + 3 * T }) },
  boots: { slot: 'acc', icon: 'boots', names: ['여행자 장화', '바람 장화', '눈길 장화', '질풍 장화'], base: T => ({ spd: 2 + 1.5 * T, eva: 2 + T }) },
};
const AFFIX = T => ({ hp: 8 + 9 * T, mp: 4 + 4 * T, atk: 2 + 2 * T, mag: 2 + 2 * T, def: 2 + 2 * T, res: 2 + 2 * T, spd: 1 + T, crit: 3 + 2 * T, eva: 2 + T });
const SPECIAL_FX = {
  lifesteal: { name: '흡혈', pre: '피를 마시는', desc: '물리 피해의 15%만큼 체력 회복' },
  thorns: { name: '가시', pre: '가시 돋친', desc: '맞으면 받은 피해의 25%를 되돌려 준다' },
  regen: { name: '재생', pre: '숨 쉬는', desc: '매 턴 체력 4% 회복' },
  mpRegen: { name: '마나 샘', pre: '샘솟는', desc: '매 턴 마나 3 회복' },
  haste: { name: '선제', pre: '질풍의', desc: '전투 시작 때 속도↑ (3턴)' },
  fireEdge: { name: '불꽃', pre: '불타는', desc: '기본 공격이 불 속성' },
  holyEdge: { name: '성스러움', pre: '성스러운', desc: '기본 공격이 빛 속성' },
  critDmg: { name: '처형', pre: '처형자의', desc: '치명타 피해 2.2배' },
};
