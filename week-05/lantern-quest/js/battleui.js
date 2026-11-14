'use strict';
// 전투 화면 — 그리기, 명령 고르기, 대상 고르기, 보상 창

const BattleScene = {
  ambient: null,
  enter() {
    this.ambient = makeAmbient(region().id);
    uiClear();
    uiAdd(`<div id="bt-top"></div>`);
    uiAdd(`<div id="bt-tools"><button class="btn sm" id="btAuto">자동</button><button class="btn sm" id="btSpd">x${Settings.speed}</button></div>`);
    uiAdd(`<div id="bt-banner"></div>`);
    uiAdd(`<div id="bt-party" class="box"></div>`);
    uiAdd(`<div id="bt-cmd" class="box"><div class="hint">…</div></div>`);
    uiAdd(`<div id="bt-info" class="box" hidden></div>`);
    uiAdd(`<div id="bt-lamp" title="등불 게이지: 가득 차면 필살기를 쓸 수 있어요">${sprImg('ic_lantern', 1, 'ico')}<span class="lbar"><i></i></span><em></em></div>`);
    renderLamp();
    this.wipe = 1;
    $('#btAuto').onclick = () => toggleAuto();
    $('#btSpd').onclick = () => toggleSpeed();
    toolState();
    renderParty();
    Music.play(B.kind === 'boss' ? 'boss' : 'battle');
  },
  update(dt) {
    B.t += dt;
    this.wipe = Math.max(0, this.wipe - dt * 1.8);
    this.ambient.update(dt);
    for (const u of B.units) {
      u.flash = Math.max(0, u.flash - dt * 4);
      if (u.squash) { u.squash *= Math.max(0, 1 - dt * 9 * Settings.speed); if (Math.abs(u.squash) < 0.02) u.squash = 0; }
      u.hpShow = lerp(u.hpShow, u.hp / u.maxHp, Math.min(1, dt * 4));
    }
  },
  draw(g) {
    const C = B.cam;
    g.save();
    if (C.z !== 1) { g.translate(240, 135); g.scale(C.z, C.z); g.translate(-C.x, -C.y); }
    g.drawImage(getBG(region().id), 0, 0, W, H);
    drawFog(g, region().id, B.t);
    this.ambient.draw(g);
    const list = B.units.filter(u => !u.gone).sort((a, b) => a.y - b.y);
    for (const u of list) drawUnit(g, u);
    fxDraw(g);
    for (const u of list) if (u.side === 'enemy' && u.alive) drawEnemyBar(g, u);
    drawCursors(g);
    if (FX.dim > 0.01) { g.globalAlpha = FX.dim; g.fillStyle = '#0a0612'; g.fillRect(-W, -H, W * 3, H * 3); g.globalAlpha = 1; }
    for (const a of CUTINS) a(g);
    fxDrawTop(g);
    g.restore();
    drawVignette(g);
    if (this.wipe > 0) drawWipe(g, this.wipe);
  },
  key(e) { battleKey(e); },
  click(x, y) {
    const u = unitAt(x, y);
    if (!B.ui || B.ui.mode !== 'target' || !u) return;
    const i = B.ui.targets.indexOf(u);
    if (i >= 0) { B.ui.idx = i; confirmTarget(); }
  },
  move(x, y) {
    const u = unitAt(x, y);
    if (B.ui && B.ui.mode === 'target' && u) {
      const i = B.ui.targets.indexOf(u);
      if (i >= 0 && i !== B.ui.idx) { B.ui.idx = i; SFX.play('move'); renderTargetInfo(); }
    }
  },
};

function unitAt(x, y) {
  const list = B.units.filter(u => !u.gone).sort((a, b) => b.y - a.y);
  for (const u of list) {
    const hw = Math.max(10, u.w * 0.45);
    if (x > u.x - hw && x < u.x + hw && y > u.y - u.h - 4 && y < u.y + 6) return u;
  }
  return null;
}

