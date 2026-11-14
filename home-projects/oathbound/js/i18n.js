'use strict';
// =============================================================
//  언어 (한국어 / English)
//  코드에는 한국어 문장을 그대로 쓰고, T('한국어') 로 감싸면
//  영어를 골랐을 때 아래 표의 영어 문장으로 바뀌어요.
//  {name} 처럼 중괄호는 나중에 값이 들어갈 자리예요.
// =============================================================

const EN = {
  // 제목·메뉴
  '검은 서약 — 기사의 보스 러시': "Oathbound — A Knight's Boss Rush",
  '검은 서약': 'OATHBOUND',
  'OATHBOUND': 'THE BLACK OATH',
  '다섯 괴물을 베어 서약을 지켜라': 'Slay five beasts. Keep the oath.',
  '전투 시작': 'Begin',
  '조작법': 'Controls',
  '돌아가기': 'Back',
  '도전할 괴물': 'Choose Your Foe',
  '처음으로': 'Title',
  '기록 지우기': 'Erase Records',
  '일시정지': 'Paused',
  '계속하기': 'Resume',
  '다시 도전': 'Retry',
  '보스 고르기로': 'Boss Select',
  '다음 보스': 'Next Boss',
  '보스 고르기': 'Boss Select',
  '그림 불러오는 중…': 'Loading…',
  // 조작법
  '이동': 'Move',
  '점프 (짧게 누르면 낮게)': 'Jump (tap for a short hop)',
  '원거리 참격 (기력 1칸)': 'Ranged slash (1 energy)',
  '근거리 공격 (3연타)': 'Melee attack (3-hit combo)',
  '패링': 'Parry',
  '대시 (잠깐 무적)': 'Dash (brief invincibility)',
  '포션 (체력 40% 회복)': 'Potion (restore 40%)',
  // HUD
  '기사': 'Knight',
  '반격 준비!': 'RIPOSTE!',
  '보스': 'Boss',
  // 보스·시련·전투장
  '묘지기 해골': 'Bone Warden',
  '등불의 망령': 'Lantern Wraith',
  '푸른 악몽마': 'Azure Nightmare',
  '지옥 야수': 'Hell Beast',
  '가시 드래곤': 'Spiked Dragon',
  '첫 번째 시련': 'First Trial',
  '두 번째 시련': 'Second Trial',
  '세 번째 시련': 'Third Trial',
  '네 번째 시련': 'Fourth Trial',
  '마지막 시련': 'Final Trial',
  '달빛 묘지': 'Moonlit Graveyard',
  '무너진 예배당': 'Ruined Chapel',
  '푸른 불꽃의 폐허': 'Ruins of Blue Flame',
  '지옥의 문턱': 'Threshold of Hell',
  '용의 둥지': "Dragon's Nest",
  // 스킬 이름
  '할퀴기 연타': 'Rending Claws',
  '뼈 던지기': 'Bone Toss',
  '땅속 이동': 'Burrow',
  '도약 내려찍기': 'Leaping Slam',
  '뼈 가시 행렬': 'Bone Spike Line',
  '해골 소환': 'Raise the Dead',
  '영혼탄 부채꼴': 'Soul Fan',
  '등불 강하': 'Lantern Dive',
  '분신 돌진': 'Phantom Rush',
  '저주의 원': 'Circle of Curses',
  '영혼 소용돌이': 'Soul Vortex',
  '돌진': 'Charge',
  '앞발 충격파': 'Hoof Quake',
  '푸른 유성': 'Azure Meteors',
  '도깨비불': "Will-o'-Wisps",
  '불꽃 고리': 'Ring of Flame',
  '3연속 돌진': 'Triple Charge',
  '화염구': 'Fireballs',
  '불기둥': 'Fire Pillars',
  '불기둥 행진': 'Pillar March',
  '화염 숨결': 'Flame Breath',
  '불꽃 순간이동': 'Flame Step',
  '손톱 연타': 'Burning Claws',
  '용암 비': 'Lava Rain',
  '물어뜯기': 'Savage Bite',
  '내려치기': 'Crushing Slam',
  '짓밟기': 'Trample',
  '화염 분사': 'Fire Spray',
  '가시 비': 'Spike Rain',
  '꼬리 가시': 'Tail Spikes',
  '화산 낙하': 'Volcanic Fall',
  '반격 폭발': 'Counter Burst',
  '분노의 포효': 'Roar of Fury',
  // 이름표 종류
  '회피': 'Dodge',
  '패링·회피': 'Parry·Dodge',
  // 전투 중 글자
  '패링!': 'PARRY!',
  '완벽!': 'PERFECT!',
  '체간 붕괴!': 'POSTURE BREAK!',
  '분노!': 'ENRAGED!',
  '기력 부족': 'No energy',
  '소리 끔': 'Sound off',
  '소리 켬': 'Sound on',
  // 보스 고르기
  '✦ 처치': '✦ Slain',
  '도전 가능': 'Available',
  '잠김': 'Locked',
  '받은 축복': 'Blessings',
  'Enter 로 도전': 'Enter to challenge',
  '최고 기록 {t}': 'Best {t}',
  '처치 기록과 축복을 모두 지울까요?': 'Erase all records and blessings?',
  // 결과
  '서약을 지켰다': 'The Oath Is Kept',
  '승리': 'Victory',
  '쓰러졌다': 'You Fell',
  '다섯 괴물이 모두 잠들었어요. 기사의 서약이 이루어졌습니다.': "All five beasts are at rest. The knight's oath is fulfilled.",
  '{name}을(를) 쓰러뜨렸어요.': '{name} has fallen.',
  '{name}에게 쓰러졌다.': 'Slain by {name}.',
  '걸린 시간 {time} · 패링 {p}번 · 받은 피해 {d} · 포션 {q}개': 'Time {time} · Parries {p} · Damage taken {d} · Potions {q}',
  '보스 남은 체력 {n}%': 'Boss HP left {n}%',
  '✦ 축복을 하나 고르세요 ✦': '✦ Choose a blessing ✦',
  '「{name}」 축복을 받았어요.': 'Blessing received: {name}',
  // 축복
  '강철 칼날': 'Steel Edge', '공격 피해 +20%': 'Attack damage +20%',
  '수호의 맹세': 'Oath of Guarding', '최대 체력 +25': 'Max HP +25',
  '예리한 눈': 'Keen Eye', '패링 판정 시간 +0.05초': 'Parry window +0.05s',
  '성수 주머니': 'Holy Water Pouch', '포션 +1개': '+1 potion',
  '반격의 서약': 'Oath of Riposte', '반격 피해 +40%': 'Riposte damage +40%',
  '바람의 발': 'Wind Step', '대시 대기 시간 -35%': 'Dash cooldown -35%',
  '피의 패링': 'Blood Parry', '패링할 때마다 체력 +4': '+4 HP per parry',
  '체간 파괴자': 'Posture Breaker', '체간 피해 +35%': 'Posture damage +35%',
  '돌 피부': 'Stone Skin', '받는 피해 -15%': 'Damage taken -15%',
  // 오류
  '그림을 못 불러왔어요: ': 'Could not load image: ',
  'assets/images 폴더가 index.html 옆에 있는지 확인해 주세요.': 'Make sure the assets/images folder is next to index.html.',
};

