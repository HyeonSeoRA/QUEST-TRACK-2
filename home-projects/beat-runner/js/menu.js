'use strict';
/* 화면들: Boot(준비) → Title(제목) → WorldMap(세계 지도) ↔ Town(마을) → Play(전투) */

/* ================= 준비 ================= */
class Boot extends Phaser.Scene {
  constructor() { super('Boot'); }
  create() {
    fitCam(this);
    const t = this.add.text(GW / 2, GH / 2, 'Loading...', { fontFamily: 'serif', fontSize: '12px', color: '#c8c0e8', resolution: textRes() }).setOrigin(0.5);
    loadFonts(allGameText()).then(() => {
      this.time.delayedCall(30, () => {
        buildAllArt(this);
        if (!W3.init()) ensureTheme(this, 'forest');
        t.destroy();
        const q = new URLSearchParams(location.search);
        if (q.has('play')) {   // 시험용 주소: ?play=스테이지번호&diff=hard&auto&seek=초
          if (!Store.s) Store.data.save = newSave();
          if (q.has('lv')) Store.s.lv = +q.get('lv');
          this.scene.start('Play', { stage: +q.get('play') || 0, diff: q.get('diff') || 'normal', auto: q.has('auto'), seek: +q.get('seek') || 0, practice: q.has('practice') });
        } else if (q.has('scene')) { if (!Store.s) Store.data.save = newSave(); this.scene.start(q.get('scene'), {}); }
        else this.scene.start('Title');
      });
    });
  }
}

/* ================= 공통 창: 설정 / 상태 / 장비 / 상점 ================= */
const SET_HELP = {
  speed: '노트가 달려오는 빠르기예요. 잘 안 보이면 낮추고, 촘촘하면 올려요.',
  offset: '늘 늦게(SLOW) 친다고 나오면 + 로, 일찍(FAST)이면 - 로 옮겨요.',
  calib: '딸깍 소리에 맞춰 키를 누르면 판정을 자동으로 맞춰 줘요.',
  vol: '배경 음악과 노래 소리 크기예요. ← 줄이기 · → 늘리기 (마우스는 ◀ ▶ 쪽 누르기)',
  sfx: '칼 소리, 메뉴 소리 같은 효과음 크기예요. ← 줄이기 · → 늘리기',
  gfx: '선명하게: 모니터 해상도 그대로 · 렉이 있으면 보통이나 빠르게로.',
  use3d: '끄면 가벼운 2.5D 그림 배경으로 바뀌어요. (설정을 닫으면 다시 불러와요)',
  hd3d: '고화질: 3D 세계를 2배 곱게 · 도트: 굵은 도트 느낌. (설정을 닫으면 다시 불러와요)',
  shake: '맞거나 보스가 등장할 때 화면이 흔들리는 효과예요.',
  meter: '전투 화면 아래에 내가 친 타이밍이 빨랐는지 늦었는지 막대로 보여 줘요.',
  keys: '공중 줄과 땅 줄을 칠 키를 바꿔요. (↑ ↓ 방향키는 늘 쓸 수 있어요)',
  full: '화면을 꽉 채워요. (Esc 로도 나올 수 있어요)',
  back: '설정을 저장하고 닫아요.',
};
function openSettings(scene, stack, onClose, o = {}) {
  const st = Store.data.settings;
  const D = o.depth || 250;   // 일시정지 창 위에서도 열 수 있게 깊이를 받아요
  const dim = modalDim(scene, D - 1);
  const win = Win(scene, 120, 14, 240, 244, { depth: D, title: '설정' });
  const onoff = v => v ? '켜기' : '끄기';
  const items = () => [
    { text: '노트 속도', right: `◀ ${st.speed.toFixed(1)} ▶`, k: 'speed' },
    { text: '판정 맞추기', right: `◀ ${st.offset >= 0 ? '+' : ''}${st.offset}ms ▶`, k: 'offset' },
    ...(o.inGame ? [] : [{ text: '자동 판정 맞추기', right: 'Enter', k: 'calib' }]),
    { text: '음악 크기', right: `◀ ${st.vol} ▶`, k: 'vol' },
    { text: '효과음 크기', right: `◀ ${st.sfx} ▶`, k: 'sfx' },
    { text: '그래픽', right: `◀ ${['빠르게', '보통', '선명하게'][st.gfx]} ▶`, k: 'gfx' },
    ...(o.inGame ? [] : [{ text: '3D 배경', right: `◀ ${onoff(st.use3d !== false)} ▶`, k: 'use3d' }, { text: '3D 화질', right: `◀ ${st.hd3d === false ? '도트' : '고화질'} ▶`, k: 'hd3d' }]),
    { text: '화면 흔들림', right: `◀ ${onoff(st.shake)} ▶`, k: 'shake' },
    { text: '타이밍 막대', right: `◀ ${onoff(st.meter)} ▶`, k: 'meter' },
    ...(o.inGame ? [] : [{ text: '키 바꾸기', right: `${keyName(st.keys.air[0])} ${keyName(st.keys.air[1])} / ${keyName(st.keys.gnd[0])} ${keyName(st.keys.gnd[1])}`, k: 'keys' }]),
    { text: '전체 화면', right: scene.scale.isFullscreen ? '켜짐' : '꺼짐', k: 'full' },
    { text: '돌아가기', k: 'back' },
  ];
  const help = tx(scene, 240, 230, '', { size: 8, ox: 0.5, color: '#9a92c0', wrap: 220, align: 'center', ls: 2 }).setDepth(D + 2);
  const use0 = st.use3d !== false, hd0 = st.hd3d !== false;
  const close = () => { m.destroy(); win.destroy(); help.destroy(); dim.destroy(); Store.save(); if ((st.use3d !== false) !== use0 || (st.hd3d !== false) !== hd0) { location.reload(); return; } if (onClose) onClose(); };
  const redraw = () => { const i = m.i; m.setItems(items()); m.i = i; m.draw(); };
  const m = new Menu(scene, 132, 28, 216, items(), {
    depth: D, stack, rowH: 15,
    onMove: it => help.setText(SET_HELP[it.k] || ''),
    // d: -1 줄이기, +1 늘리기. wrap 이면 끝에서 처음으로 돌아가요 (Enter 로 계속 누를 때)
    onSide: (d, it, wrap) => {
      const step = (v, lo, hi, by) => { const n = Math.round((v + d * by) * 10) / 10; return wrap && n > hi ? lo : clamp(n, lo, hi); };
      if (it.k === 'speed') st.speed = step(st.speed, 1.5, 6, 0.5);
      else if (it.k === 'offset') st.offset = step(st.offset, -200, 200, 5);
      else if (it.k === 'vol') { st.vol = step(st.vol, 0, 10, 1); AE.setVolume(st.vol); }
      else if (it.k === 'sfx') { st.sfx = step(st.sfx, 0, 10, 1); AE.setSfx(st.sfx); }
      else if (it.k === 'gfx') { st.gfx = step(st.gfx, 0, 2, 1); applyRes(); }
      else if (it.k === 'shake') { st.shake = !st.shake; applyShake(scene); }
      else if (it.k === 'use3d') st.use3d = st.use3d === false;
      else if (it.k === 'hd3d') st.hd3d = st.hd3d === false;
      else if (it.k === 'meter') st.meter = !st.meter;
      else return;
      Store.save(); AE.ui(); redraw();
    },
    onOk: it => {
      if (it.k === 'back') { AE.ui('back'); close(); }
      else if (it.k === 'calib') { AE.ui('open'); openCalib(scene, stack, redraw); }
      else if (it.k === 'keys') { AE.ui('open'); openKeys(scene, stack, redraw); }
      else if (it.k === 'full') { scene.scale.toggleFullscreen(); AE.ui('ok'); scene.time.delayedCall(300, redraw); }
      else m.o.onSide(1, it, true);
    },
    // 마우스: 줄의 왼쪽 반(◀)을 누르면 줄이고, 오른쪽 반(▶)을 누르면 늘려요
    onClick: (it, i, p) => {
      if (['speed', 'offset', 'vol', 'sfx', 'gfx', 'shake', 'meter', 'use3d', 'hd3d'].includes(it.k)) m.o.onSide(p.worldX < m.x + m.w / 2 ? -1 : 1, it);
      else m.ok();
    },
    onBack: close,
  });
}

