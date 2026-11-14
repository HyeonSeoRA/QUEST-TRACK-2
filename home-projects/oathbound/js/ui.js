'use strict';
// =============================================================
//  저장, 축복(강화), 메뉴 화면과 HUD (HTML 부분을 다뤄요)
//  메뉴는 화살표 키로 고르고 Enter 로 눌러요.
// =============================================================

const BLESSINGS = [
  { id: 'blade', name: '강철 칼날', desc: '공격 피해 +20%' },
  { id: 'vigor', name: '수호의 맹세', desc: '최대 체력 +25' },
  { id: 'eye', name: '예리한 눈', desc: '패링 판정 시간 +0.05초' },
  { id: 'flask', name: '성수 주머니', desc: '포션 +1개' },
  { id: 'riposte', name: '반격의 서약', desc: '반격 피해 +40%' },
  { id: 'wind', name: '바람의 발', desc: '대시 대기 시간 -35%' },
  { id: 'leech', name: '피의 패링', desc: '패링할 때마다 체력 +4' },
  { id: 'breaker', name: '체간 파괴자', desc: '체간 피해 +35%' },
  { id: 'stone', name: '돌 피부', desc: '받는 피해 -15%' },
];

function computeMods(perks) {
  const m = { atkMul: 1, maxHp: 100, parryWin: 0.18, potions: 3, riposteMul: 1, dashCdMul: 1, parryHeal: 0, postureMul: 1, dmgTakenMul: 1 };
  for (const p of perks) {
    if (p === 'blade') m.atkMul += 0.2;
    if (p === 'vigor') m.maxHp += 25;
    if (p === 'eye') m.parryWin += 0.05;
    if (p === 'flask') m.potions += 1;
    if (p === 'riposte') m.riposteMul += 0.4;
    if (p === 'wind') m.dashCdMul *= 0.65;
    if (p === 'leech') m.parryHeal += 4;
    if (p === 'breaker') m.postureMul += 0.35;
    if (p === 'stone') m.dmgTakenMul *= 0.85;
  }
  return m;
}

// 진행 기록은 이 브라우저에만 저장돼요
const Save = {
  KEY: 'oathbound-save-v1',
  data: null,
  fresh() { return { cleared: [false, false, false, false, false], perks: [], best: [null, null, null, null, null] }; },
  load() {
    try { this.data = Object.assign(this.fresh(), JSON.parse(localStorage.getItem(this.KEY)) || {}); }
    catch (e) { this.data = this.fresh(); }
  },
  write() { try { localStorage.setItem(this.KEY, JSON.stringify(this.data)); } catch (e) { /* 저장 못 해도 게임은 계속 */ } },
  reset() { this.data = this.fresh(); this.write(); },
  unlocked(i) { return i === 0 || this.data.cleared[i - 1]; },
};

const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

