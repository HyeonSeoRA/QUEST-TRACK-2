'use strict';
// =============================================================
//  주인공 기사 — 이동, 점프, 근거리 3연타, 원거리 참격(검기), 패링, 대시, 포션
//  A D 이동 / W·Space 점프 / Q 원거리 참격 / E 근거리 공격 / F 패링 / Shift 대시 / R 포션
// =============================================================

const GRAV = 1500;
const RUN_SPEED = 165;
const JUMP_V = 500;
const ENERGY_MAX = 3;       // 기력 게이지 3칸 (원거리 참격 1번 = 1칸)

// 근거리 3연타 정보
//  hitFrom~hitTo: 칼이 닿는 프레임, r0~r1: 앞쪽 판정 거리, y0: 판정 높이(위쪽)
//  slash: 칼날 궤적 이펙트 (오른쪽을 볼 때 기준 각도)
const ATTACKS = [
  { anim: 'attack1', speed: 1.6, hitFrom: 3, hitTo: 4, chainFrom: 4, r0: -8, r1: 54, y0: -62, dmg: 9, posture: 1, lunge: 70, gain: 0.16,
    slash: { cx: 8, cy: -30, r: 40, a0: -1.9, a1: 0.8, thick: 11 } },
  { anim: 'attack2', speed: 1.6, hitFrom: 2, hitTo: 3, chainFrom: 3, r0: -12, r1: 58, y0: -78, dmg: 11, posture: 2, lunge: 80, gain: 0.18,
    slash: { cx: 10, cy: -34, r: 46, a0: 1.1, a1: -1.75, thick: 12 } },
  { anim: 'attack3', speed: 1.45, hitFrom: 4, hitTo: 5, chainFrom: 99, r0: -12, r1: 78, y0: -96, dmg: 20, posture: 4, lunge: 150, big: true, gain: 0.3,
    slash: { cx: 12, cy: -42, r: 60, a0: -2.5, a1: 1.3, thick: 18 } },
];

function approach(v, target, step) {
  return v < target ? Math.min(v + step, target) : Math.max(v - step, target);
}

class Player {
  constructor(g) {
    this.g = g;
    const m = g.mods;
    this.x = 300; this.y = GROUND; this.vx = 0; this.vy = 0;
    this.facing = 1; this.onGround = true; this.coyote = 0;
    this.anim = new Anim('knight', 'idle');
    this.state = 'free'; this.stateT = 0;
    this.maxHp = m.maxHp; this.hp = this.maxHp;
    this.potions = m.potions; this.maxPotions = m.potions;
    this.energy = 1;          // 시작할 때 1칸
    this.invuln = 0; this.dashCd = 0; this.riposte = 0;
    this.combo = 0; this.hitSet = new Set(); this.swung = false; this.fired = false;
    this.bufAtk = 0; this.bufJump = 0; this.bufParry = 0; this.bufDash = 0; this.bufHeal = 0; this.bufRanged = 0;
    this.parried = false; this.healed = false; this.afterT = 0; this.t = 0;
    this.sqx = 1; this.sqy = 1;       // 늘었다 줄었다 (점프·착지·대시 때)
    this.airDash = true;              // 공중 대시는 땅에 닿기 전까지 한 번
    this.wallDir = 0;                 // 벽에 붙어 있으면 그 쪽 (-1 왼쪽 벽, 1 오른쪽 벽)
    this.stats = { hits: 0, parries: 0, taken: 0, potions: 0 };
  }

  hurtbox() { return { x: this.x - 9, y: this.y - 42, w: 18, h: 42 }; }
  get parrying() { return this.state === 'parry' && this.stateT < this.g.mods.parryWin; }

  // 한 화면 그릴 때 한 번 키 입력을 읽어서 잠깐 기억해 둬요 (입력 버퍼)
  readInput() {
    if (Input.hit('attack')) this.bufAtk = 0.22;
    if (Input.hit('ranged')) this.bufRanged = 0.15;
    if (Input.hit('jump')) this.bufJump = 0.12;
    if (Input.hit('parry')) this.bufParry = 0.1;
    if (Input.hit('dash')) this.bufDash = 0.12;
    if (Input.hit('heal')) this.bufHeal = 0.1;
  }

