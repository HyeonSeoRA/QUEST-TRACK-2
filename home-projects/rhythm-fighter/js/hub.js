'use strict';
/* 메뉴: 스테이지 지도 · 스킬 트리 · 설정 (도트 아케이드 스타일) */

const TABS = ['스테이지', '스킬 트리', '설정'];
const TCX = 464, TCY = 400;   // 스킬 트리 가운데
const BRANCH_ICON = ['sword', 'shield', 'note', 'star', 'core'];

function rankColor(r) { return { S: P.yellow, A: P.orange, B: P.sky, C: P.lime }[r] || P.slate; }

/** 두 점 사이에 금빛 점선 */
function dotLine(ctx, ax, ay, bx, by, color, size = 4, gap = 10) {
  const len = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.floor(len / gap));
  ctx.fillStyle = color;
  for (let i = 0; i <= n; i++) {
    const x = ax + (bx - ax) * i / n, y = ay + (by - ay) * i / n;
    ctx.beginPath(); ctx.arc(x, y, size / 2, 0, Math.PI * 2); ctx.fill();
  }
}
/** 고른 것을 둘러싸는 금빛 모서리 */
function brackets(ctx, x, y, w, h, color, off) {
  const L = 12;
  ctx.strokeStyle = color; ctx.lineWidth = 2;
  const x0 = x - off, y0 = y - off, x1 = x + w + off, y1 = y + h + off;
  ctx.beginPath();
  ctx.moveTo(x0, y0 + L); ctx.lineTo(x0, y0); ctx.lineTo(x0 + L, y0);
  ctx.moveTo(x1 - L, y0); ctx.lineTo(x1, y0); ctx.lineTo(x1, y0 + L);
  ctx.moveTo(x0, y1 - L); ctx.lineTo(x0, y1); ctx.lineTo(x0 + L, y1);
  ctx.moveTo(x1 - L, y1); ctx.lineTo(x1, y1); ctx.lineTo(x1, y1 - L);
  ctx.stroke();
  glow(ctx, color, x + w / 2, y + h / 2, w, h, .25);
}

class HubScene {
  constructor(app) {
    this.app = app;
    this.ui = new UI(app);
    this.fx = new Effects();
    this.t = 0;
    this.tab = 0;
    this.sel = clamp(Save.d.last || 0, 0, TOWER);
    this.calib = null;      // 박자 자동 맞추기 진행 상태
    if (!stageUnlocked(this.sel)) this.sel = 0;
    this.selSkill = 'atk';
    this.dustShown = Save.d.dust;
    this.confirmReset = false;
    this.confirmWipe = false;
    this.layers = new Map();
  }
  enter() { this.app.sound.menuMusic(); }

  update(dt) {
    this.t += dt;
    if (this.calib) this.updateCalib();
    this.dustShown += (Save.d.dust - this.dustShown) * Math.min(1, dt * 8);
    if (Math.abs(Save.d.dust - this.dustShown) < .5) this.dustShown = Save.d.dust;
    if (Math.random() < dt * 8) {
      this.fx.particle(Math.random() * W, H + 6, (Math.random() - .5) * 20, -30 - Math.random() * 50, 6 + Math.random() * 4,
        2, [P.ember, P.orange, P.red][Math.floor(Math.random() * 3)]);
    }
    this.fx.update(dt);
    this.app.canvas.style.cursor = this.ui.anyHover() ? 'pointer' : 'default';
  }

  setTab(i) {
    if (this.tab !== i) this.app.sound.play(SFX.MOVE);
    this.tab = i; this.confirmReset = false; this.confirmWipe = false;
  }

  keyDown(code, time) {
    if (this.calib) {
      if (code === 'Escape') this.endCalib(false);
      else if (this.calib.result !== undefined) { if (code === 'Enter' || code === 'Space') this.calib = null; }
      else this.calibTap(time);
      return;
    }
    if (code === 'Escape') { this.app.go(new TitleScene(this.app)); return; }
    if (code === 'Tab' || code === 'KeyE') return this.setTab((this.tab + 1) % 3);
    if (code === 'KeyQ') return this.setTab((this.tab + 2) % 3);
    if (code === 'Digit1') return this.setTab(0);
    if (code === 'Digit2') return this.setTab(1);
    if (code === 'Digit3') return this.setTab(2);
    if (this.tab === 0) {
      if (['ArrowLeft', 'ArrowUp', 'KeyA'].includes(code)) this.moveSel(-1);
      if (['ArrowRight', 'ArrowDown', 'KeyD'].includes(code)) this.moveSel(1);
      if (code === 'Enter' || code === 'Space') this.launch();
    } else if (this.tab === 1) {
      if (code === 'Enter' || code === 'Space') this.buy(skillById(this.selSkill));
    }
  }
  mouseDown(x, y) {
    if (this.calib && this.calib.result === undefined) { this.calibTap(this.app.sound.now()); return; }
    this.ui.click(x, y);
  }

  moveSel(d) {
    const n = this.sel + d;
    if (n < 0 || n > TOWER) return;
    if (!stageUnlocked(n)) { this.app.sound.play(SFX.DENY); return; }
    this.sel = n;
    this.app.sound.play(SFX.MOVE);
  }
  launch() {
    if (!stageUnlocked(this.sel)) { this.app.sound.play(SFX.DENY); return; }
    Save.d.last = this.sel;
    Save.write();
    this.app.sound.play(SFX.PICK);
    this.app.canvas.style.cursor = 'default';
    this.app.go(new BattleScene(this.app, this.sel === TOWER ? towerStage(1) : STAGES[this.sel]));
  }

