'use strict';
// 화면 — 상태 표시, 도감·상점·업적·자동 설정 창, 버튼

function renderOrb() {
  const a = byId(S.equipped), col = mainColor(a), wrap = $('#orbWrap');
  wrap.className = 't' + a.tier;
  wrap.style.setProperty('--oc', col);
  orb.className = a.c[0] === 'rainbow' ? 'rainbow' : a.c[0] === 'white' ? 'divine' : '';
  const [c1, c2] = cssPair(a);
  orb.style.background = `radial-gradient(circle at 35% 30%, #fff 0%, ${c2} 28%, ${c1} 70%, #000 125%)`;
  orb.style.boxShadow = `0 0 ${20 + a.tier * 14}px ${col}, 0 0 ${60 + a.tier * 30}px ${col}55, inset 0 0 20px #ffffff44`;
  $('#equip').innerHTML = `장착한 오라 · <b style="color:${col}">${a.name}</b> · 1 / ${kor(a.odds)}` +
    (AURA_BONUS[a.tier] ? ` · <span class="bonus">행운 +${AURA_BONUS[a.tier]}</span>` : '');
}

function renderLog() {
  $('#log').innerHTML = '<h3>희귀 기록</h3>' + (S.log.length
    ? S.log.map(l => { const a = byId(l.id); return `<div style="color:${mainColor(a)}">#${fmt(l.n)} <b>${a.name}</b><span>1/${kor(a.odds)}</span></div>`; }).join('')
    : '<p>1/1,000 보다 귀한 오라를 얻으면 여기에 남아요</p>');
}

function updateUI() {
  $('#sRolls').textContent = fmt(S.rolls);
  $('#sCoins').textContent = fmt(S.coins);
  const luck = luckInfo(S.rolls + 1), sl = $('#sLuck');
  sl.textContent = '×' + fmtLuck(luck); sl.classList.toggle('hot', luck > 1);
  const best = S.best ? byId(S.best) : null, sb = $('#sBest');
  sb.textContent = best ? best.name : '-'; sb.style.color = best ? mainColor(best) : '';

  const n = S.rolls + 1, k10 = (10 - n % 10) % 10, k100 = (100 - n % 100) % 100;
  $('#luckBar').innerHTML =
    (autoOn ? `<span class="auto">🤖 자동 ${fmt(autoCount)}번 · ${autoRate()}번/초</span>` : '') +
    `<span class="${k10 === 0 && k100 !== 0 ? 'now' : ''}">🎲 행운 굴림 ×2 · ${k10 === 0 ? '이번!' : k10 + '번 뒤'}</span>` +
    `<span class="${k100 === 0 ? 'now' : ''}">🌟 대운 굴림 ×10 · ${k100 === 0 ? '이번!' : k100 + '번 뒤'}</span>` +
    (S.clover ? `<span>☘️ 클로버 +${S.clover * 0.5}</span>` : '') +
    S.potions.map(p => `<span class="potion">${p.icon} ×${fmt(p.mult)} · ${p.left}번</span>`).join('');

  const full = pityFull();
  $('#pity').classList.toggle('full', full);
  $('#pityFill').style.width = Math.min(100, (S.pity + (full ? 1 : 0)) / PITY_MAX * 100) + '%';
  $('#pityText').textContent = full ? '⚡ 운명 게이지 가득! 다음 굴림은 에픽 이상 확정'
    : `운명 게이지 ${fmt(S.pity)} / ${fmt(PITY_MAX)} · 에픽 없이 가득 차면 에픽 이상 확정`;

  const ba = $('#btnAuto');
  ba.classList.toggle('on', autoOn); ba.textContent = autoOn ? '🤖 ON' : '🤖 자동';
  $('#btnRoll').textContent = autoOn ? '자동 굴리는 중 · 멈추기' : '굴리기';
  $('#btnFast').classList.toggle('on', S.fast);
  $('#btnSound').classList.toggle('on', S.sound);
  $('#btnSound').textContent = S.sound ? '🔊' : '🔇';
  $('#achDot').hidden = !ACH.some(a => !S.ach[a.id] && a.now() >= a.goal);
  renderOrb(); renderLog();
  if (modalMode === 'shop') refreshShop();
}

// ---------- 창 ----------
let modalMode = null;
const mBody = $('#mBody');
function openModal(mode) {
  modalMode = mode; $('#modal').hidden = false;
  ({ book: renderBook, shop: renderShop, ach: renderAch, auto: renderAutoCfg })[mode]();
}
function closeModal() { modalMode = null; $('#modal').hidden = true; }

function renderBook() {
  $('#mTitle').textContent = `도감 ${foundCount()} / ${AURAS.length}`;
  mBody.innerHTML = AURAS.map(a => {
    const has = S.found[a.id], show = has || DEMO;
    const dot = a.c[0] === 'rainbow' ? 'rainbow' : a.c[0] === 'white' ? 'divine' : '';
    return `<div class="card ${show ? '' : 'locked'}" style="--c:${mainColor(a)}">
      <div class="dot ${dot}"></div>
      <div class="info">
        <b style="color:${show ? mainColor(a) : ''}">${show ? a.name : '???'} <small>${show ? a.en + ' · ' : ''}${TIER_NAME[a.tier]}</small></b>
        <span>1 / ${fmt(a.odds)} (${kor(a.odds)} 분의 1)${AURA_BONUS[a.tier] ? ` · 장착하면 행운 +${AURA_BONUS[a.tier]}` : ''}</span>
        <i>${show ? a.desc : '아직 만나지 못했다'}</i>
      </div>
      ${show ? `<div class="acts">
        <em>×${fmt(has || 0)}</em>
        ${has ? `<button data-equip="${a.id}" ${S.equipped === a.id ? 'disabled' : ''}>${S.equipped === a.id ? '장착 중' : '장착'}</button>` : ''}
        <button data-replay="${a.id}">다시 보기</button>
      </div>` : ''}
    </div>`;
  }).join('') + '<button class="resetBtn" data-reset>기록 모두 지우기</button>';
}

