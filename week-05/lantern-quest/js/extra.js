'use strict';
// 추가 데이터 — 필살기, 변종 몬스터, 난이도, 유물, 몬스터 도감 설명, 이야기

// ---------- 필살기 (등불 게이지가 가득 차면) ----------
Object.assign(SKILLS, {
  ult_knight: { name: '성채의 맹세', mp: 0, ult: 1, tgt: 'enemies', kind: 'phys', el: 'holy', pow: 1.7, fx: 'holy', post: { heal: 0.25, st: [['defUp', 3]] }, desc: '모든 적에게 빛의 일격, 동료 모두 회복 + 방어↑' },
  ult_mage: { name: '별 무너뜨리기', mp: 0, ult: 1, tgt: 'enemies', kind: 'mag', el: 'best', pow: 2.5, fx: 'meteor', desc: '적마다 가장 아픈 속성(불·얼음·번개)으로 내리친다' },
  ult_cleric: { name: '새벽의 기적', mp: 0, ult: 1, tgt: 'allies', kind: 'special', fx: 'holy', desc: '쓰러진 동료를 모두 일으키고, 모두 크게 회복 + 재생' },
  ult_rogue: { name: '천 개의 그림자', mp: 0, ult: 1, tgt: 'random', kind: 'phys', el: 'dark', pow: 0.75, hits: 8, crit: 40, fx: 'slash', desc: '무작위 적을 8번 벤다. 치명타가 잘 터진다' },
  ult_ranger: { name: '별빛 화살', mp: 0, ult: 1, tgt: 'enemy', kind: 'phys', el: 'holy', pow: 4.2, pierce: true, acc: 100, st: [['stun', 1, 1]], fx: 'arrow', desc: '방어를 뚫는 거대한 화살. 맞으면 기절' },
  ult_alchemist: { name: '대연성', mp: 0, ult: 1, tgt: 'enemies', kind: 'mag', el: 'dark', pow: 1.8, st: [['poison', 0.7, 3], ['burn', 0.7, 3], ['defDown', 0.7, 3], ['atkDown', 0.7, 3]], fx: 'dark', desc: '모든 적에게 어둠 + 독·화상·방어↓·공격↓' },
});

// ---------- 변종 몬스터 ----------
const MOD = {
  tough: { name: '단단한', color: '#c8d0e0', hp: 1.6, def: 1.35, desc: '체력과 방어가 높다' },
  swift: { name: '날쌘', color: '#7fe8ff', spd: 1.6, eva: 20, desc: '빠르고 잘 피한다' },
  blazing: { name: '불타는', color: '#ff7a2a', burn: 0.4, resist: 'fire', desc: '때리면 화상을 입힌다' },
  vampiric: { name: '흡혈하는', color: '#e0303a', drain: 0.3, desc: '때린 만큼 체력을 빨아들인다' },
  giant: { name: '거대한', color: '#c86aff', hp: 2, atk: 1.2, scale: 1.5, desc: '몸집이 크고 힘이 세다' },
};

// ---------- 난이도 ----------
const DIFF = [
  { name: '쉬움', desc: '적이 약하고 금화를 더 준다. 처음 하는 사람에게 추천', hp: 0.78, atk: 0.85, gold: 1.25, xp: 1.15 },
  { name: '보통', desc: '원래 난이도', hp: 1, atk: 1, gold: 1, xp: 1 },
  { name: '어려움', desc: '적이 강하고 변종이 자주 나온다. 경험치를 더 준다', hp: 1.3, atk: 1.15, gold: 1, xp: 1.15 },
];

