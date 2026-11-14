'use strict';
// =============================================================
//  보스 공통 뼈대
//  스킬은 "제너레이터 함수(function*)" 로 써요.
//    yield 0.5  → 0.5초 기다리기
//    yield 0    → 다음 화면까지 기다리기
//  이렇게 하면 "신호 → 기다림 → 공격" 순서를 위에서 아래로 읽기 쉽게 쓸 수 있어요.
// =============================================================

class Boss {
  constructor(g, o) {
    this.g = g;
    Object.assign(this, {
      name: '보스', title: '', sprite: 'skeleton', idleAnim: 'walk', scale: 2,
      maxHp: 400, maxPosture: 100,
      hw: 60, hh: 100, hox: 0, hoy: 0,      // 맞는 범위 (너비, 높이, 옆/위 어긋남)
      headX: 0, headY: -100,                 // 머리 위치 (신호 별이 뜨는 곳)
      x: 650, y: GROUND, vx: 0, vy: 0, facing: -1,
      flying: false, aura: '#ff3a3a',
      knock: 1,                              // 맞았을 때 밀려나는 정도 (무거울수록 작게)
    }, o);
    this.hp = this.maxHp;
    this.posture = 0; this.postureIdle = 0;
    this.anim = new Anim(this.sprite, this.idleAnim);
    this.phase = 1; this.speedMul = 1;
    this.stunT = 0; this.flashT = 0; this.jitT = 0; this.squashT = 0;
    this.dead = false; this.deadT = 0;
    this.gen = this.intro(); this.wait = 0;
    this.lastSkill = null; this.invuln = true; this.hidden = false;
    this.alpha = 1; this.t = 0; this.dt = 0;
    this.manualFrame = -1;     // 0 이상이면 애니메이션 대신 이 프레임을 그려요
  }

  get player() { return this.g.player; }
  hurtbox() {
    return { x: this.x + this.hox * this.facing - this.hw / 2, y: this.y - this.hoy - this.hh, w: this.hw, h: this.hh };
  }
  headPos() { return { x: this.x + this.headX * this.facing, y: this.y + this.headY }; }
  dirTo() { return Math.sign(this.player.x - this.x) || this.facing; }
  dist() { return Math.abs(this.player.x - this.x); }
  face() { this.facing = this.dirTo(); }
  spawn(hz) { this.g.addHazard(hz); return hz; }

  // 공격 신호: 'parry' = 노란 빛 (패링 가능), 'danger' = 붉은 빛 (피하기)
  tell(type, at) {
    const p = at || this.headPos();
    const follow = at ? null : () => this.headPos();
    if (this.pendingCall) { this.announce(this.pendingCall.name, this.pendingCall.kind); this.pendingCall = null; }
    if (type === 'parry') {
      FX.add(new TellFx(p.x, p.y, false, follow));
      FX.add(new GlowFx(p.x, p.y, 46, 'rgba(255,220,80,0.6)', 0.45, follow));
      Sfx.tellParry();
    } else {
      FX.add(new TellFx(p.x, p.y, true, follow));
      FX.add(new GlowFx(p.x, p.y, 60, 'rgba(255,30,30,0.75)', 0.6, follow));
      this.dangerT = 0.6;            // 몸이 잠깐 붉게 빛나요
      Sfx.tellDanger();
    }
  }

