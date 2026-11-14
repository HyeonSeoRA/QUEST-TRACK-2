'use strict';
// 화면 위 HTML 도구 — 상자, 막대, 아이콘, 창

const UI = { root: null };
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function uiClear() { UI.root.innerHTML = ''; }
function uiAdd(html, parent = UI.root) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  const el = t.content.firstElementChild;
  parent.appendChild(el);
  return el;
}
const itemIcon = id => sprImg('ic_' + id, 1, 'ico');
const equipIcon = e => `<span class="eqi r${e.rarity}">${sprImg('ic_' + e.icon, 1, 'ico')}</span>`;
const goldHTML = n => `<span class="gold">${sprImg('ic_coin', 1, 'ico s')}${fmt(n)}</span>`;
function barHTML(v, max, cls) {
  const p = max > 0 ? clamp((v / max) * 100, 0, 100) : 0;
  return `<span class="bar ${cls}"><i style="width:${p}%"></i></span>`;
}
function stIcons(st) {
  return Object.keys(st).filter(k => ST_ICON[k]).map(k => `<img class="pix st" src="${stIcon(k).toDataURL()}" title="${ST_NAME[k]}" alt="">`).join('');
}

// 머리 부분만 잘라 낸 작은 그림
const _heads = {};
function headURL(name, flip) {
  const k = name + (flip ? 'f' : '');
  if (_heads[k]) return _heads[k];
  const s = getSprite(name), src = s.frames[0];
  const SW = src.width, SH = src.height, d = src.getContext('2d').getImageData(0, 0, SW, SH).data;
  let x0 = SW, y0 = SH, x1 = 0, y1 = 0;
  for (let y = 0; y < SH; y++) for (let x = 0; x < SW; x++) if (d[(y * SW + x) * 4 + 3]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const O = 18 * GS;
  const side = Math.min(O, x1 - x0 + 1, y1 - y0 + 1);
  let cx = name.startsWith('hero_') ? 11 * GS : x1 - side + 1 - (s.w > 40 ? 3 * GS : 0);
  let cy = y0 + (s.h > 40 ? Math.floor((y1 - y0) * 0.12) : 0);
  const c = newCanvas(O, O), g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  if (flip) { g.translate(O, 0); g.scale(-1, 1); }
  g.drawImage(src, cx, cy, side, side, (O - side) / 2, (O - side) / 2, side, side);
  _heads[k] = c.toDataURL();
  return _heads[k];
}

// ---------- 창 ----------
function modal(html, cls = '') {
  closeModal();
  const m = uiAdd(`<div class="veil"><div class="modal box ${cls}">${html}</div></div>`);
  return m.querySelector('.modal');
}
function closeModal() { const v = UI.root.querySelector('.veil'); if (v) v.remove(); }

let toastTimer = 0;
function toast(msg) {
  let el = UI.root.querySelector('.toast');
  if (!el) el = uiAdd('<div class="toast"></div>');
  el.innerHTML = msg;
  el.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('on'), 2000);
}

// 장비 설명 줄
function equipTip(e) {
  const who = e.cls ? CLASSES[e.cls].name + ' 전용' : { armor: '갑옷', acc: '장신구' }[e.slot];
  return `<b class="r${e.rarity}">${esc(e.name)}</b> <small>${RARITY[e.rarity].name} · ${who}</small><br><small>${esc(equipLine(e))}</small>`;
}