const I18N = {
  KEY: 'oathbound-lang',
  lang: 'ko',
  init() {
    let l = null;
    try { l = localStorage.getItem(this.KEY); } catch (e) { /* 저장소를 못 써도 괜찮아요 */ }
    if (l !== 'ko' && l !== 'en') l = (navigator.language || 'ko').toLowerCase().startsWith('ko') ? 'ko' : 'en';
    this.lang = l;
  },
  set(l) {
    this.lang = l;
    try { localStorage.setItem(this.KEY, l); } catch (e) { /* 무시 */ }
    this.applyDom();
  },
  // HTML 안의 data-i18n 표시가 붙은 글자를 모두 바꿔요 (처음 한국어는 기억해 둬요)
  applyDom() {
    document.documentElement.lang = this.lang;
    document.title = T('검은 서약 — 기사의 보스 러시');
    document.querySelectorAll('[data-i18n]').forEach(el => {
      if (el.dataset.ko === undefined) el.dataset.ko = el.innerHTML.trim();
      el.innerHTML = T(el.dataset.ko);
    });
    document.querySelectorAll('[data-lang]').forEach(b => b.classList.toggle('on', b.dataset.lang === this.lang));
  },
};

// 번역 함수: T('한국어 문장', { 이름: 값 })
function T(ko, vars) {
  let s = I18N.lang === 'en' && EN[ko] !== undefined ? EN[ko] : ko;
  if (vars) for (const k in vars) s = s.split('{' + k + '}').join(vars[k]);
  return s;
}
