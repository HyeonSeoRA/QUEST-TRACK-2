'use strict';
// =============================================================
//  키보드 입력
// =============================================================

const Input = (() => {
  const down = new Set();
  const pressed = new Set();   // 이번 프레임에 막 누른 키

  // A D 이동, W·Space 점프, Q 원거리 참격, E 근거리 공격, F 패링, Shift 대시, R 포션
  const MAP = {
    left: ['KeyA'],
    right: ['KeyD'],
    jump: ['KeyW', 'Space'],
    ranged: ['KeyQ'],
    attack: ['KeyE'],
    parry: ['KeyF'],
    dash: ['ShiftLeft', 'ShiftRight'],
    heal: ['KeyR'],
    pause: ['Escape', 'KeyP'],
    confirm: ['Enter'],
    mute: ['KeyM'],
  };

  window.addEventListener('keydown', e => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if (!down.has(e.code)) pressed.add(e.code);
    down.add(e.code);
  });
  window.addEventListener('keyup', e => down.delete(e.code));
  window.addEventListener('blur', () => down.clear());

  return {
    held(action) { return MAP[action].some(c => down.has(c)); },
    hit(action) { return MAP[action].some(c => pressed.has(c)); },
    endFrame() { pressed.clear(); },
    clear() { pressed.clear(); down.clear(); },
  };
})();
