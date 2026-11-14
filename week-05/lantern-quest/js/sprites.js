'use strict';
// 모든 그림 — 영웅 6명, 몬스터 24종, 아이콘. 사진이나 그림 파일 없이 코드로 한 점씩 그린다.
// 모두 오른쪽을 보도록 그리고, 몬스터는 화면에서 좌우를 뒤집어 그린다.

const EYE = '#1c1424';

// ================= 영웅 =================
function face(P, b, S) {
  P.px(14, 9 + b, EYE); P.px(16, 9 + b, EYE);
  P.px(14, 8 + b, light(S, 0.5));
  P.px(15, 11 + b, dark(S, 0.35));
}

// 영웅 그림 6장: 0·1 서 있기(숨쉬기), 2 무기 들기, 3 휘두르기, 4 주문 외우기, 5 맞기
const POSE = [
  { b: 0 }, { b: 1 },
  { b: 0, arm: -1.05, lean: -1 },
  { b: 0, arm: 1.3, lean: 1.5 },
  { b: 0, arm: -0.6, cast: 1 },
  { b: 1, arm: 0.35, lean: -1.6, hurt: 1 },
];
function drawHumanoid(P, f, o) {
  const ps = POSE[f], b = ps.b, ff = f & 1, g = P.g;
  const S = o.skin, Sd = dark(S, 0.3);
  g.save(); g.translate(ps.lean || 0, 0);
  if (o.back) o.back(P, b, ff);
  if (o.cape) {
    P.poly([[8, 14 + b], [12, 14 + b], [10, 30], [3, 30], [4, 22]], dark(o.cape, 0.3));
    P.poly([[8, 14 + b], [11, 14 + b], [9, 29], [5, 29]], o.cape);
  }
  g.restore();
  if (o.robe) {
    const r = o.robe;
    P.poly([[8, 18 + b], [16, 18 + b], [19, 31], [5, 31]], dark(r, 0.3));
    P.poly([[9, 18 + b], [16, 18 + b], [18, 30], [7, 30]], r);
    P.poly([[13, 18 + b], [15, 18 + b], [17, 30], [14, 30]], light(r, 0.25));
    P.rect(5, 30, 15, 1, o.trim);
  } else {
    const st = ps.arm > 1 ? 1 : ps.lean < 0 ? -1 : 0; // 휘두를 때 앞발을 내딛는다
    P.rect(9 - (st < 0 ? 1 : 0), 23, 3, 6, dark(o.legs, 0.3));
    P.rect(13 + st, 23, 3, 6, o.legs);
    P.rect(8 - (st < 0 ? 1 : 0), 28, 4, 3, dark(o.boots, 0.25));
    P.rect(13 + st, 28, 5, 3, o.boots);
    P.rect(15 + st, 28, 2, 1, light(o.boots, 0.3));
  }
  g.save(); g.translate(ps.lean || 0, 0);
  // 뒤쪽 팔
  P.rect(7, 16 + b, 2, 6, dark(o.sleeve || o.body, 0.4));
  P.rect(7, 21 + b, 2, 2, Sd);
  // 몸통
  P.rect(8, 15 + b, 8, 9, dark(o.body, 0.3));
  P.rect(9, 15 + b, 7, 8, o.body);
  P.rect(12, 15 + b, 3, 3, light(o.body, 0.3));
  if (o.chest) o.chest(P, b);
  P.rect(8, 22 + b, 8, 1, o.belt || '#4a2e22');
  P.px(13, 22 + b, '#e8c060');
  // 목과 얼굴
  P.rect(11, 13 + b, 3, 2, Sd);
  P.ell(12.5, 9.5 + b, 4.6, 4.6, Sd);
  P.ell(12.9, 9.2 + b, 4.1, 4.2, S);
  o.head(P, b, S, ff);
  if (ps.hurt) { P.rect(14, 9 + b, 4, 1, S); P.line(14, 8 + b, 15, 9 + b, EYE); P.line(17, 8 + b, 16, 9 + b, EYE); }
  if (o.offhand) o.offhand(P, b, ff);
  // 앞쪽 팔과 무기: 어깨를 축으로 돌린다
  g.save();
  g.translate(15, 17 + b); g.rotate((ps.arm || 0) * (o.swing ?? 1)); g.translate(-15, -(17 + b));
  P.rect(14, 16 + b, 2, 4, o.sleeve || o.body);
  P.rect(14, 16 + b, 1, 4, dark(o.sleeve || o.body, 0.2));
  P.rect(15, 20 + b, 3, 2, S);
  if (o.weapon) o.weapon(P, b, ff);
  if (ps.cast) {
    g.globalAlpha = 0.35; P.ell(19.5, 5 + b, 5, 5, o.glow || '#ffe8a0');
    g.globalAlpha = 0.7; P.ell(19.5, 5 + b, 2.6, 2.6, o.glow || '#ffe8a0');
    g.globalAlpha = 1; P.ell(19.5, 5 + b, 1.2, 1.2, '#ffffff');
  }
  g.restore();
  g.restore();
}