function drawUnit(g, u) {
  const s = getSprite(u.spr), flip = u.side === 'enemy';
  const fr = !u.alive ? 0 : u.pose != null && s.frames[u.pose] ? u.pose : Math.floor(B.t * 2.2 + u.phase) % 2;
  const x = Math.round(u.x + u.ox - u.w / 2), y = Math.round(u.y + u.oy - u.h), K = BODY * (u.scale || 1);
  if (u.mod && u.alive) softGlow(g, u.x + u.ox, u.y + u.oy - u.h * 0.45, u.w * 0.75, MOD[u.mod].color, (0.22 + 0.1 * Math.sin(B.t * 4)) * u.alpha);
  g.globalAlpha = 0.45 * u.alpha;
  g.fillStyle = '#0a0612';
  g.beginPath(); g.ellipse(u.x + u.ox, u.y, Math.min(u.w * 0.36, u.side === "hero" ? 9 : 99), 3, 0, 0, Math.PI * 2); g.fill();
  g.globalAlpha = u.alpha;
  if (u.side === 'hero' && !u.alive) {
    g.save();
    g.translate(Math.round(u.x - u.h * 0.45), Math.round(u.y + 2));
    g.rotate(-Math.PI / 2);
    g.globalAlpha = 0.85;
    dimg(g, s.frames[0], 0, 0, BODY);
    g.globalAlpha = 0.45;
    dimg(g, tintOf(s, 0, '#3a3050'), 0, 0, BODY);
    g.restore();
    g.globalAlpha = 1;
    return;
  }
  // 숨쉬기와 탄력: 발을 기준으로 살짝 늘었다 줄었다
  const sq = u.squash || 0, br = Math.sin(B.t * 2.6 + u.phase * 3) * 0.014;
  const sx = 1 + sq * 0.14 - br * 0.5, sy = 1 - sq * 0.14 + br;
  const blit = img => {
    g.save(); g.translate(u.x + u.ox, u.y + u.oy); g.scale(flip ? -sx : sx, sy);
    dimg(g, img, -u.w / 2, -u.h, K);
    g.restore();
  };
  blit(s.frames[fr]);
  const over = (c, a) => { g.globalAlpha = a * u.alpha; blit(tintOf(s, fr, c)); g.globalAlpha = u.alpha; };
  if (u.st.freeze) over('#9fe8ff', 0.5);
  if (u.st.poison) over('#6ad04a', 0.12 + 0.1 * Math.sin(B.t * 6));
  if (u.st.burn) over('#ff6a2a', 0.1 + 0.1 * Math.sin(B.t * 9));
  if (u.charge) over('#ff4a8a', 0.2 + 0.2 * Math.sin(B.t * 8));
  if (u.st.guard) over('#c8d0e0', 0.25);
  if (u.mod) over(MOD[u.mod].color, 0.1 + 0.08 * Math.sin(B.t * 4));
  if (u.flash > 0) { g.globalAlpha = Math.min(1, u.flash) * u.alpha; blit(s.white[fr]); }
  g.globalAlpha = 1;
}

function drawEnemyBar(g, u) {
  const bw = clamp(u.w * 0.8, 26, 60), x = Math.round(u.x - bw / 2), y = Math.round(u.y + 4);
  g.globalAlpha = u.alpha;
  g.fillStyle = '#140c1c'; g.fillRect(x - 1, y - 1, bw + 2, 5);
  g.fillStyle = '#3a2030'; g.fillRect(x, y, bw, 3);
  g.fillStyle = '#ffffff'; g.fillRect(x, y, Math.round(bw * u.hpShow), 3);
  const p = u.hp / u.maxHp;
  g.fillStyle = p > 0.5 ? '#e0404a' : p > 0.25 ? '#e8802a' : '#ffd34d';
  g.fillRect(x, y, Math.round(bw * p), 3);
  g.fillStyle = '#ffffff33'; g.fillRect(x, y, Math.round(bw * p), 1);
  let ix = x;
  for (const k in u.st) { if (!ST_ICON[k]) continue; g.drawImage(stIcon(k), ix, y + 5, 7, 7); ix += 8; }
  g.globalAlpha = 1;
}

