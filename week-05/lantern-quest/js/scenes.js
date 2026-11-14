'use strict';
// 화면들 — 시작, 동료 고르기, 지도, 상점, 모닥불, 사건, 보물, 원정대, 끝

const NODE_INFO = {
  battle: { name: '전투', icon: 'nBattle', desc: '몬스터 무리와 싸운다' },
  elite: { name: '강적', icon: 'nElite', desc: '강한 적. 좋은 장비를 떨어뜨린다' },
  rest: { name: '모닥불', icon: 'nRest', desc: '쉬거나, 수련하거나, 무기를 벼린다' },
  shop: { name: '떠돌이 상인', icon: 'nShop', desc: '물건과 장비를 사고판다' },
  event: { name: '수상한 곳', icon: 'nEvent', desc: '무슨 일이 일어날지 모른다' },
  treasure: { name: '보물 상자', icon: 'nTreasure', desc: '무언가 들어 있다…?' },
  boss: { name: '우두머리', icon: 'nBoss', desc: '이 땅을 지배하는 존재' },
};

// ================= 시작 화면 =================
const TitleScene = {
  enter() {
    this.amb = makeAmbient('title');
    this.t = 0;
    uiClear();
    const rec = getRecord();
    uiAdd(`<div class="title-wrap">
      <div class="logo"><small>LANTERN QUEST</small>등불 원정대</div>
      <div class="menu">
        <button class="btn big" id="tNew">새 여정</button>
        ${hasSave() ? '<button class="btn big" id="tCont">이어하기</button>' : ''}
        <button class="btn" id="tDex">몬스터 도감</button>
        <button class="btn" id="tHelp">하는 방법</button>
        <button class="btn" id="tSet">설정</button>
      </div>
      <div class="rec">${rec.runs ? `원정 ${rec.runs}번 · 승리 ${rec.wins}번 · 쓰러뜨린 적 ${fmt(rec.kills)}` : '해를 삼킨 잿빛 왕에게서 빛을 되찾으러 떠나요'}</div>
    </div>`);
    $('#tNew').onclick = () => { audioInit(); SFX.play('select'); if (hasSave()) confirmNew(); else go(SelectScene); };
    if ($('#tCont')) $('#tCont').onclick = () => { audioInit(); SFX.play('select'); if (loadRun()) go(MapScene); };
    $('#tHelp').onclick = () => { audioInit(); SFX.play('select'); openHelp(); };
    $('#tDex').onclick = () => { audioInit(); SFX.play('select'); go(DexScene); };
    $('#tSet').onclick = () => { audioInit(); SFX.play('select'); openSettings(); };
    Music.play('title');
  },
  update(dt) { this.t += dt; this.amb.update(dt); },
  draw(g) {
    g.drawImage(getBG('title'), 0, 0, W, H);
    this.amb.draw(g);
    const lx = 240, ly = 236;
    softGlow(g, lx, ly - 8, 60 + Math.sin(this.t * 3) * 3, '#ffb040', 0.45);
    g.fillStyle = '#4a3a2a'; g.fillRect(lx - 1, ly - 2, 2, 12);
    dimg(g, getSprite('ic_lantern').frames[0], lx - 8, ly - 18);
    const ks = Object.keys(CLASSES);
    ks.forEach((k, i) => {
      const s = getSprite('hero_' + k), x = [78, 136, 194, 286, 344, 402][i], y = 250;
      g.globalAlpha = 0.4; g.fillStyle = '#0a0612'; g.beginPath(); g.ellipse(x, y, 13, 3, 0, 0, 7); g.fill(); g.globalAlpha = 1;
      const img = s.frames[Math.floor(this.t * 2 + i * 0.7) % 2];
      if (i >= 3) { g.save(); g.translate(x + 20, y - 35); g.scale(-1, 1); dimg(g, img, 0, 0, 1); g.restore(); }
      else dimg(g, img, x - 20, y - 35, 1);
    });
  },
  key(e) { if (e.key === 'Enter') $('#tNew').click(); },
};
function confirmNew() {
  const m = modal(`<h2 class="title-sm">새 여정</h2><p>지금 하던 여정이 지워져요. 새로 시작할까요?</p>
    <div class="row"><button class="btn" id="cnNo">아니요</button><button class="btn warn" id="cnYes">새로 시작</button></div>`);
  m.querySelector('#cnNo').onclick = () => { SFX.play('cancel'); closeModal(); };
  m.querySelector('#cnYes').onclick = () => { SFX.play('select'); clearSave(); go(SelectScene); };
}

// ================= 동료 고르기 =================
const SelectScene = {
  enter() {
    this.sel = []; this.hover = 'knight'; this.t = 0;
    this.amb = makeAmbient('title');
    uiClear();
    uiAdd(`<div class="sel-wrap">
      <div class="sel-head">함께 떠날 동료 <b>3명</b>을 고르세요</div>
      <div class="cards">${Object.keys(CLASSES).map(k => `<button class="card box" data-k="${k}"><span class="num"></span>${sprImg('hero_' + k, 2)}<b>${CLASSES[k].name}</b><small>${CLASSES[k].role}</small></button>`).join('')}</div>
      <div class="cinfo box" id="cinfo"></div>
      <div class="sel-foot"><button class="btn" id="sBack">뒤로</button><button class="btn" id="sRec">추천 조합</button><span class="diffs">${DIFF.map((d, i) => `<button class="btn sm diff" data-d="${i}" title="${d.desc}">${d.name}</button>`).join('')}</span><button class="btn big" id="sGo" disabled>출발</button></div>
    </div>`);
    UI.root.querySelectorAll('.card').forEach(c => {
      c.onmouseenter = () => { this.hover = c.dataset.k; this.info(); };
      c.onclick = () => this.toggle(c.dataset.k);
    });
    $('#sBack').onclick = () => { SFX.play('cancel'); go(TitleScene); };
    $('#sRec').onclick = () => { SFX.play('select'); this.sel = ['knight', 'mage', 'cleric']; this.refresh(); };
    $('#sGo').onclick = () => this.start();
    this.diff = Settings.diff ?? 1;
    UI.root.querySelectorAll('.diff').forEach(b => b.onclick = () => { this.diff = +b.dataset.d; Settings.diff = this.diff; saveSettings(); SFX.play('select'); this.refresh(); toast(DIFF[this.diff].desc); });
    this.info(); this.refresh();
  },
  toggle(k) {
    const i = this.sel.indexOf(k);
    if (i >= 0) { this.sel.splice(i, 1); SFX.play('cancel'); }
    else if (this.sel.length < 3) { this.sel.push(k); SFX.play('select'); }
    else { SFX.play('error'); toast('3명까지 고를 수 있어요'); }
    this.hover = k; this.info(); this.refresh();
  },
  refresh() {
    UI.root.querySelectorAll('.card').forEach(c => {
      const i = this.sel.indexOf(c.dataset.k);
      c.classList.toggle('on', i >= 0);
      c.querySelector('.num').textContent = i >= 0 ? i + 1 : '';
    });
    $('#sGo').disabled = this.sel.length !== 3;
    UI.root.querySelectorAll('.diff').forEach(b => b.classList.toggle('on', +b.dataset.d === this.diff));
  },
  info() {
    const c = CLASSES[this.hover], b = c.base;
    const st = [['체력', b.hp, 80], ['마나', b.mp, 36], ['공격', b.atk, 14], ['마력', b.mag, 15], ['방어', b.def, 11], ['속도', b.spd, 14]];
    $('#cinfo').innerHTML = `<div class="ci-top"><b>${c.name} ${esc(c.hero)}</b><small>${c.role}</small></div><p>${esc(c.desc)}</p>
      <div class="ci-st">${st.map(([n, v, m]) => `<span>${n}</span>${barHTML(v, m, 'st')}`).join('')}</div>
      <div class="ci-sk">${c.skills.map(([l, id]) => `<span><em>Lv${l}</em> ${SKILLS[id].name}</span>`).join('')}</div>`;
  },
  start() {
    if (this.sel.length !== 3) return;
    SFX.play('select');
    newRun(this.sel, this.diff);
    go(IntroScene);
  },
  update(dt) { this.t += dt; this.amb.update(dt); },
  draw(g) { g.drawImage(getBG('title'), 0, 0, W, H); this.amb.draw(g); g.globalAlpha = 0.45; g.fillStyle = '#0a0612'; g.fillRect(0, 0, W, H); g.globalAlpha = 1; },
  key(e) { if (e.key === 'Escape') go(TitleScene); },
};