const UI = {
  current: null,
  $(id) { return document.getElementById(id); },

  // 화면 바꾸기 (name 이 없으면 메뉴를 모두 닫고 전투 화면)
  show(name) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    this.current = name;
    this.$('embers').classList.toggle('hidden', !name || name === 'pause');
    if (!name) { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); return; }
    this.$('screen-' + name).classList.remove('hidden');
    this.focusFirst();
  },

  navItems() {
    if (!this.current) return [];
    const scr = this.$('screen-' + this.current);
    return [...scr.querySelectorAll('.nav, .blessing')].filter(b => !b.disabled && b.offsetParent !== null);
  },
  focusFirst() {
    const items = this.navItems();
    if (!items.length) return;
    let el = items[0];
    if (this.current === 'select') {
      // 아직 안 깬 보스 중 가장 앞에 있는 카드
      const cards = items.filter(b => b.classList.contains('boss-card'));
      el = cards.find(c => !c.classList.contains('cleared')) || cards[cards.length - 1] || el;
    }
    if (this.current === 'result') {
      el = items.find(b => b.classList.contains('blessing')) || items.find(b => b.id === 'btn-next') || el;
    }
    el.focus();
  },

  // 화살표로 메뉴 고르기
  initNav() {
    window.addEventListener('keydown', e => {
      if (!this.current || this.current === 'loading') return;
      const keys = { ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1, KeyW: -1, KeyA: -1, KeyS: 1, KeyD: 1 };
      if (!(e.code in keys)) return;
      const items = this.navItems();
      if (!items.length) return;
      let i = items.indexOf(document.activeElement);
      i = i < 0 ? 0 : (i + keys[e.code] + items.length) % items.length;
      items[i].focus();
      Sfx.click();
    });
    // 마우스를 올려도 그 항목이 골라져요
    document.addEventListener('mouseover', e => {
      const b = e.target.closest && e.target.closest('.nav, .blessing');
      if (b && !b.disabled && b !== document.activeElement) b.focus();
    });
  },

  // 메뉴 화면에서 피어오르는 불씨
  initEmbers() {
    const box = this.$('embers');
    for (let i = 0; i < 40; i++) {
      const e = document.createElement('i');
      e.style.left = (Math.random() * 100) + '%';
      e.style.animationDuration = (6 + Math.random() * 8) + 's';
      e.style.animationDelay = (-Math.random() * 14) + 's';
      e.style.setProperty('--dx', `calc(${Math.round((Math.random() - 0.5) * 120)} * var(--u))`);
      if (Math.random() < 0.3) { e.style.background = '#ffe2a0'; e.style.width = e.style.height = 'calc(1 * var(--u))'; }
      box.appendChild(e);
    }
  },

  // 언어가 바뀌었을 때 지금 열린 화면의 글자 다시 쓰기
  relabel() {
    if (this.current === 'select' && this._onPick) this.buildSelect(this._onPick);
  },

  hud(on) { this.$('hud').classList.toggle('hidden', !on); },

  // ---------- 보스 고르기 ----------
  buildSelect(onPick) {
    this._onPick = onPick;
    const list = this.$('boss-list');
    list.innerHTML = '';
    this.cards = [];
    BOSS_LIST.forEach((b, i) => {
      const open = Save.unlocked(i);
      const done = Save.data.cleared[i];
      const card = document.createElement('button');
      card.className = 'boss-card nav' + (open ? '' : ' locked') + (done ? ' cleared' : '');
      card.innerHTML = `<div class="arch"></div><div class="num">${ROMAN[i]}</div>` +
        `<div class="nm">${open ? T(b.name) : '???'}</div>` +
        `<div class="st">${done ? T('✦ 처치') + (Save.data.best[i] ? ' · ' + fmtTime(Save.data.best[i]) : '') : open ? T('도전 가능') : T('잠김')}</div>`;
      const cv = document.createElement('canvas');
      cv.width = 192; cv.height = 160;
      card.insertBefore(cv, card.children[1]);
      card.addEventListener('focus', () => this.showDetail(i));
      card.addEventListener('click', () => {
        Sfx.init();
        if (!open) { Sfx.whiff(); return; }
        Sfx.click(); onPick(i);
      });
      list.appendChild(card);
      this.cards.push({ cv, b, open });
    });
    const perks = Save.data.perks;
    this.$('perk-list').innerHTML = perks.length
      ? T('받은 축복') + ' ' + perks.map(id => `<span class="chip">${T(BLESSINGS.find(x => x.id === id).name)}</span>`).join('')
      : '';
    this.animateCards();
  },

  showDetail(i) {
    const b = BOSS_LIST[i];
    const open = Save.unlocked(i);
    const best = Save.data.best[i];
    const el = this.$('boss-detail');
    if (!open) {
      el.innerHTML = `<div class="dn">??? <small>${T(b.sub)}</small></div><div class="go">${T('잠김')}</div>`;
      return;
    }
    el.innerHTML =
      `<div class="dn">${T(b.name)}<small>${T(b.sub)} · ${T(STAGES[b.stage].name)}</small></div>` +
      `<div class="go">${T('Enter 로 도전')}${best ? '<br>' + T('최고 기록 {t}', { t: fmtTime(best) }) : ''}</div>`;
  },

  // 카드 안의 보스가 움직여요
  animateCards() {
    if (this._anim) return;
    const loop = now => {
      if (this.current !== 'select') { this._anim = null; return; }
      for (const c of this.cards) {
        const g = c.cv.getContext('2d');
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.clearRect(0, 0, c.cv.width, c.cv.height);
        g.imageSmoothingEnabled = false;
        const [sp, an, sc] = c.b.preview;
        const d = SPRITES[sp].anims[an];
        const f = Math.floor((now / 1000) * d.fps) % d.frames;
        g.scale(2, 2);
        // 발밑 빛
        const gr = g.createRadialGradient(48, 76, 0, 48, 76, 40);
        gr.addColorStop(0, 'rgba(232,196,106,0.25)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr; g.fillRect(0, 40, 96, 40);
        drawSprite(g, sp, an, c.open ? f : 0, 48, 77, sc, -1);
      }
      this._anim = requestAnimationFrame(loop);
    };
    this._anim = requestAnimationFrame(loop);
  },

  // ---------- HUD ----------
  last: {},
  setW(el, frac, key) {
    const v = Math.round(clamp(frac, 0, 1) * 1000) / 10;
    if (this.last[key] === v) return;
    this.last[key] = v;
    el.style.width = v + '%';
  },
  initHud(boss, player) {
    this.last = {};
    this.$('boss-name').textContent = T(boss.name);
    this.$('boss-box').querySelector('.boss-bar').classList.remove('phase2');
    const pots = this.$('potions');
    pots.innerHTML = '';
    for (let i = 0; i < player.maxPotions; i++) {
      const d = document.createElement('div');
      d.className = 'potion';
      pots.appendChild(d);
    }
    this.$('player-box').style.width = `calc(${Math.round(180 * player.maxHp / 100)} * var(--u))`;
    this.segs = [...this.$('energy').children];
  },
  updateHud(p, b) {
    this.setW(this.$('p-hp'), p.hp / p.maxHp, 'php');
    this.setW(this.$('p-hp-lag'), p.hp / p.maxHp, 'phl');
    this.setW(this.$('b-hp'), b.hp / b.maxHp, 'bhp');
    this.setW(this.$('b-hp-lag'), b.hp / b.maxHp, 'bhl');
    this.setW(this.$('b-posture'), b.posture / b.maxPosture, 'bpo');
    this.segs.forEach((s, i) => {
      const fill = clamp(p.energy - i, 0, 1);
      this.setW(s.firstChild, fill, 'en' + i);
      const full = fill >= 1;
      if (this.last['enf' + i] !== full) { this.last['enf' + i] = full; s.classList.toggle('full', full); }
    });
    if (this.last.pots !== p.potions) {
      this.last.pots = p.potions;
      [...this.$('potions').children].forEach((d, i) => d.classList.toggle('used', i >= p.potions));
    }
    const rip = p.riposte > 0 && p.state !== 'dead';
    if (this.last.rip !== rip) { this.last.rip = rip; this.$('riposte').classList.toggle('hidden', !rip); }
    const ph2 = b.phase === 2;
    if (this.last.ph2 !== ph2) { this.last.ph2 = ph2; this.$('boss-box').querySelector('.boss-bar').classList.toggle('phase2', ph2); }
    const full = b.stunT > 0;
    if (this.last.full !== full) { this.last.full = full; this.$('boss-box').querySelector('.posture-bar').classList.toggle('full', full); }
  },

  banner(title, sub) {
    const el = this.$('banner');
    this.$('banner-title').textContent = title;
    this.$('banner-sub').textContent = sub;
    el.classList.remove('hidden');
    for (const n of [el, el.querySelector('.banner-line')]) { n.style.animation = 'none'; void n.offsetWidth; n.style.animation = ''; }
    clearTimeout(this._bt);
    this._bt = setTimeout(() => el.classList.add('hidden'), 2900);
  },

  // ---------- 결과 ----------
  result(win, info, handlers) {
    const t = this.$('result-title');
    t.textContent = T(win ? (info.allClear ? '서약을 지켰다' : '승리') : '쓰러졌다');
    t.className = win ? 'win' : 'lose';
    // 설명 줄이기: 졌을 때 힌트는 주지 않아요
    this.$('result-text').textContent = win
      ? (info.allClear ? T('다섯 괴물이 모두 잠들었어요. 기사의 서약이 이루어졌습니다.') : T('{name}을(를) 쓰러뜨렸어요.', { name: T(info.name) }))
      : T('{name}에게 쓰러졌다.', { name: T(info.name) });
    this.$('result-stats').innerHTML =
      T('걸린 시간 {time} · 패링 {p}번 · 받은 피해 {d} · 포션 {q}개', { time: fmtTime(info.time), p: info.parries, d: info.taken, q: info.potions }) +
      (win ? '' : '<br>' + T('보스 남은 체력 {n}%', { n: Math.ceil(info.bossLeft * 100) }));

    const bl = this.$('blessings');
    bl.innerHTML = '';
    this.clearResultExtras();
    const lockButtons = on => ['btn-again', 'btn-next', 'btn-select'].forEach(id => { this.$(id).disabled = on; });
    this.$('btn-next').classList.toggle('hidden', !(win && info.hasNext));
    lockButtons(false);

    if (win && info.choices && info.choices.length) {
      lockButtons(true);
      const head = document.createElement('p');
      head.className = 'blessing-head';
      head.textContent = T('✦ 축복을 하나 고르세요 ✦');
      bl.before(head);
      this._head = head;
      info.choices.forEach(c => {
        const b = document.createElement('button');
        b.className = 'blessing';
        b.innerHTML = `<b>${T(c.name)}</b><span>${T(c.desc)}</span>`;
        b.addEventListener('click', () => {
          handlers.bless(c.id);
          bl.innerHTML = `<p class="gold">${T('「{name}」 축복을 받았어요.', { name: T(c.name) })}</p>`;
          head.remove();
          lockButtons(false);
          Sfx.heal();
          this.focusFirst();
        });
        bl.appendChild(b);
      });
    }
    this.show('result');
  },
  clearResultExtras() { if (this._head) { this._head.remove(); this._head = null; } },
};

function fmtTime(s) {
  const m = Math.floor(s / 60), r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, '0')}`;
}
