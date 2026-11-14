'use strict';
// =============================================================
//  보스 5마리와 스킬
//  (노란 빛 = 패링 가능 / 붉은 빛 = 피하기)
// =============================================================

// 세 줄 할퀴기 자국
function clawFx(x, y, facing, color = '#ff6a6a', r = 40) {
  for (let k = 0; k < 3; k++) {
    FX.add(new SlashFx(x - facing * k * 8, y + k * 8, r, mirrorA(-1.3, facing), mirrorA(0.9, facing),
      { life: 0.26, thick: 7, edge: color, glow: 'rgba(255,40,40,0.55)', core: '#fff0f0' }));
  }
  FX.sparks(x + facing * 20, y + 10, 10, { angle: facing > 0 ? 0.3 : Math.PI - 0.3, spread: 1.2, color: [color, '#ffffff'], min: 120, max: 300 });
  FX.add(new GlowFx(x + facing * 10, y + 10, 40, 'rgba(255,60,60,0.5)', 0.2));
  for (let k = 0; k < 3; k++) FX.add(new CutFx(x + facing * 6 - facing * k * 8, y + k * 9, facing * 0.75, 80, color, 0.2, 1.8));
}

// 땅을 내려찍는 큰 충격 (먼지, 충격파, 갈라짐)
function slamFx(x, color, size = 1) {
  FX.explode(x, GROUND - 4, 30 * size, [color, '#ffffff'], { squash: 0.35, smokeColor: 'rgba(60,50,40,0.5)' });
  FX.add(new ShockFx(x, GROUND, 6, 150 * size, color, 0.5, 12, 0.22));
  FX.add(new ScorchFx(x, 110 * size, 'rgba(0,0,0,0.45)', 2.5, null), true);
  FX.add(new CrackFx(x, 160 * size, color, 2.8), true);
  FX.add(new CrackFx(x, 100 * size, '#ffffff', 2.0), true);
  FX.chroma(1.5 * size);
  FX.burst(x, GROUND - 2, Math.round(24 * size), { angle: -Math.PI / 2, spread: 2.2, color: ['#5a4a3a', '#2a2018', '#8a7a60'], glow: false, min: 100, max: 360, grav: 800, life: 1, size: 4 });
  FX.smoke(x - 40 * size, GROUND - 6, 4, { color: 'rgba(80,70,60,0.4)', size: 10, grow: 30, vx: -60 });
  FX.smoke(x + 40 * size, GROUND - 6, 4, { color: 'rgba(80,70,60,0.4)', size: 10, grow: 30, vx: 60 });
}

function dust(x, n = 8, color = ['#6a5a48', '#9a8a70']) {
  FX.burst(x, GROUND - 2, n, { angle: -Math.PI / 2, spread: 2.4, color, glow: false, min: 30, max: 120, grav: 300, life: 0.6 });
}

// 하늘에서 떨어지는 가시 (붉은 경고 후 떨어짐)
function spikeDrop(boss, x, warn) {
  FX.add(new GroundWarnFx(x, 22, warn, '#ff3030'), true);
  FX.add(new PathFx([[x, 0], [x, GROUND - 4]], warn, 'danger', null, 1));
  boss.spawn(Haz.shot('shard', x, -20, 0, (GROUND + 20) / warn, {
    floorDie: true, parryable: false, dmg: 15, life: warn + 0.5,
    onEnd: h => { FX.burst(h.x, GROUND - 2, 8, { angle: -Math.PI / 2, spread: 2, color: ['#8a6a44', '#3a2a1a'], glow: false, min: 40, max: 140, grav: 500 }); },
  }));
}

// =============================================================
//  1. 묘지기 해골 — 할퀴기, 뼈 던지기, 땅속 이동, 도약, 뼈 가시, 졸개 소환
// =============================================================
class BoneWarden extends Boss {
  constructor(g) {
    super(g, {
      name: '묘지기 해골', sprite: 'skeleton', idleAnim: 'walk', scale: 3,
      maxHp: 650, maxPosture: 100, hw: 66, hh: 124, headX: 12, headY: -132, aura: '#ff5a5a',
    });
    this.skills = [
      { fn: this.claw, name: '할퀴기 연타', kind: 'parry', w: 3 },
      { fn: this.boneThrow, name: '뼈 던지기', kind: 'parry', w: 2 },
      { fn: this.burrow, name: '땅속 이동', kind: 'danger', w: 1.4 },
      { fn: this.leap, name: '도약 내려찍기', kind: 'danger', w: 1.5 },
      { fn: this.spikeLine, name: '뼈 가시 행렬', kind: 'danger', w: 2, phase: 2 },
      { fn: this.summon, name: '해골 소환', kind: 'danger', now: true, w: 1.2, phase: 2, when() { return this.g.minions.length < 2; } },
    ];
  }
  tick() {
    if (this.anim.name === 'walk') this.anim.speed = Math.abs(this.vx) > 5 ? 1.4 : 0.35;
  }
  *intro() {
    this.anim.play('appear', 0.45, true);
    dust(this.x, 16);
    Sfx.bone();
    yield* this.waitAnim();
    this.anim.play('walk');
    yield 0.8;
    this.invuln = false;
  }
  *phase2Script() {
    yield* this.roar('#ff5a5a');
    yield* this.summon();
  }

  // 할퀴기 연타 (패링 가능)
  *claw() {
    yield* this.closeIn(80, 95, 2.2, 'walk');
    const hits = this.phase === 2 ? 3 : 2;
    for (let i = 0; i < hits; i++) {
      this.face();
      this.manualFrame = 2;
      this.tell('parry');
      const wt = i === 0 ? 0.5 : 0.36;
      this.warnBox(50, -70, 80, 100, wt, 'parry');
      yield wt;
      this.manualFrame = 0;
      this.vx = this.facing * 220;
      this.spawn(Haz.melee(this, 50, -70, 80, 100, 13, { posture: 22 }));
      clawFx(this.x + this.facing * 50, this.y - 80, this.facing);
      Sfx.whiff();
      yield 0.12;
      this.vx = 0;
      yield 0.18;
    }
    this.manualFrame = -1;
    yield 0.4;
  }

  // 뼈 던지기 (패링하면 되돌아가요)
  *boneThrow() {
    this.face();
    if (this.dist() < 140) yield* this.walkTo(this.x - this.facing * 90, 140, 0.6, 'walk');
    this.face();
    this.manualFrame = 2;
    this.tell('parry');
    // 던질 길을 미리 정하고 포물선으로 보여줘요
    const n = this.phase === 2 ? 5 : 3;
    const vxs = [];
    for (let i = 0; i < n; i++) {
      const dx = this.player.x - this.x;
      vxs.push(clamp((dx / 1.05) * rand(0.85, 1.15), -420, 420));
      this.warnArc(this.x + this.facing * 20, this.y - 110, vxs[i], -300, 620, 0.45 + i * 0.22 + 0.1, 'parry');
    }
    yield 0.45;
    for (let i = 0; i < n; i++) {
      this.manualFrame = i % 2 ? 0 : 2;
      const vx = vxs[i];
      this.spawn(Haz.shot('bone', this.x + this.facing * 20, this.y - 110, vx, -300, {
        grav: 620, floorDie: true,
        onEnd: h => FX.burst(h.x, h.y, 6, { color: ['#e8dcc0', '#b8a888'], glow: false, min: 30, max: 120, grav: 400 }),
      }));
      Sfx.bone();
      yield 0.22;
    }
    this.manualFrame = -1;
    yield 0.4;
  }