// ================= 지도 =================
const MapScene = {
  enter() {
    this.t = 0; this.hover = null; this.busy = false;
    this.amb = makeAmbient(region().id);
    this.tok = this.tokenPos();
    uiClear();
    uiAdd(`<div id="mp-top"><span class="rname"><small>${region().tag}</small>${region().name}<small class="dim">${DIFF[Run.diff ?? 1].name}</small></span><span id="mpRelics"></span><span id="mpLamp"></span><span id="mpGold"></span>
      <button class="btn sm" id="mpParty">원정대</button><button class="btn sm" id="mpSet">설정</button></div>`);
    uiAdd(`<div id="mp-party"></div>`);
    uiAdd(`<div id="mp-tip" class="box" hidden></div>`);
    $('#mpParty').onclick = () => { SFX.play('select'); openParty(); };
    $('#mpSet').onclick = () => { SFX.play('select'); openSettings(true); };
    this.refresh();
    Music.play(region().music);
    if (Run.intro !== Run.region) {
      Run.intro = Run.region; saveRun();
      const el = uiAdd(`<div class="chapter"><small>${region().tag}</small><b>${region().name}</b><p>${esc(region().desc)}</p></div>`);
      setTimeout(() => el.classList.add('out'), 2600);
      setTimeout(() => el.remove(), 3400);
    }
  },
  refresh() {
    $('#mpGold').innerHTML = goldHTML(Run.gold);
    $('#mpRelics').innerHTML = Run.relics.map(id => `<img class="pix relic" src="${sprURL('rl_' + id)}" title="${RELICS[id].name}: ${RELICS[id].desc}" alt="">`).join('');
    $('#mpLamp').innerHTML = `${sprImg('ic_lantern', 1, 'ico s')}<small>${Math.floor(Run.lamp || 0)}%</small>`;
    $('#mpLamp').title = '등불 게이지 (전투에서 이어져요)';
    $('#mp-party').innerHTML = Run.party.map(h => {
      const s = heroStats(h);
      return `<div class="mcard box ${h.hp > 0 ? '' : 'dead'}"><img class="pix head" src="${headURL('hero_' + h.cls)}" alt=""><span><span class="mline"><b>${esc(h.name)}</b><small>Lv${h.lvl}</small><small class="dim right">${h.hp}/${s.hp}</small></span>${barHTML(h.hp, s.hp, 'hp')}${barHTML(h.mp, s.mp, 'mp')}</span></div>`;
    }).join('');
  },
  reachable() {
    const nodes = Run.map.nodes;
    if (Run.pos == null) return nodes.filter(n => n.l === 0);
    return nodes[Run.pos].next.map(id => nodes[id]);
  },
  tokenPos() {
    if (Run.pos == null) return { x: 14, y: 118 };
    const n = Run.map.nodes[Run.pos];
    return { x: n.x, y: n.y };
  },
  update(dt) { this.t += dt; this.amb.update(dt); },
  draw(g) {
    g.drawImage(getBG(region().id), 0, 0, W, H);
    this.amb.draw(g);
    g.globalAlpha = 0.55; g.fillStyle = '#0a0612'; g.fillRect(0, 0, W, H); g.globalAlpha = 1;
    const nodes = Run.map.nodes, reach = this.busy ? [] : this.reachable(), vis = new Set(Run.visited);
    // 길
    for (const a of nodes) {
      for (const id of a.next) {
        const b = nodes[id];
        const walked = vis.has(a.id) && vis.has(b.id);
        const open = (a.id === Run.pos && reach.includes(b)) || (Run.pos == null && false);
        const c = walked ? '#ffd34d' : open ? '#f4ecd8' : '#5a4a6e';
        const d = Math.hypot(b.x - a.x, b.y - a.y), n = Math.floor(d / 4);
        for (let i = 2; i < n - 1; i++) {
          const x = Math.round(lerp(a.x, b.x, i / n)), y = Math.round(lerp(a.y, b.y, i / n));
          g.fillStyle = c; g.fillRect(x, y, open && (i + Math.floor(this.t * 6)) % 3 === 0 ? 2 : 1, 1);
        }
      }
    }
    if (Run.pos == null) for (const b of reach) {
      const d = Math.hypot(b.x - 14, b.y - 118), n = Math.floor(d / 4);
      for (let i = 2; i < n - 1; i++) { g.fillStyle = '#f4ecd8'; g.fillRect(Math.round(lerp(14, b.x, i / n)), Math.round(lerp(118, b.y, i / n)), 1, 1); }
    }
    // 칸
    for (const n of nodes) {
      const r = n.type === 'boss' ? 13 : 9, can = reach.includes(n), done = vis.has(n.id), hov = this.hover === n;
      if (can) { const pr = r + 3 + Math.sin(this.t * 5) * 1.5; pxCircle(g, n.x, n.y, pr, '#ffd34d'); }
      pxCircle(g, n.x, n.y, r + 1, '#140c1c', true);
      pxCircle(g, n.x, n.y, r, done ? '#2a2038' : hov ? '#5a4a86' : can ? '#3e3060' : '#2a2040', true);
      pxCircle(g, n.x, n.y, r, done ? '#4a3a5e' : n.type === 'boss' ? '#d8323a' : n.type === 'elite' ? '#c86a3a' : '#7a6a9a');
      const ic = getSprite('ic_' + NODE_INFO[n.type].icon);
      g.globalAlpha = done ? 0.35 : can || hov ? 1 : 0.7;
      if (n.type === 'boss') g.drawImage(ic.frames[0], n.x - 14, n.y - 14, 28, 28);
      else dimg(g, ic.frames[0], n.x - 8, n.y - 8);
      g.globalAlpha = 1;
    }
    // 등불 원정대 표시
    const lx = Math.round(this.tok.x), ly = Math.round(this.tok.y - 16 + Math.sin(this.t * 3) * 1.5);
    softGlow(g, lx, ly + 2, 22, '#ffb040', 0.55);
    dimg(g, getSprite('ic_lantern').frames[0], lx - 8, ly - 8);
  },
  nodeAt(x, y) { return Run.map.nodes.find(n => Math.hypot(n.x - x, n.y - y) < (n.type === 'boss' ? 15 : 11)); },
  move(x, y) {
    const n = this.nodeAt(x, y);
    if (n !== this.hover) {
      this.hover = n;
      const tip = $('#mp-tip');
      if (n) {
        const I = NODE_INFO[n.type], extra = n.type === 'boss' ? `<br><small>${esc(ENEMIES[region().boss].name)}</small>` : '';
        tip.innerHTML = `<b>${I.name}</b><br><small>${I.desc}</small>${extra}`;
        const K = Settings.uiK || 1.5;
        tip.style.left = clamp(n.x * K - 52, 4, W * K - 112) + 'px';
        tip.style.top = (n.y > 150 ? n.y * K - 60 : n.y * K + 20) + 'px';
        tip.hidden = false;
      } else tip.hidden = true;
    }
  },
  click(x, y) {
    if (this.busy || UI.root.querySelector('.veil')) return;
    const n = this.nodeAt(x, y);
    if (!n) return;
    if (!this.reachable().includes(n)) { SFX.play('error'); return; }
    this.travel(n);
  },
  key(e) {
    if (this.busy || UI.root.querySelector('.veil')) { if (e.key === 'Escape') closeModal(); return; }
    const r = this.reachable().sort((a, b) => a.y - b.y);
    if (/^[1-9]$/.test(e.key) && +e.key <= r.length) this.travel(r[+e.key - 1]);
    if (e.key === 'p' || e.key === 'P') openParty();
  },
  async travel(n) {
    this.busy = true;
    $('#mp-tip').hidden = true;
    SFX.play('select');
    const a = { ...this.tok };
    for (let i = 0; i < 3; i++) setTimeout(() => SFX.play('step'), i * 150);
    await tween(480, k => { this.tok.x = lerp(a.x, n.x, k); this.tok.y = lerp(a.y, n.y, k); }, ease.inOut);
    Run.pos = n.id; Run.visited.push(n.id);
    saveRun();
    await wait(150);
    await enterNode(n);
  },
};

