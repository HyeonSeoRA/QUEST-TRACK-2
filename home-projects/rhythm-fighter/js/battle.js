'use strict';
/*
 * 전투: 왼쪽은 4줄 리듬게임, 오른쪽은 기사와 몬스터의 싸움.
 * 노트를 맞추면 기사가 검기를 날려 몬스터를 때리고, 놓치면 몬스터가 기사를 공격한다.
 * 렉을 줄이려고, 움직이지 않는 부분(배경·틀·줄·풍경)은 한 장으로 미리 그려 두고 매번 그 한 장만 붙인다.
 */

const LX = 24, LY = 80, LW = 520, LH = 624;          // 왼쪽 리듬 패널
const LANE_W = 104, LANE_X0 = LX + (LW - LANE_W * 4) / 2, LANE_TOP = 96, JUDGE_Y = 598;
const AX = 560, AY = 80, AW = 696, AH = 624;         // 오른쪽 전투 패널
const HORIZON = 416, FLOOR = 556, PILOT_X = 690, MON_X = 1078;
const LANE_KEYS = { KeyD: 0, KeyF: 1, KeyJ: 2, KeyK: 3 };
const KEY_LABEL = ['D', 'F', 'J', 'K'];
const JUDGE = ['PERFECT', 'GREAT', 'GOOD', 'MISS'];
const BRAZIERS = [AX + 46, AX + AW - 46], BRAZIER_Y = HORIZON + 54;
const JUDGE_COLOR = [P.goldLight, '#8fd18a', '#8fb3d6', '#ff5a4a'];

/* ---------- 노트 그림: 금테 두른 검은 막대 + 가운데 보석 (2배 크기로 그려 두고 줄여서 씀) ---------- */
const noteCache = new Map();
function noteImg(lane, drive) {
  const key = lane + (drive ? 'd' : '');
  if (noteCache.has(key)) return noteCache.get(key);
  const w = LANE_W - 12, h = 22, pad = 12, col = drive ? P.ember : LANE_COLORS[lane];
  const img = makeCanvas(w + pad * 2, h + pad * 2, 2, g => {
    glow(g, col, pad + w / 2, pad + h / 2, w * .6, h * 1.3, .55);
    g.translate(pad, pad);
    g.fillStyle = '#000'; g.fillRect(-1, -1, w + 2, h + 2);
    let gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, mix(col, '#ffffff', .25)); gr.addColorStop(.5, col); gr.addColorStop(1, mix(col, '#000000', .6));
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(2, 2, w - 4, 3);
    g.strokeStyle = goldGrad(g, 0, h); g.lineWidth = 2; g.strokeRect(1, 1, w - 2, h - 2);
    // 가운데 보석
    const cx = w / 2, cy = h / 2;
    g.fillStyle = '#000'; g.beginPath(); g.moveTo(cx, cy - 10); g.lineTo(cx + 12, cy); g.lineTo(cx, cy + 10); g.lineTo(cx - 12, cy); g.fill();
    gr = g.createLinearGradient(0, cy - 8, 0, cy + 8);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(.5, mix(col, '#ffffff', .4)); gr.addColorStop(1, col);
    g.fillStyle = gr; g.beginPath(); g.moveTo(cx, cy - 8); g.lineTo(cx + 10, cy); g.lineTo(cx, cy + 8); g.lineTo(cx - 10, cy); g.fill();
    g.strokeStyle = P.goldLight; g.lineWidth = 1; g.stroke();
  });
  noteCache.set(key, img);
  return img;
}

class BattleScene {
  /** carry: 심연의 탑에서 다음 층으로 이어 갈 때 남은 체력 등 */
  constructor(app, stage, carry = null) {
    this.app = app;
    this.stage = stage;
    this.carry = carry;
    this.st = stats();
    this.ui = new UI(app);
    this.fx = new Effects();
    this.notes = [];
    this.bolts = [];
    this.claws = [];
    this.banner = null;
    this.held = [false, false, false, false];
    this.laneFlash = [0, 0, 0, 0];
    this.counts = [0, 0, 0, 0];
    this.combo = this.st.startCombo;
    this.maxCombo = this.combo;
    this.score = 0;
    this.php = carry ? carry.php : this.st.maxHp; this.pghost = this.php;
    this.pHurtT = 9; this.pSlashT = 9;
    this.drive = 0; this.driveT = 0; this.driveDur = 1;
    this.guardLeft = this.st.guard;
    this.reviveLeft = this.st.revive;
    this.judgeT = 9; this.comboPop = 0;
    this.shake = 0; this.hurtFx = 0;
    this.paused = false;
    this.phase = 'intro';
    this.t = 0; this.anim = 0;
    this.result = null;
    this.windows = [.042 + this.st.window, .085 + this.st.window, .125 + this.st.window];
    this.layerKey = '';
    this.hitstop = 0;       // 강한 타격 순간 화면이 아주 잠깐 멈춤
    this.flash = 0;         // 번개 · 격파 때 번쩍임
    this.lightT = 3 + Math.random() * 4;
    this.lightning = null;
    this.slashes = [];      // 몬스터에 남는 초승달 베기 자국
    this.zoom = 0;          // 격파 순간 화면이 살짝 확대
    this.touches = new Map();
    this.souls = [];        // 쓰러진 몬스터에서 빠져나와 점수로 날아가는 영혼
    this.scoreFlash = 0;
    this.holdHintT = 0;
    this.tutorial = !stage.tower && stage.index === 0 && Save.stage(0).stars === 0;
  }

  get sound() { return this.app.sound; }
  now() { return this.sound.now() - Save.d.offset / 1000; }

  /* ------------------------------------------------------------ 미리 그려 두는 한 장 */
  staticLayer() {
    if (this.layerKey === String(this.app.scale)) return this.layer;
    this.layerKey = String(this.app.scale);
    const th = this.stage.sector;
    this.layer = makeCanvas(W, H, this.app.scale, g => {
      g.drawImage(sceneBg(W, H, th, 21 + th, { horizon: .9, moon: [.5, .2, .08], scale: this.app.scale }), 0, 0, W, H);
      g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(0, 0, W, H);
      box(g, 24, 14, 1232, 56, {});
      // 리듬 패널과 네 줄
      box(g, LX, LY, LW, LH, { fill: 'rgba(6,5,5,0.94)' });
      for (let i = 0; i < 4; i++) {
        const x = LANE_X0 + i * LANE_W, col = LANE_COLORS[i];
        const gr = g.createLinearGradient(0, LANE_TOP, 0, JUDGE_Y + 80);
        gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(.8, rgba(col, .08)); gr.addColorStop(1, rgba(col, .16));
        g.fillStyle = i % 2 ? '#0b0908' : '#0e0c0a'; g.fillRect(x, LANE_TOP - 8, LANE_W, JUDGE_Y + 90 - LANE_TOP);
        g.fillStyle = gr; g.fillRect(x, LANE_TOP - 8, LANE_W, JUDGE_Y + 90 - LANE_TOP);
      }
      for (let i = 0; i <= 4; i++) {
        const gr = g.createLinearGradient(0, LANE_TOP, 0, JUDGE_Y + 80);
        gr.addColorStop(0, 'rgba(201,162,74,0)'); gr.addColorStop(.6, 'rgba(201,162,74,0.35)'); gr.addColorStop(1, 'rgba(201,162,74,0.15)');
        g.fillStyle = gr; g.fillRect(LANE_X0 + i * LANE_W - (i % 4 ? .5 : 1), LANE_TOP - 8, i % 4 ? 1 : 2, JUDGE_Y + 90 - LANE_TOP);
      }
      // 전투 패널과 풍경
      box(g, AX, AY, AW, AH, { fill: '#000' });
      g.drawImage(sceneBg(AW - 8, AH - 8, th, 40 + th, { horizon: (HORIZON - AY - 4) / (AH - 8), moon: [.78, .26, .1], scale: this.app.scale }), AX + 4, AY + 4, AW - 8, AH - 8);
      g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(AX + 16, AY + 14, AW - 32, 84);
      box(g, AX + 16, AY + 14, AW - 32, 84, { fill: 'rgba(8,6,5,0.78)', shadow: false, t: 2, rivets: false });
      box(g, AX + 16, AY + AH - 118, AW - 32, 102, { fill: 'rgba(8,6,5,0.85)', shadow: false, t: 2, rivets: false });
      // 패널 테두리를 맨 위에 한 번 더 (풍경이 테두리를 덮지 않게)
      g.lineWidth = 2; g.strokeStyle = P.gold; g.strokeRect(AX + .5, AY + .5, AW - 1, AH - 1);
      cornerOrn(g, AX + 1, AY + 1, 1, 1, P.goldLight); cornerOrn(g, AX + AW - 1, AY + 1, -1, 1, P.goldLight);
      cornerOrn(g, AX + 1, AY + AH - 1, 1, -1, P.goldLight); cornerOrn(g, AX + AW - 1, AY + AH - 1, -1, -1, P.goldLight);
      disp(g, this.stage.tower ? `ABYSS TOWER · ${this.stage.floor}F` : `CHAPTER ${this.stage.sector + 1} · ${this.stage.index % 4 + 1}`, 46, 38, 12, 'gold', 'left');
      text(g, this.stage.name, 46, 61, 17, P.white, 'left', true, 800);
      for (const bx of BRAZIERS) brazierBase(g, bx, BRAZIER_Y, .9);
      if (Save.d.quality !== 'fast') drawGrain(g, .06);   // 필름 질감은 미리 그린 한 장에 (매번 그리지 않아 가벼움)
      plaque(g, LX + LW / 2, LY - 13, 150, '리 듬 의  검');
      plaque(g, AX + AW / 2, AY - 13, 150, '전    장');
      // 판정선 양쪽 창끝 장식
      for (const s of [-1, 1]) {
        const ex = s < 0 ? LANE_X0 - 6 : LANE_X0 + LANE_W * 4 + 6;
        g.fillStyle = '#000';
        g.beginPath(); g.moveTo(ex, JUDGE_Y - 9); g.lineTo(ex + s * 22, JUDGE_Y); g.lineTo(ex, JUDGE_Y + 9); g.fill();
        g.fillStyle = goldGrad(g, JUDGE_Y - 7, JUDGE_Y + 7);
        g.beginPath(); g.moveTo(ex, JUDGE_Y - 6); g.lineTo(ex + s * 18, JUDGE_Y); g.lineTo(ex, JUDGE_Y + 6); g.fill();
      }
    });
    return this.layer;
  }