  moveDir() { return (Input.held('right') ? 1 : 0) - (Input.held('left') ? 1 : 0); }
  setFree() { this.state = 'free'; this.stateT = 0; }
  squash(x, y) { this.sqx = x; this.sqy = y; }

  gainEnergy(v) {
    const before = Math.floor(this.energy);
    this.energy = Math.min(ENERGY_MAX, this.energy + v);
    if (Math.floor(this.energy) > before) {
      // 한 칸이 찼을 때 반짝
      FX.add(new RingFx(this.x, this.y - 22, 4, 26, '#5fe8ff', 0.3, 2));
      FX.burst(this.x, this.y - 22, 8, { color: ['#5fe8ff', '#ffffff'], min: 40, max: 120, life: 0.4 });
    }
  }

  update(dt) {
    const m = this.g.mods;
    this.t += dt;
    this.stateT += dt;
    const back = 1 - Math.exp(-dt * 14);
    this.sqx = lerp(this.sqx, 1, back); this.sqy = lerp(this.sqy, 1, back);
    this.invuln -= dt; this.dashCd -= dt; this.riposte -= dt;
    this.bufAtk -= dt; this.bufJump -= dt; this.bufParry -= dt; this.bufDash -= dt; this.bufHeal -= dt; this.bufRanged -= dt;
    if (!this.onGround) this.coyote -= dt;

    let gravScale = 1;
    switch (this.state) {
      case 'dead':
        this.vx = approach(this.vx, 0, 400 * dt);
        break;

      case 'hurt':
        this.vx = approach(this.vx, 0, 600 * dt);
        if (this.stateT > 0.38) this.setFree();
        break;

      case 'heal':
        this.vx = approach(this.vx, 0, 1200 * dt);
        if (Math.random() < dt * 60) FX.particle({ x: this.x + rand(-14, 14), y: this.y - rand(0, 44), vy: rand(-70, -20), life: 0.6, size: 2, color: pick(['#7dffb0', '#d0ffe0', '#ffffff']), glow: true, floor: false });
        if (!this.healed && this.stateT > 0.45) {
          this.healed = true;
          const amt = Math.round(this.maxHp * 0.4);
          this.hp = Math.min(this.maxHp, this.hp + amt);
          Sfx.heal();
          FX.text(this.x, this.y - 55, '+' + amt, { color: '#7dffb0', size: 11, bold: true });
          FX.add(new ShockFx(this.x, this.y - 20, 4, 44, 'rgba(120,255,170,0.7)', 0.45, 6));
          FX.add(new RaysFx(this.x, this.y - 20, 8, 50, '#7dffb0', 0.4, 0.06));
          FX.add(new GlowFx(this.x, this.y - 20, 50, 'rgba(120,255,170,0.6)', 0.5));
        }
        if (this.stateT > 0.7) this.setFree();
        break;

      case 'dash': {
        gravScale = 0;
        this.vy = 0;
        this.afterT -= dt;
        if (this.afterT <= 0) {
          this.afterT = 0.02;
          FX.add(new AfterImageFx('knight', this.anim.name, this.anim.frame, this.x, this.y, 1, this.facing, '#7fe8ff', 0.28), true);
        }
        for (let i = 0; i < 2; i++) FX.particle({ x: this.x - this.facing * rand(0, 10), y: this.y - rand(4, 40), vx: -this.facing * rand(60, 200), vy: 0, life: 0.25, size: 1, color: pick(['#9ff4ff', '#ffffff']), glow: true, floor: false, kind: 'spark' });
        if (this.stateT > 0.2) { this.vx *= 0.35; this.setFree(); }
        break;
      }

      case 'parry':
        this.vx = approach(this.vx, 0, 1500 * dt);
        if (!this.onGround) gravScale = 0.4;
        // 패링에 성공하면 바로 반격으로 이어갈 수 있어요
        if (this.parried && this.stateT > 0.05 && this.bufAtk > 0) { this.startAttack(0); break; }
        if (this.parried && this.stateT > 0.05 && this.bufRanged > 0 && this.energy >= 1) { this.startRanged(); break; }
        if (this.parried && this.stateT > 0.05 && this.bufDash > 0) { this.startDash(); break; }
        if (this.stateT > m.parryWin + (this.parried ? 0.08 : 0.24)) this.setFree();
        break;

      case 'ranged': {
        this.vx = approach(this.vx, 0, 900 * dt);
        if (!this.onGround) { gravScale = 0.3; if (this.vy > 60) this.vy = 60; }
        const f = this.anim.frame;
        if (f >= 2 && !this.fired) this.fireWave();
        if (this.fired && f >= 4) {
          if (this.bufParry > 0) { this.startParry(); break; }
          if (this.bufDash > 0 && this.dashCd <= 0) { this.startDash(); break; }
          if (this.bufAtk > 0) { this.startAttack(0); break; }
        }
        if (this.anim.done) this.setFree();
        break;
      }

      case 'attack': {
        const A = ATTACKS[this.combo];
        const f = this.anim.frame;
        this.vx = approach(this.vx, 0, 700 * dt);
        if (!this.onGround) { gravScale = 0.45; if (this.vy > 120) this.vy = 120; }
        if (f >= A.hitFrom && !this.swung) { this.swung = true; this.swingFx(A); }
        if (f >= A.hitFrom && f <= A.hitTo) this.doHit(A);
        // 다음 연타
        if (this.bufAtk > 0 && f >= A.chainFrom && this.combo < 2) { this.startAttack(this.combo + 1); break; }
        // 칼을 다 휘두른 뒤에는 패링·대시·검기로 끊을 수 있어요 (휘두르기 전에도 패링은 가능)
        if (f < A.hitFrom || f > A.hitTo) {
          if (this.bufParry > 0) { this.startParry(); break; }
          if (f > A.hitTo && this.bufDash > 0 && this.dashCd <= 0 && (this.onGround || this.airDash)) { this.startDash(); break; }
          if (f > A.hitTo && this.bufRanged > 0 && this.energy >= 1) { this.startRanged(); break; }
          if (f > A.hitTo && this.bufJump > 0 && this.onGround) { this.setFree(); break; }
        }
        if (this.anim.done) this.setFree();
        break;
      }

      default: { // free: 서기, 달리기, 점프, 떨어지기
        const dir = this.moveDir();
        this.vx = approach(this.vx, dir * RUN_SPEED, (this.onGround ? 2200 : 1500) * dt);
        if (dir) this.facing = dir;
        // 벽에 붙어 미끄러지기 (벽 쪽으로 누르고 떨어지는 중)
        this.wallDir = !this.onGround && ((this.x <= 17 && dir < 0) || (this.x >= ARENA_W - 17 && dir > 0)) ? dir : 0;
        if (this.wallDir && this.vy > 90) {
          this.vy = 90;
          if (Math.random() < dt * 30) FX.particle({ x: this.x + this.wallDir * 8, y: this.y - rand(10, 40), vx: -this.wallDir * rand(10, 40), vy: rand(-20, 20), life: 0.3, size: 1.5, color: '#9a9080', glow: false, floor: false });
        }
        if (this.bufJump > 0 && this.wallDir && !this.onGround) {
          // 벽 차고 점프
          this.vy = -JUMP_V * 0.92; this.vx = -this.wallDir * 260; this.facing = -this.wallDir;
          this.bufJump = 0; this.airDash = true; this.wallDir = 0;
          this.squash(0.8, 1.22);
          Sfx.jump();
          FX.burst(this.x - this.facing * 8, this.y - 20, 8, { angle: this.facing > 0 ? 0 : Math.PI, spread: 1.4, color: ['#cfc6b0', '#8a8070'], glow: false, min: 40, max: 140, life: 0.35 });
        }
        if (this.bufJump > 0 && (this.onGround || this.coyote > 0)) {
          this.vy = -JUMP_V; this.onGround = false; this.coyote = 0; this.bufJump = 0;
          this.squash(0.78, 1.25);
          Sfx.jump();
          FX.burst(this.x, GROUND, 8, { angle: -Math.PI / 2, spread: 2.6, color: ['#8a8070', '#6a6050'], glow: false, min: 20, max: 80, life: 0.35 });
          FX.add(new RingFx(this.x, GROUND, 2, 18, 'rgba(255,255,255,0.5)', 0.25, 1.5, 0.3));
        }
        if (!Input.held('jump') && this.vy < -150) this.vy += GRAV * 1.6 * dt;   // 짧게 누르면 낮게 점프
        if (this.onGround && Math.abs(this.vx) > 100 && Math.random() < dt * 12) FX.particle({ x: this.x - this.facing * 6, y: GROUND - 1, vx: -this.facing * rand(10, 30), vy: rand(-30, -10), life: 0.4, size: rand(2, 4), grow: 6, color: 'rgba(120,110,100,0.35)', kind: 'smoke', floor: false, shrink: false });

        if (this.bufDash > 0 && this.dashCd <= 0 && (this.onGround || this.airDash)) this.startDash();
        else if (this.bufParry > 0) this.startParry();
        else if (this.bufAtk > 0) this.startAttack(0);
        else if (this.bufRanged > 0) this.startRanged();
        else if (this.bufHeal > 0 && this.potions > 0 && this.onGround && this.hp < this.maxHp) this.startHeal();
        break;
      }
    }

    // 물리
    if (this.state !== 'dash' || gravScale) this.vy = Math.min(700, this.vy + GRAV * gravScale * dt);
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.y >= GROUND) {
      if (!this.onGround && this.vy > 250) {
        this.squash(1.28, 0.76);
        Sfx.land();
        FX.burst(this.x, GROUND, 7, { angle: -Math.PI / 2, spread: 2.8, color: ['#8a8070', '#6a6050'], glow: false, min: 20, max: 70, life: 0.3 });
        FX.smoke(this.x, GROUND - 2, 3, { color: 'rgba(120,110,100,0.3)', size: 4, grow: 10 });
      }
      this.y = GROUND; this.vy = 0; this.onGround = true; this.coyote = 0.1; this.airDash = true;
    } else if (this.onGround) {
      this.onGround = false;
    }
    this.x = clamp(this.x, 16, ARENA_W - 16);