  // ---------- 공격 예고 ----------
  // 스킬 이름표 (kind: 'parry' 패링, 'danger' 회피, 'mix' 섞임)
  announce(name, kind) { FX.callout(() => this.headPos(), name, kind, 1.5); }
  // 맞는 범위 칸 — Haz.melee 와 같은 ox, oy, w, h 를 넣으면 실제 판정과 같은 자리에 그려져요
  warnBox(ox, oy, w, h, time, kind = 'danger') {
    const b = this;
    FX.add(new ZoneFx(() => ({ x: b.x + ox * b.facing - w / 2, y: b.y + oy - h / 2, w, h }), time, kind, this));
  }
  // 고정된 자리의 범위 칸
  warnRect(x, y, w, h, time, kind = 'danger') {
    FX.add(new ZoneFx(() => ({ x: x - w / 2, y: y - h / 2, w, h }), time, kind, this));
  }
  // 곧게 날아가는 탄의 경로
  warnLine(x0, y0, ang, len, time, kind = 'parry') {
    const sn = Math.sin(ang);
    if (sn > 0.01) len = Math.min(len, (GROUND - 2 - y0) / sn);   // 땅 밑으로는 안 그려요
    FX.add(new PathFx([[x0, y0], [x0 + Math.cos(ang) * len, y0 + Math.sin(ang) * len]], time, kind, this));
  }
  // 포물선으로 날아가는 탄의 경로 (땅에 닿을 때까지)
  warnArc(x0, y0, vx, vy, grav, time, kind = 'parry') {
    const pts = [[x0, y0]];
    let x = x0, y = y0, t = 0;
    while (y < GROUND && t < 3) { t += 0.03; vy += grav * 0.03; x += vx * 0.03; y += vy * 0.03; pts.push([x, Math.min(y, GROUND)]); }
    FX.add(new PathFx(pts, time, kind, this));
  }
  // 땅을 따라오는 방향 띠
  warnLane(x0, x1, h, time, kind = 'danger', y = GROUND) {
    FX.add(new LaneFx(clamp(x0, 0, ARENA_W), clamp(x1, 0, ARENA_W), y, h, time, kind, this));
  }
  // 양쪽으로 퍼지는 충격파 예고
  warnWaves(x, time, len = 320) {
    this.warnLane(x, x + len, 30, time);
    this.warnLane(x, x - len, 30, time);
  }

  // ---------- 맞기 ----------
  takeHit(dmg, o = {}) {
    if (this.dead || this.invuln || this.hidden) return false;
    const stunned = this.stunT > 0;
    let d = dmg * (stunned ? 1.6 : 1);
    d = Math.max(1, Math.round(d));
    this.hp -= d;
    this.flashT = 0.1;
    this.jitT = o.big ? 0.16 : 0.1;       // 몸이 부르르 떨려요
    this.squashT = 0.12;
    if (o.dir) this.x += o.dir * (o.big ? 7 : 3) * this.knock;
    this.g.stats.dealt += d;
    const crit = stunned || o.crit;
    FX.text(this.x + rand(-20, 20), this.y - this.hoy - this.hh - 6, String(d), { color: crit ? '#ffd25a' : '#ffffff', size: crit ? 13 : 10, bold: crit });
    if (!stunned && o.posture) this.addPosture(o.posture);
    if (this.hp <= 0) { this.hp = 0; this.die(); return true; }
    if (this.phase === 1 && this.hp <= this.maxHp * 0.5) { this.startPhase2(); return true; }
    // 쉬지 않고 계속 베면 보스가 몸 주위를 터뜨려 반격해요 (피하기)
    if (!stunned) {
      this.recentHits = (this.recentHits || []).filter(t => this.t - t < 2.5);
      this.recentHits.push(this.t);
      if (this.recentHits.length >= 7 && this.t > (this.counterReady || 0)) {
        this.counterReady = this.t + 7;
        this.recentHits = [];
        this.gen = this.counterBurst();
        this.wait = 0;
      }
    }
    return true;
  }

  // 반격 폭발: 붉은 신호 뒤 몸 주위가 터져요
  *counterBurst() {
    this.onInterrupt();
    this.vx = 0;
    this.face();
    this.tell('danger');
    this.announce('반격 폭발', 'danger');
    this.warnBox(this.hox, -(this.hoy + this.hh / 2), this.hw + 130, this.hh + 20, 0.42);
    yield 0.42;
    const cx = this.x + this.hox * this.facing, cy = this.y - this.hoy - this.hh / 2;
    Sfx.boom();
    FX.shake(6, 0.25);
    FX.explode(cx, cy, this.hw / 2 + 40, [this.aura, '#ffffff'], { smoke: false });
    FX.add(new ShockFx(cx, GROUND, 10, this.hw / 2 + 110, this.aura, 0.4, 10, 0.25));
    this.spawn(new Hazard({ follow: this, ox: this.hox, oy: -(this.hoy + this.hh / 2), w: this.hw + 130, h: this.hh + 20, dmg: 14, parryable: false, kb: 340, life: 0.12, kind: 'melee' }));
    yield 0.5;
  }
  // 스킬이 중간에 끊길 때 정리할 것 (보스마다 다시 써요)
  onInterrupt() { this.pendingCall = null; this.manualFrame = -1; this.hidden = false; this.alpha = 1; this.invuln = false; this.anim.play(this.idleAnim, 1); }

