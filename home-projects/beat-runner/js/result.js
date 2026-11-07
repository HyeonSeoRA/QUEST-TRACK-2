'use strict';
/* 결과 화면: 랭크와 기록, 그리고 경험치·골드·아이템 보상 (레벨 업!) */

class Result extends Phaser.Scene {
  constructor() { super('Result'); }
  init(d) { this.d = d; }
  create() {
    fitCam(this);
    const d = this.d, st = STAGES[d.stage], sv = Store.s, c = d.cnt;
    const acc = d.total ? (c.P + c.G * 0.7 + c.D * 0.4) / d.total : 0;
    const fc = !d.failed && c.M === 0, ap = fc && c.G === 0 && c.D === 0;
    const rank = d.failed ? 'F' : acc >= 0.95 ? 'S' : acc >= 0.88 ? 'A' : acc >= 0.78 ? 'B' : acc >= 0.65 ? 'C' : 'D';
    const hard = d.diff === 'hard';
    const firstClear = !d.failed && !sv.cleared[st.id];

    // 보상 계산
    const rankMul = { S: 1.3, A: 1.15, B: 1, C: 0.9, D: 0.8, F: 1 }[rank];
    const failMul = d.reason === 'escape' ? 0.5 : d.reason === 'dead' ? 0.3 : 1;
    const expGain = Math.round(st.exp * rankMul * (hard ? 1.5 : 1) * failMul);
    const goldGain = Math.round(d.gold * (hard ? 1.5 : 1) * (d.failed ? 0.5 : 1));
    const lvBefore = sv.lv, statBefore = stats(sv), expBefore = sv.exp;
    const stoneGain = (d.stones || 0) + (d.failed ? 0 : 1 + st.ch + (st.boss ? 2 : 0) + (hard ? 1 : 0) + (rank === 'S' ? 1 : 0));
    sv.exp += expGain; sv.gold += goldGain; sv.stones = (sv.stones || 0) + stoneGain;
    const ups = [];
    while (sv.lv < MAX_LV && sv.exp >= expNext(sv.lv)) { sv.exp -= expNext(sv.lv); sv.lv++; ups.push(sv.lv); }
    if (sv.lv >= MAX_LV) sv.exp = 0;
    let drop = null;
    if (firstClear && st.drop && !sv.inv.includes(st.drop)) { sv.inv.push(st.drop); drop = st.drop; }
    if (!d.failed) {
      sv.cleared[st.id] = true;
      const key = st.id;
      const old = sv.best[key];
      this.newBest = !old || d.score > old.score;
      const b = old ? { ...old } : { score: 0, rank: 'F' };
      if (d.score > b.score) b.score = d.score;
      if (RANK_ORDER.indexOf(rank) > RANK_ORDER.indexOf(b.rank)) b.rank = rank;
      b.fc = b.fc || fc;
      sv.best[key] = b;
      if (firstClear) sv.node = Math.min(MAP_NODES.length - 1, d.stage + 2);
    }
    Store.save();
    this.after = (firstClear && STORY_AFTER[st.id]) ? STORY_AFTER[st.id] : null;

    AE.init();
    this.bg = new BG(this, CHAPTERS[st.ch].theme);
    this.add.rectangle(0, 0, GW, GH, 0x05030c, 0.55).setOrigin(0).setDepth(-20);
    this.hero = this.add.sprite(64, GROUND + 1, 'hero', d.failed ? 'idle0' : 'win').setOrigin(0.5, 1).setDepth(5).setAlpha(0.9);
    if (d.failed) this.hero.setTint(0x8a8aa8);
    this.t0 = 0;

    const head = d.failed ? (d.reason === 'escape' ? '보스를 놓쳤다…' : '패배…') : (ap ? 'ALL PERFECT' : fc ? 'FULL COMBO' : 'STAGE CLEAR');
    const ht = tx(this, GW / 2, 20, head, d.failed ? { size: 16, font: 'serif', bold: true, ox: 0.5, oy: 0.5, color: '#ff9a9a', st: 3 } : { font: 'en', size: 20, ox: 0.5, oy: 0.5, st: 4, stroke: '#2a1408' }).setDepth(110);
    if (!d.failed) goldFill(ht);
    tx(this, GW / 2, 36, `${st.id}  ${st.name}  ·  ${hard ? '어려움' : '보통'}`, { size: 9, ox: 0.5, color: '#c8c0e8' }).setDepth(110);

    // 왼쪽: 기록
    Win(this, 120, 50, 160, 186, { depth: 100, title: '기록' });
    this.rankT = tx(this, 160, 92, rank, { font: 'en', size: 44, ox: 0.5, oy: 0.5, st: 5, stroke: '#1a0c04', color: RANK_CSS[rank] }).setDepth(110).setAlpha(0).setScale(2.5);
    if (rank === 'S' || rank === 'A') goldFill(this.rankT);
    this.add.image(160, 92, 'glow').setTint(Phaser.Display.Color.HexStringToColor(RANK_CSS[rank]).color).setBlendMode('ADD').setAlpha(0.3).setScale(1.6).setDepth(105);
    tx(this, 160, 122, 'RANK', { font: 'en', size: 8, ox: 0.5, color: '#9a92c0' }).setDepth(110);
    this.scoreT = tx(this, 270, 72, '0', { font: 'en', size: 12, ox: 1, color: '#ffffff' }).setDepth(110);
    tx(this, 200, 62, 'SCORE', { font: 'en', size: 7, color: '#9a92c0' }).setDepth(110);
    if (this.newBest && !d.failed) this.nb = tx(this, 270, 88, 'NEW BEST!', { font: 'en', size: 8, ox: 1, color: '#ff9ab8' }).setDepth(110);
    const rows = [['정확도', (acc * 100).toFixed(2) + '%', '#ffffff'], ['최대 콤보', String(d.maxCombo), '#ffffff'],
      ['PERFECT', c.P, JUDGE.P.css], ['GREAT', c.G, JUDGE.G.css], ['GOOD', c.D, JUDGE.D.css], ['MISS', c.M, JUDGE.M.css]];
    rows.forEach(([k, v, col], i) => {
      const y = 140 + i * 15;
      const a = tx(this, 134, y, k, { size: 9, font: k === k.toUpperCase() ? 'en' : 'ui', color: col }).setDepth(110).setAlpha(0);
      const b = tx(this, 268, y, String(v), { size: 10, ox: 1 }).setDepth(110).setAlpha(0);
      this.tweens.add({ targets: [a, b], alpha: 1, delay: 300 + i * 80, duration: 160 });
    });

    // 오른쪽: 보상
    Win(this, 292, 50, 176, 186, { depth: 100, title: '보상' });
    tx(this, 304, 68, `경험치  +${comma(expGain)}`, { size: 10, color: '#9ad8ff' }).setDepth(110);
    this.lvT = tx(this, 304, 86, `Lv. ${lvBefore}`, { size: 10, bold: true }).setDepth(110);
    this.expG = Gauge(this, 304, 102, 152, 5, 0x4a8aff, 0x9ad8ff, { depth: 110 });
    this.expG.set(lvBefore >= MAX_LV ? 1 : expBefore / expNext(lvBefore), true);
    this.add.image(310, 122, 'icons', 'coin').setDepth(110);
    tx(this, 320, 122, `골드  +${comma(goldGain)}  (가진 골드 ${comma(sv.gold)})`, { size: 9, oy: 0.5, color: '#ffe8b0' }).setDepth(110);
    this.add.image(310, 139, 'icons', 'crystal1').setDepth(110);
    tx(this, 320, 139, `마정석  +${stoneGain}  (가진 마정석 ${sv.stones})`, { size: 9, oy: 0.5, color: '#a8e0ff' }).setDepth(110);
    let y = 154;
    if (drop) { this.add.image(310, y + 6, 'icons', drop).setDepth(110); tx(this, 320, y, `${ITEMS[drop].name} 획득!`, { size: 9, color: '#ff9ad0', bold: true }).setDepth(110); y += 16; }
    if (firstClear && d.stage + 1 < STAGES.length) { tx(this, 304, y, `새 장소가 열렸어요: ${STAGES[d.stage + 1].name}`, { size: 8, color: '#9dffa0', wrap: 156 }).setDepth(110); y += 22; }
    if (d.failed) tx(this, 304, y, d.reason === 'escape' ? '보스를 쓰러뜨리려면 공격력이 더 필요해요.\n레벨을 올리거나 좋은 무기를 사 보세요!' : '레벨을 올리거나 방어구를 사면\n더 오래 버틸 수 있어요.', { size: 8, color: '#ffb0b0', wrap: 160, ls: 4 }).setDepth(110);
    this.upsT = tx(this, 304, 200, '', { size: 8, color: '#9dffa0', wrap: 160 }).setDepth(110);

    tx(this, GW / 2, GH - 12, 'Enter: 계속    R: 다시 도전', { size: 8, ox: 0.5, color: '#9a92c0' }).setDepth(110);

    // 연출 순서: 랭크 → 경험치 바 → 레벨 업
    this.target = d.score; this.shown = 0;
    this.time.delayedCall(700, () => {
      this.tweens.add({ targets: this.rankT, scale: 1, alpha: 1, duration: 280, ease: 'Back.easeOut' });
      this.time.delayedCall(220, () => { this.cameras.main.shake(140, 0.006); if (rank === 'F') AE.fail(); else if ('SA'.includes(rank)) AE.clear(); else AE.combo(); });
    });
    this.time.delayedCall(1300, () => this.animExp(lvBefore, expBefore, ups, statBefore));
    this.ready = false;
    this.time.delayedCall(900, () => { this.ready = true; });
    onKeys(this, e => {
      if (OK_KEYS.includes(e.code) || e.code === 'Escape') this.go(false);
      else if (e.code === 'KeyR') this.go(true);
    });
    this.input.on('pointerdown', () => this.go(false));
    this.cameras.main.fadeIn(400);
  }
  animExp(lv, exp, ups, before) {
    const sv = Store.s;
    const steps = [...ups.map(() => 1), sv.lv >= MAX_LV ? 1 : sv.exp / expNext(sv.lv)];
    let k = 0;
    const next = () => {
      if (k >= steps.length) return;
      const to = steps[k];
      this.tweens.addCounter({
        from: this.expG.v, to, duration: 500, onUpdate: tw => this.expG.set(tw.getValue(), true),
        onComplete: () => {
          if (k < ups.length) {
            this.lvT.setText(`Lv. ${ups[k]}`);
            AE.levelup();
            this.cameras.main.flash(200, 200, 230, 255);
            const t = goldFill(tx(this, 380, 86, 'LEVEL UP!', { font: 'en', size: 12, oy: 0, st: 3 })).setDepth(111).setScale(1.5);
            this.tweens.add({ targets: t, scale: 1, duration: 200 });
            this.expG.set(0, true);
            const now = stats(sv);
            this.upsT.setText(`최대 HP ${before.maxHp} → ${now.maxHp}   공격력 ${before.atk} → ${now.atk}   방어력 ${before.def} → ${now.def}`);
          }
          k++; next();
        },
      });
    };
    next();
  }
  go(retry) {
    if (!this.ready) return; this.ready = false;
    AE.ui('ok');
    const d = this.d;
    if (retry) { goScene(this, 'Play', { stage: d.stage, diff: d.diff }); return; }
    if (this.after) goScene(this, 'Story', { id: this.after, next: ['WorldMap', {}] });
    else goScene(this, 'WorldMap', {});
  }
  update(time, delta) {
    const dt = Math.min(delta, 50) / 1000;
    this.t0 += dt;
    this.bg.update(dt, 20, 0);
    this.expG.update(dt);
    if (this.t0 > 0.4 && this.shown < this.target) {
      this.shown = Math.min(this.target, this.shown + Math.max(53, this.target * dt * 1.1));
      if (Math.floor(this.t0 * 30) % 3 === 0) AE.tick();
    }
    this.scoreT.setText(comma(this.shown));
    if (this.nb) this.nb.setVisible(Math.floor(this.t0 * 3) % 2 === 0);
  }
}
