'use strict';
// 전투 — 속도 순서대로 한 명씩 행동하는 턴제 전투

let B = null;
const HERO_SLOTS = [[158, 176], [122, 198], [164, 220]];
const SLOTS_N = {
  1: [[346, 206]],
  2: [[318, 188], [380, 210]],
  3: [[308, 178], [372, 184], [334, 212]],
  4: [[300, 174], [360, 172], [318, 212], [394, 206]],
};
const SLOTS_BIG = [[370, 212], [296, 182], [290, 214], [312, 160]];

// ---------- 유닛 ----------
function makeHeroUnit(h, i) {
  const s = heroStats(h), sp = getSprite('hero_' + h.cls);
  return {
    side: 'hero', ref: h, id: h.cls, name: h.name, spr: 'hero_' + h.cls, w: sp.w * BODY, h: sp.h * BODY,
    maxHp: s.hp, maxMp: s.mp, hp: clamp(h.hp, 0, s.hp), mp: clamp(h.mp, 0, s.mp),
    atk: s.atk, mag: s.mag, def: s.def, res: s.res, spd: s.spd, crit: s.crit + (hasRelic('coin') ? 8 : 0), eva: s.eva, fx: s.fx,
    thornPct: s.fx.thorns ? 0.25 : hasRelic('thorn') ? 0.15 : 0, scale: 1,
    weak: [], resist: [], st: {}, x: HERO_SLOTS[i][0], y: HERO_SLOTS[i][1], ox: 0, oy: 0, flash: 0, alpha: 1,
    phase: Math.random() * 2, alive: h.hp > 0, skills: heroSkills(h), hpShow: 1,
  };
}
function makeEnemyUnit(id, slot, modId) {
  const e = ENEMIES[id], sp = getSprite(e.spr), T = region().tier, D = DIFF[Run.diff ?? 1];
  const hm = e.scale ? [1, 1.8, 2.8, 3.9][T] : 1, sm = e.scale ? [1, 1.5, 2, 2.4][T] : 1;
  const M = modId ? MOD[modId] : {};
  const hp = Math.round(e.hp * hm * D.hp * (M.hp || 1));
  const am = sm * D.atk * (M.atk || 1), sc = M.scale || 1;
  const u = {
    side: 'enemy', id, base: e, name: (modId ? M.name + ' ' : '') + e.name, spr: e.spr, w: sp.w * BODY * sc, h: sp.h * BODY * sc, scale: sc,
    maxHp: hp, hp, mp: 0, maxMp: 0,
    atk: Math.round(e.atk * am), mag: Math.round(e.mag * am), def: Math.round(e.def * sm * (M.def || 1)), res: Math.round(e.res * sm), spd: Math.round(e.spd * (M.spd || 1)), crit: 5, eva: 3 + (M.eva || 0), fx: {},
    weak: e.weak || [], resist: (e.resist || []).concat(M.resist ? [M.resist] : []), undead: e.undead, boss: e.boss, elite: e.elite,
    xp: Math.round(e.xp * hm * (modId ? 1.7 : 1)), gold: Math.round(e.gold * hm * (modId ? 1.7 : 1)), ai: e.ai, acts: e.acts || 1, mod: modId || null, thornPct: 0,
    st: {}, x: slot[0], y: slot[1], slot, ox: 0, oy: -8, flash: 0, alpha: 0, phase: Math.random() * 2, alive: true, hpShow: 1, charge: null,
  };
  return u;
}

const heroUnits = () => B.units.filter(u => u.side === 'hero');
const enemyUnits = () => B.units.filter(u => u.side === 'enemy' && u.alive);
const foesOf = u => B.units.filter(v => v.side !== u.side && v.alive);
const friendsOf = u => B.units.filter(v => v.side === u.side && v.alive);

function stat(u, k) {
  let v = u[k] || 0;
  const s = u.st;
  if (k === 'atk' || k === 'mag') { if (s.atkUp) v *= 1.3; if (s.atkDown) v *= 0.75; }
  if (k === 'def' || k === 'res') { if (s.defUp) v *= 1.45; if (s.defDown) v *= 0.65; }
  if (k === 'spd') { if (s.spdUp) v *= 1.35; if (s.spdDown) v *= 0.65; }
  if (k === 'eva' && s.evaUp) v += 30;
  return v;
}