function drawCursors(g) {
  const bob = Math.round(Math.sin(B.t * 8) * 2);
  if (B.active && B.active.alive && B.active.side === 'hero' && B.ui) {
    const u = B.active;
    drawArrow(g, u.x + u.ox, topOf(u) - 4 + bob, '#ffd34d');
  }
  if (B.ui && B.ui.mode === 'target') {
    const t = B.ui.targets[B.ui.idx];
    if (t) drawArrow(g, t.x + t.ox, topOf(t) - 4 + bob, Math.floor(B.t * 6) % 2 ? '#ffffff' : '#ff6a5a');
  }
}
function drawArrow(g, x, y, c) {
  x = Math.round(x); y = Math.round(y);
  g.fillStyle = '#140c1c';
  g.fillRect(x - 4, y - 5, 9, 2); g.fillRect(x - 3, y - 3, 7, 2); g.fillRect(x - 2, y - 1, 5, 2); g.fillRect(x - 1, y + 1, 3, 1);
  g.fillStyle = c;
  g.fillRect(x - 3, y - 4, 7, 1); g.fillRect(x - 2, y - 3, 5, 1); g.fillRect(x - 1, y - 2, 3, 1); g.fillRect(x, y - 1, 1, 1);
}

// ---------- 위쪽 ----------
function showBanner(text, color = '#ffe8a0', ms = 1000, sub = '') {
  const el = $('#bt-banner');
  if (!el) return;
  el.innerHTML = `${sub ? `<small>${esc(sub)}</small>` : ''}<span style="color:${color}">${esc(text)}</span>`;
  el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
  clearTimeout(B && B.bannerT);
  if (B) B.bannerT = setTimeout(() => el.classList.remove('on'), ms / (Settings.speed || 1));
}
function renderTurnBar() {
  const el = $('#bt-top');
  if (!el || !B) return;
  const list = [B.active, ...B.queue].filter(u => u && u.alive).slice(0, 9);
  el.innerHTML = `<span class="round">${B.round}턴</span>` + list.map((u, i) =>
    `<span class="chip ${u.side} ${i === 0 && B.active ? 'now' : ''}"><img class="pix" src="${headURL(u.spr, u.side === 'enemy')}" alt=""></span>`).join('');
}
function toolState() {
  const a = $('#btAuto'), s = $('#btSpd');
  if (a) a.classList.toggle('on', !!B.auto);
  if (s) s.textContent = 'x' + Settings.speed;
}
function toggleAuto() {
  B.auto = !B.auto; Settings.auto = B.auto; saveSettings();
  SFX.play('select'); toolState();
  if (B.auto && B.ui && B.ui.resolve) { const r = B.ui.resolve, u = B.ui.unit; B.ui = null; r(heroAI(u)); }
}
function toggleSpeed() { Settings.speed = Settings.speed === 1 ? 2 : 1; saveSettings(); SFX.play('select'); toolState(); }

// ---------- 동료 상태 ----------
function renderParty() {
  const el = $('#bt-party');
  if (!el || !B) return;
  el.innerHTML = heroUnits().map(u => `
    <div class="prow ${u.alive ? '' : 'dead'} ${B.active === u ? 'act' : ''}" data-i="${heroUnits().indexOf(u)}">
      <img class="pix head" src="${headURL(u.spr)}" alt="">
      <span class="pname">${esc(u.name)}</span>
      <span class="pbars"><span class="pnum">${u.hp}<small>/${u.maxHp}</small></span>${barHTML(u.hp, u.maxHp, 'hp')}${barHTML(u.mp, u.maxMp, 'mp')}</span>
      <span class="psts">${stIcons(u.st)}</span>
    </div>`).join('');
  el.querySelectorAll('.prow').forEach(r => {
    r.onclick = () => {
      if (!B.ui || B.ui.mode !== 'target') return;
      const u = heroUnits()[+r.dataset.i], i = B.ui.targets.indexOf(u);
      if (i >= 0) { B.ui.idx = i; confirmTarget(); }
    };
  });
}

// ---------- 명령 ----------
function heroInput(u) {
  return new Promise(resolve => {
    B.ui = { mode: 'cmd', unit: u, resolve, idx: 0 };
    renderParty();
    renderCmd();
  });
}
function hideMenus() {
  const c = $('#bt-cmd');
  if (c) c.innerHTML = `<div class="hint">${B && B.active ? esc(B.active.name) + '의 차례' : ''}</div>`;
  const i = $('#bt-info');
  if (i) i.hidden = true;
}

