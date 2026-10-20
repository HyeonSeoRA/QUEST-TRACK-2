'use strict';
/* 시작점: 캔버스 크기 맞추기, 입력, 화면 전환, 반복 그리기 */

const app = {
  canvas: document.getElementById('game'),
  sound: new Sound(),
  mouse: { x: -1, y: -1 },
  time: 0,
  scene: null, next: null,
  fade: 1, fadeDir: 1,
  autoplay: false,
  scale: 1,

  go(scene) {
    if (!this.scene) { this.scene = scene; scene.enter && scene.enter(); return; }
    this.next = scene;
    this.fadeDir = -1;
  },
};
app.ctx = app.canvas.getContext('2d');
app.sound.setVolume(Save.d.volume);
app.sound.setMusic(Save.d.music);

/* ---------- 화면 크기: 16:9 를 지키며 창에 맞춘다 ----------
 * 내부 그림판 크기를 제한해서 렉을 줄인다.
 *   선명하게: 1.5배 ~ 2배 (1920x1080 ~ 2560x1440) 로 또렷하게
 *   빠르게  : 1280x720 고정 (가장 가벼움)
 */
function resize() {
  const dpr = window.devicePixelRatio || 1;
  const k = Math.min(window.innerWidth / W, window.innerHeight / H);
  const cw = Math.floor(W * k), ch = Math.floor(H * k);
  app.canvas.style.width = cw + 'px';
  app.canvas.style.height = ch + 'px';
  const s = Save.d.quality === 'fast' ? Math.min(1, k * dpr) : Math.min(2, Math.max(1.5, k * dpr));
  app.canvas.width = Math.round(W * s);
  app.canvas.height = Math.round(H * s);
  app.scale = app.canvas.width / W;
}
window.addEventListener('resize', resize);
resize();

/* ---------- 입력 ---------- */
const BLOCK_KEYS = new Set(['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);
window.addEventListener('keydown', e => {
  if (BLOCK_KEYS.has(e.code)) e.preventDefault();
  if (e.repeat) return;
  app.sound.init();
  const t = app.sound.timeAt(e.timeStamp);
  if (app.scene && app.fadeDir > 0 && app.scene.keyDown) app.scene.keyDown(e.code, t);
});
window.addEventListener('keyup', e => {
  if (app.scene && app.scene.keyUp) app.scene.keyUp(e.code);
});
function toLogical(e) {
  const r = app.canvas.getBoundingClientRect();
  return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H };
}
app.canvas.addEventListener('pointermove', e => { app.mouse = toLogical(e); });
app.canvas.addEventListener('pointerleave', () => { app.mouse = { x: -1, y: -1 }; });
app.canvas.addEventListener('pointerdown', e => {
  e.preventDefault();
  app.sound.init();
  const p = toLogical(e);
  app.mouse = p;
  if (!app.scene || app.fadeDir <= 0) return;
  // 전투 중 줄을 터치하면 노트 치기 (휴대폰 · 태블릿)
  if (app.scene.pointerDown && app.scene.pointerDown(p.x, p.y, e.pointerId, app.sound.timeAt(e.timeStamp))) return;
  if (app.scene.mouseDown) app.scene.mouseDown(p.x, p.y);
});
const pointerUp = e => { if (app.scene && app.scene.pointerUp) app.scene.pointerUp(e.pointerId); };
window.addEventListener('pointerup', pointerUp);
window.addEventListener('pointercancel', pointerUp);
app.canvas.addEventListener('contextmenu', e => e.preventDefault());
const lost = () => { if (app.scene && app.scene.focusLost) app.scene.focusLost(); };
window.addEventListener('blur', lost);
document.addEventListener('visibilitychange', () => { if (document.hidden) lost(); });

/* ---------- 느린 컴퓨터면 자동으로 "빠르게" 그래픽으로 ---------- */
let slowFrames = 0, countFrames = 0;
function watchSpeed(dt) {
  if (Save.d.quality === 'fast' || document.hidden || app.scale <= 1) return;
  countFrames++;
  if (dt > 1 / 40) slowFrames++;
  if (countFrames >= 180) {
    if (slowFrames > 90) { Save.d.quality = 'fast'; Save.write(); resize(); }
    slowFrames = 0; countFrames = 0;
  }
}

/* ---------- 반복 ---------- */
let last = performance.now();
function frame(now) {
  const dt = Math.min(.05, (now - last) / 1000);
  last = now;
  app.time += dt;
  app.sound.tick();

  if (app.fadeDir < 0) {
    app.fade -= dt / .22;
    if (app.fade <= 0) {
      app.fade = 0; app.fadeDir = 1;
      if (app.next) { app.scene = app.next; app.next = null; app.scene.enter && app.scene.enter(); }
    }
  } else if (app.fade < 1) app.fade = Math.min(1, app.fade + dt / .32);
  if (app.scene) app.scene.update(dt);

  const ctx = app.ctx;
  ctx.setTransform(app.scale, 0, 0, app.scale, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  if (app.scene) app.scene.render(ctx);
  screenFrame(ctx);

  if (app.fade < 1) {
    // 화면 전환: 어둠이 덮이며 가운데 금선이 번쩍
    const a = 1 - app.fade;
    ctx.globalAlpha = Math.min(1, a * 1.2);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = a;
    ornLine(ctx, W / 2, H / 2, 320 * a);
    ctx.globalAlpha = 1;
  }
  watchSpeed(dt);
  requestAnimationFrame(frame);
}

/* ---------- 시작 ---------- */
(async function start() {
  try {
    await Promise.race([
      Promise.all([
        document.fonts.load('700 16px "Nanum Myeongjo"'),
        document.fonts.load('800 16px "Nanum Myeongjo"'),
        document.fonts.load('700 16px Cinzel'),
      ]),
      new Promise(r => setTimeout(r, 2500)),
    ]);
  } catch (e) { /* 글꼴을 못 불러와도 기본 글꼴로 진행 */ }

  // 개발용 바로가기: index.html#battle=3 , #hub=1
  const q = new URLSearchParams(location.hash.slice(1));
  if (q.has('battle')) {
    app.autoplay = true;
    app.go(new BattleScene(app, STAGES[+q.get('battle')]));
  } else if (q.has('hub')) {
    const h = new HubScene(app);
    h.tab = +q.get('hub');
    if (q.has('sel')) h.sel = +q.get('sel');
    if (q.has('mx')) app.mouse = { x: +q.get('mx'), y: +q.get('my') };
    app.go(h);
  } else {
    app.go(new TitleScene(app));
  }
  requestAnimationFrame(t => { last = t; frame(t); });
})();
