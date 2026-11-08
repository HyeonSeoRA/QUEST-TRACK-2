'use strict';
// 게임의 심장: 렌더링, 플레이어, 전투, 물건, 효과, 저장

const Game = (() => {
  const G = {};
  let renderer, scene, camera, rt, postScene, postCam, postMat;
  let dust, beam, spot, playerGlow, candleLight, viewRoot, weaponPivot, phoneMesh, phoneCanvas, phoneTex;
  const weaponModels = {};
  const clock = { t: 0 };
  G.state = 'boot';
  G.enemies = [];
  G.items = [];
  G.interactables = [];
  G.settings = { sens: 1, vol: 0.8, bright: 1, shake: true, quality: 'high', strong: true };
  try { Object.assign(G.settings, JSON.parse(localStorage.getItem('seventh_settings')) || {}); } catch (e) { /* 기본값 */ }

  G.WEAPONS = {
    hands: { name: '맨손', dmg: 7, range: 1.35, time: 0.42, sta: 8, desc: '없는 것보단 낫다' },
    mop: { name: '대걸레 자루', dmg: 15, range: 2.0, time: 0.55, sta: 12, desc: '가볍고 빠르다' },
    pipe: { name: '쇠파이프', dmg: 25, range: 2.1, time: 0.72, sta: 17, desc: '묵직하다' },
    axe: { name: '소방 도끼', dmg: 44, range: 2.25, time: 1.0, sta: 25, desc: '느리지만 강하다' },
  };
  G.ITEMS = {
    bandage: { name: '붕대', icon: '🩹', desc: '체력 +35', key: 'Z' },
    pills: { name: '진정제', icon: '💊', desc: '정신력 +40', key: 'X' },
    battery: { name: '배터리', icon: '🔋', desc: '휴대폰 배터리 +45%', key: 'R' },
    salt: { name: '소금 봉지', icon: '🧂', desc: '앞으로 뿌려 귀신을 묶고 피해 25', key: 'G' },
  };
  G.expNeed = lv => 40 + lv * 40;

  // ---------- 플레이어 ----------
  function freshPlayer() {
    return {
      x: 35.95, z: 6.3, yaw: Math.PI / 2, pitch: -0.2, eye: 1.6, vx: 0, vz: 0, speed: 0,
      hp: 100, maxHp: 100, san: 100, maxSan: 100, sta: 100, maxSta: 100, bat: 100,
      level: 1, exp: 0, points: 0, stats: { vit: 0, wil: 0, str: 0, end: 0 },
      weapon: 'hands', weapons: ['hands'], inv: { bandage: 0, pills: 0, battery: 0, salt: 0 },
      keys: [], docs: [], taken: [], kills: 0, time: 0,
      hasPhone: false, lightOn: false, focus: false, crouch: false, noise: 0,
      atkT: 0, atkHit: false, staDelay: 0, hurtT: 0, dead: false, cine: 0,
    };
  }
  G.P = freshPlayer();
  const P = () => G.P;
  function recalc() {
    const p = G.P;
    p.maxHp = 100 + p.stats.vit * 15;
    p.maxSan = 100 + p.stats.wil * 15;
    p.maxSta = 100 + p.stats.end * 15;
  }
  G.dmgMul = () => 1 + G.P.stats.str * 0.12 + (G.P.level - 1) * 0.03;
  G.addStat = k => {
    const p = G.P;
    if (!p.points) return;
    p.points--; p.stats[k]++;
    recalc();
    if (k === 'vit') p.hp += 15;
    if (k === 'wil') p.san += 15;
    if (k === 'end') p.sta += 15;
    Sound.pickup();
  };
  G.addExp = n => {
    const p = G.P;
    p.exp += n;
    while (p.exp >= G.expNeed(p.level)) {
      p.exp -= G.expNeed(p.level);
      p.level++; p.points++;
      p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.3);
      p.san = Math.min(p.maxSan, p.san + p.maxSan * 0.3);
      UI.levelUp(p.level);
      Sound.levelUp();
    }
  };
  G.timeStr = () => { const s = G.P.time | 0; return `${(s / 60) | 0}분 ${String(s % 60).padStart(2, '0')}초`; };

  // ---------- 준비 ----------
  G.init = async (onStep) => {
    const q = G.settings.quality;
    renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, q === 'high' ? 1.5 : q === 'mid' ? 1 : 0.75));
    renderer.setSize(innerWidth, innerHeight);
    renderer.shadowMap.enabled = q !== 'low';
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x000000);
    $('stage').appendChild(renderer.domElement);
    Tex.aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

    scene = new THREE.Scene();
    G.scene = scene;
    scene.fog = new THREE.FogExp2(0x030304, 0.085);
    scene.add(new THREE.AmbientLight(0x161824, 1.0));
    camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.03, 28); // 안개 너머는 그리지 않는다
    camera.rotation.order = 'YXZ';
    scene.add(camera);
    G.camera = camera;

    // 휴대폰 손전등
    spot = new THREE.SpotLight(0xfff0d8, 0, 26, 0.55, 0.6, 1.5);
    spot.castShadow = q !== 'low';
    spot.shadow.mapSize.set(q === 'high' ? 1024 : 512, q === 'high' ? 1024 : 512);
    spot.shadow.camera.near = 0.1; spot.shadow.camera.far = 26;
    spot.shadow.bias = -0.0006;
    playerGlow = new THREE.PointLight(0x8090b0, 0.14, 3.2, 2);
    camera.add(playerGlow);
    candleLight = new THREE.PointLight(0xff9440, 0, 6, 2);
    scene.add(candleLight);

    buildViewmodel();
    buildPost();
    buildDust();
    onStep && onStep(0.05);
    await new Promise(r => setTimeout(r, 30));
    let lastP = 0;
    World.build(scene, k => { lastP = k; onStep && onStep(0.05 + k * 0.85); });
    onStep && onStep(0.92);
    // 서하 책상 위 국화
    const vase = new THREE.Group();
    const vm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.2, 10), World.std({ color: 0xc0c8c8, roughness: 0.1, transparent: true, opacity: 0.6 }));
    vm.position.y = 0.1; vase.add(vm);
    for (let i = 0; i < 5; i++) {
      const fl = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), World.std({ color: 0x9a9888, roughness: 1 }));
      fl.position.set(Math.sin(i * 1.3) * 0.04, 0.27 + (i % 2) * 0.04, Math.cos(i * 1.3) * 0.04);
      vase.add(fl);
    }
    const ds = World.deskSpot('c23', 3, 3);
    vase.position.set(ds.x - 0.05, 0.76, ds.z + 0.15);
    vase.traverse(o => { o.userData.named = 'vase'; o.userData.label = '흰 국화'; });
    scene.add(vase);
    G.vase = vase;
    const named = { board_c23: '칠판', mirror: '거울', piano: '피아노', skeleton: '골격 모형' };
    Object.keys(named).forEach(k => { const o = World.named[k]; if (o) o.traverse(c => { c.userData.named = k; c.userData.label = named[k]; }); });
    ['board_c23', 'mirror', 'skeleton'].forEach(k => { const o = World.named[k]; if (o) o.traverse(c => { if (c.isMesh) World.interact.push(c); }); });
    vase.traverse(c => { if (c.isMesh) World.interact.push(c); });

    // 갑툭튀 얼굴은 미리 만든다 (멈칫 없음)
    ['hollow', 'grin', 'teacher'].forEach(k => { scareHeads[k] = Ents.scareHead(k); });
    phantom = Ents.buildStudent({ face: 'hollow', seed: 99, redEyes: false });
    phantom.group.visible = false;
    scene.add(phantom.group);
    // 셰이더를 미리 한 번 그려 둔다 (귀신이 처음 나올 때 멈칫하지 않게)
    const temp = Object.keys(Ents.DEFS).map(k => { const m = Ents.DEFS[k].build({ seed: 1 }); m.group.position.set(30, 0, 14); scene.add(m.group); return m.group; });
    renderer.compile(scene, camera);
    temp.forEach(g => scene.remove(g));
    onStep && onStep(1);
    window.addEventListener('resize', resize);
    resize();
    bindInput();
    requestAnimationFrame(frame);
  };

  function resize() {
    if (!renderer) return;
    renderer.setSize(innerWidth, innerHeight);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    const s = renderer.getDrawingBufferSize(new THREE.Vector2());
    rt.setSize(s.x, s.y);
  }

  // ---------- 화면 효과 (후처리) ----------
  function buildPost() {
    const s = renderer.getDrawingBufferSize(new THREE.Vector2());
    const opts = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat };
    if (renderer.capabilities.isWebGL2 && THREE.WebGLMultisampleRenderTarget && G.settings.quality !== 'low') {
      rt = new THREE.WebGLMultisampleRenderTarget(s.x, s.y, opts);
      rt.samples = 4;
    } else rt = new THREE.WebGLRenderTarget(s.x, s.y, opts);
    postMat = new THREE.ShaderMaterial({
      uniforms: {
        tD: { value: rt.texture }, uTime: { value: 0 }, uSan: { value: 1 }, uDmg: { value: 0 }, uScare: { value: 0 },
        uGlitch: { value: 0 }, uBright: { value: 1 }, uRed: { value: 0 }, uLowHp: { value: 0 }, uFocus: { value: 0 },
      },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `
        uniform sampler2D tD; uniform float uTime, uSan, uDmg, uScare, uGlitch, uBright, uRed, uLowHp, uFocus;
        varying vec2 vUv;
        float rnd(vec2 c){ return fract(sin(dot(c, vec2(12.9898, 78.233))) * 43758.5453); }
        void main(){
          vec2 uv = vUv;
          float ins = 1.0 - uSan;
          float ins2 = ins * ins;
          uv.x += sin(uv.y * 18.0 + uTime * 2.3) * 0.004 * ins2 + sin(uv.y * 90.0 + uTime * 70.0) * 0.012 * uScare;
          uv.y += cos(uv.x * 14.0 + uTime * 1.7) * 0.003 * ins2;
          float gl = step(0.92, rnd(vec2(floor(uv.y * 40.0), floor(uTime * 20.0)))) * uGlitch;
          uv.x += gl * (rnd(vec2(uTime, uv.y)) - 0.5) * 0.15;
          vec2 c = uv - 0.5;
          float d = length(c);
          float ab = 0.0015 + ins2 * 0.008 + uDmg * 0.012 + uScare * 0.02 + gl * 0.03;
          vec3 col;
          col.r = texture2D(tD, uv + c * ab).r;
          col.g = texture2D(tD, uv).g;
          col.b = texture2D(tD, uv - c * ab).b;
          col *= uBright;
          col = pow(col, vec3(0.82));
          float l = dot(col, vec3(0.299, 0.587, 0.114));
          col = mix(vec3(l), col, 0.72 - ins * 0.35);
          col *= vec3(0.94, 1.0, 1.04);
          // 다쳤을 때 / 핏빛
          float edge = smoothstep(0.25, 0.75, d);
          col = mix(col, vec3(0.5, 0.0, 0.0) * (0.4 + l), clamp(uDmg * edge * 1.2 + uLowHp * edge * 0.45, 0.0, 0.85));
          col = mix(col, col * vec3(1.3, 0.35, 0.3), uRed * 0.6);
          // 비네트 (정신력이 낮을수록 좁아짐)
          col *= 1.0 - smoothstep(0.35 - ins * 0.2, 0.95, d * (1.0 + ins * 0.7 + uFocus * 0.15));
          // 필름 노이즈, 주사선
          col += (rnd(uv * (uTime + 1.0)) - 0.5) * (0.05 + ins * 0.06 + uScare * 0.2);
          col *= 0.975 + 0.025 * sin(uv.y * 900.0);
          col = mix(col, vec3(1.0) - col, uScare * step(0.5, rnd(vec2(floor(uTime * 30.0), 1.0))) * 0.6);
          gl_FragColor = vec4(col, 1.0);
        }`,
      depthTest: false, depthWrite: false,
    });
    postScene = new THREE.Scene();
    postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), postMat));
  }

  // 손전등 빛 속에 떠다니는 먼지
  function buildDust() {
    const N = 900, pos = new Float32Array(N * 3), seed = new Float32Array(N);
    for (let i = 0; i < N; i++) { pos[i * 3] = Math.random() * 8; pos[i * 3 + 1] = Math.random() * 8; pos[i * 3 + 2] = Math.random() * 8; seed[i] = Math.random(); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    const m = new THREE.ShaderMaterial({
      uniforms: { uCam: { value: new THREE.Vector3() }, uDir: { value: new THREE.Vector3(0, 0, -1) }, uTime: { value: 0 }, uLight: { value: 0 }, uSize: { value: 26 * renderer.getPixelRatio() } },
      vertexShader: `
        uniform vec3 uCam; uniform vec3 uDir; uniform float uTime, uLight, uSize; attribute float aSeed; varying float vA;
        void main(){
          vec3 p = position + vec3(sin(uTime * 0.1 + aSeed * 6.0) * 0.4, -uTime * 0.04 * (0.5 + aSeed), cos(uTime * 0.13 + aSeed * 4.0) * 0.4);
          p = uCam + mod(p - uCam + 4.0, 8.0) - 4.0;
          vec3 d = p - uCam; float dist = length(d);
          float c = dot(d / max(dist, 0.001), uDir);
          vA = smoothstep(0.84, 0.97, c) * uLight * (1.0 - smoothstep(0.8, 7.0, dist)) * (0.3 + 0.7 * fract(aSeed * 13.7));
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = uSize * (0.4 + aSeed) / -mv.z;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: `varying float vA; void main(){ float a = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5)); gl_FragColor = vec4(1.0, 0.95, 0.85, a * vA * 0.55); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    });
    dust = new THREE.Points(g, m);
    dust.frustumCulled = false;
    scene.add(dust);
  }

  // ---------- 손에 든 것 ----------
  function buildViewmodel() {
    viewRoot = new THREE.Group();
    camera.add(viewRoot);
    // 왼손 휴대폰
    const phoneG = new THREE.Group();
    phoneG.position.set(-0.24, -0.25, -0.42);
    phoneG.rotation.set(-0.15, 0.25, 0.05);
    phoneCanvas = Tex.cv(128, 240);
    phoneTex = new THREE.CanvasTexture(phoneCanvas[0]);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.14, 0.009), new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.3, metalness: 0.5 }));
    phoneG.add(body);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.062, 0.128), new THREE.MeshBasicMaterial({ map: phoneTex, toneMapped: false, fog: false }));
    screen.position.z = 0.0048;
    phoneG.add(screen);
    // 손전등은 휴대폰 뒤에서 나간다 (휴대폰을 숨겨도 빛 개수는 그대로 → 셰이더를 다시 만들지 않음)
    spot.position.set(-0.22, -0.18, -0.45);
    viewRoot.add(spot);
    const tgt = new THREE.Object3D(); tgt.position.set(0.1, 0.0, -6); viewRoot.add(tgt);
    spot.target = tgt;
    // 빛줄기
    const cone = new THREE.ConeGeometry(1.4, 7, 24, 1, true);
    cone.translate(0, -3.5, 0); cone.rotateX(-Math.PI / 2);
    beam = new THREE.Mesh(cone, new THREE.ShaderMaterial({
      uniforms: { uA: { value: 0 } },
      vertexShader: 'varying float vZ; void main(){ vZ = -position.z / 7.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform float uA; varying float vZ; void main(){ gl_FragColor = vec4(1.0, 0.95, 0.85, uA * pow(1.0 - vZ, 2.0) * smoothstep(0.0, 0.08, vZ)); }',
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    }));
    beam.position.set(-0.22, -0.18, -0.47);
    viewRoot.add(beam);
    beam.lookAt(new THREE.Vector3(0.1, 0.0, -6));
    phoneMesh = phoneG;
    viewRoot.add(phoneG);

    // 오른손 무기
    weaponPivot = new THREE.Group();
    weaponPivot.position.set(0.27, -0.3, -0.42);
    viewRoot.add(weaponPivot);
    const wood = new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 0.8 });
    const metal = new THREE.MeshStandardMaterial({ color: 0x55585e, roughness: 0.4, metalness: 0.8 });
    const red = new THREE.MeshStandardMaterial({ color: 0x8a0a0a, roughness: 0.5, metalness: 0.3 });
    const mk = (parts) => { const g = new THREE.Group(); parts.forEach(p => g.add(p)); g.visible = false; weaponPivot.add(g); return g; };
    const stick = (r, len, mat) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8), mat); m.rotation.x = -Math.PI / 2 + 0.5; m.position.set(0, len * 0.22, -len * 0.38); return m; };
    weaponModels.hands = mk([]);
    weaponModels.mop = mk([stick(0.016, 1.0, wood)]);
    weaponModels.pipe = mk([stick(0.02, 0.85, metal)]);
    const axeHead = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.14, 0.22), red);
    axeHead.position.set(0, 0.42, -0.58);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.18, 0.06), metal);
    blade.position.set(0, 0.42, -0.71);
    weaponModels.axe = mk([stick(0.02, 0.85, wood), axeHead, blade]);
  }
  function drawPhone() {
    const g = phoneCanvas[1], p = G.P;
    g.fillStyle = '#05070a'; g.fillRect(0, 0, 128, 240);
    const gr = g.createLinearGradient(0, 0, 0, 240);
    gr.addColorStop(0, 'rgba(40,50,80,0.6)'); gr.addColorStop(1, 'rgba(10,10,20,0.6)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 240);
    g.fillStyle = '#dde'; g.font = '11px sans-serif'; g.textAlign = 'left'; g.fillText('서비스 없음', 6, 14);
    g.textAlign = 'right'; g.fillText(Math.ceil(p.bat) + '%', 122, 14);
    g.textAlign = 'center'; g.font = '700 38px sans-serif';
    g.fillStyle = Math.random() < 0.03 ? '#a22' : '#eef';
    g.fillText(Math.random() < 0.03 ? '31:31' : '16:44', 64, 80);
    g.font = '12px sans-serif'; g.fillStyle = '#aab'; g.fillText('2006년 11월 1일 수요일', 64, 100);
    g.fillStyle = p.lightOn ? '#fff4c8' : '#445'; g.beginPath(); g.arc(64, 200, 16, 0, 7); g.fill();
    phoneTex.needsUpdate = true;
  }

  // ---------- 입력 ----------
  const keys = {};
  let mouseR = false, lockWanted = false, intentionalUnlock = false;
  G.locked = () => document.pointerLockElement === renderer.domElement;
  G.lock = () => { try { const r = renderer.domElement.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) { /* 다시 클릭 */ } };
  G.unlock = () => { intentionalUnlock = true; if (document.pointerLockElement) document.exitPointerLock(); };
  function bindInput() {
    const cv = renderer.domElement;
    cv.addEventListener('mousedown', e => {
      if (G.state !== 'play') return;
      if (!G.locked()) { G.lock(); return; }
      if (UI.inDialog()) { if (e.button === 0) UI.dialogKey('adv'); return; }
      if (UI.docOpen()) { UI.closeDoc(); return; }
      if (e.button === 0) attack();
      if (e.button === 2) mouseR = true;
    });
    window.addEventListener('mouseup', e => { if (e.button === 2) mouseR = false; });
    cv.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('mousemove', e => {
      if (!G.locked() || G.state !== 'play' || UI.inDialog() || UI.docOpen() || G.P.cine > 0) return;
      const s = 0.0022 * G.settings.sens;
      G.P.yaw -= e.movementX * s;
      G.P.pitch = Math.max(-1.45, Math.min(1.45, G.P.pitch - e.movementY * s));
    });
    document.addEventListener('pointerlockchange', () => {
      const on = G.locked();
      if (!on && G.state === 'play' && !intentionalUnlock) G.pause();
      intentionalUnlock = false;
    });
    window.addEventListener('keydown', e => {
      const k = e.code;
      if (k === 'Tab') e.preventDefault();
      if (G.state === 'inv') { if (k === 'Tab' || k === 'Escape' || k === 'KeyI') G.closeInv(); return; }
      if (G.state === 'ending') { if (k === 'Space' || k === 'Enter') G.endingNext(); return; }
      if (G.state === 'intro') { if (k === 'Space' || k === 'Enter' || k === 'Escape') G.skipIntro(); return; }
      if (G.state !== 'play') return;
      if (k === 'Escape' && !G.locked()) { G.pause(); return; }
      if (UI.inDialog()) {
        if (k === 'KeyE' || k === 'Space' || k === 'Enter') UI.dialogKey('adv');
        else if (/^Digit[1-4]$/.test(k)) UI.dialogKey(k.slice(5));
        return;
      }
      if (UI.docOpen()) { if (k === 'KeyE' || k === 'Space' || k === 'Enter' || k === 'Escape') UI.closeDoc(); return; }
      keys[k] = true;
      if (G.P.cine > 0) return;
      if (k === 'KeyE') interact();
      if (k === 'KeyF') G.setLight(!G.P.lightOn);
      if (k === 'KeyC') G.P.crouch = !G.P.crouch;
      if (k === 'Tab' || k === 'KeyI') G.openInv();
      if (k === 'Digit1' || k === 'Digit2' || k === 'Digit3' || k === 'Digit4') {
        const w = G.P.weapons.filter(x => x !== 'hands')[+k.slice(5) - 1];
        if (w && G.P.atkT <= 0) { G.P.weapon = w; Sound.swing(false); }
      }
      if (k === 'KeyZ') G.useItem('bandage');
      if (k === 'KeyX') G.useItem('pills');
      if (k === 'KeyR') G.useItem('battery');
      if (k === 'KeyG') G.useItem('salt');
    });
    window.addEventListener('keyup', e => { keys[e.code] = false; });
    window.addEventListener('blur', () => { Object.keys(keys).forEach(k => { keys[k] = false; }); mouseR = false; });
  }

  // ---------- 손전등 ----------
  G.setLight = on => {
    const p = G.P;
    if (!p.hasPhone) return;
    if (on && p.bat <= 0) { UI.sub('', '배터리가 없다. (R 로 배터리 교체)', 2.5); return; }
    p.lightOn = on;
    Sound.flash(on);
    drawPhone();
  };

  // ---------- 소지품 ----------
  G.useItem = k => {
    const p = G.P;
    if (!p.inv[k]) { UI.sub('', `${G.ITEMS[k].name}이(가) 없다.`, 1.5); return; }
    if (k === 'bandage') { if (p.hp >= p.maxHp) return UI.sub('', '다친 곳이 없다.', 1.5); p.hp = Math.min(p.maxHp, p.hp + 35); }
    if (k === 'pills') { if (p.san >= p.maxSan) return UI.sub('', '아직 괜찮다.', 1.5); p.san = Math.min(p.maxSan, p.san + 40); }
    if (k === 'battery') { if (!p.hasPhone || p.bat >= 98) return UI.sub('', '배터리는 아직 충분하다.', 1.5); p.bat = Math.min(100, p.bat + 45); }
    if (k === 'salt') { throwSalt(); }
    p.inv[k]--;
    Sound.pickup();
    UI.toast(`${G.ITEMS[k].icon} ${G.ITEMS[k].name} 사용`);
  };
  G.openInv = () => {
    G.state = 'inv';
    hintShown = false; $('clickHint').classList.remove('show');
    G.unlock();
    UI.renderInv();
    UI.open('inv');
  };
  G.closeInv = () => {
    UI.hide('inv');
    G.state = 'play';
    G.lock();
  };
  G.pause = () => {
    if (G.state !== 'play') return;
    G.state = 'pause';
    hintShown = false; $('clickHint').classList.remove('show');
    UI.open('pause');
  };
  G.resume = () => {
    UI.hide('pause'); UI.hide('settings');
    G.state = 'play';
    G.lock();
  };

  // ---------- 물건 ----------
  const glowMat = {};
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  function itemMesh(it) {
    const g = new THREE.Group();
    const S = (o) => new THREE.MeshStandardMaterial(Object.assign({ roughness: 0.6 }, o));
    const add = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
    let glow = [255, 230, 170], gs = 0.35;
    switch (it.kind) {
      case 'phone':
        add(new THREE.BoxGeometry(0.07, 0.009, 0.14), S({ color: 0x0a0a0c, metalness: 0.5, roughness: 0.3 }), 0, 0.005, 0);
        add(new THREE.PlaneGeometry(0.06, 0.125), new THREE.MeshBasicMaterial({ color: 0x8090c0 }), 0, 0.011, 0).rotation.x = -Math.PI / 2;
        glow = [140, 160, 255]; gs = 0.6;
        break;
      case 'doc': {
        const p = add(new THREE.PlaneGeometry(0.21, 0.29), S({ map: Tex.paper(it.id.length + 7, it.id === 'd3'), side: THREE.DoubleSide, roughness: 1 }), 0, 0.004, 0);
        p.rotation.x = -Math.PI / 2; p.rotation.z = 0.3;
        glow = [255, 240, 200]; gs = 0.45;
        break;
      }
      case 'candle': {
        add(new THREE.CylinderGeometry(0.025, 0.028, 0.12, 10), S({ color: 0xd8d0b8, roughness: 0.8 }), 0, 0.06, 0);
        add(new THREE.CylinderGeometry(0.06, 0.07, 0.015, 12), S({ color: 0x6a5a40, metalness: 0.6 }), 0, 0.007, 0);
        const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: Tex.glow(255, 170, 70), blending: THREE.AdditiveBlending, depthWrite: false }));
        fl.scale.set(0.09, 0.14, 1); fl.position.y = 0.16; g.add(fl);
        g.userData.flame = fl;
        glow = [255, 140, 50]; gs = 0.9;
        break;
      }
      case 'weapon':
        if (it.w === 'mop') { const m = add(new THREE.CylinderGeometry(0.016, 0.016, 1.15, 8), S({ color: 0x6a4a2a }), 0, 0.57, 0); m.rotation.z = 0.25; const h = add(new THREE.BoxGeometry(0.3, 0.05, 0.08), S({ color: 0x5a5a50 }), -0.13, 0.03, 0); h.rotation.z = 0.25; }
        if (it.w === 'pipe') { const m = add(new THREE.CylinderGeometry(0.02, 0.02, 0.9, 8), S({ color: 0x55585e, metalness: 0.8, roughness: 0.4 }), 0, 0.02, 0); m.rotation.z = Math.PI / 2; m.rotation.y = 0.6; }
        if (it.w === 'axe') { add(new THREE.CylinderGeometry(0.018, 0.018, 0.85, 8), S({ color: 0x6a4a2a }), 0, 0, 0); add(new THREE.BoxGeometry(0.03, 0.14, 0.22), S({ color: 0x8a0a0a, metalness: 0.3 }), 0, 0.33, 0.08); g.rotation.z = 0.15; }
        glow = [255, 220, 160]; gs = 0.7;
        break;
      case 'bandage': add(new THREE.CylinderGeometry(0.04, 0.04, 0.07, 12), S({ color: 0xd8d4c8, roughness: 1 }), 0, 0.035, 0).rotation.z = Math.PI / 2; break;
      case 'pills': add(new THREE.CylinderGeometry(0.025, 0.025, 0.08, 10), S({ color: 0xa05010, roughness: 0.3, transparent: true, opacity: 0.85 }), 0, 0.04, 0); add(new THREE.CylinderGeometry(0.027, 0.027, 0.02, 10), S({ color: 0xeeeeee }), 0, 0.09, 0); break;
      case 'battery': add(new THREE.BoxGeometry(0.05, 0.012, 0.08), S({ color: 0x202428, metalness: 0.5 }), 0, 0.006, 0); add(new THREE.BoxGeometry(0.04, 0.003, 0.03), S({ color: 0xb08020, metalness: 0.8 }), 0, 0.013, -0.02); glow = [140, 255, 160]; break;
      case 'salt': add(new THREE.BoxGeometry(0.09, 0.12, 0.05), S({ color: 0xe0ddd0, roughness: 1 }), 0, 0.06, 0).rotation.y = 0.4; break;
      case 'key':
        if (it.id === 'nametag') { const n = add(new THREE.PlaneGeometry(0.1, 0.03), S({ map: Tex.nametag(), roughness: 0.7 }), 0, 0.005, 0); n.rotation.x = -Math.PI / 2; glow = [180, 200, 255]; break; }
        add(new THREE.BoxGeometry(0.02, 0.005, 0.07), S({ color: 0xb09030, metalness: 0.9, roughness: 0.3 }), 0, 0.003, 0);
        add(new THREE.TorusGeometry(0.02, 0.005, 6, 12), S({ color: 0xb09030, metalness: 0.9, roughness: 0.3 }), 0, 0.003, 0.045).rotation.x = Math.PI / 2;
        if (it.y > 1) g.rotation.x = Math.PI / 2; // 벽에 걸린 열쇠
        glow = [255, 210, 100]; gs = 0.5;
        break;
      case 'book': case 'book2':
        add(new THREE.BoxGeometry(0.25, 0.04, 0.33), S({ color: 0x5a0606, emissive: 0x1a0000, roughness: 0.7 }), 0, 0.02, 0).rotation.y = 0.2;
        glow = [255, 40, 30]; gs = 0.8;
        break;
    }
    // 얇은 물건도 쉽게 조준되도록 보이지 않는 상자를 씌운다
    const hb = { weapon: [0.4, 1.2, 0.4, 0.6], key: [0.25, 0.2, 0.25, 0.05], doc: [0.35, 0.12, 0.4, 0.03], candle: [0.25, 0.35, 0.25, 0.12] }[it.kind] || [0.3, 0.25, 0.3, 0.08];
    if (it.kind === 'weapon' && it.w !== 'mop') { hb[1] = 0.5; hb[3] = 0.1; }
    const hit = new THREE.Mesh(new THREE.BoxGeometry(hb[0], hb[1], hb[2]), hitMat);
    hit.position.y = hb[3];
    g.add(hit);
    const gk = glow.join(',');
    if (!glowMat[gk]) glowMat[gk] = new THREE.SpriteMaterial({ map: Tex.glow(...glow), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.5 });
    const sp = new THREE.Sprite(glowMat[gk]);
    sp.scale.set(gs, gs, gs); sp.position.y = 0.05;
    g.add(sp);
    g.userData.glow = sp;
    g.position.set(it.x, it.y, it.z);
    g.traverse(o => { o.userData.item = it; });
    return g;
  }
  G.placeItem = it => {
    const m = itemMesh(it);
    scene.add(m);
    const rec = { def: it, mesh: m };
    G.items.push(rec);
    m.traverse(o => { if (o.isMesh) G.interactables.push(o); });
    refreshItem(rec);
    return rec;
  };
  function refreshItem(rec) {
    const ok = !rec.def.req || !!rec.def.req();
    rec.mesh.visible = ok;
  }
  G.showItem = () => G.items.forEach(refreshItem);
  G.removeItem = id => {
    const i = G.items.findIndex(r => r.def.id === id);
    if (i < 0) return;
    const rec = G.items[i];
    scene.remove(rec.mesh);
    G.items.splice(i, 1);
    G.interactables = G.interactables.filter(o => o.userData.item !== rec.def);
  };
  function take(it) {
    const p = G.P;
    const note = (t) => UI.toast(t, 'get');
    switch (it.kind) {
      case 'phone': p.hasPhone = true; drawPhone(); break;
      case 'doc':
        p.docs.push(it.id);
        UI.readDoc(Story.DOCS[it.id], () => Story.onPickup(it));
        G.addExp(15);
        break;
      case 'weapon': p.weapons.push(it.w); p.weapon = it.w; note(`⚔ ${G.WEAPONS[it.w].name} 획득`); break;
      case 'key': p.keys.push(it.id); note(`🔑 ${Story.KEYS[it.id] || it.label}`); break;
      case 'candle': return G.save();
      case 'book': Story.onBook(); return;
      case 'book2': Story.onFinalBook(); return;
      default: p.inv[it.kind] += it.n || 1; note(`${G.ITEMS[it.kind].icon} ${G.ITEMS[it.kind].name}${(it.n || 1) > 1 ? ' × ' + it.n : ''}`);
    }
    Sound.pickup();
    p.taken.push(it.id);
    G.removeItem(it.id);
    if (it.kind !== 'doc') Story.onPickup(it);
  }

  // ---------- 조사하기 (E) ----------
  const ray = new THREE.Raycaster();
  const center = new THREE.Vector2(0, 0);
  let looking = null;
  function findTarget() {
    camera.updateMatrixWorld();
    ray.setFromCamera(center, camera);
    ray.far = 2.5;
    const hits = ray.intersectObjects(G.interactables, false);
    for (const h of hits) {
      let o = h.object;
      while (o && !o.userData.item && !o.userData.door && !o.userData.npc && !o.userData.named && !o.userData.wall) o = o.parent;
      if (!o) continue;
      if (!o.visible || (o.parent && !o.parent.visible)) continue;
      if (o.userData.wall) return null;
      return o.userData;
    }
    return null;
  }
  function promptFor(u) {
    if (!u) return null;
    if (u.item) return u.item.label;
    if (u.npc) return u.npc.alpha > 0.3 ? '서하 — 말 걸기' : null;
    if (u.door) { const d = u.door; const rm = World.room(d.room); return d.lock ? `${rm.name} (잠김)` : d.open ? `${rm.name} — 문 닫기` : `${rm.name} — 문 열기`; }
    if (u.named) return u.label;
    return null;
  }
  function interact() {
    const u = looking;
    if (!u) return;
    if (u.item) return take(u.item);
    if (u.npc) { Story.onNPC(u.npc); return; }
    if (u.named) { Story.onUse(u.named); return; }
    if (u.door) {
      const d = u.door, p = G.P;
      if (d.lock) {
        if (Story.onDoor(d)) return;
        if (p.keys.includes(d.lock)) {
          World.unlock(d); World.setDoor(d, true);
          UI.toast(`🔓 ${World.room(d.room).name} 문을 열었다`);
          Story.refreshQuest();
          return;
        }
        Sound.locked({ x: d.x + 1, z: d.z + 0.5 });
        UI.sub('', Story.lockedText[d.lock] || '잠겨 있다.', 2.5);
        return;
      }
      if (d.open) {
        const cx = Math.floor(p.x), cz = Math.floor(p.z);
        if (cz === d.z && (cx === d.x || cx === d.x + 1)) return;
        if (G.enemies.some(e => !e.dead && Math.floor(e.z) === d.z && Math.floor(e.x) >= d.x && Math.floor(e.x) <= d.x + 1)) return;
      }
      World.setDoor(d, !d.open);
    }
  }

  // ---------- 귀신 관리 ----------
  G.spawn = (type, x, z, o = {}) => {
    const e = new Ents.Enemy(type, x, z, o);
    G.enemies.push(e);
    return e;
  };
  let bossE = null;
  G.boss = e => { bossE = e; UI.boss(e ? e.def.name : null, 1); };
  G.bossSummon = () => {
    Sound.shriek({ x: 55, z: 22 });
    [[49, 18.5], [60, 25.5], [49, 25.5]].slice(0, 2).forEach(([x, z]) => G.spawn('shadow', x, z, { alert: true, rise: true }));
    UI.sub('담임', '모두, 자리에 앉아.', 2.5);
  };
  G.onSpotted = e => { spottedT = 2; };
  G.onKill = e => {
    G.P.kills++;
    G.addExp(e.def.exp);
    UI.toast(`✝ ${e.def.name} · 경험치 +${e.def.exp}`, 'kill');
    Story.onKill(e);
  };
  // 길 찾기 (플레이어 칸에서 퍼져 나가는 거리 지도)
  const flow = new Int16Array(World.GW * World.GH);
  let flowT = 0;
  function computeFlow() {
    flow.fill(-1);
    const GW = World.GW, GH = World.GH;
    const sx = Math.floor(G.P.x), sz = Math.floor(G.P.z);
    if (!World.isWalkable(sx, sz)) return;
    const q = [sx + sz * GW];
    flow[q[0]] = 0;
    for (let h = 0; h < q.length; h++) {
      const c = q[h], x = c % GW, z = (c / GW) | 0, d = flow[c];
      if (d > 70) continue;
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (const [dx, dz] of nb) {
        const nx = x + dx, nz = z + dz;
        if (nx < 0 || nz < 0 || nx >= GW || nz >= GH) continue;
        const ni = nx + nz * GW;
        if (flow[ni] !== -1 || !World.isWalkable(nx, nz)) continue;
        flow[ni] = d + 1;
        q.push(ni);
      }
    }
  }
  G.flowDir = (x, z) => {
    const GW = World.GW, cx = Math.floor(x), cz = Math.floor(z);
    const here = flow[cx + cz * GW];
    if (here <= 0) return null;
    let best = null, bd = here;
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue;
      const nx = cx + dx, nz = cz + dz;
      if (nx < 0 || nz < 0 || nx >= GW || nz >= World.GH) continue;
      const v = flow[nx + nz * GW];
      if (v < 0) continue;
      if (dx && dz && (flow[cx + dx + cz * GW] < 0 || flow[cx + (cz + dz) * GW] < 0)) continue;
      const score = v + (dx && dz ? 0.4 : 0);
      if (score < bd) { bd = score; best = { x: nx + 0.5, z: nz + 0.5 }; }
    }
    if (!best) return null;
    const l = Math.hypot(best.x - x, best.z - z) || 1;
    return { x: (best.x - x) / l, z: (best.z - z) / l };
  };

  // ---------- 싸움 ----------
  function attack() {
    const p = G.P;
    if (p.atkT > 0 || p.cine > 0) return;
    const w = G.WEAPONS[p.weapon];
    if (p.sta < w.sta * 0.5) { UI.sub('', '숨이 차서 휘두를 수 없다.', 1.2); return; }
    p.sta = Math.max(0, p.sta - w.sta);
    p.staDelay = 0.9;
    p.atkT = w.time; p.atkHit = false;
    p.noise = Math.max(p.noise, 7);
    Sound.swing(p.weapon === 'axe' || p.weapon === 'pipe');
  }
  function fwd() { return { x: -Math.sin(G.P.yaw), z: -Math.cos(G.P.yaw) }; }
  function doHit() {
    const p = G.P, w = G.WEAPONS[p.weapon], f = fwd();
    let any = false;
    G.enemies.forEach(e => {
      if (e.dead || !e.visible) return;
      const dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz);
      if (d > w.range + e.def.radius) return;
      const dot = (dx * f.x + dz * f.z) / (d || 1);
      if (dot < 0.55 && d > 0.6) return;
      if (!World.los(p.x, p.z, e.x, e.z)) return;
      let dmg = w.dmg * G.dmgMul() * (0.9 + Math.random() * 0.2);
      const crit = Math.random() < 0.1 + p.stats.str * 0.02;
      if (crit) dmg *= 1.8;
      if (e.type === 'pianist') dmg *= e.stun > 0 ? 2 : 0.5;
      if (e.type === 'teacher' && e.state === 'stagger') dmg *= 2;
      if (e.type === 'teacher' && e.state === 'call') dmg *= 0.3;
      e.damage(dmg, p);
      dmgNumber(e, dmg, crit);
      G.burst(e.x, 1.2, e.z, 0x050505, 10);
      any = true;
    });
    if (any) { Sound.hit(); hitstop = 0.06; G.shake(p.weapon === 'axe' ? 0.35 : 0.18); }
  }
  function throwSalt() {
    const p = G.P, f = fwd();
    Sound.salt();
    G.burst(p.x + f.x * 1.5, 1.2, p.z + f.z * 1.5, 0xffffff, 40, true);
    G.enemies.forEach(e => {
      if (e.dead) return;
      const dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz);
      if (d > 4.5) return;
      if ((dx * f.x + dz * f.z) / (d || 1) < 0.35) return;
      e.damage(25, p);
      dmgNumber(e, 25, false);
      if (e.type !== 'teacher') e.stun = 2.2; else if (e.state !== 'call') e.stun = 1.0;
    });
  }
  // 빛에 비친 귀신
  function lightHits(dt) {
    const p = G.P;
    if (!p.lightOn) { G.enemies.forEach(e => { e.light = 0; }); return; }
    const f = fwd(), focus = p.focus;
    G.enemies.forEach(e => {
      e.light = Math.max(0, (e.light || 0) - dt);
      if (e.dead || !e.visible) return;
      const dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz);
      if (d > (focus ? 14 : 10)) return;
      const dot = (dx * f.x + dz * f.z) / (d || 1);
      if (dot < (focus ? 0.965 : 0.88)) return;
      if (!World.los(p.x, p.z, e.x, e.z)) return;
      e.light = 0.25;
      const def = e.def;
      e.lightExp = (e.lightExp || 0) + dt * (focus ? 1 : 0.25);
      if (focus && def.lightDmg) { e.damage(def.lightDmg * dt * (1 + p.stats.wil * 0.1), null, 'light'); }
      if (e.lightExp >= def.lightStun && e.lightImmune <= 0 && e.stun <= 0) {
        if (e.type === 'teacher' && e.state !== 'stagger') return;
        e.lightExp = 0; e.lightImmune = 2.6;
        e.stun = e.type === 'pianist' ? 3.0 : 1.7;
        if (e.type === 'pianist') { e.state = 'chase'; e.visible = true; }
        Sound.shriek({ x: e.x, z: e.z });
        UI.sub('', `${def.name}이(가) 빛에 움츠러들었다!`, 1.5);
      }
    });
  }
  G.hurtPlayer = (dmg, san, src) => {
    const p = G.P;
    if (p.dead || p.cine > 0) return;
    p.hp -= dmg;
    p.san = Math.max(0, p.san - san * (1 - Math.min(0.5, p.stats.wil * 0.06)));
    p.hurtT = 0.6;
    fx.dmg = 1;
    Sound.hurt();
    G.shake(0.45);
    if (src) { const dx = p.x - src.x, dz = p.z - src.z, l = Math.hypot(dx, dz) || 1; p.vx += dx / l * 4; p.vz += dz / l * 4; }
    if (p.hp <= 0) die();
  };

  // ---------- 출석 부르기 (보스 장치) ----------
  G.attendanceStart = e => {
    Sound.static(1.2, 0.25);
    UI.big('31번.', 2.2, 'call');
    Sound.speak('삼십일번');
    G.later(1.4, () => { UI.big('31번, {name}.', 3, 'call'); });
    G.later(0.4, () => { UI.sub('서하', '움직이지 마. 불을 꺼…!', 3.5); Sound.whisper(1.5); });
  };
  G.attendanceFail = e => {
    const p = G.P, f = fwd();
    e.x = p.x + f.x * 1.4; e.z = p.z + f.z * 1.4;
    World.collide(e, 0.5, false);
    e.yaw = Math.atan2(p.x - e.x, p.z - e.z);
    UI.big('찾았다.', 1.6, 'red');
    G.scare('teacher', true);
    G.hurtPlayer(18, 26, null);
  };
  G.attendancePass = e => {
    UI.big('……결석.', 2, 'call');
    UI.sub('서하', '지금이야!', 2.5);
    Sound.groan({ x: e.x, z: e.z }, 0.6);
  };

  // ---------- 효과 ----------
  const fx = { dmg: 0, scare: 0, glitch: 0, shake: 0, red: 0 };
  let hitstop = 0, spottedT = 0;
  G.shake = k => { if (G.settings.shake) fx.shake = Math.max(fx.shake, k); };
  G.glitch = k => { fx.glitch = Math.max(fx.glitch, k); };
  const scareHeads = {};
  let scareCur = null, scareT = 0, phantom = null, phantomT = 0;
  G.scare = (kind, quiet) => {
    if (scareCur) camera.remove(scareCur);
    scareCur = scareHeads[kind] || scareHeads.hollow;
    scareCur.position.set((Math.random() - 0.5) * 0.06, -0.02, -0.5);
    scareCur.rotation.set(0, 0, (Math.random() - 0.5) * 0.4);
    camera.add(scareCur);
    scareT = 0.75;
    const strong = G.settings.strong;
    fx.scare = strong ? 1 : 0.4;
    Sound.scream();
    G.shake(strong ? 1.1 : 0.4);
    if (!quiet) G.P.san = Math.max(0, G.P.san - 12);
  };
  // 파티클 (먼지, 소금)
  const bursts = [];
  const burstMats = {};
  G.burst = (x, y, z, color, n, add) => {
    const key = color + (add ? 'a' : '');
    if (!burstMats[key]) burstMats[key] = new THREE.SpriteMaterial({ map: Tex.glow(255, 255, 255), color, transparent: true, depthWrite: false, blending: add ? THREE.AdditiveBlending : THREE.NormalBlending, opacity: 0.8 });
    for (let i = 0; i < n; i++) {
      const s = new THREE.Sprite(burstMats[key]);
      const sz = 0.08 + Math.random() * 0.15;
      s.scale.set(sz, sz, sz);
      s.position.set(x + (Math.random() - 0.5) * 0.4, y + (Math.random() - 0.5) * 0.8, z + (Math.random() - 0.5) * 0.4);
      scene.add(s);
      bursts.push({ s, vx: (Math.random() - 0.5) * 2.5, vy: Math.random() * 1.8, vz: (Math.random() - 0.5) * 2.5, life: 0.6 + Math.random() * 0.6 });
    }
  };
  function dmgNumber(e, dmg, crit) {
    const v = new THREE.Vector3(e.x, 1.6, e.z).project(camera);
    if (v.z > 1) return;
    const d = document.createElement('div');
    d.className = 'dmgNum' + (crit ? ' crit' : '');
    d.textContent = Math.round(dmg) + (crit ? '!' : '');
    d.style.left = ((v.x + 1) / 2 * innerWidth + (Math.random() - 0.5) * 30) + 'px';
    d.style.top = ((1 - v.y) / 2 * innerHeight) + 'px';
    $('hud').appendChild(d);
    setTimeout(() => d.remove(), 900);
  }

  // ---------- 저장 ----------
  const saveKey = () => 'seventh_save_' + (Auth.user ? Auth.user.id : 'guest');
  G.hasSave = () => { try { return !!localStorage.getItem(saveKey()); } catch (e) { return false; } };
  G.save = (silent) => {
    const p = G.P;
    const flags = Object.assign({}, Story.flags);
    if (!flags.bossDead) { delete flags.broadEnter; }
    if (!flags.pianistDead) { delete flags.pianoStart; }
    const data = {
      v: 1, flags,
      P: { x: p.x, z: p.z, yaw: p.yaw, hp: p.hp, san: p.san, bat: p.bat, level: p.level, exp: p.exp, points: p.points, stats: p.stats, weapon: p.weapon, weapons: p.weapons, inv: p.inv, keys: p.keys, docs: p.docs, taken: p.taken, kills: p.kills, time: p.time, hasPhone: p.hasPhone },
      doors: World.doors.map(d => ({ id: d.id, open: d.open, lock: d.lock === 'boss' ? 'key_broad_done' : d.lock })),
      when: Date.now(),
    };
    try { localStorage.setItem(saveKey(), JSON.stringify(data)); } catch (e) { /* 저장 실패 */ }
    if (!silent) {
      p.san = Math.min(p.maxSan, p.san + 30);
      p.hp = Math.min(p.maxHp, p.hp + 20);
      Sound.save();
      UI.big('기록되었다', 1.8, 'save');
      UI.toast('🕯 촛불 앞에서 숨을 고르고, 지금까지를 기록했다. (정신력 +30 · 체력 +20)');
    }
  };
  G.loadSave = () => { try { return JSON.parse(localStorage.getItem(saveKey())); } catch (e) { return null; } };
  G.deleteSave = () => { try { localStorage.removeItem(saveKey()); } catch (e) { /* 없음 */ } };
  const endKey = () => 'seventh_endings_' + (Auth.user ? Auth.user.id : 'guest');
  G.endings = () => { try { return JSON.parse(localStorage.getItem(endKey())) || []; } catch (e) { return []; } };

  // ---------- 새로 시작 / 이어하기 ----------
  G.reset = save => {
    G.enemies.forEach(e => e.remove());
    G.enemies = [];
    G.items.forEach(r => scene.remove(r.mesh));
    G.items = [];
    bursts.forEach(b => scene.remove(b.s)); bursts.length = 0;
    bossE = null; UI.boss(null);
    UI.clearDialog(); UI.closeDoc();
    if (scareCur) { camera.remove(scareCur); scareCur = null; }
    G.P = freshPlayer();
    const p = G.P;
    if (save) {
      Object.assign(p, JSON.parse(JSON.stringify(save.P)));
      p.pitch = 0;
      recalc();
      p.sta = p.maxSta;
    }
    World.doors.forEach(d => {
      d.open = false; d.t = 0; d.panel.position.x = 0; d.lock = d.baseLock;
      if (d.chain) d.chain.visible = true;
    });
    if (save) save.doors.forEach(sd => {
      const d = World.door(sd.id);
      if (!d) return;
      d.lock = sd.lock === 'key_broad_done' ? null : sd.lock;
      if (!d.lock && d.chain) d.chain.visible = false;
      if (sd.open) { d.open = true; d.t = 1; d.panel.position.x = 1.9; }
    });
    G.interactables = World.interact.slice();
    Story.reset(save);
    Story.ITEMS.forEach(it => {
      if (p.taken.includes(it.id)) return;
      G.placeItem(it);
    });
    if (Story.flags.pianistDead && !p.taken.includes('key_broad') && !p.keys.includes('key_broad')) G.placeItem({ id: 'key_broad', kind: 'key', x: 50.5, y: 0.05, z: 3.4, label: '작은 손이 쥐고 있던 열쇠' });
    if (Story.flags.bossDead && !Story.flags.finalChoice) G.placeItem({ id: 'book2', kind: 'book2', x: 54.5, y: 0.05, z: 22, label: '출석부' });
    Story.respawnGroups();
    roamT = 60; directorT = 30;
    fx.dmg = fx.scare = fx.glitch = fx.shake = 0;
    drawPhone();
    UI.hud(p);
  };
  G.newGame = () => {
    G.reset(null);
    G.state = 'intro';
    UI.show('introScreen');
    const box = $('introText');
    box.innerHTML = '';
    const lines = Story.intro();
    let i = 0;
    const step = () => {
      if (G.state !== 'intro') return;
      if (i >= lines.length) { introT = setTimeout(G.skipIntro, 1800); return; }
      const p = document.createElement('p');
      p.textContent = lines[i];
      box.appendChild(p);
      if (lines[i].startsWith('딩')) Sound.bell(true);
      i++;
      introT = setTimeout(step, i === 5 ? 3200 : 2300);
    };
    introT = setTimeout(step, 800);
  };
  let introT = null;
  G.skipIntro = () => {
    if (G.state !== 'intro') return;
    clearTimeout(introT);
    G.state = 'play';
    UI.show('game');
    $('fade').style.transition = 'none'; $('fade').style.opacity = 1;
    const p = G.P;
    p.cine = 3.2; p.eye = 1.05; p.pitch = -1.0;
    $('eyelids').className = 'blink';
    setTimeout(() => { UI.fade(0, 1500); }, 50);
    G.lock();
    Sound.startAmbient();
    Sound.setTension(0);
    G.later(3.3, () => Story.wake());
  };
  G.continueGame = () => {
    const s = G.loadSave();
    if (!s) return G.newGame();
    G.reset(s);
    G.state = 'play';
    UI.show('game');
    $('fade').style.opacity = 1;
    UI.fade(0, 1200);
    Sound.startAmbient();
    Story.refreshQuest();
    G.lock();
    if (G.P.hasPhone) G.setLight(true);
    UI.big('기록에서 이어서', 1.6, 'save');
  };
  G.later = (s, fn) => Story.later(s, fn);
  G.say = (s, t, sec) => UI.sub(s, t, sec);
  G.dialog = lines => UI.dialog(lines);
  G.inRoom = id => { const r = World.roomAt(G.P.x, G.P.z); return r && r.id === id; };

  // ---------- 죽음 / 엔딩 ----------
  function die() {
    const p = G.P;
    p.dead = true; p.hp = 0;
    G.state = 'dead';
    G.unlock();
    Sound.scream();
    Sound.setTension(0);
    fx.dmg = 1;
    setTimeout(() => {
      UI.show('death');
      $('deathStats').textContent = `Lv.${p.level} · 처치 ${p.kills} · ${G.timeStr()}`;
      $('retryBtn').style.display = G.hasSave() ? '' : 'none';
    }, 1400);
  }
  let endLines = [], endI = 0, endKind = null, endTimer = null;
  G.endGame = kind => {
    endKind = kind;
    G.state = 'ending';
    G.unlock();
    Sound.setTension(0);
    const E = Story.ENDINGS[kind];
    const list = G.endings();
    if (!list.includes(kind)) { list.push(kind); try { localStorage.setItem(endKey(), JSON.stringify(list)); } catch (e) { /* 없음 */ } }
    if (kind !== 'stay') G.deleteSave();
    UI.fade(1, 1500).then(() => {
      UI.show('ending');
      $('fade').style.opacity = 0;
      $('endText').innerHTML = '';
      $('endCard').classList.remove('show');
      endLines = E.lines; endI = 0;
      if (kind === 'free') Sound.bell(false);
      if (kind === 'stay') Sound.bell(true);
      G.endingNext();
    });
  };
  G.endingNext = () => {
    clearTimeout(endTimer);
    if (endI < endLines.length) {
      const p = document.createElement('p');
      p.textContent = UI.fill(endLines[endI]);
      $('endText').appendChild(p);
      endI++;
      endTimer = setTimeout(G.endingNext, 2600);
      return;
    }
    if ($('endCard').classList.contains('show')) return;
    const E = Story.ENDINGS[endKind], p = G.P;
    $('endNo').textContent = `엔딩 ${E.no} / 3`;
    $('endTitle').textContent = E.title;
    $('endSub').textContent = E.sub;
    $('endStats').innerHTML = `Lv.${p.level} · 처치 ${p.kills} · 일지 ${p.docs.length}/5 · ${G.timeStr()}<br>모은 엔딩 ${G.endings().length} / 3`;
    $('endRetry').style.display = endKind === 'stay' && G.hasSave() ? '' : 'none';
    $('endHint').textContent = endKind === 'free' ? '' : endKind === 'tear' ? '서하의 이름을 찾아 주면, 다른 결말이 기다리고 있다.' : '절대, 대답하지 마.';
    $('endCard').classList.add('show');
    if (endKind === 'stay') G.scare('teacher', true);
  };
  G.toMenu = () => {
    G.state = 'menu';
    G.unlock();
    G.reset(null);
    Sound.setTension(0);
    UI.boss(null);
    Main.showMenu();
  };

  // ---------- 매 프레임 ----------
  let last = performance.now(), hudT = 0, roamT = 60, directorT = 30, heartT = 0, stepAcc = 0, bob = 0, phoneT = 0, flowTimer = 0;
  const camPos = new THREE.Vector3(), camDir = new THREE.Vector3();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    clock.t += dt;
    const t = clock.t;
    if (G.state === 'menu' || G.state === 'boot') menuUpdate(dt, t);
    else if (G.state === 'play') playUpdate(dt, t);
    else if (G.state === 'pause' || G.state === 'inv' || G.state === 'dead') {
      World.update(t, 0, G.P.x, G.P.z, World.roomAt(G.P.x, G.P.z));
      if (G.state === 'dead') { camera.position.y += (0.3 - camera.position.y) * dt * 2; camera.rotation.z += dt * 0.3; }
    }
    updateFX(dt, t);
    render(t);
  }

  let hintShown = false;
  function playUpdate(dt, t) {
    const p = G.P;
    const needClick = !G.locked() && p.cine <= 0;
    if (needClick !== hintShown) { hintShown = needClick; $('clickHint').classList.toggle('show', needClick); }
    UI.tickDialog(dt);
    const frozen = UI.inDialog() || UI.docOpen();
    if (hitstop > 0) { hitstop -= dt; dt *= 0.1; }
    if (!frozen) {
      p.time += dt;
      updatePlayer(dt, t);
      flowTimer -= dt;
      if (flowTimer <= 0) { flowTimer = 0.3; computeFlow(); }
      lightHits(dt);
      G.enemies.forEach(e => e.update(dt, t));
      for (let i = G.enemies.length - 1; i >= 0; i--) if (G.enemies[i].gone) G.enemies.splice(i, 1);
      separate();
      Story.update(dt, t);
      director(dt, t);
      roaming(dt);
      sanity(dt, t);
    }
    const room = World.roomAt(p.x, p.z);
    World.update(t, dt, p.x, p.z, room);
    // 촛불 빛
    let near = null, nd = 9;
    G.items.forEach(r => { if (r.def.kind === 'candle') { const d = Math.hypot(r.def.x - p.x, r.def.z - p.z); if (d < nd) { nd = d; near = r; } } });
    if (near) {
      candleLight.position.set(near.def.x, near.def.y + 0.3, near.def.z);
      candleLight.intensity = 0.9 + Math.sin(t * 13) * 0.1 + Math.sin(t * 7.1) * 0.12;
      near.mesh.userData.flame.scale.y = 0.14 + Math.sin(t * 17) * 0.02;
    } else candleLight.intensity = 0;
    // 물건 반짝임
    G.items.forEach(r => { const gl = r.mesh.userData.glow; if (gl) gl.material.opacity = 0.35 + Math.sin(t * 2.5) * 0.15; });
    // 조사 대상
    looking = frozen || p.cine > 0 ? null : findTarget();
    UI.prompt(looking ? `<kbd>E</kbd> ${esc(promptFor(looking) || '')}` : '');
    if (!promptFor(looking)) UI.prompt('');
    // 보스 체력
    if (bossE) { UI.boss(bossE.def.name, bossE.hp / bossE.maxHp); if (bossE.dead) G.boss(null); }
    hudT -= dt;
    if (hudT <= 0) { hudT = 0.1; UI.hud(p); }
    phoneT -= dt;
    if (phoneT <= 0) { phoneT = 1; drawPhone(); }
    // 긴장 음악
    const chasing = G.enemies.filter(e => !e.dead && e.state !== 'idle' && e.dist < 14).length;
    Sound.setTension(Math.min(1, chasing * 0.45 + (bossE ? 0.5 : 0)));
    Sound.setListener(p.x, p.z, p.yaw);
    // 심장 소리
    const nearest = G.enemies.reduce((m, e) => (!e.dead && e.dist < m ? e.dist : m), 99);
    const fear = Math.max(0, 1 - nearest / 9) + (1 - p.san / p.maxSan) * 0.4;
    heartT -= dt;
    if (fear > 0.25 && heartT <= 0) { heartT = 1.1 - Math.min(0.65, fear * 0.6); Sound.heartbeat(Math.min(1, fear)); }
    updateCamera(dt, t);
  }

  function updatePlayer(dt, t) {
    const p = G.P;
    if (p.cine > 0) {
      p.cine -= dt;
      const k = 1 - Math.max(0, p.cine) / 3.2;
      p.eye = 1.05 + Math.max(0, k - 0.45) / 0.55 * 0.55;
      p.pitch = -1.0 + Math.min(1, k * 1.4) * 0.95;
      return;
    }
    // 이동
    let mx = 0, mz = 0;
    if (keys.KeyW || keys.ArrowUp) mz -= 1;
    if (keys.KeyS || keys.ArrowDown) mz += 1;
    if (keys.KeyA || keys.ArrowLeft) mx -= 1;
    if (keys.KeyD || keys.ArrowRight) mx += 1;
    const ml = Math.hypot(mx, mz);
    const wantRun = (keys.ShiftLeft || keys.ShiftRight) && mz < 0 && p.sta > 1 && !p.crouch;
    if (keys.ShiftLeft && p.crouch && ml) p.crouch = false;
    let sp = p.crouch ? 1.35 : wantRun ? 4.7 : 2.6;
    if (p.atkT > 0) sp *= 0.6;
    if (p.focus) sp *= 0.75;
    let wx = 0, wz = 0;
    if (ml) {
      mx /= ml; mz /= ml;
      const s = Math.sin(p.yaw), c = Math.cos(p.yaw);
      wx = mx * c + mz * s; wz = -mx * s + mz * c;
    }
    const acc = 12;
    p.vx += (wx * sp - p.vx) * Math.min(1, dt * acc);
    p.vz += (wz * sp - p.vz) * Math.min(1, dt * acc);
    const pos = { x: p.x + p.vx * dt, z: p.z + p.vz * dt };
    World.collide(pos, 0.3, true);
    const moved = Math.hypot(pos.x - p.x, pos.z - p.z);
    p.speed = moved / Math.max(dt, 1e-4);
    p.x = pos.x; p.z = pos.z;
    // 기력
    const running = wantRun && ml > 0 && p.speed > 3;
    if (running) { p.sta = Math.max(0, p.sta - 17 * dt); p.staDelay = 0.8; }
    else { p.staDelay -= dt; if (p.staDelay <= 0) p.sta = Math.min(p.maxSta, p.sta + 26 * dt); }
    p.noise = Math.max(0, p.noise - dt * 10);
    if (p.speed > 0.3) p.noise = Math.max(p.noise, running ? 10 : p.crouch ? 0 : 3.5);
    // 발소리, 흔들림
    stepAcc += moved;
    bob += moved * (running ? 2.2 : 2.6);
    const stride = running ? 0.85 : p.crouch ? 0.7 : 0.75;
    if (stepAcc > stride) { stepAcc = 0; if (!p.crouch || Math.random() < 0.3) Sound.step(World.floorType(p.x, p.z), running); }
    const targetEye = p.crouch ? 1.05 : 1.6;
    p.eye += (targetEye - p.eye) * Math.min(1, dt * 8);
    // 손전등
    p.focus = mouseR && p.lightOn && p.bat > 0;
    if (p.lightOn) {
      p.bat = Math.max(0, p.bat - dt * (0.42 + (p.focus ? 3.2 : 0)));
      if (p.bat <= 0) { p.lightOn = false; UI.sub('', '휴대폰 배터리가 나갔다…', 2.5); Sound.flash(false); drawPhone(); }
    }
    // 공격
    if (p.atkT > 0) {
      const w = G.WEAPONS[p.weapon];
      p.atkT -= dt;
      if (!p.atkHit && 1 - p.atkT / w.time > 0.35) { p.atkHit = true; doHit(); }
    }
    p.hurtT = Math.max(0, p.hurtT - dt);
  }

  function sanity(dt, t) {
    const p = G.P;
    let drain = 0;
    G.enemies.forEach(e => { if (!e.dead && e.dist < 7 && e.los) drain += 2.2; });
    const room = World.roomAt(p.x, p.z);
    const litNear = World.fixtures.some(f => f.level > 0.5 && Math.hypot(f.x - p.x, f.z - p.z) < 4);
    if (!p.lightOn && !litNear) drain += 0.35;
    if (World.mode === 'red') drain += 0.5;
    drain *= 1 - Math.min(0.5, p.stats.wil * 0.06);
    const candle = G.items.some(r => r.def.kind === 'candle' && Math.hypot(r.def.x - p.x, r.def.z - p.z) < 3);
    if (drain === 0) p.san = Math.min(p.maxSan, p.san + dt * (candle ? 4 : room && room.id === 'nurse' ? 1.2 : 0.25));
    p.san = Math.max(0, p.san - drain * dt);
    if (p.san <= 0) { p.hp -= dt * 2; if (p.hp <= 0) die(); }
    // 헛것
    const low = 1 - p.san / p.maxSan;
    if (low > 0.6 && phantomT <= 0 && Math.random() < dt * 0.08 * low) showPhantom(1.2);
    if (low > 0.55 && Math.random() < dt * 0.04 * low) { Sound.whisper(1.8); if (Math.random() < 0.4) UI.sub('', ['…뒤에.', '31번…', '자리에 앉아.', '대답해.', '왜 나만 두고 갔어?'][Math.random() * 5 | 0], 2); }
  }
  function showPhantom(sec) {
    const p = G.P, f = fwd();
    for (let i = 0; i < 10; i++) {
      const side = Math.random() < 0.5 ? -1 : 1, a = p.yaw + side * (0.35 + Math.random() * 0.35), r = 6 + Math.random() * 6;
      const x = p.x - Math.sin(a) * r, z = p.z - Math.cos(a) * r;
      if (World.isSolid(Math.floor(x), Math.floor(z)) || !World.los(p.x, p.z, x, z)) continue;
      phantom.group.position.set(x, 0, z);
      phantom.group.rotation.y = Math.atan2(p.x - x, p.z - z);
      phantom.group.visible = true;
      phantomT = sec;
      return;
    }
  }

  // 등 뒤에서 일어나는 일들 (가끔)
  let lastEvent = -1;
  function director(dt, t) {
    const p = G.P;
    directorT -= dt;
    if (directorT > 0 || bossE || !Story.flags.d23open) return;
    directorT = 28 + Math.random() * 40;
    let k;
    do { k = Math.random() * 8 | 0; } while (k === lastEvent);
    lastEvent = k;
    const a = Math.random() * Math.PI * 2, far = { x: p.x + Math.cos(a) * 12, z: p.z + Math.sin(a) * 12 };
    if (k === 0) Sound.thumps(8);
    if (k === 1) Sound.shriek(far);
    if (k === 2) { const d = World.doors.slice().sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[1]; if (d) Sound.knock({ x: d.x + 1, z: d.z + 0.5 }, 3); }
    if (k === 3) Sound.whisper(2.2);
    if (k === 4) Sound.giggle(far);
    if (k === 5) { const prev = World.mode; World.mode = 'dark'; Sound.static(0.5, 0.15); G.later(0.7, () => { if (World.mode === 'dark') World.mode = prev === 'dark' ? 'normal' : prev; }); }
    if (k === 6) showPhantom(1.4);
    if (k === 7) { Sound.vibrate(); UI.sub('', '휴대폰이 떨린다. 발신자: 31', 2.5); }
  }
  // 복도를 떠도는 귀신
  function roaming(dt) {
    const f = Story.flags, p = G.P;
    if (!f.metSeoha || bossE) return;
    roamT -= dt;
    if (roamT > 0) return;
    roamT = 45 + Math.random() * 35;
    const alive = G.enemies.filter(e => !e.dead && !e.id).length;
    if (alive >= 2) return;
    const room = World.roomAt(p.x, p.z);
    if (room && room.id === 'nurse') return;
    for (let i = 0; i < 20; i++) {
      const x = 2 + Math.random() * 59, z = 12.5 + Math.random() * 3;
      if (Math.hypot(x - p.x, z - p.z) < 14 || World.los(p.x, p.z, x, z)) continue;
      G.spawn(Math.random() < 0.7 ? 'shadow' : 'crawler', x, z, { rise: true });
      return;
    }
  }
  function separate() {
    const L = G.enemies;
    for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
      const a = L[i], b = L[j];
      if (a.dead || b.dead) continue;
      const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz), m = a.def.radius + b.def.radius;
      if (d < m && d > 0.001) { const push = (m - d) / 2; a.x -= dx / d * push; a.z -= dz / d * push; b.x += dx / d * push; b.z += dz / d * push; }
    }
    // 플레이어와도
    const p = G.P;
    L.forEach(e => {
      if (e.dead) return;
      const dx = p.x - e.x, dz = p.z - e.z, d = Math.hypot(dx, dz), m = 0.3 + e.def.radius;
      if (d < m && d > 0.001) { e.x -= dx / d * (m - d); e.z -= dz / d * (m - d); }
    });
  }

  function updateCamera(dt, t) {
    const p = G.P;
    const sh = fx.shake * 0.05;
    const run = p.speed > 3.5;
    const bobY = Math.sin(bob * 2) * (run ? 0.045 : 0.025) * Math.min(1, p.speed / 2);
    camera.position.set(p.x + (Math.random() - 0.5) * sh, p.eye + bobY + (Math.random() - 0.5) * sh, p.z + (Math.random() - 0.5) * sh);
    const low = 1 - p.san / p.maxSan;
    camera.rotation.set(p.pitch + (Math.random() - 0.5) * sh * 0.5, p.yaw, Math.sin(bob) * 0.008 * Math.min(1, p.speed / 2) + Math.sin(t * 0.7) * 0.03 * low * low);
    const fov = 72 + (run ? 5 : 0) - (p.focus ? 4 : 0);
    if (Math.abs(camera.fov - fov) > 0.05) { camera.fov += (fov - camera.fov) * Math.min(1, dt * 6); camera.updateProjectionMatrix(); }
    // 손에 든 것
    const w = G.WEAPONS[p.weapon];
    Object.keys(weaponModels).forEach(k => { weaponModels[k].visible = k === p.weapon; });
    weaponPivot.visible = p.weapon !== 'hands';
    let swing = 0;
    if (p.atkT > 0) {
      const k = 1 - p.atkT / w.time;   // 뒤로 젖힘 → 내려침 → 돌아옴
      swing = k < 0.3 ? -k / 0.3 * 0.5 : k < 0.55 ? -0.5 + (k - 0.3) / 0.25 * 1.6 : 1.1 * (1 - (k - 0.55) / 0.45);
    }
    weaponPivot.position.set(0.27 + Math.sin(bob) * 0.012 - swing * 0.12, -0.3 + Math.abs(Math.cos(bob)) * 0.012, -0.42 - Math.max(0, swing) * 0.08);
    weaponPivot.rotation.set(-0.15 - swing * 0.8, 0.1 + swing * 0.6, swing * 0.4);
    phoneMesh.visible = p.hasPhone;
    phoneMesh.position.set(-0.24 + Math.sin(bob + 1) * 0.008, -0.25 + Math.abs(Math.cos(bob + 1)) * 0.008 + (p.focus ? 0.04 : 0), -0.42 + (p.focus ? -0.06 : 0));
    // 손전등 세기
    const flick = p.bat < 15 ? (Math.random() < 0.08 ? 0.2 : 1) : 1;
    const fearFlick = (1 - p.san / p.maxSan) > 0.7 && Math.random() < 0.03 ? 0.1 : 1;
    const on = p.lightOn && p.hasPhone;
    spot.intensity = on ? (p.focus ? 3.0 : 1.75) * flick * fearFlick : 0;
    spot.angle += ((p.focus ? 0.3 : 0.55) - spot.angle) * Math.min(1, dt * 8);
    spot.distance = p.focus ? 30 : 24;
    beam.material.uniforms.uA.value = on ? (p.focus ? 0.05 : 0.025) * flick : 0;
    beam.scale.setScalar(p.focus ? 0.6 : 1);
    playerGlow.intensity = 0.12;
  }

  function updateFX(dt, t) {
    fx.dmg = Math.max(0, fx.dmg - dt * 1.6);
    fx.scare = Math.max(0, fx.scare - dt * 1.5);
    fx.glitch = Math.max(0, fx.glitch - dt * 1.2);
    fx.shake = Math.max(0, fx.shake - dt * 2.2);
    if (scareCur) {
      scareT -= dt;
      const k = 1 - scareT / 0.75;
      scareCur.scale.setScalar(0.6 + Math.min(1, k * 6) * 0.55);
      scareCur.position.x = (Math.random() - 0.5) * 0.05;
      scareCur.position.y = -0.02 + (Math.random() - 0.5) * 0.04;
      if (scareT <= 0) { camera.remove(scareCur); scareCur = null; }
    }
    if (phantom.group.visible && G.state === 'play') {
      phantomT -= dt;
      const p = G.P, dx = phantom.group.position.x - p.x, dz = phantom.group.position.z - p.z, d = Math.hypot(dx, dz);
      const f = fwd(), dot = (dx * f.x + dz * f.z) / (d || 1);
      if (phantomT <= 0 || (dot > 0.97 && phantomT < 1.0) || d < 3) { phantom.group.visible = false; if (dot > 0.9) G.glitch(0.25); }
      phantom.head.rotation.z = Math.sin(t * 20) * 0.1;
    }
    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i];
      b.life -= dt;
      b.s.position.x += b.vx * dt; b.s.position.y += b.vy * dt; b.s.position.z += b.vz * dt;
      b.vy -= dt * 1.5;
      if (b.life <= 0) { scene.remove(b.s); bursts.splice(i, 1); }
    }
    // 화면 효과 값
    const p = G.P;
    const u = postMat.uniforms;
    u.uTime.value = t;
    u.uSan.value = G.state === 'play' || G.state === 'pause' || G.state === 'inv' || G.state === 'dead' ? p.san / p.maxSan : 1;
    u.uDmg.value = fx.dmg;
    u.uScare.value = fx.scare;
    u.uGlitch.value = Math.max(fx.glitch, World.mode === 'red' ? 0.05 : 0);
    u.uBright.value = G.settings.bright;
    u.uRed.value += ((World.mode === 'red' ? 1 : 0) - u.uRed.value) * Math.min(1, dt * 2);
    u.uLowHp.value = G.state === 'play' ? Math.max(0, 1 - p.hp / p.maxHp / 0.35) : 0;
    u.uFocus.value = p.focus ? 1 : 0;
    // 먼지
    camera.getWorldPosition(camPos);
    camera.getWorldDirection(camDir);
    dust.material.uniforms.uCam.value.copy(camPos);
    dust.material.uniforms.uDir.value.copy(camDir);
    dust.material.uniforms.uTime.value = t;
    dust.material.uniforms.uLight.value = (p.lightOn && p.hasPhone && G.state !== 'menu') ? (p.focus ? 1.4 : 1) : 0;
  }

  function render() {
    renderer.setRenderTarget(rt);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(postScene, postCam);
  }

  // ---------- 메뉴 배경 (복도를 천천히 걷는 카메라) ----------
  let menuGhostT = 4;
  function menuUpdate(dt, t) {
    const x = 6 + (t * 0.35) % 40;
    camera.position.set(x, 1.55 + Math.sin(t * 1.3) * 0.02, 14 + Math.sin(t * 0.2) * 0.3);
    camera.rotation.set(-0.02 + Math.sin(t * 0.3) * 0.02, -Math.PI / 2 + Math.sin(t * 0.15) * 0.15, 0);
    World.update(t, dt, x, 14, World.room('hall'));
    menuGhostT -= dt;
    if (menuGhostT <= 0) {
      menuGhostT = 6 + Math.random() * 6;
      phantom.group.position.set(x + 9 + Math.random() * 4, 0, 13.2 + Math.random() * 1.6);
      phantom.group.rotation.y = -Math.PI / 2;
      phantom.group.visible = true;
      phantomT = 0.4 + Math.random() * 0.6;
    }
    if (phantom.group.visible) {
      phantomT -= dt;
      if (phantomT <= 0) phantom.group.visible = false;
    }
    spot.intensity = 0;
    beam.material.uniforms.uA.value = 0;
    phoneMesh.visible = false;
    Object.keys(weaponModels).forEach(k => { weaponModels[k].visible = false; });
    candleLight.intensity = 0;
  }

  // 자동 점검용 (콘솔에서 쓸 수 있음)
  G.debug = {
    attack, interact, take, showPhantom, findTarget: () => findTarget(),
    measure: () => { const i = renderer.info; i.autoReset = false; i.reset(); renderer.setRenderTarget(rt); renderer.render(scene, camera); renderer.setRenderTarget(null); const r = Object.assign({}, i.render, { programs: i.programs.length, tex: i.memory.textures, geo: i.memory.geometries }); i.autoReset = true; return r; },
    step: (sec) => { for (let i = 0; i < sec * 20; i++) { clock.t += 0.05; if (G.state === 'play') playUpdate(0.05, clock.t); updateFX(0.05, clock.t); scene.updateMatrixWorld(); } return G.P.time; },
  };

  G.applySettings = () => {
    Sound.setVolume(G.settings.vol);
    try { localStorage.setItem('seventh_settings', JSON.stringify(G.settings)); } catch (e) { /* 없음 */ }
  };

  return G;
})();
