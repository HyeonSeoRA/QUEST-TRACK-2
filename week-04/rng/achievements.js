'use strict';
// 업적 — 조건을 채우면 코인을 준다

const foundCount = () => AURAS.filter(a => S.found[a.id]).length;
const bestTier = () => S.best ? byId(S.best).tier : -1;
const TIER_REWARD = [0, 20, 100, 500, 5000, 50000, 1e6, 1e8];

const ACH = [
  { id: 'r1',    icon: '🎲', name: '첫 굴림',      desc: '처음으로 굴리기',            reward: 10,     goal: 1,    now: () => S.rolls },
  { id: 'r100',  icon: '🎲', name: '백 번의 운명', desc: '100번 굴리기',               reward: 100,    goal: 100,  now: () => S.rolls },
  { id: 'r1k',   icon: '🎲', name: '천 번의 운명', desc: '1,000번 굴리기',             reward: 1000,   goal: 1e3,  now: () => S.rolls },
  { id: 'r10k',  icon: '🎰', name: '만 번의 운명', desc: '10,000번 굴리기',            reward: 10000,  goal: 1e4,  now: () => S.rolls },
  { id: 'r100k', icon: '🎰', name: '운명 중독',    desc: '100,000번 굴리기',           reward: 200000, goal: 1e5,  now: () => S.rolls },
  ...[1, 2, 3, 4, 5, 6, 7].map(t => ({
    id: 't' + t, icon: ['', '🔹', '💠', '🔮', '🌟', '🌌', '🪐', '♾️'][t], name: `${TIER_NAME[t]} 발견`,
    desc: `${TIER_NAME[t]} 등급 오라를 처음 얻기`, reward: TIER_REWARD[t], goal: 1, now: () => bestTier() >= t ? 1 : 0,
  })),
  ...[5, 10, 15, 20].map(n => ({
    id: 'b' + n, icon: '📖', name: `수집가 ${n}`, desc: `도감 ${n}칸 채우기`, reward: n * n * 20, goal: n, now: foundCount,
  })),
  { id: 'potion', icon: '🧪', name: '첫 물약',     desc: '물약 마시기',                    reward: 50,    goal: 1,   now: () => S.potionsUsed },
  { id: 'pot50',  icon: '⚗️', name: '물약 중독',   desc: '물약 50병 마시기',               reward: 5000,  goal: 50,  now: () => S.potionsUsed },
  { id: 'event',  icon: '☄️', name: '하늘을 본 자', desc: '이벤트 중에 50번 굴리기',       reward: 500,   goal: 50,  now: () => S.eventRolls },
  { id: 'deja',   icon: '🔁', name: '데자뷔',       desc: '먼지가 아닌 같은 오라 3번 연속', reward: 300,   goal: 1,   now: () => S.streak.n >= 3 && S.streak.id !== 'dust' ? 1 : 0 },
  { id: 'pity',   icon: '⚡', name: '불운의 끝',    desc: '운명 게이지를 가득 채우기',      reward: 1000,  goal: 1,   now: () => S.pityUsed },
  { id: 'rich',   icon: '💰', name: '코인 부자',    desc: '코인 100,000개 가지기',          reward: 10000, goal: 1e5, now: () => S.coins },
  { id: 'clover', icon: '☘️', name: '행운의 정원',  desc: '네잎클로버 10단계',              reward: 20000, goal: 10,  now: () => S.clover },
];

function checkAch() {
  for (const a of ACH) {
    if (S.ach[a.id] || a.now() < a.goal) continue;
    S.ach[a.id] = Date.now();
    S.coins += a.reward; S.coinsEarned += a.reward;
    achPopup(a);
  }
}
function achPopup(a) {
  const el = document.createElement('div');
  el.className = 'ach';
  el.innerHTML = `<small>업적 달성</small><b>${a.icon} ${a.name}</b><span>${a.desc} · +${fmt(a.reward)} 🪙</span>`;
  $('#achPop').appendChild(el);
  SFX.ach();
  setTimeout(() => el.remove(), 4200);
}

function renderAch() {
  const done = ACH.filter(a => S.ach[a.id]).length;
  $('#mTitle').textContent = `업적 ${done} / ${ACH.length}`;
  const best = S.best ? byId(S.best) : null;
  const tierCount = [0, 0, 0, 0, 0, 0, 0, 0];
  for (const a of AURAS) tierCount[a.tier] += S.found[a.id] || 0;
  mBody.innerHTML = `
    <h4>통계</h4>
    <div class="statGrid">
      <div><span>굴린 횟수</span><b>${fmt(S.rolls)}</b></div>
      <div><span>모은 코인 (전체)</span><b>${fmt(S.coinsEarned)}</b></div>
      <div><span>가장 귀한 오라</span><b style="color:${best ? mainColor(best) : ''}">${best ? `${best.name} · 1/${kor(best.odds)}` : '-'}</b></div>
      <div><span>플레이 시간</span><b>${fmtTime(S.playMs)}</b></div>
      <div><span>마신 물약</span><b>${fmt(S.potionsUsed)}병</b></div>
      <div><span>만난 이벤트</span><b>${fmt(S.eventsSeen)}번</b></div>
    </div>
    <div class="tierBars">${TIER_NAME.map((n, t) => `<div><span>${n}</span><i style="width:${S.rolls ? Math.max(tierCount[t] ? 2 : 0, tierCount[t] / S.rolls * 100) : 0}%"></i><em>${fmt(tierCount[t])}</em></div>`).join('')}</div>
    <h4>업적</h4>
    ${ACH.map(a => {
      const ok = S.ach[a.id], p = Math.min(1, a.now() / a.goal);
      return `<div class="item achRow ${ok ? 'done' : ''}"><div class="ic">${a.icon}</div>
        <div class="info"><b>${a.name}</b><i>${a.desc}</i>
          ${ok ? '' : `<div class="prog"><i style="width:${p * 100}%"></i></div>`}</div>
        <em class="rw">${ok ? '✔ 달성' : '+' + fmt(a.reward) + ' 🪙'}</em></div>`;
    }).join('')}`;
}
