'use strict';
// 영웅 도트 그림 — 한 칸 한 칸 직접 찍은 그림 (24 x 32 칸, 오른쪽을 본다)
// 글자 하나가 한 칸이고, 글자마다 색이 정해져 있다. '.' 은 빈칸
const HERO_ART = {
 "knight": {
  "pal": {
   "m": "#8796a6",
   "M": "#4a5361",
   "l": "#c8d2dc",
   "a": "#3e64a8",
   "A": "#283f78",
   "q": "#6a8ad0",
   "r": "#d8323a",
   "R": "#8a1a2a",
   "c": "#b03a48",
   "C": "#6a1e2e",
   "s": "#f0b890",
   "S": "#c8845e",
   "b": "#e8c547",
   "B": "#a8862a",
   "p": "#3b4a63",
   "P": "#262e40",
   "f": "#6a4a34",
   "F": "#3e2a1e"
  },
  "body": [
   "........................",
   "..........rrr...........",
   "........rrRRrr..........",
   ".......rRR..mmmm........",
   "......rR...mllmmmm......",
   "......R...mllmmmmmM.....",
   ".........mlmmmmmmmmM....",
   ".........mmmmmmmmmmM....",
   ".........MmmMMMMMMMM....",
   ".........MmMssssssM.....",
   ".........MmMsessesS.....",
   ".........MmMssssssS.....",
   "..........MMSsssSS......",
   "...........MMMMMM.......",
   ".....cc..mlmmmmmm.......",
   "....cCc.mlmaqqaam.......",
   "....cCcmmMaqqaaAm.......",
   "...cCCcmMMallmaAA.......",
   "...cCCcmMMmllmaAA.......",
   "...cCCcmMMmmmmmAA.......",
   "...cCCcMM.bbBbbbB.......",
   "..cCCCc...aaaaaaA.......",
   "..cCCCc...aAaaaAA.......",
   "..cCCC....pPp.ppP.......",
   "...CC.....pPp.ppP.......",
   "..........mMM.mmM.......",
   "..........lmM.lmM.......",
   "..........pPP.ppP.......",
   "..........pPP.ppP.......",
   ".........fFFf.ffff......",
   ".........FFFF.fffff.....",
   "........................"
  ],
  "over": [
   [
    4,
    15,
    [
     "BbbbbB",
     "baaaab",
     "babbab",
     "bbbbbb",
     "babbab",
     "baaaab",
     ".baab.",
     "..bb.."
    ]
   ]
  ],
  "sleeve": "m",
  "sleeve2": "M",
  "weapon": {
   "map": [
    "..l..",
    ".lmM.",
    ".lmM.",
    ".lmM.",
    ".lmM.",
    ".lmM.",
    ".lmM.",
    ".lmM.",
    "bbbBB",
    "..F..",
    "..b.."
   ],
   "grip": [
    2,
    9
   ],
   "wpal": {
    "F": "#5a3a22"
   }
  },
  "ang": {
   "idle": 15,
   "windup": -70,
   "strike": 100,
   "cast": -10,
   "hurt": -25
  }
 },
 "mage": {
  "pal": {
   "h": "#4b3b8f",
   "H": "#2e2459",
   "i": "#7a64d0",
   "b": "#e8c547",
   "B": "#a8862a",
   "s": "#f1c7a1",
   "S": "#c8946a",
   "x": "#e6e6ee",
   "X": "#a8a8bc",
   "a": "#4b3b8f",
   "A": "#2e2459",
   "q": "#6f5cc4",
   "f": "#3a2a22",
   "F": "#20160e"
  },
  "body": [
   "..............h.........",
   ".............hhH........",
   "............hhiH........",
   "...........hhiihH.......",
   "..........hhiihhH.......",
   ".........hhihhhhH.......",
   "......HHhbbbbbbbbhH.....",
   ".....HhhhhhhhhhhhhhH....",
   "........HssssssSH.......",
   "........SsessesS........",
   "........SsssssxS........",
   ".........xxxxxxx........",
   ".........xxxxxxX........",
   "..........xxxxX.........",
   "........aaqxxXaA........",
   ".......aAaqqxqaA........",
   "......aAAaqqqqaA........",
   "......aAAaqqqaaA........",
   "......aAAbbbbbbB........",
   "......aAAaaqqaaA........",
   ".......AaaaqqaaAA.......",
   ".......AaaaqqaaaA.......",
   "......AAaaaqqaaaAA......",
   "......AaaaaqqaaaaA......",
   "......AaaaaqqaaaaAA.....",
   ".....AAaaaaqqaaaaaA.....",
   ".....AaaaaaqqaaaaaAA....",
   ".....AaaaaaqqaaaaaaA....",
   ".....bbbbbbbbbbbbbbB....",
   "........fF....ff........",
   ".......FFF....fff.......",
   "........................"
  ],
  "over": [],
  "sleeve": "a",
  "sleeve2": "A",
  "weapon": {
   "map": [
    ".gg.",
    "gGGg",
    "gGGg",
    ".gg.",
    ".tT.",
    ".tT.",
    ".tT.",
    ".tT.",
    ".tT.",
    ".tT.",
    ".tT.",
    ".tT.",
    ".tT.",
    ".tT.",
    ".tT.",
    ".tT."
   ],
   "grip": [
    1,
    9
   ],
   "wpal": {
    "g": "#7fd8ff",
    "G": "#d8f6ff",
    "t": "#8a5a30",
    "T": "#5a3a1e"
   }
  },
  "ang": {
   "idle": 0,
   "windup": -35,
   "strike": 40,
   "cast": -20,
   "hurt": -20
  }
 },
 "cleric": {
  "pal": {
   "h": "#f6f1e4",
   "H": "#c8bea4",
   "b": "#e0b030",
   "B": "#a07a1a",
   "s": "#9a6240",
   "S": "#6e4028",
   "a": "#ece6d6",
   "A": "#b8ae96",
   "q": "#ffffff",
   "f": "#8a6a3a",
   "F": "#5a4220"
  },
  "body": [
   "........................",
   "...........hhhh.........",
   ".........hhhhhhhh.......",
   "........hhhhhhhhhH......",
   ".......hhhhhhhhhhhH.....",
   ".......hhhhhssssshH.....",
   ".......hhhhsssssssH.....",
   ".......Hhhhsessess......",
   ".......HhhhssssssS......",
   ".......HHhhSsssSS.......",
   "........HHhhSSSH........",
   ".........HHHHHH.........",
   "........aabbbbaa........",
   ".......aAabqqbaA........",
   "......aAAaabbaaAA.......",
   "......aAAaabbaaAA.......",
   "......aAAaabbaaAA.......",
   "......aAAbbbbbbBA.......",
   ".......AaaaqaaaAA.......",
   ".......AaaaqaaaaA.......",
   "......AAaaaqaaaaAA......",
   "......AaaaaqaaaaaA......",
   "......AaaaaqaaaaaAA.....",
   ".....AAaaaaqaaaaaaA.....",
   ".....AaaaaaqaaaaaaA.....",
   ".....AaaaaaqaaaaaaAA....",
   ".....AaaaaaqaaaaaaaA....",
   ".....bbbbbbbbbbbbbbB....",
   "........................",
   "........fF....ff........",
   ".......FFF....fff.......",
   "........................"
  ],
  "over": [],
  "sleeve": "a",
  "sleeve2": "A",
  "weapon": {
   "map": [
    ".b.b.",
    "bbBbb",
    ".bxb.",
    "bbBbb",
    ".b.b.",
    "..t..",
    "..t..",
    "..t..",
    "..t..",
    "..T.."
   ],
   "grip": [
    2,
    8
   ],
   "wpal": {
    "x": "#fff6c8",
    "t": "#8a6a3a",
    "T": "#5a4220"
   }
  },
  "ang": {
   "idle": 20,
   "windup": -70,
   "strike": 95,
   "cast": -10,
   "hurt": -25
  }
 },
 "rogue": {
  "pal": {
   "h": "#4a4064",
   "H": "#2a2440",
   "i": "#6a5c88",
   "s": "#f3d0b0",
   "S": "#c89a78",
   "r": "#c8323e",
   "R": "#7a1a26",
   "a": "#3d3550",
   "A": "#241e34",
   "q": "#5a4e74",
   "b": "#7a5a30",
   "B": "#4a3418",
   "p": "#2a2436",
   "P": "#18141f",
   "f": "#4a3428",
   "F": "#2a1c14",
   "m": "#c8d0dc"
  },
  "body": [
   "........................",
   "...........hhhh.........",
   ".........hhhiihhH.......",
   "........hhhiihhhhH......",
   ".......hhhhhhhhhhhH.....",
   ".......hhhhhssssshH.....",
   ".......Hhhhsessess......",
   ".......Hhhhssssss.......",
   ".......HHhhrrrrrrr......",
   "...rr...HHrrRrrrrR......",
   "..rRRrr..HHRRRRRR.......",
   "...RRRrr..aaaaaa........",
   ".....RRrrqaaaaaa........",
   "........aqqaaaaA........",
   ".......aAqqbaaaA........",
   ".......aAqaabaaA........",
   ".......aAaaaabaA........",
   ".......aAaaaaabA........",
   ".......aAbbbbbbB........",
   "........AaaaaaaA........",
   "........AaaAaaaA........",
   ".........pPp.ppP........",
   ".........pPp.ppP........",
   ".........pPp.ppP........",
   ".........pPP.ppP........",
   ".........pPP.ppP........",
   ".........pPP.ppP........",
   ".........fFF.ffF........",
   ".........fFF.ffF........",
   "........fFFF.fffF.......",
   "........FFFF.fffff......",
   "........................"
  ],
  "over": [
   [
    5,
    20,
    [
     ".m",
     ".m",
     ".m",
     "bBb"
    ]
   ]
  ],
  "sleeve": "a",
  "sleeve2": "A",
  "weapon": {
   "map": [
    ".l.",
    "lmM",
    "lmM",
    "lmM",
    "bbB",
    ".F."
   ],
   "grip": [
    1,
    5
   ],
   "wpal": {
    "l": "#ffffff",
    "m": "#c8d0dc",
    "M": "#7a8290",
    "F": "#3a2a1e"
   }
  },
  "ang": {
   "idle": 80,
   "windup": -40,
   "strike": 100,
   "cast": 60,
   "hurt": 40
  }
 },
 "ranger": {
  "pal": {
   "h": "#4a7a3a",
   "H": "#2e4a24",
   "i": "#6aa050",
   "s": "#c68a5a",
   "S": "#94603a",
   "c": "#3a5a2c",
   "C": "#223a1a",
   "a": "#5a8a3e",
   "A": "#3a5a26",
   "q": "#7aac54",
   "b": "#7a4e28",
   "B": "#4a2e14",
   "p": "#5a4a32",
   "P": "#3a2e1e",
   "f": "#6a4a2a",
   "F": "#3e2a16",
   "r": "#e86a3a",
   "x": "#e8e0c8"
  },
  "body": [
   "........................",
   "...........hhhh.........",
   ".........hhhiihhH.......",
   "........hhhiihhhhH......",
   ".......hhhhhhhhhhhH.....",
   "......hhhhhbbbbbbhH.....",
   ".....rhhhhbsssssss......",
   "....r.Hhhhsessess.......",
   "......HHhhssssssS.......",
   ".....HHHHhhSssSS........",
   "....xHHHH.HHSSS.........",
   "...xbbcc.aaaaaa.........",
   "...xbbcCaqqaaaaA........",
   "...xbbcCaqqaaaaA........",
   "...xbbcCaaqaaaaA........",
   "....bbcCaaabbbaA........",
   "....bbcCAbbbaaaA........",
   ".....ccCbaaaaaaA........",
   ".....ccCaBBBBBBB........",
   "....cccCAaaaaaaA........",
   "....ccCC.AaAaaAA........",
   "....cCC..pPp.ppP........",
   ".....C...pPp.ppP........",
   ".........pPp.ppP........",
   ".........pPP.ppP........",
   ".........pPP.ppP........",
   ".........fFF.ffF........",
   ".........fFF.ffF........",
   ".........fFF.ffF........",
   "........fFFF.fffF.......",
   "........FFFF.fffff......",
   "........................"
  ],
  "over": [],
  "sleeve": "a",
  "sleeve2": "A",
  "weapon": {
   "map": [
    "bb.",
    ".bx",
    ".bx",
    "..b",
    "..b",
    "..b",
    "..b",
    "..b",
    "..b",
    ".bx",
    ".bx",
    "bb."
   ],
   "grip": [
    2,
    6
   ],
   "wpal": {
    "b": "#8b5a2b",
    "x": "#e8e0c8"
   }
  },
  "ang": {
   "idle": 0,
   "windup": -15,
   "strike": 10,
   "cast": -10,
   "hurt": -10
  }
 },
 "alchemist": {
  "pal": {
   "h": "#e8702a",
   "H": "#b04a18",
   "i": "#ffa858",
   "s": "#f5d3b8",
   "S": "#cc9e80",
   "g": "#5a3a22",
   "x": "#9fe8ff",
   "a": "#6a8a5a",
   "A": "#4a6a3a",
   "q": "#8aac74",
   "b": "#8a5a32",
   "B": "#5a3a1a",
   "p": "#4a3a2e",
   "P": "#2e221a",
   "f": "#5a3a22",
   "F": "#382210",
   "v": "#e05a8a",
   "V": "#5ae07a"
  },
  "body": [
   "..........h..h..........",
   "........h.hhihh.h.......",
   ".......hhhhiihhhh.......",
   "......hhhhiihhhhhH......",
   ".......hhhhhhhhhhH......",
   ".......hgggggggggg......",
   ".......hgxxgggxxgg......",
   ".......Hhssssssss.......",
   ".......Hhsessess........",
   ".......HHsssssssS.......",
   "........HHSsssSS........",
   ".........SSSSSS.........",
   "........aaqbbbaa........",
   ".......aAaqbbbaaA.......",
   ".......aAaqbbbaaA.......",
   ".......aAqqbbbaaA.......",
   ".......aAaabbbaaA.......",
   ".......aAvVbbbVaA.......",
   ".......aABBBBBBBB.......",
   "........AaabbbaaA.......",
   "........AaAbbbaAA.......",
   ".........pPp.ppP........",
   ".........pPp.ppP........",
   ".........pPp.ppP........",
   ".........pPP.ppP........",
   ".........pPP.ppP........",
   ".........pPP.ppP........",
   ".........fFF.ffF........",
   ".........fFF.ffF........",
   "........fFFF.fffF.......",
   "........FFFF.fffff......",
   "........................"
  ],
  "over": [],
  "sleeve": "a",
  "sleeve2": "A",
  "weapon": {
   "map": [
    ".kk.",
    ".cc.",
    ".cc.",
    "cgGc",
    "gGGg",
    "gggg",
    ".gg."
   ],
   "grip": [
    1,
    2
   ],
   "wpal": {
    "k": "#8a5a32",
    "c": "#c8e0e8",
    "g": "#4ad07a",
    "G": "#b8ffd0"
   }
  },
  "ang": {
   "idle": 0,
   "windup": -60,
   "strike": 70,
   "cast": -20,
   "hurt": -20
  }
 }
};
const HERO_ARMS = {"idle": [[15, 15], ["ab.", "aB.", "aB.", ".ss", ".sS"], [2, 4]], "windup": [[13, 11], ["ss..", "sS..", ".aa.", "..ab", "..aB"], [0, 0]], "strike": [[15, 15], ["aaabss", "aBBbsS"], [5, 0]], "cast": [[15, 11], ["...ss", "...sS", "..ab.", ".aB..", "ab..."], [4, 0]], "hurt": [[14, 15], ["ab", "aB", "aB", "ss", "sS"], [0, 4]]};
const ART_BASE = { e: '#1c1424', w: '#ffffff' };
const POSE_NAME = ['idle', 'idle', 'windup', 'strike', 'cast', 'hurt'];

