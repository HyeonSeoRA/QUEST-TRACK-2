'use strict';
// 폐교 2층: 칸(1m) 지도, 벽·바닥·천장, 교실 소품, 문, 형광등

const World = (() => {
  const W = {};
  const GW = 63, GH = 28, WALL_H = 3.0;
  W.GW = GW; W.GH = GH; W.WALL_H = WALL_H;
  const grid = new Uint8Array(GW * GH);          // 0 벽, 1 바닥, 2 문
  const roomGrid = new Int8Array(GW * GH).fill(-1);
  const doorGrid = new Array(GW * GH).fill(null);
  const idx = (x, z) => z * GW + x;

  // 방 (칸 좌표, 양끝 포함). 실제 위치는 x0 ~ x1+1
  W.rooms = [
    { id: 'c21', name: '2학년 1반', x0: 1, x1: 12, z0: 1, z1: 10, floor: 'wood', wall: 'plaster', cls: true },
    { id: 'c22', name: '2학년 2반', x0: 14, x1: 25, z0: 1, z1: 10, floor: 'wood', wall: 'plaster', cls: true },
    { id: 'c23', name: '2학년 3반', x0: 27, x1: 38, z0: 1, z1: 10, floor: 'wood', wall: 'plaster', cls: true },
    { id: 'music', name: '음악실', x0: 40, x1: 52, z0: 1, z1: 10, floor: 'wood', wall: 'music' },
    { id: 'sci', name: '과학실', x0: 54, x1: 61, z0: 1, z1: 10, floor: 'lino', wall: 'plaster' },
    { id: 'hall', name: '2층 복도', x0: 1, x1: 61, z0: 12, z1: 15, floor: 'hall', wall: 'plaster' },
    { id: 'stair', name: '중앙 계단', x0: 1, x1: 7, z0: 17, z1: 26, floor: 'hall', wall: 'plaster' },
    { id: 'toilet', name: '여자 화장실', x0: 9, x1: 17, z0: 17, z1: 26, floor: 'tile', wall: 'tile' },
    { id: 'office', name: '교무실', x0: 19, x1: 33, z0: 17, z1: 26, floor: 'lino', wall: 'plaster' },
    { id: 'nurse', name: '보건실', x0: 35, x1: 45, z0: 17, z1: 26, floor: 'lino', wall: 'plaster' },
    { id: 'broad', name: '방송실', x0: 47, x1: 61, z0: 17, z1: 26, floor: 'hall', wall: 'burnt' },
  ];
  W.room = id => W.rooms.find(r => r.id === id);
  // 방 안의 비율 위치 → 실제 좌표
  W.R = (id, fx, fz) => { const r = W.room(id); return { x: r.x0 + fx * (r.x1 + 1 - r.x0), z: r.z0 + fz * (r.z1 + 1 - r.z0) }; };

  W.doors = [
    { id: 'd21', room: 'c21', x: 2, z: 11 },
    { id: 'd22', room: 'c22', x: 15, z: 11 },
    { id: 'd23', room: 'c23', x: 28, z: 11, lock: 'jam' },
    { id: 'dmus', room: 'music', x: 41, z: 11, lock: 'key_music' },
    { id: 'dsci', room: 'sci', x: 57, z: 11, lock: 'key_sci' },
    { id: 'dsta', room: 'stair', x: 3, z: 16, lock: 'seal' },
    { id: 'dtoi', room: 'toilet', x: 12, z: 16 },
    { id: 'doff', room: 'office', x: 25, z: 16, lock: 'key_office' },
    { id: 'dnur', room: 'nurse', x: 39, z: 16 },
    { id: 'dbro', room: 'broad', x: 53, z: 16, lock: 'key_broad' },
  ];
  W.door = id => W.doors.find(d => d.id === id);

  W.rooms.forEach((r, i) => {
    for (let z = r.z0; z <= r.z1; z++) for (let x = r.x0; x <= r.x1; x++) { grid[idx(x, z)] = 1; roomGrid[idx(x, z)] = i; }
  });
  W.doors.forEach(d => {
    d.open = false; d.t = 0; d.baseLock = d.lock || null;
    const ri = W.rooms.findIndex(r => r.id === d.room);
    for (let k = 0; k < 2; k++) { grid[idx(d.x + k, d.z)] = 2; roomGrid[idx(d.x + k, d.z)] = ri; doorGrid[idx(d.x + k, d.z)] = d; }
  });

  W.cell = (x, z) => (x < 0 || z < 0 || x >= GW || z >= GH) ? 0 : grid[idx(x, z)];
  W.isSolid = (cx, cz) => {
    if (cx < 0 || cz < 0 || cx >= GW || cz >= GH) return true;
    const g = grid[idx(cx, cz)];
    if (g === 0) return true;
    if (g === 2) return doorGrid[idx(cx, cz)].t < 0.75;
    return false;
  };
  // 귀신용: 잠기지 않은 닫힌 문은 지나갈 수 있다고 본다 (가서 연다)
  W.isWalkable = (cx, cz) => {
    if (cx < 0 || cz < 0 || cx >= GW || cz >= GH) return false;
    const g = grid[idx(cx, cz)];
    if (g === 0) return false;
    if (g === 2) { const d = doorGrid[idx(cx, cz)]; return d.open || !d.lock; }
    return true;
  };
  W.doorAt = (cx, cz) => (cx < 0 || cz < 0 || cx >= GW || cz >= GH) ? null : doorGrid[idx(cx, cz)];
  W.roomAt = (x, z) => {
    const cx = Math.floor(x), cz = Math.floor(z);
    if (cx < 0 || cz < 0 || cx >= GW || cz >= GH) return null;
    const i = roomGrid[idx(cx, cz)];
    return i >= 0 ? W.rooms[i] : null;
  };
  W.floorType = (x, z) => {
    const r = W.roomAt(x, z);
    if (!r) return 'hall';
    return r.floor === 'tile' ? 'tile' : r.floor === 'wood' ? 'wood' : 'hall';
  };
  // 두 점 사이가 벽에 막히지 않았나
  W.los = (x1, z1, x2, z2) => {
    const dx = x2 - x1, dz = z2 - z1, dist = Math.hypot(dx, dz);
    const n = Math.ceil(dist / 0.2);
    for (let i = 1; i < n; i++) {
      const t = i / n;
      if (W.isSolid(Math.floor(x1 + dx * t), Math.floor(z1 + dz * t))) return false;
    }
    return true;
  };

  // ---------- 충돌 상자 (소품) ----------
  const bins = new Map();
  W.boxes = [];
  function addBox(x0, z0, x1, z1) {
    const b = { x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1) };
    W.boxes.push(b);
    for (let z = Math.floor(b.z0); z <= Math.floor(b.z1); z++) for (let x = Math.floor(b.x0); x <= Math.floor(b.x1); x++) {
      const k = idx(x, z);
      if (!bins.has(k)) bins.set(k, []);
      bins.get(k).push(b);
    }
    return b;
  }
  W.addBox = addBox;
  W.removeBox = b => { bins.forEach(list => { const i = list.indexOf(b); if (i >= 0) list.splice(i, 1); }); };
  function pushOut(p, rad, x0, z0, x1, z1) {
    const nx = Math.max(x0, Math.min(x1, p.x)), nz = Math.max(z0, Math.min(z1, p.z));
    const dx = p.x - nx, dz = p.z - nz, d2 = dx * dx + dz * dz;
    if (d2 >= rad * rad) return false;
    if (d2 > 1e-8) { const d = Math.sqrt(d2); p.x = nx + dx / d * rad; p.z = nz + dz / d * rad; }
    else {
      const l = p.x - x0, r = x1 - p.x, t = p.z - z0, b = z1 - p.z, m = Math.min(l, r, t, b);
      if (m === l) p.x = x0 - rad; else if (m === r) p.x = x1 + rad; else if (m === t) p.z = z0 - rad; else p.z = z1 + rad;
    }
    return true;
  }
  W.collide = (p, rad, props = true) => {
    for (let it = 0; it < 2; it++) {
      const cx0 = Math.floor(p.x - rad), cx1 = Math.floor(p.x + rad), cz0 = Math.floor(p.z - rad), cz1 = Math.floor(p.z + rad);
      for (let z = cz0; z <= cz1; z++) for (let x = cx0; x <= cx1; x++) {
        if (W.isSolid(x, z)) pushOut(p, rad, x, z, x + 1, z + 1);
        if (props) { const list = bins.get(idx(x, z)); if (list) for (const b of list) pushOut(p, rad, b.x0, b.z0, b.x1, b.z1); }
      }
    }
  };

  // ---------- 재질 ----------
  const M = {};
  const std = (o) => new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.9, metalness: 0 }, o));
  W.M = M;
  W.std = std;

  // 여러 조각을 한 덩어리로 (재질 번호별 그룹)
  function merge(parts) {
    parts = parts.map(p => ({ g: p.g.index ? p.g.toNonIndexed() : p.g, m: p.m || 0 })).sort((a, b) => a.m - b.m);
    let total = 0;
    parts.forEach(p => { total += p.g.attributes.position.count; });
    const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), uv = new Float32Array(total * 2);
    const geo = new THREE.BufferGeometry();
    let off = 0, gs = 0, cur = parts.length ? parts[0].m : 0;
    for (const p of parts) {
      if (p.m !== cur) { geo.addGroup(gs, off - gs, cur); gs = off; cur = p.m; }
      pos.set(p.g.attributes.position.array, off * 3);
      nor.set(p.g.attributes.normal.array, off * 3);
      if (p.g.attributes.uv) uv.set(p.g.attributes.uv.array, off * 2);
      off += p.g.attributes.position.count;
    }
    geo.addGroup(gs, off - gs, cur);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.computeBoundingSphere();
    return geo;
  }
  W.merge = merge;
  const bx = (w, h, d, x, y, z, m = 0, ry = 0, rx = 0, rz = 0) => {
    const g = new THREE.BoxGeometry(w, h, d);
    if (rx) g.rotateX(rx);
    if (rz) g.rotateZ(rz);
    if (ry) g.rotateY(ry);
    g.translate(x, y, z);
    return { g, m };
  };
  const cyl = (rt, rb, h, x, y, z, m = 0, seg = 8, rx = 0, rz = 0) => {
    const g = new THREE.CylinderGeometry(rt, rb, h, seg);
    if (rx) g.rotateX(rx);
    if (rz) g.rotateZ(rz);
    g.translate(x, y, z);
    return { g, m };
  };
  W.bx = bx; W.cyl = cyl;

  let scene, root;
  W.interact = [];      // 손으로 만질 수 있는 것
  W.named = {};
  W.fixtures = [];
  W.anims = [];         // 매 프레임 움직이는 소품
  W.mode = 'normal';    // normal / red / dark
  W.darkRooms = new Set();

  function mesh(geo, mat, x = 0, y = 0, z = 0, parent = root, shadow = true) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = shadow; m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  W.mesh = mesh;
  // 벽에 붙이는 판 (normal: '+x' '-x' '+z' '-z')
  const ROT = { '+z': 0, '+x': Math.PI / 2, '-z': Math.PI, '-x': -Math.PI / 2 };
  function wallPlane(mat, w, h, x, y, z, dir, off = 0.02) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    const n = { '+z': [0, 1], '+x': [1, 0], '-z': [0, -1], '-x': [-1, 0] }[dir];
    m.position.set(x + n[0] * off, y, z + n[1] * off);
    m.rotation.y = ROT[dir];
    m.receiveShadow = true;
    root.add(m);
    return m;
  }
  W.wallPlane = wallPlane;
  const decalCache = {};
  function decalMat(map, opacity = 1) {
    const k = map.uuid + opacity;
    return decalCache[k] || (decalCache[k] = std({ map, transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, roughness: 0.6 }));
  }
  W.decalMat = decalMat;
  function floorDecal(map, x, z, s, rot = 0, opacity = 1) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s), decalMat(map, opacity));
    m.rotation.x = -Math.PI / 2; m.rotation.z = rot;
    m.position.set(x, 0.012, z);
    m.receiveShadow = true;
    root.add(m);
    return m;
  }
  W.floorDecal = floorDecal;
  function planeUV(w, h, ru, rv) {
    const g = new THREE.PlaneGeometry(w, h);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * ru, uv.getY(i) * rv);
    return g;
  }

  // ---------- 짓기 ----------
  W.build = (sc, onStep) => {
    scene = sc;
    root = new THREE.Group();
    scene.add(root);
    const r = Tex.rng(2006);

    M.wood = std({ map: Tex.floor('wood'), roughness: 0.75 });
    M.desk = std({ map: Tex.floor('wood'), color: 0xd8c0a0, roughness: 0.7 });
    M.metal = std({ color: 0x3c4046, roughness: 0.55, metalness: 0.5 });
    M.rust = std({ color: 0x4a3226, roughness: 0.9, metalness: 0.3 });
    M.dark = std({ color: 0x15130f, roughness: 0.9 });
    M.white = std({ color: 0xb8b4aa, roughness: 0.6 });
    M.black = std({ color: 0x0a0a0c, roughness: 0.25, metalness: 0.2 });
    M.jamb = std({ color: 0x3a2a1c, roughness: 0.8 });
    M.lintel = std({ map: Tex.wall('plaster', 0), roughness: 0.95 });
    M.locker = std({ map: Tex.locker(), roughness: 0.6, metalness: 0.3 });
    M.cloth = std({ map: Tex.cloth(), side: THREE.DoubleSide, transparent: true, alphaTest: 0.5, roughness: 1 });
    M.door = std({ map: Tex.door(), roughness: 0.7 });
    M.glass = std({ color: 0x0a1014, roughness: 0.1, metalness: 0.6, transparent: true, opacity: 0.55 });
    M.window = new THREE.MeshBasicMaterial({ map: Tex.windowNight(), color: 0x6a7080 });
    M.mirror = std({ color: 0x3a4248, roughness: 0.12, metalness: 0.35 });
    M.porcelain = std({ color: 0xa8aaa4, roughness: 0.3 });
    M.green = std({ color: 0x1d3a2a, roughness: 0.8 });
    M.paperMats = [1, 2, 3, 4, 5].map(s => std({ map: Tex.paper(s), roughness: 1, side: THREE.DoubleSide }));
    onStep && onStep(0.1);

    // --- 벽 면 (바닥 칸 쪽을 바라보는 판만 만든다) ---
    const wallSets = {};
    const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let z = 0; z < GH; z++) for (let x = 0; x < GW; x++) {
      const g = grid[idx(x, z)];
      if (g === 0) continue;
      const room = W.rooms[roomGrid[idx(x, z)]];
      for (const [dx, dz] of DIRS) {
        if (W.cell(x + dx, z + dz) !== 0) continue;
        let style = g === 2 ? 'jamb' : room.wall, variant = 0;
        if (style !== 'jamb') {
          const v = r();
          variant = v < 0.45 ? 0 : v < 0.7 ? 1 : v < 0.85 ? 2 : 3;
          if (style === 'tile' && variant > 1) variant = r() < 0.5 ? 0 : 3;
        }
        const key = style + variant;
        if (!wallSets[key]) wallSets[key] = { style, variant, pos: [], nor: [], uv: [] };
        const s = wallSets[key];
        const nx = -dx, nz = -dz;                 // 방 쪽을 향함
        const rx = nz, rz = -nx;                   // 바라봤을 때 오른쪽
        const cx = x + 0.5 + dx * 0.5, cz = z + 0.5 + dz * 0.5;
        const p0 = [cx - rx * 0.5, 0, cz - rz * 0.5], p1 = [cx + rx * 0.5, 0, cz + rz * 0.5];
        const H = g === 2 ? 2.25 : WALL_H;
        const v = [[p0[0], 0, p0[2]], [p1[0], 0, p1[2]], [p1[0], H, p1[2]], [p0[0], H, p0[2]]];
        const uvs = [[0, 0], [1, 0], [1, H / WALL_H], [0, H / WALL_H]];
        [0, 1, 2, 0, 2, 3].forEach(i => { s.pos.push(...v[i]); s.nor.push(nx, 0, nz); s.uv.push(...uvs[i]); });
      }
    }
    Object.values(wallSets).forEach(s => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(s.pos, 3));
      geo.setAttribute('normal', new THREE.Float32BufferAttribute(s.nor, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(s.uv, 2));
      const mat = s.style === 'jamb' ? M.jamb : std({ map: Tex.wall(s.style, s.variant), roughness: 0.95 });
      const m = mesh(geo, mat, 0, 0, 0, root, false);
      m.userData.wall = true;
      W.interact.push(m);
    });
    onStep && onStep(0.35);

    // --- 바닥과 천장 ---
    const floorMats = {}, rep = { wood: 2, hall: 1, tile: 1, lino: 2 };
    const ceilMat = std({ map: Tex.floor('ceil'), roughness: 1 });
    W.rooms.forEach(rm => {
      const w = rm.x1 + 1 - rm.x0, d = rm.z1 + 1 - rm.z0, cx = rm.x0 + w / 2, cz = rm.z0 + d / 2;
      if (!floorMats[rm.floor]) floorMats[rm.floor] = std({ map: Tex.floor(rm.floor), roughness: rm.floor === 'tile' ? 0.45 : 0.8 });
      const f = mesh(planeUV(w, d, w / rep[rm.floor], d / rep[rm.floor]), floorMats[rm.floor], cx, 0, cz, root, false);
      f.rotation.x = -Math.PI / 2;
      const c = mesh(planeUV(w, d, w / 1.2, d / 1.2), ceilMat, cx, WALL_H, cz, root, false);
      c.rotation.x = Math.PI / 2;
    });
    // 군데군데 빠지거나 매달린 천장 판
    const holeM = new THREE.MeshBasicMaterial({ color: 0x010101 });
    const hangM = std({ map: Tex.floor('ceil'), roughness: 1, side: THREE.DoubleSide });
    W.rooms.forEach(rm => {
      const n = Math.round((rm.x1 - rm.x0 + 1) * (rm.z1 - rm.z0 + 1) / (rm.id === 'broad' ? 6 : 14));
      for (let i = 0; i < n; i++) {
        const x = rm.x0 + 0.6 + Math.floor(r() * (rm.x1 - rm.x0) / 0.6) * 0.6, z = rm.z0 + 0.6 + Math.floor(r() * (rm.z1 - rm.z0) / 0.6) * 0.6;
        const h = mesh(new THREE.PlaneGeometry(0.58, 0.58), holeM, x + 0.3, WALL_H - 0.004, z + 0.3, root, false);
        h.rotation.x = Math.PI / 2;
        if (r() < 0.3) { // 한쪽이 떨어져 매달림
          const t = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.58), hangM);
          t.geometry.translate(0, -0.29, 0);
          t.position.set(x + 0.3, WALL_H - 0.01, z + 0.01);
          t.rotation.x = 0.35 + r() * 0.6;
          root.add(t);
        }
      }
    });
    // 문 칸
    W.doors.forEach(d => {
      const f = mesh(planeUV(2, 1, 2, 1), floorMats.hall, d.x + 1, 0, d.z + 0.5, root, false);
      f.rotation.x = -Math.PI / 2;
      mesh(new THREE.BoxGeometry(2, WALL_H - 2.25, 1), M.lintel, d.x + 1, 2.25 + (WALL_H - 2.25) / 2, d.z + 0.5, root, false);
    });
    onStep && onStep(0.5);

    buildDoors();
    buildClassrooms(r);
    onStep && onStep(0.65);
    buildCorridor(r);
    buildToilet(r);
    buildOffice(r);
    buildNurse(r);
    onStep && onStep(0.8);
    buildMusic(r);
    buildScience(r);
    buildBroadcast(r);
    buildStair(r);
    buildInstances();
    buildFixtures(r);
    buildDecals(r);
    optimize();
    onStep && onStep(1);
  };

  // ---------- 움직이지 않는 소품을 재질별로 한 덩어리로 합친다 (그리기 횟수 줄이기) ----------
  function optimize() {
    const keep = new Set(W.interact);
    Object.values(W.named).forEach(o => { if (o && o.traverse) o.traverse(c => keep.add(c)); });
    W.fixtures.forEach(f => f.group.traverse(c => keep.add(c)));
    root.updateMatrixWorld(true);
    const buckets = new Map(), victims = [];
    const dynamic = o => { for (let p = o; p && p !== root; p = p.parent) if (p.userData.dyn) return true; return false; };
    root.traverse(o => {
      if (!o.isMesh || o.isInstancedMesh || keep.has(o) || dynamic(o)) return;
      const g = o.geometry;
      if (!g.attributes.normal || !g.attributes.uv) return;
      const ng = (g.index ? g.toNonIndexed() : g.clone()).applyMatrix4(o.matrixWorld);
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const groups = ng.groups.length ? ng.groups : [{ start: 0, count: ng.attributes.position.count, materialIndex: 0 }];
      groups.forEach(gr => {
        const mat = mats[gr.materialIndex] || mats[0];
        const key = mat.uuid + (o.castShadow ? 's' : '');
        if (!buckets.has(key)) buckets.set(key, { mat, shadow: o.castShadow, parts: [] });
        buckets.get(key).parts.push({ ng, start: gr.start, count: Math.min(gr.count, ng.attributes.position.count - gr.start) });
      });
      victims.push(o);
    });
    victims.forEach(o => o.parent.remove(o));
    buckets.forEach(b => {
      let n = 0;
      b.parts.forEach(p => { n += p.count; });
      const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
      let off = 0;
      b.parts.forEach(p => {
        const A = p.ng.attributes;
        pos.set(A.position.array.subarray(p.start * 3, (p.start + p.count) * 3), off * 3);
        nor.set(A.normal.array.subarray(p.start * 3, (p.start + p.count) * 3), off * 3);
        uv.set(A.uv.array.subarray(p.start * 2, (p.start + p.count) * 2), off * 2);
        off += p.count;
      });
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      geo.computeBoundingSphere();
      const m = new THREE.Mesh(geo, b.mat);
      m.castShadow = b.shadow; m.receiveShadow = true;
      root.add(m);
    });
    W.batched = { merged: victims.length, into: buckets.size };
  }

  // ---------- 문 ----------
  function buildDoors() {
    W.doors.forEach(d => {
      const g = new THREE.Group();
      g.position.set(d.x + 1, 0, d.z + 0.5);
      const panel = mesh(new THREE.BoxGeometry(1.96, 2.2, 0.06), M.door, 0, 1.1, 0, g);
      panel.userData.door = d;
      W.interact.push(panel);
      root.add(g);
      g.userData.dyn = true;
      d.group = g; d.panel = panel;
      // 복도 쪽 명패
      const rm = W.room(d.room);
      const north = d.z === 11;
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.25), std({ map: Tex.sign(rm.name), roughness: 0.8 }));
      sign.position.set(d.x + 1, 2.62, north ? d.z + 1.02 : d.z - 0.02);
      sign.rotation.y = north ? 0 : Math.PI;
      root.add(sign);
      if (d.lock === 'seal') { // 쇠사슬
        const chain = std({ color: 0x4a4440, roughness: 0.5, metalness: 0.8 });
        const parts = [];
        for (let i = 0; i < 14; i++) parts.push({ g: new THREE.TorusGeometry(0.06, 0.015, 5, 8).rotateY(i % 2 ? Math.PI / 2 : 0).rotateZ(0.5).translate(-0.8 + i * 0.12, 1.2 + Math.sin(i * 0.6) * 0.15, -0.07), m: 0 });
        for (let i = 0; i < 14; i++) parts.push({ g: new THREE.TorusGeometry(0.06, 0.015, 5, 8).rotateY(i % 2 ? Math.PI / 2 : 0).rotateZ(-0.5).translate(-0.8 + i * 0.12, 1.0 - Math.sin(i * 0.6) * 0.15, -0.07), m: 0 });
        parts.push(bx(0.16, 0.2, 0.08, 0, 1.05, -0.1));
        const cm = mesh(merge(parts), chain, 0, 0, 0, g);
        d.chain = cm;
      }
    });
  }
  W.setDoor = (d, open, sound = true) => {
    if (d.open === open) return;
    d.open = open;
    if (sound) Sound.door({ x: d.x + 1, z: d.z + 0.5 });
  };
  W.unlock = d => { d.lock = null; if (d.chain) { d.chain.visible = false; } };

  // ---------- 교실 ----------
  const deskT = [], chairT = [];
  W.chairs = {};       // 방 id → 의자 번호들
  function deskGeo() {
    return merge([
      bx(0.45, 0.035, 0.64, 0, 0.74, 0, 0),
      bx(0.38, 0.1, 0.56, 0.02, 0.64, 0, 1),
      ...[[-0.19, -0.28], [-0.19, 0.28], [0.19, -0.28], [0.19, 0.28]].map(([x, z]) => bx(0.03, 0.72, 0.03, x, 0.36, z, 1)),
    ]);
  }
  function chairGeo() {
    return merge([
      bx(0.38, 0.03, 0.4, 0, 0.44, 0, 0),
      bx(0.03, 0.3, 0.38, 0.19, 0.7, 0, 0),
      ...[[-0.16, -0.17], [-0.16, 0.17], [0.17, -0.17], [0.17, 0.17]].map(([x, z]) => bx(0.025, 0.44, 0.025, x, 0.22, z, 1)),
      bx(0.025, 0.3, 0.025, 0.19, 0.6, -0.17, 1), bx(0.025, 0.3, 0.025, 0.19, 0.6, 0.17, 1),
    ]);
  }
  function addDesk(x, z, yaw = 0, fallen = false) {
    deskT.push({ x, z, yaw, fallen });
    if (!fallen) addBox(x - 0.24, z - 0.33, x + 0.24, z + 0.33);
  }
  function addChair(roomId, x, z, yaw = 0, fallen = false) {
    chairT.push({ x, z, yaw, fallen, base: yaw });
    (W.chairs[roomId] = W.chairs[roomId] || []).push(chairT.length - 1);
  }
  W.deskSpot = (roomId, i, j) => { const rm = W.room(roomId); return { x: rm.x0 + 3.6 + i * 1.6, z: rm.z0 + 1.3 + j * 2.0 }; };

  function blackboard(rm, lines, side) {
    const zc = (rm.z0 + rm.z1 + 1) / 2;
    const b = wallPlane(std({ map: Tex.board(lines, side), roughness: 0.85 }), 4.8, 1.3, rm.x0, 1.55, zc, '+x', 0.04);
    mesh(new THREE.BoxGeometry(0.06, 1.42, 4.92), M.jamb, rm.x0 + 0.02, 1.55, zc, root, false);
    mesh(new THREE.BoxGeometry(0.12, 0.04, 4.8), M.jamb, rm.x0 + 0.07, 0.88, zc, root, false);
    return b;
  }
  function clock(x, y, z, dir) {
    const g = new THREE.Group();
    const face = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 24), std({ color: 0xc8c0b0, roughness: 0.6 }));
    face.rotation.x = Math.PI / 2;
    g.add(face);
    const hand = (len, w, ang) => {
      const h = new THREE.Mesh(new THREE.BoxGeometry(w, len, 0.01), M.dark);
      h.geometry.translate(0, len / 2, 0);
      h.position.z = 0.03; h.rotation.z = -ang;
      g.add(h);
    };
    hand(0.11, 0.025, (4 + 44 / 60) / 12 * Math.PI * 2);   // 4:44
    hand(0.17, 0.015, 44 / 60 * Math.PI * 2);
    g.position.set(x, y, z);
    g.rotation.y = ROT[dir];
    root.add(g);
  }
  function lockersAlong(x, z0, z1, dir, h = 1.1) {
    for (let z = z0; z + 1 <= z1 + 0.01; z += 1) {
      const m = mesh(new THREE.BoxGeometry(0.45, h, 0.98), M.locker, x, h / 2, z + 0.5);
      if (dir === '-x') m.position.x = x - 0.23; else m.position.x = x + 0.23;
      addBox(m.position.x - 0.23, z, m.position.x + 0.23, z + 1);
    }
  }
  function windows(rm) {
    // 북쪽 바깥벽 (z = 1)
    for (let x = rm.x0 + 1; x + 1.6 <= rm.x1 + 1; x += 2.2) {
      wallPlane(M.window, 1.6, 1.5, x + 0.8, 1.75, rm.z0, '+z', 0.015);
      mesh(new THREE.BoxGeometry(1.7, 0.06, 0.12), M.jamb, x + 0.8, 1.0, rm.z0 + 0.05, root, false);
      mesh(new THREE.BoxGeometry(1.7, 0.06, 0.06), M.jamb, x + 0.8, 2.5, rm.z0 + 0.03, root, false);
      mesh(new THREE.BoxGeometry(0.05, 1.5, 0.06), M.jamb, x + 0.8, 1.75, rm.z0 + 0.03, root, false);
      mesh(new THREE.BoxGeometry(0.05, 1.5, 0.06), M.jamb, x, 1.75, rm.z0 + 0.03, root, false);
      mesh(new THREE.BoxGeometry(0.05, 1.5, 0.06), M.jamb, x + 1.6, 1.75, rm.z0 + 0.03, root, false);
    }
    // 찢어진 커튼 몇 장
    for (let x = rm.x0 + 1.5; x < rm.x1; x += 4.4) {
      const c = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.9, 1, 6), M.cloth);
      c.position.set(x, 1.65, rm.z0 + 0.2);
      root.add(c);
      c.userData.dyn = true;
      W.anims.push(t => { c.rotation.x = Math.sin(t * 0.7 + x) * 0.06; });
    }
  }

  function buildClassrooms(r) {
    const boards = {
      c21: [[{ t: '수행평가 — 11월 3일까지', size: 56 }, { t: '나 가 게 해 줘', size: 80, color: 'rgba(200,40,40,0.8)', y: 150, x: 200 }], ['주번 7번', '11월 1일']],
      c22: [[{ t: '2학년 2반은 오늘 비어 있음', size: 56 }, { t: '(야자 장소 → 3반)', size: 48, y: 120 }], ['11월 1일']],
      c23: [[{ t: '7교시 — 자습', size: 92 }, { t: '아무도 나가지 마시오.', size: 66, y: 150 }], ['11월 1일 (수)', '주번 31번', '결석 30']],
    };
    ['c21', 'c22', 'c23'].forEach(id => {
      const rm = W.room(id);
      const zc = (rm.z0 + rm.z1 + 1) / 2;
      const b = blackboard(rm, boards[id][0], boards[id][1]);
      W.named['board_' + id] = b;
      // 교탁
      const lect = mesh(merge([bx(0.6, 1.0, 1.0, 0, 0.5, 0, 0), bx(0.66, 0.04, 1.06, 0, 1.02, 0, 1)]), [M.jamb, M.desk], rm.x0 + 1.6, 0, zc);
      addBox(rm.x0 + 1.3, zc - 0.5, rm.x0 + 1.9, zc + 0.5);
      W.named['lectern_' + id] = lect;
      clock(rm.x0 + 0.03, 2.55, zc, '+x');
      wallPlane(std({ map: Tex.calendar(), roughness: 0.9 }), 0.5, 0.62, rm.x0, 1.5, zc + 3.3, '+x', 0.03);
      if (id === 'c23') wallPlane(std({ map: Tex.timetable(), roughness: 0.9 }), 0.8, 0.75, rm.x1 + 1, 1.9, zc - 2.5, '-x', 0.03);
      wallPlane(std({ map: Tex.poster('정숙', '조용히 앉아 있으세요', id.length + 3), roughness: 0.9 }), 0.6, 0.85, rm.x1 + 1, 1.9, zc + 2.6, '-x', 0.03);
      lockersAlong(rm.x1 + 1, rm.z0 + 0.5, rm.z1 + 0.5, '-x');
      windows(rm);
      // 책상 5 x 5
      for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) {
        const p = W.deskSpot(id, i, j);
        let yaw = (r() - 0.5) * 0.12;
        if (id === 'c21' && r() < 0.35) { // 1반은 엉망
          if (r() < 0.5) { addDesk(p.x + (r() - 0.5), p.z + (r() - 0.5), r() * 6, true); addChair(id, p.x + 0.7, p.z + (r() - 0.5), r() * 6, true); continue; }
          yaw = (r() - 0.5) * 1.2;
        }
        addDesk(p.x, p.z, yaw);
        if (!(id === 'c22' && r() < 0.3)) addChair(id, p.x + 0.5, p.z, yaw + (r() - 0.5) * 0.2);
      }
    });
    // 1반 뒤쪽 바리케이드
    const rm = W.room('c21');
    for (let k = 0; k < 6; k++) addDesk(rm.x0 + 10.6 + (r() - 0.5) * 0.4, rm.z0 + 2 + k * 1.1, r() * 0.4, k % 2 === 1);

  }

  // 책상·의자를 한꺼번에 그리기
  function buildInstances() {
    const dMesh = new THREE.InstancedMesh(deskGeo(), [M.desk, M.metal], deskT.length);
    const cMesh = new THREE.InstancedMesh(chairGeo(), [M.desk, M.metal], chairT.length);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1), v = new THREE.Vector3();
    deskT.forEach((d, i) => {
      if (d.fallen) { e.set(Math.PI / 2, d.yaw, 0, 'YXZ'); v.set(d.x, 0.32, d.z); } else { e.set(0, d.yaw, 0); v.set(d.x, 0, d.z); }
      q.setFromEuler(e); m4.compose(v, q, one); dMesh.setMatrixAt(i, m4);
    });
    W.setChair = (i, x, z, yaw, fallen) => {
      const c = chairT[i]; c.x = x; c.z = z; c.yaw = yaw; c.fallen = fallen;
      if (fallen) { e.set(0, yaw, Math.PI / 2, 'YXZ'); v.set(x, 0.2, z); } else { e.set(0, yaw, 0); v.set(x, 0, z); }
      q.setFromEuler(e); m4.compose(v, q, one); cMesh.setMatrixAt(i, m4);
      cMesh.instanceMatrix.needsUpdate = true;
    };
    W.chairT = chairT;
    chairT.forEach((c, i) => W.setChair(i, c.x, c.z, c.yaw, c.fallen));
    dMesh.castShadow = cMesh.castShadow = true;
    dMesh.receiveShadow = cMesh.receiveShadow = true;
    root.add(dMesh); root.add(cMesh);
    W.deskMesh = dMesh;
  }
  // 의자들이 한 곳을 바라보게 (2학년 3반 장면)
  W.chairsFace = (roomId, tx, tz) => {
    (W.chairs[roomId] || []).forEach(i => {
      const c = chairT[i];
      const yaw = Math.atan2(tz - c.z, -(tx - c.x));
      W.setChair(i, c.x, c.z, yaw, false);
    });
  };
  W.chairsReset = (roomId) => {
    (W.chairs[roomId] || []).forEach(i => { const c = chairT[i]; W.setChair(i, c.x, c.z, c.base ?? 0, false); });
  };

  // ---------- 복도 ----------
  function buildCorridor(r) {
    const doorsN = W.doors.filter(d => d.z === 11).map(d => d.x);
    // 북쪽 벽(교실 쪽)에 사물함
    for (let x = 1; x < 61; x++) {
      if (doorsN.some(dx => x >= dx - 1 && x <= dx + 2)) continue;
      if (W.cell(x, 11) !== 0 || r() < 0.3 || (x > 48 && x < 53)) continue;
      const fallen = r() < 0.06;
      const m = mesh(new THREE.BoxGeometry(0.98, 1.4, 0.45), M.locker, x + 0.5, 0.7, 12.23);
      if (fallen) { m.rotation.x = -1.35; m.position.set(x + 0.5, 0.25, 12.9); addBox(x, 12.2, x + 1, 13.6); }
      else addBox(x, 12, x + 1, 12.46);
    }
    // 게시판
    for (let x = 6; x < 60; x += 9) {
      if (W.cell(x, 16) !== 0 || W.cell(x + 1, 16) !== 0) continue;
      wallPlane(std({ color: 0x3a2a1a, roughness: 1 }), 1.8, 1.0, x + 1, 1.7, 16, '-z', 0.015);
      for (let k = 0; k < 3; k++) {
        const p = wallPlane(M.paperMats[(x + k) % 5], 0.35, 0.45, x + 0.4 + k * 0.6, 1.7 + (r() - 0.5) * 0.3, 16, '-z', 0.025);
        p.rotation.z = (r() - 0.5) * 0.3;
      }
    }
    // 소화기 상자
    [10, 33, 47].forEach(x => {
      if (W.cell(x, 16) !== 0) return;
      mesh(new THREE.BoxGeometry(0.5, 0.8, 0.2), std({ color: 0x6a0a0a, roughness: 0.6 }), x + 0.5, 1.2, 15.9);
    });
    // 비상구 표시 (초록 불)
    const exitC = Tex.cv(256, 96);
    exitC[1].fillStyle = '#0a5a2a'; exitC[1].fillRect(0, 0, 256, 96);
    exitC[1].fillStyle = '#e8ffe8'; exitC[1].font = '700 44px "Noto Sans KR"'; exitC[1].textAlign = 'center'; exitC[1].fillText('비상구', 150, 64);
    exitC[1].fillRect(24, 22, 40, 52);
    const exitM = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(exitC[0]), color: 0x88aa88 });
    const ex = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.26, 0.08), exitM);
    ex.position.set(6.5, 2.5, 15.9);
    root.add(ex);
    W.named.exitSign = ex;
    // 넘어진 의자, 종이
    for (let i = 0; i < 40; i++) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.29), M.paperMats[i % 5]);
      p.rotation.x = -Math.PI / 2; p.rotation.z = r() * 6;
      p.position.set(2 + r() * 58, 0.006 + i * 0.0002, 12.6 + r() * 3);
      root.add(p);
    }
    // 세면대 (물 마시는 곳)
    mesh(merge([bx(1.6, 0.85, 0.5, 0, 0.42, 0, 0), bx(1.6, 0.06, 0.55, 0, 0.88, 0, 1)]), [M.porcelain, M.metal], 21.5, 0, 15.7);
    addBox(20.7, 15.45, 22.3, 16);
    // 촛불 의자 (기록 장소 3)
    mesh(merge([bx(0.4, 0.04, 0.4, 0, 0.5, 0), ...[[-0.17, -0.17], [-0.17, 0.17], [0.17, -0.17], [0.17, 0.17]].map(([x, z]) => bx(0.03, 0.5, 0.03, x, 0.25, z))]), M.desk, 50.5, 0, 12.6);
    addBox(50.3, 12.4, 50.7, 12.8);
  }

  // ---------- 화장실 ----------
  function buildToilet(r) {
    const pm = std({ color: 0x6a7a74, roughness: 0.6 });
    W.stalls = [];
    for (let k = 0; k <= 5; k++) {
      const z = 17.6 + k * 1.6;
      mesh(new THREE.BoxGeometry(1.6, 2.0, 0.04), pm, 17.2, 1.1, z);
      addBox(16.4, z - 0.03, 18, z + 0.03);
    }
    for (let k = 0; k < 6; k++) {
      const z0 = 17.6 + k * 1.6, z1 = k === 5 ? 27 : z0 + 1.6;
      const zc = (z0 + z1) / 2;
      mesh(merge([cyl(0.2, 0.16, 0.4, 0, 0.2, 0, 0, 12), bx(0.42, 0.05, 0.36, 0.04, 0.42, 0, 0), bx(0.2, 0.5, 0.4, 0.28, 0.55, 0, 0)]), M.porcelain, 17.55, 0, zc);
      // 칸막이 문 (경첩: 앞쪽)
      const pivot = new THREE.Group();
      pivot.position.set(16.4, 0, z0 + 0.02);
      const dm = mesh(new THREE.BoxGeometry(0.04, 1.85, (z1 - z0) - 0.06), pm, 0, 1.05, (z1 - z0) / 2 - 0.02, pivot);
      dm.castShadow = true;
      pivot.rotation.y = -(0.2 + r() * 1.1);
      if (k === 5) pivot.rotation.y = -0.05;
      root.add(pivot);
      pivot.userData.dyn = true;
      W.stalls.push({ pivot, zc, base: pivot.rotation.y, bang: 0 });
    }
    // 세면대와 거울
    for (let k = 0; k < 3; k++) {
      const z = 19 + k * 1.6;
      mesh(merge([bx(0.55, 0.15, 0.5, 0, 0.85, 0, 0), bx(0.4, 0.65, 0.12, 0.05, 0.42, 0, 1)]), [M.porcelain, M.metal], 9.3, 0, z);
      addBox(9, z - 0.28, 9.6, z + 0.28);
    }
    const mir = wallPlane(M.mirror, 4.4, 1.0, 9, 1.65, 20.6, '+x', 0.02);
    W.named.mirror = mir;
    mir.userData.label = '거울';
    for (let i = 0; i < 4; i++) floorDecal(Tex.blood(20 + i), 12 + r() * 4, 19 + r() * 7, 0.8 + r() * 0.6, r() * 6, 0.5);
    // 웅덩이
    const pud = new THREE.Mesh(new THREE.CircleGeometry(0.9, 20), std({ color: 0x0a0c0e, roughness: 0.04, metalness: 0.3, transparent: true, opacity: 0.45, depthWrite: false }));
    pud.rotation.x = -Math.PI / 2; pud.scale.set(1.4, 1, 1); pud.position.set(13, 0.01, 23.5);
    root.add(pud);
  }

  // ---------- 교무실 ----------
  function buildOffice(r) {
    const gray = std({ color: 0x4a4c48, roughness: 0.7, metalness: 0.2 });
    const deskG = merge([bx(1.2, 0.04, 0.7, 0, 0.74, 0, 0), bx(0.04, 0.72, 0.66, -0.58, 0.36, 0, 1), bx(0.4, 0.72, 0.66, 0.38, 0.36, 0, 1), bx(1.2, 0.35, 0.03, 0, 0.92, 0.36, 1)]);
    const spots = [];
    [[22, 19.5], [22, 23.5], [28, 19.5], [28, 23.5]].forEach(([cx, cz]) => {
      for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) spots.push([cx + (i - 0.5) * 1.25, cz + (j - 0.5) * 1.42, j === 0 ? 0 : Math.PI]);
    });
    const om = new THREE.InstancedMesh(deskG, [M.desk, gray], spots.length);
    const m4 = new THREE.Matrix4();
    spots.forEach(([x, z, ry], i) => {
      m4.makeRotationY(ry); m4.setPosition(x, 0, z); om.setMatrixAt(i, m4);
      addBox(x - 0.6, z - 0.37, x + 0.6, z + 0.37);
      if (r() < 0.6) { // 서류 더미
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05 + r() * 0.2, 0.22), M.paperMats[i % 5]);
        p.position.set(x + (r() - 0.5) * 0.6, 0.8, z + (r() - 0.5) * 0.3); p.rotation.y = r();
        root.add(p);
      }
    });
    om.castShadow = om.receiveShadow = true;
    root.add(om);
    // 캐비닛
    for (let x = 30; x < 33.5; x += 1) { mesh(new THREE.BoxGeometry(0.95, 2.0, 0.5), M.locker, x + 0.5, 1.0, 17.25); addBox(x, 17, x + 1, 17.5); }
    for (let z = 19; z < 26; z += 1.0) { if (z > 21 && z < 23) continue; mesh(new THREE.BoxGeometry(0.5, 1.9, 0.95), M.locker, 33.75, 0.95, z + 0.5); addBox(33.5, z, 34, z + 1); }
    // 교감 책상 (출석부)
    mesh(merge([bx(1.6, 0.05, 0.8, 0, 0.76, 0, 0), bx(1.5, 0.74, 0.7, 0, 0.37, 0, 1)]), [M.desk, M.jamb], 26, 0, 25.6);
    addBox(25.2, 25.2, 26.8, 26);
    W.named.headDesk = { x: 26, z: 25.6 };
    // 열쇠 걸이
    wallPlane(std({ color: 0x5a4a32, roughness: 0.9 }), 0.8, 0.6, 19, 1.6, 21.5, '+x', 0.02);
    // 행사 칠판
    wallPlane(std({ map: Tex.board([{ t: '11월 행사', size: 64 }, { t: '1일 — 야간자율학습 (전원)', size: 50, y: 110 }, { t: '열쇠는 담임이 관리', size: 50, y: 190 }], null), roughness: 0.85 }), 3.6, 1.15, 19, 1.6, 24.4, '+x', 0.03);
    wallPlane(std({ map: Tex.poster('근면', '지각·결석 없는 반', 9), roughness: 0.9 }), 0.6, 0.85, 26, 1.8, 27, '-z', 0.03);
  }

  // ---------- 보건실 ----------
  function buildNurse(r) {
    const frame = std({ color: 0x8a8e90, roughness: 0.5, metalness: 0.5 });
    const sheet = std({ color: 0xa8a49a, roughness: 1 });
    [18.8, 22, 25.2].forEach((z, i) => {
      mesh(merge([bx(2.0, 0.08, 0.95, 0, 0.5, 0, 0), ...[[-0.95, -0.42], [-0.95, 0.42], [0.95, -0.42], [0.95, 0.42]].map(([x, zz]) => bx(0.04, 0.5, 0.04, x, 0.25, zz, 0)), bx(0.05, 0.5, 0.95, 0.98, 0.75, 0, 0)]), frame, 44.9, 0, z);
      const mat = mesh(merge([bx(1.9, 0.14, 0.88, 0, 0.61, 0, 0), bx(0.4, 0.1, 0.6, 0.65, 0.73, 0, 0)]), sheet, 44.9, 0, z);
      if (i === 1) { mat.rotation.y = 0.15; } // 구겨진 침대
      addBox(43.9, z - 0.48, 46, z + 0.48);
    });
    // 커튼
    [20.4, 23.6].forEach(z => {
      const c = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 2.1, 6, 1), M.cloth);
      c.position.set(44.8, 1.2, z);
      root.add(c);
      c.userData.dyn = true;
      W.anims.push(t => { c.position.z = z + Math.sin(t * 0.9 + z) * 0.04; });
    });
    for (let k = 0; k < 3; k++) {
      const c = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 2.1), M.cloth);
      c.position.set(43.5, 1.2, 18.4 + k * 3.2);
      c.rotation.y = Math.PI / 2;
      root.add(c);
      c.userData.dyn = true;
      W.anims.push(t => { c.rotation.y = Math.PI / 2 + Math.sin(t * 0.6 + k * 2) * 0.12; });
    }
    // 약장
    mesh(new THREE.BoxGeometry(0.45, 1.8, 1.6), M.white, 35.25, 0.9, 21.5);
    addBox(35, 20.7, 35.5, 22.3);
    for (let s = 0; s < 3; s++) for (let b = 0; b < 5; b++) {
      const bt = mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.12 + r() * 0.08, 8), std({ color: [0x6a3a1a, 0x2a4a6a, 0xa0a090][b % 3], roughness: 0.3 }), 35.55, 0.75 + s * 0.45, 20.95 + b * 0.27);
      if (r() < 0.2) { bt.rotation.z = Math.PI / 2; bt.position.y -= 0.03; }
    }
    // 책상
    mesh(merge([bx(1.2, 0.04, 0.7, 0, 0.74, 0, 0), bx(1.1, 0.72, 0.6, 0, 0.36, 0, 1)]), [M.desk, M.white], 37.2, 0, 18.2);
    addBox(36.6, 17.85, 37.8, 18.55);
    mesh(merge([bx(1.0, 0.04, 0.6, 0, 0.74, 0, 0), bx(0.9, 0.72, 0.5, 0, 0.36, 0, 1)]), [M.desk, M.white], 37, 0, 24.5);
    addBox(36.5, 24.2, 37.5, 24.8);
    // 체중계, 시력표
    mesh(new THREE.BoxGeometry(0.4, 0.06, 0.35), frame, 41, 0.03, 26.3);
    const eye = Tex.cv(200, 300);
    eye[1].fillStyle = '#ddd8c8'; eye[1].fillRect(0, 0, 200, 300); eye[1].fillStyle = '#111'; eye[1].textAlign = 'center';
    ['ㅁ', 'ㅇ ㅅ', 'ㄱ ㄴ ㄷ', '나 가 지', '마 세 요 ...', '대 답 하 지 마'].forEach((s, i) => { eye[1].font = `${48 - i * 7}px "Noto Sans KR"`; eye[1].fillText(s, 100, 50 + i * 45); });
    wallPlane(std({ map: new THREE.CanvasTexture(eye[0]), roughness: 0.9 }), 0.5, 0.75, 41, 1.6, 27, '-z', 0.03);
  }

  // ---------- 음악실 ----------
  function buildMusic(r) {
    const rm = W.room('music');
    windows(rm);
    const piano = mesh(merge([
      bx(1.5, 1.25, 0.6, 0, 0.63, 0, 0), bx(1.5, 0.05, 0.3, 0, 0.74, 0.42, 0), bx(1.4, 0.03, 0.18, 0, 0.77, 0.45, 1),
      bx(0.06, 0.7, 0.3, -0.72, 0.38, 0.42, 0), bx(0.06, 0.7, 0.3, 0.72, 0.38, 0.42, 0),
    ]), [M.black, M.porcelain], 50.5, 0, 2.0);
    addBox(49.7, 1.6, 51.3, 2.75);
    W.named.piano = piano;
    piano.userData.label = '피아노';
    W.interact.push(piano);
    mesh(new THREE.BoxGeometry(0.8, 0.45, 0.35), M.black, 50.5, 0.23, 3.1);
    // 의자 줄
    for (let i = 0; i < 4; i++) for (let j = 0; j < 6; j++) {
      const x = 42 + j * 1.5, z = 5 + i * 1.4;
      const fallen = r() < 0.15;
      addChair('music', x, z, (r() - 0.5) * 0.3, fallen);
    }
    // 오선 칠판
    const zc = 6;
    wallPlane(std({ map: Tex.board([{ t: '𝄞 ─────────────', size: 60 }, { t: '도  레  미  …  미  미  미', size: 56, y: 110 }, { t: '멈추지 마. 멈추면 들켜.', size: 56, y: 200, color: 'rgba(200,60,60,0.85)' }], null), roughness: 0.85 }), 4.6, 1.25, rm.x0, 1.55, zc, '+x', 0.04);
    for (let k = 0; k < 4; k++) wallPlane(std({ map: Tex.portrait(k + 3), roughness: 0.8 }), 0.55, 0.72, 43 + k * 2.6, 2.0, 11, '-z', 0.03);
    // 보면대
    for (let k = 0; k < 3; k++) {
      const s = mesh(merge([cyl(0.015, 0.015, 1.1, 0, 0.55, 0, 0), bx(0.45, 0.32, 0.02, 0, 1.15, 0, 0, 0, -0.4)]), M.metal, 45 + k * 2, 0, 3.4);
      s.rotation.y = r() * 0.5;
      if (k === 1) { s.rotation.z = 1.4; s.position.y = 0.05; }
    }
  }

  // ---------- 과학실 ----------
  function buildScience(r) {
    const rm = W.room('sci');
    windows(rm);
    const top = std({ color: 0x101010, roughness: 0.35 });
    [[56, 4.5], [59.6, 4.5], [56, 8.2], [59.6, 8.2]].forEach(([x, z]) => {
      mesh(merge([bx(2.4, 0.05, 1.2, 0, 0.9, 0, 0), bx(2.3, 0.86, 1.1, 0, 0.43, 0, 1), cyl(0.012, 0.012, 0.35, 0.8, 1.07, 0, 2)]), [top, M.desk, M.metal], x, 0, z);
      addBox(x - 1.2, z - 0.6, x + 1.2, z + 0.6);
      for (let k = 0; k < 3; k++) {
        const jar = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.18, 10), std({ color: [0x3a5a2a, 0x5a3a2a, 0x2a3a5a][k], roughness: 0.15, transparent: true, opacity: 0.7 }), x - 0.7 + k * 0.4, 1.02, z + (r() - 0.5) * 0.4);
        if (r() < 0.3) { jar.rotation.z = Math.PI / 2; jar.position.y = 0.97; }
      }
    });
    // 인체 골격 모형
    const bone = std({ color: 0xb8ae96, roughness: 0.6 });
    const sk = new THREE.Group();
    const parts = [cyl(0.015, 0.015, 1.2, 0, 0.6, 0, 0), bx(0.4, 0.04, 0.4, 0, 0.02, 0, 0)];
    const body = [
      new THREE.SphereGeometry(0.1, 10, 8).scale(1, 1.15, 1.05).translate(0, 1.66, 0),
      new THREE.CylinderGeometry(0.02, 0.02, 0.6, 6).translate(0, 1.25, -0.03),
    ];
    for (let i = 0; i < 6; i++) body.push(new THREE.TorusGeometry(0.12 - i * 0.008, 0.012, 4, 14).rotateX(Math.PI / 2).translate(0, 1.42 - i * 0.055, 0));
    body.push(new THREE.TorusGeometry(0.11, 0.02, 4, 12).rotateX(Math.PI / 2).translate(0, 0.98, 0));
    [[-0.1, 0], [0.1, 0]].forEach(([x]) => {
      body.push(new THREE.CylinderGeometry(0.02, 0.018, 0.45, 6).translate(x, 0.72, 0));
      body.push(new THREE.CylinderGeometry(0.018, 0.015, 0.42, 6).translate(x, 0.28, 0.02));
      body.push(new THREE.CylinderGeometry(0.015, 0.015, 0.3, 6).rotateZ(x > 0 ? 0.2 : -0.2).translate(x * 2, 1.32, 0));
      body.push(new THREE.CylinderGeometry(0.013, 0.012, 0.28, 6).rotateZ(x > 0 ? 0.1 : -0.1).translate(x * 2.3, 1.04, 0.04));
    });
    body.forEach(g => parts.push({ g, m: 1 }));
    mesh(merge(parts), [M.metal, bone], 0, 0, 0, sk);
    sk.position.set(60.8, 0, 2.0); sk.rotation.y = -0.6;
    root.add(sk);
    sk.userData.dyn = true;
    addBox(60.5, 1.7, 61.1, 2.3);
    W.named.skeleton = sk;
    // 유리 진열장
    mesh(new THREE.BoxGeometry(2.4, 2.0, 0.45), M.glass, 55.8, 1.0, 1.25);
    addBox(54.6, 1, 57, 1.5);
    for (let k = 0; k < 8; k++) mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.25, 10), std({ color: 0x4a5a3a, roughness: 0.2, transparent: true, opacity: 0.75 }), 54.9 + (k % 4) * 0.6, 0.5 + Math.floor(k / 4) * 0.7, 1.25);
    // 소방 도끼 상자
    mesh(new THREE.BoxGeometry(0.9, 1.2, 0.15), std({ color: 0x7a0a0a, roughness: 0.6 }), 59.2, 1.4, 1.08);
    W.named.axeBox = { x: 59.2, y: 1.4, z: 1.2 };
    // 주기율표
    const pt = Tex.cv(256, 160);
    pt[1].fillStyle = '#cfc8b0'; pt[1].fillRect(0, 0, 256, 160);
    for (let i = 0; i < 18; i++) for (let j = 0; j < 7; j++) { if (j < 3 && i > 1 && i < 12) continue; pt[1].fillStyle = `hsl(${(i * 20) % 360},30%,${50 + j * 3}%)`; pt[1].fillRect(8 + i * 13.5, 12 + j * 20, 12, 18); }
    wallPlane(std({ map: new THREE.CanvasTexture(pt[0]), roughness: 0.9 }), 1.6, 1.0, 54, 1.8, 6.5, '+x', 0.03);
  }

  // ---------- 방송실 ----------
  function buildBroadcast(r) {
    const black = std({ color: 0x0c0c0c, roughness: 0.95 });
    const panel = std({ color: 0x23262a, roughness: 0.6, metalness: 0.3 });
    // 남쪽 벽 장비
    mesh(merge([bx(9, 0.05, 1.0, 0, 0.8, 0, 0), bx(9, 0.78, 0.9, 0, 0.39, 0, 1)]), [panel, black], 54.5, 0, 26.45);
    addBox(50, 25.95, 59, 27);
    for (let k = 0; k < 5; k++) {
      mesh(new THREE.BoxGeometry(0.9, 0.08, 0.5), panel, 51.2 + k * 1.6, 0.86, 26.4).rotation.x = -0.2;
      const scr = mesh(new THREE.BoxGeometry(0.55, 0.42, 0.35), panel, 51.2 + k * 1.6, 1.08, 26.75);
      scr.rotation.y = (r() - 0.5) * 0.3;
    }
    // 화면 하나는 지직거린다
    const stc = Tex.cv(64, 48);
    const stTex = new THREE.CanvasTexture(stc[0]);
    const stM = new THREE.MeshBasicMaterial({ map: stTex, color: 0x9090a0 });
    const st = new THREE.Mesh(new THREE.PlaneGeometry(0.48, 0.34), stM);
    st.position.set(54.4, 1.08, 26.57); st.rotation.y = Math.PI;
    root.add(st);
    let stT = 0;
    W.anims.push((t, dt) => {
      stT += dt; if (stT < 0.07) return; stT = 0;
      const im = stc[1].createImageData(64, 48);
      for (let i = 0; i < im.data.length; i += 4) { const v = Math.random() * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = v; im.data[i + 3] = 255; }
      stc[1].putImageData(im, 0, 0); stTex.needsUpdate = true;
    });
    // 마이크
    mesh(merge([cyl(0.012, 0.012, 1.4, 0, 0.7, 0, 0), cyl(0.15, 0.18, 0.03, 0, 0.015, 0, 0), cyl(0.03, 0.025, 0.14, 0, 1.45, 0.05, 1, 10, 1.1)]), [M.metal, M.black], 54.5, 0, 24.6);
    // 무너진 천장 조각과 그을음
    for (let k = 0; k < 7; k++) {
      const ch = mesh(new THREE.BoxGeometry(0.6 + r() * 0.8, 0.05, 0.6 + r() * 0.6), std({ color: 0x3a3830, roughness: 1 }), 48.5 + r() * 12, 0.05 + r() * 0.1, 18 + r() * 7);
      ch.rotation.set((r() - 0.5) * 0.4, r() * 3, (r() - 0.5) * 0.4);
    }
    for (let k = 0; k < 6; k++) floorDecal(Tex.blood(40 + k), 49 + r() * 11, 18.5 + r() * 7, 1.5 + r() * 1.5, r() * 6, 0.35);
    // 테이프 선반
    mesh(new THREE.BoxGeometry(0.45, 2.2, 3), panel, 47.25, 1.1, 20);
    addBox(47, 18.5, 47.5, 21.5);
    for (let k = 0; k < 18; k++) mesh(new THREE.BoxGeometry(0.2, 0.12, 0.08), M.black, 47.55, 0.4 + (k % 6) * 0.35, 18.8 + Math.floor(k / 6) * 1.0 + r() * 0.3);
  }

  // ---------- 계단 ----------
  function buildStair(r) {
    const step = std({ map: Tex.floor('hall'), roughness: 0.8 });
    for (let i = 0; i < 9; i++) { // 3층으로 올라가는 계단 (막힘)
      mesh(new THREE.BoxGeometry(2.6, 0.18 * (i + 1), 0.32), step, 2.4, 0.09 * (i + 1), 23 + i * 0.32);
    }
    addBox(1, 22.8, 3.8, 27);
    // 책상으로 막은 바리케이드
    for (let k = 0; k < 7; k++) {
      const d = mesh(deskGeo(), [M.desk, M.metal], 2 + r() * 1.6, 0.4 + (k > 3 ? 0.7 : 0), 22.7 + r() * 0.6);
      d.rotation.set((r() - 0.5) * 1.5, r() * 3, (r() - 0.5) * 1.5);
    }
    // 아래층으로 가는 난간
    mesh(new THREE.BoxGeometry(0.06, 1.0, 5), M.metal, 4.6, 0.5, 21);
    const tape = std({ color: 0x8a7a10, roughness: 0.7 });
    mesh(new THREE.BoxGeometry(3.4, 0.08, 0.01), tape, 2.6, 1.1, 22.5).rotation.z = 0.08;
    mesh(new THREE.BoxGeometry(3.4, 0.08, 0.01), tape, 2.6, 0.8, 22.52).rotation.z = -0.1;
  }

  // ---------- 형광등 ----------
  function buildFixtures(r) {
    const housing = std({ color: 0x2a2a2a, roughness: 0.7, metalness: 0.4 });
    const add = (x, z, room, state) => {
      if (!state) { const v = r(); state = v < 0.5 ? 'ok' : v < 0.82 ? 'flicker' : 'dead'; }
      const mat = new THREE.MeshBasicMaterial({ color: 0x000000 });
      const g = new THREE.Group();
      g.position.set(x, WALL_H - 0.05, z);
      g.add(new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.07, 0.32), housing));
      const tube = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.035, 0.07), mat);
      tube.position.y = -0.05;
      g.add(tube);
      if (r() < 0.12) g.rotation.z = 0.25; // 한쪽이 떨어져 내려옴
      root.add(g);
      W.fixtures.push({ x, z, y: WALL_H - 0.3, room, state, mat, phase: r() * 100, level: 0, group: g });
    };
    W.rooms.forEach(rm => {
      const w = rm.x1 + 1 - rm.x0, d = rm.z1 + 1 - rm.z0;
      if (rm.id === 'hall') { for (let x = 4; x < 61; x += 6) add(x, 14, 'hall'); return; }
      const nx = w > 9 ? 2 : 1, nz = d > 6 ? 2 : 1;
      for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
        let st;
        if (rm.id === 'broad') st = 'dead';
        if (rm.id === 'c23') st = (i === 1 && j === 0) ? 'flicker' : 'dead';
        add(rm.x0 + w * (i + 0.5) / nx, rm.z0 + d * (j + 0.5) / nz, rm.id, st);
      }
    });
    // 빛 웅덩이: 가까운 형광등 몇 개에만 진짜 빛을 붙인다 (성능)
    W.pool = [];
    for (let i = 0; i < 4; i++) {
      const L = new THREE.PointLight(0xcfdcff, 0, 9, 2);
      L.position.set(0, -50, 0);
      scene.add(L);
      W.pool.push(L);
    }
  }

  // ---------- 핏자국과 낙서 ----------
  function buildDecals(r) {
    // 화장실에서 교무실까지 끌린 자국
    for (let x = 13; x < 26; x += 0.9) floorDecal(Tex.blood(1 + (x | 0) % 6), x, 15 - (x - 13) * 0.05 + (r() - 0.5) * 0.3, 0.5 + r() * 0.4, r() * 6, 0.55);
    floorDecal(Tex.writing('대답하지 마', 'rgba(110,4,4,0.95)', 120, 640, 200), 24, 13.8, 3.2, Math.PI, 0.9).scale.set(1, 0.32, 1);
    const wr = [
      ['31', 37.5, 1.7, 12, '+z', 'rgba(110,6,6,0.9)'],
      ['아직 7교시야', 8, 1.6, 16, '-z', 'rgba(220,220,210,0.55)'],
      ['다 앉아 있어', 46, 1.5, 12, '+z', 'rgba(110,6,6,0.85)'],
      ['결석', 60, 1.6, 16, '-z', 'rgba(110,6,6,0.9)'],
      ['어디 가?', 17.8, 1.4, 22, '-x', 'rgba(110,6,6,0.8)'],
    ];
    wr.forEach(([t, x, y, z, dir, col]) => wallPlane(decalMat(Tex.writing(t, col)), 1.8, 0.56, x, y, z, dir, 0.03));
    const hand = decalMat(Tex.handTex(), 0.9);
    [[30, 1.3, 12, '+z'], [30.7, 1.0, 12, '+z'], [44, 1.2, 16, '-z'], [52, 0.9, 16, '-z'], [53.4, 1.5, 16, '-z']].forEach(([x, y, z, dir]) => {
      const p = wallPlane(hand, 0.3, 0.38, x, y, z, dir, 0.03);
      p.rotation.z = (r() - 0.5) * 0.6;
    });
    for (let i = 0; i < 10; i++) floorDecal(Tex.blood(60 + i), 2 + r() * 58, 12.5 + r() * 3, 0.6 + r() * 0.9, r() * 6, 0.45);
  }

  // ---------- 매 프레임 ----------
  let poolT = 0;
  W.update = (t, dt, px, pz, curRoom) => {
    // 문 열고 닫기
    W.doors.forEach(d => {
      const target = d.open ? 1 : 0;
      if (d.t !== target) {
        d.t += Math.sign(target - d.t) * dt * 2.6;
        d.t = Math.max(0, Math.min(1, d.t));
        d.panel.position.x = d.t * 1.9;
      }
    });
    // 형광등 깜빡임
    const red = W.mode === 'red', dark = W.mode === 'dark';
    W.fixtures.forEach(f => {
      let v = 0;
      if (!dark && !W.darkRooms.has(f.room)) {
        if (f.state === 'ok') v = Math.sin(t * 37 + f.phase) > 0.995 ? 0.3 : 1;
        else if (f.state === 'flicker') {
          const n = Math.sin(t * 2.1 + f.phase) + Math.sin(t * 7.3 + f.phase * 2) + Math.sin(t * 23 + f.phase * 3);
          v = n > 0.9 ? 1 : n > 0.5 ? 0.25 : 0.02;
        }
        if (red) v = f.state === 'dead' ? 0 : 0.7 + Math.sin(t * 3 + f.phase) * 0.3;
      }
      f.level = v;
      if (red) f.mat.color.setRGB(v * 0.9, v * 0.05, v * 0.03);
      else f.mat.color.setRGB(v * 0.75, v * 0.8, v * 0.85);
    });
    // 가까운 형광등에 빛 붙이기
    poolT -= dt;
    if (poolT <= 0) {
      poolT = 0.15;
      const lit = W.fixtures.filter(f => f.state !== 'dead').map(f => {
        let d = Math.hypot(f.x - px, f.z - pz);
        if (curRoom && f.room !== curRoom.id) d *= 1.7;
        return { f, d };
      }).filter(o => o.d < 16).sort((a, b) => a.d - b.d).slice(0, W.pool.length);
      W.pool.forEach((L, i) => { L.userData.f = lit[i] ? lit[i].f : null; });
    }
    W.pool.forEach(L => {
      const f = L.userData.f;
      if (!f) { L.intensity = 0; return; }
      L.position.set(f.x, f.y, f.z);
      if (red) L.color.setRGB(1, 0.12, 0.08); else L.color.setRGB(0.82, 0.88, 1);
      L.intensity = f.level * (red ? 0.9 : 0.75);
    });
    // 화장실 칸 문 쾅쾅
    if (W.stalls) W.stalls.forEach(s => {
      if (s.bang > 0) {
        s.bang -= dt;
        s.pivot.rotation.y = s.base - Math.abs(Math.sin(s.bang * 9)) * 0.9;
        if (Math.sin(s.bang * 9) * Math.sin((s.bang + dt) * 9) < 0) Sound.slam({ x: 16.4, z: s.zc });
        if (s.bang <= 0) s.pivot.rotation.y = s.base;
      }
    });
    W.anims.forEach(f => f(t, dt));
  };

  return W;
})();
