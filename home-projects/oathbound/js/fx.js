'use strict';
// =============================================================
//  화면 크기 상수 + 이펙트(파티클, 칼자국, 빛줄기, 폭발, 흔들림, 글자)
// =============================================================

const W = 640, H = 360;     // 게임 세계 크기 (위치 계산은 이 단위로 해요)
const RES = 2;              // 그릴 때는 2배 → 실제 화면 1280×720
const GROUND = 300;         // 땅 높이
const ARENA_W = 1000;       // 전투장 가로 길이 (화면보다 넓어서 옆으로 움직여요)

const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const snap = v => Math.round(v * RES) / RES;          // 실제 화면 픽셀에 맞추기
const TAU = Math.PI * 2;
// 오른쪽을 볼 때의 각도를 왼쪽을 볼 때 각도로 뒤집기
const mirrorA = (a, facing) => (facing > 0 ? a : Math.PI - a);

const FX = {
  parts: [],
  list: [],       // 모양 이펙트 (고리, 칼자국, 경고 등)
  back: [],       // 캐릭터 뒤에 그릴 이펙트
  texts: [],
  callouts: [],   // 보스 머리 위 스킬 이름표
  shakeA: 0, shakeT: 0,
  flashColor: null, flashT: 0, flashMax: 0,
  zoom: 1, zoomT: 0, zoomMax: 0, zoomAmt: 0, zoomX: W / 2, zoomY: H / 2,
  camX: 0,
  quality: 1,     // 1 = 최고, 낮을수록 파티클을 덜 만들어요 (main.js 가 자동 조절)
  chromaA: 0,     // 색 갈라짐 세기 (큰 타격 순간)
  kickX: 0, kickY: 0,   // 카메라 반동 (때린 방향으로 화면이 살짝 튀어요)
  impactT: 0,     // 흑백 반전 '임팩트 프레임' 남은 시간

  reset() {
    this.parts.length = 0; this.list.length = 0; this.back.length = 0; this.texts.length = 0; this.callouts.length = 0;
    this.shakeA = 0; this.shakeT = 0; this.flashT = 0; this.zoomT = 0; this.zoom = 1;
    this.chromaA = 0; this.impactT = 0; this.kickX = 0; this.kickY = 0;
  },

  // kind: 'sq' 네모 / 'spark' 속도 방향으로 늘어난 불티 / 'smoke' 퍼지는 연기 / 'orb' 둥근 빛
  particle(o) {
    if (this.quality < 1 && Math.random() > this.quality) return o;   // 느린 컴퓨터에서는 일부만 만들어요
    const p = Object.assign({
      x: 0, y: 0, vx: 0, vy: 0, life: 0.5, t: 0, size: 2, color: '#fff',
      grav: 0, drag: 0, glow: false, shrink: true, floor: true, kind: 'sq', grow: 0,
    }, o);
    this.parts.push(p);
    return p;
  },

  // 여러 방향으로 튀는 불꽃
  burst(x, y, n, o = {}) {
    const ang = o.angle !== undefined ? o.angle : 0;
    const spread = o.spread !== undefined ? o.spread : TAU;
    for (let i = 0; i < n; i++) {
      const a = ang + (Math.random() - 0.5) * spread;
      const sp = rand(o.min || 40, o.max || 160);
      this.particle({
        x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: rand(o.lifeMin || 0.25, o.life || 0.6),
        size: o.size ? rand(o.size * 0.6, o.size) : rand(1, 3),
        color: Array.isArray(o.color) ? pick(o.color) : (o.color || '#fff'),
        grav: o.grav || 0, drag: o.drag !== undefined ? o.drag : 2,
        glow: o.glow !== undefined ? o.glow : true,
        kind: o.kind || 'sq', floor: o.floor !== undefined ? o.floor : true,
      });
    }
  },

  // 불티 (빠르게 길게 날아가는 선)
  sparks(x, y, n, o = {}) { this.burst(x, y, n, Object.assign({ kind: 'spark', min: 150, max: 420, life: 0.35, drag: 4, size: 1.5 }, o)); },

  // 연기
  smoke(x, y, n, o = {}) {
    for (let i = 0; i < n; i++) {
      this.particle({
        x: x + rand(-6, 6), y: y + rand(-6, 6), vx: rand(-30, 30) + (o.vx || 0), vy: rand(-40, -5) + (o.vy || 0),
        life: rand(0.6, o.life || 1.2), size: rand(4, o.size || 9), grow: o.grow || 14, color: o.color || 'rgba(40,30,40,0.5)',
        kind: 'smoke', drag: 1.5, floor: false, shrink: false,
      });
    }
  },

  // 큰 폭발 한 번 (빛, 고리, 불티, 연기, 빛줄기)
  explode(x, y, size, colors, o = {}) {
    const c0 = colors[0], c1 = colors[1] || '#ffffff';
    this.add(new ImpactFx(x, y, size * 0.9, c1, 0.18));
    this.add(new ShockFx(x, y, size * 0.2, size * 1.6, c0, 0.45, size * 0.18, o.squash || 1));
    this.add(new GlowFx(x, y, size * 1.8, c0, 0.4));
    if (o.rays !== false) this.add(new RaysFx(x, y, 10, size * 2.2, c0, 0.35, 0.09));
    this.sparks(x, y, Math.round(size * 0.8), { color: [c0, c1], min: size * 4, max: size * 11, grav: 300 });
    this.burst(x, y, Math.round(size * 0.6), { color: [c0, c1], min: size, max: size * 6, life: 0.7, grav: 200, size: 3 });
    if (o.smoke !== false) this.smoke(x, y, Math.round(size / 5), { color: o.smokeColor || 'rgba(30,20,25,0.45)', size: size * 0.4, grow: size * 0.6 });
  },

  // 순간 확대 (패링, 체간 붕괴 같은 큰 순간)
  punch(amount, time, x, y) {
    this.zoomAmt = amount; this.zoomT = time; this.zoomMax = time;
    this.zoomX = x; this.zoomY = y;
  },

  chroma(a) { this.chromaA = Math.max(this.chromaA, a); },
  kick(dx, dy) { this.kickX += dx; this.kickY += dy; },
  impact(t) { this.impactT = Math.max(this.impactT, t); },

  add(e, behind) { (behind ? this.back : this.list).push(e); return e; },

  shake(a, t) {
    this.shakeA = Math.max(this.shakeA, a);
    this.shakeT = Math.max(this.shakeT, t);
  },

  flash(color, t) { this.flashColor = color; this.flashT = t; this.flashMax = t; },

  // 스킬 이름표: kind = 'parry' 패링 / 'danger' 회피 / 'mix' 패링·회피 섞임
  callout(pos, name, kind, life = 1.4) {
    name = T(name);
    this.callouts = [];             // 새 이름표가 뜨면 예전 것은 지워요
    this.callouts.push({ pos, name, kind, life, t: 0 });
  },

  text(x, y, str, o = {}) {
    this.texts.push({ x, y, str, color: o.color || '#fff', size: o.size || 9, t: 0, life: o.life || 0.9, vy: o.vy || -38, bold: o.bold });
  },

  update(dt) {
    for (const p of this.parts) {
      p.t += dt;
      p.vy += p.grav * dt;
      const k = Math.max(0, 1 - p.drag * dt);
      p.vx *= k; p.vy *= k;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.grow) p.size += p.grow * dt;
      if (p.floor && p.y > GROUND) { p.y = GROUND; p.vy *= -0.3; p.vx *= 0.6; }
    }
    this.parts = this.parts.filter(p => p.t < p.life);
    const cap = Math.round(1400 * this.quality);
    if (this.parts.length > cap) this.parts.splice(0, this.parts.length - cap);
    this.list = this.list.filter(e => e.update(dt) !== false);
    this.back = this.back.filter(e => e.update(dt) !== false);
    for (const t of this.texts) { t.t += dt; t.y += t.vy * dt; t.vy *= 0.92; }
    this.texts = this.texts.filter(t => t.t < t.life);
    for (const c of this.callouts) c.t += dt;
    this.callouts = this.callouts.filter(c => c.t < c.life);
    if (this.shakeT > 0) { this.shakeT -= dt; if (this.shakeT <= 0) this.shakeA = 0; }
    if (this.flashT > 0) this.flashT -= dt;
    this.chromaA *= Math.exp(-dt * 7); if (this.chromaA < 0.15) this.chromaA = 0;
    if (this.impactT > 0) this.impactT -= dt;
    const kd = Math.exp(-dt * 16);
    this.kickX *= kd; this.kickY *= kd;
    if (this.zoomT > 0) {
      this.zoomT -= dt;
      const k = Math.max(0, this.zoomT / this.zoomMax);
      this.zoom = 1 + this.zoomAmt * Math.sin(k * Math.PI * 0.5);
    } else this.zoom = 1;
  },

  drawBack(ctx) { for (const e of this.back) e.draw(ctx); },

  drawParts(ctx) {
    ctx.save();
    // ① 연기 (보통 섞기)
    ctx.globalCompositeOperation = 'source-over';
    for (const p of this.parts) {
      if (p.kind !== 'smoke') continue;
      ctx.globalAlpha = Math.min(1, (1 - p.t / p.life) * 1.5);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, TAU); ctx.fill();
    }
    // ② 빛나지 않는 조각
    for (const p of this.parts) {
      if (p.glow || p.kind === 'smoke') continue;
      const k = 1 - p.t / p.life;
      const sz = p.shrink ? Math.max(0.5, p.size * k) : p.size;
      ctx.globalAlpha = 1;
      ctx.fillStyle = p.color;
      ctx.fillRect(snap(p.x - sz / 2), snap(p.y - sz / 2), Math.max(0.5, snap(sz)), Math.max(0.5, snap(sz)));
    }
    // ③ 빛나는 것들 (한 번에 더하기 모드)
    ctx.globalCompositeOperation = 'lighter';
    for (const p of this.parts) {
      if (!p.glow || p.kind === 'smoke') continue;
      const k = 1 - p.t / p.life;
      ctx.globalAlpha = Math.min(1, k * 1.4);
      if (p.kind === 'spark') {
        const sp = Math.hypot(p.vx, p.vy) || 1;
        const len = Math.min(22, 2 + sp * 0.035);
        ctx.strokeStyle = p.color;
        ctx.lineWidth = Math.max(0.5, p.size * k);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - (p.vx / sp) * len, p.y - (p.vy / sp) * len);
        ctx.stroke();
      } else if (p.kind === 'orb') {
        const sz = p.shrink ? p.size * k : p.size;
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.5, sz), 0, TAU); ctx.fill();
      } else {
        const sz = p.shrink ? Math.max(0.5, p.size * k) : p.size;
        ctx.fillStyle = p.color;
        ctx.fillRect(snap(p.x - sz / 2), snap(p.y - sz / 2), Math.max(0.5, snap(sz)), Math.max(0.5, snap(sz)));
      }
    }
    ctx.restore();
  },

  draw(ctx) {
    for (const e of this.list) e.draw(ctx);
    this.drawParts(ctx);
  },

  // 화면 전체 색 번쩍임
  drawFlash(ctx) {
    if (this.flashT > 0) {
      ctx.save();
      ctx.globalAlpha = (this.flashT / this.flashMax) * 0.6;
      ctx.fillStyle = this.flashColor;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  },

  // 글자는 화면 캔버스에 따로 그려요 (또렷하게). map 은 세계 좌표 → 화면 좌표
  drawTexts(ctx, map, S) {
    ctx.save();
    ctx.textAlign = 'center';
    for (const t of this.texts) {
      const k = t.t / t.life;
      const pop = t.t < 0.08 ? 1 + (0.08 - t.t) * 8 : 1;
      ctx.globalAlpha = k > 0.7 ? (1 - k) / 0.3 : 1;
      ctx.font = `${t.bold ? '900' : 'bold'} ${Math.round(t.size * S * pop)}px "Nanum Myeongjo", "Malgun Gothic", serif`;
      const p = map(t.x, t.y);
      ctx.lineWidth = Math.max(2, S * 1.6);
      ctx.strokeStyle = 'rgba(0,0,0,0.9)';
      ctx.strokeText(t.str, p.x, p.y);
      if (t.bold) {
        ctx.globalAlpha *= 0.35;
        ctx.lineWidth = Math.max(3, S * 4);
        ctx.strokeStyle = t.color;
        ctx.strokeText(t.str, p.x, p.y);
        ctx.globalAlpha /= 0.35;
      }
      ctx.fillStyle = t.color;
      ctx.fillText(t.str, p.x, p.y);
    }
    // 스킬 이름표: [패링] 할퀴기 연타
    const TAG = { parry: [T('패링'), '#ffd84a', '#2a1e02'], danger: [T('회피'), '#ff4a4a', '#2a0404'], mix: [T('패링·회피'), '#ffa040', '#2a1402'] };
    for (const c of this.callouts) {
      const k = c.t / c.life;
      const [tag, col, ink] = TAG[c.kind] || TAG.danger;
      const pp = c.pos();
      const p = map(pp.x, pp.y - 22);
      const slide = Math.min(1, c.t / 0.12);
      ctx.globalAlpha = (k > 0.8 ? (1 - k) / 0.2 : 1) * slide;
      const nameFont = `800 ${Math.round(8 * S)}px "Nanum Myeongjo", "Malgun Gothic", serif`;
      const tagFont = `800 ${Math.round(6.5 * S)}px "Malgun Gothic", sans-serif`;
      ctx.font = nameFont;
      const nameW = ctx.measureText(c.name).width;
      ctx.font = tagFont;
      const tagW = ctx.measureText(tag).width + 6 * S;
      const pad = 5 * S, h = 14 * S;
      const total = tagW + nameW + pad * 3;
      const x0 = clamp(p.x - total / 2, 4 * S, W * S - total - 4 * S), y0 = Math.max(26 * S, p.y - h) - (1 - slide) * 6 * S;
      // 어두운 명판 + 위아래 가는 빛줄 + 양끝 다이아몬드
      const gr = ctx.createLinearGradient(x0, 0, x0 + total, 0);
      gr.addColorStop(0, 'rgba(8,5,14,0)'); gr.addColorStop(0.12, 'rgba(8,5,14,0.88)');
      gr.addColorStop(0.88, 'rgba(8,5,14,0.88)'); gr.addColorStop(1, 'rgba(8,5,14,0)');
      ctx.fillStyle = gr;
      ctx.fillRect(x0 - 8 * S, y0, total + 16 * S, h);
      const gl = ctx.createLinearGradient(x0, 0, x0 + total, 0);
      gl.addColorStop(0, 'rgba(0,0,0,0)'); gl.addColorStop(0.5, col); gl.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gl;
      ctx.fillRect(x0 - 8 * S, y0, total + 16 * S, Math.max(1, 0.6 * S));
      ctx.fillRect(x0 - 8 * S, y0 + h - Math.max(1, 0.6 * S), total + 16 * S, Math.max(1, 0.6 * S));
      ctx.fillStyle = col;
      for (const dx of [x0 - 6 * S, x0 + total + 6 * S]) {
        ctx.save(); ctx.translate(dx, y0 + h / 2); ctx.rotate(Math.PI / 4);
        ctx.fillRect(-1.6 * S, -1.6 * S, 3.2 * S, 3.2 * S); ctx.restore();
      }
      // 종류 글자 (빛나는 글씨)
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = tagFont;
      ctx.globalAlpha *= 0.4;
      ctx.lineWidth = 3 * S; ctx.strokeStyle = col;
      ctx.strokeText(tag, x0 + pad + tagW / 2, y0 + h / 2 + 0.5 * S);
      ctx.globalAlpha /= 0.4;
      ctx.fillStyle = '#fffaf0';
      ctx.fillText(tag, x0 + pad + tagW / 2, y0 + h / 2 + 0.5 * S);
      ctx.fillStyle = col;
      ctx.fillRect(x0 + pad + tagW + pad * 0.5, y0 + 3.5 * S, Math.max(1, 0.5 * S), h - 7 * S);
      ctx.font = nameFont;
      ctx.fillStyle = '#fff6e0';
      ctx.textAlign = 'left';
      ctx.fillText(c.name, x0 + pad * 2 + tagW, y0 + h / 2 + 0.5 * S);
      ctx.fillStyle = col;
      const tx = clamp(p.x, x0 + 6 * S, x0 + total - 6 * S);
      ctx.beginPath(); ctx.moveTo(tx - 3 * S, y0 + h); ctx.lineTo(tx + 3 * S, y0 + h); ctx.lineTo(tx, y0 + h + 4 * S); ctx.fill();
      ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'center';
    }
    ctx.restore();
  },
};