// 도트 그림을 각도만큼 돌린다 (가장 가까운 칸을 가져와서 칸 모양이 흐트러지지 않게)
function rotateArt(map, grip, deg) {
  const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a), out = [];
  const h = map.length, w = map[0].length, R2 = Math.ceil(Math.hypot(w, h)) + 1;
  for (let y = -R2; y <= R2; y++) {
    for (let x = -R2; x <= R2; x++) {
      // 돌린 자리 (x,y) 가 원래 그림의 어느 칸인지 거꾸로 계산
      const sx = Math.round(c * x + s * y + grip[0]), sy = Math.round(-s * x + c * y + grip[1]);
      if (sx < 0 || sy < 0 || sx >= w || sy >= h) continue;
      const ch = map[sy][sx];
      if (ch !== '.') out.push([x, y, ch]);
    }
  }
  return out;
}

function drawHeroArt(P, f, k) {
  const A = HERO_ART[k], g = P.g, pose = POSE_NAME[f];
  g.save(); g.translate(8, 3); // 무기가 잘리지 않게 둘레에 여백
  const color = ch => A.pal[ch] || ART_BASE[ch] || (A.weapon.wpal && A.weapon.wpal[ch]) || '#ff00ff';
  const breathe = f === 1 ? 1 : 0;
  const lean = { windup: -1, strike: 1, hurt: -1 }[pose] || 0;
  const UPPER = 21; // 이 줄 위쪽(윗몸)은 숨쉬기·기울기를 따라 움직인다
  const dot = (x, y, c) => { g.fillStyle = c; g.fillRect(x, y, 1, 1); };
  const shiftOf = y => (y < UPPER ? [lean, breathe] : [0, 0]);
  // 몸
  A.body.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.') continue;
      const [dx, dy] = shiftOf(y);
      dot(x + dx, y + dy, color(ch));
    }
  });
  // 덧그림 (방패, 뒤쪽 단검 등)
  for (const [ox, oy, map] of A.over) {
    map.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] !== '.') dot(ox + x + lean, oy + y + breathe, color(row[x])); });
  }
  // 앞쪽 팔과 무기
  const [apos, amap, hand] = HERO_ARMS[pose];
  const ax = apos[0] + lean, ay = apos[1] + breathe;
  const hx = ax + hand[0], hy = ay + hand[1];
  const W = A.weapon, wcol = ch => (W.wpal && W.wpal[ch]) || A.pal[ch] || ART_BASE[ch] || '#ff00ff';
  for (const [x, y, ch] of rotateArt(W.map, W.grip, A.ang[pose])) dot(hx + x, hy + y, wcol(ch));
  const armCol = { a: color(A.sleeve), b: color(A.sleeve), B: color(A.sleeve2), s: color('s'), S: color('S') };
  amap.forEach((row, y) => { for (let x = 0; x < row.length; x++) if (row[x] !== '.') dot(ax + x, ay + y, armCol[row[x]]); });
  // 주문 외울 때 손끝 빛
  if (pose === 'cast') {
    const glow = { knight: '#fff2a8', mage: '#bff0ff', cleric: '#fff2a8', rogue: '#e0a8ff', ranger: '#d8ffb0', alchemist: '#b8ffd0' }[k];
    for (const [dx, dy] of [[0, -2], [-1, -1], [0, -1], [1, -1], [-2, 0], [-1, 0], [1, 0], [2, 0], [-1, 1], [0, 1], [1, 1], [0, 2]]) dot(hx + 1 + dx, hy - 3 + dy, glow);
    dot(hx + 1, hy - 3, '#ffffff');
  }
  g.restore();
}
for (const k in HERO_ART) defSprite('hero_' + k, 40, 36, 6, (P, f) => drawHeroArt(P, f, k), { shade: false });