// ---------- 시작 ----------
// kind: normal / elite / boss / event
function startBattle(ids, kind = 'normal') {
  return new Promise(resolve => {
    B = { units: [], kind, round: 0, queue: [], active: null, auto: !!Settings.auto, ui: null, resolve, over: null, killed: [], fled: [], t: 0, banner: null, stealGold: 0, stolen: [],
      lamp: Run.lamp || 0, cam: { z: 1, x: 240, y: 135 }, seedUsed: false };
    Run.party.forEach((h, i) => B.units.push(makeHeroUnit(h, i)));
    const big = ids.some(id => getSprite(ENEMIES[id].spr).w > 44 || ENEMIES[id].boss || ENEMIES[id].elite);
    B.slots = big ? SLOTS_BIG : SLOTS_N[Math.min(4, ids.length)];
    // 변종 몬스터: 보통 전투에서 가끔 하나가 특별한 힘을 두르고 나온다
    let modAt = -1, modId = null;
    const modChance = (Run.diff === 2 ? 0.5 : 0.3) * (Run.region > 0 || (Run.pos != null && Run.map.nodes[Run.pos].l >= 3) ? 1 : 0);
    if ((kind === 'normal' || kind === 'event') && chance(modChance)) { modAt = ri(0, ids.length - 1); if (ids[modAt] === 'goldSlime') modAt = -1; else modId = pick(Object.keys(MOD)); }
    ids.forEach((id, i) => B.units.push(makeEnemyUnit(id, B.slots[i], i === modAt ? modId : null)));
    for (const u of heroUnits()) {
      if (!u.alive) continue;
      if (u.fx.haste) u.st.spdUp = 3;
      if (hasRelic('thunder')) u.st.spdUp = Math.max(u.st.spdUp || 0, 2);
      if (hasRelic('shell')) u.st.defUp = 2;
      if (hasRelic('flag')) u.st.atkUp = 2;
    }
    if (Run.blessing) { for (const u of heroUnits()) if (u.alive) u.st[Run.blessing] = 3; Run.blessing = null; }
    for (const id of ids) { Run.seen[id] = 1; dexMark(id, 'seen'); }
    setScene(BattleScene);
    battleLoop();
  });
}

async function battleLoop() {
  // 등장
  await wait(150);
  enemyUnits().forEach((u, i) => tween(400 + i * 120, k => { u.alpha = k; u.oy = -8 * (1 - k); }));
  if (B.kind === 'boss') {
    SFX.play('boss'); shake(4);
    const e = enemyUnits()[0];
    camTo(1.12, e.x, e.y - e.h * 0.5, 500).then(() => wait(900)).then(() => camTo(1, 240, 135, 500));
    showBanner(e.name, '#ff6a5a', 1800, region().tag + ' 우두머리');
    await wait(1600);
  } else await wait(500);

  while (!B.over) {
    B.round++;
    const order = B.units.filter(u => u.alive).map(u => ({ u, v: stat(u, 'spd') * rnd(0.85, 1.15) }));
    order.sort((a, b) => b.v - a.v);
    B.queue = order.map(o => o.u);
    while (B.queue.length && !B.over) {
      const u = B.queue.shift();
      if (!u.alive) continue;
      B.active = u;
      renderTurnBar();
      await unitTurn(u);
      B.active = null;
      await checkPhases();
      checkEnd();
    }
  }
  renderTurnBar();
  await finishBattle();
}

function checkEnd() {
  if (B.over) return;
  if (!heroUnits().some(u => u.alive)) B.over = 'lose';
  else if (!enemyUnits().length) B.over = 'win';
}

// ---------- 한 턴 ----------
async function unitTurn(u) {
  delete u.st.guard;
  await tickStatus(u);
  if (!u.alive) return;
  if (u.st.freeze || u.st.stun) {
    floatTxt(cxOf(u), topOf(u) - 6, u.st.freeze ? '얼어붙었다' : '기절했다', '#ffe066');
    delete u.st.freeze; delete u.st.stun;
    await wait(550);
    endTurn(u);
    return;
  }
  if (u.side === 'hero') {
    Run.stats.turns++;
    const cmd = B.auto ? heroAI(u) : await heroInput(u);
    hideMenus();
    if (cmd) await doCommand(u, cmd);
  } else {
    await enemyTurn(u);
  }
  endTurn(u);
  await wait(120);
}

function endTurn(u) {
  for (const k in u.st) {
    if (k === 'charge') continue;
    u.st[k]--;
    if (u.st[k] <= 0) delete u.st[k];
  }
  renderParty();
}

async function tickStatus(u) {
  const big = u.boss || u.elite;
  const dot = [['poison', big ? 0.03 : 0.08, '#6ad04a'], ['burn', big ? 0.025 : 0.06, '#ff7a2a'], ['bleed', big ? 0.02 : 0.05, '#e0303a']];
  for (const [k, r, c] of dot) {
    if (!u.st[k] || !u.alive) continue;
    const d = Math.max(1, Math.round(u.maxHp * r * (u.side === 'enemy' && hasRelic('viper') ? 1.5 : 1)));
    u.hp = Math.max(0, u.hp - d);
    u.flash = 0.6;
    floatNum(cxOf(u), topOf(u), d, c);
    burst(cxOf(u), cyOf(u), { n: 6, c: [c], g: -20 });
    await wait(260);
    if (u.hp <= 0) { await kill(u); return; }
  }
  let heal = 0;
  if (u.st.regen) heal += Math.round(u.maxHp * 0.08);
  if (u.fx.regen) heal += Math.round(u.maxHp * 0.04);
  if (heal && u.hp < u.maxHp) { heal = Math.min(heal, u.maxHp - u.hp); u.hp += heal; floatNum(cxOf(u), topOf(u), '+' + heal, '#6ae07a'); await wait(200); }
  if (u.fx.mpRegen) u.mp = Math.min(u.maxMp, u.mp + 3);
  if (u.side === 'hero' && hasRelic('flower')) u.mp = Math.min(u.maxMp, u.mp + 2);
  renderParty();
}

