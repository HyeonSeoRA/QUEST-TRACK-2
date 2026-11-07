'use strict';
/* RPG 화면 부품: 창, 메뉴, 게이지, 대화창, 알림 */

/* ---------- 창 (남색 그라데이션 + 금테 + 모서리 보석) ----------
 * 창 그림은 크기·색마다 한 번만 그려서 다시 써요 (매 프레임 다시 그리지 않아 가벼움) */
function winTex(scene, w, h, o = {}) {
  const top = o.top != null ? o.top : 0x2a3468, bot = o.bot != null ? o.bot : 0x0c1030, a = o.alpha != null ? o.alpha : 0.94;
  const border = o.border || 0xd8c08a, gems = o.gems !== false;
  const key = `win_${w}x${h}_${top}_${bot}_${a}_${border}_${gems}_${RES}`;
  if (scene.textures.exists(key)) return key;
  const S = RES, t = scene.textures.createCanvas(key, Math.ceil((w + 4) * S), Math.ceil((h + 5) * S)), c = t.getContext();
  const css = (n, al = 1) => `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${al})`;
  const rr = (x, y, ww, hh, r) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + ww, y, x + ww, y + hh, r); c.arcTo(x + ww, y + hh, x, y + hh, r); c.arcTo(x, y + hh, x, y, r); c.arcTo(x, y, x + ww, y, r); c.closePath(); };
  c.scale(S, S);
  c.fillStyle = 'rgba(0,0,0,0.35)'; rr(2, 3, w, h, 5); c.fill();
  c.fillStyle = css(0x080a1c, a); rr(0, 0, w, h, 5); c.fill();
  const g = c.createLinearGradient(0, 3, 0, h - 3); g.addColorStop(0, css(top, a)); g.addColorStop(1, css(bot, a));
  c.fillStyle = g; rr(3, 3, w - 6, h - 6, 3); c.fill();
  c.fillStyle = 'rgba(255,255,255,0.07)'; c.fillRect(4, 4, w - 8, 1);
  c.lineWidth = 1;
  c.strokeStyle = '#05040c'; rr(0.5, 0.5, w - 1, h - 1, 5); c.stroke();
  c.strokeStyle = css(border); rr(1.5, 1.5, w - 3, h - 3, 4); c.stroke();
  c.strokeStyle = css(0x5a4626, 0.9); rr(2.5, 2.5, w - 5, h - 5, 3); c.stroke();
  if (gems) for (const [x, y] of [[2, 2], [w - 2, 2], [2, h - 2], [w - 2, h - 2]]) {
    c.fillStyle = '#3a2a10'; c.beginPath(); c.moveTo(x, y - 3); c.lineTo(x + 3, y); c.lineTo(x, y + 3); c.lineTo(x - 3, y); c.fill();
    c.fillStyle = '#ffe6a0'; c.beginPath(); c.moveTo(x, y - 2); c.lineTo(x + 2, y); c.lineTo(x, y + 2); c.lineTo(x - 2, y); c.fill();
  }
  t.refresh(); t.setFilter(Phaser.Textures.FilterMode.LINEAR);
  return key;
}
/* 창이 열리면 뒤 화면을 어둡게 덮어요 (뒤쪽 글자와 겹쳐 보이지 않게) */
function modalDim(scene, depth) { return scene.add.rectangle(0, 0, GW, GH, 0x05030c, 0.74).setOrigin(0).setDepth(depth).setScrollFactor(0); }
function winImg(scene, x, y, w, h, o) { return scene.add.image(x, y, winTex(scene, w, h, o)).setOrigin(0).setScale(1 / RES); }
function Win(scene, x, y, w, h, o = {}) {
  const c = scene.add.container(Math.round(x), Math.round(y)).setDepth(o.depth != null ? o.depth : 100);
  const g = winImg(scene, 0, 0, w, h, o); c.add(g);
  c.w = w; c.h = h; c.g = g;
  if (o.title) {
    const tt = tx(scene, 0, 0, o.title, { size: 10, bold: true, color: '#ffe8b0' });
    const tw = Math.ceil(tt.width) + 18;
    const tg = winImg(scene, 8, -9, tw, 16, { top: 0x5a3a20, bot: 0x2a1a10, gems: false });
    tt.setPosition(17, -7);
    c.add([tg, tt]);
  }
  if (o.pop !== false) { c.setAlpha(0).setScale(0.96); scene.tweens.add({ targets: c, alpha: 1, scale: 1, duration: 140, ease: 'Quad.easeOut' }); }
  return c;
}

