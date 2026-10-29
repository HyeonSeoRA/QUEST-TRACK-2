'use strict';
// 실사풍 그림: 픽셀 하나하나 빛과 그림자를 계산해서 얼굴과 메뉴 배경을 그린다.
// 사진 파일은 하나도 쓰지 않는다.

const Real = (() => {
  const faces = [], faceRed = [], faceCyan = [], faceSmall = [];
  const grain = [];

  const FACE_TYPES = [
    // 0: 긴 머리 창백한 여자 — 하얗게 흐린 눈, 벌어진 입, 처진 눈꺼풀과 속눈썹
    { eyeX: 0.2, eyeY: -0.07, eyeRX: 0.078, eyeRY: 0.05, sock: 0.32, mouthY: 0.43, mouthW: 0.11, mouthH: 0.21,
      hair: 'long', eyes: 'milky', lid: -0.45, lash: true, age: 0.45, jawPow: 1.7, grin: false, tears: false, skin: [0.80, 0.82, 0.79], seed: 11 },
    // 1: 텅 빈 눈의 아이 — 검은 구멍 같은 눈, 흘러내리는 검은 눈물, 짧게 깎은 머리, 시반
    { eyeX: 0.21, eyeY: -0.04, eyeRX: 0.095, eyeRY: 0.08, sock: 0.48, mouthY: 0.4, mouthW: 0.085, mouthH: 0.13,
      hair: 'buzz', eyes: 'void', age: 0.08, jawPow: 1.3, livor: true, grin: false, tears: true, skin: [0.70, 0.69, 0.67], seed: 23 },
    // 2: 귀까지 찢어진 웃음 — 동그랗게 뜬 눈, 작은 눈동자, 기름진 몇 가닥 머리, 깊은 주름
    { eyeX: 0.23, eyeY: -0.09, eyeRX: 0.085, eyeRY: 0.07, sock: 0.26, mouthY: 0.33, mouthW: 0.43, mouthH: 0.085,
      hair: 'thin', eyes: 'stare', lid: -1.05, age: 0.95, jawPow: 2.4, grin: true, tears: false, skin: [0.74, 0.66, 0.6], seed: 37, blood: true },
    // 3: 입이 꿰매진 얼굴 — 움푹 꺼진 눈구멍 속 바늘구멍 같은 빛, 뺨과 정수리를 가로지른 꿰맨 상처
    { eyeX: 0.21, eyeY: -0.06, eyeRX: 0.088, eyeRY: 0.064, sock: 0.42, mouthY: 0.4, mouthW: 0.17, mouthH: 0.02,
      hair: 'scalp', eyes: 'glow', age: 0.7, jawPow: 2, livor: true, grin: false, tears: false, sewn: true, skin: [0.64, 0.6, 0.58], seed: 53, blood: true },
  ];

  const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const G2 = (a, b, sa, sb) => Math.exp(-(a * a / sa + b * b / sb));
  // 선분까지의 거리와 선분 위 위치(0~1)
  const seg = (u, v, ax, ay, bx, by) => {
    const vx = bx - ax, vy = by - ay, t = U.clamp(((u - ax) * vx + (v - ay) * vy) / (vx * vx + vy * vy), 0, 1);
    return [Math.hypot(u - ax - vx * t, v - ay - vy * t), t];
  };

  function renderFace(type, S) {
    const P = FACE_TYPES[type], sd = P.seed, age = P.age || 0.4;
    const N = S * S;
    // M: 0 배경, 1 피부, 2 눈, 3 입, 4 목, 5 옷
    const Hm = new Float32Array(N), M = new Uint8Array(N);
    const SOCK = new Float32Array(N), MD = new Float32Array(N), CR = new Float32Array(N), ED = new Float32Array(N);

    // 머리 윤곽: 둥근 두개골, 살짝 들어간 관자놀이, 튀어나온 광대, 각진 턱에서 좁아지는 턱끝
    const halfW = v => {
      const top = Math.min(0, v + 0.22) / 0.72;
      const crown = Math.sqrt(Math.max(0, 1 - top * top));
      const t = Math.max(0, (v - 0.12) / 0.7);
      const jaw = t >= 1 ? 0 : U.lerp(1, 0.24, t ** P.jawPow) * Math.sqrt(1 - t ** 6);
      return (0.5 - 0.028 * Math.exp(-((v + 0.2) ** 2) / 0.008) + 0.032 * Math.exp(-((v - 0.05) ** 2) / 0.012)) * crown * jaw;
    };
    const mouthAt = (u, v) => {
      if (P.grin) {
        if (Math.abs(u) > P.mouthW) return 9;
        const vc = P.mouthY - 0.5 * u * u;
        const th = P.mouthH * Math.sqrt(Math.max(0, 1 - (u / P.mouthW) ** 2)) + 0.006;
        return Math.abs(v - vc) / th;
      }
      const jit = (U.noise(u * 20, v * 20, sd + 4) - 0.5) * 0.25;
      return Math.sqrt((u / P.mouthW) ** 2 + ((v - P.mouthY) / P.mouthH) ** 2) + jit;
    };
    const mouthTop = P.grin ? P.mouthY - 0.04 : P.mouthY - P.mouthH;
    const mouthBot = P.grin ? P.mouthY + 0.05 : P.mouthY + P.mouthH;
    const longHair = P.hair === 'long';
    // 느리게 변하는 무늬는 절반 해상도로 미리 계산해 두고 보간해서 쓴다 (불러오기 시간 절약)
    const CS = (S >> 1) + 2;
    const coarse = fn => {
      const A = new Float32Array(CS * CS);
      for (let y = 0; y < CS; y++) for (let x = 0; x < CS; x++) A[y * CS + x] = fn((x * 2 / S) * 2 - 1, (y * 2 / S) * 2 - 1);
      return A;
    };
    const at = (A, x, y) => {
      const fx = x / 2, fy = y / 2, x0 = fx | 0, y0 = fy | 0, tx = fx - x0, ty = fy - y0, k = y0 * CS + x0;
      return (A[k] * (1 - tx) + A[k + 1] * tx) * (1 - ty) + (A[k + CS] * (1 - tx) + A[k + CS + 1] * tx) * ty;
    };
    const fBump = coarse((u, v) => U.fbm(u * 5, v * 5, 3, sd));
    const fAlb = coarse((u, v) => U.fbm(u * 5, v * 5, 4, sd + 5));
    const fSpot = coarse((u, v) => U.fbm(u * 10, v * 10, 3, sd + 3));
    const fRidge = coarse((u, v) => U.fbm(u * 6, v * 6, 4, sd + 9));
    const fOil = coarse((u, v) => U.fbm(u * 7, v * 7, 2, sd + 80));
    const fLiv = P.livor ? coarse((u, v) => U.fbm(u * 4, v * 4, 3, sd + 60)) : null;
    const fBg = coarse((u, v) => U.fbm(u * 3, v * 3, 3, sd + 50));

    // 1) 높이(입체) 지도
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const i = y * S + x, u = (x / S) * 2 - 1, v = (y / S) * 2 - 1;
        const hw = halfW(v), dd = hw > 0 ? Math.abs(u) / hw : 9;
        const vv = (v + 0.06) / 0.88;
        if (dd >= 1) {
          // 얼굴 밖: 목, 어깨(옷), 귀
          const neckW = 0.3 + 0.05 * U.smooth(0.6, 1, v);
          const shW = v > 0.8 ? 0.26 + (v - 0.8) ** 0.7 * 1.6 : 0;
          const inNeck = v > 0.3 && Math.abs(u) < neckW;
          const collar = 0.95 - 0.12 * (1 - (u / 0.3) ** 2);
          if (Math.abs(u) < shW && !(inNeck && v < collar)) {
            const nd = Math.abs(u) / shW;
            Hm[i] = 0.28 * Math.sqrt(1 - nd * nd) + (U.fbm(u * 7, v * 4, 3, sd + 90) - 0.5) * 0.05;
            M[i] = 5; ED[i] = nd;
          } else if (inNeck) {
            const nd = Math.abs(u) / neckW;
            let h = 0.4 * Math.sqrt(1 - nd * nd);
            for (const s of [-1, 1]) {
              // 귀 뒤에서 쇄골로 내려오는 목 근육
              const [d] = seg(u, v, s * 0.24, 0.42, s * 0.06, 1.0);
              h += 0.03 * Math.exp(-(d * d) / 0.0012);
            }
            h += (U.fbm(u * 6, v * 6, 3, sd) - 0.5) * 0.01;
            Hm[i] = h; M[i] = 4; ED[i] = nd;
          } else if (!longHair) {
            for (const s of [-1, 1]) {
              const ecx = s * (halfW(0.04) + 0.012);
              const ex = (u - ecx) / 0.06, ey = (v - 0.05) / 0.13;
              const r = ex * ex + ey * ey;
              if (r < 1 && u * s > 0) {
                Hm[i] = 0.16 * Math.sqrt(1 - r) - 0.07 * Math.exp(-r / 0.25) + 0.02 * Math.exp(-((r - 0.6) ** 2) / 0.01);
                M[i] = 1; ED[i] = 0.9 + r * 0.1;
              }
            }
          }
          continue;
        }
        let h = 0.9 * Math.pow(1 - dd * dd, 0.42) * Math.sqrt(Math.max(0, 1 - vv ** 4));
        let sock = 0, cr = 0;
        for (const s of [-1, 1]) {
          const ex = u - s * P.eyeX, ey = v - P.eyeY;
          sock += Math.exp(-((ex / (P.eyeRX * 1.7)) ** 2 + (ey / (P.eyeRY * 2.2)) ** 2));
          h += 0.05 * G2(u - s * 0.3, v - 0.08, 0.01, 0.006); // 광대뼈
          h -= 0.07 * G2(u - s * 0.27, v - 0.3, 0.012, 0.012); // 꺼진 볼
          h -= 0.05 * G2(u - s * 0.035, v - 0.225, 0.0005, 0.0006); // 콧구멍
          h += 0.03 * G2(u - s * 0.062, v - 0.205, 0.0011, 0.0011); // 콧방울
          // 인중의 두 기둥
          h += 0.004 * Math.exp(-((u - s * 0.02) ** 2) / 0.00012) * U.smooth(0.24, 0.27, v) * (1 - U.smooth(mouthTop - 0.03, mouthTop, v));
          // 팔자주름
          const bx = s * Math.min(0.3, P.mouthW + 0.06), by = P.mouthY + 0.07;
          const [dn, tn] = seg(u, v, s * 0.08, 0.19, bx, by);
          const dnb = dn - 0.02 * Math.sin(Math.PI * tn);
          const fold = Math.exp(-(dnb * dnb) / 0.00014) * age;
          h -= 0.02 * fold; cr += fold * 0.5;
          h += 0.006 * Math.exp(-((dnb + 0.03) ** 2) / 0.0015) * age * (1 - tn * 0.5); // 볼살
          // 눈 밑 주름과 처진 살
          const ux = u - s * P.eyeX, fadeX = U.smooth(P.eyeRX * 1.6, P.eyeRX * 0.6, Math.abs(ux));
          const bagY = P.eyeY + P.eyeRY * 1.95 + 1.2 * ux * ux, db = v - bagY;
          const bag = Math.exp(-(db * db) / 0.00006) * fadeX * (0.2 + age);
          h -= 0.012 * bag; cr += bag * 0.4;
          h += 0.012 * Math.exp(-((db + 0.022) ** 2) / 0.0003) * fadeX * age;
          // 눈꼬리 잔주름
          if (age > 0.3) {
            const ox = (u - s * (P.eyeX + P.eyeRX * 1.25)) * s, oy = v - P.eyeY;
            if (ox > 0 && ox < 0.1) {
              const ang = Math.atan2(oy, ox), r = Math.hypot(ox, oy);
              for (const a0 of [-0.55, -0.1, 0.35]) {
                const dl = Math.abs(ang - a0 - 0.15 * Math.sin(r * 40)) * r;
                const c = Math.exp(-(dl * dl) / 0.000012) * (1 - r / 0.1) * (age - 0.3);
                h -= 0.006 * c; cr += c * 0.5;
              }
            }
          }
          // 미간 주름
          if (age > 0.5) {
            const c = Math.exp(-((u - s * 0.032) ** 2) / 0.00003) * U.smooth(-0.33, -0.27, v) * (1 - U.smooth(-0.2, -0.15, v)) * (age - 0.5) * 2;
            h -= 0.007 * c; cr += c * 0.5;
          }
        }
        // 이마 주름 세 줄
        for (let k = 0; k < 3; k++) {
          const ly = -0.53 + k * 0.075 + 0.014 * Math.sin(u * 8 + k * 2) + 0.03 * u * u;
          const c = Math.exp(-((v - ly) ** 2) / 0.00004) * U.smooth(0.34, 0.08, Math.abs(u)) * (0.4 + 0.6 * U.noise(u * 7, k, sd + 15)) * age;
          h -= 0.007 * c; cr += c * 0.45;
        }
        sock = Math.min(1, sock);
        SOCK[i] = sock;
        h -= P.sock * sock;
        h += 0.06 * Math.exp(-((v - (P.eyeY - 0.11)) ** 2) / 0.003) * Math.exp(-(u * u) / 0.12); // 눈썹뼈
        h += 0.11 * Math.exp(-(u * u) / 0.0018) * U.smooth(-0.12, 0.06, v) * (1 - U.smooth(0.18, 0.25, v)); // 콧등
        h += 0.06 * Math.exp(-(u * u + (v - 0.2) ** 2) / 0.004); // 코끝
        const md = mouthAt(u, v);
        MD[i] = md;
        h -= 0.2 * U.smooth(1.08, 0.45, md);
        h += 0.02 * Math.exp(-((md - 1.15) ** 2) / 0.02); // 입술 둘레
        // 아랫입술 밑 홈과 툭 튀어나온 턱끝
        const ml = mouthBot + 0.1;
        h -= 0.012 * Math.exp(-((v - ml) ** 2) / 0.0006 - (u * u) / 0.02);
        h += 0.03 * G2(u, v - 0.64, 0.015, 0.006);
        // 살갗: 큰 굴곡은 부드럽게, 잔 결과 모공은 아주 얕게
        h += (at(fBump, x, y) - 0.5) * 0.014;
        h += (U.noise(u * 26, v * 26, sd + 1) - 0.5) * 0.005 * (0.5 + age);
        h += (U.noise(u * 150, v * 150, sd + 2) - 0.5) * 0.001;
        Hm[i] = h;
        CR[i] = Math.min(1, cr);
        ED[i] = Math.max(dd, Math.abs(vv) ** 3);
        M[i] = 1;
        for (const s of [-1, 1]) {
          const ex = (u - s * P.eyeX) / P.eyeRX, ey = (v - P.eyeY) / P.eyeRY;
          const edge = 1 + (U.noise(u * 30, v * 30, sd + 8) - 0.5) * 0.2;
          if (ex * ex + ey * ey < edge * (P.eyes === 'void' || P.eyes === 'glow' ? 1.7 : 1)) M[i] = 2;
        }
        if (md < 1) M[i] = 3;
      }
    }

    // 2) 빛 계산
    const c = U.canvas(S, S), cx = c.getContext('2d');
    const img = cx.createImageData(S, S), D = img.data;
    const L1 = [-0.25, 0.72, 0.62], L2 = [0.45, -0.6, 0.66];
    const n1 = Math.hypot(...L1), n2 = Math.hypot(...L2);
    L1.forEach((_, k) => (L1[k] /= n1)); L2.forEach((_, k) => (L2[k] /= n2));
    const hx = L1[0], hy = L1[1], hz = L1[2] + 1, hn = Math.hypot(hx, hy, hz);

    // 기름진 몇 가닥 머리카락 (얼굴 위로 늘어진다)
    const strands = [];
    if (P.hair === 'thin') {
      for (let k = 0; k < 16; k++) {
        const x0 = (U.hash(k, 1, sd) - 0.5) * 0.8;
        strands.push({ x0, drift: (U.hash(k, 2, sd) - 0.5) * 0.35 + x0 * 0.4, end: -0.55 + U.hash(k, 3, sd) * (Math.abs(x0) > 0.25 ? 1.1 : 0.75), w: 0.004 + U.hash(k, 4, sd) * 0.004, ph: k * 1.7 });
      }
    }

    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const i = y * S + x, u = (x / S) * 2 - 1, v = (y / S) * 2 - 1;
        let col;
        const hl = Hm[y * S + Math.max(0, x - 1)], hr = Hm[y * S + Math.min(S - 1, x + 1)];
        const hu = Hm[Math.max(0, y - 1) * S + x], hd = Hm[Math.min(S - 1, y + 1) * S + x];
        let nx = -(hr - hl) * S / 4, ny = -(hd - hu) * S / 4, nz = 1;
        const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
        const ndl = nx * L1[0] + ny * L1[1] + nz * L1[2];
        const d1 = Math.max(0, ndl);
        const d2 = Math.max(0, nx * L2[0] + ny * L2[1] + nz * L2[2]);
        // 빛과 그림자의 경계에 살 속 피가 비쳐 붉어진다
        const sss = Math.max(0, (ndl + 0.4) / 1.4) - d1 * 0.85;
        const hdot = Math.max(0, (nx * hx + ny * hy + nz * hz) / hn);
        const fall = 0.12 + 0.88 * U.smooth(-0.85, 0.45, v);

        // 배경: 탁한 어둠
        const bgN = at(fBg, x, y);
        const bg = [0.012 + bgN * 0.02, 0.014 + bgN * 0.022, 0.016 + bgN * 0.024];
        const m = M[i], dd = ED[i];

        if (m === 0) col = bg;
        else if (m === 5) {
          // 낡고 젖은 천
          const fold = U.fbm(u * 9 + v * 2, v * 3, 3, sd + 91);
          const alb = [0.11, 0.1, 0.1].map(cv => cv * (0.6 + fold * 0.6));
          const lit = 0.02 + d1 * 0.7 * fall + d2 * 0.05;
          col = alb.map(cv => cv * lit + Math.pow(hdot, 10) * 0.02 * fall);
          col = mix3(col, bg, U.smooth(0.85, 1, dd) * 0.8);
          col = col.map(cv => cv * (0.45 + 0.55 * U.smooth(1.05, 0.8, v)));
        } else {
          // 피부 바탕색: 큰 얼룩 + 잔 모공
          let alb = P.skin.map(cv => cv * (0.88 + at(fAlb, x, y) * 0.17 + (U.hash(x, y, sd + 7) - 0.5) * 0.035));
          const spots = U.smooth(0.64, 0.74, at(fSpot, x, y));
          alb = mix3(alb, [0.45, 0.38, 0.33], spots * 0.22);
          const ridge = 1 - Math.abs(at(fRidge, x, y) * 2 - 1);
          const temple = 0.25 + 0.75 * U.smooth(0.18, 0.42, Math.abs(u)) + 0.5 * Math.exp(-((v + 0.5) ** 2) / 0.05) + (m === 4 ? 0.6 : 0);
          alb = mix3(alb, [0.3, 0.27, 0.42], U.smooth(0.94, 0.985, ridge) * 0.42 * Math.min(1, temple)); // 핏줄
          alb = mix3(alb, [0.24, 0.16, 0.22], SOCK[i] * 0.8); // 눈가 멍
          if (P.livor) {
            // 시반: 아래쪽부터 번지는 보랏빛 얼룩
            const lv = U.smooth(0.48, 0.72, at(fLiv, x, y)) * U.smooth(-0.1, 0.7, v);
            alb = mix3(alb, [0.38, 0.27, 0.42], lv * 0.45);
          }
          if (m !== 4 && MD[i] >= 1 && MD[i] < 1.35) {
            // 입술: 핏기 없이 푸르스름하고 갈라졌다
            const crack = U.smooth(0.82, 0.95, 1 - Math.abs(U.noise(u * 90, v * 9, sd + 17) * 2 - 1));
            alb = mix3(alb, mix3([0.32, 0.14, 0.17], [0.26, 0.2, 0.28], P.livor ? 0.6 : 0.25), (1.35 - MD[i]) / 0.35 * 0.75);
            alb = mix3(alb, [0.1, 0.03, 0.04], crack * 0.5 * (1.35 - MD[i]) / 0.35);
          }
          if (P.hair === 'buzz' || P.hair === 'scalp') {
            // 짧게 깎은 머리: 두피 위 짧은 털이 점점이 보인다
            const hl0 = -0.5 + 0.42 * u * u + (U.noise(u * 30, 0, sd) - 0.5) * 0.03;
            const side = U.smooth(0.36, 0.44, Math.abs(u)) * U.smooth(0.05, -0.1, v);
            const a = Math.max(U.smooth(hl0 + 0.02, hl0 - 0.04, v), side) * (m === 1 ? 1 : 0);
            const dots = U.hash(x, y, sd + 33) < 0.5 ? 1 : 0.3;
            alb = mix3(alb, [0.05, 0.045, 0.045], a * (P.hair === 'buzz' ? 0.85 : 0.35) * dots);
          }
          if (m === 1 && dd > 0.88 && !longHair && Math.abs(v - 0.05) < 0.15 && Math.abs(u) > 0.4) alb = mix3(alb, [0.6, 0.3, 0.3], 0.2); // 귀는 얇아 붉다
          const cr = CR[i];
          alb = alb.map(cv => cv * (1 - cr * 0.35));
          let ao = (1 - 0.9 * SOCK[i] ** 1.3) * (0.25 + 0.75 * (1 - U.smooth(0.6, 1.0, dd))) * (1 - cr * 0.55);
          ao *= 1 - 0.5 * Math.exp(-((MD[i] - 1) ** 2) / 0.01) * (MD[i] > 1 && m !== 4 ? 1 : 0);
          if (m === 4) ao *= 0.35 + 0.35 * U.smooth(0.7, 0.95, v); // 턱 그늘 아래의 목
          // 피지와 땀: 이마, 콧등, 광대가 젖은 듯 번들거린다
          const tz = Math.exp(-(u * u) / 0.01) * U.smooth(0.3, -0.2, v) + Math.exp(-(u * u) / 0.06) * U.smooth(-0.3, -0.5, v) + 0.6 * Math.exp(-((Math.abs(u) - 0.3) ** 2) / 0.006 - ((v - 0.08) ** 2) / 0.006);
          const oil = (0.4 + 0.6 * at(fOil, x, y)) * (0.55 + 0.7 * Math.min(1, tz)) * (0.55 + 0.45 * U.hash(x >> 1, y >> 1, sd + 81));
          const lipM = m !== 4 && MD[i] < 1.4 ? 0.75 : 0;
          const spec = (Math.pow(hdot, 70) * 0.34 + Math.pow(hdot, 14) * 0.05) * oil * (1 - lipM);
          const lightAmt = 0.03 + d1 * 1.08 * ao * fall + d2 * 0.12 * ao;
          const sc = sss * ao * fall * 0.45;
          col = [
            alb[0] * lightAmt + alb[0] * 0.03 * fall + sc * 0.5 + spec * ao * fall,
            alb[1] * lightAmt + sc * 0.06 + spec * ao * fall,
            alb[2] * (lightAmt + d2 * 0.05) + sc * 0.05 + spec * 1.08 * ao * fall,
          ];

          if (m === 2) {
            // 눈
            let ex = 0, ey = 0;
            for (const s of [-1, 1]) {
              const a = (u - s * P.eyeX) / P.eyeRX, b = (v - P.eyeY) / P.eyeRY;
              if (a * a + b * b < 2.2) { ex = a; ey = b; }
            }
            const r2 = ex * ex + ey * ey, ball = Math.sqrt(Math.max(0, 1 - Math.min(1, r2)));
            const fallE = 0.3 + 0.7 * U.smooth(-0.85, 0.45, v);
            if (P.eyes === 'void') {
              // 눈알이 없는 깊은 구멍, 안쪽 벽에 젖은 살이 희미하게 비친다
              const g = Math.exp(-(((ex + 0.3) ** 2) + ((ey + 0.35) ** 2)) / 0.01) * U.smooth(1, 0.3, r2);
              const wall = U.smooth(0.55, 1.4, r2) * (1 - U.smooth(1.4, 1.7, r2));
              col = mix3(col, [0.003, 0.002, 0.003], U.smooth(1.7, 0.55, r2)).map(cv => cv + g * 0.3);
              col = [col[0] + wall * 0.03 * (0.3 + d1), col[1] + wall * 0.004, col[2] + wall * 0.006];
            } else if (P.eyes === 'glow') {
              // 깊은 구멍 속에서 바늘구멍만 한 눈동자가 빛난다
              const ir = Math.hypot(ex * P.eyeRX, ey * P.eyeRY);
              col = mix3(col, [0.002, 0.001, 0.001], U.smooth(1.7, 0.5, r2));
              const halo = Math.exp(-(ir * ir) / 0.0009);
              col = [col[0] + halo * 0.55, col[1] + halo * 0.4, col[2] + halo * 0.32];
              if (ir < 0.011) col = [1, 0.93, 0.82];
            } else {
              const skinCol = col;
              const vein = U.smooth(0.88, 0.97, 1 - Math.abs(U.fbm(u * 40, v * 40, 3, sd + 30) * 2 - 1)) * U.smooth(0.15, 0.8, r2);
              let e = P.eyes === 'milky' ? [0.66, 0.69, 0.66] : [0.72, 0.68, 0.62];
              e = mix3(e, [0.55, 0.05, 0.05], vein * (P.eyes === 'stare' ? 0.9 : 0.6));
              if (P.eyes === 'stare') e = mix3(e, [0.5, 0.1, 0.08], U.smooth(0.55, 1, r2) * 0.7);
              const ir = Math.hypot(ex * P.eyeRX, ey * P.eyeRY);
              const ang = Math.atan2(ey, ex);
              if (P.eyes === 'milky') {
                // 백내장처럼 뿌옇게 흐린 눈동자
                const cloud = U.fbm(ang * 3, ir * 120, 3, sd + 31);
                if (ir < 0.036) e = mix3(e, [0.6, 0.63, 0.63], (0.45 + cloud * 0.35) * U.smooth(0.036, 0.028, ir));
                if (ir < 0.013) e = mix3(e, [0.34, 0.36, 0.36], U.smooth(0.013, 0.008, ir));
              } else {
                // 홍채 결이 방사형으로 갈라진 작은 눈동자
                const fib = U.noise(ang * 9, ir * 160, sd + 32);
                if (ir < 0.029) e = mix3([0.2, 0.11, 0.06], [0.09, 0.05, 0.03], fib * 0.8 + U.smooth(0.02, 0.029, ir) * 0.5);
                if (ir < 0.011) e = [0.01, 0.01, 0.01];
              }
              // 위 눈꺼풀이 눈알을 덮고, 그 아래 그림자가 진다
              const lidY = P.lid + 0.3 * ex * ex + (U.noise(ex * 3, 0, sd + 34) - 0.5) * 0.08;
              const lidSh = U.smooth(lidY, lidY + 0.55, ey);
              const sh = (0.18 + 0.82 * ball) * (0.15 + 0.85 * lidSh) * fallE;
              col = e.map(cv => cv * sh);
              const glint = Math.exp(-(((ex + 0.3) ** 2) + ((ey + 0.25) ** 2)) / 0.006) * lidSh;
              const glint2 = Math.exp(-(((ex - 0.35) ** 2) + ((ey - 0.4) ** 2)) / 0.003) * 0.4;
              col = col.map(cv => cv + (glint * 0.55 + glint2 * 0.2) * fallE);
              // 아래 눈꺼풀 가장자리는 젖어 붉다
              col = mix3(col, [0.32 * fallE, 0.08 * fallE, 0.08 * fallE], U.smooth(0.6, 0.95, r2) * (ey > 0 ? 0.75 : 0.4));
              if (ey < lidY) {
                // 눈꺼풀 살
                const lidCol = skinCol.map(cv => cv * (0.75 + 0.25 * U.smooth(lidY - 0.6, lidY, ey)));
                col = mix3(col, lidCol, U.smooth(lidY + 0.02, lidY - 0.06, ey));
              }
              // 눈꺼풀 테두리와 속눈썹
              const rimD = Math.abs(ey - lidY);
              col = col.map(cv => cv * (1 - 0.6 * Math.exp(-(rimD * rimD) / 0.004)));
              if (P.lash && ey < lidY + 0.05 && ey > lidY - 0.45) {
                const lx = ex * 9 + (ey - lidY) * (ex * 1.6) + U.noise(ex * 4, 1, sd + 35) * 1.5;
                const lashA = U.smooth(0.25, 0.05, Math.abs((lx % 1 + 1) % 1 - 0.5)) * U.smooth(lidY - 0.45, lidY - 0.1, ey) * U.smooth(1.05, 0.7, Math.abs(ex));
                col = mix3(col, [0.01, 0.01, 0.012], lashA * 0.9);
              }
              col = mix3(col, skinCol, U.smooth(0.85, 1.05, r2));
            }
          } else if (m === 3) {
            // 입 속: 목구멍은 끝없이 검고, 혀와 잇몸이 희미하게 젖어 빛난다
            const md = MD[i];
            const skinCol = col;
            col = mix3([0.006, 0.0, 0.0], [0.13, 0.025, 0.03], U.smooth(0.5, 1, md) * (0.4 + d1 * 0.6));
            if (P.grin) {
              const vc = P.mouthY - 0.5 * u * u, side = v < vc ? -1 : 1;
              const tooth = (u * 34 + U.noise(u * 10, side, sd) * 1.6) % 1;
              const gap = Math.abs(v - vc) < 0.008;
              if (!gap && md > 0.12 && md < 0.82 && Math.abs(tooth) > 0.13) {
                const ti = Math.floor(u * 34), stain = U.hash(ti, side + 7, sd);
                const tc = mix3([0.62, 0.57, 0.44], [0.32, 0.24, 0.14], stain * 0.8).map(cv => cv * (0.75 + U.hash(ti, side, sd) * 0.35));
                const round = 1 - Math.abs(tooth - 0.56) * 1.2;
                const tspec = Math.pow(Math.max(0, round), 6) * 0.12 * (0.3 + d1);
                col = tc.map(cv => cv * (0.15 + 0.85 * (1 - md)) * (0.35 + d1 * 0.6) * (0.55 + 0.45 * round) + tspec);
              } else if (md >= 0.82) col = [0.26, 0.05, 0.06].map(cv => cv * (0.35 + d1 * 0.5));
            } else {
              const my = (v - P.mouthY) / P.mouthH;
              if (my > 0.25 && md > 0.35) {
                // 혀
                const tg = U.smooth(0.25, 0.7, my) * U.smooth(0.35, 0.75, md);
                const tc = [0.2, 0.06, 0.07].map(cv => cv * (0.4 + d1 * 0.8) * (0.8 + U.noise(u * 60, v * 60, sd + 18) * 0.4));
                col = mix3(col, tc, tg * 0.85);
              }
              if (my < -0.55 && md > 0.55) {
                const tooth = ((u / P.mouthW + 1) * 4.5) % 1;
                const miss = U.hash(Math.floor((u / P.mouthW + 1) * 4.5), 3, sd) < 0.3;
                const len = -0.55 - U.hash(Math.floor((u / P.mouthW + 1) * 4.5), 4, sd) * 0.3;
                if (tooth > 0.2 && !miss && my < len + 0.1) col = [0.48, 0.43, 0.32].map(cv => cv * (0.25 + d1 * 0.45) * (1.2 - md * 0.5));
              }
              // 입 가장자리에 걸린 끈적한 침
              for (let k = 0; k < 2; k++) {
                const su = (U.hash(k, 9, sd) - 0.5) * P.mouthW * 1.2;
                if (Math.abs(u - su - 0.004 * Math.sin(v * 80)) < 0.004 && md > 0.3) col = col.map(cv => cv * 0.6 + 0.05 * (0.3 + d1));
              }
            }
            col = mix3(col, skinCol, U.smooth(0.85, 1.0, md));
          }

          if (P.tears) {
            for (const s of [-1, 1]) {
              const sm = Math.exp(-(((u - s * P.eyeX) ** 2) / 0.006 + (Math.max(0, v - P.eyeY) ** 2) / 0.02)) * U.smooth(1.0, 1.6, (((u - s * P.eyeX) / P.eyeRX) ** 2 + ((v - P.eyeY) / P.eyeRY) ** 2));
              col = mix3(col, [0.02, 0.015, 0.02], sm * 0.55);
              // 검은 눈물: 눈 밑으로 번지며 흘러내린다
              for (let k = 0; k < 2; k++) {
                const len = 0.25 + U.hash(s + 5, k, sd) * 0.45;
                const off = (k - 1) * 0.035 + (U.hash(s, k, sd) - 0.5) * 0.02;
                const tu = u - s * P.eyeX - off + 0.014 * Math.sin(v * 14 + s * 2 + k * 3) + (U.noise(v * 6, k + s * 3, sd) - 0.5) * 0.03, tv = v - P.eyeY - P.eyeRY * 0.9;
                const w = (0.014 + U.noise(v * 8, s + k, sd + 12) * 0.012) * (k === 1 ? 1 : 0.7);
                const along = tv / len;
                if (tv > -0.03 && along < 1) {
                  const wd = w * (1 - along * 0.55) + (along > 0.9 ? 0.006 : 0);
                  const a = U.smooth(wd, wd * 0.3, Math.abs(tu)) * (1 - U.smooth(0.3, 1, along) * 0.75) * (0.55 + 0.45 * U.noise(v * 30, k, sd + 13));
                  const gl = Math.exp(-((tu + wd * 0.35) ** 2) / (wd * wd * 0.05)) * 0.18 * (0.4 + d1);
                  col = mix3(col, [0.008 + gl, 0.006 + gl, 0.01 + gl * 1.1], a * 0.95);
                }
              }
            }
          }
          if (P.grin) {
            // 찢어진 입꼬리: 벌어진 살과 흐르는 피
            for (const s of [-1, 1]) {
              const cxu = s * P.mouthW * 0.97, cyv = P.mouthY - 0.5 * P.mouthW * P.mouthW;
              const tu = u - cxu, tv = v - cyv;
              const torn = Math.exp(-(tu * tu) / 0.0008 - (tv * tv) / 0.0004);
              col = mix3(col, [0.22 * (0.4 + d1), 0.02, 0.03], torn * 0.7);
              if (tv > 0 && tv < 0.28 && Math.abs(tu + Math.sin(tv * 20) * 0.006) < 0.012 * (1 - tv / 0.3)) col = [0.3 * (0.4 + d1), 0.01, 0.02];
            }
          }
          if (P.sewn) {
            // 입술을 굵은 검은 실로 꿰맸다. 바늘구멍에서는 피가 배어 나온다
            const dm = Math.abs(v - P.mouthY);
            const puff = Math.exp(-((u / (P.mouthW * 1.2)) ** 2 + ((v - P.mouthY) / 0.06) ** 2));
            col = mix3(col, [0.3 * (0.4 + d1), 0.12, 0.16], puff * 0.45);
            for (let st = -4; st <= 4; st++) {
              const su = st * 0.037 + (U.hash(st, 1, sd) - 0.5) * 0.008, tilt = (U.hash(st, 2, sd) - 0.5) * 0.02;
              if (Math.abs(u) > P.mouthW * 1.05) continue;
              // X 자로 엇갈린 굵은 실
              for (const dir of [-1, 1]) {
                const du = Math.abs(u - su - (v - P.mouthY) * (0.35 * dir + tilt));
                if (dm < 0.05 && du < 0.0075) {
                  const th = 0.015 + 0.09 * Math.exp(-(du * du) / 0.000012) * (0.4 + d1);
                  col = [th, th * 0.85, th * 0.8];
                }
              }
              for (const hv of [-0.05, 0.05]) for (const hu2 of [-0.0175, 0.0175]) {
                const hd2 = Math.hypot(u - su - hu2 * (hv > 0 ? 1 : -1), v - P.mouthY - hv);
                if (hd2 < 0.009) col = mix3(col, [0.22 * (0.4 + d1), 0.01, 0.02], 0.9);
              }
              // 바늘구멍 몇 군데에서만 피가 흘러내린다
              if (U.hash(st, 3, sd) < 0.35 && Math.abs(u - su - 0.017) < 0.005 + 0.003 * Math.sin(v * 60) && v > P.mouthY + 0.05 && v < P.mouthY + 0.08 + U.hash(st, 4, sd) * 0.2) {
                col = [0.24 * (0.3 + d1), 0.008, 0.015];
              }
            }
            // 왼쪽 뺨을 가로지른 꿰맨 상처
            const [sd2, tt] = seg(u, v, -0.46, -0.02, -0.2, 0.26);
            if (sd2 < 0.016) col = mix3(col, [0.3 * (0.3 + d1), 0.06, 0.07], U.smooth(0.016, 0.004, sd2));
            if (sd2 < 0.03 && (tt * 9) % 1 < 0.12) col = [0.03, 0.02, 0.02];
          }
          if (P.hair === 'scalp' && m === 1) {
            // 정수리를 가로지르는 꿰맨 수술 자국과 철 스테이플
            const wv = -0.66 + 0.1 * u - 0.05 * Math.sin(u * 5), dw = Math.abs(v - wv);
            if (Math.abs(u) < 0.38) {
              col = mix3(col, [0.2 * (0.3 + d1 + fall), 0.03, 0.04], U.smooth(0.03, 0.006, dw) * 0.8);
              const stp = ((u + 0.4) * 14) % 1;
              if (dw < 0.035 && stp < 0.16) { const g = 0.05 + 0.25 * Math.pow(hdot, 8) * fall + d1 * 0.08 * fall; col = [g, g * 1.02, g * 1.05]; }
            }
          }
          if (P.blood && m === 1) {
            // 한쪽으로 튄 잔 핏방울 (눈과 입 안에는 묻지 않는다)
            const side = U.smooth(-0.1, 0.5, u * 0.8 + v * 0.6);
            const sp = U.noise(u * 55, v * 55, sd + 70) * side;
            if (sp > 0.72) col = mix3(col, [0.17 * (0.35 + d1), 0.01, 0.015], U.smooth(0.72, 0.8, sp) * 0.85);
          }
          // 뒤에서 비추는 차가운 테두리 빛 (얼굴이 어둠에서 떠오른다)
          const overNeck = m !== 4 && v > 0.3 && Math.abs(u) < 0.3 ? U.smooth(0.3, 0.45, v) : 0;
          const rim = U.smooth(0.72, 0.95, dd) * (1 - U.smooth(0.95, 1, dd)) * U.smooth(-0.6, 0.3, -u * 0.6 + v * 0.2 + 0.2) * (1 - overNeck);
          col = [col[0] + rim * 0.05, col[1] + rim * 0.07, col[2] + rim * 0.1];
          // 테두리를 배경에 부드럽게 섞기 (턱 아래는 목과 이어지므로 섞지 않는다)
          col = mix3(col, bg, U.smooth(0.94, 1, dd) * (1 - overNeck * 0.85));
        }

        // 머리카락
        if (longHair) {
          const curtain = 0.36 + 0.08 * (U.fbm(v * 3, 1, 2, sd + 40) - 0.5) + 0.03 * U.smooth(-0.2, 0.9, v);
          const outer = 0.66 + 0.3 * U.smooth(-0.3, 1, v);
          const topLine = -0.5 + 1.1 * u * u - 0.06 * U.noise(u * 9, 0, sd + 41);
          const st = U.fbm(u * 60 + Math.sin(v * 3) * 0.6, v * 1.6, 3, sd + 21);
          const sideA = U.smooth(curtain - 0.015, curtain + 0.035, Math.abs(u) + (st - 0.5) * 0.12);
          const topA = U.smooth(topLine + 0.04, topLine - 0.03, v + (st - 0.5) * 0.05);
          const outA = m === 0 ? 1 : 0;
          const hairA = Math.max(sideA, topA, outA) * U.smooth(outer + 0.02, outer - 0.08, Math.abs(u) + (st - 0.5) * 0.1) * U.smooth(-0.99, -0.86, v);
          if (hairA > 0) {
            // 젖어서 엉킨 가닥: 아래쪽 빛을 조금씩 받아 반짝인다
            const near = Math.exp(-((Math.abs(u) - curtain) ** 2) / 0.02) * U.smooth(-0.6, 0.5, v);
            let hc = 0.008 + (0.05 + 0.22 * near) * U.smooth(0.5, 0.85, st);
            hc *= 0.5 + 0.5 * U.smooth(1, 0.1, v);
            col = mix3(col, [hc * 0.95, hc, hc * 1.12], 0.97 * hairA);
          }
          // 얼굴 앞으로 흘러내린 몇 가닥
          for (let k = 0; k < 5; k++) {
            const sx = (k % 2 ? 1 : -1) * (0.12 + U.hash(k, 5, sd) * 0.2);
            const su = sx + 0.03 * Math.sin(v * 5 + k) + (v + 0.5) * (U.hash(k, 6, sd) - 0.5) * 0.25;
            const endV = -0.1 + U.hash(k, 7, sd) * 0.6;
            if (v > -0.55 && v < endV && Math.abs(u - su) < 0.005) {
              const a = U.smooth(endV, endV - 0.15, v);
              col = mix3(col, [0.01 + 0.05 * d1, 0.01 + 0.05 * d1, 0.012 + 0.06 * d1], a * 0.9);
            }
          }
        }
        if (strands.length && v < 0.6) {
          let a = 0, gl = 0;
          for (const s of strands) {
            if (v > s.end) continue;
            const t = (v + 0.92) / (s.end + 0.92);
            const su = s.x0 + s.drift * t * t + 0.015 * Math.sin(v * 9 + s.ph);
            const du = Math.abs(u - su);
            if (du < s.w * 2) {
              const aa = U.smooth(s.w, s.w * 0.3, du) * U.smooth(s.end, s.end - 0.12, v);
              if (aa > a) { a = aa; gl = Math.exp(-((u - su + s.w * 0.3) ** 2) / (s.w * s.w * 0.15)); }
            }
          }
          if (a > 0) col = mix3(col, [0.02 + gl * 0.12 * fall, 0.02 + gl * 0.11 * fall, 0.02 + gl * 0.09 * fall], a * 0.92);
        }

        // 사진 같은 마무리: 대비, 색감, 비네팅, 입자
        const vg = 1 - 0.7 * U.smooth(0.5, 1.45, Math.hypot(u, v * 0.9));
        const lum = (col[0] + col[1] + col[2]) / 3;
        const gr = (U.hash(x, y, sd + 99) - 0.5) * (0.035 + 0.04 * (1 - Math.min(1, lum * 3)));
        for (let k = 0; k < 3; k++) {
          let cv = U.clamp(col[k] * vg, 0, 1);
          cv = Math.pow(cv, 0.92);
          cv = cv * 0.55 + cv * cv * (3 - 2 * cv) * 0.45;
          D[i * 4 + k] = U.clamp((cv + gr) * 255, 0, 255);
        }
        // 그림자는 살짝 녹색, 밝은 곳은 살짝 차갑게
        D[i * 4 + 1] = Math.min(255, D[i * 4 + 1] * 1.02 + 1);
        D[i * 4 + 3] = 255;
      }
    }
    // 싸구려 렌즈처럼 가장자리로 갈수록 빨강과 파랑이 어긋난다
    const src = new Uint8ClampedArray(D);
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const ox = (x - S / 2) / S, oy = (y - S / 2) / S, r = Math.hypot(ox, oy);
        const sh = r * r * 9;
        const rx = U.clamp(Math.round(x + ox * sh), 0, S - 1), ry = U.clamp(Math.round(y + oy * sh), 0, S - 1);
        const bx = U.clamp(Math.round(x - ox * sh), 0, S - 1), by = U.clamp(Math.round(y - oy * sh), 0, S - 1);
        const i = (y * S + x) * 4;
        D[i] = src[(ry * S + rx) * 4];
        D[i + 2] = src[(by * S + bx) * 4 + 2];
      }
    }
    cx.putImageData(img, 0, 0);
    // 렌즈처럼 아주 살짝 흐리게
    const out = U.canvas(S, S), ox = out.getContext('2d');
    ox.filter = 'blur(0.6px)';
    ox.drawImage(c, 0, 0);
    ox.filter = 'none';
    return out;
  }

  function tint(src, color) {
    const c = U.canvas(src.width, src.height), x = c.getContext('2d');
    x.drawImage(src, 0, 0);
    x.globalCompositeOperation = 'multiply';
    x.fillStyle = color; x.fillRect(0, 0, c.width, c.height);
    return c;
  }

  function makeGrain() {
    for (let k = 0; k < 4; k++) {
      const c = U.canvas(256, 256), x = c.getContext('2d'), im = x.createImageData(256, 256);
      for (let i = 0; i < 256 * 256; i++) {
        const g = Math.random() * 255;
        im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = g;
        im.data[i * 4 + 3] = 255;
      }
      x.putImageData(im, 0, 0);
      grain.push(c);
    }
  }

  // 무거운 계산이라 한 장씩 나눠서 만든다
  function prepare(onProgress, onDone) {
    makeGrain();
    let k = 0;
    const step = () => {
      if (k >= FACE_TYPES.length) { onDone(); return; }
      const FS = 400, f = renderFace(k, FS);
      faces[k] = f;
      faceRed[k] = tint(f, '#ff2020');
      faceCyan[k] = tint(f, '#20ffff');
      const sm = U.canvas(32, 32), sx = sm.getContext('2d');
      sx.imageSmoothingQuality = 'high';
      sx.drawImage(f, FS * 0.114, FS * 0.068, FS * 0.773, FS * 0.818, 0, 0, 32, 32);
      faceSmall[k] = sm;
      k++;
      onProgress(k / FACE_TYPES.length);
      setTimeout(step, 20);
    };
    setTimeout(step, 30);
  }

  // ---------- 메뉴 배경: 안개 낀 언덕 위 폐가 ----------
  function tree(x, px, py, len, ang, w, depth, rnd) {
    if (depth === 0 || w < 0.35) return;
    const x2 = px + Math.cos(ang) * len, y2 = py + Math.sin(ang) * len;
    x.lineWidth = w;
    x.beginPath();
    x.moveTo(px, py);
    x.quadraticCurveTo((px + x2) / 2 + (rnd() - 0.5) * len * 0.35, (py + y2) / 2 + (rnd() - 0.5) * len * 0.35, x2, y2);
    x.stroke();
    const n = 2 + (rnd() < 0.35 ? 1 : 0);
    for (let i = 0; i < n; i++) tree(x, x2, y2, len * (0.6 + rnd() * 0.22), ang + (rnd() - 0.5) * 1.4, w * 0.64, depth - 1, rnd);
  }

  function renderScene(W, H) {
    const c = U.canvas(W, H), x = c.getContext('2d');
    const img = x.createImageData(W, H), d = img.data;
    const mx = W * 0.74, my = H * 0.2, mr = H * 0.07;
    for (let py = 0; py < H; py++) {
      for (let px = 0; px < W; px++) {
        const u = px / W, v = py / H;
        const t = Math.pow(U.clamp(v / 0.7, 0, 1), 1.5);
        let col = mix3([0.005, 0.007, 0.013], [0.06, 0.068, 0.074], t);
        const dx = px - mx, dy = py - my, dm = Math.hypot(dx, dy);
        const glow = Math.exp(-dm / (mr * 2.2)) * 0.22 + Math.exp(-dm / (H * 0.45)) * 0.06;
        col = col.map((cv, k) => cv + glow * [0.8, 0.85, 0.9][k]);
        if (dm < mr + 1) {
          const k = Math.sqrt(Math.max(0, 1 - (dm / mr) ** 2));
          const cr = U.fbm(dx / mr * 2.5 + 10, dy / mr * 2.5, 4, 8);
          const moon = [0.86, 0.86, 0.8].map(cv => cv * (0.5 + 0.5 * k) * (0.72 + 0.4 * cr));
          col = mix3(col, moon, U.clamp(mr + 0.5 - dm, 0, 1));
        }
        const cl = U.fbm(u * 3.4 + v * 0.9, v * 7.5, 5, 3);
        const cloud = U.smooth(0.44, 0.78, cl) * (1 - U.smooth(0.45, 0.7, v));
        const lit = Math.exp(-dm / (H * 0.3));
        col = mix3(col, [0.03 + 0.2 * lit, 0.035 + 0.21 * lit, 0.04 + 0.22 * lit], cloud * 0.85);
        const fog = U.smooth(0.42, 0.7, v) * (0.5 + U.fbm(u * 6, v * 9, 3, 5));
        col = col.map(cv => cv + 0.05 * fog);
        const i = (py * W + px) * 4;
        d[i] = col[0] * 255; d[i + 1] = col[1] * 255; d[i + 2] = col[2] * 255; d[i + 3] = 255;
      }
    }
    x.putImageData(img, 0, 0);

    const rnd = U.rng(666);
    const hor = H * 0.68;

    // 먼 숲 (안개에 가려 흐릿하게)
    x.filter = 'blur(1.2px)';
    x.strokeStyle = 'rgba(22,25,29,0.9)';
    x.fillStyle = 'rgba(18,21,24,1)';
    x.beginPath(); x.moveTo(0, hor - 6);
    for (let i = 0; i <= 40; i++) x.lineTo(i / 40 * W, hor - 8 - U.noise(i * 0.4, 0, 9) * 14);
    x.lineTo(W, H); x.lineTo(0, H); x.fill();
    for (let i = 0; i < 26; i++) tree(x, rnd() * W, hor - 6, H * (0.05 + rnd() * 0.05), -Math.PI / 2 + (rnd() - 0.5) * 0.2, 2.2, 6, rnd);
    x.filter = 'none';

    // 언덕
    const hx = W * 0.36, hy = hor - H * 0.13;
    x.fillStyle = '#060708';
    x.beginPath(); x.moveTo(0, hor + 12);
    x.bezierCurveTo(W * 0.15, hor - 4, W * 0.24, hy, hx, hy);
    x.bezierCurveTo(W * 0.5, hy, W * 0.62, hor - 6, W, hor + 18);
    x.lineTo(W, H); x.lineTo(0, H); x.fill();

    // 폐가
    const s = H * 0.24, bx = hx, by = hy + 2;
    x.fillStyle = '#040405';
    x.fillRect(bx - 0.5 * s, by - 0.5 * s, 1.02 * s, 0.5 * s);
    x.beginPath(); x.moveTo(bx - 0.58 * s, by - 0.48 * s); x.lineTo(bx - 0.2 * s, by - 0.86 * s); x.lineTo(bx + 0.16 * s, by - 0.48 * s); x.fill();
    x.beginPath(); x.moveTo(bx + 0.04 * s, by - 0.48 * s); x.lineTo(bx + 0.3 * s, by - 0.74 * s); x.lineTo(bx + 0.58 * s, by - 0.48 * s); x.fill();
    x.fillRect(bx + 0.24 * s, by - 0.98 * s, 0.17 * s, 0.5 * s);
    x.beginPath(); x.moveTo(bx + 0.21 * s, by - 0.97 * s); x.lineTo(bx + 0.325 * s, by - 1.4 * s); x.lineTo(bx + 0.44 * s, by - 0.97 * s); x.fill();
    x.fillRect(bx - 0.36 * s, by - 0.9 * s, 0.06 * s, 0.24 * s);
    // 부러진 처마 장식
    x.strokeStyle = '#040405'; x.lineWidth = 1.2;
    x.beginPath(); x.moveTo(bx + 0.325 * s, by - 1.4 * s); x.lineTo(bx + 0.325 * s, by - 1.5 * s); x.stroke();
    // 창문들
    const wins = [[-0.42, -0.36], [-0.27, -0.36], [-0.05, -0.36], [0.3, -0.83], [0.3, -0.63], [-0.27, -0.66], [0.38, -0.36]];
    let litWin = null;
    wins.forEach(([wx, wy], k) => {
      const X = bx + wx * s, Y = by + wy * s, ww = 0.07 * s, wh = 0.12 * s;
      if (k === 5) {
        litWin = { x: X / W, y: Y / H, w: ww / W, h: wh / H };
        const g = x.createRadialGradient(X + ww / 2, Y + wh / 2, 0, X + ww / 2, Y + wh / 2, s * 0.25);
        g.addColorStop(0, 'rgba(160,80,30,0.35)'); g.addColorStop(1, 'rgba(160,80,30,0)');
        x.fillStyle = g; x.fillRect(X - s * 0.3, Y - s * 0.3, s * 0.6, s * 0.6);
        x.fillStyle = '#8a4a1c'; x.fillRect(X, Y, ww, wh);
        x.fillStyle = '#c47a34'; x.fillRect(X + ww * 0.2, Y + wh * 0.25, ww * 0.6, wh * 0.6);
        x.fillStyle = '#040405'; x.fillRect(X + ww * 0.45, Y, ww * 0.1, wh); x.fillRect(X, Y + wh * 0.45, ww, wh * 0.08);
      } else {
        x.fillStyle = k % 3 === 0 ? '#0d0f13' : '#090a0d';
        x.fillRect(X, Y, ww, wh);
        x.fillStyle = '#040405'; x.fillRect(X + ww * 0.45, Y, ww * 0.1, wh);
      }
    });
    // 울타리
    x.strokeStyle = '#030304'; x.lineWidth = 1.4;
    for (let i = 0; i < 28; i++) {
      const fx = bx - 0.8 * s + i * s * 0.06, fy = by + 4 + Math.sin(i) * 1.5;
      if (U.hash(i, 1, 5) < 0.15) continue;
      x.beginPath(); x.moveTo(fx, fy); x.lineTo(fx + (U.hash(i, 2, 5) - 0.5) * 3, fy - s * 0.12); x.stroke();
    }
    x.beginPath(); x.moveTo(bx - 0.8 * s, by - s * 0.05); x.lineTo(bx + 0.9 * s, by - s * 0.06); x.stroke();

    // 언덕 아래 안개 띠
    const fg = x.createLinearGradient(0, hy, 0, hor + 40);
    fg.addColorStop(0, 'rgba(70,78,84,0)'); fg.addColorStop(0.6, 'rgba(70,78,84,0.22)'); fg.addColorStop(1, 'rgba(70,78,84,0.05)');
    x.fillStyle = fg; x.fillRect(0, hy, W, hor + 40 - hy);

    // 가까운 땅과 비석
    x.fillStyle = '#020203';
    x.beginPath(); x.moveTo(0, H * 0.84);
    for (let i = 0; i <= 50; i++) x.lineTo(i / 50 * W, H * 0.84 - U.noise(i * 0.3, 2, 4) * H * 0.05);
    x.lineTo(W, H); x.lineTo(0, H); x.fill();
    x.strokeStyle = '#020203'; x.lineWidth = 1;
    for (let i = 0; i < 260; i++) {
      const gx = rnd() * W, gy = H * 0.84 - U.noise(gx / W * 50 * 0.3, 2, 4) * H * 0.05 + 2;
      x.beginPath(); x.moveTo(gx, gy); x.lineTo(gx + (rnd() - 0.5) * 4, gy - 3 - rnd() * 7); x.stroke();
    }
    [[0.18, 0.86, 1], [0.27, 0.88, 0], [0.6, 0.87, 1], [0.7, 0.9, 2], [0.82, 0.86, 0], [0.5, 0.92, 2]].forEach(([gx, gy, t]) => {
      const X = gx * W, Y = gy * H, h = H * (0.06 + U.hash(gx * 100, 1, 2) * 0.04);
      x.save(); x.translate(X, Y); x.rotate((U.hash(gx * 100, 3, 2) - 0.5) * 0.25);
      x.fillStyle = '#060708';
      if (t === 2) { x.fillRect(-h * 0.06, -h, h * 0.12, h); x.fillRect(-h * 0.3, -h * 0.75, h * 0.6, h * 0.12); }
      else {
        x.beginPath(); x.moveTo(-h * 0.28, 0); x.lineTo(-h * 0.28, -h * 0.7);
        x.arc(0, -h * 0.7, h * 0.28, Math.PI, 0); x.lineTo(h * 0.28, 0); x.fill();
        x.strokeStyle = 'rgba(80,88,96,0.25)'; x.lineWidth = 1;
        x.beginPath(); x.arc(0, -h * 0.7, h * 0.27, Math.PI * 1.1, Math.PI * 1.6); x.stroke();
      }
      x.restore();
    });

    // 앞쪽의 죽은 나무
    x.strokeStyle = '#010101'; x.lineCap = 'round';
    tree(x, W * 0.05, H * 1.02, H * 0.3, -Math.PI / 2 + 0.12, 16, 9, rnd);
    tree(x, W * 0.97, H * 1.02, H * 0.26, -Math.PI / 2 - 0.15, 13, 9, rnd);

    // 마무리: 색감, 비네팅, 입자
    const im2 = x.getImageData(0, 0, W, H), e = im2.data;
    for (let py = 0; py < H; py++) {
      for (let px = 0; px < W; px++) {
        const i = (py * W + px) * 4;
        const vg = 1 - 0.8 * U.smooth(0.35, 1.05, Math.hypot(px / W - 0.5, (py / H - 0.48) * 1.1) * 1.6);
        const gr = (Math.random() - 0.5) * 6;
        e[i] = e[i] * vg * 0.92 + gr; e[i + 1] = e[i + 1] * vg + gr; e[i + 2] = e[i + 2] * vg * 1.08 + gr;
      }
    }
    x.putImageData(im2, 0, 0);
    return { canvas: c, litWin };
  }

  // 수평으로 이어 붙여도 이음새가 없는 안개
  function renderFog(W, H, seed) {
    const c = U.canvas(W, H), x = c.getContext('2d'), im = x.createImageData(W, H), d = im.data;
    for (let py = 0; py < H; py++) {
      for (let px = 0; px < W; px++) {
        const u = px / W * 5, v = py / H * 3, t = px / W;
        const n = U.fbm(u, v, 4, seed) * (1 - t) + U.fbm(u - 5, v, 4, seed) * t;
        const band = U.smooth(0.2, 0.6, py / H) * (1 - U.smooth(0.85, 1, py / H) * 0.4);
        const a = U.smooth(0.42, 0.85, n) * band;
        const i = (py * W + px) * 4;
        d[i] = 120; d[i + 1] = 128; d[i + 2] = 136; d[i + 3] = a * 120;
      }
    }
    x.putImageData(im, 0, 0);
    return c;
  }

  // 길쭉하고 마른 형체 (번개가 칠 때만 보인다)
  function drawFigure(x, X, Y, h) {
    x.save(); x.translate(X, Y);
    x.fillStyle = '#000';
    x.beginPath();
    x.ellipse(0, -h * 0.93, h * 0.055, h * 0.07, 0.15, 0, Math.PI * 2);
    x.fill();
    x.beginPath();
    x.moveTo(-h * 0.02, -h * 0.86); x.lineTo(-h * 0.1, -h * 0.8); x.lineTo(-h * 0.11, -h * 0.5);
    x.lineTo(-h * 0.16, -h * 0.18); x.lineTo(-h * 0.13, -h * 0.17); x.lineTo(-h * 0.085, -h * 0.5);
    x.lineTo(-h * 0.07, -h * 0.45); x.lineTo(-h * 0.06, 0); x.lineTo(-h * 0.02, 0); x.lineTo(0, -h * 0.4);
    x.lineTo(h * 0.02, 0); x.lineTo(h * 0.06, 0); x.lineTo(h * 0.07, -h * 0.45); x.lineTo(h * 0.085, -h * 0.5);
    x.lineTo(h * 0.14, -h * 0.15); x.lineTo(h * 0.17, -h * 0.16); x.lineTo(h * 0.11, -h * 0.5);
    x.lineTo(h * 0.1, -h * 0.8); x.lineTo(h * 0.02, -h * 0.86);
    x.closePath(); x.fill();
    x.restore();
  }

  return { FACE_TYPES, faces, faceRed, faceCyan, faceSmall, grain, prepare, renderScene, renderFog, drawFigure };
})();

