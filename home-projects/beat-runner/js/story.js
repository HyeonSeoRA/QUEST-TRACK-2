'use strict';
/* 이야기 장면과 엔딩 크레딧 */

const STORY_BOSS = { boss0: 'treant', ch0: 'treant', boss1: 'wyrm', ch1: 'wyrm', boss2: 'lord', ending: 'lord' };

class Story extends Phaser.Scene {
  constructor() { super('Story'); }
  init(d) { this.d = d; }
  create() {
    fitCam(this);
    const S = STORY[this.d.id];
    AE.init();
    playBgm(this.d.id.startsWith('boss') ? 'map' : 'title', 0.55);
    this.bg = new BG(this, S.bg, { orbit: 22, shiftY: 40 });
    this.t0 = 0;
    this.add.image(170, GROUND + 3, 'shadow').setScale(1, 0.25).setAlpha(0.5).setDepth(19);
    this.hero = this.add.sprite(170, GROUND + 1, 'hero', 'idle0').setOrigin(0.5, 1).setDepth(20);
    this.lumi = this.add.sprite(146, 168, 'lumi', 0).setDepth(21);
    const bk = STORY_BOSS[this.d.id];
    if (bk) {
      const floating = bk !== 'treant';
      this.boss = this.add.sprite(380, floating ? 120 : GROUND + 4, 'boss_' + bk, 0).setOrigin(0.5, floating ? 0.5 : 1).setDepth(15);
      this.bossFloat = floating;
      if (this.d.id === 'ending' || this.d.id.startsWith('ch')) this.boss.setTint(0xd8e0ff);
    }
    // 카메라를 조금 내려서, 인물이 대화창 위에 보이게 해요
    this.cameras.main.scrollY = 40;
    this.add.rectangle(0, 0, GW, GH, 0x000010, 0.25).setOrigin(0).setDepth(50).setScrollFactor(0);
    // 영화처럼 위아래 검은 띠
    this.add.rectangle(0, 0, GW, 14, 0x000000).setOrigin(0).setDepth(60).setScrollFactor(0);
    this.add.rectangle(0, GH - 6, GW, 6, 0x000000).setOrigin(0).setDepth(60).setScrollFactor(0);
    tx(this, GW - 8, 3, 'Enter: 다음   Esc: 건너뛰기', { size: 7, ox: 1, color: '#8a82b0' }).setDepth(61).setScrollFactor(0);
    this.stack = new UIStack(this);
    this.cameras.main.fadeIn(600);
    this.time.delayedCall(500, () => new Dialog(this, this.stack, S.lines, () => this.done()));
  }
  done() {
    Store.s.seen[this.d.id] = true; Store.save();
    stopBgm(0.8);
    if (this.d.id === 'ending') goScene(this, 'Credits', {}, 900);
    else goScene(this, ...this.d.next, 600);
  }
  update(time, delta) {
    const dt = Math.min(delta, 50) / 1000;
    this.t0 += dt;
    this.bg.update(dt, 0, 0);
    this.hero.setFrame('idle' + (Math.floor(this.t0 * 2) % 2));
    this.lumi.setFrame(Math.floor(this.t0 * 14) % 4).setPosition(146 + Math.sin(this.t0 * 1.2) * 5, 168 + Math.sin(this.t0 * 2.4) * 4);
    if (this.boss) {
      this.boss.setFrame(Math.floor(this.t0 * 2) % 2);
      if (this.bossFloat) this.boss.y = 120 + Math.sin(this.t0 * 1.8) * 4;
    }
  }
}

class Credits extends Phaser.Scene {
  constructor() { super('Credits'); }
  create() {
    fitCam(this);
    AE.init(); playBgm('title', 0.8);
    this.bg = new BG(this, 'forest');
    this.add.rectangle(0, 0, GW, GH, 0x000010, 0.45).setOrigin(0).setDepth(50);
    this.hero = this.add.sprite(GW / 2, GROUND + 1, 'hero', 'run0').setOrigin(0.5, 1).setDepth(20);
    this.lumi = this.add.sprite(GW / 2 - 28, 166, 'lumi', 0).setDepth(21);
    const lines = [
      ['BEAT RUNNER', 'en', 26], ['비트 러너 · 잊혀진 선율', 'serif', 12], ['', '', 30],
      ['- 주인공 -', 'serif', 10], ['리아', 'ui', 11], ['', '', 10],
      ['- 길 안내 -', 'serif', 10], ['요정 루미', 'ui', 11], ['', '', 10],
      ['- 그림 · 음악 · 프로그램 -', 'serif', 10], ['모두 코드로 만들었어요', 'ui', 11], ['', '', 10],
      ['- 사용한 도구 -', 'serif', 10], ['Phaser 3', 'en', 12], ['', '', 30],
      ['세상에 다시 노래가 울려 퍼졌습니다.', 'serif', 11], ['', '', 20],
      ['THE END', 'en', 22], ['플레이해 주셔서 고마워요!', 'ui', 11],
    ];
    this.c = this.add.container(0, GH + 10).setDepth(55);
    let y = 0;
    for (const [s, f, size] of lines) {
      if (s) { const t = tx(this, GW / 2, y, s, { font: f, size, ox: 0.5, color: f === 'en' ? '#ffe8b0' : '#f0e8ff', st: 3 }); if (f === 'en') goldFill(t); this.c.add(t); }
      y += size + 10;
    }
    this.endY = -y + GH / 2 + 10;
    this.t0 = 0;
    this.stack = new UIStack(this);
    this.stack.push({ key: c => { if (OK_KEYS.includes(c) || BACK_KEYS.includes(c)) this.leave(); } });
    this.cameras.main.fadeIn(900);
  }
  leave() { if (this.left) return; this.left = true; Store.s.ending = true; Store.save(); stopBgm(1); goScene(this, 'Title', {}, 1000); }
  update(time, delta) {
    const dt = Math.min(delta, 50) / 1000;
    this.t0 += dt;
    this.bg.update(dt, 80, 0);
    this.hero.setFrame('run' + (Math.floor(this.t0 * 12) % 8));
    this.lumi.setFrame(Math.floor(this.t0 * 14) % 4).setY(166 + Math.sin(this.t0 * 2.5) * 4);
    if (this.c.y > this.endY) this.c.y -= dt * 16;
    else if (!this.wait) { this.wait = true; this.time.delayedCall(4000, () => this.leave()); }
  }
}