function cmdList() {
  const u = B.ui.unit, canFlee = B.kind === 'normal' || B.kind === 'event';
  const hasItem = Object.keys(Run.items).some(k => Run.items[k] > 0);
  return [
    { label: '공격', desc: '무기로 적 하나를 공격', go: () => pickTarget({ type: 'skill', id: 'attack' }, SKILLS.attack.tgt) },
    { label: '기술', desc: '마나를 써서 기술 사용', go: () => { B.ui.mode = 'skill'; B.ui.idx = 0; renderCmd(); } },
    { label: '물건', desc: hasItem ? '가방의 물건 사용' : '가방이 비었다', off: !hasItem, go: () => { B.ui.mode = 'item'; B.ui.idx = 0; renderCmd(); } },
    { label: '방어', desc: '받는 피해 절반, 마나 조금 회복', go: () => finishInput({ type: 'guard' }) },
    { label: '도망', desc: canFlee ? '전투에서 도망친다' : '이 싸움은 피할 수 없다', off: !canFlee, go: () => finishInput({ type: 'flee' }) },
    { label: '필살기', ult: 1, desc: B.lamp >= 100 ? `「${SKILLS['ult_' + u.id].name}」 ${SKILLS['ult_' + u.id].desc}` : `등불 게이지가 가득 차면 쓸 수 있다 (지금 ${Math.floor(B.lamp)}%)`, off: B.lamp < 100, go: () => { const us = SKILLS['ult_' + u.id]; if (us.tgt === 'enemy') pickTarget({ type: 'ult' }, 'enemy'); else finishInput({ type: 'ult' }); } },
  ];
}
function skillList() {
  const u = B.ui.unit;
  return u.skills.map(id => {
    const s = SKILLS[id];
    const noTarget = s.tgt === 'deadAlly' && !heroUnits().some(h => !h.alive);
    return { label: s.name, mp: s.mp, desc: s.desc + (s.el && s.el !== 'phys' ? ` · ${EL_NAME[s.el]}` : ''), off: s.mp > u.mp || noTarget, go: () => pickTarget({ type: 'skill', id }, s.tgt) };
  });
}
function itemList() {
  return ITEM_ORDER.filter(id => Run.items[id] > 0).map(id => {
    const it = ITEMS[id];
    const noTarget = it.tgt === 'deadAlly' && !heroUnits().some(h => !h.alive);
    return { label: it.name, n: Run.items[id], icon: id, desc: it.desc, off: noTarget, go: () => pickTarget({ type: 'item', id }, it.tgt) };
  });
}
function currentList() { return B.ui.mode === 'cmd' ? cmdList() : B.ui.mode === 'skill' ? skillList() : B.ui.mode === 'item' ? itemList() : []; }

function renderCmd() {
  const el = $('#bt-cmd');
  if (!el || !B.ui) return;
  const list = currentList(), u = B.ui.unit;
  B.ui.idx = clamp(B.ui.idx, 0, Math.max(0, list.length - 1));
  const cur = list[B.ui.idx];
  if (B.ui.mode === 'cmd') {
    el.innerHTML = `<div class="cmdwrap"><div class="cmds">${list.map((c, i) => `<button class="btn cmd ${c.ult ? 'ult' : ''} ${c.ult && !c.off ? 'ready' : ''} ${i === B.ui.idx ? 'sel' : ''}" data-i="${i}" ${c.off ? 'disabled' : ''}><kbd>${i + 1}</kbd>${c.label}</button>`).join('')}</div>
      <div class="cdesc"><div class="chead"><img class="pix portrait" src="${headURL(u.spr)}" alt=""><span><b>${esc(u.name)}</b><br><small>${CLASSES[u.id].name} · Lv ${u.ref.lvl} · MP ${u.mp}/${u.maxMp}</small></span></div>${esc(cur ? cur.desc : '')}</div></div>`;
  } else {
    el.innerHTML = `<div class="sklist">${list.map((c, i) => `<button class="btn sk ${i === B.ui.idx ? 'sel' : ''}" data-i="${i}" ${c.off ? 'disabled' : ''}>${c.icon ? itemIcon(c.icon) : ''}<span>${esc(c.label)}</span><em>${c.mp != null ? (c.mp ? c.mp + 'MP' : '') : 'x' + c.n}</em></button>`).join('') || '<div class="hint">없음</div>'}</div>
      <div class="skdesc">${esc(cur ? cur.desc : '')}<span class="back">Esc 뒤로</span></div>`;
  }
  el.querySelectorAll('button[data-i]').forEach(b => {
    b.onmouseenter = () => { const i = +b.dataset.i; if (i !== B.ui.idx) { B.ui.idx = i; renderCmd(); } };
    b.onclick = () => { const i = +b.dataset.i, c = currentList()[i]; if (!c || c.off) { SFX.play('error'); return; } SFX.play('select'); c.go(); };
  });
}