const HERO_LOOK = {
  knight: {
    skin: '#e0ac80', body: '#5577aa', sleeve: '#7d8a99', legs: '#3b4a63', boots: '#6a4a34', cape: '#b03a48', belt: '#4a2e22',
    chest(P, b) { P.rect(9, 15 + b, 7, 2, '#9aa9b8'); P.rect(11, 17 + b, 3, 1, '#e8c547'); },
    head(P, b, S) {
      P.ell(12.5, 8.5 + b, 5, 5, '#4a5361');
      P.ell(12.3, 8 + b, 4.5, 4.4, '#8796a6');
      P.ell(11.2, 6.4 + b, 2.4, 1.8, '#c4ced8');
      P.rect(13, 9 + b, 5, 4, S);
      P.rect(13, 9 + b, 5, 1, '#4a5361');
      P.px(15, 10 + b, EYE); P.px(17, 10 + b, EYE);
      P.poly([[10, 4 + b], [13, 3 + b], [12, 1 + b], [6, 1 + b], [3, 7 + b], [7, 5 + b]], '#c0392b');
      P.poly([[10, 3 + b], [12, 2 + b], [8, 2 + b], [6, 4 + b]], '#e86a5a');
    },
    swing: 1, glow: '#fff2a8',
    weapon(P, b) {
      P.rect(18, 5 + b, 2, 13, '#dfe6ee'); P.rect(19, 5 + b, 1, 13, '#9aa6b4'); P.px(18, 4 + b, '#dfe6ee');
      P.rect(16, 18 + b, 6, 1, '#c9a227'); P.rect(18, 19 + b, 2, 4, '#6b4226'); P.px(18, 23 + b, '#e8c547');
    },
    offhand(P, b) {
      P.poly([[2, 15 + b], [9, 15 + b], [9, 21 + b], [5.5, 26 + b], [2, 21 + b]], '#7a5a2a');
      P.poly([[3, 16 + b], [8, 16 + b], [8, 21 + b], [5.5, 24 + b], [3, 21 + b]], '#2f5d9e');
      P.rect(3, 17 + b, 5, 1, '#e8c547'); P.rect(5, 16 + b, 1, 7, '#e8c547');
    },
  },
  mage: {
    swing: 0.55, glow: '#7fd8ff',
    skin: '#f1c7a1', body: '#4b3b8f', legs: '#2e2459', boots: '#3a2a22', robe: '#4b3b8f', trim: '#e8c547', belt: '#e8c547',
    head(P, b, S, f) {
      face(P, b, S);
      P.poly([[12, 11 + b], [17, 11 + b], [16, 17 + b], [13, 18 + b], [11, 14 + b]], '#d6d6e2');
      P.poly([[13, 12 + b], [16, 12 + b], [15, 15 + b], [13, 16 + b]], '#ffffff');
      P.rect(6, 5 + b, 14, 2, '#2e2459'); P.rect(7, 5 + b, 12, 1, '#6f5cc4');
      P.poly([[8, 5 + b], [16, 5 + b], [13, 1 + b], [10, 0], [6, 1 + b]], '#4b3b8f');
      P.poly([[11, 5 + b], [15, 5 + b], [13, 1 + b]], '#6f5cc4');
      P.px(12, 3 + b, '#ffe066'); P.px(14, 4 + b, '#ffe066');
    },
    weapon(P, b, f) {
      P.rect(19, 6 + b, 1, 25 - b, '#7a5230'); P.rect(20, 6 + b, 1, 25 - b, '#5a3a22');
      P.ell(19.5, 4 + b, 2.6, 2.6, f ? '#bff0ff' : '#7fd8ff'); P.px(19, 3 + b, '#ffffff');
    },
  },
  cleric: {
    swing: 1, glow: '#fff2a8',
    skin: '#8d5a3b', body: '#ece6d6', sleeve: '#ece6d6', legs: '#c9c0a8', boots: '#8a6a3a', robe: '#e2dccb', trim: '#d9a92e', belt: '#d9a92e',
    chest(P, b) { P.rect(11, 15 + b, 2, 7, '#d9a92e'); P.rect(10, 17 + b, 4, 1, '#d9a92e'); },
    head(P, b, S) {
      face(P, b, S);
      P.ell(12, 9 + b, 5.2, 5.6, '#cfc7b2');
      P.ell(12.2, 8.6 + b, 4.7, 5, '#f6f1e4');
      P.rect(13, 8 + b, 5, 6, S);
      P.ell(13.5, 8 + b, 2.6, 1.2, '#f6f1e4');
      P.px(15, 10 + b, EYE); P.px(17, 10 + b, EYE); P.px(16, 12 + b, dark(S, 0.4));
      P.rect(8, 6 + b, 1, 7, '#d9a92e');
    },
    weapon(P, b, f) {
      P.line(17, 22 + b, 20, 12 + b, '#8a6a3a', 1.5);
      P.ell(20.5, 10 + b, 2.8, 2.8, '#b8860b'); P.ell(20.2, 9.6 + b, 2.2, 2.2, '#f2c94c'); P.px(19, 9 + b, '#fff6c8');
      P.px(20, 6 + b, '#f2c94c'); P.px(23, 10 + b, '#f2c94c'); P.px(17, 10 + b, '#f2c94c');
      if (f) P.px(21, 7 + b, '#fffbe0');
    },
  },
  rogue: {
    skin: '#f3d0b0', body: '#3d3550', legs: '#2a2436', boots: '#4a3428', belt: '#6a4a2a',
    back(P, b, f) { P.poly([[9, 13 + b], [12, 13 + b], [4, 17 + b + f], [1, 15 + b + f]], '#a8323e'); },
    chest(P, b) { P.line(9, 15 + b, 15, 21 + b, '#6a4a2a'); },
    head(P, b, S) {
      P.ell(12.3, 8.6 + b, 5, 5.2, '#2e2840');
      P.ell(12.3, 8.2 + b, 4.5, 4.6, '#4a4064');
      P.rect(13, 8 + b, 5, 3, S);
      P.px(15, 9 + b, EYE); P.px(17, 9 + b, EYE);
      P.rect(13, 11 + b, 5, 3, '#a8323e'); P.rect(13, 11 + b, 5, 1, '#c8505a');
    },
    swing: 0.85, glow: '#c86aff',
    weapon(P, b) {
      P.rect(18, 20 + b, 5, 1, '#dfe6ee'); P.px(22, 19 + b, '#dfe6ee'); P.rect(17, 19 + b, 1, 3, '#c9a227');
    },
    offhand(P, b) { P.rect(6, 22 + b, 1, 4, '#dfe6ee'); P.rect(5, 21 + b, 3, 1, '#c9a227'); },
  },
  ranger: {
    swing: 0.25, glow: '#bff0a8',
    skin: '#c68a5a', body: '#4a7a3a', legs: '#5a4a32', boots: '#6a4a2a', cape: '#3a5a2c', belt: '#6a4a2a',
    back(P, b) { P.rect(4, 11 + b, 3, 10, '#6a4a2a'); P.px(4, 10 + b, '#e8e0c8'); P.px(6, 9 + b, '#d84a3a'); P.px(5, 10 + b, '#e8e0c8'); },
    head(P, b, S) {
      face(P, b, S);
      P.ell(12, 8.4 + b, 5.2, 5, '#2e4a24');
      P.ell(12.2, 8 + b, 4.7, 4.5, '#4a7a3a');
      P.poly([[8, 6 + b], [4, 10 + b], [8, 11 + b]], '#2e4a24');
      P.rect(13, 8 + b, 5, 5, S);
      P.rect(13, 8 + b, 5, 1, '#6a3a22');
      P.px(15, 10 + b, EYE); P.px(17, 10 + b, EYE); P.px(16, 12 + b, dark(S, 0.35));
      P.px(9, 4 + b, '#e86a3a'); P.px(8, 3 + b, '#e86a3a');
    },
    weapon(P, b) {
      for (let y = 7; y <= 29; y++) {
        const x = 19 + Math.round(3 * Math.sin((Math.PI * (y - 7)) / 22));
        P.px(x, y + b * 0, '#8b5a2b'); P.px(x + 1, y, '#5a3a1a');
      }
      P.line(19, 7, 19, 29, '#e8e0c8');
    },
  },
  alchemist: {
    swing: 0.8, glow: '#7af09a',
    skin: '#f5d3b8', body: '#6a8a5a', legs: '#4a3a2e', boots: '#5a3a22', belt: '#5a3a22',
    chest(P, b) {
      P.rect(10, 16 + b, 5, 8, '#8a5a32'); P.rect(10, 16 + b, 5, 1, '#a8744a');
      P.px(9, 22 + b, '#5ae07a'); P.px(15, 22 + b, '#e05a8a');
    },
    head(P, b, S) {
      face(P, b, S);
      P.ell(11, 6.4 + b, 5, 3.4, '#d8642a');
      P.poly([[7, 7 + b], [5, 4 + b], [9, 5 + b], [9, 2 + b], [12, 4 + b], [14, 1 + b], [15, 5 + b], [17, 4 + b], [16, 7 + b]], '#e87a3a');
      P.rect(9, 9 + b, 1, 4, '#d8642a');
      P.rect(10, 6 + b, 8, 2, '#5a3a22'); P.px(13, 6 + b, '#9fe8ff'); P.px(16, 6 + b, '#9fe8ff'); P.px(14, 7 + b, '#5a3a22');
    },
    weapon(P, b, f) {
      P.rect(19, 15 + b, 2, 3, '#c8e0e8'); P.rect(19, 14 + b, 2, 1, '#8a5a32');
      P.ell(20, 20 + b, 3, 3, '#c8e0e8');
      P.ell(20, 21 + b, 2.4, 2, f ? '#7af09a' : '#4ad07a');
      P.px(19, 18 + b, '#ffffff');
    },
  },
};
for (const k in HERO_LOOK) defSprite('hero_' + k, 24, 32, 6, (P, f) => drawHumanoid(P, f, HERO_LOOK[k]));

// ================= 몬스터 =================
function slime(o) {
  return (P, f) => {
    const s = f ? 1 : 0, r = ramp(o.c);
    P.ball(13, 13 + s, 11 + s, 8 - s, r);
    P.rect(4, 20, 18, 1, r[0]);
    if (o.moss) { P.ell(11, 6 + s, 5, 2.5, '#3f7d3a'); P.ell(15, 5.5 + s, 3.5, 2, '#5fa04e'); P.px(13, 3 + s, '#9fe07b'); P.px(9, 5 + s, '#e8e070'); }
    if (o.crack) { P.line(7, 12 + s, 10, 16 + s, o.crack); P.line(10, 16 + s, 9, 19, o.crack); P.line(16, 9 + s, 18, 13 + s, o.crack); P.px(12, 9 + s, o.crack); }
    if (o.shine) { P.px(6, 8 + s, '#ffffff'); P.px(7, 7 + s, '#ffffff'); P.px(20, 7 + s, '#fff6c8'); if (f) P.px(3, 4, '#ffffff'); else P.px(23, 3, '#ffffff'); }
    P.rect(15, 11 + s, 2, 3, EYE); P.rect(19, 11 + s, 2, 3, EYE);
    P.px(15, 11 + s, '#ffffff'); P.px(19, 11 + s, '#ffffff');
    P.rect(17, 16 + s, 2, 1, dark(o.c, 0.6));
  };
}
defSprite('mossSlime', 26, 22, 2, slime({ c: '#6cc04a', moss: 1 }));
defSprite('lavaSlime', 26, 22, 2, slime({ c: '#c8442a', crack: '#ffd34d' }));
defSprite('goldSlime', 26, 22, 2, slime({ c: '#f2c230', shine: 1 }));