// ---------- 유물 ----------
const RELICS = {
  ember: { name: '꺼지지 않는 불씨', desc: '불 속성 피해 +30%', c: '#ff7a2a' },
  frost: { name: '서리 결정', desc: '빙결이 걸릴 확률 +20%', c: '#7fd8ff' },
  thunder: { name: '번개 깃털', desc: '전투 시작 때 모두 속도↑ (2턴)', c: '#ffe066' },
  lamp: { name: '오래된 등잔', desc: '등불 게이지가 50% 더 빨리 찬다', c: '#ffb040' },
  fang: { name: '흡혈 송곳니', desc: '동료가 준 피해의 6%만큼 체력 회복', c: '#e0303a' },
  shell: { name: '거북 등껍질', desc: '전투 시작 때 모두 방어↑ (2턴)', c: '#6ab07a' },
  pouch: { name: '금화 주머니', desc: '전투에서 얻는 금화 +30%', c: '#f2c230' },
  glasses: { name: '현자의 안경', desc: '얻는 경험치 +20%', c: '#9fe8ff' },
  seed: { name: '부활의 씨앗', desc: '전투마다 처음 쓰러진 동료가 체력 30%로 일어난다', c: '#8fd36b' },
  flower: { name: '마나 꽃', desc: '동료 모두 매 턴 마나 +2', c: '#5a8ae0' },
  thorn: { name: '가시 갑옷 조각', desc: '동료가 맞으면 피해의 15%를 되돌려 준다', c: '#a8a0b8' },
  coin: { name: '행운 동전', desc: '동료 모두 치명 +8%', c: '#ffd34d' },
  herb: { name: '약초 주머니', desc: '전투가 끝날 때 체력을 10% 더 회복', c: '#6ae07a' },
  mark: { name: '사냥꾼의 표식', desc: '강적과 우두머리에게 주는 피해 +18%', c: '#c84a5a' },
  grail: { name: '빛의 성배', desc: '빛 속성 피해 +40%', c: '#fff2a8' },
  seal: { name: '상인의 인장', desc: '상점 가격 25% 할인', c: '#d9a92e' },
  viper: { name: '독사의 이빨', desc: '독·화상·출혈 피해 1.5배', c: '#6ad04a' },
  flag: { name: '용기의 깃발', desc: '전투 시작 때 모두 공격↑ (2턴)', c: '#d8323a' },
};
const hasRelic = id => !!(Run && Run.relics && Run.relics.includes(id));
// 유물 그림: 받침 위에 빛나는 물건
function relicDraw(id) {
  const c = RELICS[id].c;
  return P => {
    const r = ramp(c);
    switch (id) {
      case 'ember': P.poly([[8, 1], [13, 8], [12, 13], [4, 13], [3, 8]], '#c8442a'); P.poly([[8, 4], [11, 9], [10, 13], [6, 13], [5, 9]], '#ff7a2a'); P.ell(8, 10.5, 2, 2.5, '#ffe066'); break;
      case 'frost': P.poly([[8, 1], [12, 6], [8, 15], [4, 6]], r[1]); P.poly([[8, 1], [12, 6], [8, 8]], r[2]); P.line(8, 1, 8, 15, '#ffffff'); break;
      case 'thunder': P.poly([[3, 14], [11, 2], [13, 3], [7, 13]], '#e8e0c8'); P.poly([[9, 4], [7, 8], [10, 8], [7, 13]], c); break;
      case 'lamp': P.rect(7, 1, 2, 2, '#4a3a2a'); P.rect(4, 3, 8, 10, '#4a3a2a'); P.rect(5, 4, 6, 8, c); P.ell(8, 8, 2, 2.6, '#fff2b0'); P.rect(3, 13, 10, 2, '#4a3a2a'); break;
      case 'fang': P.poly([[4, 2], [8, 2], [6, 14]], '#f4ecd8'); P.poly([[9, 2], [13, 2], [11, 11]], '#e8dcc0'); P.ell(6, 13, 1, 1.4, c); break;
      case 'shell': P.ball(8, 9, 6.5, 5.5, r); P.line(8, 4, 8, 14, r[0]); P.line(3, 9, 13, 9, r[0]); P.ell(8, 9, 2, 2, r[2]); break;
      case 'pouch': P.ball(8, 10, 5.5, 4.5, ramp('#a8744a')); P.rect(6, 3, 4, 3, '#8a5a32'); P.ell(8, 10, 2.4, 2.4, c); break;
      case 'glasses': P.ell(5, 8, 3.2, 3.2, '#4a3a2a'); P.ell(11, 8, 3.2, 3.2, '#4a3a2a'); P.ell(5, 8, 2.2, 2.2, c); P.ell(11, 8, 2.2, 2.2, c); P.rect(7, 7, 2, 1, '#4a3a2a'); break;
      case 'seed': P.ball(8, 10, 4.5, 5, ramp('#a8744a')); P.line(8, 5, 8, 1, '#3f7d3a'); P.ell(6, 3, 2, 1.2, c); P.ell(10, 2.5, 2, 1.2, c); break;
      case 'flower': for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; P.ell(8 + Math.cos(a) * 3.5, 8 + Math.sin(a) * 3.5, 2.6, 2.6, c); } P.ell(8, 8, 2.2, 2.2, '#ffe066'); break;
      case 'thorn': P.poly([[3, 4], [13, 4], [12, 13], [4, 13]], '#5a6878'); for (const x of [4, 8, 12]) P.poly([[x - 1.5, 4], [x, 0.5], [x + 1.5, 4]], c); break;
      case 'coin': P.ball(8, 8, 6, 6, ramp(c)); P.poly([[8, 4], [9, 7], [12, 7], [9.5, 9], [10.5, 12], [8, 10], [5.5, 12], [6.5, 9], [4, 7], [7, 7]], '#fff6c8'); break;
      case 'herb': P.ball(8, 10, 5, 4.5, ramp('#c8b890')); P.ell(6, 4, 2, 3, c); P.ell(10, 4, 2, 3, '#4ab05a'); P.rect(5, 6, 6, 1, '#8a5a32'); break;
      case 'mark': P.ell(8, 8, 6, 6, '#e8dcc0'); P.ell(8, 8, 4, 4, c); P.ell(8, 8, 2, 2, '#e8dcc0'); P.ell(8, 8, 0.8, 0.8, c); break;
      case 'grail': P.poly([[3, 2], [13, 2], [11, 8], [5, 8]], '#d9a92e'); P.rect(7, 8, 2, 4, '#d9a92e'); P.rect(4, 12, 8, 2, '#b8862a'); P.ell(8, 3.5, 4, 1.2, c); break;
      case 'seal': P.ball(8, 9, 5.5, 5.5, ramp(c)); P.rect(6, 1, 4, 4, '#8a5a32'); P.rect(6, 7, 4, 4, '#8a6a1a'); break;
      case 'viper': P.poly([[3, 3], [7, 3], [5, 14]], '#f4ecd8'); P.poly([[9, 3], [13, 3], [11, 14]], '#f4ecd8'); P.ell(5, 12, 1.4, 2, c); P.ell(11, 12, 1.4, 2, c); break;
      case 'flag': P.rect(3, 1, 1.5, 14, '#8a6a4a'); P.poly([[4.5, 2], [14, 4], [4.5, 9]], c); P.ell(8, 5, 1.4, 1.4, '#ffe066'); break;
    }
  };
}
for (const id in RELICS) defSprite('rl_' + id, 16, 16, 1, relicDraw(id));

