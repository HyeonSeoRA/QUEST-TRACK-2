'use strict';
/* 전투 화면: 적이 박자에 맞춰 달려오고, 공중(D F) / 땅(J K)을 쳐서 베어요.
 * 능력치(공격력·방어력·HP)와 장비가 전투에 그대로 쓰여요. */

const BOSS_INFO = {
  treant: { x: 408, y: GROUND + 8, oy: 1, hand: [-48, -78] },
  wyrm: { x: 404, y: 112, oy: 0.5, hand: [-36, -10] },
  lord: { x: 404, y: 110, oy: 0.5, hand: [-42, 10] },
};

class Play extends Phaser.Scene {
  constructor() { super('Play'); }
  init(d) { this.si = d.stage; this.diff = d.diff || 'normal'; this.auto = !!d.auto; this.seek = d.seek || 0; this.practice = !!d.practice; }

  create() {
    fitCam(this);
    const S = this.S = SONGDATA[this.si], st = this.st = STAGES[this.si], ch = this.ch = CHAPTERS[st.ch];
    const sv = this.sv = Store.s, ps = this.ps = stats(sv);
    this._leaving = false; this.leaving = false; this.bossKilled = false;
    this.notes = S.charts[this.diff].map(n => ({ ...n }));
    this.notes.forEach((n, i) => {
      if (n.dbl && n.lane === 0) n.mate = this.notes.find((o, j) => j !== i && o.dbl && o.lane === 1 && Math.abs(o.t - n.t) < 0.001);
    });
    const judgeable = n => n.type === 'hold' ? 2 : n.type === 'heart' ? 0 : 1;
    this.total = this.notes.reduce((a, n) => a + judgeable(n), 0);
    this.lastNoteT = this.notes.reduce((a, n) => Math.max(a, n.end || n.t), 0);
    this.spawnIdx = 0; this.active = [];
    this.cnt = { P: 0, G: 0, D: 0, M: 0 };
    this.score = 0; this.shownScore = 0; this.combo = 0; this.maxCombo = 0;
    this.hp = ps.maxHp; this.goldGain = 0; this.kills = 0; this.stoneGain = 0;
    this.fever = 0; this.feverOn = false; this.feverEnd = 0; this.feverLen = S.spb * 16;
    this.speed = 100 * Store.data.settings.speed;
    this.offset = Store.data.settings.offset / 1000;
    this.winD = JUDGE.D.w + ps.win;
    this.enemyAtk = (ch.atk + (st.boss ? 3 : 0)) * (this.diff === 'hard' ? 1 : 0.75);
    this.laneHeld = [new Set(), new Set()];
    this.holdNote = [null, null];
    this.ptrLane = {};
    this.state = 'play';
    this.slots = {}; this.dmgK = 0;

    this.bg = new BG(this, ch.theme, { orbit: 10 });
    this.amb = this.bg.th.ambient;
    this.gfx = this.add.graphics().setDepth(12);
    this.laneImg = [0, 1].map(l => this.add.image(JX, LANE_Y[l], 'lane').setOrigin(0, 0.5).setTint(LANE_C[l]).setDepth(6));
    this.targets = [0, 1].map(l => this.add.image(JX, LANE_Y[l], 'ring').setScale(0.36).setTint(LANE_C[l]).setDepth(7));
    this.tglow = [0, 1].map(l => this.add.image(JX, LANE_Y[l], 'glow').setTint(LANE_C[l]).setBlendMode('ADD').setAlpha(0).setDepth(7).setScale(0.8));
    this.shadow = this.add.image(PX, GROUND, 'shadow').setScale(1, 0.25).setAlpha(0.55).setDepth(18);
    this.player = this.add.sprite(PX, GROUND + 1, 'hero', 'run0').setOrigin(0.5, 1).setDepth(20);
    this.lumi = this.add.sprite(PX - 24, 160, 'lumi', 0).setDepth(21);
    // 바닥 위의 판정 표시 (원근으로 납작한 고리)
    this.floorRing = this.add.image(JX, GROUND + 1, 'ring').setTint(LANE_C[1]).setScale(0.42, 0.11).setAlpha(0.5).setDepth(7).setBlendMode('ADD');
    // 적이 배경에 묻히지 않게: 줄 뒤에 옅은 어둠 띠, 가까운 배경은 살짝 어둡게
    [0, 1].forEach(l => this.add.image(JX - 30, LANE_Y[l], 'laneDark').setOrigin(0, 0.5).setDisplaySize(GW - JX + 40, 48).setDepth(5));
    const near = this.bg.layers.find(o => o.L.key === 'near'); if (near) near.obj.setTint(0xbcbcc8);
    // 콤보 오라 (50 콤보: 금빛, 100 콤보: 무지개)
    this.comboAura = this.add.image(PX, GROUND - 30, 'glow').setBlendMode('ADD').setScale(1.5, 1.9).setAlpha(0).setDepth(19);
    this.lumiSh = this.add.image(PX - 26, GROUND + 1, 'shadow').setScale(0.35, 0.1).setAlpha(0.18).setDepth(17);
    this.lumiGlow = this.add.image(PX - 24, 160, 'glow').setScale(0.6).setTint(0xfff2a0).setBlendMode('ADD').setAlpha(0.3).setDepth(21);
    this.player.setTint(this.amb);
    this.py = GROUND; this.vy = 0; this.airUntil = 0; this.atkUntil = 0; this.hurtUntil = 0;
    this.slashFlip = false; this.ghostAcc = 0; this.realT = 0;

    this.makeEmitters();
    this.lk = laneKeys();
    this.pstack = { stack: [], push(h) { this.stack.push(h); return h; }, pop(h) { const i = this.stack.lastIndexOf(h); if (i >= 0) this.stack.splice(i, 1); }, top() { return this.stack[this.stack.length - 1]; } };
    this.makeHUD();
    this.makeMeter();

    // 보스
    this.boss = null;
    if (st.boss) {
      const bossNotes = this.notes.filter(n => n.t >= S.bossStart).reduce((a, n) => a + judgeable(n), 0);
      const recAtk = 12 + (st.rec - 1) * 3 + [0, 4, 9][st.ch];
      const B = BOSS_INFO[ch.boss];
      const hpMax = Math.round(bossNotes * recAtk * 0.9 * (this.diff === 'hard' ? 1.15 : 1));
      this.boss = { ...B, key: ch.boss, hp: hpMax, max: hpMax, alive: true, flash: 0, kick: 0, cx: B.x + 140 };
      this.boss.spr = this.add.sprite(this.boss.cx, B.y, 'boss_' + ch.boss, 0).setOrigin(0.5, B.oy).setDepth(9);
      this.boss.sh = this.add.image(this.boss.cx, GROUND + 4, 'shadow').setDepth(8);
      this.boss.aura = this.add.image(this.boss.cx, B.y, 'glow').setTint(0xff5a8a).setBlendMode('ADD').setScale(3).setAlpha(0.15).setDepth(8);
    }

    AE.init();
    stopBgm(0.1);
    AE.setBeat(S.spb);
    this.startAt = AE.now() + 3.0 - this.seek;
    SEQ.play(S.events, this.startAt);
    if (this.seek) while (this.spawnIdx < this.notes.length && this.notes[this.spawnIdx].t < this.seek + 1) this.spawnIdx++;
    this.clock = this.rawTime();

    this.titleCard();
    onKeys(this, e => this.keyDown(e), e => this.keyUp(e));
    this.input.addPointer(2);
    this.input.on('pointerdown', p => this.ptrDown(p));
    this.input.on('pointerup', p => this.ptrUp(p));
    const vis = () => { if (document.hidden && this.state === 'play') this.pause(); };
    document.addEventListener('visibilitychange', vis);
    this.events.once('shutdown', () => { document.removeEventListener('visibilitychange', vis); SEQ.stop(); });
    this.cameras.main.fadeIn(500);
  }

