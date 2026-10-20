'use strict';
/* 타이틀: 붉은 달 아래의 성채, 금빛 로고, 피어오르는 불씨, 몬스터 행진 */

class TitleScene {
  constructor(app) {
    this.app = app;
    this.fx = new Effects();
    this.t = 0;
    this.bg = null;
    this.lightT = 2.5;       // 다음 번개까지
    this.bolt = null;
    this.flash = 0;
  }
  enter() { this.app.sound.menuMusic(); }

  update(dt) {
    this.t += dt;
    if (Math.random() < dt * 26) {
      this.fx.particle(Math.random() * W, H + 6, (Math.random() - .5) * 26, -35 - Math.random() * 70, 5 + Math.random() * 4,
        Math.random() < .3 ? 3 : 2, [P.ember, P.orange, '#ffcf7a'][Math.floor(Math.random() * 3)], { add: true });
    }
    // 가끔 번개
    this.lightT -= dt;
    if (this.lightT <= 0) {
      this.lightT = 5 + Math.random() * 6;
      this.flash = .8;
      this.bolt = { x: 200 + Math.random() * 880, t: 0, seed: Math.floor(Math.random() * 1e6) };
      this.app.sound.play(SFX.THUNDER);
    }
    if (this.bolt) { this.bolt.t += dt; if (this.bolt.t > .3) this.bolt = null; }
    this.flash = Math.max(0, this.flash - dt * 2.5);
    this.fx.update(dt);
  }

  /** 로고를 한 장에 미리 그려 두기 (빛이 쓸고 지나가는 효과에 씀) */
  logoImage() {
    if (this.logo && this.logoScale === this.app.scale) return this.logo;
    this.logoScale = this.app.scale;
    this.logo = makeCanvas(900, 230, this.app.scale, g => {
      disp(g, 'RHYTHM', 450, 88, 54, 'gold', 'center', 4);
      disp(g, 'FIGHTER', 450, 182, 96, 'gold', 'center', 6);
    });
    this.logoTmp = makeCanvas(900, 230, this.app.scale, () => {});
    return this.logo;
  }

  keyDown(code) { if (code !== 'Escape') this.start(); }
  mouseDown() { this.start(); }
  start() {
    this.app.sound.play(SFX.PICK);
    this.app.go(new HubScene(this.app));
  }

  render(ctx) {
    const t = this.t;
    if (!this.bg || this.bgScale !== this.app.scale) {
      this.bgScale = this.app.scale;
      this.bg = sceneBg(W, H, 1, 7, { horizon: .82, moon: [.5, .5, .17], castle: true, castleX: W * .5, scale: this.app.scale });
    }
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.bg, 0, 0, W, H);
    // 달을 가로지르는 구름 · 번개
    drawScroll(ctx, fogTexture(W, 240, '#1a0405', 77, 1.3), 0, 120, W, 240, t * 16, .75);
    if (this.bolt && Math.floor(this.bolt.t * 30) % 3 !== 2) {
      const r = rng(this.bolt.seed);
      let lx = this.bolt.x, ly = 0;
      const pts = [[lx, ly]];
      while (ly < 470) { lx += (r() - .5) * 60; ly += 20 + r() * 20; pts.push([lx, ly]); }
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineJoin = 'round';
      for (const [w, col] of [[14, 'rgba(255,170,140,0.18)'], [5, 'rgba(255,220,200,0.6)'], [1.8, '#ffffff']]) {
        ctx.strokeStyle = col; ctx.lineWidth = w;
        ctx.beginPath(); pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.stroke();
      }
      ctx.restore();
    }
    if (this.flash > 0) { ctx.globalAlpha = this.flash * .25; ctx.fillStyle = '#ffe0d0'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
    drawScroll(ctx, fogTexture(W, 160, '#3a0a08', 78), 0, 520, W, 160, t * 34, .45);
    brazierBase(ctx, 92, 600, 1.1); brazierBase(ctx, W - 92, 600, 1.1);
    brazierFire(ctx, 92, 600, 1.1, t); brazierFire(ctx, W - 92, 600, 1.1, t + 2);
    const beat = this.app.sound.cond.beatOfSec(this.app.sound.now());
    const pulse = Math.pow(1 - ((beat % 1) + 1) % 1, 3);

    // 몬스터 행진 + 기사
    ctx.imageSmoothingEnabled = false;
    const parade = [['slime', .5], ['bat', .76], ['lord', .8], ['squid', .88], ['drone', .33]];
    parade.forEach(([id, hue], i) => {
      const f = monsterFrames(id, hue), k = KINDS[id];
      const img = f.idle[Math.floor(t * 8 + i * 3) % 8];
      const sc = k.boss ? 5 : 4;
      const x = 470 + i * 172, bob = Math.round(Math.sin(t * 2.4 + i) * k.floaty * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.beginPath(); ctx.ellipse(x, 618, 44, 7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.drawImage(img, Math.round(x - img.width * sc / 2), 620 - img.height * sc + bob, img.width * sc, img.height * sc);
    });
    const pf = Pilot.frames;
    const pi = Math.floor(t * 6) % 6 < 4 ? pf.idle[Math.floor(t * 5) % 4] : pf.slash[Math.floor(t * 12) % 4];
    glow(ctx, P.ember, 230, 560, 70, 70, .25);
    ctx.drawImage(pi, 230 - Pilot.CX * 5, 620 - Pilot.BASE * 5, Pilot.W * 5, Pilot.H * 5);

    this.fx.render(ctx);

    // 로고
    glow(ctx, '#ff5a2a', 640, 220, 420, 130, .22 + pulse * .12);
    // 로고 + 빛이 쓸고 지나감
    const logo = this.logoImage(), tmp = this.logoTmp, tg = tmp.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(logo, 190, 80, 900, 230);
    const sp = ((t * .28) % 1) * 1.8 - .4;
    if (sp > 0 && sp < 1) {
      tg.setTransform(1, 0, 0, 1, 0, 0);
      tg.clearRect(0, 0, tmp.width, tmp.height);
      tg.globalCompositeOperation = 'source-over';
      tg.drawImage(logo, 0, 0);
      tg.globalCompositeOperation = 'source-atop';
      const bx = sp * tmp.width, g = tg.createLinearGradient(bx - 120, 0, bx + 120, tmp.height);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(.5, 'rgba(255,250,230,0.85)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      tg.fillStyle = g; tg.fillRect(0, 0, tmp.width, tmp.height);
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(tmp, 190, 80, 900, 230); ctx.restore();
    }
    ctx.imageSmoothingEnabled = false;
    ornLine(ctx, 640, 292, 260);
    text(ctx, '어둠 속 괴물을 박자로 베어라', 640, 330, 22, P.white, 'center');

    ctx.globalAlpha = .45 + .55 * Math.abs(Math.sin(t * 2.2));
    text(ctx, '—  아무 키나 눌러 시작  —', 640, 420, 20, P.goldLight, 'center');
    ctx.globalAlpha = 1;

    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 670, W, 50);
    ctx.fillStyle = P.goldDark; ctx.fillRect(0, 670, W, 1);
    text(ctx, 'D  F  J  K  노트 치기   ·   SPACE  각성   ·   ESC  일시정지', 640, 701, 15, P.silver, 'center');
    shine(ctx, 0, 670, W, t * .1);
    if (Save.d.quality !== 'fast') drawGrain(ctx, .07);
  }
}