// ---------- 몬스터 도감 설명 ----------
const ENEMY_DESC = {
  mossSlime: '숲 바닥의 이끼를 먹고 자란 슬라임. 끈적이 점액으로 발을 묶는다.',
  boar: '등에 가시털이 돋은 멧돼지. 화가 나면 앞뒤 가리지 않고 돌진한다.',
  shroom: '걸어 다니는 독버섯. 위험해지면 동료를 버섯 가루로 치료한다.',
  wolf: '밤의 숲을 지키는 늑대. 울부짖으면 무리가 사나워진다.',
  treant: '천 년 묵은 나무에 깃든 수호자. 뿌리로 발을 묶고 땅을 울린다.',
  spiderQueen: '숲 가장 깊은 곳에 거미줄을 친 여왕. 빛나는 것을 모은다.',
  spiderling: '여왕의 알에서 깨어난 새끼 거미.',
  scorpion: '모래 속에 숨어 있다가 집게와 독침으로 덮친다.',
  mummy: '왕을 지키다 잠든 병사. 붕대로 상대를 감아 버린다.',
  vulture: '지친 여행자를 노리는 독수리. 가장 약한 자부터 쫀다.',
  clayGolem: '무덤을 지키도록 빚어진 진흙 인형. 칼날이 잘 먹히지 않는다.',
  pharaoh: '잠에서 깨어난 옛 왕. 저주를 내리고 미라를 불러낸다.',
  sandWyrm: '모래 왕국을 통째로 삼킨 거대한 뱀. 모래 속으로 숨었다 솟구친다.',
  iceBat: '동굴 천장에 매달린 박쥐. 물면 피를 빨아 간다.',
  frostWisp: '수정에서 새어 나온 차가운 불꽃. 약해지면 스스로 터진다.',
  crystalCrab: '등에 수정이 자라는 게. 껍질이 아주 단단하다.',
  penguinKnight: '얼음 동굴의 기사단. 배로 미끄러지며 창을 찌른다.',
  yeti: '눈보라를 몰고 다니는 거인. 포효 한 번에 기운이 빠진다.',
  frostDragon: '동굴 가장 깊은 곳에서 잠든 용. 숨결 한 번에 모든 것이 언다.',
  imp: '불장난을 좋아하는 작은 악마. 킥킥대며 잘 피한다.',
  skeletonKnight: '잿빛 왕의 근위병. 쓰러뜨려도 한 번은 다시 일어난다.',
  lavaSlime: '용암이 굳다 만 슬라임. 닿기만 해도 뜨겁다.',
  shadowMage: '그림자로 몸을 감싼 마법사. 동료를 그림자 장막으로 지킨다.',
  hellhound: '성문을 지키는 불타는 사냥개. 한 턴에 두 번 문다.',
  ashKing: '해를 삼켜 왕관에 가둔 왕. 왕관이 타오르면 하늘이 검게 물든다.',
  mimic: '보물 상자인 척하는 괴물. 이긴 자에게 진짜 보물을 남긴다.',
  goldSlime: '금화를 잔뜩 품은 슬라임. 겁이 많아 금방 도망친다.',
};
const DEX_ORDER = ['mossSlime', 'boar', 'shroom', 'wolf', 'treant', 'spiderQueen', 'spiderling', 'scorpion', 'mummy', 'vulture', 'clayGolem', 'pharaoh', 'sandWyrm',
  'iceBat', 'frostWisp', 'crystalCrab', 'penguinKnight', 'yeti', 'frostDragon', 'imp', 'skeletonKnight', 'lavaSlime', 'shadowMage', 'hellhound', 'ashKing', 'mimic', 'goldSlime'];