  addPosture(v) {
    if (this.dead || this.stunT > 0 || this.invuln) return;
    this.posture += v;
    if (v >= 10) this.postureIdle = 0;     // 패링처럼 큰 충격만 회복을 멈춰요
    if (this.posture >= this.maxPosture) this.breakPosture();
  }

  // 체간이 가득 차면 쓰러져요 → 큰 피해를 받을 기회
  breakPosture() {
    this.posture = this.maxPosture;
    this.stunT = 2.6;
    this.gen = null; this.wait = 0; this.pendingCall = null;
    this.vx = 0;
    this.hidden = false; this.alpha = 1; this.manualFrame = -1;
    const c = this.headPos();
    Sfx.breakPosture();
    FX.text(c.x, c.y - 14, T('체간 붕괴!'), { color: '#ffd25a', size: 18, bold: true, life: 1.5 });
    FX.add(new ImpactFx(c.x, c.y, 90, '#ffd25a', 0.3, 4, 0));
    FX.add(new ImpactFx(c.x, c.y, 60, '#ffffff', 0.22, 4, Math.PI / 4));
    FX.add(new RaysFx(c.x, c.y, 18, 200, '#ffd25a', 0.7, 0.04));
    FX.add(new ShockFx(c.x, c.y, 6, 140, 'rgba(255,210,90,0.8)', 0.6, 14));
    FX.add(new RingFx(c.x, c.y, 6, 100, '#ffffff', 0.45, 3));
    FX.add(new SpeedLinesFx('rgba(255,230,150,0.9)', 0.6, 50));
    FX.sparks(c.x, c.y, 40, { color: ['#ffd25a', '#ffffff', '#ff9b1a'], min: 200, max: 650, grav: 300, life: 0.6 });
    // 깨진 체간 조각
    FX.burst(c.x, c.y, 16, { color: ['#ffe9a0', '#ffd25a'], min: 80, max: 260, life: 1, grav: 500, size: 4, glow: false });
    FX.flash('#ffffff', 0.18);
    FX.punch(0.1, 0.5, c.x, c.y);
    FX.impact(0.06);
    FX.chroma(4);
    for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU + rand(-0.3, 0.3); FX.add(new LightningFx(c.x, c.y, c.x + Math.cos(a) * 90, c.y + Math.sin(a) * 90, '#ffd25a', 0.35, 8, 9, 1.6)); }
    FX.shake(6, 0.3);
    this.g.hitstop = Math.max(this.g.hitstop, 0.18);
    this.g.slow(0.3, 0.6);
    this.onStun();
  }
  onStun() {}
  onRecover() { this.anim.play(this.idleAnim); }

  startPhase2() {
    if (!this.phase2Script) return;
    this.phase = 2;
    this.speedMul = 1.22;
    this.onInterrupt();
    this.gen = this.phase2Script();
    this.wait = 0;
    this.stunT = 0;
  }

  // 2페이즈 시작 연출 (포효)
  *roar(color) {
    this.announce('분노의 포효', 'danger');
    this.invuln = true;
    this.vx = 0;
    const c = this.headPos();
    Sfx.roar();
    FX.flash(color, 0.3);
    FX.shake(8, 1.0);
    FX.text(c.x, c.y - 20, T('분노!'), { color, size: 16, bold: true, life: 1.4 });
    FX.add(new RaysFx(c.x, c.y, 16, 260, color, 1.2, 0.05, () => this.headPos()));
    FX.add(new SpeedLinesFx(color, 1.0, 50));
    FX.punch(0.06, 1.0, c.x, c.y);
    FX.chroma(3);
    for (let i = 0; i < 4; i++) FX.add(new LightningFx(c.x, c.y, c.x + rand(-160, 160), GROUND, color, 0.5, 10, 12, 2));
    for (let i = 0; i < 4; i++) {
      FX.add(new ShockFx(c.x, c.y, 10, 240, color, 0.7, 12));
      FX.add(new RingFx(c.x, c.y, 10, 220, '#ffffff', 0.6, 2));
      // 가까이 있던 기사를 밀어내요
      const p = this.player;
      if (i === 0 && Math.abs(p.x - this.x) < 160 && p.state !== 'dead') { p.vx = Math.sign(p.x - this.x || 1) * 320; p.vy = -200; p.onGround = false; }
      FX.burst(c.x, c.y, 16, { color: [color, '#ffffff'], min: 100, max: 300, life: 0.6 });
      yield 0.25;
    }
    this.invuln = false;
    yield 0.3;
  }

  die() {
    this.dead = true; this.deadT = 0;
    this.gen = null; this.vx = 0;
    this.hidden = false; this.alpha = 1;
    const c = this.headPos();
    Sfx.boom();
    FX.flash('#ffffff', 0.45);
    FX.shake(10, 0.8);
    FX.explode(c.x, c.y, 60, [this.aura, '#ffffff']);
    FX.add(new RaysFx(c.x, c.y, 24, 320, this.aura, 1.6, 0.04));
    FX.add(new RingFx(c.x, c.y, 10, 300, '#ffffff', 0.9, 6));
    FX.add(new SpeedLinesFx('#ffffff', 0.8, 60));
    FX.punch(0.12, 1.2, c.x, c.y);
    FX.impact(0.09);
    FX.chroma(5);
    this.boomT = 0;
    this.g.hitstop = 0.25;
    this.g.slow(0.25, 1.4);
    // 남은 공격은 모두 사라져요
    for (const h of this.g.hazards) if (!h.friendly) h.dead = true;
    for (const m of this.g.minions) m.hp = 0;
    this.onDeath();
    this.g.onBossDeath();
  }
  onDeath() { }

  // 쓰러진 뒤: 기본은 빛 조각이 되어 흩어져요
  // 쓰러지는 동안 몸 곳곳에서 빛이 터져요
  deathBursts(dt, until) {
    this.boomT = (this.boomT || 0) - dt;
    if (this.deadT < until && this.boomT <= 0) {
      this.boomT = rand(0.1, 0.22);
      const b = this.hurtbox();
      const x = rand(b.x, b.x + b.w), y = rand(b.y, b.y + b.h);
      FX.explode(x, y, rand(14, 26), [this.aura, '#ffffff'], { smoke: false, rays: Math.random() < 0.4 });
      Sfx.hit(true);
      FX.shake(3, 0.1);
    }
  }
  updateDeath(dt) {
    this.deathBursts(dt, 1.6);
    this.alpha = Math.max(0, 1 - this.deadT / 2.2);
    if (this.deadT < 2.2 && Math.random() < dt * 60) {
      const b = this.hurtbox();
      FX.particle({ x: rand(b.x, b.x + b.w), y: rand(b.y, b.y + b.h), vx: rand(-20, 20), vy: rand(-90, -30), life: rand(0.6, 1.2), size: rand(1, 3), color: pick([this.aura, '#ffffff']), glow: true, floor: false });
    }
  }

  // ---------- 매 프레임 ----------
  update(dt) {
    this.t += dt; this.dt = dt;
    this.flashT -= dt; this.jitT -= dt; this.squashT -= dt;
    this.anim.update(dt * (this.phase === 2 ? 1.1 : 1));
    if (this.dead) { this.deadT += dt; this.updateDeath(dt); this.physics(dt); return; }

    if (this.stunT > 0) {
      this.stunT -= dt;
      this.vx = approach(this.vx, 0, 600 * dt);
      this.physics(dt);
      if (this.stunT <= 0) { this.posture = 0; this.onRecover(); }
      return;
    }

    // 한동안 패링 당하지 않으면 체간이 천천히 회복돼요
    this.postureIdle += dt;
    if (this.postureIdle > 2) this.posture = Math.max(0, this.posture - 10 * dt);

    // 스킬 진행
    if (!this.gen) this.gen = this.brain();
    if (this.wait > 0) this.wait -= dt * this.speedMul;
    else {
      const r = this.gen.next();
      if (r.done) this.gen = null;
      else this.wait = r.value || 0;
    }
    if (this.tick) this.tick(dt);
    this.physics(dt);
  }

  physics(dt) {
    this.x += this.vx * dt;
    if (!this.flying) {
      this.vy += GRAV * dt;
      this.y += this.vy * dt;
      if (this.y >= GROUND) { this.y = GROUND; this.vy = 0; }
    } else {
      this.y += this.vy * dt;
    }
    const m = this.hw / 2;
    this.x = clamp(this.x, m, ARENA_W - m);
  }

  // ---------- 스킬 고르기 ----------
  *brain() {
    const s = this.chooseSkill();
    this.lastSkill = s;
    this.pendingCall = s.name ? s : null;
    if (s.now && s.name) { this.announce(s.name, s.kind); this.pendingCall = null; }
    yield* s.fn.call(this);
    this.vx = 0;
    yield rand(0.25, 0.6) / (this.phase === 2 ? 1.3 : 1);
  }

  chooseSkill() {
    let list = this.skills.filter(s => (s.phase || 1) <= this.phase && (!s.when || s.when.call(this)));
    if (list.length > 1) list = list.filter(s => s !== this.lastSkill);
    const total = list.reduce((a, s) => a + (s.w || 1), 0);
    let r = Math.random() * total;
    for (const s of list) { r -= (s.w || 1); if (r <= 0) return s; }
    return list[0];
  }

  // ---------- 자주 쓰는 동작 ----------
  *waitAnim() { while (!this.anim.done) yield 0; }
  *waitFrame(f) { while (this.anim.frame < f && !this.anim.done) yield 0; }
  *walkTo(tx, speed, maxT = 2, animName) {
    let t = 0;
    if (animName) this.anim.play(animName);
    while (Math.abs(tx - this.x) > 6 && t < maxT) {
      this.facing = Math.sign(tx - this.x);
      this.vx = this.facing * speed * this.speedMul;
      t += this.dt;
      yield 0;
    }
    this.vx = 0;
  }
  *closeIn(range, speed, maxT = 2.5, animName) {
    let t = 0;
    if (animName) this.anim.play(animName);
    while (this.dist() > range && t < maxT) {
      this.face();
      this.vx = this.facing * speed * this.speedMul;
      t += this.dt;
      yield 0;
    }
    this.vx = 0;
    this.face();
  }

  // ---------- 그리기 ----------
  drawBody(ctx, opt) {
    const f = this.manualFrame >= 0 ? this.manualFrame : this.anim.frame;
    // 맞은 직후: 좌우로 떨리고 살짝 납작해졌다 돌아와요
    const jx = this.jitT > 0 ? (Math.random() - 0.5) * 4 * (this.jitT / 0.16) : 0;
    const sq = this.squashT > 0 ? this.squashT / 0.12 : 0;
    const o = Object.assign({ sx: 1 + 0.05 * sq, sy: 1 - 0.05 * sq }, opt);
    drawSprite(ctx, this.sprite, this.anim.name, f, this.x + jx, this.y, this.scale, this.facing, o);
  }

  draw(ctx) {
    if (this.hidden) return;
    // 그림자
    ctx.save();
    ctx.globalAlpha = 0.35 * this.alpha;
    ctx.fillStyle = '#000';
    const sw = this.hw * 0.9 * clamp(1 - (GROUND - this.y) / 300, 0.3, 1);
    ctx.beginPath(); ctx.ellipse(this.x + this.hox * this.facing, GROUND, sw / 2, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // 2페이즈 기운
    if (this.phase === 2 && !this.dead) {
      const b = this.hurtbox();
      glowCircle(ctx, b.x + b.w / 2, b.y + b.h / 2, Math.max(b.w, b.h) * 0.8, this.aura, 0.25 + 0.1 * Math.sin(this.t * 8));
      if (Math.random() < 0.4) FX.particle({ x: rand(b.x, b.x + b.w), y: b.y + b.h, vx: rand(-10, 10), vy: rand(-80, -30), life: 0.6, size: 2, color: this.aura, glow: true, floor: false });
    }

    this.drawBody(ctx, { alpha: this.alpha });
    if (this.flashT > 0) this.drawBody(ctx, { white: true, alpha: 0.5 * this.alpha });
    if (this.dangerT > 0) {
      // 피해야 하는 공격 직전: 몸이 붉게 깜빡여요
      this.dangerT -= this.dt;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      this.drawBody(ctx, { white: true, alpha: 0.12 + 0.12 * Math.sin(this.t * 40) });
      ctx.restore();
      const b = this.hurtbox();
      glowCircle(ctx, b.x + b.w / 2, b.y + b.h / 2, Math.max(b.w, b.h) * 0.7, 'rgba(255,30,30,0.5)', 0.5 * (0.6 + 0.4 * Math.sin(this.t * 40)));
    }
    if (this.stunT > 0) {
      // 비틀거릴 때 노란 빛 + 머리 위 별
      this.drawBody(ctx, { white: true, alpha: 0.15 + 0.1 * Math.sin(this.t * 20), comp: 'lighter' });
      const c = this.headPos();
      for (let i = 0; i < 3; i++) {
        const a = this.t * 5 + (i * Math.PI * 2) / 3;
        const sx = c.x + Math.cos(a) * 18, sy = c.y - 14 + Math.sin(a) * 5;
        ctx.fillStyle = '#ffd25a';
        ctx.fillRect(Math.round(sx) - 1, Math.round(sy) - 3, 2, 6);
        ctx.fillRect(Math.round(sx) - 3, Math.round(sy) - 1, 6, 2);
      }
    }
    if (this.g.debug) {
      const b = this.hurtbox();
      ctx.strokeStyle = '#ff0'; ctx.strokeRect(b.x, b.y, b.w, b.h);
    }
  }
}