  enter() {
    const s = this.stage, snd = this.sound;
    snd.cond.change(snd.renderedBar() + 1, s.bpm, s.prog, s.intensity);
    this.startWave(0);
  }

  startWave(i) {
    const s = this.stage, wv = s.waves[i], snd = this.sound;
    this.wave = i;
    const k = KINDS[wv.kind];
    this.mon = {
      kind: wv.kind, k, f: monsterFrames(wv.kind, wv.hue),
      hp: s.monsterHp(i), max: s.monsterHp(i), ghost: s.monsterHp(i), atk: s.monsterAtk(i),
      attackT: 9, hurtT: 9, spawnT: 0, dieT: -1, blinkAt: 2 + Math.random() * 2,
    };
    const startBar = snd.renderedBar() + (i === 0 ? 3 : 2) + (k.boss ? 1 : 0);
    const level = s.level + (k.boss ? .35 : 0) + i * .12;
    this.spec = { seed: s.seedBase + i * 17 + 7, level, startBar };
    snd.setLead(this.spec, startBar, Infinity);
    this.genBar = startBar;
    this.firstBeat = startBar * 4 + 2;
    this.waveStart = snd.cond.secOfBeat(startBar * 4);
    if (i > 0) this.phase = 'fight';
    this.banner = k.boss
      ? { t: 0, life: 3.4, boss: true, name: k.name, desc: k.desc }
      : {
        t: 0, life: 2.4, boss: false,
        title: i === 0 ? (s.tower ? `심연의 탑 · ${s.floor}층` : `제${s.sector + 1}장 · ${SECTOR[s.sector]}`) : `${i + 1}차 전투`,
        sub: i === 0 ? s.name : `${k.name} 등장`,
      };
    if (k.boss) { snd.play(SFX.GONG); this.shake = 10; }
  }

  /* ------------------------------------------------------------ 입력 */
  keyDown(code, time) {
    if (this.result) {
      if (this.result.t < .8) return;
      if (code === 'KeyR') this.retry();
      else if (code === 'KeyN' && this.hasNext()) this.nextStage();
      else if (code === 'Enter' || code === 'Escape' || code === 'Space') this.leave();
      return;
    }
    if (this.paused) {
      if (code === 'Escape') this.setPaused(false);
      else if (code === 'KeyR') this.retry();
      else if (code === 'KeyQ') this.leave();
      return;
    }
    if (code === 'Escape') { this.setPaused(true); return; }
    if (code === 'Space') { this.activateDrive(); return; }
    const lane = LANE_KEYS[code];
    if (lane === undefined) return;
    this.held[lane] = true;
    if (!this.app.autoplay) this.press(lane, time - Save.d.offset / 1000);
  }
  keyUp(code) {
    const lane = LANE_KEYS[code];
    if (lane === undefined) return;
    this.held[lane] = false;
    if (!this.app.autoplay && !this.paused) this.release(lane, this.now());
  }
  mouseDown(x, y) { this.ui.click(x, y); }
  /** 터치 · 마우스로 줄을 누르기 (휴대폰에서도 할 수 있게) */
  pointerDown(x, y, id, time) {
    if (this.result || this.paused) return false;
    if (x >= LANE_X0 && x < LANE_X0 + LANE_W * 4 && y > LANE_TOP && y < H - 10) {
      const lane = Math.floor((x - LANE_X0) / LANE_W);
      this.touches.set(id, lane);
      this.held[lane] = true;
      if (!this.app.autoplay) this.press(lane, time - Save.d.offset / 1000);
      return true;
    }
    if (x > AX && y > AY + 100 && y < AY + AH - 120 && this.st.drive && this.drive >= 100) { this.activateDrive(); return true; }
    return false;
  }
  pointerUp(id) {
    if (!this.touches.has(id)) return;
    const lane = this.touches.get(id);
    this.touches.delete(id);
    this.held[lane] = false;
    if (!this.app.autoplay && !this.paused) this.release(lane, this.now());
  }
  focusLost() { if (!this.paused && !this.result) this.setPaused(true); }

  setPaused(p) {
    this.paused = p;
    this.sound.pause(p);
    this.held = [false, false, false, false];
  }
  retry() {
    if (this.paused) this.sound.pause(false);
    this.app.go(new BattleScene(this.app, this.stage.tower ? towerStage(1) : this.stage));
  }
  leave() {
    if (this.paused) this.sound.pause(false);
    const h = new HubScene(this.app);
    if (this.stage.tower) h.sel = TOWER;
    else {
      h.sel = this.stage.index;
      if (this.result && this.result.win && this.stage.index + 1 < STAGES.length && stageUnlocked(this.stage.index + 1)) h.sel = this.stage.index + 1;
    }
    this.app.go(h);
  }
  hasNext() {
    return !!(this.result && this.result.win && (this.stage.tower || this.stage.index + 1 < STAGES.length));
  }
  nextStage() {
    if (this.stage.tower) {
      // 다음 층: 체력은 이어지고 30% 회복
      const php = Math.min(this.st.maxHp, Math.max(0, this.php) + this.st.maxHp * .3);
      this.app.go(new BattleScene(this.app, towerStage(this.stage.floor + 1), { php: Math.round(php) }));
      return;
    }
    Save.d.last = this.stage.index + 1;
    Save.write();
    this.app.go(new BattleScene(this.app, STAGES[this.stage.index + 1]));
  }

  /* ------------------------------------------------------------ 판정 */
  press(lane, time) {
    this.laneFlash[lane] = Math.max(this.laneFlash[lane], .35);
    if (this.mon.dieT >= 0) return;
    let best = null;
    for (const n of this.notes) {
      if (n.state || n.lane !== lane) continue;
      if (Math.abs(time - n.time) <= this.windows[2]) { best = n; break; }
      if (n.time - time > this.windows[2]) break;
    }
    if (!best) return;
    const d = time - best.time, ad = Math.abs(d);
    const j = ad <= this.windows[0] ? 0 : ad <= this.windows[1] ? 1 : 2;
    this.hit(best, j, d);
  }

  /** 롱노트를 떼었을 때: 끝 근처면 성공, 너무 일찍 떼면 실패 */
  release(lane, time) {
    for (const n of this.notes) {
      if (n.state !== 4 || n.lane !== lane) continue;
      if (time >= n.end - this.windows[2]) this.holdDone(n);
      else this.miss(n);
      return;
    }
  }
  holdDone(n) {
    n.state = 1;
    this.hit({ lane: n.lane, state: 0, tail: true }, 0, 0);
  }

  hit(n, j, d) {
    const st = this.st;
    n.state = n.hold ? 4 : 1;      // 롱노트는 누르고 있는 상태(4)로
    this.counts[j]++;
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.comboPop = 1;
    if (this.combo % 50 === 0) {
      this.fx.text(`${this.combo} COMBO!`, LANE_X0 + LANE_W * 2, 250, 40, 'gold', 1.4, { display: true, vy: -30 });
      this.fx.pop(LANE_X0 + LANE_W * 2, 300, P.goldLight, 26, 340);
      this.sound.play(SFX.COMBO);
    }
    this.score += [300, 200, 100][j] * (1 + Math.min(this.combo, 200) / 100) * (this.driveT > 0 ? 1.5 : 1);
    this.showJudge(j, d);
    const x = LANE_X0 + n.lane * LANE_W + LANE_W / 2, col = this.driveT > 0 ? P.yellow : LANE_COLORS[n.lane];
    this.laneFlash[n.lane] = 1;
    this.fx.ring(x, JUDGE_Y, 18, j === 0 ? 56 : 44, .25, j === 0 ? 6 : 4, col);
    this.fx.burst(x, JUDGE_Y, col, j === 0 ? 8 : 5, 380, .35);
    if (st.drive && this.driveT <= 0) this.drive = Math.min(100, this.drive + [2.2, 1.2, .4][j] * st.feverMul);
    if (j === 0 && st.vamp) this.php = Math.min(st.maxHp, this.php + st.vamp);

    let dmg = [12, 8, 4][j] * st.atkMul * (j === 0 ? st.perfectMul : 1);
    dmg *= 1 + Math.min(this.combo, 150) * st.comboBonus;
    if (this.driveT > 0) dmg *= 2;
    if (this.mon.hp < this.mon.max * .25) dmg *= 1 + st.execute;
    const crit = Math.random() < st.critChance;
    if (crit) dmg *= st.critMul;
    dmg = Math.max(1, Math.round(dmg));
    this.sound.play(crit ? SFX.CRIT : SFX.HIT, n.lane);

    this.pSlashT = 0;
    const sx = PILOT_X + 46, sy = FLOOR - 96;
    const ex = MON_X + (Math.random() - .5) * 50, ey = FLOOR - this.mon.k.size * 2 + (Math.random() - .5) * 60;
    this.bolts.push({
      x0: sx, y0: sy, x1: ex, y1: ey, cx: (sx + ex) / 2, cy: Math.min(sy, ey) - 70 - n.lane * 22,
      t: 0, dur: .2, dmg, crit, color: crit ? P.yellow : col,
    });
  }

