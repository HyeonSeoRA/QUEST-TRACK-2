'use strict';
/* 게임 자료: 아이템, 스테이지, 이야기, 능력치 계산 */

/* ---------- 아이템 ---------- */
const ITEMS = {
  // 무기
  w0: { type: 'weapon', name: '나무 검', icon: 'sword', col: '#b08a5a', atk: 0, price: 0, desc: '마을 대장간에서 받은 연습용 검.' },
  w1: { type: 'weapon', name: '강철 검', icon: 'sword', col: '#b4c4dc', atk: 4, price: 300, desc: '잘 벼린 강철 검. 공격력 +4' },
  w2: { type: 'weapon', name: '수정 검', icon: 'sword', col: '#7ff0ff', atk: 9, price: 900, desc: '수정 동굴의 결정으로 만든 검. 공격력 +9' },
  w3: { type: 'weapon', name: '별빛 검', icon: 'sword', col: '#ffe08a', atk: 15, price: 2200, desc: '밤하늘의 별을 담은 검. 공격력 +15' },
  w4: { type: 'weapon', name: '선율의 검', icon: 'sword', col: '#ff9ad0', atk: 22, price: 0, drop: true, desc: '세상의 노래가 깃든 전설의 검. 공격력 +22' },
  // 방어구
  a0: { type: 'armor', name: '여행자 옷', icon: 'armor', col: '#34508f', def: 0, hp: 0, price: 0, desc: '튼튼한 천으로 지은 여행복.' },
  a1: { type: 'armor', name: '가죽 갑옷', icon: 'armor', col: '#9a6a3a', def: 2, hp: 15, price: 250, desc: '방어력 +2, 최대 HP +15' },
  a2: { type: 'armor', name: '사슬 갑옷', icon: 'armor', col: '#a0a8b8', def: 4, hp: 30, price: 750, desc: '방어력 +4, 최대 HP +30' },
  a3: { type: 'armor', name: '수정 갑주', icon: 'armor', col: '#8ae0ff', def: 7, hp: 50, price: 1800, desc: '방어력 +7, 최대 HP +50' },
  // 장신구
  c1: { type: 'acc', name: '바람의 깃털', icon: 'feather', col: '#c8f0ff', win: 15, price: 500, desc: '판정이 너그러워져요. (GOOD 범위 +15ms)' },
  c2: { type: 'acc', name: '붉은 부적', icon: 'amulet', col: '#ff5a5a', burst: 0.35, price: 600, desc: '버스트 게이지가 35% 빨리 차요.' },
  c3: { type: 'acc', name: '행운의 동전', icon: 'ring', col: '#ffe08a', gold: 0.4, price: 400, desc: '얻는 골드 +40%' },
  c4: { type: 'acc', name: '생명의 반지', icon: 'ring', col: '#ff8ab0', hp: 25, heal: 2, price: 900, desc: '최대 HP +25, 물약 회복량 2배' },
  c5: { type: 'acc', name: '숲의 축복', icon: 'amulet', col: '#8aff9a', hp: 10, burst: 0.2, atk: 2, price: 0, drop: true, desc: '고목의 수호자가 준 부적. 공격 +2, HP +10, 버스트 +20%' },
  c6: { type: 'acc', name: '비룡의 비늘', icon: 'amulet', col: '#7ab8ff', def: 3, win: 10, price: 0, drop: true, desc: '수정 비룡의 비늘. 방어 +3, 판정 +10ms' },
};
const SHOP = ['w1', 'w2', 'w3', 'a1', 'a2', 'a3', 'c1', 'c2', 'c3', 'c4'];
const SLOT_NAME = { weapon: '무기', armor: '방어구', acc: '장신구' };