// =============================================================
//  졸개: 땅에서 기어 나오는 작은 해골
// =============================================================
class Minion {
  constructor(g, x) {
    this.g = g;
    this.x = x; this.y = GROUND; this.facing = -1;
    this.hp = 26; this.anim = new Anim('skeleton', 'appear');
    this.state = 'appear'; this.atkCd = 0.8; this.flashT = 0; this.dead = false; this.t = 0;
    this.scale = 1.6;
    FX.burst(x, GROUND, 10, { angle: -Math.PI / 2, spread: 1.6, color: ['#6a5a48', '#a89878'], glow: false, min: 40, max: 140, grav: 400 });
  }
  hurtbox() { return { x: this.x - 16, y: this.y - 66, w: 32, h: 66 }; }
  takeHit(dmg) {
    if (this.dead || this.state === 'appear') return false;
    this.hp -= dmg; this.flashT = 0.1;
    this.x += Math.sign(this.x - this.g.player.x) * 10;
    if (this.hp <= 0) this.kill();
    return true;
  }
  kill() {
    if (this.dead) return;
    this.dead = true;
    Sfx.bone();
    FX.burst(this.x, this.y - 30, 18, { color: ['#e8dcc0', '#b8a888', '#8a2a2a'], glow: false, min: 60, max: 220, grav: 600, life: 0.8 });
  }
  update(dt) {
    this.t += dt; this.flashT -= dt;
    if (this.hp <= 0) { this.kill(); return; }
    this.anim.update(dt);
    const p = this.g.player;
    if (this.state === 'appear') {
      if (this.anim.done) { this.state = 'walk'; this.anim.play('walk'); }
      return;
    }
    this.atkCd -= dt;
    const d = p.x - this.x;
    this.facing = Math.sign(d) || this.facing;
    if (this.state === 'walk') {
      if (Math.abs(d) > 30) this.x += this.facing * 55 * dt;
      if (Math.abs(d) < 46 && this.atkCd <= 0 && p.state !== 'dead') {
        this.state = 'swing'; this.swingT = 0;
        FX.add(new GlintFx(this.x + this.facing * 14, this.y - 50, '#ffd84a', 14, 0.35));
        Sfx.tellParry();
      }
    } else if (this.state === 'swing') {
      this.swingT += dt;
      if (this.swingT > 0.42 && !this.swung) {
        this.swung = true;
        this.g.addHazard(new Hazard({ follow: this, ox: 26, oy: -34, w: 40, h: 50, dmg: 9, posture: 0, life: 0.12, kind: 'melee',
          onParry: () => { this.hp = 0; } }));
        FX.add(new ArcFx(this.x + this.facing * 12, this.y - 36, 22, this.facing > 0 ? -1.2 : Math.PI + 1.2, this.facing > 0 ? 1.2 : Math.PI - 1.2, '#ff5a5a', 0.15, 3));
      }
      if (this.swingT > 0.8) { this.state = 'walk'; this.swung = false; this.atkCd = 1.4; }
    }
  }
  draw(ctx) {
    const f = this.anim.frame;
    drawSprite(ctx, 'skeleton', this.anim.name, f, this.x, this.y, this.scale, this.facing);
    if (this.flashT > 0) drawSprite(ctx, 'skeleton', this.anim.name, f, this.x, this.y, this.scale, this.facing, { white: true, alpha: 0.8 });
  }
}