function pickTarget(cmd, tgt) {
  const u = B.ui.unit;
  let targets;
  if (tgt === 'enemy') targets = enemyUnits().sort((a, b) => a.y - b.y);
  else if (tgt === 'ally') targets = heroUnits().filter(h => h.alive);
  else if (tgt === 'deadAlly') targets = heroUnits().filter(h => !h.alive);
  else return finishInput(cmd);
  if (!targets.length) { SFX.play('error'); return; }
  B.ui.prev = B.ui.mode;
  B.ui.mode = 'target'; B.ui.cmd = cmd; B.ui.targets = targets;
  B.ui.idx = tgt === 'ally' ? Math.max(0, targets.indexOf(targets.slice().sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0])) : 0;
  $('#bt-cmd').innerHTML = `<div class="hint">대상을 고르세요 <small>(클릭 또는 ←→ 와 Enter · Esc 뒤로)</small></div>`;
  renderTargetInfo();
}
function renderTargetInfo() {
  const el = $('#bt-info');
  const t = B.ui && B.ui.targets && B.ui.targets[B.ui.idx];
  if (!el || !t) return;
  el.hidden = false;
  let html = `<b>${esc(t.name)}</b> <small>${t.hp} / ${t.maxHp}</small>${barHTML(t.hp, t.maxHp, 'hp')}`;
  if (t.side === 'enemy') {
    const kn = Run.known[t.id] || {};
    const w = Object.keys(kn).filter(k => kn[k] === 'weak').map(k => EL_NAME[k]);
    const r = Object.keys(kn).filter(k => kn[k] === 'resist').map(k => EL_NAME[k]);
    html += `<small>약점 ${w.length ? w.join(' ') : '?'} · 저항 ${r.length ? r.join(' ') : '?'}</small>`;
    if (t.undead) html += `<small class="dim">망령 · 빛에 약함</small>`;
    if (t.mod) html += `<small style="color:${MOD[t.mod].color}">변종 · ${MOD[t.mod].desc}</small>`;
  }
  const sts = Object.keys(t.st).filter(k => ST_NAME[k]).map(k => ST_NAME[k]);
  if (sts.length) html += `<small>${sts.join(' · ')}</small>`;
  el.innerHTML = html;
}
function confirmTarget() {
  const t = B.ui.targets[B.ui.idx];
  SFX.play('select');
  finishInput(Object.assign({}, B.ui.cmd, { targets: [t] }));
}
function finishInput(cmd) {
  const r = B.ui.resolve;
  B.ui = null;
  $('#bt-info').hidden = true;
  r(cmd);
}
function backMenu() {
  if (!B.ui) return;
  SFX.play('cancel');
  if (B.ui.mode === 'target') { B.ui.mode = B.ui.prev; B.ui.idx = 0; $('#bt-info').hidden = true; renderCmd(); }
  else if (B.ui.mode !== 'cmd') { B.ui.mode = 'cmd'; B.ui.idx = 0; renderCmd(); }
}

function battleKey(e) {
  const k = e.key;
  if (k === 'a' || k === 'A') return toggleAuto();
  if (k === 's' || k === 'S') return toggleSpeed();
  if (!B.ui) return;
  if (B.ui.mode === 'reward') { if (k === 'Enter' || k === ' ') B.ui.ok(); return; }
  if (k === 'Escape' || k === 'Backspace') return backMenu();
  if (B.ui.mode === 'target') {
    const n = B.ui.targets.length;
    if (k === 'ArrowRight' || k === 'ArrowDown') { B.ui.idx = (B.ui.idx + 1) % n; SFX.play('move'); renderTargetInfo(); }
    if (k === 'ArrowLeft' || k === 'ArrowUp') { B.ui.idx = (B.ui.idx + n - 1) % n; SFX.play('move'); renderTargetInfo(); }
    if (k === 'Enter' || k === ' ') confirmTarget();
    return;
  }
  const list = currentList(), n = list.length;
  if (!n) return;
  const cols = 2;
  if (k === 'ArrowDown') { B.ui.idx = (B.ui.idx + cols) % n; SFX.play('move'); renderCmd(); }
  if (k === 'ArrowUp') { B.ui.idx = (B.ui.idx - cols + n * 2) % n; SFX.play('move'); renderCmd(); }
  if (k === 'ArrowRight' && cols > 1) { B.ui.idx = (B.ui.idx + 1) % n; SFX.play('move'); renderCmd(); }
  if (k === 'ArrowLeft' && cols > 1) { B.ui.idx = (B.ui.idx + n - 1) % n; SFX.play('move'); renderCmd(); }
  if (/^[1-9]$/.test(k) && +k <= n) { B.ui.idx = +k - 1; renderCmd(); const c = list[B.ui.idx]; if (!c.off) { SFX.play('select'); c.go(); } else SFX.play('error'); return; }
  if (k === 'Enter' || k === ' ') { const c = list[B.ui.idx]; if (c && !c.off) { SFX.play('select'); c.go(); } else SFX.play('error'); }
}

