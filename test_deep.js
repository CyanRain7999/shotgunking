'use strict';
const G = require('./game.js');

function invariant(g, label) {
  const seen = new Set();
  for (const p of g.pieces) {
    const k = p.x + ',' + p.y;
    if (seen.has(k)) throw new Error(label + ': overlap ' + k);
    seen.add(k);
    if (!G.inB(p.x, p.y)) throw new Error(label + ': off board');
    if (p.hp <= 0) throw new Error(label + ': dead piece present');
  }
  const obs = new Set();
  for (const o of g.obstacles) {
    const k = o.x + ',' + o.y;
    if (obs.has(k) || seen.has(k)) throw new Error(label + ': obstacle overlap');
    obs.add(k);
  }
  if (seen.has(g.player.x + ',' + g.player.y)) throw new Error(label + ': player overlap');
  if (g.player.hp < 0 || g.player.hp > g.player.maxHp) throw new Error(label + ': hp range');
  for (const w of g.weapons) {
    if (w.ammo < 0 || w.ammo > w.maxAmmo) throw new Error(label + ': ammo range ' + w.id);
  }
  if (g.floorCleared && g.phase === 'player') throw new Error(label + ': stuck floorCleared');
}

function evalAngle(g, angle) {
  const w = g.weapons[g.weapon];
  if (!w || w.type === 'flame' || w.type === 'bomber') {
    // simple cone estimate
    return { value: 30, kingAim: false };
  }
  const eff = G.effectiveWeapon(g, w);
  const limit = eff.pierce >= 900 ? 900 : eff.pierce + 1;
  const hits = G.raycast(g, g.player.x + 0.5, g.player.y + 0.5, angle, eff.range, limit);
  let value = 0, kingAim = false;
  for (const h of hits) {
    if (h.kind === 'obstacle') break;
    value += h.pc.type === 'king' ? 100 : { pawn: 10, knight: 20, bishop: 20, rook: 30, queen: 40 }[h.pc.type];
    if (h.pc.type === 'king') kingAim = true;
  }
  return { value, kingAim };
}

function botAction(g) {
  const threat = G.threatMap(g);
  const w = g.weapons[g.weapon];
  if (w.ammo <= 0 && !g.musou) return ['reload', 0];
  const k = G.whiteKing(g);
  if (!k) return ['reload', 0];

  // find the best of 24 aim angles (mouse-style continuous aiming)
  let bestAngle = null, bestVal = -1;
  for (let i = 0; i < 24; i++) {
    const angle = i * 15 - 180;
    const ev = evalAngle(g, angle);
    if (ev.value > bestVal) { bestVal = ev.value; bestAngle = angle; }
  }
  if (bestVal > 0) return ['fire', bestAngle];

  // reposition toward the king, avoiding red threat squares
  const legal = G.legalPlayerMoves(g);
  if (legal.length) {
    let bestM = legal[0];
    for (const m of legal) {
      const a = Math.max(Math.abs(m.x - k.x), Math.abs(m.y - k.y));
      const b = Math.max(Math.abs(bestM.x - k.x), Math.abs(bestM.y - k.y));
      const da = threat[m.y][m.x] ? 100 : 0;
      const db = threat[bestM.y][bestM.x] ? 100 : 0;
      if (a + da < b + db) bestM = m;
    }
    return ['move', bestM];
  }
  return ['reload', 0];
}

(async () => {
  let reached = 0;
  for (let seed = 0; seed < 12; seed++) {
    let s = seed + 1;
    const origRandom = Math.random;
    Math.random = () => { s = (s * 1103515245 + 12345) >>> 0; return s / 4294967296; };
    const g = G.newGame('classic');
    g.turbo = true; g.autoPick = true;
    g.player.maxHp += 2; g.player.hp += 2;
    g.stats.dmg += 1; g.stats.range = 5;
    G.spawnFloor(g);
    let steps = 0;
    while (!g.over && g.floor <= 10 && steps < 600) {
      invariant(g, 'deep seed=' + seed + ' step=' + steps + ' floor=' + g.floor);
      if (g.phase === 'player') {
        const [kind, arg] = botAction(g);
        await G.playerAction(g, kind, arg);
        steps++;
      } else {
        await new Promise(r => setTimeout(r, 0));
        steps++;
        if (steps > 620) break;
      }
    }
    invariant(g, 'deep end seed=' + seed);
    reached = Math.max(reached, g.floor);
    if (g.won) console.log('seed ' + seed + ': WON at floor ' + g.floor);
    Math.random = origRandom;
  }
  console.log('deep bot: max floor reached =', reached);

  // god mode: must win floor 10 and continue endless
  {
    const g = G.newGame('classic');
    g.turbo = true; g.autoPick = true;
    g.player.maxHp = 99; g.player.hp = 99;
    g.stats.dmg = 99; g.stats.range = 7; g.stats.pierce = 8;
    for (const w of g.weapons) { w.ammo = 30; w.maxAmmo = 30; }
    G.spawnFloor(g);
    let steps = 0;
    while (!g.won && !g.over && steps < 300) {
      const k = G.whiteKing(g);
      if (!k) break;
      g.player.x = k.x; g.player.y = 7;
      await G.playerAction(g, 'fire', -90);
      steps++;
    }
    if (!g.won || g.floor !== 10) throw new Error('god mode should win at floor 10, got ' + g.floor + ' won=' + g.won);
    g.endless = true; g.won = false; g.floor++;
    G.spawnFloor(g);
    invariant(g, 'endless floor 11');
    if (g.floor !== 11) throw new Error('endless floor wrong');
    console.log('victory at floor 10 + endless floor 11 OK');
  }

  // sniper mode god-run: one-shot from anywhere, 5 floors
  {
    const g = G.newGame('sniper');
    g.turbo = true; g.autoPick = true;
    g.player.maxHp = 99; g.player.hp = 99;
    g.stats.dmg = 99;
    G.spawnFloor(g);
    let steps = 0;
    while (!g.won && !g.over && steps < 200 && g.floor <= 5) {
      const k = G.whiteKing(g);
      if (!k) break;
      const w = g.weapons[0];
      if (w.ammo <= 0) { await G.playerAction(g, 'reload', 0); steps++; continue; }
      const ang = Math.atan2(k.y - g.player.y, k.x - g.player.x) * 180 / Math.PI;
      await G.playerAction(g, 'fire', ang);
      steps++;
      invariant(g, 'sniper run floor ' + g.floor);
    }
    if (g.floor < 5 && !g.over) throw new Error('sniper god-run stalled at floor ' + g.floor);
    console.log('sniper mode deep run OK (reached floor ' + g.floor + ')');
  }

  // obstacle mode deep run with god stats: walls must stay consistent
  {
    const g = G.newGame('obstacle');
    g.turbo = true; g.autoPick = true;
    g.player.maxHp = 99; g.player.hp = 99;
    g.stats.dmg = 99; g.stats.range = 7; g.stats.pierce = 8;
    for (const w of g.weapons) { w.ammo = 30; w.maxAmmo = 30; }
    G.spawnFloor(g);
    let steps = 0;
    while (!g.over && g.floor <= 3 && steps < 200) {
      const k = G.whiteKing(g);
      g.player.x = k.x; g.player.y = 7;
      await G.playerAction(g, 'fire', -90);
      steps++;
      invariant(g, 'obstacle god floor ' + g.floor);
    }
    console.log('obstacle mode deep run OK (reached floor ' + g.floor + ')');
  }

  console.log('ALL DEEP TESTS PASSED');
})().catch(e => { console.error('DEEP TEST FAILURE:', e); process.exit(1); });