  // 땅속으로 사라졌다가 기사 발밑에서 뼈 가시와 함께 솟아나요 (피하기)
  *burrow() {
    this.tell('danger');
    yield 0.35;
    this.invuln = true;
    this.anim.play('appear', 0, true);
    for (let f = 5; f >= 0; f--) { this.manualFrame = f; dust(this.x, 3); yield 0.06; }
    this.hidden = true; this.manualFrame = -1;
    let t = 0;
    while (t < 0.9) {
      t += this.dt;
      this.x += clamp(this.player.x - this.x, -420 * this.dt, 420 * this.dt);
      if (Math.random() < 0.7) dust(this.x, 1);
      yield 0;
    }
    this.spawn(Haz.eruption(this.g, this.x, 70, 60, 0.55, 'bone', { dmg: 16 }));
    this.warnRect(this.x, GROUND - 30, 70, 60, 0.55);
    yield 0.55;
    this.hidden = false;
    this.face();
    this.anim.play('appear', 1, true);
    yield* this.waitAnim();
    this.invuln = false;
    this.anim.play('walk');
    yield 0.4;
  }

  // 높이 뛰어올라 내려찍기 → 양옆으로 충격파 (피하기, 점프로 넘기)
  *leap() {
    this.face();
    this.tell('danger');
    this.manualFrame = 2;
    // 떨어질 자리를 미리 정하고: 뛰는 길 + 착지 범위 + 양옆 충격파
    const tx = this.player.x;
    this.warnArc(this.x, this.y - 70, clamp((tx - this.x) / 0.83, -520, 520), -620, GRAV, 1.3, 'danger');
    this.warnRect(tx, GROUND - 30, 120, 60, 1.3);
    this.warnWaves(tx, 1.4);
    yield 0.45;
    this.vy = -620;
    this.vx = clamp((tx - this.x) / 0.83, -520, 520);
    dust(this.x, 10);
    yield 0.05;
    while (this.y < GROUND - 0.5 || this.vy < 0) yield 0;
    this.vx = 0;
    this.manualFrame = -1;
    Sfx.boom();
    FX.shake(7, 0.3);
    slamFx(this.x, 'rgba(255,230,190,0.8)', 1);
    this.spawn(Haz.melee(this, 0, -30, 120, 60, 16, { parryable: false }));
    const sp = this.phase === 2 ? 340 : 260;
    this.spawn(Haz.wave(this.x + 30, 1, sp, '#e8dcc0'));
    this.spawn(Haz.wave(this.x - 30, -1, sp, '#e8dcc0'));
    yield 0.6;
  }

  // 뼈 가시가 줄지어 솟아요 (2페이즈, 피하기)
  *spikeLine() {
    this.face();
    this.tell('danger');
    this.manualFrame = 2;
    this.warnLane(this.x, this.x + this.facing * 610, 50, 1.4);
    yield 0.5;
    this.manualFrame = 0;
    FX.shake(3, 0.4);
    const dir = this.facing;
    for (let i = 1; i <= 10; i++) {
      const px = this.x + dir * (30 + i * 55);
      if (px < 10 || px > ARENA_W - 10) break;
      this.spawn(Haz.eruption(this.g, px, 44, 48, 0.35, 'bone', { dmg: 15 }));
      yield 0.09;
    }
    this.manualFrame = -1;
    yield 0.6;
  }

  // 해골 졸개 소환 (2페이즈)
  *summon() {
    Sfx.magic();
    FX.add(new GlowFx(this.x, this.y - 70, 60, 'rgba(255,60,60,0.6)', 0.5));
    const xs = [0, 1].map(i => clamp(this.player.x + (i ? 1 : -1) * rand(90, 170), 30, ARENA_W - 30));
    for (const x of xs) FX.add(new GroundWarnFx(x, 50, 0.5, '#ff4040', 60), true);
    yield 0.5;
    for (const x of xs) {
      this.g.minions.push(new Minion(this.g, x));
      FX.explode(x, GROUND - 10, 18, ['rgba(255,60,60,0.9)', '#ffffff'], { squash: 0.5 });
      yield 0.2;
    }
    yield 0.5;
  }
}

// =============================================================
//  2. 등불의 망령 — 영혼탄, 등불 강하, 분신 돌진, 저주의 원, 영혼 소용돌이
// =============================================================
class LanternWraith extends Boss {
  constructor(g) {
    super(g, {
      name: '등불의 망령', sprite: 'ghost', idleAnim: 'fly', scale: 3,
      maxHp: 720, maxPosture: 100, hw: 54, hh: 118, headX: 6, headY: -128,
      flying: true, aura: '#b46cff',
    });
    this.homeY = GROUND - 24;
    this.y = this.homeY;
    this.floating = true;
    this.alpha = 0;
    this.skills = [
      { fn: this.soulFan, name: '영혼탄 부채꼴', kind: 'parry', w: 3 },
      { fn: this.dive, name: '등불 강하', kind: 'danger', now: true, w: 1.6 },
      { fn: this.phantoms, name: '분신 돌진', kind: 'parry', w: 2 },
      { fn: this.curses, name: '저주의 원', kind: 'danger', w: 1.6 },
      { fn: this.spiral, name: '영혼 소용돌이', kind: 'parry', w: 1.6, phase: 2 },
    ];
  }
  lantern() { return { x: this.x + this.facing * 30, y: this.y - 44 }; }
  tick(dt) {
    if (this.floating) this.y = lerp(this.y, this.homeY + Math.sin(this.t * 2.2) * 8, Math.min(1, 3 * dt));
    if (Math.random() < dt * 20 && !this.hidden) {
      const l = this.lantern();
      FX.particle({ x: l.x + rand(-2, 2), y: l.y + rand(-2, 2), vy: rand(-30, -10), life: 0.5, size: 1, color: '#ffb050', glow: true, floor: false });
    }
  }
  drawBody(ctx, opt) {
    const l = this.lantern();
    if (!opt.white) glowCircle(ctx, l.x, l.y, 30, 'rgba(255,170,70,0.5)', this.alpha * (0.8 + 0.2 * Math.sin(this.t * 13)));
    super.drawBody(ctx, Object.assign({}, opt, { alpha: (opt.alpha !== undefined ? opt.alpha : 1) * (0.88 + 0.08 * Math.sin(this.t * 7)) }));
  }
  *intro() {
    Sfx.magic();
    let t = 0;
    while (t < 1.4) {
      t += this.dt;
      this.alpha = Math.min(1, t / 1.2);
      FX.particle({ x: this.x + rand(-30, 30), y: this.y - rand(0, 130), vy: rand(-40, -10), life: 0.6, size: 2, color: '#b46cff', glow: true, floor: false });
      yield 0;
    }
    this.alpha = 1;
    this.invuln = false;
  }
  // 쓰러졌다 일어나면 다시 둥둥 떠요
  onRecover() {
    super.onRecover();
    this.floating = true; this.homeY = GROUND - 24; this.alpha = 1;
  }
  onInterrupt() {
    super.onInterrupt();
    this.floating = true; this.homeY = GROUND - 24;
  }
  *phase2Script() {
    this.floating = true; this.homeY = GROUND - 24; this.alpha = 1;
    yield* this.roar('#b46cff');
    yield* this.spiral();
  }
  *drift() {
    const side = Math.sign(this.x - this.player.x) || 1;
    const tx = clamp(this.player.x + side * 170, 60, ARENA_W - 60);
    yield* this.walkTo(tx, 150, 1.0);
    this.face();
  }