  showJudge(j, d) {
    this.judge = j;
    this.judgeT = 0;
    this.judgeEL = j > 0 && j < 3 ? (d < 0 ? 'EARLY' : 'LATE') : '';
  }

  miss(n) {
    n.state = 2;
    n.missT = 0;
    this.counts[3]++;
    this.showJudge(3, 0);
    if (this.guardLeft > 0 && this.combo > 0) {
      this.guardLeft--;
      this.fx.text('보호막!', LANE_X0 + 208, 390, 20, '#8fb3d6', .8);
    } else this.combo = 0;
    if (this.mon.dieT >= 0 || this.result) return;
    const dmg = Math.max(1, Math.round(this.mon.atk * (1 - this.st.def)));
    this.php -= dmg;
    this.mon.attackT = 0;
    this.pHurtT = 0;
    this.shake = Math.max(this.shake, 10);
    this.hurtFx = 1;
    this.hitstop = Math.max(this.hitstop, .04);
    this.sound.play(SFX.HURT);
    this.claws.push({ x: PILOT_X + 4, y: FLOOR - 80, t: 0 });
    this.fx.text('-' + dmg, PILOT_X, FLOOR - 170, 30, '#ff4a3a', .9, { display: true });
    this.fx.burst(PILOT_X, FLOOR - 80, P.red, 8, 300, .45);
    if (this.php <= 0) {
      if (this.reviveLeft > 0) {
        this.reviveLeft--;
        this.php = Math.round(this.st.maxHp * .4);
        this.fx.ring(PILOT_X, FLOOR - 70, 20, 150, .7, 8, P.yellow);
        this.fx.pop(PILOT_X, FLOOR - 70, P.yellow, 20, 320);
        this.fx.text('부활!', PILOT_X, FLOOR - 190, 32, P.yellow, 1.2);
        this.sound.play(SFX.DRIVE);
      } else {
        this.php = 0;
        this.finish(false);
      }
    }
  }

  activateDrive() {
    if (!this.st.drive || this.drive < 100 || this.driveT > 0 || this.mon.dieT >= 0) return;
    this.driveDur = this.driveT = 8 * 60 / this.stage.bpm;
    this.drive = 0;
    this.sound.play(SFX.DRIVE);
    this.fx.ring(PILOT_X, FLOOR - 70, 20, 200, .6, 8, P.yellow);
    this.fx.text('각 성 !', LANE_X0 + 208, 300, 40, '#ffb070', 1.2);
  }

  damageMonster(b) {
    const m = this.mon;
    if (m.dieT >= 0) return;
    m.hp -= b.dmg;
    m.hurtT = 0;
    this.fx.burst(b.x1, b.y1, b.color, b.crit ? 10 : 5, b.crit ? 420 : 280, .4);
    this.fx.ring(b.x1, b.y1, 8, b.crit ? 50 : 30, .22, 4, b.color);
    // 숫자가 한곳에 겹치지 않게 나란히 흩뿌림
    this.dmgSlot = ((this.dmgSlot || 0) + 1) % 5;
    const nx = MON_X - 110 + this.dmgSlot * 55 + (Math.random() - .5) * 16;
    const ny = FLOOR - m.k.size * 4 - 10 + Math.abs(this.dmgSlot - 2) * 14;
    if (b.crit) {
      this.fx.text(String(b.dmg), nx, ny, 38, 'gold', .9, { vy: -110, display: true });
      this.fx.text('치명타', nx, ny - 36, 15, '#ff9a5a', .8, { vy: -110 });
      this.shake = Math.max(this.shake, 7);
      this.hitstop = Math.max(this.hitstop, .05);
    } else {
      this.fx.text(String(b.dmg), nx, ny, 22, P.white, .6, { vy: -90, display: true });
    }
    this.slashes.push({ x: b.x1 + (Math.random() - .5) * 30, y: b.y1 + (Math.random() - .5) * 30, a: Math.random() * Math.PI * 2,
      r: b.crit ? 80 : 46 + Math.random() * 20, t: 0, color: b.color });
    if (m.hp <= 0) this.killMonster();
    else if (m.k.boss && !m.enraged && m.hp < m.max * .5) this.enrage();
  }

  /** 보스 2페이즈: 체력이 절반 아래로 떨어지면 분노 — 노트가 빽빽해지고 공격이 세진다 */
  enrage() {
    const m = this.mon, snd = this.sound;
    m.enraged = true;
    m.atk *= 1.35;
    this.spec = { seed: this.spec.seed + 999, level: this.spec.level + 1.1, startBar: this.genBar };
    snd.setLead(this.spec, this.genBar, Infinity);
    snd.cond.change(this.genBar, this.stage.bpm, this.stage.prog, 3);
    snd.play(SFX.GONG); snd.play(SFX.THUNDER);
    this.banner = { t: 0, life: 2.2, rage: true, name: m.k.name };
    this.flash = 1; this.shake = 18; this.hitstop = .2;
    this.fx.ring(MON_X, FLOOR - 150, 30, 320, .8, 6, '#ff3020');
  }

  killMonster() {
    const m = this.mon, snd = this.sound;
    m.hp = 0;
    m.dieT = 0;
    snd.stopLead();
    snd.play(SFX.KILL);
    this.shake = 16;
    this.hitstop = .14;
    this.flash = .9;
    this.zoom = 1;
    this.score += 2000 * (this.wave + 1);
    if (this.st.regen) {
      this.php = Math.min(this.st.maxHp, this.php + this.st.regen);
      this.fx.text('+' + this.st.regen, PILOT_X, FLOOR - 170, 24, P.lime, 1, { display: true });
    }
    // 도트가 산산이 흩어짐
    const img = m.f.hurt, S = m.f.scale, size = m.k.size;
    const ox = MON_X - m.f.res * S / 2, oy = FLOOR - m.f.base * S;
    for (const p of pixelsOf(img, 1)) {
      const x = ox + p.x * S, y = oy + p.y * S;
      const a = Math.atan2(y - (oy + size * 2), x - MON_X) + (Math.random() - .5) * .8;
      const sp = 120 + Math.random() * 420;
      this.fx.particle(x + S / 2, y + S / 2, Math.cos(a) * sp, Math.sin(a) * sp - 160, .8 + Math.random() * .8, S, p.c, { grav: 600, drag: .97 });
    }
    this.fx.ring(MON_X, oy + size * 2, 20, 240, .7, 6, P.goldLight);
    this.fx.pop(MON_X, oy + size * 2, P.yellow, 18, 380);
    this.fx.text('격 파', MON_X, oy + size * 2 - 20, 56, 'gold', 1.4, { vy: -30 });
    for (let i = 0; i < 9; i++) {
      const a = Math.random() * Math.PI * 2, sp = 180 + Math.random() * 200;
      this.souls.push({ x: MON_X, y: FLOOR - m.f.res * S / 2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 140, t: -i * .04 });
    }
    for (const n of this.notes) {
      if (n.state && n.state !== 4) continue;
      n.state = 3;
      const y = JUDGE_Y - (n.time - this.t) * Save.d.speed;
      if (y > LANE_TOP) this.fx.burst(LANE_X0 + n.lane * LANE_W + LANE_W / 2, y, LANE_COLORS[n.lane], 3, 160, .35);
    }
    this.bolts.length = 0;
    this.phase = 'clear';
  }

  finish(win) {
    if (this.result) return;
    const s = this.stage, st = this.st;
    if (s.tower) return this.finishTower(win);
    const rec = Save.stage(s.index);
    const total = this.counts.reduce((a, b) => a + b, 0) || 1;
    const acc = (this.counts[0] + this.counts[1] * .7 + this.counts[2] * .4) / total;
    let rank = '-', stars = 0, reward;
    if (win) {
      rank = acc >= .95 ? 'S' : acc >= .88 ? 'A' : acc >= .75 ? 'B' : 'C';
      stars = rank === 'S' ? 3 : rank === 'A' ? 2 : 1;
      const first = rec.stars === 0;
      reward = s.reward * { S: 1.5, A: 1.25, B: 1, C: .8 }[rank] * st.dustMul * (s.boss ? st.bountyMul : 1) * (first ? 1.5 : 1);
      this.sound.play(SFX.CLEAR);
    } else {
      const progress = (this.wave + (1 - this.mon.hp / this.mon.max)) / s.waves.length;
      reward = s.reward * .25 * progress * st.dustMul;
      this.sound.play(SFX.HURT);
    }
    this.sound.stopLead();
    reward = Math.round(reward);
    const score = Math.round(this.score);
    const order = '-CBAS';
    const newBest = win && score > rec.best;
    Save.setStage(s.index, {
      stars: Math.max(rec.stars, stars),
      best: win ? Math.max(rec.best, score) : rec.best,
      rank: order.indexOf(rank) > order.indexOf(rec.rank) ? rank : rec.rank,
    });
    Save.d.dust += reward;
    Save.write();
    for (const n of this.notes) if (!n.state || n.state === 4) n.state = 3;   // 남은 노트는 판정하지 않음
    this.result = { win, rank, stars, reward, acc, score, newBest, t: 0 };
    this.phase = win ? 'win' : 'lose';
  }

