'use strict';
// 캔버스 효과 — 별, 유성, 파티클, 화면 흔들림·번쩍임

const bg = $('#bg'), bctx = bg.getContext('2d'), fx = $('#fx'), ctx = fx.getContext('2d');
const stage = $('#stage'), orb = $('#orb'), dim = $('#dim');
let W = 0, H = 0;
function resize() {
  const dpr = Math.min(2, devicePixelRatio || 1);
  W = innerWidth; H = innerHeight;
  for (const c of [bg, fx]) { c.width = W * dpr; c.height = H * dpr; c.style.width = W + 'px'; c.style.height = H + 'px'; }
  bctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
addEventListener('resize', resize);
resize();

// ---------- 별 ----------
const STAR_BASE = 0.0006;
let starSpeed = STAR_BASE, starTarget = STAR_BASE, frozen = false;
const newStar = z => ({ x: Math.random() * 2 - 1, y: Math.random() * 2 - 1, z, tw: Math.random() * 6.28 });
const stars = Array.from({ length: 280 }, () => newStar(0.1 + Math.random() * 0.9));
function drawStars(time) {
  bctx.clearRect(0, 0, W, H);
  if (!frozen) starSpeed += (starTarget - starSpeed) * 0.04;
  const cx = W / 2, cy = H / 2, k = Math.max(W, H) * 0.5, warp = Math.abs(starSpeed) > 0.004;
  for (const s of stars) {
    const pz = s.z;
    if (!frozen) s.z -= starSpeed;
    if (s.z > 1.3) { const u = newStar(0.08); u.x *= 0.08; u.y *= 0.08; Object.assign(s, u); continue; }
    const sx = cx + s.x / s.z * k, sy = cy + s.y / s.z * k;
    if (s.z < 0.03 || sx < -60 || sx > W + 60 || sy < -60 || sy > H + 60) { Object.assign(s, newStar(1)); continue; }
    const b = Math.min(1, (1.05 - s.z) * 1.3) * (warp ? 1 : 0.65 + 0.35 * Math.sin(time / 600 + s.tw));
    const size = (1 - Math.min(1, s.z)) * 2 + 0.4;
    if (warp) {
      bctx.strokeStyle = `rgba(210,220,255,${b})`; bctx.lineWidth = size;
      bctx.beginPath(); bctx.moveTo(cx + s.x / pz * k, cy + s.y / pz * k); bctx.lineTo(sx, sy); bctx.stroke();
    } else {
      bctx.fillStyle = `rgba(210,220,255,${b})`;
      bctx.fillRect(sx, sy, size, size);
    }
  }
}

// ---------- 유성 (유성우·은하 폭풍 이벤트) ----------
const METEORS = [];
function drawMeteors() {
  const rate = !EV ? 0 : EV.id === 'storm' ? 0.3 : EV.id === 'meteor' ? 0.1 : 0;
  if (Math.random() < rate) {
    METEORS.push({ x: Math.random() * W * 1.3, y: -20, vx: -(5 + Math.random() * 6), vy: 7 + Math.random() * 6, color: EV.color });
  }
  for (let i = METEORS.length - 1; i >= 0; i--) {
    const m = METEORS[i];
    m.x += m.vx; m.y += m.vy;
    if (m.y > H + 80 || m.x < -200) { METEORS.splice(i, 1); continue; }
    const g = bctx.createLinearGradient(m.x, m.y, m.x - m.vx * 10, m.y - m.vy * 10);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.2, m.color); g.addColorStop(1, 'rgba(0,0,0,0)');
    bctx.strokeStyle = g; bctx.lineWidth = 2.2;
    bctx.beginPath(); bctx.moveTo(m.x, m.y); bctx.lineTo(m.x - m.vx * 10, m.y - m.vy * 10); bctx.stroke();
  }
}

// ---------- 파티클 ----------
const P = [], RINGS = [];
let OX = 0, OY = 0, OR = 75, CX = 0, CY = 0, vortex = null, cineOn = false, shakeAmt = 0;
function spawn(o) {
  const p = Object.assign({ x: CX, y: CY, vx: 0, vy: 0, life: 60, size: 2, color: '#fff', drag: 0.98, grav: 0 }, o);
  if (p.max == null) p.max = p.life;
  P.push(p);
}
function burst(a, n, speed, x = CX, y = CY) {
  for (let i = 0; i < n; i++) {
    const ang = Math.random() * 6.283, v = Math.random() * speed, life = 40 + Math.random() * 70;
    spawn({ x, y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, life, size: 0.8 + Math.random() * 3.2, color: pc(a), drag: 0.965 });
  }
}
function ring(a, speed = 8, w = 3, x = CX, y = CY) { RINGS.push({ x, y, r: 8, v: speed, w, life: 70, max: 70, color: pc(a) }); }
function gather(a, n, frames) {
  for (let i = 0; i < n; i++) {
    const ang = Math.random() * 6.283, d = Math.max(W, H) * (0.35 + Math.random() * 0.4);
    spawn({ x: CX + Math.cos(ang) * d, y: CY + Math.sin(ang) * d, home: true, life: frames + Math.random() * 20, size: 1 + Math.random() * 2.5, color: pc(a) });
  }
}
function coinRain(n) { // 코인을 얻을 때 위로 튀는 금가루
  for (let i = 0; i < n; i++) {
    spawn({ x: OX + (Math.random() - 0.5) * 40, y: OY, vx: (Math.random() - 0.5) * 5, vy: -3 - Math.random() * 5, grav: 0.18,
      life: 50 + Math.random() * 30, size: 1.5 + Math.random() * 2, color: Math.random() < 0.5 ? '#ffd36b' : '#fff2b8', drag: 0.99 });
  }
}
const shake = a => { shakeAmt = Math.max(shakeAmt, a); };