/* ---------- 레벨과 능력치 ---------- */
const MAX_LV = 20;
function expNext(L) { return Math.round(50 + (L - 1) * L * 12 + (L - 1) * 25); }
/* ---------- 장비 강화 (+1 ~ +10) ---------- */
const ENH_MAX = 10;
function enhLv(sv, id) { return (id && sv.enh && sv.enh[id]) || 0; }
function itemName(sv, id) { const n = enhLv(sv, id); return ITEMS[id].name + (n ? ` +${n}` : ''); }
function enhBonus(id, lv) {   // 강화로 늘어나는 능력치
  const it = ITEMS[id];
  return it.type === 'weapon' ? { atk: lv * (2 + Math.floor((it.atk || 0) * 0.12)) } : { def: lv, hp: lv * 6 };
}
function enhCost(id, lv) {
  const it = ITEMS[id], base = it.price || (it.drop ? 1600 : 120);
  return { gold: Math.round(base * 0.2 * (lv + 1) + 40 * lv), stones: lv < 3 ? 0 : lv - 1, rate: [1, 1, 1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3][lv] };
}
function stats(sv) {
  const w = ITEMS[sv.weapon], a = ITEMS[sv.armor], c = sv.acc ? ITEMS[sv.acc] : {};
  const L = sv.lv, bw = enhBonus(sv.weapon, enhLv(sv, sv.weapon)), ba = enhBonus(sv.armor, enhLv(sv, sv.armor));
  return {
    maxHp: 100 + (L - 1) * 10 + (a.hp || 0) + (c.hp || 0) + (ba.hp || 0),
    atk: 12 + (L - 1) * 3 + w.atk + (c.atk || 0) + (bw.atk || 0),
    def: Math.floor((L - 1) * 0.5) + (a.def || 0) + (c.def || 0) + (ba.def || 0),
    burst: 1 + (c.burst || 0),
    win: (c.win || 0) / 1000,
    heal: c.heal || 1,
    gold: 1 + (c.gold || 0),
  };
}

/* ---------- 스테이지 (곡) ---------- */
const CHAPTERS = [
  { name: '제1장  속삭이는 숲', theme: 'forest', enemies: ['slime', 'bat'], boss: 'treant', bossName: '고목의 수호자', atk: 8 },
  { name: '제2장  수정 동굴', theme: 'cave', enemies: ['beetle', 'shard'], boss: 'wyrm', bossName: '수정 비룡', atk: 12 },
  { name: '제3장  망각의 성', theme: 'castle', enemies: ['knight', 'wraith'], boss: 'lord', bossName: '망각의 군주', atk: 16 },
];
const STAGES = [
  { id: '1-1', ch: 0, name: '숲의 입구', rec: 1, bpm: 100, root: 57, seed: 101, pw: 0, lead: 'flute', arp: 'pluck', drums: 'light',
    prog: [[0, 'M'], [5, 'M'], [9, 'm'], [7, 'M']], sections: [['intro', 4], ['A', 8], ['B', 8], ['outro', 2]],
    desc: '햇살이 비치는 숲길. 슬라임과 박쥐가 길을 막고 있어요.', exp: 60, gold: 4 },
  { id: '1-2', ch: 0, name: '반딧불 오솔길', rec: 2, bpm: 108, root: 55, seed: 102, pw: 0, lead: 'flute', arp: 'pluck', drums: 'light',
    prog: [[0, 'M'], [7, 'M'], [9, 'm'], [5, 'M']], sections: [['intro', 4], ['A', 8], ['B', 8], ['brk', 4], ['B', 8], ['outro', 2]],
    desc: '반딧불이 춤추는 깊은 숲. 긴 노트가 처음 나와요.', exp: 90, gold: 5 },
  { id: '1-3', ch: 0, name: '고목의 수호자', rec: 3, bpm: 112, root: 52, seed: 103, pw: 0, lead: 'flute', arp: 'pluck', drums: 'normal', boss: true,
    prog: [[0, 'm'], [8, 'M'], [10, 'M'], [0, 'm']], sections: [['intro', 4], ['A', 8], ['B', 8], ['brk', 4], ['drop', 8], ['outro', 2]],
    desc: '숲의 가장 오래된 나무가 망각에 홀렸어요. [보스]', exp: 150, gold: 7, drop: 'c5' },
  { id: '2-1', ch: 1, name: '푸른 수정길', rec: 4, bpm: 118, root: 50, seed: 201, pw: 1, lead: 'bell', arp: 'pluck', drums: 'normal',
    prog: [[0, 'm'], [10, 'M'], [8, 'M'], [7, 'M']], sections: [['intro', 4], ['A', 8], ['B', 8], ['brk', 4], ['drop', 8], ['outro', 2]],
    desc: '빛나는 수정이 가득한 동굴. 노랫소리가 메아리쳐요.', exp: 180, gold: 8 },
  { id: '2-2', ch: 1, name: '울림의 호수', rec: 5, bpm: 124, root: 53, seed: 202, pw: 1, lead: 'bell', arp: 'pluck', drums: 'normal',
    prog: [[0, 'M'], [2, 'M'], [9, 'm'], [7, 'M']], sections: [['intro', 4], ['A', 8], ['B', 8], ['drop', 8], ['brk', 4], ['drop', 8], ['outro', 2]],
    desc: '지하 호수 위로 수정 정령이 떠다녀요.', exp: 230, gold: 9 },
  { id: '2-3', ch: 1, name: '수정 비룡', rec: 6, bpm: 128, root: 49, seed: 203, pw: 1, lead: 'bell', arp: 'arp', drums: 'normal', boss: true,
    prog: [[0, 'm'], [9, 'M'], [4, 'M'], [11, 'M']], sections: [['intro', 4], ['A', 8], ['B', 8], ['brk', 4], ['drop', 8], ['B', 8], ['drop', 8], ['outro', 2]],
    desc: '동굴 깊은 곳, 수정을 지키는 비룡이 깨어났어요. [보스]', exp: 360, gold: 11, drop: 'c6' },
  { id: '3-1', ch: 2, name: '무너진 성문', rec: 7, bpm: 136, root: 50, seed: 301, pw: 2, lead: 'lead', arp: 'arp', drums: 'heavy',
    prog: [[0, 'm'], [8, 'M'], [5, 'm'], [7, 'M']], sections: [['intro', 4], ['A', 8], ['B', 8], ['brk', 4], ['drop', 8], ['outro', 2]],
    desc: '달빛 아래 무너진 성문. 검은 기사들이 지키고 있어요.', exp: 400, gold: 12 },
  { id: '3-2', ch: 2, name: '달빛 회랑', rec: 8, bpm: 142, root: 52, seed: 302, pw: 2, lead: 'lead', arp: 'arp', drums: 'heavy',
    prog: [[0, 'm'], [3, 'M'], [10, 'M'], [11, 'M']], sections: [['intro', 4], ['A', 8], ['B', 8], ['drop', 8], ['brk', 4], ['drop', 8], ['outro', 2]],
    desc: '망령이 떠도는 긴 회랑. 왕좌가 가까워요.', exp: 480, gold: 14 },
  { id: '3-3', ch: 2, name: '망각의 군주', rec: 10, bpm: 150, root: 52, seed: 303, pw: 2, lead: 'lead', arp: 'arp', drums: 'heavy', boss: true,
    prog: [[0, 'm'], [5, 'm'], [8, 'M'], [7, 'M']], sections: [['intro', 4], ['A', 8], ['B', 8], ['drop', 8], ['brk', 4], ['B', 8], ['drop', 16], ['outro', 2]],
    desc: '세상의 소리를 빼앗은 자. 마지막 결전이에요. [최종 보스]', exp: 700, gold: 18, drop: 'w4' },
];
// 메뉴 화면 배경 음악 (채보 없음)
const BGM_DEFS = {
  title: { bpm: 84, root: 57, seed: 7, pw: 0, lead: 'bell', arp: 'pluck', drums: 'none', prog: [[0, 'm'], [8, 'M'], [3, 'M'], [10, 'M']], sections: [['A', 8], ['B', 8]] },
  map: { bpm: 100, root: 55, seed: 8, pw: 0, lead: 'flute', arp: 'pluck', drums: 'light', prog: [[0, 'M'], [5, 'M'], [7, 'M'], [0, 'M']], sections: [['A', 8], ['B', 8]] },
  town: { bpm: 92, root: 53, seed: 9, pw: 0, lead: 'flute', arp: 'pluck', drums: 'none', prog: [[0, 'M'], [9, 'm'], [5, 'M'], [7, 'M']], sections: [['A', 8], ['B', 8]] },
};

