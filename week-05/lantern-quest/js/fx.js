'use strict';
// 효과 — 불꽃 가루, 떠오르는 숫자, 화면 흔들림, 기술마다 다른 연출

const FX = { parts: [], floats: [], anims: [], shakeA: 0, flashA: 0, flashC: '#ffffff', dim: 0, dimTarget: 0 };

function burst(x, y, o = {}) {
  const n = o.n || 12, cols = o.c || ['#ffffff'];
  for (let i = 0; i < n; i++) {
    const a = o.angle != null ? o.angle + rnd(-(o.spread || 0.5), o.spread || 0.5) : rnd(0, Math.PI * 2);
    const sp = rnd(...(o.spd || [20, 70]));
    const life = rnd(...(o.life || [0.3, 0.7]));
    FX.parts.push({
      x: x + rnd(-(o.r || 0), o.r || 0), y: y + rnd(-(o.r || 0), o.r || 0), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (o.up || 0),
      g: o.g ?? 60, drag: o.drag ?? 2, life, max: life, c: pick(cols), s: o.size || (chance(0.3) ? 1.5 : 0.8), glow: o.glow,
    });
  }
}
function floatNum(x, y, val, color, big) {
  FX.floats.push({ x, y, vy: -38, t: 0, max: 0.95, num: String(val), color, s: big ? 3 : 2 });
}
function floatTxt(x, y, txt, color) {
  FX.floats.push({ x, y, vy: -22, t: 0, max: 1.1, txt, color });
}
function addAnim(dur, draw) {
  return new Promise(res => FX.anims.push({ t: 0, dur: dur / 1000 / (Settings.speed || 1), draw, res }));
}
function shake(a) { if (Settings.shake) FX.shakeA = Math.max(FX.shakeA, a); }
function flash(c, a = 0.5) { FX.flashC = c; FX.flashA = Math.max(FX.flashA, a); }