  rawTime() { return AE.now() - this.startAt - AE.latency() - this.offset; }

  /* ================= 화면 구성 ================= */
  makeEmitters() {
    this.em = {};
    const mk = (k, c, extra = {}) => {
      this.em[k] = this.add.particles(0, 0, 'px', Object.assign({
        speed: { min: 40, max: 160 }, angle: { min: 0, max: 360 }, lifespan: { min: 250, max: 600 },
        scale: { start: 1.2, end: 0 }, gravityY: 160, tint: c, emitting: false, blendMode: 'ADD',
      }, extra)).setDepth(30);
    };
    mk(0, LANE_C[0]); mk(1, LANE_C[1]); mk('w', 0xffffff); mk('y', 0xffe08a); mk('r', 0xff4a4a); mk('g', 0x9dffa0);
    mk('dust', 0xd8c8b0, { speed: { min: 10, max: 40 }, angle: { min: 190, max: 350 }, gravityY: 30, lifespan: 380, blendMode: 'NORMAL' });
    mk('boss', 0xff9a6a, { speed: { min: 60, max: 260 }, lifespan: { min: 500, max: 1100 }, gravityY: 80, scale: { start: 2, end: 0 } });
    this.coinEm = this.add.particles(0, 0, 'coin', { speed: { min: 60, max: 120 }, angle: { min: 240, max: 300 }, gravityY: 400, lifespan: 600, scale: { start: 1, end: 0.6 }, emitting: false }).setDepth(31);
  }
  burst(k, x, y, n) { this.em[k].explode(n, x, y); }

  makeHUD() {
    const d = 100;
    Win(this, 6, 6, 170, 42, { depth: d, pop: false });
    const fg = this.add.graphics().setDepth(d + 1);
    fg.fillStyle(0x05040c, 1).fillRect(12, 12, 30, 30).lineStyle(1, 0xd8c08a, 1).strokeRect(12.5, 12.5, 29, 29);
    this.add.image(27, 27, 'face_ria').setDepth(d + 2);
    tx(this, 48, 10, `리아  Lv.${this.sv.lv}`, { size: 9, bold: true, color: '#ffe8b0' }).setDepth(d + 2);
    this.hpG = Gauge(this, 48, 24, 118, 6, 0x5aff8a, 0xc8ff6a, { depth: d + 2 });
    this.hpT = tx(this, 166, 22, '', { font: 'en', size: 7, ox: 1, oy: 1, color: '#d8ffd8', st: 2 }).setDepth(d + 3);
    this.fvG = Gauge(this, 48, 36, 118, 4, 0xffb040, 0xffe890, { depth: d + 2 });
    this.fvG.set(0, true);
    this.fvT = tx(this, 48, 33, '', { size: 7, oy: 1, color: '#ffe8b0', st: 2 }).setDepth(d + 3);

    Win(this, GW - 140, 6, 134, 42, { depth: d, pop: false });
    tx(this, GW - 130, 11, 'SCORE', { font: 'en', size: 8, color: '#c8c0e8' }).setDepth(d + 2);
    this.scoreT = tx(this, GW - 14, 9, '0', { font: 'en', size: 12, ox: 1, color: '#ffffff' }).setDepth(d + 2);
    this.add.image(GW - 126, 37, 'icons', 'coin').setScale(0.75).setDepth(d + 2);
    this.goldT = tx(this, GW - 118, 37, '0', { size: 9, oy: 0.5, color: '#ffe8b0' }).setDepth(d + 2);
    this.accT = tx(this, GW - 14, 37, '100.0%', { size: 9, ox: 1, oy: 0.5, color: '#c8c0e8' }).setDepth(d + 2);

    // 곡 이름 줄: [이름] [난이도] 를 한 줄에 나란히, 진행 막대는 그 아래 따로
    const tt = tx(this, 0, 7, `${this.st.id}  ${this.st.name}`, { size: 9, font: 'serif', bold: true, color: '#fff4dc', st: 3 }).setDepth(d);
    const dt = tx(this, 0, 9, (this.diff === 'hard' ? '어려움' : '보통') + (this.practice ? ' · 연습' : ''), { size: 7, color: this.diff === 'hard' ? '#ff9a9a' : '#9dffa0' }).setDepth(d);
    const tw = tt.width + 6 + dt.width;
    tt.x = Math.round(GW / 2 - tw / 2); dt.x = Math.round(tt.x + tt.width + 6);
    this.progG = Gauge(this, GW / 2 - 70, 26, 140, 2, 0x9ad8ff, 0xffffff, { depth: d });
    this.progG.set(0, true);

    this.comboN = tx(this, GW / 2, 64, '', { font: 'en', size: 24, ox: 0.5, oy: 0.5, st: 4, stroke: '#2a1408' }).setDepth(d);
    this.comboL = tx(this, GW / 2, 82, 'COMBO', { font: 'en', size: 8, ox: 0.5, color: '#ffe8b0', st: 2 }).setDepth(d).setVisible(false);

    if (this.st.boss) {
      this.bossUI = Win(this, GW / 2 - 110, GH - 24, 220, 20, { depth: d, pop: false });
      this.bossUI.add(tx(this, 10, 10, this.ch.bossName, { size: 8, bold: true, oy: 0.5, color: '#ff9ab8' }));
      this.bossG = Gauge(this, GW / 2 - 110 + 84, GH - 17, 128, 6, 0xff3a5a, 0xff9a6a, { depth: d + 1 });
      this.bossUI.setVisible(false); this.bossG.g.setVisible(false);
    }
    this.dmg = this.add.rectangle(0, 0, GW, GH, 0xff0000, 0).setOrigin(0).setDepth(95);
    this.keyHints = [
      tx(this, JX + 16, LANE_Y[0], `${keyName(Store.data.settings.keys.air[0])} · ${keyName(Store.data.settings.keys.air[1])}`, { size: 9, bold: true, oy: 0.5, color: '#bfeeff', st: 3 }).setDepth(50),
      tx(this, JX + 16, LANE_Y[1], `${keyName(Store.data.settings.keys.gnd[0])} · ${keyName(Store.data.settings.keys.gnd[1])}`, { size: 9, bold: true, oy: 0.5, color: '#ffe0a8', st: 3 }).setDepth(50),
    ];
    this.updateHP(true);
  }