defSprite('boar', 34, 24, 2, (P, f) => {
  const c = '#8a5a3c', s = f ? 1 : 0;
  for (let x = 8; x < 24; x += 2) P.line(x, 7, x - 1, 3 + ((x / 2) & 1), '#4a2e1e');
  P.line(5, 11, 2, 8 + s, '#4a2e1e');
  P.rect(7, 18, 3, 5, '#5a3a26'); P.rect(12 + s, 18, 3, 5, '#6b4630'); P.rect(19, 18, 3, 5, '#5a3a26'); P.rect(23 - s, 18, 3, 5, '#6b4630');
  P.rect(7, 22, 3, 1, '#2a1a12'); P.rect(19, 22, 3, 1, '#2a1a12');
  P.ball(15, 13, 11, 7, ramp(c));
  P.poly([[22, 8], [24, 3], [26, 9]], '#6b4630');
  P.ball(26, 13, 6, 5, ramp('#9a6a48'));
  P.rect(30, 12, 3, 4, '#d49a8a'); P.px(32, 13, '#6a3a3a');
  P.px(27, 11, '#ff5a3a'); P.px(26, 10, EYE);
  P.poly([[28, 16], [32, 14], [31, 18]], '#f4ecd8');
});

defSprite('shroom', 22, 26, 2, (P, f) => {
  const s = f ? 1 : 0;
  P.rect(7, 22, 3, 3, '#e0c8a0'); P.rect(13, 22, 3, 3, '#e0c8a0');
  P.rect(7, 12, 9, 11, '#d8c49a'); P.rect(8, 12, 7, 10, '#f0e0c0'); P.rect(13, 13, 2, 8, '#fff4dc');
  P.px(12, 16, EYE); P.px(14, 16, EYE); P.rect(12, 19, 3, 1, '#a8744a');
  P.ball(11, 9 + s, 10 - s * 0.5, 7, ramp('#d8433a'));
  P.rect(2, 13 + s, 18, 1, '#a8323a');
  P.ell(7, 6 + s, 2, 1.6, '#fff4dc'); P.ell(14, 5 + s, 1.6, 1.4, '#fff4dc'); P.ell(17, 10 + s, 1.5, 1.3, '#fff4dc'); P.ell(9, 10 + s, 1.2, 1, '#fff4dc');
});

function wolf(o) {
  return (P, f) => {
    const c = o.c, y = 2, s = f ? 1 : 0;
    P.poly([[6, 10 + y], [1, 5 + y + s], [2, 9 + y + s], [6, 14 + y]], dark(c, 0.15));
    P.rect(8, 17 + y, 2, 7, dark(c, 0.3)); P.rect(12 - s, 17 + y, 2, 7, c); P.rect(20, 17 + y, 2, 7, dark(c, 0.3)); P.rect(24 + s, 17 + y, 2, 7, c);
    P.ball(15, 13 + y, 10, 6, ramp(c));
    P.ell(22, 15 + y, 5, 4.5, light(c, 0.25));
    P.poly([[22, 8 + y], [24, 2 + y], [26, 7 + y]], dark(c, 0.25));
    P.ball(26, 10 + y, 5, 4.5, ramp(c));
    P.poly([[28, 8 + y], [34, 11 + y], [33, 13 + y], [28, 14 + y]], light(c, 0.15));
    P.px(33, 11 + y, EYE); P.px(28, 9 + y, o.eye); P.px(29, 9 + y, o.eye);
    P.px(30, 14 + y, '#ffffff'); P.px(32, 14 + y, '#ffffff');
    if (o.fire) {
      const fl = f ? [[8, 9], [11, 4], [13, 8], [16, 2], [18, 8], [21, 4], [23, 9]] : [[8, 9], [10, 5], [13, 8], [15, 3], [18, 8], [20, 3], [23, 9]];
      P.poly(fl.map(([a, bb]) => [a, bb + y]), '#ff6a2a');
      P.poly(fl.map(([a, bb]) => [a, bb + y + 2]).slice(1, -1).concat([[22, 10 + y], [9, 10 + y]]), '#ffd34d');
    }
  };
}
defSprite('wolf', 36, 28, 2, wolf({ c: '#7a8094', eye: '#ffd34d' }));
defSprite('hellhound', 36, 28, 2, wolf({ c: '#3a2a33', eye: '#ff4a2a', fire: 1 }));

defSprite('treant', 44, 50, 2, (P, f) => {
  const s = f ? 1 : 0;
  P.poly([[14, 44], [8, 49], [20, 47], [24, 49], [36, 49], [30, 44]], '#4a3220');
  P.rect(15, 18, 14, 29, '#5a3c24'); P.rect(17, 18, 10, 28, '#7a5434'); P.rect(23, 20, 3, 25, '#8e6a44');
  P.line(19, 24, 18, 40, '#5a3c24'); P.line(25, 30, 26, 44, '#5a3c24');
  P.line(16, 26, 5, 16 + s, '#5a3c24', 3); P.line(6, 17 + s, 3, 12 + s, '#5a3c24', 2); P.line(28, 26, 39, 20 - s, '#5a3c24', 3); P.line(38, 20 - s, 41, 15, '#5a3c24', 2);
  P.ell(24, 28, 2.5, 3, '#1a1008'); P.ell(30, 28, 2, 3, '#1a1008'); P.px(24, 28, '#ffe066'); P.px(30, 28, '#ffe066');
  P.poly([[22, 35], [31, 34], [29, 38], [24, 38]], '#1a1008');
  P.ball(22, 12 + s, 15, 10, ramp('#3f8a3a'));
  P.ball(9, 15 + s, 7, 6, ramp('#3a7a34')); P.ball(35, 14 + s, 7, 6, ramp('#3a7a34'));
  P.px(14, 7 + s, '#f2a0c0'); P.px(29, 9 + s, '#f2a0c0'); P.px(21, 4 + s, '#fff4dc'); P.px(8, 12 + s, '#f2a0c0');
});

defSprite('spiderQueen', 70, 52, 2, (P, f) => {
  const s = f ? 1 : 0, L = '#2a1636';
  const legs = [[36, 32, 22, 14, 12 + s, 49], [39, 33, 30, 12, 25 - s, 50], [45, 33, 53, 11, 51 + s, 50], [48, 32, 62, 15, 67 - s, 48]];
  for (const [ax, ay, kx, ky, fx, fy] of legs) { P.line(ax, ay, kx, ky, L, 2.4); P.line(kx, ky, fx, fy, L, 2); P.px(kx, ky, '#7a3a8a'); }
  P.ball(21, 26, 17, 14, ramp('#5b2a6e'));
  P.poly([[17, 18], [25, 18], [22, 25], [25, 33], [17, 33], [20, 25]], '#d8323a');
  P.px(12, 22, '#c8a0e0'); P.px(14, 30, '#c8a0e0');
  P.ball(42, 30, 10, 8, ramp('#6e3484'));
  P.ball(52, 27, 7, 6.5, ramp('#7a3a90'));
  for (const [x, y] of [[54, 24], [56, 25], [57, 27], [55, 27], [53, 26]]) P.px(x, y, '#ff3a4a');
  P.poly([[55, 31], [59, 33], [56, 35]], '#f4ecd8'); P.poly([[51, 32], [54, 33], [52, 36]], '#f4ecd8');
  P.poly([[47, 21], [48, 16], [50, 19], [52, 15], [54, 19], [56, 16], [57, 22]], '#e8c547');
  P.px(52, 18, '#ff3a4a');
});
defSprite('spiderling', 22, 16, 2, (P, f) => {
  const s = f ? 1 : 0;
  for (const [ax, kx, fx] of [[8, 4, 2 + s], [10, 8, 7 - s], [13, 15, 16 + s], [15, 19, 21 - s]]) { P.line(ax, 9, kx, 4, '#2a1636'); P.line(kx, 4, fx, 14, '#2a1636'); }
  P.ball(8, 9, 6, 4.5, ramp('#5b2a6e'));
  P.ball(15, 9, 4, 3.5, ramp('#7a3a90'));
  P.px(17, 8, '#ff3a4a'); P.px(18, 9, '#ff3a4a');
});

