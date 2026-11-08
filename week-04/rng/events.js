'use strict';
// 하늘 이벤트 — 몇 분마다 찾아와서 잠깐 동안 규칙을 바꾼다

const EVENTS = [
  { id: 'meteor',    name: '유성우',    icon: '☄️', desc: '행운 ×3',                secs: 90,  luck: 3,  color: '#7fd6ff' },
  { id: 'bloodmoon', name: '붉은 달',   icon: '🌕', desc: '에픽 이상 확률 ×5',      secs: 75,  tierMin: 3, tierMult: 5, color: '#ff3b5c' },
  { id: 'gold',      name: '황금 시간', icon: '💰', desc: '코인 ×3',                secs: 90,  coin: 3,  color: '#ffd36b' },
  { id: 'calm',      name: '고요한 밤', icon: '🌙', desc: '자동 굴리기 2배 빠르게', secs: 120, speed: 2, color: '#9be3b8' },
  { id: 'storm',     name: '은하 폭풍', icon: '🌀', desc: '행운 ×10',               secs: 40,  luck: 10, color: '#b45cff', rare: true },
];
const nextGap = first => DEMO ? 15e3 : (first ? 90e3 : 180e3) + Math.random() * 150e3;

let EV = null, evEnd = 0, evNext = performance.now() + nextGap(true);

function startEvent(e) {
  EV = e; evEnd = performance.now() + e.secs * 1000;
  S.eventsSeen++;
  document.body.dataset.event = e.id;
  document.body.style.setProperty('--ec', e.color);
  flash(e.color, 700); SFX.event();
  toast(`${e.icon} ${e.name} 시작! ${e.desc}`);
  updateUI();
}
function endEvent() {
  toast(`${EV.icon} ${EV.name} 이 끝났어요`);
  EV = null; evNext = performance.now() + nextGap(false);
  delete document.body.dataset.event;
  updateUI();
}
function tickEvents() {
  const now = performance.now();
  if (EV && now >= evEnd) endEvent();
  else if (!EV && now >= evNext && !cineOn) {
    const pool = EVENTS.filter(e => !e.rare || Math.random() < 0.4);
    startEvent(pool[Math.random() * pool.length | 0]);
  }
  const el = $('#event');
  el.hidden = !EV;
  if (EV) el.innerHTML = `<b>${EV.icon} ${EV.name}</b> · ${EV.desc} · ${Math.max(0, Math.ceil((evEnd - now) / 1000))}초`;
}
