'use strict';
// 화면 위 글자와 창: 체력 막대, 대화창, 일지, 소지품, 알림

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const UI = (() => {
  const U = {};
  U.name = () => (Auth.user && Auth.user.short) || '학생';
  const fill = s => s.replace(/\{name\}/g, U.name());
  U.fill = fill;

  // ---------- 화면 전환 ----------
  U.show = id => {
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('show', s.id === id));
    $('profile').style.display = id === 'menu' ? '' : 'none';
  };
  U.hide = id => $(id).classList.remove('show');
  U.open = id => $(id).classList.add('show');
  U.fade = (to, ms = 800) => new Promise(res => {
    const f = $('fade');
    f.style.transition = `opacity ${ms}ms`;
    f.style.opacity = to;
    setTimeout(res, ms);
  });

  // ---------- 알림 ----------
  U.toast = (text, kind = '') => {
    const d = document.createElement('div');
    d.className = 'toast ' + kind;
    d.innerHTML = text;
    $('toasts').appendChild(d);
    setTimeout(() => d.classList.add('out'), 3200);
    setTimeout(() => d.remove(), 4000);
  };
  let subT = null;
  U.sub = (speaker, text, sec = 3.5) => {
    const el = $('subtitle');
    el.innerHTML = (speaker ? `<b>${esc(speaker)}</b> ` : '') + esc(fill(text));
    el.classList.add('show');
    clearTimeout(subT);
    subT = setTimeout(() => el.classList.remove('show'), sec * 1000);
  };
  let bigT = null;
  U.big = (text, sec = 2.5, cls = '') => {
    const el = $('bigText');
    el.className = 'show ' + cls;
    el.textContent = fill(text);
    clearTimeout(bigT);
    bigT = setTimeout(() => { el.className = ''; }, sec * 1000);
  };
  U.prompt = text => {
    const el = $('prompt');
    if (!text) { el.classList.remove('show'); return; }
    el.innerHTML = text;
    el.classList.add('show');
  };
  U.quest = text => {
    const el = $('quest');
    el.innerHTML = `<small>목표</small>${esc(fill(text))}`;
    el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
  };
  U.tip = (text, sec = 6) => {
    const el = $('tip');
    el.innerHTML = text;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('show'), sec * 1000);
  };

  // ---------- 체력 막대 ----------
  U.hud = P => {
    $('hpBar').style.width = (P.hp / P.maxHp * 100) + '%';
    $('sanBar').style.width = (P.san / P.maxSan * 100) + '%';
    $('staBar').style.width = (P.sta / P.maxSta * 100) + '%';
    $('expBar').style.width = (P.exp / Game.expNeed(P.level) * 100) + '%';
    $('hpTxt').textContent = Math.ceil(P.hp);
    $('sanTxt').textContent = Math.ceil(P.san);
    $('lvTxt').textContent = 'Lv.' + P.level + (P.points ? ' ●' : '');
    $('bat').textContent = Math.ceil(P.bat) + '%';
    $('batFill').style.width = P.bat + '%';
    $('batFill').className = P.bat < 20 ? 'low' : '';
    $('phoneHud').classList.toggle('off', !P.hasPhone);
    $('lightIco').classList.toggle('on', P.lightOn);
    const inv = P.inv;
    $('hbBandage').textContent = inv.bandage; $('hbPills').textContent = inv.pills;
    $('hbBattery').textContent = inv.battery; $('hbSalt').textContent = inv.salt;
    document.querySelectorAll('.hb').forEach(el => el.classList.toggle('empty', !inv[el.dataset.item]));
    const w = Game.WEAPONS[P.weapon];
    $('weaponHud').innerHTML = `<b>${esc(w.name)}</b><small>${P.weapons.filter(k => k !== 'hands').map((k, i) => `<span class="${k === P.weapon ? 'on' : ''}">${i + 1}</span>`).join('')}</small>`;
    document.body.classList.toggle('lowhp', P.hp / P.maxHp < 0.3);
  };
  U.boss = (name, k) => {
    const el = $('bossbar');
    if (name === null) { el.classList.remove('show'); return; }
    el.classList.add('show');
    $('bossName').textContent = name;
    $('bossFill').style.width = Math.max(0, k * 100) + '%';
  };

  // ---------- 대화 ----------
  // lines: [{ s: 말하는 이, t: 글, choices: [{ t, on() → 이어질 줄들(선택) , req }] , fx() }]
  let dq = null;
  const waiting = [];   // 대화 중에 새 대화가 오면 줄을 세운다
  U.inDialog = () => !!dq;
  U.dialog = (lines, done) => new Promise(res => {
    const item = { lines: lines.slice(), i: -1, done: () => { done && done(); res(); }, typing: false, full: '', shown: 0 };
    if (dq) { waiting.push(item); return; }
    dq = item;
    $('dialog').classList.add('show');
    next();
  });
  U.clearDialog = () => { dq = null; waiting.length = 0; $('dialog').classList.remove('show'); };
  function next() {
    dq.i++;
    $('choices').innerHTML = '';
    if (dq.i >= dq.lines.length) {
      const d = dq;
      dq = waiting.shift() || null;
      if (dq) next(); else $('dialog').classList.remove('show');
      d.done();
      return;
    }
    const L = dq.lines[dq.i];
    if (L.req && !L.req()) { next(); return; }
    if (L.fx) L.fx();
    $('dName').textContent = L.s ? fill(L.s) : '';
    $('dName').className = L.s === '서하' ? 'seoha' : (L.s === '담임' || L.s === '목소리' || L.s === '스피커') ? 'enemy' : L.s ? 'me' : '';
    $('dialog').classList.toggle('narr', !L.s);
    dq.full = fill(L.t); dq.shown = 0; dq.typing = true;
    $('dText').textContent = '';
    $('dMore').style.visibility = 'hidden';
  }
  U.tickDialog = dt => {
    if (!dq || !dq.typing) return;
    dq.shown += dt * 42;
    const n = Math.min(dq.full.length, Math.floor(dq.shown));
    $('dText').textContent = dq.full.slice(0, n);
    if (n >= dq.full.length) finishTyping();
  };
  function finishTyping() {
    dq.typing = false;
    $('dText').textContent = dq.full;
    const L = dq.lines[dq.i];
    if (L.choices) {
      const box = $('choices');
      L.choices.filter(c => !c.req || c.req()).forEach((c, i) => {
        const b = document.createElement('button');
        b.innerHTML = `<kbd>${i + 1}</kbd> ${esc(fill(c.t))}`;
        b.onclick = () => choose(c);
        box.appendChild(b);
      });
    } else $('dMore').style.visibility = 'visible';
  }
  function choose(c) {
    if (!dq) return;
    Sound.page();
    const more = c.on ? c.on() : null;
    if (more && more.length) dq.lines.splice(dq.i + 1, 0, ...more);
    next();
  }
  U.dialogKey = key => {
    if (!dq) return false;
    const L = dq.lines[dq.i];
    if (dq.typing) { if (key === 'adv') finishTyping(); return true; }
    if (L && L.choices) {
      const list = L.choices.filter(c => !c.req || c.req());
      const n = parseInt(key, 10);
      if (n >= 1 && n <= list.length) choose(list[n - 1]);
      return true;
    }
    if (key === 'adv') next();
    return true;
  };

  // ---------- 일지 읽기 ----------
  let docOpen = false;
  U.docOpen = () => docOpen;
  U.readDoc = (doc, done) => {
    docOpen = true;
    $('docTitle').textContent = doc.title;
    $('docDate').textContent = doc.date || '';
    $('docBody').innerHTML = esc(fill(doc.text)).replace(/\n/g, '<br>');
    $('docPaper').className = 'paper ' + (doc.style || '');
    $('doc').classList.add('show');
    Sound.page();
    U._docDone = done;
  };
  U.closeDoc = () => {
    if (!docOpen) return;
    docOpen = false;
    $('doc').classList.remove('show');
    const d = U._docDone; U._docDone = null;
    d && d();
  };

  // ---------- 소지품 / 상태 창 ----------
  let tab = 'stat';
  U.invTab = t => { tab = t; U.renderInv(); };
  U.renderInv = () => {
    const P = Game.P;
    document.querySelectorAll('.itab').forEach(b => b.classList.toggle('on', b.dataset.t === tab));
    const box = $('invBody');
    if (tab === 'stat') {
      const st = [
        ['vit', '체력', `최대 체력 ${P.maxHp}`],
        ['wil', '정신력', `최대 정신력 ${P.maxSan} · 공포에 덜 흔들림`],
        ['str', '근력', `공격력 +${Math.round((Game.dmgMul() - 1) * 100)}%`],
        ['end', '지구력', `최대 기력 ${P.maxSta} · 달리기·휘두르기`],
      ];
      box.innerHTML = `
        <div class="who"><div class="ava">${Auth.user && Auth.user.picture ? `<img src="${esc(Auth.user.picture)}" referrerpolicy="no-referrer">` : '31'}</div>
          <div><b>${esc(U.name())}</b><small>2학년 3반 31번 · Lv.${P.level}</small>
          <div class="xp"><i style="width:${P.exp / Game.expNeed(P.level) * 100}%"></i></div><small>경험치 ${P.exp} / ${Game.expNeed(P.level)}</small></div></div>
        <p class="pts">${P.points ? `올릴 수 있는 능력 점수 <b>${P.points}</b>` : '레벨이 오르면 능력 점수를 얻어요.'}</p>
        ${st.map(([k, n, d]) => `<div class="statRow"><span>${n} <b>${P.stats[k]}</b></span><small>${d}</small><button data-st="${k}" ${P.points ? '' : 'disabled'}>+</button></div>`).join('')}
        <p class="sm">처치 ${P.kills} · 플레이 ${Game.timeStr()} · 일지 ${P.docs.filter(d => Story.DOCS[d] && Story.DOCS[d].page).length}/5</p>`;
      box.querySelectorAll('button[data-st]').forEach(b => b.onclick = () => { Game.addStat(b.dataset.st); U.renderInv(); });
    } else if (tab === 'items') {
      const it = Game.ITEMS;
      const rows = Object.keys(it).map(k => `<div class="itemRow ${P.inv[k] ? '' : 'none'}"><span class="ico">${it[k].icon}</span><div><b>${it[k].name} × ${P.inv[k]}</b><small>${it[k].desc}</small></div>
        <button data-use="${k}" ${P.inv[k] ? '' : 'disabled'}>사용 <kbd>${it[k].key}</kbd></button></div>`).join('');
      const keys = P.keys.map(k => `<li>${Story.KEYS[k] ? Story.KEYS[k] : k}</li>`).join('') || '<li class="none">없음</li>';
      const ws = P.weapons.filter(k => k !== 'hands').map((k, i) => `<li class="${k === P.weapon ? 'on' : ''}"><kbd>${i + 1}</kbd> ${Game.WEAPONS[k].name} <small>공격력 ${Game.WEAPONS[k].dmg} · ${Game.WEAPONS[k].desc}</small></li>`).join('');
      box.innerHTML = `${rows}<h4>무기</h4><ul class="klist">${ws}</ul><h4>중요한 물건</h4><ul class="klist">${keys}</ul>`;
      box.querySelectorAll('button[data-use]').forEach(b => b.onclick = () => { Game.useItem(b.dataset.use); U.renderInv(); });
    } else if (tab === 'docs') {
      const list = P.docs.map(id => Story.DOCS[id]).filter(Boolean);
      box.innerHTML = list.length ? list.map((d, i) => `<button class="docRow" data-i="${i}"><b>${esc(d.title)}</b><small>${esc(d.date || '')}</small></button>`).join('') : '<p class="sm">아직 주운 기록이 없어요.</p>';
      box.querySelectorAll('.docRow').forEach(b => b.onclick = () => U.readDoc(list[+b.dataset.i]));
    } else if (tab === 'quest') {
      box.innerHTML = `<p class="qnow">${esc(fill(Story.questText()))}</p>
        <ul class="qlist">${Story.questLog().map(q => `<li class="${q.done ? 'done' : ''}">${esc(fill(q.t))}</li>`).join('')}</ul>
        <h4>조작</h4><p class="sm"><kbd>WASD</kbd> 이동 · <kbd>Shift</kbd> 달리기 · <kbd>C</kbd> 숙이기 · <kbd>E</kbd> 조사 · <kbd>F</kbd> 손전등 · 마우스 <kbd>왼쪽</kbd> 공격 · <kbd>오른쪽 꾹</kbd> 빛 모으기 · <kbd>1~3</kbd> 무기 · <kbd>Z</kbd> 붕대 · <kbd>X</kbd> 진정제 · <kbd>R</kbd> 배터리 · <kbd>G</kbd> 소금 던지기</p>`;
    }
  };

  // ---------- 레벨 업 ----------
  U.levelUp = lv => {
    const el = $('levelUp');
    el.innerHTML = `<b>LEVEL UP</b><span>Lv.${lv} · <kbd>Tab</kbd> 에서 능력 점수를 올리세요</span>`;
    el.classList.remove('show'); void el.offsetWidth; el.classList.add('show');
  };

  return U;
})();