  // 영혼탄 부채꼴 (패링 가능 — 되돌아가요)
  *soulFan() {
    yield* this.drift();
    this.tell('parry', this.lantern());
    const volleys = this.phase === 2 ? 2 : 1;
    for (let v = 0; v < volleys; v++) {
      this.face();
      const lp = this.lantern();
      const a0 = Math.atan2(this.player.y - 22 - lp.y, this.player.x - lp.x);
      const n = 5;
      // 다섯 갈래 길을 먼저 보여줘요
      for (let i = 0; i < n; i++) this.warnLine(lp.x, lp.y, a0 + (i - (n - 1) / 2) * 0.17 + (v % 2) * 0.085, 260, 0.5, 'parry');
      yield 0.5;
      for (let i = 0; i < n; i++) {
        const a = a0 + (i - (n - 1) / 2) * 0.17 + (v % 2) * 0.085;
        this.spawn(Haz.shot('soul', lp.x, lp.y, Math.cos(a) * 200, Math.sin(a) * 200));
      }
      Sfx.magic();
      FX.add(new GlowFx(lp.x, lp.y, 50, 'rgba(190,100,255,0.9)', 0.3));
      FX.add(new ShockFx(lp.x, lp.y, 4, 46, 'rgba(190,100,255,0.8)', 0.3, 6));
      FX.add(new RaysFx(lp.x, lp.y, 8, 60, '#c070ff', 0.3, 0.06));
      yield 0.15;
    }
    yield 0.3;
  }

  // 사라졌다가 머리 위에서 내리꽂기 (피하기)
  *dive() {
    this.invuln = true;
    this.floating = false;
    for (let t = 0; t < 0.3; t += this.dt) { this.alpha = 1 - t / 0.3; yield 0; }
    this.hidden = true;
    yield 0.3;
    this.x = this.player.x; this.y = GROUND - 170;
    this.hidden = false;
    this.face();
    this.tell('danger');
    // 내리꽂을 기둥 범위 (망령을 따라 움직여요)
    FX.add(new ZoneFx(() => ({ x: this.x - 28, y: this.y - 120, w: 56, h: GROUND - this.y + 120 }), 0.55, 'danger', this));
    let t = 0;
    while (t < 0.55) {
      t += this.dt;
      this.alpha = Math.min(1, t / 0.2);
      this.x += clamp(this.player.x - this.x, -170 * this.dt, 170 * this.dt);
      yield 0;
    }
    this.alpha = 1;
    this.warnWaves(this.x, 0.45);
    this.vy = 950;
    this.spawn(Haz.melee(this, 0, -60, 50, 120, 18, { parryable: false, life: 0.5, light: 'rgba(190,90,255,0.9)', lightW: 80 }));
    while (this.y < GROUND) {
      FX.add(new AfterImageFx('ghost', 'fly', this.anim.frame, this.x, this.y, this.scale, this.facing, '#c060ff', 0.2), true);
      FX.particle({ x: this.x + rand(-20, 20), y: this.y - rand(0, 120), vx: 0, vy: -rand(100, 300), life: 0.3, size: 1.5, color: pick(['#c060ff', '#ffffff']), glow: true, floor: false, kind: 'spark' });
      yield 0;
    }
    this.y = GROUND; this.vy = 0;
    Sfx.boom();
    FX.shake(8, 0.35);
    slamFx(this.x, 'rgba(190,90,255,0.9)', 1.1);
    FX.add(new RaysFx(this.x, GROUND - 10, 12, 140, '#c060ff', 0.5, 0.06));
    const sp = this.phase === 2 ? 330 : 270;
    this.spawn(Haz.wave(this.x + 24, 1, sp, '#c060ff'));
    this.spawn(Haz.wave(this.x - 24, -1, sp, '#c060ff'));
    this.invuln = false;
    yield 0.7;
    this.floating = true;
    yield 0.3;
  }

  // 화면 끝에서 분신이 돌진 (하나씩 패링 가능)
  *phantoms() {
    this.tell('parry');
    yield 0.3;
    const n = this.phase === 2 ? 4 : 3;
    const boss = this;
    for (let i = 0; i < n; i++) {
      const fromRight = i % 2 === 0 ? this.player.x < this.x : this.player.x >= this.x;
      const sx = fromRight ? this.g.camX + W - 24 : this.g.camX + 24;
      const dir = fromRight ? -1 : 1;
      const cy = GROUND - 34;
      FX.add(new GlintFx(sx, cy - 20, '#ffd84a', 24, 0.5));
      this.warnLane(sx, sx + dir * W, 64, 0.6, 'parry');
      Sfx.tellParry();
      let after = 0;
      this.spawn(new Hazard({
        x: sx, y: cy, w: 40, h: 64, vx: dir * 560, delay: 0.55, life: 2.4, dmg: 13, posture: 18, light: 'rgba(180,100,255,0.7)', lightW: 50,
        kind: 'phantom',
        tick(h, dt) {
          if (h.t > h.delay) {
            after -= dt;
            if (after <= 0) { after = 0.04; FX.add(new AfterImageFx('ghost', 'fly', Math.floor(h.t * 12) % 4, h.x, h.y + 40, 2, dir, '#b46cff', 0.25), true); }
          }
        },
        draw(ctx, h) {
          const f = Math.floor(h.t * 12) % 4;
          const a = h.t < h.delay ? h.t / h.delay : 1;
          drawSprite(ctx, 'ghost', 'fly', f, h.x, h.y + 40, 2, dir, { alpha: 0.55 * a });
          drawSprite(ctx, 'ghost', 'fly', f, h.x, h.y + 40, 2, dir, { white: true, alpha: 0.25 * a, comp: 'lighter' });
        },
        onParry(h) {
          FX.burst(h.x, h.y, 20, { color: ['#b46cff', '#ffffff'], min: 60, max: 220 });
          boss.addPosture(6);
        },
      }));
      yield 0.5;
    }
    yield 0.8;
  }