  /* ------------------------------------------------------------ 박자 자동 맞추기 */
  startCalib() {
    const snd = this.app.sound, start = snd.now() + 1.2, gap = .6, n = 12;
    this.calib = { beats: [], diffs: [], start, gap, n, music: Save.d.music };
    snd.setMusic(0);
    for (let i = 0; i < n; i++) {
      const bt = start + i * gap;
      this.calib.beats.push(bt);
      snd.clickAt(bt, i % 4 === 0);
    }
  }
  calibTap(time) {
    const c = this.calib;
    if (!c || c.result !== undefined) return;
    let best = null;
    for (const b of c.beats) if (best === null || Math.abs(time - b) < Math.abs(time - best)) best = b;
    if (best !== null && Math.abs(time - best) < .3) c.diffs.push(time - best);
    c.tapT = this.t;
  }
  updateCalib() {
    const c = this.calib;
    if (c.result === undefined && this.app.sound.now() > c.beats[c.n - 1] + .6) this.endCalib(true);
  }
  endCalib(ok) {
    const c = this.calib;
    this.app.sound.setMusic(c.music);
    if (!ok || c.diffs.length < 5) {
      this.calib = ok ? { result: null } : null;
      if (ok) this.calib.tooFew = true;
      return;
    }
    // 처음 두 번은 빼고, 가운데 값(중앙값)을 쓴다 → 손이 한두 번 흔들려도 괜찮음
    const d = c.diffs.slice(2).sort((a, b) => a - b);
    const med = d[Math.floor(d.length / 2)] * 1000;
    Save.d.offset = clamp(Math.round(med / 5) * 5, -150, 150);
    Save.write();
    this.app.sound.play(SFX.PICK);
    this.calib = { result: Save.d.offset };
  }
  drawCalib(ctx) {
    const c = this.calib;
    ctx.fillStyle = 'rgba(0,0,0,0.78)'; ctx.fillRect(0, 0, W, H);
    const x = 390, y = 170, w = 500, h = 380;
    box(ctx, x, y, w, h, {});
    text(ctx, '박자 자동 맞추기', 640, y + 56, 28, P.goldLight, 'center', true, 800);
    ornLine(ctx, 640, y + 78, 160);
    if (c.result !== undefined) {
      if (c.tooFew) {
        text(ctx, '누른 횟수가 너무 적어요.', 640, y + 170, 20, P.white, 'center');
        text(ctx, '딸깍 소리에 맞춰 다시 해 볼까요?', 640, y + 204, 16, P.silver, 'center');
      } else {
        text(ctx, '판정 오프셋을 맞췄어요', 640, y + 150, 18, P.silver, 'center');
        disp(ctx, (c.result > 0 ? '+' : '') + c.result + 'ms', 640, y + 220, 54, 'gold', 'center', 3);
      }
      this.ui.button(ctx, x + 60, y + h - 80, w - 120, 48, '확인 (Enter)', 'primary', true, () => { this.calib = null; });
      return;
    }
    text(ctx, '딸깍 소리에 맞춰 아무 키(또는 화면)를 눌러 주세요', 640, y + 118, 16, P.white, 'center');
    text(ctx, '총 12번 · 마지막까지 들으면 자동으로 끝나요 · ESC 취소', 640, y + 144, 13, P.silver, 'center');
    const now = this.app.sound.now();
    for (let i = 0; i < c.n; i++) {
      const bx = 640 - (c.n - 1) * 17 + i * 34, passed = now >= c.beats[i];
      const pulse = passed && now - c.beats[i] < .15;
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.moveTo(bx, y + 210 - 12); ctx.lineTo(bx + 12, y + 210); ctx.lineTo(bx, y + 222); ctx.lineTo(bx - 12, y + 210); ctx.fill();
      ctx.fillStyle = pulse ? '#ffffff' : passed ? P.gold : '#2a2420';
      ctx.beginPath(); ctx.moveTo(bx, y + 210 - 9); ctx.lineTo(bx + 9, y + 210); ctx.lineTo(bx, y + 219); ctx.lineTo(bx - 9, y + 210); ctx.fill();
      if (pulse) glow(ctx, P.goldLight, bx, y + 210, 30, 30, .8);
    }
    const tapped = c.tapT !== undefined && this.t - c.tapT < .15;
    ctx.fillStyle = tapped ? P.goldLight : '#1a1410';
    ctx.beginPath(); ctx.arc(640, y + 290, 36, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = P.gold; ctx.stroke();
    text(ctx, `${c.diffs.length}`, 640, y + 300, 26, tapped ? '#000' : P.white, 'center', false, 800);
  }
  buy(n) {
    if (!n || n.branch === BR.CORE) return;
    const lv = skillLevel(n);
    if (lv >= n.max || !skillOpen(n) || Save.d.dust < skillCost(n, lv)) { this.app.sound.play(SFX.DENY); return; }
    Save.d.dust -= skillCost(n, lv);
    Save.d.skills[n.id] = lv + 1;
    Save.write();
    this.app.sound.play(SFX.PICK);
    const x = TCX + n.dx, y = TCY + n.dy, c = BRANCH_COLOR[n.branch];
    this.fx.ring(x, y, 24, 70, .45, 6, c);
    this.fx.pop(x, y, c, 16, 260);
    this.fx.text('LV ' + (lv + 1), x, y - 44, 16, c, .9, { display: true });
  }

  /* ------------------------------------------------------------ 바뀌지 않는 부분은 한 장으로 미리 그림 */
  layer() {
    const theme = this.tab === 0 ? (this.sel === TOWER ? 2 : STAGES[this.sel].sector) : 0;
    const key = `${this.tab}:${theme}:${this.app.scale}`;
    let c = this.layers.get(key);
    if (c) return c;
    c = makeCanvas(W, H, this.app.scale, g => {
      g.drawImage(sceneBg(W, H, theme, 11 + theme, { horizon: .9, moon: [.85, .3, .09], scale: this.app.scale }), 0, 0, W, H);
      g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, 0, W, H);
      box(g, 24, 14, 1232, 62, {});
      if (this.tab === 0) {
        box(g, 24, 92, 836, 612, { fill: 'rgba(10,8,7,0.9)' });
        // 지도: 구역마다 희미한 빛 + 지형 무늬
        const zone = [[200, 470, '#4c6274'], [500, 400, '#6a1a16'], [760, 300, '#3a2850']];
        for (const [zx, zy, col] of zone) {
          const gr = g.createRadialGradient(zx, zy, 10, zx, zy, 230);
          gr.addColorStop(0, rgba(col, .55)); gr.addColorStop(1, rgba(col, 0));
          g.fillStyle = gr; g.fillRect(28, 96, 828, 604);
        }
        const r = rng(5);
        g.strokeStyle = 'rgba(201,162,74,0.07)'; g.lineWidth = 1;
        for (let i = 0; i < 14; i++) {
          const cx = 60 + r() * 760, cy = 130 + r() * 520, rx = 40 + r() * 120;
          g.beginPath(); g.ellipse(cx, cy, rx, rx * (.4 + r() * .4), r() * 3, 0, Math.PI * 2); g.stroke();
        }
        box(g, 876, 92, 380, 612, {});
        plaque(g, 442, 80, 170, '원 정  지 도');
        plaque(g, 1066, 80, 150, '작 전  정 보');
      } else if (this.tab === 1) {
        box(g, 24, 92, 880, 612, { fill: 'rgba(10,8,7,0.9)' });
        const gr = g.createRadialGradient(TCX, TCY, 10, TCX, TCY, 360);
        gr.addColorStop(0, 'rgba(201,162,74,0.16)'); gr.addColorStop(1, 'rgba(201,162,74,0)');
        g.fillStyle = gr; g.fillRect(28, 96, 872, 604);
        g.strokeStyle = 'rgba(201,162,74,0.12)'; g.lineWidth = 1;
        for (let i = 1; i <= 3; i++) { g.beginPath(); g.arc(TCX, TCY, i * 105, 0, Math.PI * 2); g.stroke(); }
        box(g, 920, 92, 336, 612, {});
        plaque(g, 464, 80, 150, '각    인');
        plaque(g, 1088, 80, 150, '각 인  정 보');
      } else {
        box(g, 24, 92, 760, 612, {});
        box(g, 800, 92, 456, 612, {});
        plaque(g, 404, 80, 150, '설    정');
        plaque(g, 1028, 80, 150, '전 투  방 법');
      }
    });
    this.layers.set(key, c);
    return c;
  }