/* 자동 판정 맞추기: 딸깍 소리 8번에 맞춰 누르면, 평균적으로 얼마나 늦게/일찍 누르는지 재서 맞춰 줘요 */
function openCalib(scene, stack, onDone) {
  AE.init();
  const st = Store.data.settings, N = 8, gap = 0.6;
  const dim = modalDim(scene, 299);
  const win = Win(scene, GW / 2 - 110, 70, 220, 120, { depth: 300, title: '자동 판정 맞추기' });
  const info = tx(scene, GW / 2, 92, '딸깍 소리에 맞춰 아무 키나\n8번 눌러 주세요  (Esc: 취소)', { size: 9, ox: 0.5, align: 'center', ls: 4 }).setDepth(302);
  const dots = scene.add.graphics().setDepth(302);
  const ring = scene.add.image(GW / 2, 150, 'ring').setScale(0.3).setTint(0xffe08a).setDepth(302).setBlendMode('ADD');
  const res = tx(scene, GW / 2, 176, '', { size: 9, ox: 0.5, color: '#9dffa0' }).setDepth(302);
  const start = AE.now() + 1.0, clicks = [];
  for (let i = 0; i < N + 6; i++) { const t = start + i * gap; clicks.push(t); AE.tone(t, 'square', 1760, 1760, 0.1, 0.05, AE.sfx); }
  const diffs = [];
  let done = false;
  const draw = () => { dots.clear(); for (let i = 0; i < N; i++) dots.fillStyle(i < diffs.length ? 0xffe08a : 0x3a3860, 1).fillCircle(GW / 2 - 42 + i * 12, 128, 3); };
  draw();
  const tick = scene.time.addEvent({ delay: 16, loop: true, callback: () => {
    const now = AE.now() - AE.latency();
    const k = clicks.findIndex(t => t > now - 0.3);
    const ph = k >= 0 ? clamp(1 - Math.abs(now - clicks[k]) / 0.3, 0, 1) : 0;
    ring.setScale(0.24 + ph * 0.14).setAlpha(0.3 + ph * 0.7);
  } });
  const close = () => { tick.remove(); [win, info, dots, ring, res, dim].forEach(x => x.destroy()); scene.input.off('pointerdown', ptr); stack.pop(h); if (onDone) onDone(); };
  const hitNow = () => {
    if (done) return;
    const t = AE.now() - AE.latency();
    let best = 9; for (const c of clicks) if (Math.abs(t - c) < Math.abs(best)) best = t - c;
    if (Math.abs(best) > 0.3) return;
    diffs.push(best); AE.ui('move'); draw();
    if (diffs.length >= N) {
      done = true;
      const s = diffs.slice().sort((a, b) => a - b), med = (s[3] + s[4]) / 2;
      st.offset = clamp(Math.round(med * 1000 / 5) * 5, -200, 200); Store.save();
      res.setText(`판정 맞추기를 ${st.offset >= 0 ? '+' : ''}${st.offset}ms 로 정했어요!`);
      AE.ui('ok'); scene.time.delayedCall(1600, close);
    }
  };
  const ptr = () => { if (stack.top() === h) hitNow(); };
  scene.input.on('pointerdown', ptr);
  const h = { key: c => { if (c === 'Escape') { AE.ui('back'); done = true; close(); } else hitNow(); } };
  stack.push(h);
}

