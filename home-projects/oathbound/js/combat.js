'use strict';
// =============================================================
//  공격 판정(Hazard) — 보스의 공격, 탄, 충격파, 솟아오르는 기둥, 기사의 검기
//  parryable = true  → 노란 빛, 패링 가능
//  parryable = false → 붉은 빛, 피해야 함
// =============================================================

function overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

class Hazard {
  constructor(o) {
    Object.assign(this, {
      x: 0, y: 0, w: 10, h: 10, vx: 0, vy: 0, grav: 0,
      dmg: 10, parryable: true, posture: 25, kb: 180,
      delay: 0, life: 1, t: 0, dead: false,
      friendly: false, projectile: false, reflected: false,
      follow: null, ox: 0, oy: 0,
      hitPlayer: false, harmless: false,
      floorDie: false, kind: '', color: '#fff',
      draw: null, tick: null, onParry: null, onEnd: null, onHit: null,
    }, o);
  }
  get active() { return !this.dead && this.t >= this.delay; }
  rect() { return { x: this.x - this.w / 2, y: this.y - this.h / 2, w: this.w, h: this.h }; }
  update(dt, g) {
    this.t += dt;
    if (this.follow) {
      this.x = this.follow.x + this.ox * this.follow.facing;
      this.y = this.follow.y + this.oy;
      if (this.follow.dead || this.follow.stunT > 0) this.dead = true;
    } else if (this.t >= this.delay) {
      this.vy += this.grav * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
    }
    if (this.tick) this.tick(this, dt, g);
    if (this.floorDie && this.y >= GROUND - 2 && this.t >= this.delay) this.end(g);
    if (this.t >= this.delay + this.life) this.end(g);
    if (this.x < -200 || this.x > ARENA_W + 200 || this.y > H + 100) this.dead = true;
  }
  end(g) {
    if (this.dead) return;
    this.dead = true;
    if (this.onEnd) this.onEnd(this, g);
  }
  render(ctx) { if (this.draw) this.draw(ctx, this); }
}

// 되돌아간 탄은 금빛으로 바뀌어요
const GOLD = 'rgba(255,214,90,0.95)';