// 칸에 들어가기
async function enterNode(n) {
  const R = region();
  let res = null;
  if (n.type === 'battle') res = await fight(genEncounter(n), 'normal');
  else if (n.type === 'elite') {
    const ids = [R.elite];
    if (n.l >= 4 && chance(0.5)) ids.push(pick(R.pool));
    res = await fight(ids, 'elite');
  } else if (n.type === 'boss') { await bossTalk(R.boss); res = await fight([R.boss], 'boss'); }
  else if (n.type === 'shop') await openShop(n);
  else if (n.type === 'rest') await openRest();
  else if (n.type === 'event') res = await openEvent();
  else if (n.type === 'treasure') res = await openTreasure();

  if (res === 'lose') return go(GameOverScene);
  if (res === 'win' && (n.type === 'elite' || (n.type === 'boss' && R.boss !== 'ashKing'))) await chooseRelic(n.type === 'boss' ? '우두머리가 지키던 유물' : '강적이 지니고 있던 유물');
  if (n.type === 'boss' && res === 'win') {
    if (R.boss === 'ashKing') return go(EndingScene);
    Run.region++;
    for (const h of Run.party) { const s = heroStats(h); h.hp = s.hp; h.mp = s.mp; }
    Run.map = genMap(Run.region); Run.pos = null; Run.visited = [];
    saveRun();
    return go(RegionClearScene);
  }
  saveRun();
  if (Game.scene !== MapScene) go(MapScene);
  else { MapScene.busy = false; MapScene.refresh(); }
}

function genEncounter(n) {
  const R = region(), l = n.l;
  let cnt = l === 0 ? 2 : l <= 2 ? ri(2, 3) : ri(2, 3) + (R.tier >= 2 && l >= 4 && chance(0.5) ? 1 : 0);
  if (R.tier === 0 && l === 0) cnt = ri(1, 2);
  const ids = [];
  for (let i = 0; i < cnt; i++) ids.push(pick(R.pool));
  if (chance(0.04)) ids[ids.length - 1] = 'goldSlime';
  return ids;
}
async function fight(ids, kind) {
  const r = await startBattle(ids, kind);
  return r;
}

// ================= 상점 =================
function openShop(n) {
  const T = region().tier;
  if (!n.stock) {
    const cons = ['hp', 'mp', 'herb', 'feather', ...shuffle(['bombFire', 'bombIce', 'bombHoly', 'smoke']).slice(0, 2)];
    if (T >= 1) cons.push('hpBig', 'mpBig');
    if (T >= 2) cons.push('elixir');
    n.stock = { items: cons, equips: [0, 0, 0].map(() => randomEquip(T, Math.max(0, rollRarity(T, 0.05)))), healed: false };
    saveRun();
  }
  return new Promise(done => {
    const healCost = price(30 + T * 30);
    if (n.stock.relic === undefined) { const pool = Object.keys(RELICS).filter(id => !Run.relics.includes(id)); n.stock.relic = pool.length ? pick(pool) : null; }
    const relicCost = price(140 + 45 * T);
    const render = () => {
      const m = modal(`
        <h2 class="title-sm">${sprImg('ic_nShop', 1, 'ico')} 떠돌이 상인 <span class="right">${goldHTML(Run.gold)}</span></h2>
        <p class="say">"어서 오게. 이 어둠 속에서 손님은 귀하지."</p>
        <div class="shop">
          <div class="col"><h3>물건</h3>${n.stock.items.map((id, i) => `<button class="row-item btn" data-buy="${i}" ${Run.gold < price(ITEMS[id].price) ? 'disabled' : ''}>${itemIcon(id)}<span>${ITEMS[id].name}<small>${ITEMS[id].desc} · 가진 것 ${Run.items[id] || 0}</small></span><em>${price(ITEMS[id].price)}</em></button>`).join('')}
            <button class="row-item btn" id="shHeal" ${Run.gold < healCost || n.stock.healed ? 'disabled' : ''}>${sprImg('ic_herb', 1, 'ico')}<span>약사의 치료<small>모두 체력·마나 회복, 쓰러진 동료도 일으킴 (한 번)</small></span><em>${healCost}</em></button></div>
          <div class="col">${n.stock.relic ? `<h3>유물</h3><button class="row-item btn" id="shRelic" ${Run.gold < relicCost ? 'disabled' : ''}><img class="pix ico" src="${sprURL('rl_' + n.stock.relic)}" alt=""><span><b>${RELICS[n.stock.relic].name}</b><small>${RELICS[n.stock.relic].desc}</small></span><em>${relicCost}</em></button>` : ''}<h3>장비</h3>${n.stock.equips.map((e, i) => e ? `<button class="row-item btn" data-eq="${i}" ${Run.gold < price(e.value * 2) ? 'disabled' : ''}>${equipIcon(e)}<span>${equipTip(e)}</span><em>${price(e.value * 2)}</em></button>` : '').join('') || '<small class="dim">다 팔렸다</small>'}
            <h3>팔기</h3>${Run.bag.map((e, i) => `<button class="row-item btn" data-sell="${i}">${equipIcon(e)}<span>${equipTip(e)}</span><em>+${Math.round(e.value * 0.6)}</em></button>`).join('') || '<small class="dim">가방에 남는 장비가 없다</small>'}</div>
        </div>
        <div class="row"><button class="btn" id="shParty">원정대</button><button class="btn big" id="shOut">떠나기</button></div>`, 'wide');
      m.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => { const id = n.stock.items[+b.dataset.buy]; if (Run.gold < price(ITEMS[id].price)) return; Run.gold -= price(ITEMS[id].price); addItem(id); SFX.play('coin'); render(); });
      m.querySelectorAll('[data-eq]').forEach(b => b.onclick = () => { const i = +b.dataset.eq, e = n.stock.equips[i]; if (Run.gold < price(e.value * 2)) return; Run.gold -= price(e.value * 2); Run.bag.push(e); n.stock.equips[i] = null; SFX.play('coin'); render(); });
      m.querySelectorAll('[data-sell]').forEach(b => b.onclick = () => { const e = Run.bag.splice(+b.dataset.sell, 1)[0]; Run.gold += Math.round(e.value * 0.6); SFX.play('coin'); render(); });
      const rb = m.querySelector('#shRelic');
      if (rb) rb.onclick = () => { if (Run.gold < relicCost) return; Run.gold -= relicCost; Run.relics.push(n.stock.relic); toast(`유물 「${RELICS[n.stock.relic].name}」를 얻었다`); n.stock.relic = null; SFX.play('open'); render(); };
      m.querySelector('#shHeal').onclick = () => { if (Run.gold < healCost) return; Run.gold -= healCost; n.stock.healed = true; for (const h of Run.party) { const s = heroStats(h); h.hp = s.hp; h.mp = s.mp; } SFX.play('heal'); MapScene.refresh(); render(); };
      m.querySelector('#shParty').onclick = () => openParty(() => render());
      m.querySelector('#shOut').onclick = () => { SFX.play('select'); closeModal(); saveRun(); done(); };
      MapScene.refresh();
    };
    render();
  });
}