// ---------------- 모양 이펙트들 ----------------

// 퍼지는 고리 (얇은 충격파)
class RingFx {
  constructor(x, y, r0, r1, color, life, width = 2, squash = 1) {
    Object.assign(this, { x, y, r0, r1, color, life, width, squash, t: 0 });
  }
  update(dt) { this.t += dt; return this.t < this.life; }
  draw(ctx) {
    const k = this.t / this.life;
    const r = lerp(this.r0, this.r1, 1 - (1 - k) * (1 - k));
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 1 - k;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = Math.max(0.5, this.width * (1 - k));
    ctx.beginPath();
    ctx.ellipse(this.x, this.y, r, r * this.squash, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
}

// 두꺼운 충격파 (안쪽이 은은하게 빛나는 고리)
class ShockFx {
  constructor(x, y, r0, r1, color, life, width = 8, squash = 1) {
    Object.assign(this, { x, y, r0, r1, color, life, width, squash, t: 0 });
  }
  update(dt) { this.t += dt; return this.t < this.life; }
  draw(ctx) {
    const k = this.t / this.life;
    const e = 1 - Math.pow(1 - k, 3);
    const r = lerp(this.r0, this.r1, e);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(this.x, this.y);
    ctx.scale(1, this.squash);
    const g = ctx.createRadialGradient(0, 0, Math.max(0, r - this.width * 2), 0, 0, r);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.8, this.color);
    g.addColorStop(1, 'rgba(255,255,255,0.9)');
    ctx.globalAlpha = (1 - k) * 0.9;
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1 - k;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(0.5, 2 * (1 - k));
    ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
    ctx.restore();
  }
}

// 빛줄기 (가운데서 뻗어나가는 빛살)
class RaysFx {
  constructor(x, y, n, len, color, life, width = 0.1, follow = null) {
    this.rays = [];
    for (let i = 0; i < n; i++) this.rays.push({ a: (i / n) * TAU + rand(-0.2, 0.2), l: rand(0.5, 1) });
    Object.assign(this, { x, y, len, color, life, width, t: 0, follow, spin: rand(-1, 1) });
  }
  update(dt) { this.t += dt; return this.t < this.life; }
  draw(ctx) {
    const k = this.t / this.life;
    let x = this.x, y = this.y;
    if (this.follow) { const p = this.follow(); x = p.x; y = p.y; }
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(x, y);
    ctx.rotate(this.spin * k);
    ctx.globalAlpha = (1 - k) * 0.8;
    const grow = Math.min(1, k * 4);
    ctx.fillStyle = this.color;
    for (const r of this.rays) {
      const L = this.len * r.l * grow;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(r.a - this.width) * L, Math.sin(r.a - this.width) * L);
      ctx.lineTo(Math.cos(r.a) * L * 1.08, Math.sin(r.a) * L * 1.08);
      ctx.lineTo(Math.cos(r.a + this.width) * L, Math.sin(r.a + this.width) * L);
      ctx.fill();
    }
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha *= 0.8;
    for (const r of this.rays) {
      const L = this.len * r.l * grow * 0.35;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(r.a - this.width * 0.5) * L, Math.sin(r.a - this.width * 0.5) * L);
      ctx.lineTo(Math.cos(r.a + this.width * 0.5) * L, Math.sin(r.a + this.width * 0.5) * L);
      ctx.fill();
    }
    ctx.restore();
  }
}