defSprite('scorpion', 36, 28, 2, (P, f) => {
  const c = '#c8913a', s = f ? 1 : 0;
  for (const x of [11, 15, 19]) { P.line(x, 21, x - 3, 26, dark(c, 0.3)); P.line(x + 1, 21, x + 3, 26, dark(c, 0.3)); }
  const seg = [[8, 19], [4, 14], [4, 9 - s], [7, 5 - s], [12, 3 - s]];
  seg.forEach(([x, y], i) => P.ball(x, y, 3 - i * 0.2, 2.8 - i * 0.2, ramp(c)));
  P.poly([[14, 2 - s], [19, 4 - s], [15, 6 - s]], '#f2e0a0');
  P.ball(16, 20, 9, 5, ramp(c));
  P.ball(26, 20, 5, 4, ramp(light(c, 0.1)));
  P.line(28, 18, 31, 14, c, 2); P.ball(33, 12, 3, 2.5, ramp(c)); P.rect(34, 12, 2, 1, dark(c, 0.5));
  P.line(29, 22, 32, 24, c, 2); P.ball(33, 25, 2.5, 2, ramp(c));
  P.px(29, 18, EYE); P.px(30, 19, '#ff3a4a');
});

defSprite('mummy', 24, 32, 2, (P, f) => {
  const b = f, c = '#d8cfa8', d = '#a89a78';
  P.rect(9, 23, 3, 7, d); P.rect(13, 23, 3, 7, c); P.rect(8, 30, 4, 1, d); P.rect(13, 30, 4, 1, c);
  P.rect(8, 14 + b, 8, 10, d); P.rect(9, 14 + b, 7, 9, c);
  for (let y = 15; y < 23; y += 2) P.line(9, y + b, 15, y + 1 + b, d);
  P.rect(14, 16 + b, 8, 2, c); P.rect(14, 18 + b, 8, 1, d);
  P.ell(12.5, 9 + b, 4.6, 4.8, d); P.ell(12.8, 8.8 + b, 4.1, 4.3, c);
  P.line(9, 6 + b, 17, 8 + b, d); P.line(8, 10 + b, 17, 12 + b, d);
  P.px(15, 9 + b, '#ff4a2a'); P.px(16, 9 + b, f ? '#ffd34d' : '#ff4a2a');
  P.line(8, 18 + b, 4, 24 + b + f, c);
});

defSprite('vulture', 34, 30, 2, (P, f) => {
  const c = '#5a4636';
  if (f) P.poly([[10, 14], [1, 24], [7, 24], [12, 22], [16, 17]], dark(c, 0.2));
  else P.poly([[10, 13], [1, 2], [6, 4], [9, 2], [16, 11]], dark(c, 0.2));
  P.poly([[8, 18], [1, 23], [9, 21]], dark(c, 0.3));
  P.line(15, 22, 14, 28, '#e8d070'); P.line(19, 22, 20, 28, '#e8d070');
  P.ball(16, 16, 8, 7, ramp(c));
  if (f) P.poly([[13, 15], [5, 25], [11, 24], [18, 18]], c);
  else P.poly([[13, 14], [5, 4], [9, 5], [12, 3], [18, 13]], c);
  P.ell(22, 12, 3.5, 2.5, '#e8e0d0');
  P.line(23, 11, 25, 7, '#d88a8a', 2);
  P.ball(27, 6, 3.5, 3, ramp('#e8a0a0'));
  P.poly([[29, 5], [33, 7], [32, 9], [29, 8]], '#e8d070');
  P.px(27, 5, EYE);
});

defSprite('clayGolem', 32, 34, 2, (P, f) => {
  const c = '#a8744a', s = f ? 1 : 0;
  P.rect(9, 24, 5, 8, dark(c, 0.3)); P.rect(18, 24, 5, 8, c); P.rect(8, 31, 7, 2, dark(c, 0.4)); P.rect(17, 31, 7, 2, dark(c, 0.2));
  P.rect(2, 11 + s, 6, 13, dark(c, 0.35)); P.rect(1, 22 + s, 7, 5, dark(c, 0.3));
  P.rect(7, 9 + s, 18, 16, dark(c, 0.25)); P.rect(8, 9 + s, 16, 14, c); P.rect(14, 10 + s, 8, 5, light(c, 0.25));
  P.line(11, 12 + s, 13, 18 + s, dark(c, 0.4)); P.line(20, 17 + s, 22, 21 + s, dark(c, 0.4));
  P.px(16, 18 + s, '#5ad8e8'); P.px(17, 19 + s, '#5ad8e8'); P.px(15, 19 + s, '#5ad8e8');
  P.rect(12, 2 + s, 9, 8, dark(c, 0.25)); P.rect(13, 2 + s, 8, 7, c);
  P.rect(17, 5 + s, 2, 1, '#5ad8e8'); P.rect(20, 5 + s, 1, 1, '#5ad8e8');
  P.rect(24, 11 + s, 6, 12, c); P.rect(24, 21 + s, 7, 6, light(c, 0.15)); P.rect(25, 11 + s, 2, 10, light(c, 0.2));
});

defSprite('pharaoh', 32, 42, 2, (P, f) => {
  const b = f, sk = '#6a7a8a';
  P.poly([[10, 22 + b], [20, 22 + b], [24, 41], [6, 41]], '#2a4a8a'); P.poly([[12, 22 + b], [19, 22 + b], [22, 40], [10, 40]], '#3a62b0');
  P.rect(13, 22 + b, 4, 18, '#e8c547'); P.rect(6, 40, 18, 1, '#e8c547');
  P.rect(9, 14 + b, 12, 9, '#2a4a8a'); P.rect(9, 14 + b, 12, 3, '#e8c547'); P.rect(9, 17 + b, 12, 1, '#3a62b0');
  P.poly([[8, 6 + b], [20, 5 + b], [22, 13 + b], [21, 19 + b], [8, 19 + b], [6, 13 + b]], '#e8c547');
  for (let y = 7; y < 19; y += 2) P.line(7, y + b, 21, y + b, '#2a4a8a');
  P.rect(14, 8 + b, 7, 8, sk); P.rect(14, 8 + b, 7, 1, '#e8c547');
  P.px(17, 10 + b, '#5affe0'); P.px(19, 10 + b, '#5affe0'); P.rect(18, 15 + b, 1, 3, '#e8c547');
  P.poly([[13, 5 + b], [15, 1 + b], [17, 5 + b]], '#e8c547'); P.px(15, 3 + b, '#d8323a');
  P.rect(25, 4 + b, 1, 36, '#e8c547'); P.rect(26, 4 + b, 1, 36, '#a8862a');
  P.ell(25.5, 4 + b, 3, 2.5, '#2a8a5a'); P.px(27, 3 + b, '#ff3a4a'); P.poly([[27, 5 + b], [30, 6 + b], [27, 7 + b]], '#2a8a5a');
  P.rect(20, 18 + b, 5, 2, sk);
  if (f) { P.px(3, 12, '#5affe0'); P.px(28, 26, '#5affe0'); } else { P.px(4, 20, '#5affe0'); P.px(29, 14, '#5affe0'); }
});