function addSt(u, k, t, src) {
  if (!u.alive) return false;
  if ((u.boss || u.elite) && (k === 'stun' || k === 'freeze') && chance(0.5)) return false;
  const opp = { atkUp: 'atkDown', atkDown: 'atkUp', defUp: 'defDown', defDown: 'defUp', spdUp: 'spdDown', spdDown: 'spdUp' }[k];
  if (opp && u.st[opp]) { delete u.st[opp]; floatTxt(cxOf(u), topOf(u) - 4, ST_NAME[opp] + ' 풀림', '#c8c0d8'); return true; }
  const extra = B.active === u ? 1 : 0;
  u.st[k] = Math.max(u.st[k] || 0, t + extra);
  const good = !BAD_ST.includes(k);
  floatTxt(cxOf(u), topOf(u) - 12 - Math.random() * 6, ST_NAME[k], good ? '#9fe8ff' : '#ff9a7a');
  return true;
}

// ---------- 행동 ----------
async function doCommand(u, cmd) {
  if (cmd.type === 'guard') {
    u.st.guard = 1; u.mp = Math.min(u.maxMp, u.mp + Math.round(u.maxMp * 0.08));
    SFX.play('guard'); floatTxt(cxOf(u), topOf(u) - 6, '방어', '#c8d0e0');
    await wait(400);
    return;
  }
  if (cmd.type === 'flee') {
    B.fleeTry = (B.fleeTry || 0) + 1;
    if (chance(0.5 + B.fleeTry * 0.15)) {
      SFX.play('wind'); showBanner('도망쳤다!', '#c8c0d8', 900);
      for (const h of heroUnits()) tween(500, k => { h.ox = -60 * k; });
      await wait(700);
      B.over = 'flee';
    } else { SFX.play('error'); showBanner('도망치지 못했다!', '#ff9a7a', 900); await wait(800); }
    return;
  }
  if (cmd.type === 'item') return useItem(u, cmd.id, cmd.targets);
  if (cmd.type === 'ult') {
    B.lamp = 0; renderLamp();
    await cutIn(u, SKILLS['ult_' + u.id]);
    await act(u, 'ult_' + u.id, cmd.targets);
    camTo(1, 240, 135, 300);
    return;
  }
  return act(u, cmd.id, cmd.targets);
}

async function lunge(u, tgt, back) {
  const dir = u.side === 'hero' ? 1 : -1;
  const dist = tgt && tgt !== u ? clamp(Math.abs(tgt.x - u.x) - (tgt.w + u.w) * 0.45, 6, 200) * dir : 8 * dir;
  const dy = tgt && tgt !== u ? (tgt.y - u.y) * 0.8 : 0;
  if (!back) {
    if (u.side === 'hero') { u.pose = 2; await wait(110); } else { u.squash = 0.6; await wait(90); u.squash = -1; }
    await tween(170, k => { u.ox = dist * k; u.oy = dy * k - Math.sin(k * Math.PI) * 6; });
    if (u.side === 'hero') u.pose = 3;
  } else {
    await tween(200, k => { u.ox = dist * (1 - k); u.oy = dy * (1 - k); });
    if (u.side === 'hero') u.pose = null;
  }
}

function resolveTargets(u, sk, chosen) {
  if (chosen && chosen.length) return chosen.filter(t => sk.tgt === 'deadAlly' || t.alive);
  const foes = foesOf(u), friends = friendsOf(u);
  switch (sk.tgt) {
    case 'enemies': return foes;
    case 'allies': return friends;
    case 'self': return [u];
    case 'random': return [];
    case 'weakest': return foes.length ? [foes.slice().sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0]] : [];
    case 'ally': {
      if (sk.kind === 'heal') return [friends.slice().sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0]];
      const nb = friends.filter(f => f !== u && !f.st.defUp);
      return [nb.length ? pick(nb) : u];
    }
    default: {
      const taunt = foes.filter(f => f.st.taunt);
      if (u.side === 'enemy' && taunt.length) return [taunt[0]];
      return foes.length ? [pick(foes)] : [];
    }
  }
}