/* 키 바꾸기: 공중 키 2개, 땅 키 2개를 차례로 눌러 정해요 */
function openKeys(scene, stack, onDone) {
  const st = Store.data.settings;
  const steps = ['공중 줄 키 (1번째)', '공중 줄 키 (2번째)', '땅 줄 키 (1번째)', '땅 줄 키 (2번째)'];
  const got = [];
  const dim = modalDim(scene, 299);
  const win = Win(scene, GW / 2 - 110, 80, 220, 96, { depth: 300, title: '키 바꾸기' });
  const t1 = tx(scene, GW / 2, 104, '', { size: 11, bold: true, ox: 0.5, color: '#ffe8b0' }).setDepth(302);
  const t2 = tx(scene, GW / 2, 124, '', { size: 9, ox: 0.5 }).setDepth(302);
  const t3 = tx(scene, GW / 2, 156, 'Esc: 취소  (Space, Enter, 방향키는 쓸 수 없어요)', { size: 7, ox: 0.5, color: '#9a92c0' }).setDepth(302);
  const show = () => { t1.setText(`${steps[got.length]} 를 눌러 주세요`); t2.setText(got.length ? '고른 키:  ' + got.map(keyName).join('  ') : ''); };
  show();
  const close = () => { [dim, win, t1, t2, t3].forEach(x => x.destroy()); stack.pop(h); if (onDone) onDone(); };
  const h = { key: c => {
    if (c === 'Escape') { AE.ui('back'); close(); return; }
    if (['Space', 'Enter', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Backspace'].includes(c) || got.includes(c)) { AE.ui('no'); return; }
    got.push(c); AE.ui('move');
    if (got.length < 4) { show(); return; }
    st.keys = { air: got.slice(0, 2), gnd: got.slice(2, 4) }; Store.save(); AE.ui('ok');
    toast(scene, `키를 바꿨어요:  공중 ${keyName(got[0])} ${keyName(got[1])} · 땅 ${keyName(got[2])} ${keyName(got[3])}`);
    close();
  } };
  stack.push(h);
}

function statLines(sv, cmp) {
  const s = stats(sv);
  const row = (k, name) => {
    let r = String(Math.round(s[k]));
    if (cmp) { const c = stats(cmp)[k]; if (c !== s[k]) r += `  →  ${Math.round(c)}`; }
    return [name, r, cmp ? (stats(cmp)[k] > s[k] ? '#9dffa0' : stats(cmp)[k] < s[k] ? '#ff8a8a' : '#f4f0ff') : '#f4f0ff'];
  };
  return [row('maxHp', '최대 HP'), row('atk', '공격력'), row('def', '방어력')];
}

function openStatus(scene, stack, onClose) {
  const sv = Store.s, s = stats(sv);
  const dim = modalDim(scene, 249);
  const win = Win(scene, 40, 22, 400, 226, { depth: 250, title: '상태' });
  const add = o => { win.add(o); return o; };
  const g = add(scene.add.graphics());
  g.fillStyle(0x05040c, 1).fillRect(30, 28, 70, 70).fillStyle(0x1a2050, 1).fillRect(32, 30, 66, 66).fillStyle(0x141a40, 1).fillRect(32, 63, 66, 33).lineStyle(1, 0xd8c08a, 1).strokeRect(30.5, 28.5, 69, 69);
  add(scene.add.image(65, 63, 'pt_ria'));
  add(tx(scene, 128, 18, '리아', { size: 14, bold: true, font: 'serif', color: '#ffe8b0' }));
  add(tx(scene, 128, 38, `리듬의 검사   Lv. ${sv.lv}`, { size: 10 }));
  add(tx(scene, 128, 56, `EXP  ${sv.exp} / ${sv.lv >= MAX_LV ? 'MAX' : expNext(sv.lv)}`, { size: 9, color: '#c8c0e8' }));
  const eg = Gauge(scene, 0, 0, 150, 5, 0x4a8aff, 0x9ad8ff); eg.g.setDepth(0); add(eg.g); eg.g.setPosition(128, 70);
  eg.set(sv.lv >= MAX_LV ? 1 : sv.exp / expNext(sv.lv), true);
  const lines = [['최대 HP', s.maxHp], ['공격력', s.atk], ['방어력', s.def], ['버스트 충전', Math.round(s.burst * 100) + '%'], ['판정 여유', '+' + Math.round(s.win * 1000) + 'ms'], ['골드 획득', Math.round(s.gold * 100) + '%']];
  lines.forEach(([k, v], i) => { add(tx(scene, 128 + (i % 2) * 130, 86 + Math.floor(i / 2) * 15, k, { size: 9, color: '#c8c0e8' })); add(tx(scene, 236 + (i % 2) * 130, 86 + Math.floor(i / 2) * 15, String(v), { size: 10, ox: 1 })); });
  add(tx(scene, 14, 132, '장비', { size: 10, bold: true, color: '#ffe8b0' }));
  [['weapon', sv.weapon], ['armor', sv.armor], ['acc', sv.acc]].forEach(([slot, id], i) => {
    add(tx(scene, 20, 150 + i * 16, SLOT_NAME[slot], { size: 9, color: '#c8c0e8' }));
    if (id) add(scene.add.image(84, 155 + i * 16, 'icons', id));
    add(tx(scene, 96, 150 + i * 16, id ? itemName(sv, id) : '없음', { size: 10 }));
  });
  const cleared = STAGES.filter(st => sv.cleared[st.id]).length;
  add(tx(scene, 230, 132, '모험 기록', { size: 10, bold: true, color: '#ffe8b0' }));
  add(tx(scene, 236, 150, `클리어한 곳   ${cleared} / ${STAGES.length}`, { size: 9 }));
  add(tx(scene, 236, 166, `가진 골드     ${comma(sv.gold)} G`, { size: 9 }));
  add(tx(scene, 236, 182, `모험 시간     ${fmtTime(sv.playTime)}`, { size: 9 }));
  add(tx(scene, 236, 198, `마정석        ${sv.stones || 0} 개`, { size: 9 }));
  add(tx(scene, 386, 206, 'Esc: 닫기', { size: 8, ox: 1, color: '#8a82b0' }));
  const h = { key: c => { if (BACK_KEYS.includes(c) || OK_KEYS.includes(c)) { AE.ui('back'); stack.pop(h); win.destroy(); dim.destroy(); if (onClose) onClose(); } } };
  stack.push(h);
}

function openEquip(scene, stack, onClose) {
  const sv = Store.s;
  const dim = modalDim(scene, 249);
  const win = Win(scene, 30, 26, 250, 218, { depth: 250, title: '장비' });
  const info = Win(scene, 290, 26, 160, 218, { depth: 250 });
  const infoObjs = [];
  const showInfo = (id, slot) => {
    infoObjs.forEach(o => o.destroy()); infoObjs.length = 0;
    const cmp = JSON.parse(JSON.stringify(sv));
    if (slot) cmp[slot] = id;
    const it = id ? ITEMS[id] : null;
    const push = o => { infoObjs.push(o); return o; };
    if (it) { push(scene.add.image(306, 48, 'icons', id).setDepth(252)); push(tx(scene, 318, 41, it.name, { size: 10, bold: true, color: '#ffe8b0' }).setDepth(252)); push(tx(scene, 300, 60, it.desc, { size: 9, wrap: 140, color: '#d8d0f0' }).setDepth(252)); }
    else push(tx(scene, 300, 41, '장비하지 않음', { size: 10, color: '#a8a0c8' }).setDepth(252));
    statLines(sv, slot ? cmp : null).forEach(([k, v, c], i) => { push(tx(scene, 300, 150 + i * 16, k, { size: 9, color: '#c8c0e8' }).setDepth(252)); push(tx(scene, 440, 150 + i * 16, v, { size: 10, ox: 1, color: c }).setDepth(252)); });
  };
  const slots = () => ['weapon', 'armor', 'acc'].map(sl => ({ text: SLOT_NAME[sl], right: sv[sl] ? itemName(sv, sv[sl]) : '없음', icon: sv[sl] || null, slot: sl }));
  let sub = null;
  const close = () => { m.destroy(); win.destroy(); info.destroy(); dim.destroy(); infoObjs.forEach(o => o.destroy()); Store.save(); if (onClose) onClose(); };
  const m = new Menu(scene, 42, 44, 226, slots(), {
    depth: 250, stack, rowH: 20,
    onMove: it => showInfo(sv[it.slot], null),
    onOk: it => {
      AE.ui('ok');
      const own = sv.inv.filter(id => ITEMS[id].type === it.slot);
      const list = own.map(id => ({ text: itemName(sv, id), icon: id, id, right: sv[it.slot] === id ? 'E' : '' }));
      if (it.slot === 'acc') list.unshift({ text: '없음', id: null });
      sub = new Menu(scene, 42, 116, 226, list, {
        depth: 251, stack, rowH: 17,
        onMove: s2 => showInfo(s2.id, it.slot),
        onOk: s2 => { sv[it.slot] = s2.id; AE.ui('buy'); sub.destroy(); sub = null; m.setItems(slots()); },
        onBack: () => { sub.destroy(); sub = null; m.draw(); },
      });
    },
    onBack: close,
  });
}

function openShop(scene, stack, onClose) {
  const sv = Store.s;
  const dim = modalDim(scene, 249);
  const win = Win(scene, 16, 22, 290, 226, { depth: 250, title: '상점' });
  const info = Win(scene, 314, 22, 150, 226, { depth: 250 });
  const goldT = tx(scene, 452, 230, '', { size: 10, ox: 1, color: '#ffe8b0' }).setDepth(252);
  const coin = scene.add.image(0, 236, 'icons', 'coin').setDepth(252);
  const infoObjs = [];
  const updGold = () => { goldT.setText(comma(sv.gold) + ' G'); coin.x = 452 - goldT.width - 10; };
  const showInfo = id => {
    infoObjs.forEach(o => o.destroy()); infoObjs.length = 0;
    const it = ITEMS[id], push = o => { infoObjs.push(o); return o; };
    push(scene.add.image(330, 44, 'icons', id).setDepth(252));
    push(tx(scene, 342, 37, it.name, { size: 10, bold: true, color: '#ffe8b0' }).setDepth(252));
    push(tx(scene, 324, 56, it.desc, { size: 9, wrap: 132, color: '#d8d0f0' }).setDepth(252));
    const cmp = JSON.parse(JSON.stringify(sv)); cmp[it.type] = id;
    push(tx(scene, 324, 132, '장착하면', { size: 9, color: '#9a92c0' }).setDepth(252));
    statLines(sv, cmp).forEach(([k, v, c], i) => { push(tx(scene, 324, 148 + i * 15, k, { size: 9, color: '#c8c0e8' }).setDepth(252)); push(tx(scene, 456, 148 + i * 15, v, { size: 10, ox: 1, color: c }).setDepth(252)); });
  };
  const items = () => SHOP.map(id => {
    const it = ITEMS[id], own = sv.inv.includes(id);
    return { text: it.name, icon: id, id, right: own ? '보유' : comma(it.price) + ' G', rcolor: own ? '#8a82b0' : (sv.gold >= it.price ? '#ffe8b0' : '#ff8a8a') };
  });
  updGold();
  const close = () => { m.destroy(); win.destroy(); info.destroy(); dim.destroy(); goldT.destroy(); coin.destroy(); infoObjs.forEach(o => o.destroy()); Store.save(); if (onClose) onClose(); };
  const m = new Menu(scene, 26, 38, 272, items(), {
    depth: 250, stack, rowH: 20,
    onMove: it => showInfo(it.id),
    onOk: it => {
      const item = ITEMS[it.id];
      if (sv.inv.includes(it.id)) { AE.ui('no'); toast(scene, '이미 가지고 있어요.'); return; }
      if (sv.gold < item.price) { AE.ui('no'); toast(scene, '골드가 모자라요.', '#ff9a9a'); return; }
      confirmBox(scene, stack, `${item.name}을(를) ${comma(item.price)} G 에 살까요?`, () => {
        sv.gold -= item.price; sv.inv.push(it.id); AE.ui('buy'); updGold();
        const i = m.i; m.setItems(items()); m.i = i; m.draw();
        confirmBox(scene, stack, '바로 장착할까요?', () => { sv[item.type] = it.id; Store.save(); toast(scene, `${item.name} 장착!`); m.draw(); });
      });
    },
    onBack: close,
  });
}


/* 대장간: 무기와 방어구를 골드와 마정석으로 강화해요. 높은 단계일수록 성공 확률이 낮아져요 (실패해도 단계는 그대로) */
function openForge(scene, stack, onClose) {
  const sv = Store.s;
  const dim = modalDim(scene, 249);
  const win = Win(scene, 16, 22, 250, 226, { depth: 250, title: '대장간 · 장비 강화' });
  const info = Win(scene, 274, 22, 190, 226, { depth: 250 });
  const objs = [];
  const push = o => { objs.push(o.setDepth(252)); return o; };
  const list = () => sv.inv.filter(id => ITEMS[id].type !== 'acc').map(id => ({ text: itemName(sv, id), icon: id, id, right: (sv.weapon === id || sv.armor === id) ? '장착' : '', rcolor: '#9dffa0' }));
  let cur = null;
  const show = id => {
    cur = id; objs.forEach(o => o.destroy()); objs.length = 0;
    const it = ITEMS[id], lv = enhLv(sv, id);
    push(scene.add.image(292, 46, 'icons', id).setScale(1.5));
    push(tx(scene, 306, 38, itemName(sv, id), { size: 11, bold: true, color: '#ffe8b0' }));
    push(tx(scene, 306, 52, `강화 단계  ${lv} / ${ENH_MAX}`, { size: 8, color: '#c8c0e8' }));
    const g = push(scene.add.graphics());
    for (let i = 0; i < ENH_MAX; i++) g.fillStyle(i < lv ? 0xffd070 : 0x2a2850, 1).fillRect(286 + i * 17, 64, 14, 4);
    const now = enhBonus(id, lv), nxt = enhBonus(id, Math.min(ENH_MAX, lv + 1));
    const rows = it.type === 'weapon' ? [['공격력 보너스', now.atk, nxt.atk]] : [['방어력 보너스', now.def, nxt.def], ['최대 HP 보너스', now.hp, nxt.hp]];
    rows.forEach(([k, a, b], i) => {
      push(tx(scene, 286, 80 + i * 15, k, { size: 9, color: '#c8c0e8' }));
      push(tx(scene, 454, 80 + i * 15, lv >= ENH_MAX ? `+${a}` : `+${a}  →  +${b}`, { size: 10, ox: 1, color: lv >= ENH_MAX ? '#ffe08a' : '#9dffa0' }));
    });
    if (lv >= ENH_MAX) { push(tx(scene, 370, 140, '최대 단계예요!', { size: 11, bold: true, ox: 0.5, color: '#ffe08a' })); }
    else {
      const c = enhCost(id, lv);
      push(tx(scene, 286, 120, '필요한 재료', { size: 9, bold: true, color: '#ffe8b0' }));
      push(scene.add.image(292, 140, 'icons', 'coin'));
      push(tx(scene, 302, 140, `${comma(c.gold)} G`, { size: 10, oy: 0.5, color: sv.gold >= c.gold ? '#ffffff' : '#ff8a8a' }));
      push(tx(scene, 454, 140, `가진 골드 ${comma(sv.gold)}`, { size: 8, ox: 1, oy: 0.5, color: '#9a92c0' }));
      push(scene.add.image(292, 158, 'icons', 'crystal1'));
      push(tx(scene, 302, 158, `마정석 ${c.stones}개`, { size: 10, oy: 0.5, color: sv.stones >= c.stones ? '#ffffff' : '#ff8a8a' }));
      push(tx(scene, 454, 158, `가진 마정석 ${sv.stones}`, { size: 8, ox: 1, oy: 0.5, color: '#9a92c0' }));
      push(tx(scene, 286, 178, '성공 확률', { size: 9, color: '#c8c0e8' }));
      push(tx(scene, 454, 178, Math.round(c.rate * 100) + '%', { size: 11, bold: true, ox: 1, color: c.rate >= 0.8 ? '#9dffa0' : c.rate >= 0.5 ? '#ffe08a' : '#ff9a9a' }));
      push(tx(scene, 370, 204, 'Enter: 강화하기', { size: 9, ox: 0.5, color: '#ffe8b0' }));
    }
    push(tx(scene, 370, 222, '마정석은 스테이지를 깨거나 빛나는 엘리트 적을 베면 얻어요', { size: 7, ox: 0.5, color: '#8a82b0', wrap: 180, align: 'center' }));
  };
  const close = () => { m.destroy(); win.destroy(); info.destroy(); dim.destroy(); objs.forEach(o => o.destroy()); Store.save(); if (onClose) onClose(); };
  const attempt = id => {
    const lv = enhLv(sv, id);
    if (lv >= ENH_MAX) { AE.ui('no'); return; }
    const c = enhCost(id, lv);
    if (sv.gold < c.gold) { AE.ui('no'); toast(scene, '골드가 부족해요.', '#ff9a9a'); return; }
    if (sv.stones < c.stones) { AE.ui('no'); toast(scene, '마정석이 부족해요.', '#ff9a9a'); return; }
    sv.gold -= c.gold; sv.stones -= c.stones;
    m.busy = true;
    // 망치질 연출: 쾅! 쾅! 쾅!
    for (let i = 0; i < 3; i++) scene.time.delayedCall(i * 230, () => {
      AE.hit(1, 'P'); scene.cameras.main.shake(70, 0.004);
      const sp = scene.add.image(292 + (Math.random() - 0.5) * 16, 46 + (Math.random() - 0.5) * 12, 'spark').setTint(0xffd070).setBlendMode('ADD').setDepth(260).setScale(1.5);
      scene.tweens.add({ targets: sp, alpha: 0, scale: 3, duration: 260, onComplete: () => sp.destroy() });
    });
    scene.time.delayedCall(760, () => {
      m.busy = false;
      if (Math.random() < c.rate) {
        sv.enh[id] = lv + 1; AE.levelup(); scene.cameras.main.flash(250, 255, 230, 160);
        toast(scene, `강화 성공!  ${itemName(sv, id)}`, '#ffe08a');
      } else { AE.fail(); toast(scene, '강화 실패… 단계는 그대로예요.', '#ff9a9a'); }
      Store.save();
      const i = m.i; m.setItems(list()); m.i = i; m.draw();
    });
  };
  const m = new Menu(scene, 26, 38, 232, list(), {
    depth: 250, stack, rowH: 20,
    onMove: it => show(it.id),
    onOk: it => { if (!m.busy) attempt(it.id); },
    onBack: () => { if (!m.busy) close(); },
  });
}

/* ================= 제목 화면 ================= */
class Title extends Phaser.Scene {
  constructor() { super('Title'); }
  create() {
    fitCam(this);
    this.bg = new BG(this, 'forest', { orbit: 30 });
    this.t0 = 0;
    this.add.image(110, GROUND + 4, 'shadow').setScale(1, 0.25).setAlpha(0.5).setDepth(19);
    this.hero = this.add.sprite(110, GROUND + 1, 'hero', 'run0').setOrigin(0.5, 1).setDepth(20);
    this.lumi = this.add.sprite(80, 160, 'lumi', 0).setDepth(21);
    this.add.rectangle(0, 0, GW, GH, 0x000010, 0.2).setOrigin(0).setDepth(50);
    this.glow = this.add.image(GW / 2, 62, 'glow').setScale(6, 2).setTint(0xffd070).setAlpha(0.25).setBlendMode('ADD').setDepth(51);
    this.logo = goldFill(tx(this, GW / 2, 62, 'BEAT RUNNER', { font: 'en', size: 34, ox: 0.5, oy: 0.5, st: 4, stroke: '#2a1408' })).setDepth(52);
    this.sub = tx(this, GW / 2, 92, '비트 러너  ·  잊혀진 선율', { font: 'serif', size: 12, ox: 0.5, color: '#fff4dc', st: 3, stroke: '#2a1a30' }).setDepth(52);
    this.press = tx(this, GW / 2, 196, '- PRESS ENTER -', { font: 'en', size: 11, ox: 0.5, color: '#fff4dc', st: 3 }).setDepth(52);
    tx(this, GW - 6, GH - 6, 'v2.0', { size: 7, ox: 1, oy: 1, color: '#c8c0e8' }).setDepth(52);
    this.stack = new UIStack(this);
    this.phase = 'press';
    this.stack.push({ key: c => { if (OK_KEYS.includes(c)) this.wake(); } });
    this.input.once('pointerdown', () => this.wake());
    this.cameras.main.fadeIn(800);
  }
  wake() {
    if (this.phase !== 'press') return;
    this.phase = 'menu';
    AE.init(); AE.ui('ok'); playBgm('title');
    this.stack.stack.length = 0;
    this.press.destroy();
    const has = !!Store.s;
    this.win = Win(this, GW / 2 - 70, 156, 140, 62, { depth: 100 });
    this.menu = new Menu(this, GW / 2 - 58, 162, 120, [
      { text: '새로 시작', k: 'new' }, { text: '이어하기', k: 'cont', disabled: !has }, { text: '설정', k: 'set' },
    ], { stack: this.stack, start: has ? 1 : 0, onOk: it => this.choose(it.k) });
  }
  choose(k) {
    if (k === 'set') { AE.ui('open'); openSettings(this, this.stack); return; }
    if (k === 'cont') { AE.ui('ok'); stopBgm(0.6); goScene(this, 'WorldMap', {}, 600); return; }
    const start = () => { Store.data.save = newSave(); Store.save(); AE.ui('ok'); stopBgm(0.6); goScene(this, 'Story', { id: 'prologue', next: ['WorldMap', {}] }, 700); };
    if (Store.s) confirmBox(this, this.stack, '저장된 모험이 지워져요.\n처음부터 시작할까요?', start); else start();
  }
  update(time, delta) {
    const dt = Math.min(delta, 50) / 1000;
    this.t0 += dt;
    const beat = this.t0 * 84 / 60, pulse = Math.pow(1 - (beat % 1), 3);
    this.bg.update(dt, 90, pulse * 0.5);
    this.hero.setFrame('run' + (Math.floor(this.t0 * 12) % 8));
    this.lumi.setFrame(Math.floor(this.t0 * 14) % 4).setPosition(80 + Math.sin(this.t0 * 1.3) * 6, 160 + Math.sin(this.t0 * 2.6) * 5);
    this.logo.setY(62 + Math.sin(this.t0 * 1.5) * 1.5);
    this.glow.setAlpha(0.2 + pulse * 0.08);
    if (this.press && this.press.active) this.press.setAlpha(0.55 + 0.45 * Math.sin(this.t0 * 4));
  }
}

/* ================= 세계 지도 ================= */
function buildWorldMap(scene) {
  if (scene.textures.exists('worldmap')) return;
  const pb = new PB(GW, GH), n = makeNoise(77), n2 = makeNoise(78);
  const segD = (x, y) => {
    let md = 1e9;
    for (let i = 0; i < MAP_NODES.length - 1; i++) {
      const a = MAP_NODES[i], b = MAP_NODES[i + 1], vx = b.x - a.x, vy = b.y - a.y;
      const t = clamp(((x - a.x) * vx + (y - a.y) * vy) / (vx * vx + vy * vy), 0, 1);
      md = Math.min(md, Math.hypot(x - a.x - vx * t, y - a.y - vy * t));
    }
    return md;
  };
  const H = new Float32Array(GW * GH), REG = new Float32Array(GW * GH);
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    const d = segD(x, y), edge = clamp(Math.min(x, GW - x, y, GH - y) / 50, 0, 1);
    H[y * GW + x] = n(x / 70, y / 70, 5) * 0.8 + 0.34 * Math.exp(-d * d / (2 * 40 * 40)) - (1 - edge) * 0.4;
    REG[y * GW + x] = clamp((x + (GH - y) * 0.9 - 180) / 220 + (n2(x / 40, y / 40) - 0.5) * 0.45, 0, 2);
  }
  const h = (x, y) => H[clamp(y, 0, GH - 1) * GW + clamp(x, 0, GW - 1)];
  const SEA = 0.42;
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    const v = h(x, y), reg = REG[y * GW + x], b = BAYER4[y & 3][x & 3] / 16;
    let col;
    if (v < SEA) {
      const dd = (SEA - v) / 0.25;
      col = mixHex('#4a8ac0', '#12305e', clamp(dd + (b - 0.5) * 0.15, 0, 1));
      if (v > SEA - 0.018) col = '#9ad0ea';
      else if ((x * 3 + y * 7) % 23 === 0 && n2(x / 6, y / 3) > 0.62) col = '#7ab8e0';
    } else {
      const shadeV = (h(x - 1, y - 1) - h(x + 1, y + 1)) * 9;
      const alt = (v - SEA) / 0.4;
      let base;
      if (v < SEA + 0.02) base = '#e8d8a0';
      else if (reg < 0.8) base = alt > 0.6 ? '#7a9a5a' : '#5aa048';
      else if (reg < 1.45) base = alt > 0.62 ? (alt > 0.92 ? '#f0f0f8' : '#9a9080') : '#8a9a6a';
      else base = alt > 0.6 ? '#5a4a6a' : '#4e4460';
      col = mixHex(base, shadeV > 0 ? '#fff8e0' : '#101028', clamp(Math.abs(shadeV) + (b - 0.5) * 0.08, 0, 0.45));
    }
    pb.set(x, y, col);
  }
  // 숲, 산, 마른 나무 무늬
  const r = mulberry32(5), P = [];
  for (let y = 4; y < GH; y += 5) for (let x0 = (y % 10) ? 2 : 5; x0 < GW; x0 += 6) {
    const x = x0 + (r() - 0.5) * 4, yy = y + (r() - 0.5) * 3;
    const v = h(Math.round(x), Math.round(yy)), reg = REG[clamp(Math.round(yy), 0, GH - 1) * GW + clamp(Math.round(x), 0, GW - 1)];
    if (v < SEA + 0.04 || segD(x, yy) < 10) continue;
    const dens = n2(x / 26, yy / 26);
    if (reg < 0.8) { if (dens > 0.5 && r() < 0.8) P.push(E(x, yy, 2 + r() * 1.4, 1.9 + r() * 1.2, R(r() < 0.5 ? '#3a7a34' : '#2e6a30'), { amb: 0.4 })); }
    else if (reg < 1.45) { if (v > SEA + 0.16 && dens > 0.42 && r() < 0.28) { const s2 = 3.5 + r() * 3; P.push(Poly([[x - s2, yy + s2 * 0.6], [x, yy - s2], [x + s2, yy + s2 * 0.6]], R('#8a8090'), { amb: 0.4 }), Poly([[x - s2 * 0.32, yy - s2 * 0.5], [x, yy - s2], [x + s2 * 0.32, yy - s2 * 0.5]], R('#f4f4ff'), { flat: 4, line: false, ol: false })); } }
    else if (r() < 0.12) P.push(Cap(x, yy + 2, x, yy - 3, 0.7, 0.4, R('#2a1e30')), Cap(x, yy - 1, x + 2, yy - 3, 0.4, 0.3, R('#2a1e30')));
  }
  renderParts(pb, 0, 0, GW, GH, P);
  // 마을, 동굴, 성 그림
  const T0 = MAP_NODES[0], C6 = MAP_NODES[6], K9 = MAP_NODES[9];
  const Q = [];
  for (const [dx, dy, c] of [[-10, -6, '#b84a3a'], [0, -10, '#4a6ab0'], [9, -5, '#b84a3a']]) {
    Q.push(Poly([[T0.x + dx - 5, T0.y + dy + 6], [T0.x + dx - 5, T0.y + dy], [T0.x + dx + 5, T0.y + dy], [T0.x + dx + 5, T0.y + dy + 6]], R('#e8dcc0')));
    Q.push(Poly([[T0.x + dx - 7, T0.y + dy + 1], [T0.x + dx, T0.y + dy - 6], [T0.x + dx + 7, T0.y + dy + 1]], R(c)));
  }
  Q.push(E(C6.x + 10, C6.y - 10, 12, 9, R('#7a7080')), E(C6.x + 8, C6.y - 7, 4, 4, R('#0a0812'), { flat: 0 }));
  for (const [dx, hh] of [[-8, 16], [0, 24], [8, 16]]) {
    Q.push(Poly([[K9.x + dx - 4, K9.y - 6], [K9.x + dx - 4, K9.y - 6 - hh], [K9.x + dx + 4, K9.y - 6 - hh], [K9.x + dx + 4, K9.y - 6]], R('#4a4060')));
    Q.push(Poly([[K9.x + dx - 6, K9.y - 6 - hh], [K9.x + dx, K9.y - 14 - hh], [K9.x + dx + 6, K9.y - 6 - hh]], R('#8a2a4a')));
  }
  renderParts(pb, 0, 0, GW, GH, Q);
  pb.glow(K9.x, K9.y - 20, 30, '#c04aff', 0.3);
  pb.glow(T0.x, T0.y - 6, 16, '#ffc860', 0.35);
  pb.toTexture(scene, 'worldmap');
}