defSprite('sandWyrm', 72, 62, 2, (P, f) => {
  const c = '#b88a4a', s = f ? 1 : 0;
  P.ell(24, 58, 22, 4, '#c8a060'); P.ell(24, 57, 18, 3, '#e0c080');
  const seg = [[14, 54], [16, 46], [20, 39], [25, 32], [31, 26], [37, 21]];
  seg.forEach(([x, y], i) => {
    const r = 9 - i * 0.5;
    P.ball(x, y - s * (i / 5), r, r * 0.9, ramp(c));
    P.ell(x + r * 0.45, y - s * (i / 5), r * 0.45, r * 0.6, '#e8c890');
    P.poly([[x - 3, y - r + 1], [x - 1, y - r - 4], [x + 1, y - r + 1]], '#7a5428');
  });
  const hy = 18 - s;
  P.poly([[44, hy + 6], [66, hy + 12 + s * 2], [62, hy + 15 + s * 2], [44, hy + 12]], dark(c, 0.2));
  for (let x = 48; x < 64; x += 3) P.px(x, hy + 11 + s, '#f4ecd8');
  P.ball(48, hy, 11, 8, ramp(c));
  P.poly([[48, hy - 2], [70, hy + 3], [66, hy + 7], [48, hy + 7]], c);
  for (let x = 52; x < 68; x += 3) P.px(x, hy + 7, '#f4ecd8');
  P.poly([[40, hy - 6], [36, hy - 14], [44, hy - 8]], '#7a5428'); P.poly([[45, hy - 7], [44, hy - 15], [49, hy - 8]], '#7a5428');
  P.ell(52, hy - 1, 2.5, 2, '#1a1008'); P.px(53, hy - 1, '#ffe066');
});

defSprite('iceBat', 32, 22, 2, (P, f) => {
  const m = '#3a4a7a', ml = '#5a6aa0';
  if (f) { P.poly([[13, 10], [1, 18], [5, 20], [8, 17], [11, 19], [15, 14]], m); P.poly([[19, 10], [31, 18], [27, 20], [24, 17], [21, 19], [17, 14]], ml); }
  else { P.poly([[13, 10], [1, 2], [4, 7], [7, 4], [9, 8], [15, 13]], m); P.poly([[19, 10], [31, 2], [28, 7], [25, 4], [23, 8], [17, 13]], ml); }
  P.ball(16, 12, 5, 5.5, ramp('#5a6a9a'));
  P.poly([[13, 8], [13, 3], [15, 7]], '#4a5a8a'); P.poly([[17, 7], [19, 3], [19, 8]], '#4a5a8a');
  P.px(15, 11, '#7fe8ff'); P.px(18, 11, '#7fe8ff'); P.px(16, 15, '#ffffff'); P.px(18, 15, '#ffffff');
  P.px(f ? 4 : 5, f ? 18 : 4, '#bfe8ff'); P.px(f ? 28 : 27, f ? 18 : 4, '#bfe8ff');
});

defSprite('frostWisp', 22, 28, 2, (P, f) => {
  const pts = f ? [[11, 1], [16, 8], [19, 16], [16, 24], [6, 24], [3, 16], [5, 9], [8, 6]] : [[12, 2], [17, 9], [19, 17], [15, 24], [7, 24], [3, 17], [6, 8], [9, 4]];
  P.poly(pts, '#3a8ad0');
  P.poly(pts.map(([x, y]) => [11 + (x - 11) * 0.72, 15 + (y - 15) * 0.72]), '#7fd0ff');
  P.ell(11, 17, 4, 4.5, '#d8f4ff');
  P.px(12, 15, EYE); P.px(15, 15, EYE); P.px(13, 18, '#3a8ad0');
  P.px(f ? 3 : 18, f ? 26 : 25, '#bfe8ff'); P.px(f ? 19 : 2, 3, '#bfe8ff');
});

defSprite('crystalCrab', 36, 26, 2, (P, f) => {
  const c = '#4a7aa0', s = f ? 1 : 0;
  for (const x of [8, 12, 16, 20, 24]) P.line(x, 18, x + (x < 16 ? -3 : 3), 24, dark(c, 0.3));
  P.ball(17, 16, 11, 6.5, ramp(c));
  P.poly([[9, 12], [11, 3], [14, 11]], '#8fd8ff'); P.poly([[13, 11], [16, 1], [19, 11]], '#bfefff'); P.poly([[18, 11], [22, 5], [23, 12]], '#8fd8ff');
  P.px(15, 4, '#ffffff'); P.px(11, 6, '#ffffff');
  P.line(21, 11, 22, 7, dark(c, 0.2)); P.px(22, 6, EYE); P.line(24, 11, 25, 7, dark(c, 0.2)); P.px(25, 6, EYE);
  P.line(27, 17, 29, 15, c, 2);
  P.ball(31, 14 - s, 4, 3.5, ramp(light(c, 0.1))); P.rect(32, 14 - s, 3, 1, dark(c, 0.5));
});

defSprite('penguinKnight', 26, 32, 2, (P, f) => {
  const b = f;
  P.rect(8, 29, 4, 2, '#f2a83a'); P.rect(14, 29, 4, 2, '#f2a83a');
  P.ball(12, 19 + b, 7.5, 10, ramp('#2a3045'));
  P.ell(14, 20 + b, 4.5, 7.5, '#eef2f8'); P.ell(15, 19 + b, 2, 5, '#ffffff');
  P.rect(8, 15 + b, 10, 2, '#c8323a'); P.poly([[8, 15 + b], [4, 21 + b], [7, 21 + b], [10, 16 + b]], '#c8323a');
  P.px(15, 11 + b, '#ffffff'); P.px(16, 11 + b, EYE);
  P.poly([[17, 12 + b], [22, 13 + b], [17, 14 + b]], '#f2a83a');
  P.ell(12, 8 + b, 6.5, 3, '#6a7888'); P.ell(12, 7.5 + b, 5.5, 2.4, '#9aa8b8'); P.poly([[6, 8 + b], [3, 3 + b], [7, 6 + b]], '#e8e0c8');
  P.rect(21, 3, 1, 26, '#8a6a4a'); P.poly([[20, 4], [21, 0], [23, 4]], '#bfe8ff'); P.px(21, 2, '#ffffff');
  P.ell(19, 19 + b, 2.5, 3.5, '#2a3045');
});

defSprite('yeti', 46, 48, 2, (P, f) => {
  const c = '#dfe8f0', s = f ? 1 : 0;
  P.ball(15, 43, 6, 4, ramp(c)); P.ball(29, 43, 6, 4, ramp(c));
  P.ball(9, 31 + s, 6, 11, ramp(dark(c, 0.1)));
  P.ball(22, 27, 16, 15, ramp(c));
  for (let i = 0; i < 26; i++) P.px(10 + ((i * 7) % 24), 16 + ((i * 11) % 22), '#b8c8d8');
  P.ball(37, 31 - s, 6, 11, ramp(c)); P.ball(38, 41 - s, 5, 4, ramp('#7a8aa0'));
  P.ell(31, 18, 7, 6.5, '#6a7a94'); P.ell(32, 18, 6, 5.5, '#8a9ab4');
  P.rect(29, 15, 4, 1, '#3a4a64'); P.rect(34, 15, 3, 1, '#3a4a64');
  P.px(31, 17, '#5ae0ff'); P.px(35, 17, '#5ae0ff');
  P.rect(30, 21, 7, 2, '#3a2a3a'); P.px(31, 21, '#ffffff'); P.px(35, 21, '#ffffff');
  P.poly([[24, 11], [20, 4], [16, 6], [21, 7], [26, 14]], '#a89070'); P.poly([[34, 10], [38, 3], [42, 6], [38, 6], [36, 12]], '#a89070');
});

