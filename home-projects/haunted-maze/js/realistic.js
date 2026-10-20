'use strict';
// 실사풍 그림: 픽셀 하나하나 빛과 그림자를 계산해서 얼굴과 메뉴 배경을 그린다.
// 사진 파일은 하나도 쓰지 않는다.

const Real = (() => {
  const faces = [], faceRed = [], faceCyan = [], faceSmall = [];
  const grain = [];

  const FACE_TYPES = [
    // 0: 긴 머리 창백한 여자 — 하얗게 흐린 눈, 벌어진 입
    { eyeX: 0.2, eyeY: -0.07, eyeRX: 0.078, eyeRY: 0.05, sock: 0.32, mouthY: 0.43, mouthW: 0.11, mouthH: 0.21,
      hair: true, eyes: 'milky', grin: false, tears: false, skin: [0.80, 0.82, 0.79], seed: 11 },
    // 1: 텅 빈 눈의 아이 — 검은 구멍 같은 눈, 흘러내리는 검은 눈물
    { eyeX: 0.21, eyeY: -0.04, eyeRX: 0.095, eyeRY: 0.08, sock: 0.48, mouthY: 0.4, mouthW: 0.085, mouthH: 0.13,
      hair: false, eyes: 'void', grin: false, tears: true, skin: [0.70, 0.69, 0.67], seed: 23 },
    // 2: 귀까지 찢어진 웃음 — 동그랗게 뜬 눈, 작은 눈동자
    { eyeX: 0.23, eyeY: -0.09, eyeRX: 0.085, eyeRY: 0.07, sock: 0.26, mouthY: 0.33, mouthW: 0.43, mouthH: 0.085,
      hair: false, eyes: 'stare', grin: true, tears: false, skin: [0.74, 0.66, 0.6], seed: 37 },
  ];

  const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

  function renderFace(type, S) {
    const P = FACE_TYPES[type], sd = P.seed;
    const N = S * S;
    const Hm = new Float32Array(N), M = new Uint8Array(N); // M: 0 배경, 1 피부, 2 눈, 3 입
    const SOCK = new Float32Array(N), MD = new Float32Array(N);

    // 관자놀이는 좁고 광대에서 넓다가 턱으로 갈수록 좁아지는 얼굴 윤곽
    const halfW = v => 0.56 * (1 - 0.13 * U.smooth(-0.05, -0.9, v)) * (1 - 0.3 * U.smooth(0.15, 0.9, v));
    const faceDD = (u, v) => (u / halfW(v)) ** 2 + ((v + 0.02) / 0.88) ** 2;
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

    // 1) 높이(입체) 지도
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const i = y * S + x, u = (x / S) * 2 - 1, v = (y / S) * 2 - 1;
        const dd = faceDD(u, v);
        if (dd >= 1) { Hm[i] = 0; M[i] = 0; continue; }
        let h = Math.sqrt(1 - dd) * 0.9;
        let sock = 0;
        for (const s of [-1, 1]) {
          const ex = u - s * P.eyeX, ey = v - P.eyeY;
          sock += (Math.exp(-((ex / (P.eyeRX * 1.7)) ** 2 + (ey / (P.eyeRY * 2.2)) ** 2)));
          h += 0.05 * Math.exp(-(((u - s * 0.3) ** 2) / 0.01 + ((v - 0.08) ** 2) / 0.006)); // 광대뼈
          h -= 0.07 * Math.exp(-(((u - s * 0.27) ** 2) / 0.012 + ((v - 0.3) ** 2) / 0.012)); // 꺼진 볼
          h -= 0.05 * Math.exp(-(((u - s * 0.035) ** 2) / 0.0005 + ((v - 0.225) ** 2) / 0.0006)); // 콧구멍
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
        h += 0.025 * Math.exp(-((md - 1.15) ** 2) / 0.02); // 입술 둘레
        h += (U.fbm(u * 18, v * 18, 3, sd) - 0.5) * 0.028; // 주름
        Hm[i] = h;
        M[i] = 1;
        for (const s of [-1, 1]) {
          const ex = (u - s * P.eyeX) / P.eyeRX, ey = (v - P.eyeY) / P.eyeRY;
          const edge = 1 + (U.noise(u * 30, v * 30, sd + 8) - 0.5) * 0.2;
          if (ex * ex + ey * ey < edge * (P.eyes === 'void' ? 1.7 : 1)) M[i] = 2;
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

    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const i = y * S + x, u = (x / S) * 2 - 1, v = (y / S) * 2 - 1;
        let col;
        const hl = Hm[y * S + Math.max(0, x - 1)], hr = Hm[y * S + Math.min(S - 1, x + 1)];
        const hu = Hm[Math.max(0, y - 1) * S + x], hd = Hm[Math.min(S - 1, y + 1) * S + x];
        let nx = -(hr - hl) * S / 4, ny = -(hd - hu) * S / 4, nz = 1;
        const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
        const d1 = Math.max(0, nx * L1[0] + ny * L1[1] + nz * L1[2]);
        const d2 = Math.max(0, nx * L2[0] + ny * L2[1] + nz * L2[2]);
        const hx = L1[0], hy = L1[1], hz = L1[2] + 1, hn = Math.hypot(hx, hy, hz);
        const spec = Math.pow(Math.max(0, (nx * hx + ny * hy + nz * hz) / hn), 28);

        // 배경: 탁한 어둠
        const bgN = U.fbm(u * 3, v * 3, 3, sd + 50);
        const bg = [0.012 + bgN * 0.02, 0.014 + bgN * 0.022, 0.016 + bgN * 0.024];

        if (M[i] === 0) col = bg;
        else {
          const dd = faceDD(u, v);
          // 피부 바탕색: 큰 얼룩 + 잔 모공
          let alb = P.skin.map(cv => cv * (0.86 + U.fbm(u * 5, v * 5, 4, sd + 5) * 0.2 + (U.hash(x, y, sd + 7) - 0.5) * 0.05));
          const spots = U.smooth(0.64, 0.74, U.fbm(u * 10, v * 10, 3, sd + 3));
          alb = mix3(alb, [0.45, 0.38, 0.33], spots * 0.25);
          const ridge = 1 - Math.abs(U.fbm(u * 6, v * 6, 4, sd + 9) * 2 - 1);
          const temple = 0.25 + 0.75 * U.smooth(0.18, 0.42, Math.abs(u)) + 0.5 * Math.exp(-((v + 0.5) ** 2) / 0.05);
          alb = mix3(alb, [0.3, 0.27, 0.4], U.smooth(0.94, 0.985, ridge) * 0.4 * Math.min(1, temple)); // 핏줄
          alb = mix3(alb, [0.24, 0.16, 0.22], SOCK[i] * 0.8); // 눈가 멍
          if (MD[i] >= 1 && MD[i] < 1.35) alb = mix3(alb, [0.3, 0.12, 0.14], (1.35 - MD[i]) / 0.35 * 0.7); // 입술
          let ao = (1 - 0.9 * SOCK[i] ** 1.3) * (0.25 + 0.75 * (1 - U.smooth(0.6, 1.0, dd)));
          ao *= 1 - 0.5 * Math.exp(-((MD[i] - 1) ** 2) / 0.01) * (MD[i] > 1 ? 1 : 0);
          // 아래에서 비추는 빛이라 이마 쪽은 어둠에 묻힌다
          const fall = 0.12 + 0.88 * U.smooth(-0.85, 0.45, v);
          const lightAmt = 0.03 + d1 * 1.1 * ao * fall + d2 * 0.12 * ao;
          col = [
            alb[0] * lightAmt + alb[0] * 0.03 * fall + spec * 0.2 * ao * fall,
            alb[1] * lightAmt + spec * 0.2 * ao * fall,
            alb[2] * (lightAmt + d2 * 0.05) + spec * 0.22 * ao * fall,
          ];

          if (M[i] === 2) {
            // 눈
            let ex = 0, ey = 0;
            for (const s of [-1, 1]) {
              const a = (u - s * P.eyeX) / P.eyeRX, b = (v - P.eyeY) / P.eyeRY;
              if (a * a + b * b < 2.2) { ex = a; ey = b; }
            }
            const r2 = ex * ex + ey * ey, ball = Math.sqrt(Math.max(0, 1 - Math.min(1, r2)));
            const lid = 0.15 + 0.85 * U.smooth(-0.95, -0.05, ey);
            const fall = 0.3 + 0.7 * U.smooth(-0.85, 0.45, v);
            if (P.eyes === 'void') {
              // 눈알이 없는 깊은 구멍
              const g = Math.exp(-(((ex + 0.3) ** 2) + ((ey + 0.35) ** 2)) / 0.01) * U.smooth(1, 0.3, r2);
              col = mix3(col, [0.003, 0.002, 0.003], U.smooth(1.7, 0.55, r2)).map(cv => cv + g * 0.3);
            } else {
              const skinCol = col;
              const vein = U.smooth(0.88, 0.97, 1 - Math.abs(U.fbm(u * 40, v * 40, 3, sd + 30) * 2 - 1)) * U.smooth(0.15, 0.8, r2);
              let e = P.eyes === 'milky' ? [0.66, 0.69, 0.66] : [0.72, 0.68, 0.62];
              e = mix3(e, [0.55, 0.05, 0.05], vein * (P.eyes === 'stare' ? 0.9 : 0.6));
              if (P.eyes === 'stare') e = mix3(e, [0.5, 0.1, 0.08], U.smooth(0.55, 1, r2) * 0.7);
              const ir = Math.hypot(ex * P.eyeRX, ey * P.eyeRY);
              if (P.eyes === 'milky') {
                if (ir < 0.034) e = mix3(e, [0.58, 0.6, 0.6], 0.6);
                if (ir < 0.012) e = [0.3, 0.32, 0.32];
              } else {
                if (ir < 0.028) e = [0.16, 0.09, 0.05];
                if (ir < 0.011) e = [0.01, 0.01, 0.01];
              }
              const sh = (0.2 + 0.8 * ball) * lid * fall;
              col = e.map(cv => cv * sh);
              const glint = Math.exp(-(((ex + 0.3) ** 2) + ((ey + 0.35) ** 2)) / 0.008);
              col = col.map(cv => cv + glint * 0.5 * fall);
              // 눈꺼풀 가장자리는 피부와 섞이며 젖은 붉은 기가 돈다
              col = mix3(col, [0.3 * fall, 0.08 * fall, 0.08 * fall], U.smooth(0.6, 0.95, r2) * 0.6);
              col = mix3(col, skinCol, U.smooth(0.85, 1.05, r2));
            }
          } else if (M[i] === 3) {
            // 입 속
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
                col = tc.map(cv => cv * (0.15 + 0.85 * (1 - md)) * (0.35 + d1 * 0.6) * (0.55 + 0.45 * round));
              } else if (md >= 0.82) col = [0.26, 0.05, 0.06].map(cv => cv * (0.35 + d1 * 0.5));
            } else {
              const my = (v - P.mouthY) / P.mouthH;
              if (my < -0.55 && md > 0.55) {
                const tooth = ((u / P.mouthW + 1) * 4.5) % 1;
                const miss = U.hash(Math.floor((u / P.mouthW + 1) * 4.5), 3, sd) < 0.3;
                const len = -0.55 - U.hash(Math.floor((u / P.mouthW + 1) * 4.5), 4, sd) * 0.3;
                if (tooth > 0.2 && !miss && my < len + 0.1) col = [0.48, 0.43, 0.32].map(cv => cv * (0.25 + d1 * 0.45) * (1.2 - md * 0.5));
              }
            }
            col = mix3(col, skinCol, U.smooth(0.85, 1.0, md));
          }

          if (P.tears) {
            for (const s of [-1, 1]) {
              const sm = Math.exp(-(((u - s * P.eyeX) ** 2) / 0.006 + (Math.max(0, v - P.eyeY) ** 2) / 0.02)) * U.smooth(1.0, 1.6, (((u - s * P.eyeX) / P.eyeRX) ** 2 + ((v - P.eyeY) / P.eyeRY) ** 2));
              col = mix3(col, [0.02, 0.015, 0.02], sm * 0.55);
              // 검은 눈물: 눈 밑으로 번지며 흘러내린다
              for (let k = 0; k < 3; k++) {
                const len = 0.25 + U.hash(s + 5, k, sd) * 0.45;
                const off = (k - 1) * 0.035 + (U.hash(s, k, sd) - 0.5) * 0.02;
                const tu = u - s * P.eyeX - off + 0.014 * Math.sin(v * 14 + s * 2 + k * 3) + (U.noise(v * 6, k + s * 3, sd) - 0.5) * 0.03, tv = v - P.eyeY - P.eyeRY * 0.9;
                if (k === 2) continue;
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
            // 찢어진 입꼬리에서 흐르는 피
            for (const s of [-1, 1]) {
              const cxu = s * P.mouthW * 0.97, cyv = P.mouthY - 0.5 * P.mouthW * P.mouthW;
              const tu = u - cxu, tv = v - cyv;
              if (tv > 0 && tv < 0.28 && Math.abs(tu + Math.sin(tv * 20) * 0.006) < 0.012 * (1 - tv / 0.3)) col = [0.3 * (0.4 + d1), 0.01, 0.02];
            }
          }
          // 얼굴 테두리를 배경에 부드럽게 섞기
          col = mix3(col, bg, U.smooth(0.94, 1, dd));
        }

        // 머리카락
        if (P.hair) {
          const curtain = 0.36 + 0.08 * (U.fbm(v * 3, 1, 2, sd + 40) - 0.5) + 0.03 * U.smooth(-0.2, 0.9, v);
          const outer = 0.66 + 0.3 * U.smooth(-0.3, 1, v);
          const topLine = -0.5 + 1.1 * u * u - 0.06 * U.noise(u * 9, 0, sd + 41);
          const st = U.fbm(u * 60 + Math.sin(v * 3) * 0.6, v * 1.6, 3, sd + 21);
          const sideA = U.smooth(curtain - 0.015, curtain + 0.035, Math.abs(u) + (st - 0.5) * 0.12);
          const topA = U.smooth(topLine + 0.04, topLine - 0.03, v + (st - 0.5) * 0.05);
          const outA = M[i] === 0 ? 1 : 0;
          const hairA = Math.max(sideA, topA, outA) * U.smooth(outer + 0.02, outer - 0.08, Math.abs(u) + (st - 0.5) * 0.1) * U.smooth(-0.99, -0.86, v);
          if (hairA > 0) {
            // 가닥마다 아래쪽 빛을 조금씩 받아 반짝인다
            const near = Math.exp(-((Math.abs(u) - curtain) ** 2) / 0.02) * U.smooth(-0.6, 0.5, v);
            let hc = 0.008 + (0.05 + 0.22 * near) * U.smooth(0.5, 0.85, st);
            hc *= 0.5 + 0.5 * U.smooth(1, 0.1, v);
            col = mix3(col, [hc * 0.95, hc, hc * 1.12], 0.97 * hairA);
          }
        }

        // 사진 같은 마무리: 대비, 색감, 비네팅, 입자
        const vg = 1 - 0.7 * U.smooth(0.5, 1.45, Math.hypot(u, v * 0.9));
        const gr = (U.hash(x, y, sd + 99) - 0.5) * 0.05;
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
      const f = renderFace(k, 440);
      faces[k] = f;
      faceRed[k] = tint(f, '#ff2020');
      faceCyan[k] = tint(f, '#20ffff');
      const sm = U.canvas(32, 32), sx = sm.getContext('2d');
      sx.imageSmoothingQuality = 'high';
      sx.drawImage(f, 50, 30, 340, 360, 0, 0, 32, 32);
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
    const dur = opts.dur || 0.9, power = opts.power || 1;
    if (!Real.faces[type]) { opts.done && opts.done(); return; }
    active = true;
    cv.width = innerWidth; cv.height = innerHeight;
    cv.style.display = 'block';
    document.body.classList.add('shake');
    if (opts.scream !== false) SFX.scream(power);
    SFX.static(dur * 0.8, 0.3 * power);
    const t0 = performance.now();
    const f = Real.faces[type], fr = Real.faceRed[type], fc = Real.faceCyan[type];
    const loop = () => {
      const t = (performance.now() - t0) / 1000, k = t / dur;
      const W = cv.width, H = cv.height;
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
      // 가끔 얼굴이 경련하듯 좌우로 뒤집히거나 옆으로 늘어난다
      const tw = Math.random();
      if (tw < 0.07) { x.save(); x.translate(W, 0); x.scale(-1, 1); x.drawImage(f, W - cx - size, cy, size, size); x.restore(); }
      else if (tw < 0.12) x.drawImage(f, cx - size * 0.08, cy + size * 0.03, size * 1.16, size * 0.94);
      else x.drawImage(f, cx, cy, size, size);
      x.globalCompositeOperation = 'lighter';
      const split = 6 + Math.random() * 14;
      x.globalAlpha = 0.5; x.drawImage(fr, cx + split, cy, size, size);
      x.globalAlpha = 0.35; x.drawImage(fc, cx - split, cy + split * 0.3, size, size);
      x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1;
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
        const rg = x.createLinearGradient(0, H, 0, H * 0.4);
        rg.addColorStop(0, 'rgba(120,0,0,0.55)'); rg.addColorStop(1, 'rgba(120,0,0,0)');
        x.fillStyle = rg; x.fillRect(0, 0, W, H);
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