  // 저주의 원 — 기사가 있던 자리에 보라 빛기둥 (피하기)
  *curses() {
    this.tell('danger', this.lantern());
    yield 0.35;
    const n = this.phase === 2 ? 5 : 3;
    for (let i = 0; i < n; i++) {
      this.spawn(Haz.eruption(this.g, this.player.x, 44, 150, 0.75, 'curse', { dmg: 16 }));
      Sfx.magic();
      yield 0.45;
    }
    yield 0.6;
  }

  // 영혼 소용돌이 (2페이즈, 패링 가능)
  *spiral() {
    this.homeY = GROUND - 110;
    yield* this.walkTo(clamp(this.player.x + (this.x > this.player.x ? 140 : -140), 80, ARENA_W - 80), 160, 1.0);
    this.face();
    this.tell('parry');
    let a = rand(0, Math.PI);
    // 처음 뿜어질 방향들
    for (let k = 0; k < 4; k++) for (let j = 0; j < 2; j++) this.warnLine(this.x, this.y - 60, a + k * 0.45 + j * Math.PI, 150, 0.6, 'parry');
    yield 0.6;
    for (let k = 0; k < 16; k++) {
      for (let j = 0; j < 2; j++) {
        const ang = a + j * Math.PI;
        this.spawn(Haz.shot('soul', this.x, this.y - 60, Math.cos(ang) * 135, Math.sin(ang) * 135, { life: 4 }));
      }
      a += 0.45;
      if (k % 3 === 0) Sfx.magic();
      yield 0.16;
    }
    this.homeY = GROUND - 24;
    yield 0.6;
  }
}

// =============================================================
//  3. 푸른 악몽마 — 돌진, 앞발 구르기, 푸른 유성, 도깨비불, 불꽃 고리
// =============================================================
class Nightmare extends Boss {
  constructor(g) {
    super(g, {
      name: '푸른 악몽마', sprite: 'nightmare', idleAnim: 'idle', scale: 2,
      maxHp: 820, maxPosture: 110, hw: 120, hh: 108, hox: 6, headX: 72, headY: -128,
      aura: '#40e0ff', x: ARENA_W - 110, knock: 0.5,
    });
    this.charging = false;
    this.skills = [
      { fn: this.charge, name: '돌진', kind: 'parry', w: 3 },
      { fn: this.stomp, name: '앞발 충격파', kind: 'danger', w: 2 },
      { fn: this.meteors, name: '푸른 유성', kind: 'danger', w: 1.6 },
      { fn: this.wisps, name: '도깨비불', kind: 'parry', w: 2 },
      { fn: this.flameRing, name: '불꽃 고리', kind: 'danger', w: 1.6, phase: 2 },
      { fn: this.tripleCharge, name: '3연속 돌진', kind: 'parry', w: 1.6, phase: 2 },
    ];
  }
  onInterrupt() { super.onInterrupt(); this.charging = false; }
  tick(dt) {
    if (Math.random() < dt * 25) {
      const h = this.headPos();
      FX.particle({ x: h.x - this.facing * rand(10, 60), y: h.y + rand(0, 30), vx: -this.facing * rand(10, 40), vy: rand(-50, -20), life: 0.5, size: 2, color: pick(['#40e0ff', '#c0ffff']), glow: true, floor: false });
    }
  }
  *intro() {
    this.anim.play('run');
    this.facing = -1;
    while (this.x > 680) { this.vx = -320; yield 0; }
    this.vx = 0;
    this.anim.play('idle');
    Sfx.roar();
    FX.shake(5, 0.6);
    FX.add(new RingFx(this.headPos().x, this.headPos().y, 10, 140, '#40e0ff', 0.6, 4));
    yield 0.8;
    this.invuln = false;
  }
  *phase2Script() {
    yield* this.roar('#40e0ff');
    yield* this.tripleCharge();
  }

  // 돌진 (패링하면 말이 튕겨나며 비틀거려요)
  *charge(again) {
    this.face();
    this.anim.play('idle', 1.6);
    this.tell('parry');
    this.vx = -this.facing * 50;
    // 달려올 길
    const wdir = this.facing;
    const endX = clamp(this.player.x + wdir * 200, this.hw / 2, ARENA_W - this.hw / 2) + wdir * 60;
    this.warnLane(this.x + wdir * 40, endX, 100, again ? 0.42 : 0.6, 'parry');
    yield again ? 0.42 : 0.6;
    const dir = this.facing;
    this.anim.play('run', 1.7);
    this.vx = dir * 540;
    this.charging = true;
    Sfx.dash();
    const hz = this.spawn(Haz.melee(this, 55, -60, 90, 100, 18, {
      posture: 35, life: 3, kb: 320, light: 'rgba(64,224,255,0.9)', lightW: 110,
      onParry: () => {
        this.charging = false; this.recoiled = true; this.vx = -dir * 260; FX.shake(7, 0.3);
        const h = this.headPos();
        FX.explode(h.x, h.y + 30, 30, ['rgba(64,224,255,0.9)', '#ffffff'], { smoke: false });
      },
    }));
    this.recoiled = false;
    let t = 0, after = 0;
    while (this.charging && t < 2.4) {
      t += this.dt; after -= this.dt;
      this.vx = dir * 540 * this.speedMul;
      if (after <= 0) { after = 0.05; FX.add(new AfterImageFx('nightmare', 'run', this.anim.frame, this.x, this.y, 2, this.facing, '#40e0ff', 0.25), true); }
      for (let k = 0; k < 3; k++) FX.particle({ x: this.x - dir * rand(30, 70), y: GROUND - rand(0, 60), vx: -dir * rand(40, 160), vy: rand(-120, -20), life: rand(0.3, 0.6), size: rand(2, 4), color: pick(['#40e0ff', '#c0ffff', '#ffffff']), glow: true, floor: false, kind: k ? 'sq' : 'spark' });
      if (Math.random() < 0.3) FX.add(new ScorchFx(this.x - dir * 40, 40, 'rgba(0,20,30,0.35)', 1.2, 'rgba(64,224,255,0.5)'), true);
      if (Math.random() < 0.15) { const h = this.headPos(); FX.add(new LightningFx(h.x, h.y, h.x - dir * rand(40, 90), h.y + rand(-20, 50), '#40e0ff', 0.12, 5, 6, 1.2)); }
      const pastPlayer = (this.x - this.player.x) * dir > 200;
      const atWall = (dir > 0 && this.x >= ARENA_W - this.hw / 2 - 1) || (dir < 0 && this.x <= this.hw / 2 + 1);
      if (pastPlayer || atWall) { if (atWall) FX.shake(4, 0.2); break; }
      yield 0;
    }
    hz.dead = true;
    if (this.recoiled) {
      this.anim.play('idle', 0.5);
      while (Math.abs(this.vx) > 10) { this.vx = approach(this.vx, 0, 500 * this.dt); yield 0; }
      yield 0.9;        // 빈틈! 마구 베세요
    } else {
      while (Math.abs(this.vx) > 20) { this.vx = approach(this.vx, 0, 1500 * this.dt); yield 0; }
    }
    this.charging = false;
    this.vx = 0;
    this.anim.play('idle');
    yield 0.3;
  }
  *tripleCharge() {
    for (let i = 0; i < 3; i++) {
      yield* this.charge(i > 0);
      if (this.recoiled) break;
    }
  }