defSprite('frostDragon', 80, 62, 2, (P, f) => {
  const c = '#5a8ac8', s = f ? 1 : 0, wing = '#2e4a80', wl = '#4a6aa8';
  if (f) P.poly([[30, 30], [10, 14], [22, 16], [26, 8], [36, 14], [46, 28]], wing);
  else P.poly([[30, 30], [18, 2], [30, 8], [38, 0], [44, 10], [48, 28]], wing);
  if (f) { P.line(30, 30, 12, 15, wl); P.line(32, 29, 26, 9, wl); } else { P.line(30, 30, 19, 3, wl); P.line(34, 28, 38, 1, wl); }
  P.line(22, 40, 10, 50, c, 6); P.line(10, 50, 3, 44, c, 4); P.line(3, 44, 2, 36, c, 2);
  P.poly([[1, 36], [4, 30], [5, 37]], '#bfe8ff');
  P.ball(26, 48, 6, 8, ramp(dark(c, 0.1)));
  P.ball(36, 38, 17, 11, ramp(c));
  P.ell(40, 42, 11, 6, '#cfe4f4'); for (let x = 32; x < 50; x += 3) P.px(x, 42, '#a8c4dc');
  for (let x = 24; x < 46; x += 5) P.poly([[x, 29], [x + 2, 23], [x + 4, 29]], '#bfe8ff');
  P.ball(48, 48, 5, 7, ramp(c)); P.rect(46, 54, 7, 2, '#e8f4ff');
  P.line(46, 32, 58, 20 - s, c, 7);
  P.ball(62, 16 - s, 9, 7, ramp(c));
  P.poly([[64, 12 - s], [78, 16 - s], [76, 20 - s], [64, 21 - s]], light(c, 0.15));
  P.rect(65, 20 - s, 11, 1, '#ffffff');
  P.poly([[57, 11 - s], [50, 3 - s], [60, 8 - s]], '#e0f0ff'); P.poly([[61, 9 - s], [58, 0], [64, 8 - s]], '#e0f0ff');
  P.ell(65, 13 - s, 2, 1.5, '#1a2a4a'); P.px(66, 13 - s, '#7fe8ff');
  P.px(77, 15 - s, '#bfe8ff');
});

defSprite('imp', 26, 28, 2, (P, f) => {
  const c = '#d8433a';
  if (f) { P.poly([[9, 12], [1, 8], [3, 14], [6, 13]], '#8a2a2a'); } else { P.poly([[9, 12], [2, 4], [3, 10], [6, 11]], '#8a2a2a'); }
  P.line(7, 20, 2, 24, '#8a2a2a'); P.poly([[0, 23], [3, 22], [2, 26]], '#8a2a2a');
  P.rect(9, 22, 2, 4, dark(c, 0.3)); P.rect(14, 22, 2, 4, c);
  P.ball(12, 17, 6, 6, ramp(c));
  P.ball(14, 9, 5.5, 5, ramp(c));
  P.poly([[10, 6], [8, 1], [12, 5]], '#f4ecd8'); P.poly([[15, 5], [17, 0], [18, 6]], '#f4ecd8');
  P.px(15, 8, '#ffe066'); P.px(17, 8, '#ffe066'); P.rect(15, 11, 4, 1, EYE); P.px(16, 12, '#ffffff');
  P.rect(21, 5, 1, 21, '#4a3a3a'); P.rect(19, 4, 5, 1, '#8a8a9a'); P.px(19, 2, '#8a8a9a'); P.px(19, 3, '#8a8a9a'); P.px(21, 2, '#8a8a9a'); P.px(21, 3, '#8a8a9a'); P.px(23, 2, '#8a8a9a'); P.px(23, 3, '#8a8a9a');
  P.rect(17, 15, 4, 2, c);
});

defSprite('skeletonKnight', 28, 34, 2, (P, f) => {
  const b = f, bone = '#e8e4d0', bd = '#a8a490', iron = '#4a4a58';
  P.rect(10, 24, 2, 7, bd); P.rect(15, 24, 2, 7, bone); P.rect(9, 30, 4, 2, iron); P.rect(14, 30, 5, 2, iron);
  P.ell(5, 20 + b, 5, 6, '#6a4a2a'); P.ell(5, 20 + b, 4, 5, '#8a5a32'); P.px(5, 20 + b, '#c8c8d0');
  P.rect(9, 15 + b, 9, 9, '#2a2a34');
  for (let y = 16; y < 23; y += 2) P.rect(10, y + b, 7, 1, bone);
  P.rect(13, 15 + b, 1, 9, bone);
  P.rect(8, 14 + b, 4, 3, iron); P.rect(15, 14 + b, 4, 3, iron);
  P.ell(13.5, 9 + b, 4.6, 4.6, bd); P.ell(13.8, 8.8 + b, 4.1, 4.2, bone);
  P.rect(15, 8 + b, 2, 2, EYE); P.px(16, 8 + b, '#ff3a3a'); P.rect(12, 8 + b, 2, 2, EYE);
  P.rect(14, 12 + b, 4, 1, bd); P.px(15, 13 + b, bone); P.px(17, 13 + b, bone);
  P.ell(13, 6 + b, 5, 2.5, iron); P.rect(8, 6 + b, 10, 1, '#6a6a78');
  P.rect(18, 17 + b, 2, 5, bone);
  P.rect(20, 3 + b, 3, 17, '#b8c0c8'); P.rect(22, 3 + b, 1, 17, '#7a8290'); P.rect(18, 19 + b, 7, 2, iron); P.rect(20, 21 + b, 3, 3, '#4a2e22');
});

defSprite('shadowMage', 28, 36, 2, (P, f) => {
  const r = '#2a1e3e', rl = '#3e2e5a';
  const hem = f ? [[5, 33], [9, 31], [13, 34], [17, 31], [21, 33]] : [[5, 32], [9, 34], [13, 31], [17, 34], [21, 32]];
  P.poly([[8, 12], [18, 12], ...hem.slice().reverse()], r);
  P.poly([[10, 13], [17, 13], [19, 30], [9, 30]], rl);
  P.ell(13, 8, 6, 6.5, r); P.ell(13.5, 7.5, 5, 5.5, rl);
  P.ell(15, 9, 3.4, 3.6, '#0a0612');
  P.px(14, 9, '#c86aff'); P.px(17, 9, '#c86aff');
  P.poly([[10, 3], [13, 0], [12, 4]], r);
  P.line(17, 16, 21, 19, rl, 2); P.px(22, 19, '#c8c0d0');
  P.ell(24, 15 - f, 3, 3, '#7a3ac8'); P.ell(23.6, 14.6 - f, 2, 2, '#c86aff'); P.px(23, 14 - f, '#ffffff');
});

