'use strict';
// 이야기: 일지, 대화, 목표, 정해진 장면, 엔딩

const Story = (() => {
  const S = {};
  S.flags = {};
  const F = () => S.flags;

  S.KEYS = {
    key_office: '교무실 열쇠 — 녹슨 고리에 "교무"',
    key_music: '음악실 열쇠 — 높은음자리표 열쇠고리',
    key_sci: '과학실 열쇠 — 서하의 서랍에서',
    key_broad: '방송실 열쇠 — 아이의 차가운 손에 쥐여 있던 것',
    nametag: '낡은 명찰 — "윤서하". 불에 그을렸다',
  };

  S.DOCS = {
    d1: { page: true, title: '누군가의 일지 ①', date: '2006년 10월 30일 (월)', text:
`담임이 바뀐 지 한 달.
한 선생님은 출석에 집착한다.

오늘은 화장실에 다녀온 지수를 '결석'으로 적었다. 1분 늦었다고.
다들 웃었는데, 지수는 웃지 않았다.

선생님은 출석부를 절대 손에서 놓지 않는다.
잠깐 내려놓을 때도 손바닥을 그 위에 얹어 둔다.
마치 무언가 빠져나갈까 봐 누르고 있는 것처럼.` },
    d2: { page: true, title: '누군가의 일지 ②', date: '2006년 10월 31일 (화)', text:
`지수가 오늘 학교에 안 왔다.

아니, 이상하다. 아무도 지수를 기억하지 못한다.
지수 자리에 앉은 애한테 물었더니 "거기 원래 빈자리였잖아" 라고 했다.

몰래 본 출석부.
지수 이름 옆에 빨간 글씨로 — 결석.

이름이 저기 적히면, 그 사람은 지워진다.
나만 기억하고 있다. 나만.` },
    d3: { page: true, title: '한 선생의 메모', date: '11월 1일', style: 'typed', text:
`아이들이 빠져나간다. 하나, 둘.

서른 명이 모두 자리에 앉아 있어야 수업이 끝난다.
한 명이라도 비면, 이 반은 끝나지 않는다.

오늘 야간 자율 학습은 문을 잠그고 한다.
아무도 나가지 않는다. 아무도.

방송실 열쇠는 음악실 그 아이에게 맡겼다.
그 애는 피아노를 멈추지 않으니까.` },
    d4: { page: true, title: '누군가의 일지 ③', date: '2006년 11월 1일 (수) 밤', text:
`방송실 쪽에서 타는 냄새가 난다.
문이 안 열린다. 창문도.

스피커에서 선생님이 출석을 부른다.
한 명씩. 번호를. 이름을.

대답한 애들은 그대로 자리에 앉아서
다시는 움직이지 않는다.

대답하지 마. 숨어. 불빛을 끄고.
움직이지 마. 그럼 못 찾아.

반장인 내가 열쇠를 받아서— ` },
    d5: { page: true, title: '누군가의 일지 ④ (마지막 장)', date: '날짜를 알 수 없음', style: 'burnt', text:
`누군가 이걸 읽는다면.

나는 이제 내 이름이 기억나지 않는다.
출석부에서 이름이 지워지면, 나도 지워진다.

보건실 맨 안쪽 침대, 베개 밑에
내 명찰을 숨겨 뒀어.

그걸 찾으면, 나한테 돌려줘.
그리고 불러 줘.

대답 말고, 이름을.` },
  };

  // 줍는 물건들 (kind: 종류, label: 손을 댔을 때 보이는 이름)
  S.ITEMS = [
    { id: 'phone', kind: 'phone', x: 35.25, y: 0.775, z: 6.15, label: '내 휴대폰' },
    { id: 'd1', kind: 'doc', x: 28.55, y: 1.045, z: 5.85, label: '펼쳐진 공책' },
    { id: 'save1', kind: 'candle', x: 28.6, y: 1.04, z: 6.35, label: '촛불 — 기록하기' },
    { id: 'mop', kind: 'weapon', w: 'mop', x: 38.35, y: 0, z: 1.3, label: '대걸레 자루' },
    { id: 'c23band', kind: 'bandage', x: 30.6, y: 0.775, z: 2.3, label: '붕대' },
    { id: 'key_sci', kind: 'key', x: 35.35, y: 0.775, z: 8.1, label: '서하의 서랍 — 과학실 열쇠', req: () => F().metSeoha },
    { id: 'h_bat1', kind: 'battery', x: 20.5, y: 0.05, z: 12.8, label: '배터리' },
    { id: 'h_pill1', kind: 'pills', x: 8, y: 0.05, z: 14.6, label: '진정제' },
    { id: 'h_salt1', kind: 'salt', x: 44, y: 0.05, z: 15.3, label: '소금 봉지' },
    { id: 'h_band1', kind: 'bandage', x: 58, y: 0.05, z: 13.4, label: '붕대' },
    { id: 'save3', kind: 'candle', x: 50.5, y: 0.54, z: 12.6, label: '누군가 켜 둔 촛불 — 기록하기' },
    { id: 'pipe', kind: 'weapon', w: 'pipe', x: 2.3, y: 0, z: 2.0, label: '쇠파이프' },
    { id: 'c21band', kind: 'bandage', x: 6.2, y: 0.775, z: 8.3, label: '붕대' },
    { id: 'c21bat', kind: 'battery', x: 9.4, y: 0.775, z: 4.3, label: '배터리' },
    { id: 'c21salt', kind: 'salt', n: 2, x: 2.6, y: 1.045, z: 6.0, label: '소금 봉지 (2)' },
    { id: 'c22pill', kind: 'pills', x: 15.6, y: 1.045, z: 6.0, label: '진정제' },
    { id: 'c22bat', kind: 'battery', x: 20.8, y: 0.775, z: 10.3, label: '배터리' },
    { id: 'key_office', kind: 'key', x: 17.62, y: 0.47, z: 26.3, label: '변기 위의 열쇠' },
    { id: 'd2', kind: 'doc', x: 9.38, y: 0.94, z: 20.6, label: '젖은 공책 한 장' },
    { id: 't_band', kind: 'bandage', x: 12, y: 0.05, z: 25, label: '붕대' },
    { id: 'd3', kind: 'doc', x: 21.4, y: 0.785, z: 18.85, label: '타자로 친 메모' },
    { id: 'book', kind: 'book', x: 26, y: 0.81, z: 25.55, label: '출석부' },
    { id: 'key_music', kind: 'key', x: 19.06, y: 1.5, z: 21.5, label: '열쇠 걸이 — 음악실 열쇠' },
    { id: 'o_pill', kind: 'pills', x: 28.6, y: 0.785, z: 24.2, label: '진정제' },
    { id: 'o_bat', kind: 'battery', x: 33, y: 0.05, z: 25.5, label: '배터리' },
    { id: 'save2', kind: 'candle', x: 37.5, y: 0.78, z: 18.2, label: '촛불 — 기록하기' },
    { id: 'n_band', kind: 'bandage', n: 2, x: 36.7, y: 0.78, z: 24.5, label: '붕대 (2)' },
    { id: 'd4', kind: 'doc', x: 37.05, y: 0.78, z: 24.5, label: '구겨진 공책' },
    { id: 'n_pill', kind: 'pills', x: 37.35, y: 0.78, z: 24.5, label: '진정제' },
    { id: 'n_bat', kind: 'battery', x: 44.6, y: 0.7, z: 18.8, label: '배터리' },
    { id: 'nametag', kind: 'key', x: 45.4, y: 0.8, z: 25.2, label: '베개 밑 — 낡은 명찰' },
    { id: 'd5', kind: 'doc', x: 56, y: 0.945, z: 4.5, label: '불에 그을린 공책' },
    { id: 'axe', kind: 'weapon', w: 'axe', x: 59.2, y: 1.4, z: 1.2, label: '소방 도끼' },
    { id: 's_salt', kind: 'salt', n: 2, x: 59.6, y: 0.945, z: 8.2, label: '소금 봉지 (2)' },
    { id: 's_band', kind: 'bandage', x: 56, y: 0.945, z: 8.2, label: '붕대' },
    { id: 'm_salt', kind: 'salt', x: 42, y: 0.05, z: 10.2, label: '소금 봉지' },
  ];

  // ---------- 목표 ----------
  const has = k => Game.P.keys.includes(k);
  S.questText = () => {
    const f = F();
    if (!f.phone) return '책상 위에서 빛나는 휴대폰을 집자';
    if (!f.d23open) return f.jamTried ? (has('mop') || Game.P.weapons.includes('mop') ? '대걸레 자루로 교실 문을 비틀어 열자' : '문틈에 끼울 만한 것을 찾자 (교실 뒤쪽)') : '교실에서 나가자';
    if (!f.metSeoha) return f.seohaSeen ? '2학년 2반으로 들어간 아이를 따라가자' : '복도를 살펴보자';
    if (!has('key_office') && !f.officeEnter) return '화장실에서 교무실 열쇠를 찾자';
    if (!f.book) return '교무실의 출석부를 찾자';
    if (!f.officeClear) return '살아남자';
    if (!has('key_music') && !f.musicEnter) return '교무실 열쇠 걸이에서 음악실 열쇠를 챙기자';
    if (!f.pianistDead) return f.musicEnter ? '피아노를 조사하자' : '음악실로 가자';
    if (!f.bossDead) return f.broadEnter ? '살아남자 — 이름이 불리면 움직이지 말고 불을 꺼' : '방송실로 가자 (복도 끝 촛불에서 기록해 두자)';
    if (!f.finalChoice) return '떨어진 출석부를 집자';
    return '중앙 계단으로 내려가자';
  };
  S.questLog = () => {
    const f = F();
    const list = [
      { t: '2학년 3반에서 나가기', done: !!f.d23open },
      { t: '복도 끝의 아이 만나기', done: !!f.metSeoha },
      { t: '교무실 열쇠 찾기 (화장실)', done: has('key_office') || !!f.officeEnter },
      { t: '출석부 조사하기 (교무실)', done: !!f.book },
      { t: '음악실 피아노 조사하기', done: !!f.pianistDead },
      { t: '방송실 — 담임', done: !!f.bossDead },
      { t: '중앙 계단으로 나가기', done: !!f.ending },
    ];
    if (f.metSeoha) list.push({ t: '(선택) 과학실 — 서하가 숨겨 둔 것', done: Game.P.docs.includes('d5') });
    if (Game.P.docs.includes('d5')) list.push({ t: '(선택) 보건실 침대의 명찰을 서하에게 돌려주기', done: !!f.nameReturned });
    return list;
  };
  let lastQuest = '';
  S.refreshQuest = () => { const q = S.questText(); if (q !== lastQuest) { lastQuest = q; UI.quest(q); } };

  // ---------- 서하 ----------
  let seoha = null;
  function makeSeoha() {
    if (seoha) return seoha;
    const m = Ents.buildStudent({ face: 'girl', seed: 5, uniform: 0x5a5c62, skin: 0x8e8e8c, glow: 0x0b0d10, noEyes: true, hairLen: 0.7 });
    m.mats.forEach(mt => { mt.transparent = true; mt.opacity = 0.92; });
    seoha = { m, obj: m.group, x: 0, z: 0, yaw: 0, path: [], alpha: 0, target: 0.92, sit: false, onArrive: null };
    m.body.traverse(o => { if (o.isMesh) { o.userData.npc = seoha; Game.interactables.push(o); } });
    Game.scene.add(m.group);
    m.group.visible = false;
    return seoha;
  }
  S.seohaAt = (x, z, yaw, sit = false) => {
    const s = makeSeoha();
    s.x = x; s.z = z; s.yaw = yaw; s.sit = sit; s.path = []; s.target = 0.92; s.alpha = 0.01;
    s.obj.visible = true;
    s.talk = null;
    return s;
  };
  S.seohaGo = (pts, onArrive) => { if (!seoha) return; seoha.path = pts.slice(); seoha.onArrive = onArrive; seoha.sit = false; };
  S.seohaFade = () => { if (seoha) seoha.target = 0; };
  function updateSeoha(dt, t) {
    const s = seoha;
    if (!s || !s.obj.visible) return;
    s.alpha += (s.target - s.alpha) * Math.min(1, dt * 2);
    s.m.mats.forEach(mt => { mt.opacity = s.alpha; });
    if (s.target === 0 && s.alpha < 0.02) { s.obj.visible = false; return; }
    let walking = false;
    if (s.path.length) {
      const p = s.path[0], dx = p.x - s.x, dz = p.z - s.z, l = Math.hypot(dx, dz);
      if (l < 0.1) { s.path.shift(); if (!s.path.length && s.onArrive) { const f = s.onArrive; s.onArrive = null; f(); } }
      else { s.x += dx / l * 1.1 * dt; s.z += dz / l * 1.1 * dt; s.yaw = Math.atan2(dx, dz); walking = true; }
    }
    const m = s.m, ph = t * 4;
    s.obj.position.set(s.x, 0, s.z);
    s.obj.rotation.y = s.yaw;
    if (s.sit) {
      m.legs.forEach(l => { l.rotation.x = -1.45; });
      m.body.position.y = -0.36;
      m.arms.forEach(a => { a.rotation.x = -0.7; });
      m.head.rotation.x = 0.45;
    } else {
      m.body.position.y = 0;
      m.legs[0].rotation.x = walking ? Math.sin(ph) * 0.4 : 0;
      m.legs[1].rotation.x = walking ? -Math.sin(ph) * 0.4 : 0;
      m.arms.forEach(a => { a.rotation.x = 0; });
      m.head.rotation.x = 0.25 + Math.sin(t * 0.7) * 0.05;
    }
    m.head.rotation.z = Math.sin(t * 0.5) * 0.08;
  }
  S.onNPC = npc => {
    if (npc !== seoha || seoha.alpha < 0.3) return false;
    if (seoha.talk) { seoha.talk(); return true; }
    Game.dialog([{ s: '서하', t: ['…….', '서둘러.', '여긴 오래 있으면 안 돼.'][Math.random() * 3 | 0] }]);
    return true;
  };

  // ---------- 시작 ----------
  S.reset = save => {
    S.flags = save ? JSON.parse(JSON.stringify(save.flags)) : {};
    if (seoha) { Game.scene.remove(seoha.obj); seoha = null; }
    prevRoom = null;
    lastQuest = '';
    timers.length = 0;
    S.restoreState();
  };
  // 불러올 때 장면을 맞춰 둔다
  S.restoreState = () => {
    const f = F();
    if (f.chairs) World.chairsFace('c23', 29, 11); else World.chairsReset('c23');
    if (f.d23open) { World.unlock(World.door('d23')); }
    if (f.bossDead) World.unlock(World.door('dbro'));
    if (f.finalChoice && f.finalChoice !== 'stay') World.unlock(World.door('dsta'));
    if (f.metSeoha && !f.pianistDead) { /* 서하는 숨어 있다 */ }
    World.mode = 'normal';
    World.darkRooms.clear();
    if (f.book && !f.officeClear) World.mode = 'red';
    if (f.pianistDead && !f.seoha2) { S.seohaAt(48, 6, -Math.PI / 2); seoha.talk = seohaTalk2; }
    if (f.bossDead && !f.finalChoice) S.seohaAt(55, 19, 0);
    if (f.chairs && !f.seohaSeen) S.seohaAt(17.5, 13.6, Math.PI / 2);
  };

  S.intro = () => [
    '6교시, 수학 시간.',
    '창밖으로 오후 햇살이 따뜻하게 들어오고 있었다.',
    '선생님의 목소리가 점점 멀어졌다.',
    '……잠깐만, 눈을 붙이기로 했다.',
    '딩— 동— 댕— 동—',
    '종소리가, 이상하게 느렸다.',
  ];

  S.wake = () => {
    Game.dialog([
      { s: '{name}', t: '……으, 목 아파.' },
      { s: '{name}', t: '몇 시지? 왜 이렇게 어두워…?' },
      { s: '{name}', t: '애들은… 다 어디 갔어?' },
      { t: '교실은 먼지 냄새로 가득했다. 마치 몇십 년 동안 아무도 들어오지 않은 것처럼.' },
    ]).then(() => {
      F().wake = true;
      S.refreshQuest();
      UI.tip('<kbd>WASD</kbd> 이동 · 마우스로 둘러보기 · <kbd>E</kbd> 조사하기', 8);
    });
  };

  // ---------- 물건을 주웠을 때 ----------
  S.onPickup = it => {
    const f = F();
    if (it.id === 'phone') {
      f.phone = true;
      Game.dialog([
        { t: '휴대폰 화면이 켜졌다.' },
        { t: '16:44 — 2006년 11월 1일 (수)', fx: () => Sound.static(0.4, 0.1) },
        { s: '{name}', t: '2006년…? 고장 났나. 신호도 없네.' },
        { s: '{name}', t: '손전등이라도 켜자.' },
      ]).then(() => {
        Game.setLight(true);
        UI.tip('<kbd>F</kbd> 손전등 켜기/끄기 · 배터리가 닳아요. 끄면 귀신이 나를 잘 못 찾아요.', 8);
        S.refreshQuest();
      });
    }
    if (it.id === 'mop') {
      Game.dialog([{ t: '부러진 대걸레 자루. 손에 쥐니 조금 안심이 된다.' }]).then(() => {
        UI.tip('마우스 <kbd>왼쪽</kbd> 휘두르기 · 휘두르면 기력이 줄어요', 7);
        S.refreshQuest();
      });
    }
    if (it.id === 'key_office') {
      f.keyOffice = true;
      Game.later(0.9, () => {
        World.darkRooms.add('toilet');
        Sound.static(0.6, 0.25);
        Game.later(1.2, () => {
          Game.scare('hollow');
          spawnGroup('toilet');
          Game.later(1.4, () => { World.darkRooms.delete('toilet'); S.refreshQuest(); });
        });
      });
    }
    if (it.id === 'key_music') S.refreshQuest();
    if (it.id === 'key_broad') S.refreshQuest();
    if (it.id === 'key_sci') Game.dialog([{ t: '서랍 깊숙이, 테이프로 붙여 둔 열쇠가 있었다. "과학실".' }]);
    if (it.id === 'nametag') {
      f.nametag = true;
      Game.dialog([
        { t: '베개 밑에서 작은 명찰이 나왔다. 한쪽이 불에 그을려 있다.' },
        { t: '"윤서하"' },
        { s: '{name}', t: '……서하.' },
      ]);
    }
    if (it.id === 'd5') Game.later(0.3, () => S.refreshQuest());
    if (it.id === 'axe') UI.tip('소방 도끼 — 느리지만 아주 강해요. <kbd>1</kbd>~<kbd>3</kbd> 으로 무기를 바꿔요.', 7);
    if (it.id === 'pipe') UI.tip('쇠파이프 — <kbd>1</kbd>~<kbd>3</kbd> 으로 무기를 바꿔요.', 6);
  };

  // ---------- 정해진 물건 조사 ----------
  S.onUse = (name, obj) => {
    const f = F();
    if (name === 'board_c23') {
      Game.dialog([
        { t: '칠판에 분필로 쓴 글씨. "7교시 — 자습. 아무도 나가지 마시오."' },
        { t: '구석에는 "결석 30" 이라고 적혀 있다.' },
        { s: '{name}', t: '7교시…? 우리 학교는 6교시까지밖에 없는데.' },
      ]);
      return true;
    }
    if (name === 'vase') {
      Game.dialog([{ t: '책상 위에 흰 국화 한 송이가 꽂혀 있다. 꽃잎은 오래전에 말라 있었다.' }, { s: '{name}', t: '…내 옆자리였는데.' }]);
      return true;
    }
    if (name === 'mirror') {
      if (!f.mirrorSeen && f.keyOffice) { f.mirrorSeen = true; Game.scare('grin'); return true; }
      Game.dialog([{ t: '금이 간 거울. 내 얼굴이 희미하게 비친다.' }, { t: '…내 뒤에도 누군가 서 있는 것 같다.' }]);
      return true;
    }
    if (name === 'piano') {
      if (f.pianistDead) { Game.dialog([{ t: '건반 하나가 아직 눌린 채로 있다.' }]); return true; }
      if (f.pianoStart) return true;
      startPianist();
      return true;
    }
    if (name === 'skeleton') {
      Game.dialog([{ t: '인체 골격 모형. 목이 조금씩 이쪽으로 돌아가 있는 것 같은 건… 기분 탓이겠지.' }]);
      if (World.named.skeleton) World.named.skeleton.rotation.y += 0.4;
      return true;
    }
    return false;
  };

  // 문을 조사했을 때 (잠긴 문 대사)
  S.onDoor = d => {
    const f = F();
    if (d.lock === 'jam') {
      if (!Game.P.weapons.includes('mop')) {
        f.jamTried = true;
        Sound.locked({ x: d.x + 1, z: d.z + 0.5 });
        Game.dialog([{ t: '문이 꿈쩍도 하지 않는다. 밖에서 무언가 걸려 있는 것 같다.' }, { s: '{name}', t: '문틈에 끼워서 비틀 만한 게 있으면…' }]).then(S.refreshQuest);
        return true;
      }
      Game.dialog([{ t: '대걸레 자루를 문틈에 끼우고, 온몸으로 비틀었다—' }]).then(() => {
        Sound.creak({ x: d.x + 1, z: d.z + 0.5 });
        Game.shake(0.3);
        World.unlock(d);
        World.setDoor(d, true);
        f.d23open = true;
        S.refreshQuest();
      });
      return true;
    }
    if (d.lock === 'seal') {
      Sound.locked({ x: d.x + 1, z: d.z + 0.5 });
      Game.dialog([{ t: '굵은 쇠사슬이 문손잡이를 칭칭 감고 있다. 자물쇠에는 빨간 글씨로 — "수업 중".' }]);
      return true;
    }
    if (d.lock === 'boss') { Sound.locked({ x: d.x + 1, z: d.z + 0.5 }); UI.sub('', '문이 열리지 않는다!', 2); return true; }
    return false;
  };
  S.lockedText = { key_office: '잠겨 있다. "교무실" — 열쇠가 필요하다.', key_music: '잠겨 있다. 안에서 피아노 소리가…', key_sci: '잠겨 있다. "과학실".', key_broad: '잠겨 있다. 문틈으로 탄 냄새가 새어 나온다.' };

  // ---------- 출석부 (교무실) ----------
  S.onBook = () => {
    const f = F();
    if (f.book) return;
    Game.dialog([
      { t: '낡은 출석부. "2학년 3반".' },
      { t: '서른 개의 이름이 모두 빨간 줄로 그어져 있다. 이름 옆에는 하나같이 — 결석.' },
      { t: '맨 아래, 아직 마르지 않은 잉크로 쓴 줄이 하나 있다.' },
      { t: '"31. {name}"', fx: () => { Sound.sting(); Game.shake(0.2); } },
      { t: '천장의 스피커가 지지직거렸다.', fx: () => Sound.static(1.5, 0.3) },
      { s: '스피커', t: '……31번.', fx: () => Sound.speak('삼십일번') },
      { s: '스피커', t: '31번. {name}.' },
      { s: '', t: '(대답하라는 듯, 정적이 이어진다)', choices: [
        { t: '"…네."', on: () => { f.answered = true; return [{ s: '{name}', t: '…네.' }, { t: '', fx: () => Game.later(0.1, () => S.ending('stay')) }]; } },
        { t: '(입을 꾹 다문다)', on: () => { f.silent = true; Game.addExp(30); return [{ s: '스피커', t: '…………결석인가.' }, { s: '서하', t: '(어디선가 속삭임) 잘했어. 절대 대답하지 마.', fx: () => Sound.whisper(2) }]; } },
        { t: '"누구야! 나와!"', on: () => { Game.P.san = Math.max(5, Game.P.san - 25); return [{ s: '스피커', t: '지각에, 떠들기까지.', fx: () => Sound.speak('지각이구나') }, { s: '스피커', t: '벌을 받아야지.' }]; } },
      ] },
    ]).then(() => {
      if (f.answered) return;
      f.book = true;
      World.mode = 'red';
      Sound.boom();
      spawnGroup('office');
      S.refreshQuest();
      UI.big('살아남아라', 2.2, 'red');
    });
  };

  // ---------- 무리 지어 나타나는 귀신 ----------
  const GROUPS = {
    toilet: [['crawler', 12.6, 18.2], ['shadow', 22, 14]],
    office: [['shadow', 31, 25.5], ['shadow', 20.5, 25.5], ['crawler', 25.5, 15.2]],
    c21: [['shadow', 5, 4], ['shadow', 9.5, 8.5]],
    sci: [['crawler', 55, 9.5], ['crawler', 60.5, 6]],
    roam1: [['shadow', 45, 14]],
  };
  function spawnGroup(id, alert = true) {
    const f = F();
    f['grp_' + id] = true;
    const killed = f.killed || [];
    GROUPS[id].forEach(([type, x, z], i) => {
      const eid = id + '_' + i;
      if (killed.includes(eid)) return;
      Game.spawn(type, x, z, { id: eid, alert, rise: true });
    });
  }
  S.spawnGroup = spawnGroup;
  S.groupAlive = id => Game.enemies.some(e => !e.dead && e.id && e.id.startsWith(id + '_'));
  S.respawnGroups = () => { Object.keys(GROUPS).forEach(id => { if (F()['grp_' + id]) spawnGroup(id, false); }); };

  // ---------- 음악실 ----------
  let lullT = 0;
  function startPianist() {
    const f = F();
    f.pianoStart = true;
    Sound.piano(130.8, 0, 0.5); Sound.piano(138.6, 0, 0.5);
    World.darkRooms.add('music');
    Game.later(1.2, () => {
      const e = Game.spawn('pianist', 50.5, 3.4, { id: 'pianist', alert: true });
      e.ai = Ents.pianistAI;
      e.tele = 2.5;
      Game.boss(e);
      UI.big('건반 위의 아이', 2.4, 'red');
      UI.tip('빛에 오래 비추면 움찔해요 (<kbd>오른쪽 꾹</kbd>). 움찔한 동안 때리면 두 배로 아파해요.', 8);
    });
  }
  function seohaTalk2() {
    const f = F();
    const lines = [
      { s: '서하', t: '그 애, 피아노를 정말 좋아했어. 그날도 마지막까지 치고 있었어.' },
      { s: '서하', t: '방송실. 불이 시작된 곳이야. 선생님은 아직도 거기서 출석을 불러.' },
      { s: '서하', t: '그가 번호를 부르면 — 움직이지 말고, 불을 꺼. 그럼 너를 못 찾아.' },
      { s: '', t: '', choices: [
        { t: '"넌 왜 나를 도와줘?"', on: () => [{ s: '서하', t: '…반장이니까. 마지막 한 명까지 집에 보내는 게, 내 일이었어.' }] },
        { t: '"무서워."', on: () => [{ s: '서하', t: '나도. 근데 넌 아직 나갈 수 있잖아.' }] },
      ] },
    ];
    if (Game.P.keys.includes('nametag') && !f.nameReturned) lines.push(...returnName());
    lines.push({ s: '서하', t: '가. 복도 끝 촛불 옆에서 숨을 고르고.' });
    Game.dialog(lines).then(() => { f.seoha2 = true; seoha.talk = null; S.seohaFade(); S.refreshQuest(); });
  }
  function returnName() {
    const f = F();
    return [
      { s: '{name}', t: '이거… 네 거지? 보건실 침대에 있었어.' },
      { t: '명찰을 내밀었다. 그을린 글씨가 손전등 빛에 반짝였다.' },
      { s: '{name}', t: '윤서하.', fx: () => { f.nameReturned = true; Sound.save(); } },
      { s: '서하', t: '…….' },
      { s: '서하', t: '아. 맞아. 서하. 내 이름이야.' },
      { s: '서하', t: '이십 년 동안 아무도 안 불러 줬는데. …고마워.' },
    ];
  }

  // ---------- 방송실 (마지막) ----------
  function startBoss() {
    const f = F();
    f.broadEnter = true;
    const d = World.door('dbro');
    World.setDoor(d, false);
    d.lock = 'boss';
    Sound.slam({ x: 54, z: 16.5 });
    Game.later(0.8, () => { Sound.feedback(); UI.sub('스피커', '지지지직— 출석을, 부르겠다.', 3); Sound.speak('출석을 부르겠다', 0.1, 0.6); });
    const e = Game.spawn('teacher', 54.5, 24.2, { id: 'teacher', yaw: 0 });
    e.ai = Ents.teacherAI;
    e.state = 'intro'; e.callT = 10;
    Game.later(2.6, () => {
      e.state = 'chase';
      Game.boss(e);
      UI.big('담임 — 끝나지 않는 출석', 2.6, 'red');
      UI.tip('이름이 불리면: 움직이지 말고 <kbd>F</kbd> 로 불을 꺼요. 버티면 담임이 비틀거려요.', 9);
      S.refreshQuest();
    });
  }

  S.onKill = e => {
    const f = F();
    if (e.id) { f.killed = f.killed || []; f.killed.push(e.id); }
    if (e.id === 'pianist') {
      f.pianistDead = true;
      World.darkRooms.delete('music');
      Game.boss(null);
      Game.placeItem({ id: 'key_broad', kind: 'key', x: e.x, y: 0.05, z: e.z, label: '작은 손이 쥐고 있던 열쇠' });
      Game.later(2.5, () => {
        S.seohaAt(48, 6, -Math.PI / 2);
        seoha.talk = seohaTalk2;
        UI.sub('', '누군가 피아노 의자 옆에 서 있다…', 3);
      });
      S.refreshQuest();
    }
    if (e.id === 'teacher') {
      f.bossDead = true;
      World.mode = 'normal';
      Game.boss(null);
      const d = World.door('dbro');
      d.lock = null;
      Game.enemies.forEach(o => { if (!o.dead) o.damage(999); });
      Game.later(1.5, () => {
        UI.sub('담임', '……수업이… 아직… 안……', 3);
        Game.placeItem({ id: 'book2', kind: 'book2', x: e.x, y: 0.05, z: e.z, label: '출석부' });
        S.seohaAt(55, 19, 0);
        S.refreshQuest();
      });
    }
    if (e.id && e.id.startsWith('office_') && !S.groupAlive('office')) {
      f.officeClear = true;
      World.mode = 'normal';
      Game.later(1, () => { UI.sub('서하', '(속삭임) …음악실. 피아노 소리를 따라가.', 4); Sound.whisper(2); S.refreshQuest(); });
    }
  };

  S.onFinalBook = () => {
    const f = F();
    const lines = [
      { t: '출석부가 바닥에 펼쳐져 있다. 서른한 개의 이름. 페이지 사이에 볼펜이 꽂혀 있다.' },
    ];
    if (Game.P.keys.includes('nametag') && !f.nameReturned) lines.push(...returnName());
    lines.push({ s: '서하', t: f.nameReturned ? '서하. 내 이름도… 거기 있어.' : '…어떻게 할 거야?' });
    lines.push({ s: '', t: '', choices: [
      { t: '출석부를 찢어 버린다', on: () => { f.finalChoice = 'tear'; return [
        { t: '종이가 찢어지는 소리가 복도 끝까지 울렸다.', fx: () => { Sound.page(); Game.shake(0.3); } },
        { s: '서하', t: '……그래. 이제 문이 열릴 거야.' },
        { s: '서하', t: '넌 가. 난… 아직 여기 있어야 할 것 같아.' },
      ]; } },
      { t: '모든 이름 옆에 "하교" 라고 적는다', req: () => f.nameReturned, on: () => { f.finalChoice = 'free'; return [
        { t: '한 줄, 한 줄. 서른 개의 이름 옆에 또박또박 적었다. — 하교.' },
        { t: '마지막 줄. "윤서하 — 하교."', fx: () => Sound.save() },
        { t: '복도 어딘가에서, 아주 오랜만에, 평범한 종소리가 울렸다.', fx: () => Sound.bell(false) },
        { s: '서하', t: '{name}. …고마워.' },
        { s: '서하', t: '우리 다 같이, 집에 가자.' },
      ]; } },
      { t: '내 이름 옆에 "출석" 이라고 적는다', on: () => { f.finalChoice = 'stay'; return [{ t: '', fx: () => Game.later(0.1, () => S.ending('stay')) }]; } },
    ] });
    Game.dialog(lines).then(() => {
      if (f.finalChoice === 'stay' || !f.finalChoice) return;
      Game.removeItem('book2');
      World.unlock(World.door('dsta'));
      S.seohaFade();
      Sound.slam({ x: 4, z: 16.5 });
      UI.sub('', '멀리서 쇠사슬이 끊어지는 소리가 났다.', 3);
      S.refreshQuest();
      Game.save(true);
    });
  };

  // ---------- 엔딩 ----------
  S.ENDINGS = {
    free: { no: 1, title: '졸업', sub: '모두가 집으로 돌아갔다', lines: [
      '계단을 내려갈수록 공기가 따뜻해졌다.',
      '등 뒤에서 서른 개의 발소리가 따라왔다. 무섭지 않았다.',
      '1층 현관에서, 누군가 내 어깨를 가볍게 두드렸다.',
      '"안녕, 31번. 아니— {name}."',
      '돌아보았을 때, 처음으로 그 애의 얼굴을 보았다. 웃고 있었다.',
      '……',
      '눈을 떴다. 6교시가 끝나는 종이 울리고 있었다.',
      '오후 햇살. 떠드는 아이들. 평범한 교실.',
      '책상 서랍 안에, 기억에 없는 낡은 명찰이 하나 들어 있었다.',
      '"윤서하"',
    ] },
    tear: { no: 2, title: '하교', sub: '아직 끝나지 않았다', lines: [
      '계단을 뛰어 내려갔다. 뒤돌아보지 않았다.',
      '현관문을 밀자 차가운 바람이 얼굴을 때렸다.',
      '……',
      '눈을 떴다. 6교시 수학 시간.',
      '꿈이었구나. 길게 숨을 내쉬며 칠판을 보았다.',
      '"7교시 — 자습."',
      '선생님이 천천히 뒤를 돌아보았다.',
      '"출석 부르겠다. ……31번."',
    ] },
    stay: { no: 3, title: '31번', sub: '영원한 7교시', lines: [
      '대답하는 순간, 몸이 의자에 달라붙었다.',
      '교실의 불이 하나씩 켜졌다.',
      '서른 명의 아이들이 고개를 숙인 채 앉아 있었다.',
      '모두, 얼굴이 없었다.',
      '교탁 앞의 그가 출석부에 무언가를 적었다. 사각, 사각.',
      '"좋아. 이제 다 모였구나."',
      '"수업을 시작한다."',
    ] },
  };
  S.ending = kind => { F().ending = kind; Game.endGame(kind); };

  // ---------- 매 프레임: 장면 발동 ----------
  const timers = [];
  S.later = (sec, fn) => timers.push({ t: sec, fn });
  let prevRoom = null;
  S.update = (dt, t) => {
    const f = F(), P = Game.P;
    for (let i = timers.length - 1; i >= 0; i--) { timers[i].t -= dt; if (timers[i].t <= 0) { const fn = timers[i].fn; timers.splice(i, 1); fn(); } }
    updateSeoha(dt, t);
    if (F().wake) S.refreshQuest();
    const room = World.roomAt(P.x, P.z);
    const rid = room ? room.id : null;
    if (rid !== prevRoom) { enterRoom(rid, prevRoom); prevRoom = rid; }

    // 교실을 나서자 의자들이 일제히 문을 본다
    if (f.d23open && !f.chairs && rid === 'hall') {
      f.chairs = true;
      World.chairsFace('c23', 29, 11);
      Sound.chairs({ x: 33, z: 6 });
      Game.later(2.2, () => {
        Sound.bell(true);
        Game.later(7.5, () => {
          Sound.static(2, 0.2);
          UI.sub('교내 방송', '……7교시를 시작합니다. 모든 학생은… 자리로……', 4.5);
          S.seohaAt(17.5, 13.6, Math.PI / 2);
        });
      });
    }
    // 복도 끝의 아이
    if (f.chairs && !f.seohaSeen && seoha && seoha.obj.visible && Math.abs(P.x - seoha.x) < 10 && rid === 'hall') {
      f.seohaSeen = true;
      S.refreshQuest();
      S.seohaGo([{ x: 16, z: 12.6 }, { x: 16, z: 10.2 }], () => { S.seohaFade(); });
      World.setDoor(World.door('d22'), true);
      Game.later(3, () => {
        if (!f.tutorialSpawn) {
          f.tutorialSpawn = true;
          Game.spawn('shadow', 34, 13.5, { id: 'tutorial', alert: true, rise: true });
          UI.tip('결석생 — <kbd>왼쪽</kbd> 클릭으로 때리고, <kbd>오른쪽</kbd> 을 꾹 누르면 빛을 모아 움츠러들게 해요.', 9);
        }
      });
    }
    // 2반 안쪽에 앉은 서하
    if (f.seohaSeen && !f.metSeoha && rid === 'c22' && !f.seohaSit) {
      f.seohaSit = true;
      const p = World.deskSpot('c22', 1, 1);
      S.seohaAt(p.x + 0.5, p.z, -Math.PI / 2, true);
      seoha.talk = seohaTalk1;
    }
    if (f.seohaSit && !f.metSeoha && rid === 'c22' && seoha && !seoha.obj.visible) { const p = World.deskSpot('c22', 1, 1); S.seohaAt(p.x + 0.5, p.z, -Math.PI / 2, true); seoha.talk = seohaTalk1; }
    // 음악실 자장가
    if (rid === 'music' && !f.pianoStart) {
      lullT -= dt;
      if (lullT <= 0) {
        lullT = 3.2;
        [329.6, 293.7, 261.6, 293.7, 329.6, 329.6, 329.6].forEach((fq, i) => Sound.piano(fq * 0.995, i * 0.42, 0.13, { x: 50.5, z: 2 }));
      }
    }
    // 다 끝나면 계단으로
    if (f.finalChoice && f.finalChoice !== 'stay' && rid === 'stair' && !f.ending) S.ending(f.finalChoice);
  };

  function enterRoom(rid, prev) {
    const f = F();
    if (!rid) return;
    if (rid === 'toilet' && !f.toiletEnter) {
      f.toiletEnter = true;
      Game.later(1.5, () => { World.stalls[2].bang = 2.4; Sound.whisper(2.5); });
    }
    if (rid === 'office' && !f.officeEnter) {
      f.officeEnter = true;
      Game.later(1, () => { Sound.vibrate(); UI.sub('', '주머니 속 휴대폰이 떨린다. 화면에는 — "31".', 3.5); });
      S.refreshQuest();
    }
    if (rid === 'c21' && !f.grp_c21) spawnGroup('c21', false);
    if (rid === 'sci' && !f.grp_sci) { spawnGroup('sci', true); Sound.giggle({ x: 58, z: 6 }); }
    if (rid === 'music' && !f.musicEnter) { f.musicEnter = true; S.refreshQuest(); }
    if (rid === 'broad' && !f.broadEnter && !f.bossDead) startBoss();
    if (rid === 'nurse' && !f.nurseEnter) { f.nurseEnter = true; UI.sub('', '소독약 냄새. 이상하게 여기선 숨이 좀 쉬어진다.', 3.5); }
  }

  function seohaTalk1() {
    const f = F();
    Game.dialog([
      { s: '서하', t: '……너, 아직 숨 쉬고 있구나.' },
      { s: '', t: '', choices: [
        { t: '"넌 누구야?"', on: () => [{ s: '서하', t: '반장. …이었어. 이름은, 잘 기억이 안 나.' }] },
        { t: '"여기 어디야? 우리 학교 맞아?"', on: () => [{ s: '서하', t: '2006년 11월 1일. 야간 자율 학습, 7교시.' }, { s: '서하', t: '여긴 그날에서 한 번도 끝나지 않았어.' }] },
        { t: '(조용히 다가간다)', on: () => [{ s: '서하', t: '더 가까이 오지 마. …내 얼굴, 보면 안 돼.' }] },
      ] },
      { s: '서하', t: '선생님이 출석부를 채우고 있어. 서른 명. 한 자리가 비었거든.' },
      { s: '서하', t: '……네 자리야. 31번.' },
      { s: '{name}', t: '무슨 소리야. 난 그냥 수업 시간에 잠들었을 뿐이야.' },
      { s: '서하', t: '나가고 싶으면 교무실로 가. 출석부가 거기 있어.' },
      { s: '서하', t: '교무실 열쇠는… 그날 내가 화장실에 떨어뜨렸어. 맨 끝 칸.' },
      { s: '서하', t: '그리고 하나만 기억해. 누가 네 번호를 불러도, 절대 대답하지 마.' },
      { s: '', t: '', choices: [
        { t: '"같이 나가자."', on: () => { f.promise = true; return [{ s: '서하', t: '…그럴 수 있으면 좋겠다.' }]; } },
        { t: '"알았어."', on: () => [{ s: '서하', t: '응.' }] },
      ] },
      { s: '서하', t: '3반, 네 옆자리. 내 책상 서랍에 과학실 열쇠가 있어. 거기… 내가 숨겨 둔 게 있어.' },
      { s: '서하', t: '시간이 되면 찾아봐.' },
    ]).then(() => {
      f.metSeoha = true;
      seoha.talk = null;
      S.seohaFade();
      Game.addExp(20);
      Game.showItem('key_sci');
      S.refreshQuest();
    });
  }

  return S;
})();