// 맞은 순간 번쩍이는 별 모양
class ImpactFx {
  constructor(x, y, size, color, life = 0.14, points = 4, rot = 0) {
    Object.assign(this, { x, y, size, color, life, points, rot: rot || rand(0, 1), t: 0 });
  }
  update(dt) { this.t += dt; return this.t < this.life; }
  draw(ctx) {
    const k = this.t / this.life;
    const s = this.size * (k < 0.3 ? k / 0.3 : 1 - (k - 0.3) / 0.7 * 0.6);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rot);
    ctx.globalAlpha = 1 - k * k;
    for (const [col, m] of [[this.color, 1], ['#ffffff', 0.55]]) {
      ctx.fillStyle = col;
      ctx.beginPath();
      for (let i = 0; i < this.points * 2; i++) {
        const a = (i / (this.points * 2)) * TAU;
        const r = (i % 2 === 0 ? s : s * 0.16) * m;
        ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
}

// 반달 모양 칼날 궤적 (채워진 초승달, 휘두르는 방향으로 그려져요)
class SlashFx {
  constructor(x, y, r, a0, a1, o = {}) {
    Object.assign(this, {
      x, y, r, a0, a1, t: 0,
      life: o.life || 0.22, thick: o.thick || 10,
      core: o.core || '#ffffff', edge: o.edge || '#9ff4ff', glow: o.glow || 'rgba(60,200,255,0.6)',
      squash: o.squash || 1, rot: o.rot || 0, follow: o.follow || null,
    });
  }
  update(dt) { this.t += dt; return this.t < this.life; }
  crescent(ctx, from, to, r, thick) {
    const N = 22;
    ctx.beginPath();
    for (let i = 0; i <= N; i++) {
      const u = i / N, a = lerp(from, to, u);
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    for (let i = N; i >= 0; i--) {
      const u = i / N, a = lerp(from, to, u);
      const rr = r - thick * Math.sin(u * Math.PI) * (0.3 + 0.7 * u);
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
  }
  draw(ctx) {
    const k = this.t / this.life;
    const head = Math.min(1, k / 0.3);
    const tail = Math.max(0, (k - 0.15) / 0.85);
    const from = lerp(this.a0, this.a1, tail), to = lerp(this.a0, this.a1, head);
    if (Math.abs(to - from) < 0.01) return;
    let x = this.x, y = this.y;
    if (this.follow) { const p = this.follow(); x += p.x; y += p.y; }
    const fade = 1 - Math.max(0, (k - 0.4) / 0.6);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(x, y);
    ctx.rotate(this.rot);
    ctx.scale(1, this.squash);
    ctx.globalAlpha = 0.45 * fade; ctx.fillStyle = this.glow;
    this.crescent(ctx, from, to, this.r + this.thick * 0.35, this.thick * 1.8);
    ctx.globalAlpha = 0.85 * fade; ctx.fillStyle = this.edge;
    this.crescent(ctx, from, to, this.r, this.thick);
    ctx.globalAlpha = fade; ctx.fillStyle = this.core;
    this.crescent(ctx, from, to, this.r - this.thick * 0.1, this.thick * 0.45);
    ctx.restore();
  }
}

// 반짝 별 (보스 공격 신호: 노랑 = 패링 가능, 빨강 = 피하기)
class GlintFx {
  constructor(x, y, color, size = 22, life = 0.45, follow = null) {
    Object.assign(this, { x, y, color, size, life, t: 0, follow });
  }
  update(dt) { this.t += dt; return this.t < this.life; }
  draw(ctx) {
    const k = this.t / this.life;
    const s = this.size * Math.sin(Math.min(1, k * 1.6) * Math.PI) + 2;
    let x = this.x, y = this.y;
    if (this.follow) { const p = this.follow(); x = p.x; y = p.y; }
    glowCircle(ctx, x, y, s * 1.4, this.color, 0.6 * (1 - k));
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(x, y);
    ctx.rotate(k * 0.8);
    ctx.fillStyle = this.color;
    ctx.globalAlpha = 0.95;
    for (let i = 0; i < 4; i++) {
      ctx.rotate(Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.lineTo(s * 0.1, 0);
      ctx.lineTo(-s * 0.1, 0);
      ctx.fill();
    }
    ctx.rotate(Math.PI / 4);
    ctx.globalAlpha = 0.5;
    for (let i = 0; i < 4; i++) {
      ctx.rotate(Math.PI / 2);
      ctx.beginPath(); ctx.moveTo(0, -s * 0.5); ctx.lineTo(s * 0.07, 0); ctx.lineTo(-s * 0.07, 0); ctx.fill();
    }
    ctx.fillStyle = '#fff';
    ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.arc(0, 0, 2, 0, TAU); ctx.fill();
    ctx.restore();
  }
}

// 공격 신호 묶음: 모여드는 고리 + 별 + 빛살 (+ 위험이면 느낌표)
class TellFx {
  constructor(x, y, danger, follow = null) {
    Object.assign(this, { x, y, danger, follow, t: 0, life: danger ? 0.65 : 0.5 });
    this.color = danger ? '#ff2a2a' : '#ffd84a';
    this.glint = new GlintFx(x, y, this.color, danger ? 36 : 28, this.life, follow);
    this.rays = new RaysFx(x, y, danger ? 10 : 8, danger ? 60 : 44, this.color, this.life, 0.05, follow);
  }
  update(dt) { this.t += dt; this.glint.update(dt); this.rays.update(dt); return this.t < this.life; }
  draw(ctx) {
    let x = this.x, y = this.y;
    if (this.follow) { const p = this.follow(); x = p.x; y = p.y; }
    const k = this.t / this.life;
    // 바깥에서 안으로 좁혀오는 고리 (언제 공격이 오는지 알려줘요)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = this.color;
    ctx.globalAlpha = Math.min(1, k * 3) * (1 - k * 0.5);
    ctx.lineWidth = 1.5;
    const r = lerp(46, 6, Math.min(1, k * 1.3));
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
    ctx.lineWidth = 0.75;
    ctx.beginPath(); ctx.arc(x, y, r * 1.25, 0, TAU); ctx.stroke();
    ctx.restore();
    this.rays.draw(ctx);
    this.glint.draw(ctx);
    if (this.danger) {
      // 머리 위 붉은 느낌표
      const by = y - 30 - Math.sin(Math.min(1, k * 4) * Math.PI * 0.5) * 6;
      ctx.save();
      ctx.globalAlpha = k > 0.8 ? (1 - k) / 0.2 : 1;
      ctx.fillStyle = '#200000';
      ctx.fillRect(x - 3, by - 13, 6, 12); ctx.fillRect(x - 3, by + 1, 6, 5);
      ctx.fillStyle = '#ff3a3a';
      ctx.fillRect(x - 2, by - 12, 4, 10); ctx.fillRect(x - 2, by + 2, 4, 3);
      ctx.restore();
    }
  }
}

// 땅 위 경고 표시 (곧 무언가 솟아오르는 곳) — 빛나는 마법진 + 솟을 높이만큼 빛기둥
class GroundWarnFx {
  constructor(x, w, life, color = '#ff3030', h = 0) {
    Object.assign(this, { x, w, life, color, t: 0, h, seed: Math.random() * 10 });
  }
  update(dt) { this.t += dt; return this.t < this.life; }
  draw(ctx) {
    const k = this.t / this.life;
    const r = this.w / 2 * (0.5 + 0.5 * Math.min(1, k * 3));
    if (this.h) lightPillar(ctx, this.x, GROUND, r * 1.6, this.h, this.color, 0.2 + 0.45 * k, this.t, this.seed);
    drawSigil(ctx, this.x, GROUND, r + 4, this.color, this.t + this.seed, k, 0.26, 0.6 + 0.4 * k);
  }
}

// 잔상 (대시, 돌진할 때)
class AfterImageFx {
  constructor(sprite, anim, frame, x, y, scale, facing, color, life = 0.3) {
    Object.assign(this, { sprite, anim, frame, x, y, scale, facing, color, life, t: 0 });
  }
  update(dt) { this.t += dt; return this.t < this.life; }
  draw(ctx) {
    const k = 1 - this.t / this.life;
    drawSprite(ctx, this.sprite, this.anim, this.frame, this.x, this.y, this.scale, this.facing,
      { white: true, alpha: 0.5 * k, comp: 'lighter' });
  }
}

// 가는 선 칼자국 / 할퀴기 (옛 방식, 보조용)
class ArcFx {
  constructor(x, y, r, a0, a1, color, life = 0.18, width = 6) {
    this.s = new SlashFx(x, y, r, a0, a1, { life, thick: width * 1.6, edge: color, glow: color, core: '#ffffff' });
  }
  update(dt) { return this.s.update(dt); }
  draw(ctx) { this.s.draw(ctx); }
}

// 곧게 뻗는 선 (패링 불꽃)
class StreakFx {
  constructor(x, y, angle, len, color, life = 0.15, width = 2) {
    Object.assign(this, { x, y, angle, len, color, life, width, t: 0 });
  }
  update(dt) { this.t += dt; return this.t < this.life; }
  draw(ctx) {
    const k = this.t / this.life;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 1 - k;
    ctx.strokeStyle = this.color;
    ctx.lineWidth = this.width * (1 - k * 0.5);
    ctx.lineCap = 'round';
    const l0 = this.len * k, l1 = this.len * Math.min(1, k + 0.6);
    ctx.beginPath();
    ctx.moveTo(this.x + Math.cos(this.angle) * l0, this.y + Math.sin(this.angle) * l0);
    ctx.lineTo(this.x + Math.cos(this.angle) * l1, this.y + Math.sin(this.angle) * l1);
    ctx.stroke();
    ctx.restore();
  }
}

// 화면 가장자리에서 안쪽으로 모이는 집중선
class SpeedLinesFx {
  constructor(color, life = 0.35, n = 40) {
    this.lines = [];
    for (let i = 0; i < n; i++) this.lines.push({ a: rand(0, TAU), w: rand(0.004, 0.012), l: rand(0.25, 0.5) });
    Object.assign(this, { color, life, t: 0 });
  }
  update(dt) { this.t += dt; return this.t < this.life; }
  draw(ctx) {
    const k = this.t / this.life;
    const cx = FX.camX + W / 2, cy = H / 2;
    const R = W * 0.75;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = (1 - k) * 0.55;
    ctx.fillStyle = this.color;
    for (const ln of this.lines) {
      const r1 = R * (1 - ln.l * (0.6 + 0.4 * k));
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ln.a - ln.w) * R, cy + Math.sin(ln.a - ln.w) * R);
      ctx.lineTo(cx + Math.cos(ln.a) * r1, cy + Math.sin(ln.a) * r1);
      ctx.lineTo(cx + Math.cos(ln.a + ln.w) * R, cy + Math.sin(ln.a + ln.w) * R);
      ctx.fill();
    }
    ctx.restore();
  }
}

// 땅에 남는 그을린 자국
class ScorchFx {
  constructor(x, w, color = 'rgba(0,0,0,0.5)', life = 2.5, glow = null) {
    Object.assign(this, { x, w, color, life, glow, t: 0 });
  }
  update(dt) { this.t += dt; return this.t < this.life; }
  draw(ctx) {
    const k = this.t / this.life;
    ctx.save();
    ctx.globalAlpha = 1 - k;
    ctx.translate(this.x, GROUND + 1);
    ctx.scale(1, 0.18);
    ctx.fillStyle = this.color;
    ctx.beginPath(); ctx.arc(0, 0, this.w / 2, 0, TAU); ctx.fill();
    if (this.glow) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = (1 - k) * 0.8;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(glowSprite(this.glow), -this.w / 2, -this.w / 2, this.w, this.w);
    }
    ctx.restore();
  }
}

// 둥근 빛 번짐
class GlowFx {
  constructor(x, y, r, color, life, follow = null) {
    Object.assign(this, { x, y, r, color, life, t: 0, follow });
  }
  update(dt) { this.t += dt; return this.t < this.life; }
  draw(ctx) {
    let x = this.x, y = this.y;
    if (this.follow) { const p = this.follow(); x = p.x; y = p.y; }
    glowCircle(ctx, x, y, this.r, this.color, 1 - this.t / this.life);
  }
}

// 은은한 빛 원 하나 그리기 (자주 써요)
// 매번 그라데이션을 새로 만들면 느려서, 색깔마다 한 번만 그려 두고 재사용해요.
const GlowCache = new Map();
function glowSprite(color) {
  let c = GlowCache.get(color);
  if (!c) {
    c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    // 가운데가 밝고 바깥으로 부드럽게
    const gr2 = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr2.addColorStop(0, color);
    gr2.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr2;
    g.fillRect(0, 0, 64, 64);
    GlowCache.set(color, c);
  }
  return c;
}
function glowCircle(ctx, x, y, r, color, alpha = 1) {
  if (r <= 0 || alpha <= 0.01) return;
  const prevOp = ctx.globalCompositeOperation, prevA = ctx.globalAlpha, prevS = ctx.imageSmoothingEnabled;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = prevA * Math.min(1, alpha);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(glowSprite(color), x - r, y - r, r * 2, r * 2);
  ctx.globalCompositeOperation = prevOp; ctx.globalAlpha = prevA; ctx.imageSmoothingEnabled = prevS;
}

// ---------------- 더 강한 이펙트들 ----------------

// 베인 자국: 한 줄로 길게 번쩍 그어지는 빛
class CutFx {
  constructor(x, y, ang, len, color, life = 0.2, width = 3) {
    Object.assign(this, { x, y, ang, len, color, life, width, t: 0 });
  }
  update(dt) { this.t += dt; return this.t < this.life; }
  draw(ctx) {
    const k = this.t / this.life;
    const grow = Math.min(1, k / 0.18);
    const L = this.len * grow * (1 + k * 0.15);
    const w = this.width * (1 - k * 0.7);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(this.x, this.y);
    ctx.rotate(this.ang);
    for (const [c, m, a] of [[this.color, 4, 0.3], [this.color, 1.8, 0.8], ['#ffffff', 0.7, 1]]) {
      ctx.globalAlpha = a * (1 - k);
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.moveTo(-L / 2, 0); ctx.lineTo(0, -w * m); ctx.lineTo(L / 2, 0); ctx.lineTo(0, w * m);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }
}

// 번개 (지그재그로 번쩍이는 선)
class LightningFx {
  constructor(x1, y1, x2, y2, color, life = 0.2, segs = 8, jag = 8, width = 2) {
    Object.assign(this, { x1, y1, x2, y2, color, life, segs, jag, width, t: 0, regen: 0, pts: null });
  }
  make() {
    this.pts = [];
    const dx = this.x2 - this.x1, dy = this.y2 - this.y1, len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    for (let i = 0; i <= this.segs; i++) {
      const u = i / this.segs, off = (i === 0 || i === this.segs) ? 0 : rand(-1, 1) * this.jag;
      this.pts.push([this.x1 + dx * u + nx * off, this.y1 + dy * u + ny * off]);
    }
  }
  update(dt) {
    this.t += dt; this.regen -= dt;
    if (this.regen <= 0) { this.regen = 0.035; this.make(); }
    return this.t < this.life;
  }
  draw(ctx) {
    if (!this.pts) this.make();
    const k = this.t / this.life;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineJoin = 'round';
    for (const [c, w, a] of [[this.color, this.width * 4, 0.35], [this.color, this.width * 1.6, 0.9], ['#ffffff', this.width * 0.6, 1]]) {
      ctx.strokeStyle = c; ctx.lineWidth = w; ctx.globalAlpha = a * (1 - k) * (0.7 + Math.random() * 0.3);
      ctx.beginPath();
      for (const [x, y] of this.pts) ctx.lineTo(x, y);
      ctx.stroke();
    }
    ctx.restore();
  }
}

// 땅이 갈라진 자국 (처음엔 빛나다가 어두운 금으로 남아요)
class CrackFx {
  constructor(x, w, color, life = 2.6) {
    Object.assign(this, { x, w, color, life, t: 0 });
    this.lines = [];
    const n = 6 + Math.floor(w / 25);
    for (let i = 0; i < n; i++) {
      const dir = i % 2 ? 1 : -1;
      const pts = [[0, 0]];
      let px = 0, py = 0;
      const len = rand(0.4, 1) * w / 2;
      const down = rand(0, 1) < 0.35;
      for (let k = 0; k < 5; k++) {
        px += dir * len / 5 * rand(0.6, 1.3);
        py += down ? rand(1, 5) : rand(-0.6, 1.2);
        pts.push([px, py]);
      }
      this.lines.push(pts);
    }
  }
  update(dt) { this.t += dt; return this.t < this.life; }
  draw(ctx) {
    const k = this.t / this.life;
    ctx.save();
    ctx.translate(this.x, GROUND + 0.5);
    ctx.lineJoin = 'round';
    ctx.globalAlpha = (1 - k) * 0.8;
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    for (const l of this.lines) { ctx.beginPath(); for (const [x, y] of l) ctx.lineTo(x, y); ctx.stroke(); }
    const glow = Math.max(0, 1 - this.t / 0.9);
    if (glow > 0) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 1;
      ctx.globalAlpha = glow;
      for (const l of this.lines) { ctx.beginPath(); for (const [x, y] of l) ctx.lineTo(x, y); ctx.stroke(); }
    }
    ctx.restore();
  }
}

// 땅 위에 잠깐 남는 불씨 (불꽃이 계속 피어올라요)
class EmberPatchFx {
  constructor(x, w, colors, life = 1.2) { Object.assign(this, { x, w, colors, life, t: 0 }); }
  update(dt) {
    this.t += dt;
    const k = 1 - this.t / this.life;
    if (Math.random() < dt * 40 * k) {
      FX.particle({ x: this.x + rand(-this.w / 2, this.w / 2), y: GROUND - 1, vx: rand(-10, 10), vy: rand(-90, -30), life: rand(0.3, 0.6), size: rand(1, 3), color: pick(this.colors), glow: true, floor: false });
    }
    return this.t < this.life;
  }
  draw(ctx) {
    const k = 1 - this.t / this.life;
    groundLight(ctx, this.x, this.colors[0], 0.6 * k, this.w);
  }
}

// 땅에 비치는 빛 (빛나는 것 아래에 그려요)
function groundLight(ctx, x, color, intensity, width = 60) {
  if (intensity <= 0.02) return;
  const prevOp = ctx.globalCompositeOperation, prevA = ctx.globalAlpha, prevS = ctx.imageSmoothingEnabled;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = prevA * Math.min(1, intensity);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(glowSprite(color), x - width, GROUND + 2 - width * 0.18, width * 2, width * 0.36);
  ctx.globalCompositeOperation = prevOp; ctx.globalAlpha = prevA; ctx.imageSmoothingEnabled = prevS;
}


// ---------------- 공격 예고 (범위·경로·방향) — 빛나는 마법진 스타일 ----------------
const WARN_COL = { parry: '#ffd84a', danger: '#ff3a2a' };

// 보스의 스킬이 중간에 끊기면 예고도 빨리 사라져요
function warnAlive(e) {
  if (e.boss && (e.boss.gen !== e.gen || e.boss.stunT > 0 || e.boss.dead)) {
    e.t = Math.max(e.t, e.life - 0.06);
  }
}

// 룬 글자 모양 (작은 선 몇 개로 된 기호)
const RUNES = [
  [[-1, -1, -1, 1], [-1, -1, 1, 0], [-1, 0.2, 1, 0]],
  [[0, -1, 0, 1], [-1, -0.4, 1, -0.4], [-1, 0.6, 0, 1]],
  [[-1, 1, 0, -1], [0, -1, 1, 1], [-0.5, 0.2, 0.5, 0.2]],
  [[-1, -1, 1, 1], [1, -1, -1, 1], [0, -1, 0, -0.4]],
  [[-1, -1, 1, -1], [0, -1, 0, 1], [-1, 1, 1, 0.4]],
  [[-1, 0, 0, -1], [0, -1, 1, 0], [1, 0, 0, 1], [0, 1, -1, 0]],
];

// 마법진 그리기: 바깥 두 고리 + 도는 룬 + 안쪽 별 + 시간이 차오르는 고리
function drawSigil(ctx, x, y, r, color, t, prog, squash = 0.28, power = 1) {
  if (r < 2) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.translate(x, y);
  ctx.scale(1, squash);
  // 바닥에 번지는 빛
  ctx.globalAlpha = 0.45 * power;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(glowSprite(color), -r * 1.35, -r * 1.35, r * 2.7, r * 2.7);
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  // 바깥 고리 두 개
  ctx.globalAlpha = 0.85 * power;
  ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, TAU); ctx.stroke();
  ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.arc(0, 0, r * 0.8, 0, TAU); ctx.stroke();
  // 도는 룬 글자
  const n = Math.max(6, Math.min(16, Math.floor(r / 5)));
  const gs = Math.min(3.2, r * 0.07);
  ctx.lineWidth = 0.9;
  ctx.globalAlpha = 0.9 * power;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + t * 0.6;
    const rr = r * 0.9;
    ctx.save();
    ctx.translate(Math.cos(a) * rr, Math.sin(a) * rr);
    ctx.rotate(a + Math.PI / 2);
    ctx.beginPath();
    for (const [x1, y1, x2, y2] of RUNES[i % RUNES.length]) { ctx.moveTo(x1 * gs, y1 * gs); ctx.lineTo(x2 * gs, y2 * gs); }
    ctx.stroke();
    ctx.restore();
  }
  // 안쪽 육망성 (반대로 돌아요)
  ctx.globalAlpha = 0.55 * power;
  ctx.lineWidth = 0.9;
  for (let tri = 0; tri < 2; tri++) {
    ctx.beginPath();
    for (let i = 0; i <= 3; i++) {
      const a = -t * 0.9 + tri * Math.PI / 3 + (i / 3) * TAU;
      ctx.lineTo(Math.cos(a) * r * 0.72, Math.sin(a) * r * 0.72);
    }
    ctx.stroke();
  }
  ctx.beginPath(); ctx.arc(0, 0, r * 0.36, 0, TAU); ctx.stroke();
  // 시간이 차오르는 밝은 고리 (다 차면 공격!)
  if (prog > 0) {
    ctx.globalAlpha = power;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.arc(0, 0, r, -Math.PI / 2, -Math.PI / 2 + TAU * Math.min(1, prog)); ctx.stroke();
    if (prog > 0.85) {
      ctx.globalAlpha = (prog - 0.85) / 0.15 * (0.5 + 0.5 * Math.sin(t * 60));
      ctx.drawImage(glowSprite('#ffffff'), -r, -r, r * 2, r * 2);
    }
  }
  ctx.restore();
}