async function act(u, id, chosen) {
  const sk = SKILLS[id] || ESKILLS[id];
  if (u.side === 'hero') u.mp = Math.max(0, u.mp - (sk.mp || 0));
  renderParty();
  let el = sk.el;
  if (id === 'attack' && u.fx.fireEdge) el = 'fire';
  if (id === 'attack' && u.fx.holyEdge) el = 'holy';
  if (id !== 'attack' && !sk.ult) showBanner(sk.name, u.side === 'hero' ? '#ffe8a0' : '#ff9a7a', 900);

  if (sk.charge) {
    if (sk.self) for (const [k, t] of sk.self) addSt(u, k, t);
    u.charge = sk.charge; u.st.charge = 99;
    await playFX(sk.fx, u, [u]);
    floatTxt(cxOf(u), topOf(u) - 8, '힘을 모은다…!', '#ff4a8a');
    await wait(500);
    return;
  }

  let targets = resolveTargets(u, sk, chosen);
  if (sk.tgt !== 'random' && !targets.length && sk.kind !== 'special') return;
  const melee = (sk.kind === 'phys') && ['slash', 'pierce', 'smash', 'bite', 'claw'].includes(sk.fx);
  const first = targets[0];
  if (melee && sk.tgt !== 'enemies' && sk.tgt !== 'random') await lunge(u, first);
  else if (sk.kind === 'phys' || sk.kind === 'mag') await lunge(u, null);
  else { u.flash = 0.5; await wait(120); }
  if (u.side === 'hero' && sk.kind !== 'phys') { u.pose = 4; SFX.play('buff'); }

  if (sk.kind === 'phys' || sk.kind === 'mag') {
    if (sk.tgt === 'random') {
      for (let i = 0; i < (sk.hits || 1); i++) {
        const foes = foesOf(u);
        if (!foes.length) break;
        const t = pick(foes);
        await playFX(el === 'bolt' ? 'bolt' : sk.fx, u, [t]);
        await strike(u, t, sk, el);
        await wait(70);
      }
    } else {
      for (let i = 0; i < (sk.hits || 1); i++) {
        const live = targets.filter(t => t.alive);
        if (!live.length) break;
        await playFX(sk.fx, u, live);
        await Promise.all(live.map(t => strike(u, t, sk, el)));
        if (sk.hits > 1) await wait(90);
      }
    }
    if (sk.special === 'selfDestruct' && u.alive) { await playFX('explode', u, []); u.hp = 0; await kill(u); }
    if (sk.post) {
      const friends = friendsOf(u);
      await playFX('heal', u, friends);
      for (const f of friends) { healUnit(f, Math.round(f.maxHp * sk.post.heal)); for (const [k, t] of sk.post.st) addSt(f, k, t); }
      await wait(300);
    }
  } else if (sk.kind === 'heal') {
    await playFX(sk.fx, u, targets);
    for (const t of targets) {
      let amt = sk.pct ? t.maxHp * sk.pct : stat(u, 'mag') * sk.pow * rnd(0.95, 1.05) + 6;
      healUnit(t, Math.round(amt));
      if (sk.cure) cure(t);
      if (sk.mpGain) { t.mp = Math.min(t.maxMp, t.mp + sk.mpGain); if (t.maxMp) floatNum(cxOf(t) + 10, topOf(t) + 8, '+' + sk.mpGain, '#7fb8ff'); }
      if (sk.st) for (const [k, ch, tt] of sk.st) if (chance(ch)) addSt(t, k, tt);
    }
    if (sk.self) for (const [k, t] of sk.self) addSt(u, k, t);
    await wait(350);
  } else if (sk.kind === 'buff') {
    await playFX(sk.fx, u, targets);
    if (sk.st) for (const t of targets) for (const [k, ch, tt] of sk.st) if (chance(ch)) addSt(t, k, tt);
    if (sk.self) for (const [k, t] of sk.self) addSt(u, k, t);
    SFX.play(targets[0] && targets[0].side !== u.side ? 'debuff' : 'buff');
    await wait(400);
  } else if (sk.kind === 'special') {
    await special(u, id, sk, targets);
  }
  if (melee && sk.tgt !== 'enemies' && sk.tgt !== 'random') await lunge(u, first, true);
  else { u.ox = 0; u.oy = 0; }
  if (u.pose !== 5) u.pose = null;
  renderParty();
}

