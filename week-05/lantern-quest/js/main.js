'use strict';
// 시작 — 화면 크기 맞추기, 장면 바꾸기, 매 프레임 그리기, 입력

const Game = { scene: null, g: null, cv: null, S: 1, last: 0 };

function setScene(s) {
  Game.scene = s;
  FX.parts.length = 0; FX.floats.length = 0;
  const f = $('#fade');
  f.classList.remove('in'); void f.offsetWidth; f.classList.add('in');
  f.classList.remove('on');
  if (s.enter) s.enter();
}
let going = false;
function go(s) {
  if (going) return;
  going = true;
  $('#fade').classList.add('on');
  setTimeout(() => { going = false; setScene(s); }, 220);
}

function resize() {
  // 창 크기에 꽉 맞게 (가로세로 비율은 16:9 유지)
  const S = Math.min(innerWidth / W, innerHeight / H);
  Game.S = S;
  const st = $('#stage');
  st.style.width = W * S + 'px'; st.style.height = H * S + 'px';
  // 글자와 메뉴는 게임 화면보다 K배 넓은 공간에 배치해서 작게 보이게 한다
  const K = Settings.uiK || 1.5;
  UI.root.style.width = W * K + 'px'; UI.root.style.height = H * K + 'px';
  UI.root.style.transform = `scale(${S / K})`;
}

function frame(t) {
  const dt = Math.min(0.05, (t - Game.last) / 1000 || 0);
  Game.last = t;
  const sc = Game.scene;
  if (sc) {
    if (sc.update) sc.update(dt);
    fxUpdate(dt);
    const g = Game.g;
    g.save();
    g.setTransform(R, 0, 0, R, 0, 0);
    if (FX.shakeA > 0.3) g.translate(Math.round(rnd(-1, 1) * FX.shakeA), Math.round(rnd(-1, 1) * FX.shakeA));
    sc.draw(g);
    g.restore();
  }
  requestAnimationFrame(frame);
}

function toGame(e) {
  const r = Game.cv.getBoundingClientRect();
  return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H];
}

async function boot() {
  Game.cv = $('#cv');
  Game.g = Game.cv.getContext('2d');
  UI.root = $('#ui');
  resize();
  addEventListener('resize', resize);
  Game.cv.addEventListener('mousemove', e => { const [x, y] = toGame(e); if (Game.scene && Game.scene.move) Game.scene.move(x, y); });
  Game.cv.addEventListener('click', e => { audioInit(); const [x, y] = toGame(e); if (Game.scene && Game.scene.click) Game.scene.click(x, y); });
  addEventListener('pointerdown', () => audioInit());
  addEventListener('keydown', e => {
    audioInit();
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key) && e.target.tagName !== 'INPUT') e.preventDefault();
    if (e.repeat && e.key === 'Enter') return;
    if (Game.scene && Game.scene.key) Game.scene.key(e);
  });
  Game.cv.width = W * R; Game.cv.height = H * R;
  Game.g.imageSmoothingEnabled = false;
  const load = uiAdd('<div class="loading">그림을 그리는 중… <span>0%</span><i><b></b></i></div>');
  try { await Promise.race([Promise.all([document.fonts.load("11px 'Galmuri11'"), document.fonts.load("11px 'Galmuri11 Bold'"), document.fonts.load("9px 'Galmuri9'")]), new Promise(r => setTimeout(r, 1500))]); } catch (e) {}
  // 그림을 미리 만들어 둔다 (중간중간 쉬면서 진행 막대를 보여 준다)
  const jobs = [...Object.keys(SPR_DEF).map(k => () => getSprite(k)), ...[...REGIONS.map(r => r.id), 'title'].map(id => () => getBG(id))];
  for (let i = 0; i < jobs.length; i++) {
    jobs[i]();
    if (i % 4 === 3) {
      const p = Math.round(((i + 1) / jobs.length) * 100);
      load.querySelector('span').textContent = p + '%'; load.querySelector('b').style.width = p + '%';
      await new Promise(r => setTimeout(r, 0));
    }
  }
  load.remove();
  setScene(TitleScene);
  requestAnimationFrame(frame);
}
addEventListener('load', boot);