// 땅에서 올라오는 빛 커튼 (공격이 닿는 높이)
function lightPillar(ctx, x, bottom, w, h, color, power, t, seed = 0) {
  if (h <= 0 || power <= 0.01) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.imageSmoothingEnabled = true;
  ctx.globalAlpha = Math.min(1, power);
  // 아래가 밝고 위로 사라지는 빛 (빛 원을 길게 늘여서)
  ctx.drawImage(glowSprite(color), x - w / 2, bottom - h * 1.1, w, h * 2.2);
  // 위로 떠오르는 빛 알갱이
  ctx.fillStyle = color;
  for (let i = 0; i < 7; i++) {
    const u = ((i * 0.618 + seed) % 1);
    const yy = bottom - ((t * 55 + i * 31) % h);
    const fade = 1 - (bottom - yy) / h;
    ctx.globalAlpha = Math.min(1, power * 1.6) * fade;
    ctx.fillRect(x - w * 0.4 + u * w * 0.8, yy, 1.5, 3);
  }
  ctx.restore();
}

// 맞는 범위: 발밑 마법진 + 범위만큼 솟는 빛 커튼 + 모서리 장식
class ZoneFx {
  constructor(getRect, life, kind, boss) {
    Object.assign(this, { getRect, life, kind, t: 0, boss, seed: Math.random() * 10 });
    if (boss) this.gen = boss.gen;
  }
  update(dt) { this.t += dt; warnAlive(this); return this.t < this.life; }
  draw(ctx) {
    const r = this.getRect();
    const k = this.t / this.life;
    const col = WARN_COL[this.kind] || WARN_COL.danger;
    const fade = Math.min(1, this.t / 0.1);
    const bx = r.x + r.w / 2, by = Math.min(GROUND, r.y + r.h);
    lightPillar(ctx, bx, by, r.w * 1.25, r.h, col, (0.18 + 0.35 * k) * fade, this.t, this.seed);
    drawSigil(ctx, bx, by, r.w / 2 + 2, col, this.t + this.seed, k, 0.24, fade * (0.7 + 0.3 * k));
    // 범위 네 모서리의 빛나는 꺾쇠 (고딕 장식)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.2;
    ctx.globalAlpha = fade * (0.45 + 0.4 * k) * (0.75 + 0.25 * Math.sin(this.t * (10 + k * 30)));
    const c = Math.min(10, r.w * 0.2, r.h * 0.2);
    const corners = [[r.x, r.y, 1, 1], [r.x + r.w, r.y, -1, 1], [r.x, r.y + r.h, 1, -1], [r.x + r.w, r.y + r.h, -1, -1]];
    for (const [cx, cy, sx, sy] of corners) {
      ctx.beginPath(); ctx.moveTo(cx, cy + sy * c); ctx.lineTo(cx, cy); ctx.lineTo(cx + sx * c, cy); ctx.stroke();
      ctx.fillStyle = col;
      ctx.fillRect(cx - 1, cy - 1, 2, 2);
    }
    ctx.restore();
  }
}