// 한 번 때리기
async function strike(u, t, sk, el) {
  if (!t.alive || !u.alive) return;
  const magic = sk.kind === 'mag';
  if (!magic && !(sk.acc >= 100)) {
    const hit = 95 + (sk.acc || 0) - stat(t, 'eva');
    if (Math.random() * 100 > hit) { SFX.play('miss'); floatTxt(cxOf(t), topOf(t) - 4, '빗나감', '#c8c0d8'); dodge(t); return; }
  } else if (magic && t.st.evaUp && chance(0.15)) { SFX.play('miss'); floatTxt(cxOf(t), topOf(t) - 4, '빗나감', '#c8c0d8'); dodge(t); return; }
  if (el === 'best') {
    const els = ['fire', 'ice', 'bolt'];
    el = els.find(e => t.weak.includes(e)) || els.find(e => !t.resist.includes(e)) || 'fire';
  }
  const A = stat(u, magic ? 'mag' : 'atk'), D0 = stat(t, magic ? 'res' : 'def'), D = sk.pierce ? D0 * 0.2 : D0;
  let dmg = (A * sk.pow * 50) / (50 + D * 1.3) * rnd(0.9, 1.1);
  let tag = null;
  if (t.weak.includes(el)) { dmg *= 1.5; tag = 'weak'; } else if (t.resist.includes(el)) { dmg *= 0.5; tag = 'resist'; }
  if (tag && t.side === 'enemy') { Run.known[t.id] = Run.known[t.id] || {}; Run.known[t.id][el] = tag; }
  if (el === 'holy' && t.undead && tag !== 'weak') dmg *= 1.3;
  if (u.side === 'hero') {
    if (el === 'fire' && hasRelic('ember')) dmg *= 1.3;
    if (el === 'holy' && hasRelic('grail')) dmg *= 1.4;
    if ((t.boss || t.elite) && hasRelic('mark')) dmg *= 1.18;
  }
  const cc = ((u.crit || 0) + (sk.crit || 0)) * (magic ? 0.5 : 1);
  const crit = Math.random() * 100 < cc;
  if (crit) dmg *= u.fx.critDmg ? 2.2 : 1.7;
  if (t.st.guard) dmg *= 0.5;
  if (sk.special === 'execute' && t.hp / t.maxHp < 0.3) dmg *= 2.5;
  if (t.st.freeze && el === 'fire') delete t.st.freeze;
  dmg = Math.max(1, Math.round(dmg));
  await damage(t, dmg, { crit, tag, el, src: u });
  if (u.fx.lifesteal && !magic && u.alive) healUnit(u, Math.max(1, Math.round(dmg * 0.15)), true);
  if (sk.drain && u.alive) healUnit(u, Math.round(dmg * sk.drain), true);
  if (u.side === 'hero' && hasRelic('fang') && u.alive) healUnit(u, Math.max(1, Math.round(dmg * 0.06)), true);
  if (u.mod === 'vampiric' && u.alive) healUnit(u, Math.round(dmg * MOD.vampiric.drain), true);
  if (u.mod === 'blazing' && t.alive && chance(MOD.blazing.burn)) addSt(t, 'burn', 3);
  if (t.thornPct && u.alive && !magic) { const back = Math.max(1, Math.round(dmg * t.thornPct)); await damage(u, back, { el: 'phys', quiet: true }); }
  if (sk.st && t.alive) for (const [k, ch, tt] of sk.st) if (chance(k === 'freeze' && u.side === 'hero' && hasRelic('frost') ? ch + 0.2 : ch)) addSt(t, k, tt, u);
  if (sk.special === 'steal' && u.side === 'hero') doSteal(u, t);
}

function dodge(t) {
  const d = t.side === 'hero' ? -8 : 8;
  tween(140, k => { t.ox = d * Math.sin(k * Math.PI); });
}

async function damage(t, dmg, o = {}) {
  t.hp = Math.max(0, t.hp - dmg);
  gainLamp(t.side === 'hero' ? 6 : 3 + (o.crit ? 3 : 0) + (o.tag === 'weak' ? 3 : 0));
  if (o.crit && Settings.shake) camPunch(t, 1.05);
  t.flash = 1;
  if (t.side === 'hero') { t.pose = 5; setTimeout(() => { if (t.pose === 5) t.pose = null; }, 420 / (Settings.speed || 1)); }
  else t.squash = o.crit ? 1.3 : 0.9;
  const kb = (t.side === 'hero' ? -1 : 1) * (o.crit ? 6 : 3);
  tween(180, k => { t.ox = kb * Math.sin(k * Math.PI); });
  const color = o.tag === 'weak' ? '#ffa83a' : o.tag === 'resist' ? '#a8a0b8' : o.crit ? '#ffe066' : '#ffffff';
  floatNum(cxOf(t), topOf(t), dmg, color, o.crit || o.tag === 'weak');
  if (o.crit) { floatTxt(cxOf(t), topOf(t) - 16, '치명타!', '#ffe066'); SFX.play('crit'); shake(4); }
  else if (!o.quiet) SFX.play('hit');
  if (o.tag === 'weak') floatTxt(cxOf(t), topOf(t) - (o.crit ? 28 : 16), '약점!', '#ffa83a');
  if (o.tag === 'resist') floatTxt(cxOf(t), topOf(t) - 16, '저항', '#a8a0b8');
  if (t.side === 'hero' && dmg > t.maxHp * 0.25) shake(3);
  renderParty();
  if (t.hp <= 0) await kill(t);
}

function healUnit(t, amt, quiet) {
  if (!t.alive) return;
  amt = Math.min(amt, t.maxHp - t.hp);
  t.hp += amt;
  if (amt > 0 || !quiet) floatNum(cxOf(t), topOf(t) + (quiet ? 6 : 0), '+' + amt, '#6ae07a');
  renderParty();
}
function cure(t) { for (const k of BAD_ST) delete t.st[k]; }