/* ---------- 게이지 ---------- */
function Gauge(scene, x, y, w, h, colA, colB, o = {}) {
  const g = scene.add.graphics().setDepth(o.depth != null ? o.depth : 100);
  const obj = { g, v: 1, trail: 1, w, h, x, y, colA, colB };
  obj.draw = () => {
    g.clear();
    g.fillStyle(0x05040c, 1).fillRect(x - 1, y - 1, w + 2, h + 2);
    g.fillStyle(0x1a1830, 1).fillRect(x, y, w, h);
    if (obj.trail > obj.v) { g.fillStyle(0xffffff, 0.7).fillRect(x, y, Math.round(w * obj.trail), h); }
    const fw = Math.round(w * clamp(obj.v, 0, 1));
    if (fw > 0) {
      g.fillGradientStyle(obj.colA, obj.colB, obj.colA, obj.colB, 1).fillRect(x, y, fw, h);
      g.fillStyle(0xffffff, 0.35).fillRect(x, y, fw, 1);
      g.fillStyle(0x000000, 0.25).fillRect(x, y + h - 1, fw, 1);
    }
  };
  obj.set = (v, instant) => {
    v = clamp(v, 0, 1);
    const tr = (instant || obj.trail < v) ? v : obj.trail;
    if (v === obj.v && tr === obj.trail && obj.colA === obj._a && obj.colB === obj._b) return;
    obj.v = v; obj.trail = tr; obj._a = obj.colA; obj._b = obj.colB; obj.draw();
  };
  obj.update = dt => { if (obj.trail > obj.v) { obj.trail = Math.max(obj.v, obj.trail - dt * 0.6); obj.draw(); } };
  obj.draw();
  return obj;
}

/* ---------- 키 입력 순서 (맨 위 창만 키를 받아요) ---------- */
class UIStack {
  constructor(scene) {
    this.s = scene; this.stack = [];
    onKeys(scene, e => { if (e.repeat && !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) return; const top = this.stack[this.stack.length - 1]; if (top && top.key) top.key(e.code); });
  }
  push(h) { this.stack.push(h); return h; }
  pop(h) { const i = this.stack.lastIndexOf(h); if (i >= 0) this.stack.splice(i, 1); }
  top() { return this.stack[this.stack.length - 1]; }
}