// 경로: 탄이 지나갈 길을 따라 흐르는 빛줄기와 빛 알갱이, 끝에는 작은 마법진
class PathFx {
  constructor(points, life, kind, boss, width = 1.5) {
    Object.assign(this, { points, life, kind, t: 0, boss, width });
    if (boss) this.gen = boss.gen;
    this.lens = [0];
    for (let i = 1; i < points.length; i++) {
      const [x0, y0] = points[i - 1], [x1, y1] = points[i];
      this.lens.push(this.lens[i - 1] + Math.hypot(x1 - x0, y1 - y0));
    }
    this.total = this.lens[this.lens.length - 1] || 1;
  }
  update(dt) { this.t += dt; warnAlive(this); return this.t < this.life; }
  at(d) {
    const L = this.lens, P = this.points;
    let i = 1;
    while (i < L.length - 1 && L[i] < d) i++;
    const seg = (L[i] - L[i - 1]) || 1, u = clamp((d - L[i - 1]) / seg, 0, 1);
    return [lerp(P[i - 1][0], P[i][0], u), lerp(P[i - 1][1], P[i][1], u)];
  }
  draw(ctx) {
    const pts = this.points;
    if (pts.length < 2) return;
    const k = this.t / this.life;
    const col = WARN_COL[this.kind] || WARN_COL.danger;
    const a = Math.min(1, this.t / 0.1) * (k > 0.88 ? (1 - k) / 0.12 : 1);
    const reveal = Math.min(1, this.t / 0.15) * this.total;     // 길이 앞으로 뻗어나가요
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.strokeStyle = col;
    const path = () => {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) {
        if (this.lens[i] <= reveal) ctx.lineTo(pts[i][0], pts[i][1]);
        else { const [x, y] = this.at(reveal); ctx.lineTo(x, y); break; }
      }
    };
    for (const [w, al] of [[this.width * 6, 0.1], [this.width * 2.4, 0.3 + 0.25 * k]]) {
      ctx.globalAlpha = a * al; ctx.lineWidth = w; path(); ctx.stroke();
    }
    ctx.strokeStyle = '#ffffff';
    ctx.globalAlpha = a * (0.35 + 0.4 * k); ctx.lineWidth = this.width * 0.6; path(); ctx.stroke();
    // 길을 따라 흐르는 빛 알갱이 (어느 쪽으로 오는지 보여줘요)
    const spacing = 26, off = (this.t * 170) % spacing;
    ctx.imageSmoothingEnabled = true;
    for (let d = off; d < reveal; d += spacing) {
      const [x, y] = this.at(d);
      ctx.globalAlpha = a * 0.9;
      ctx.drawImage(glowSprite(col), x - 5, y - 5, 10, 10);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x - 0.75, y - 0.75, 1.5, 1.5);
    }
    ctx.restore();
    // 끝자리 표시: 땅이면 납작한 마법진, 공중이면 세운 작은 마법진
    if (reveal >= this.total - 1) {
      const [ex, ey] = pts[pts.length - 1];
      const onGround = ey >= GROUND - 6;
      drawSigil(ctx, ex, onGround ? GROUND : ey, onGround ? 14 : 8, col, this.t * 2, k, onGround ? 0.26 : 1, a);
    }
  }
}

