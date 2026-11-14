'use strict';
// =============================================================
//  게임 흐름: 화면 상태, 전투 진행, 충돌 판정, 그리기
// =============================================================

const Game = {
  state: 'loading',        // loading / title / help / select / fight / pause / result
  canvas: null, ctx: null, buf: null, bctx: null, S: 1, B: 1,
  bossIndex: 0, stage: null, player: null, boss: null,
  hazards: [], minions: [],
  camX: 0, hitstop: 0, slowT: 0, slowK: 1,
  mods: null, stats: null, fightT: 0, endT: -1, outcome: null,
  debug: false, menuT: 0, vignette: null,

  targets() {
    const t = [];
    if (this.boss && !this.boss.dead && !this.boss.hidden) t.push(this.boss);
    for (const m of this.minions) if (!m.dead) t.push(m);
    return t;
  },
  addHazard(h) { this.hazards.push(h); return h; },
  slow(k, t) { this.slowK = k; this.slowT = t; },

  // ---------- 전투 시작 ----------
  startFight(i) {
    Sfx.init();
    this.bossIndex = i;
    const info = BOSS_LIST[i];
    FX.reset();
    this.mods = computeMods(Save.data.perks);
    this.stage = buildStage(info.stage);
    this.hazards = []; this.minions = [];
    this.stats = { dealt: 0 };
    this.player = new Player(this);
    this.boss = new info.cls(this);
    this.camX = 0;
    this.hitstop = 0; this.slowT = 0;
    this.fightT = 0; this.endT = -1; this.outcome = null;
    UI.clearResultExtras();
    UI.show(null);
    UI.hud(true);
    UI.initHud(this.boss, this.player);
    UI.banner(T(info.name), T(info.sub) + ' · ' + T(this.stage.def.name));
    Input.clear();
    this.state = 'fight';
  },

  onPlayerDeath() {
    if (this.outcome) return;
    this.outcome = 'lose';
    this.endT = 2.8;
    Sfx.defeat();
    this.slow(0.3, 1.2);
  },
  onBossDeath() {
    if (this.outcome) return;
    this.outcome = 'win';
    this.endT = this.boss instanceof SpikedDragon ? 5.0 : 3.6;
    this.player.invuln = 99;
    setTimeout(() => Sfx.victory(), 900);
  },

  finish() {
    const win = this.outcome === 'win';
    const i = this.bossIndex;
    const p = this.player;
    let choices = null;
    if (win) {
      const first = !Save.data.cleared[i];
      Save.data.cleared[i] = true;
      if (!Save.data.best[i] || this.fightT < Save.data.best[i]) Save.data.best[i] = this.fightT;
      if (first) {
        const pool = BLESSINGS.filter(b => !Save.data.perks.includes(b.id));
        choices = [];
        while (choices.length < 3 && pool.length) choices.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
      }
      Save.write();
    }
    this.state = 'result';
    UI.hud(false);
    UI.result(win, {
      name: BOSS_LIST[i].name,
      time: this.fightT, parries: p.stats.parries, taken: p.stats.taken, potions: p.stats.potions,
      bossLeft: this.boss.hp / this.boss.maxHp,
      hasNext: i < BOSS_LIST.length - 1,
      allClear: win && Save.data.cleared.every(Boolean) && i === BOSS_LIST.length - 1,
      choices,
    }, {
      bless: id => { Save.data.perks.push(id); Save.write(); },
    });
  },

  // ---------- 한 걸음 진행 ----------
  step(dt) {
    this.fightT += this.outcome ? 0 : dt;
    this.player.update(dt);
    this.boss.update(dt);
    for (const m of this.minions) m.update(dt);
    this.minions = this.minions.filter(m => !m.dead);
    for (const h of this.hazards) h.update(dt, this);
    this.resolve();
    this.hazards = this.hazards.filter(h => !h.dead);
    if (this.stage.def.ambient) this.stage.def.ambient(this, dt);
  },

  // 공격이 닿았는지 확인
  resolve() {
    const p = this.player;
    const pb = p.hurtbox();
    for (const hz of this.hazards) {
      if (!hz.active || hz.harmless) continue;
      const r = hz.rect();
      if (hz.friendly) {
        // 기사의 검기는 날아오는 탄(패링 가능한 것)을 베어 없애요
        if (hz.cuts) {
          for (const e of this.hazards) {
            if (e.friendly || !e.projectile || !e.parryable || !e.active || !overlap(r, e.rect())) continue;
            e.end(this);
            FX.add(new ImpactFx(e.x, e.y, 26, '#ffffff', 0.12));
            Sfx.clink();
          }
        }
        // 되돌아간 탄·검기 → 보스나 졸개를 맞혀요
        for (const t of this.targets()) {
          if (overlap(r, t.hurtbox())) {
            const crit = hz.reflected || hz.big;
            const posture = hz.kind === 'wave' ? hz.posture : 22;
            if (t.takeHit(hz.dmg * this.mods.atkMul, { posture: posture * this.mods.postureMul, crit, dir: Math.sign(hz.vx) || 1, big: true })) {
              hitFx(this, hz.x, hz.y, Math.sign(hz.vx) || 1, true, crit);
              if (hz.reflected) p.gainEnergy(0.25);
            }
            hz.end(this);
            break;
          }
        }
        continue;
      }
      if (hz.hitPlayer || p.state === 'dead' || !overlap(r, pb)) continue;
      if (hz.parryable && p.parrying) {
        this.parry(hz);
      } else if (p.invuln <= 0) {
        const dir = Math.sign(p.x - (hz.follow ? hz.follow.x : hz.x)) || 1;
        p.hurt(hz.dmg, dir, hz.kb);
        hz.hitPlayer = true;
        if (hz.onHit) hz.onHit(hz, this);
        if (hz.projectile && hz.kind !== 'meteor') hz.end(this);
      }
    }
  },

  parry(hz) {
    const p = this.player;
    const perfect = p.stateT < 0.07 && !p.parried;     // 누르고 아주 짧은 순간에 막았어요
    p.onParry(hz);
    const px = p.x + p.facing * 14, py = p.y - 26;
    Sfx.parry();
    // 쨍! — 별빛, 빛살, 충격파, 불티, 집중선, 순간 확대
    FX.add(new ImpactFx(px, py, 62, '#ffe680', 0.2, 4, 0));
    FX.add(new ImpactFx(px, py, 40, '#ffffff', 0.15, 4, Math.PI / 4));
    FX.add(new RaysFx(px, py, 14, 120, '#ffd25a', 0.4, 0.045));
    FX.add(new ShockFx(px, py, 4, 76, 'rgba(255,230,140,0.85)', 0.38, 9));
    FX.add(new RingFx(px, py, 4, 54, '#ffffff', 0.3, 3));
    FX.add(new GlowFx(px, py, 80, 'rgba(255,230,140,0.95)', 0.3));
    FX.add(new SpeedLinesFx('rgba(255,250,220,0.9)', 0.32, 40));
    FX.sparks(px, py, 34, { color: ['#ffffff', '#ffe680', '#ffd25a', '#9ff4ff'], min: 180, max: 600, grav: 300, life: 0.45 });
    for (let i = 0; i < 10; i++) FX.add(new StreakFx(px, py, (i / 10) * TAU + rand(-0.2, 0.2), rand(30, 60), '#ffffff', 0.2, 2.5));
    FX.text(px, py - 32, T(perfect ? '완벽!' : '패링!'), { color: perfect ? '#fff6c0' : '#ffe680', size: perfect ? 17 : 14, bold: true, life: 0.8 });
    FX.kick(-p.facing * 5, 0);
    if (perfect) {
      FX.add(new RaysFx(px, py, 22, 190, '#fff2b0', 0.55, 0.035));
      FX.add(new ShockFx(px, py, 4, 120, 'rgba(255,240,180,0.9)', 0.5, 12));
      FX.impact(0.035);
      Sfx.parry(); Sfx.clink();
      p.gainEnergy(0.25);
      this.slow(0.25, 0.4);
    }
    FX.flash('#fff2c0', 0.06);
    FX.shake(4, 0.14);
    FX.punch(0.07, 0.24, px, py);
    FX.chroma(3);
    for (let i = 0; i < 5; i++) {
      const a = rand(0, TAU), L = rand(40, 80);
      FX.add(new LightningFx(px, py, px + Math.cos(a) * L, py + Math.sin(a) * L, '#ffe680', 0.2, 6, 7, 1.3));
    }
    FX.add(new CutFx(px, py, rand(-0.4, 0.4), 160, '#ffe680', 0.22, 2.5));
    this.hitstop = Math.max(this.hitstop, 0.12);
    this.slow(0.4, 0.25);

    if (this.boss && hz.posture) this.boss.addPosture(hz.posture * this.mods.postureMul * (perfect ? 1.5 : 1));
    if (hz.onParry) hz.onParry(hz, this);

    if (hz.projectile) {
      // 탄을 보스에게 되돌려 보내요
      hz.friendly = true; hz.reflected = true; hz.grav = 0; hz.floorDie = false;
      const b = this.boss;
      const tx = b && !b.dead && !b.hidden ? b.x + b.hox * b.facing : hz.x - Math.sign(hz.vx || 1) * 300;
      const ty = b && !b.dead && !b.hidden ? b.y - b.hoy - b.hh / 2 : hz.y;
      const a = Math.atan2(ty - hz.y, tx - hz.x);
      const sp = Math.max(340, Math.hypot(hz.vx, hz.vy) * 1.4);
      hz.vx = Math.cos(a) * sp; hz.vy = Math.sin(a) * sp;
      hz.dmg = hz.dmg + 14;
      hz.life = hz.t - hz.delay + 2.5;
    } else {
      hz.hitPlayer = true;
      hz.dead = true;
    }
  },

  updateCamera(dt) {
    const p = this.player, b = this.boss;
    let target = p.x - W / 2;
    if (b && !b.dead && !b.hidden) target = (p.x + b.x) / 2 - W / 2;
    target = clamp(target, p.x - W + 70, p.x - 70);
    target = clamp(target, 0, ARENA_W - W);
    this.camX = lerp(this.camX, target, Math.min(1, dt * 5));
  },

  // ---------- 매 화면 ----------
  frame(realDt) {
    if (Input.hit('mute')) { const m = Sfx.toggleMute(); FX.text(this.camX + W / 2, 40, T(m ? '소리 끔' : '소리 켬'), { size: 9 }); }
    if (Input.hit('pause')) {
      if (this.state === 'fight' && !this.outcome) { this.state = 'pause'; UI.show('pause'); }
      else if (this.state === 'pause') this.resume();
      else if (this.state === 'help' || this.state === 'select') { this.state = 'title'; UI.show('title'); }
    }

    if (this.state === 'fight') {
      this.player.readInput();
      if (this.hitstop > 0) this.hitstop -= realDt;
      else {
        let dt = realDt;
        if (this.slowT > 0) { this.slowT -= realDt; dt *= this.slowK; }
        const n = Math.max(1, Math.ceil(dt / (1 / 60)));
        for (let i = 0; i < n; i++) this.step(dt / n);
        FX.update(dt);
        this.updateCamera(dt);
      }
      if (this.endT > 0) { this.endT -= realDt; if (this.endT <= 0) this.finish(); }
      UI.updateHud(this.player, this.boss);
    } else if (this.state !== 'pause' && this.state !== 'loading') {
      // 메뉴 화면 뒤에서 배경이 천천히 흘러가요
      this.menuT += realDt;
      if (!this.stage) this.stage = buildStage(0);
      this.camX = (Math.sin(this.menuT * 0.08) * 0.5 + 0.5) * (ARENA_W - W);
      if (this.stage.def.ambient) this.stage.def.ambient(this, realDt);
      FX.update(realDt);
    }
    this.render();
    Input.endFrame();
  },

  resume() { this.state = 'fight'; UI.show(null); Input.clear(); },
  goSelect() {
    this.state = 'select';
    UI.hud(false);
    UI.buildSelect(i => this.startFight(i));
    UI.show('select');
  },

  // ---------- 그리기 ----------
  render() {
    const c = this.bctx;
    c.setTransform(RES, 0, 0, RES, 0, 0);        // 세계 단위 1 = 화면 2픽셀
    c.imageSmoothingEnabled = false;
    c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
    let sx = 0, sy = 0;
    const cam = snap(this.camX);
    const z = FX.zoom, zx = FX.zoomX - cam, zy = FX.zoomY;
    FX.camX = cam;
    if (this.stage) {
      if (FX.shakeA > 0) { sx = snap(rand(-1, 1) * FX.shakeA); sy = snap(rand(-1, 1) * FX.shakeA * 0.6); }
      sx += snap(FX.kickX); sy += snap(FX.kickY);
      c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
      c.save();
      c.translate(sx, sy);
      if (z > 1.0005) { c.translate(zx, zy); c.scale(z, z); c.translate(-zx, -zy); }
      drawStageBack(c, this.stage, cam);
      c.translate(-cam, 0);
      FX.drawBack(c);
      // 빛나는 공격이 땅을 비춰요
      for (const h of this.hazards) {
        if (h.light && !h.dead && h.t >= h.delay) groundLight(c, h.x, h.light, 0.9 * (1 - clamp((GROUND - h.y) / 160, 0, 1)), h.lightW || 50);
      }
      const inFight = this.state === 'fight' || this.state === 'pause' || this.state === 'result';
      if (inFight && this.boss) {
        this.boss.draw(c);
        for (const m of this.minions) m.draw(c);
        for (const h of this.hazards) if (h.kind === 'erupt') h.render(c);
        this.player.draw(c);
        for (const h of this.hazards) if (h.kind !== 'erupt') h.render(c);
        if (this.debug) for (const h of this.hazards) { const r = h.rect(); c.strokeStyle = h.parryable ? '#ff0' : '#f00'; if (h.active) c.strokeRect(r.x, r.y, r.w, r.h); }
      } else {
        // 메뉴 화면: 기사가 서 있어요
        const kx = cam + W * 0.32;
        drawSprite(c, 'knight', 'idle', Math.floor(this.menuT * 10) % 10, kx, GROUND, 2, 1);
      }
      FX.draw(c);
      c.translate(cam, 0);
      drawStageFront(c, this.stage, cam);     // 캐릭터 앞 어두운 실루엣
      c.restore();
      // 전투장마다 색감 입히기
      if (this.stage.def.grade) {
        c.save();
        c.globalCompositeOperation = 'overlay';
        c.globalAlpha = 0.28;
        c.fillStyle = this.stage.def.grade;
        c.fillRect(0, 0, W, H);
        c.restore();
      }
      c.drawImage(this.vignette, 0, 0, W, H);
      // 체력이 적으면 화면 가장자리가 붉게 뛰어요
      if (inFight && this.player && this.player.hp > 0 && this.player.hp < this.player.maxHp * 0.3) {
        c.save();
        c.globalAlpha = 0.35 + 0.25 * Math.sin(performance.now() / 150);
        c.drawImage(this.redVignette, 0, 0, W, H);
        c.restore();
      }
      FX.drawFlash(c);
    } else {
      c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
    }

    const ctx = this.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    const cw = this.canvas.width, ch = this.canvas.height;
    ctx.drawImage(this.buf, 0, 0, cw, ch);
    this.postFx(ctx, cw, ch);
    const B = this.B;
    FX.drawTexts(ctx, (x, y) => {
      const bx = zx + (x - cam - zx) * z, by = zy + (y - zy) * z;
      return { x: (bx + sx) * B, y: (by + sy) * B };
    }, B);
  },

  // ---------- 화면 후처리 ----------
  postFx(ctx, cw, ch) {
    const q = this.q;
    ctx.save();
    // 1) 빛 번짐(블룸): 작게 줄인 화면에서 밝은 곳만 뽑아 흐리게 한 뒤 위에 더해요
    //    (큰 화면에 바로 필터를 걸면 느려서, 먼저 1/4 크기로 줄여요)
    if (this.bloomOn && q >= 1 && this.stage) {
      const sm = this.smallCtx, b = this.bloomCtx;
      sm.globalCompositeOperation = 'source-over';
      sm.drawImage(this.buf, 0, 0, this.small.width, this.small.height);
      b.clearRect(0, 0, this.bloom.width, this.bloom.height);
      b.filter = 'brightness(0.72) contrast(2.6) saturate(1.5) blur(3px)';
      b.drawImage(this.small, 0, 0);
      b.filter = 'none';
      ctx.imageSmoothingEnabled = true;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.45;
      ctx.drawImage(this.bloom, 0, 0, cw, ch);
      ctx.imageSmoothingEnabled = false;
    }
    // 2) 색 갈라짐: 큰 타격 순간 빨강·파랑이 옆으로 번져요 (필터 없이 색 곱하기로)
    if (q >= 1 && FX.chromaA > 0) {
      const o = FX.chromaA * this.B * 0.6;
      for (const [cv, col] of [[this.tintR, '#ff2a2a'], [this.tintC, '#2ad8ff']]) {
        const g = cv.getContext('2d');
        g.globalCompositeOperation = 'source-over';
        g.drawImage(this.buf, 0, 0, cv.width, cv.height);
        g.globalCompositeOperation = 'multiply';
        g.fillStyle = col;
        g.fillRect(0, 0, cv.width, cv.height);
      }
      ctx.imageSmoothingEnabled = true;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.min(0.4, FX.chromaA * 0.09);
      ctx.drawImage(this.tintR, -o, 0, cw, ch);
      ctx.drawImage(this.tintC, o, 0, cw, ch);
      ctx.imageSmoothingEnabled = false;
    }
    // 3) 임팩트 프레임: 아주 짧게 흑백이 뒤집혀요 (색 섞기 모드라 가벼워요)
    if (FX.impactT > 0) {
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'saturation';
      ctx.fillStyle = '#808080';
      ctx.fillRect(0, 0, cw, ch);
      ctx.globalCompositeOperation = 'difference';
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, cw, ch);
    }
    // 4) 필름 입자 (가장 좋은 품질에서만)
    if (this.grain && q >= 2) {
      ctx.globalCompositeOperation = 'overlay';
      ctx.globalAlpha = 0.07;
      ctx.translate(-randi(0, 127), -randi(0, 127));
      ctx.fillStyle = this.grain;
      ctx.fillRect(0, 0, cw + 128, ch + 128);
    }
    ctx.restore();
  },

  // 렉 자동 조절: 한동안 느리면 품질을 한 단계 내리고, 오래 빠르면 다시 올려요
  //  2 = 모든 효과, 1 = 필름 입자 끄고 파티클 70%, 0 = 빛 번짐·색 갈라짐 끄고 파티클 45%
  autoQuality(raw) {
    this.ft = this.ft ? lerp(this.ft, raw, 0.05) : raw;
    if (this.state !== 'fight') return;
    if (this.ft > 1 / 42) { this.slowFor += raw; this.fastFor = 0; }
    else if (this.ft < 1 / 56) { this.fastFor += raw; this.slowFor = 0; }
    if (this.slowFor > 1.5 && this.q > 0) { this.q--; this.slowFor = 0; }
    if (this.fastFor > 8 && this.q < 2) { this.q++; this.fastFor = 0; }
    FX.quality = [0.45, 0.7, 1][this.q];
  },

  makeGrain() {
    const g = document.createElement('canvas');
    g.width = g.height = 128;
    const gc = g.getContext('2d');
    const img = gc.createImageData(128, 128);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
    }
    gc.putImageData(img, 0, 0);
    return this.ctx.createPattern(g, 'repeat');
  },

  makeVignette(color, inner) {
    const v = document.createElement('canvas');
    v.width = W; v.height = H;
    const g = v.getContext('2d');
    const gr = g.createRadialGradient(W / 2, H / 2, H * inner, W / 2, H / 2, W * 0.62);
    gr.addColorStop(0, 'rgba(0,0,0,0)');
    gr.addColorStop(1, color);
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    return v;
  },

  resize() {
    const s = Math.min(window.innerWidth / W, window.innerHeight / H);
    this.S = s >= 1 ? Math.max(1, Math.floor(s * 4) / 4) : s;
    document.documentElement.style.setProperty('--s', this.S);
    this.B = this.S * (window.devicePixelRatio || 1);
    this.canvas.width = Math.round(W * this.B);
    this.canvas.height = Math.round(H * this.B);
  },

  init() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    this.buf = document.createElement('canvas');
    this.buf.width = W * RES; this.buf.height = H * RES;    // 1280×720
    this.bctx = this.buf.getContext('2d');
    this.vignette = this.makeVignette('rgba(0,0,0,0.6)', 0.35);
    // 블룸용 작은 캔버스 (브라우저가 filter 를 지원할 때만 써요)
    this.q = 2; this.slowFor = 0; this.fastFor = 0;
    this.small = document.createElement('canvas');
    this.small.width = W / 2; this.small.height = H / 2;
    this.smallCtx = this.small.getContext('2d');
    this.tintR = document.createElement('canvas');
    this.tintC = document.createElement('canvas');
    this.tintR.width = this.tintC.width = W; this.tintR.height = this.tintC.height = H;
    this.bloom = document.createElement('canvas');
    this.bloom.width = W / 2; this.bloom.height = H / 2;
    this.bloomCtx = this.bloom.getContext('2d');
    this.bloomCtx.filter = 'blur(2px)';
    this.bloomOn = this.bloomCtx.filter === 'blur(2px)';
    this.bloomCtx.filter = 'none';
    this.grain = this.makeGrain();
    this.redVignette = this.makeVignette('rgba(200,0,20,0.9)', 0.4);
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('keydown', () => Sfx.init());
    window.addEventListener('pointerdown', () => Sfx.init());
    window.addEventListener('keydown', e => { if (e.code === 'Backquote') this.debug = !this.debug; });
    window.addEventListener('blur', () => { if (this.state === 'fight' && !this.outcome) { this.state = 'pause'; UI.show('pause'); } });

    Save.load();
    // 언어: 저장된 것 → 없으면 브라우저 언어. 시작 화면 오른쪽 위 버튼으로 바꿔요
    I18N.init();
    I18N.applyDom();
    document.querySelectorAll('[data-lang]').forEach(b => b.addEventListener('click', () => {
      Sfx.init(); Sfx.click();
      I18N.set(b.dataset.lang);
      UI.relabel();
    }));
    UI.initNav();
    UI.initEmbers();

    // 버튼 연결
    document.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => {
      Sfx.init(); Sfx.click();
      const go = b.dataset.go;
      if (go === 'select') this.goSelect();
      else { this.state = go; UI.show(go); }
    }));
    UI.$('btn-resume').addEventListener('click', () => this.resume());
    UI.$('btn-retry').addEventListener('click', () => this.startFight(this.bossIndex));
    UI.$('btn-quit').addEventListener('click', () => this.goSelect());
    UI.$('btn-again').addEventListener('click', () => this.startFight(this.bossIndex));
    UI.$('btn-next').addEventListener('click', () => this.startFight(Math.min(this.bossIndex + 1, BOSS_LIST.length - 1)));
    UI.$('btn-select').addEventListener('click', () => this.goSelect());
    UI.$('btn-reset').addEventListener('click', () => {
      if (confirm(T('처치 기록과 축복을 모두 지울까요?'))) { Save.reset(); this.goSelect(); }
    });

    let last = performance.now();
    const loop = now => {
      const raw = (now - last) / 1000;
      const dt = Math.min(0.05, raw);
      last = now;
      this.autoQuality(Math.min(0.2, raw));
      this.frame(dt);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);

    loadAssets(p => { UI.$('load-pct').textContent = Math.round(p * 100); })
      .then(() => { this.state = 'title'; UI.show('title'); })
      .catch(err => {
        UI.$('screen-loading').innerHTML = '<p>' + err.message + '</p><p>' + T('assets/images 폴더가 index.html 옆에 있는지 확인해 주세요.') + '</p>';
      });
  },
};

window.addEventListener('load', () => Game.init());