function fxUpdate(dt) {
  const sdt = dt * (Settings.speed || 1);
  for (let i = FX.parts.length - 1; i >= 0; i--) {
    const p = FX.parts[i];
    p.life -= sdt;
    if (p.life <= 0) { FX.parts.splice(i, 1); continue; }
    p.vx *= 1 - p.drag * sdt; p.vy *= 1 - p.drag * sdt; p.vy += p.g * sdt;
    p.x += p.vx * sdt; p.y += p.vy * sdt;
  }
  for (let i = FX.floats.length - 1; i >= 0; i--) {
    const f = FX.floats[i];
    f.t += dt; f.y += f.vy * dt; f.vy *= 1 - 3 * dt;
    if (f.t > f.max) FX.floats.splice(i, 1);
  }
  for (let i = FX.anims.length - 1; i >= 0; i--) {
    const a = FX.anims[i];
    a.t += dt;
    if (a.t >= a.dur) { FX.anims.splice(i, 1); a.res(); }
  }
  FX.shakeA = Math.max(0, FX.shakeA - dt * 18);
  FX.flashA = Math.max(0, FX.flashA - dt * 2.5);
  FX.dim = lerp(FX.dim, FX.dimTarget, Math.min(1, dt * 5));
}
function fxDraw(g) {
  for (const a of FX.anims) a.draw(g, Math.min(1, a.t / a.dur));
  for (const p of FX.parts) {
    const k = p.life / p.max;
    if (p.glow) softGlow(g, p.x, p.y, p.s * 3, p.c, 0.5 * k);
    g.globalAlpha = k < 0.3 ? k / 0.3 : 1;
    g.fillStyle = p.c;
    g.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s);
  }
  g.globalAlpha = 1;
}
function fxDrawTop(g) {
  for (const f of FX.floats) {
    const k = f.t / f.max, pop = f.t < 0.08 ? 1 + (0.08 - f.t) * 6 : 1;
    g.globalAlpha = k > 0.75 ? (1 - k) / 0.25 : 1;
    if (f.num) drawText(g, f.num, f.x, f.y, f.color, Math.round(f.s * 4.5 * pop), 'center', '#140c1c', true);
    else drawText(g, f.txt, f.x, f.y, f.color, 8);
  }
  g.globalAlpha = 1;
  if (FX.flashA > 0.01) { g.globalAlpha = FX.flashA; g.fillStyle = FX.flashC; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
}

// ---------- 그리기 도구 ----------
function pxLine(g, x0, y0, x1, y1, c, w = 1) {
  g.strokeStyle = c; g.lineWidth = w; g.lineCap = 'round';
  g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
}
function pxCircle(g, cx, cy, r, c, fill) {
  g.beginPath(); g.arc(cx, cy, Math.max(0.1, r), 0, Math.PI * 2);
  if (fill) { g.fillStyle = c; g.fill(); } else { g.strokeStyle = c; g.lineWidth = 0.9; g.stroke(); }
}
const cxOf = u => u.x + u.ox, cyOf = u => u.y + u.oy - u.h * 0.5, topOf = u => u.y + u.oy - u.h;

// ---------- 기술 연출 ----------
// 맞는 순간에 끝나는 약속을 돌려준다
async function playFX(name, src, tgts) {
  const T = tgts.length ? tgts : [src];
  const all = (fn) => Promise.all(T.map(fn));
  switch (name) {
    case 'slash': SFX.play('slash');
      return all(t => addAnim(200, (g, k) => {
        const x = cxOf(t), y = cyOf(t), r = 12 + t.w * 0.25;
        for (let j = 0; j < 3; j++) {
          const a0 = -2.3 + k * 2.6 - j * 0.25;
          g.fillStyle = j ? '#c8d8ff' : '#ffffff';
          for (let s = 0; s < 6; s++) { const a = a0 + s * 0.12; g.fillRect(Math.round(x + Math.cos(a) * (r - j * 2)), Math.round(y + Math.sin(a) * (r - j * 2)), 2, 2); }
        }
        if (k > 0.5 && !t._sp) { t._sp = 1; burst(x, y, { n: 8, c: ['#ffffff', '#ffe066'], spd: [30, 80] }); }
      }).then(() => { t._sp = 0; }));
    case 'pierce': SFX.play('slash');
      return all(t => addAnim(160, (g, k) => {
        const x = cxOf(t), y = cyOf(t);
        pxLine(g, x - 26 + k * 20, y, x - 6 + k * 20, y, '#ffffff'); pxLine(g, x - 22 + k * 20, y - 1, x - 8 + k * 20, y - 1, '#c8d8ff');
        if (k > 0.7 && !t._sp) { t._sp = 1; burst(x, y, { n: 6, c: ['#ffffff', '#ffe066'], angle: 0, spread: 0.8 }); }
      }).then(() => { t._sp = 0; }));
    case 'smash': SFX.play('smash'); shake(3);
      return all(t => addAnim(180, (g, k) => {
        const x = cxOf(t), y = cyOf(t), r = 4 + k * 12;
        g.fillStyle = '#ffffff';
        for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; g.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r), 2, 2); }
        if (!t._sp) { t._sp = 1; burst(x, t.y, { n: 10, c: ['#c8b898', '#a89878'], spd: [20, 50], g: 80, up: 20 }); }
      }).then(() => { t._sp = 0; }));
    case 'bite': SFX.play('bite');
      return all(t => addAnim(200, (g, k) => {
        const x = cxOf(t), y = cyOf(t), d = 14 * (1 - k);
        g.fillStyle = '#ffffff';
        for (let i = -2; i <= 2; i++) { g.fillRect(x + i * 4, Math.round(y - 4 - d), 2, 4); g.fillRect(x + i * 4 + 2, Math.round(y + 1 + d), 2, 4); }
        if (k > 0.8 && !t._sp) { t._sp = 1; burst(x, y, { n: 8, c: ['#e0303a', '#a8202a'], g: 120 }); }
      }).then(() => { t._sp = 0; }));
    case 'claw': SFX.play('slash');
      return all(t => addAnim(180, (g, k) => {
        const x = cxOf(t), y = cyOf(t);
        for (let i = -1; i <= 1; i++) pxLine(g, x - 10 + i * 5, y - 10, x - 10 + i * 5 + 20 * k, y - 10 + 20 * k, '#ffffff');
      }));
    case 'arrow': SFX.play('arrow');
      return all(t => projectile(src, t, 180, (g, x, y, a) => { pxLine(g, x, y, x - Math.cos(a) * 8, y - Math.sin(a) * 8, '#e8e0c8'); g.fillStyle = '#ffffff'; g.fillRect(Math.round(x), Math.round(y), 2, 1); })
        .then(() => burst(cxOf(t), cyOf(t), { n: 6, c: ['#ffffff', '#c8b898'] })));
    case 'arrows': SFX.play('arrow');
      return all((t, i) => addAnim(320, (g, k) => {
        for (let j = 0; j < 4; j++) {
          const kk = clamp(k * 1.6 - j * 0.15, 0, 1), x = cxOf(t) - 12 + j * 7, y = lerp(-10, cyOf(t) + (j % 2) * 6, kk);
          if (kk > 0 && kk < 1) pxLine(g, x - 4, y - 8, x, y, '#e8e0c8');
        }
        if (k > 0.6 && !t._sp) { t._sp = 1; burst(cxOf(t), cyOf(t), { n: 8, c: ['#ffffff', '#c8b898'] }); }
      }).then(() => { t._sp = 0; }));
    case 'fire': SFX.play('fire');
      return all(t => projectile(src, t, 280, (g, x, y) => {
        pxCircle(g, x, y, 3, '#ff6a2a', true); pxCircle(g, x, y, 2, '#ffd34d', true);
        burst(x, y, { n: 1, c: ['#ff6a2a', '#ffd34d', '#c8442a'], spd: [5, 15], g: -30, life: [0.2, 0.4] });
      }, true).then(() => { SFX.play('boom'); flash('#ff8a3a', 0.15); burst(cxOf(t), cyOf(t), { n: 26, c: ['#ff6a2a', '#ffd34d', '#ffffff', '#c8442a'], spd: [30, 90], g: -20, glow: 1 }); }));
    case 'meteor': SFX.play('fire');
      return all((t, i) => addAnim(380 + i * 60, (g, k) => {
        const x = lerp(cxOf(t) + 90, cxOf(t), k), y = lerp(-20, cyOf(t), k);
        pxCircle(g, x, y, 5, '#c8442a', true); pxCircle(g, x - 1, y - 1, 3, '#ffd34d', true);
        burst(x, y, { n: 2, c: ['#ff6a2a', '#ffd34d'], spd: [5, 20], g: -10, life: [0.2, 0.5] });
      }, ease.in).then(() => { SFX.play('boom'); shake(4); flash('#ff8a3a', 0.2); burst(cxOf(t), cyOf(t), { n: 34, c: ['#ff6a2a', '#ffd34d', '#ffffff'], spd: [40, 110], g: 40, glow: 1 }); }));
    case 'ice': SFX.play('ice');
      return all(t => addAnim(260, (g, k) => {
        const x = cxOf(t), y = cyOf(t);
        for (let j = 0; j < 6; j++) {
          const a = (j / 6) * Math.PI * 2, r = 30 * (1 - k);
          pxLine(g, x + Math.cos(a) * (r + 6), y + Math.sin(a) * (r + 6), x + Math.cos(a) * r, y + Math.sin(a) * r, j % 2 ? '#bff0ff' : '#7fd8ff');
        }
      }, ease.in).then(() => { burst(cxOf(t), cyOf(t), { n: 22, c: ['#7fd8ff', '#bff0ff', '#ffffff'], spd: [30, 80], g: 40 }); }));
    case 'blizzard': SFX.play('ice'); FX.dimTarget = 0.2;
      return addAnim(420, (g, k) => {
        g.fillStyle = '#e8f4ff';
        for (let j = 0; j < 60; j++) { const x = (hash(j) * W + k * 260) % W, y = (hash(j + 9) * 200 + k * 140) % 200; g.fillRect(Math.round(x), Math.round(y), 3, 1); }
      }).then(() => { FX.dimTarget = 0; T.forEach(t => burst(cxOf(t), cyOf(t), { n: 20, c: ['#7fd8ff', '#bff0ff', '#ffffff'], spd: [30, 80], g: 40 })); shake(2); });
    case 'bolt': SFX.play('bolt');
      return all(t => addAnim(220, (g, k) => {
        if (k > 0.75) return;
        let x = cxOf(t), y = -4;
        const ty = cyOf(t);
        for (let s = 0; s < 8; s++) {
          const nx = cxOf(t) + rnd(-10, 10) * (1 - s / 8), ny = lerp(-4, ty, (s + 1) / 8);
          pxLine(g, x, y, nx, ny, '#ffffff'); pxLine(g, x + 1, y, nx + 1, ny, '#ffe066');
          x = nx; y = ny;
        }
      }).then(() => { flash('#ffffff', 0.25); burst(cxOf(t), cyOf(t), { n: 16, c: ['#ffe066', '#ffffff'], spd: [40, 100], g: 0, drag: 6 }); }));
    case 'holy': SFX.play('holy');
      return all(t => addAnim(380, (g, k) => {
        const x = cxOf(t), w = Math.round(10 * Math.sin(k * Math.PI));
        g.globalAlpha = 0.5; g.fillStyle = '#fff2a8'; g.fillRect(x - w, 0, w * 2, t.y + 2);
        g.globalAlpha = 0.9; g.fillStyle = '#ffffff'; g.fillRect(x - (w >> 1), 0, w, t.y + 2); g.globalAlpha = 1;
        if (chance(0.5)) burst(x + rnd(-8, 8), t.y - rnd(0, t.h), { n: 1, c: ['#ffe066', '#ffffff'], spd: [5, 15], g: -40, life: [0.4, 0.8] });
      }).then(() => burst(cxOf(t), cyOf(t), { n: 18, c: ['#ffe066', '#ffffff', '#fff2a8'], spd: [20, 60], g: -30, glow: 1 })));
    case 'dark': SFX.play('dark');
      return all(t => addAnim(320, (g, k) => {
        const x = cxOf(t), y = cyOf(t);
        for (let j = 0; j < 5; j++) {
          const a = j * 1.26 + k * 6, r = 26 * (1 - k);
          pxCircle(g, x + Math.cos(a) * r, y + Math.sin(a) * r, 2, j % 2 ? '#7a3ac8' : '#c86aff', true);
        }
      }, ease.in).then(() => burst(cxOf(t), cyOf(t), { n: 20, c: ['#7a3ac8', '#c86aff', '#2a1036'], spd: [30, 80], g: 0 })));
    case 'poison': SFX.play('poison');
      return all(t => addAnim(260, (g, k) => {
        if (!t._sp) { t._sp = 1; burst(cxOf(t), cyOf(t), { n: 18, c: ['#6ad04a', '#3a8a2a', '#b8f070'], spd: [20, 60], g: -20 }); }
        pxCircle(g, cxOf(t), cyOf(t), 4 + k * 10, '#6ad04a');
      }).then(() => { t._sp = 0; }));
    case 'heal': SFX.play('heal');
      return all(t => addAnim(360, (g, k) => {
        pxCircle(g, cxOf(t), t.y - 2, 6 + k * 12, '#6ae07a');
        if (chance(0.6)) { const x = cxOf(t) + rnd(-10, 10), y = t.y - rnd(0, t.h); burst(x, y, { n: 1, c: ['#6ae07a', '#d8ffd0', '#ffffff'], spd: [2, 8], g: -50, life: [0.4, 0.8] }); }
      }));
    case 'buff': SFX.play('buff');
      return all(t => addAnim(300, (g, k) => {
        g.fillStyle = '#ffe066';
        for (let j = 0; j < 4; j++) {
          const x = cxOf(t) - 9 + j * 6, y = t.y - ((k * 30 + j * 7) % 30);
          g.fillRect(x, y, 1, 3); g.fillRect(x - 1, y + 1, 3, 1);
        }
      }));
    case 'roar': SFX.play('roar'); shake(2);
      return addAnim(360, (g, k) => { for (let j = 0; j < 3; j++) pxCircle(g, cxOf(src), cyOf(src), 6 + ((k * 60 + j * 18) % 54), '#ffffff'); });
    case 'quake': SFX.play('smash'); shake(5);
      return all(t => addAnim(240, (g, k) => { if (!t._sp) { t._sp = 1; burst(cxOf(t), t.y, { n: 16, c: ['#a89878', '#7a6a58', '#c8b898'], spd: [30, 70], g: 140, up: 40, angle: -Math.PI / 2, spread: 1.2 }); } })
        .then(() => { t._sp = 0; }));
    case 'web': SFX.play('poison');
      return all(t => addAnim(300, (g, k) => {
        const x = cxOf(t), y = cyOf(t), r = 14 * k;
        for (let j = 0; j < 6; j++) { const a = (j / 6) * Math.PI * 2; pxLine(g, x, y, x + Math.cos(a) * r, y + Math.sin(a) * r, '#e8e8f0'); }
        pxCircle(g, x, y, r * 0.6, '#e8e8f0'); pxCircle(g, x, y, r, '#c8c8d8');
      }));
    case 'sand': SFX.play('wind');
      return addAnim(380, (g, k) => {
        g.fillStyle = '#f0c080';
        for (let j = 0; j < 50; j++) { const x = (hash(j * 3) * W + k * 400) % W, y = 60 + hash(j * 5) * 140; g.fillRect(Math.round(x), Math.round(y), 4, 1); }
      }).then(() => T.forEach(t => burst(cxOf(t), cyOf(t), { n: 8, c: ['#f0c080', '#c08a50'] })));
    case 'smoke': SFX.play('wind');
      return all(t => addAnim(300, (g, k) => { if (!t._sp) { t._sp = 1; burst(cxOf(t), cyOf(t), { n: 20, c: ['#a8a0b8', '#c8c0d8', '#8a8098'], spd: [10, 40], g: -10, size: 3, life: [0.5, 0.9] }); } }).then(() => { t._sp = 0; }));
    case 'summon': SFX.play('dark');
      return addAnim(360, (g, k) => { pxCircle(g, cxOf(src) - 30, src.y, 4 + k * 16, '#c86aff'); pxCircle(g, cxOf(src) - 30, src.y, 2 + k * 10, '#7a3ac8'); });
    case 'eclipse': SFX.play('dark'); FX.dimTarget = 0.55;
      await addAnim(700, (g, k) => {
        const r = Math.round(4 + k * 20);
        pxCircle(g, 240, 60, r + 3, '#ff8a3a', true); pxCircle(g, 240, 60, r, '#0a0612', true);
      });
      FX.dimTarget = 0; flash('#c86aff', 0.4); shake(6);
      T.forEach(t => burst(cxOf(t), cyOf(t), { n: 24, c: ['#7a3ac8', '#c86aff', '#ff8a3a'], spd: [40, 100], g: 20, glow: 1 }));
      return;
    case 'explode': SFX.play('boom'); shake(5); flash('#ffffff', 0.4);
      return burst(cxOf(src), cyOf(src), { n: 40, c: ['#7fd8ff', '#ffffff', '#bff0ff'], spd: [40, 140], g: 20 });
    default: return wait(150);
  }
}

// 날아가는 것 (불덩이, 화살)
function projectile(src, tgt, ms, draw, arc) {
  const x0 = cxOf(src) + (src.side === 'hero' ? 10 : -10), y0 = cyOf(src) - 2, x1 = cxOf(tgt), y1 = cyOf(tgt);
  let px = x0, py = y0;
  return addAnim(ms, (g, k) => {
    const x = lerp(x0, x1, k), y = lerp(y0, y1, k) - (arc ? Math.sin(k * Math.PI) * 18 : 0);
    const a = Math.atan2(y - py, x - px);
    draw(g, x, y, a);
    px = x; py = y;
  }, ease.lin);
}