defSprite('ashKing', 78, 82, 2, (P, f) => {
  const b = f, ar = '#3a3440', arL = '#5a5268', gold = '#d9a92e', cape = '#7a1a2a';
  P.poly([[22, 26 + b], [42, 26 + b], [46, 78], [40, 74], [34, 80], [28, 75], [20, 80], [12, 76]], dark(cape, 0.2));
  P.poly([[24, 27 + b], [40, 27 + b], [42, 74], [34, 78], [26, 74], [16, 76]], cape);
  P.rect(25, 56, 8, 20, dark(ar, 0.2)); P.rect(36, 56, 8, 20, ar); P.rect(37, 56, 3, 18, arL);
  P.rect(23, 74, 11, 6, '#2a2430'); P.rect(35, 74, 12, 6, ar);
  P.rect(24, 32 + b, 22, 26, dark(ar, 0.2)); P.rect(26, 32 + b, 19, 24, ar); P.rect(34, 34 + b, 8, 10, arL);
  P.rect(24, 52 + b, 22, 3, gold); P.rect(33, 52 + b, 4, 3, '#ff6a2a');
  P.poly([[30, 36 + b], [40, 36 + b], [35, 46 + b]], '#2a2430'); P.px(35, 40 + b, '#ff6a2a');
  P.ball(22, 33 + b, 7, 6, ramp(ar)); P.poly([[16, 30 + b], [14, 24 + b], [20, 28 + b]], gold);
  P.ball(47, 33 + b, 7, 6, ramp(arL)); P.poly([[50, 29 + b], [56, 24 + b], [53, 31 + b]], gold);
  P.rect(18, 37 + b, 6, 14, dark(ar, 0.3)); P.rect(18, 50 + b, 6, 5, '#2a2430');
  P.ball(35, 21 + b, 9, 9, ramp(ar));
  P.rect(34, 18 + b, 10, 3, '#0a0612'); P.px(37, 19 + b, '#ff8a2a'); P.px(41, 19 + b, '#ff8a2a'); P.px(38, 19 + b, '#ffd34d');
  P.rect(36, 22 + b, 1, 6, '#0a0612'); P.rect(39, 22 + b, 1, 6, '#0a0612');
  P.poly([[26, 14 + b], [27, 6 + b], [30, 11 + b], [33, 3 + b], [36, 11 + b], [39, 4 + b], [41, 11 + b], [44, 6 + b], [44, 14 + b]], gold);
  P.rect(26, 13 + b, 18, 2, '#b8862a'); P.px(35, 9 + b, '#d8323a'); P.px(30, 12 + b, '#5affe0'); P.px(40, 12 + b, '#5affe0');
  P.rect(48, 38 + b, 6, 12, ar); P.rect(50, 46 + b, 6, 5, '#2a2430');
  P.rect(54, 44 + b, 4, 4, gold); P.rect(51, 47 + b, 10, 2, gold);
  P.poly([[55, 44 + b], [58, 44 + b], [60, 6], [57, 2], [54, 6]], '#4a4252');
  P.poly([[56, 42 + b], [57, 42 + b], [58, 8], [57, 5], [56, 8]], '#8a8098');
  const fl = f ? [[53, 40], [50, 28], [54, 30], [52, 16], [57, 22], [58, 6], [61, 18], [64, 12], [63, 28], [66, 30], [61, 42]]
    : [[53, 40], [51, 26], [55, 28], [54, 12], [58, 20], [60, 4], [62, 20], [66, 14], [62, 30], [65, 34], [61, 42]];
  P.poly(fl, '#ff6a2a');
  P.poly(fl.map(([x, y]) => [57.5 + (x - 57.5) * 0.55, 24 + (y - 24) * 0.8]), '#ffd34d');
});

defSprite('mimic', 30, 28, 2, (P, f) => {
  const w = '#8a5a2e', wd = '#5a3a1e', s = f ? 2 : 0;
  P.rect(3, 14, 24, 12, wd); P.rect(4, 14, 22, 11, w);
  P.rect(3, 18, 24, 1, '#6a6a78'); P.rect(9, 14, 2, 12, '#6a6a78'); P.rect(19, 14, 2, 12, '#6a6a78');
  P.rect(5, 13, 20, 2, '#3a0a14');
  P.poly([[6, 12], [9, 12], [7.5, 16]], '#f4ecd8'); P.poly([[12, 12], [15, 12], [13.5, 16]], '#f4ecd8'); P.poly([[18, 12], [21, 12], [19.5, 16]], '#f4ecd8');
  P.poly([[2, 12 - s], [26, 4 - s], [28, 9 - s], [4, 14 - s]], wd); P.poly([[3, 11 - s], [26, 5 - s], [27, 8 - s], [4, 13 - s]], w);
  P.poly([[8, 11 - s], [10, 15 - s], [11, 10 - s]], '#f4ecd8'); P.poly([[16, 9 - s], [18, 13 - s], [19, 8 - s]], '#f4ecd8');
  P.px(15, 7 - s, '#e8c547'); P.px(14, 16, '#ff3a4a'); P.px(18, 16, '#ff3a4a');
  P.poly([[22, 16], [28, 18 + s], [26, 20], [21, 18]], '#d84a6a');
});