/* ---------- 지도 위치 (0번 = 마을) ---------- */
const MAP_NODES = [
  { x: 62, y: 190, town: true, name: '하르모니아 마을' },
  { x: 110, y: 174 }, { x: 156, y: 154 }, { x: 204, y: 172 },
  { x: 254, y: 140 }, { x: 292, y: 108 }, { x: 334, y: 130 },
  { x: 372, y: 96 }, { x: 402, y: 66 }, { x: 440, y: 42 },
];
function nodeUnlocked(sv, i) { return i <= 1 || !!sv.cleared[STAGES[i - 2].id]; }

/* ---------- 이야기 ---------- */
const WHO = {
  ria: { name: '리아', pt: 'pt_ria', col: '#ffd0e0' },
  lumi: { name: '루미', pt: 'pt_lumi', col: '#fff2a0' },
  elder: { name: '촌장', pt: 'pt_elder', col: '#c8f0c0' },
  treant: { name: '고목의 수호자', pt: 'pt_treant', col: '#ffd080' },
  wyrm: { name: '수정 비룡', pt: 'pt_wyrm', col: '#9ff6ff' },
  lord: { name: '망각의 군주', pt: 'pt_lord', col: '#ff8ab8' },
};
const STORY = {
  prologue: { bg: 'town', lines: [
    [null, '세상의 모든 소리는, 하나의 커다란 선율에서 태어났다.'],
    [null, '그러나 어느 날 밤, 망각의 군주가 세 개의 \'선율의 수정\'을 빼앗아 갔고…\n세상은 조금씩 노래를 잃어 가기 시작했다.'],
    ['elder', '리아… 오늘 아침엔 숲의 새소리마저 들리지 않는구나.'],
    ['ria', '촌장님, 제가 가겠어요. 이 검이라면 박자를 따라 싸울 수 있어요.'],
    ['lumi', '나도 같이 갈게! 선율의 요정 루미, 길 안내는 나한테 맡겨!'],
    ['elder', '고맙구나. 마을 상점에서 장비를 갖추고 가거라. 무리하지 말고.'],
    ['lumi', '기억해, 리아. 적들은 음악의 박자에 맞춰 다가와.\n하늘의 적은 D·F, 땅의 적은 J·K! 소리를 잘 들으면 반드시 벨 수 있어.'],
    ['ria', '좋아. 가자, 루미!'],
  ] },
  boss0: { bg: 'forest', lines: [
    ['treant', '…누가… 숲의 오랜 잠을 깨우는가…'],
    ['ria', '수호자님! 정신 차리세요! 숲이 울고 있어요!'],
    ['lumi', '망각의 기운에 홀린 거야! 리아, 음악으로 깨워 주자!'],
  ] },
  ch0: { bg: 'forest', lines: [
    ['treant', '…아아, 이제야 바람 소리가 들리는구나. 고맙다, 작은 검사여.'],
    ['treant', '이것은 첫 번째 선율의 수정이다. 그리고… 내 축복을 함께 가져가거라.'],
    [null, '\'초록 수정\'과 \'숲의 축복\'을 얻었다!'],
    ['lumi', '다음은 수정 동굴이야. 옛날엔 동굴 전체가 노래했다던데…'],
  ] },
  boss1: { bg: 'cave', lines: [
    ['wyrm', '크르르… 이 반짝이는 수정은 이제 나의 것이다!'],
    ['ria', '그건 세상의 노래야. 돌려줘!'],
    ['wyrm', '가져갈 수 있다면 가져가 보아라, 꼬마!'],
  ] },
  ch1: { bg: 'cave', lines: [
    ['wyrm', '…빛이… 다시 노래하는군. 내가 무엇에 홀려 있었던 것인가.'],
    ['wyrm', '가거라. 망각의 군주는 북쪽의 성에 있다. 이 비늘이 너를 지켜 줄 것이다.'],
    [null, '\'푸른 수정\'과 \'비룡의 비늘\'을 얻었다!'],
    ['lumi', '마지막이야, 리아. 성은 많이 위험할 거야. 꼭 준비하고 가자.'],
  ] },
  boss2: { bg: 'castle', lines: [
    ['lord', '어리석은 검사여. 소리 없는 세상이야말로 완전한 고요다.'],
    ['ria', '고요는 쉼표일 뿐이야. 쉼표가 끝나면, 음악은 다시 시작돼!'],
    ['lumi', '리아, 마지막 박자까지 함께야!'],
    ['lord', '그렇다면… 그 노래째로 잊혀지거라!'],
  ] },
  ending: { bg: 'castle', lines: [
    ['lord', '…이 선율은… 내가 오래전에… 잊고 있던…'],
    [null, '세 개의 수정이 하늘로 떠오르자, 세상에 다시 노래가 울려 퍼졌다.'],
    ['lumi', '해냈어, 리아! 들려? 바람도, 새도, 모두 노래하고 있어!'],
    ['ria', '응. 이제… 돌아가자. 모두가 노래하는 마을로.'],
    [null, '\'선율의 검\'을 얻었다!'],
  ] },
};
const STORY_BEFORE = { '1-3': 'boss0', '2-3': 'boss1', '3-3': 'boss2' };
const STORY_AFTER = { '1-3': 'ch0', '2-3': 'ch1', '3-3': 'ending' };

// 글꼴을 미리 불러오기 위해 게임에 나오는 모든 글자를 모아요
function allGameText() {
  return JSON.stringify([ITEMS, STAGES.map(s => [s.name, s.desc]), CHAPTERS, STORY, WHO, MAP_NODES]) +
    '대장간강화성공실패마정석확률엘리트최대단계부족해요재료+-0123456789새로 시작이어하기설정상점장비상태휴식기록떠나기마을지도출격취소보통어려움난이도추천레벨골드경험치공격력방어력최대체력버스트판정속도음량오프셋확인돌아가기구매보유장착해제없음다시도전승리패배보스획득레벨업처음부터저장했습니다계속타이틀로일시정지완료최고점수랭크정확도콤보도망쳤다';
}