  // 앞발 구르기 → 푸른 충격파 (점프로 넘기)
  *stomp() {
    this.face();
    this.tell('danger');
    this.anim.play('idle', 2.5);
    this.warnRect(this.x, GROUND - 20, 170, 40, 1.15);
    this.warnWaves(this.x, 1.25);
    yield 0.4;
    this.vy = -520;
    yield 0.05;
    while (this.y < GROUND - 0.5 || this.vy < 0) yield 0;
    const waves = this.phase === 2 ? 2 : 1;
    for (let i = 0; i < waves; i++) {
      Sfx.boom();
      FX.shake(8, 0.3);
      slamFx(this.x, 'rgba(64,224,255,0.9)', 1.2);
      this.spawn(Haz.melee(this, 0, -20, 170, 40, 15, { parryable: false }));
      this.spawn(Haz.wave(this.x + 40, 1, 310, '#40e0ff'));
      this.spawn(Haz.wave(this.x - 40, -1, 310, '#40e0ff'));
      yield 0.45;
      if (i < waves - 1) { this.vy = -380; yield 0.05; while (this.y < GROUND - 0.5 || this.vy < 0) yield 0; }
    }
    this.anim.play('idle');
    yield 0.4;
  }

  // 푸른 유성 (피하기)
  *meteors() {
    this.tell('danger');
    this.anim.play('idle', 2.5);
    Sfx.roar();
    yield 0.55;
    const n = this.phase === 2 ? 9 : 6;
    for (let i = 0; i < n; i++) {
      const x = i === 0 ? this.player.x : clamp(this.player.x + rand(-230, 230), 20, ARENA_W - 20);
      this.spawn(Haz.meteor(this.g, x, 0.9, '#40e0ff', { slant: rand(-130, -40), core: '#e0ffff' }));
      yield 0.18;
    }
    this.anim.play('idle');
    yield 0.8;
  }

  // 도깨비불: 머리 둘레를 돌다가 하나씩 날아와요 (패링 가능)
  *wisps() {
    this.face();
    this.tell('parry');
    const n = this.phase === 2 ? 5 : 3;
    const orbs = [];
    const boss = this;
    for (let i = 0; i < n; i++) {
      const o = Haz.shot('wisp', this.x, this.y - 100, 0, 0, {
        hold: true, idx: i, life: 6,
        tick(h, dt) {
          if (h.hold) {
            const hp = boss.headPos();
            const a = h.t * 3 + (h.idx * Math.PI * 2) / n;
            h.x = hp.x - boss.facing * 30 + Math.cos(a) * 34;
            h.y = hp.y - 10 + Math.sin(a) * 26;
            if (boss.dead || boss.stunT > 0) h.dead = true;
          }
          trail(h, ['#3fe0ff', '#b8fbff'], 50, dt);
        },
      });
      orbs.push(this.spawn(o));
      Sfx.fire();
      yield 0.15;
    }
    yield 0.5;
    for (const o of orbs) {
      if (o.dead) continue;
      o.hold = false;
      // 멈춰서 날아갈 길을 보여준 뒤 출발
      const a = Math.atan2(this.player.y - 24 - o.y, this.player.x - o.x);
      this.warnLine(o.x, o.y, a, 320, 0.24, 'parry');
      yield 0.24;
      o.vx = Math.cos(a) * 270; o.vy = Math.sin(a) * 270;
      FX.add(new GlintFx(o.x, o.y, '#ffd84a', 14, 0.25));
      Sfx.fire();
      yield 0.1;
    }
    yield 0.4;
  }

  // 자기 주변으로 퍼지는 푸른 불기둥 (2페이즈, 피하기)
  *flameRing() {
    this.tell('danger');
    this.anim.play('idle', 2.5);
    yield 0.45;
    for (let d = 70; d <= 330; d += 65) {
      this.spawn(Haz.eruption(this.g, this.x + d, 40, 110, 0.4, 'blue', { dmg: 16 }));
      this.spawn(Haz.eruption(this.g, this.x - d, 40, 110, 0.4, 'blue', { dmg: 16 }));
      yield 0.14;
    }
    this.anim.play('idle');
    yield 0.6;
  }
}

// =============================================================
//  4. 지옥 야수 — 화염구, 불기둥, 불기둥 행진, 화염 숨결, 불꽃 순간이동, 용암 비
// =============================================================
class HellBeast extends Boss {
  constructor(g) {
    super(g, {
      name: '지옥 야수', sprite: 'beast', idleAnim: 'idle', scale: 2,
      maxHp: 920, maxPosture: 110, hw: 64, hh: 116, headX: 8, headY: -112, aura: '#ff6a1a', knock: 0.7,
    });
    this.hidden = true;
    this.skills = [
      { fn: this.fireballs, name: '화염구', kind: 'parry', w: 3 },
      { fn: this.pillars, name: '불기둥', kind: 'danger', w: 2 },
      { fn: this.march, name: '불기둥 행진', kind: 'danger', w: 1.6 },
      { fn: this.breath, name: '화염 숨결', kind: 'danger', w: 1.8, when() { return this.dist() < 260; } },
      { fn: this.teleport, name: '불꽃 순간이동', kind: 'mix', now: true, w: 1.5 },
      { fn: this.swipes, name: '손톱 연타', kind: 'parry', w: 2.2, when() { return this.dist() < 110; } },
      { fn: this.lavaRain, name: '용암 비', kind: 'danger', w: 1.5, phase: 2 },
    ];
  }
  hand() { return { x: this.x + this.facing * 30, y: this.y - 72 }; }
  tick(dt) {
    if (Math.random() < dt * 12 && !this.hidden) {
      const h = this.hand();
      FX.particle({ x: h.x + rand(-4, 4), y: h.y, vy: rand(-60, -20), life: 0.4, size: 2, color: pick(['#ff9a2a', '#ffd040']), glow: true, floor: false });
    }
  }
  // 불기둥 연출만 (피해 없음)
  firePuff(x) {
    this.spawn(Haz.eruption(this.g, x, 50, 150, 0.01, 'fire', { harmless: true }));
  }
  *intro() {
    this.invuln = true;
    FX.add(new GroundWarnFx(this.x, 60, 0.8, '#ff5a10', 150), true);
    yield 0.8;
    this.firePuff(this.x);
    yield 0.25;
    this.hidden = false;
    Sfx.roar();
    FX.shake(5, 0.5);
    yield 0.8;
    this.invuln = false;
  }
  *phase2Script() {
    yield* this.roar('#ff6a1a');
    yield* this.lavaRain();
  }

