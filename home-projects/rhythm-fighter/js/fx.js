'use strict';
/* 파티클 · 빛 고리 · 떠오르는 글자 + 마우스 버튼 (다크 판타지 스타일) */

class Effects {
  constructor() { this.ps = []; this.rings = []; this.texts = []; }
  /** extra.add = true 면 빛처럼 더해지는 파티클(불씨 · 불꽃), 아니면 보통 조각 */
  particle(x, y, vx, vy, life, size, color, extra = {}) {
    if (this.ps.length > 1400) return null;
    const p = Object.assign({ x, y, vx, vy, life, max: life, size, color, grav: 0, drag: 1, add: false }, extra);
    this.ps.push(p);
    return p;
  }
  /** 사방으로 튀는 불꽃 */
  burst(x, y, color, n, speed, life = .45) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = speed * (.35 + Math.random() * .8);
      this.particle(x, y, Math.cos(a) * s, Math.sin(a) * s, life * (.6 + Math.random() * .6),
        Math.random() < .3 ? 3 : 2, color, { drag: .9, add: true, spark: true });
    }
  }
  /** 위로 튀었다 떨어지는 금빛 가루 */
  pop(x, y, color, n, speed) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = speed * (.3 + Math.random() * .9);
      this.particle(x, y, Math.cos(a) * s, Math.sin(a) * s - speed * .4, .6 + Math.random() * .6,
        Math.random() < .5 ? 3 : 2, color, { grav: 500, drag: .96, add: true });
    }
  }
  ring(x, y, r0, r1, life, width, color) {
    this.rings.push({ x, y, r0, r1, life, max: life, width, color });
  }
  text(s, x, y, size, color, life = .8, extra = {}) {
    this.texts.push(Object.assign({ s, x, y, vy: -80, life, max: life, size, color, display: false }, extra));
  }
  clear() { this.ps.length = 0; this.rings.length = 0; this.texts.length = 0; }

  update(dt) {
    for (let i = this.ps.length - 1; i >= 0; i--) {
      const p = this.ps[i];
      p.life -= dt;
      if (p.life <= 0) { this.ps[i] = this.ps[this.ps.length - 1]; this.ps.pop(); continue; }
      const d = Math.pow(p.drag, dt * 60);
      p.vx *= d; p.vy *= d; p.vy += p.grav * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
    for (let i = this.rings.length - 1; i >= 0; i--) { this.rings[i].life -= dt; if (this.rings[i].life <= 0) this.rings.splice(i, 1); }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt;
      if (t.life <= 0) { this.texts.splice(i, 1); continue; }
      t.y += t.vy * dt;
      t.vy *= Math.pow(.88, dt * 60);
    }
  }

  render(ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const r of this.rings) {
      const k = 1 - r.life / r.max, rad = r.r0 + (r.r1 - r.r0) * ease(k);
      ctx.globalAlpha = (1 - k) * .9;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = Math.max(.8, r.width * (1 - k * .7));
      ctx.beginPath(); ctx.arc(r.x, r.y, rad, 0, Math.PI * 2); ctx.stroke();
    }
    // 보통 조각 먼저, 빛 파티클은 더해서
    ctx.globalCompositeOperation = 'source-over';
    for (const p of this.ps) {
      if (p.add) continue;
      ctx.globalAlpha = Math.min(1, p.life / p.max * 2);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    for (const p of this.ps) {
      if (!p.add) continue;
      const a = Math.min(1, p.life / p.max * 1.6);
      ctx.globalAlpha = a;
      if (p.spark) {
        ctx.strokeStyle = p.color; ctx.lineWidth = p.size;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * .035, p.y - p.vy * .035); ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        ctx.globalAlpha = a * .25;
        ctx.fillRect(p.x - p.size * 1.5, p.y - p.size * 1.5, p.size * 3, p.size * 3);
      }
    }
    ctx.restore();
    for (const t of this.texts) {
      const k = 1 - t.life / t.max;
      const pop = k < .1 ? 1.3 - k * 3 : 1;
      ctx.globalAlpha = Math.min(1, t.life / t.max * 3);
      outlined(ctx, t.s, t.x, t.y, Math.round(t.size * pop), t.color, t.display);
    }
    ctx.globalAlpha = 1;
  }
}

/** 마우스 버튼: 그릴 때 자리를 등록하고, 클릭되면 그 일을 한다 */
class UI {
  constructor(app) { this.app = app; this.list = []; }
  begin() { this.list.length = 0; }
  hover(x, y, w, h) { const m = this.app.mouse; return m.x >= x && m.x <= x + w && m.y >= y && m.y <= y + h; }
  area(x, y, w, h, act) { this.list.push({ x, y, w, h, act }); }
  click(x, y) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const b = this.list[i];
      if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) { if (b.act) b.act(); return true; }
    }
    return false;
  }
  anyHover() { return this.list.some(b => this.hover(b.x, b.y, b.w, b.h)); }
  /** style: primary(핏빛) / gold(금) / danger / ghost(검은 가죽) */
  button(ctx, x, y, w, h, label, style, enabled, act) {
    const hv = enabled && this.hover(x, y, w, h);
    const S = {
      primary: ['#5a1010', '#2a0606', P.gold, P.goldLight],
      gold: ['#5c4416', '#2a1e08', P.gold, P.goldLight],
      danger: ['#6a1414', '#300606', P.red, '#ffb0a0'],
      ghost: ['#24201c', '#110e0c', P.goldDark, P.white],
    }[style];
    const c = Math.min(10, h / 3);
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; chamfer(ctx, x + 3, y + 5, w, h, c); ctx.fill();
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, enabled ? (hv ? mix(S[0], '#ffffff', .12) : S[0]) : '#1a1714');
    g.addColorStop(1, enabled ? S[1] : '#0c0a09');
    chamfer(ctx, x, y, w, h, c); ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = '#000'; chamfer(ctx, x - 1, y - 1, w + 2, h + 2, c + 1); ctx.stroke();
    ctx.lineWidth = hv ? 2 : 1.4; ctx.strokeStyle = enabled ? (hv ? P.goldLight : S[2]) : '#3a332a';
    chamfer(ctx, x + 1.5, y + 1.5, w - 3, h - 3, c - 1); ctx.stroke();
    ctx.fillStyle = 'rgba(255,230,180,0.08)'; ctx.fillRect(x + c, y + 3, w - c * 2, h * .3);
    if (hv) {
      glow(ctx, P.gold, x + w / 2, y + h / 2, w * .55, h, .18);
      ctx.fillStyle = P.goldLight;
      for (const s of [-1, 1]) {
        const ax = s < 0 ? x + 12 : x + w - 12;
        ctx.beginPath(); ctx.moveTo(ax - s * 5, y + h / 2 - 6); ctx.lineTo(ax + s * 2, y + h / 2); ctx.lineTo(ax - s * 5, y + h / 2 + 6); ctx.fill();
      }
    }
    text(ctx, label, x + w / 2, y + h / 2 + 6, 16, enabled ? (hv ? '#ffffff' : S[3]) : '#5f564a', 'center');
    this.area(x, y, w, h, enabled ? act : () => this.app.sound.play(SFX.DENY));
  }
}
