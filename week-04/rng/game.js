'use strict';
// 굴리기 — 행운 계산, 오라 뽑기, 결과 보여 주기

const PITY_MAX = 2000; // 이만큼 굴리는 동안 에픽이 안 나오면 다음 굴림은 에픽 이상 확정

function luckInfo(n) { // n 번째 굴림의 행운
  let mult = 1 + S.clover * 0.5 + AURA_BONUS[byId(S.equipped).tier];
  for (const p of S.potions) mult *= p.mult;
  if (n % 100 === 0) mult *= 10;
  else if (n % 10 === 0) mult *= 2;
  if (EV && EV.luck) mult *= EV.luck;
  return mult;
}
const pityFull = () => S.pity + 1 >= PITY_MAX;

function pick(mult, minTier = 0) {
  for (let i = AURAS.length - 1; i > 0; i--) {
    const a = AURAS[i];
    if (a.tier < minTier) return AURAS.find(x => x.tier === minTier);
    const m = EV && EV.tierMin != null && a.tier >= EV.tierMin ? mult * EV.tierMult : mult;
    if (chance(m / a.odds)) return a;
  }
  return AURAS[0];
}

function buyPotion(it, auto) {
  if (S.coins < it.cost) return false;
  S.coins -= it.cost; S.potionsUsed++;
  S.potions.push({ id: it.id, icon: it.icon, mult: it.mult, left: it.rolls });
  SFX.chime();
  toast(`${it.icon} ${it.name} 사용!${auto ? ' (자동 구매)' : ''}`);
  checkAch(); save(); updateUI();
  return true;
}

// ---------- 결과 표시 ----------
const result = $('#result'), rName = $('#rName'), rOdds = $('#rOdds');
function showResult(a, spinning, coins) {
  rName.textContent = a.name;
  rName.className = 'rt' + a.tier + (a.c[0] === 'rainbow' ? ' rainbowText' : a.c[0] === 'white' ? ' divineText' : '');
  rName.style.color = mainColor(a);
  rOdds.innerHTML = `<span class="tier" style="color:${mainColor(a)}">${TIER_NAME[a.tier]}</span>1 / ${fmt(a.odds)}` +
    (coins ? ` <span class="gain">+${fmt(coins)} 🪙</span>` : '');
  result.classList.toggle('spin', !!spinning);
  if (!spinning) { result.classList.remove('pop'); void result.offsetWidth; result.classList.add('pop'); }
}

async function spin() {
  const n = S.fast ? 5 : 13;
  for (let i = 0; i < n; i++) {
    showResult(AURAS[Math.floor(Math.pow(rand(), 1.7) * AURAS.length)], true);
    if (!S.fast) SFX.tick(i);
    await sleep(S.fast ? 30 : 30 + i * i * 1.3);
  }
}

async function reveal(a, info) {
  const t = a.tier;
  const short = info.auto && S.auto.shortKnown && !info.isNew && t >= 3 && t <= 5;
  if (t >= 3 && !short) {
    await cinematic(a, info);
    showResult(a, false, info.coins);
  } else if (t >= 3) { // 이미 가진 에픽~신화를 자동 굴리기에서 짧게
    showResult(a, false, info.coins);
    flash(mainColor(a), 500); shake(6 + t * 2);
    burst(a, 120 + t * 50, 6 + t); ring(a, 8, 3); ring(a, 11, 2);
    SFX.boom(); SFX.chime();
    await sleep(S.fast ? 500 : 900);
  } else {
    showResult(a, false, info.coins);
    burst(a, [10, 40, 110][t], [2, 4, 7][t]);
    if (t >= 1) ring(a, 4 + t * 2, 1 + t);
    if (t === 2) { shake(5); flash(mainColor(a), 300); SFX.chime(); } else SFX.pop(t);
    await sleep(S.fast ? 120 : 380 + t * 200);
  }
  if (info.coins >= 30) { coinRain(Math.min(60, Math.log10(info.coins) * 12)); SFX.coin(); }
  if (info.isNew && !info.replay) toast(`✦ 새 오라 발견! ${a.name} (1 / ${kor(a.odds)})`);
}

// ---------- 굴리기 ----------
let busy = false;
async function roll(fromAuto = false) {
  if (busy) return null;
  busy = true; $('#btnRoll').classList.add('busy');
  ensureAudio();
  const n = S.rolls + 1, guaranteed = pityFull();
  const a = pick(luckInfo(n), guaranteed ? 3 : 0);
  S.rolls = n;
  S.potions.forEach(p => p.left--);
  S.potions = S.potions.filter(p => p.left > 0);
  if (guaranteed) S.pityUsed++;
  S.pity = a.tier >= 3 ? 0 : S.pity + 1;
  if (EV) S.eventRolls++;
  S.streak = S.streak.id === a.id ? { id: a.id, n: S.streak.n + 1 } : { id: a.id, n: 1 };

  const isNew = !S.found[a.id];
  S.found[a.id] = (S.found[a.id] || 0) + 1;
  const coins = Math.max(1, Math.round(Math.sqrt(a.odds))) * (EV && EV.coin || 1);
  S.coins += coins; S.coinsEarned += coins;
  if (!S.best || a.odds > byId(S.best).odds) S.best = a.id;
  if (a.odds >= 1000) { S.log.unshift({ n, id: a.id }); S.log.length = Math.min(S.log.length, 30); }
  save();
  $('#sRolls').textContent = fmt(S.rolls);

  await spin();
  await reveal(a, { isNew, rollNo: n, auto: fromAuto, coins, guaranteed });
  if (a.odds > byId(S.equipped).odds) S.equipped = a.id; // 더 귀한 오라는 자동으로 장착
  checkAch();
  save();
  updateUI();
  busy = false; $('#btnRoll').classList.remove('busy');
  return { aura: a, isNew };
}