class WorldMap extends Phaser.Scene {
  constructor() { super('WorldMap'); }
  create() {
    fitCam(this);
    const sv = Store.s;
    buildWorldMap(this);
    W3.hide();
    AE.init(); playBgm('map');
    this.add.image(0, 0, 'worldmap').setOrigin(0).setDepth(-10);
    // 지도 위 구름은 2.5D 숲 배경의 구름 그림을 써요. 3D 를 쓰면 처음에 안 만들어 두므로 여기서 꼭 만들어요
    // (없으면 Phaser 가 '그림 없음' 표시인 대각선 그어진 초록 상자를 그려요)
    ensureTheme(this, 'forest');
    this.clouds = this.add.tileSprite(0, 0, GW, 120, 'bg_forest_cloud').setOrigin(0).setAlpha(0.28).setDepth(40);
    this.clouds2 = this.add.tileSprite(0, 150, GW, 120, 'bg_forest_cloud').setOrigin(0).setAlpha(0.18).setDepth(40);
    ensureVignette(this); this.add.image(0, 0, 'vignette').setOrigin(0).setDepth(45);
    this.paths = this.add.graphics().setDepth(1);
    this.nodesG = this.add.graphics().setDepth(2);
    this.labels = MAP_NODES.map((nd, i) => tx(this, nd.x, nd.y + 8, nd.town ? '마을' : STAGES[i - 1].id, { size: 8, ox: 0.5, color: '#fff4dc', st: 2 }).setDepth(3));
    this.idx = clamp(sv.node || 0, 0, MAP_NODES.length - 1);
    if (!nodeUnlocked(sv, this.idx)) this.idx = 0;
    const nd = MAP_NODES[this.idx];
    this.shadow = this.add.image(nd.x, nd.y + 1, 'shadow').setScale(0.6, 0.18).setAlpha(0.6).setDepth(4);
    this.hero = this.add.sprite(nd.x, nd.y + 2, 'heroMini', 'idle0').setOrigin(0.5, 1).setDepth(5);
    this.lumi = this.add.sprite(nd.x - 10, nd.y - 20, 'lumi', 0).setScale(0.5).setDepth(6);
    this.walking = false; this.t0 = 0;
    // 창들
    this.topWin = Win(this, 8, 8, 170, 26, { depth: 100, pop: false });
    this.areaT = tx(this, 18, 21, '', { size: 10, bold: true, oy: 0.5, font: 'serif', color: '#ffe8b0' }).setDepth(102);
    this.lvWin = Win(this, GW - 128, 8, 120, 26, { depth: 100, pop: false });
    this.lvT = tx(this, GW - 120, 21, '', { size: 9, oy: 0.5 }).setDepth(102);
    this.infoWin = Win(this, 8, GH - 48, GW - 16, 42, { depth: 100, pop: false });
    this.info = [];
    tx(this, GW - 18, GH - 42, '←→ 이동   Enter 선택   T 마을   Esc 메뉴', { size: 8, ox: 1, color: '#9a92c0' }).setDepth(102);
    this.stack = new UIStack(this);
    this.stack.push({ key: c => this.key(c) });
    this.input.on('pointerdown', p => {
      if (this.stack.stack.length !== 1 || this.walking) return;
      const k = MAP_NODES.findIndex(q => Math.hypot(q.x - p.worldX, q.y - p.worldY) < 12);
      if (k < 0) return;
      if (k === this.idx) this.key('Enter'); else if (nodeUnlocked(sv, k)) this.walkTo(k);
    });
    this.refresh();
    this.cameras.main.fadeIn(400);
  }
  refresh() {
    const sv = Store.s;
    this.lvT.setText(`리아  Lv.${sv.lv}     ${comma(sv.gold)} G`);
    const st = this.idx ? STAGES[this.idx - 1] : null;
    this.areaT.setText(st ? CHAPTERS[st.ch].name : '하르모니아 마을');
    this.info.forEach(o => o.destroy()); this.info = [];
    const add = o => { this.info.push(o.setDepth(102)); return o; };
    if (!st) {
      add(tx(this, 20, GH - 43, '하르모니아 마을', { size: 11, bold: true, font: 'serif', color: '#ffe8b0' }));
      add(tx(this, 20, GH - 25, '상점에서 장비를 사고, 장비를 갈아입고, 모험을 기록할 수 있어요.', { size: 9, color: '#d8d0f0' }));
    } else {
      const best = sv.best[st.id];
      add(tx(this, 20, GH - 43, `${st.id}  ${st.name}`, { size: 11, bold: true, font: 'serif', color: st.boss ? '#ff9ab8' : '#ffe8b0' }));
      const rc = sv.lv >= st.rec ? '#9dffa0' : '#ff9a9a';
      add(tx(this, 200, GH - 42, `추천 Lv.${st.rec}`, { size: 9, color: rc }));
      add(tx(this, 270, GH - 42, `BPM ${st.bpm}`, { size: 9, color: '#c8c0e8' }));
      add(tx(this, 20, GH - 25, st.desc, { size: 9, color: '#d8d0f0' }));
      if (best) add(tx(this, GW - 20, GH - 25, `최고  ${best.rank}  ${comma(best.score)}`, { size: 9, ox: 1, color: RANK_CSS[best.rank] }));
    }
    this.drawNodes();
  }
  drawNodes() {
    const sv = Store.s, g = this.paths, ng = this.nodesG;
    g.clear(); ng.clear();
    for (let i = 0; i < MAP_NODES.length - 1; i++) {
      const a = MAP_NODES[i], b = MAP_NODES[i + 1], open = nodeUnlocked(sv, i + 1);
      const L = Math.hypot(b.x - a.x, b.y - a.y), n = Math.floor(L / 5);
      for (let k = 1; k < n; k++) {
        const x = a.x + (b.x - a.x) * k / n, y = a.y + (b.y - a.y) * k / n;
        g.fillStyle(0x1a1008, open ? 0.9 : 0.4).fillRect(Math.round(x) - 1, Math.round(y) - 1, 3, 3);
        g.fillStyle(open ? 0xf0d890 : 0x8a8070, open ? 1 : 0.5).fillRect(Math.round(x), Math.round(y), 1, 1);
      }
    }
    MAP_NODES.forEach((nd, i) => {
      const open = nodeUnlocked(sv, i), clr = i > 0 && sv.cleared[STAGES[i - 1].id], boss = i > 0 && STAGES[i - 1].boss;
      const r = nd.town ? 0 : boss ? 6 : 5;
      this.labels[i].setAlpha(open ? 1 : 0.4);
      if (!r) return;
      ng.fillStyle(0x0a0612, 1).fillCircle(nd.x, nd.y, r + 1.5);
      ng.fillStyle(!open ? 0x5a5868 : clr ? 0xe6b44c : boss ? 0xd04a6a : 0x4a8ae8, 1).fillCircle(nd.x, nd.y, r);
      ng.fillStyle(0xffffff, open ? 0.45 : 0.15).fillCircle(nd.x - 1.5, nd.y - 1.5, r * 0.4);
      if (clr) ng.fillStyle(0xfff4c0, 1).fillPoints([{ x: nd.x, y: nd.y - 3 }, { x: nd.x + 1, y: nd.y - 1 }, { x: nd.x + 3, y: nd.y }, { x: nd.x + 1, y: nd.y + 1 }, { x: nd.x, y: nd.y + 3 }, { x: nd.x - 1, y: nd.y + 1 }, { x: nd.x - 3, y: nd.y }, { x: nd.x - 1, y: nd.y - 1 }], true);
    });
  }
  walkTo(k) {
    if (this.walking || k === this.idx) return;
    const step = k > this.idx ? 1 : -1;
    const hop = () => {
      if (this.idx === k) { this.walking = false; Store.s.node = k; this.refresh(); this.hero.setFrame('idle0'); return; }
      const nx = this.idx + step;
      if (!nodeUnlocked(Store.s, nx)) { this.walking = false; this.refresh(); return; }
      const a = MAP_NODES[this.idx], b = MAP_NODES[nx];
      this.walking = true;
      this.hero.setFlipX(b.x < a.x);
      this.tweens.add({ targets: this.hero, x: b.x, y: b.y + 2, duration: Math.hypot(b.x - a.x, b.y - a.y) * 9, onComplete: () => { this.idx = nx; AE.ui('move'); hop(); } });
    };
    hop();
  }
  key(c) {
    if (this.walking) return;
    const sv = Store.s;
    if (['ArrowRight', 'ArrowUp', 'KeyD', 'KeyW'].includes(c)) { if (this.idx < MAP_NODES.length - 1 && nodeUnlocked(sv, this.idx + 1)) this.walkTo(this.idx + 1); else AE.ui('no'); }
    else if (['ArrowLeft', 'ArrowDown', 'KeyA', 'KeyS'].includes(c)) { if (this.idx > 0) this.walkTo(this.idx - 1); }
    else if (OK_KEYS.includes(c)) {
      AE.ui('ok');
      if (this.idx === 0) { Store.save(); goScene(this, 'Town', {}); return; }
      this.stageWindow(this.idx - 1);
    } else if (c === 'KeyT') { if (this.idx !== 0) { AE.ui('ok'); this.walkTo(0); } }   // T: 마을로 바로 가기
    else if (BACK_KEYS.includes(c)) this.sysMenu();
  }
  stageWindow(si) {
    const st = STAGES[si];
    const dim = modalDim(this, 199);
    const win = Win(this, GW / 2 - 100, 76, 200, 110, { depth: 200, title: `${st.id}  ${st.name}` });
    const m = new Menu(this, GW / 2 - 88, 96, 176, [
      { text: '보통으로 출격', right: '보상 x1', k: 'normal' },
      { text: '어려움으로 출격', right: '보상 x1.5', k: 'hard', color: '#ffb0b0' },
      { text: '연습하기', right: '지지 않음 · 보상 없음', k: 'practice', color: '#b0e0ff' },
      { text: '취소', k: 'no' },
    ], {
      depth: 200, stack: this.stack, rowH: 20,
      onOk: it => {
        if (it.k === 'no') { AE.ui('back'); m.destroy(); win.destroy(); dim.destroy(); return; }
        AE.ui('ok'); Store.s.node = this.idx; Store.save(); stopBgm(0.5);
        const play = ['Play', { stage: si, diff: it.k === 'practice' ? 'normal' : it.k, practice: it.k === 'practice' }];
        const sid = STORY_BEFORE[st.id];
        if (sid && !Store.s.seen[sid]) goScene(this, 'Story', { id: sid, next: play });
        else goScene(this, ...play);
      },
      onBack: () => { m.destroy(); win.destroy(); dim.destroy(); },
    });
  }
  sysMenu() {
    AE.ui('open');
    const dim = modalDim(this, 199);
    const win = Win(this, GW / 2 - 60, 70, 120, 86, { depth: 200, title: '메뉴' });
    const m = new Menu(this, GW / 2 - 50, 84, 100, [{ text: '상태', k: 's' }, { text: '장비', k: 'e' }, { text: '설정', k: 'o' }, { text: '타이틀로', k: 't' }], {
      depth: 200, stack: this.stack,
      onOk: it => {
        AE.ui('ok');
        if (it.k === 's') openStatus(this, this.stack);
        else if (it.k === 'e') openEquip(this, this.stack, () => this.refresh());
        else if (it.k === 'o') openSettings(this, this.stack);
        else { Store.save(); stopBgm(0.5); goScene(this, 'Title', {}); }
      },
      onBack: () => { m.destroy(); win.destroy(); dim.destroy(); },
    });
  }
  update(time, delta) {
    const dt = Math.min(delta, 50) / 1000;
    this.t0 += dt;
    Store.s.playTime += dt;
    this.clouds.tilePositionX += dt * 6; this.clouds2.tilePositionX += dt * 4;
    if (this.walking) this.hero.setFrame('walk' + (Math.floor(this.t0 * 8) % 4));
    this.shadow.setPosition(this.hero.x, this.hero.y - 1);
    this.lumi.setFrame(Math.floor(this.t0 * 14) % 4).setPosition(this.hero.x - 10 + Math.sin(this.t0 * 2) * 3, this.hero.y - 22 + Math.sin(this.t0 * 3) * 2);
    // 갈 수 있는 다음 곳이 반짝여요
    const nx = this.idx + 1;
    if (!this.ring) this.ring = this.add.image(0, 0, 'ring').setScale(0.3).setBlendMode('ADD').setDepth(2);
    const target = MAP_NODES.findIndex((q, i) => i > 0 && nodeUnlocked(Store.s, i) && !Store.s.cleared[STAGES[i - 1].id]);
    if (target > 0) { const q = MAP_NODES[target]; this.ring.setVisible(true).setPosition(q.x, q.y).setScale(0.22 + (this.t0 % 1) * 0.2).setAlpha(1 - (this.t0 % 1)).setTint(0x9ad8ff); }
    else this.ring.setVisible(false);
  }
}