async function kill(u) {
  if (!u.alive) return;
  if (u.base && u.base.reassemble && !u.reassembled) {
    u.reassembled = true;
    SFX.play('dark');
    floatTxt(cxOf(u), topOf(u) - 8, '뼈가 다시 맞춰진다!', '#c86aff');
    burst(cxOf(u), cyOf(u), { n: 16, c: ['#e8e4d0', '#a8a490'], g: 100, up: 30 });
    u.hp = Math.round(u.maxHp * 0.35);
    await wait(500);
    return;
  }
  if (u.side === 'hero' && hasRelic('seed') && !B.seedUsed) {
    B.seedUsed = true;
    SFX.play('holy');
    floatTxt(cxOf(u), topOf(u) - 8, '부활의 씨앗!', '#8fd36b');
    burst(cxOf(u), cyOf(u), { n: 20, c: ['#8fd36b', '#ffffff', '#ffe066'], g: -40, glow: 1 });
    u.hp = Math.round(u.maxHp * 0.3);
    await wait(500);
    renderParty();
    return;
  }
  u.alive = false;
  u.st = {}; u.charge = null;
  SFX.play('death');
  if (u.side === 'enemy') {
    B.killed.push(u); Run.stats.kills++; dexMark(u.id, 'kills');
    for (let i = 0; i < 30; i++) burst(u.x + rnd(-u.w / 2, u.w / 2), u.y - rnd(0, u.h), { n: 1, c: ['#ffffff', '#c8c0d8', '#7a6a8a'], spd: [10, 40], g: -40, life: [0.4, 0.9] });
    await tween(380, k => { u.alpha = 1 - k; u.flash = 1 - k; });
    u.gone = true;
  } else {
    floatTxt(cxOf(u), topOf(u) - 8, '쓰러졌다', '#ff7a7a');
    await wait(300);
  }
  renderParty();
}

async function special(u, id, sk, targets) {
  if (id === 'ult_cleric') {
    const all = heroUnits();
    await playFX('holy', u, all);
    for (const t of all) {
      if (!t.alive) { t.alive = true; t.hp = 0; t.st = {}; floatTxt(cxOf(t), topOf(t) - 10, '일어났다!', '#fff2a8'); }
      healUnit(t, Math.round(t.maxHp * 0.7)); cure(t); addSt(t, 'regen', 3);
    }
    await wait(500);
    return;
  }
  if (id === 'focus') {
    await playFX('buff', u, [u]);
    const g = Math.round(u.maxMp * 0.3);
    u.mp = Math.min(u.maxMp, u.mp + g);
    floatNum(cxOf(u), topOf(u), '+' + g, '#7fb8ff');
    addSt(u, 'atkUp', 2);
    await wait(400);
  } else if (id === 'revive') {
    const t = targets[0];
    if (!t || t.alive) return;
    await playFX('holy', u, [t]);
    t.alive = true; t.hp = Math.round(t.maxHp * 0.5); t.st = {};
    floatTxt(cxOf(t), topOf(t) - 6, '일어났다!', '#fff2a8');
    await wait(400);
  } else if (id === 'transmute') {
    const t = targets[0];
    await playFX('dark', u, [t]);
    const pool = shuffle(['poison', 'burn', 'freeze', 'stun', 'defDown', 'atkDown', 'spdDown', 'bleed']);
    let n = 0;
    for (const k of pool) { if (n >= 2) break; if (addSt(t, k, k === 'freeze' || k === 'stun' ? 1 : 3)) n++; }
    await wait(400);
  } else if (sk.special === 'summon') {
    const free = B.slots.filter(s => !B.units.some(v => v.alive && v.slot === s && v.side === 'enemy'));
    await playFX('summon', u, []);
    for (let i = 0; i < sk.n && free.length; i++) {
      const v = makeEnemyUnit(sk.summon, free.shift());
      v.xp = Math.round(v.xp * 0.5);
      B.units.push(v);
      tween(400, k => { v.alpha = k; v.oy = -8 * (1 - k); });
    }
    await wait(450);
  } else if (sk.special === 'flee') {
    showBanner('황금 슬라임이 도망쳤다!', '#f2c230', 900);
    await tween(400, k => { u.alpha = 1 - k; u.ox = 40 * k; });
    u.alive = false; u.gone = true; B.fled.push(u);
    await wait(300);
  }
}

function doSteal(u, t) {
  if (!chance(0.65)) { floatTxt(cxOf(u), topOf(u) - 10, '훔치지 못했다', '#c8c0d8'); return; }
  if (chance(0.6)) {
    const g = ri(6, 14) * (region().tier + 1) * (t.boss || t.elite ? 3 : 1);
    B.stealGold += g; SFX.play('coin');
    floatTxt(cxOf(u), topOf(u) - 10, `금화 ${g}개!`, '#f2c230');
  } else {
    const it = pick(['hp', 'hp', 'mp', 'herb', 'bombFire', 'smoke', 'hpBig']);
    B.stolen.push(it); SFX.play('coin');
    floatTxt(cxOf(u), topOf(u) - 10, ITEMS[it].name + '!', '#f2c230');
  }
}