// ================= 모닥불 =================
function openRest() {
  return new Promise(done => {
    const finish = msg => {
      MapScene.refresh(); saveRun();
      const m = modal(`<h2 class="title-sm">${sprImg('ic_nRest', 1, 'ico')} 모닥불</h2><p>${msg}</p><button class="btn big" id="rsOk">계속</button>`);
      m.querySelector('#rsOk').onclick = () => { SFX.play('select'); closeModal(); done(); };
    };
    const m = modal(`<h2 class="title-sm">${sprImg('ic_nRest', 1, 'ico')} 모닥불</h2><p class="say">따뜻한 불 곁에서 잠시 숨을 돌린다. 하나만 고를 수 있다.</p>
      <div class="choices">
        <button class="btn choice" id="rsRest"><b>쉬기</b><small>모두 체력·마나 45% 회복. 쓰러진 동료는 30%로 일어난다</small></button>
        <button class="btn choice" id="rsTrain"><b>수련</b><small>동료 한 명이 다음 레벨까지의 경험치 70%를 얻는다</small></button>
        <button class="btn choice" id="rsForge"><b>무기 벼리기</b><small>동료 한 명의 무기를 강화한다 (+1, 능력치 20%↑, 최대 +3)</small></button>
      </div>`);
    m.querySelector('#rsRest').onclick = () => {
      SFX.play('heal');
      for (const h of Run.party) {
        const s = heroStats(h);
        if (h.hp <= 0) h.hp = Math.round(s.hp * 0.3);
        else h.hp = Math.min(s.hp, h.hp + Math.round(s.hp * 0.45));
        h.mp = Math.min(s.mp, h.mp + Math.round(s.mp * 0.45));
      }
      finish('불꽃이 몸을 데운다. 모두 기운을 되찾았다.');
    };
    m.querySelector('#rsTrain').onclick = () => chooseHero('누가 수련할까요?', h => h.hp > 0 && h.lvl < MAX_LVL, h => {
      const ups = gainXp(h, Math.ceil((xpNeed(h.lvl) - h.xp) * 0.7) + 1);
      SFX.play(ups.length ? 'levelup' : 'buff');
      finish(`${esc(h.name)}이(가) 밤새 수련했다.${ups.length ? ` 레벨 ${h.lvl}!` : ''}${ups.flatMap(u => u.learned).map(n => ` 새 기술 「${n}」`).join('')}`);
    }, () => openRest().then(done));
    m.querySelector('#rsForge').onclick = () => chooseHero('누구의 무기를 벼릴까요?', h => h.equip.weapon && (h.equip.weapon.plus || 0) < 3, h => {
      const e = h.equip.weapon;
      e.plus = (e.plus || 0) + 1;
      for (const k in e.stats) if (e.stats[k] > 0) e.stats[k] = Math.round(e.stats[k] * 1.2 + 1);
      e.name = e.name.replace(/ \+\d$/, '') + ' +' + e.plus;
      e.value = Math.round(e.value * 1.3);
      SFX.play('smash');
      finish(`망치 소리가 울린다. ${esc(e.name)} 완성!<br><small>${esc(equipLine(e))}</small>`);
    }, () => openRest().then(done));
  });
}
function chooseHero(title, ok, then, back) {
  const m = modal(`<h2 class="title-sm">${title}</h2><div class="choices">${Run.party.map((h, i) => `<button class="btn choice hero" data-i="${i}" ${ok(h) ? '' : 'disabled'}><img class="pix head" src="${headURL('hero_' + h.cls)}" alt=""><b>${esc(h.name)}</b><small>${CLASSES[h.cls].name} Lv${h.lvl}${h.equip.weapon ? ' · ' + esc(h.equip.weapon.name) : ''}</small></button>`).join('')}</div>
    ${back ? '<button class="btn" id="chBack">뒤로</button>' : ''}`);
  m.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { SFX.play('select'); then(Run.party[+b.dataset.i]); });
  if (back) m.querySelector('#chBack').onclick = () => { SFX.play('cancel'); back(); };
}

// ================= 보물 =================
async function openTreasure() {
  const T = region().tier;
  if (chance(0.22)) {
    await new Promise(r => {
      const m = modal(`<h2 class="title-sm">${sprImg('ic_nTreasure', 1, 'ico')} 보물 상자</h2><p>상자를 여는 순간… 뚜껑에 이빨이 돋아났다!</p><button class="btn big warn" id="trF">싸운다</button>`);
      SFX.play('roar');
      m.querySelector('#trF').onclick = () => { closeModal(); r(); };
    });
    return fight(['mimic'], 'event');
  }
  const rpool = Object.keys(RELICS).filter(id => !Run.relics.includes(id));
  const relic = rpool.length && chance(0.35) ? pick(rpool) : null;
  if (relic) Run.relics.push(relic);
  const gold = ri(30, 60) * (T + 1), items = [pick(['hp', 'mp', 'hpBig', 'feather', 'bombFire', 'herb'])], eq = !relic && chance(0.6) ? randomEquip(T, Math.max(1, rollRarity(T, 0.1))) : null;
  Run.gold += gold; Run.stats.gold += gold;
  items.forEach(id => addItem(id));
  if (eq) Run.bag.push(eq);
  SFX.play('open');
  await new Promise(r => {
    const m = modal(`<h2 class="title-sm">${sprImg('ic_nTreasure', 1, 'ico')} 보물 상자</h2><p>상자 안에서 빛이 새어 나온다.</p>
      <div class="loots">${goldHTML(gold)}${items.map(id => `<span class="loot">${itemIcon(id)}${ITEMS[id].name}</span>`).join('')}</div>
      ${eq ? `<div class="loot eq">${equipIcon(eq)}<span>${equipTip(eq)}</span></div>` : ''}
      ${relic ? `<div class="loot eq"><img class="pix ico" src="${sprURL('rl_' + relic)}" alt=""><span><b>유물 · ${RELICS[relic].name}</b><br><small>${RELICS[relic].desc}</small></span></div>` : ''}
      <button class="btn big" id="trOk">챙긴다</button>`);
    m.querySelector('#trOk').onclick = () => { SFX.play('select'); closeModal(); r(); };
  });
  MapScene.refresh();
  return null;
}