function renderShop() {
  $('#mTitle').textContent = '상점';
  mBody.innerHTML = `<p class="coins">가진 코인: <b id="shopCoins">${fmt(S.coins)}</b> 🪙 <small>(귀한 오라일수록 코인을 많이 줘요)</small></p>
    <h4>물약 <small>· 여러 개 마시면 행운이 곱해져요</small></h4>
    ${SHOP.map(it => `<div class="item"><div class="ic">${it.icon}</div>
      <div class="info"><b>${it.name}</b><i>${it.desc}</i></div>
      <button data-buy="${it.id}" data-cost="${it.cost}">${fmt(it.cost)} 🪙</button></div>`).join('')}
    <h4>영구 강화</h4>
    ${UPGRADES.map(u => `<div class="item"><div class="ic">${u.icon}</div>
      <div class="info"><b>${u.name} <small id="lv-${u.id}"></small></b><i>${u.desc}</i></div>
      <button data-up="${u.id}"></button></div>`).join('')}`;
  refreshShop();
}
function refreshShop() { // 버튼을 새로 만들지 않고 상태만 바꿔서, 자동 굴리기 중에도 클릭이 끊기지 않게
  const c = $('#shopCoins'); if (!c) return;
  c.textContent = fmt(S.coins);
  mBody.querySelectorAll('[data-buy]').forEach(b => { b.disabled = S.coins < +b.dataset.cost; });
  for (const u of UPGRADES) {
    const lv = S[u.id], b = mBody.querySelector(`[data-up="${u.id}"]`), max = lv >= u.max;
    $('#lv-' + u.id).textContent = `Lv.${lv}` + (u.id === 'hourglass' ? ` · ${Math.max(90, 600 - lv * 85)}ms` : ` · +${lv * 0.5}`);
    b.textContent = max ? '최대' : fmt(upCost(u)) + ' 🪙';
    b.disabled = max || S.coins < upCost(u);
  }
}

mBody.addEventListener('click', async e => {
  const b = e.target.closest('button'); if (!b) return;
  ensureAudio();
  if (b.dataset.buy) {
    buyPotion(SHOP.find(s => s.id === b.dataset.buy));
  } else if (b.dataset.up) {
    const u = UPGRADES.find(x => x.id === b.dataset.up), cost = upCost(u);
    if (S[u.id] >= u.max || S.coins < cost) return;
    S.coins -= cost; S[u.id]++;
    SFX.chime(); checkAch(); save(); updateUI();
  } else if (b.dataset.equip) {
    S.equipped = b.dataset.equip; save(); updateUI(); renderBook();
  } else if (b.dataset.replay) {
    if (busy) { toast('굴림이 끝나면 다시 볼 수 있어요'); return; }
    closeModal();
    busy = true;
    await reveal(byId(b.dataset.replay), { replay: true });
    busy = false;
  } else if ('autotoggle' in b.dataset) {
    toggleAuto();
    if (autoOn) closeModal();
  } else if ('reset' in b.dataset) {
    if (!confirm('정말 모든 기록을 지울까요? 되돌릴 수 없어요.')) return;
    toggleAuto(false); S = fresh(); save(); updateUI(); renderBook();
  }
});
mBody.addEventListener('change', e => {
  const k = e.target.dataset.cfg; if (!k) return;
  S.auto[k] = e.target.type === 'checkbox' ? e.target.checked : k === 'autoBuy' ? e.target.value : +e.target.value;
  save();
});

// ---------- 버튼 ----------
const press = (id, fn) => $(id).addEventListener('click', e => { e.currentTarget.blur(); fn(); });
press('#btnRoll', () => autoOn ? toggleAuto(false) : roll());
press('#btnAuto', () => toggleAuto());
press('#btnAutoCfg', () => openModal('auto'));
press('#btnFast', () => { S.fast = !S.fast; save(); updateUI(); });
press('#btnSound', () => { S.sound = !S.sound; save(); updateUI(); });
press('#btnBook', () => openModal('book'));
press('#btnShop', () => openModal('shop'));
press('#btnAch', () => openModal('ach'));
press('#mClose', closeModal);
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
addEventListener('keydown', e => {
  if (e.key === 'Escape') return closeModal();
  if (!$('#modal').hidden || e.target.tagName === 'SELECT') return;
  if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); if (!autoOn) roll(); }
  if (e.code === 'KeyA') toggleAuto();
});

// ---------- 시작 ----------
setInterval(tickEvents, 500);
setInterval(() => { if (autoOn) updateUI(); }, 1000);
requestAnimationFrame(frame);
checkAch();
updateUI();