const RATE = [0.06, 0.12, 0.25, 0.5, 1, 1.6, 2.4, 3.2];
let ambAcc = 0;
function ambient() { // 장착한 오라가 구슬 주변에 내뿜는 빛
  if (cineOn || !$('#modal').hidden) return;
  const a = byId(S.equipped);
  ambAcc += RATE[a.tier];
  while (ambAcc >= 1) {
    ambAcc--;
    const ang = Math.random() * 6.283, r = OR * (0.9 + Math.random() * 0.2), sp = 0.3 + Math.random() * (0.5 + a.tier * 0.25);
    spawn({ x: OX + Math.cos(ang) * r, y: OY + Math.sin(ang) * r, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 0.3,
      life: 50 + Math.random() * 60 + a.tier * 8, size: 0.7 + Math.random() * (1.4 + a.tier * 0.3), color: pc(a), drag: 0.99 });
    if (a.tier >= 5 && Math.random() < 0.35) {
      spawn({ orbit: true, ang: Math.random() * 6.283, rad: OR * (1.35 + Math.random() * 0.6), w: 0.012 + Math.random() * 0.02,
        life: 160 + Math.random() * 80, size: 0.8 + Math.random() * 1.8, color: pc(a) });
    }
  }
}

function drawFx() {
  ctx.clearRect(0, 0, W, H);
  if (vortex) {
    for (let i = 0; i < 9; i++) {
      const ang = Math.random() * 6.283, d = Math.max(W, H) * (0.4 + Math.random() * 0.25);
      spawn({ x: CX + Math.cos(ang) * d, y: CY + Math.sin(ang) * d, vortex: true, life: 400, size: 0.8 + Math.random() * 2.4, color: pc(vortex), drag: 1 });
    }
  }
  ctx.globalCompositeOperation = 'lighter';
  for (let i = P.length - 1; i >= 0; i--) {
    const p = P[i];
    if (p.home) {
      const dx = CX - p.x, dy = CY - p.y;
      p.x += dx * 0.05 - dy * 0.02; p.y += dy * 0.05 + dx * 0.02;
    } else if (p.vortex) {
      const dx = CX - p.x, dy = CY - p.y, d = Math.hypot(dx, dy) || 1, f = 0.45 + Math.min(1.5, 120 / d);
      p.vx = (p.vx + dx / d * f - dy / d * 0.28) * 0.96;
      p.vy = (p.vy + dy / d * f + dx / d * 0.28) * 0.96;
      p.x += p.vx; p.y += p.vy;
      if (d < 26) p.life = 0;
    } else if (p.orbit) {
      p.ang += p.w;
      p.x = OX + Math.cos(p.ang) * p.rad; p.y = OY + Math.sin(p.ang) * p.rad * 0.32;
    } else {
      p.vx *= p.drag; p.vy = p.vy * p.drag + p.grav; p.x += p.vx; p.y += p.vy;
    }
    if (--p.life <= 0) { P.splice(i, 1); continue; }
    const al = p.home || p.vortex ? Math.min(1, p.life / 15) : p.orbit ? Math.min(1, p.life / 30, (p.max - p.life) / 30) : p.life / p.max;
    ctx.fillStyle = p.color;
    ctx.globalAlpha = al;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 6.283); ctx.fill();
    if (p.size > 1.6) { ctx.globalAlpha = al * 0.22; ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 3.2, 0, 6.283); ctx.fill(); }
  }
  for (let i = RINGS.length - 1; i >= 0; i--) {
    const r = RINGS[i];
    r.r += r.v; r.v *= 0.985;
    if (--r.life <= 0) { RINGS.splice(i, 1); continue; }
    ctx.globalAlpha = r.life / r.max; ctx.strokeStyle = r.color; ctx.lineWidth = r.w;
    ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, 6.283); ctx.stroke();
  }
  if (vortex) { // 사건의 지평선
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    const g = ctx.createRadialGradient(CX, CY, 20, CX, CY, 90);
    g.addColorStop(0, '#000'); g.addColorStop(0.45, '#000'); g.addColorStop(0.55, mainColor(vortex)); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(CX, CY, 90, 0, 6.283); ctx.fill();
  }
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  if (P.length > 3000) P.splice(0, P.length - 3000);
}

function frame(time) {
  requestAnimationFrame(frame);
  const r = orb.getBoundingClientRect();
  OX = r.left + r.width / 2; OY = r.top + r.height / 2; OR = r.width / 2;
  if (cineOn) { CX = W / 2; CY = H / 2; } else { CX = OX; CY = OY; }
  drawStars(time);
  drawMeteors();
  ambient();
  drawFx();
  if (shakeAmt > 0.3) {
    const t = `translate(${(Math.random() - 0.5) * shakeAmt * 2}px,${(Math.random() - 0.5) * shakeAmt * 2}px)`;
    stage.style.transform = t; $('#cine').style.transform = t;
    shakeAmt *= 0.93;
    if (shakeAmt <= 0.3) { stage.style.transform = ''; $('#cine').style.transform = ''; }
  }
}

// ---------- 화면 효과 ----------
function flash(color, ms) {
  const f = $('#flash');
  f.style.transition = 'none'; f.style.background = color; f.style.opacity = 1;
  void f.offsetWidth;
  f.style.transition = `opacity ${ms}ms ease-out`; f.style.opacity = 0;
}
function setDim(v, ms) { dim.style.transition = `opacity ${ms}ms`; dim.style.opacity = v; }
let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
}
