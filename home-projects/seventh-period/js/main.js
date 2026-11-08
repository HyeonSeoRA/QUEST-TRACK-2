'use strict';
// 시작 흐름: 글꼴 → 동의 → 로그인 → 불러오기 → 메뉴, 그리고 메뉴·설정 버튼

const Main = (() => {
  const M = {};
  let ready = false, settingsBack = 'menu';

  async function boot() {
    try {
      await Promise.race([
        Promise.all(['40px "Nanum Pen Script"', '800 40px "Nanum Myeongjo"', '400 20px "Noto Sans KR"', '700 20px "Noto Sans KR"'].map(f => document.fonts.load(f))),
        new Promise(r => setTimeout(r, 3000)),
      ]);
    } catch (e) { /* 기본 글꼴로 */ }
    Auth.load();
    const c = Auth.consent();
    if (!c) showConsent();
    else if (!Auth.user) showLogin();
    else startLoading();
  }
  // 소리는 사용자가 한 번 눌러야 켜진다
  document.addEventListener('pointerdown', () => Sound.init(), { once: false });
  document.addEventListener('keydown', () => Sound.init());

  // ---------- 동의 ----------
  function showConsent() {
    UI.show('consent');
    const req = [...document.querySelectorAll('.cReq')];
    const opt = [...document.querySelectorAll('.cOpt')];
    const all = $('cAll');
    const upd = () => {
      const ok = req.every(c => c.checked);
      $('agreeBtn').disabled = !ok;
      all.checked = ok && opt.every(c => c.checked);
    };
    all.onchange = () => { [...req, ...opt].forEach(c => { c.checked = all.checked; }); upd(); };
    [...req, ...opt].forEach(c => { c.onchange = upd; });
    document.querySelectorAll('.cMore').forEach(b => b.onclick = e => { e.preventDefault(); b.closest('.cItem').classList.toggle('open'); });
    upd();
    $('agreeBtn').onclick = () => {
      Sound.init();
      Auth.saveConsent({ strong: $('cStrong').checked, remember: $('cRemember').checked, terms: true, privacy: true, horror: true, flash: true });
      Game.settings.strong = $('cStrong').checked;
      Game.applySettings();
      showLogin();
    };
  }

  // ---------- 로그인 ----------
  function showLogin() {
    UI.show('login');
    $('gnote').textContent = '';
    Auth.initGoogle($('gbtn'), () => { Sound.init(); startLoading(); }, why => {
      $('gbtn').innerHTML = '<button class="gFake" disabled><span class="gG">G</span> Google 계정으로 로그인</button>';
      $('gnote').textContent = why;
    });
    $('guestBtn').onclick = () => {
      Sound.init();
      Auth.guest($('guestName').value);
      startLoading();
    };
    $('guestName').onkeydown = e => { if (e.key === 'Enter') $('guestBtn').click(); };
  }

  // ---------- 불러오기 ----------
  async function startLoading() {
    if (ready) { M.showMenu(); return; }
    UI.show('loading');
    const bar = $('loadBar'), msg = $('loadMsg');
    const msgs = ['칠판을 닦는 중', '책상을 줄 맞추는 중', '형광등을 거는 중', '출석부를 펴는 중', '누군가 자리에 앉는 중'];
    try {
      await Game.init(k => { bar.style.width = (k * 100) + '%'; msg.textContent = msgs[Math.min(4, (k * 5) | 0)] + '…'; });
    } catch (e) {
      console.error(e);
      msg.textContent = '3D 화면을 켜지 못했어요. 다른 브라우저(크롬/엣지)로 열어 주세요.';
      return;
    }
    ready = true;
    Game.state = 'menu';
    M.showMenu();
  }

  // ---------- 메뉴 ----------
  let newArmed = false;
  M.showMenu = () => {
    Game.state = 'menu';
    UI.show('menu');
    ['pause', 'settings', 'inv', 'howto', 'records', 'doc'].forEach(UI.hide);
    const u = Auth.user;
    $('profile').innerHTML = u ? `${u.picture ? `<img src="${esc(u.picture)}" referrerpolicy="no-referrer" alt="">` : `<span class="ava0">${esc(u.short.slice(0, 1))}</span>`}
      <div><b>${esc(u.short)}</b><small>${u.provider === 'google' ? 'Google 계정' : '게스트'} · 2학년 3반 31번</small></div>
      <button id="logoutBtn">로그아웃</button>` : '';
    if ($('logoutBtn')) $('logoutBtn').onclick = () => { Auth.logout(); showLogin(); };
    const save = Game.loadSave();
    $('btnContinue').style.display = save ? '' : 'none';
    if (save) {
      const d = new Date(save.when);
      $('btnContinue').innerHTML = `이어하기<small>Lv.${save.P.level} · ${Math.floor(save.P.time / 60)}분 · ${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}</small>`;
    }
    newArmed = false;
    $('btnNew').innerHTML = '새 학기';
    if (matchMedia('(pointer: coarse)').matches && !matchMedia('(pointer: fine)').matches) $('menuFoot').textContent = '이 게임은 키보드와 마우스가 있는 컴퓨터에서 할 수 있어요.';
    const ends = Game.endings().length;
    $('menuEnds').textContent = ends ? `모은 엔딩 ${ends} / 3` : '';
  };

  function bind() {
    $('btnContinue').onclick = () => { Sound.init(); Game.continueGame(); };
    $('btnNew').onclick = () => {
      Sound.init();
      if (Game.hasSave() && !newArmed) { newArmed = true; $('btnNew').innerHTML = '새 학기<small>이어하던 기록이 지워져요. 한 번 더 누르세요.</small>'; return; }
      Game.deleteSave();
      Game.newGame();
    };
    $('btnRecords').onclick = () => { renderRecords(); UI.open('records'); };
    $('btnSettings').onclick = () => { settingsBack = 'menu'; openSettings(); };
    $('btnHowto').onclick = () => UI.open('howto');
    document.querySelectorAll('.closePanel').forEach(b => b.onclick = () => UI.hide(b.dataset.p));

    // 일시정지
    $('pResume').onclick = () => Game.resume();
    $('pSettings').onclick = () => { settingsBack = 'pause'; openSettings(); };
    $('pHowto').onclick = () => UI.open('howto');
    let menuArmed = false;
    $('pMenu').onclick = () => {
      if (!menuArmed) { menuArmed = true; $('pMenu').textContent = '정말 나갈까요? (기록 안 한 진행은 사라져요)'; setTimeout(() => { menuArmed = false; $('pMenu').textContent = '메뉴로 나가기'; }, 3000); return; }
      menuArmed = false; $('pMenu').textContent = '메뉴로 나가기';
      UI.hide('pause');
      Game.toMenu();
    };

    // 죽음 / 엔딩
    $('retryBtn').onclick = () => Game.continueGame();
    $('deathMenu').onclick = () => Game.toMenu();
    $('endMenu').onclick = e => { e.stopPropagation(); Game.toMenu(); };
    $('endRetry').onclick = e => { e.stopPropagation(); Game.continueGame(); };
    $('ending').onclick = () => Game.endingNext();

    // 소지품 창
    document.querySelectorAll('.itab').forEach(b => b.onclick = () => UI.invTab(b.dataset.t));
    $('invClose').onclick = () => Game.closeInv();
    $('docClose').onclick = () => UI.closeDoc();
    $('clickHint').onclick = () => Game.lock();
  }

  // ---------- 설정 ----------
  function openSettings() {
    const s = Game.settings;
    $('sSens').value = s.sens; $('sVol').value = s.vol; $('sBright').value = s.bright;
    $('sShake').checked = s.shake; $('sStrong').checked = s.strong; $('sQual').value = s.quality;
    UI.open('settings');
  }
  function bindSettings() {
    const s = Game.settings;
    $('sSens').oninput = e => { s.sens = +e.target.value; Game.applySettings(); };
    $('sVol').oninput = e => { s.vol = +e.target.value; Game.applySettings(); };
    $('sBright').oninput = e => { s.bright = +e.target.value; Game.applySettings(); };
    $('sShake').onchange = e => { s.shake = e.target.checked; Game.applySettings(); };
    $('sStrong').onchange = e => { s.strong = e.target.checked; Game.applySettings(); };
    $('sQual').onchange = e => { s.quality = e.target.value; Game.applySettings(); $('qualNote').textContent = '페이지를 새로 고치면 적용돼요.'; };
    $('sBack').onclick = () => { UI.hide('settings'); if (settingsBack === 'pause') UI.open('pause'); };
  }

  function renderRecords() {
    const got = Game.endings();
    $('recList').innerHTML = ['free', 'tear', 'stay'].map(k => {
      const E = Story.ENDINGS[k];
      const on = got.includes(k);
      return `<li class="${on ? 'on' : ''}"><span>엔딩 ${E.no}</span><b>${on ? E.title : '？？？'}</b><small>${on ? E.sub : '아직 보지 못한 결말'}</small></li>`;
    }).join('');
  }

  window.addEventListener('DOMContentLoaded', () => {
    bind();
    bindSettings();
    Sound.setVolume(Game.settings.vol);
    boot();
  });

  return M;
})();