// ---------- 화면 가득 튀어나오는 얼굴 ----------
const Scare = (() => {
  const cv = document.getElementById('scare');
  const x = cv.getContext('2d');
  let active = false;

  function face(type, opts = {}) {
    const dur = opts.dur || 0.9, power = opts.power || 1, pre = opts.pre || 0;
    if (!Real.faces[type]) { opts.done && opts.done(); return; }
    active = true;
    cv.width = innerWidth; cv.height = innerHeight;
    cv.style.display = 'block';
    const P = Real.FACE_TYPES[type];
    // 미리 정해 두는 핏줄기 (화면 위에서 흘러내린다)
    // 피는 얼굴 자체(눈 밑, 콧구멍, 입꼬리)에서 흘러나온다
    const bleeds = [];
    if (opts.blood) {
      const src = [];
      for (const sg of [-1, 1]) src.push([sg * P.eyeX + (Math.random() - 0.5) * 0.03, P.eyeY + P.eyeRY * 0.9, 0.02, true]);
      src.push([0.03, 0.245, 0.18], [-0.03, 0.245, 0.3]);
      for (const sg of [-1, 1]) {
        if (P.grin) src.push([sg * P.mouthW * 0.94, P.mouthY - 0.5 * P.mouthW * P.mouthW + 0.02, 0.1]);
        else src.push([sg * P.mouthW * 0.8, P.mouthY + P.mouthH * 0.6, 0.22]);
      }
      for (const [u, v, d, eye] of src) bleeds.push({ u, v, eye, d: d + Math.random() * 0.12, sp: 0.5 + Math.random() * 0.5, w: 0.024 + Math.random() * 0.018, ph: Math.random() * 9, max: 0.35 + Math.random() * 0.45 });
    }
    const go = () => {
      document.body.classList.add('shake');
      if (opts.scream !== false) SFX.scream(power);
      SFX.static(dur * 0.8, 0.3 * power);
    };
    if (pre) { SFX.whisper(pre + 0.2, 0, 0.35); setTimeout(go, pre * 1000); } else go();
    const t0 = performance.now();
    const f = Real.faces[type], fr = Real.faceRed[type], fc = Real.faceCyan[type];
    const loop = () => {
      const tAll = (performance.now() - t0) / 1000;
      const W = cv.width, H = cv.height;
      if (tAll < pre) {
        // 어둠 저편에 작은 얼굴이 가만히 서 있다
        x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
        const sz = Math.min(W, H) * (0.1 + tAll / pre * 0.05);
        x.globalAlpha = 0.5 + 0.5 * (tAll / pre);
        x.drawImage(f, W / 2 - sz / 2, H * 0.45 - sz / 2, sz, sz);
        x.globalAlpha = 1;
        requestAnimationFrame(loop);
        return;
      }
      const t = tAll - pre, k = t / dur;
      if (t >= dur) {
        x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
        setTimeout(() => {
          cv.style.display = 'none'; active = false;
          document.body.classList.remove('shake');
          opts.done && opts.done();
        }, opts.hold || 120);
        return;
      }
      x.globalCompositeOperation = 'source-over';
      x.globalAlpha = 1;
      x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
      const ease = 1 - Math.pow(1 - Math.min(1, k * 1.6), 3);
      const size = Math.max(W, H) * (0.75 + ease * 0.55 + k * 0.15);
      const j = (1 - k * 0.6) * Math.min(W, H) * 0.03;
      const jx = (Math.random() - 0.5) * j * 2, jy = (Math.random() - 0.5) * j * 2;
      const cx = W / 2 - size / 2 + jx, cy = H / 2 - size * 0.48 + jy;
      // 고개가 천천히 꺾인다 (가끔 홱 돌아간다)
      const rot = Math.sin(t * 2.2) * 0.035 + U.smooth(0.3, 1, k) * 0.13 * (type % 2 ? 1 : -1) + (Math.random() < 0.05 ? (Math.random() - 0.5) * 0.3 : 0);
      const pcx = W / 2 + jx, pcy = H / 2 + jy;
      x.save();
      x.translate(pcx, pcy); x.rotate(rot); x.translate(-pcx, -pcy);
      // 가끔 얼굴이 경련하듯 좌우로 뒤집히거나 옆으로 늘어난다
      const tw = Math.random();
      if (tw < 0.07) { x.save(); x.translate(W, 0); x.scale(-1, 1); x.drawImage(f, W - cx - size, cy, size, size); x.restore(); }
      else if (tw < 0.12) x.drawImage(f, cx - size * 0.08, cy + size * 0.03, size * 1.16, size * 0.94);
      else x.drawImage(f, cx, cy, size, size);
      if (opts.jaw) {
        // 턱이 빠지듯 입 아래가 길게 늘어난다
        const jk = U.smooth(0.25, 0.85, k), fs = f.width, cut = Math.floor((P.mouthY + 1) / 2 * fs - fs * 0.01);
        if (jk > 0) {
          const sy = cut / fs * size;
          x.drawImage(f, 0, cut, fs, fs - cut, cx, cy + sy, size, (fs - cut) / fs * size * (1 + jk * 0.45));
        }
      }
      if (bleeds.length) {
        // 곱하기로 칠해서 피부 밝기를 따라 어둡고 붉게 스민다
        x.globalCompositeOperation = 'multiply';
        x.fillStyle = 'rgb(118,12,14)';
        for (const b of bleeds) {
          const L = Math.min(b.max, Math.max(0, k - b.d) * b.sp * 2.4);
          if (L <= 0) continue;
          const X0 = cx + (b.u + 1) / 2 * size, Y0 = cy + (b.v + 1) / 2 * size, len = L / 2 * size, w0 = b.w / 2 * size;
          const xoAt = yy => Math.sin(yy / size * 22 + b.ph) * w0 * 0.7;
          for (let yy = 0; yy < len; yy += 3) {
            const ww = w0 * (0.55 + 0.45 * Math.sin(yy / size * 55 + b.ph)) * (1 - yy / len * 0.35);
            x.fillRect(X0 + xoAt(yy) - ww / 2, Y0 + yy, ww, 4);
          }
          x.beginPath(); x.ellipse(X0 + xoAt(len), Y0 + len, w0 * 0.7, w0, 0, 0, Math.PI * 2); x.fill();
          // 흘러나온 자리는 넓게 번져 있다
          if (b.eye) {
            x.globalAlpha = 0.5;
            x.beginPath(); x.ellipse(X0, Y0 + w0 * 0.6, w0 * 2.2, w0 * 1.3, 0, 0, Math.PI * 2); x.fill();
            x.globalAlpha = 1;
          }
        }
        // 젖은 피에 맺힌 아주 약한 반사광
        x.globalCompositeOperation = 'source-over';
        x.fillStyle = 'rgba(255,150,140,0.08)';
        for (const b of bleeds) {
          const L = Math.min(b.max, Math.max(0, k - b.d) * b.sp * 2.4);
          if (L <= 0) continue;
          const X0 = cx + (b.u + 1) / 2 * size, Y0 = cy + (b.v + 1) / 2 * size, len = L / 2 * size, w0 = b.w / 2 * size;
          for (let yy = 0; yy < len; yy += 3) x.fillRect(X0 + Math.sin(yy / size * 22 + b.ph) * w0 * 0.7 - w0 * 0.25, Y0 + yy, Math.max(1, w0 * 0.18), 4);
        }
        // 글리치 색감: 핏줄기만 빨강/청록으로 어긋나고, 군데군데 가로로 찢겨 밀린다
        x.globalCompositeOperation = 'lighter';
        const gs = size * (0.006 + Math.random() * 0.01);
        for (const b of bleeds) {
          const L = Math.min(b.max, Math.max(0, k - b.d) * b.sp * 2.4);
          if (L <= 0) continue;
          const X0 = cx + (b.u + 1) / 2 * size, Y0 = cy + (b.v + 1) / 2 * size, len = L / 2 * size, w0 = b.w / 2 * size;
          for (let yy = 0; yy < len; yy += 4) {
            const xo = Math.sin(yy / size * 22 + b.ph) * w0 * 0.7, ww = w0 * (0.55 + 0.45 * Math.sin(yy / size * 55 + b.ph));
            const tear = Math.random() < 0.06 ? (Math.random() - 0.5) * w0 * 8 : 0;
            x.fillStyle = 'rgba(255,0,36,0.32)'; x.fillRect(X0 + xo - ww / 2 + gs + tear, Y0 + yy, ww, 4);
            x.fillStyle = 'rgba(0,200,220,0.16)'; x.fillRect(X0 + xo - ww / 2 - gs + tear, Y0 + yy + 1, ww, 4);
            if (tear) { x.fillStyle = 'rgba(255,40,90,0.45)'; x.fillRect(X0 + xo + tear - ww * 2, Y0 + yy, ww * 4, 2); }
          }
          // 가끔 핏줄기 한 토막이 화면 옆으로 통째로 밀린다
          if (Math.random() < 0.25) {
            const yy = Math.random() * len, h = 6 + Math.random() * 18;
            x.fillStyle = Math.random() < 0.5 ? 'rgba(255,0,60,0.5)' : 'rgba(0,255,230,0.3)';
            x.fillRect(X0 - w0 + (Math.random() - 0.5) * size * 0.08, Y0 + yy, w0 * 2, h);
          }
        }
        x.globalCompositeOperation = 'source-over';
      }
      if (P.eyes === 'glow' || P.eyes === 'stare') {
        // 눈에서 빛이 번진다
        x.globalCompositeOperation = 'lighter';
        for (const s of [-1, 1]) {
          const ex = cx + (s * P.eyeX + 1) / 2 * size, ey = cy + (P.eyeY + 1) / 2 * size, r = size * (P.eyes === 'glow' ? 0.05 : 0.03) * (0.8 + Math.random() * 0.5);
          const gg = x.createRadialGradient(ex, ey, 0, ex, ey, r);
          gg.addColorStop(0, P.eyes === 'glow' ? 'rgba(255,230,210,0.55)' : 'rgba(255,60,40,0.3)'); gg.addColorStop(1, 'rgba(255,0,0,0)');
          x.fillStyle = gg; x.fillRect(ex - r, ey - r, r * 2, r * 2);
        }
        x.globalCompositeOperation = 'source-over';
      }
      x.globalCompositeOperation = 'lighter';
      const split = 6 + Math.random() * 14;
      x.globalAlpha = 0.5; x.drawImage(fr, cx + split, cy, size, size);
      x.globalAlpha = 0.35; x.drawImage(fc, cx - split, cy + split * 0.3, size, size);
      x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1;
      x.restore();
      if (dur >= 0.8 && k > 0.5 && k < 0.57) {
        // 한순간 눈만 화면 가득 다가온다
        const fs = f.width, sw = fs * 0.62, sh = fs * 0.2, sx = fs * 0.19, sy = (P.eyeY + 1) / 2 * fs - sh / 2;
        const dh = W * sh / sw;
        x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
        x.drawImage(f, sx, sy, sw, sh, (Math.random() - 0.5) * 20, H / 2 - dh / 2, W, dh);
      }
      // 화면이 찢어지는 줄
      const bands = 2 + Math.floor(Math.random() * 5);
      for (let b = 0; b < bands; b++) {
        const by = Math.random() * H, bh = 4 + Math.random() * H * 0.06;
        x.drawImage(cv, 0, by, W, bh, (Math.random() - 0.5) * W * 0.12, by, W, bh);
      }
      // 입자와 깜빡임
      x.globalAlpha = 0.28;
      x.globalCompositeOperation = 'overlay';
      const g = Real.grain[Math.floor(Math.random() * Real.grain.length)];
      const pat = x.createPattern(g, 'repeat');
      x.fillStyle = pat; x.fillRect(0, 0, W, H);
      x.globalCompositeOperation = 'source-over';
      x.globalAlpha = 1;
      if (t < 0.05) { x.fillStyle = 'rgba(255,255,255,0.75)'; x.fillRect(0, 0, W, H); }
      else if (Math.random() < 0.08) { x.fillStyle = 'rgba(0,0,0,0.85)'; x.fillRect(0, 0, W, H); }
      else if (Math.random() < 0.06) {
        // 필름이 타 버린 듯한 반전 프레임
        x.globalCompositeOperation = 'difference';
        x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
        x.globalCompositeOperation = 'source-over';
      }
      if (k > 0.4 && Math.random() < 0.25) {
        // 붉은 기운이 화면 아래에서 차오른다
        x.globalCompositeOperation = 'multiply';
        const rg = x.createLinearGradient(0, H, 0, H * 0.35);
        rg.addColorStop(0, 'rgb(150,40,40)'); rg.addColorStop(1, 'rgb(255,255,255)');
        x.fillStyle = rg; x.fillRect(0, 0, W, H);
        x.globalCompositeOperation = 'source-over';
      }
      const vg = x.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.75);
      vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.85)');
      x.fillStyle = vg; x.fillRect(0, 0, W, H);
      if (opts.text && t > dur * 0.35) {
        x.font = `800 ${Math.round(Math.min(W, H) * 0.08)}px 'Nanum Myeongjo', serif`;
        x.textAlign = 'center'; x.fillStyle = '#d8000c';
        x.fillText(opts.text, W / 2 + jx * 0.5, H * 0.88 + jy * 0.5);
      }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  return { face, get active() { return active; } };
})();