async function useItem(u, id, chosen) {
  const it = ITEMS[id];
  Run.items[id]--;
  if (Run.items[id] <= 0) delete Run.items[id];
  showBanner(it.name, '#ffe8a0', 800);
  u.pose = 4;
  let targets = chosen && chosen.length ? chosen : it.tgt === 'enemies' ? foesOf(u) : it.tgt === 'allies' ? friendsOf(u) : [u];
  u.flash = 0.5;
  await wait(150);
  if (it.dmg) {
    const fx = it.el === 'fire' ? 'fire' : it.el === 'ice' ? 'ice' : 'holy';
    await playFX(fx, u, targets);
    const amt = it.dmg * (1 + region().tier * 0.8);
    await Promise.all(targets.map(async t => {
      let d = amt * rnd(0.9, 1.1), tag = null;
      if (t.weak.includes(it.el)) { d *= 1.5; tag = 'weak'; } else if (t.resist.includes(it.el)) { d *= 0.5; tag = 'resist'; }
      if (tag) { Run.known[t.id] = Run.known[t.id] || {}; Run.known[t.id][it.el] = tag; }
      await damage(t, Math.round(d), { tag, el: it.el });
      if (it.st && t.alive) for (const [k, ch, tt] of it.st) if (chance(ch)) addSt(t, k, tt);
    }));
  } else if (it.st) {
    await playFX('smoke', u, targets);
    for (const t of targets) for (const [k, ch, tt] of it.st) if (chance(ch)) addSt(t, k, tt);
  } else {
    const t = targets[0];
    if (it.revive) {
      if (t.alive) return;
      await playFX('holy', u, [t]);
      t.alive = true; t.hp = Math.round(t.maxHp * it.revive); t.st = {};
      floatTxt(cxOf(t), topOf(t) - 6, '일어났다!', '#fff2a8');
    } else {
      await playFX('heal', u, [t]);
      if (it.full) { healUnit(t, t.maxHp); t.mp = t.maxMp; }
      if (it.heal) healUnit(t, it.heal);
      if (it.mpGain) { const g = Math.min(it.mpGain, t.maxMp - t.mp); t.mp += g; floatNum(cxOf(t) + 10, topOf(t) + 8, '+' + g, '#7fb8ff'); }
      if (it.cure) cure(t);
    }
  }
  await wait(300);
  u.pose = null;
  renderParty();
}

// ---------- 몬스터 생각 ----------
const COND = {
  allyHurt: u => friendsOf(u).some(a => a.hp / a.maxHp < 0.55),
  hurt: u => u.hp / u.maxHp < 0.6,
  low: u => u.hp / u.maxHp < 0.35,
  noBuff: u => !u.st.atkUp && !u.st.defUp && !u.st.evaUp,
  fewAdds: u => friendsOf(u).length < 3,
  noDebuff: u => !foesOf(u).some(f => f.st.atkDown),
  allyNoBuff: u => friendsOf(u).some(a => a !== u && !a.st.defUp),
};
async function enemyTurn(u) {
  if (u.charge) {
    const id = u.charge;
    u.charge = null; delete u.st.charge;
    await act(u, id);
    return;
  }
  const acts = u.phase2on ? u.base.phase2.acts : u.acts;
  for (let i = 0; i < acts; i++) {
    if (!u.alive || !heroUnits().some(h => h.alive)) break;
    const list = u.ai.filter(([, , c]) => !c || COND[c](u));
    const [id] = weighted(list, x => x[1]);
    await act(u, id);
    if (u.charge) break;
    if (i < acts - 1) await wait(250);
  }
}
async function checkPhases() {
  for (const u of enemyUnits()) {
    const p = u.base.phase2;
    if (p && !u.phase2on && u.hp / u.maxHp <= p.at) {
      u.phase2on = true; u.ai = p.ai;
      SFX.play('roar'); shake(6); flash('#ff3a3a', 0.3);
      showBanner(p.msg, '#ff6a5a', 2000);
      addSt(u, 'atkUp', 3);
      await wait(1400);
    }
  }
}

