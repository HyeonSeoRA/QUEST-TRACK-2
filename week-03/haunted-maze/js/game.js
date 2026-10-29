'use strict';
// 게임 본체: 이동, 손전등, 유령, 갑툭튀 이벤트, 점수

const TILE = 20, VW = 480, VH = 300;
const CONE = 0.5;          // 손전등 빛 각도의 절반 (라디안)
const PLAYER_SPEED = 6.5;  // 초당 칸 수

// 모든 플레이어가 같은 미로, 같은 유령 배치, 같은 함정에서 겨룬다 (시드 고정)
const STAGES = [
  {
    name: '1단계', title: '버려진 저택', sub: '누군가 아직 이 집에 살고 있다',
    seed: 1031, cw: 7, ch: 7, loops: 0.15, dark: 0.7,
    light: 7, amb: 2.8, flicker: 0.01, ghosts: 2, wander: 3.0, chase: 4.9, sight: 6,
    tint: [255, 200, 140], enemy: 'woman',
    stalker: false, base: 1000, rate: 40, lightType: 'pumpkin', lightCount: 8, blood: 5, bones: 3,
    scares: [
      { seg: 0, at: 0.22, type: 'watcher' }, { seg: 0, at: 0.4, type: 'footsteps' },
      { seg: 0, at: 0.75, type: 'runner' }, { seg: 1, at: 0.3, type: 'handprints' },
      { seg: 1, at: 0.55, type: 'crawler' }, { seg: 1, at: 0.72, type: 'face' },
      { seg: 1, at: 0.15, type: 'prints' },
    ],
    faceType: 0, texts: ['나가'],
  },
  {
    name: '2단계', title: '폐쇄 병동', sub: '환자들은 아무도 퇴원하지 못했다',
    seed: 2031, cw: 9, ch: 9, loops: 0.15, dark: 0.78,
    light: 6.3, amb: 2.5, flicker: 0.03, ghosts: 3, wander: 3.4, chase: 5.1, sight: 7,
    tint: [190, 235, 215], enemy: 'patient',
    stalker: false, base: 2500, rate: 80, lightType: 'candle', lightCount: 9, blood: 14, bones: 4,
    scares: [
      { seg: 0, at: 0.22, type: 'handprints' }, { seg: 0, at: 0.48, type: 'runner' },
      { seg: 0, at: 0.64, type: 'watcher' }, { seg: 0, at: 0.85, type: 'runner' },
      { seg: 1, at: 0.12, type: 'crawler' }, { seg: 1, at: 0.25, type: 'text' },
      { seg: 1, at: 0.5, type: 'blackout' }, { seg: 1, at: 0.68, type: 'footsteps' },
      { seg: 1, at: 0.86, type: 'face' }, { seg: 0, at: 0.35, type: 'prints' },
    ],
    faceType: 1, texts: ['뒤에 있어'],
  },
  {
    name: '3단계', title: '지하 납골당', sub: '그것은 네가 보지 않을 때만 움직인다',
    seed: 3031, cw: 11, ch: 11, loops: 0.15, dark: 0.81,
    light: 6.0, amb: 2.4, flicker: 0.04, ghosts: 1, wander: 3.8, chase: 5.5, sight: 8,
    tint: [255, 150, 130], enemy: 'skeleton',
    stalker: true, stalkerSpeed: 5.4, base: 5000, rate: 140, lightType: 'both', lightCount: 28, lightGap: 3, extraPumpkins: 3, glowR: 2.1, glowA: 0.88, blood: 26, bones: 18,
    scares: [
      { seg: 0, at: 0.18, type: 'footsteps' }, { seg: 0, at: 0.36, type: 'blackout' },
      { seg: 0, at: 0.55, type: 'text' }, { seg: 0, at: 0.7, type: 'crawler' },
      { seg: 0, at: 0.84, type: 'face' }, { seg: 1, at: 0.1, type: 'watcher' },
      { seg: 1, at: 0.22, type: 'handprints' }, { seg: 1, at: 0.42, type: 'runner' },
      { seg: 1, at: 0.62, type: 'footsteps' }, { seg: 1, at: 0.8, type: 'face' },
      { seg: 1, at: 0.33, type: 'prints' },
    ],
    faceType: 2, texts: ['너도 여기 남아'],
  },
];
const LIFE_BONUS = 1500;

// 오늘의 악몽: 같은 날에는 모두 같은 미로·같은 저주. 날이 바뀌면 바뀐다
const CURSES = [
  { name: '짙은 안개', desc: '손전등 빛이 짧아진다', apply: S => { S.light -= 0.8; S.dark = Math.min(1, S.dark + 0.05); } },
  { name: '굶주린 밤', desc: '유령이 조금 더 빠르다', apply: S => { S.chase += 0.3; S.wander += 0.3; if (S.stalkerSpeed) S.stalkerSpeed += 0.2; } },
  { name: '정전', desc: '손전등이 자주 깜빡인다', apply: S => { S.flicker = S.flicker * 2.5 + 0.02; } },
  { name: '핏빛 달', desc: '모든 것이 붉고, 갑툭튀가 늘어난다', apply: S => { S.tint = [255, 70, 60]; S.bloodRain = true; S.scares = S.scares.concat([{ seg: 0, at: 0.6, type: 'face' }, { seg: 1, at: 0.45, type: 'runner' }]); } },
  { name: '고요', desc: '심장 소리가 들리지 않는다', apply: S => { S.silent = true; } },
];
const dailyCurse = day => CURSES[day % CURSES.length];

