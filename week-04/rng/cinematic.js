'use strict';
// 에픽 이상 오라가 나왔을 때의 연출 — 등급이 높을수록 길고 커진다

const cine = $('#cine'), cSay = $('#cineSay'), cSub = $('#cineSub'), cTitle = $('#cineTitle'), cOdds = $('#cineOdds'), cInfo = $('#cineInfo');
function say(text) {
  cSay.classList.remove('in'); void cSay.offsetWidth;
  cSay.textContent = text; cSay.classList.add('in');
}
function countOdds(odds, ms) {
  const start = performance.now(), L = Math.log10(odds);
  return new Promise(res => {
    const step = now => {
      const p = Math.min(1, Math.max(0, (now - start) / ms)), e = 1 - Math.pow(1 - p, 3);
      cOdds.textContent = '1 / ' + fmt(p >= 1 ? odds : Math.round(Math.pow(10, L * e)));
      if (p < 1) { if (Math.random() < 0.3) SFX.tick(p * 20); requestAnimationFrame(step); } else res();
    };
    requestAnimationFrame(step);
  });
}
async function glitchText(ms) {
  const chars = '∞Ω█▓▒░#@$%&?!01ﾊﾐﾋｰｳｼﾅ';
  const junk = n => Array.from({ length: n }, () => chars[Math.random() * chars.length | 0]).join('');
  const end = performance.now() + ms;
  while (performance.now() < end) {
    cTitle.textContent = junk(4 + Math.random() * 6 | 0);
    cSay.textContent = junk(14);
    shake(6);
    await sleep(55);
  }
  cTitle.textContent = ''; cSay.textContent = '';
}

function impact(a) {
  const t = a.tier;
  flash(t >= 7 ? '#ffffff' : mainColor(a), 400 + t * 220);
  shake(8 + t * 4);
  burst(a, 140 * t, 5 + t * 1.8);
  for (let i = 0; i < t - 1; i++) setTimeout(() => ring(a, 6 + i * 2.5, 2 + i), i * 120);
  SFX.boom(); SFX.fanfare(t);
}

async function cinematic(a, info) {
  const t = a.tier, [c1, c2] = cssPair(a);
  cineOn = true;
  closeModal(); // 자동 굴리기 중 상점을 보고 있었어도 연출은 가리지 않게
  document.body.classList.add('cine');
  cine.style.setProperty('--c1', c1); cine.style.setProperty('--c2', c2);
  cine.className = 'show t' + t;
  cSay.textContent = cSub.textContent = cTitle.textContent = cOdds.textContent = cInfo.textContent = '';
  stage.classList.add('hush');
  dim.className = '';

  if (t === 3) {
    setDim(0.82, 500); SFX.heartbeat(); say(info.guaranteed ? '운명이 응답한다...' : '공기가 무거워진다...');
    await sleep(900);
    SFX.heartbeat(); gather(a, 180, 70);
    await sleep(1100);
  } else if (t === 4) {
    setDim(0.9, 700); starTarget = 0.035; SFX.riser(2.6); say('하늘이 갈라진다...');
    await sleep(1300);
    say('별이 쏟아진다'); gather(a, 320, 75);
    await sleep(1300);
    starTarget = STAR_BASE;
  } else if (t === 5) {
    setDim(0.96, 1200); bg.style.opacity = 0; SFX.drone(5.5); say('빛이 사라진다...');
    for (let i = 0; i < 6; i++) { SFX.heartbeat(); shake(2 + i); await sleep(820 - i * 110); }
    say('모든 것이 빨려 들어간다'); vortex = a; SFX.riser(1.9);
    await sleep(2000);
    vortex = null; P.forEach(p => { if (p.vortex) p.life = Math.min(p.life, 8); });
    say(''); await sleep(600);
  } else if (t === 6) {
    setDim(1, 1500); bg.style.opacity = 0; SFX.drone(9); say('우주가 숨을 멈췄다.');
    await sleep(2100);
    say('시간이 거꾸로 흐른다...'); bg.style.opacity = 1; starTarget = -0.03; SFX.riser(2);
    await sleep(2000);
    say('모든 것이 한 점으로.'); bg.style.opacity = 0; starTarget = 0; vortex = a;
    for (let i = 0; i < 5; i++) { SFX.heartbeat(); shake(3 + i * 2); await sleep(700 - i * 100); }
    vortex = null; P.forEach(p => { if (p.vortex) p.life = Math.min(p.life, 8); });
    say('그리고—'); await sleep(1400);
  } else {
    setDim(1, 400); bg.style.opacity = 0; frozen = true; say('. . .');
    await sleep(1400);
    document.body.classList.add('invert'); SFX.glitch();
    await glitchText(1800);
    document.body.classList.remove('invert');
    await sleep(1600); // 완전한 침묵
    say('끝이 없는 것을 본 적이 있는가');
    await sleep(2200);
    gather(a, 600, 90); SFX.riser(1.6); say('');
    await sleep(1500);
  }

  impact(a);
  if (t >= 6) { dim.className = t === 6 ? 'cosmos' : 'heaven'; bg.style.opacity = 1; frozen = false; starTarget = t === 6 ? 0.01 : STAR_BASE; }
  cSub.textContent = `${TIER_EN[t]} · ${TIER_NAME[t]}`;
  cTitle.innerHTML = [...a.name].map((ch, i) => `<span style="animation-delay:${i * 0.14}s">${ch}</span>`).join('');
  await sleep(500);
  await countOdds(a.odds, t >= 5 ? 1500 : 800);
  cOdds.innerHTML = `1 / ${fmt(a.odds)}<small>${kor(a.odds)} 분의 1 · ${a.desc}</small>`;
  cInfo.textContent = info.replay ? '다시 보기'
    : `${fmt(info.rollNo)}번째 굴림${info.isNew ? ' · 첫 발견!' : ''}${info.guaranteed ? ' · ⚡ 운명 게이지' : ''} · +${fmt(info.coins)} 코인`;

  const end = performance.now() + [0, 0, 0, 1800, 2400, 3200, 4400, 5600][t];
  while (performance.now() < end) {
    if (t >= 4) {
      burst(a, 40 + t * 12, 3 + t, W * (0.12 + Math.random() * 0.76), H * (0.12 + Math.random() * 0.76));
      if (t >= 6) SFX.sparkle();
    }
    await sleep(t >= 6 ? 260 : 520);
  }

  cine.className = ''; dim.className = ''; setDim(0, 1000);
  bg.style.opacity = 1; starTarget = STAR_BASE; frozen = false;
  document.body.classList.remove('cine');
  stage.classList.remove('hush');
  cineOn = false;
  await sleep(300);
}
