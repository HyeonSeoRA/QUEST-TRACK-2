'use strict';
// 자동 굴리기 — 멈춤 조건, 정해진 횟수, 물약 자동 구매

let autoOn = false, autoCount = 0, autoStart = 0, autoToken = 0;

function autoInterval() {
  const base = Math.max(90, 600 - S.hourglass * 85);
  return EV && EV.speed ? base / EV.speed : base;
}

function toggleAuto(on = !autoOn) {
  autoOn = on;
  if (on) { autoCount = 0; autoStart = performance.now(); ensureAudio(); autoLoop(++autoToken); }
  updateUI();
  if (modalMode === 'auto') renderAutoCfg();
}

async function autoLoop(token) {
  while (autoOn && token === autoToken) {
    autoBuy();
    const r = await roll(true);
    if (!autoOn || token !== autoToken) break;
    if (r) {
      autoCount++;
      const why = stopReason(r.aura, r.isNew);
      if (why) { toggleAuto(false); toast(`🤖 자동 멈춤 · ${why}`); break; }
    }
    await sleep(autoInterval());
  }
}

function stopReason(a, isNew) {
  const c = S.auto;
  if (c.stopTier && a.tier >= c.stopTier) return `${a.name} (${TIER_NAME[a.tier]}) 등장!`;
  if (c.stopNew && isNew) return `새 오라 ${a.name} 발견!`;
  if (c.limit && autoCount >= c.limit) return `${fmt(c.limit)}번 굴리기 완료`;
  return '';
}

function autoBuy() { // 고른 물약이 다 떨어지면 코인이 있을 때 다시 마신다
  const it = SHOP.find(s => s.id === S.auto.autoBuy);
  if (it && !S.potions.some(p => p.id === it.id) && S.coins >= it.cost) buyPotion(it, true);
}

const autoRate = () => {
  const sec = (performance.now() - autoStart) / 1000;
  return sec > 1 ? (autoCount / sec).toFixed(1) : '-';
};

function renderAutoCfg() {
  $('#mTitle').textContent = '자동 굴리기 설정';
  const c = S.auto;
  const opt = (v, label, cur) => `<option value="${v}" ${String(v) === String(cur) ? 'selected' : ''}>${label}</option>`;
  mBody.innerHTML = `
    <p class="hint">A 키나 🤖 자동 버튼으로도 켜고 끌 수 있어요. 지금 속도: ${autoInterval() | 0}ms 마다 1번</p>
    <label class="cfg"><div class="info"><b>이 등급 이상이 나오면 멈추기</b><i>귀한 오라를 놓치지 않게 멈춰요</i></div>
      <select data-cfg="stopTier">${opt(0, '멈추지 않기', c.stopTier)}${[2, 3, 4, 5, 6, 7].map(t => opt(t, TIER_NAME[t] + ' 이상', c.stopTier)).join('')}</select></label>
    <label class="cfg"><div class="info"><b>새 오라를 찾으면 멈추기</b><i>도감에 없는 오라가 나오면 멈춰요</i></div>
      <input type="checkbox" data-cfg="stopNew" ${c.stopNew ? 'checked' : ''}></label>
    <label class="cfg"><div class="info"><b>이미 가진 오라는 연출 짧게</b><i>에픽~신화를 이미 가지고 있으면 짧게 보여 줘요 (우주·초월은 언제나 전부)</i></div>
      <input type="checkbox" data-cfg="shortKnown" ${c.shortKnown ? 'checked' : ''}></label>
    <label class="cfg"><div class="info"><b>정해진 횟수만 굴리기</b><i>이 횟수를 채우면 멈춰요</i></div>
      <select data-cfg="limit">${[0, 100, 500, 1000, 5000, 10000].map(n => opt(n, n ? fmt(n) + '번' : '끝없이', c.limit)).join('')}</select></label>
    <label class="cfg"><div class="info"><b>물약 자동 구매</b><i>고른 물약이 떨어지면 코인으로 다시 마셔요</i></div>
      <select data-cfg="autoBuy">${opt('', '사지 않기', c.autoBuy)}${SHOP.slice(0, 3).map(s => opt(s.id, `${s.icon} ${s.name} (${fmt(s.cost)})`, c.autoBuy)).join('')}</select></label>
    <button class="bigBtn" data-autotoggle>${autoOn ? '⏹ 자동 굴리기 끄기' : '▶ 자동 굴리기 시작'}</button>`;
}