    this.pickAnim();
    this.anim.update(dt);
  }

  pickAnim() {
    if (this.state === 'free') {
      if (this.onGround) this.anim.play(Math.abs(this.vx) > 25 ? 'run' : 'idle');
      else this.anim.play(this.vy < 0 ? 'jump' : 'fall');
    }
  }

  // ---------- 근거리 공격 ----------
  startAttack(i) {
    const A = ATTACKS[i];
    this.state = 'attack'; this.stateT = 0; this.combo = i;
    this.bufAtk = 0; this.swung = false; this.hitSet.clear();
    const dir = this.moveDir();
    if (dir) this.facing = dir;
    this.anim.play(A.anim, A.speed, true);
    // 보스와 너무 붙어 있으면 앞으로 덜 나가요
    const b = this.g.boss;
    let lunge = A.lunge;
    if (b && !b.dead && Math.abs(b.x - this.x) < 70 && Math.sign(b.x - this.x) === this.facing) lunge *= 0.3;
    this.vx = this.facing * lunge;
  }

  // 칼을 휘두르는 순간의 칼날 궤적
  swingFx(A) {
    const s = A.slash, f = this.facing;
    const gold = this.riposte > 0;
    const opt = gold
      ? { edge: '#ffd25a', glow: 'rgba(255,170,40,0.7)', core: '#fffbe0' }
      : { edge: '#7ff0ff', glow: 'rgba(40,170,255,0.6)', core: '#ffffff' };
    const follow = () => ({ x: this.x, y: this.y });
    FX.add(new SlashFx(f * s.cx, s.cy, s.r, mirrorA(s.a0, f), mirrorA(s.a1, f), Object.assign({ life: A.big ? 0.3 : 0.22, thick: s.thick, follow }, opt)));
    // 바깥쪽에 얇은 두 번째 궤적
    FX.add(new SlashFx(f * s.cx, s.cy, s.r + 7, mirrorA(s.a0 + 0.2, f), mirrorA(s.a1, f), Object.assign({ life: 0.18, thick: s.thick * 0.35, follow }, opt)));
    // 칼날 끝에서 흩날리는 빛가루
    const col = gold ? ['#ffd25a', '#fff6c0'] : ['#7ff0ff', '#ffffff'];
    const cx = this.x + f * s.cx, cy = this.y + s.cy;
    for (let i = 0; i < (A.big ? 22 : 12); i++) {
      const u = Math.random();
      const a = lerp(mirrorA(s.a0, f), mirrorA(s.a1, f), u);
      const tang = a + (mirrorA(s.a1, f) > mirrorA(s.a0, f) ? Math.PI / 2 : -Math.PI / 2);
      const sp = rand(60, 220);
      FX.particle({ x: cx + Math.cos(a) * s.r, y: cy + Math.sin(a) * s.r, vx: Math.cos(tang) * sp, vy: Math.sin(tang) * sp, life: rand(0.2, 0.45), size: rand(1, 2.2), color: pick(col), glow: true, drag: 3, floor: false, kind: Math.random() < 0.5 ? 'spark' : 'sq' });
    }
    FX.add(new GlowFx(cx + f * s.r * 0.5, cy, s.r * 1.1, gold ? 'rgba(255,190,60,0.45)' : 'rgba(80,210,255,0.4)', 0.18));
    Sfx.slash(A.big);
    this.squash(A.big ? 1.22 : 1.1, A.big ? 0.86 : 0.94);
    if (A.big) {
      // 마무리 일격: 땅을 가르는 충격
      const gx = this.x + f * 50;
      FX.add(new ShockFx(gx, GROUND, 4, 60, gold ? 'rgba(255,190,60,0.7)' : 'rgba(80,200,255,0.7)', 0.35, 8, 0.25));
      FX.sparks(gx, GROUND - 2, 14, { angle: -Math.PI / 2, spread: 2.2, color: gold ? ['#ffd25a', '#ffffff'] : ['#7ff0ff', '#ffffff'], min: 100, max: 300, grav: 500 });
      FX.add(new CrackFx(gx, 60, gold ? '#ffd25a' : '#7ff0ff', 1.6), true);
      FX.add(new CutFx(this.x + f * 40, this.y - 40, mirrorA(-1.0, f), 120, gold ? '#ffd25a' : '#7ff0ff', 0.22, 2.5));
      FX.chroma(1.5);
      FX.shake(3, 0.12);
    }
  }

  doHit(A) {
    const box = this.facing > 0
      ? { x: this.x + A.r0, y: this.y + A.y0, w: A.r1 - A.r0, h: -A.y0 }
      : { x: this.x - A.r1, y: this.y + A.y0, w: A.r1 - A.r0, h: -A.y0 };
    const m = this.g.mods;
    for (const t of this.g.targets()) {
      if (this.hitSet.has(t)) continue;
      const hb = t.hurtbox();
      if (!overlap(box, hb)) continue;
      this.hitSet.add(t);
      const crit = this.riposte > 0;
      const dmg = A.dmg * m.atkMul * (crit ? 1.5 * m.riposteMul : 1);
      const hit = t.takeHit(dmg, { posture: A.posture * m.postureMul * (crit ? 2 : 1), dir: this.facing, crit, big: A.big });
      if (!hit) continue;
      this.stats.hits++;
      this.gainEnergy(A.gain * (crit ? 1.5 : 1));
      const cx = (Math.max(box.x, hb.x) + Math.min(box.x + box.w, hb.x + hb.w)) / 2;
      const cy = (Math.max(box.y, hb.y) + Math.min(box.y + box.h, hb.y + hb.h)) / 2;
      hitFx(this.g, cx, cy, this.facing, A.big, crit);
      this.vx -= this.facing * 30;
    }
  }

  // ---------- 원거리 참격 (기력 1칸) ----------
  startRanged() {
    this.bufRanged = 0;
    if (this.energy < 1) {
      FX.text(this.x, this.y - 56, T('기력 부족'), { color: '#8fb8d8', size: 8, life: 0.6 });
      Sfx.whiff();
      return;
    }
    this.energy -= 1;
    this.state = 'ranged'; this.stateT = 0; this.fired = false;
    const dir = this.moveDir();
    if (dir) this.facing = dir;
    this.anim.play('attack2', 1.8, true);
    this.vx = -this.facing * 40;
    // 기를 모으는 빛
    FX.add(new GlowFx(this.x, this.y - 30, 40, 'rgba(90,220,255,0.7)', 0.2));
    FX.burst(this.x, this.y - 30, 10, { color: ['#5fe8ff', '#ffffff'], min: 30, max: 90, life: 0.25 });
  }

  fireWave() {
    this.fired = true;
    const power = this.riposte > 0 ? 1.5 * this.g.mods.riposteMul : 1;
    const x = this.x + this.facing * 26, y = this.y - 34;
    this.g.addHazard(Haz.slashWave(x, y, this.facing, power));
    const col = power > 1 ? '#ffd25a' : '#5fe8ff';
    FX.add(new ImpactFx(x, y, 34, col, 0.15, 4, 0));
    FX.add(new RingFx(x, y, 4, 24, col, 0.2, 2, 1.8));
    FX.sparks(x, y, 14, { angle: this.facing > 0 ? 0 : Math.PI, spread: 1.2, color: [col, '#ffffff'] });
    Sfx.wave();
    FX.chroma(1.2);
    FX.shake(2, 0.1);
  }

  // ---------- 패링 ----------
  startParry() {
    this.state = 'parry'; this.stateT = 0; this.bufParry = 0; this.parried = false;
    this.vx *= 0.2;
    this.anim.play('attack2', 0, true);   // 칼을 세운 자세에서 멈춤
    this.anim.setFrame(1);
    Sfx.whiff();
  }

  // 패링 성공!
  onParry(hz) {
    const m = this.g.mods;
    this.parried = true;
    this.stateT = 0;                     // 판정 시간 다시 열어줘서 연속 공격도 받아낼 수 있어요
    this.invuln = Math.max(this.invuln, 0.12);
    this.riposte = 1.1;
    this.stats.parries++;
    this.gainEnergy(0.5);
    if (hz.x !== undefined) this.facing = Math.sign(hz.x - this.x) || this.facing;
    this.vx = -this.facing * 90;
    if (m.parryHeal) { this.hp = Math.min(this.maxHp, this.hp + m.parryHeal); }
  }

  // ---------- 대시 ----------
  startDash() {
    const dir = this.moveDir() || this.facing;
    this.facing = dir;
    if (!this.onGround) this.airDash = false;
    this.squash(1.3, 0.8);
    this.state = 'dash'; this.stateT = 0; this.bufDash = 0;
    this.dashCd = 0.55 * this.g.mods.dashCdMul;
    this.invuln = Math.max(this.invuln, 0.28);
    this.vx = dir * 430; this.vy = 0; this.afterT = 0;
    this.anim.play('run', 2);
    Sfx.dash();
    FX.burst(this.x, this.y - 4, 10, { angle: dir > 0 ? Math.PI : 0, spread: 1, color: ['#9ff4ff', '#ffffff'], min: 60, max: 180, life: 0.3, kind: 'spark' });
    FX.add(new RingFx(this.x, this.y - 20, 4, 30, '#9ff4ff', 0.25, 2, 1.5));
    for (let i = 0; i < 3; i++) FX.add(new CutFx(this.x + dir * 40, this.y - 12 - i * 12, 0, 110, '#9ff4ff', 0.22, 1.2));
    if (this.onGround) FX.smoke(this.x, GROUND - 2, 4, { color: 'rgba(140,130,120,0.3)', size: 5, grow: 14, vx: -dir * 40 });
  }

  startHeal() {
    this.state = 'heal'; this.stateT = 0; this.bufHeal = 0; this.healed = false;
    this.potions--; this.stats.potions++;
    this.anim.play('idle');
    FX.add(new RingFx(this.x, GROUND, 4, 30, '#7dffb0', 0.6, 2, 0.3));
  }

  hurt(dmg, dir, kb = 180) {
    if (this.invuln > 0 || this.state === 'dead') return false;
    dmg = Math.round(dmg * this.g.mods.dmgTakenMul);
    this.hp -= dmg;
    this.stats.taken += dmg;
    this.riposte = 0;
    Sfx.hurt();
    const cy = this.y - 24;
    FX.text(this.x, this.y - 50, '-' + dmg, { color: '#ff6b6b', size: 11, bold: true });
    FX.add(new ImpactFx(this.x, cy, 30, '#ff3040', 0.16, 4));
    FX.sparks(this.x, cy, 16, { color: ['#ff4a4a', '#ff9a9a', '#ffffff'], angle: dir > 0 ? 0 : Math.PI, spread: 2.4 });
    FX.burst(this.x, cy, 10, { color: ['#a01020', '#ff4a4a'], min: 60, max: 200, life: 0.5, grav: 500, glow: false });
    FX.flash('#ff2030', 0.2);
    FX.shake(6, 0.22);
    FX.punch(0.04, 0.18, this.x, cy);
    this.g.hitstop = Math.max(this.g.hitstop, 0.09);
    if (this.hp <= 0) { this.hp = 0; this.die(dir); return true; }
    this.squash(0.82, 1.16);
    FX.kick(dir * 5, -2);
    this.state = 'hurt'; this.stateT = 0;
    this.anim.play('hit', 1, true);
    this.vx = dir * kb; this.vy = -160; this.onGround = false;
    this.invuln = 0.9;
    return true;
  }

  die(dir) {
    this.state = 'dead'; this.stateT = 0;
    this.anim.play('death', 1, true);
    this.vx = dir * 120; this.vy = -120;
    FX.add(new ShockFx(this.x, this.y - 20, 6, 120, 'rgba(255,40,60,0.6)', 0.7, 10));
    FX.punch(0.1, 0.6, this.x, this.y - 20);
    this.g.onPlayerDeath();
  }

  draw(ctx) {
    // 그림자
    ctx.save();
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#000';
    const sh = clamp(1 - (GROUND - this.y) / 200, 0.3, 1);
    ctx.beginPath(); ctx.ellipse(this.x, GROUND, 13 * sh, 2.5, 0, 0, TAU); ctx.fill();
    ctx.restore();

    let alpha = 1;
    if (this.invuln > 0 && this.state !== 'dash' && this.state !== 'dead' && !this.parried) alpha = Math.floor(this.invuln * 20) % 2 ? 0.35 : 1;

    // 반격 준비 중이면 금빛 기운
    if (this.riposte > 0 && this.state !== 'dead') {
      glowCircle(ctx, this.x, this.y - 22, 36, 'rgba(255,190,60,0.4)', 0.6 + 0.4 * Math.sin(this.t * 30));
      if (Math.random() < 0.6) FX.particle({ x: this.x + rand(-10, 10), y: this.y - rand(0, 40), vy: rand(-60, -20), life: 0.45, size: 1.5, color: pick(['#ffd25a', '#fff2b0']), glow: true, floor: false });
    }
    // 기력이 가득 차면 푸른 기운
    if (this.energy >= ENERGY_MAX && this.state !== 'dead' && Math.random() < 0.3) {
      FX.particle({ x: this.x + rand(-8, 8), y: this.y - rand(0, 40), vy: rand(-40, -15), life: 0.4, size: 1, color: '#5fe8ff', glow: true, floor: false });
    }

    drawSprite(ctx, 'knight', this.anim.name, this.anim.frame, this.x, this.y, 1, this.facing, { alpha, sx: this.sqx, sy: this.sqy });
    if (this.riposte > 0 && this.state !== 'dead') {
      drawSprite(ctx, 'knight', this.anim.name, this.anim.frame, this.x, this.y, 1, this.facing, { white: true, alpha: 0.15 + 0.1 * Math.sin(this.t * 30), comp: 'lighter' });
    }

    // 패링 자세: 앞쪽에 빛나는 방패
    if (this.state === 'parry') {
      const win = this.g.mods.parryWin;
      const on = this.stateT < win;
      const cx = this.x + this.facing * 4, cy = this.y - 24;
      const col = this.parried ? '#ffe680' : '#bff8ff';
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const a0 = mirrorA(-1.15, this.facing), a1 = mirrorA(1.15, this.facing);
      const ccw = this.facing < 0;
      for (const [r, w, a] of [[24, on ? 4 : 1, on ? 0.9 : 0.3], [28, 1.5, on ? 0.6 : 0.2], [20, 1, on ? 0.5 : 0.15]]) {
        ctx.strokeStyle = on ? col : 'rgba(120,160,200,0.6)';
        ctx.globalAlpha = a;
        ctx.lineWidth = w;
        ctx.beginPath(); ctx.arc(cx, cy, r, a0, a1, ccw); ctx.stroke();
      }
      // 방패 무늬 (작은 룬 점)
      if (on) {
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 5; i++) {
          const a = lerp(a0, a1, (i + 0.5) / 5) + Math.sin(this.t * 20 + i) * 0.03;
          ctx.globalAlpha = 0.8;
          ctx.fillRect(cx + Math.cos(a) * 24 - 1, cy + Math.sin(a) * 24 - 1, 2, 2);
        }
      }
      ctx.restore();
      if (on) glowCircle(ctx, cx + this.facing * 20, cy, 26, this.parried ? 'rgba(255,220,120,0.6)' : 'rgba(160,240,255,0.55)');
    }

    if (this.g.debug) {
      const b = this.hurtbox();
      ctx.strokeStyle = '#0f0'; ctx.strokeRect(b.x, b.y, b.w, b.h);
    }
  }
}