/* ---------- 목록 메뉴 ---------- */
class Menu {
  constructor(scene, x, y, w, items, o = {}) {
    this.s = scene; this.x = x; this.y = y; this.w = w; this.o = o;
    this.rowH = o.rowH || 15; this.i = o.start || 0; this.depth = (o.depth || 100) + 1;
    this.objs = [];
    this.hl = scene.add.graphics().setDepth(this.depth);
    this.cur = scene.add.image(0, 0, 'cursor').setDepth(this.depth + 2);
    this.t = 0;
    this.setItems(items);
    this.tick = scene.time.addEvent({ delay: 16, loop: true, callback: () => { this.t += 0.016; this.cur.x = this.x + 2 + Math.round(Math.sin(this.t * 8)); } });
    if (o.stack) o.stack.push(this);
  }
  setItems(items) {
    this.objs.forEach(o => o.destroy()); this.objs = [];
    this.items = items;
    if (this.i >= items.length) this.i = Math.max(0, items.length - 1);
    items.forEach((it, k) => {
      const y = this.y + k * this.rowH;
      let lx = this.x + 14;
      if (it.icon) { this.objs.push(this.s.add.image(lx + 7, y + this.rowH / 2, 'icons', it.icon).setDepth(this.depth + 1)); lx += 18; }
      const t = tx(this.s, lx, y + this.rowH / 2, it.text, { size: this.o.size || 10, oy: 0.5, color: it.disabled ? '#6a6688' : (it.color || '#f4f0ff') }).setDepth(this.depth + 1);
      this.objs.push(t);
      if (it.right != null) this.objs.push(tx(this.s, this.x + this.w - 6, y + this.rowH / 2, it.right, { size: 10, ox: 1, oy: 0.5, color: it.rcolor || (it.disabled ? '#6a6688' : '#ffe8b0') }).setDepth(this.depth + 1));
      const z = this.s.add.zone(this.x, y, this.w, this.rowH).setOrigin(0).setInteractive({ useHandCursor: true }).setDepth(this.depth + 3);
      z.on('pointerover', () => { if (this.i !== k && this.active()) { this.i = k; AE.ui(); this.draw(); } });
      z.on('pointerdown', () => { if (!this.active()) return; this.i = k; this.draw(); this.ok(); });
      this.objs.push(z);
    });
    this.draw();
  }
  active() { return !this.o.stack || this.o.stack.top() === this; }
  draw() {
    const y = this.y + this.i * this.rowH;
    this.hl.clear();
    if (!this.items.length) { this.cur.setVisible(false); return; }
    this.cur.setVisible(true);
    this.hl.fillGradientStyle(0x6a8aff, 0x6a8aff, 0x6a8aff, 0x6a8aff, 0.28, 0, 0.28, 0).fillRect(this.x + 8, y + 1, this.w - 10, this.rowH - 2);
    this.hl.fillStyle(0xffe6a0, 0.5).fillRect(this.x + 8, y + 1, 1, this.rowH - 2);
    this.cur.setPosition(this.x + 2, y + this.rowH / 2);
    if (this.o.onMove) this.o.onMove(this.items[this.i], this.i);
  }
  ok() {
    const it = this.items[this.i];
    if (!it) return;
    if (it.disabled) { AE.ui('no'); return; }
    if (this.o.onOk) this.o.onOk(it, this.i);
  }
  key(code) {
    const n = this.items.length;
    if (code === 'ArrowUp' || code === 'KeyW') { if (n) { this.i = (this.i + n - 1) % n; AE.ui(); this.draw(); } }
    else if (code === 'ArrowDown' || code === 'KeyS') { if (n) { this.i = (this.i + 1) % n; AE.ui(); this.draw(); } }
    else if (code === 'ArrowLeft' || code === 'KeyA') { if (this.o.onSide) this.o.onSide(-1, this.items[this.i], this.i); }
    else if (code === 'ArrowRight' || code === 'KeyD') { if (this.o.onSide) this.o.onSide(1, this.items[this.i], this.i); }
    else if (OK_KEYS.includes(code)) this.ok();
    else if (BACK_KEYS.includes(code)) { if (this.o.onBack) { AE.ui('back'); this.o.onBack(); } }
  }
  destroy() {
    this.objs.forEach(o => o.destroy()); this.hl.destroy(); this.cur.destroy(); this.tick.remove();
    if (this.o.stack) this.o.stack.pop(this);
  }
}

/* ---------- 예 / 아니요 ---------- */
function confirmBox(scene, stack, text, onYes, onNo) {
  const w = 220, h = 74, x = (GW - w) / 2, y = (GH - h) / 2;
  const dim = modalDim(scene, 299);
  const win = Win(scene, x, y, w, h, { depth: 300 });
  const t = tx(scene, x + w / 2, y + 16, text, { size: 10, ox: 0.5, align: 'center', wrap: w - 20 }).setDepth(302);
  const close = () => { m.destroy(); win.destroy(); t.destroy(); dim.destroy(); };
  const m = new Menu(scene, x + 70, y + 38, 80, [{ text: '예' }, { text: '아니요' }], {
    depth: 300, stack, onOk: (it, i) => { AE.ui(i === 0 ? 'ok' : 'back'); close(); (i === 0 ? onYes : onNo || (() => {}))(); },
    onBack: () => { close(); if (onNo) onNo(); },
  });
  return m;
}

/* ---------- 알림 (위에서 내려왔다 사라짐) ---------- */
function toast(scene, text, color = '#ffe8b0', y = 3) {
  const t = tx(scene, 0, 0, text, { size: 10, bold: true, color });
  const w = Math.ceil(t.width) + 30;
  const c = Win(scene, (GW - w) / 2, y, w, 22, { depth: 400, pop: false });
  t.setPosition(15, 11).setOrigin(0, 0.5); c.add(t);
  c.setAlpha(0); c.y -= 8;
  scene.tweens.add({ targets: c, alpha: 1, y: c.y + 8, duration: 180 });
  scene.tweens.add({ targets: c, alpha: 0, delay: 1700, duration: 300, onComplete: () => c.destroy() });
}