const Game = (() => {
  const view = document.getElementById('view');
  const ctx = view.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const dark = U.canvas(VW / 2, VH / 2), dctx = dark.getContext('2d');
  const tmp = U.canvas(VW, VH), tctx = tmp.getContext('2d');
  const hud = {
    stage: document.getElementById('hStage'), time: document.getElementById('hTime'),
    bonus: document.getElementById('hBonus'), score: document.getElementById('hScore'),
    lives: document.getElementById('hLives'), key: document.getElementById('hKey'),
    msg: document.getElementById('msg'),
  };

  let G = null;
  let cb = {};  // main.js 에 알릴 일 (단계 시작, 단계 통과, 게임 끝)
  let RUN = { daily: 0, curse: null };

  function stageFor(idx) {
    const S = { ...STAGES[idx], scares: STAGES[idx].scares.slice() };
    if (RUN.daily) {
      S.seed = (STAGES[idx].seed * 31 + RUN.daily * 7 + idx * 101) % 2147483647;
      RUN.curse.apply(S);
      S.curse = RUN.curse;
    }
    return S;
  }
  const held = [];
  let lockHeld = false;

  // 정적 효과 미리 만들기
  const vignette = (() => {
    const c = U.canvas(VW, VH), x = c.getContext('2d');
    const g = x.createRadialGradient(VW / 2, VH / 2, VH * 0.25, VW / 2, VH / 2, VW * 0.62);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.5)');
    x.fillStyle = g; x.fillRect(0, 0, VW, VH);
    return c;
  })();
  const redVig = (() => {
    const c = U.canvas(VW, VH), x = c.getContext('2d');
    const g = x.createRadialGradient(VW / 2, VH / 2, VH * 0.2, VW / 2, VH / 2, VW * 0.6);
    g.addColorStop(0, 'rgba(120,0,0,0)'); g.addColorStop(1, 'rgba(150,0,0,0.9)');
    x.fillStyle = g; x.fillRect(0, 0, VW, VH);
    return c;
  })();
  const SHADE = ['rgba(0,0,0,0.4)', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.7)', 'rgba(0,0,0,0.8)'];
  const noiseFrames = [];
  for (let k = 0; k < 6; k++) {
    const c = U.canvas(VW / 2, VH / 2), x = c.getContext('2d'), im = x.createImageData(VW / 2, VH / 2);
    for (let i = 0; i < im.data.length; i += 4) {
      const v = Math.random() * 255;
      im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = Math.random() < 0.5 ? 255 : 0;
    }
    x.putImageData(im, 0, 0);
    noiseFrames.push(c);
  }

  // ---------- 입력 ----------
  const KEYMAP = { ArrowUp: 'u', KeyW: 'u', ArrowDown: 'd', KeyS: 'd', ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r' };
  const DV = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] };
  addEventListener('keydown', e => {
    if (!G) return;
    const d = KEYMAP[e.code];
    if (d) { e.preventDefault(); const i = held.indexOf(d); if (i >= 0) held.splice(i, 1); held.push(d); }
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'Space') { e.preventDefault(); lockHeld = true; }
    if (e.code === 'Escape' && !e.repeat) togglePause();
  });
  addEventListener('keyup', e => {
    const d = KEYMAP[e.code];
    if (d) { const i = held.indexOf(d); if (i >= 0) held.splice(i, 1); }
    if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'Space') lockHeld = false;
  });
  addEventListener('blur', () => { held.length = 0; lockHeld = false; if (G && G.state === 'play') togglePause(); });

  // ---------- 단계 만들기 ----------
  function isWall(x, y) {
    if (x < 0 || y < 0 || x >= G.W || y >= G.H) return true;
    return G.g[y * G.W + x] === 1;
  }

  const isWallRaw = (g, W, x, y) => y < 0 || x < 0 || x >= W || g[y * W + x] === 1;

  function buildStage(idx) {
    const S = stageFor(idx);
    const mz = Maze.generate(S.cw, S.ch, S.seed, S.loops);
    const W = mz.W, H = mz.H, g = mz.g;
    const rnd = U.rng(S.seed * 7 + 1);
    const start = { x: 1, y: 1 };
    // 탈출구: 시작점에서 가장 먼 막다른 길
    let dS = Maze.bfs(mz, 1, 1);
    let door = null, best = -1;
    for (let y = 1; y < H; y += 2) for (let x = 1; x < W; x += 2) {
      const i = y * W + x;
      if (g[i] || (x === 1 && y === 1)) continue;
      let open = 0;
      for (const [dx, dy] of DIR4) if (!g[(y + dy) * W + x + dx]) open++;
      if (open === 1 && dS[i] > best) { best = dS[i]; door = { x, y }; }
    }
    // 나머지 막다른 길은 모두 뚫는다 → 쫓겨도 운 나쁘게 갇히는 일이 없다
    const blockDoor = (x, y) => x === door.x && y === door.y;
    Maze.braid(mz, rnd, blockDoor);
    dS = Maze.bfs(mz, 1, 1, blockDoor);
    const dD = Maze.bfs(mz, door.x, door.y);
    // 열쇠: 시작점에서도, 탈출구에서도 먼 곳
    let key = start; best = -1;
    for (let y = 1; y < H; y += 2) for (let x = 1; x < W; x += 2) {
      const i = y * W + x;
      if (g[i] || blockDoor(x, y)) continue;
      const sc = Math.min(dS[i], dD[i]) * 2 + dS[i] + dD[i];
      if (sc > best) { best = sc; key = { x, y }; }
    }
    const path0 = Maze.path(mz, start, key, blockDoor), path1 = Maze.path(mz, key, door);
    const par = Math.ceil((path0.length + path1.length) / PLAYER_SPEED * 1.9 + 8);

    const floorCells = [];
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) if (!g[y * W + x]) floorCells.push({ x, y });
    const maxD = Math.max(...dS);

    // 유령은 시작 지점에서 먼 곳에, 서로 떨어져서
    const spawns = [];
    const want = S.ghosts + (S.stalker ? 1 : 0);
    for (let tries = 0; spawns.length < want && tries < 5000; tries++) {
      const c = floorCells[Math.floor(rnd() * floorCells.length)];
      if (dS[c.y * W + c.x] < maxD * 0.42 || blockDoor(c.x, c.y)) continue;
      if (spawns.some(s => Math.abs(s.x - c.x) + Math.abs(s.y - c.y) < 8)) continue;
      if (c.x === key.x && c.y === key.y) continue;
      spawns.push(c);
    }

    // 호박등 / 촛불 (빛이 나는 장식)
    const lights = [];
    for (let tries = 0; lights.length < S.lightCount && tries < 5000; tries++) {
      const c = floorCells[Math.floor(rnd() * floorCells.length)];
      if (blockDoor(c.x, c.y) || (c.x === key.x && c.y === key.y) || (c.x === 1 && c.y === 1)) continue;
      if (lights.some(l => Math.abs(l.x - c.x) + Math.abs(l.y - c.y) < (S.lightGap || 6))) continue;
      const type = S.lightType === 'both' ? (rnd() < 0.65 ? 'pumpkin' : 'candle') : S.lightType;
      lights.push({ x: c.x, y: c.y, type, ph: rnd() * 10 });
    }
    // 불빛이 가장 드문 곳을 골라 호박을 더 놓는다
    for (let n = 0; n < (S.extraPumpkins || 0); n++) {
      let pick = null, far = -1;
      for (const c of floorCells) {
        if (blockDoor(c.x, c.y) || (c.x === key.x && c.y === key.y) || (c.x === 1 && c.y === 1)) continue;
        const d = Math.min(...lights.map(l => Math.abs(l.x - c.x) + Math.abs(l.y - c.y)));
        if (d > far) { far = d; pick = c; }
      }
      if (pick) lights.push({ x: pick.x, y: pick.y, type: 'pumpkin', ph: n * 3.7 });
    }

    // 단계별 소품: 1단계 초상화, 2단계 휠체어, 3단계 관
    const decor = [];
    const kind = ['portrait', 'chair', 'coffin'][idx], want2 = [7, 4, 8][idx];
    const cand = floorCells.filter(c => (kind === 'chair' || isWallRaw(g, W, c.x, c.y - 1)) && !blockDoor(c.x, c.y) &&
      !(c.x === key.x && c.y === key.y) && !(c.x === 1 && c.y === 1) && !lights.some(l => l.x === c.x && l.y === c.y))
      .sort((a, b) => U.hash(a.x, a.y, S.seed + 5) - U.hash(b.x, b.y, S.seed + 5));
    for (const c of cand) {
      if (decor.length >= want2) break;
      if (decor.some(d => Math.abs(d.x - c.x) + Math.abs(d.y - c.y) < 5)) continue;
      decor.push({ kind, x: c.x, y: c.y, ox: 0, oy: 0, tx: 0, ty: 0, open: false, red: false, moveT: 2 + U.hash(c.x, c.y, 9) * 3 });
    }

    const taken = c => blockDoor(c.x, c.y) || (c.x === key.x && c.y === key.y) || (Math.abs(c.x - 1) + Math.abs(c.y - 1) < 3) ||
      lights.some(l => l.x === c.x && l.y === c.y) || decor.some(d => d.x === c.x && d.y === c.y);
    const byHash = k => floorCells.filter(c => !taken(c)).sort((a, b) => U.hash(a.x, a.y, S.seed + k) - U.hash(b.x, b.y, S.seed + k));
    const creaks = new Set(), shutters = [];
    if (idx === 0) {
      const got = [];
      for (const c of byHash(41)) {
        if (got.length >= 10) break;
        if (got.some(o => Math.abs(o.x - c.x) + Math.abs(o.y - c.y) < 3)) continue;
        got.push(c); creaks.add(c.x + ',' + c.y);
      }
    }
    if (idx === 1) {
      for (const c of byHash(43)) {
        if (shutters.length >= 5) break;
        const wl = isWallRaw(g, W, c.x - 1, c.y), wr = isWallRaw(g, W, c.x + 1, c.y), wu = isWallRaw(g, W, c.x, c.y - 1), wd = isWallRaw(g, W, c.x, c.y + 1);
        const vert = wl && wr && !wu && !wd, horiz = wu && wd && !wl && !wr;
        if (!vert && !horiz) continue;
        if (shutters.some(o => Math.abs(o.x - c.x) + Math.abs(o.y - c.y) < 5)) continue;
        shutters.push({ x: c.x, y: c.y, vert, ph: U.hash(c.x, c.y, S.seed + 44) * 4 });
      }
    }

    const scares = S.scares.map(s => {
      const p = s.seg ? path1 : path0;
      const c = p[Math.max(1, Math.floor(s.at * (p.length - 1)))];
      return { x: c.x, y: c.y, type: s.type, done: false };
    });

    G = {
      idx, S, W, H, g, mz, rnd, start, key, door, par, spawns, lights, scares, floorCells, decor, creaks, shutters,
      idleT: 0, idleStage: 0, staticT: 0, staticDone: [],
      map: null, mapCtx: null, hasKey: false,
      player: null, enemies: [], fx: [], event: null,
      state: 'intro', stageTime: 0, t: 0,
      lives: G ? G.lives : 3, score: G ? G.score : 0, results: G ? G.results : [],
      shake: 0, hbT: 0, danger: 0, msgT: 0, flick: 1, keyDoorHint: 0, lightsOutT: 0,
      stalkerSeenT: 0, wobble: 0, faceFx: null, forceDarkT: 0, redFlash: 0, drips: [], subT: 3, subFlash: 0,
      motes: Array.from({ length: 36 }, () => ({ x: 99, y: 99, vx: (Math.random() - 0.5) * 0.2, vy: (Math.random() - 0.5) * 0.2, ph: Math.random() * 6 })),
    };
    G.seen = new Uint8Array(W * H);
    renderMap(rnd);
    resetActors();
  }

  function renderMap(rnd) {
    const S = G.S, W = G.W, H = G.H;
    const c = U.canvas(W * TILE, H * TILE), m = c.getContext('2d');
    const tiles = Sprites.tilesFor(G.idx);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const v = Math.floor(U.hash(x, y, S.seed) * 4);
        let img;
        if (isWall(x, y)) img = (y + 1 < H && !isWall(x, y + 1)) ? tiles.front[v] : tiles.wall[v];
        else img = tiles.floor[v];
        m.drawImage(img, x * TILE, y * TILE);
      }
    }
    // 벽 밑 그림자
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (isWall(x, y)) continue;
        const px = x * TILE, py = y * TILE;
        if (isWall(x, y - 1)) { m.fillStyle = 'rgba(0,0,0,0.45)'; m.fillRect(px, py, TILE, 3); m.fillStyle = 'rgba(0,0,0,0.2)'; m.fillRect(px, py + 3, TILE, 2); }
        if (isWall(x - 1, y)) { m.fillStyle = 'rgba(0,0,0,0.3)'; m.fillRect(px, py, 3, TILE); }
        if (isWall(x + 1, y)) { m.fillStyle = 'rgba(0,0,0,0.2)'; m.fillRect(px + TILE - 2, py, 2, TILE); }
      }
    }
    detailMap(m);
    // 핏자국, 뼈, 해골
    const cells = G.floorCells;
    for (let i = 0; i < S.blood; i++) {
      const p = cells[Math.floor(rnd() * cells.length)];
      m.drawImage(Sprites.blood[Math.floor(rnd() * 4)], p.x * TILE, p.y * TILE);
    }
    for (let i = 0; i < S.bones; i++) {
      const p = cells[Math.floor(rnd() * cells.length)];
      m.drawImage(rnd() < 0.4 ? Sprites.skull : Sprites.bones, p.x * TILE, p.y * TILE);
    }
    // 끌린 핏자국 (2단계부터)
    if (G.idx > 0) {
      for (let i = 0; i < G.idx * 4; i++) {
        const p = cells[Math.floor(rnd() * cells.length)];
        m.fillStyle = 'rgba(90,0,6,0.7)';
        const horiz = !isWall(p.x + 1, p.y);
        for (let k = 0; k < 30; k++) {
          const a = k / 30;
          if (horiz) m.fillRect(p.x * TILE + 4 + a * 34, p.y * TILE + 9 + Math.sin(a * 9) * 1.5, 2, 2 + (k % 3));
          else m.fillRect(p.x * TILE + 9 + Math.sin(a * 9) * 1.5, p.y * TILE + 4 + a * 34, 2 + (k % 3), 2);
        }
      }
    }
    // 핏물이 흘러내리는 벽 (2단계부터)
    if (G.idx > 0) {
      const fronts = [];
      for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) if (isWall(x, y) && !isWall(x, y + 1)) fronts.push({ x, y });
      for (let i = 0; i < G.idx * 12 && fronts.length; i++) {
        const f = fronts[Math.floor(rnd() * fronts.length)], ox = 3 + Math.floor(rnd() * 14);
        m.fillStyle = 'rgba(80,0,5,0.85)';
        m.fillRect(f.x * TILE + ox, f.y * TILE + 9, 1, 4 + Math.floor(rnd() * 5));
        m.fillRect(f.x * TILE + ox - 1, f.y * TILE + 9, 3, 2);
        G.drips.push({ x: f.x, y: f.y, ox, ph: rnd() * 3, per: 1.4 + rnd() * 1.6 });
      }
    }
    // 삐걱이는 마루: 들뜨고 금 간 널빤지 (보고 피할 수 있게 표시)
    for (const k of G.creaks) {
      const [x, y] = k.split(',').map(Number), px = x * TILE, py = y * TILE;
      m.fillStyle = 'rgba(20,10,4,0.55)'; m.fillRect(px + 2, py + 5, 16, 9);
      m.fillStyle = 'rgba(130,90,55,0.55)'; m.fillRect(px + 2, py + 5, 16, 1);
      m.fillStyle = 'rgba(0,0,0,0.75)';
      for (let i = 0; i < 7; i++) m.fillRect(px + 4 + i * 2, py + 8 + (i % 2), 2, 1);
      m.fillStyle = 'rgba(170,170,180,0.8)'; m.fillRect(px + 3, py + 6, 1, 1); m.fillRect(px + 16, py + 12, 1, 1);
    }
    m.drawImage(Sprites.trapdoor, G.door.x * TILE, G.door.y * TILE);
    G.map = c; G.mapCtx = m;
  }

  // 미로를 도트 한 점 한 점 꾸민다 (모두에게 같도록 위치는 해시로 정한다)
  function detailMap(m) {
    const S = G.S, W = G.W, H = G.H, sd = S.seed;
    const dot = (x, y, c) => { m.fillStyle = c; m.fillRect(x, y, 1, 1); };
    const h = (x, y, k) => U.hash(x, y, sd + k);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const px = x * TILE, py = y * TILE;
        if (isWall(x, y)) {
          const front = y + 1 < H && !isWall(x, y + 1), topH = front ? 12 : 20;
          // 벽 윗면의 모서리: 빛 받는 쪽은 밝게, 반대쪽은 어둡게
          if (y > 0 && !isWall(x, y - 1)) { m.fillStyle = 'rgba(255,240,220,0.14)'; m.fillRect(px, py, TILE, 1); }
          if (x > 0 && !isWall(x - 1, y)) { m.fillStyle = 'rgba(255,240,220,0.1)'; m.fillRect(px, py, 1, topH); }
          if (x < W - 1 && !isWall(x + 1, y)) { m.fillStyle = 'rgba(0,0,0,0.3)'; m.fillRect(px + TILE - 1, py, 1, topH); }
          if (front) {
            m.fillStyle = 'rgba(0,0,0,0.35)'; m.fillRect(px, py + 11, TILE, 1);
            const r = h(x, y, 1);
            if (G.idx === 0 && r < 0.22) {
              // 찢어져 벗겨진 벽지
              for (let i = 0; i < 6; i++) for (let j = 0; j < 4 + (i % 3); j++) dot(px + 6 + i, py + 3 + j, `rgba(120,90,80,${0.35 - j * 0.05})`);
              for (let i = 0; i < 6; i++) dot(px + 6 + i, py + 7 + (i % 3), 'rgba(20,10,10,0.5)');
            } else if (G.idx === 1 && r < 0.3) {
              // 곰팡이와 긁힌 자국
              for (let i = 0; i < 14; i++) dot(px + 3 + Math.floor(h(x, y, 10 + i) * 14), py + 12 + Math.floor(h(x, y, 30 + i) * 7), 'rgba(40,60,30,0.55)');
              for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) dot(px + 5 + i * 2 + j, py + 13 + j, 'rgba(10,10,10,0.5)');
            } else if (G.idx === 2 && r < 0.3) {
              // 벽에 박힌 쇠사슬
              const cx = px + 4 + Math.floor(h(x, y, 2) * 12);
              for (let j = 0; j < 9; j++) dot(cx, py + 11 + j, j % 2 ? 'rgba(150,150,160,0.8)' : 'rgba(60,60,70,0.9)');
              dot(cx - 1, py + 19, 'rgba(120,120,130,0.8)'); dot(cx + 1, py + 19, 'rgba(120,120,130,0.8)');
            } else if (G.idx === 2 && r < 0.42) {
              // 벽 틈에 끼워 둔 해골
              const cx = px + 7 + Math.floor(h(x, y, 3) * 6);
              m.fillStyle = 'rgba(200,190,170,0.9)'; m.fillRect(cx, py + 13, 5, 4);
              dot(cx + 1, py + 14, '#000'); dot(cx + 3, py + 14, '#000'); dot(cx + 2, py + 16, '#000');
            }
          }
          continue;
        }
        const r = h(x, y, 5);
        // 금 간 바닥
        if (r < 0.2) {
          let cx = px + 3 + Math.floor(h(x, y, 6) * 14), cy = py + 3 + Math.floor(h(x, y, 7) * 14);
          for (let i = 0; i < 9; i++) {
            dot(cx, cy, 'rgba(0,0,0,0.45)');
            cx += h(x, y, 40 + i) < 0.5 ? 1 : 0; cy += h(x, y, 60 + i) < 0.5 ? 1 : -1;
            if (i === 4 && h(x, y, 8) < 0.5) dot(cx + 1, cy - 1, 'rgba(0,0,0,0.35)');
          }
        }
        // 먼지
        for (let i = 0; i < 3; i++) if (h(x, y, 80 + i) < 0.5) dot(px + Math.floor(h(x, y, 90 + i) * 20), py + Math.floor(h(x, y, 95 + i) * 20), 'rgba(255,240,220,0.08)');
        // 구석의 거미줄 (1·3단계)
        if (G.idx !== 1 && isWall(x, y - 1) && (isWall(x - 1, y) || isWall(x + 1, y)) && h(x, y, 9) < 0.55) {
          const left = isWall(x - 1, y), ox = left ? px : px + TILE - 1, sx = left ? 1 : -1;
          for (let i = 0; i < 8; i++) { dot(ox + sx * i, py + 2 + Math.floor(i * 0.3), 'rgba(210,210,220,0.18)'); dot(ox + sx * Math.floor(i * 0.5), py + 2 + i, 'rgba(210,210,220,0.18)'); }
          for (let i = 1; i < 6; i++) dot(ox + sx * i, py + 2 + i, 'rgba(210,210,220,0.22)');
          for (let i = 0; i < 4; i++) dot(ox + sx * (5 - i), py + 3 + i, 'rgba(210,210,220,0.15)');
        }
        const r2 = h(x, y, 11);
        if (G.idx === 0 && r2 < 0.16 && !isWall(x - 1, y) && !isWall(x + 1, y)) {
          // 낡은 붉은 카펫
          m.fillStyle = 'rgba(90,16,20,0.85)'; m.fillRect(px, py + 5, TILE, 10);
          m.fillStyle = 'rgba(170,120,50,0.6)'; m.fillRect(px, py + 6, TILE, 1); m.fillRect(px, py + 13, TILE, 1);
          for (let i = 0; i < TILE; i += 4) { dot(px + i + 1, py + 9, 'rgba(170,120,50,0.5)'); dot(px + i + 2, py + 10, 'rgba(170,120,50,0.5)'); }
          for (let i = 0; i < 6; i++) dot(px + Math.floor(h(x, y, 12 + i) * 20), py + 5 + Math.floor(h(x, y, 20 + i) * 10), 'rgba(20,0,0,0.5)');
        } else if (G.idx === 1 && r2 < 0.14) {
          // 떨어져 나간 바닥 타일
          const tx = px + (h(x, y, 13) < 0.5 ? 1 : 11), ty = py + (h(x, y, 14) < 0.5 ? 1 : 11);
          m.fillStyle = 'rgba(12,14,12,0.9)'; m.fillRect(tx, ty, 8, 8);
          dot(tx + 8, ty + 2, 'rgba(12,14,12,0.9)'); dot(tx + 3, ty + 8, 'rgba(12,14,12,0.9)');
        } else if (G.idx === 1 && r2 < 0.26) {
          // 흩어진 진료 기록지
          const tx = px + 3 + Math.floor(h(x, y, 15) * 10), ty = py + 3 + Math.floor(h(x, y, 16) * 10);
          m.fillStyle = 'rgba(210,205,190,0.75)'; m.fillRect(tx, ty, 5, 6);
          m.fillStyle = 'rgba(60,60,60,0.6)'; m.fillRect(tx + 1, ty + 1, 3, 1); m.fillRect(tx + 1, ty + 3, 2, 1);
          if (h(x, y, 17) < 0.5) dot(tx + 3, ty + 4, 'rgba(110,0,6,0.9)');
        } else if (G.idx === 1 && r2 < 0.32) {
          // 깨진 유리 조각
          for (let i = 0; i < 5; i++) dot(px + 4 + Math.floor(h(x, y, 50 + i) * 12), py + 4 + Math.floor(h(x, y, 55 + i) * 12), 'rgba(180,230,240,0.55)');
        } else if (G.idx === 2 && r2 < 0.14) {
          // 검게 고인 물웅덩이
          m.fillStyle = 'rgba(6,8,12,0.75)';
          m.beginPath(); m.ellipse(px + 10, py + 11, 6 + h(x, y, 18) * 3, 3 + h(x, y, 19) * 2, 0, 0, Math.PI * 2); m.fill();
          m.fillStyle = 'rgba(160,170,190,0.25)'; m.fillRect(px + 7, py + 9, 3, 1);
        } else if (G.idx === 2 && r2 < 0.22) {
          // 흩어진 뼛조각
          for (let i = 0; i < 4; i++) { const bx = px + 3 + Math.floor(h(x, y, 70 + i) * 13), by = py + 3 + Math.floor(h(x, y, 75 + i) * 13); m.fillStyle = 'rgba(200,190,170,0.8)'; m.fillRect(bx, by, 2 + (i % 2), 1); }
        }
      }
    }
  }

  function makeMover(x, y) { return { cx: x, cy: y, nx: x, ny: y, p: 0, moving: false, x, y, px: x, py: y }; }

  function resetActors() {
    const P = makeMover(G.start.x, G.start.y);
    P.ang = Math.PI / 2; P.mdir = null; P.stepT = 0; P.stepSide = 1;
    G.player = P;
    G.enemies = G.spawns.map((s, i) => {
      const e = makeMover(s.x, s.y);
      e.type = (G.S.stalker && i === G.spawns.length - 1) ? 'stalker' : 'ghost';
      e.state = 'wander'; e.memory = 0; e.target = null;
      e.delay = e.type === 'stalker' ? 6 : 1.5;
      e.lit = false; e.moanT = 2 + i; e.stepT = 0; e.bob = i * 1.7;
      return e;
    });
    G.fx = [];
  }

  // ---------- 진행 ----------
  function start(callbacks, opts = {}) {
    cb = callbacks;
    RUN = { daily: opts.daily || 0, curse: opts.daily ? dailyCurse(opts.daily) : null };
    G = null;
    beginStage(0);
  }

  function beginStage(idx) {
    buildStage(idx);
    updateHud();
    cb.onStageIntro && cb.onStageIntro(G.S, () => {
      G.state = 'play';
      SFX.ambient(idx);
      say(idx === 0 ? '열쇠를 찾아 탈출구를 열어라' : idx === 1 ? '여기서도 열쇠를 찾아야 한다' : '빛을 그것에게서 떼지 마라', 4);
    });
  }

  function togglePause() {
    if (!G) return;
    if (G.state === 'play') { G.state = 'paused'; cb.onPause && cb.onPause(true); }
    else if (G.state === 'paused') { G.state = 'play'; cb.onPause && cb.onPause(false); }
  }

  function quit() { SFX.stopAmbient(); G = null; held.length = 0; }

  function say(text, sec = 3) {
    hud.msg.textContent = text;
    hud.msg.classList.add('show');
    G.msgT = sec;
  }

  function updateHud() {
    const t = G.stageTime;
    hud.stage.textContent = `${G.S.name} · ${G.S.title}`;
    hud.time.textContent = `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}.${Math.floor((t * 10) % 10)}`;
    const bonus = Math.max(0, G.par - t) * G.S.rate;
    hud.bonus.textContent = Math.floor(bonus).toLocaleString();
    hud.score.textContent = G.score.toLocaleString();
    hud.lives.textContent = '●'.repeat(G.lives) + '○'.repeat(Math.max(0, 3 - G.lives));
    hud.key.textContent = G.hasKey ? '열쇠 있음' : '열쇠 없음';
    hud.key.classList.toggle('on', G.hasKey);
  }

  function frame(dt) {
    if (!G) return;
    dt = Math.min(dt, 0.05);
    G.t += dt;
    if (G.state === 'play') {
      G.stageTime += dt;
      updatePlayer(dt);
      for (const e of G.enemies) updateEnemy(e, dt);
      checkTriggers();
      checkCaught();
      updateDanger(dt);
      updateIdle(dt);
      // 2단계부터 정해진 시각에 화면이 지직거리며 얼굴이 비친다 (모두에게 같은 순간)
      for (const at of G.idx ? [17, 38] : []) {
        if (G.stageTime >= at && !G.staticDone.includes(at)) { G.staticDone.push(at); G.staticT = 0.4; SFX.static(0.4, 0.55); SFX.whisper(0.8, 0, 0.4); }
      }
    } else if (G.state === 'event') updateEvent(dt);
    else if (G.state === 'dying') updateDying(dt);
    updateFx(dt);
    updateMotes(dt);
    revealAround();
    if (G.msgT > 0) { G.msgT -= dt; if (G.msgT <= 0) hud.msg.classList.remove('show'); }
    G.shake = Math.max(0, G.shake - dt * 2.5);
    if (G.state !== 'intro') draw();
    updateHud();
  }

  // ---------- 플레이어 ----------
  function shutterAt(x, y) { return G.shutters.find(s => s.x === x && s.y === y); }
  // 셔터는 4초마다 1.3초씩 닫힌다 (모두에게 같은 박자)
  function shutterClosed(s) { return ((G.stageTime + s.ph) % 4) < 1.3; }
  function passable(x, y) {
    if (isWall(x, y)) return false;
    if (x === G.door.x && y === G.door.y && !G.hasKey) return false;
    const sh = shutterAt(x, y);
    if (sh && shutterClosed(sh)) return false;
    return true;
  }

  function updatePlayer(dt) {
    const P = G.player;
    const want = held.length ? held[held.length - 1] : null;
    // 손전등 방향 고정 중 뒷걸음질은 느리다
    let speed = PLAYER_SPEED;
    if (lockHeld && P.mdir) {
      const [dx, dy] = DV[P.mdir];
      const dot = dx * Math.cos(P.ang) + dy * Math.sin(P.ang);
      speed *= dot < -0.5 ? 0.65 : dot < 0.5 ? 0.85 : 1;
    }

    const tryStart = () => {
      for (let i = held.length - 1; i >= 0; i--) {
        const d = held[i], [dx, dy] = DV[d];
        if (passable(P.cx + dx, P.cy + dy)) {
          P.nx = P.cx + dx; P.ny = P.cy + dy; P.moving = true; P.mdir = d;
          return true;
        }
        if (G.hasKey === false && P.cx + dx === G.door.x && P.cy + dy === G.door.y && G.keyDoorHint <= 0) {
          say('잠겨 있다. 열쇠가 필요하다', 2); G.keyDoorHint = 3; SFX.bang(0.2);
        }
      }
      return false;
    };
    G.keyDoorHint -= dt;

    if (!P.moving) {
      if (want) { tryStart(); P.p = 0; }
    } else {
      if (want && P.mdir) {
        const [dx, dy] = DV[want], [mx, my] = DV[P.mdir];
        if (dx === -mx && dy === -my) {
          [P.cx, P.nx] = [P.nx, P.cx]; [P.cy, P.ny] = [P.ny, P.cy];
          P.p = 1 - P.p; P.mdir = want;
        }
      }
      P.p += speed * dt;
      if (P.p >= 1) {
        const left = (P.p - 1) / speed;
        P.cx = P.nx; P.cy = P.ny; P.p = 0; P.moving = false;
        arrive();
        if (G.state === 'play' && held.length && tryStart()) P.p = Math.min(0.9, left * speed);
      }
    }
    P.x = U.lerp(P.cx, P.nx, P.p); P.y = U.lerp(P.cy, P.ny, P.p);

    if (P.moving && !lockHeld) {
      const [dx, dy] = DV[P.mdir];
      const target = Math.atan2(dy, dx);
      P.ang += U.angDiff(P.ang, target) * Math.min(1, dt * 14);
    }
  }

  function arrive() {
    const P = G.player;
    P.stepSide *= -1;
    SFX.footstep(0.06, P.stepSide * 0.15);
    if (!G.hasKey && P.cx === G.key.x && P.cy === G.key.y) takeKey();
    if (G.creaks.has(P.cx + ',' + P.cy)) {
      // 삐걱이는 마루를 밟으면 근처 유령이 그 자리로 몰려온다
      SFX.creak(0.5, 0.45); G.shake = Math.max(G.shake, 0.2); say('삐걱—', 0.8);
      for (const e of G.enemies) {
        if (e.type !== 'ghost' || e.delay > 0 || Math.hypot(e.x - P.x, e.y - P.y) > 8) continue;
        e.state = 'chase'; e.memory = 2; e.target = { x: P.cx, y: P.cy };
      }
    }
    if (G.hasKey && P.cx === G.door.x && P.cy === G.door.y) exitScare();
  }

  // 뚜껑문을 여는 순간: 마지막 갑툭튀 (시간은 멈춰 있다)
  function exitScare() {
    G.state = 'event'; G.event = { type: 'exit' }; held.length = 0;
    const ft = [0, 1, 3][G.idx], lines = ['어디 가?', '아직 진료가 안 끝났어', '같이 여기 있자'];
    Scare.face(ft, { dur: 0.75, power: 1, text: lines[G.idx], jaw: true, blood: G.idx > 0, done: () => { if (G) { G.event = null; G.state = 'play'; clearStage(); } } });
  }

  function takeKey() {
    G.hasKey = true;
    SFX.pickup();
    setTimeout(() => { if (G) { SFX.bang(0.9); G.shake = 0.6; } }, 700);
    G.lightsOutT = 3.5;
    say(G.idx === 2 ? '열쇠를 집었다... 모두 깨어났다' : '열쇠를 집었다. 어디선가 문이 쾅 닫혔다', 3.5);
    // 열쇠를 집는 순간 유령들이 열쇠 쪽으로 몰려온다
    for (const e of G.enemies) {
      if (e.type !== 'ghost') continue;
      e.state = 'chase'; e.memory = 2.5; e.target = { x: G.key.x, y: G.key.y };
    }
  }

  function clearStage() {
    G.state = 'clear';
    SFX.stopAmbient();
    SFX.creak(1.6, 0.35);
    const t = G.stageTime;
    const bonus = Math.floor(Math.max(0, G.par - t) * G.S.rate);
    const gained = G.S.base + bonus;
    G.score += gained;
    const res = { stage: G.idx + 1, time: t, base: G.S.base, bonus, gained, par: G.par };
    G.results.push(res);
    const last = G.idx === STAGES.length - 1;
    let lifeBonus = 0;
    if (last) { lifeBonus = G.lives * LIFE_BONUS; G.score += lifeBonus; }
    updateHud();
    cb.onStageClear && cb.onStageClear(res, { last, lifeBonus, total: G.score, lives: G.lives }, () => {
      if (last) finish(true);
      else beginStage(G.idx + 1);
    });
  }

  function finish(cleared) {
    const r = { score: G.score, cleared, reached: G.idx + 1, results: G.results.slice(), lives: G.lives,
      time: G.results.reduce((a, b) => a + b.time, 0) + (cleared ? 0 : G.stageTime) };
    SFX.stopAmbient();
    G = null;
    cb.onGameOver && cb.onGameOver(r);
  }

  // ---------- 유령 ----------
  const enemyBlocked = (x, y) => {
    if (isWall(x, y) || (x === G.door.x && y === G.door.y)) return true;
    const sh = G.shutters.length && shutterAt(x, y);
    return !!(sh && shutterClosed(sh));
  };

  function los(ax, ay, bx, by) {
    const d = Math.hypot(bx - ax, by - ay), n = Math.ceil(d * 4);
    for (let i = 1; i < n; i++) {
      const t = i / n;
      if (isWall(Math.floor(ax + (bx - ax) * t + 0.5), Math.floor(ay + (by - ay) * t + 0.5))) return false;
    }
    return true;
  }

  function isLitByPlayer(e) {
    const P = G.player;
    if (G.flick < 0.35 || G.event) return false;
    const dx = e.x - P.x, dy = e.y - P.y, d = Math.hypot(dx, dy);
    if (d < G.S.amb * 0.85) return los(P.x, P.y, e.x, e.y);
    if (d > G.S.light) return false;
    if (Math.abs(U.angDiff(P.ang, Math.atan2(dy, dx))) > CONE + 0.08) return false;
    return los(P.x, P.y, e.x, e.y);
  }

  function chooseNext(e) {
    let tx = null;
    if (e.type === 'stalker' || e.state === 'chase') {
      const tgt = e.type === 'stalker' ? { x: G.player.cx, y: G.player.cy } : e.target;
      if (tgt && !(tgt.x === e.cx && tgt.y === e.cy)) {
        const dist = Maze.bfs(G.mz, tgt.x, tgt.y, (x, y) => x === G.door.x && y === G.door.y);
        let best = dist[e.cy * G.W + e.cx];
        for (const [dx, dy] of DIR4) {
          const nx = e.cx + dx, ny = e.cy + dy;
          if (enemyBlocked(nx, ny)) continue;
          const d = dist[ny * G.W + nx];
          if (d >= 0 && (best < 0 || d < best)) { best = d; tx = { x: nx, y: ny }; }
        }
      } else if (e.state === 'chase' && e.memory <= 0) e.state = 'wander';
    }
    if (!tx) {
      const opts = [];
      for (const [dx, dy] of DIR4) {
        const nx = e.cx + dx, ny = e.cy + dy;
        if (enemyBlocked(nx, ny)) continue;
        if (nx === e.px && ny === e.py) continue;
        opts.push({ x: nx, y: ny });
      }
      if (!opts.length && !enemyBlocked(e.px, e.py)) opts.push({ x: e.px, y: e.py });
      if (opts.length) tx = opts[Math.floor(G.rnd() * opts.length)];
    }
    if (tx) { e.nx = tx.x; e.ny = tx.y; e.moving = true; }
  }

  function updateEnemy(e, dt) {
    const P = G.player, S = G.S;
    e.bob += dt;
    if (e.delay > 0) { e.delay -= dt; return; }
    let speed;
    if (e.type === 'stalker') {
      const lit = isLitByPlayer(e);
      if (lit && !e.lit && G.stalkerSeenT <= 0 && Math.hypot(e.x - P.x, e.y - P.y) < S.light + 0.5) {
        SFX.stinger(0.7); G.shake = 0.5; G.stalkerSeenT = 5;
      }
      e.lit = lit;
      if (lit) return; // 보고 있으면 멈춘다
      speed = S.stalkerSpeed;
      e.stepT -= dt;
      const d = Math.hypot(e.x - P.x, e.y - P.y);
      if (e.stepT <= 0 && d < 9) { SFX.footstep(0.05 + (1 - d / 9) * 0.25, U.clamp((e.x - P.x) / 6, -1, 1), 0.6); e.stepT = 0.32; }
    } else {
      const d = Math.hypot(e.x - P.x, e.y - P.y);
      const sees = d < S.sight && los(e.x, e.y, P.x, P.y);
      if (sees) {
        if (e.state !== 'chase' && d < S.sight) { SFX.shriek(U.clamp((e.x - P.x) / 6, -1, 1)); G.shake = Math.max(G.shake, 0.3); G.redFlash = Math.max(G.redFlash, 0.18); }
        e.state = 'chase'; e.memory = 2.5; e.target = { x: P.cx, y: P.cy };
      } else if (e.memory > 0) e.memory -= dt;
      speed = e.state === 'chase' ? S.chase : S.wander;
      e.moanT -= dt;
      if (e.moanT <= 0 && d < 7) { SFX.moan(U.clamp((e.x - P.x) / 6, -1, 1), 0.06 + (1 - d / 7) * 0.1); e.moanT = 4 + G.rnd() * 3; }
      // 걸음마다 나는 소리: 해골은 뼈가 달그락, 환자는 다리를 질질 끈다
      e.stepT -= dt;
      if (e.moving && d < 8 && e.stepT <= 0) {
        const pan = U.clamp((e.x - P.x) / 6, -1, 1), v = 0.04 + (1 - d / 8) * 0.18;
        if (G.S.enemy === 'skeleton') { SFX.boneRattle(pan, v); e.stepT = 0.4; }
        else if (G.S.enemy === 'patient') { SFX.footstep(v * 0.8, pan, 0.5); e.stepT = 0.55; }
        else e.stepT = 1;
      }
      e.trailT = (e.trailT || 0) - dt;
      if (e.state === 'chase' && e.trailT <= 0) { (e.trail = e.trail || []).push({ x: e.x, y: e.y }); if (e.trail.length > 5) e.trail.shift(); e.trailT = 0.06; }
      if (e.state !== 'chase' && e.trail && e.trail.length && e.trailT <= 0) { e.trail.shift(); e.trailT = 0.06; }
    }
    if (!e.moving) chooseNext(e);
    if (e.moving) {
      e.p += speed * dt;
      if (e.p >= 1) {
        e.px = e.cx; e.py = e.cy;
        e.cx = e.nx; e.cy = e.ny; e.p = 0; e.moving = false;
        if (e.state === 'chase' && e.target && e.cx === e.target.x && e.cy === e.target.y && e.memory <= 0) e.state = 'wander';
        chooseNext(e);
      }
    }
    e.x = U.lerp(e.cx, e.nx, e.p); e.y = U.lerp(e.cy, e.ny, e.p);
  }

  function updateIdle(dt) {
    const P = G.player;
    // 손전등을 고정하고 그것을 노려보는 중에는 봐준다
    if (P.moving || G.stageTime < 2) { G.idleT = 0; G.idleStage = 0; return; }
    G.idleT += dt * (lockHeld ? 0.35 : 1);
    if (G.idleStage === 0 && G.idleT > 2.5) { G.idleStage = 1; SFX.breath(-Math.cos(P.ang) * 0.6, 0.35); }
    if (G.idleStage === 1 && G.idleT > 4.5) { G.idleStage = 2; SFX.whisper(1.5, 0, 0.35); say('...가만히 있지 마', 1.5); }
    if (G.idleStage === 2 && G.idleT > 6.5) {
      G.idleStage = 3;
      G.state = 'event'; G.event = { type: 'idle' }; held.length = 0;
      Scare.face(G.S.faceType, { dur: 0.7, power: 0.9, text: '움직여', jaw: true, done: () => { if (G) { G.state = 'play'; G.event = null; G.idleT = 0; G.idleStage = 0; } } });
    }
  }

  function updateDanger(dt) {
    const P = G.player;
    let dn = 99;
    for (const e of G.enemies) if (e.delay <= 0) dn = Math.min(dn, Math.hypot(e.x - P.x, e.y - P.y));
    G.danger = U.clamp(1 - (dn - 1) / 7, 0, 1);
    G.hbT -= dt;
    if (G.danger > 0.05 && G.hbT <= 0 && !G.S.silent) { SFX.heartbeat(0.25 + G.danger * 0.75); G.hbT = U.lerp(1.1, 0.36, G.danger); G.pulse = 1; }
    G.pulse = Math.max(0, (G.pulse || 0) - dt * 3.5);
    G.stalkerSeenT -= dt;
    G.lightsOutT -= dt;
    // 쫓기고 있으면 불협화음이 점점 커진다
    let chasing = false;
    for (const e of G.enemies) {
      if (e.delay > 0) continue;
      const d = Math.hypot(e.x - P.x, e.y - P.y);
      if ((e.type === 'ghost' && e.state === 'chase' && d < 9) || (e.type === 'stalker' && !e.lit && d < 7)) chasing = true;
    }
    SFX.setChase(chasing ? Math.max(0.35, G.danger) : G.danger * 0.25);
    // 아주 가까우면 한 프레임씩 얼굴이 비친다
    G.subT -= dt;
    if (G.danger > 0.7 && G.subT <= 0) { G.subFlash = 0.05; G.subT = 2 + Math.random() * 2.5; SFX.static(0.12, 0.25); }
  }

  function checkCaught() {
    const P = G.player;
    for (const e of G.enemies) {
      if (e.delay > 0) continue;
      if (Math.hypot(e.x - P.x, e.y - P.y) < 0.6) { startDying(e); return; }
    }
  }

  // ---------- 죽음 ----------
  function startDying(e) {
    G.state = 'dying';
    G.dying = { e, t: 0, faced: false };
    SFX.static(0.5, 0.4);
    held.length = 0;
  }

  function updateDying(dt) {
    const D = G.dying;
    D.t += dt;
    G.shake = 1;
    if (D.t > 0.3 && !D.faced) {
      D.faced = true;
      const type = D.e.type === 'stalker' ? 3 : G.S.faceType;
      D.faceType = type;
      Scare.face(type, { dur: 1.1, power: 1.2, hold: 250, jaw: true, blood: true, done: () => afterDeath() });
    }
  }

  function afterDeath() {
    if (!G) return;
    G.state = 'caught';
    G.lives--;
    updateHud();
    if (G.lives <= 0) {
      cb.onCaught && cb.onCaught(0, () => finish(false), G.dying.faceType);
      return;
    }
    cb.onCaught && cb.onCaught(G.lives, () => {
      // 시작점으로 돌아간다. 주운 열쇠는 그대로, 유령은 처음 자리로. 시간은 계속 흐른다.
      resetActors();
      G.state = 'play';
      say(G.hasKey ? '다시 처음부터... 열쇠는 아직 손에 있다' : '다시 처음부터...', 2.5);
    }, G.dying.faceType);
  }

  // ---------- 갑툭튀 ----------
  function checkTriggers() {
    const P = G.player;
    for (const s of G.scares) {
      if (s.done) continue;
      if (Math.abs(P.x - s.x) < 0.5 && Math.abs(P.y - s.y) < 0.5) { s.done = true; fire(s.type); return; }
    }
  }

  function aheadCell(dist) {
    const P = G.player;
    const dx = Math.round(Math.cos(P.ang)), dy = Math.round(Math.sin(P.ang));
    let x = P.cx, y = P.cy;
    for (let i = 0; i < dist; i++) { if (isWall(x + dx, y + dy)) break; x += dx; y += dy; }
    return { x, y };
  }

  function fire(type) {
    const P = G.player;
    if (type === 'face') {
      G.state = 'event'; G.event = { type: 'face' };
      held.length = 0;
      const lines = [null, '여기서 나갈 수 없어', '아직 못 나갔어'];
      G.faceN = (G.faceN || 0) + 1;
      const ft = G.idx === 2 && G.faceN % 2 === 0 ? 3 : G.S.faceType;
      Scare.face(ft, { dur: 0.85 + G.idx * 0.15, power: 0.8 + G.idx * 0.2, text: lines[G.idx], pre: G.idx ? 0.35 : 0, jaw: G.faceN % 2 === 1, blood: G.idx > 0, done: () => { if (G) { G.state = 'play'; G.event = null; } } });
    } else if (type === 'blackout') {
      G.state = 'event'; G.event = { type: 'blackout', t: 0, dur: 1.5 + G.idx * 0.2, shown: false };
      held.length = 0;
      SFX.static(0.2, 0.2);
      SFX.whisper(1.8, -0.6, 0.4);
      setTimeout(() => SFX.whisper(1.4, 0.6, 0.35), 500);
    } else if (type === 'runner') {
      const dx = Math.cos(P.ang), dy = Math.sin(P.ang);
      const ax = P.x + dx * 2.2, ay = P.y + dy * 2.2;
      const dir = G.rnd() < 0.5 ? 1 : -1;
      G.fx.push({ type: 'runner', t: 0, dur: 0.45, x0: ax - dy * 4 * dir, y0: ay + dx * 4 * dir, x1: ax + dy * 4 * dir, y1: ay - dx * 4 * dir });
      SFX.whoosh(-dir, dir);
      SFX.stinger(0.35);
      G.shake = 0.3;
    } else if (type === 'footsteps') {
      const back = P.ang + Math.PI;
      for (let i = 0; i < 7; i++) {
        setTimeout(() => SFX.footstep(0.12 + i * 0.03, U.clamp(Math.cos(back), -1, 1) * 0.7, 0.8), i * (300 - i * 25));
      }
      setTimeout(() => SFX.whisper(1.2, Math.cos(back) * 0.8, 0.5), 7 * 230);
      say('...누군가 뒤에서 따라온다', 2.5);
      // 발소리가 멈추면 정말로 바로 뒤에 서 있다. 돌아보면 사라진다
      const g0 = G;
      setTimeout(() => {
        if (G !== g0 || G.state !== 'play') return;
        const Q = G.player, bx = Math.round(Q.x - Math.cos(Q.ang) * 1.3), by = Math.round(Q.y - Math.sin(Q.ang) * 1.3);
        if (isWall(bx, by)) return;
        G.fx.push({ type: 'behind', t: 0, dur: 4, x: bx, y: by, gone: -1 });
      }, 7 * 230 + 400);
    } else if (type === 'handprints') {
      const spots = [];
      for (let dy = -2; dy <= 2; dy++) for (let dx = -3; dx <= 3; dx++) {
        const x = P.cx + dx, y = P.cy + dy;
        if (isWall(x, y) && !isWall(x, y + 1) && y > 0) spots.push({ x, y });
      }
      spots.slice(0, 7).forEach((s, i) => {
        setTimeout(() => {
          if (!G) return;
          G.mapCtx.save();
          G.mapCtx.translate(s.x * TILE + 10, s.y * TILE + 8);
          G.mapCtx.rotate((U.hash(s.x, s.y, 3) - 0.5) * 0.8);
          G.mapCtx.drawImage(Sprites.hand, -10, -10);
          G.mapCtx.restore();
          SFX.bang(0.45 + i * 0.05, U.clamp((s.x - G.player.cx) / 3, -1, 1));
          G.shake = 0.25;
        }, i * 210);
      });
    } else if (type === 'watcher') {
      // 빛이 닿는 끝에 가만히 서서 바라보다가, 불이 깜빡하면 사라진다
      const c = aheadCell(Math.max(2, Math.floor(G.S.light - 1)));
      if (Math.abs(c.x - P.cx) + Math.abs(c.y - P.cy) < 2) return;
      G.fx.push({ type: 'watcher', t: 0, dur: 1.4, x: c.x, y: c.y });
      SFX.whisper(1.3, 0, 0.25);
    } else if (type === 'crawler') {
      // 어둠 속에서 네 발로 기어 달려든다 (닿기 직전에 사라진다)
      const c = aheadCell(7);
      const d = Math.hypot(c.x - P.x, c.y - P.y);
      if (d < 2.5) return;
      G.state = 'event'; held.length = 0;
      G.event = { type: 'crawler', t: 0, x: c.x, y: c.y, sx: c.x, sy: c.y, hit: false, done: 0 };
      SFX.static(0.3, 0.15);
      SFX.moan(0, 0.25);
    } else if (type === 'prints') {
      const bx = -Math.round(Math.cos(P.ang)), by = -Math.round(Math.sin(P.ang));
      const cells = [];
      let x = P.cx, y = P.cy;
      for (let i = 0; i < 7; i++) { if (isWall(x + bx, y + by)) break; x += bx; y += by; cells.push({ x, y }); }
      if (cells.length < 3) return;
      cells.reverse();
      G.fx.push({ type: 'prints', t: 0, dur: 99, next: 0.3, cells, i: 0, dx: -bx, dy: -by });
      say('...무언가가 다가온다', 2);
    } else if (type === 'text') {
      const c = aheadCell(2);
      const m = G.mapCtx, text = G.S.texts[0];
      m.save();
      m.font = "bold 13px 'Nanum Myeongjo', serif";
      m.textAlign = 'center'; m.textBaseline = 'middle';
      const tx = c.x * TILE + 10, ty = c.y * TILE + 10;
      m.fillStyle = 'rgba(110,0,6,0.92)';
      m.fillText(text, tx, ty);
      for (let k = 0; k < 8; k++) m.fillRect(tx - 20 + U.hash(k, 1, 7) * 40, ty + 4, 1, 3 + U.hash(k, 2, 7) * 8);
      m.restore();
      SFX.stinger(0.3);
      SFX.whisper(2, 0, 0.3);
    }
  }

  function updateEvent(dt) {
    const E = G.event;
    if (E && E.type === 'crawler') {
      const P = G.player;
      E.t += dt;
      if (!E.hit) {
        const dx = P.x - E.x, dy = P.y - E.y, d = Math.hypot(dx, dy);
        const sp = 7 + E.t * 10;
        if (E.t > 0.25) { E.x += dx / d * sp * dt; E.y += dy / d * sp * dt; }
        if (Math.floor(E.t * 14) !== Math.floor((E.t - dt) * 14)) SFX.footstep(0.25, 0, 0.7);
        if (d < 0.9) { E.hit = true; E.done = E.t + 0.5; SFX.stinger(1); SFX.scream(0.7); G.shake = 1; G.redFlash = 0.5; }
      } else if (E.t >= E.done) { G.event = null; G.state = 'play'; }
      return;
    }
    if (!E || E.type !== 'blackout') return;
    E.t += dt;
    if (!E.shown && E.t > E.dur - 0.5) {
      E.shown = true;
      SFX.stinger(1);
      SFX.scream(0.35);
      G.shake = 0.8;
      const P = G.player;
      G.faceFx = { t: 0, x: P.x + Math.cos(P.ang) * 1.1, y: P.y + Math.sin(P.ang) * 1.1 };
    }
    if (E.t >= E.dur) { G.event = null; G.state = 'play'; G.faceFx = null; }
  }

  function updateFx(dt) {
    for (const f of G.fx) {
      f.t += dt;
      if (f.type === 'watcher' && f.t > 0.9 && !f.out) { f.out = true; G.forceDarkT = 0.3; SFX.static(0.35, 0.3); }
      if (f.type === 'prints' && f.t >= f.next) {
        // 칸마다 왼발, 오른발 두 개씩
        const step = f.i, c = f.cells[step >> 1];
        if (!c) { f.dur = f.t; SFX.whisper(1.2, 0, 0.45); G.shake = 0.3; continue; }
        const side = step % 2 ? 1 : -1, m = G.mapCtx;
        const px = c.x * TILE + 10 + (f.dy ? side * 3 : (step % 2) * 6 - 3), py = c.y * TILE + 10 + (f.dx ? side * 3 : (step % 2) * 6 - 3);
        m.fillStyle = 'rgba(100,0,6,0.85)';
        if (f.dx) { m.fillRect(px - 2, py - 1, 4, 3); m.fillRect(px + 2 * f.dx, py - 1, 1, 1); m.fillRect(px + 2 * f.dx, py + 1, 1, 1); }
        else { m.fillRect(px - 1, py - 2, 3, 4); m.fillRect(px - 1, py + 2 * f.dy, 1, 1); m.fillRect(px + 1, py + 2 * f.dy, 1, 1); }
        SFX.footstep(0.08 + step * 0.02, U.clamp((c.x - G.player.cx) / 4, -1, 1), 0.7);
        f.i++; f.next += 0.34 - Math.min(0.15, step * 0.012);
      }
      if (f.type === 'behind' && f.gone < 0 && f.t > 0.2 && isLitByPlayer({ x: f.x, y: f.y })) {
        f.gone = f.t; f.dur = f.t + 0.35; SFX.stinger(0.9); SFX.scream(0.45); G.shake = 0.7; G.redFlash = 0.35;
      }
    }
    updateDecor(dt);
    G.handT = (G.handT === undefined ? 6 : G.handT) - dt * (1 + G.danger * 1.5);
    if (G.state === 'play' && G.handT <= 0) {
      G.handT = 6 + Math.random() * 6;
      const Q = G.player, opts = [];
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const fx = Q.cx + dx, fy = Q.cy + dy;
        if (isWall(fx, fy) || (dx === 0 && dy === 0)) continue;
        for (const [ax, ay] of DIR4) if (isWall(fx + ax, fy + ay) && fy + ay > 0 && fx + ax > 0 && fx + ax < G.W - 1 && fy + ay < G.H - 1) opts.push({ fx, fy, ax, ay });
      }
      if (opts.length) {
        const o = opts[Math.floor(Math.random() * opts.length)];
        G.fx.push({ type: 'hands', t: 0, dur: 1.6, ...o, n: 2 + Math.floor(Math.random() * 2), seed: Math.random() * 100 });
        SFX.whisper(0.6, U.clamp((o.fx - Q.cx) / 3, -1, 1), 0.18); SFX.static(0.15, 0.08);
      }
    }
    G.forceDarkT = Math.max(0, (G.forceDarkT || 0) - dt);
    G.redFlash = Math.max(0, (G.redFlash || 0) - dt);
    G.subFlash = Math.max(0, (G.subFlash || 0) - dt);
    // 어둠 속 벽에서 눈이 뜨인다 (가까이 가면 사라짐)
    const P = G.player;
    G.eyes = (G.eyes || []).filter(e => (e.t += dt) < e.dur && Math.hypot(e.x - P.x, e.y - P.y) > 2.5);
    G.eyeT = (G.eyeT === undefined ? 4 : G.eyeT) - dt;
    if (G.state === 'play' && G.eyeT <= 0 && G.eyes.length < 2 + G.idx) {
      G.eyeT = 3 + Math.random() * 4;
      const x = Math.round(P.x + (Math.random() - 0.5) * 20), y = Math.round(P.y + (Math.random() - 0.5) * 13);
      if (isWall(x, y) && Math.hypot(x - P.x, y - P.y) > 4 && x > 0 && y > 0 && x < G.W - 1 && y < G.H - 1) {
        G.eyes.push({ x, y, t: 0, dur: 3 + Math.random() * 3 });
        if (Math.random() < 0.4) SFX.whisper(0.9, U.clamp((x - P.x) / 8, -1, 1), 0.12);
      }
    }
    // 가끔 들려오는 목소리
    G.voiceT = (G.voiceT === undefined ? 12 : G.voiceT) - dt;
    if (G.state === 'play' && G.voiceT <= 0) {
      G.voiceT = 14 + Math.random() * 12;
      const lines = ['...여기야', '같이 놀자', '놓치지 않을 거야', '뒤를 봐', '왜 도망가?', '하나... 둘... 셋...'];
      say(lines[Math.floor(Math.random() * lines.length)], 1.8);
      SFX.whisper(1.6, Math.random() * 2 - 1, 0.3);
    }
    G.fx = G.fx.filter(f => f.t < f.dur);
    if (G.faceFx) G.faceFx.t += dt;
  }

  // ---------- 그리기 ----------
  function castRay(ox, oy, ang, maxD) {
    const dx = Math.cos(ang) || 1e-9, dy = Math.sin(ang) || 1e-9;
    let mx = Math.floor(ox), my = Math.floor(oy);
    const ddx = Math.abs(1 / dx), ddy = Math.abs(1 / dy);
    const sx = dx < 0 ? -1 : 1, sy = dy < 0 ? -1 : 1;
    let sdx = dx < 0 ? (ox - mx) * ddx : (mx + 1 - ox) * ddx;
    let sdy = dy < 0 ? (oy - my) * ddy : (my + 1 - oy) * ddy;
    for (let i = 0; i < 64; i++) {
      let d;
      if (sdx < sdy) { d = sdx; sdx += ddx; mx += sx; } else { d = sdy; sdy += ddy; my += sy; }
      if (d > maxD) return maxD;
      if (isWall(mx, my)) return d + 0.3; // 벽 표면도 조금 비춘다
    }
    return maxD;
  }

  function flickerValue() {
    const f = G.S.flicker, t = G.t;
    const k = Math.floor(t * 18);
    let v = 1;
    const r = U.hash(k, 7, G.idx);
    if (r < f) v = 0.05 + U.hash(k, 8, G.idx) * 0.4;
    else if (r < f * 2.5) v = 0.7 + U.hash(k, 9, G.idx) * 0.2;
    v *= 0.94 + 0.06 * Math.sin(t * 13);
    if (G.event && G.event.type === 'blackout') v = G.event.shown ? 1 : 0;
    if (G.danger > 0.55 && U.hash(k, 11, G.idx) < (G.danger - 0.55) * 0.9) v *= 0.55;
    if (G.forceDarkT > 0) v = 0;
    if (G.idx === 1) SFX.setBuzz(v < 0.6 ? 1 : 0);
    return v;
  }

  function drawDarkness(camX, camY) {
    const P = G.player, S = G.S, s = 0.5;
    const px = ((P.x + 0.5) * TILE - camX) * s, py = ((P.y + 0.5) * TILE - camY) * s;
    dctx.globalCompositeOperation = 'source-over';
    dctx.fillStyle = `rgba(0,0,0,${S.dark})`;
    dctx.clearRect(0, 0, dark.width, dark.height);
    dctx.fillRect(0, 0, dark.width, dark.height);
    const I = G.flick;
    dctx.globalCompositeOperation = 'destination-out';
    if (I > 0.01) {
      const ox = P.x + 0.5, oy = P.y + 0.5, R = S.light;
      dctx.save();
      dctx.beginPath();
      const full = new Path2D();
      const N = 180;
      for (let i = 0; i <= N; i++) {
        const a = (i / N) * Math.PI * 2;
        const d = castRay(ox, oy, a, R + 0.5);
        const X = px + Math.cos(a) * d * TILE * s, Y = py + Math.sin(a) * d * TILE * s;
        if (i === 0) { dctx.moveTo(X, Y); full.moveTo(X / s, Y / s); } else { dctx.lineTo(X, Y); full.lineTo(X / s, Y / s); }
      }
      dctx.closePath();
      full.closePath();
      G.lightPath = full;
      dctx.clip();
      const ar = S.amb * TILE * s;
      let g = dctx.createRadialGradient(px, py, 0, px, py, ar);
      g.addColorStop(0, `rgba(0,0,0,${I})`); g.addColorStop(0.5, `rgba(0,0,0,${0.85 * I})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      dctx.fillStyle = g; dctx.fillRect(px - ar, py - ar, ar * 2, ar * 2);
      const cr = R * TILE * s;
      for (const [spread, alpha] of [[CONE + 0.18, 0.35], [CONE, 1]]) {
        g = dctx.createRadialGradient(px, py, 0, px, py, cr);
        g.addColorStop(0, `rgba(0,0,0,${I * alpha})`); g.addColorStop(0.55, `rgba(0,0,0,${0.85 * I * alpha})`); g.addColorStop(1, 'rgba(0,0,0,0)');
        dctx.fillStyle = g;
        dctx.beginPath(); dctx.moveTo(px, py);
        dctx.arc(px, py, cr, P.ang - spread, P.ang + spread);
        dctx.closePath(); dctx.fill();
      }
      dctx.restore();
      // 빛의 가장자리를 어둠이 꿈틀거리며 갉아먹는다 (도트 덩어리)
      dctx.globalCompositeOperation = 'source-over';
      const nT = 90 + G.idx * 40 + Math.floor(G.danger * 80);
      for (let i = 0; i < nT; i++) {
        const a = P.ang + (Math.random() - 0.5) * (CONE + 0.25) * 2, rr = cr * (0.62 + Math.random() * 0.4);
        dctx.fillStyle = SHADE[i & 3];
        dctx.fillRect(Math.round(px + Math.cos(a) * rr), Math.round(py + Math.sin(a) * rr), 1 + (Math.random() < 0.3 ? 1 : 0), 1);
      }
      dctx.globalCompositeOperation = 'destination-out';
    }
    // 장식 불빛 (열쇠를 집으면 잠깐 모두 꺼진다)
    if (G.lightsOutT <= 0) {
      for (const L of G.lights) {
        if (L.out) continue;
        const lx = ((L.x + 0.5) * TILE - camX) * s, ly = ((L.y + 0.5) * TILE - camY) * s;
        if (lx < -40 || ly < -40 || lx > dark.width + 40 || ly > dark.height + 40) continue;
        const fl = 0.75 + 0.25 * Math.sin(G.t * 9 + L.ph) * Math.sin(G.t * 23 + L.ph * 2);
        const r = TILE * s * (G.S.glowR || 1.7) * fl;
        const g = dctx.createRadialGradient(lx, ly, 0, lx, ly, r);
        g.addColorStop(0, `rgba(0,0,0,${G.S.glowA || 0.75})`); g.addColorStop(1, 'rgba(0,0,0,0)');
        dctx.fillStyle = g; dctx.fillRect(lx - r, ly - r, r * 2, r * 2);
      }
    }
    // 열린 탈출구에서 새어 나오는 빛
    if (G.hasKey) {
      const lx = ((G.door.x + 0.5) * TILE - camX) * s, ly = ((G.door.y + 0.5) * TILE - camY) * s;
      const r = TILE * s * (1.6 + Math.sin(G.t * 4) * 0.2);
      const g = dctx.createRadialGradient(lx, ly, 0, lx, ly, r);
      g.addColorStop(0, 'rgba(0,0,0,0.8)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      dctx.fillStyle = g; dctx.fillRect(lx - r, ly - r, r * 2, r * 2);
    }
    dctx.globalCompositeOperation = 'source-over';
  }

  function updateDecor(dt) {
    const P = G.player;
    for (const d of G.decor) {
      const dist = Math.hypot(d.x - P.x, d.y - P.y);
      if (d.kind === 'portrait' && !d.red && dist < 2.2) {
        // 가까이 가면 초상화의 눈이 붉게 변하고 피눈물이 흐른다
        d.red = true; d.redT = 0; SFX.childLaugh(U.clamp((d.x - P.x) / 4, -1, 1), 0.14);
      }
      if (d.red) d.redT += dt;
      if (d.kind === 'coffin' && !d.open && dist < 1.8) {
        d.open = true; SFX.creak(0.9, 0.3); SFX.boneRattle(U.clamp((d.x - P.x) / 4, -1, 1), 0.3); G.shake = Math.max(G.shake, 0.25);
      }
      if (d.kind === 'chair') {
        // 내가 보고 있지 않을 때만 조금씩 굴러간다
        d.moveT -= dt;
        if (d.moveT <= 0 && dist < 8) {
          d.moveT = 2.5 + Math.random() * 3;
          if (!isLitByPlayer({ x: d.x + d.ox / TILE, y: d.y + d.oy / TILE })) {
            d.tx = U.clamp(d.tx + (Math.random() - 0.5) * 8, -6, 6); d.ty = U.clamp(d.ty + (Math.random() - 0.5) * 6, -4, 4);
            SFX.squeak(U.clamp((d.x - P.x) / 5, -1, 1), 0.05 + (1 - dist / 8) * 0.1);
          }
        }
        d.ox += (d.tx - d.ox) * Math.min(1, dt * 2); d.oy += (d.ty - d.oy) * Math.min(1, dt * 2);
      }
    }
  }

  function drawDecor(camX, camY) {
    const P = G.player;
    for (const d of G.decor) {
      const sx = Math.round(d.x * TILE - camX), sy = Math.round(d.y * TILE - camY);
      if (sx < -30 || sy < -40 || sx > VW + 10 || sy > VH + 30) continue;
      if (d.kind === 'portrait') {
        const py = sy - 15;
        ctx.drawImage(Sprites.portrait, sx, py);
        // 눈동자가 나를 따라온다
        const look = P.x < d.x - 0.3 ? 0 : P.x > d.x + 0.3 ? 1 : (Math.floor(G.t * 0.7) % 2);
        for (const [ex, ey] of Sprites.PORTRAIT_EYES) {
          const wx = ex === 8 ? 8 : 11;
          ctx.fillStyle = d.red ? '#5a0006' : '#d8d0c0'; ctx.fillRect(sx + wx, py + ey, 2, 1);
          ctx.fillStyle = d.red ? '#ff2a1a' : '#100808'; ctx.fillRect(sx + wx + look, py + ey, 1, 1);
          if (d.red) { ctx.fillStyle = '#7a0008'; ctx.fillRect(sx + wx + look, py + ey + 1, 1, Math.min(6, Math.floor(d.redT * 4))); }
        }
      } else if (d.kind === 'coffin') {
        ctx.drawImage(Sprites.coffin[d.open ? 1 : 0], sx, sy - 13);
      } else if (d.kind === 'chair') {
        ctx.drawImage(Sprites.wheelchair, Math.round(sx + d.ox), Math.round(sy + d.oy) - 2);
      }
    }
  }

  function enemyImg(e) {
    if (e.type === 'stalker') return Sprites.stalker;
    return Sprites[G.S.enemy][Math.floor(e.bob * 3) % 2];
  }

  function updateMotes(dt) {
    const P = G.player;
    for (const m of G.motes) {
      m.x += m.vx * dt; m.y += m.vy * dt;
      m.vx += (Math.random() - 0.5) * dt * 0.6; m.vy += (Math.random() - 0.5) * dt * 0.6;
      m.vx *= 0.99; m.vy *= 0.99;
      if (Math.hypot(m.x - P.x, m.y - P.y) > G.S.light + 1) {
        const a = P.ang + (Math.random() - 0.5) * CONE * 2, d = 0.5 + Math.random() * G.S.light;
        m.x = P.x + Math.cos(a) * d; m.y = P.y + Math.sin(a) * d;
      }
    }
  }

  function sprAt(img, x, y, ox = 0, oy = 0, camX, camY) {
    ctx.drawImage(img, Math.round(x * TILE - camX + ox), Math.round(y * TILE - camY + oy));
  }

  function draw() {
    const P = G.player;
    G.flick = flickerValue();
    let camX = (P.x + 0.5) * TILE - VW / 2, camY = (P.y + 0.5) * TILE - VH / 2;
    const mw = G.W * TILE, mh = G.H * TILE;
    camX = mw > VW ? U.clamp(camX, 0, mw - VW) : (mw - VW) / 2;
    camY = mh > VH ? U.clamp(camY, 0, mh - VH) : (mh - VH) / 2;
    if (G.shake > 0) { camX += (Math.random() - 0.5) * G.shake * 8; camY += (Math.random() - 0.5) * G.shake * 8; }
    camX = Math.round(camX); camY = Math.round(camY);

    ctx.globalAlpha = 1;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, VW, VH);
    ctx.drawImage(G.map, -camX, -camY);

    // 장식 불빛 (유령이 2칸 안에 있으면 꺼진다)
    for (const L of G.lights) {
      const was = L.out;
      L.out = G.enemies.some(e => e.delay <= 0 && Math.abs(e.x - L.x) + Math.abs(e.y - L.y) < 2.2);
      if (L.out && !was && Math.hypot(L.x - P.x, L.y - P.y) < 8) SFX.blowout(U.clamp((L.x - P.x) / 6, -1, 1));
      const fr = G.lightsOutT > 0 || L.out ? 2 : (Math.sin(G.t * 11 + L.ph) > 0.3 ? 1 : 0);
      sprAt(L.type === 'pumpkin' ? Sprites.pumpkin[fr] : Sprites.candle[fr], L.x, L.y, 0, 0, camX, camY);
    }
    ctx.globalAlpha = G.hasKey ? 0.6 + 0.4 * Math.sin(G.t * 5) : 0.25 + 0.1 * Math.sin(G.t * 2);
    sprAt(Sprites.trapGlow, G.door.x, G.door.y, 0, 0, camX, camY);
    ctx.globalAlpha = 1;
    if (!G.hasKey) {
      sprAt(Sprites.key, G.key.x, G.key.y, 0, Math.round(Math.sin(G.t * 3) * 1.5), camX, camY);
    }

    // 벽에서 떨어지는 핏방울
    for (const d of G.drips) {
      const k = ((G.t + d.ph) % d.per) / d.per;
      const x = d.x * TILE + d.ox - camX, y = d.y * TILE + 13 + k * k * 11 - camY;
      if (x < -4 || y < -4 || x > VW + 4 || y > VH + 4) continue;
      ctx.fillStyle = '#6a0006';
      ctx.fillRect(Math.round(x), Math.round(y), 1, k > 0.92 ? 1 : 2);
    }

    drawDecor(camX, camY);
    // 셔터: 닫히기 직전에 빨간 경고등이 깜빡인다
    for (const sh of G.shutters) {
      const sx = Math.round(sh.x * TILE - camX), sy = Math.round(sh.y * TILE - camY);
      if (sx < -20 || sy < -20 || sx > VW || sy > VH) continue;
      const ph = (G.stageTime + sh.ph) % 4, closed = ph < 1.3, warn = ph > 3.4;
      ctx.fillStyle = '#3a3e44';
      if (sh.vert) { ctx.fillRect(sx, sy, 2, TILE); ctx.fillRect(sx + TILE - 2, sy, 2, TILE); } else { ctx.fillRect(sx, sy, TILE, 2); ctx.fillRect(sx, sy + TILE - 2, TILE, 2); }
      if (closed) {
        const k = Math.min(1, ph / 0.15);
        for (let i = 0; i < TILE * k; i += 3) {
          ctx.fillStyle = i % 6 ? '#6a7078' : '#8a9098';
          if (sh.vert) ctx.fillRect(sx + 2, sy + i, TILE - 4, 2); else ctx.fillRect(sx + i, sy + 2, 2, TILE - 4);
        }
        ctx.fillStyle = 'rgba(90,0,6,0.8)'; ctx.fillRect(sx + 8, sy + 9, 3, 2);
      }
      if (warn && Math.sin(G.t * 20) > 0) { ctx.fillStyle = '#ff2020'; ctx.fillRect(sx + 9, sy + 1, 2, 2); }
      if (closed && !sh.wasClosed) SFX.bang(0.18, U.clamp((sh.x - P.x) / 6, -1, 1));
      sh.wasClosed = closed;
    }
    // 벽 틈에서 손이 뻗어 나왔다 들어간다
    for (const f of G.fx) {
      if (f.type !== 'hands') continue;
      const k = f.t < 0.5 ? f.t / 0.5 : f.t < 1.0 ? 1 : Math.max(0, 1 - (f.t - 1.0) / 0.6);
      const ex = (f.fx + 0.5 + f.ax * 0.5) * TILE - camX, ey = (f.fy + 0.5 + f.ay * 0.5) * TILE - camY;
      const dirx = -f.ax, diry = -f.ay, perx = -diry, pery = dirx;
      for (let a = 0; a < f.n; a++) {
        const off = (a - (f.n - 1) / 2) * 5 + Math.sin(f.seed + a) * 2, len = k * (7 + (a % 2) * 3), wig = Math.sin(G.t * 12 + a + f.seed) * 0.8;
        for (let i = 0; i <= len; i++) {
          const bx = Math.round(ex + perx * (off + wig * i / 8) + dirx * i), by = Math.round(ey + pery * (off + wig * i / 8) + diry * i);
          ctx.fillStyle = '#0c0808'; ctx.fillRect(bx - 1, by - 1, 3, 3);
          ctx.fillStyle = i % 3 === 0 ? '#9a9080' : '#c8beac'; ctx.fillRect(bx, by, 1, 1);
        }
        // 손가락
        if (len > 3) {
          const hx = ex + perx * off + dirx * len, hy = ey + pery * off + diry * len;
          for (let fg = -1; fg <= 1; fg++) for (let i = 1; i <= 3; i++) {
            ctx.fillStyle = '#d0c6b4';
            ctx.fillRect(Math.round(hx + perx * fg * 1.5 + dirx * i), Math.round(hy + pery * fg * 1.5 + diry * i), 1, 1);
          }
        }
      }
    }

    // 유령 (발밑 그림자와 함께)
    for (const e of G.enemies) {
      if (e.delay > 0) continue;
      // 쫓아올 때 남는 잔상
      if (e.trail && e.type === 'ghost') {
        e.trail.forEach((p, i) => { ctx.globalAlpha = 0.05 + i * 0.05; sprAt(enemyImg(e), p.x, p.y, 0, -3, camX, camY); });
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath(); ctx.ellipse(Math.round((e.x + 0.5) * TILE - camX), Math.round((e.y + 0.5) * TILE - camY) + 8, 6, 2, 0, 0, Math.PI * 2); ctx.fill();
      const img = enemyImg(e);
      if (e.type === 'ghost') {
        const sway = G.S.enemy === 'patient' ? (Math.sin(e.bob * 7) > 0.8 ? 1 : 0) : Math.round(Math.sin(e.bob * 1.7));
        ctx.globalAlpha = 0.86 + 0.1 * Math.sin(e.bob * 3);
        sprAt(img, e.x, e.y, sway, -3, camX, camY);
        if (Math.random() < 0.04) { ctx.globalAlpha = 0.35; sprAt(img, e.x, e.y, sway + (Math.random() < 0.5 ? -3 : 3), -3, camX, camY); }
        ctx.globalAlpha = 1;
      } else {
        const tw = e.lit && Math.random() < 0.06 ? (Math.random() < 0.5 ? -1 : 1) : 0;
        sprAt(img, e.x, e.y, tw, -4, camX, camY);
      }
    }

    // 빛 속에 서 있는 형체들 (가만히 바라보는 것, 등 뒤에 선 것)
    for (const f of G.fx) {
      if (f.type === 'watcher' && !f.out) {
        const tw = f.t > 0.6 && Math.random() < 0.3 ? (Math.random() < 0.5 ? -1 : 1) : 0;
        sprAt(Sprites[G.S.enemy][0], f.x, f.y, tw, -3, camX, camY);
      }
      if (f.type === 'behind' && f.gone < 0) sprAt(Sprites[G.S.enemy][0], f.x, f.y, 0, -3, camX, camY);
    }

    // 플레이어
    const ca = Math.cos(P.ang), sa = Math.sin(P.ang);
    const spr = Math.abs(ca) > Math.abs(sa) ? (ca > 0 ? Sprites.player.r : Sprites.player.l) : (sa > 0 ? Sprites.player.d : Sprites.player.u);
    const bob = P.moving ? Math.round(Math.abs(Math.sin(P.p * Math.PI)) * -1) : 0;
    if (G.state !== 'dying') sprAt(spr, P.x, P.y, 0, bob - 2, camX, camY);

    // 어둠
    drawDarkness(camX, camY);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(dark, 0, 0, VW, VH);
    // 손전등의 따뜻한 빛
    if (G.flick > 0.01 && G.lightPath) {
      const lx = (P.x + 0.5) * TILE - camX, ly = (P.y + 0.5) * TILE - camY, R = G.S.light * TILE;
      ctx.save();
      ctx.clip(G.lightPath);
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(lx, ly, 0, lx, ly, R);
      const [tr, tg, tb] = G.S.tint;
      g.addColorStop(0, `rgba(${tr},${tg},${tb},${0.2 * G.flick})`); g.addColorStop(0.5, `rgba(${tr},${tg},${tb},${0.08 * G.flick})`); g.addColorStop(1, `rgba(${tr},${tg},${tb},0)`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(lx, ly); ctx.arc(lx, ly, R, P.ang - CONE, P.ang + CONE); ctx.closePath(); ctx.fill();
      // 손전등 빛 속을 떠다니는 먼지
      ctx.globalCompositeOperation = 'source-over';
      for (const m of G.motes) {
        const mx = (m.x + 0.5) * TILE - camX, my = (m.y + 0.5) * TILE - camY;
        const dx = m.x - P.x, dy = m.y - P.y, d = Math.hypot(dx, dy);
        if (d > G.S.light || Math.abs(U.angDiff(P.ang, Math.atan2(dy, dx))) > CONE) continue;
        ctx.fillStyle = `rgba(${tr},${tg},${tb},${(1 - d / G.S.light) * 0.55 * G.flick * (0.5 + 0.5 * Math.sin(G.t * 3 + m.ph))})`;
        ctx.fillRect(Math.round(mx), Math.round(my), 1, 1);
      }
      ctx.restore();
    }

    // 손전등이 깜빡이는 찰나에만 보이는 것
    if (G.idx > 0 && G.flick < 0.35 && !G.event && U.hash(Math.floor(G.t * 18), 3, G.idx) < 0.5) {
      const hx = Math.round(P.x + Math.cos(P.ang) * 2.4), hy = Math.round(P.y + Math.sin(P.ang) * 2.4);
      if (!isWall(hx, hy) && los(P.x, P.y, hx, hy)) {
        ctx.globalAlpha = 0.45;
        sprAt(Sprites[G.S.enemy][1], hx, hy, 0, -3, camX, camY);
        ctx.globalAlpha = 1;
      }
    }

    // 어둠 속에서도 보이는 것들: 붉은 눈, 열쇠의 반짝임
    for (const e of G.enemies) {
      if (e.delay > 0) continue;
      const d = Math.hypot(e.x - P.x, e.y - P.y);
      if (d > 9) continue;
      const a = (0.5 + 0.5 * Math.sin(G.t * 6 + e.bob)) * (1 - d / 9) * (G.idx === 0 ? 0.5 : 1);
      ctx.fillStyle = `rgba(255,20,30,${a})`;
      const ex = Math.round(e.x * TILE - camX), ey = Math.round(e.y * TILE - camY);
      const kind = e.type === 'stalker' ? 'stalker' : G.S.enemy;
      const off = kind === 'patient' && Math.floor(e.bob * 3) % 2 ? 1 : 0;
      const oy = e.type === 'stalker' ? -4 : -3;
      for (const [px, py] of Sprites.eyes[kind]) {
        ctx.fillRect(ex + px + off, ey + py + oy, 1, 1);
        ctx.globalAlpha = a * 0.3; ctx.fillRect(ex + px + off - 1, ey + py + oy - 1, 3, 3); ctx.globalAlpha = 1;
      }
    }
    for (const e of G.eyes || []) {
      const open = Math.min(1, e.t * 2, (e.dur - e.t) * 2) * (Math.sin(e.t * 2.3 + e.x) > -0.85 ? 1 : 0);
      if (open <= 0) continue;
      const ex = Math.round((e.x + 0.5) * TILE - camX), ey = Math.round((e.y + 0.4) * TILE - camY);
      ctx.fillStyle = `rgba(255,${G.idx === 1 ? 240 : 30},${G.idx === 1 ? 220 : 30},${open * 0.85})`;
      ctx.fillRect(ex - 3, ey, 2, 1); ctx.fillRect(ex + 2, ey, 2, 1);
    }
    if (!G.hasKey && Math.hypot(G.key.x - P.x, G.key.y - P.y) < 5 && Math.sin(G.t * 4) > 0.85) {
      ctx.fillStyle = 'rgba(255,240,170,0.8)';
      ctx.fillRect(Math.round(G.key.x * TILE - camX + 7), Math.round(G.key.y * TILE - camY + 6), 1, 1);
    }

    // 스쳐 지나가는 그림자
    for (const f of G.fx) {
      if (f.type !== 'runner') continue;
      const k = f.t / f.dur;
      const x = U.lerp(f.x0, f.x1, k), y = U.lerp(f.y0, f.y1, k);
      for (let tr = 0; tr < 4; tr++) {
        ctx.globalAlpha = 0.5 - tr * 0.12;
        const kk = Math.max(0, k - tr * 0.05);
        sprAt(Sprites[G.S.enemy][tr % 2], U.lerp(f.x0, f.x1, kk), U.lerp(f.y0, f.y1, kk), 0, -3, camX, camY);
      }
      ctx.globalAlpha = 0.9;
      sprAt(Sprites[G.S.enemy][1], x, y, 0, -3, camX, camY);
      ctx.globalAlpha = 1;
    }

    // 등 뒤에 서 있던 것과 눈이 마주친 순간
    for (const f of G.fx) {
      if (f.type !== 'behind' || f.gone < 0) continue;
      const img = Real.faceSmall[G.S.faceType];
      if (!img) continue;
      const k = (f.t - f.gone) / 0.35, sz = 70 + k * 90;
      ctx.drawImage(img, Math.round((f.x + 0.5) * TILE - camX - sz / 2 + (Math.random() - 0.5) * 6), Math.round((f.y + 0.5) * TILE - camY - sz / 2 + (Math.random() - 0.5) * 6), sz, sz);
    }

    // 기어 오는 것
    if (G.event && G.event.type === 'crawler') {
      const E = G.event, img = Sprites[G.S.enemy][Math.floor(E.t * 16) % 2];
      if (!E.hit) {
        const d = Math.hypot(P.x - E.x, P.y - E.y), a = Math.atan2(P.y - E.y, P.x - E.x);
        const sx = (E.x + 0.5) * TILE - camX, sy = (E.y + 0.5) * TILE - camY;
        for (let tr = 3; tr >= 0; tr--) {
          ctx.globalAlpha = U.clamp(1.2 - d / 7, 0.15, 1) * (tr ? 0.25 : 1);
          ctx.save();
          ctx.translate(Math.round(sx - Math.cos(a) * tr * 4), Math.round(sy - Math.sin(a) * tr * 4));
          ctx.rotate(a - Math.PI / 2 + Math.sin(E.t * 40) * 0.15);
          ctx.drawImage(img, -12, -12, 24, 24);
          ctx.restore();
        }
        ctx.globalAlpha = 1;
      } else {
        const fi = Real.faceSmall[G.S.faceType];
        if (fi) {
          const k = Math.min(1, (E.t - (E.done - 0.5)) / 0.5), sz = 140 + k * 200;
          ctx.drawImage(fi, VW / 2 - sz / 2 + (Math.random() - 0.5) * 14, VH / 2 - sz / 2 + (Math.random() - 0.5) * 14, sz, sz);
        }
      }
    }

    // 정전 뒤 눈앞에 나타나는 얼굴
    if (G.faceFx) {
      const F = G.faceFx, img = Real.faceSmall[G.S.faceType];
      if (img) {
        const sz = 64 + F.t * 40;
        const fx = (F.x + 0.5) * TILE - camX - sz / 2 + (Math.random() - 0.5) * 4, fy = (F.y + 0.5) * TILE - camY - sz / 2 + (Math.random() - 0.5) * 4;
        ctx.globalAlpha = F.t > 0.45 ? Math.max(0, 1 - (F.t - 0.45) * 6) : 1;
        ctx.drawImage(img, Math.round(fx), Math.round(fy), Math.round(sz), Math.round(sz));
        ctx.globalAlpha = 1;
      }
    }

    // 잡히는 순간: 유령이 화면 가득 다가온다
    if (G.state === 'dying') {
      const D = G.dying, k = Math.min(1, D.t / 0.3);
      const img = enemyImg(D.e);
      const sz = 40 + k * k * 400;
      ctx.drawImage(img, VW / 2 - sz / 2 + (Math.random() - 0.5) * 10, VH / 2 - sz / 2 + (Math.random() - 0.5) * 10, sz, sz);
    }

    // 후처리: 위험할수록 붉어지고 흔들린다
    if (G.danger > 0.05) {
      const pulse = 0.6 + 0.4 * Math.max(0, Math.sin(G.t * (4 + G.danger * 6)));
      ctx.globalAlpha = G.danger * 0.55 * pulse;
      ctx.drawImage(redVig, 0, 0);
      ctx.globalAlpha = 1;
    }
    const wob = G.idx === 2 ? G.danger * 2.5 : G.idx === 1 ? G.danger * 1 : 0;
    if (wob > 0.3) {
      tctx.drawImage(view, 0, 0);
      for (let y = 0; y < VH; y += 3) ctx.drawImage(tmp, 0, y, VW, 3, Math.sin(y * 0.09 + G.t * 9) * wob, y, VW, 3);
    }
    // 두 겹으로 보이는 시야 (겁에 질렸을 때)
    const dbl = Math.max(0, G.danger - 0.35) * 1.5 + G.redFlash * 2;
    if (dbl > 0.02) {
      tctx.drawImage(view, 0, 0);
      ctx.globalCompositeOperation = 'screen';
      ctx.globalAlpha = Math.min(0.5, dbl * 0.35);
      const o = 1 + dbl * 3;
      ctx.drawImage(tmp, o + Math.sin(G.t * 13) * o, 0);
      ctx.drawImage(tmp, -o, Math.cos(G.t * 11) * o * 0.5);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }
    if (G.redFlash > 0) { ctx.fillStyle = `rgba(150,0,0,${G.redFlash})`; ctx.fillRect(0, 0, VW, VH); }
    // 핏빛 비 (3단계, 핏빛 달): 화면 가장자리로 흘러내린다
    if (G.idx === 2 || G.S.bloodRain) {
      G.rain = G.rain || Array.from({ length: 26 }, (_, i) => ({ x: i % 2 ? Math.random() * 46 : VW - Math.random() * 46, y: Math.random() * VH, v: 30 + Math.random() * 60 }));
      ctx.fillStyle = 'rgba(80,0,6,0.55)';
      for (const r of G.rain) {
        r.y += r.v / 60; if (r.y > VH) { r.y = -10; }
        ctx.fillRect(Math.round(r.x), Math.round(r.y), 1, 4);
      }
    }
    // 가만히 있으면 화면 아래에서 손이 기어 올라온다
    if (G.idleStage >= 1) {
      const k = U.clamp((G.idleT - 2.5) / 4, 0, 1);
      for (const side of [-1, 1]) {
        const bx = side < 0 ? 0 : VW, by = VH, len = k * 90;
        for (let f = 0; f < 3; f++) {
          const ang = -Math.PI / 2 + side * (0.6 + f * 0.25) * -1 + Math.sin(G.t * 6 + f) * 0.05;
          for (let i = 0; i < len; i++) {
            const x = Math.round(bx + Math.cos(ang) * i + side * -f * 6), y = Math.round(by + Math.sin(ang) * i);
            ctx.fillStyle = '#060404'; ctx.fillRect(x - 1, y - 1, 3, 3);
            ctx.fillStyle = i % 4 ? '#bdb3a2' : '#8e8574'; ctx.fillRect(x, y, 1, 1);
          }
          const hx = bx + Math.cos(ang) * len + side * -f * 6, hy = by + Math.sin(ang) * len;
          ctx.fillStyle = '#d0c6b4';
          for (let q = -1; q <= 1; q++) for (let i = 1; i <= 4; i++) ctx.fillRect(Math.round(hx + Math.cos(ang + q * 0.35) * i), Math.round(hy + Math.sin(ang + q * 0.35) * i), 1, 1);
        }
      }
      ctx.globalAlpha = k * 0.5; ctx.drawImage(vignette, 0, 0); ctx.globalAlpha = 1;
    }
    // 정해진 시각의 지직거림 속 얼굴
    if (G.staticT > 0) {
      G.staticT -= 1 / 60;
      ctx.globalAlpha = 0.85; ctx.drawImage(noiseFrames[Math.floor(Math.random() * noiseFrames.length)], 0, 0, VW, VH);
      const fi = Real.faceSmall[G.S.faceType];
      if (fi) { ctx.globalAlpha = 0.45; ctx.drawImage(fi, VW / 2 - 90 + (Math.random() - 0.5) * 8, VH / 2 - 90, 180, 180); }
      ctx.globalAlpha = 1;
    }
    if (G.subFlash > 0 && Real.faceSmall[G.S.faceType]) {
      ctx.globalAlpha = 0.55;
      ctx.drawImage(Real.faceSmall[G.S.faceType], VW / 2 - 130 + (Math.random() - 0.5) * 20, VH / 2 - 130, 260, 260);
      ctx.globalAlpha = 1;
    }
    ctx.drawImage(vignette, 0, 0);
    if (G.pulse > 0 && G.danger > 0.1) { ctx.globalAlpha = G.pulse * G.danger * 0.8; ctx.drawImage(vignette, 0, 0); ctx.drawImage(vignette, 0, 0); ctx.globalAlpha = 1; }
    // 필름 입자: 밝은 곳에만 얹고, 위험할 때는 화면 전체가 지직거린다
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.12 + G.idx * 0.04;
    ctx.drawImage(noiseFrames[Math.floor(Math.random() * noiseFrames.length)], 0, 0, VW, VH);
    ctx.globalCompositeOperation = 'source-over';
    const st = G.danger * G.danger * 0.1 + (G.event ? 0.12 : 0);
    if (st > 0.005) { ctx.globalAlpha = st; ctx.drawImage(noiseFrames[Math.floor(Math.random() * noiseFrames.length)], 0, 0, VW, VH); }
    ctx.globalAlpha = 1;
    drawMinimap(camX, camY);
  }

  // ---------- 미니맵 ----------
  // 지나간 자리 주변 5x5 칸만 길과 벽이 기록된다. 열쇠·탈출구·나·유령 위치는 처음부터 보인다.
  function revealAround() {
    const P = G.player, cx = Math.round(P.x), cy = Math.round(P.y);
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const x = cx + dx, y = cy + dy;
      if (x < 0 || y < 0 || x >= G.W || y >= G.H || G.seen[y * G.W + x]) continue;
      G.seen[y * G.W + x] = 1;
      // 새로 본 칸만 미니맵 그림에 한 번 칠해 둔다 (매 프레임 다시 그리지 않음)
      if (!G.mm) { G.mm = U.canvas(G.W * 3, G.H * 3); G.mmx = G.mm.getContext('2d'); }
      G.mmx.fillStyle = isWall(x, y) ? 'rgba(90,82,78,0.85)' : 'rgba(30,26,26,0.9)';
      G.mmx.fillRect(x * 3, y * 3, 3, 3);
    }
  }

  function drawMinimap(camX, camY) {
    const cs = 3, W = G.W, H = G.H, mw = W * cs, mh = H * cs;
    // 나·탈출구·열쇠를 가리지 않는 구석을 골라 천천히 옮긴다
    const sp = (x, y) => [(x + 0.5) * TILE - camX, (y + 0.5) * TILE - camY];
    const P0 = G.player, pts = [sp(P0.x, P0.y), sp(G.door.x, G.door.y)];
    if (!G.hasKey) pts.push(sp(G.key.x, G.key.y));
    const corners = [[VW - mw - 5, 16], [5, 16], [5, VH - mh - 20], [VW - mw - 5, VH - mh - 20]];
    const gap = (c, p) => Math.hypot(Math.max(c[0] - p[0], 0, p[0] - c[0] - mw), Math.max(c[1] - p[1], 0, p[1] - c[1] - mh));
    const score = c => Math.min(...pts.map((p, i) => gap(c, p) - (i === 0 ? 30 : 0)));
    if (G.mmCorner === undefined) G.mmCorner = 0;
    let best = G.mmCorner;
    corners.forEach((c, i) => { if (score(c) > score(corners[best]) + 12) best = i; });
    G.mmCorner = best;
    const tgt = corners[best];
    if (!G.mmPos) G.mmPos = tgt.slice();
    G.mmPos[0] += (tgt[0] - G.mmPos[0]) * 0.15; G.mmPos[1] += (tgt[1] - G.mmPos[1]) * 0.15;
    const ox = Math.round(G.mmPos[0]), oy = Math.round(G.mmPos[1]);
    // 그래도 무언가 밑에 깔리면 반투명하게
    const under = pts.some(p => gap([ox, oy], p) < 8) || G.enemies.some(e => e.delay <= 0 && gap([ox, oy], sp(e.x, e.y)) < 8);
    G.mmAlpha = U.lerp(G.mmAlpha === undefined ? 1 : G.mmAlpha, under ? 0.3 : 1, 0.2);
    ctx.save();
    ctx.globalAlpha = G.mmAlpha;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(ox - 2, oy - 2, mw + 4, mh + 4);
    ctx.fillStyle = 'rgba(120,20,20,0.5)';
    ctx.fillRect(ox - 2, oy - 2, mw + 4, 1); ctx.fillRect(ox - 2, oy + mh + 1, mw + 4, 1);
    ctx.fillRect(ox - 2, oy - 2, 1, mh + 4); ctx.fillRect(ox + mw + 1, oy - 2, 1, mh + 4);
    if (G.mm) ctx.drawImage(G.mm, ox, oy);
    const blink = Math.sin(G.t * 8) > 0;
    // 탈출구, 열쇠
    ctx.fillStyle = G.hasKey ? (blink ? '#ff5a20' : '#a02008') : '#c03010';
    ctx.fillRect(ox + G.door.x * cs, oy + G.door.y * cs, cs, cs);
    if (!G.hasKey) { ctx.fillStyle = blink ? '#ffe070' : '#c09020'; ctx.fillRect(ox + G.key.x * cs, oy + G.key.y * cs, cs, cs); }
    // 유령
    for (const e of G.enemies) {
      if (e.delay > 0) continue;
      ctx.fillStyle = e.type === 'stalker' ? '#ffffff' : '#ff1a2a';
      ctx.fillRect(ox + Math.round(e.x) * cs, oy + Math.round(e.y) * cs, cs, cs);
    }
    // 나
    const P = G.player;
    ctx.fillStyle = '#40e0ff';
    ctx.fillRect(ox + Math.round(P.x) * cs, oy + Math.round(P.y) * cs, cs, cs);
    ctx.restore();
  }

  return {
    start, frame, quit, togglePause, dailyCurse,
    get active() { return !!G; },
    get state() { return G && G.state; },
  };
})();
