'use strict';
// 20x20 도트 그림. 글자 하나 = 픽셀 하나, '.' 은 투명

const Sprites = (() => {
  const S = 20;

  function fromRows(rows, pal) {
    const c = U.canvas(S, S), x = c.getContext('2d');
    rows.forEach((r, y) => {
      for (let i = 0; i < S; i++) {
        const col = pal[r[i]];
        if (!col) continue;
        x.fillStyle = col;
        x.fillRect(i, y, 1, 1);
      }
    });
    polish(c, rows);
    return c;
  }

  // 손으로 찍은 도트를 다듬는다
  // 1) 바깥 테두리를 새까만 색 대신 안쪽 색의 짙은 버전으로 (색 테두리)
  // 2) 위쪽 가장자리는 빛을 받아 밝게, 아래쪽 가장자리는 그림자로 어둡게
  function polish(c, rows) {
    const x = c.getContext('2d'), im = x.getImageData(0, 0, S, S), d = im.data, src = new Uint8ClampedArray(d);
    const ch = (i, y) => (rows[y] && rows[y][i]) || '.';
    const solid = (i, y) => i >= 0 && y >= 0 && i < S && y < S && src[(y * S + i) * 4 + 3] > 0;
    const outer = (i, y) => ch(i, y) === 'k' && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !solid(i + dx, y + dy));
    for (let y = 0; y < S; y++) {
      for (let i = 0; i < S; i++) {
        const k = (y * S + i) * 4;
        if (!src[k + 3]) continue;
        if (outer(i, y)) {
          // 바깥 테두리: 이웃한 색을 어둡게 해서 쓴다 (아래쪽 테두리는 더 어둡게)
          for (const [dx, dy] of [[0, -1], [1, 0], [-1, 0], [0, 1]]) {
            const ni = i + dx, ny = y + dy;
            if (!solid(ni, ny) || ch(ni, ny) === 'k') continue;
            const n = (ny * S + ni) * 4, f = dy === -1 ? 0.28 : 0.4;
            d[k] = src[n] * f; d[k + 1] = src[n + 1] * f; d[k + 2] = src[n + 2] * f;
            break;
          }
          continue;
        }
        if (ch(i, y) === 'k') continue;
        const upOpen = !solid(i, y - 1) || outer(i, y - 1);
        const downOpen = !solid(i, y + 1) || outer(i, y + 1);
        const f = upOpen && !downOpen ? 1.14 : downOpen && !upOpen ? 0.84 : 1;
        if (f !== 1) { d[k] = src[k] * f; d[k + 1] = src[k + 1] * f; d[k + 2] = src[k + 2] * f; }
      }
    }
    x.putImageData(im, 0, 0);
  }

  function flip(src) {
    const c = U.canvas(src.width, src.height), x = c.getContext('2d');
    x.translate(src.width, 0);
    x.scale(-1, 1);
    x.drawImage(src, 0, 0);
    return c;
  }

  // fn(x, y) 가 [r,g,b,a] 를 돌려주면 그 색으로 칠한다
  function pix(fn, w = S, h = S) {
    const c = U.canvas(w, h), x = c.getContext('2d');
    const im = x.createImageData(w, h), d = im.data;
    for (let y = 0; y < h; y++) {
      for (let i = 0; i < w; i++) {
        const v = fn(i, y);
        if (!v) continue;
        const k = (y * w + i) * 4;
        d[k] = U.clamp(v[0], 0, 255); d[k + 1] = U.clamp(v[1], 0, 255);
        d[k + 2] = U.clamp(v[2], 0, 255); d[k + 3] = v[3] === undefined ? 255 : v[3];
      }
    }
    x.putImageData(im, 0, 0);
    return c;
  }

  // ---------- 캐릭터 ----------
  const PL = { k: '#1a0f0c', o: '#e8823a', l: '#f6a860', c: '#c4561d', C: '#8a3510', D: '#5a210a', h: '#4a3226', H: '#6b4a38', s: '#f2cfa8', S: '#c99a74', e: '#1a1010', w: '#ffffff', p: '#3a3f5c', P: '#262a40', b: '#2a1d16', B: '#5a4436', m: '#b8bec8', M: '#6a707a', y: '#fff4c0' };

  const playerDown = fromRows([
    '....................',
    '.......kkkkkk.......',
    '.....kkoollookk.....',
    '....kooccccccook....',
    '...kocccCccCcccok...',
    '...kocCkkkkkkCcok...',
    '...kcCkhHhhHhkCck...',
    '..kCcCkhhhhhhkCcCk..',
    '..kCckssshhssskcCk..',
    '..kCckssessesskcCk..',
    '..kCckssessesskcCk..',
    '..kDCCkSSSSSSkCCDk..',
    '...kDCCkkkkkkCCDk...',
    '..koccoccCCccoccok..',
    '.kocccccDCCDcccccok.',
    '.kocCccccCCccccCcok.',
    '.kSkCCDDDDDDDDCCmMk.',
    '..kkkppppPPppppkMy..',
    '.....kpPPkkPPpk..y..',
    '....kbBbbkkbbBbk....',
  ], PL);

  const playerUp = fromRows([
    '....................',
    '.......kkkkkk.......',
    '.....kkoollookk.....',
    '....kooccccccook....',
    '...koccccooccccok...',
    '...koccccccccccok...',
    '...kocccCccCcccok...',
    '..kCcccccCCcccccCk..',
    '..kCccccCCCCccccCk..',
    '..kCcccCCCCCCcccCk..',
    '..kCCcCCDDDDCCcCCk..',
    '..kDCCCCDDDDCCCCDk..',
    '...kDDCCCCCCCCDDk...',
    '..koccoccCCccoccok..',
    '.kocccccDCCDcccccok.',
    '.kocCccccCCccccCcok.',
    '.kSkCCDDDDDDDDCCkSk.',
    '..kkkppppPPppppkkk..',
    '.....kpPPkkPPpk.....',
    '....kbBbbkkbbBbk....',
  ], PL);

  const playerRight = fromRows([
    '....................',
    '........kkkkkk......',
    '......kkoolllck.....',
    '.....kooccccccCk....',
    '....kocccccccccCk...',
    '....kocccccCkkkkCk..',
    '....kocccccCkhHhhk..',
    '....kcccccCkhhssk...',
    '....kCccccCkhsessk..',
    '....kCccccCksswssk..',
    '....kCcccccCksssSk..',
    '.....kCcccccCkSSk...',
    '.....kDCCCCCCkkk....',
    '....kocccccCCk......',
    '....koccccccCkmMk...',
    '....kocccccSSkMyyy..',
    '....kDCCCCCCkkkk....',
    '.....kpppppPPk......',
    '.....kppPk.kpPk.....',
    '.....kbBbk.kbBbbk...',
  ], PL);

  const ghost = fromRows([
    '....................',
    '......wwwwwwww......',
    '....wwwwwwwwwwww....',
    '...wwwwwwwwwwwwww...',
    '..wwwwwwwwwwwwwwWW..',
    '..wwwkkkwwwwkkkwWW..',
    '.wwwkkkkkwwkkkkkwWW.',
    '.wwwkkrkkwwkkrkkwWW.',
    '.wwwkkkkkwwkkkkkWWW.',
    '.wwwwkkkwwwwkkkwWWW.',
    '.wwwwwwwwkkwwwwwWWW.',
    '.wwwwwwwkkkkwwwwWWg.',
    '.Wwwwwwwkkkkwwwwwg..',
    '.WWwwwwwwkkwwwwwWg..',
    '.WWWwwwwwwwwwwwWWg..',
    '..WWWwwwwwwwwwWWg...',
    '..gWWWwwWWwwWWWgg...',
    '..g.WWWg.WWg.WWg....',
    '..g..Wg...Wg..Wg....',
    '.......g.....g......',
  ], { w: '#e4e2ee', W: '#a9a7c0', g: '#6e6c88', k: '#050308', r: '#c0001a' });

  const stalker = fromRows([
    '......kkkkkkk.......',
    '.....kpppppppk......',
    '....kpppppppppk.....',
    '....kpkkkpkkkpk.....',
    '....kpkrkpkrkPk.....',
    '....kpkkkpkkkPk.....',
    '....kppppPppppk.....',
    '....kpkkkkkkkPk.....',
    '....kPkrrrrrkPk.....',
    '.....kPkkkkkPk......',
    '...kkkPPPPPPPkkk....',
    '..kpPPPpppppPPPpk...',
    '..kpk.kPpppPk.kpk...',
    '..kpk.kPpppPk.kpk...',
    '..kPk.kPPPPPk.kPk...',
    '..kPk..kPkPk..kPk...',
    '.kPPk..kPkPk..kPPk..',
    '.kqkqk.kPkPk.kqkqk..',
    '........kPkPk.......',
    '.......kkk.kkk......',
  ], { p: '#dcd8cc', P: '#a39e90', q: '#6e6a60', k: '#000000', r: '#a00a0a' });


  // 얼굴을 머리카락으로 가린 흰 옷의 여자 (1·3단계 유령), 걸음 2장
  const WP = { k: '#000000', h: '#0b0b0e', H: '#24242c', s: '#cfcfc6', S: '#8e8e86',
    d: '#dcdad2', D: '#9c9a92', r: '#7a0008', e: '#ff1a1a' };
  const woman = [
    fromRows([
      '....................',
      '.......kkkkkk.......',
      '......khhhhhhk......',
      '.....khhHhhHhhk.....',
      '.....khhhhhhhhk.....',
      '....khhHhhhhHhhk....',
      '....khhhhshhhhhk....',
      '....khhhhehhHhhk....',
      '....khhhhShhhhhk....',
      '...khhhdddddhhhhk...',
      '...khhddddddddhhk...',
      '..ks.kdddddddDk.sk..',
      '..ks.kdddddddDk.sk..',
      '..kS.kddddddrDk.Sk..',
      '..kS.kdddddrdDk.Sk..',
      '..kss.kdddddDk.ssk..',
      '.....kddddddddDk....',
      '....kdDdDddDdDdDk...',
      '.....kDk.kDk.kDk....',
      '......s......s......',
    ], WP),
    fromRows([
      '....................',
      '.......kkkkkk.......',
      '......khhhhhhk......',
      '.....khHhhhhHhk.....',
      '.....khhhhhhhhk.....',
      '....khhhHhhhhHhk....',
      '....khhhhshhhhhk....',
      '....khhhhehhhhhk....',
      '....khhHhShhhhhk....',
      '...khhhdddddhhhhk...',
      '...khhddddddddhhk...',
      '...ks.kddddddDk.sk..',
      '..ks..kddddddDk.sk..',
      '..kS..kdddddrDk..Sk.',
      '..kS..kddddrdDk..Sk.',
      '.kss..kdddddDk...ssk',
      '.....kddddddddDk....',
      '.....kdDdDdDdDdk....',
      '....kDk.kDk.kDk.....',
      '.........s....s.....',
    ], WP),
  ];

  // 피 묻은 붕대를 감은 환자 (2단계 유령), 걸음 2장
  const PP = { k: '#000000', w: '#d6d2bc', r: '#8a0008', s: '#a8b09e', S: '#6e7666',
    g: '#8ea69e', G: '#5a6e68', e: '#ff1a1a' };
  const patient = [
    fromRows([
      '....................',
      '........kkkk........',
      '.......kwwwwk.......',
      '......kwwrwwwk......',
      '......kwwwwrwk......',
      '......kwewwewk......',
      '......kwwwwwwk......',
      '......kswwwwsk......',
      '.......kskksk.......',
      '.....kkgggggggkk....',
      '....kggggGgggggGk...',
      '...ksggggGggggggsk..',
      '...ksgggggGggrggsk..',
      '...kSggggGgggggGSk..',
      '...ks.kggggggrgk.sk.',
      '...ks.kgggGgggGk.sk.',
      '...kk.kggggggggk.kk.',
      '......kgGgk.kgGk....',
      '......ksSk...ksSk...',
      '......kkk.....kkk...',
    ], PP),
    fromRows([
      '....................',
      '.........kkkk.......',
      '........kwwwwk......',
      '.......kwwrwwwk.....',
      '.......kwwwwrwk.....',
      '.......kwewwewk.....',
      '.......kwwwwwwk.....',
      '.......kswwwwsk.....',
      '........kskksk......',
      '.....kkgggggggkk....',
      '....kggggGgggggGk...',
      '...ksggggGggggggsk..',
      '..ksggggggGggrggsk..',
      '..kSgggggGgggggGSk..',
      '..ks..kggggggrgk.sk.',
      '..ks..kgggGgggGk..sk',
      '..kk..kggggggggk..kk',
      '.....kgGgk..kgGk....',
      '.....ksSk....ksSk...',
      '.....kkk......kkk...',
    ], PP),
  ];
  // 3단계: 뼈만 남은 해골 병사, 걸음 2장 (그것은 누렇게 바랜 해골)
  const skelRows = [
    [
      '....................',
      '......kkkkkkkk......',
      '.....kwwwwwwwwk.....',
      '.....kwwwwwwwwk.....',
      '.....kwkkwwkkwk.....',
      '.....kwkewwekwk.....',
      '.....kWwwkkwwWk.....',
      '......kwkwwkwk......',
      '.......kkkkkk.......',
      '...kwwwwkwwkwwwwk...',
      '..kwk.kwwwwwwk.kwk..',
      '..kwk.kkkwwkkk.kwk..',
      '..kwk.kwwwwwwk.kwk..',
      '..kwk..kkwwkk..kwk..',
      '..kWk.kXwwwwXk.kWk..',
      '.kwXk.kwkkkkwk.kXwk.',
      '......kwk..kwk......',
      '......kwk..kwk......',
      '......kWk..kWk......',
      '.....kwwk..kwwk.....',
    ],
    [
      '....................',
      '......kkkkkkkk......',
      '.....kwwwwwwwwk.....',
      '.....kwwwwwwwwk.....',
      '.....kwkkwwkkwk.....',
      '.....kwkewwekwk.....',
      '.....kWwwkkwwWk.....',
      '......kwkwwkwk......',
      '.......kkkkkk.......',
      '...kwwwwkwwkwwwwk...',
      '..kwk.kwwwwwwk.kwk..',
      '..kwk.kkkwwkkk.kwk..',
      '..kwk.kwwwwwwk.kwk..',
      '..kwk..kkwwkk..kwk..',
      '..kWk.kXwwwwXk.kkwXk',
      '..kwk.kwkkkkwk......',
      '.......kwk.kwk......',
      '.......kwk.kwk......',
      '.......kWk.kWk......',
      '.......kwwkkwwk.....',
    ],
  ];
  const skeleton = skelRows.map(r => fromRows(r, { k: '#0c0a08', w: '#e6dfca', W: '#b2a88e', X: '#7a705a', e: '#ff2020' }));
  const boneStalker = fromRows(skelRows[0], { k: '#050403', w: '#cdbd94', W: '#8c7e60', X: '#584c36', e: '#ff3a10' });

  // 어둠 속에서 빛나는 눈 위치
  const eyes = { woman: [[9, 7]], patient: [[8, 5], [11, 5]], ghost: [[6, 7], [13, 7]], skeleton: [[8, 5], [11, 5]], stalker: [[8, 5], [11, 5]] };

  // ---------- 물건 ----------
  const key = fromRows([
    '....................',
    '....................',
    '....................',
    '.......kkkkk........',
    '......kyllyyk.......',
    '.....kyZkkkZYk......',
    '.....klk...kYk......',
    '.....kyk...kYk......',
    '.....kyYkkkYZk......',
    '......kYyyyZk.......',
    '.......kkyYkk.......',
    '........kyYk........',
    '........kyYk........',
    '........kyYkkk......',
    '........kyYyYk......',
    '........kyYkZk......',
    '........kyYyyk......',
    '........kyYkkk......',
    '.........kk.........',
    '....................',
  ], { y: '#e0b040', Y: '#a07020', Z: '#5a3a10', l: '#fff0a0', k: '#1a1000' });

  const pumpkinRows = [
    '....................',
    '....................',
    '.........kkk........',
    '........kgGkgk......',
    '.........kgGk.......',
    '......kkkkgGkk......',
    '....kkOolllloOkk....',
    '...kOolOLLLLOloOk...',
    '..kOoollollollooOk..',
    '..kOooFoollooFooOk..',
    '.kOOoFfFolloFfFoOOk.',
    '.kOooooooFFooooooOk.',
    '.kOoFoooFffFoooFoOk.',
    '.kOoffffffffffffoOk.',
    '.kOOofFFffffFFfoOOk.',
    '..kOOooFooooFooOOk..',
    '..kkOOoOooooOoOOkk..',
    '....kkkkOOOOkkkk....',
    '......kkkkkkkk......',
    '....................',
  ];
  const pumpkinPal = { k: '#2a0e00', O: '#8f3a0a', o: '#d8681a', l: '#f08c32', L: '#ffbe6a', g: '#5a7a26', G: '#2e4414', r: '#7a2a04' };
  const pumpkin = [
    fromRows(pumpkinRows, { ...pumpkinPal, f: '#fff0a0', F: '#ffb030' }),
    fromRows(pumpkinRows, { ...pumpkinPal, f: '#ffd060', F: '#ff8a18' }),
    fromRows(pumpkinRows, { ...pumpkinPal, f: '#5a1a04', F: '#3a1002' }),
  ];

  const candleBody = [
    '....................',
    '.........a..........',
    '........aFa.........',
    '........FcF.........',
    '.......aFcFa........',
    '........FcF.........',
    '.........k..........',
    '.......kdwwWk.......',
    '......kdwwwwWk......',
    '......kwdwwwXk......',
    '.....kdkwwwwXk......',
    '.....kwkwwwWXk......',
    '.....kXkwwwWXk......',
    '......kwwwwWXk......',
    '......kwwwWWXk......',
    '....kkYyyyyyYYkk....',
    '...kYyllyyyyyYYZk...',
    '....kZYYYYYYYYZk....',
    '.....kkkkkkkkkk.....',
    '....................',
  ];
  const candlePal = { k: '#1a1410', w: '#efe6cc', W: '#c8bd9a', X: '#958a6a', d: '#fffbea', y: '#c89a40', Y: '#8a6420', Z: '#4a3410', l: '#f6dc8a' };
  const candle = [
    fromRows(candleBody, { ...candlePal, a: '#ff7a10', F: '#ffc040', c: '#fff8d8' }),
    fromRows(candleBody, { ...candlePal, a: '#e85a08', F: '#ffa020', c: '#ffe8a0' }),
    fromRows(candleBody.map((r, y) => y < 6 ? '....................' : r), candlePal),
  ];

  const skull = fromRows([
    '....................',
    '....................',
    '....................',
    '....................',
    '......kkkkkkkk......',
    '.....kwwwwwwwwk.....',
    '....kwwwwllwwwwk....',
    '....kwwwwwwwwwwk....',
    '....kwkkkwwkkkwk....',
    '....kwkrkwwkkkwk....',
    '....kWwkwkkwkwWk....',
    '.....kWWWWWWWWk.....',
    '.....kwkwkkwkwk.....',
    '......kkkkkkkk......',
    '....................',
    '....................',
    '....................',
    '....................',
    '....................',
    '....................',
  ], { w: '#e8dec6', W: '#b0a284', l: '#fffaf0', k: '#0a0806', r: '#c00010' });

  // 엇갈린 뼈 두 개: 선분까지의 거리로 그리고, 양 끝에 둥근 마디를 붙인다
  const bones = pix((x, y) => {
    let best = 9;
    for (const [ax, ay, bx, by] of [[4, 6, 15, 15], [15, 6, 4, 15]]) {
      const vx = bx - ax, vy = by - ay, t = U.clamp(((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy), 0, 1);
      best = Math.min(best, Math.hypot(x - ax - vx * t, y - ay - vy * t) - 0.2);
      const nx = -vy / Math.hypot(vx, vy), ny = vx / Math.hypot(vx, vy);
      for (const [ex, ey] of [[ax, ay], [bx, by]]) for (const sgn of [-1, 1]) best = Math.min(best, Math.hypot(x - ex - nx * sgn, y - ey - ny * sgn) - 0.5);
    }
    if (best > 1.6) return null;
    if (best > 1.05) return [42, 36, 26];
    const sh = 0.82 + U.hash(x, y, 61) * 0.12 - (best > 0.5 ? 0.18 : 0);
    return [216 * sh, 206 * sh, 182 * sh];
  });

  const hand = fromRows([
    '....................',
    '....................',
    '......r..r..........',
    '...r..r..r..r.......',
    '...r..r..r..r.......',
    '...rr.rr.rr.r.......',
    '...rr.rr.rr.rr......',
    '....rrrrrrrrrr......',
    '....rrrrrrrrrr..r...',
    '....rrrrrrrrrr.rr...',
    '....rrrrrrrrrrrr....',
    '.....rrrrrrrrrr.....',
    '.....rrrrrrrrr......',
    '......rrrrrrr.......',
    '......rRrrrRr.......',
    '.......r..r.R.......',
    '.......R....r.......',
    '............R.......',
  ], { r: 'rgba(122,0,8,0.85)', R: 'rgba(80,0,5,0.8)' });

  function blood(seed) {
    const cx = 7 + U.hash(seed, 1) * 6, cy = 7 + U.hash(seed, 2) * 6, rad = 3.5 + U.hash(seed, 3) * 3;
    return pix((x, y) => {
      const dx = x - cx, dy = y - cy, d = Math.sqrt(dx * dx + dy * dy);
      const edge = rad + (U.noise(x * 0.5, y * 0.5, seed) - 0.5) * 4;
      const drop = d < 9.5 && U.hash(x, y, seed + 9) < 0.05;
      if (d < edge || drop) {
        const s = 0.7 + U.hash(x, y, seed) * 0.35;
        return [110 * s, 4, 8, 215];
      }
      return null;
    });
  }

  // 바닥 탈출구 (나무 뚜껑문)
  const trapdoor = pix((x, y) => {
    if (x === 0 || y === 0 || x === 19 || y === 19) return [14, 9, 5];
    if (x === 1 || y === 1 || x === 18 || y === 18) return [30, 20, 12];
    const ring = Math.abs(Math.hypot(x - 9.5, y - 9.5) - 3);
    if (ring < 0.7) return [96, 96, 100];
    if (y === 5 || y === 14) return (x % 4 === 2) ? [130, 130, 136] : [62, 62, 68];
    if (x % 5 === 0) return [8, 5, 3];
    const n = 0.75 + U.noise(x * 0.4, y * 1.3, 7) * 0.4;
    return [62 * n, 38 * n, 22 * n];
  });
  const trapGlow = pix((x, y) => {
    if (x < 2 || y < 2 || x > 17 || y > 17) return null;
    if (y === 5 || y === 14) return null;
    if (x % 5 === 0) return [255, 70 + U.hash(x, y, 4) * 60, 20, 255];
    return null;
  });

  // ---------- 단계별 바닥과 벽 ----------
  function tilesFor(stage) {
    const floor = [], wall = [], front = [];
    for (let v = 0; v < 4; v++) {
      if (stage === 0) {
        // 낡은 나무 바닥 + 어두운 벽지 + 나무 징두리 판
        floor.push(pix((x, y) => {
          const row = Math.floor(y / 5), seam = (row * 7 + v * 5) % 20;
          const n = 0.72 + U.noise(x * 0.22 + v * 13, y * 1.6 + row * 3, 11) * 0.4;
          let r = 96 * n, g = 64 * n, b = 40 * n;
          if (y % 5 === 4 || x === seam) { r *= 0.42; g *= 0.42; b *= 0.42; }
          if (U.hash(x, y, v + 3) < 0.05) { r *= 0.75; g *= 0.75; b *= 0.75; }
          return [r, g, b];
        }));
        const top = (x, y) => {
          const pat = ((x + y + v) % 6 === 0 || (x - y + 60 + v) % 6 === 0) ? 1.25 : 1;
          const n = (0.8 + U.hash(x, y, v + 20) * 0.3) * pat;
          return [34 * n, 20 * n, 30 * n];
        };
        wall.push(pix(top));
        front.push(pix((x, y) => {
          if (y < 12) return top(x, y);
          if (y === 12) return [96, 64, 42];
          if (y === 19) return [16, 10, 6];
          const n = 0.8 + U.hash(x, y, v + 30) * 0.25;
          if (x % 5 === 0) return [30 * n, 18 * n, 11 * n];
          return [60 * n, 38 * n, 25 * n];
        }));
      } else if (stage === 1) {
        // 병원 타일 바닥 + 칠이 벗겨진 녹색 벽
        floor.push(pix((x, y) => {
          const ck = ((x < 10) !== (y < 10));
          let r = ck ? 124 : 88, g = ck ? 130 : 97, b = ck ? 114 : 88;
          if (x % 10 === 0 || y % 10 === 0) { r *= 0.62; g *= 0.62; b *= 0.62; }
          const grime = 1 - U.smooth(0.45, 0.85, U.noise(x * 0.3 + v * 9, y * 0.3, 40)) * 0.45;
          r *= grime; g *= grime; b *= grime;
          if (U.hash(x, y, v + 50) < 0.03) { r = 70; g = 12; b = 12; }
          return [r, g, b];
        }));
        const top = (x, y) => {
          const n = 0.8 + U.noise(x * 0.5, y * 0.5, v + 60) * 0.35;
          return [56 * n, 68 * n, 62 * n];
        };
        wall.push(pix(top));
        front.push(pix((x, y) => {
          if (y < 12) return top(x, y);
          if (y === 12) return [30, 36, 32];
          if (y === 19) return [14, 16, 15];
          let n = 0.85 + U.hash(x, y, v + 70) * 0.2;
          if (U.hash(x, 0, v + 71) < 0.25 && y > 13) n *= 0.6; // 흘러내린 얼룩
          if (x % 5 === 0 || y === 16) return [70 * n, 82 * n, 72 * n];
          return [128 * n, 150 * n, 130 * n];
        }));
      } else {
        // 납골당 돌바닥 + 돌벽돌
        floor.push(pix((x, y) => {
          let best = 9, second = 9, cell = 0;
          const gx = Math.floor(x / 6), gy = Math.floor(y / 6);
          for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
            const cx = gx + ox, cy = gy + oy;
            const px = cx * 6 + U.hash(cx, cy, v + 80) * 6, py = cy * 6 + U.hash(cx, cy, v + 81) * 6;
            const d = Math.hypot(x - px, y - py);
            if (d < best) { second = best; best = d; cell = U.hash(cx, cy, v + 82); }
            else if (d < second) second = d;
          }
          if (second - best < 1.1) return [20, 17, 15];
          const n = (0.75 + cell * 0.35) * (0.9 + U.hash(x, y, v + 83) * 0.15);
          return [60 * n, 53 * n, 47 * n];
        }));
        const top = (x, y) => {
          const n = 0.75 + U.noise(x * 0.6, y * 0.6, v + 90) * 0.4;
          const crack = Math.abs(U.noise(x * 0.25, y * 0.25, v + 91) - 0.5) < 0.03;
          return crack ? [14, 12, 11] : [46 * n, 42 * n, 40 * n];
        };
        wall.push(pix(top));
        front.push(pix((x, y) => {
          if (y < 11) return top(x, y);
          if (y === 19) return [10, 9, 8];
          const row = Math.floor((y - 11) / 4), off = row % 2 ? 5 : 0;
          if ((y - 11) % 4 === 3 || (x + off) % 10 === 0) return [22, 20, 18];
          const n = 0.7 + U.hash(Math.floor((x + off) / 10), row, v + 92) * 0.4;
          if (y > 16 && U.hash(x, y, v + 93) < 0.3) return [34, 52, 28];
          return [72 * n, 64 * n, 58 * n];
        }));
      }
    }
    return { floor, wall, front };
  }

  return {
    S, pix, flip,
    player: { d: playerDown, u: playerUp, r: playerRight, l: flip(playerRight) },
    ghost, stalker: boneStalker, woman, patient, skeleton, eyes, key, pumpkin, candle, skull, bones, hand, trapdoor, trapGlow,
    blood: [blood(3), blood(17), blood(31), blood(55)],
    tilesFor,
  };
})();
