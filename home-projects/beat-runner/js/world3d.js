'use strict';
/* 도트 3D 세계 (Three.js)
 * - 나무·바위·수정·집·성 같은 배경을 진짜 3D 모양으로 만들고, 480x270 작은 화면에 그린 뒤 그대로 키워서 '도트 3D' 로 보여요.
 * - 겉면에는 코드로 그린 도트 무늬(풀·흙·돌·나무껍질·잎·벽·지붕)를 입혀요.
 * - 풀잎과 나뭇잎은 바람에 흔들리고, 반딧불·포자·불티가 3D 공간을 떠다녀요.
 * - 도트 효과: 가장자리 테두리 + 위쪽 가장자리 빛 + 밝은 곳 번짐 + 장소별 색감 + 색 단계 줄이기와 점묘.
 * - 캐릭터·적·글자는 그 위의 Phaser 화면(투명)에 도트 그림으로 그려요. (HD-2D 방식)
 * - 3D 를 쓸 수 없는 컴퓨터에서는 예전 2.5D 배경으로 그려요. */

const W3 = {
  tried: false, ready: false,
  CH: 24,                      // 땅 조각 하나의 가로 길이
  H: 5, D: 16, FOV: 36,        // 카메라 높이, 거리, 시야각
  uTime: { value: 0 },         // 흔들림용 시간 (모든 흔들리는 재료가 같이 써요)

  init() {
    if (this.tried) return this.ready;
    this.tried = true;
    if (typeof THREE === 'undefined') return false;
    if (Store.data.settings.use3d === false || /[?&]no3d/.test(location.search)) return false;   // 설정에서 3D 를 끄면 2.5D 로
    try {
      const cv = document.getElementById('world3d');
      const r = this.r = new THREE.WebGLRenderer({ canvas: cv, antialias: false, powerPreference: 'high-performance' });
      this.RS = (Store.data.settings.hd3d === false || /[?&]dot3d/.test(location.search)) ? 1 : 2;     // 3D 화질: 2 = 고화질(960x540), 1 = 도트(480x270)
      r.setPixelRatio(1); r.setSize(GW * this.RS, GH * this.RS, false);
      r.shadowMap.enabled = true; r.shadowMap.type = THREE.BasicShadowMap;   // 딱딱한 도트 그림자
      this.rt = new THREE.WebGLRenderTarget(GW * this.RS, GH * this.RS, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
      this.rt.depthTexture = new THREE.DepthTexture(GW * this.RS, GH * this.RS);
      this.scene = new THREE.Scene();
      this.cam = new THREE.PerspectiveCamera(this.FOV, GW / GH, 0.5, 700);
      // 주인공이 달리는 줄(z=0)이 화면 높이 214 에 오도록 카메라가 내려다보는 높이를 계산
      const half = Math.tan(this.FOV / 2 * Math.PI / 180);
      const want = (GROUND - GH / 2) / (GH / 2);
      const phi = Math.atan(this.H / this.D), delta = Math.atan(want * half), theta = phi - delta;
      this.Ly = this.H - this.D * Math.tan(theta);
      this.PXU = GH / (2 * half * Math.hypot(this.H, this.D) * Math.cos(delta));   // 깊이 0 에서 1칸 = 몇 픽셀
      this.post = this.makePost();
      this.camX = 0; this.t = 0; this.theme = null; this.chunks = new Map();
      this.ready = true;
    } catch (e) { console.warn('3D 를 쓸 수 없어 2.5D 로 그려요', e); this.ready = false; }
    return this.ready;
  },

  /* ---------- 도트 효과 (후처리) ---------- */
  makePost() {
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        tColor: { value: this.rt.texture }, tDepth: { value: this.rt.depthTexture }, uRes: { value: new THREE.Vector2(GW * this.RS, GH * this.RS) },
        uNear: { value: 0.5 }, uFar: { value: 700 }, uPulse: { value: 0 }, uScale: { value: this.RS },
        uTint: { value: new THREE.Vector3(1, 1, 1) }, uSat: { value: 1 }, uBloom: { value: 0.6 },
        uSun: { value: new THREE.Vector2(0.7, 0.9) }, uSunOn: { value: 0 }, uRayCol: { value: new THREE.Vector3(1, 0.95, 0.8) }, uDof: { value: 1 }, uFlash: { value: 0 },
      },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `
        uniform sampler2D tColor; uniform sampler2D tDepth; uniform vec2 uRes, uSun; uniform vec3 uTint, uRayCol;
        uniform float uNear, uFar, uPulse, uSat, uBloom, uScale, uSunOn, uDof, uFlash;
        varying vec2 vUv;
        float lin(float d) { float z = d * 2.0 - 1.0; return 2.0 * uNear * uFar / (uFar + uNear - z * (uFar - uNear)); }
        float dep(vec2 o) { return lin(texture2D(tDepth, vUv + o).x); }
        float b2(vec2 v) { v = floor(v); return fract(v.x * 0.5 + v.y * v.y * 0.75); }
        float bayer(vec2 v) { return b2(0.5 * v) * 0.25 + b2(v); }
        void main() {
          vec2 px = 1.0 / uRes, sp = px * uScale;        // sp: 도트 1칸 크기 (화질과 상관없이 같은 크기로 효과가 보여요)
          vec3 c = texture2D(tColor, vUv).rgb;
          float d = dep(vec2(0.0));
          // 1) 멀리 있는 풍경은 살짝 흐리게 (피사계 심도)
          float fb = clamp((d - 55.0) / 90.0, 0.0, 1.0) * uDof;
          if (fb > 0.01) {
            vec3 acc = c;
            for (int i = 0; i < 8; i++) { float a = float(i) * 0.785398; acc += texture2D(tColor, vUv + vec2(cos(a), sin(a)) * sp * 1.6).rgb; }
            c = mix(c, acc / 9.0, fb);
          }
          // 2) 밝은 곳 번짐 (두 겹: 가까이 + 넓게)
          vec3 bl = vec3(0.0);
          for (int i = 0; i < 8; i++) {
            float a = float(i) * 0.785398;
            vec2 o = vec2(cos(a), sin(a));
            bl += max(texture2D(tColor, vUv + o * sp * 2.5).rgb - 0.66, 0.0);
            bl += max(texture2D(tColor, vUv + o * sp * 6.0).rgb - 0.7, 0.0) * 0.6;
          }
          c += bl * uBloom * 0.16;
          // 3) 물체가 맞닿은 곳은 살짝 어둡게 (그늘, AO)
          float occ = 0.0;
          for (int i = 0; i < 8; i++) {
            float a = float(i) * 0.785398 + 0.39;
            float nd = dep(vec2(cos(a), sin(a)) * sp * 3.0);
            occ += clamp((d - nd - 0.12) / 1.4, 0.0, 1.0) * step(d - nd, 3.5);
          }
          c *= 1.0 - occ / 8.0 * 0.5 * (1.0 - smoothstep(28.0, 70.0, d));
          // 4) 옆·아래 가장자리 어두운 테두리 / 위쪽 가장자리 빛
          float fade = 1.0 - smoothstep(60.0, 160.0, d);
          float thr = 0.13 * d + 0.6;
          float side = max(max(dep(vec2(sp.x, 0.0)), dep(vec2(-sp.x, 0.0))), dep(vec2(0.0, -sp.y)));
          float up = dep(vec2(0.0, sp.y));
          float edge = step(thr, side - d) * fade;
          float rim = step(thr, up - d) * fade * (1.0 - edge);
          c = mix(c, c * 0.45, edge * 0.8);
          c = mix(c, c * 1.3 + 0.035, rim * 0.65);
          // 5) 빛내림: 해(달)에서 나무와 구름 사이로 빛줄기가 내려와요
          if (uSunOn > 0.01) {
            vec2 dv = (uSun - vUv) / 16.0; vec2 p = vUv; float il = 1.0, acc = 0.0;
            for (int i = 0; i < 16; i++) { p += dv; acc += step(400.0, lin(texture2D(tDepth, clamp(p, 0.001, 0.999)).x)) * il; il *= 0.94; }
            float fall = 1.0 - smoothstep(0.0, 0.95, length((vUv - uSun) * vec2(1.6, 1.0)));
            c += uRayCol * (acc / 16.0) * fall * uSunOn * 0.55;
          }
          // 6) 장소별 색감 + 번개
          float l = dot(c, vec3(0.299, 0.587, 0.114));
          c = mix(vec3(l), c, uSat) * uTint;
          c *= 1.0 + uPulse * 0.05;
          c += vec3(0.75, 0.8, 1.0) * uFlash;
          // 7) 색 단계 줄이기 + 점묘 (고화질에서는 더 곱게)
          float lv = uScale > 1.5 ? 40.0 : 22.0;
          c = floor(c * lv + 0.5 + (bayer(gl_FragCoord.xy) - 0.5) * 0.75) / lv;
          gl_FragColor = vec4(c, 1.0);
        }`,
      depthTest: false, depthWrite: false,
    });
    const scene = new THREE.Scene();
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));
    return { scene, cam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), mat };
  },

  /* ---------- 화질 바꾸기 (게임 도중에도) ---------- */
  setRS(k) {
    if (k === this.RS) return;
    this.RS = k;
    const W = GW * k, H = GH * k, old = this.rt;
    this.r.setSize(W, H, false);
    this.rt = new THREE.WebGLRenderTarget(W, H, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
    this.rt.depthTexture = new THREE.DepthTexture(W, H);
    old.depthTexture.dispose(); old.dispose();
    const u = this.post.mat.uniforms;
    u.tColor.value = this.rt.texture; u.tDepth.value = this.rt.depthTexture; u.uRes.value.set(W, H); u.uScale.value = k;
    syncWorldCanvas();
  },
  // 고화질이 버거운 컴퓨터면 (몇 초 동안 계속 느리면) 이번 판은 도트 화질로 자동으로 낮춰요
  watchSpeed() {
    const now = performance.now(), F = this._fps || (this._fps = { last: now, n: 0, sum: 0, skip: 40 });
    const ms = now - F.last; F.last = now;
    if (F.skip > 0) { F.skip--; return; }
    if (this.RS < 2 || ms > 250) return;            // 탭 전환 같은 큰 멈춤은 빼요
    F.n++; F.sum += ms;
    if (F.n >= 120) {
      const fps = 1000 / (F.sum / F.n);
      if (fps < 46) { this.setRS(1); console.info('3D 화질을 자동으로 도트로 낮췄어요 (fps ' + fps.toFixed(0) + ')'); }
      F.n = 0; F.sum = 0;
    }
  },

  /* ---------- 보이기 / 숨기기 ---------- */
  show(id, o = {}) {
    if (!this.ready) return;
    const cv = this.r.domElement;
    cv.style.display = 'block';
    syncWorldCanvas();
    this.orbit = (o.orbit != null ? o.orbit : 14) * 0.22 * Math.PI / 180;
    this.shiftY = o.shiftY || 0;
    if (this.shiftY) this.cam.setViewOffset(GW, GH, 0, this.shiftY, GW, GH);   // (화면 비율 단위라 화질과 상관없어요) else this.cam.clearViewOffset();
    if (this.theme !== id) this.setTheme(id);
  },
  hide() { if (this.ready) this.r.domElement.style.display = 'none'; },

  /* ---------- 도트 무늬 (64x64, 회색조 → 재료 색과 곱해져요) ---------- */
  tex(name) {
    this._tex = this._tex || {};
    if (this._tex[name]) return this._tex[name];
    const S = 64, cv = document.createElement('canvas'); cv.width = cv.height = S;
    const c = cv.getContext('2d'), img = c.createImageData(S, S), d = img.data;
    const r = mulberry32(name.length * 131 + name.charCodeAt(0) * 7), n = makeNoise(77 + name.charCodeAt(1));
    const val = new Float32Array(S * S);
    const set = (x, y, v) => { x = ((Math.floor(x) % S) + S) % S; y = ((Math.floor(y) % S) + S) % S; val[y * S + x] = v; };
    const get = (x, y) => val[(((Math.floor(y) % S) + S) % S) * S + (((Math.floor(x) % S) + S) % S)];
    // 이음새 없는 노이즈 (끝과 처음이 이어져요)
    const tn = (x, y, sc) => { const tx = x / S, ty = y / S; return n(x / sc, y / sc, 2) * (1 - tx) * (1 - ty) + n((x - S) / sc, y / sc, 2) * tx * (1 - ty) + n(x / sc, (y - S) / sc, 2) * (1 - tx) * ty + n((x - S) / sc, (y - S) / sc, 2) * tx * ty; };
    const fill = f => { for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) val[y * S + x] = f(x, y); };
    const stones = (rowH, colW, mortar, jitter) => {
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
        const row = Math.floor(y / rowH), off = (row % 2) * colW / 2, lx = (x + off) % colW, ly = y % rowH;
        const id = Math.floor((x + off) / colW) * 7 + row * 13;
        let v = 0.8 + ((id * 37) % 11) / 11 * jitter + (tn(x, y, 3) - 0.5) * 0.12;
        if (lx === 0 || ly === 0) v = mortar;
        else if (lx === 1 || ly === 1) v = Math.min(1, v + 0.12);
        else if (lx === colW - 1 || ly === rowH - 1) v -= 0.14;
        set(x, y, v);
      }
    };
    switch (name) {
      case 'grass':
        fill((x, y) => 0.8 + (tn(x, y, 9) - 0.5) * 0.3);
        for (let i = 0; i < 150; i++) { const x = r() * S, y = r() * S, L = 2 + Math.floor(r() * 2); for (let k = 0; k < L; k++) set(x, y + k, 0.6); set(x, y - 1, 1); }
        break;
      case 'dirt':
        fill((x, y) => 0.82 + (tn(x, y, 7) - 0.5) * 0.26);
        for (let i = 0; i < 26; i++) { const x = r() * S, y = r() * S; set(x, y, 1); set(x + 1, y, 0.96); set(x, y + 1, 0.62); set(x + 1, y + 1, 0.58); }
        for (let i = 0; i < 5; i++) { let x = r() * S, y = r() * S; for (let k = 0; k < 8; k++) { set(x, y, 0.6); x += r() < 0.5 ? 1 : 0; y += r() < 0.6 ? 1 : -1; } }
        break;
      case 'cobble': stones(8, 10, 0.42, 0.18); break;
      case 'brick': stones(8, 16, 0.45, 0.15); break;
      case 'rock':
        fill((x, y) => 0.78 + (tn(x, y, 6) - 0.5) * 0.34);
        for (let i = 0; i < 60; i++) set(r() * S, r() * S, r() < 0.5 ? 0.98 : 0.58);
        for (let i = 0; i < 4; i++) { let x = r() * S, y = r() * S; for (let k = 0; k < 12; k++) { set(x, y, 0.5); x += r() < 0.5 ? 1 : -1; y += 1; } }
        break;
      case 'bark':
        fill((x, y) => 0.72 + (n(x / 1.5, y / 10, 2) - 0.5) * 0.5);
        for (let i = 0; i < 12; i++) { const x = Math.floor(r() * S), y = r() * S, L = 4 + r() * 10; for (let k = 0; k < L; k++) set(x, y + k, 0.5); }
        break;
      case 'leaf':
        fill((x, y) => 0.74 + (tn(x, y, 5) - 0.5) * 0.25);
        for (let i = 0; i < 70; i++) { const x = r() * S, y = r() * S; set(x, y, 1); set(x + 1, y, 0.96); set(x - 1, y + 1, 0.9); set(x, y + 1, 0.55); set(x + 1, y + 1, 0.6); }
        break;
      case 'plaster':
        fill((x, y) => 0.9 + (tn(x, y, 8) - 0.5) * 0.12);
        for (let i = 0; i < 30; i++) set(r() * S, r() * S, 0.8);
        break;
      case 'wood':
        fill((x, y) => { const pl = y % 8; return pl === 0 ? 0.5 : 0.8 + (n(x / 12, y / 1.5, 2) - 0.5) * 0.3 + (pl === 1 ? 0.1 : 0); });
        break;
      case 'roof':
        fill((x, y) => { const row = Math.floor(y / 6), lx = (x + (row % 2) * 4) % 8, ly = y % 6; return ly === 5 ? 0.5 : lx === 0 ? 0.62 : 0.84 + (ly === 0 ? 0.1 : 0) + (tn(x, y, 4) - 0.5) * 0.1; });
        break;
      case 'water':
        fill((x, y) => { const w = Math.sin((x + tn(x, y, 10) * 20) * 0.35 + y * 0.6); return 0.82 + (w > 0.86 ? 0.18 : w < -0.9 ? -0.08 : 0); });
        break;
      case 'crystal':
        fill((x, y) => 0.8 + ((x + y) % 9 === 0 ? 0.2 : 0) + (tn(x, y, 6) - 0.5) * 0.2);
        break;
      default: fill(() => 1);
    }
    for (let i = 0; i < S * S; i++) { const v = clamp(Math.round(val[i] * 255), 0, 255); d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255; }
    c.putImageData(img, 0, 0);
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestMipmapLinearFilter;
    return (this._tex[name] = t);
  },

  /* ---------- 재료 셰이더 손질: 바람 흔들림 + 땅 위를 지나가는 구름 그림자 ---------- */
  uCloud: { value: 0 },
  applyWorld(m, kind) {
    m.onBeforeCompile = sh => {
      sh.uniforms.uTime = W3.uTime; sh.uniforms.uCloud = W3.uCloud;
      let sway = '';
      if (kind === 'grass') sway = `
           #ifdef USE_INSTANCING
             float ph = instanceMatrix[3].x * 0.6 + instanceMatrix[3].z * 0.4;
           #else
             float ph = position.x * 0.6;
           #endif
           transformed.x += sin(uTime * 2.2 + ph) * 0.09 * position.y;`;
      else if (kind === 'leaf') sway = `
           float sw = max(0.0, position.y - 2.0);
           transformed.x += sin(uTime * 1.3 + position.x * 0.45 + position.z * 0.3) * 0.05 * sw;
           transformed.z += cos(uTime * 1.1 + position.x * 0.3) * 0.035 * sw;`;
      sh.vertexShader = 'uniform float uTime;\nvarying vec3 vWPos;\n' + sh.vertexShader
        .replace('#include <begin_vertex>', '#include <begin_vertex>' + sway)
        .replace('#include <project_vertex>', `#include <project_vertex>
           vec4 wp4 = vec4(transformed, 1.0);
           #ifdef USE_INSTANCING
             wp4 = instanceMatrix * wp4;
           #endif
           vWPos = (modelMatrix * wp4).xyz;`);
      sh.fragmentShader = `uniform float uTime; uniform float uCloud; varying vec3 vWPos;
        float hh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hh(i), hh(i + vec2(1, 0)), f.x), mix(hh(i + vec2(0, 1)), hh(i + vec2(1, 1)), f.x), f.y); }
      ` + sh.fragmentShader.replace('#include <dithering_fragment>', `
        float cl = vn(vWPos.xz * 0.035 + vec2(uTime * 0.05, uTime * 0.012)) * 0.65 + vn(vWPos.xz * 0.09 + vec2(uTime * 0.07, 0.0)) * 0.35;
        gl_FragColor.rgb *= 1.0 - uCloud * smoothstep(0.5, 0.72, cl);
        #include <dithering_fragment>`);
    };
    m.customProgramCacheKey = () => 'world-' + (kind || 'none');
  },

  /* ---------- 재료 (같은 색·무늬는 같이 써요) ---------- */
  mats: {},
  mat(color, o = {}) {
    const k = color + JSON.stringify(o);
    if (this.mats[k]) return this.mats[k];
    const p = Object.assign({ color, flatShading: true, shininess: 0, specular: 0x000000 }, o);
    const tex = p.tex, sway = p.sway; delete p.tex; delete p.sway;
    if (tex) p.map = this.tex(tex);
    const m = new THREE.MeshPhongMaterial(p);
    this.applyWorld(m, sway);
    return (this.mats[k] = m);
  },
  mesh(geo, color, o, shadow = true) {
    const m = new THREE.Mesh(geo, this.mat(color, o));
    m.castShadow = shadow; m.receiveShadow = true;
    return m;
  },
  jit(hex, r, amt = 0.06) {   // 색을 살짝씩 다르게 (4단계로만 → 재료 수를 줄여요)
    const c = new THREE.Color(hex), q = Math.floor(r() * 4) / 3 - 0.5;
    c.offsetHSL(q * amt * 0.3, 0, q * amt);
    return c.getHex();
  },
  glowTex() {
    if (this._glow) return this._glow;
    const cv = document.createElement('canvas'); cv.width = cv.height = 32;
    const c = cv.getContext('2d'), g = c.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,0.4)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, 32, 32);
    const t = new THREE.CanvasTexture(cv); t.magFilter = t.minFilter = THREE.NearestFilter;
    return (this._glow = t);
  },
  glow(color, size, opacity = 0.8) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex(), color, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity }));
    s.scale.set(size, size, 1);
    return s;
  },

  /* ---------- 장소 바꾸기 ---------- */
  setTheme(id) {
    const T = W3T[id];
    this.theme = id; this.T = T;
    for (const g of this.chunks.values()) this.disposeChunk(g);
    this.chunks.clear();
    while (this.scene.children.length) { const o = this.scene.children[0]; this.scene.remove(o); o.traverse(x => { if (x.geometry) x.geometry.dispose(); }); }
    const sc = this.scene;
    sc.fog = new THREE.Fog(T.fog, T.fogNear, T.fogFar);
    this.r.setClearColor(T.fog);
    const gr = T.grade || { tint: [1, 1, 1], sat: 1, bloom: 0.6 }, u = this.post.mat.uniforms;
    u.uTint.value.set(...gr.tint); u.uSat.value = gr.sat; u.uBloom.value = gr.bloom;
    // 하늘 (둥근 천장에 그라데이션)
    const sky = new THREE.Mesh(new THREE.SphereGeometry(520, 24, 12), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color(T.sky[0]) }, mid: { value: new THREE.Color(T.sky[1]) }, bot: { value: new THREE.Color(T.sky[2]) } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 top, mid, bot; varying vec3 vP; void main(){ float h = vP.y; vec3 c = h > 0.0 ? mix(mid, top, pow(clamp(h * 2.4, 0.0, 1.0), 0.7)) : mix(mid, bot, clamp(-h * 5.0, 0.0, 1.0)); gl_FragColor = vec4(c, 1.0); }',
    }));
    sky.renderOrder = -10; sc.add(sky); this.sky = sky;
    // 빛
    const hemi = new THREE.HemisphereLight(T.hemi[0], T.hemi[1], T.hemi[2]); sc.add(hemi); this.hemi = hemi;
    const dir = new THREE.DirectionalLight(T.dir[0], T.dir[1]);
    dir.castShadow = true; dir.shadow.mapSize.set(1024, 1024);
    const sc2 = dir.shadow.camera; sc2.left = -45; sc2.right = 45; sc2.top = 30; sc2.bottom = -30; sc2.near = 1; sc2.far = 160;
    dir.shadow.bias = -0.002;
    sc.add(dir); sc.add(dir.target); this.dir = dir;
    // 움직이는 색 빛 (개수를 고정해서 셰이더를 다시 만들지 않아요)
    this.plights = (T.plights || []).map(p => { const l = new THREE.PointLight(p.c, p.i, p.d, 2); l.userData = p; sc.add(l); return l; });
    // 먼 풍경 / 구름 / 해 / 별
    this.far = new THREE.Group(); sc.add(this.far);
    this.clouds = new THREE.Group(); sc.add(this.clouds);
    this.skyFx = new THREE.Group(); sc.add(this.skyFx);
    this.pulseMats = [];
    if (T.far) { T.far(this.far, mulberry32(9)); this.merge(this.far); }
    if (T.cloud) { this.makeClouds(T); this.clouds.children.forEach(c => this.merge(c)); }
    if (T.sun) { const s = this.glow(T.sun.c, T.sun.size, 1); s.material.fog = false; s.position.set(...T.sun.pos); this.skyFx.add(s); const core = this.glow(0xffffff, T.sun.size * 0.35, 1); core.material.fog = false; core.position.set(...T.sun.pos); this.skyFx.add(core); }
    if (T.stars) {
      const r = mulberry32(3), pts = [];
      for (let i = 0; i < 500; i++) { const a = r() * Math.PI * 2, e = 0.08 + r() * 1.3; pts.push(Math.cos(a) * Math.cos(e) * 480, Math.sin(e) * 480, -Math.abs(Math.sin(a) * Math.cos(e) * 480)); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      this.skyFx.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1, sizeAttenuation: false, fog: false })));
    }
    this.makeMotes(T);
    this.uCloud.value = T.cloudShadow || 0;
    const rc = T.rays || [1, 0.95, 0.8]; this.post.mat.uniforms.uRayCol.value.set(...rc);
    this.post.mat.uniforms.uDof.value = T.dof != null ? T.dof : 1;
    if (T.moon) { const mn = new THREE.Mesh(new THREE.SphereGeometry(16, 14, 10), new THREE.MeshBasicMaterial({ color: 0xf0ecd8, fog: false })); mn.position.set(...T.sun.pos); this.skyFx.add(mn); }
    // 칠 때 번쩍이는 빛 + 어두운 곳에서 주인공 둘레의 빛 (개수를 늘 같게 둬요)
    this.hitL = new THREE.PointLight(0xffffff, 0, 10, 2); sc.add(this.hitL);
    this.heroL = new THREE.PointLight(T.heroLight ? T.heroLight[0] : 0xffffff, T.heroLight ? T.heroLight[1] : 0, 9, 2); sc.add(this.heroL);
    this.makeFx(T);
  },
  /* 칠 때 3D 세계가 그 자리에서 번쩍 빛나요 (sx, sy: 480x270 화면 좌표) */
  flash(sx, sy, color, power = 2.6) {
    if (!this.ready || !this.hitL || this.r.domElement.style.display === 'none') return;
    this.hitL.color.set(color); this.hitL.intensity = power;
    this.hitL.position.set(this.camX + (sx - GW / 2) / this.PXU, Math.max(0.4, (GROUND - sy) / this.PXU), 0.8);
  },

  /* ---------- 날씨와 분위기: 떨어지는 잎, 비와 번개, 굴뚝 연기, 낮게 깔린 안개 ---------- */
  makeFx(T) {
    const fx = T.fx || [], sc = this.scene, r = mulberry32(23);
    this.fx = { list: fx };
    if (fx.includes('leaves')) {
      const N = 46, im = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.2, 0.13), new THREE.MeshLambertMaterial({ side: THREE.DoubleSide }), N);
      const st = [], col = new THREE.Color();
      for (let i = 0; i < N; i++) { st.push({ x: -40 + r() * 85, y: r() * 12, z: -20 + r() * 26, vy: 0.6 + r() * 0.8, ph: r() * 6, sp: 1 + r() * 2 }); col.set(pick(r, [0x8ac850, 0x6ab84a, 0xd8b040, 0xc87a30])); im.setColorAt(i, col); }
      im.frustumCulled = false; sc.add(im); this.fx.leaves = { im, st };
    }
    if (fx.includes('rain')) {
      const N = 420, pos = new Float32Array(N * 6), st = [];
      for (let i = 0; i < N; i++) st.push({ x: -40 + r() * 85, y: r() * 16, z: -25 + r() * 32, v: 22 + r() * 10 });
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const ln = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xb8c8ff, transparent: true, opacity: 0.35 }));
      ln.frustumCulled = false; sc.add(ln); this.fx.rain = { ln, st, pos };
      this.fx.lt = 4; this.fx.fl = 0;
    }
    if (fx.includes('smoke')) {
      const pool = [];
      for (let i = 0; i < 26; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex(), color: 0xffffff, transparent: true, depthWrite: false, fog: false, opacity: 0 })); sp.visible = false; sc.add(sp); pool.push({ sp, life: 0 }); }
      this.fx.smoke = { pool, acc: 0 };
    }
    if (fx.includes('mist')) {
      if (!this._mistTex) {
        const cv = document.createElement('canvas'); cv.width = cv.height = 128; const c = cv.getContext('2d'), rr = mulberry32(8);
        for (let i = 0; i < 40; i++) { const x = rr() * 128, y = rr() * 128, rad = 12 + rr() * 26; for (const ox of [-128, 0, 128]) for (const oy of [-128, 0, 128]) { const gg = c.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad); gg.addColorStop(0, 'rgba(255,255,255,0.32)'); gg.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gg; c.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2); } }
        this._mistTex = new THREE.CanvasTexture(cv); this._mistTex.wrapS = this._mistTex.wrapT = THREE.RepeatWrapping;
      }
      const layers = [];
      for (let i = 0; i < 3; i++) {
        const t = this._mistTex.clone(); t.needsUpdate = true; t.repeat.set(3, 1);
        const m = new THREE.Mesh(new THREE.PlaneGeometry(160, 40), new THREE.MeshBasicMaterial({ map: t, color: T.mistCol || 0xffffff, transparent: true, opacity: 0.5, depthWrite: false }));
        m.rotation.x = -Math.PI / 2; m.position.set(0, 0.3 + i * 0.45, -12 - i * 9); m.renderOrder = 2; sc.add(m); layers.push({ m, t, sp: 0.004 + i * 0.003 });
      }
      this.fx.mist = layers;
    }
  },
  updateFx(dt) {
    const F = this.fx; if (!F) return;
    const cx = this.camX;
    if (F.leaves) {
      const { im, st } = F.leaves, m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s3 = new THREE.Vector3(1, 1, 1);
      st.forEach((L, i) => {
        L.y -= L.vy * dt; L.x += Math.sin(this.t * L.sp + L.ph) * 0.9 * dt - 0.3 * dt;
        if (L.y < 0) { L.y = 10 + Math.random() * 3; L.x = cx - 30 + Math.random() * 70; }
        if (L.x < cx - 45) L.x += 90; else if (L.x > cx + 45) L.x -= 90;
        e.set(this.t * L.sp + L.ph, this.t * L.sp * 0.7, L.ph); q.setFromEuler(e); p.set(L.x, L.y, L.z); m4.compose(p, q, s3); im.setMatrixAt(i, m4);
      });
      im.instanceMatrix.needsUpdate = true;
    }
    if (F.rain) {
      const { st, pos, ln } = F.rain;
      st.forEach((R, i) => {
        R.y -= R.v * dt; R.x -= R.v * 0.18 * dt;
        if (R.y < 0) { R.y = 14 + Math.random() * 4; R.x = cx - 40 + Math.random() * 85; }
        if (R.x < cx - 45) R.x += 90;
        pos.set([R.x, R.y, R.z, R.x + 0.12, R.y + 0.7, R.z], i * 6);
      });
      ln.geometry.attributes.position.needsUpdate = true;
      // 번개: 가끔 하늘이 두 번 번쩍여요
      F.lt -= dt;
      if (F.lt < 0) { F.lt = 7 + Math.random() * 9; F.fl = 0.9; F.second = 0.18; }
      if (F.second > 0) { F.second -= dt; if (F.second <= 0) F.fl = Math.max(F.fl, 0.7); }
      F.fl = Math.max(0, F.fl - dt * 5);
      this.post.mat.uniforms.uFlash.value = F.fl * 0.35;
    }
    if (F.smoke) {
      const srcs = []; for (const g of this.chunks.values()) if (g.userData.smoke) for (const p of g.userData.smoke) if (Math.abs(p[0] - cx) < 40) srcs.push(p);
      F.smoke.acc += dt;
      if (F.smoke.acc > 0.18 && srcs.length) {
        F.smoke.acc = 0;
        const s = F.smoke.pool.find(q => q.life <= 0);
        if (s) { const p = pick(Math.random, srcs); s.life = 1; s.sp.visible = true; s.sp.position.set(p[0] + (Math.random() - 0.5) * 0.2, p[1], p[2]); }
      }
      for (const s of F.smoke.pool) if (s.life > 0) {
        s.life -= dt * 0.28; s.sp.position.y += dt * 1.1; s.sp.position.x += dt * 0.5;
        const k = 1 - s.life; s.sp.scale.set(0.6 + k * 2.4, 0.6 + k * 2.4, 1); s.sp.material.opacity = Math.sin(Math.min(1, k * 1.2) * Math.PI) * 0.3;
        if (s.life <= 0) s.sp.visible = false;
      }
    }
    if (F.mist) for (const L of F.mist) { L.m.position.x = cx; L.t.offset.x = cx / 160 * 3 + this.t * L.sp; }
  },
  makeClouds(T) {
    const r = mulberry32(17);
    for (let i = 0; i < 16; i++) {
      const g = new THREE.Group(), n = 3 + Math.floor(r() * 4);
      for (let k = 0; k < n; k++) {
        const m = this.mesh(new THREE.IcosahedronGeometry(5 + r() * 6, 1), T.cloud, { emissive: T.cloud, emissiveIntensity: 0.35 }, false);
        m.position.set(k * 7 + r() * 4, r() * 3, r() * 5); m.scale.y = 0.55; m.receiveShadow = false;
        g.add(m);
      }
      g.position.set(-320 + r() * 640, 40 + r() * 25, -170 - r() * 120);
      this.clouds.add(g);
    }
  },
  /* 떠다니는 빛 알갱이 (반딧불·포자·불티) — 3D 공간에 있어서 깊이마다 다르게 움직여요 */
  makeMotes(T) {
    const M = T.motes; this.motes = null;
    if (!M) return;
    const r = mulberry32(5), N = M.n, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), info = [];
    for (let i = 0; i < N; i++) {
      pos[i * 3] = -40 + r() * 85; pos[i * 3 + 1] = M.y[0] + r() * (M.y[1] - M.y[0]); pos[i * 3 + 2] = -22 + r() * 28;
      info.push({ ph: r() * 6.28, sp: 0.5 + r() * 1.5, vx: (r() - 0.5) * M.drift[0], vy: M.drift[1] * (0.5 + r()) });
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ size: M.size, sizeAttenuation: false, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    pts.frustumCulled = false;
    this.scene.add(pts);
    this.motes = { pts, info, base: new THREE.Color(M.c), M };
  },
  updateMotes(dt) {
    const m = this.motes; if (!m) return;
    const p = m.pts.geometry.attributes.position, c = m.pts.geometry.attributes.color, cx = this.camX, M = m.M;
    for (let i = 0; i < m.info.length; i++) {
      const f = m.info[i];
      let x = p.getX(i) + (f.vx + Math.sin(this.t * f.sp + f.ph) * 0.3) * dt, y = p.getY(i) + f.vy * dt;
      if (x < cx - 45) x += 90; else if (x > cx + 45) x -= 90;
      if (y > M.y[1]) y = M.y[0]; else if (y < M.y[0]) y = M.y[1];
      p.setXYZ(i, x, y, p.getZ(i));
      const tw = 0.35 + 0.65 * Math.max(0, Math.sin(this.t * f.sp * 2 + f.ph));
      c.setXYZ(i, m.base.r * tw, m.base.g * tw, m.base.b * tw);
    }
    p.needsUpdate = true; c.needsUpdate = true;
  },

  /* 같은 재료의 모양들을 하나로 합쳐요 (그릴 것이 수백 개 → 수십 개로 줄어 가벼워져요) */
  merge(g) {
    g.updateMatrixWorld(true);
    const groups = new Map();
    for (const o of g.children.slice()) {
      if (!o.isMesh || o.isInstancedMesh || o.geometry.attributes.color) continue;
      const k = o.material.uuid + (o.castShadow ? 's' : 'n');
      if (!groups.has(k)) groups.set(k, { mat: o.material, cast: o.castShadow, list: [] });
      groups.get(k).list.push(o); g.remove(o);
    }
    for (const { mat, cast, list } of groups.values()) {
      let total = 0;
      const parts = list.map(m => { const ge = m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone(); ge.applyMatrix4(m.matrixWorld); m.geometry.dispose(); total += ge.attributes.position.count; return ge; });
      const pos = new Float32Array(total * 3), uv = new Float32Array(total * 2); let off = 0;
      for (const ge of parts) {
        pos.set(ge.attributes.position.array, off * 3);
        if (ge.attributes.uv) uv.set(ge.attributes.uv.array, off * 2);
        off += ge.attributes.position.count; ge.dispose();
      }
      const mg = new THREE.BufferGeometry();
      mg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      mg.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      mg.computeVertexNormals();
      const mm = new THREE.Mesh(mg, mat); mm.castShadow = cast; mm.receiveShadow = true; g.add(mm);
    }
    g.traverse(o => { if (o !== g) { o.updateMatrix(); o.matrixAutoUpdate = false; } });
  },

  /* ---------- 땅 조각 (가로로 끝없이 이어져요) ---------- */
  disposeChunk(g) { this.scene.remove(g); g.traverse(x => { if (x.geometry) x.geometry.dispose(); }); },
  // 풀잎 한 다발 (세 갈래)
  bladeGeo() {
    if (this._blade) return this._blade;
    const v = [];
    for (let k = 0; k < 3; k++) {
      const a = k * 2.1, lx = Math.cos(a) * 0.12, lz = Math.sin(a) * 0.12, h = 0.42 + k * 0.08;
      v.push(-0.035, 0, 0, 0.035, 0, 0, lx, h, lz);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.computeVertexNormals();
    return (this._blade = g);
  },
  makeChunk(i) {
    const T = this.T, CH = this.CH, x0 = i * CH, g = new THREE.Group(), r = mulberry32(i * 7919 + T.seed);
    // 풀밭 (멀리는 언덕). 무늬 좌표는 세상 좌표라서 조각 사이 이음새가 안 보여요
    const geo = new THREE.PlaneGeometry(CH, 170, 8, 40);
    geo.rotateX(-Math.PI / 2); geo.translate(x0 + CH / 2, 0, -75);
    const pos = geo.attributes.position, cols = [], uvs = [], c = new THREE.Color();
    for (let k = 0; k < pos.count; k++) {
      const x = pos.getX(k), z = pos.getZ(k);
      pos.setY(k, T.height ? T.height(x, z) : 0);
      T.ground(x, z, c); c.multiplyScalar(1.22); cols.push(c.r, c.g, c.b);
      uvs.push(x / 3, z / 3);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.computeVertexNormals();
    const ground = new THREE.Mesh(geo, this.mat(0xffffff, { vertexColors: true, tex: T.groundTex || 'grass' }));
    ground.receiveShadow = true; g.add(ground);
    // 길 (캐릭터가 달리는 줄)
    if (T.road) {
      const rg = new THREE.PlaneGeometry(CH, 4.2, 24, 6); rg.rotateX(-Math.PI / 2); rg.translate(x0 + CH / 2, 0.03, 0);
      const rp = rg.attributes.position, rc = [], ru = [];
      for (let k = 0; k < rp.count; k++) { T.road(rp.getX(k), rp.getZ(k), c); c.multiplyScalar(1.2); rc.push(c.r, c.g, c.b); ru.push(rp.getX(k) / 2.5, rp.getZ(k) / 2.5); }
      rg.setAttribute('color', new THREE.Float32BufferAttribute(rc, 3));
      rg.setAttribute('uv', new THREE.Float32BufferAttribute(ru, 2));
      const road = new THREE.Mesh(rg, this.mat(0xffffff, { vertexColors: true, tex: T.roadTex || 'dirt', polygonOffset: true, polygonOffsetFactor: -1 }));
      road.receiveShadow = true; g.add(road);
    }
    // 바람에 흔들리는 풀잎 (한 번에 그리는 '인스턴스' 로 수백 개)
    if (T.grass) {
      const G = T.grass, N = Math.round(G.n * (Store.data.settings.gfx === 0 ? 0.4 : 1));
      const im = new THREE.InstancedMesh(this.bladeGeo(), this.mat(0xffffff, { sway: 'grass', side: THREE.DoubleSide }), N);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s3 = new THREE.Vector3(), p3 = new THREE.Vector3(), col = new THREE.Color(), up = new THREE.Vector3(0, 1, 0);
      for (let k = 0; k < N; k++) {
        let z;
        do { z = -16 + r() * 23; } while (Math.abs(z) < 2.25 && r() < 0.97);
        const x = x0 + r() * CH, sc = 0.7 + r() * 0.8;
        p3.set(x, T.height ? T.height(x, z) : 0, z); q.setFromAxisAngle(up, r() * 6.28); s3.set(sc, sc * (0.8 + r() * 0.6), sc);
        m4.compose(p3, q, s3); im.setMatrixAt(k, m4);
        col.set(G.c[Math.floor(r() * G.c.length)]); im.setColorAt(k, col);
      }
      im.receiveShadow = true; im.castShadow = false;
      g.add(im);
    }
    T.build(g, r, x0, CH, this);
    this.merge(g);
    return g;
  },

  /* ---------- 매 프레임 ---------- */
  advance(dt, speed, pulse = 0) {
    if (!this.ready || this.r.domElement.style.display === 'none') return;
    this.t += dt; this.uTime.value = this.t;
    this.camX += speed / this.PXU * dt;
    const T = this.T, cx = this.camX, CH = this.CH;
    // 필요한 땅 조각만 만들고, 지나간 것은 치워요 (한 프레임에 하나씩만 만들어서 끊김을 줄여요)
    const a = Math.floor((cx - 110) / CH), b = Math.floor((cx + 110) / CH);
    for (const [k, g] of this.chunks) if (k < a || k > b) { this.disposeChunk(g); this.chunks.delete(k); }
    let made = 0;
    for (let k = a; k <= b; k++) if (!this.chunks.has(k) && (made++ === 0 || this.chunks.size < 4)) { const g = this.makeChunk(k); this.scene.add(g); this.chunks.set(k, g); }
    // 카메라: 달리는 줄을 중심으로 천천히 돌아요 (진짜 3D 시차)
    const ang = this.orbit * (Math.sin(this.t * 0.21) * 0.75 + Math.sin(this.t * 0.47 + 1) * 0.25);
    this.cam.position.set(cx + Math.sin(ang) * this.D, this.H + Math.sin(this.t * 0.33) * 0.15, Math.cos(ang) * this.D);
    this.cam.lookAt(cx, this.Ly, 0);
    // 하늘·먼 풍경은 카메라를 따라와요 (아주 멀리 있는 것처럼)
    this.sky.position.copy(this.cam.position);
    this.skyFx.position.set(cx, 0, 0);
    this.far.position.x = cx * 0.93;
    this.clouds.position.x = cx * 0.96 + this.t * 1.2;
    // 그림자를 만드는 해는 카메라 근처만 비춰요
    this.dir.position.set(cx + T.dir[2][0], T.dir[2][1], T.dir[2][2]);
    this.dir.target.position.set(cx, 0, -8);
    for (const l of this.plights) {
      const p = l.userData, k = this.t * (p.sp || 0.5);
      l.position.set(cx + p.x + Math.sin(k) * (p.wx || 3), p.y + Math.sin(k * 1.7) * 0.6, p.z + Math.cos(k) * (p.wz || 2));
      l.intensity = p.i * (1 + pulse * 0.35 + (p.flick ? Math.sin(this.t * 23 + p.x) * 0.12 : 0));
    }
    for (const m of this.pulseMats) m.emissiveIntensity = m.userData.base * (1 + pulse * 0.8);
    this.updateMotes(dt);
    this.updateFx(dt);
    this.watchSpeed();
    if (this.hitL) { this.hitL.intensity *= Math.exp(-dt * 9); this.heroL.position.set(cx + (PX - GW / 2) / this.PXU, 1.3, 0.9); }
    if (this._waterT) this._waterT.offset.set(this.t * 0.03, this.t * 0.011);
    // 해(달)가 화면 어디에 있는지 계산해서 빛내림을 그려요
    const U = this.post.mat.uniforms;
    if (T.sun && T.rays) {
      const v = new THREE.Vector3(cx + T.sun.pos[0], T.sun.pos[1], T.sun.pos[2]).project(this.cam);
      U.uSun.value.set((v.x + 1) / 2, (v.y + 1) / 2);
      U.uSunOn.value = v.z < 1 ? clamp(1.3 - Math.max(Math.abs(v.x), Math.abs(v.y)) * 0.6, 0, 1) * (T.rayPow || 1) : 0;
    } else U.uSunOn.value = 0;
    this.post.mat.uniforms.uPulse.value = pulse;
    if ((this._f = (this._f || 0) + 1) % 30 === 0) syncWorldCanvas();
    // 그리기: 작은 화면 → 도트 효과 → 캔버스
    this.r.setRenderTarget(this.rt); this.r.render(this.scene, this.cam);
    this.r.setRenderTarget(null); this.r.render(this.post.scene, this.post.cam);
  },
};

/* Phaser 화면과 정확히 같은 자리·크기로 3D 화면을 겹쳐요 */
function syncWorldCanvas() {
  const cv = document.getElementById('world3d');
  if (!cv || typeof game === 'undefined' || !game.canvas) return;
  const r = game.canvas.getBoundingClientRect();
  Object.assign(cv.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
}

/* ================= 장소별 3D 모양 ================= */
const _n1 = makeNoise(501), _n2 = makeNoise(502);
const hillH = (x, z) => z > -9 ? 0 : (_n1(x / 28, z / 28, 3) - 0.35) * Math.min(1, (-z - 9) / 30) * 14;
const LEAF = { tex: 'leaf', sway: 'leaf' };

// 자주 쓰는 모양
const P3 = {
  tree(W, g, x, z, s, r, leaf, bark) {
    const t = W.mesh(new THREE.CylinderGeometry(0.22 * s, 0.38 * s, 3 * s, 6), bark, { tex: 'bark' }); t.position.set(x, 1.5 * s, z); g.add(t);
    const br = W.mesh(new THREE.CylinderGeometry(0.06 * s, 0.13 * s, 1.4 * s, 4), bark, { tex: 'bark' }); br.position.set(x + 0.45 * s, 2.6 * s, z); br.rotation.z = -0.8; g.add(br);
    for (let k = 0; k < 4; k++) {
      const f = W.mesh(new THREE.IcosahedronGeometry((1.15 + r() * 0.6) * s, 1), W.jit(leaf, r, 0.08), LEAF);
      f.position.set(x + (r() - 0.5) * 1.6 * s, (3.2 + r() * 1.4) * s, z + (r() - 0.5) * 1.3 * s); f.rotation.set(r() * 3, r() * 3, 0); f.scale.y = 0.85; g.add(f);
    }
  },
  birch(W, g, x, z, s, r) {
    const t = W.mesh(new THREE.CylinderGeometry(0.14 * s, 0.2 * s, 4.2 * s, 6), 0xe8e4d8, { tex: 'bark' }); t.position.set(x, 2.1 * s, z); g.add(t);
    for (let k = 0; k < 3; k++) { const f = W.mesh(new THREE.IcosahedronGeometry((0.8 + r() * 0.4) * s, 1), W.jit(0x8ac850, r, 0.08), LEAF); f.position.set(x + (r() - 0.5) * 0.9 * s, (3.8 + k * 0.7) * s, z + (r() - 0.5) * 0.8 * s); f.scale.y = 1.2; g.add(f); }
  },
  pine(W, g, x, z, s, r, leaf, bark) {
    const t = W.mesh(new THREE.CylinderGeometry(0.18 * s, 0.28 * s, 1.6 * s, 5), bark, { tex: 'bark' }); t.position.set(x, 0.8 * s, z); g.add(t);
    for (let k = 0; k < 4; k++) { const c = W.mesh(new THREE.ConeGeometry((1.7 - k * 0.38) * s, 1.9 * s, 7), W.jit(leaf, r, 0.08), LEAF); c.position.set(x, (1.9 + k * 0.95) * s, z); c.rotation.y = r() * 3; g.add(c); }
  },
  rock(W, g, x, z, s, r, col) { const m = W.mesh(new THREE.DodecahedronGeometry(s, 0), W.jit(col, r), { tex: 'rock' }); m.position.set(x, s * 0.35, z); m.scale.set(1, 0.65 + r() * 0.3, 0.9); m.rotation.set(r(), r() * 3, r()); g.add(m); },
  bush(W, g, x, z, s, r, col) { for (let k = 0; k < 3; k++) { const m = W.mesh(new THREE.IcosahedronGeometry((0.5 + r() * 0.35) * s, 1), W.jit(col, r, 0.1), LEAF); m.position.set(x + (k - 1) * 0.55 * s, 0.4 * s, z + (r() - 0.5) * 0.4); m.scale.y = 0.8; g.add(m); } },
  flowers(W, g, x, z, r) { for (let k = 0; k < 6; k++) { const fx = x + (r() - 0.5) * 1.2, fz = z + (r() - 0.5) * 0.8; const st = W.mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.22, 3), 0x3e8a34, {}, false); st.position.set(fx, 0.11, fz); g.add(st); const m = W.mesh(new THREE.OctahedronGeometry(0.1, 0), pick(r, [0xff8ab0, 0xffe070, 0xffffff, 0xb8a0ff, 0xff9a50]), {}, false); m.position.set(fx, 0.25, fz); g.add(m); } },
  pebbles(W, g, x0, CH, z, r, col) { for (let k = 0; k < 10; k++) { const m = W.mesh(new THREE.DodecahedronGeometry(0.08 + r() * 0.1, 0), W.jit(col, r), {}, false); m.position.set(x0 + r() * CH, 0.05, z + (r() - 0.5) * 0.4); m.scale.y = 0.6; g.add(m); } },
  fence(W, g, x, z, len, col, iron) {
    const n = Math.max(2, Math.round(len / 1.4));
    for (let k = 0; k <= n; k++) { const p = W.mesh(iron ? new THREE.CylinderGeometry(0.035, 0.035, 1.2, 4) : new THREE.BoxGeometry(0.14, 0.9, 0.14), col, iron ? {} : { tex: 'wood' }); p.position.set(x + k * len / n, iron ? 0.6 : 0.45, z); g.add(p);
      if (iron) { const sp = W.mesh(new THREE.ConeGeometry(0.06, 0.18, 4), col); sp.position.set(x + k * len / n, 1.28, z); g.add(sp); } }
    for (const y of iron ? [0.95, 0.3] : [0.65, 0.3]) { const rl = W.mesh(new THREE.BoxGeometry(len, iron ? 0.04 : 0.1, iron ? 0.04 : 0.06), col, iron ? {} : { tex: 'wood' }); rl.position.set(x + len / 2, y, z); g.add(rl); }
  },
  crystal(W, g, x, z, s, r, col) {
    const mt = W.mat(col, { emissive: col, emissiveIntensity: 0.55, tex: 'crystal' });
    if (!W.pulseMats.includes(mt)) { mt.userData.base = 0.55; W.pulseMats.push(mt); }
    for (let k = 0; k < 5; k++) {
      const h = (1 + r() * 2.2) * s * (k === 0 ? 1.4 : 1), m = new THREE.Mesh(new THREE.CylinderGeometry(0, 0.28 * s, h, 6), mt);
      m.castShadow = true; m.position.set(x + (r() - 0.5) * 0.9 * s, h * 0.4, z + (r() - 0.5) * 0.7 * s); m.rotation.set((r() - 0.5) * 0.7, r() * 3, (r() - 0.5) * 0.7); g.add(m);
    }
    const gl = W.glow(col, 4 * s, 0.55); gl.position.set(x, 1.2 * s, z); g.add(gl);
  },
  pond(W, g, x, z, rad, r, col, glowCol) {
    const wm = W.mat(col, { shininess: 90, specular: 0xd8eeff, transparent: true, opacity: 0.86, emissive: glowCol || 0x000000, emissiveIntensity: glowCol ? 0.5 : 0, tex: 'water', flatShading: false });
    W._waterT = wm.map;
    const w = new THREE.Mesh(new THREE.CircleGeometry(rad, 14), wm);
    w.rotation.x = -Math.PI / 2; w.position.set(x, 0.05, z); w.receiveShadow = true; g.add(w);
    for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2 + r() * 0.3; P3.rock(W, g, x + Math.cos(a) * rad * 1.02, z + Math.sin(a) * rad * 0.98, 0.18 + r() * 0.2, r, 0x8a8478); }
    if (glowCol) { const gl = W.glow(glowCol, rad * 3, 0.35); gl.position.set(x, 0.6, z); g.add(gl); }
  },
};