// ---------------- 탄 모양 그리기 ----------------
const ShotArt = {
  bone(ctx, h) {
    // 흐릿한 잔상 3개 + 본체
    for (let i = 3; i >= 0; i--) {
      const px = h.x - h.vx * 0.012 * i, py = h.y - h.vy * 0.012 * i;
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate((h.t - i * 0.012) * 14);
      ctx.globalAlpha = i ? 0.25 / i : 1;
      if (!i && h.reflected) glowCircle(ctx, 0, 0, 16, GOLD);
      ctx.fillStyle = '#2a1c14';
      ctx.fillRect(-8, -2, 16, 4); ctx.fillRect(-10, -4, 4, 8); ctx.fillRect(6, -4, 4, 8);
      ctx.fillStyle = h.reflected ? '#ffe9a0' : '#f0e6cc';
      ctx.fillRect(-7, -1, 14, 2); ctx.fillRect(-9, -3, 2, 2); ctx.fillRect(-9, 1, 2, 2); ctx.fillRect(7, -3, 2, 2); ctx.fillRect(7, 1, 2, 2);
      ctx.restore();
    }
  },
  orb(ctx, h) {
    const c = h.reflected ? GOLD : h.color;
    const sz = h.size || 1;
    const flick = 1 + Math.sin(h.t * 40) * 0.12;
    // 꼬리
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const sp = Math.hypot(h.vx, h.vy) || 1;
    for (let i = 1; i <= 5; i++) {
      ctx.globalAlpha = 0.35 * (1 - i / 6);
      ctx.fillStyle = c;
      ctx.beginPath(); ctx.arc(h.x - (h.vx / sp) * i * 4, h.y - (h.vy / sp) * i * 4, 6 * sz * (1 - i / 7), 0, TAU); ctx.fill();
    }
    ctx.restore();
    glowCircle(ctx, h.x, h.y, 22 * flick * sz, c, 0.7);
    glowCircle(ctx, h.x, h.y, 9 * sz, c, 1);
    // 도는 작은 별 두 개
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = h.reflected ? '#fff6c0' : (h.core || '#fff');
    for (let i = 0; i < 2; i++) {
      const a = h.t * 10 + i * Math.PI;
      ctx.fillRect(h.x + Math.cos(a) * 9 * sz - 1, h.y + Math.sin(a) * 9 * sz - 1, 2, 2);
    }
    ctx.beginPath(); ctx.arc(h.x, h.y, 3 * sz, 0, TAU); ctx.fill();
    ctx.restore();
  },
  flame(ctx, h) {   // 꼬리가 달린 불꽃 탄
    const c = h.reflected ? GOLD : h.color;
    const sz = h.size || 1;
    const ang = Math.atan2(h.vy, h.vx);
    glowCircle(ctx, h.x, h.y, 42 * sz, c, 0.4);
    glowCircle(ctx, h.x, h.y, 20 * sz, c, 0.7);
    // 탄 둘레를 도는 불꽃 혀
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = c;
    ctx.lineWidth = 1.5 * sz;
    for (let i = 0; i < 3; i++) {
      const a = h.t * 14 + i * TAU / 3;
      ctx.globalAlpha = 0.6;
      ctx.beginPath(); ctx.arc(h.x, h.y, 11 * sz, a, a + 1.4); ctx.stroke();
    }
    ctx.restore();
    ctx.save();
    ctx.translate(h.x, h.y);
    ctx.rotate(ang);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 9; i++) {
      const k = i / 9;
      ctx.globalAlpha = 0.7 * (1 - k);
      ctx.fillStyle = i < 2 ? (h.core || '#fff4c0') : c;
      const r = (8 - i * 0.7) * sz * (1 + Math.sin(h.t * 50 + i * 1.7) * 0.18);
      ctx.beginPath(); ctx.arc(-i * 4.2 * sz, Math.sin(h.t * 30 + i) * i * 0.4, Math.max(1, r), 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(1, 0, 3 * sz, 0, TAU); ctx.fill();
    ctx.restore();
  },
  shard(ctx, h) {   // 가시
    const ang = Math.atan2(h.vy, h.vx);
    const c = h.reflected ? GOLD : 'rgba(255,120,40,0.7)';
    glowCircle(ctx, h.x, h.y, 14, c, 0.5);
    ctx.save();
    ctx.translate(h.x, h.y);
    ctx.rotate(ang - Math.PI / 2);
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = c;
    ctx.beginPath(); ctx.moveTo(0, 6); ctx.lineTo(-3, -30); ctx.lineTo(3, -30); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#1a0f08';
    ctx.beginPath(); ctx.moveTo(0, 15); ctx.lineTo(-5, -10); ctx.lineTo(5, -10); ctx.fill();
    ctx.fillStyle = h.reflected ? '#ffe080' : '#a07a4c';
    ctx.beginPath(); ctx.moveTo(0, 13); ctx.lineTo(-3, -8); ctx.lineTo(0, -8); ctx.fill();
    ctx.restore();
  },
};

// 탄 꼬리 파티클
function trail(h, colors, rate, dt, size = 2, smoke) {
  if (Math.random() < rate * dt) {
    FX.particle({ x: h.x + rand(-3, 3), y: h.y + rand(-3, 3), vx: -h.vx * 0.1 + rand(-20, 20), vy: -h.vy * 0.1 + rand(-20, 20), life: rand(0.25, 0.5), size: rand(1, size + 1), color: h.reflected ? '#ffd860' : pick(colors), glow: true, floor: false });
  }
  if (smoke && Math.random() < rate * 0.3 * dt) {
    FX.particle({ x: h.x, y: h.y, vx: rand(-10, 10), vy: rand(-30, -10), life: 0.7, size: 3, grow: 10, color: smoke, kind: 'smoke', floor: false, shrink: false });
  }
}

// 탄이 사라질 때 작은 폭발
function popShot(h, colors) {
  const c = h.reflected ? '#ffd25a' : colors[0];
  FX.add(new ImpactFx(h.x, h.y, 22, c, 0.14));
  FX.add(new ShockFx(h.x, h.y, 3, 30, c, 0.28, 5));
  FX.add(new GlowFx(h.x, h.y, 34, c, 0.2));
  FX.sparks(h.x, h.y, 12, { color: [c, '#ffffff'], min: 100, max: 300 });
  if (h.y > GROUND - 8) FX.add(new CrackFx(h.x, 30, c, 1.4), true);
}

// ---------------- 공격 만들기 도우미 ----------------
const Haz = {
  // 보스 몸에 붙은 근접 공격 판정 (보이지 않음)
  melee(owner, ox, oy, w, h, dmg, o = {}) {
    return new Hazard(Object.assign({ follow: owner, ox, oy, w, h, dmg, life: 0.12, kind: 'melee' }, o));
  },

  // 날아가는 탄
  shot(kind, x, y, vx, vy, o = {}) {
    const presets = {
      bone: { w: 14, h: 14, dmg: 12, draw: ShotArt.bone, tick: (h, dt) => trail(h, ['#e8dcc0'], 20, dt, 1), colors: ['#e8dcc0'] },
      soul: { w: 12, h: 12, dmg: 12, color: 'rgba(190,100,255,0.9)', core: '#f4e0ff', draw: ShotArt.orb, tick: (h, dt) => trail(h, ['#b46cff', '#e0b0ff'], 60, dt), colors: ['#c070ff'], light: 'rgba(190,100,255,0.9)' },
      wisp: { w: 14, h: 14, dmg: 14, color: 'rgba(60,220,255,0.9)', core: '#e0ffff', draw: ShotArt.flame, tick: (h, dt) => trail(h, ['#3fe0ff', '#b8fbff'], 70, dt), colors: ['#40e0ff'], light: 'rgba(60,220,255,0.9)' },
      fire: { w: 16, h: 16, dmg: 16, color: 'rgba(255,100,20,0.95)', core: '#fff0a0', draw: ShotArt.flame, tick: (h, dt) => trail(h, ['#ff7a1a', '#ffd040', '#ff3a0a'], 90, dt, 3, 'rgba(50,25,20,0.45)'), colors: ['#ff7a1a'], light: 'rgba(255,120,30,1)', lightW: 70 },
      shard: { w: 10, h: 18, dmg: 16, draw: ShotArt.shard, parryable: false, tick: (h, dt) => trail(h, ['#ff9040', '#7a5a3a'], 25, dt, 1), colors: ['#ff9040'], light: 'rgba(255,140,60,0.6)', lightW: 30 },
    };
    const p = presets[kind];
    const hz = new Hazard(Object.assign({ x, y, vx, vy, projectile: true, kind, life: 6, posture: 22 }, p, o));
    const userEnd = o.onEnd;
    hz.onEnd = (h, g) => { popShot(h, p.colors); if (userEnd) userEnd(h, g); };
    return hz;
  },

  // 기사의 원거리 참격 — 날아가는 초승달 검기 (적 탄도 베어 없애요)
  slashWave(x, y, dir, power) {
    const big = power > 1;
    const col = big ? '#ffd25a' : '#5fe8ff';
    const glow = big ? 'rgba(255,190,60,0.7)' : 'rgba(60,200,255,0.7)';
    let after = 0;
    return new Hazard({
      x, y, w: big ? 46 : 36, h: big ? 88 : 72, vx: dir * 560, dmg: 22 * power, posture: 8 * power,
      friendly: true, projectile: true, kind: 'wave', life: 0.85, dir, big, cuts: true, light: col, lightW: 80,
      tick(h, dt) {
        h.vx *= 1 - dt * 0.6;
        after -= dt;
        if (after <= 0) {
          after = 0.025;
          FX.add(new SlashFx(h.x - dir * 6, h.y, h.h * 0.55, mirrorA(-1.15, dir), mirrorA(1.15, dir),
            { life: 0.16, thick: 9, edge: col, glow, core: '#ffffff' }), true);
        }
        // 땅을 긁으며 튀는 불티
        if (Math.random() < dt * 60) FX.particle({ x: h.x - dir * rand(0, 10), y: GROUND - 1, vx: -dir * rand(60, 200), vy: rand(-180, -60), life: 0.35, size: 1.5, color: pick([col, '#ffffff']), glow: true, grav: 600, kind: 'spark' });
        if (Math.random() < dt * 90) FX.particle({ x: h.x + rand(-6, 6), y: h.y + rand(-h.h / 2, h.h / 2), vx: -dir * rand(40, 140), vy: rand(-30, 30), life: 0.35, size: rand(1, 2.5), color: pick([col, '#ffffff']), glow: true, floor: false, kind: Math.random() < 0.5 ? 'spark' : 'sq' });
      },
      draw(ctx, h) {
        const k = Math.min(1, (h.t) / 0.08);
        const fade = h.t > h.life - 0.15 ? (h.life - h.t) / 0.15 : 1;
        glowCircle(ctx, h.x, h.y, h.h * 0.8, glow, 0.6 * fade);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.translate(h.x, h.y);
        ctx.scale(dir, 1);
        const R = h.h * 0.55 * k;
        for (const [c, a, t] of [[glow, 0.5, 1.8], [col, 0.9, 1], ['#ffffff', 1, 0.45]]) {
          ctx.globalAlpha = a * fade;
          ctx.fillStyle = c;
          ctx.beginPath();
          for (let i = 0; i <= 20; i++) { const u = i / 20, ang = lerp(-1.2, 1.2, u); ctx.lineTo(Math.cos(ang) * R, Math.sin(ang) * R); }
          for (let i = 20; i >= 0; i--) { const u = i / 20, ang = lerp(-1.2, 1.2, u); const rr = R - 12 * t * Math.sin(u * Math.PI); ctx.lineTo(Math.cos(ang) * rr - 8 * t * Math.sin(u * Math.PI), Math.sin(ang) * rr); }
          ctx.closePath(); ctx.fill();
        }
        ctx.restore();
      },
      onEnd(h) {
        FX.add(new ImpactFx(h.x, h.y, 34, col, 0.16));
        FX.add(new ShockFx(h.x, h.y, 4, 46, col, 0.3, 6, 1.5));
        FX.add(new CutFx(h.x, h.y, Math.PI / 2 + rand(-0.3, 0.3), 90, col, 0.2, 2.5));
        FX.sparks(h.x, h.y, 18, { color: [col, '#ffffff'] });
      },
    });
  },

  // 땅을 따라 달리는 충격파 (점프로 넘어요)
  wave(x, dir, speed, color, o = {}) {
    return new Hazard(Object.assign({
      x, y: GROUND - 12, w: 20, h: 24, vx: dir * speed, dmg: 14, parryable: false, life: 2.2, kind: 'gwave', color,
      light: color, lightW: 70, crackT: 0,
      draw(ctx, h) {
        const d = Math.sign(h.vx) || 1;
        glowCircle(ctx, h.x, GROUND - 10, 34, h.color, 0.6);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        // 뒤로 길게 끌리는 빛의 벽
        // 빛의 벽 (그라데이션 대신 두 겹 단색: 가벼워요)
        for (let i = 0; i < 14; i++) {
          const hh = (h.h + 10) * (1 - i / 15) * (0.8 + Math.sin(h.t * 40 + i * 1.3) * 0.2);
          ctx.globalAlpha = 0.75 - i * 0.05;
          ctx.fillStyle = i < 2 ? '#ffffff' : h.color;
          ctx.fillRect(h.x - d * i * 3 - 1.5, GROUND - hh * 0.55, 3, hh * 0.55);
          ctx.globalAlpha *= 0.45;
          ctx.fillRect(h.x - d * i * 3 - 1.5, GROUND - hh, 3, hh * 0.45);
        }
        ctx.restore();
      },
      tick(h, dt) {
        if (Math.random() < dt * 60) FX.particle({ x: h.x, y: GROUND - 2, vx: -h.vx * 0.2 + rand(-20, 20), vy: rand(-140, -40), life: 0.45, size: 2, color: pick([h.color, '#ffffff']), glow: true, grav: 400, kind: 'spark' });
        if (Math.random() < dt * 40) FX.particle({ x: h.x, y: GROUND - 2, vx: rand(-30, 30), vy: rand(-160, -50), life: 0.7, size: rand(2, 4), color: pick(['#6a5a48', '#4a3a2a']), glow: false, grav: 700 });
        h.crackT -= dt;
        if (h.crackT <= 0) { h.crackT = 0.08; FX.add(new CrackFx(h.x, 26, h.color, 1.5), true); }
      },
    }, o));
  },

  // 땅에서 솟아오르는 공격: style = 'bone' | 'fire' | 'curse' | 'blue'
  eruption(g, x, w, h, warn, style, o = {}) {
    const colors = { bone: '#ffffff', fire: '#ff5a10', curse: '#c060ff', blue: '#40e0ff' };
    const c = colors[style];
    if (!o.harmless) FX.add(new GroundWarnFx(x, w + 10, warn, style === 'bone' ? '#ff3030' : c, style === 'bone' ? 0 : h), true);
    const hz = new Hazard(Object.assign({
      x, y: GROUND - h / 2, w, h, dmg: 18, parryable: false, delay: warn, life: style === 'fire' ? 0.5 : 0.35,
      kind: 'erupt', style, hgt: h, started: false, light: style === 'bone' ? 'rgba(255,80,60,0.6)' : c, lightW: w * 1.6,
      tick(hz) {
        if (!hz.started && hz.t >= hz.delay) {
          hz.started = true;
          FX.shake(3, 0.15);
          if (!o.harmless) FX.add(new CrackFx(x, w * 1.8, style === 'bone' ? '#ff6040' : c, 2), true);
          if (style === 'curse' || style === 'blue') {
            for (let i = 0; i < 2; i++) FX.add(new LightningFx(x + rand(-w / 3, w / 3), GROUND - h - 30, x + rand(-w / 2, w / 2), GROUND, c, 0.28, 9, 9, 1.5));
          }
          if (style === 'fire') FX.add(new EmberPatchFx(x, w * 1.4, ['#ff9a2a', '#ffd040', '#ff4a10'], 1.4), true);
          if (style === 'bone') {
            Sfx.bone();
            FX.burst(x, GROUND, 14, { angle: -Math.PI / 2, spread: 1.4, color: ['#e8dcc0', '#8a7a60'], grav: 600, glow: false, min: 100, max: 260 });
            FX.add(new ShockFx(x, GROUND, 4, w * 0.9, 'rgba(255,240,210,0.6)', 0.3, 6, 0.25));
          } else {
            Sfx.fire();
            FX.add(new ShockFx(x, GROUND, 4, w * 1.3, c, 0.4, 10, 0.3));
            FX.add(new RaysFx(x, GROUND - 10, 7, h * 0.8, c, 0.35, 0.08));
            FX.sparks(x, GROUND - 10, 18, { angle: -Math.PI / 2, spread: 1.2, color: [c, '#ffffff'], min: 160, max: 420, grav: 200 });
            FX.add(new ScorchFx(x, w * 1.6, 'rgba(10,5,5,0.55)', 2.2, c), true);
            if (style === 'fire') FX.smoke(x, GROUND - h * 0.7, 5, { color: 'rgba(40,20,15,0.5)', size: 10, grow: 20, vy: -40 });
          }
        }
      },
      draw(ctx, hz) {
        if (hz.t < hz.delay) {
          // 불기둥은 솟기 전에 작은 불씨가 자라나요 (시트의 0~3 프레임)
          if (style === 'fire' && hz.delay > 0.1) {
            const f = Math.min(3, Math.floor((hz.t / hz.delay) * 4));
            drawSprite(ctx, 'beast', 'pillar', f, x, GROUND, hz.hgt / 150, -1, { alpha: 0.85 });
          }
          return;
        }
        const at = hz.t - hz.delay, total = hz.life;
        const rise = Math.min(1, at / 0.07), fall = at > total - 0.1 ? (total - at) / 0.1 : 1;
        const k = Math.max(0, Math.min(rise, fall));
        if (style === 'bone') {
          const n = Math.max(2, Math.round(w / 9));
          for (let i = 0; i < n; i++) {
            const px = x - w / 2 + (i + 0.5) * (w / n);
            const ph = hz.hgt * k * (0.6 + 0.4 * Math.abs(Math.sin(i * 2.3)));
            ctx.fillStyle = '#2a1c14';
            ctx.beginPath(); ctx.moveTo(px - 5, GROUND); ctx.lineTo(px, GROUND - ph - 2); ctx.lineTo(px + 5, GROUND); ctx.fill();
            ctx.fillStyle = '#efe4c8';
            ctx.beginPath(); ctx.moveTo(px - 3.5, GROUND); ctx.lineTo(px, GROUND - ph); ctx.lineTo(px + 3.5, GROUND); ctx.fill();
            ctx.fillStyle = '#fffaf0';
            ctx.beginPath(); ctx.moveTo(px - 1, GROUND); ctx.lineTo(px, GROUND - ph); ctx.lineTo(px + 0.5, GROUND); ctx.fill();
            ctx.fillStyle = '#9a8a6a'; ctx.fillRect(px + 0.5, GROUND - ph * 0.55, 1.5, ph * 0.55);
          }
          glowCircle(ctx, x, GROUND - 4, w * 0.6, 'rgba(255,60,40,0.5)', k * 0.6);
        } else if (style === 'fire') {
          const f = 4 + (Math.floor(at * 14) % 2);   // 4, 5 프레임: 다 솟은 불기둥
          const sc = hz.hgt / 150;
          glowCircle(ctx, x, GROUND - hz.hgt / 2, hz.hgt * 0.8, 'rgba(255,90,20,0.7)', k);
          drawSprite(ctx, 'beast', 'pillar', f, x, GROUND, sc, -1);
          drawSprite(ctx, 'beast', 'pillar', f, x, GROUND, sc, -1, { white: true, alpha: 0.25 * k, comp: 'lighter' });
          if (Math.random() < 0.8) FX.particle({ x: x + rand(-w / 2, w / 2), y: GROUND - rand(0, hz.hgt), vx: rand(-30, 30), vy: rand(-200, -80), life: 0.5, size: rand(1, 3), color: pick(['#ffd040', '#ff7a1a', '#ffffff']), glow: true, floor: false, kind: 'spark' });
        } else {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          const ww = w * (0.5 + 0.5 * k);
          const top = GROUND - hz.hgt * k;
          // 빛기둥: 미리 그려 둔 빛 원을 세로로 길게 늘여서 여러 겹
          ctx.imageSmoothingEnabled = true;
          for (let i = 0; i < 4; i++) {
            const iw = ww * (1.6 - i * 0.35) * (1 + Math.sin(hz.t * 60 + i) * 0.05);
            ctx.globalAlpha = (i >= 3 ? 0.9 : 0.5) * k;
            ctx.drawImage(glowSprite(i >= 3 ? '#ffffff' : c), x - iw / 2, top - 10, iw, hz.hgt * k + 20);
          }
          // 위로 흐르는 룬 조각
          ctx.fillStyle = '#ffffff';
          for (let i = 0; i < 6; i++) {
            const yy = GROUND - ((hz.t * 300 + i * 40) % (hz.hgt * k + 1));
            ctx.globalAlpha = 0.8 * k;
            ctx.fillRect(x + Math.sin(i * 2.1) * w * 0.25 - 1, yy, 2, 5);
          }
          ctx.restore();
          glowCircle(ctx, x, GROUND - hz.hgt / 2, hz.hgt * 0.7, c, 0.6 * k);
          glowCircle(ctx, x, GROUND, w * 1.2, c, 0.7 * k);
          if (Math.random() < 0.8) FX.particle({ x: x + rand(-w / 2, w / 2), y: GROUND - rand(0, hz.hgt), vx: 0, vy: rand(-180, -60), life: 0.45, size: 2, color: pick([c, '#ffffff']), glow: true, floor: false, kind: 'spark' });
        }
      },
    }, o));
    return hz;
  },

  // 하늘에서 떨어지는 유성 (땅에 닿으면 폭발)
  meteor(g, x, warn, color, o = {}) {
    FX.add(new GroundWarnFx(x, 56, warn, color, 0), true);
    const startX = x + (o.slant || -90), startY = -30;
    // 떨어질 길 (빨간 점선)
    FX.add(new PathFx([[startX, startY], [x, GROUND - 4]], warn, 'danger', null, 1.2));
    const vx = (x - startX) / 0.45, vy = (GROUND - startY) / 0.45;
    return new Hazard(Object.assign({
      x: startX, y: startY, vx: 0, vy: 0, w: 18, h: 18, dmg: 16, parryable: false, delay: warn - 0.45, life: 2,
      kind: 'meteor', color, size: 1.5, projectile: true, floorDie: true, light: color, lightW: 60,
      draw: (ctx, h) => {
        if (h.t < h.delay) return;
        // 긴 빛 꼬리
        const sp = Math.hypot(h.vx, h.vy) || 1;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const tx = h.x - (h.vx / sp) * 90, ty = h.y - (h.vy / sp) * 90;
        const gr = ctx.createLinearGradient(h.x, h.y, tx, ty);
        gr.addColorStop(0, color); gr.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.strokeStyle = gr;
        ctx.lineCap = 'round';
        ctx.lineWidth = 14; ctx.globalAlpha = 0.5;
        ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.lineTo(tx, ty); ctx.stroke();
        ctx.lineWidth = 4; ctx.globalAlpha = 1; ctx.strokeStyle = '#ffffff';
        ctx.beginPath(); ctx.moveTo(h.x, h.y); ctx.lineTo(h.x - (h.vx / sp) * 40, h.y - (h.vy / sp) * 40); ctx.stroke();
        ctx.restore();
        ShotArt.flame(ctx, h);
      },
      tick(h, dt) {
        if (h.t >= h.delay && h.vx === 0 && h.vy === 0) { h.vx = vx; h.vy = vy; }
        if (h.t >= h.delay) trail(h, [color, '#ffffff'], 120, dt, 3, 'rgba(40,30,40,0.4)');
      },
      onEnd(h, gg) {
        Sfx.boom();
        FX.shake(6, 0.25);
        FX.explode(x, GROUND - 6, 34, [color, '#ffffff'], { squash: 0.4 });
        FX.add(new ScorchFx(x, 70, 'rgba(10,5,10,0.6)', 2.5, color), true);
        FX.add(new CrackFx(x, 90, color, 2.6), true);
        FX.add(new EmberPatchFx(x, 50, [color, '#ffffff'], 1.3), true);
        FX.chroma(1.2);
        FX.burst(x, GROUND - 4, 14, { angle: -Math.PI / 2, spread: 1.6, color: ['#5a4a3a', '#2a2018'], glow: false, min: 100, max: 300, grav: 700, life: 0.9, size: 3 });
        gg.addHazard(new Hazard({ x, y: GROUND - 16, w: 56, h: 32, dmg: o.dmg || 18, parryable: false, life: 0.12, kind: 'blast' }));
      },
    }, o));
  },
};