  // 화염구 (패링하면 되돌아가요)
  *fireballs() {
    this.face();
    this.anim.play('shoot', 1, true);
    this.tell('parry', this.hand());
    // 쏠 방향을 먼저 정해서 보여줘요
    const n = this.phase === 2 ? 5 : 3;
    const h0 = this.hand();
    const aims = [];
    for (let i = 0; i < n; i++) {
      const spread = this.phase === 2 ? (i - (n - 1) / 2) * 0.12 : 0;
      aims.push(Math.atan2(this.player.y - 22 - h0.y, this.player.x - h0.x) + spread);
      this.warnLine(h0.x, h0.y, aims[i], 380, 0.5 + i * 0.3 + 0.1, 'parry');
    }
    yield 0.5;
    for (let i = 0; i < n; i++) {
      const hp = this.hand();
      const a = aims[i];
      this.spawn(Haz.shot('fire', hp.x, hp.y, Math.cos(a) * 250, Math.sin(a) * 250));
      Sfx.fire();
      FX.burst(hp.x, hp.y, 10, { color: ['#ff9a2a', '#ffd040'], min: 40, max: 160 });
      FX.add(new ImpactFx(hp.x, hp.y, 26, '#ff9a2a', 0.12));
      FX.add(new ShockFx(hp.x, hp.y, 3, 30, 'rgba(255,140,40,0.8)', 0.25, 5));
      FX.smoke(hp.x, hp.y, 3, { color: 'rgba(50,25,20,0.45)', size: 6, grow: 16 });
      yield 0.3;
    }
    this.anim.play('idle');
    yield 0.4;
  }

  // 기사 발밑에서 불기둥 (피하기)
  *pillars() {
    this.anim.play('shoot', 1, true);
    this.tell('danger');
    yield 0.4;
    const n = this.phase === 2 ? 4 : 3;
    for (let i = 0; i < n; i++) {
      this.spawn(Haz.eruption(this.g, this.player.x, 40, 150, 0.7, 'fire', { dmg: 18 }));
      yield 0.5;
    }
    this.anim.play('idle');
    yield 0.4;
  }

  // 불기둥이 줄지어 다가와요 (피하기)
  *march() {
    this.face();
    this.tell('danger');
    this.anim.play('shoot', 1, true);
    this.warnLane(this.x + this.facing * 70, this.x + this.facing * 760, 60, 1.6);
    if (this.phase === 2) this.warnLane(this.x - this.facing * 70, this.x - this.facing * 760, 60, 1.6);
    yield 0.5;
    const dir = this.facing;
    for (let i = 1; i <= 12; i++) {
      const d = 40 + i * 58;
      const px = this.x + dir * d;
      if (px > 10 && px < ARENA_W - 10) this.spawn(Haz.eruption(this.g, px, 40, 130, 0.4, 'fire', { dmg: 16 }));
      if (this.phase === 2) {
        const bx = this.x - dir * d;
        if (bx > 10 && bx < ARENA_W - 10) this.spawn(Haz.eruption(this.g, bx, 40, 130, 0.4, 'fire', { dmg: 16 }));
      }
      yield 0.11;
    }
    this.anim.play('idle');
    yield 0.6;
  }

  // 화염 숨결 (피하기 — 뒤로 돌아가거나 멀어지세요)
  *breath() {
    yield* this.closeIn(150, 110, 1.2, 'idle');
    this.face();
    this.tell('danger');
    this.anim.play('shoot', 0.7, true);
    const dur = this.phase === 2 ? 1.6 : 1.2;
    this.warnBox(110, -40, 160, 64, 0.55 + dur);
    yield 0.55;
    let t = 0, next = 0;
    while (t < dur) {
      t += this.dt; next -= this.dt;
      const mx = this.x + this.facing * 32, my = this.y - 80;
      for (let k = 0; k < 6; k++) {
        FX.particle({ x: mx, y: my, vx: this.facing * rand(220, 400), vy: rand(10, 120), life: rand(0.35, 0.6), size: rand(2, 6), grow: 8, color: pick(['#ff9a2a', '#ffd040', '#ff4a10', '#fff0a0']), glow: true, drag: 1, floor: true, kind: k % 3 ? 'orb' : 'spark' });
      }
      if (Math.random() < 0.4) FX.particle({ x: mx + this.facing * rand(60, 160), y: my + rand(0, 40), vx: this.facing * 60, vy: -40, life: 0.9, size: 6, grow: 20, color: 'rgba(40,20,15,0.4)', kind: 'smoke', floor: false, shrink: false });
      if (Math.random() < 0.3) FX.add(new GlowFx(mx + this.facing * 60, my + 20, 70, 'rgba(255,120,30,0.5)', 0.15));
      if (next <= 0) {
        next = 0.3;
        Sfx.fire();
        this.spawn(Haz.melee(this, 110, -40, 160, 64, 10, { parryable: false, life: 0.3, light: 'rgba(255,120,30,0.9)', lightW: 110 }));
        FX.add(new EmberPatchFx(this.x + this.facing * rand(80, 160), 50, ['#ff9a2a', '#ffd040'], 0.8), true);
      }
      yield 0;
    }
    this.anim.play('idle');
    yield 0.5;
  }

  // 불꽃 속으로 사라져 기사 뒤에서 나타나요
  *teleport() {
    this.invuln = true;
    this.firePuff(this.x);
    Sfx.fire();
    yield 0.15;
    this.hidden = true;
    yield 0.4;
    const p = this.player;
    let nx = p.x - p.facing * 110;
    if (nx < 50 || nx > ARENA_W - 50) nx = p.x + p.facing * 110;
    this.x = clamp(nx, 40, ARENA_W - 40);
    this.spawn(Haz.eruption(this.g, this.x, 50, 140, 0.45, 'fire', { dmg: 14 }));
    this.warnRect(this.x, GROUND - 70, 50, 140, 0.45);
    yield 0.45;
    this.hidden = false;
    this.invuln = false;
    this.face();
    yield 0.2;
    yield* this.swipes();
  }