/* ---------- 대화창 ---------- */
class Dialog {
  constructor(scene, stack, lines, onDone) {
    this.s = scene; this.stack = stack; this.lines = lines; this.onDone = onDone; this.k = -1;
    this.objs = [];
    this.win = Win(scene, 8, 192, GW - 16, 72, { depth: 200 });
    this.ptFrame = scene.add.graphics().setDepth(201);
    this.pt = scene.add.image(48, 228, 'pt_ria').setDepth(202);
    this.nameWin = scene.add.image(0, 0, winTex(scene, 40, 17, { top: 0x5a3a20, bot: 0x2a1a10, gems: false })).setOrigin(0).setScale(1 / RES).setDepth(201);
    this.name = tx(scene, 0, 0, '', { size: 10, bold: true }).setDepth(202);
    this.text = tx(scene, 0, 0, '', { size: 11, wrap: 340, ls: 5 }).setDepth(202);
    this.arrow = tx(scene, GW - 24, 252, '▼', { size: 8, color: '#ffe8b0' }).setDepth(202);
    this.narr = tx(scene, GW / 2, 110, '', { size: 12, font: 'serif', ox: 0.5, oy: 0.5, align: 'center', wrap: 400, ls: 8, color: '#f0e8ff' }).setDepth(202);
    this.narrBg = scene.add.rectangle(0, 0, GW, GH, 0x000000, 0).setOrigin(0).setDepth(199);
    [this.win, this.ptFrame, this.pt, this.nameWin, this.name, this.text, this.arrow, this.narr, this.narrBg].forEach(o => o.setScrollFactor(0));
    stack.push(this);
    this.ptr = () => { if (stack.top() === this) this.key('Enter'); };
    scene.input.on('pointerdown', this.ptr);
    this.timer = scene.time.addEvent({ delay: 28, loop: true, callback: () => this.type() });
    this.next();
  }
  next() {
    this.k++;
    if (this.k >= this.lines.length) { this.finish(); return; }
    const [who, str] = this.lines[this.k];
    this.full = str; this.shown = 0; this.who = who;
    const narr = !who;
    this.win.setVisible(!narr); this.pt.setVisible(!narr); this.ptFrame.setVisible(!narr); this.name.setVisible(!narr); this.nameWin.setVisible(!narr); this.text.setVisible(!narr);
    this.narr.setVisible(narr).setText('');
    this.s.tweens.add({ targets: this.narrBg, alpha: narr ? 0.55 : 0, duration: 250 });
    if (narr) return;
    const W = WHO[who];
    this.pt.setTexture(W.pt);
    this.ptFrame.clear().fillStyle(0x05040c, 1).fillRect(14, 194, 68, 68).fillStyle(0x1a2050, 1).fillRect(16, 196, 64, 64).lineStyle(1, 0xd8c08a, 1).strokeRect(14.5, 194.5, 67, 67);
    this.pt.setPosition(48, 228);
    this.name.setText(W.name).setColor(W.col);
    const nw = Math.ceil(this.name.width) + 20;
    this.nameWin.setTexture(winTex(this.s, nw, 17, { top: 0x5a3a20, bot: 0x2a1a10, gems: false }));
    this.nameWin.setPosition(92, 182); this.name.setPosition(102, 184);
    this.text.setPosition(94, 204).setText('');
    // 말하는 사람 초상화가 살짝 튀어 오름
    this.pt.y += 4; this.s.tweens.add({ targets: this.pt, y: 228, duration: 120 });
  }
  type() {
    if (this.full == null || this.shown >= this.full.length) { this.arrow.setVisible(this.full != null && Math.floor(this.s.time.now / 300) % 2 === 0); return; }
    this.arrow.setVisible(false);
    this.shown = Math.min(this.full.length, this.shown + 1);
    const str = this.full.slice(0, this.shown);
    (this.who ? this.text : this.narr).setText(str);
    if (this.shown % 2 === 0 && this.full[this.shown - 1] !== ' ') AE.ui('text');
  }
  key(code) {
    if (OK_KEYS.includes(code)) {
      if (this.shown < this.full.length) { this.shown = this.full.length; (this.who ? this.text : this.narr).setText(this.full); }
      else { AE.ui('move'); this.next(); }
    } else if (code === 'Escape') this.finish();
  }
  finish() {
    if (this.done) return; this.done = true;
    this.timer.remove();
    this.s.input.off('pointerdown', this.ptr);
    [this.win, this.ptFrame, this.pt, this.nameWin, this.name, this.text, this.arrow, this.narr, this.narrBg].forEach(o => o.destroy());
    this.stack.pop(this);
    if (this.onDone) this.onDone();
  }
}