// ================= 사건 =================
function heal(h, p) { if (h.hp <= 0) return; const s = heroStats(h); h.hp = Math.min(s.hp, h.hp + Math.round(s.hp * p)); }
function hurt(h, p) { if (h.hp <= 0) return; const s = heroStats(h); h.hp = Math.max(1, h.hp - Math.round(s.hp * p)); }
const EVENTS = [
  {
    title: '이끼 덮인 제단', art: 'ic_nEvent', text: '오래된 제단 위에 작은 불씨가 깜빡인다. 누군가 기도하던 자리다.',
    choices: [
      { label: '기도한다', desc: '모두 체력 30% 회복', go: () => { Run.party.forEach(h => heal(h, 0.3)); SFX.play('holy'); return '따뜻한 빛이 원정대를 감쌌다.'; } },
      { label: '금화 40개를 바친다', desc: '무언가를 받을지도', need: () => Run.gold >= 40, go: () => { Run.gold -= 40; const e = randomEquip(region().tier, 2); Run.bag.push(e); SFX.play('open'); return `제단이 빛나며 장비를 내려 주었다.<br>${equipTip(e)}`; } },
      { label: '지나친다', go: () => '조용히 지나쳤다.' },
    ],
  },
  {
    title: '떠도는 음유시인', art: 'ic_nEvent', text: '"용감한 원정대여, 노래 한 곡 들어 보겠소? 듣고 나면 힘이 날 거요."',
    choices: [
      { label: '노래를 듣는다', desc: '다음 전투 시작 때 모두 공격↑', go: () => { Run.blessing = 'atkUp'; SFX.play('buff'); return '용사의 노래가 가슴을 뛰게 한다. 다음 전투에서 모두 공격↑'; } },
      { label: '금화 25개를 준다', desc: '모두 경험치', need: () => Run.gold >= 25, go: () => { Run.gold -= 25; const n = 12 + region().tier * 30; let up = ''; Run.party.forEach(h => { if (gainXp(h, n).length) up += ` ${h.name} 레벨 ${h.lvl}!`; }); SFX.play('levelup'); return `시인이 옛 영웅들의 싸움 이야기를 들려주었다. 모두 경험치 +${n}.${up}`; } },
      { label: '거절한다', go: () => '시인은 어깨를 으쓱하고 다른 곡을 흥얼거렸다.' },
    ],
  },
  {
    title: '맑은 샘', art: 'ic_nEvent', text: '바위 틈에서 맑은 물이 솟는다. 그런데 물빛이 살짝 푸르스름하다.',
    choices: [
      { label: '마신다', desc: '운이 좋으면 크게 회복', go: () => { if (chance(0.7)) { Run.party.forEach(h => { heal(h, 1); const s = heroStats(h); if (h.hp > 0) h.mp = s.mp; }); SFX.play('heal'); return '시원하다! 모두 체력과 마나가 가득 찼다.'; } Run.party.forEach(h => hurt(h, 0.15)); SFX.play('poison'); return '배가 아프다… 모두 체력 15%를 잃었다.'; } },
      { label: '물병에 담는다', desc: '마나 물약 2개', go: () => { addItem('mp', 2); SFX.play('coin'); return '마나 물약 2개를 얻었다.'; } },
    ],
  },
  {
    title: '무너진 다리', art: 'ic_nEvent', text: '낡은 다리 건너편에 반짝이는 무언가가 보인다. 다리가 삐걱거린다.',
    choices: [
      { label: '조심히 건넌다', desc: '한 명이 다칠 수 있다', go: () => { const g = ri(40, 80) * (region().tier + 1); Run.gold += g; Run.stats.gold += g; const h = pick(aliveHeroes()); if (chance(0.5)) { hurt(h, 0.25); SFX.play('hit'); return `금화 ${g}개를 주웠지만, ${h.name}이(가) 발을 헛디뎌 다쳤다.`; } SFX.play('coin'); return `무사히 건너 금화 ${g}개를 주웠다!`; } },
      { label: '돌아간다', go: () => '안전한 길로 돌아갔다.' },
    ],
  },
  {
    title: '떠돌이 대장장이', art: 'ic_nEvent', text: '"망치 한 번에 금화 60개! 무기가 몰라보게 좋아질 거야."',
    choices: [
      { label: '맡긴다 (금화 60)', desc: '모든 동료의 무기 공격·마력 +3', need: () => Run.gold >= 60, go: () => { Run.gold -= 60; Run.party.forEach(h => { const e = h.equip.weapon; if (!e) return; if (e.stats.atk) e.stats.atk += 3; if (e.stats.mag) e.stats.mag += 3; }); SFX.play('smash'); return '쾅! 쾅! 무기들이 새것처럼 빛난다.'; } },
      { label: '구경만 한다', go: () => '대장장이는 다시 망치질을 시작했다.' },
    ],
  },
  {
    title: '별똥별', art: 'ic_nEvent', text: '하늘을 가르며 별똥별이 떨어진다. 소원을 하나 빌 수 있을 것 같다.',
    choices: [
      { label: '"부자가 되고 싶어"', desc: '금화', go: () => { const g = 70 + region().tier * 60; Run.gold += g; Run.stats.gold += g; SFX.play('coin'); return `발밑에 금화 ${g}개가 떨어져 있었다.`; } },
      { label: '"강해지고 싶어"', desc: '무작위 동료 한 명 능력치 영구 상승', go: () => { const h = pick(Run.party), k = pick(['atk', 'mag', 'def', 'spd', 'hp']); const v = k === 'hp' ? 15 : 3; h.perm[k] = (h.perm[k] || 0) + v; SFX.play('buff'); return `${h.name}의 ${STAT_NAME[k]}이(가) 영원히 ${v} 올랐다.`; } },
      { label: '"모두 무사하길"', desc: '불사조 깃털', go: () => { addItem('feather'); SFX.play('holy'); return '불사조 깃털 하나가 하늘에서 내려왔다.'; } },
    ],
  },
  {
    title: '그림자 상인', art: 'ic_nEvent', text: '"대가만 치르면 전설의 물건을 주지. 대가는… 네 피 조금."',
    choices: [
      { label: '거래한다', desc: '한 명 최대 체력 영구 -12, 전설 장비', go: () => { const h = pick(aliveHeroes()); h.perm.hp = (h.perm.hp || 0) - 12; const s = heroStats(h); h.hp = Math.min(h.hp, s.hp); const e = randomEquip(region().tier, 3); Run.bag.push(e); SFX.play('dark'); return `${h.name}의 몸에서 힘이 조금 빠져나갔다.<br>${equipTip(e)}`; } },
      { label: '거절한다', go: () => '"아쉽군…" 상인은 그림자 속으로 사라졌다.' },
    ],
  },
  {
    title: '버려진 야영지', art: 'ic_nEvent', text: '누군가 급히 떠난 흔적이다. 배낭 하나가 남아 있다.',
    choices: [
      { label: '배낭을 뒤진다', desc: '물건을 얻는다. 무언가 숨어 있을지도', go: async () => { if (chance(0.3)) { SFX.play('roar'); return { fight: [pick(region().pool), pick(region().pool)], text: '배낭에서 몬스터가 튀어나왔다!' }; } addItem('hp', 2); addItem(pick(['bombFire', 'bombIce', 'smoke'])); SFX.play('coin'); return '회복 물약 2개와 폭탄을 찾았다.'; } },
      { label: '잠깐 쉰다', desc: '모두 체력 20% 회복', go: () => { Run.party.forEach(h => heal(h, 0.2)); SFX.play('heal'); return '모닥불 자리에서 잠깐 쉬었다.'; } },
    ],
  },
  {
    title: '길 잃은 아이 유령', art: 'ic_nEvent', text: '희미한 아이 유령이 울고 있다. "엄마한테 가는 길을 잃었어…"',
    choices: [
      { label: '길을 함께 찾아 준다', desc: '모두 경험치, 조금 지친다', go: () => { const n = 20 + region().tier * 40; Run.party.forEach(h => { hurt(h, 0.08); gainXp(h, n); }); SFX.play('holy'); return `아이가 웃으며 빛이 되어 사라졌다. 모두 경험치 +${n}.`; } },
      { label: '등불 빛을 나눠 준다', desc: '한 명 마나 전부 소모, 행운의 선물', go: () => { const h = pick(aliveHeroes()); h.mp = 0; const e = randomEquip(region().tier, 2); Run.bag.push(e); SFX.play('holy'); return `${h.name}의 등불 빛을 받은 아이가 작은 선물을 두고 갔다.<br>${equipTip(e)}`; } },
    ],
  },
  {
    title: '수련 표지판', art: 'ic_nEvent', text: '"이 앞, 강한 자만 지나갈 것." 옆에는 허수아비가 서 있다… 아니, 움직인다!',
    choices: [
      { label: '도전한다', desc: '강적과 싸워 이기면 장비', go: () => ({ fight: [region().elite], text: '허수아비 뒤에서 강적이 걸어 나왔다!', kind: 'elite' }) },
      { label: '돌아간다', go: () => '오늘은 그냥 지나가기로 했다.' },
    ],
  },
];
async function openEvent() {
  const ev = pick(EVENTS);
  const out = await new Promise(res => {
    const m = modal(`<h2 class="title-sm">${sprImg(ev.art, 1, 'ico')} ${ev.title}</h2><p class="say">${ev.text}</p>
      <div class="choices">${ev.choices.map((c, i) => `<button class="btn choice" data-i="${i}" ${c.need && !c.need() ? 'disabled' : ''}><b>${c.label}</b>${c.desc ? `<small>${c.desc}</small>` : ''}</button>`).join('')}</div>`);
    m.querySelectorAll('[data-i]').forEach(b => b.onclick = async () => { SFX.play('select'); res(await ev.choices[+b.dataset.i].go()); });
  });
  if (out && out.fight) {
    await new Promise(r => {
      const m = modal(`<h2 class="title-sm">${ev.title}</h2><p>${out.text}</p><button class="btn big warn" id="evF">싸운다</button>`);
      m.querySelector('#evF').onclick = () => { closeModal(); r(); };
    });
    return fight(out.fight, out.kind || 'event');
  }
  MapScene.refresh();
  await new Promise(r => {
    const m = modal(`<h2 class="title-sm">${ev.title}</h2><p>${out}</p><button class="btn big" id="evOk">계속</button>`);
    m.querySelector('#evOk').onclick = () => { SFX.play('select'); closeModal(); r(); };
  });
  MapScene.refresh();
  return null;
}