  // 불붙은 손톱 2연타 (패링 가능)
  *swipes() {
    const n = this.phase === 2 ? 3 : 2;
    for (let i = 0; i < n; i++) {
      this.face();
      this.anim.play('shoot', 1, true);
      this.tell('parry', this.hand());
      const wt = i === 0 ? 0.45 : 0.32;
      this.warnBox(44, -60, 76, 96, wt, 'parry');
      yield wt;
      this.vx = this.facing * 160;
      this.spawn(Haz.melee(this, 44, -60, 76, 96, 14, { posture: 24 }));
      clawFx(this.x + this.facing * 44, this.y - 76, this.facing, '#ff8a2a', 36);
      FX.burst(this.x + this.facing * 50, this.y - 60, 10, { color: ['#ff9a2a', '#ffd040'], min: 60, max: 160 });
      Sfx.whiff();
      yield 0.12;
      this.vx = 0;
      yield 0.15;
    }
    this.anim.play('idle');
    yield 0.4;
  }

  // 용암 비 (2페이즈, 피하기)
  *lavaRain() {
    this.anim.play('shoot', 1, true);
    this.tell('danger');
    Sfx.roar();
    yield 0.5;
    for (let i = 0; i < 9; i++) {
      const x = i % 3 === 0 ? this.player.x : clamp(this.player.x + rand(-240, 240), 20, ARENA_W - 20);
      this.spawn(Haz.meteor(this.g, x, 0.85, '#ff6a1a', { slant: rand(-120, 120) }));
      yield 0.17;
    }
    this.anim.play('idle');
    yield 0.7;
  }
}

// =============================================================
//  5. 가시 드래곤 — 물어뜯기, 내려치기, 화염 분사, 가시 비, 꼬리 가시, 화산 낙하
// =============================================================
class SpikedDragon extends Boss {
  constructor(g) {
    super(g, {
      name: '가시 드래곤', sprite: 'dragon', idleAnim: 'idle', scale: 1.6,
      maxHp: 1300, maxPosture: 130, hw: 230, hh: 128, hox: 0, headX: 112, headY: -122,
      aura: '#ff9a3c', x: ARENA_W - 115, knock: 0.15,
    });
    this.skills = [
      { fn: this.bite, name: '물어뜯기', kind: 'parry', w: 3, when() { return this.dist() > 90; } },
      { fn: this.slam, name: '내려치기', kind: 'danger', w: 2 },
      { fn: this.trample, name: '짓밟기', kind: 'danger', w: 4, when() { return this.dist() < 140; } },
      { fn: this.fireSpray, name: '화염 분사', kind: 'parry', w: 2 },
      { fn: this.spikeRain, name: '가시 비', kind: 'danger', w: 1.5 },
      { fn: this.tailSpikes, name: '꼬리 가시', kind: 'parry', w: 1.8 },
      { fn: this.volcano, name: '화산 낙하', kind: 'danger', w: 1.4, phase: 2 },
    ];
  }
  tail() { return { x: this.x - this.facing * 120, y: this.y - 90 }; }
  tick() {
    if (this.anim.name === 'walk') this.anim.speed = Math.abs(this.vx) > 5 ? 1.6 : 0.6;
  }
  *intro() {
    this.anim.play('walk');
    while (this.x > 700) { this.vx = -90; yield 0; }
    this.vx = 0;
    this.anim.play('attack', 1.4, true);
    yield* this.waitFrame(8);
    Sfx.roar();
    FX.shake(8, 1.0);
    const h = this.headPos();
    for (let i = 0; i < 3; i++) { FX.add(new RingFx(h.x, h.y, 10, 200, '#ff9a3c', 0.7, 4)); yield 0.2; }
    yield* this.waitAnim();
    this.anim.play('idle');
    this.invuln = false;
  }
  onStun() { this.anim.play('hit', 1, true); }
  onDeath() { this.anim.play('death', 1, true); }
  updateDeath(dt) {
    this.deathBursts(dt, 3.0);
    if (this.anim.done) {
      const k = Math.max(0, this.deadT - 3.2);
      this.alpha = Math.max(0, 1 - k / 1.5);
    }
    if (this.deadT < 4.5 && Math.random() < dt * 30) {
      const b = this.hurtbox();
      FX.particle({ x: rand(b.x, b.x + b.w), y: rand(b.y, b.y + b.h), vx: rand(-20, 20), vy: rand(-80, -20), life: 1, size: rand(1, 3), color: pick(['#ff9a3c', '#ffd060', '#ffffff']), glow: true, floor: false });
    }
  }
  *phase2Script() {
    this.anim.play('attack', 1.4, true);
    yield* this.roar('#ff9a3c');
    this.anim.play('idle');
    yield* this.volcano();
  }

  // 물어뜯기 (패링 가능)
  *bite() {
    yield* this.closeIn(200, 80, 2.5, 'walk');
    this.face();
    const times = this.phase === 2 ? 2 : 1;
    for (let i = 0; i < times; i++) {
      this.tell('parry');
      this.anim.play('attack', 1.5, true);
      if (i > 0) this.anim.setFrame(5);
      this.warnBox(150, -55, 130, 90, (9 - (i > 0 ? 5 : 0)) / 15, 'parry');
      yield* this.waitFrame(9);
      this.spawn(Haz.melee(this, 150, -55, 130, 90, 22, { posture: 30, kb: 300 }));
      const h = this.headPos();
      // 위아래로 닫히는 이빨 궤적
      const bx = h.x + this.facing * 40, by = h.y + 45;
      FX.add(new SlashFx(bx, by - 8, 44, mirrorA(-2.2, this.facing), mirrorA(-0.2, this.facing), { life: 0.22, thick: 10, edge: '#ffb070', glow: 'rgba(255,120,40,0.6)' }));
      FX.add(new SlashFx(bx, by + 8, 44, mirrorA(2.2, this.facing), mirrorA(0.2, this.facing), { life: 0.22, thick: 10, edge: '#ffb070', glow: 'rgba(255,120,40,0.6)' }));
      FX.add(new ImpactFx(bx + this.facing * 30, by, 40, '#ffb070', 0.16));
      FX.sparks(bx + this.facing * 30, by, 14, { angle: this.facing > 0 ? 0 : Math.PI, spread: 1.4, color: ['#ffb070', '#ffffff'] });
      Sfx.whiff();
      FX.shake(4, 0.15);
      yield* this.waitFrame(15);
    }
    this.anim.play('idle');
    yield 0.4;
  }