// ---------- 보상 ----------
function showRewards(rw) {
  return new Promise(res => {
    const ups = rw.ups.map(({ h, ups }) => `<div class="lvup"><img class="pix head" src="${headURL('hero_' + h.cls)}" alt=""><b>${esc(h.name)}</b> 레벨 ${ups[ups.length - 1].lvl}!${ups.flatMap(u => u.learned).map(n => ` <span class="new">새 기술 「${esc(n)}」</span>`).join('')}</div>`).join('');
    const items = rw.items.map(id => `<span class="loot">${itemIcon(id)}${esc(ITEMS[id].name)}</span>`).join('');
    const eqs = rw.equips.map(e => `<div class="loot eq">${equipIcon(e)}<span>${equipTip(e)}</span></div>`).join('');
    const m = modal(`
      <h2 class="title-sm">승리!</h2>
      <div class="rw"><span>경험치 <b>+${fmt(rw.xp)}</b></span>${goldHTML(rw.gold)}</div>
      ${ups ? `<div class="ups">${ups}</div>` : ''}
      ${items ? `<div class="loots">${items}</div>` : ''}
      ${eqs ? `<div class="eqs">${eqs}<small class="dim">새 장비는 지도에서 「원정대」를 눌러 입힐 수 있어요</small></div>` : ''}
      <button class="btn big" id="rwOk">계속</button>`, 'reward');
    if (rw.ups.length) setTimeout(() => SFX.play('levelup'), 250);
    let done = false;
    const ok = () => { if (done) return; done = true; B.ui = null; SFX.play('select'); closeModal(); res(); };
    m.querySelector('#rwOk').onclick = ok;
    B.ui = { mode: 'reward', ok };
  });
}


// ---------- 등불 게이지 ----------
function gainLamp(n) {
  if (!B || B.over) return;
  const before = B.lamp;
  B.lamp = Math.min(100, B.lamp + n * (hasRelic('lamp') ? 1.5 : 1));
  if (before < 100 && B.lamp >= 100) { SFX.play('levelup'); showBanner('등불이 가득 찼다! 필살기를 쓸 수 있다', '#ffd34d', 1200); }
  renderLamp();
}
function renderLamp() {
  const el = $('#bt-lamp');
  if (!el || !B) return;
  el.querySelector('i').style.width = B.lamp + '%';
  el.querySelector('em').textContent = B.lamp >= 100 ? '필살기!' : Math.floor(B.lamp) + '%';
  el.classList.toggle('full', B.lamp >= 100);
  if (B.ui && B.ui.mode === 'cmd') renderCmd();
}

// ---------- 카메라 ----------
function camTo(z, x, y, ms) {
  const C = B.cam, z0 = C.z, x0 = C.x, y0 = C.y;
  return tween(ms, k => { C.z = lerp(z0, z, k); C.x = lerp(x0, x, k); C.y = lerp(y0, y, k); }, ease.inOut);
}
function camPunch(t, z) {
  if (!B || B.cam.z !== 1) return;
  const C = B.cam;
  tween(260, k => { const s = Math.sin(k * Math.PI); C.z = 1 + (z - 1) * s; C.x = lerp(240, cxOf(t), s * 0.5); C.y = lerp(135, cyOf(t), s * 0.5); }).then(() => { C.z = 1; C.x = 240; C.y = 135; });
}