// ================= 원정대 (장비, 물건) =================
function openParty(onClose) {
  let cur = 0, pickSlot = null;
  const render = () => {
    const h = Run.party[cur], s = heroStats(h), C = CLASSES[h.cls];
    const slots = [['weapon', '무기'], ['armor', '갑옷'], ['acc', '장신구']];
    const cand = pickSlot ? Run.bag.map((e, i) => [e, i]).filter(([e]) => e.slot === pickSlot && canEquip(h, e)) : [];
    const items = ITEM_ORDER.filter(id => Run.items[id] > 0);
    const m = modal(`
      <div class="pt-tabs">${Run.party.map((p, i) => `<button class="btn tab ${i === cur ? 'on' : ''}" data-tab="${i}"><img class="pix head" src="${headURL('hero_' + p.cls)}" alt="">${esc(p.name)}</button>`).join('')}<span class="right">${goldHTML(Run.gold)}</span></div>
      <div class="pt-body">
        <div class="pt-left">
          <div class="pt-hero">${sprImg('hero_' + h.cls, 2)}<div><b>${esc(h.name)}</b><small>${C.name} · Lv ${h.lvl}</small>
            <small>경험치 ${h.lvl >= MAX_LVL ? 'MAX' : `${h.xp} / ${xpNeed(h.lvl)}`}</small>${h.hp <= 0 ? '<small class="bad">쓰러짐</small>' : ''}</div></div>
          <div class="pt-stats">
            <span>체력</span><b>${h.hp}/${s.hp}</b><span>마나</span><b>${h.mp}/${s.mp}</b>
            <span>공격</span><b>${s.atk}</b><span>마력</span><b>${s.mag}</b><span>방어</span><b>${s.def}</b><span>마법 방어</span><b>${s.res}</b>
            <span>속도</span><b>${s.spd}</b><span>치명</span><b>${s.crit}%</b>
          </div>
        </div>
        <div class="pt-right">
          ${slots.map(([k, n]) => { const e = h.equip[k]; return `<button class="btn slot ${pickSlot === k ? 'on' : ''}" data-slot="${k}"><em>${n}</em>${e ? equipIcon(e) + `<span>${equipTip(e)}</span>` : '<span class="dim">비어 있음</span>'}</button>`; }).join('')}
          ${pickSlot ? `<div class="cand"><small>가방에서 고르기</small>${cand.map(([e, i]) => `<button class="btn row-item" data-eq="${i}">${equipIcon(e)}<span>${equipTip(e)}</span></button>`).join('') || '<small class="dim">입을 수 있는 장비가 없다</small>'}
            ${h.equip[pickSlot] ? '<button class="btn sm" id="ptOff">벗기</button>' : ''}</div>`
            : `<div class="pt-skills">${C.skills.map(([l, id]) => `<span class="${h.lvl >= l ? '' : 'dim'}"><em>Lv${l}</em> <b>${SKILLS[id].name}</b> <small>${SKILLS[id].mp ? SKILLS[id].mp + 'MP · ' : ''}${SKILLS[id].desc}</small></span>`).join('')}</div>`}
        </div>
      </div>
      <div class="pt-items">${items.map(id => `<button class="btn itm" data-item="${id}" title="${ITEMS[id].desc}" ${ITEMS[id].battle ? 'disabled' : ''}>${itemIcon(id)}<small>${Run.items[id]}</small></button>`).join('') || '<small class="dim">물건 없음</small>'}
        <small class="dim">물약을 누르면 ${esc(h.name)}에게 써요 · 가방 장비 ${Run.bag.length}개</small></div>
      <div class="row"><button class="btn big" id="ptClose">닫기</button></div>`, 'wide party');
    m.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { cur = +b.dataset.tab; pickSlot = null; SFX.play('move'); render(); });
    m.querySelectorAll('[data-slot]').forEach(b => b.onclick = () => { pickSlot = pickSlot === b.dataset.slot ? null : b.dataset.slot; SFX.play('move'); render(); });
    m.querySelectorAll('[data-eq]').forEach(b => b.onclick = () => {
      const i = +b.dataset.eq, e = Run.bag[i], old = h.equip[e.slot];
      const before = heroStats(h);
      Run.bag.splice(i, 1);
      if (old) Run.bag.push(old);
      h.equip[e.slot] = e;
      const after = heroStats(h);
      if (h.hp > 0) h.hp = clamp(h.hp + (after.hp - before.hp), 1, after.hp);
      h.mp = clamp(h.mp + (after.mp - before.mp), 0, after.mp);
      SFX.play('guard'); pickSlot = null; render();
    });
    const off = m.querySelector('#ptOff');
    if (off) off.onclick = () => { const e = h.equip[pickSlot]; h.equip[pickSlot] = null; Run.bag.push(e); const s2 = heroStats(h); h.hp = Math.min(h.hp, s2.hp); h.mp = Math.min(h.mp, s2.mp); SFX.play('cancel'); pickSlot = null; render(); };
    m.querySelectorAll('[data-item]').forEach(b => b.onclick = () => {
      const id = b.dataset.item, it = ITEMS[id], st = heroStats(h);
      if (it.revive) { if (h.hp > 0) return toast('쓰러진 동료에게만 쓸 수 있어요'); h.hp = Math.round(st.hp * it.revive); }
      else {
        if (h.hp <= 0) return toast('쓰러진 동료는 깃털로 일으켜야 해요');
        if (it.full) { h.hp = st.hp; h.mp = st.mp; }
        if (it.heal) h.hp = Math.min(st.hp, h.hp + it.heal);
        if (it.mpGain) h.mp = Math.min(st.mp, h.mp + it.mpGain);
      }
      Run.items[id]--; if (Run.items[id] <= 0) delete Run.items[id];
      SFX.play('heal'); render();
    });
    m.querySelector('#ptClose').onclick = () => { SFX.play('cancel'); closeModal(); saveRun(); if (Game.scene === MapScene) MapScene.refresh(); if (onClose) onClose(); };
  };
  render();
}