// 땅을 따라 달려오는 길: 바닥에 번지는 불길 + 앞으로 흐르는 룬 + 몸 높이만큼의 빛 커튼
class LaneFx {
  constructor(x0, x1, y, h, life, kind, boss) {
    Object.assign(this, { x0, x1, y, h, life, kind, t: 0, boss });
    if (boss) this.gen = boss.gen;
  }
  update(dt) { this.t += dt; warnAlive(this); return this.t < this.life; }
  draw(ctx) {
    const k = this.t / this.life;
    const col = WARN_COL[this.kind] || WARN_COL.danger;
    const dir = Math.sign(this.x1 - this.x0) || 1;
    const len = Math.abs(this.x1 - this.x0);
    const a = Math.min(1, this.t / 0.1) * (k > 0.88 ? (1 - k) / 0.12 : 1);
    const reach = Math.min(1, this.t / 0.2) * len;               // 출발점에서 앞으로 번져가요
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.imageSmoothingEnabled = true;
    // 몸 높이의 은은한 빛 커튼
    ctx.globalAlpha = a * (0.1 + 0.15 * k);
    const left = dir > 0 ? this.x0 : this.x0 - reach;
    ctx.drawImage(glowSprite(col), left - 10, this.y - this.h * 1.1, reach + 20, this.h * 2.2);
    // 바닥 불길: 작은 불꽃 혀가 줄지어 일렁여요
    ctx.fillStyle = col;
    for (let d = 0; d < reach; d += 7) {
      const x = this.x0 + dir * d;
      const fl = 0.5 + 0.5 * Math.sin(this.t * 18 + d * 0.35);
      const hh = (3 + 6 * fl) * (0.6 + 0.6 * k);
      ctx.globalAlpha = a * (0.35 + 0.4 * (1 - d / len));
      ctx.beginPath();
      ctx.moveTo(x - 3, this.y); ctx.quadraticCurveTo(x - 1, this.y - hh * 0.6, x + dir * 1.5, this.y - hh); ctx.quadraticCurveTo(x + 1, this.y - hh * 0.5, x + 3, this.y);
      ctx.fill();
    }
    ctx.globalAlpha = a * 0.7;
    ctx.drawImage(glowSprite(col), left, this.y - 4, reach, 8);
    // 앞으로 흘러가는 룬 (어느 쪽으로 오는지)
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 0.9;
    const step = 34, off = (this.t * 150) % step;
    for (let d = off; d < reach; d += step) {
      const x = this.x0 + dir * d, y = this.y - 5;
      ctx.globalAlpha = a * (0.5 + 0.5 * k);
      ctx.beginPath();
      ctx.moveTo(x - dir * 4, y - 3); ctx.lineTo(x, y); ctx.lineTo(x - dir * 4, y + 3);
      ctx.moveTo(x - dir * 8, y - 3); ctx.lineTo(x - dir * 4, y); ctx.lineTo(x - dir * 8, y + 3);
      ctx.stroke();
    }
    ctx.restore();
    // 출발점 마법진
    drawSigil(ctx, this.x0, this.y, 12, col, this.t * 2, k, 0.26, a);
  }
}