  // 앞발 내려치기 → 땅 흔들림, 충격파, 낙석 (피하기)
  *slam() {
    yield* this.closeIn(260, 80, 1.5, 'walk');
    this.face();
    this.tell('danger');
    this.anim.play('strike', 1.35, true);
    const t0 = 18 / (9 * 1.35);
    this.warnBox(140, -40, 170, 80, t0);
    this.warnWaves(this.x + this.facing * 140, t0 + 0.1);
    yield* this.waitFrame(18);
    const ix = this.x + this.facing * 140;
    this.spawn(Haz.melee(this, 140, -40, 170, 80, 26, { parryable: false, kb: 320 }));
    Sfx.boom();
    FX.shake(12, 0.5);
    slamFx(ix, 'rgba(255,160,60,0.9)', 1.5);
    FX.punch(0.05, 0.3, ix, GROUND - 40);
    this.spawn(Haz.wave(ix + 30, 1, 330, '#ffa040'));
    this.spawn(Haz.wave(ix - 30, -1, 330, '#ffa040'));
    const rocks = this.phase === 2 ? 7 : 4;
    for (let i = 0; i < rocks; i++) spikeDrop(this, clamp(this.player.x + rand(-200, 200), 20, ARENA_W - 20), 0.8 + i * 0.08);
    yield* this.waitAnim();
    this.anim.play('idle');
    yield 0.4;
  }

  // 발밑 짓밟기 — 배 밑에 숨은 기사를 노려요 (피하기)
  *trample() {
    this.tell('danger');
    this.anim.play('strike', 1.6, true);
    this.warnBox(10, -35, 280, 70, 18 / (9 * 1.6));
    if (this.phase === 2) this.warnWaves(this.x, 18 / (9 * 1.6) + 0.1, 420);
    yield* this.waitFrame(18);
    this.spawn(Haz.melee(this, 10, -35, 280, 70, 20, { parryable: false, kb: 360 }));
    Sfx.boom();
    FX.shake(10, 0.4);
    slamFx(this.x - 60, 'rgba(255,160,60,0.9)', 1.1);
    slamFx(this.x + 60, 'rgba(255,160,60,0.9)', 1.1);
    if (this.phase === 2) {
      this.spawn(Haz.wave(this.x + 140, 1, 300, '#ffa040'));
      this.spawn(Haz.wave(this.x - 140, -1, 300, '#ffa040'));
    }
    yield* this.waitAnim();
    this.anim.play('idle');
    yield 0.4;
  }

  // 입에서 화염구를 훑듯이 뿜어요 (하나하나 패링 가능)
  *fireSpray() {
    this.face();
    this.tell('parry');
    this.anim.play('attack', 1.2, true);
    const n = this.phase === 2 ? 12 : 9;
    // 훑고 지나갈 부채꼴 길
    const hh = this.headPos();
    for (let i = 0; i < n; i += 2) {
      const a = lerp(0.55, -0.2, i / (n - 1));
      this.warnLine(hh.x, hh.y + 20, this.facing > 0 ? a : Math.PI - a, 340, 8 / 12 + i * 0.09, 'parry');
    }
    yield* this.waitFrame(8);
    this.anim.speed = 0;
    for (let i = 0; i < n; i++) {
      const h = this.headPos();
      const a = lerp(0.55, -0.2, i / (n - 1));
      const ang = this.facing > 0 ? a : Math.PI - a;
      this.spawn(Haz.shot('fire', h.x, h.y + 20, Math.cos(ang) * 300, Math.sin(ang) * 300, { dmg: 11, size: 0.8, posture: 12 }));
      Sfx.fire();
      FX.burst(h.x, h.y + 20, 6, { color: ['#ff9a2a', '#ffd040'], min: 40, max: 140 });
      FX.add(new GlowFx(h.x, h.y + 20, 50, 'rgba(255,140,40,0.7)', 0.12));
      if (i % 3 === 0) FX.smoke(h.x, h.y + 20, 2, { color: 'rgba(50,25,20,0.4)', size: 7, grow: 18 });
      yield 0.09;
    }
    this.anim.speed = 1.5;
    yield* this.waitFrame(16);
    this.anim.play('idle');
    yield 0.5;
  }

  // 하늘에서 가시가 쏟아져요 (피하기)
  *spikeRain() {
    this.tell('danger');
    this.anim.play('attack', 1.4, true);
    Sfx.roar();
    FX.shake(5, 1.0);
    yield 0.5;
    const n = this.phase === 2 ? 18 : 12;
    for (let i = 0; i < n; i++) {
      const x = i % 4 === 0 ? this.player.x : rand(this.g.camX + 20, this.g.camX + W - 20);
      spikeDrop(this, x, 0.75);
      yield 0.1;
    }
    yield* this.waitAnim();
    this.anim.play('idle');
    yield 0.5;
  }

  // 꼬리 가시를 포물선으로 쏴요 (패링 가능)
  *tailSpikes() {
    this.face();
    this.tell('parry', this.tail());
    // 날아갈 포물선을 미리 정해서 보여줘요
    const n = this.phase === 2 ? 5 : 3;
    const t0 = this.tail();
    const T = 0.9;
    const shots = [];
    for (let i = 0; i < n; i++) {
      const tx = this.player.x + rand(-30, 30);
      const vx = (tx - t0.x) / T;
      const vy = (this.player.y - 20 - t0.y - 0.5 * 700 * T * T) / T;
      shots.push([vx, vy]);
      this.warnArc(t0.x, t0.y, vx, vy, 700, 0.5 + i * 0.25 + 0.15, 'parry');
    }
    yield 0.5;
    for (let i = 0; i < n; i++) {
      const [vx, vy] = shots[i];
      this.spawn(Haz.shot('shard', t0.x, t0.y, vx, vy, { grav: 700, parryable: true, floorDie: true, dmg: 14, posture: 20 }));
      Sfx.bone();
      FX.burst(t0.x, t0.y, 6, { color: ['#8a6a44', '#ffffff'], min: 40, max: 120 });
      yield 0.25;
    }
    yield 0.4;
  }

  // 화산 낙하 (2페이즈, 피하기)
  *volcano() {
    this.tell('danger');
    yield 0.4;
    for (let i = 0; i < 10; i++) {
      const x = i % 3 === 0 ? this.player.x : clamp(this.player.x + rand(-260, 260), 20, ARENA_W - 20);
      this.spawn(Haz.meteor(this.g, x, 0.9, '#ff7a20', { slant: rand(-140, 140), dmg: 20 }));
      yield 0.16;
    }
    yield 0.7;
  }
}

// 보스 목록 (선택 화면 순서)
const BOSS_LIST = [
  { cls: BoneWarden, name: '묘지기 해골', sub: '첫 번째 시련', stage: 0, preview: ['skeleton', 'walk', 1.4], },
  { cls: LanternWraith, name: '등불의 망령', sub: '두 번째 시련', stage: 1, preview: ['ghost', 'fly', 1.5], },
  { cls: Nightmare, name: '푸른 악몽마', sub: '세 번째 시련', stage: 2, preview: ['nightmare', 'idle', 0.85], },
  { cls: HellBeast, name: '지옥 야수', sub: '네 번째 시련', stage: 3, preview: ['beast', 'idle', 1.15], },
  { cls: SpikedDragon, name: '가시 드래곤', sub: '마지막 시련', stage: 4, preview: ['dragon', 'idle', 0.42], },
];