// ---------- 필살기 컷인 ----------
const CUTINS = [];
async function cutIn(u, sk) {
  SFX.play('boss');
  FX.dimTarget = 0.55;
  const col = CLASSES[u.id].color, s = getSprite(u.spr);
  let t0 = 0;
  const draw = g => {
    const k = clamp(t0, 0, 1), inK = ease.out(Math.min(1, k * 3)), outK = k > 0.8 ? (k - 0.8) / 0.2 : 0;
    const cy = 135, hh = 46 * inK * (1 - outK);
    g.save();
    g.globalAlpha = 0.92;
    const gr = g.createLinearGradient(0, cy - hh, 0, cy + hh);
    gr.addColorStop(0, dark(col, 0.6)); gr.addColorStop(0.5, col); gr.addColorStop(1, dark(col, 0.7));
    g.fillStyle = gr;
    g.beginPath(); g.moveTo(-20, cy - hh + 12); g.lineTo(W + 20, cy - hh - 12); g.lineTo(W + 20, cy + hh - 12); g.lineTo(-20, cy + hh + 12); g.fill();
    g.globalAlpha = 0.5; g.fillStyle = '#ffffff';
    for (let i = 0; i < 14; i++) { const y = cy - hh + ((i * 37 + t0 * 900) % (hh * 2 + 1)); g.fillRect(((i * 97 + t0 * 1600) % (W + 80)) - 40, y, 30 + (i % 3) * 12, 0.6); }
    g.globalAlpha = 1;
    if (hh > 8) {
      g.save(); g.beginPath(); g.rect(0, cy - hh - 20, W, hh * 2 + 40); g.clip();
      const sx = lerp(-120, 60, inK) + k * 20;
      dimg(g, s.frames[0], sx, cy - 72, 3);
      g.restore();
      drawText(g, sk.name, lerp(W + 100, 320, inK) - k * 16, cy - 6, '#fff6d8', 26, 'center', '#140c1c', true);
      drawText(g, '필살기', lerp(W + 100, 320, inK) - k * 16, cy + 18, '#ffd34d', 11);
    }
    g.restore();
  };
  CUTINS.push(draw);
  await tween(1300, k => { t0 = k; }, ease.lin);
  CUTINS.splice(CUTINS.indexOf(draw), 1);
  FX.dimTarget = 0;
  flash('#ffffff', 0.5);
  shake(5);
}

// ---------- 분위기: 안개, 가장자리 어둡게, 전투 시작 전환 ----------
const FOG = {};
function fogCanvas(id) {
  if (FOG[id]) return FOG[id];
  const col = { forest: '#bfe8d0', sands: '#f8d8a0', frost: '#d8f0ff', ash: '#ff9a6a', title: '#bfe8d0' }[id] || '#ffffff';
  const c = newCanvas(W * 2, 80 * 2), g = c.getContext('2d');
  g.scale(2, 2);
  for (let i = 0; i < 40; i++) softGlow(g, (i * 53) % W, 40 + Math.sin(i * 1.7) * 18, 30 + (i % 5) * 8, col, 0.12);
  // 좌우가 이어지도록 가장자리 복사
  g.setTransform(1, 0, 0, 1, 0, 0);
  FOG[id] = c;
  return c;
}
function drawFog(g, id, t) {
  const c = fogCanvas(id), off = (t * 5) % W;
  g.globalAlpha = 0.8;
  g.drawImage(c, -off, 95, W, 80);
  g.drawImage(c, W - off, 95, W, 80);
  g.globalAlpha = 1;
}
let _vig = null;
function drawVignette(g) {
  if (!_vig) {
    _vig = newCanvas(W * 2, H * 2);
    const v = _vig.getContext('2d');
    const gr = v.createRadialGradient(W, H * 0.9, H * 0.5, W, H, W * 1.15);
    gr.addColorStop(0, 'rgba(10,6,18,0)'); gr.addColorStop(1, 'rgba(10,6,18,0.55)');
    v.fillStyle = gr; v.fillRect(0, 0, W * 2, H * 2);
  }
  g.drawImage(_vig, 0, 0, W, H);
}
function drawWipe(g, k) {
  g.fillStyle = '#0a0612';
  const n = 10, bw = (W + H) / n;
  for (let i = 0; i < n; i++) {
    const w = bw * clamp(k * 1.6 - i * 0.06, 0, 1);
    if (w <= 0) continue;
    const x = i * bw - H;
    g.beginPath(); g.moveTo(x, H); g.lineTo(x + H, 0); g.lineTo(x + H + w, 0); g.lineTo(x + w, H); g.fill();
  }
}