  /** 심연의 탑 결과: 층을 깨면 다음 층으로, 쓰러지면 기록 */
  finishTower(win) {
    const s = this.stage, st = this.st;
    const total = this.counts.reduce((a, b) => a + b, 0) || 1;
    const acc = (this.counts[0] + this.counts[1] * .7 + this.counts[2] * .4) / total;
    const rank = acc >= .95 ? 'S' : acc >= .88 ? 'A' : acc >= .75 ? 'B' : 'C';
    const stars = win ? (rank === 'S' ? 3 : rank === 'A' ? 2 : 1) : 0;
    const progress = win ? 1 : (this.wave + (1 - this.mon.hp / this.mon.max)) / s.waves.length * .3;
    const reward = Math.round(s.reward * progress * { S: 1.5, A: 1.25, B: 1, C: .8 }[rank] * st.dustMul * (s.boss && win ? st.bountyMul : 1));
    const reached = win ? s.floor : s.floor - 1;
    const newBest = reached > (Save.d.towerBest || 0);
    if (newBest) Save.d.towerBest = reached;
    Save.d.dust += reward;
    Save.write();
    this.sound.play(win ? SFX.CLEAR : SFX.HURT);
    this.sound.stopLead();
    for (const n of this.notes) if (!n.state || n.state === 4) n.state = 3;
    this.result = { win, rank: win ? rank : '-', stars, reward, acc, score: Math.round(this.score), newBest, t: 0, tower: true, reached };
    this.phase = win ? 'win' : 'lose';
  }

  /* ------------------------------------------------------------ 갱신 */
  update(dt) {
    this.anim += dt;
    if (this.result) this.result.t += dt;
    if (this.paused) return;
    const snd = this.sound;
    const t = this.t = this.now();
    const m = this.mon;

    if (m.dieT < 0 && !this.result) {
      const look = (JUDGE_Y - LANE_TOP) / Save.d.speed + .4;
      while (snd.cond.secOfBeat(this.genBar * 4) < t + look) {
        for (const [s, lane, len] of Chart.notes(this.spec, this.genBar)) {
          const n = { time: snd.cond.secOfBeat(this.genBar * 4 + s / 4), lane, state: 0 };
          if (len) {
            n.hold = true;
            n.end = snd.cond.secOfBeat(this.genBar * 4 + (s + len) / 4);
            if (!Save.d.seenHold) { Save.d.seenHold = true; Save.write(); this.holdHintT = 5; }
          }
          this.notes.push(n);
        }
        this.genBar++;
      }
    }
    if (this.phase === 'intro' && t >= this.waveStart) this.phase = 'fight';

    if (this.app.autoplay) {
      for (const n of this.notes) if (!n.state && n.time <= t) { this.held[n.lane] = true; this.hit(n, 0, 0); }
      for (let i = 0; i < 4; i++) if (this.laneFlash[i] < .5 && !this.notes.some(n => n.state === 4 && n.lane === i)) this.held[i] = false;
    }
    for (const n of this.notes) {
      if (!n.state && t - n.time > this.windows[2]) this.miss(n);
      else if (n.state === 4) {
        // 누르고 있는 롱노트: 끝까지 버티면 성공, 그동안 불꽃이 튐
        if (t >= n.end) this.holdDone(n);
        else {
          this.laneFlash[n.lane] = Math.max(this.laneFlash[n.lane], .6);
          if (Math.random() < dt * 30) this.fx.burst(LANE_X0 + n.lane * LANE_W + LANE_W / 2, JUDGE_Y, LANE_COLORS[n.lane], 1, 260, .3);
        }
      }
    }
    for (let i = this.notes.length - 1; i >= 0; i--) {
      const n = this.notes[i];
      if (n.state === 2) n.missT += dt;
      if (n.state === 1 || n.state === 3 || (n.state === 2 && n.missT > .4)) this.notes.splice(i, 1);
    }

    const vdt = this.hitstop > 0 ? 0 : dt;
    this.hitstop = Math.max(0, this.hitstop - dt);
    const arrived = [];
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      b.t += vdt;
      if (b.t >= b.dur) { this.bolts.splice(i, 1); arrived.push(b); }
    }
    for (const b of arrived) this.damageMonster(b);   // 마지막 일격이면 남은 검기는 사라짐
    for (let i = this.claws.length - 1; i >= 0; i--) { this.claws[i].t += vdt; if (this.claws[i].t > .4) this.claws.splice(i, 1); }
    for (let i = this.slashes.length - 1; i >= 0; i--) { this.slashes[i].t += vdt; if (this.slashes[i].t > .2) this.slashes.splice(i, 1); }
    this.zoom = Math.max(0, this.zoom - dt * 3.5);
    this.scoreFlash = Math.max(0, this.scoreFlash - dt * 2.5);
    for (let i = this.souls.length - 1; i >= 0; i--) {
      const sl = this.souls[i];
      sl.t += dt;
      if (sl.t < 0) continue;
      if (sl.t < .5) {
        const d = Math.pow(.9, dt * 60);
        sl.vx *= d; sl.vy *= d;
        sl.x += sl.vx * dt; sl.y += sl.vy * dt;
      } else {
        const tx = 1190, ty = 44, dx = tx - sl.x, dy = ty - sl.y, dist = Math.hypot(dx, dy);
        const sp = 300 + (sl.t - .5) * 2600;
        if (dist < sp * dt + 10) {
          this.souls.splice(i, 1);
          this.scoreFlash = 1;
          this.fx.burst(tx, ty, '#c9b6ff', 4, 220, .3);
          continue;
        }
        sl.x += dx / dist * sp * dt; sl.y += dy / dist * sp * dt;
      }
    }
    if (this.holdHintT > 0) this.holdHintT -= dt;
    // 분노한 보스 주변에 붉은 불씨
    if (m.enraged && m.dieT < 0 && Math.random() < dt * 25) {
      this.fx.particle(MON_X + (Math.random() - .5) * 200, FLOOR - Math.random() * 40, (Math.random() - .5) * 20, -60 - Math.random() * 90,
        1 + Math.random(), 3, Math.random() < .5 ? '#ff3020' : P.ember, { add: true });
    }

    m.attackT += vdt; m.hurtT += vdt; m.spawnT += vdt;
    m.ghost += (m.hp - m.ghost) * Math.min(1, dt * 3.5);
    m.blinkAt -= dt;
    if (m.blinkAt < -.12) m.blinkAt = 2 + Math.random() * 3;
    this.pHurtT += vdt; this.pSlashT += vdt;
    this.pghost += (this.php - this.pghost) * Math.min(1, dt * 3);
    if (this.driveT > 0) this.driveT = Math.max(0, this.driveT - dt);
    for (let i = 0; i < 4; i++) this.laneFlash[i] = Math.max(0, this.laneFlash[i] - dt * 5);
    this.judgeT += dt;
    this.comboPop = Math.max(0, this.comboPop - dt * 8);
    this.shake = Math.max(0, this.shake - dt * 40);
    this.hurtFx = Math.max(0, this.hurtFx - dt * 3);
    if (this.banner) { this.banner.t += dt; if (this.banner.t > this.banner.life) this.banner = null; }

