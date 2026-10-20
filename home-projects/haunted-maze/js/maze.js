'use strict';
// 미로 만들기와 길 찾기. 칸 값: 1 = 벽, 0 = 길

const DIR4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

const Maze = {
  generate(cw, ch, seed, loops) {
    const rnd = U.rng(seed);
    const W = cw * 2 + 1, H = ch * 2 + 1;
    const g = new Uint8Array(W * H).fill(1);
    const vis = new Uint8Array(cw * ch);
    const stack = [[0, 0]];
    vis[0] = 1;
    g[W + 1] = 0;
    while (stack.length) {
      const [cx, cy] = stack[stack.length - 1];
      const nb = [];
      for (const [dx, dy] of DIR4) {
        const nx = cx + dx, ny = cy + dy;
        if (nx >= 0 && ny >= 0 && nx < cw && ny < ch && !vis[ny * cw + nx]) nb.push([nx, ny, dx, dy]);
      }
      if (!nb.length) { stack.pop(); continue; }
      const [nx, ny, dx, dy] = nb[Math.floor(rnd() * nb.length)];
      vis[ny * cw + nx] = 1;
      g[(cy * 2 + 1 + dy) * W + (cx * 2 + 1 + dx)] = 0;
      g[(ny * 2 + 1) * W + (nx * 2 + 1)] = 0;
      stack.push([nx, ny]);
    }
    // 벽을 조금 뚫어서 도망칠 갈림길을 만든다
    for (let y = 1; y < H - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        if (g[y * W + x] !== 1) continue;
        const horiz = x % 2 === 0 && y % 2 === 1 && g[y * W + x - 1] === 0 && g[y * W + x + 1] === 0;
        const vert = x % 2 === 1 && y % 2 === 0 && g[(y - 1) * W + x] === 0 && g[(y + 1) * W + x] === 0;
        if ((horiz || vert) && rnd() < loops) g[y * W + x] = 0;
      }
    }
    return { W, H, g };
  },

  // 막다른 길마다 벽 하나를 뚫어서 어디서든 돌아 나갈 수 있게 한다.
  // keep(x, y) 가 true 인 칸(탈출구)만 막다른 길로 남긴다.
  braid(mz, rnd, keep) {
    const { W, H, g } = mz;
    const openCount = (x, y) => {
      let n = 0;
      for (const [dx, dy] of DIR4) if (!g[(y + dy) * W + x + dx]) n++;
      return n;
    };
    for (let y = 1; y < H; y += 2) {
      for (let x = 1; x < W; x += 2) {
        if (g[y * W + x] || keep(x, y) || openCount(x, y) !== 1) continue;
        const opts = [];
        for (const [dx, dy] of DIR4) {
          const wx = x + dx, wy = y + dy, nx = x + dx * 2, ny = y + dy * 2;
          if (nx < 1 || ny < 1 || nx > W - 2 || ny > H - 2) continue;
          if (!g[wy * W + wx] || keep(nx, ny)) continue;
          opts.push({ wx, wy, deadEnd: openCount(nx, ny) === 1 });
        }
        if (!opts.length) continue;
        const pref = opts.filter(o => o.deadEnd), pool = pref.length ? pref : opts;
        const o = pool[Math.floor(rnd() * pool.length)];
        g[o.wy * W + o.wx] = 0;
      }
    }
  },

  // blocked(x, y) 가 true 인 칸은 지나가지 못한다
  bfs(mz, sx, sy, blocked) {
    const { W, H, g } = mz;
    const dist = new Int32Array(W * H).fill(-1);
    const q = new Int32Array(W * H);
    let head = 0, tail = 0;
    dist[sy * W + sx] = 0;
    q[tail++] = sy * W + sx;
    while (head < tail) {
      const i = q[head++], x = i % W, y = (i / W) | 0;
      for (const [dx, dy] of DIR4) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx;
        if (g[j] || dist[j] >= 0) continue;
        if (blocked && blocked(nx, ny)) continue;
        dist[j] = dist[i] + 1;
        q[tail++] = j;
      }
    }
    return dist;
  },

  path(mz, a, b, blocked) {
    const dist = Maze.bfs(mz, b.x, b.y, blocked);
    const W = mz.W;
    if (dist[a.y * W + a.x] < 0) return [a];
    const out = [{ x: a.x, y: a.y }];
    let x = a.x, y = a.y;
    while (x !== b.x || y !== b.y) {
      const cur = dist[y * W + x];
      for (const [dx, dy] of DIR4) {
        const d = dist[(y + dy) * W + (x + dx)];
        if (d >= 0 && d === cur - 1) { x += dx; y += dy; break; }
      }
      out.push({ x, y });
    }
    return out;
  },
};
