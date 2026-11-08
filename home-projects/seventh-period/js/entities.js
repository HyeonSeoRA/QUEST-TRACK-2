'use strict';
// 귀신들: 모양 만들기, 움직임, 공격

const Ents = (() => {
  const E = {};
  const std = o => new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.9, metalness: 0 }, o));
  let eyeMatW, eyeMatR;
  function eyeMats() {
    if (eyeMatW) return;
    eyeMatW = new THREE.SpriteMaterial({ map: Tex.glow(255, 245, 235), color: 0xd8e0ff, blending: THREE.AdditiveBlending, fog: false, depthWrite: false, transparent: true });
    eyeMatR = new THREE.SpriteMaterial({ map: Tex.glow(255, 60, 40), color: 0xff3020, blending: THREE.AdditiveBlending, fog: false, depthWrite: false, transparent: true });
  }
  function eyes(head, y, z, sep, red, size = 0.05) {
    eyeMats();
    const list = [];
    [-1, 1].forEach(s => {
      const sp = new THREE.Sprite(red ? eyeMatR : eyeMatW);
      sp.scale.set(size, size, size);
      sp.position.set(s * sep, y, z);
      head.add(sp);
      list.push(sp);
    });
    return list;
  }
  const cyl = (rt, rb, h, seg = 8) => new THREE.CylinderGeometry(rt, rb, h, seg);
  // 머리 앞쪽을 감싸는 휘어진 얼굴 (머리보다 아주 조금 크게)
  function faceGeo(r, w = 1.75, h = 1.9) {
    return new THREE.SphereGeometry(r * 1.025, 24, 18, Math.PI / 2 - w / 2, w, Math.PI / 2 - h / 2, h);
  }
  function part(geo, mat, x, y, z, parent) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = false;
    parent.add(m);
    return m;
  }
  function hairStrands(head, mat, len, r, front) {
    const n = front ? 9 : 7;
    for (let i = 0; i < n; i++) {
      const a = (i / (n - 1) - 0.5) * (front ? 3.4 : 2.6) + Math.PI;
      const p = new THREE.Mesh(new THREE.PlaneGeometry(0.09, len, 1, 4), mat);
      p.position.set(Math.sin(a) * r, 0.12 - len / 2, Math.cos(a) * r);
      p.rotation.y = a;
      head.add(p);
    }
  }

  // 학생 모양 (결석생, 서하, 피아노 치는 아이)
  function buildStudent(o = {}) {
    const g = new THREE.Group();
    const uni = std({ color: o.uniform ?? 0x161a26, roughness: 0.95, emissive: o.glow ?? 0x000000 });
    const skin = std({ color: o.skin ?? 0x5c5b57, roughness: 0.55, emissive: o.glow ?? 0x000000 });
    const hairM = std({ color: 0x050505, roughness: 0.8, side: THREE.DoubleSide });
    const white = std({ color: 0x9a9a96, roughness: 0.9, emissive: o.glow ?? 0x000000 });
    const mats = [uni, skin, hairM, white];
    const body = new THREE.Group(); g.add(body);
    const legs = [];
    [-1, 1].forEach(s => {
      const leg = new THREE.Group(); leg.position.set(s * 0.09, 0.8, 0); body.add(leg);
      part(cyl(0.05, 0.04, 0.8), skin, 0, -0.4, 0, leg);
      part(new THREE.BoxGeometry(0.09, 0.06, 0.2), std({ color: 0x0a0a0a }), 0, -0.79, 0.04, leg);
      legs.push(leg);
    });
    if (o.dress) part(cyl(0.16, 0.34, 0.95, 12), white, 0, 0.62, 0, body);
    else part(cyl(0.17, 0.27, 0.38, 12), uni, 0, 0.72, 0, body);
    const torso = part(cyl(0.18, 0.15, 0.58, 12), o.dress ? white : uni, 0, 1.08, 0, body);
    part(new THREE.BoxGeometry(0.12, 0.08, 0.02), white, 0, 1.3, 0.16, body); // 칼라
    part(cyl(0.04, 0.05, 0.12), skin, 0, 1.4, 0, body);
    const arms = [];
    [-1, 1].forEach(s => {
      const arm = new THREE.Group(); arm.position.set(s * 0.21, 1.33, 0); body.add(arm);
      const al = o.armLen ?? 0.78;
      part(cyl(0.045, 0.035, al), o.dress ? white : uni, 0, -al / 2, 0, arm);
      const hand = part(new THREE.BoxGeometry(0.06, 0.16, 0.035), skin, 0, -al - 0.07, 0, arm);
      for (let f = 0; f < 3; f++) part(cyl(0.008, 0.006, 0.12, 4), skin, -0.02 + f * 0.02, -al - 0.2, 0, arm);
      arm.userData.hand = hand;
      arms.push(arm);
    });
    const head = new THREE.Group(); head.position.set(0, 1.46, 0); body.add(head);
    part(new THREE.SphereGeometry(0.12, 16, 12), skin, 0, 0.1, 0, head).scale.set(0.9, 1.12, 1);
    const faceM = new THREE.MeshStandardMaterial({ map: Tex.face(o.face || 'hollow', 256, o.seed || 1), transparent: true, alphaTest: 0.1, roughness: 0.55, emissive: 0x0c0c0c });
    const face = part(faceGeo(0.12), faceM, 0, 0.1, 0, head);
    face.scale.set(0.9, 1.12, 1);
    face.castShadow = false;
    mats.push(faceM);
    // 머리카락
    const cap = part(new THREE.SphereGeometry(0.135, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hairM, 0, 0.12, -0.01, head);
    cap.scale.set(0.95, 1.1, 1.05);
    if (o.hair !== 'short') hairStrands(head, hairM, o.hairLen || 0.55, 0.12, false);
    const eyeList = o.noEyes ? [] : eyes(head, 0.11, 0.128, 0.032, o.redEyes, o.eyeSize || 0.05);
    if (o.scale) g.scale.setScalar(o.scale);
    return { group: g, body, legs, arms, head, torso, eyes: eyeList, mats, kind: 'student' };
  }

  // 네 발로 기는 것 (지각생)
  function buildCrawler(o = {}) {
    const g = new THREE.Group();
    const uni = std({ color: 0x14161e, roughness: 0.95 });
    const skin = std({ color: 0x585a55, roughness: 0.55 });
    const hairM = std({ color: 0x050505, roughness: 0.8, side: THREE.DoubleSide });
    const mats = [uni, skin, hairM];
    const body = new THREE.Group(); g.add(body);
    const torso = part(cyl(0.15, 0.18, 0.7, 10), uni, 0, 0.55, 0, body);
    torso.rotation.x = Math.PI / 2 - 0.25;
    const limbs = [];
    [[-1, 0.3], [1, 0.3], [-1, -0.3], [1, -0.3]].forEach(([s, zz], i) => {
      const up = new THREE.Group(); up.position.set(s * 0.17, 0.62 + (zz > 0 ? 0.05 : 0), zz); body.add(up);
      part(cyl(0.035, 0.03, 0.5, 6), i < 2 ? skin : uni, 0, -0.25, 0, up);
      const low = new THREE.Group(); low.position.set(0, -0.5, 0); up.add(low);
      part(cyl(0.03, 0.02, 0.5, 6), skin, 0, -0.25, 0, low);
      up.rotation.z = s * 0.9;
      low.rotation.z = -s * 1.6;
      limbs.push({ up, low, s, front: zz > 0, ph: i * Math.PI / 2 });
    });
    // 거꾸로 뒤집힌 얼굴
    const head = new THREE.Group(); head.position.set(0, 0.78, 0.42); body.add(head);
    part(new THREE.SphereGeometry(0.12, 14, 10), skin, 0, 0, 0, head).scale.set(0.9, 1.1, 1);
    const faceM = new THREE.MeshStandardMaterial({ map: Tex.face('grin', 256, o.seed || 3), transparent: true, alphaTest: 0.1, roughness: 0.55, emissive: 0x0c0c0c });
    const face = part(faceGeo(0.12), faceM, 0, 0, 0, head);
    face.scale.set(0.9, -1.1, 1); face.castShadow = false;   // 거꾸로 뒤집힌 얼굴
    faceM.side = THREE.DoubleSide;
    mats.push(faceM);
    const hair = part(new THREE.SphereGeometry(0.13, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), hairM, 0, -0.02, -0.01, head);
    hair.rotation.x = Math.PI;
    for (let i = 0; i < 8; i++) { // 바닥으로 늘어진 머리카락
      const p = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.5), hairM);
      const a = i / 8 * Math.PI * 2;
      p.position.set(Math.sin(a) * 0.1, -0.3, Math.cos(a) * 0.1);
      p.rotation.y = a;
      head.add(p);
    }
    const eyeList = eyes(head, 0.01, 0.125, 0.032, true, 0.045);
    return { group: g, body, head, limbs, eyes: eyeList, mats, kind: 'crawler', torso };
  }

  // 담임 (키가 큰 남자, 출석부와 회초리)
  function buildTeacher() {
    const g = new THREE.Group();
    const suit = std({ color: 0x24252a, roughness: 0.85 });
    const skin = std({ color: 0x62605b, roughness: 0.5 });
    const red = std({ color: 0x5a0606, roughness: 0.7 });
    const shirt = std({ color: 0x8a8880, roughness: 0.9 });
    const mats = [suit, skin, red, shirt];
    const body = new THREE.Group(); g.add(body);
    const legs = [];
    [-1, 1].forEach(s => {
      const leg = new THREE.Group(); leg.position.set(s * 0.12, 1.15, 0); body.add(leg);
      part(cyl(0.07, 0.055, 1.15), suit, 0, -0.575, 0, leg);
      part(new THREE.BoxGeometry(0.11, 0.07, 0.28), std({ color: 0x050505, roughness: 0.3 }), 0, -1.13, 0.06, leg);
      legs.push(leg);
    });
    const torso = part(cyl(0.25, 0.19, 0.85, 12), suit, 0, 1.58, 0, body);
    part(new THREE.BoxGeometry(0.14, 0.5, 0.02), shirt, 0, 1.75, 0.2, body);
    part(new THREE.BoxGeometry(0.05, 0.42, 0.025), red, 0, 1.72, 0.215, body); // 넥타이
    part(cyl(0.05, 0.06, 0.4), skin, 0, 2.15, 0, body); // 긴 목
    const arms = [];
    [-1, 1].forEach(s => {
      const arm = new THREE.Group(); arm.position.set(s * 0.29, 1.95, 0); body.add(arm);
      part(cyl(0.06, 0.045, 1.25), suit, 0, -0.625, 0, arm);
      const hand = part(new THREE.BoxGeometry(0.08, 0.22, 0.05), skin, 0, -1.36, 0, arm);
      for (let f = 0; f < 4; f++) part(cyl(0.009, 0.006, 0.2, 4), skin, -0.03 + f * 0.02, -1.55, 0, arm);
      arm.userData.hand = hand;
      arms.push(arm);
    });
    // 오른손 회초리, 왼손 출석부
    const stick = part(cyl(0.012, 0.008, 1.1, 5), std({ color: 0x3a2412, roughness: 0.7 }), 0, -1.45, 0.45, arms[1]);
    stick.rotation.x = Math.PI / 2;
    const book = part(new THREE.BoxGeometry(0.3, 0.4, 0.05), std({ color: 0x6a0808, roughness: 0.6, emissive: 0x200000 }), 0, -1.4, 0.06, arms[0]);
    const head = new THREE.Group(); head.position.set(0, 2.38, 0); body.add(head);
    part(new THREE.SphereGeometry(0.14, 16, 12), skin, 0, 0.1, 0, head).scale.set(0.85, 1.25, 1);
    const faceM = new THREE.MeshStandardMaterial({ map: Tex.face('teacher', 256, 9), transparent: true, alphaTest: 0.1, roughness: 0.5, emissive: 0x0c0c0c });
    const face = part(faceGeo(0.14), faceM, 0, 0.1, 0, head);
    face.scale.set(0.85, 1.25, 1);
    face.castShadow = false;
    mats.push(faceM);
    part(new THREE.SphereGeometry(0.145, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.4), std({ color: 0x0a0a0a }), 0, 0.14, -0.01, head).scale.set(0.9, 1.2, 1.05);
    const eyeList = eyes(head, 0.12, 0.148, 0.036, true, 0.06);
    return { group: g, body, legs, arms, head, torso, eyes: eyeList, mats, book, stick, kind: 'teacher' };
  }

  E.buildStudent = buildStudent;

  // ---------- 종류 ----------
  E.DEFS = {
    shadow: { name: '결석생', hp: 45, speed: 1.1, chase: 2.55, dmg: 11, san: 6, range: 1.45, windup: 0.55, cool: 1.3, exp: 22, radius: 0.33, detect: 9, lightDmg: 11, lightStun: 1.0, jerky: true,
      build: o => buildStudent({ face: o.seed % 2 ? 'hollow' : 'grin', seed: o.seed, hair: o.seed % 3 === 0 ? 'short' : 'long', redEyes: o.seed % 2 === 0 }) },
    crawler: { name: '지각생', hp: 34, speed: 1.4, chase: 4.0, dmg: 9, san: 8, range: 1.3, windup: 0.32, cool: 1.0, exp: 30, radius: 0.38, detect: 11, lightDmg: 18, lightStun: 0.6,
      build: o => buildCrawler(o) },
    pianist: { name: '건반 위의 아이', hp: 240, speed: 2, chase: 5.5, dmg: 13, san: 10, range: 1.5, windup: 0.42, cool: 0.8, exp: 160, radius: 0.33, detect: 30, lightDmg: 0, lightStun: 1.3, boss: true,
      build: () => buildStudent({ face: 'child', seed: 21, dress: true, scale: 0.78, hairLen: 0.75, uniform: 0x6a6a66, skin: 0x9a9a96, glow: 0x0a0a0c }) },
    teacher: { name: '담임', hp: 640, speed: 1.2, chase: 1.95, dmg: 22, san: 12, range: 2.5, windup: 0.8, cool: 1.5, exp: 400, radius: 0.55, detect: 40, lightDmg: 4, lightStun: 99, boss: true,
      build: () => buildTeacher() },
  };

  // ---------- 귀신 하나 ----------
  let seedN = 1;
  class Enemy {
    constructor(type, x, z, o = {}) {
      const d = E.DEFS[type];
      this.type = type; this.def = d; this.id = o.id || null;
      this.m = d.build({ seed: o.seed || seedN++ });
      this.obj = this.m.group;
      this.x = x; this.z = z; this.yaw = o.yaw ?? Math.random() * 6;
      this.obj.position.set(x, 0, z);
      this.hp = this.maxHp = d.hp;
      this.state = o.alert ? 'chase' : 'idle';
      this.t2 = 0; this.stun = 0; this.light = 0; this.lightImmune = 0; this.lost = 0;
      this.dead = false; this.deadT = 0; this.phase = Math.random() * 10; this.hitFlash = 0;
      this.twitch = 0; this.twX = 0; this.twZ = 0; this.jerkT = 0; this.jerkMul = 1; this.moving = 0;
      this.home = { x, z }; this.wanderT = 0; this.wanderTo = null; this.groanT = 2 + Math.random() * 5;
      this.knock = { x: 0, z: 0 };
      this.spawnT = o.rise ? 1 : 0;     // 바닥에서 솟아오름
      this.visible = true;
      Game.scene.add(this.obj);
    }
    alert() {
      if (this.state === 'idle') {
        this.state = 'chase';
        if (this.type !== 'teacher') Sound.shriek({ x: this.x, z: this.z });
        Game.onSpotted(this);
      }
    }
    damage(n, from, kind) {
      if (this.dead) return;
      this.hp -= n; this.hitFlash = 0.15;
      if (kind !== 'light') Sound.ghostHit({ x: this.x, z: this.z });
      if (from && kind !== 'light') {
        const dx = this.x - from.x, dz = this.z - from.z, l = Math.hypot(dx, dz) || 1;
        const kb = this.def.boss ? 0.15 : 0.55;
        this.knock.x += dx / l * kb * 6; this.knock.z += dz / l * kb * 6;
        if (!this.def.boss && this.state === 'windup' && Math.random() < 0.5) { this.state = 'recover'; this.t2 = 0.5; }
      }
      if (this.state === 'idle') this.alert();
      if (this.hp <= 0) this.die();
    }
    die() {
      this.dead = true; this.deadT = 0;
      Sound.die({ x: this.x, z: this.z });
      this.m.mats.forEach(m => { m.transparent = true; });
      this.m.eyes.forEach(e => { e.visible = false; });
      Game.onKill(this);
    }
    remove() { Game.scene.remove(this.obj); }

    move(dirx, dirz, speed, dt) {
      const p = { x: this.x + dirx * speed * dt + this.knock.x * dt, z: this.z + dirz * speed * dt + this.knock.z * dt };
      this.knock.x *= Math.pow(0.02, dt); this.knock.z *= Math.pow(0.02, dt);
      // 닫힌 문은 열고 지나간다
      const ahead = World.doorAt(Math.floor(this.x + dirx * 0.8), Math.floor(this.z + dirz * 0.8));
      if (ahead && !ahead.open && !ahead.lock) { World.setDoor(ahead, true, false); Sound.slam({ x: ahead.x + 1, z: ahead.z + 0.5 }); }
      World.collide(p, this.def.radius, false);
      this.x = p.x; this.z = p.z;
      this.moving = speed;
    }
    face(tx, tz, dt, rate = 8) {
      const want = Math.atan2(tx - this.x, tz - this.z);
      let d = want - this.yaw;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.yaw += d * Math.min(1, dt * rate);
    }
    // 플레이어 쪽으로 (보이면 곧장, 아니면 길 찾기)
    seek(P, dist, los, speed, dt) {
      let dx, dz;
      if (los && dist < 14) { dx = (P.x - this.x) / dist; dz = (P.z - this.z) / dist; }
      else {
        const f = Game.flowDir(this.x, this.z);
        if (!f) { this.moving = 0; return; }
        dx = f.x; dz = f.z;
      }
      this.face(this.x + dx, this.z + dz, dt);
      this.move(dx, dz, speed, dt);
    }

    update(dt, t) {
      const P = Game.P, d = this.def;
      if (this.dead) { this.deathAnim(dt); return; }
      this.hitFlash = Math.max(0, this.hitFlash - dt);
      this.lightImmune = Math.max(0, this.lightImmune - dt);
      this.moving = 0;
      if (this.spawnT > 0) { this.spawnT = Math.max(0, this.spawnT - dt * 0.8); this.animate(dt, t); return; }
      const dx = P.x - this.x, dz = P.z - this.z, dist = Math.hypot(dx, dz);
      const los = dist < 20 && World.los(this.x, this.z, P.x, P.z);
      this.dist = dist; this.los = los;
      if (this.stun > 0) { this.stun -= dt; this.move(0, 0, 0, dt); this.animate(dt, t); return; }
      if (this.ai) { this.ai(dt, t, P, dist, los); this.animate(dt, t); return; }

      this.groanT -= dt;
      if (this.groanT <= 0) { this.groanT = 4 + Math.random() * 7; if (dist < 16) Sound.groan({ x: this.x, z: this.z }, this.type === 'crawler' ? 1.5 : 0.9 + Math.random() * 0.2); }

      if (this.state === 'idle') {
        const detect = d.detect * (P.crouch ? 0.5 : 1) * (P.lightOn ? 1.2 : 0.85);
        if ((los && dist < detect && this.inFront(P)) || dist < 2.0 || (P.noise > dist)) this.alert();
        // 천천히 서성임
        this.wanderT -= dt;
        if (this.wanderT <= 0) {
          this.wanderT = 3 + Math.random() * 5;
          const a = Math.random() * Math.PI * 2;
          this.wanderTo = Math.random() < 0.4 ? null : { x: this.home.x + Math.cos(a) * 2.5, z: this.home.z + Math.sin(a) * 2.5 };
        }
        if (this.wanderTo) {
          const wx = this.wanderTo.x - this.x, wz = this.wanderTo.z - this.z, wl = Math.hypot(wx, wz);
          if (wl > 0.3) { this.face(this.wanderTo.x, this.wanderTo.z, dt, 3); this.move(wx / wl, wz / wl, d.speed * 0.6, dt); }
          else this.wanderTo = null;
        }
      } else if (this.state === 'chase') {
        // 손전등에 비치면 뚝뚝 끊기며 다가온다
        let mul = 1;
        if (d.jerky && this.light > 0) {
          this.jerkT -= dt;
          if (this.jerkT <= 0) { this.jerkT = 0.07 + Math.random() * 0.22; this.jerkMul = Math.random() < 0.45 ? 0 : 1.9; }
          mul = this.jerkMul;
        }
        this.seek(P, dist, los, d.chase * mul, dt);
        if (dist < d.range && los) { this.state = 'windup'; this.t2 = d.windup; if (this.type === 'crawler') Sound.giggle({ x: this.x, z: this.z }); }
        this.lost = los ? 0 : this.lost + dt;
        if (this.lost > 8) { this.state = 'idle'; this.home = { x: this.x, z: this.z }; }
      } else if (this.state === 'windup') {
        this.face(P.x, P.z, dt, 10);
        this.t2 -= dt;
        if (this.type === 'crawler' && dist > 0.9) this.move(dx / dist, dz / dist, 2.5, dt); // 달려듦
        if (this.t2 <= 0) {
          if (dist < d.range + 0.45) Game.hurtPlayer(d.dmg, d.san, this);
          this.state = 'recover'; this.t2 = d.cool;
        }
      } else if (this.state === 'recover') {
        this.t2 -= dt;
        if (dist > 1.0) this.seek(P, dist, los, d.speed * 0.5, dt);
        if (this.t2 <= 0) this.state = 'chase';
      }
      this.animate(dt, t);
    }
    inFront(P) { // 등 뒤에서는 덜 알아챈다 → 몰래 지나갈 수 있음
      const fx = Math.sin(this.yaw), fz = Math.cos(this.yaw);
      const dx = P.x - this.x, dz = P.z - this.z, l = Math.hypot(dx, dz) || 1;
      return (fx * dx + fz * dz) / l > -0.2 || l < 4;
    }

    animate(dt, t) {
      const m = this.m;
      this.obj.position.set(this.x, 0, this.z);
      this.obj.rotation.y = this.yaw;
      const mv = Math.min(1, this.moving / 2.5);
      this.phase += dt * (2 + this.moving * 3);
      // 고개 꺾기
      this.twitch -= dt;
      if (this.twitch <= 0) { this.twitch = 0.4 + Math.random() * 2.2; this.twZ = (Math.random() - 0.5) * 1.3; this.twX = (Math.random() - 0.5) * 0.5; }
      if (m.kind === 'student' || m.kind === 'teacher') {
        m.head.rotation.z += (this.twZ - m.head.rotation.z) * Math.min(1, dt * 18);
        m.head.rotation.x += (this.twX - m.head.rotation.x) * Math.min(1, dt * 18);
        m.legs[0].rotation.x = Math.sin(this.phase) * 0.55 * mv;
        m.legs[1].rotation.x = -Math.sin(this.phase) * 0.55 * mv;
        let aL = Math.sin(this.phase) * -0.3 * mv, aR = Math.sin(this.phase) * 0.3 * mv;
        if (this.state === 'windup') { const k = 1 - Math.max(0, this.t2) / this.def.windup; aL = aR = -1.5 - k * 0.9; }
        else if (this.state === 'recover' && this.t2 > this.def.cool - 0.2) { aL = aR = -0.6; }
        if (this.stun > 0) { aL = aR = -2.6 + Math.sin(t * 40) * 0.1; m.head.rotation.x = -0.6; }
        if (this.call) { aL = -1.2; aR = 0.2; }
        m.arms[0].rotation.x += (aL - m.arms[0].rotation.x) * Math.min(1, dt * 12);
        m.arms[1].rotation.x += (aR - m.arms[1].rotation.x) * Math.min(1, dt * 12);
        m.arms[0].rotation.z = -0.08; m.arms[1].rotation.z = 0.08;
        m.body.position.y = Math.abs(Math.sin(this.phase)) * 0.04 * mv + (this.float || 0);
        m.body.rotation.x = this.state === 'windup' ? 0.25 : 0.05;
      } else if (m.kind === 'crawler') {
        m.limbs.forEach(l => {
          const s = Math.sin(this.phase * 1.6 + l.ph);
          l.up.rotation.x = s * 0.6 * mv * (l.front ? 1 : -1);
          l.low.rotation.x = Math.max(0, -s) * 0.6 * mv;
        });
        m.head.rotation.z = Math.sin(t * 9) * 0.15 + this.twZ * 0.5;
        m.body.position.y = Math.abs(Math.sin(this.phase * 1.6)) * 0.05 * mv - (this.state === 'windup' ? 0.15 : 0);
      }
      // 손전등에 비치면 덜덜 떨린다
      if (this.light > 0 || this.stun > 0) { m.body.position.x = (Math.random() - 0.5) * 0.04; m.body.position.z = (Math.random() - 0.5) * 0.04; }
      else { m.body.position.x = 0; m.body.position.z = 0; }
      if (this.spawnT > 0) m.body.position.y = -this.spawnT * 1.8;
      const flash = this.hitFlash > 0 ? 0.5 : 0;
      m.mats.forEach(mt => { if (mt.emissive && mt.userData.base === undefined) mt.userData.base = mt.emissive.getHex(); });
      m.mats.forEach(mt => { if (mt.emissive) { if (flash) mt.emissive.setRGB(0.5, 0.05, 0.05); else mt.emissive.setHex(mt.userData.base); } });
      this.obj.visible = this.visible;
    }
    deathAnim(dt) {
      this.deadT += dt;
      const k = Math.min(1, this.deadT / 1.4);
      this.m.body.rotation.x = -k * 0.6;
      this.m.body.position.y = -k * 0.4;
      this.m.body.position.x = (Math.random() - 0.5) * 0.1 * (1 - k);
      this.obj.scale.set(1 + k * 0.3, 1 - k * 0.6, 1 + k * 0.3);
      this.m.mats.forEach(m => { m.opacity = 1 - k; });
      if (this.deadT > 0.1 && this.deadT - dt <= 0.1) Game.burst(this.x, 1, this.z, 0x000000, 40);
      if (k >= 1 && !this.gone) { this.gone = true; this.remove(); }
    }
  }
  E.Enemy = Enemy;

  // ---------- 건반 위의 아이 (중간 보스) ----------
  E.pianistAI = function (dt, t, P, dist, los) {
    const d = this.def;
    this.float = 0.12 + Math.sin(t * 2) * 0.05;
    this.noteT = (this.noteT || 0) - dt;
    if (this.noteT <= 0) { // 피아노가 혼자 울린다
      this.noteT = 0.5 + Math.random() * 0.6;
      const f = [261.6, 277.2, 329.6, 311.1, 392, 415.3][Math.random() * 6 | 0];
      Sound.piano(f * (Math.random() < 0.3 ? 0.5 : 1), 0, 0.18, { x: 50.5, z: 2 });
    }
    this.tele = (this.tele ?? 3) - dt;
    if (this.state === 'gone') {
      this.visible = false;
      this.t2 -= dt;
      if (this.t2 <= 0) { // 등 뒤에 나타난다
        const back = Math.atan2(-Math.sin(P.yaw), -Math.cos(P.yaw)) + Math.PI;
        for (let i = 0; i < 12; i++) {
          const a = back + (Math.random() - 0.5) * 2.2, r = 2 + Math.random() * 1.5;
          const x = P.x + Math.sin(a) * r, z = P.z + Math.cos(a) * r;
          if (!World.isSolid(Math.floor(x), Math.floor(z)) && World.roomAt(x, z) && World.roomAt(x, z).id === 'music') { this.x = x; this.z = z; break; }
        }
        this.visible = true; this.state = 'chase'; this.tele = 3.5 + Math.random() * 2;
        Sound.giggle({ x: this.x, z: this.z });
        Game.glitch(0.3);
      }
      return;
    }
    if (this.tele <= 0 && this.state === 'chase' && this.stun <= 0) {
      this.state = 'gone'; this.t2 = 0.6 + Math.random() * 0.5; Game.burst(this.x, 1, this.z, 0x000000, 25); return;
    }
    if (this.state === 'chase') {
      this.seek(P, dist, los, d.chase, dt);
      if (dist < d.range) { this.state = 'windup'; this.t2 = d.windup; }
    } else if (this.state === 'windup') {
      this.face(P.x, P.z, dt, 12); this.t2 -= dt;
      if (this.t2 <= 0) { if (dist < d.range + 0.5) Game.hurtPlayer(d.dmg, d.san, this); this.state = 'recover'; this.t2 = d.cool; }
    } else if (this.state === 'recover') {
      this.t2 -= dt;
      if (this.t2 <= 0) this.state = 'chase';
    } else this.state = 'chase';
  };

  // ---------- 담임 (마지막 보스) ----------
  E.teacherAI = function (dt, t, P, dist, los) {
    const d = this.def;
    const hpK = this.hp / this.maxHp;
    if (!this.phase2 && hpK < 0.5) {
      this.phase2 = true; World.mode = 'red'; Sound.boom(); Game.shake(0.8);
      Game.say('담임', '……수업 중에 떠드는 학생이 있구나.', 3);
    }
    [[0.7, 's1'], [0.35, 's2']].forEach(([k, key]) => {
      if (hpK < k && !this[key]) { this[key] = true; Game.bossSummon(); }
    });
    // 출석 부르기
    this.callT = (this.callT ?? 9) - dt;
    if (this.state === 'call') {
      this.call = true;
      this.t2 -= dt;
      const passed = 4.6 - this.t2;
      if (passed > 1.3 && !this.punished) {
        if (P.speed > 0.6 || P.lightOn) {
          this.punished = true;
          Game.attendanceFail(this);
        }
      }
      if (this.t2 <= 0) {
        this.call = false;
        if (!this.punished) { this.state = 'stagger'; this.t2 = 3.5; Game.attendancePass(this); }
        else { this.state = 'chase'; }
        this.callT = this.phase2 ? 11 + Math.random() * 3 : 15 + Math.random() * 3;
      }
      return;
    }
    if (this.state === 'stagger') {
      this.t2 -= dt;
      this.m.body.rotation.z = Math.sin(t * 3) * 0.1;
      if (this.t2 <= 0) { this.state = 'chase'; this.m.body.rotation.z = 0; }
      return;
    }
    if (this.callT <= 0 && this.state === 'chase') {
      this.state = 'call'; this.t2 = 4.6; this.punished = false;
      Game.attendanceStart(this);
      return;
    }
    const sp = d.chase * (this.phase2 ? 1.35 : 1);
    if (this.state === 'idle') this.state = 'chase';
    if (this.state === 'chase') {
      this.seek(P, dist, los, sp, dt);
      if (dist < d.range) { this.state = 'windup'; this.t2 = d.windup * (this.phase2 ? 0.8 : 1); }
    } else if (this.state === 'windup') {
      this.face(P.x, P.z, dt, 5); this.t2 -= dt;
      if (this.t2 <= 0) {
        Sound.swing(true);
        if (dist < d.range + 0.5) Game.hurtPlayer(d.dmg, d.san, this);
        this.state = 'recover'; this.t2 = d.cool;
      }
    } else if (this.state === 'recover') {
      this.t2 -= dt;
      if (this.t2 <= 0) this.state = 'chase';
    }
  };

  // ---------- 갑툭튀 얼굴 ----------
  E.scareHead = (kind) => {
    const g = new THREE.Group();
    const skin = std({ color: 0x55534f, roughness: 0.5, emissive: 0x0a0908 });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 16), skin);
    head.scale.set(0.95, 1.2, 0.9);
    g.add(head);
    const faceM = new THREE.MeshStandardMaterial({ map: Tex.face(kind, 512, 77), transparent: true, alphaTest: 0.05, roughness: 0.45, emissive: 0x1a1818, emissiveMap: Tex.face(kind, 512, 77), fog: false });
    const f = new THREE.Mesh(faceGeo(0.16, 1.9, 2.0), faceM);
    f.scale.set(0.95, 1.2, 0.9);
    g.add(f);
    const hairM = std({ color: 0x030303, side: THREE.DoubleSide, roughness: 0.9 });
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.17, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.36), hairM);
    cap.position.set(0, 0.06, -0.03); cap.scale.set(1, 1.2, 1); g.add(cap);
    hairStrands(g, hairM, 0.8, 0.16, true);
    return g;
  };

  return E;
})();