// ================= 아이콘 (16x16) =================
function icon(name, draw) { defSprite('ic_' + name, 16, 16, 1, P => draw(P)); }
function potion(c, big) {
  return P => {
    const r = big ? 5.5 : 4.5;
    P.rect(6, 2, 4, 2, '#8a5a32'); P.rect(6, 4, 4, 3, '#c8e0e8');
    P.ell(8, 10.5, r, r, '#c8e0e8'); P.ell(8, 11.5, r - 1, r - 1.6, c); P.ell(7, 11, r - 2.4, r - 2.8, light(c, 0.3));
    P.px(5, 8, '#ffffff'); if (big) P.rect(7, 5, 2, 1, '#e8c547');
  };
}
icon('hp', potion('#e0404a')); icon('hpBig', potion('#e0404a', 1));
icon('mp', potion('#3a8ae0')); icon('mpBig', potion('#3a8ae0', 1));
icon('elixir', potion('#f2c230', 1));
icon('herb', P => { P.line(8, 14, 8, 6, '#3f7d3a'); P.ell(5, 7, 3, 2, '#5fa04e'); P.ell(11, 5, 3, 2, '#6cc04a'); P.ell(8, 3, 2, 2.4, '#8fd36b'); P.px(4, 7, '#9fe07b'); });
icon('feather', P => { P.poly([[3, 14], [12, 2], [14, 3], [6, 13]], '#ff7a2a'); P.poly([[5, 12], [12, 3], [13, 4], [6, 12]], '#ffd34d'); P.line(3, 14, 12, 3, '#c8442a'); });
function bomb(c) { return P => { P.ball(8, 10, 5.5, 5.5, ramp('#3a3448')); P.rect(7, 3, 3, 2, '#6a6a78'); P.line(9, 3, 12, 1, '#a8744a'); P.px(13, 1, c); P.px(12, 0, '#ffffff'); P.ell(8, 10, 2, 2, c); }; }
icon('bombFire', bomb('#ff6a2a')); icon('bombIce', bomb('#7fd8ff')); icon('bombHoly', bomb('#ffe066'));
icon('smoke', P => { P.ball(6, 10, 4, 4, ramp('#a8a0b8')); P.ball(10, 8, 4.5, 4.5, ramp('#c8c0d8')); P.ball(9, 12, 3, 3, ramp('#8a8098')); });
icon('sword', P => { P.line(3, 13, 12, 4, '#dfe6ee', 2); P.line(4, 13, 13, 4, '#8a96a4'); P.line(3, 10, 6, 13, '#c9a227', 1.5); P.rect(2, 13, 2, 2, '#6b4226'); });
icon('staff', P => { P.line(3, 14, 11, 6, '#7a5230', 1.5); P.ell(12, 4, 2.8, 2.8, '#7fd8ff'); P.px(11, 3, '#ffffff'); });
icon('mace', P => { P.line(3, 14, 9, 8, '#8a6a3a', 1.5); P.ell(11, 6, 3.4, 3.4, '#b8860b'); P.ell(10.6, 5.6, 2.6, 2.6, '#f2c94c'); P.px(11, 1, '#f2c94c'); P.px(15, 6, '#f2c94c'); });
icon('dagger', P => { P.line(4, 12, 11, 5, '#dfe6ee', 1.5); P.line(3, 10, 6, 13, '#c9a227'); P.rect(2, 12, 2, 2, '#4a3428'); P.line(6, 14, 13, 7, '#9aa6b4'); });
icon('bow', P => { for (let i = 0; i <= 12; i++) { const t = i / 12, a = Math.PI * (0.75 + t * 1.5); P.px(9 + Math.cos(a) * 6, 8 + Math.sin(a) * 6, '#8b5a2b'); } P.line(4, 3, 4, 13, '#e8e0c8'); P.line(4, 8, 14, 8, '#c8c0a8'); P.px(14, 8, '#dfe6ee'); });
icon('flask', P => { P.rect(7, 2, 3, 4, '#c8e0e8'); P.ell(8.5, 10, 5, 5, '#c8e0e8'); P.ell(8.5, 11, 4, 3.4, '#4ad07a'); P.px(6, 8, '#ffffff'); P.rect(7, 1, 3, 1, '#8a5a32'); });
icon('armorHeavy', P => { P.poly([[2, 3], [14, 3], [13, 14], [3, 14]], '#5a6878'); P.poly([[4, 4], [12, 4], [11, 12], [5, 12]], '#9aa9b8'); P.rect(7, 4, 2, 8, '#c4ced8'); P.rect(2, 3, 3, 3, '#7d8a99'); P.rect(11, 3, 3, 3, '#7d8a99'); });
icon('robe', P => { P.poly([[5, 2], [11, 2], [14, 14], [2, 14]], '#4b3b8f'); P.poly([[7, 2], [9, 2], [10, 14], [6, 14]], '#e8c547'); P.rect(2, 13, 12, 1, '#e8c547'); });
icon('leather', P => { P.poly([[3, 3], [13, 3], [12, 13], [4, 13]], '#7a5232'); P.poly([[5, 4], [11, 4], [10, 11], [6, 11]], '#a8744a'); P.rect(4, 9, 8, 1, '#4a2e1e'); P.px(8, 9, '#e8c547'); });
icon('ring', P => { P.ell(8, 10, 4.5, 4.5, '#d9a92e'); P.cut(8, 10, 2.8, 2.8); P.ell(8, 4, 2.6, 2.6, '#d8323a'); P.px(7, 3, '#ffffff'); });
icon('amulet', P => { P.line(3, 2, 8, 9, '#d9a92e'); P.line(13, 2, 8, 9, '#d9a92e'); P.ell(8, 11, 3.5, 3.5, '#d9a92e'); P.ell(8, 11, 2.2, 2.2, '#3a8ae0'); P.px(7, 10, '#ffffff'); });
icon('charm', P => { P.poly([[4, 2], [12, 2], [12, 13], [8, 11], [4, 13]], '#e8dcc0'); P.rect(5, 4, 6, 1, '#c8323a'); P.rect(7, 6, 2, 4, '#c8323a'); P.rect(5, 7, 6, 1, '#c8323a'); });
icon('boots', P => { P.rect(4, 3, 5, 8, '#7a5232'); P.rect(4, 10, 10, 4, '#7a5232'); P.rect(5, 3, 3, 7, '#a8744a'); P.rect(4, 13, 10, 1, '#3a2a1e'); P.px(13, 5, '#ffffff'); P.line(10, 4, 14, 2, '#e8e0c8'); });
// 지도 아이콘
icon('nBattle', P => { P.line(2, 14, 12, 3, '#dfe6ee', 2); P.line(14, 14, 4, 3, '#dfe6ee', 2); P.rect(2, 11, 4, 2, '#c9a227'); P.rect(10, 11, 4, 2, '#c9a227'); });
icon('nElite', P => { P.ball(8, 9, 5.5, 5, ramp('#e8e4d0')); P.rect(5, 8, 2, 2, EYE); P.rect(9, 8, 2, 2, EYE); P.px(6, 8, '#ff3a3a'); P.px(10, 8, '#ff3a3a'); P.rect(6, 12, 4, 2, '#e8e4d0'); P.poly([[3, 6], [0, 1], [5, 4]], '#d8323a'); P.poly([[13, 6], [15, 1], [11, 4]], '#d8323a'); });
icon('nRest', P => { P.rect(2, 13, 12, 2, '#6b4226'); P.line(3, 12, 13, 14, '#8a5a32', 1.5); P.poly([[8, 1], [12, 8], [11, 12], [5, 12], [4, 8]], '#ff6a2a'); P.poly([[8, 5], [10, 9], [9, 12], [7, 12], [6, 9]], '#ffd34d'); });
icon('nShop', P => { P.ball(8, 10, 5.5, 4.5, ramp('#a8744a')); P.rect(6, 3, 4, 3, '#8a5a32'); P.rect(5, 5, 6, 1, '#e8c547'); P.ell(8, 10, 2, 2, '#f2c230'); P.px(8, 10, '#a8744a'); });
icon('nEvent', P => { P.poly([[3, 2], [13, 2], [13, 14], [3, 14]], '#e8dcc0'); P.rect(3, 2, 10, 1, '#c8b890'); P.rect(6, 4, 4, 1, '#5a3a8a'); P.rect(9, 5, 1, 2, '#5a3a8a'); P.rect(7, 7, 2, 2, '#5a3a8a'); P.rect(7, 11, 2, 1, '#5a3a8a'); });
icon('nTreasure', P => { P.rect(2, 7, 12, 7, '#8a5a2e'); P.ball(8, 6, 6, 3, ramp('#a8744a')); P.rect(2, 7, 12, 1, '#e8c547'); P.rect(7, 7, 2, 3, '#e8c547'); P.rect(2, 13, 12, 1, '#5a3a1e'); });
icon('nBoss', P => { P.poly([[1, 6], [4, 1], [6, 5], [8, 0], [10, 5], [12, 1], [15, 6], [14, 13], [2, 13]], '#d9a92e'); P.rect(2, 11, 12, 2, '#b8862a'); P.px(8, 8, '#d8323a'); P.px(4, 9, '#5affe0'); P.px(12, 9, '#5affe0'); });
icon('coin', P => { P.ell(8, 8, 5.5, 5.5, '#b8862a'); P.ell(7.6, 7.6, 4.6, 4.6, '#f2c230'); P.rect(7, 5, 2, 6, '#b8862a'); P.px(5, 5, '#fff6c8'); });
icon('lantern', P => { P.rect(7, 0, 2, 2, '#4a3a2a'); P.rect(4, 2, 8, 2, '#4a3a2a'); P.rect(4, 4, 8, 9, '#ffd34d'); P.rect(5, 5, 6, 7, '#fff2b0'); P.rect(4, 4, 1, 9, '#4a3a2a'); P.rect(11, 4, 1, 9, '#4a3a2a'); P.rect(3, 13, 10, 2, '#4a3a2a'); P.px(7, 8, '#ff9a3a'); });

// ================= 상태 표시 (5x5) =================
const ST_ICON = {
  poison: ['01000', '01100', '11110', '11110', '01100', '#6ad04a'],
  burn: ['00100', '01100', '01110', '11111', '01110', '#ff7a2a'],
  freeze: ['10101', '01110', '11111', '01110', '10101', '#9fe8ff'],
  stun: ['00100', '11111', '01110', '01010', '10001', '#ffe066'],
  bleed: ['00100', '01110', '11111', '11111', '01110', '#e0303a'],
  atkUp: ['00100', '01110', '11111', '00100', '00100', '#ff6a5a'],
  atkDown: ['00100', '00100', '11111', '01110', '00100', '#a8323a'],
  defUp: ['00100', '01110', '11111', '00100', '00100', '#5aa8ff'],
  defDown: ['00100', '00100', '11111', '01110', '00100', '#3a5aa0'],
  spdUp: ['00100', '01110', '11111', '00100', '00100', '#ffe066'],
  spdDown: ['00100', '00100', '11111', '01110', '00100', '#a89a3a'],
  regen: ['00100', '00100', '11111', '00100', '00100', '#6ae07a'],
  taunt: ['00100', '00100', '00100', '00000', '00100', '#ff9a3a'],
  evaUp: ['10001', '11011', '01110', '00100', '00100', '#e8f0ff'],
  guard: ['11111', '11111', '11111', '01110', '00100', '#c8d0e0'],
  charge: ['01110', '10001', '10101', '10001', '01110', '#ff4a8a'],
};
const ST_CANVAS = {};
function stIcon(k) {
  if (ST_CANVAS[k]) return ST_CANVAS[k];
  const d = ST_ICON[k], c = newCanvas(7 * R, 7 * R), g = c.getContext('2d');
  g.scale(R, R);
  g.fillStyle = '#140c1c'; g.fillRect(0, 0, 7, 7);
  g.fillStyle = d[5];
  for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) if (d[y][x] === '1') g.fillRect(x + 1, y + 1, 1, 1);
  ST_CANVAS[k] = c;
  return c;
}
