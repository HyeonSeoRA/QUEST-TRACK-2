'use strict';
/* 글꼴: 한글은 나눔고딕/나눔명조, 영어 제목은 Cinzel.
 * 글자는 화면 확대 배율만큼 높은 해상도로 그려서 또렷하게 보여요. */

const FONT_UI = '"Nanum Gothic", "Malgun Gothic", sans-serif';
const FONT_SERIF = '"Nanum Myeongjo", "Batang", serif';
const FONT_EN = '"Cinzel", "Nanum Myeongjo", serif';

function textRes() { return RES; }

/* tx(장면, x, y, 글, 옵션)
 * 옵션: size, color, font('ui'|'serif'|'en'), bold, ox, oy, stroke, st(테두리 두께), wrap, align, ls(줄 간격), shadow */
function tx(scene, x, y, str, o = {}) {
  const family = o.font === 'serif' ? FONT_SERIF : o.font === 'en' ? FONT_EN : FONT_UI;
  const style = {
    fontFamily: family,
    fontSize: (o.size || 10) + 'px',
    color: o.color || '#f4f0ff',
    fontStyle: o.bold === false ? 'normal' : (o.bold || o.font === 'en' ? 'bold' : 'normal'),
    stroke: o.stroke || '#0a0716',
    strokeThickness: o.st != null ? o.st : 2,
    align: o.align || 'left',
    resolution: textRes(),
    lineSpacing: o.ls != null ? o.ls : 3,
  };
  if (o.wrap) style.wordWrap = { width: o.wrap, useAdvancedWrap: true };
  const t = scene.add.text(Math.round(x), Math.round(y), str, style).setOrigin(o.ox || 0, o.oy || 0);
  // 글자는 부드럽게 (도트 모드의 '가장 가까운 점' 방식이면 획이 빠져 보여요)
  t.texture.setFilter(Phaser.Textures.FilterMode.LINEAR);
  if (o.shadow !== false) t.setShadow(1, 1, 'rgba(0,0,0,0.6)', 2, true, true);
  return t;
}

/* 금색 그라데이션 글자 (제목, 랭크) */
function goldFill(t, top = '#fff6d0', mid = '#f2c45a', bot = '#a8641e') {
  const g = t.context.createLinearGradient(0, 0, 0, t.height);
  g.addColorStop(0, top); g.addColorStop(0.5, mid); g.addColorStop(1, bot);
  t.setFill(g);
  return t;
}

/* 게임에 쓰이는 모든 글자를 미리 불러와요 (한글 글꼴은 글자 묶음마다 따로 내려받기 때문) */
function loadFonts(sample) {
  if (!document.fonts || !document.fonts.load) return Promise.resolve();
  const jobs = [
    `10px "Nanum Gothic"`, `bold 10px "Nanum Gothic"`,
    `bold 10px "Nanum Myeongjo"`, `bold 10px "Cinzel"`,
  ].map(f => document.fonts.load(f, sample).catch(() => null));
  return Promise.race([Promise.all(jobs), new Promise(r => setTimeout(r, 4500))]);
}

/* 자주 튀어나오는 글자(PERFECT, 피해 숫자 등)는 한 번 그린 그림을 다시 써요 (매번 글자를 새로 그리면 느려요) */
function bakedText(scene, x, y, str, o = {}) {
  const key = 'bt|' + str + '|' + JSON.stringify(o) + '|' + RES;
  if (!scene.textures.exists(key)) {
    const t = tx(scene, 0, 0, str, o);
    if (o.gold) goldFill(t);
    t.updateText();
    const cv = t.canvas, ct = scene.textures.createCanvas(key, cv.width, cv.height);
    ct.getContext().drawImage(cv, 0, 0); ct.refresh(); ct.setFilter(Phaser.Textures.FilterMode.LINEAR);
    t.destroy();
  }
  return scene.add.image(Math.round(x), Math.round(y), key).setScale(1 / RES).setOrigin(o.ox || 0, o.oy || 0);
}