    if (m.dieT >= 0) {
      m.dieT += dt;
      if (m.dieT > 1.7 && !this.result) {
        if (this.wave + 1 < this.stage.waves.length) this.startWave(this.wave + 1);
        else this.finish(true);
      }
    }
    // 분위기: 1·3구역은 재가 떨어지고, 2구역은 불씨가 피어오름
    if (Math.random() < dt * 16) {
      if (this.stage.sector === 1) {
        this.fx.particle(AX + 10 + Math.random() * (AW - 20), FLOOR + 14, (Math.random() - .5) * 30, -40 - Math.random() * 70,
          3 + Math.random() * 2, Math.random() < .3 ? 3 : 2, [P.ember, P.orange, '#ffcf7a'][Math.floor(Math.random() * 3)], { add: true });
      } else {
        this.fx.particle(AX + 40 + Math.random() * (AW - 20), AY + 110, -8 - Math.random() * 14, 24 + Math.random() * 30,
          5 + Math.random() * 3, 2, Math.random() < .5 ? P.slate : P.silver);
      }
    }
    // 번개 (보스전과 2구역)
    if ((this.mon.k.boss || this.stage.sector === 1) && !this.result && this.mon.dieT < 0) {
      this.lightT -= dt;
      if (this.lightT <= 0) {
        this.lightT = 4 + Math.random() * 6;
        this.flash = Math.max(this.flash, .6);
        this.lightning = { x: AX + 80 + Math.random() * (AW - 160), t: 0, seed: Math.floor(Math.random() * 1e6) };
        this.sound.play(SFX.THUNDER);
      }
    }
    if (this.lightning) { this.lightning.t += dt; if (this.lightning.t > .28) this.lightning = null; }
    this.flash = Math.max(0, this.flash - dt * 3);
    if (this.driveT > 0 && Math.random() < dt * 14) {
      this.fx.particle(PILOT_X + (Math.random() - .5) * 60, FLOOR - Math.random() * 130, 0, -90, .6, 3, P.ember, { add: true });
    }
    this.fx.update(vdt);
  }

  /* ------------------------------------------------------------ 그리기 */
  render(ctx) {
    this.ui.begin();
    const t = this.t, beat = this.sound.cond.beatOfSec(t);
    ctx.imageSmoothingEnabled = false;
    ctx.save();
    if (this.shake > 0) ctx.translate((Math.random() - .5) * this.shake, (Math.random() - .5) * this.shake);
    if (this.zoom > 0) {
      const z = 1 + .045 * ease(this.zoom), fx = MON_X, fy = FLOOR - 150;
      ctx.translate(fx, fy); ctx.scale(z, z); ctx.translate(-fx, -fy);
    }
    ctx.drawImage(this.staticLayer(), 0, 0, W, H);
    this.drawHud(ctx);
    this.drawLanes(ctx, t, beat);
    this.drawArena(ctx, t, beat);
    this.fx.render(ctx);
    for (const sl of this.souls) {
      if (sl.t < 0) continue;
      glow(ctx, '#9a6cff', sl.x, sl.y, 24, 24, .9);
      glow(ctx, '#ffffff', sl.x, sl.y, 7, 7, 1);
    }
    ctx.restore();
    shine(ctx, LX + 24, LY, LW - 48, this.anim * .11);
    shine(ctx, AX + 24, AY, AW - 48, this.anim * .11 + .45);
    shine(ctx, 50, 14, 1180, this.anim * .07 + .2);
    if (this.hurtFx > 0) {
      ctx.globalAlpha = this.hurtFx * .6;
      const g = ctx.createRadialGradient(W / 2, H / 2, H * .3, W / 2, H / 2, W * .7);
      g.addColorStop(0, 'rgba(120,0,0,0)'); g.addColorStop(1, 'rgba(150,0,0,0.9)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
    if (this.driveT > 0) glow(ctx, P.ember, W / 2, H, W * .7, 200, .35 + .15 * Math.sin(beat * Math.PI * 2));
    this.drawBanner(ctx);
    if (this.paused) this.drawPause(ctx);
    if (this.result) this.drawResult(ctx);
  }

  drawHud(ctx) {
    const s = this.stage;
    const n = s.waves.length, gap = 60, x0 = 640 - (n - 1) * gap / 2;
    ctx.fillStyle = P.goldDark; ctx.fillRect(x0, 35, (n - 1) * gap, 2);
    for (let i = 0; i < n; i++) {
      const x = x0 + i * gap, boss = KINDS[s.waves[i].kind].boss;
      const done = i < this.wave || (i === this.wave && this.mon.dieT >= 0), cur = i === this.wave && !done;
      const r = boss ? 9 : 7;
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.moveTo(x, 36 - r - 2); ctx.lineTo(x + r + 2, 36); ctx.lineTo(x, 36 + r + 2); ctx.lineTo(x - r - 2, 36); ctx.fill();
      ctx.fillStyle = done ? (boss ? P.red : P.gold) : cur ? '#2a1a10' : '#141110';
      ctx.beginPath(); ctx.moveTo(x, 36 - r); ctx.lineTo(x + r, 36); ctx.lineTo(x, 36 + r); ctx.lineTo(x - r, 36); ctx.fill();
      ctx.strokeStyle = boss ? '#ff6a5a' : P.gold; ctx.lineWidth = 1.2; ctx.stroke();
      if (cur) glow(ctx, boss ? P.red : P.gold, x, 36, 22, 22, .6 + Math.sin(this.anim * 5) * .25);
    }
    text(ctx, `${Math.min(this.wave + 1, n)} / ${n} 차 전투`, 640, 64, 13, P.silver, 'center');
    const total = this.counts.reduce((a, b) => a + b, 0);
    const acc = total ? (this.counts[0] + this.counts[1] * .7 + this.counts[2] * .4) / total * 100 : 100;
    this.ui.button(ctx, 838, 26, 46, 30, 'Ⅱ', 'ghost', !this.result, () => { if (!this.paused) this.setPaused(true); });
    chip(ctx, 900, 26, 130, 30, P.gold);
    disp(ctx, acc.toFixed(2) + '%', 965, 47, 15, P.goldLight, 'center');
    if (this.scoreFlash > 0) glow(ctx, '#b48cff', 1180, 44, 90, 30, this.scoreFlash * .6);
    disp(ctx, comma(this.score), 1234, 53, 24, 'gold', 'right');
    text(ctx, '점수', 1234 - textW(ctx, comma(this.score), 24, true) - 12, 50, 13, P.silver, 'right');
  }

  drawLanes(ctx, t, beat) {
    const speed = Save.d.speed, drive = this.driveT > 0;
    ctx.save();
    ctx.beginPath(); ctx.rect(LANE_X0, LANE_TOP - 8, LANE_W * 4, JUDGE_Y + 90 - LANE_TOP); ctx.clip();
    // 박자 선
    const topBeat = this.sound.cond.beatOfSec(t + (JUDGE_Y - LANE_TOP) / speed);
    for (let b = Math.ceil(beat); b <= topBeat; b++) {
      const y = Math.round(JUDGE_Y - (this.sound.cond.secOfBeat(b) - t) * speed);
      ctx.fillStyle = b % 4 === 0 ? 'rgba(201,162,74,0.28)' : 'rgba(201,162,74,0.09)';
      ctx.fillRect(LANE_X0, y - 1, LANE_W * 4, b % 4 === 0 ? 2 : 1);
    }
    // 줄 뒤에서 흐르는 금빛 룬 문자
    if (Save.d.quality !== 'fast') {
      const rt = runeTexture(LANE_W * 4, 264), off = ((beat * 22) % 264 + 264) % 264;
      ctx.globalAlpha = .07;
      for (let yy = LANE_TOP - 8 - 264 + off; yy < JUDGE_Y + 90; yy += 264) ctx.drawImage(rt, LANE_X0, yy, LANE_W * 4, 264);
      ctx.globalAlpha = 1;
    }
    // 누르고 있는 줄의 빛기둥
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
      const a = Math.max(this.held[i] ? .5 : 0, this.laneFlash[i]);
      if (a <= 0) continue;
      const g = ctx.createLinearGradient(0, JUDGE_Y - 300, 0, JUDGE_Y);
      const col = drive ? P.ember : LANE_COLORS[i];
      g.addColorStop(0, rgba(col, 0)); g.addColorStop(1, rgba(col, .35 * a));
      ctx.fillStyle = g; ctx.fillRect(LANE_X0 + i * LANE_W + 2, JUDGE_Y - 300, LANE_W - 4, 300);
    }
    ctx.globalCompositeOperation = 'source-over';
    // 노트
    ctx.imageSmoothingEnabled = true;
    for (const n of this.notes) {
      let y = JUDGE_Y - (n.time - t) * speed;
      if (n.hold) {
        // 롱노트 몸통: 머리에서 꼬리까지 이어진 빛의 띠
        if (n.state === 4) y = JUDGE_Y;
        const ty = Math.max(LANE_TOP - 20, JUDGE_Y - (n.end - t) * speed);
        if (y < LANE_TOP - 30 || ty > JUDGE_Y + 70) continue;
        const cx = LANE_X0 + n.lane * LANE_W + LANE_W / 2, col = drive ? P.ember : LANE_COLORS[n.lane], bw = 30;
        const on = n.state === 4;
        ctx.globalAlpha = n.state === 2 ? Math.max(0, .35 - n.missT) : 1;
        ctx.fillStyle = '#000'; ctx.fillRect(cx - bw / 2 - 2, ty, bw + 4, y - ty);
        const g = ctx.createLinearGradient(cx - bw / 2, 0, cx + bw / 2, 0);
        g.addColorStop(0, mix(col, '#000000', on ? .2 : .55)); g.addColorStop(.5, on ? mix(col, '#ffffff', .35) : mix(col, '#000000', .2)); g.addColorStop(1, mix(col, '#000000', on ? .2 : .55));
        ctx.fillStyle = g; ctx.fillRect(cx - bw / 2, ty, bw, y - ty);
        ctx.fillStyle = P.gold; ctx.fillRect(cx - bw / 2 - 2, ty, 1.5, y - ty); ctx.fillRect(cx + bw / 2 + .5, ty, 1.5, y - ty);
        // 꼬리: 각진 금장 끝
        ctx.fillStyle = P.goldLight;
        ctx.beginPath(); ctx.moveTo(cx - bw / 2 - 4, ty + 8); ctx.lineTo(cx, ty - 6); ctx.lineTo(cx + bw / 2 + 4, ty + 8); ctx.lineTo(cx + bw / 2 + 4, ty + 12); ctx.lineTo(cx - bw / 2 - 4, ty + 12); ctx.fill();
        if (on) glow(ctx, col, cx, (ty + y) / 2, bw * 1.6, (y - ty) / 2 + 20, .35);
        ctx.globalAlpha = 1;
      }
      if (y < LANE_TOP - 30 || y > JUDGE_Y + 70) continue;
      const img = noteImg(n.lane, drive && n.state !== 2);
      const x = LANE_X0 + n.lane * LANE_W + LANE_W / 2 - img.width / 4;
      ctx.globalAlpha = n.state === 2 ? Math.max(0, .4 - n.missT) : clamp((y - LANE_TOP + 30) / 70, 0, 1);
      ctx.drawImage(img, x, y - img.height / 4, img.width / 2, img.height / 2);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // 판정선: 금 막대 + 보석 받침
    const pulse = Math.pow(1 - ((beat % 1) + 1) % 1, 4);
    glow(ctx, drive ? P.ember : P.gold, LANE_X0 + LANE_W * 2, JUDGE_Y, LANE_W * 2.3, 24, .25 + pulse * .35);
    ctx.fillStyle = '#000'; ctx.fillRect(LANE_X0 - 6, JUDGE_Y - 4, LANE_W * 4 + 12, 8);
    ctx.fillStyle = goldGrad(ctx, JUDGE_Y - 3, JUDGE_Y + 3); ctx.fillRect(LANE_X0 - 4, JUDGE_Y - 2.5, LANE_W * 4 + 8, 5);
    for (let i = 0; i < 4; i++) {
      const cx = LANE_X0 + i * LANE_W + LANE_W / 2, col = drive ? P.ember : LANE_COLORS[i];
      const f = this.laneFlash[i], down = this.held[i] || f > .5;
      // 보석 받침 (마름모)
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.moveTo(cx, JUDGE_Y - 15); ctx.lineTo(cx + 15, JUDGE_Y); ctx.lineTo(cx, JUDGE_Y + 15); ctx.lineTo(cx - 15, JUDGE_Y); ctx.fill();
      ctx.fillStyle = down ? col : mix(col, '#000000', .7);
      ctx.beginPath(); ctx.moveTo(cx, JUDGE_Y - 11); ctx.lineTo(cx + 11, JUDGE_Y); ctx.lineTo(cx, JUDGE_Y + 11); ctx.lineTo(cx - 11, JUDGE_Y); ctx.fill();
      ctx.strokeStyle = P.gold; ctx.lineWidth = 1.5; ctx.stroke();
      if (f > 0) glow(ctx, col, cx, JUDGE_Y, LANE_W * .7, 50 * (.5 + f), f);
      // 키 이름
      const ky = JUDGE_Y + 34;
      box(ctx, cx - 22, ky + (down ? 2 : 0), 44, 38, { fill: down ? mix(col, '#000000', .55) : '#0c0a09', border: down ? P.goldLight : P.goldDark, shadow: !down, t: 2, rivets: false });
      disp(ctx, KEY_LABEL[i], cx, ky + 27 + (down ? 2 : 0), 18, down ? '#ffffff' : P.goldLight, 'center');
    }

    const cx = LANE_X0 + LANE_W * 2;
    const rel = beat - this.firstBeat, counting = rel >= -4 && rel < 0 && this.mon.dieT < 0 && !this.cine;
    // 콤보
    if (this.combo >= 3 && !counting) {
      const sz = 54 + this.comboPop * 10;
      if (this.combo >= 50) glow(ctx, P.ember, cx, 290, 120, 50, .25);
      disp(ctx, String(this.combo), cx, 312, sz, 'gold', 'center', 3);
      disp(ctx, 'COMBO', cx, 338, 13, P.silver, 'center');
    }
    // 판정
    if (this.judgeT < .5) {
      const sz = this.judgeT < .06 ? 34 : 28, col = JUDGE_COLOR[this.judge];
      glow(ctx, col, cx, 440, 110, 30, .25 * (1 - this.judgeT * 2));
      disp(ctx, JUDGE[this.judge], cx, 452, sz, this.judge === 0 ? 'gold' : col, 'center', 2);
      if (this.judgeEL) text(ctx, this.judgeEL === 'EARLY' ? '빠름' : '느림', cx, 476, 13, this.judgeEL === 'EARLY' ? '#8fb3d6' : '#e09a6a', 'center');
    }
    // 카운트다운
    if (counting) {
      const n = Math.ceil(-rel), lab = { 4: 'III', 3: 'II', 2: 'I', 1: '전투!' }[n], fr = -rel - (n - 1);
      ctx.globalAlpha = Math.min(1, fr * 2.5);
      glow(ctx, n === 1 ? P.red : P.gold, cx, 230, 120, 70, .35);
      if (n === 1) text(ctx, lab, cx, 252, 60, '#ff7a5a', 'center', true, 800);
      else disp(ctx, lab, cx, 258, 76 + (1 - fr) * 10, 'gold', 'center', 4);
      ctx.globalAlpha = 1;
    }
    // 첫 판 안내
    const done = this.counts.reduce((a, b) => a + b, 0);
    if (this.tutorial && this.wave === 0 && done < 12 && this.mon.dieT < 0) {
      const a = .65 + .35 * Math.sin(this.anim * 5);
      ctx.globalAlpha = a;
      for (let i = 0; i < 4; i++) {
        const kx = LANE_X0 + i * LANE_W + LANE_W / 2;
        disp(ctx, KEY_LABEL[i], kx, JUDGE_Y - 40, 22, P.goldLight, 'center');
        ctx.fillStyle = P.goldLight;
        ctx.beginPath(); ctx.moveTo(kx - 7, JUDGE_Y - 32); ctx.lineTo(kx + 7, JUDGE_Y - 32); ctx.lineTo(kx, JUDGE_Y - 23); ctx.fill();
      }
      ctx.globalAlpha = 1;
      box(ctx, cx - 190, 500, 380, 40, { fill: 'rgba(10,8,6,0.9)', shadow: false, t: 2, rivets: false });
      text(ctx, '보석이 금색 선에 닿을 때 키를 누르세요!', cx, 526, 15, P.white, 'center');
    }
    if (this.holdHintT > 0) {
      ctx.globalAlpha = Math.min(1, this.holdHintT);
      box(ctx, cx - 200, 500, 400, 40, { fill: 'rgba(10,8,6,0.9)', border: P.ember, shadow: false, t: 2, rivets: false });
      text(ctx, '긴 노트는 끝까지 누르고 있다가 떼세요!', cx, 526, 15, '#ffcf9a', 'center');
      ctx.globalAlpha = 1;
    }
    // 각성 안내
    if (this.st.drive && this.drive >= 100 && this.driveT <= 0 && this.mon.dieT < 0) {
      ctx.globalAlpha = .6 + .4 * Math.sin(this.anim * 6);
      box(ctx, cx - 120, LANE_TOP + 4, 240, 34, { fill: '#3a1608', border: P.ember, shadow: false, t: 2, rivets: false });
      text(ctx, 'SPACE · 각성 준비 완료', cx, LANE_TOP + 27, 15, '#ffcf9a', 'center');
      ctx.globalAlpha = 1;
    } else if (this.driveT > 0) {
      text(ctx, '각  성', cx, LANE_TOP + 30, 22, '#ffb070', 'center', true, 800);
    }
  }

  drawArena(ctx, t, beat) {
    ctx.save();
    ctx.beginPath(); ctx.rect(AX + 4, AY + 4, AW - 8, AH - 8); ctx.clip();
    const fr = ((beat % 1) + 1) % 1;
    // 박자마다 땅을 울리는 빛
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 2; i++) {
      const k = (i + fr) / 2, y = HORIZON + Math.pow(k, 2.2) * (AY + AH - HORIZON);
      ctx.fillStyle = rgba(this.driveT > 0 ? P.ember : P.gold, .03 + k * .07);
      ctx.fillRect(AX, y, AW, 2);
    }
    ctx.globalCompositeOperation = 'source-over';
    // 번개
    if (this.lightning && Math.floor(this.lightning.t * 30) % 3 !== 2) {
      const r = rng(this.lightning.seed);
      let lx = this.lightning.x, ly = AY + 96;
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const pts = [[lx, ly]];
      while (ly < HORIZON + 10) { lx += (r() - .5) * 40; ly += 14 + r() * 12; pts.push([lx, ly]); }
      for (const [w, col] of [[10, 'rgba(160,190,255,0.25)'], [4, 'rgba(200,220,255,0.7)'], [1.5, '#ffffff']]) {
        ctx.strokeStyle = col; ctx.lineWidth = w;
        ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    const fogCol = THEMES[this.stage.sector].fog, fancy = Save.d.quality !== 'fast';
    drawScroll(ctx, fogTexture(AW - 8, 200, fogCol, 11), AX + 4, HORIZON - 130, AW - 8, 200, this.anim * 14, .55);
    BRAZIERS.forEach((bx, i) => brazierFire(ctx, bx, BRAZIER_Y, .9, this.anim + i * 1.7));
    // 젖은 돌바닥에 비친 모습
    const reflect = (img, x, y, w, h, a) => {
      ctx.save();
      ctx.beginPath(); ctx.rect(AX + 4, FLOOR + 2, AW - 8, AY + AH - 120 - FLOOR); ctx.clip();
      ctx.translate(0, FLOOR * 2 + 4); ctx.scale(1, -1);
      ctx.globalAlpha = a;
      ctx.drawImage(img, x, y, w, h);
      ctx.restore();
    };
    const m = this.mon, f = m.f, k = m.k, S = f.scale, size = k.size, D = f.res * S;
    // ----- 몬스터
    if (m.dieT < 0) {
      let img = f.idle[Math.floor(((beat / 2) % 1 + 1) % 1 * 8) % 8];
      let dx = 0, dy = Math.round(Math.sin(beat * Math.PI) * k.floaty) * 2;
      if (m.blinkAt < 0) img = f.blink;
      if (m.attackT < .5) {
        const q = m.attackT / .5;
        img = f.attack[Math.min(3, Math.floor(q * 4))];
        dx = -120 * Math.sin(Math.PI * clamp((q - .15) / .6, 0, 1));
      } else if (m.hurtT < .2) {
        img = m.hurtT < .07 ? f.hurtFlash : f.hurt;
        dx = 12 * (1 - m.hurtT / .2);
      }
      dx = Math.round(dx);
      const spawn = clamp(m.spawnT / .8, 0, 1);
      const x = MON_X - D / 2 + dx, y = FLOOR - f.base * S + dy - Math.round((1 - ease(spawn)) * 60);
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.beginPath(); ctx.ellipse(MON_X + dx * .6, FLOOR + 4, size * 1.7, 12, 0, 0, Math.PI * 2); ctx.fill();
      glow(ctx, k.boss ? '#ff2a1a' : '#a01818', MON_X + dx, FLOOR - D / 2, D * .62, D * .62, (k.boss ? .5 : .3) * spawn + Math.pow(1 - fr, 3) * .08);
      if (m.enraged) glow(ctx, '#ff1a00', MON_X + dx, FLOOR - D / 2, D * .8, D * .8, .35 + .25 * Math.sin(this.anim * 9));
      if (fancy) reflect(img, x, y, D, D, .2 * spawn);
      ctx.globalAlpha = spawn;
      ctx.drawImage(spawn < 1 && Math.floor(m.spawnT * 16) % 2 ? f.hurtFlash : img, x, y, D, D);
      ctx.globalAlpha = 1;
    }

    // ----- 기사
    const pf = Pilot.frames, PS = Pilot.SCALE;
    let pimg = pf.idle[Math.floor(((beat % 1) + 1) % 1 * 4) % 4], pdx = 0;
    if (this.pHurtT < .35) {
      pimg = this.pHurtT < .07 ? pf.hurtFlash : pf.hurt;
      pdx = -Math.round(16 * (1 - this.pHurtT / .35));
    } else if (this.pSlashT < .22) {
      pimg = pf.slash[Math.min(3, Math.floor(this.pSlashT / .22 * 4))];
      pdx = 6;
    }
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.beginPath(); ctx.ellipse(PILOT_X + pdx, FLOOR + 3, 46, 9, 0, 0, Math.PI * 2); ctx.fill();
    if (this.driveT > 0) glow(ctx, P.ember, PILOT_X + pdx, FLOOR - 70, 100, 110, .5 + Math.sin(this.anim * 12) * .15);
    if (fancy) reflect(pimg, PILOT_X - Pilot.CX * PS + pdx, FLOOR - Pilot.BASE * PS, Pilot.W * PS, Pilot.H * PS, .2);
    ctx.drawImage(pimg, PILOT_X - Pilot.CX * PS + pdx, FLOOR - Pilot.BASE * PS, Pilot.W * PS, Pilot.H * PS);
    // 검이 그리는 빛의 궤적
    if (this.pSlashT < .2) {
      const q = this.pSlashT / .2, cx = PILOT_X + 24, cy = FLOOR - 72, a1 = -2.3 + q * 2.8;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
      for (const [w, col] of [[11 * (1 - q), 'rgba(255,120,50,0.45)'], [4 * (1 - q), 'rgba(255,236,190,0.95)']]) {
        ctx.strokeStyle = col; ctx.lineWidth = Math.max(.5, w);
        ctx.beginPath(); ctx.arc(cx, cy, 58, a1 - 1.15, a1); ctx.stroke();
      }
      ctx.restore();
    }
    // 가까운 안개 (발치를 지나감)
    if (fancy) drawScroll(ctx, fogTexture(AW - 8, 120, fogCol, 23, .8), AX + 4, FLOOR - 70, AW - 8, 120, this.anim * 30, .32);

    // ----- 검기 (빛나는 꼬리)
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (const b of this.bolts) {
      const pos = q => {
        const u = clamp(q, 0, 1), iu = 1 - u;
        return [iu * iu * b.x0 + 2 * iu * u * b.cx + u * u * b.x1, iu * iu * b.y0 + 2 * iu * u * b.cy + u * u * b.y1];
      };
      const u = b.t / b.dur, w = b.crit ? 9 : 6;
      for (let i = 5; i >= 1; i--) {
        const [ax, ay] = pos(u - i * .06), [bx, by] = pos(u - (i - 1) * .06);
        ctx.strokeStyle = rgba(b.color, (1 - i / 6) * .85);
        ctx.lineWidth = w * (1 - i / 7);
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
      }
      const [hx, hy] = pos(u);
      glow(ctx, b.color, hx, hy, w * 4, w * 4, 1);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(hx, hy, w * .45, 0, Math.PI * 2); ctx.fill();
    }
    // ----- 검기가 남기는 초승달 베기 자국
    for (const sl of this.slashes) {
      const q = sl.t / .2, sweep = 1.8 * ease(q * 1.6);
      ctx.globalAlpha = 1 - q;
      for (const [w, col] of [[9, sl.color], [3, '#ffffff']]) {
        ctx.strokeStyle = col; ctx.lineWidth = w * (1 - q * .6);
        ctx.beginPath(); ctx.arc(sl.x, sl.y, sl.r, sl.a - sweep / 2, sl.a + sweep / 2); ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    // ----- 몬스터의 발톱 자국 (붉은 세 줄)
    for (const c of this.claws) {
      const q = c.t / .4, len = 110 * ease(q * 3);
      ctx.globalAlpha = 1 - q;
      for (let line = -1; line <= 1; line++) {
        ctx.strokeStyle = line ? '#ff3a2a' : '#ffd0c0';
        ctx.lineWidth = line ? 5 : 3;
        ctx.beginPath();
        ctx.moveTo(c.x + 44 + line * 18, c.y - 50);
        ctx.lineTo(c.x + 44 + line * 18 - len * .6, c.y - 50 + len * .8);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    ctx.globalCompositeOperation = 'source-over';
    if (this.flash > 0) {
      ctx.globalAlpha = this.flash * .3;
      ctx.fillStyle = '#fff4e0';
      ctx.fillRect(AX, AY, AW, AH);
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    // ----- 몬스터 이름과 체력
    const hx = AX + 106, hy = AY + 24;
    const [lh, lp] = this.labelLayer();
    ctx.drawImage(lh, AX + 16, AY + 14, AW - 32, 86);
    ctx.drawImage(lp, AX + 16, AY + AH - 118, AW - 32, 102);
    disp(ctx, `${comma(Math.max(0, Math.ceil(m.hp)))} / ${comma(m.max)}`, AX + AW - 34, hy + 22, 14, P.silver, 'right');
    bar(ctx, hx, hy + 36, AW - 140, 14, m.hp / m.max, m.hp < m.max * .25 ? '#e0402a' : '#a01414', m.ghost / m.max);

    // ----- 기사 상태
    const bx = AX + 34, by = AY + AH - 102;
    const low = this.php < this.st.maxHp * .3;
    disp(ctx, `${Math.ceil(this.php)} / ${this.st.maxHp}`, bx + 380, by + 19, 14, low && Math.floor(this.anim * 4) % 2 ? '#ff5a4a' : P.white, 'right');
    bar(ctx, bx, by + 28, 380, 14, this.php / this.st.maxHp, low ? '#e0402a' : '#b81c1c', this.pghost / this.st.maxHp);
    const dx0 = bx + 410, dw = AW - 68 - 410;
    if (this.st.drive) {
      const full = this.drive >= 100, r = this.driveT > 0 ? this.driveT / this.driveDur : this.drive / 100;
      bar(ctx, dx0, by + 28, dw, 14, r, full || this.driveT > 0 ? P.ember : '#2f5fa8');
      text(ctx, this.driveT > 0 ? '발동 중' : full ? 'SPACE!' : Math.floor(this.drive) + '%', dx0 + dw, by + 19, 14, full || this.driveT > 0 ? '#ffb070' : P.silver, 'right');
    } else {
      bar(ctx, dx0, by + 28, dw, 14, 0, '#2f5fa8');
      text(ctx, '각인에서 배워요', dx0 + dw / 2, by + 41, 12, '#5f564a', 'center', false);
    }
  }

  /** 몬스터 이름판 · 기사 상태 글자처럼 가끔만 바뀌는 것을 한 장으로 (바뀔 때만 다시 그림) */
  labelLayer() {
    const key = `${this.app.scale}|${this.wave}|${this.guardLeft}|${this.reviveLeft}`;
    if (this.labelKey === key) return this.labelImg;
    this.labelKey = key;
    const k = this.mon.k, sc = this.app.scale;
    // 몬스터 이름판 (전투 패널 위쪽만)
    const head = makeCanvas(AW - 32, 86, sc, g => {
      g.translate(-(AX + 16), -(AY + 14));
      // 초상화 메달
      const mx = AX + 62, my = AY + 56;
      glow(g, k.boss ? '#ff3020' : P.gold, mx, my, 50, 50, .25);
      g.save();
      g.beginPath(); g.arc(mx, my, 30, 0, Math.PI * 2);
      g.fillStyle = k.boss ? '#2a0606' : '#0e0a08'; g.fill(); g.clip();
      g.imageSmoothingEnabled = false;
      const pimg = this.mon.f.idle[0], psc = k.boss ? 2.2 : 2.6, pw = pimg.width * psc;
      g.drawImage(pimg, mx - pw / 2, my - 24, pw, pw);
      g.restore();
      g.lineWidth = 3; g.strokeStyle = k.boss ? P.red : P.gold;
      g.beginPath(); g.arc(mx, my, 30, 0, Math.PI * 2); g.stroke();
      g.lineWidth = 1; g.strokeStyle = P.goldDark;
      g.beginPath(); g.arc(mx, my, 34.5, 0, Math.PI * 2); g.stroke();
      const hx = AX + 106, hy = AY + 24;
      text(g, k.name, hx, hy + 24, 24, k.boss ? '#ff8a7a' : P.white, 'left', true, 800);
      const tag = k.boss ? 'BOSS' : `Lv.${this.stage.index * 2 + this.wave + 1}`;
      const tagx = hx + 12 + textW(g, k.name, 24), tw = textW(g, tag, 13, true) + 20;
      chip(g, tagx, hy + 6, tw, 22, k.boss ? P.red : P.gold);
      disp(g, tag, tagx + tw / 2, hy + 22, 13, k.boss ? '#ff8a7a' : P.goldLight, 'center');
      text(g, k.desc, hx, hy + 68, 14, P.silver, 'left');
    });
    // 기사 상태 (전투 패널 아래쪽만)
    const panel = makeCanvas(AW - 32, 102, sc, g => {
      g.translate(-(AX + 16), -(AY + AH - 118));
      const bx = AX + 34, by = AY + AH - 102, dx0 = bx + 410;
      icon(g, 'heart', bx + 8, by + 13, 2.4, '#d02a2a');
      text(g, '기사', bx + 24, by + 19, 15, P.goldLight, 'left', true, 800);
      text(g, '각성', dx0, by + 19, 15, this.st.drive ? '#ffb070' : '#4a4236', 'left', true, 800);
      const chips = [[`공격 x${this.st.atkMul.toFixed(1)}`, P.gold], [`치명 ${Math.round(this.st.critChance * 100)}%`, P.gold]];
      if (this.st.def) chips.push([`방어 ${Math.round(this.st.def * 100)}%`, '#6f8fb0']);
      if (this.st.guard) chips.push([`보호막 ${this.guardLeft}`, '#6f8fb0']);
      if (this.st.revive) chips.push([`부활 ${this.reviveLeft}`, P.ember]);
      let cx = bx;
      for (const [s, c] of chips) {
        const w = textW(g, s, 13) + 20;
        chip(g, cx, by + 56, w, 26, c);
        text(g, s, cx + w / 2, by + 74, 13, c, 'center', false);
        cx += w + 8;
      }
    });
    this.labelImg = [head, panel];
    return this.labelImg;
  }

  /** 장 시작 카드 · 웨이브 카드 · 보스 등장 연출 */
  drawBanner(ctx) {
    const b = this.banner;
    if (!b) return;
    const k = b.t / b.life, inA = ease(b.t / .4), out = k > .8 ? 1 - (k - .8) / .2 : 1;
    if (b.rage) {
      // 보스 분노: 붉은 섬광과 함께 화면 가득 글자
      ctx.globalAlpha = .35 * out * (1 - k * .5);
      ctx.fillStyle = '#5a0000'; ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = out;
      glow(ctx, '#ff2010', W / 2, H / 2 - 20, 560, 160, .5);
      const sz = 64 + (1 - ease(b.t / .3)) * 40;
      text(ctx, `분노한 ${b.name}!`, W / 2, H / 2 + 4, sz, '#ff8a6a', 'center', true, 800);
      ornLine(ctx, W / 2, H / 2 + 30, 320, '#ff4a2a');
      text(ctx, '노트가 빨라지고 공격이 강해집니다', W / 2, H / 2 + 66, 18, '#ffcfb8', 'center');
      ctx.globalAlpha = 1;
      return;
    }
    if (b.boss) {
      // 화면 위아래 검은 띠 + 어둠 + 붉은 빛 + 거대한 이름
      const bar = 90 * ease(b.t / .5) * out;
      ctx.globalAlpha = .55 * out;
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
      glow(ctx, '#ff2010', W / 2, H / 2, 620, 200, .45 * out);
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, bar); ctx.fillRect(0, H - bar, W, bar);
      ctx.fillStyle = P.red; ctx.fillRect(0, bar - 2, W, 2); ctx.fillRect(0, H - bar, W, 2);
      if (b.t > .35) {
        const a = clamp((b.t - .35) / .4, 0, 1) * out;
        ctx.globalAlpha = a;
        text(ctx, '— 보스 출현 —', W / 2, H / 2 - 70, 18, '#ff8a7a', 'center');
        const sz = 72 + (1 - ease((b.t - .35) / .5)) * 30;
        text(ctx, b.name, W / 2, H / 2 + 20, sz, '#ffe8d8', 'center', true, 800);
        ornLine(ctx, W / 2, H / 2 + 46, 300, '#ff5a3a');
        text(ctx, b.desc, W / 2, H / 2 + 82, 18, P.silver, 'center');
        ctx.globalAlpha = 1;
      }
      return;
    }
    // 보통: 가운데 금테 카드
    const cx = AX + AW / 2, y = AY + 236, w = 520 * inA;
    ctx.globalAlpha = out;
    const g = ctx.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(.2, 'rgba(0,0,0,0.82)'); g.addColorStop(.8, 'rgba(0,0,0,0.82)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(cx - w / 2, y - 56, w, 112);
    ornLine(ctx, cx, y - 52, w / 2); ornLine(ctx, cx, y + 52, w / 2);
    if (b.t > .2) {
      ctx.globalAlpha = out * clamp((b.t - .2) / .3, 0, 1);
      text(ctx, b.title, cx, y - 14, 16, P.goldLight, 'center');
      text(ctx, b.sub, cx, y + 28, 34, P.white, 'center', true, 800);
    }
    ctx.globalAlpha = 1;
  }

  drawPause(ctx) {
    ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fillRect(0, 0, W, H);
    const x = 440, y = 190, w = 400, h = 340;
    box(ctx, x, y, w, h, {});
    text(ctx, '일시 정지', 640, y + 70, 34, P.goldLight, 'center', true, 800);
    ornLine(ctx, 640, y + 94, 140);
    this.ui.button(ctx, x + 40, y + 130, w - 80, 48, '계속하기 (ESC)', 'primary', true, () => this.setPaused(false));
    this.ui.button(ctx, x + 40, y + 192, w - 80, 44, '처음부터 다시 (R)', 'ghost', true, () => this.retry());
    this.ui.button(ctx, x + 40, y + 250, w - 80, 44, '원정 지도로 (Q)', 'ghost', true, () => this.leave());
  }

  drawResult(ctx) {
    const r = this.result, k = ease(r.t / .5);
    ctx.fillStyle = `rgba(0,0,0,${.8 * k})`; ctx.fillRect(0, 0, W, H);
    if (r.t < .15) return;
    const x = 330, w = 620, h = 520, y = 100;
    // 승리의 빛줄기
    if (r.win) {
      ctx.save();
      ctx.translate(640, y + 70);
      ctx.rotate(this.anim * .15);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 14; i++) {
        ctx.rotate(Math.PI * 2 / 14);
        ctx.fillStyle = `rgba(255,200,110,${.07 * k})`;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-40, -520); ctx.lineTo(40, -520); ctx.fill();
      }
      ctx.restore();
    }
    box(ctx, x, y, w, h, { border: r.win ? P.gold : P.red });
    glow(ctx, r.win ? P.gold : P.red, 640, y + 62, 220, 50, .35);
    text(ctx, r.win ? '승  리' : '패  배', 640, y + 82, 54, r.win ? '#ffe2a0' : '#ff6a5a', 'center', true, 800);
    ornLine(ctx, 640, y + 104, 200, r.win ? P.gold : P.red);
    text(ctx, r.tower ? `심연의 탑 · ${r.reached}층까지 정복` + (r.newBest ? '  (최고 기록!)' : `  (최고 ${Save.d.towerBest}층)`)
      : `${this.stage.code} · ${this.stage.name}`, 640, y + 132, 15, r.tower && r.newBest ? P.goldLight : P.silver, 'center');

    const rx = x + 130, ry = y + 250;
    if (r.win) {
      if (r.t > .5) {
        // 랭크 인장
        const sc = r.t < .62 ? 1.3 : 1;
        ctx.save(); ctx.translate(rx, ry); ctx.scale(sc, sc);
        glow(ctx, rankColor(r.rank), 0, 0, 90, 90, .45);
        ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(0, 0, 58, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#2a0a0a'; ctx.beginPath(); ctx.arc(0, 0, 54, 0, Math.PI * 2); ctx.fill();
        ctx.lineWidth = 3; ctx.strokeStyle = P.gold; ctx.stroke();
        ctx.lineWidth = 1; ctx.strokeStyle = P.goldDark; ctx.beginPath(); ctx.arc(0, 0, 46, 0, Math.PI * 2); ctx.stroke();
        disp(ctx, r.rank, 0, 26, 76, r.rank === 'S' ? 'gold' : rankColor(r.rank), 'center', 3);
        ctx.restore();
      }
      for (let i = 0; i < 3; i++) {
        if (r.t < .9 + i * .2) continue;
        icon(ctx, 'star', rx - 44 + i * 44, ry + 92, r.t < 1 + i * .2 ? 5.5 : 4.2, i < r.stars ? P.yellow : '#2a2420');
      }
    } else {
      ctx.drawImage(Pilot.frames.hurt, rx - Pilot.W * 3.5, ry - Pilot.H * 4, Pilot.W * 7, Pilot.H * 7);
    }

    const sx = x + 280;
    [['점수', comma(r.score), 'gold'], ['정확도', (r.acc * 100).toFixed(2) + '%', P.white], ['최대 콤보', comma(this.maxCombo), P.white]].forEach(([n, v, c], i) => {
      const yy = y + 186 + i * 38;
      text(ctx, n, sx, yy, 16, P.silver);
      disp(ctx, v, x + w - 40, yy + 2, 22, c, 'right');
    });
    if (r.newBest) {
      ctx.globalAlpha = .6 + .4 * Math.sin(r.t * 6);
      chip(ctx, sx + 50, y + 168, 86, 24, P.gold);
      text(ctx, '최고 기록!', sx + 93, y + 185, 13, P.goldLight, 'center', false);
      ctx.globalAlpha = 1;
    }
    JUDGE.forEach((jn, i) => {
      const cw = (w - 320) / 4, cx = sx + i * cw;
      chip(ctx, cx, y + 296, cw - 8, 52, JUDGE_COLOR[i]);
      disp(ctx, jn, cx + (cw - 8) / 2, y + 314, 10, JUDGE_COLOR[i], 'center');
      disp(ctx, String(this.counts[i]), cx + (cw - 8) / 2, y + 339, 18, P.white, 'center');
    });

    if (r.t > 1.2) {
      box(ctx, x + 40, y + 366, w - 80, 52, { fill: '#120d08', border: P.gold, shadow: false, t: 2, rivets: false });
      icon(ctx, 'gem', x + 72, y + 392, 3, '#c96bff');
      text(ctx, '영혼석 획득', x + 96, y + 398, 17, P.white, 'left', true, 800);
      disp(ctx, '+' + comma(Math.round(r.reward * clamp((r.t - 1.2) / .8, 0, 1))), x + w - 64, y + 401, 26, 'gold', 'right');
    }
    if (r.t > .8) {
      const hasNext = this.hasNext();
      const bw = hasNext ? 176 : 262, by = y + h - 78;
      this.ui.button(ctx, x + 40, by, bw, 48, r.tower ? '1층부터 (R)' : '다시 도전 (R)', 'ghost', true, () => this.retry());
      this.ui.button(ctx, x + 40 + bw + 12, by, bw, 48, '원정 지도 (Enter)', hasNext ? 'ghost' : 'primary', true, () => this.leave());
      if (hasNext) this.ui.button(ctx, x + 40 + (bw + 12) * 2, by, bw, 48, r.tower ? `${this.stage.floor + 1}층으로 (N)` : '다음 전투 (N)', 'primary', true, () => this.nextStage());
    }
  }
}
