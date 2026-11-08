'use strict';
/* 시작점: Phaser 게임 만들기 + 화면 크기를 정수 배로 맞추기 (픽셀이 또렷하게) */

// 화면을 실제로 몇 배 크기로 그릴지 (도트는 그 배수로 또렷하게, 글자는 고해상도로)
// 그래픽 품질: 0 빠르게(최대 2배) · 1 보통(최대 3배) · 2 선명하게(모니터 해상도 그대로, 최대 6배)
const _gq = new URLSearchParams(location.search).get('gfx'); if (_gq != null) Store.data.settings.gfx = +_gq;
function calcRes() {
  const need = Math.ceil(Math.min(window.innerWidth / GW, window.innerHeight / GH) * (window.devicePixelRatio || 1) - 0.05);
  return clamp(need, 2, [2, 3, 6][Store.data.settings.gfx] || 6);
}
RES = calcRes();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GW * RES,
  height: GH * RES,
  transparent: true,
  pixelArt: true,
  roundPixels: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  audio: { noAudio: true },
  input: { activePointers: 3 },
  scene: [Boot, Title, WorldMap, Town, Story, Credits, Play, Result],
});

// 창 크기가 바뀌거나 전체 화면이 되면, 그리는 배율을 다시 맞춰요 (흐려지지 않게)
function applyRes() {
  const r = calcRes();
  if (r === RES) return;
  RES = r;
  game.scale.resize(GW * RES, GH * RES);
  game.scene.getScenes(true).forEach(s => s.cameras.main.setZoom(RES));
}
game.scale.on('resize', () => setTimeout(syncWorldCanvas, 0));
// 빛나는 효과(더하기 섞기)가 화면의 투명도까지 바꾸면, 뒤의 3D 세계 위에 네모난 자국이 생겨요.
// 그래서 '색만 더하고 투명도는 그대로' 두도록 바꿔요.
game.events.once('ready', () => {
  const r = game.renderer, gl = r && r.gl;
  if (gl && r.blendModes && r.blendModes[Phaser.BlendModes.ADD]) r.blendModes[Phaser.BlendModes.ADD].func = [gl.ONE, gl.ONE, gl.ZERO, gl.ONE];
});
let _rt = null;
window.addEventListener('resize', () => { clearTimeout(_rt); _rt = setTimeout(applyRes, 250); });
document.addEventListener('fullscreenchange', () => setTimeout(applyRes, 300));

// 브라우저는 사람이 한 번 누르기 전에는 소리를 못 내게 해요
window.addEventListener('pointerdown', () => AE.init(), { once: true });
