'use strict';
// 동의와 로그인 (구글 계정 / 게스트)
// 서버가 없는 게임이라, 로그인 정보는 이 브라우저에만 저장하고 어디에도 보내지 않는다.

const Auth = (() => {
  const A = { user: null };
  const USER_KEY = 'seventh_user', CONSENT_KEY = 'seventh_consent_v1';
  const get = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const set = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 저장 불가 */ } };

  A.consent = () => get(CONSENT_KEY);
  A.saveConsent = opt => set(CONSENT_KEY, Object.assign({ at: Date.now() }, opt));
  A.load = () => { const u = get(USER_KEY); if (u && u.id) A.user = u; return A.user; };

  function remember(u) {
    A.user = u;
    const c = A.consent() || {};
    if (c.remember !== false) set(USER_KEY, u);
  }

  // 구글이 준 신분증(JWT)의 가운데 부분만 읽는다 (한글 이름도 깨지지 않게)
  function decodeJwt(token) {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(part + '==='.slice((part.length + 3) % 4));
    const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  A.googleReady = () => !!(window.CONFIG && CONFIG.GOOGLE_CLIENT_ID) && location.protocol !== 'file:';
  A.whyNoGoogle = () => {
    if (location.protocol === 'file:') return '파일로 열면 구글 로그인을 쓸 수 없어요. GitHub Pages 주소로 열어 주세요.';
    if (!(window.CONFIG && CONFIG.GOOGLE_CLIENT_ID)) return '아직 구글 로그인이 설정되지 않았어요 (js/config.js).';
    return '';
  };

  A.initGoogle = (el, onLogin, onFail) => {
    if (!A.googleReady()) { onFail && onFail(A.whyNoGoogle()); return; }
    const start = () => {
      try {
        google.accounts.id.initialize({
          client_id: CONFIG.GOOGLE_CLIENT_ID,
          callback: resp => {
            try {
              const p = decodeJwt(resp.credential);
              const u = { id: 'g_' + p.sub, name: p.name || '이름 없음', short: p.given_name || p.name || '학생', picture: p.picture || '', provider: 'google' };
              remember(u);
              onLogin(u);
            } catch (e) { onFail && onFail('로그인 정보를 읽지 못했어요. 다시 시도해 주세요.'); }
          },
          ux_mode: 'popup',
          auto_select: false,
          cancel_on_tap_outside: true,
        });
        google.accounts.id.renderButton(el, { theme: 'filled_black', size: 'large', shape: 'pill', text: 'signin_with', locale: 'ko', width: 280 });
      } catch (e) { onFail && onFail('구글 로그인을 불러오지 못했어요.'); }
    };
    if (window.google && google.accounts && google.accounts.id) return start();
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true; s.defer = true;
    s.onload = start;
    s.onerror = () => onFail && onFail('구글 서버에 연결하지 못했어요. 인터넷 연결을 확인해 주세요.');
    document.head.appendChild(s);
  };

  A.guest = name => {
    const n = (name || '').trim().slice(0, 10) || '학생';
    const u = { id: 'guest_' + encodeURIComponent(n), name: n, short: n, picture: '', provider: 'guest' };
    remember(u);
    return u;
  };

  A.logout = () => {
    try { if (window.google && google.accounts && google.accounts.id) google.accounts.id.disableAutoSelect(); } catch (e) { /* 없음 */ }
    A.user = null;
    try { localStorage.removeItem(USER_KEY); } catch (e) { /* 없음 */ }
  };

  return A;
})();