const W3T = {
  forest: {
    seed: 11, sky: [0x3a7cc8, 0xc6dceb, 0x9ab880], fog: 0xc6dceb, fogNear: 28, fogFar: 230,
    hemi: [0xd8ecff, 0x5a7a3a, 0.8], dir: [0xfff0d0, 0.95, [-30, 45, 30]], cloud: 0xf4f2ee,
    sun: { c: 0xfff0c0, size: 70, pos: [110, 58, -420] }, rays: [1, 0.93, 0.72], rayPow: 1, cloudShadow: 0.24,
    fx: ['leaves'],
    grade: { tint: [1.04, 1.0, 0.93], sat: 1.06, bloom: 0.6 },
    grass: { n: 650, c: [0x4a9a3c, 0x3e8a34, 0x5aaa44, 0x6ab84a, 0x34782e] },
    motes: { n: 90, c: 0xfff2a0, size: 2, y: [0.5, 6], drift: [0.6, 0.15] },
    groundTex: 'grass', roadTex: 'dirt',
    height: hillH,
    ground(x, z, c) { const v = _n1(x / 6, z / 6, 2); c.setHSL(0.26 + v * 0.05, 0.34, 0.3 + v * 0.12 + (z > 2 ? -0.03 : 0)); },
    road(x, z, c) { const v = _n2(x / 3, z / 2, 2); const edge = Math.abs(z) > 1.7 + (v - 0.5); if (edge) c.setHSL(0.26, 0.36, 0.34 + v * 0.08); else c.setHSL(0.08, 0.36, 0.38 + v * 0.1 + (Math.abs(Math.abs(z) - 0.9) < 0.15 ? -0.06 : 0)); },
    far(g, r) {
      for (let i = 0; i < 16; i++) { const h = 26 + r() * 34, m = W3.mesh(new THREE.ConeGeometry(26 + r() * 24, h, 6), 0x7a98c4, {}, false); m.position.set(-380 + i * 50 + r() * 20, h / 2 - 6, -360 - r() * 50); m.rotation.y = r() * 3; g.add(m);
        const sn = W3.mesh(new THREE.ConeGeometry(9 + r() * 4, h * 0.25, 6), 0xf4f8ff, {}, false); sn.position.set(m.position.x, h - 6 - h * 0.12, m.position.z); g.add(sn); }
    },
    build(g, r, x0, CH, W) {
      for (let k = 0; k < 6; k++) { const s = 0.8 + r() * 0.6, x = x0 + r() * CH, z = -8.5 - r() * 22, t = r(); if (t < 0.55) P3.tree(W, g, x, z, s, r, 0x4a9a3c, 0x6e4a30); else if (t < 0.8) P3.pine(W, g, x, z, s, r, 0x3a8a44, 0x5a3e2c); else P3.birch(W, g, x, z, s, r); }
      for (let k = 0; k < 7; k++) { const x = x0 + r() * CH, z = -32 - r() * 40; (r() < 0.5 ? P3.tree : P3.pine)(W, g, x, z, 1.6 + r() * 1.2, r, 0x3f8a46, 0x5a3e2c); }
      for (let k = 0; k < 6; k++) P3.bush(W, g, x0 + r() * CH, -2.6 - r() * 8, 0.9 + r() * 0.5, r, 0x3f8a3a);
      for (let k = 0; k < 3; k++) P3.rock(W, g, x0 + r() * CH, -2.8 - r() * 10, 0.4 + r() * 0.6, r, 0x8a8478);
      for (let k = 0; k < 6; k++) P3.flowers(W, g, x0 + r() * CH, (r() < 0.5 ? -1 : 1) * (2.6 + r() * 2.5), r);
      P3.pebbles(W, g, x0, CH, 2.15, r, 0x9a9080);
      if (r() < 0.45) { const fx = x0 + r() * (CH - 7); P3.fence(W, g, fx, -2.7, 4 + r() * 3, 0x8a5a34); }
      if (r() < 0.3) P3.pond(W, g, x0 + 4 + r() * (CH - 8), -11 - r() * 1.5, 2.2 + r() * 1.2, r, 0x3a7ec8);
      if (r() < 0.5) { const x = x0 + r() * CH, z = -3 - r() * 4; const st = W.mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.4, 6), 0xf0e8d8); st.position.set(x, 0.2, z); g.add(st); const cap = W.mesh(new THREE.SphereGeometry(0.3, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2), 0xd8402e); cap.position.set(x, 0.38, z); g.add(cap); }
    },
  },
  cave: {
    seed: 21, sky: [0x0a0a20, 0x1e1a46, 0x1a1634], fog: 0x1e1a46, fogNear: 14, fogFar: 120,
    hemi: [0x5a6aaa, 0x201830, 0.55], dir: [0x8a9aff, 0.35, [-20, 40, 25]],
    grade: { tint: [0.94, 0.98, 1.1], sat: 1.12, bloom: 1.1 }, heroLight: [0x9ad8ff, 1.1], fx: ['mist'], mistCol: 0x8a9aff, dof: 1.2,
    motes: { n: 110, c: 0x8ae8ff, size: 2, y: [0.3, 12], drift: [0.3, 0.45] },
    plights: [{ c: 0x5ad8ff, i: 2.2, d: 26, x: -8, y: 3, z: -5, sp: 0.4 }, { c: 0xd07aff, i: 2.2, d: 26, x: 9, y: 3.5, z: -9, sp: 0.33 }, { c: 0x9ad8ff, i: 1.2, d: 22, x: 0, y: 4, z: 5, sp: 0.2, wx: 6 }],
    groundTex: 'rock', roadTex: 'rock',
    height: (x, z) => z > -6 ? 0 : (_n1(x / 10, z / 10, 2) - 0.3) * Math.min(1, (-z - 6) / 10) * 5,
    ground(x, z, c) { const v = _n1(x / 5, z / 5, 2); c.setHSL(0.7, 0.25, 0.18 + v * 0.1); },
    road(x, z, c) { const v = _n2(x / 3, z / 2, 2); c.setHSL(0.7, 0.22, Math.abs(z) > 1.8 + (v - 0.5) * 0.8 ? 0.2 + v * 0.08 : 0.26 + v * 0.07); },
    build(g, r, x0, CH, W) {
      const ceil = new THREE.Mesh(new THREE.PlaneGeometry(CH, 120), W.mat(0x16142c, { tex: 'rock' })); ceil.rotation.x = Math.PI / 2; ceil.position.set(x0 + CH / 2, 15, -50); g.add(ceil);
      for (let k = 0; k < 7; k++) { const h = 3 + r() * 7, m = W.mesh(new THREE.ConeGeometry(0.6 + r() * 1.2, h, 7), W.jit(0x3a3666, r), { tex: 'rock' }); m.position.set(x0 + r() * CH, 15 - h / 2, -4 - r() * 30); m.rotation.x = Math.PI; g.add(m); }
      for (let k = 0; k < 6; k++) { const h = 2 + r() * 6, m = W.mesh(new THREE.ConeGeometry(0.6 + r() * 1.3, h, 7), W.jit(0x34305e, r), { tex: 'rock' }); m.position.set(x0 + r() * CH, h / 2 - 0.2, -4 - r() * 30); g.add(m); }
      for (let k = 0; k < 3; k++) P3.crystal(W, g, x0 + r() * CH, -3 - r() * 16, 0.8 + r() * 0.8, r, r() < 0.5 ? 0x5ad8ff : 0xd07aff);
      P3.crystal(W, g, x0 + r() * CH, 3 + r() * 2, 0.45, r, r() < 0.5 ? 0x5ad8ff : 0xd07aff);
      for (let k = 0; k < 4; k++) P3.rock(W, g, x0 + r() * CH, (r() < 0.7 ? -1 : 1) * (2.6 + r() * 6), 0.4 + r() * 0.7, r, 0x3e3a6a);
      P3.pebbles(W, g, x0, CH, 2.15, r, 0x5a5690);
      if (r() < 0.35) P3.pond(W, g, x0 + 4 + r() * (CH - 8), -9 - r() * 3, 1.8 + r() * 1.4, r, 0x2a5aa0, 0x3ab8ff);
      for (let k = 0; k < 4; k++) { const m = W.mesh(new THREE.DodecahedronGeometry(6 + r() * 6, 0), W.jit(0x24224a, r), { tex: 'rock' }, false); m.position.set(x0 + r() * CH, 3 + r() * 6, -42 - r() * 10); g.add(m); }
      for (let k = 0; k < 3; k++) { const x = x0 + r() * CH, z = -2.8 - r() * 3; for (let j = 0; j < 3; j++) { const st = W.mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.3, 3), 0xa0b8e0, {}, false); st.position.set(x + j * 0.2, 0.15, z); g.add(st); const cp = new THREE.Mesh(new THREE.SphereGeometry(0.13, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2), W.mat(0x5ae0ff, { emissive: 0x5ae0ff, emissiveIntensity: 0.8 })); cp.position.set(x + j * 0.2, 0.3, z); g.add(cp); } }
    },
  },
  castle: {
    seed: 31, sky: [0x07061a, 0x3a2a58, 0x2a2040], fog: 0x3a2a58, fogNear: 24, fogFar: 210, stars: true,
    hemi: [0x8a7ac8, 0x1a1428, 0.6], dir: [0xb8c0ff, 0.55, [-25, 45, 20]], cloud: 0x4a3a6a,
    sun: { c: 0xd8d0ff, size: 46, pos: [-120, 62, -430] }, moon: true, rays: [0.75, 0.72, 1], rayPow: 0.8, cloudShadow: 0.15,
    fx: ['rain', 'mist'], mistCol: 0x9a8ac8, heroLight: [0xffc890, 0.8],
    grade: { tint: [0.98, 0.93, 1.08], sat: 0.96, bloom: 0.9 },
    grass: { n: 380, c: [0x3a3044, 0x4a3a50, 0x2e2638] },
    motes: { n: 80, c: 0xff9ad0, size: 2, y: [0.3, 9], drift: [1.4, -0.35] },
    plights: [{ c: 0xff9a40, i: 1.8, d: 18, x: -6, y: 2.4, z: -3, sp: 0.15, flick: true }, { c: 0xff9a40, i: 1.8, d: 18, x: 10, y: 2.4, z: -4, sp: 0.12, flick: true }],
    groundTex: 'grass', roadTex: 'cobble',
    height: hillH,
    ground(x, z, c) { const v = _n1(x / 6, z / 6, 2); c.setHSL(0.72, 0.18, 0.15 + v * 0.08); },
    road(x, z, c) { const v = _n2(x / 3, z / 2, 2); c.setHSL(0.7, 0.1, 0.32 + v * 0.08); },
    far(g, r) {
      for (let i = 0; i < 14; i++) { const h = 24 + r() * 30, m = W3.mesh(new THREE.ConeGeometry(26 + r() * 24, h, 5), 0x241a3c, {}, false); m.position.set(-340 + i * 50, h / 2 - 6, -340 - r() * 40); m.rotation.y = r() * 3; g.add(m); }
      const cx = 40, base = 30, cz = -280, st = 0x2a2040;
      const body = W3.mesh(new THREE.BoxGeometry(70, 30, 20), st, { tex: 'brick' }, false); body.position.set(cx, base + 15, cz); g.add(body);
      for (const [dx, h, w] of [[-34, 50, 10], [-14, 64, 12], [8, 80, 14], [28, 58, 10], [40, 44, 9]]) {
        const t = W3.mesh(new THREE.BoxGeometry(w, h, w), st, { tex: 'brick' }, false); t.position.set(cx + dx, base + h / 2, cz); g.add(t);
        const rf = W3.mesh(new THREE.ConeGeometry(w * 0.85, 14, 4), 0x3a2a58, { tex: 'roof' }, false); rf.position.set(cx + dx, base + h + 7, cz); rf.rotation.y = Math.PI / 4; g.add(rf);
        for (let k = 0; k < 4; k++) { const wd = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.4, 0.5), W3.mat(0xffc860, { emissive: 0xffb040, emissiveIntensity: 1 })); wd.position.set(cx + dx + (r() - 0.5) * w * 0.6, base + 8 + r() * (h - 14), cz + w / 2 + 0.2); g.add(wd); }
      }
    },
    build(g, r, x0, CH, W) {
      const dead = (x, z, s) => {
        const t = W.mesh(new THREE.CylinderGeometry(0.18 * s, 0.35 * s, 4 * s, 5), 0x2a2232, { tex: 'bark' }); t.position.set(x, 2 * s, z); g.add(t);
        for (let k = 0; k < 4; k++) { const b = W.mesh(new THREE.CylinderGeometry(0.05 * s, 0.12 * s, 2 * s, 4), 0x2a2232, { tex: 'bark' }); const a = r() * Math.PI * 2; b.position.set(x + Math.cos(a) * 0.7 * s, (3 + r()) * s, z + Math.sin(a) * 0.5 * s); b.rotation.set(Math.sin(a) * 0.9, 0, -Math.cos(a) * 0.9); g.add(b); }
      };
      for (let k = 0; k < 3; k++) dead(x0 + r() * CH, -8.5 - r() * 20, 0.9 + r() * 0.6);
      for (let k = 0; k < 5; k++) { const x = x0 + r() * CH, z = -3.6 - r() * 11, gs = W.mesh(new THREE.BoxGeometry(0.7, 1 + r() * 0.4, 0.18), W.jit(0x5a5878, r), { tex: 'rock' }); gs.position.set(x, 0.5, z); gs.rotation.set((r() - 0.5) * 0.2, (r() - 0.5) * 0.5, (r() - 0.5) * 0.15); g.add(gs); }
      if (r() < 0.7) {
        const x = x0 + 4 + r() * (CH - 12), z = -8 - r() * 10, h = 5 + r() * 3;
        for (const dx of [0, 6]) { const p = W.mesh(new THREE.CylinderGeometry(0.5, 0.55, h - (dx ? r() * 2 : 0), 8), 0x5a5878, { tex: 'brick' }); p.position.set(x + dx, h / 2, z); g.add(p); }
        if (r() < 0.6) { const ar = W.mesh(new THREE.TorusGeometry(3, 0.4, 5, 10, Math.PI), 0x5a5878, { tex: 'brick' }); ar.position.set(x + 3, h - 0.6, z); g.add(ar); }
      }
      if (r() < 0.55) P3.fence(W, g, x0 + r() * (CH - 8), -2.75, 5 + r() * 3, 0x1e1a26, true);
      { const x = x0 + r() * CH, z = -2.8 - r() * 2, pole = W.mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.4, 5), 0x1a1420); pole.position.set(x, 1.2, z); g.add(pole);
        const fl = new THREE.Mesh(new THREE.OctahedronGeometry(0.22, 0), W.mat(0xffc060, { emissive: 0xff9a30, emissiveIntensity: 1 })); fl.position.set(x, 2.5, z); g.add(fl);
        const gl = W.glow(0xff9a30, 2.8, 0.7); gl.position.set(x, 2.5, z); g.add(gl); }
      P3.pebbles(W, g, x0, CH, 2.15, r, 0x4a4660);
      if (r() < 0.25) P3.pond(W, g, x0 + 4 + r() * (CH - 8), -10.5 - r() * 2, 1.6 + r(), r, 0x2a2850);
    },
  },
  town: {
    seed: 41, sky: [0x3a7cc8, 0xc6dceb, 0x9ab880], fog: 0xc6dceb, fogNear: 30, fogFar: 230,
    hemi: [0xd8ecff, 0x6a5a40, 0.8], dir: [0xfff0d0, 0.95, [-30, 45, 30]], cloud: 0xf4f2ee,
    sun: { c: 0xfff0c0, size: 70, pos: [110, 58, -420] }, rays: [1, 0.93, 0.72], rayPow: 0.9, cloudShadow: 0.22,
    fx: ['smoke'],
    grade: { tint: [1.05, 1.0, 0.92], sat: 1.04, bloom: 0.7 },
    grass: { n: 280, c: [0x4a9a3c, 0x3e8a34, 0x5aaa44] },
    motes: { n: 50, c: 0xfff2a0, size: 2, y: [0.5, 6], drift: [0.6, 0.15] },
    groundTex: 'grass', roadTex: 'cobble',
    height: hillH,
    ground(x, z, c) { const v = _n1(x / 6, z / 6, 2); c.setHSL(0.27 + v * 0.05, 0.36, 0.33 + v * 0.12); },
    road(x, z, c) { const v = _n2(x / 3, z / 2, 2); c.setHSL(0.08, 0.18, 0.5 + v * 0.1); },
    far(g, r) { W3T.forest.far(g, r); },
    build(g, r, x0, CH, W) {
      let x = x0 + 1;
      while (x < x0 + CH - 6) {
        const w = 3.6 + r() * 2, d = 3 + r() * 1.2, h = 2.6 + r() * 1.2, z = -12 - r() * 4;
        const body = W.mesh(new THREE.BoxGeometry(w, h, d), W.jit(0xe8dcc0, r), { tex: 'plaster' }); body.position.set(x + w / 2, h / 2, z); g.add(body);
        for (const dx of [-w / 2 + 0.15, 0, w / 2 - 0.15]) { const beam = W.mesh(new THREE.BoxGeometry(0.22, h, 0.1), 0x6a4630, { tex: 'wood' }, false); beam.position.set(x + w / 2 + dx, h / 2, z + d / 2 + 0.05); g.add(beam); }
        const hb = W.mesh(new THREE.BoxGeometry(w, 0.18, 0.1), 0x6a4630, { tex: 'wood' }, false); hb.position.set(x + w / 2, h * 0.5, z + d / 2 + 0.05); g.add(hb);
        const roof = W.mesh(new THREE.CylinderGeometry(0, Math.max(w, d) * 0.78, 1.8, 4), pick(r, [0xb84a3a, 0x4a6ab0, 0x5a8a4a]), { tex: 'roof' }); roof.position.set(x + w / 2, h + 0.9, z); roof.rotation.y = Math.PI / 4; roof.scale.z = d / w; g.add(roof);
        for (const dx of [-w * 0.28, w * 0.28]) { const wd = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.1), W.mat(0xffd870, { emissive: 0xffc050, emissiveIntensity: 0.8 })); wd.position.set(x + w / 2 + dx, h * 0.72, z + d / 2 + 0.06); g.add(wd); const sill = W.mesh(new THREE.BoxGeometry(0.75, 0.08, 0.16), 0x6a4630, {}, false); sill.position.set(x + w / 2 + dx, h * 0.72 - 0.34, z + d / 2 + 0.08); g.add(sill); }
        const door = W.mesh(new THREE.BoxGeometry(0.7, 1.2, 0.1), 0x7a4a2a, { tex: 'wood' }, false); door.position.set(x + w / 2, 0.6, z + d / 2 + 0.06); g.add(door);
        const ch = W.mesh(new THREE.BoxGeometry(0.6, 1.4, 0.6), 0x8a5a4a, { tex: 'brick' }); ch.position.set(x + w * 0.75, h + 1.1, z - 0.5); g.add(ch);
        (g.userData.smoke = g.userData.smoke || []).push([x + w * 0.75, h + 1.9, z - 0.5]);   // 굴뚝 연기가 나올 자리
        P3.flowers(W, g, x + w / 2, z + d / 2 + 0.6, r);
        x += w + 2.2;
        if (r() < 0.7) P3.tree(W, g, x - 1, z + 2, 0.7, r, 0x4a9a3c, 0x6e4a30);
      }
      for (let k = 0; k < 3; k++) { const m = W.mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.8, 8), 0x8a5a34, { tex: 'wood' }); m.position.set(x0 + r() * CH, 0.4, -2.8 - r() * 2); g.add(m); }
      for (let k = 0; k < 2; k++) { const m = W.mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), 0x9a6a3a, { tex: 'wood' }); m.position.set(x0 + r() * CH, 0.35, -2.8 - r() * 2); m.rotation.y = r(); g.add(m); }
      if (r() < 0.5) P3.fence(W, g, x0 + r() * (CH - 6), -4.6, 4 + r() * 2, 0xa07a50);
      { const lx = x0 + r() * CH, pole = W.mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.8, 5), 0x2a2a30); pole.position.set(lx, 1.4, -2.6); g.add(pole);
        const lm = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.4, 0.35), W.mat(0xffe0a0, { emissive: 0xffc060, emissiveIntensity: 0.9 })); lm.position.set(lx, 2.9, -2.6); g.add(lm);
        const gl = W.glow(0xffc060, 2, 0.5); gl.position.set(lx, 2.9, -2.6); g.add(gl); }
    },
  },
};
