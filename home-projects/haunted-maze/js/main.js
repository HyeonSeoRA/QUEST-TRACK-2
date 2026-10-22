'use strict';
// 화면 전환, 메뉴 배경 연출, 순위표

const $ = id => document.getElementById(id);
const SCORE_KEY = 'haunted-maze-scores-v1';
let screen = 'warn';

function show(id) {
  screen = id;
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('show', s.id === id));
  const menuish = ['warn', 'menu', 'howto', 'ranks', 'loading'].includes(id);
  $('menuBg').style.display = menuish ? 'block' : 'none';
  $('game').classList.toggle('show', id === 'game' || id === 'card' || id === 'pause');
}

// ---------- 순위표 (이 브라우저에 저장) ----------
// 오늘 날짜 (예: 20261022). 같은 날에는 모두 같은 '오늘의 악몽' 미로를 탄다
const today = () => { const d = new Date(); return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); };
let mode = 'normal', rankMode = 'normal';
const keyFor = m => (m === 'daily' ? 'haunted-maze-daily-' + today() : SCORE_KEY);
function loadScores(m = 'normal') {
  try { return JSON.parse(localStorage.getItem(keyFor(m))) || []; } catch (e) { return []; }
}
function saveScore(entry, m = 'normal') {
  const list = loadScores(m);
  list.push(entry);
  list.sort((a, b) => b.score - a.score || a.time - b.time);
  const top = list.slice(0, 10);
  try { localStorage.setItem(keyFor(m), JSON.stringify(top)); } catch (e) { /* 저장 못 해도 게임은 계속 */ }
  return top.indexOf(entry);
}
const fmtTime = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}.${Math.floor((t * 10) % 10)}`;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function renderRanks(highlight = -1, m = rankMode) {
  rankMode = m;
  document.querySelectorAll('.rtab').forEach(b => b.classList.toggle('on', b.dataset.m === m));
  const c = Game.dailyCurse(today());
  $('rankNote').textContent = m === 'daily' ? `${String(today()).replace(/(\d{4})(\d{2})(\d{2})/, '$1.$2.$3')} 오늘의 악몽 · 저주: ${c.name}` : '고정 미로 · 언제나 같은 미로에서 겨룹니다';
  const list = loadScores(m);
  const body = list.length ? list.map((r, i) => `
    <tr class="${i === highlight ? 'me' : ''}">
      <td>${i + 1}</td><td>${esc(r.name)}</td><td>${r.score.toLocaleString()}</td>
      <td>${r.cleared ? '탈출' : r.reached + '단계'}</td><td>${fmtTime(r.time)}</td>
    </tr>`).join('') : '<tr><td colspan="5" class="empty">아직 아무도 살아 나오지 못했다</td></tr>';
  $('rankBody').innerHTML = body;
  const best = loadScores('normal')[0];
  $('best').textContent = best ? `최고 기록 · ${best.name} ${best.score.toLocaleString()}점` : '';
  const dc = Game.dailyCurse(today());
  $('dailyNote').textContent = `오늘의 저주 · ${dc.name} — ${dc.desc}`;
}
document.querySelectorAll('.rtab').forEach(b => b.addEventListener('click', () => renderRanks(-1, b.dataset.m)));

// ---------- 메뉴 배경 ----------
const menu = {
  scene: null, fog: [], t: 0, flash: 0, nextFlash: 5, figStep: 0, figShown: false,
  winT: 8, winOn: 0, scared: false, hover: 0, hoverOn: false,
  rain: Array.from({ length: 220 }, () => ({ x: Math.random(), y: Math.random(), s: 0.6 + Math.random() * 0.8 })),
};
const mcv = $('menuBg'), mx = mcv.getContext('2d');

function buildMenuArt() {
  menu.scene = Real.renderScene(640, 360);
  menu.fog = [Real.renderFog(640, 200, 71), Real.renderFog(640, 200, 93)];
}

function drawMenu(dt) {
  if (!menu.scene) return;
  if (mcv.width !== innerWidth || mcv.height !== innerHeight) { mcv.width = innerWidth; mcv.height = innerHeight; }
  const W = mcv.width, H = mcv.height;
  menu.t += dt;
  const sc = Math.max(W / 640, H / 360), dw = 640 * sc, dh = 360 * sc, ox = (W - dw) / 2, oy = (H - dh) / 2;
  mx.imageSmoothingEnabled = true;
  mx.drawImage(menu.scene.canvas, ox, oy, dw, dh);

  // 창문 속 그림자
  menu.winT -= dt;
  if (menu.winT <= 0) { menu.winOn = 1.1; menu.winT = 9 + Math.random() * 8; }
  if (menu.winOn > 0) {
    menu.winOn -= dt;
    const w = menu.scene.litWin;
    const X = ox + w.x * dw, Y = oy + w.y * dh, ww = w.w * dw, wh = w.h * dh;
    mx.fillStyle = '#050304';
    mx.beginPath(); mx.ellipse(X + ww * 0.5, Y + wh * 0.42, ww * 0.18, wh * 0.18, 0, 0, Math.PI * 2); mx.fill();
    mx.fillRect(X + ww * 0.22, Y + wh * 0.58, ww * 0.56, wh * 0.42);
  }

  // 달 앞에서 천천히 흔들리는 매달린 형체
  {
    const rx = ox + dw * 0.795, ry = oy, len = dh * 0.19;
    const sw = Math.sin(menu.t * 0.9) * 0.06 + Math.sin(menu.t * 2.3) * 0.01;
    mx.save();
    mx.translate(rx, ry); mx.rotate(sw);
    mx.strokeStyle = '#020202'; mx.lineWidth = Math.max(1, dh * 0.002);
    mx.beginPath(); mx.moveTo(0, 0); mx.lineTo(0, len); mx.stroke();
    mx.translate(0, len);
    mx.rotate(Math.sin(menu.t * 0.6) * 0.08);
    const h = dh * 0.13;
    mx.fillStyle = '#020202';
    mx.beginPath(); mx.ellipse(h * 0.03, h * 0.07, h * 0.07, h * 0.085, 0.5, 0, Math.PI * 2); mx.fill();
    mx.beginPath();
    mx.moveTo(-h * 0.1, h * 0.16); mx.lineTo(h * 0.11, h * 0.16); mx.lineTo(h * 0.1, h * 0.6);
    mx.lineTo(h * 0.07, h * 1.0); mx.lineTo(h * 0.035, h * 1.0); mx.lineTo(0, h * 0.62);
    mx.lineTo(-h * 0.035, h * 1.0); mx.lineTo(-h * 0.07, h * 1.0); mx.lineTo(-h * 0.1, h * 0.6);
    mx.closePath(); mx.fill();
    mx.fillRect(-h * 0.14, h * 0.17, h * 0.04, h * 0.4); mx.fillRect(h * 0.1, h * 0.17, h * 0.04, h * 0.4);
    mx.restore();
  }

  // 들어가기 버튼에 손을 대면 안개 속에서 얼굴이 떠오른다
  menu.hover = U.clamp(menu.hover + (menu.hoverOn ? dt * 0.25 : -dt * 0.8), 0, 1);
  if (menu.hover > 0 && Real.faces[1]) {
    const fs = Math.min(W, H) * 0.9;
    mx.globalAlpha = menu.hover * 0.16 * (0.8 + 0.2 * Math.sin(menu.t * 3));
    mx.globalCompositeOperation = 'screen';
    mx.drawImage(Real.faces[1], W / 2 - fs / 2, H * 0.62 - fs / 2, fs, fs);
    mx.globalCompositeOperation = 'source-over';
    mx.globalAlpha = 1;
  }

  // 흘러가는 안개
  menu.fog.forEach((f, i) => {
    const fw = dw, fh = dh * 0.56, y = oy + dh * (0.5 + i * 0.12);
    const off = ((menu.t * (8 + i * 6) * sc) % fw);
    mx.globalAlpha = 0.8;
    mx.drawImage(f, ox - off, y, fw, fh);
    mx.drawImage(f, ox - off + fw, y, fw, fh);
    mx.globalAlpha = 1;
  });

  // 번개: 칠 때마다 형체가 조금씩 가까워진다
  menu.nextFlash -= dt;
  if (menu.nextFlash <= 0) {
    menu.nextFlash = 7 + Math.random() * 6;
    menu.flash = 0.45;
    menu.figStep++;
    SFX.thunder();
    if (menu.figStep === 4 && !menu.scared && screen === 'menu') {
      menu.scared = true;
      setTimeout(() => Scare.face(1, { dur: 0.7, power: 0.6 }), 160);
    }
    if (menu.figStep >= 4) menu.figStep = 0;
  }
  if (menu.flash > 0) {
    menu.flash -= dt;
    const k = menu.flash;
    const a = k > 0.35 ? 0.7 : k > 0.28 ? 0.05 : k > 0.12 ? 0.55 * (k - 0.12) / 0.16 : 0;
    if (a > 0) {
      mx.globalCompositeOperation = 'screen';
      mx.fillStyle = `rgba(190,200,220,${a})`; mx.fillRect(0, 0, W, H);
      mx.globalCompositeOperation = 'source-over';
      const steps = [null, [0.58, 0.69, 0.07], [0.3, 0.8, 0.22], [0.66, 0.98, 0.55]];
      const st = steps[menu.figStep];
      if (st) Real.drawFigure(mx, ox + st[0] * dw, oy + st[1] * dh, st[2] * dh);
    }
  }

  // 비
  mx.strokeStyle = 'rgba(150,160,178,0.22)';
  mx.lineWidth = 1;
  mx.beginPath();
  for (const r of menu.rain) {
    r.y += dt * 1.6 * r.s; r.x -= dt * 0.12 * r.s;
    if (r.y > 1) { r.y -= 1.05; r.x = Math.random() * 1.1; }
    if (r.x < 0) r.x += 1;
    const X = r.x * W, Y = r.y * H, l = 14 * r.s;
    mx.moveTo(X, Y); mx.lineTo(X - l * 0.08, Y + l);
  }
  mx.stroke();

  // 입자
  if (Real.grain.length) {
    mx.globalAlpha = 0.07;
    mx.globalCompositeOperation = 'overlay';
    mx.fillStyle = mx.createPattern(Real.grain[Math.floor(Math.random() * Real.grain.length)], 'repeat');
    mx.fillRect(0, 0, W, H);
    mx.globalCompositeOperation = 'source-over';
    mx.globalAlpha = 1;
  }
}

// ---------- 게임 화면 크기 ----------
function fitView() {
  const v = $('view'), wrap = $('stageWrap');
  let s = Math.min(innerWidth / VW, (innerHeight - 8) / VH);
  if (s >= 2) s = Math.floor(s * 2) / 2;
  wrap.style.width = Math.floor(VW * s) + 'px';
  wrap.style.height = Math.floor(VH * s) + 'px';
  v.style.width = '100%'; v.style.height = '100%';
}
addEventListener('resize', fitView);

// ---------- 카드 (단계 소개 / 잡힘 / 통과) ----------
let cardNext = null, cardReady = 0;
function card(html, opts = {}) {
  $('cardInner').innerHTML = html;
  // 검은 화면 뒤에서 희미하게 숨 쉬는 얼굴
  const cf = $('cardFace'), face = Real.faces[opts.face === undefined ? Math.floor(Math.random() * Real.faces.length) : opts.face];
  if (face) {
    cf.width = face.width; cf.height = face.height;
    cf.getContext('2d').drawImage(face, 0, 0);
  }
  cf.style.display = opts.solid && face ? 'block' : 'none';
  show('card');
  $('card').classList.toggle('solid', !!opts.solid);
  cardNext = opts.next || null;
  cardReady = performance.now() + (opts.wait || 0);
  if (opts.auto) setTimeout(() => { if (cardNext === opts.next) proceed(); }, opts.auto);
}
function proceed() {
  if (!cardNext || performance.now() < cardReady) return;
  const n = cardNext; cardNext = null;
  show('game');
  n();
}
$('card').addEventListener('click', proceed);
addEventListener('keydown', e => {
  if (screen === 'card' && (e.code === 'Enter' || e.code === 'Space')) { e.preventDefault(); proceed(); }
  if (e.code === 'KeyM' && !e.repeat && screen !== 'result') $('muteBtn').textContent = SFX.toggleMute() ? '소리 꺼짐' : '소리 켜짐';
  if (screen === 'pause' && e.code === 'KeyQ') { Game.quit(); show('menu'); }
});

const callbacks = {
  onStageIntro(S, go) {
    const curse = S.curse ? `<p class="curse">오늘의 저주 · ${S.curse.name} — ${S.curse.desc}</p>` : '';
    card(`<div class="stageNo">${S.name}</div><h2>${S.title}</h2><p class="sub">${S.sub}</p>${curse}`, { solid: true, auto: S.curse ? 2400 : 1800, next: go, wait: 300, face: S.faceType });
    SFX.bang(0.5);
  },
  onStageClear(res, info, go) {
    let html = `<div class="stageNo">${res.stage}단계 통과</div>
      <table class="sum">
        <tr><td>기본 점수</td><td>${res.base.toLocaleString()}</td></tr>
        <tr><td>시간 보너스 <small>(${fmtTime(res.time)} / 기준 ${res.par}초)</small></td><td>+${res.bonus.toLocaleString()}</td></tr>`;
    if (info.last) html += `<tr><td>남은 목숨 ${info.lives}개 × ${LIFE_BONUS.toLocaleString()}</td><td>+${info.lifeBonus.toLocaleString()}</td></tr>`;
    html += `<tr class="tot"><td>총점</td><td>${info.total.toLocaleString()}</td></tr></table>
      <p class="hint">${info.last ? '계단이 보인다... 클릭하면 밖으로 나간다' : '아래로 내려가는 계단이 있다 · 클릭 또는 Enter'}</p>`;
    card(html, { solid: true, next: go, wait: 400 });
  },
  onCaught(livesLeft, go, face) {
    if (livesLeft > 0) card(`<h2 class="red">잡혔다</h2><p class="sub">남은 목숨 ${livesLeft}개</p><p class="hint">클릭 또는 Enter 로 다시 일어난다</p>`, { solid: true, next: go, wait: 500, face });
    else card(`<h2 class="red">너도 이제 여기 산다</h2><p class="hint">클릭 또는 Enter</p>`, { solid: true, next: go, wait: 700, face });
  },
  onPause(on) { show(on ? 'pause' : 'game'); },
  onGameOver(r) {
    if (r.cleared) {
      // 끝난 줄 알았지?
      card(`<h2>탈출했다</h2><p class="sub">차가운 밤공기가 느껴진다...</p>`, { solid: true });
      setTimeout(() => Scare.face(2, { dur: 1.6, power: 1.3, text: '정말 나갔다고 생각해?', jaw: true, blood: true, hold: 500, done: () => showResult(r) }), 1500);
    } else showResult(r);
  },
};

// ---------- 결과 ----------
let lastResult = null;
function showResult(r) {
  lastResult = r;
  const rows = r.results.map(x => `<tr><td>${x.stage}단계</td><td>${fmtTime(x.time)}</td><td>+${x.gained.toLocaleString()}</td></tr>`).join('');
  $('resTitle').textContent = r.cleared ? '살아서 나왔다' : `${r.reached}단계에서 잡혔다`;
  $('resScore').textContent = r.score.toLocaleString();
  $('resRows').innerHTML = rows || '<tr><td colspan="3">통과한 단계 없음</td></tr>';
  $('resLife').textContent = r.cleared ? `남은 목숨 보너스 +${(r.lives * LIFE_BONUS).toLocaleString()}` : '';
  $('nameIn').value = localStorage.getItem('haunted-maze-name') || '';
  $('saveBtn').disabled = false;
  show('result');
  setTimeout(() => $('nameIn').focus(), 50);
}
$('saveBtn').addEventListener('click', () => {
  const name = ($('nameIn').value.trim() || '이름없음').slice(0, 10);
  try { localStorage.setItem('haunted-maze-name', name); } catch (e) { /* 무시 */ }
  const r = lastResult;
  const pos = saveScore({ name, score: r.score, reached: r.reached, cleared: r.cleared, time: r.time, date: Date.now() }, mode);
  $('saveBtn').disabled = true;
  renderRanks(pos, mode);
  show('ranks');
});
$('nameIn').addEventListener('keydown', e => { if (e.code === 'Enter') $('saveBtn').click(); e.stopPropagation(); });
$('skipBtn').addEventListener('click', () => { renderRanks(); show('menu'); });

// ---------- 버튼 ----------
function startGame(m = 'normal') {
  mode = m;
  SFX.init();
  show('game');
  fitView();
  Game.start(callbacks, m === 'daily' ? { daily: today() } : {});
}
document.querySelectorAll('[data-act]').forEach(b => {
  b.addEventListener('mouseenter', () => { SFX.whisper(0.5, (Math.random() - 0.5), 0.08); if (b.dataset.act === 'start') menu.hoverOn = true; });
  b.addEventListener('mouseleave', () => { if (b.dataset.act === 'start') menu.hoverOn = false; });
  b.addEventListener('click', () => {
    const a = b.dataset.act;
    SFX.init();
    if (a === 'start') startGame('normal');
    if (a === 'daily') startGame('daily');
    if (a === 'ranks') { renderRanks(); show('ranks'); }
    if (a === 'howto') show('howto');
    if (a === 'back') show('menu');
    if (a === 'resume') Game.togglePause();
    if (a === 'quit') { Game.quit(); show('menu'); }
  });
});
$('muteBtn').addEventListener('click', () => { $('muteBtn').textContent = SFX.toggleMute() ? '소리 꺼짐' : '소리 켜짐'; });

$('enterBtn').addEventListener('click', () => {
  SFX.init();
  show('loading');
  Real.prepare(p => { $('loadBar').style.width = Math.round(p * 80) + '%'; }, () => {
    setTimeout(() => {
      buildMenuArt();
      $('loadBar').style.width = '100%';
      renderRanks();
      show('menu');
      SFX.thunder();
      menu.flash = 0.45; menu.nextFlash = 6;
    }, 30);
  });
});

// ---------- 메인 루프 ----------
let last = performance.now();
function loop(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (Game.active) Game.frame(dt);
  if ($('menuBg').style.display !== 'none') drawMenu(dt);
  requestAnimationFrame(loop);
}
show('warn');
requestAnimationFrame(loop);
