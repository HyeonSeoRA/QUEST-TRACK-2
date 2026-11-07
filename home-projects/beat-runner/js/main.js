'use strict';
/* 시작점: Phaser 게임 만들기 + 화면 크기를 정수 배로 맞추기 (픽셀이 또렷하게) */

// 화면을 실제로 몇 배 크기로 그릴지 (도트는 그 배수로 또렷하게, 글자는 고해상도로)
// 그래픽 품질: 0 빠르게(최대 2배) · 1 보통(최대 3배) · 2 선명하게(최대 4배)
const _gq = new URLSearchParams(location.search).get('gfx'); if (_gq != null) Store.data.settings.gfx = +_gq;
RES = clamp(Math.ceil(Math.min(window.innerWidth / GW, window.innerHeight / GH) * (window.devicePixelRatio || 1)), 2, [2, 3, 4][Store.data.settings.gfx] || 3);

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: GW * RES,
  height: GH * RES,
  backgroundColor: '#000000',
  pixelArt: true,
  roundPixels: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  audio: { noAudio: true },
  input: { activePointers: 3 },
  scene: [Boot, Title, WorldMap, Town, Story, Credits, Play, Result],
});

// 브라우저는 사람이 한 번 누르기 전에는 소리를 못 내게 해요
window.addEventListener('pointerdown', () => AE.init(), { once: true });
