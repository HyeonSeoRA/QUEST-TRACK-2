'use strict';
// =============================================================
//  그림(스프라이트 시트) 정보와 불러오기
//  모든 시트는 프레임이 가로 한 줄로 이어져 있어요.
//  [파일, 프레임 너비, 프레임 높이, 프레임 수, fps, 반복?, 기준점x, 기준점y]
//  기준점(ax, ay)은 캐릭터의 "발밑 가운데" 위치예요.
// =============================================================

const IMG_ROOT = 'assets/images/';

const SPRITES = {
  knight: {           // 판타지 전사 (주인공 기사) — 오른쪽을 봄
    folder: 'fantasy-warrior', faceRight: true, ax: 80, ay: 101,
    anims: {
      idle:    ['fantasy-warrior_idle.png',     154, 105, 10, 10, true],
      run:     ['fantasy-warrior_run.png',      154, 105, 8, 14, true],
      jump:    ['fantasy-warrior_jump.png',     154, 105, 3, 10, true],
      fall:    ['fantasy-warrior_fall.png',     154, 105, 3, 10, true],
      attack1: ['fantasy-warrior_attack.png',   154, 105, 7, 14, false],
      attack2: ['fantasy-warrior_attack_2.png', 154, 105, 7, 14, false],
      attack3: ['fantasy-warrior_attack_3.png', 154, 105, 8, 14, false],
      hit:     ['fantasy-warrior_hit.png',      154, 105, 3, 12, false],
      death:   ['fantasy-warrior_death.png',    154, 105, 7, 10, false],
    },
  },
  skeleton: {         // 누더기 해골 — 왼쪽을 봄
    folder: 'clothed-skeleton', faceRight: false, ax: 22, ay: 52,
    anims: {
      walk:   ['clothed-skeleton_walk.png',   44, 52, 8, 10, true],
      appear: ['clothed-skeleton_appear.png', 44, 52, 6, 16, false],
    },
  },
  ghost: {            // 묘지 유령 — 오른쪽을 봄
    folder: 'graveyard-ghost', faceRight: true, ax: 15, ay: 49,
    anims: {
      fly: ['graveyard-ghost_fly.png', 29, 49, 4, 12, true],
    },
  },
  nightmare: {        // 푸른 불꽃 말 — 왼쪽을 봄
    folder: 'nightmare', faceRight: false, ax: 48, ay: 89,
    anims: {
      idle: ['nightmare_idle.png', 100, 89, 4, 8, true, 48, 89],
      run:  ['nightmare_run.png',  119, 77, 4, 10, true, 58, 76],
    },
  },
  beast: {            // 불 뿜는 지옥 야수 — 왼쪽을 봄
    folder: 'hell-beast', faceRight: false, ax: 28, ay: 67,
    anims: {
      idle:   ['hell-beast_idle.png',   55, 67, 6, 10, true, 28, 67],
      shoot:  ['hell-beast_shoot.png',  64, 64, 4, 14, true, 34, 64],
      pillar: ['hell-beast_attack.png', 74, 160, 6, 14, false, 37, 160],  // 불기둥
    },
  },
  dragon: {           // 가시 드래곤 — 왼쪽을 봄
    folder: 'spiked-dragon', faceRight: false, ax: 112, ay: 114,
    anims: {
      idle:   ['spiked-dragon_idle.png',   220, 122, 27, 10, true],
      walk:   ['spiked-dragon_walk.png',   220, 122, 27, 10, true, 112, 116],
      attack: ['spiked-dragon_attack.png', 220, 122, 27, 10, false],
      hit:    ['spiked-dragon_hit.png',    220, 122, 21, 20, false],
      death:  ['spiked-dragon_death.png',  220, 122, 31, 10, false, 112, 118],
      strike: ['spiked-dragon_strike.png', 220, 122, 29, 9, false, 112, 116],
    },
  },
};

// 배열을 알아보기 쉬운 모양으로 바꿔 둬요.
for (const key in SPRITES) {
  const s = SPRITES[key];
  for (const name in s.anims) {
    const a = s.anims[name];
    s.anims[name] = {
      file: a[0], fw: a[1], fh: a[2], frames: a[3], fps: a[4], loop: a[5],
      ax: a[6] !== undefined ? a[6] : s.ax,
      ay: a[7] !== undefined ? a[7] : s.ay,
      img: null, white: null,
    };
  }
}

const Assets = { loaded: 0, total: 0 };

// 맞았을 때 하얗게 번쩍이는 그림을 미리 만들어 둬요.
function makeSilhouette(img, color) {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const g = c.getContext('2d');
  g.drawImage(img, 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = color;
  g.fillRect(0, 0, c.width, c.height);
  return c;
}

// 모든 그림 불러오기 (HTML Image 사용)
function loadAssets(onProgress) {
  const jobs = [];
  for (const key in SPRITES) {
    const s = SPRITES[key];
    for (const name in s.anims) {
      const a = s.anims[name];
      Assets.total++;
      jobs.push(new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          a.img = img;
          a.white = makeSilhouette(img, '#ffffff');
          Assets.loaded++;
          if (onProgress) onProgress(Assets.loaded / Assets.total);
          resolve();
        };
        img.onerror = () => reject(new Error(T('그림을 못 불러왔어요: ') + img.src));
        img.src = IMG_ROOT + s.folder + '/' + a.file;
      }));
    }
  }
  return Promise.all(jobs);
}

// 애니메이션 재생기
class Anim {
  constructor(sprite, name) {
    this.sprite = sprite;
    this.name = name;
    this.t = 0;
    this.speed = 1;
  }
  get def() { return SPRITES[this.sprite].anims[this.name]; }
  play(name, speed = 1, restart = false) {
    if (this.name === name && !restart) { this.speed = speed; return; }
    this.name = name; this.t = 0; this.speed = speed;
  }
  update(dt) { this.t += dt * this.speed; }
  get frame() {
    const d = this.def;
    const f = Math.floor(this.t * d.fps);
    return d.loop ? f % d.frames : Math.min(f, d.frames - 1);
  }
  get done() { const d = this.def; return !d.loop && this.t * d.fps >= d.frames; }
  setFrame(f) { this.t = (f + 0.001) / this.def.fps; }
}

// 스프라이트 한 프레임 그리기 (픽셀이 흐려지지 않게 최근접 필터)
// facing: 1 = 오른쪽, -1 = 왼쪽
function drawSprite(ctx, sprite, anim, frame, x, y, scale, facing, opt) {
  const s = SPRITES[sprite];
  const d = s.anims[anim];
  if (!d || !d.img) return;
  const flip = (facing > 0) !== s.faceRight;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(snap(x), snap(y));
  const sx = opt && opt.sx || 1, sy = opt && opt.sy || 1;
  ctx.scale((flip ? -scale : scale) * sx, scale * sy);
  if (opt && opt.alpha !== undefined) ctx.globalAlpha *= opt.alpha;
  if (opt && opt.comp) ctx.globalCompositeOperation = opt.comp;
  const src = opt && opt.white ? d.white : d.img;
  ctx.drawImage(src, frame * d.fw, 0, d.fw, d.fh, -d.ax, -d.ay, d.fw, d.fh);
  ctx.restore();
}