  /* ------------------------------------------------------------ 그리기 */
  render(ctx) {
    this.ui.begin();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.layer(), 0, 0, W, H);
    this.topBar(ctx);
    if (this.tab === 0) this.stageTab(ctx);
    else if (this.tab === 1) this.skillTab(ctx);
    else this.settingsTab(ctx);
    this.fx.render(ctx);
    shine(ctx, 50, 14, 1180, this.t * .08);
    if (Save.d.quality !== 'fast') drawGrain(ctx, .06);
    if (this.calib) this.drawCalib(ctx);
  }

  topBar(ctx) {
    icon(ctx, 'sword', 58, 45, 4, P.yellow);
    disp(ctx, 'RHYTHM FIGHTER', 84, 55, 22, 'gold', 'left', 2);
    const tx0 = 640 - 225;
    TABS.forEach((name, i) => {
      const x = tx0 + i * 150, hv = this.ui.hover(x, 20, 150, 50), on = this.tab === i;
      text(ctx, name, x + 75, 52, 16, on ? P.yellow : hv ? P.white : P.silver, 'center');
      if (on) { ornLine(ctx, x + 75, 64, 52); glow(ctx, P.gold, x + 75, 46, 70, 26, .15); }
      this.ui.area(x, 20, 150, 50, () => this.setTab(i));
    });
    const ds = comma(this.dustShown), dw = textW(ctx, ds, 16, true) + 64, dx = 1236 - dw;
    chip(ctx, dx, 28, dw, 34, P.yellow);
    icon(ctx, 'gem', dx + 22, 46, 2.6, '#c96bff');
    disp(ctx, ds, dx + 40, 53, 17, P.yellow, 'left', 1);
    text(ctx, '영혼석', dx - 12, 52, 16, P.silver, 'right');
  }

  /* ------------------------------------------------------------ 스테이지 지도 */
  stagePos(i) { const s = STAGES[i]; return [24 + s.mapX, 112 + s.mapY]; }

  stageTab(ctx) {
    ctx.save(); ctx.beginPath(); ctx.rect(28, 96, 828, 604); ctx.clip();
    drawScroll(ctx, fogTexture(836, 300, '#3a3046', 31, 1.4), 24, 300, 836, 300, this.t * 10, .5);
    drawScroll(ctx, fogTexture(836, 200, '#4a2a2a', 32), 24, 470, 836, 200, -this.t * 16, .35);
    ctx.restore();
    disp(ctx, 'EXPEDITION', 48, 128, 15, 'gold', 'left', 1);
    text(ctx, '원정 지도 · 향할 곳을 고르세요', 48, 152, 15, P.silver);
    const sc = [210, 500, 770];
    for (let s = 0; s < 3; s++) {
      const open = stageUnlocked(s * 4), col = [P.cyan, P.orange, '#b48cff'][s];
      text(ctx, `구역 ${s + 1}`, sc[s], 650, 16, open ? col : P.steel, 'center');
      text(ctx, SECTOR[s], sc[s], 674, 16, open ? P.white : P.steel, 'center');
    }
    // 길
    for (let i = 0; i + 1 < STAGES.length; i++) {
      const [ax, ay] = this.stagePos(i), [bx, by] = this.stagePos(i + 1), open = stageUnlocked(i + 1);
      dotLine(ctx, ax, ay, bx, by, open ? P.gold : 'rgba(167,156,134,0.25)', open ? 3 : 2, 11);
      if (open) {
        const k = (this.t * .5 + i * .37) % 1;
        glow(ctx, P.ember, ax + (bx - ax) * k, ay + (by - ay) * k, 10, 10, 1);
      }
    }
    // 별(스테이지)
    STAGES.forEach((s, i) => {
      const [x, y] = this.stagePos(i), open = stageUnlocked(i), r = s.boss ? 26 : 20;
      const hv = Math.abs(this.app.mouse.x - x) < r + 6 && Math.abs(this.app.mouse.y - y) < r + 6;
      const stars = Save.stage(i).stars;
      const col = s.boss ? '#5a1010' : ['#1e2f3c', '#3a0e0e', '#24183a'][s.sector];
      const fill = !open ? '#0c0a09' : stars ? col : '#16120f';
      box(ctx, x - r, y - r + (hv && open ? -2 : 0), r * 2, r * 2, { fill, border: !open ? '#3a332a' : hv || i === this.sel ? P.goldLight : s.boss ? P.red : P.gold, shadow: open, t: 2, rivets: false });
      if (open) disp(ctx, s.code, x, y + 6 + (hv ? -2 : 0), 14, P.white, 'center');
      else icon(ctx, 'lock', x, y, 2.6, '#4a4236');
      if (s.boss && open) icon(ctx, 'crown', x, y - r - 11, 2.4, P.yellow);
      for (let k = 0; k < 3; k++) icon(ctx, 'star', x - 16 + k * 16, y + r + 14, 1.7, k < stars ? P.yellow : '#2a2420');
      if (i === this.sel) {
        const g = ctx.createLinearGradient(0, y - 170, 0, y);
        g.addColorStop(0, 'rgba(255,210,140,0)'); g.addColorStop(1, 'rgba(255,210,140,0.32)');
        ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = g;
        ctx.fillRect(x - 14 - Math.sin(this.t * 3) * 2, y - 170, 28 + Math.sin(this.t * 3) * 4, 170);
        ctx.restore();
      }
      if (i === this.sel) brackets(ctx, x - r, y - r, r * 2, r * 2, P.goldLight, 7 + Math.sin(this.t * 5) * 2);
      this.ui.area(x - r - 6, y - r - 6, r * 2 + 12, r * 2 + 12, () => {
        if (!stageUnlocked(i)) this.app.sound.play(SFX.DENY);
        else if (this.sel === i) this.launch();
        else { this.sel = i; this.app.sound.play(SFX.MOVE); }
      });
    });
    // 심연의 탑 (1장 보스를 깨면 열림)
    {
      const tx = 812, ty = 172, open = stageUnlocked(TOWER), sel = this.sel === TOWER;
      const hv = Math.abs(this.app.mouse.x - tx) < 30 && Math.abs(this.app.mouse.y - ty) < 44;
      if (open) glow(ctx, '#8a5cff', tx, ty, 70, 80, .35 + .15 * Math.sin(this.t * 3));
      ctx.fillStyle = '#000';
      ctx.beginPath(); ctx.moveTo(tx - 22, ty + 38); ctx.lineTo(tx - 16, ty - 22); ctx.lineTo(tx, ty - 44); ctx.lineTo(tx + 16, ty - 22); ctx.lineTo(tx + 22, ty + 38); ctx.closePath(); ctx.fill();
      ctx.fillStyle = open ? '#24183a' : '#100d14';
      ctx.beginPath(); ctx.moveTo(tx - 19, ty + 35); ctx.lineTo(tx - 13, ty - 20); ctx.lineTo(tx, ty - 39); ctx.lineTo(tx + 13, ty - 20); ctx.lineTo(tx + 19, ty + 35); ctx.closePath(); ctx.fill();
      ctx.lineWidth = sel || hv ? 2.2 : 1.4; ctx.strokeStyle = open ? (sel || hv ? P.goldLight : P.gold) : '#3a332a'; ctx.stroke();
      if (open) {
        for (let i = 0; i < 3; i++) { ctx.fillStyle = i === 2 ? '#c9b6ff' : '#8a5cff'; ctx.fillRect(tx - 3, ty + 18 - i * 16, 6, 8); }
      } else icon(ctx, 'lock', tx, ty + 6, 2.4, '#4a4236');
      text(ctx, '심연의 탑', tx, ty + 60, 14, open ? '#c9b6ff' : '#4a4236', 'center');
      if (open && Save.d.towerBest) text(ctx, `최고 ${Save.d.towerBest}층`, tx, ty + 78, 12, P.silver, 'center');
      if (sel) brackets(ctx, tx - 22, ty - 44, 44, 82, P.goldLight, 6 + Math.sin(this.t * 5) * 2);
      this.ui.area(tx - 30, ty - 48, 60, 92, () => {
        if (!open) this.app.sound.play(SFX.DENY);
        else if (this.sel === TOWER) this.launch();
        else { this.sel = TOWER; this.app.sound.play(SFX.MOVE); }
      });
    }
    text(ctx, '← → 로 고르고 Enter 로 출격', 48, 694, 16, P.slate, 'left', false);
    this.stageDetail(ctx);
  }

  /** 심연의 탑 정보 */
  towerDetail(ctx) {
    const x = 876, y = 92, w = 380, open = stageUnlocked(TOWER);
    disp(ctx, 'ABYSS TOWER', x + 24, y + 40, 14, 'gold', 'left', 1);
    chip(ctx, x + w - 112, y + 20, 88, 26, '#8a5cff');
    text(ctx, '무한 도전', x + w - 68, y + 38, 13, '#c9b6ff', 'center', false);
    text(ctx, '심연의 탑', x + 24, y + 80, 30, P.white, 'left', true, 800);
    text(ctx, '끝없이 이어지는 층을 올라라', x + 24, y + 106, 15, P.silver);
    const lines = [
      ['층마다 몬스터 세 마리, 5층마다 보스', P.white],
      ['위로 갈수록 빠르고 단단해져요', P.white],
      ['체력은 다음 층으로 이어져요 (층마다 30% 회복)', P.white],
      ['쓰러질 때까지 몇 층까지 오를 수 있을까요?', P.goldLight],
    ];
    lines.forEach(([l, c], i) => {
      ctx.fillStyle = P.gold; ctx.fillRect(x + 28, y + 150 + i * 30 - 6, 5, 5);
      text(ctx, l, x + 42, y + 150 + i * 30, 14, c, 'left', false);
    });
    // 미리보기: 첫 층 몬스터
    const preview = towerStage(5);
    const f = monsterFrames(preview.waves[1].kind, preview.waves[1].hue);
    const img = f.idle[Math.floor(this.t * 8) % 8];
    box(ctx, x + 24, y + 278, w - 48, 128, { fill: '#0a0710', border: '#5a3f8a', shadow: false, t: 2, rivets: false });
    glow(ctx, '#8a5cff', x + w / 2, y + 342, 140, 60, .25);
    ctx.drawImage(img, x + w / 2 - img.width, y + 292, img.width * 2, img.height * 2);
    text(ctx, '5층의 수문장', x + w / 2, y + 398, 13, '#c9b6ff', 'center');
    const ry = y + 446;
    text(ctx, '최고 기록', x + 24, ry, 16, P.silver, 'left', false);
    disp(ctx, Save.d.towerBest ? `${Save.d.towerBest}F` : '-', x + w - 24, ry, 20, 'gold', 'right');
    text(ctx, '보상', x + 24, ry + 32, 16, P.silver, 'left', false);
    text(ctx, '층마다 영혼석 (높을수록 많이)', x + w - 24, ry + 32, 14, P.goldLight, 'right', false);
    this.ui.button(ctx, x + 24, y + 540, w - 48, 52, open ? '탑에 오르기!' : '1장 보스를 먼저 쓰러뜨리세요', 'primary', open, () => this.launch());
  }

  stageDetail(ctx) {
    if (this.sel === TOWER) return this.towerDetail(ctx);
    const s = STAGES[this.sel], x = 876, y = 92, w = 380;
    disp(ctx, `CHAPTER ${s.sector + 1} · ${s.index % 4 + 1}`, x + 24, y + 40, 14, 'gold', 'left', 1);
    if (s.boss) { chip(ctx, x + w - 92, y + 20, 68, 26, P.red); disp(ctx, 'BOSS', x + w - 58, y + 39, 13, '#ff8a7a', 'center'); }
    text(ctx, s.name, x + 24, y + 80, 30, P.white, 'left', true, 800);
    text(ctx, `구역 ${s.sector + 1} · ${SECTOR[s.sector]}`, x + 24, y + 106, 16, P.silver, 'left', false);

    chip(ctx, x + 24, y + 122, 120, 34, null);
    disp(ctx, 'BPM', x + 36, y + 145, 12, P.silver, 'left');
    disp(ctx, String(s.bpm), x + 80, y + 146, 16, P.goldLight, 'left');
    chip(ctx, x + 152, y + 122, 204, 34, null);
    text(ctx, '난이도', x + 164, y + 145, 16, P.silver, 'left', false);
    for (let k = 0; k < 5; k++) icon(ctx, 'star', x + 236 + k * 23, y + 139, 2, k < s.difficulty ? '#d8432f' : '#2a2420');

    text(ctx, '등장 몬스터', x + 24, y + 188, 16, P.silver);
    const n = s.waves.length, cw = (w - 48 - (n - 1) * 8) / n;
    s.waves.forEach((wv, i) => {
      const k = KINDS[wv.kind], f = monsterFrames(wv.kind, wv.hue);
      const cx = x + 24 + i * (cw + 8), cy = y + 198;
      box(ctx, cx, cy, cw, 150, { fill: k.boss ? '#1e0707' : '#0a0807', border: k.boss ? P.red : P.goldDark, shadow: false, t: 2, rivets: false });
      const img = f.idle[Math.floor(this.t * 8 + i * 2) % 8];
      const scl = Math.max(1, Math.floor(Math.min((cw - 8) / img.width, 108 / img.height)));
      ctx.drawImage(img, Math.round(cx + cw / 2 - img.width * scl / 2), Math.round(cy + 66 - img.height * scl / 2), img.width * scl, img.height * scl);
      const nm = k.name.length > 5 && cw < 100 ? k.name.slice(0, 5) : k.name;
      text(ctx, nm, cx + cw / 2, cy + 138, 14, k.boss ? '#ff8a7a' : P.white, 'center');
    });

    const ry = y + 382, rec = Save.stage(this.sel);
    const row = (label, i) => text(ctx, label, x + 24, ry + i * 30, 16, P.silver, 'left', false);
    row('최고 점수', 0); disp(ctx, rec.best ? comma(rec.best) : '-', x + w - 24, ry, 16, P.white, 'right');
    row('최고 랭크', 1); disp(ctx, rec.rank, x + w - 24, ry + 32, 22, rankColor(rec.rank), 'right');
    row('별', 2);
    for (let k = 0; k < 3; k++) icon(ctx, 'star', x + w - 76 + k * 24, ry + 54, 2.6, k < rec.stars ? P.yellow : '#2a2420');
    const first = rec.stars === 0;
    row('보상', 3);
    const rw = comma(s.reward * 1.5 * (first ? 1.5 : 1) * stats().dustMul);
    disp(ctx, rw, x + w - 24, ry + 91, 17, P.yellow, 'right');
    icon(ctx, 'gem', x + w - 38 - textW(ctx, rw, 17, true), ry + 85, 2, '#c96bff');
    if (first) text(ctx, '첫 클리어 보너스 x1.5', x + w - 24, ry + 116, 16, P.lime, 'right', false);

    const open = stageUnlocked(this.sel);
    this.ui.button(ctx, x + 24, y + 540, w - 48, 52, open ? '출격하기!' : '이전 스테이지를 먼저 깨세요', 'primary', open, () => this.launch());
  }

  /* ------------------------------------------------------------ 스킬 트리 */
  skillTab(ctx) {
    disp(ctx, 'ENGRAVING', 48, 128, 15, 'gold', 'left', 1);
    text(ctx, '각인 · 영혼석으로 힘을 새기세요', 48, 152, 15, P.silver);
    [['공격', 0, -232], ['방어', 360, 6], ['리듬', -360, 6], ['행운', 0, 240]].forEach(([n, dx, dy], b) =>
      text(ctx, n, TCX + dx, TCY + dy, 16, BRANCH_COLOR[b], 'center'));

    for (const n of SKILLS) {
      if (!n.req) continue;
      const r = skillById(n.req), ax = TCX + r.dx, ay = TCY + r.dy, bx = TCX + n.dx, by = TCY + n.dy;
      const c = BRANCH_COLOR[n.branch];
      if (skillLevel(n) > 0) {
        ctx.strokeStyle = c; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
        glow(ctx, c, (ax + bx) / 2, (ay + by) / 2, Math.abs(bx - ax) / 2 + 20, Math.abs(by - ay) / 2 + 20, .15);
      } else if (skillOpen(n)) dotLine(ctx, ax, ay, bx, by, rgba(c, .7), 3, 9);
      else dotLine(ctx, ax, ay, bx, by, 'rgba(167,156,134,0.2)', 2, 10);
    }

    let hoverNode = null;
    for (const n of SKILLS) {
      const x = TCX + n.dx, y = TCY + n.dy, core = n.branch === BR.CORE, r = core ? 28 : 22;
      const lv = skillLevel(n), open = skillOpen(n), maxed = lv >= n.max, c = BRANCH_COLOR[n.branch];
      const hv = Math.abs(this.app.mouse.x - x) < r + 4 && Math.abs(this.app.mouse.y - y) < r + 4;
      if (hv) hoverNode = n;
      const affordable = open && !maxed && !core && Save.d.dust >= skillCost(n, lv);
      // 원형 문장(메달)
      if (lv > 0) {
        glow(ctx, c, x, y, r * 2.4, r * 2.4, .35);
        for (let o = 0; o < Math.min(3, lv); o++) {
          const a = this.t * (1.6 + o * .3) + o * Math.PI * 2 / 3 + x;
          glow(ctx, c, x + Math.cos(a) * (r + 9), y + Math.sin(a) * (r + 9), 6, 6, .9);
        }
      }
      const gr = ctx.createRadialGradient(x - r * .3, y - r * .35, 1, x, y, r);
      gr.addColorStop(0, lv > 0 ? mix(c, '#000000', .2) : open ? '#2a241e' : '#14110e');
      gr.addColorStop(1, lv > 0 ? mix(c, '#000000', .7) : '#0a0807');
      ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(x, y, r + 3, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = hv ? 3 : 2;
      ctx.strokeStyle = !open ? '#3a332a' : hv || maxed ? P.goldLight : P.gold;
      ctx.stroke();
      if (open || core) icon(ctx, BRANCH_ICON[n.branch], x, y, core ? 4.4 : 3.4, lv > 0 ? P.white : c);
      else icon(ctx, 'lock', x, y, 2.6, '#4a4236');
      if (n.id === this.selSkill) brackets(ctx, x - r, y - r, r * 2, r * 2, P.goldLight, 6 + Math.sin(this.t * 5) * 2);
      if (!core) {
        const pw = 8, gap = 3, tw = n.max * pw + (n.max - 1) * gap;
        for (let k = 0; k < n.max; k++) {
          const px = Math.round(x - tw / 2 + k * (pw + gap));
          ctx.fillStyle = '#000'; ctx.fillRect(px - 1, y + r + 6, pw + 2, 6);
          ctx.fillStyle = k < lv ? c : '#2a2420'; ctx.fillRect(px, y + r + 7, pw, 4);
        }
      }
      if (affordable) glow(ctx, P.goldLight, x + r - 2, y - r + 2, 12, 12, .6 + .4 * Math.sin(this.t * 5));
      text(ctx, n.name, x, y + r + (core ? 26 : 32), 16, open ? P.white : P.slate, 'center', open);
      this.ui.area(x - r - 6, y - r - 6, r * 2 + 12, r * 2 + 12, () => {
        if (n.id === this.selSkill) this.buy(n);
        else { this.selSkill = n.id; this.confirmReset = false; this.app.sound.play(SFX.MOVE); }
      });
    }
    text(ctx, '노드를 누르면 정보, 한 번 더 누르면 강화 (Enter 도 가능)', 48, 694, 16, P.slate, 'left', false);
    this.skillDetail(ctx, hoverNode || skillById(this.selSkill));
  }

  skillDetail(ctx, n) {
    const x = 920, y = 92, w = 336, c = BRANCH_COLOR[n.branch], lv = skillLevel(n), open = skillOpen(n), core = n.branch === BR.CORE;
    chip(ctx, x + 24, y + 20, 72, 30, c);
    text(ctx, BRANCH_NAME[n.branch], x + 60, y + 41, 16, c, 'center');
    if (!core) disp(ctx, `Lv ${lv}/${n.max}`, x + w - 24, y + 43, 16, lv >= n.max ? P.yellow : P.white, 'right');
    glow(ctx, c, x + 56, y + 104, 50, 50, .3);
    ctx.fillStyle = mix(c, '#000000', .65); ctx.beginPath(); ctx.arc(x + 56, y + 104, 32, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = P.gold; ctx.stroke();
    icon(ctx, BRANCH_ICON[n.branch], x + 56, y + 104, 4.4, P.white);
    text(ctx, n.name, x + 104, y + 114, 24, P.white, 'left', true, 800);
    wrapText(ctx, n.desc, x + 24, y + 172, w - 48, 16, P.silver, 24);

    const ey = y + 226;
    if (!core) {
      box(ctx, x + 24, ey, w - 48, 112, { fill: '#0a0807', border: P.goldDark, shadow: false, t: 2, rivets: false });
      text(ctx, '지금', x + 40, ey + 32, 16, P.silver, 'left', false);
      text(ctx, skillEffect(n, lv), x + w - 40, ey + 32, 16, lv ? P.white : P.slate, 'right', false);
      text(ctx, '다음', x + 40, ey + 64, 16, P.silver, 'left', false);
      text(ctx, lv >= n.max ? '최대 레벨' : skillEffect(n, lv + 1), x + w - 40, ey + 64, 16, lv >= n.max ? P.yellow : c, 'right', false);
      if (lv < n.max) {
        const cost = skillCost(n, lv), can = Save.d.dust >= cost, cs = comma(cost);
        text(ctx, '비용', x + 40, ey + 96, 16, P.silver, 'left', false);
        disp(ctx, cs, x + w - 40, ey + 99, 17, can ? P.yellow : '#ff6a5a', 'right');
        icon(ctx, 'gem', x + w - 54 - textW(ctx, cs, 17, true), ey + 93, 2, '#c96bff');
      }
      let label, enabled = false;
      if (!open) label = `${skillById(n.req).name} Lv ${n.reqLv} 필요`;
      else if (lv >= n.max) label = '최대 레벨 달성!';
      else if (Save.d.dust < skillCost(n, lv)) label = '영혼석이 부족해요';
      else { label = '강화하기 (Enter)'; enabled = true; }
      this.ui.button(ctx, x + 24, y + 356, w - 48, 50, label, 'gold', enabled, () => this.buy(n));
    } else {
      wrapText(ctx, '여기서부터 공격 · 방어 · 리듬 · 행운 네 갈래로 뻗어 나가요. 스테이지를 깨고 받은 영혼석으로 노드를 강화해 보세요.',
        x + 24, ey + 20, w - 48, 16, P.white, 26);
    }

    const st = stats(), sy = y + 448;
    text(ctx, '기사 능력치', x + 24, sy, 16, P.silver);
    [['공격력', 'x' + st.atkMul.toFixed(2), '체력', String(st.maxHp)],
     ['치명타', Math.round(st.critChance * 100) + '%', '방어', Math.round(st.def * 100) + '%']].forEach((rw, i) => {
      const ry = sy + 30 + i * 26;
      text(ctx, rw[0], x + 24, ry, 16, P.slate, 'left', false);
      text(ctx, rw[1], x + 156, ry, 16, P.white, 'right', false);
      text(ctx, rw[2], x + 180, ry, 16, P.slate, 'left', false);
      text(ctx, rw[3], x + w - 24, ry, 16, P.white, 'right', false);
    });

    const spent = skillSpent();
    const rl = this.confirmReset ? '정말? 한 번 더 누르기' : `스킬 초기화 (${comma(spent)} 환불)`;
    this.ui.button(ctx, x + 24, y + 548, w - 48, 42, rl, this.confirmReset ? 'danger' : 'ghost', spent > 0, () => {
      if (!this.confirmReset) { this.confirmReset = true; return; }
      this.confirmReset = false;
      Save.d.dust += spent;
      Save.d.skills = {};
      Save.write();
      this.app.sound.play(SFX.KILL);
      this.fx.ring(TCX, TCY, 20, 300, .6, 8, P.yellow);
    });
  }

  /* ------------------------------------------------------------ 설정 */
  settingsTab(ctx) {
    disp(ctx, 'SETTINGS', 48, 128, 15, 'gold', 'left', 1);
    const d = Save.d, snd = this.app.sound;
    const off = (d.offset > 0 ? '+' : '') + d.offset + 'ms';
    this.row(ctx, 0, '노트 속도', '노트가 떨어지는 빠르기', String(d.speed), (d.speed - 400) / 1100,
      () => d.speed = Math.max(400, d.speed - 50), () => d.speed = Math.min(1500, d.speed + 50));
    this.row(ctx, 1, '판정 오프셋', '박자가 어긋나면 맞춰요', off, (d.offset + 150) / 300,
      () => d.offset = Math.max(-150, d.offset - 5), () => d.offset = Math.min(150, d.offset + 5));
    this.ui.button(ctx, 334, 144 + 96 + 20, 108, 40, '자동 맞추기', 'gold', true, () => this.startCalib());
    this.row(ctx, 2, '전체 소리', '효과음과 음악 모두', Math.round(d.volume * 100) + '%', d.volume,
      () => snd.setVolume(d.volume = Math.max(0, Math.round(d.volume * 10 - 1) / 10)),
      () => snd.setVolume(d.volume = Math.min(1, Math.round(d.volume * 10 + 1) / 10)));
    this.row(ctx, 3, '음악 소리', '배경 음악만', Math.round(d.music * 100) + '%', d.music,
      () => snd.setMusic(d.music = Math.max(0, Math.round(d.music * 10 - 1) / 10)),
      () => snd.setMusic(d.music = Math.min(1, Math.round(d.music * 10 + 1) / 10)));
    this.row(ctx, 4, '그래픽', '느리면 "빠르게" 로 바꿔 보세요', d.quality === 'fast' ? '빠르게' : '선명하게', d.quality === 'fast' ? 0 : 1,
      () => { d.quality = 'fast'; resize(); }, () => { d.quality = 'sharp'; resize(); });
    const wl = this.confirmWipe ? '모든 진행이 지워져요. 한 번 더!' : '저장 초기화 (처음부터)';
    this.ui.button(ctx, 48, 636, 320, 44, wl, this.confirmWipe ? 'danger' : 'ghost', true, () => {
      if (!this.confirmWipe) { this.confirmWipe = true; return; }
      this.confirmWipe = false;
      Save.reset();
      this.sel = 0; this.dustShown = 0;
      this.app.sound.play(SFX.KILL);
    });

    const x = 800, y = 92;
    disp(ctx, 'HOW TO FIGHT', x + 24, y + 36, 15, 'gold', 'left', 1);
    ['D', 'F', 'J', 'K'].forEach((k, i) => {
      const kx = x + 40 + i * 98, ky = y + 58;
      box(ctx, kx, ky, 64, 64, { fill: mix(LANE_COLORS[i], '#000000', .7), border: LANE_COLORS[i], t: 2, rivets: false });
      disp(ctx, k, kx + 32, ky + 44, 28, P.white, 'center');
    });
    ['노트가 판정선에 닿을 때 맞는 키를 눌러요.',
     '긴 노트는 끝까지 누르고 있다가 떼요.',
     '맞추면 기사가 검기로 몬스터를 공격하고,',
     '놓치면(MISS) 몬스터가 기사를 공격해요.',
     'PERFECT 일수록, 콤보가 길수록 더 아파요.',
     '「각성」을 배우면 게이지가 찼을 때 SPACE!',
    ].forEach((s, i) => text(ctx, s, x + 40, y + 170 + i * 28, 16, P.white, 'left', false));
    text(ctx, 'ESC 일시정지 · Tab 탭 · 휴대폰은 줄을 터치', x + 40, y + 356, 16, P.silver, 'left', false);
    [['PERFECT', '±42ms', P.goldLight], ['GREAT', '±85ms', '#8fd18a'], ['GOOD', '±125ms', '#8fb3d6']].forEach(([n, ms, c], i) => {
      const jx = x + 40 + i * 130;
      chip(ctx, jx, y + 396, 118, 56, c);
      disp(ctx, n, jx + 59, y + 422, 13, c, 'center');
      text(ctx, ms, jx + 59, y + 442, 16, P.silver, 'center', false);
    });
    text(ctx, '판정 범위는 스킬 「매의 눈」으로 넓혀요.', x + 40, y + 494, 16, P.silver, 'left', false);
  }

  row(ctx, i, name, desc, value, ratio, minus, plus) {
    const y = 144 + i * 96;
    box(ctx, 48, y, 712, 82, { fill: '#0a0807', border: P.goldDark, shadow: false, t: 2, rivets: false });
    text(ctx, name, 72, y + 36, 22, P.white, 'left', true, 800);
    text(ctx, desc, 72, y + 62, 16, P.silver, 'left', false);
    const act = f => () => { f(); Save.write(); this.app.sound.play(SFX.MOVE); };
    this.ui.button(ctx, 460, y + 14, 48, 40, '<', 'ghost', true, act(minus));
    text(ctx, value, 584, y + 42, 22, P.goldLight, 'center');
    this.ui.button(ctx, 660, y + 14, 48, 40, '>', 'ghost', true, act(plus));
    bar(ctx, 460, y + 64, 248, 6, ratio, P.gold);
  }
}