// ================= 설정, 도움말 =================
function openSettings(inRun) {
  const m = modal(`<h2 class="title-sm">설정</h2>
    <div class="set">
      <label>효과음 <input type="range" id="stSfx" min="0" max="1" step="0.1" value="${Settings.sfx}"></label>
      <label>음악 <input type="range" id="stMus" min="0" max="1" step="0.1" value="${Settings.music}"></label>
      <label>전투 속도 <button class="btn sm" id="stSpd">x${Settings.speed}</button></label>
      <label>화면 흔들림 <button class="btn sm" id="stShake">${Settings.shake ? '켬' : '끔'}</button></label>
      <label>글자·메뉴 크기 <span>${[[1.8, '작게'], [1.5, '보통'], [1.3, '크게']].map(([k, n]) => `<button class="btn sm uik ${(Settings.uiK || 1.5) === k ? 'on' : ''}" data-k="${k}">${n}</button>`).join('')}</span></label>
    </div>
    <div class="row">${inRun ? '<button class="btn warn" id="stQuit">처음 화면으로</button>' : ''}<button class="btn big" id="stOk">닫기</button></div>`);
  m.querySelector('#stSfx').oninput = e => { Settings.sfx = +e.target.value; setVolumes(); saveSettings(); SFX.play('move'); };
  m.querySelector('#stMus').oninput = e => { Settings.music = +e.target.value; setVolumes(); saveSettings(); };
  m.querySelector('#stSpd').onclick = e => { Settings.speed = Settings.speed === 1 ? 2 : 1; e.target.textContent = 'x' + Settings.speed; saveSettings(); SFX.play('select'); };
  m.querySelectorAll('.uik').forEach(b => b.onclick = () => { Settings.uiK = +b.dataset.k; saveSettings(); resize(); SFX.play('select'); m.querySelectorAll('.uik').forEach(x => x.classList.toggle('on', x === b)); });
  m.querySelector('#stShake').onclick = e => { Settings.shake = !Settings.shake; e.target.textContent = Settings.shake ? '켬' : '끔'; saveSettings(); SFX.play('select'); };
  if (inRun) m.querySelector('#stQuit').onclick = () => { saveRun(); SFX.play('cancel'); go(TitleScene); };
  m.querySelector('#stOk').onclick = () => { SFX.play('cancel'); closeModal(); };
}
function openHelp() {
  const m = modal(`<h2 class="title-sm">하는 방법</h2><div class="help">
    <p><b>목표</b> · 동료 3명과 함께 4개의 땅을 지나 잿빛 왕을 쓰러뜨려요.</p>
    <p><b>지도</b> · 빛나는 칸을 눌러 앞으로 가요. 전투, 강적, 상인, 모닥불, 사건, 보물 중에서 길을 골라요. 마지막 칸에는 우두머리가 있어요.</p>
    <p><b>전투</b> · 빠른 순서대로 한 명씩 움직여요. 공격·기술·물건·방어 중에서 고르고, 적을 눌러 대상을 정해요.</p>
    <p><b>약점</b> · 불, 얼음, 번개, 빛, 어둠, 독 속성이 있어요. 약점을 찌르면 1.5배! 한 번 알아낸 약점은 기억해요.</p>
    <p><b>단축키</b> · 1~5 명령, 방향키와 Enter 고르기, Esc 뒤로, A 자동 전투, S 전투 속도, 지도에서 P 원정대</p>
    <p><b>등불 게이지</b> · 싸울수록 왼쪽 위 등불이 차올라요. 가득 차면 「필살기」로 직업마다 다른 큰 기술을 써요. 게이지는 다음 전투로 이어져요.</p>
    <p><b>유물</b> · 강적·우두머리·보물·상인에게서 얻는 영원한 힘이에요. 지도 위쪽에 모여요.</p>
    <p><b>변종</b> · 빛을 두른 몬스터는 특별한 힘이 있어요. 대신 경험치와 금화를 더 줘요.</p>
    <p><b>쓰러짐</b> · 쓰러진 동료는 모닥불, 부활 기술, 불사조 깃털로 일으켜요. 모두 쓰러지면 여정이 끝나요.</p>
  </div><button class="btn big" id="hpOk">닫기</button>`, 'wide');
  m.querySelector('#hpOk').onclick = () => { SFX.play('cancel'); closeModal(); };
}

// ================= 장 끝, 게임 끝 =================
const RegionClearScene = {
  enter() {
    this.t = 0;
    uiClear();
    const prev = REGIONS[Run.region - 1], next = region();
    uiAdd(`<div class="center-card box"><small>${prev.tag} 완료</small><h2 class="title-sm">${prev.name}에 빛이 돌아왔다</h2>
      <p>등불이 한층 밝아졌다. 모두 기운을 되찾고, 쓰러진 동료도 일어났다.</p>
      <p class="dim">다음 땅 · <b>${next.name}</b></p><button class="btn big" id="rcGo">계속</button></div>`);
    $('#rcGo').onclick = () => { SFX.play('select'); go(MapScene); };
    SFX.play('levelup');
    Music.play('title');
  },
  update(dt) { this.t += dt; },
  draw(g) {
    g.drawImage(getBG(REGIONS[Run.region - 1].id), 0, 0, W, H);
    g.globalAlpha = 0.5; g.fillStyle = '#0a0612'; g.fillRect(0, 0, W, H); g.globalAlpha = 1;
    softGlow(g, 240, 135, 110 + Math.sin(this.t * 2) * 8, '#ffd34d', 0.4);
  },
  key(e) { if (e.key === 'Enter') $('#rcGo').click(); },
};

function runSummary() {
  const s = Run.stats, min = Math.round((Date.now() - s.start) / 60000);
  return `<div class="sum"><span>도달한 땅</span><b>${region().name}</b><span>이긴 전투</span><b>${s.battles}</b><span>쓰러뜨린 적</span><b>${s.kills}</b><span>모은 금화</span><b>${fmt(s.gold)}</b><span>걸린 시간</span><b>${min}분</b></div>
    <div class="sum-party">${Run.party.map(h => `<span>${sprImg('hero_' + h.cls, 1)}<small>${esc(h.name)} Lv${h.lvl}</small></span>`).join('')}</div>`;
}
const GameOverScene = {
  enter() {
    saveRecord(false);
    uiClear();
    uiAdd(`<div class="center-card box"><h2 class="title-sm bad">원정대가 쓰러졌다</h2><p>등불이 꺼지고 어둠이 내려앉았다…</p>${runSummary()}<button class="btn big" id="goT">처음으로</button></div>`);
    clearSave();
    $('#goT').onclick = () => { SFX.play('select'); go(TitleScene); };
  },
  update() {},
  draw(g) { g.drawImage(getBG(region().id), 0, 0, W, H); g.globalAlpha = 0.75; g.fillStyle = '#0a0612'; g.fillRect(0, 0, W, H); g.globalAlpha = 1; },
};
const EndingScene = {
  enter() {
    this.t = 0;
    this.amb = makeAmbient('title');
    Run.region = 3;
    saveRecord(true);
    uiClear();
    uiAdd(`<div class="center-card box ending"><small>끝</small><h2 class="title-sm">해가 돌아왔다</h2>
      <p>잿빛 왕이 쓰러지자 왕관 속에 갇혀 있던 해의 불씨가 하늘로 솟아올랐다.<br>네 개의 땅에 다시 아침이 찾아왔다.</p>${runSummary()}
      <button class="btn big" id="edT">처음으로</button></div>`);
    clearSave();
    $('#edT').onclick = () => { SFX.play('select'); go(TitleScene); };
    SFX.play('victory');
    Music.play('title');
  },
  update(dt) { this.t += dt; this.amb.update(dt); },
  draw(g) {
    g.drawImage(getBG('title'), 0, 0, W, H);
    softGlow(g, 240, 60 - Math.min(30, this.t * 6), 140, '#ffe8a0', Math.min(0.7, this.t * 0.12));
    this.amb.draw(g);
  },
};