// ---------- 자동 전투 ----------
function heroAI(u) {
  if (B.lamp >= 100 && (u.id !== 'cleric' || heroUnits().some(h => !h.alive || h.hp / h.maxHp < 0.5))) {
    const us = SKILLS['ult_' + u.id];
    return { type: 'ult', targets: us.tgt === 'enemy' ? [enemyUnits().slice().sort((a, b) => b.hp - a.hp)[0]] : undefined };
  }
  const sk = u.skills.map(id => [id, SKILLS[id]]).filter(([, s]) => s.mp <= u.mp);
  const allies = heroUnits().filter(h => h.alive), dead = heroUnits().filter(h => !h.alive), foes = enemyUnits();
  const rev = sk.find(([, s]) => s.tgt === 'deadAlly');
  if (dead.length && rev) return { type: 'skill', id: rev[0], targets: [dead[0]] };
  const hurt = allies.filter(a => a.hp / a.maxHp < 0.45).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
  if (hurt.length) {
    const grp = sk.find(([, s]) => s.kind === 'heal' && s.tgt === 'allies');
    if (grp && hurt.length >= 2) return { type: 'skill', id: grp[0] };
    const one = sk.find(([, s]) => s.kind === 'heal' && s.tgt === 'ally');
    if (one) return { type: 'skill', id: one[0], targets: [hurt[0]] };
    const self = sk.find(([, s]) => s.kind === 'heal' && s.tgt === 'self');
    if (self && hurt[0] === u) return { type: 'skill', id: self[0] };
    if (Run.items.hp && hurt[0].hp / hurt[0].maxHp < 0.3) return { type: 'item', id: 'hp', targets: [hurt[0]] };
  }
  const focus = sk.find(([id]) => id === 'focus');
  if (focus && u.mp < u.maxMp * 0.3) return { type: 'skill', id: 'focus' };
  const target = foes.slice().sort((a, b) => a.hp - b.hp)[0];
  const dmg = sk.filter(([, s]) => (s.kind === 'phys' || s.kind === 'mag') && s.mp > 0);
  if (dmg.length && u.mp > u.maxMp * 0.2 && chance(0.7)) {
    const aoe = dmg.filter(([, s]) => s.tgt === 'enemies' || s.tgt === 'random');
    if (foes.length >= 3 && aoe.length) return { type: 'skill', id: aoe[aoe.length - 1][0] };
    const kn = Run.known[target.id] || {};
    const single = dmg.filter(([, s]) => s.tgt === 'enemy');
    const weak = single.find(([, s]) => kn[s.el] === 'weak');
    const ok = single.filter(([, s]) => kn[s.el] !== 'resist');
    const ch = weak || (ok.length ? ok[ok.length - 1] : null);
    if (ch) return { type: 'skill', id: ch[0], targets: [target] };
  }
  return { type: 'skill', id: 'attack', targets: [target] };
}

// ---------- 끝 ----------
async function finishBattle() {
  hideMenus();
  B.queue = []; B.active = null; renderTurnBar();
  const res = B.over;
  Run.lamp = res === 'win' ? B.lamp : 0;
  saveDex();
  // 결과를 동료에게 돌려준다
  for (const u of heroUnits()) { u.ref.hp = u.alive ? u.hp : 0; u.ref.mp = u.mp; }
  if (res === 'win') {
    Run.stats.battles++;
    for (const h of heroUnits()) if (h.alive) { h.pose = 4; tween(300, k => { h.oy = -Math.sin(k * Math.PI) * 6; }); }
    SFX.play('victory');
    Music.stop();
    await wait(900);
    const rw = computeRewards();
    applyRewards(rw);
    await showRewards(rw);
  } else if (res === 'lose') {
    Music.stop(); SFX.play('defeat');
    showBanner('원정대가 쓰러졌다…', '#ff7a7a', 2500);
    FX.dimTarget = 0.6;
    await new Promise(r => setTimeout(r, 2400));
    FX.dimTarget = 0;
  }
  const done = B.resolve;
  done(res);
}

function computeRewards() {
  const T = region().tier;
  let xp = 0, gold = B.stealGold;
  const items = [...B.stolen], equips = [];
  for (const e of B.killed) {
    xp += e.xp; gold += Math.round(e.gold * rnd(0.85, 1.15));
    if (chance(e.boss || e.elite ? 0.8 : 0.18)) items.push(weighted([{ id: 'hp', w: 5 }, { id: 'mp', w: 3 }, { id: 'herb', w: 2 }, { id: 'bombFire', w: 1 }, { id: 'bombIce', w: 1 }, { id: 'smoke', w: 1 }, { id: 'hpBig', w: T }, { id: 'feather', w: 0.6 }]).id);
    if (e.elite) equips.push(randomEquip(T, Math.max(1, rollRarity(T, 0.1))));
    if (e.boss && !e.base.final) equips.push(randomEquip(T, Math.max(2, rollRarity(T, 0.2))));
    if (e.id === 'mimic') equips.push(randomEquip(T, Math.max(1, rollRarity(T))));
  }
  if (B.kind === 'normal' && chance(0.12)) equips.push(randomEquip(T));
  const D = DIFF[Run.diff ?? 1];
  gold = Math.round(gold * D.gold * (hasRelic('pouch') ? 1.3 : 1));
  xp = Math.round(xp * D.xp * (hasRelic('glasses') ? 1.2 : 1));
  return { xp, gold, items, equips };
}
function applyRewards(rw) {
  Run.gold += rw.gold; Run.stats.gold += rw.gold;
  for (const id of rw.items) addItem(id);
  for (const e of rw.equips) Run.bag.push(e);
  rw.ups = [];
  for (const h of Run.party) {
    if (h.hp <= 0) continue;
    const s = heroStats(h);
    h.hp = Math.min(s.hp, h.hp + Math.round(s.hp * (hasRelic('herb') ? 0.25 : 0.15)));
    h.mp = Math.min(s.mp, h.mp + Math.round(s.mp * 0.2));
    const ups = gainXp(h, rw.xp);
    if (ups.length) rw.ups.push({ h, ups });
  }
}