  titleCard() {
    const c = this.add.container(0, 0).setDepth(150);
    const band = this.add.graphics();
    band.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0, 0.75, 0, 0.75).fillRect(0, 96, GW / 2, 56);
    band.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.75, 0, 0.75, 0).fillRect(GW / 2, 96, GW / 2, 56);
    const a = tx(this, GW / 2, 104, this.ch.name, { size: 9, ox: 0.5, font: 'serif', color: '#c8c0e8' });
    const b = tx(this, GW / 2, 128, this.st.name, { size: 18, ox: 0.5, oy: 0.5, font: 'serif', bold: true, st: 3, color: '#fff4dc' });
    c.add([band, a, b]); c.setAlpha(0);
    this.tweens.add({ targets: c, alpha: 1, duration: 400 });
    this.tweens.add({ targets: c, alpha: 0, delay: 1300, duration: 400, onComplete: () => c.destroy() });
    this.readyT = tx(this, GW / 2, 128, '', { font: 'en', size: 20, ox: 0.5, oy: 0.5, st: 4, stroke: '#2a1408' }).setDepth(151);
  }

  /* ================= 입력 ================= */
  keyDown(e) {
    if (e.repeat) return;
    if (this.state === 'pause') { const top = this.pstack.top(); if (top) top.key(e.code); return; }
    if (e.code === 'Escape') { if (this.state === 'play') this.pause(); return; }
    if (this.state !== 'play') return;
    if (e.code === 'Space') { this.tryFever(); return; }
    for (let l = 0; l < 2; l++) if (this.lk[l].includes(e.code)) { this.laneHeld[l].add(e.code); this.press(l); return; }
  }
  keyUp(e) {
    for (let l = 0; l < 2; l++) if (this.laneHeld[l].delete(e.code) && this.laneHeld[l].size === 0) this.release(l);
  }
  ptrDown(p) {
    if (this.state !== 'play') return;
    p = { id: p.id, x: p.worldX, y: p.worldY };
    if (p.y < 50 && p.x > GW / 2 - 80 && p.x < GW / 2 + 80) { this.pause(); return; }
    if (p.y < 50 && p.x < 180) { this.tryFever(); return; }
    const l = p.y < 172 ? 0 : 1;
    this.ptrLane[p.id] = l; this.laneHeld[l].add('ptr' + p.id);
    this.press(l);
  }
  ptrUp(p) {
    const l = this.ptrLane[p.id];
    if (l == null) return;
    delete this.ptrLane[p.id];
    if (this.laneHeld[l].delete('ptr' + p.id) && this.laneHeld[l].size === 0) this.release(l);
  }

  press(l) {
    const st = this.rawTime();
    this.attackAnim(l);
    let best = null, bd = 9;
    for (const n of this.active) {
      if (n.lane !== l || n.hit || n.missed || n.taken) continue;
      const d = st - n.t, w = n.type === 'heart' ? 0.16 : this.winD;
      if (Math.abs(d) <= w && Math.abs(d) < Math.abs(bd)) { best = n; bd = d; }
    }
    if (!best) { AE.whiff(); return; }
    if (best.type === 'heart') { this.takeHeart(best); return; }
    const ad = Math.abs(bd);
    const g = ad <= JUDGE.P.w ? 'P' : ad <= JUDGE.G.w + this.ps.win * 0.5 ? 'G' : 'D';
    best.hit = true;
    AE.hit(l, g);
    if (best.type === 'hold') {
      best.holding = true; best.nextTick = best.t + this.S.step;
      this.holdNote[l] = best;
      this.judge(g, l, bd); this.hitFx(l, g, null);
    } else {
      this.judge(g, l, bd); this.hitFx(l, g, best);
      if (best.dbl) this.cameras.main.shake(70, 0.004);
    }
  }
  release(l) {
    const n = this.holdNote[l];
    if (!n) return;
    this.holdNote[l] = null; n.holding = false;
    if (this.rawTime() >= n.end - 0.12) this.completeHold(n);
    else { n.broken = true; this.miss(l, 0.6); }
  }
  completeHold(n) {
    if (n.done) return;
    n.done = true; n.holding = false;
    if (this.holdNote[n.lane] === n) this.holdNote[n.lane] = null;
    this.judge('P', n.lane, 0);
    AE.hit(n.lane, 'P');
    this.hitFx(n.lane, 'P', null);
    this.burst('y', JX, LANE_Y[n.lane], 16);
  }
  takeHeart(n) {
    n.taken = true;
    const spr = n.spr; n.spr = null;
    const heal = Math.round(this.ps.maxHp * 0.15 * this.ps.heal);
    this.hp = Math.min(this.ps.maxHp, this.hp + heal);
    AE.heart();
    this.burst('g', spr.x, spr.y, 14);
    this.popText('+' + heal, '#9dffa0', PX, this.py - 70, 11, false, 'hp');
    this.tweens.add({ targets: spr, x: PX, y: this.py - 20, scale: 0.4, alpha: 0.4, duration: 220, onComplete: () => spr.destroy() });
    this.updateHP();
  }
  tryFever() {
    if (this.feverOn || this.fever < 100) return;
    this.feverOn = true; this.feverEnd = this.rawTime() + this.feverLen;
    AE.fever();
    this.cameras.main.flash(250, 255, 230, 160);
    this.banner('BURST!', 112, 900);
    if (typeof W3 !== 'undefined') W3.flash(PX, GROUND - 30, 0xffd070, 6);
    this.burst('y', PX, this.py - 20, 40);
  }

  /* ================= 판정 ================= */
  judge(g, l, d) {
    this.cnt[g]++;
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    const J = JUDGE[g];
    const comboMul = 1 + Math.min(Math.floor(this.combo / 10), 10) * 0.05;
    this.score += Math.round(J.base * comboMul * (this.feverOn ? 2 : 1));
    if (!this.feverOn) {
      const was = this.fever;
      this.fever = Math.min(100, this.fever + J.fever * this.ps.burst);
      if (was < 100 && this.fever >= 100) { AE.combo(); this.popText('BURST READY!  [SPACE]', '#ffe08a', GW / 2, 104, 10, false, 'center'); }
    }
    this.popJudge(g, l, d);
    this.meterTick(d, J.c);
    if (this.combo >= 3) {
      this.comboN.setText(String(this.combo)).setScale(1.25);
      goldFill(this.comboN);
      this.tweens.add({ targets: this.comboN, scale: 1, duration: 120 });
      this.comboL.setVisible(true);
    }
    if (this.combo % 50 === 0) { AE.combo(); this.banner(this.combo + ' COMBO', 112, 700); }
    const b = this.boss;
    if (b && b.alive && b.entered) {
      const dmg = Math.round(this.ps.atk * J.dmg * (1 + Math.min(this.combo, 50) / 100) * (this.feverOn ? 1.5 : 1));
      b.hp = Math.max(0, b.hp - dmg); b.flash = 0.03; b.kick = 3;
      // 피해 숫자: 4칸을 돌아가며 써서 서로 겹치지 않게
      this.dmgK = (this.dmgK + 1) % 4;
      this.popText(String(dmg), g === 'P' ? '#ffe08a' : '#ffffff', b.x - 34 + (this.dmgK % 2) * 26, b.y - (b.oy === 1 ? 96 : 34) + this.dmgK * 11, g === 'P' ? 12 : 10, true, 'dmg' + this.dmgK);
      this.bossG.set(b.hp / b.max);
      if (b.hp <= 0) this.bossDie();
    }
  }

  miss(l, mul = 1, count = 1) {
    this.cnt.M += count;
    if (this.combo >= 10) this.popText('COMBO BREAK', '#ff8a8a', GW / 2, 104, 9, false, 'center');
    this.combo = 0;
    this.comboN.setText(''); this.comboL.setVisible(false);
    const def = this.ps.def;
    const dmg = Math.max(2, Math.round(this.enemyAtk * mul * (1 - def / (def + 20))));
    this.hp = Math.max(this.practice ? 1 : 0, this.hp - dmg);   // 연습 모드는 지지 않아요
    this.updateHP();
    this.popJudge('M', l, 0);
    this.popText('-' + dmg, '#ff7a7a', PX + 6, this.py - 70, 11, false, 'hp');
    AE.miss();
    this.hurtUntil = this.realT + 0.45;
    this.cameras.main.shake(100, 0.006);
    this.dmg.setAlpha(0.22);
    this.tweens.add({ targets: this.dmg, alpha: 0, duration: 280 });
    this.burst('r', PX, this.py - 20, 8);
    if (this.boss && this.boss.alive) this.boss.kick = -10;
    if (this.hp <= 0 && this.state === 'play') this.fail();
  }

  updateHP(instant) {
    const r = this.hp / this.ps.maxHp;
    this.hpG.colA = r > 0.5 ? 0x5aff8a : r > 0.25 ? 0xffd040 : 0xff4a4a;
    this.hpG.colB = r > 0.5 ? 0xc8ff6a : r > 0.25 ? 0xfff08a : 0xff9a6a;
    this.hpG.set(r, instant);
    this.hpT.setText(`${Math.ceil(this.hp)} / ${this.ps.maxHp}`);
  }

  /* ================= 효과 ================= */
  attackAnim(l) {
    const now = this.realT;
    if (l === 0) { this.airUntil = now + 0.26; this.vy = 0; }
    else if (this.py < GROUND - 2) { this.py = GROUND; this.vy = 0; this.burst('dust', PX, GROUND, 6); }
    this.atkUntil = now + 0.14;
    this.slashFlip = !this.slashFlip;
    const s = this.add.image(JX - 10, LANE_Y[l], 'slash').setTint(this.feverOn ? 0xffe08a : LANE_C[l]).setDepth(22).setBlendMode('ADD').setFlipY(this.slashFlip).setScale(0.7);
    this.tweens.add({ targets: s, alpha: 0, scaleX: 1.05, x: JX - 2, duration: 160, onComplete: () => s.destroy() });
  }
  hitFx(l, g, n) {
    const y = LANE_Y[l], c = LANE_C[l];
    // 3D 세계도 그 자리에서 번쩍 빛나요
    if (typeof W3 !== 'undefined') W3.flash(JX + 10, y, g === 'P' ? 0xffe08a : c, g === 'P' ? 3 : 2.2);
    // 바닥에 비치는 빛 (칠 때마다 발밑이 환해져요)
    const fl = this.add.image(JX, GROUND, 'glow').setTint(c).setBlendMode('ADD').setScale(1.6, 0.35).setAlpha(0.55).setDepth(8);
    this.tweens.add({ targets: fl, alpha: 0, scaleX: 2.2, duration: 260, onComplete: () => fl.destroy() });
    const r = this.add.image(JX, y, 'ring').setTint(g === 'P' ? 0xffe08a : c).setScale(0.15).setDepth(25).setBlendMode('ADD');
    this.tweens.add({ targets: r, scale: 0.6, alpha: 0, duration: 300, ease: 'Quad.easeOut', onComplete: () => r.destroy() });
    this.tglow[l].setAlpha(0.9);
    this.burst(l, JX + 6, y, g === 'P' ? 14 : 9);
    this.burst('w', JX + 6, y, 5);
    if (n && n.spr) {
      const spr = n.spr; n.spr = null;
      if (n.sh) { n.sh.destroy(); n.sh = null; }
      if (n.aura) { n.aura.destroy(); n.aura = null; }
      this.kills++;
      let gold = Math.max(1, Math.round(this.st.gold * this.ps.gold * (0.6 + Math.random() * 0.8)));
      if (n.elite) {
        gold *= 3; this.coinEm.explode(6, spr.x, spr.y); this.burst('y', spr.x, spr.y, 16); AE.coin();
        if (Math.random() < 0.35) { this.stoneGain++; this.popText('마정석 +1', '#a8e0ff', JX + 96, 100, 9, true, 'stone'); }
      }
      this.goldGain += gold;
      this.coinEm.explode(2, spr.x, spr.y);
      if (this.kills % 4 === 0) AE.coin();
      spr.setTintFill(0xffffff);
      this.time.delayedCall(60, () => { if (spr.active) spr.setTint(this.amb); });
      this.tweens.add({
        targets: spr, x: spr.x + 50 + Math.random() * 50, y: spr.y - 60 - Math.random() * 50,
        angle: (Math.random() < 0.5 ? -1 : 1) * (360 + Math.random() * 360), alpha: 0, scale: 0.6,
        duration: 480, ease: 'Quad.easeOut', onComplete: () => spr.destroy(),
      });
    }
  }
  popJudge(g, l, d) {
    const J = JUDGE[g], x = JX + 30, y = LANE_Y[l] - 24;
    this.popText(J.name, J.css, x, y, 10, false, 'j' + l);
    const fs = (g === 'G' || g === 'D') && Math.abs(d) > 0.02;
    if (fs) this.popText(d < 0 ? 'FAST' : 'SLOW', d < 0 ? '#8ab8ff' : '#ffaa6a', x, y + 11, 7, false, 'f' + l);
    else if (this.slots['f' + l] && this.slots['f' + l].active) { this.tweens.killTweensOf(this.slots['f' + l]); this.slots['f' + l].destroy(); }
  }
  popText(s, col, x, y, size = 10, big = false, slot = null) {
    if (slot) { const old = this.slots[slot]; if (old && old.active) { this.tweens.killTweensOf(old); old.destroy(); } }
    const t = bakedText(this, x, y, s, { font: 'en', size, ox: 0.5, oy: 0.5, color: col, st: 3 }).setDepth(90);
    if (big) { t.setScale(1.4 / RES); this.tweens.add({ targets: t, scale: 1 / RES, duration: 100 }); }
    this.tweens.add({ targets: t, y: y - 12, alpha: { from: 1, to: 0 }, duration: 450, delay: 160, ease: 'Quad.easeIn', onComplete: () => t.destroy() });
    if (slot) this.slots[slot] = t;
    return t;
  }
  banner(s, y, dur) {
    const old = this.slots.banner; if (old && old.active) { this.tweens.killTweensOf(old); old.destroy(); }
    const t = bakedText(this, GW / 2, y, s, { font: 'en', size: 22, ox: 0.5, oy: 0.5, st: 4, stroke: '#2a1408', gold: true }).setDepth(140).setScale(1.6 / RES).setAlpha(0);
    this.tweens.add({ targets: t, scale: 1 / RES, alpha: 1, duration: 160, ease: 'Back.easeOut' });
    this.tweens.add({ targets: t, alpha: 0, y: y - 8, delay: dur, duration: 260, onComplete: () => t.destroy() });
    this.slots.banner = t;
    return t;
  }

  /* ================= 보스 ================= */
  updateBoss(st, pulse) {
    const b = this.boss;
    if (!b) return;
    if (!b.entered && st >= this.S.bossStart - this.S.barD * 2) {
      b.entered = true;
      AE.warning();
      this.cameras.main.shake(400, 0.004);
      this.bossUI.setVisible(true); this.bossG.g.setVisible(true); this.bossG.set(1, true);
      const w = tx(this, GW / 2, 128, 'WARNING', { font: 'en', size: 22, ox: 0.5, oy: 0.5, color: '#ff5a6a', st: 4 }).setDepth(140);
      const bar = this.add.rectangle(0, 128, GW, 30, 0xff0020, 0.25).setOrigin(0, 0.5).setDepth(139);
      this.tweens.add({ targets: [w, bar], alpha: 0.2, duration: 200, yoyo: true, repeat: 4, onComplete: () => { w.destroy(); bar.destroy(); } });
    }
    if (!b.alive) return;
    b.cx = lerp(b.cx, b.entered ? b.x : b.x + 140, 0.04);
    b.kick = b.kick > 0 ? Math.max(0, b.kick - 0.5) : Math.min(0, b.kick + 0.8);
    const bob = b.oy === 1 ? 0 : Math.sin(this.realT * 2) * 5;
    const bx = Math.round(b.cx + b.kick), by = Math.round(b.y + bob);
    b.spr.setPosition(bx, by).setFrame(Math.floor(Math.max(0, st) / this.S.spb) % 2);
    b.aura.setPosition(bx, b.oy === 1 ? by - 64 : by).setAlpha(0.1 + pulse * 0.15);
    b.hx = bx + b.hand[0]; b.hy = by + b.hand[1];
    if (b.flash > 0) { b.flash -= 1 / 60; b.spr.setTint(0xffb8b8); } else b.spr.setTint(this.amb);
    if (b.sh) b.sh.setPosition(bx, GROUND + 4).setScale(b.oy === 1 ? 3.2 : 2.6 - (by - 100) * 0.004, 0.42).setAlpha(b.oy === 1 ? 0.5 : 0.32);
  }
  bossDie() {
    const b = this.boss;
    if (!b || !b.alive) return;
    b.alive = false; this.bossKilled = true;
    AE.bossHit();
    for (let i = 0; i < 7; i++) this.time.delayedCall(i * 130, () => {
      const cy = b.oy === 1 ? b.spr.y - 64 : b.spr.y;
      this.burst('boss', b.spr.x + (Math.random() - 0.5) * 70, cy + (Math.random() - 0.5) * 60, 20);
      this.burst('w', b.spr.x, cy, 8);
      this.cameras.main.shake(120, 0.008);
      AE.hit(1, 'P');
    });
    this.time.delayedCall(950, () => {
      AE.explode();
      this.cameras.main.flash(400, 255, 255, 255);
      if (typeof W3 !== 'undefined') W3.flash(b.spr.x, b.oy === 1 ? b.spr.y - 64 : b.spr.y, 0xffa060, 9);
      const cy = b.oy === 1 ? b.spr.y - 64 : b.spr.y;
      this.burst('boss', b.spr.x, cy, 70); this.burst('y', b.spr.x, cy, 40);
      this.coinEm.explode(20, b.spr.x, cy);
      this.goldGain += this.st.gold * 25;
      this.tweens.add({ targets: [b.spr, b.aura], alpha: 0, y: '+=30', duration: 700, onComplete: () => { b.spr.destroy(); b.aura.destroy(); } });
      this.bossUI.setVisible(false); this.bossG.g.setVisible(false);
      this.banner('VICTORY', 128, 1200);
    });
  }

  /* ================= 일시정지 ================= */
  pause() {
    if (this.state !== 'play') return;
    this.state = 'pause';
    if (AE.ctx) AE.ctx.suspend();
    this.pauseDim = this.add.rectangle(0, 0, GW, GH, 0x05020c, 0.6).setOrigin(0).setDepth(290);
    this.pauseWin = Win(this, GW / 2 - 80, 86, 160, 96, { depth: 300, title: '일시정지', pop: false });
    this.pauseMenu = new Menu(this, GW / 2 - 70, 100, 140, [{ text: '계속하기', k: 'go' }, { text: '처음부터 다시', k: 'retry' }, { text: '설정', k: 'set' }, { text: '지도로 돌아가기', k: 'map' }], {
      depth: 300, rowH: 18, stack: this.pstack,
      onOk: it => {
        if (it.k === 'set') { AE.ui('open'); openSettings(this, this.pstack, () => this.applySettings(), { inGame: true, depth: 330 }); return; }
        AE.resume();
        if (it.k === 'go') { this.resumeGame(); return; }
        SEQ.stop(); this.state = 'leave';
        if (it.k === 'retry') this.scene.restart({ stage: this.si, diff: this.diff, auto: this.auto, practice: this.practice });
        else this.scene.start('WorldMap', {});
      },
      onBack: () => { AE.resume(); this.resumeGame(); },
    });
  }
  // 일시정지 중 바꾼 설정을 바로 적용
  applySettings() {
    const st = Store.data.settings;
    this.speed = 100 * st.speed; this.offset = st.offset / 1000; this.lk = laneKeys();
    this.meter.setVisible(st.meter);
    for (const n of this.active) if (n.spr && !n.hit) n.spr.x = JX + (n.t - this.clock) * this.speed;
  }
  /* 타이밍 막대: 가운데 = 딱 맞음, 왼쪽 = 일찍, 오른쪽 = 늦게. 최근에 친 타이밍이 짧은 선으로 남아요 */
  makeMeter() {
    const c = this.add.container(GW / 2, GH - 40).setDepth(99).setVisible(Store.data.settings.meter);
    const g = this.add.graphics();
    const W = 60 / JUDGE.D.w;
    g.fillStyle(0x000000, 0.45).fillRoundedRect(-66, -6, 132, 12, 3);
    g.fillStyle(JUDGE.D.c, 0.45).fillRect(-60, -1, 120, 2);
    g.fillStyle(JUDGE.G.c, 0.6).fillRect(-JUDGE.G.w * W, -1, JUDGE.G.w * W * 2, 2);
    g.fillStyle(JUDGE.P.c, 0.85).fillRect(-JUDGE.P.w * W, -1, JUDGE.P.w * W * 2, 2);
    g.fillStyle(0xffffff, 1).fillRect(-0.5, -5, 1, 10);
    c.add(g);
    c.add(tx(this, -64, -13, 'FAST', { font: 'en', size: 6, color: '#8ab8ff' }));
    c.add(tx(this, 64, -13, 'SLOW', { font: 'en', size: 6, ox: 1, color: '#ffaa6a' }));
    this.meter = c; this.meterW = W; this.ticks = [];
  }
  meterTick(d, col) {
    if (!Store.data.settings.meter) return;
    const x = clamp(d, -JUDGE.D.w, JUDGE.D.w) * this.meterW;
    const t = this.add.rectangle(x, 0, 2, 9, col).setAlpha(0.95);
    this.meter.add(t);
    this.tweens.add({ targets: t, alpha: 0, duration: 2400, onComplete: () => t.destroy() });
    this.ticks.push(t); if (this.ticks.length > 14) { const o = this.ticks.shift(); if (o.active) o.destroy(); }
  }
  resumeGame() {
    if (this.pstack.stack.length > 1) return;   // 설정 창이 열려 있으면 닫힌 뒤에
    this.pauseMenu.destroy(); this.pauseWin.destroy(); this.pauseDim.destroy();
    for (let l = 0; l < 2; l++) { this.laneHeld[l].clear(); if (this.holdNote[l]) this.release(l); }
    this.ptrLane = {};
    if (AE.ctx) AE.ctx.resume();
    this.state = 'play';
  }

  /* ================= 끝 ================= */
  finish() {
    this.state = 'end';
    const fc = this.cnt.M === 0, ap = fc && this.cnt.G === 0 && this.cnt.D === 0;
    if (this.boss && this.boss.alive) {
      this.boss.alive = false;
      this.tweens.add({ targets: [this.boss.spr, this.boss.aura], x: '+=200', alpha: 0, duration: 900, ease: 'Quad.easeIn' });
      this.bossUI.setVisible(false); this.bossG.g.setVisible(false);
      tx(this, GW / 2, 128, '보스가 도망쳤다…', { size: 14, font: 'serif', bold: true, ox: 0.5, oy: 0.5, color: '#ff9ab8', st: 3 }).setDepth(140);
      this.time.delayedCall(2200, () => this.toResult(true, 'escape'));
      return;
    }
    AE.clear();
    this.player.setFrame('win');
    this.banner(ap ? 'ALL PERFECT' : fc ? 'FULL COMBO' : 'STAGE CLEAR', 128, 1800);
    this.burst('y', GW / 2, 128, 40);
    this.time.delayedCall(2400, () => this.toResult(false));
  }
  fail() {
    this.state = 'fail';
    SEQ.stop(0.8); AE.fail();
    this.player.setAlpha(1).setFrame('hurt').setTint(0xff8080);
    this.tweens.add({ targets: this.player, angle: -80, y: GROUND + 6, duration: 500 });
    this.add.rectangle(0, 128, GW, 34, 0x000000, 0.7).setOrigin(0, 0.5).setDepth(139);
    tx(this, GW / 2, 128, '쓰러졌다…', { size: 16, font: 'serif', bold: true, ox: 0.5, oy: 0.5, color: '#ff8a8a', st: 3 }).setDepth(140);
    this.cameras.main.shake(300, 0.01);
    this.time.delayedCall(2400, () => this.toResult(true, 'dead'));
  }
  toResult(failed, reason) {
    if (this.leaving) return; this.leaving = true;
    this.cameras.main.fadeOut(500);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      SEQ.stop();
      this.scene.start('Result', {
        practice: this.practice, stage: this.si, diff: this.diff, score: this.score, cnt: this.cnt, total: this.total,
        maxCombo: this.maxCombo, failed, reason, gold: this.goldGain, kills: this.kills, stones: this.stoneGain,
      });
    });
  }

  /* ================= 매 프레임 ================= */
  update(time, delta) {
    if (this.state === 'pause' || this.state === 'leave') return;
    const dt = Math.min(delta, 50) / 1000;
    this.realT += dt;
    this.sv.playTime += dt;
    const S = this.S, sp = this.speed;
    const raw = this.rawTime();
    if (this.state !== 'fail') {
      this.clock += dt;
      const e = raw - this.clock;
      if (Math.abs(e) > 0.05) this.clock = raw; else this.clock += e * 0.1;
    }
    const st = this.clock, beat = st / S.spb;
    const pulse = beat >= 0 ? Math.pow(1 - (beat - Math.floor(beat)), 4) : 0;
    this.bg.update(dt, this.state === 'fail' ? 0 : sp, pulse, this.feverOn);

    // 준비 → 시작
    if (this.readyT) {
      if (st > -1.6 && st <= -0.5 && this.readyT.text !== 'READY') { this.readyT.setText('READY').setColor('#fff4dc').setScale(1.4); this.tweens.add({ targets: this.readyT, scale: 1, duration: 200 }); }
      if (st > -0.5 && this.readyT.text !== 'START!') { this.readyT.setText('START!'); goldFill(this.readyT); this.readyT.setScale(1.6); this.tweens.add({ targets: this.readyT, scale: 1, duration: 200 }); }
      if (st > 0.5) { this.readyT.destroy(); this.readyT = null; }
    }
    if (this.keyHints) {
      const a = clamp(1 - (st - S.barD * 3) / S.barD, 0, 1);
      this.keyHints.forEach(k => k.setAlpha(a * (0.6 + pulse * 0.4)));
      if (a <= 0) { this.keyHints.forEach(k => k.destroy()); this.keyHints = null; }
    }

    // 줄과 판정선
    for (let l = 0; l < 2; l++) {
      this.laneImg[l].setAlpha(0.75 + pulse * 0.25);
      this.targets[l].setAlpha(0.6 + pulse * 0.4).setScale(0.36 + pulse * 0.03);
      this.tglow[l].setAlpha(Math.max(this.tglow[l].alpha - dt * 4, this.holdNote[l] ? 0.6 : 0.12 + pulse * 0.15));
    }

    if (this.auto && this.state === 'play') for (const n of this.active) if (!n.hit && !n.missed && !n.taken && raw >= n.t) this.press(n.lane);
    if (this.state === 'play' || this.state === 'end') { this.spawnNotes(st); this.updateNotes(st, sp); }
    this.updateBoss(st, pulse);
    this.updatePlayer(st, dt, beat, pulse);
    this.updateHUD(st, dt);

    if (this.feverOn) {
      this.fever = 100 * clamp((this.feverEnd - st) / this.feverLen, 0, 1);
      this.ghostAcc += dt;
      if (this.ghostAcc > 0.05) {
        this.ghostAcc = 0;
        const g = this.add.image(this.player.x, this.player.y, 'hero', this.player.frame.name).setOrigin(0.5, 1).setTint(hueC(this.realT * 0.5, 0.5)).setAlpha(0.5).setDepth(19).setBlendMode('ADD');
        this.tweens.add({ targets: g, x: g.x - 18, alpha: 0, duration: 240, onComplete: () => g.destroy() });
      }
      if (st >= this.feverEnd) this.feverOn = false;
    }
    if (this.state === 'play' && st > this.lastNoteT + 0.3 && this.spawnIdx >= this.notes.length &&
      this.active.every(n => n.type === 'heart' || n.done || n.missed || (n.hit && n.type === 'tap'))) this.finish();
  }

  spawnNotes(st) {
    const look = (GW + 60 - JX) / this.speed;
    while (this.spawnIdx < this.notes.length && this.notes[this.spawnIdx].t - st < look) {
      const n = this.notes[this.spawnIdx++];
      if (n.type === 'tap') {
        const key = 'en_' + this.ch.enemies[n.lane === 1 ? 0 : 1];
        n.spr = this.add.sprite(600, 0, key, 0).setDepth(n.lane ? 11 : 10);
        n.cy = n.lane === 1 ? GROUND + 1 - n.spr.height / 2 : LANE_Y[0];
        n.spr.setTint(this.amb);
        n.cy += ENEMY_PAD;
        // 엘리트: 가끔 나오는 빛나는 적 (골드 3배, 마정석을 떨어뜨리기도 해요)
        n.elite = n.sect !== 'intro' && Math.floor(n.t * 997) % 11 === 3;
        if (n.elite) {
          n.spr.setScale(1.15);
          if (n.lane === 1) n.cy = GROUND + 1 + ENEMY_PAD - n.spr.height * 1.15 / 2;
          n.aura = this.add.image(600, 0, 'glow').setTint(0xffd060).setBlendMode('ADD').setScale(1.5).setDepth(n.spr.depth - 0.5);
        }
        n.sh = this.add.image(600, GROUND + 2, 'shadow').setScale(n.lane ? 0.8 : 0.55, n.lane ? 0.2 : 0.14).setAlpha(n.lane ? 0.45 : 0.22).setDepth(9);
      } else if (n.type === 'heart') { n.spr = this.add.image(600, 0, 'potion').setDepth(10); n.cy = LANE_Y[n.lane]; }
      else { n.spr = this.add.image(600, 0, 'rune' + n.lane).setDepth(13); n.tail = this.add.image(600, 0, 'runeT' + n.lane).setDepth(12); }
      this.active.push(n);
    }
  }

  noteY(n, x, st) {
    let y = n.cy;
    if (n.lane === 0 && n.type === 'tap') y += Math.round(Math.sin(st * 5 + n.t * 3) * 2.5);
    if (n.type === 'heart') y += Math.round(Math.sin(st * 6) * 2);
    const b = this.boss;
    if (b && b.alive && b.entered && b.hx && n.t >= this.S.bossStart - 0.01) {
      const k = clamp((x - 220) / (b.hx - 220), 0, 1);
      y = Math.round(lerp(y, b.hy, k * k));
    }
    return y;
  }

  updateNotes(st, sp) {
    const g = this.gfx; g.clear();
    const b = this.boss;
    for (let i = this.active.length - 1; i >= 0; i--) {
      const n = this.active[i];
      if (n.type === 'hold') {
        const y = LANE_Y[n.lane];
        let hx = JX + (n.t - st) * sp;
        const ex = JX + (n.end - st) * sp;
        if (n.holding) {
          hx = JX;
          while (st >= n.nextTick && n.nextTick < n.end) {
            n.nextTick += this.S.step;
            this.score += Math.round(30 * (this.feverOn ? 2 : 1));
            if (!this.feverOn) this.fever = Math.min(100, this.fever + 0.4 * this.ps.burst);
            this.burst(n.lane, JX + 4, y, 3);
          }
          if (st >= n.end) this.completeHold(n);
        }
        if (!n.hit && !n.missed && st - n.t > this.winD) { n.missed = true; this.miss(n.lane, 1, 2); }
        if (n.done) { n.spr.destroy(); n.tail.destroy(); this.active.splice(i, 1); continue; }
        const grey = n.missed || n.broken, col = grey ? 0x5a5670 : LANE_C[n.lane];
        const x0 = Math.round(hx), w = Math.round(ex) - x0;
        if (w > 0) {
          g.fillStyle(col, n.holding ? 0.3 : 0.18).fillRect(x0, y - 7, w, 14);
          g.fillStyle(col, n.holding ? 0.75 : 0.5).fillRect(x0, y - 3, w, 6);
          g.fillStyle(0xffffff, n.holding ? 0.95 : 0.6).fillRect(x0, y - 1, w, 2);
          const off = ((Math.round(st * sp)) % 10 + 10) % 10;
          g.fillStyle(0xffffff, grey ? 0.08 : 0.3);
          for (let x = x0 + 10 - off; x < x0 + w; x += 10) g.fillRect(x, y - 5, 2, 10);
        }
        n.spr.setPosition(x0, y).setAlpha(grey ? 0.4 : 1).setAngle(n.holding ? this.realT * 400 : 0);
        n.tail.setPosition(Math.round(ex), y).setAlpha(grey ? 0.4 : 1);
        if (ex < -14) { n.spr.destroy(); n.tail.destroy(); this.active.splice(i, 1); }
        continue;
      }
      if (n.taken || (n.hit && !n.spr)) { if (n.sh) n.sh.destroy(); if (n.aura) n.aura.destroy(); this.active.splice(i, 1); continue; }
      const x = JX + (n.t - st) * sp;
      if (!n.missed && st - n.t > (n.type === 'heart' ? 0.16 : this.winD)) { n.missed = true; if (n.type === 'tap') this.miss(n.lane); }
      const y = this.noteY(n, x, st);
      n.spr.setPosition(Math.round(x), y);
      if (n.type === 'tap') n.spr.setFrame(Math.floor(Math.max(0, st) / this.S.spb * (n.lane === 0 ? 4 : 2) + n.t * 7) % 4);
      let a = n.missed ? 0.4 : 1;
      if (b && b.alive && b.entered && b.hx && x > b.hx) a = 0;
      n.spr.setAlpha(a);
      if (n.sh) n.sh.setPosition(Math.round(x), GROUND + 2).setAlpha(a * (n.lane ? 0.45 : 0.22));
      if (n.aura) n.aura.setPosition(Math.round(x), y).setAlpha(a * (0.5 + 0.25 * Math.sin(this.realT * 8)));
      if (n.dbl && n.lane === 0 && n.mate && !n.hit && !n.missed && n.mate.spr && !n.mate.hit && a > 0) {
        const my = this.noteY(n.mate, x, st);
        g.fillStyle(0xffffff, 0.55);
        for (let yy = y + 10; yy < my - 12; yy += 4) g.fillRect(Math.round(x), yy, 1, 2);
      }
      if (x < -30) { n.spr.destroy(); if (n.sh) n.sh.destroy(); if (n.aura) n.aura.destroy(); this.active.splice(i, 1); }
    }
  }

  updatePlayer(st, dt, beat, pulse) {
    const now = this.realT;
    this.lumi.setFrame(Math.floor(now * 14) % 4).setPosition(PX - 26 + Math.sin(now * 1.7) * 4, this.py - 64 + Math.sin(now * 3.1) * 3);
    const tier = this.combo >= 100 ? 2 : this.combo >= 50 ? 1 : 0;
    this.comboAura.setPosition(PX, this.py - 30).setAlpha(tier ? 0.28 + pulse * 0.25 : Math.max(0, this.comboAura.alpha - 0.05)).setTint(tier === 2 ? hueC(now * 0.5, 0.5) : 0xffd070);
    this.lumiSh.setX(this.lumi.x); this.floorRing.setAlpha(0.35 + pulse * 0.35);
    this.lumiGlow.setPosition(this.lumi.x, this.lumi.y).setAlpha((this.fever >= 100 || this.feverOn ? 0.7 : 0.25) + pulse * 0.2);
    if (this.state === 'fail') return;
    if (this.state === 'end' && this.player.frame.name === 'win') return;
    const airHold = this.holdNote[0] && this.holdNote[0].holding;
    if (now < this.airUntil || airHold) { this.py = lerp(this.py, AIR_FEET, Math.min(1, dt * 28)); this.vy = 0; }
    else if (this.py < GROUND) {
      this.vy += 1200 * dt; this.py += this.vy * dt;
      if (this.py >= GROUND) { this.py = GROUND; this.vy = 0; this.burst('dust', PX, GROUND, 4); }
    }
    const inAir = this.py < GROUND - 2;
    const attacking = now < this.atkUntil || this.holdNote[0] || this.holdNote[1];
    const ri = beat >= 0 ? Math.floor(beat * 4) % 8 : Math.floor(now * 12) % 8;
    let f;
    if (now < this.hurtUntil - 0.25) f = 'hurt';
    else if (attacking) f = (inAir ? 'atkA' : 'atk') + (this.slashFlip ? '2' : '');
    else if (inAir) f = this.vy > 50 ? 'fall' : 'jump';
    else f = 'run' + ri;
    this.player.setFrame(f).setPosition(PX, Math.round(this.py) + 1);
    const hurt = now < this.hurtUntil;
    this.player.setAlpha(hurt && Math.floor(now * 16) % 2 ? 0.4 : 1);
    if (hurt) this.player.setTint(0xffa0a0); else this.player.setTint(this.amb);
    const h = (GROUND - this.py) / 60;
    this.shadow.setAlpha(0.55 * (1 - h)).setScale(1 - h * 0.5, 0.25);
  }

  updateHUD(st, dt) {
    this.shownScore = this.score - this.shownScore < 3 ? this.score : lerp(this.shownScore, this.score, Math.min(1, dt * 12));
    this.scoreT.setText(comma(this.shownScore));
    this.goldT.setText(comma(this.goldGain));
    const judged = this.cnt.P + this.cnt.G + this.cnt.D + this.cnt.M;
    this.accT.setText((judged ? (this.cnt.P + this.cnt.G * 0.7 + this.cnt.D * 0.4) / judged * 100 : 100).toFixed(1) + '%');
    this.hpG.update(dt);
    if (this.bossG) this.bossG.update(dt);
    this.progG.set(clamp(st / this.S.duration, 0, 1), true);
    const ready = !this.feverOn && this.fever >= 100;
    if (this.feverOn || ready) { this.fvG.colA = hueC(this.realT * 0.6, 0.6); this.fvG.colB = 0xffffff; } else { this.fvG.colA = 0xffb040; this.fvG.colB = 0xffe890; }
    this.fvG.set(this.fever / 100, true);
    this.fvT.setText(this.feverOn ? 'BURST  x2' : ready ? (Math.floor(this.realT * 3) % 2 ? 'SPACE!' : '') : '');
  }
}