/* ================= 마을 ================= */
class Town extends Phaser.Scene {
  constructor() { super('Town'); }
  create() {
    fitCam(this);
    AE.init(); playBgm('town');
    this.bg = new BG(this, 'town', { orbit: 16 });
    this.t0 = 0;
    this.add.image(150, GROUND + 3, 'shadow').setScale(1, 0.25).setAlpha(0.5).setDepth(19);
    this.hero = this.add.sprite(150, GROUND + 1, 'hero', 'idle0').setOrigin(0.5, 1).setDepth(20);
    this.lumi = this.add.sprite(124, 170, 'lumi', 0).setDepth(21);
    this.add.rectangle(0, 0, GW, GH, 0x000010, 0.12).setOrigin(0).setDepth(50);
    const tw = Win(this, 8, 8, 150, 26, { depth: 100, pop: false });
    tx(this, 18, 21, '하르모니아 마을', { size: 10, bold: true, oy: 0.5, font: 'serif', color: '#ffe8b0' }).setDepth(102);
    this.goldWin = Win(this, GW - 196, 8, 188, 26, { depth: 100, pop: false });
    this.goldT = tx(this, GW - 186, 21, '', { size: 9, oy: 0.5 }).setDepth(102);
    this.stack = new UIStack(this);
    this.win = Win(this, GW - 150, 56, 136, 130, { depth: 100, title: '무엇을 할까?' });
    this.menu = new Menu(this, GW - 140, 72, 118, [
      { text: '상점', k: 'shop' }, { text: '대장간 (강화)', k: 'forge' }, { text: '장비', k: 'equip' }, { text: '상태', k: 'status' }, { text: '휴식하고 기록하기', k: 'rest' }, { text: '지도로 나가기', k: 'out' },
    ], { stack: this.stack, rowH: 18, onOk: it => this.choose(it.k), onBack: () => this.choose('out') });
    this.refresh();
    this.cameras.main.fadeIn(400);
    if (!Store.s.seen.town) { Store.s.seen.town = true; new Dialog(this, this.stack, [['lumi', '여기가 마을이야! 적을 물리치면 골드를 모을 수 있어.\n골드로 상점에서 좋은 장비를 사면 훨씬 강해져!']]); }
  }
  refresh() { this.goldT.setText(`리아  Lv.${Store.s.lv}    ${comma(Store.s.gold)} G    마정석 ${Store.s.stones || 0}`); }
  choose(k) {
    AE.ui('ok');
    if (k === 'shop') openShop(this, this.stack, () => this.refresh());
    else if (k === 'forge') openForge(this, this.stack, () => this.refresh());
    else if (k === 'equip') openEquip(this, this.stack, () => this.refresh());
    else if (k === 'status') openStatus(this, this.stack);
    else if (k === 'rest') { Store.save(); AE.levelup(); toast(this, '푹 쉬었다! 모험을 기록했어요.'); this.hero.setFrame('win'); this.time.delayedCall(900, () => this.hero.setFrame('idle0')); }
    else { Store.s.node = 0; Store.save(); goScene(this, 'WorldMap', {}); }
  }
  update(time, delta) {
    const dt = Math.min(delta, 50) / 1000;
    this.t0 += dt; Store.s.playTime += dt;
    this.bg.update(dt, 0, 0);
    if (this.hero.frame.name !== 'win') this.hero.setFrame('idle' + (Math.floor(this.t0 * 2) % 2));
    this.lumi.setFrame(Math.floor(this.t0 * 14) % 4).setPosition(124 + Math.sin(this.t0 * 1.2) * 6, 170 + Math.sin(this.t0 * 2.4) * 4);
  }
}