// ================= 유물 고르기, 우두머리 대화 =================
const price = p => Math.round(p * (hasRelic('seal') ? 0.75 : 1));
function chooseRelic(title) {
  const pool = shuffle(Object.keys(RELICS).filter(id => !Run.relics.includes(id))).slice(0, 3);
  if (!pool.length) return Promise.resolve();
  return new Promise(res => {
    SFX.play('open');
    const m = modal(`<h2 class="title-sm">${sprImg('ic_nTreasure', 1, 'ico')} ${title}</h2><p class="say">하나를 골라 가져갈 수 있다.</p>
      <div class="relic-pick">${pool.map(id => `<button class="btn relic-card" data-r="${id}"><img class="pix" src="${sprURL('rl_' + id)}" alt=""><b>${RELICS[id].name}</b><small>${RELICS[id].desc}</small></button>`).join('')}</div>
      <button class="btn sm" id="rlSkip">가져가지 않는다</button>`, 'wide');
    m.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { Run.relics.push(b.dataset.r); SFX.play('levelup'); closeModal(); saveRun(); res(); });
    m.querySelector('#rlSkip').onclick = () => { SFX.play('cancel'); closeModal(); res(); };
  });
}
function bossTalk(boss) {
  const lines = BOSS_TALK[boss];
  if (!lines) return Promise.resolve();
  const hero = aliveHeroes()[0] || Run.party[0];
  const seq = [[ENEMIES[boss].name, headURL(ENEMIES[boss].spr, true), lines[0], 'boss'], [hero.name, headURL('hero_' + hero.cls), lines[1], 'hero']];
  return new Promise(res => {
    let i = 0;
    const next = () => {
      if (i >= seq.length) { closeModal(); res(); return; }
      const [name, img, text, side] = seq[i++];
      SFX.play(side === 'boss' ? 'roar' : 'select');
      const m = modal(`<div class="talk ${side}"><img class="pix" src="${img}" alt=""><div><b>${esc(name)}</b><p class="typed"></p></div></div><button class="btn big" id="tkNext">${i >= seq.length ? '싸운다!' : '다음'}</button>`, 'talkbox');
      const p = m.querySelector('.typed');
      let n = 0;
      const tm = setInterval(() => { n++; p.textContent = text.slice(0, n); if (n >= text.length) clearInterval(tm); }, 28);
      m.querySelector('#tkNext').onclick = () => { if (n < text.length) { n = text.length; p.textContent = text; clearInterval(tm); return; } clearInterval(tm); next(); };
    };
    next();
  });
}

// ================= 시작 이야기 =================
const IntroScene = {
  enter() {
    this.i = 0; this.t = 0; this.n = 0;
    this.amb = makeAmbient('title');
    uiClear();
    uiAdd(`<div class="story"><p id="stText"></p><div class="row"><button class="btn sm" id="stSkip">건너뛰기</button><button class="btn" id="stNext">다음</button></div></div>`);
    $('#stNext').onclick = () => this.next();
    $('#stSkip').onclick = () => { SFX.play('cancel'); go(MapScene); };
    Music.play('title');
  },
  next() {
    const txt = INTRO[this.i].text;
    if (this.n < txt.length) { this.n = txt.length; return; }
    SFX.play('select');
    if (++this.i >= INTRO.length) return go(MapScene);
    this.t = 0; this.n = 0;
  },
  update(dt) {
    this.t += dt; this.amb.update(dt);
    const txt = INTRO[Math.min(this.i, INTRO.length - 1)].text;
    this.n = Math.min(txt.length, this.n + dt * 26);
    const el = $('#stText');
    if (el) el.textContent = txt.slice(0, Math.floor(this.n));
  },
  draw(g) {
    const sc = INTRO[Math.min(this.i, INTRO.length - 1)];
    const z = 1.06 + this.t * 0.01;
    g.save(); g.translate(240, 120); g.scale(z, z); g.translate(-240 - this.t * 2, -120);
    g.drawImage(getBG(sc.bg), 0, 0, W, H);
    g.restore();
    this.amb.draw(g);
    if (sc.party) {
      Run.party.forEach((h, i) => {
        const s = getSprite('hero_' + h.cls), x = 90 + i * 40 + this.t * 10, y = 200 + (i % 2) * 6;
        softGlow(g, x + 10, y - 20, 26, '#ffb040', i === 0 ? 0.35 : 0);
        dimg(g, s.frames[Math.floor(this.t * 4 + i) % 2], x - 20, y - 35, 1);
      });
      dimg(g, getSprite('ic_lantern').frames[0], 90 + this.t * 10 + 12, 160);
    }
    const a = Math.min(1, this.t * 1.5);
    g.globalAlpha = 1 - a; g.fillStyle = '#0a0612'; g.fillRect(0, 0, W, H); g.globalAlpha = 1;
    const gr = g.createLinearGradient(0, 170, 0, 270);
    gr.addColorStop(0, 'rgba(10,6,18,0)'); gr.addColorStop(1, 'rgba(10,6,18,0.85)');
    g.fillStyle = gr; g.fillRect(0, 170, W, 100);
  },
  key(e) { if (e.key === 'Enter' || e.key === ' ') this.next(); if (e.key === 'Escape') go(MapScene); },
  click() { this.next(); },
};

// ================= 몬스터 도감 =================
const DexScene = {
  enter() {
    this.t = 0;
    this.amb = makeAmbient('title');
    uiClear();
    const known = DEX_ORDER.filter(id => DEX[id] && DEX[id].seen).length;
    uiAdd(`<div class="dex box"><div class="dex-head"><b>몬스터 도감</b><small>${known} / ${DEX_ORDER.length} 발견</small><button class="btn sm right" id="dxBack">닫기</button></div>
      <div class="dex-body"><div class="dex-grid">${DEX_ORDER.map(id => { const d = DEX[id]; return `<button class="btn dcell ${d && d.seen ? '' : 'unknown'}" data-id="${id}"><img class="pix" src="${headURL(ENEMIES[id].spr, true)}" alt=""></button>`; }).join('')}</div>
      <div class="dex-info" id="dxInfo"><small class="dim">몬스터를 눌러 보세요</small></div></div></div>`);
    UI.root.querySelectorAll('.dcell').forEach(b => { b.onclick = () => { SFX.play('move'); this.show(b.dataset.id); }; });
    $('#dxBack').onclick = () => { SFX.play('cancel'); go(TitleScene); };
    this.show(DEX_ORDER.find(id => DEX[id] && DEX[id].seen) || DEX_ORDER[0]);
  },
  show(id) {
    const d = DEX[id], e = ENEMIES[id], r = enemyRegion(id), seen = d && d.seen, kills = d ? d.kills : 0;
    UI.root.querySelectorAll('.dcell').forEach(b => b.classList.toggle('on', b.dataset.id === id));
    const s = getSprite(e.spr), k = Math.min(1.6, 80 / s.h, 110 / s.w);
    $('#dxInfo').innerHTML = `<div class="dex-art"><img class="pix ${seen ? '' : 'sil'}" src="${sprURL(e.spr)}" style="width:${s.w * k}px;height:${s.h * k}px;transform:scaleX(-1)" alt=""></div>
      <b>${seen ? esc(e.name) : '???'}</b><small>${r ? r.tag + ' ' + r.name : '어디서나'}${e.boss ? ' · 우두머리' : e.elite ? ' · 강적' : ''}</small>
      <p>${seen ? esc(ENEMY_DESC[id] || '') : '아직 만나지 못했다.'}</p>
      ${kills ? `<div class="dex-st"><span>체력</span><b>${e.hp}</b><span>공격</span><b>${e.atk}</b><span>마력</span><b>${e.mag}</b><span>속도</span><b>${e.spd}</b>
        <span>약점</span><b>${(e.weak || []).map(x => EL_NAME[x]).join(' ') || '없음'}</b><span>저항</span><b>${(e.resist || []).map(x => EL_NAME[x]).join(' ') || '없음'}</b></div>` : seen ? '<small class="dim">한 번 쓰러뜨리면 자세한 정보가 보여요</small>' : ''}
      <small class="dim">만난 횟수 ${d ? d.seen : 0} · 쓰러뜨린 횟수 ${kills}</small>`;
  },
  update(dt) { this.t += dt; this.amb.update(dt); },
  draw(g) { g.drawImage(getBG('title'), 0, 0, W, H); this.amb.draw(g); g.globalAlpha = 0.5; g.fillStyle = '#0a0612'; g.fillRect(0, 0, W, H); g.globalAlpha = 1; },
  key(e) { if (e.key === 'Escape') go(TitleScene); },
};