// 기사의 공격이 맞았을 때 이펙트 (근거리·원거리 같이 써요)
function hitFx(g, cx, cy, dir, big, crit) {
  const col = crit ? ['#ffd25a', '#fff6c0', '#ff9b1a'] : ['#ffffff', '#9ff4ff', '#4fd8ff'];
  const main = crit ? '#ffc040' : '#5fe0ff';
  const ang = dir > 0 ? 0 : Math.PI;
  FX.add(new ImpactFx(cx, cy, big ? 46 : 30, main, big ? 0.18 : 0.13, 4, rand(-0.3, 0.3)));
  FX.add(new ImpactFx(cx, cy, big ? 30 : 18, '#ffffff', 0.1, 4, Math.PI / 4));
  FX.add(new GlowFx(cx, cy, big ? 60 : 38, crit ? 'rgba(255,200,80,0.9)' : 'rgba(120,230,255,0.8)', 0.18));
  FX.sparks(cx, cy, big ? 26 : 14, { angle: ang, spread: 2.0, color: col, max: big ? 520 : 380, grav: 250 });
  FX.burst(cx, cy, big ? 14 : 6, { angle: ang, spread: 2.6, color: col, min: 60, max: 200, life: 0.45, size: 3, grav: 300 });
  for (let i = 0; i < (big ? 4 : 2); i++) FX.add(new StreakFx(cx, cy, ang + rand(-0.8, 0.8), rand(30, 55), '#ffffff', 0.13, big ? 3 : 2));
  // 베인 자국 (크게 맞으면 십자로)
  const ca = rand(-1.2, -0.4) * dir;
  FX.add(new CutFx(cx, cy, ca, big ? 110 : 70, main, big ? 0.24 : 0.18, big ? 3 : 2));
  if (big || crit) FX.add(new CutFx(cx, cy, ca + Math.PI / 2 + rand(-0.3, 0.3), big ? 90 : 60, '#ffffff', 0.2, 2));
  if (big || crit) FX.chroma(big ? 2.2 : 1.5);
  if (crit) for (let i = 0; i < 3; i++) FX.add(new LightningFx(cx, cy, cx + rand(-50, 50), cy + rand(-50, 50), '#ffd25a', 0.16, 5, 6, 1.2));
  if (big || crit) {
    FX.add(new ShockFx(cx, cy, 4, big ? 70 : 46, main, 0.3, 7));
    FX.add(new RaysFx(cx, cy, 8, big ? 80 : 55, main, 0.25, 0.06));
  }
  if (crit) FX.punch(0.035, 0.15, cx, cy);
  Sfx.hit(big);
  FX.kick(dir * (big ? 6 : 2.5), big ? 2 : 0.8);
  g.hitstop = Math.max(g.hitstop, big ? 0.1 : 0.05);
  FX.shake(big ? 5 : 2.5, big ? 0.16 : 0.1);
}