function enemyRegion(id) {
  for (const r of REGIONS) if (r.pool.includes(id) || r.elite === id || r.boss === id) return r;
  if (id === 'spiderling') return REGIONS[0];
  return null;
}

// ---------- 도감 기록 (모든 원정에 걸쳐 남는다) ----------
const DEX_KEY = 'lantern-dex-v1';
let DEX = (() => { try { return JSON.parse(localStorage.getItem(DEX_KEY)) || {}; } catch (e) { return {}; } })();
function dexMark(id, kind) {
  const d = DEX[id] || (DEX[id] = { seen: 0, kills: 0 });
  d[kind]++;
}
function saveDex() { try { localStorage.setItem(DEX_KEY, JSON.stringify(DEX)); } catch (e) {} }

// ---------- 이야기 ----------
const INTRO = [
  { bg: 'title', text: '아주 먼 옛날, 하늘에는 꺼지지 않는 해가 떠 있었다.\n사람들은 그 빛 아래에서 씨를 뿌리고 노래했다.' },
  { bg: 'ash', text: '어느 날, 잿빛 왕이 해를 삼켜 자신의 왕관 속에 가두었다.\n세상은 끝나지 않는 밤에 잠겼다.' },
  { bg: 'forest', text: '마지막 남은 해의 불씨는 작은 등불 하나에 담겼다.\n그리고 그 등불을 든 원정대가 길을 나섰다.', party: 1 },
];
const BOSS_TALK = {
  spiderQueen: ['등불의 냄새… 달콤하구나. 그 빛을 내 실타래에 감아 두마.', '그 빛은 네 장식품이 아니야!'],
  sandWyrm: ['모래 아래 잠든 왕들이 너희를 부른다. 함께 묻혀라!', '우리는 아직 갈 길이 멀어. 비켜!'],
  frostDragon: ['따뜻한 것은 모두 얼어야 한다. 너희의 등불도.', '얼음을 녹이는 건 바로 이 불씨야!'],
  ashKing: ['해는 이제 나의 왕관이다. 빛이 없는 세상의 고요함을 보아라.', '해를 돌려받으러 왔다, 잿빛 왕!'],
};
