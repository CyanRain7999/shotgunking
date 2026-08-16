'use strict';
const G = require('./game.js');

function invariant(g, label) {
  const seen = new Set();
  for (const p of g.pieces) {
    const k = p.x + ',' + p.y;
    if (seen.has(k)) throw new Error(label + ': two pieces share ' + k);
    seen.add(k);
    if (!G.inB(p.x, p.y)) throw new Error(label + ': piece off board ' + k);
    if (p.hp <= 0) throw new Error(label + ': dead piece still in array');
  }
  const obs = new Set();
  for (const o of g.obstacles) {
    const k = o.x + ',' + o.y;
    if (obs.has(k)) throw new Error(label + ': two obstacles share ' + k);
    if (seen.has(k)) throw new Error(label + ': obstacle overlaps piece ' + k);
    obs.add(k);
    if (o.hp <= 0) throw new Error(label + ': dead obstacle still in array');
  }
  const pk = g.player.x + ',' + g.player.y;
  if (seen.has(pk) || obs.has(pk)) throw new Error(label + ': player overlaps ' + pk);
  if (!G.inB(g.player.x, g.player.y)) throw new Error(label + ': player off board');
  if (g.player.hp < 0 || g.player.hp > g.player.maxHp) throw new Error(label + ': hp range');
  for (const w of g.weapons) {
    if (w.ammo < 0 || w.ammo > w.maxAmmo) throw new Error(label + ': ammo range ' + w.id);
  }
  if (g.stats.range < 1 || g.stats.range > 8) throw new Error(label + ': range stat out of range');
}

function fireAt(g, angle) {
  return G.playerAction(g, 'fire', angle);
}

(async () => {
  /* ---- raycast sanity ---- */
  {
    const g = G.newGame();
    g.obstacles = [];
    g.pieces = [];
    g.pieces.push({ id: 1, type: 'pawn', x: 4, y: 2, hp: 1, maxHp: 1, dmg: 1, boss: false, burned: false, slowed: false, moving: null });
    const hits = G.raycast(g, 4.5, 7.5, -90, 8, 1);
    if (hits.length !== 1 || hits[0].x !== 4 || hits[0].y !== 2 || hits[0].kind !== 'piece') {
      throw new Error('vertical raycast failed: ' + JSON.stringify(hits));
    }
    const ang = Math.atan2(2 - 7.5, 4 - 0.5) * 180 / Math.PI;
    const diag = G.raycast(g, 0.5, 7.5, ang, 12, 1);
    if (!diag.length || diag[0].kind !== 'piece' || diag[0].x !== 4 || diag[0].y !== 2) {
      throw new Error('diagonal raycast failed: ' + JSON.stringify(diag) + ' ang=' + ang);
    }
    console.log('raycast OK');
  }

  /* ---- shotgun king kill via mouse-angle fire ---- */
  {
    const g = G.newGame();
    G.spawnFloor(g);
    const w = g.weapons[0];
    w.ammo = 9; w.maxAmmo = 9;
    g.stats.dmg = 50; g.stats.pierce = 8; g.stats.range = 7; // range 4 + 4 = 8
    for (let i = 0; i < 6 && !g.over; i++) {
      const k = G.whiteKing(g);
      if (!k) break;
      g.player.x = k.x; g.player.y = 7;
      await fireAt(g, -90);
      invariant(g, 'shoot loop ' + i);
    }
    if (!g.floorCleared) throw new Error('shotgun failed to clear floor');
    console.log('shotgun angle fire kills king OK');
  }

  /* ---- bow: infinite pierce ---- */
  {
    const g = G.newGame();
    G.spawnFloor(g);
    g.pieces.length = 0;
    g.weapons = [G.WEAPON_DEFS.warbow && { ...G.WEAPON_DEFS.warbow, ammo: 1 }];
    g.weapon = 0;
    g.player.x = 4; g.player.y = 7;
    for (let y = 0; y <= 2; y++) {
      g.pieces.push({ id: 10 + y, type: 'pawn', x: 4, y, hp: 1, maxHp: 1, dmg: 1, boss: false, burned: false, slowed: false, moving: null });
    }
    await fireAt(g, -90);
    if (g.pieces.length !== 0) throw new Error('bow should pierce all, left ' + g.pieces.length);
    console.log('bow infinite pierce OK');
  }

  /* ---- flamethrower: cone AoE + burn ---- */
  {
    const g = G.newGame();
    G.spawnFloor(g);
    g.pieces.length = 0;
    g.weapons = [{ ...G.WEAPON_DEFS.flamer, ammo: 6 }];
    g.weapon = 0;
    g.player.x = 4; g.player.y = 7;
    const a = { id: 20, type: 'pawn', x: 4, y: 5, hp: 1, maxHp: 1, dmg: 1, boss: false, burned: false, slowed: false, moving: null };
    const b = { id: 21, type: 'pawn', x: 4, y: 6, hp: 1, maxHp: 1, dmg: 1, boss: false, burned: false, slowed: false, moving: null };
    const c = { id: 22, type: 'pawn', x: 7, y: 5, hp: 1, maxHp: 1, dmg: 1, boss: false, burned: false, slowed: false, moving: null };
    g.pieces.push(a, b, c);
    await fireAt(g, -90);
    if (g.pieces.includes(a) || g.pieces.includes(b)) throw new Error('flamer should hit cone targets');
    if (!g.pieces.includes(c)) throw new Error('flamer hit far outside cone');
    console.log('flamethrower cone AoE OK');
  }

  /* ---- bomber: deterministic bounce (Math.random -> 0 => bounce East) ---- */
  {
    const g = G.newGame();
    G.spawnFloor(g);
    g.pieces.length = 0;
    g.weapons = [{ ...G.WEAPON_DEFS.bomber, ammo: 3 }];
    g.weapon = 0;
    g.player.x = 4; g.player.y = 7;
    g.bombTarget = { x: 4, y: 4 };
    g.pieces.push({ id: 30, type: 'pawn', x: 5, y: 4, hp: 1, maxHp: 1, dmg: 1, boss: false, burned: false, slowed: false, moving: null });
    const orig = Math.random;
    Math.random = () => 0;
    await fireAt(g, -90);
    Math.random = orig;
    if (g.pieces.length !== 0) throw new Error('bomber bounce should kill target+E piece');
    console.log('bomber bounce + 3x3 explosion OK');
  }

  /* ---- obstacle mode: spawn, block, destroy ---- */
  {
    const g = G.newGame('obstacle');
    G.spawnFloor(g);
    if (g.obstacles.length === 0) throw new Error('obstacle mode spawned no walls');
    // obstacles must never overlap anything
    invariant(g, 'obstacle spawn');
    // raycast stops at obstacle and shotgun damages it
    const w = g.weapons[0];
    w.ammo = 9; w.maxAmmo = 9;
    g.stats.range = 7; g.stats.pierce = 8;
    const target = g.obstacles.find(o => o.x === 4 && o.y < 7);
    if (target) {
      const before = target.hp;
      await fireAt(g, -90);
      if (g.obstacles.includes(target) && target.hp >= before) throw new Error('shot should damage obstacle');
    }
    // enemy slides must not cross walls
    for (const p of g.pieces) {
      for (const m of G.legalEnemyMoves(g, p)) {
        if (G.obstacleAt(g, m.x, m.y)) throw new Error('enemy move lands on obstacle');
      }
    }
    console.log('obstacle mode OK (' + g.obstacles.length + ' walls)');
  }

  /* ---- musou mode: infinite ammo ---- */
  {
    const g = G.newGame('musou');
    G.spawnFloor(g);
    const w = g.weapons[0];
    const before = w.ammo;
    g.player.x = 4; g.player.y = 7;
    await fireAt(g, -90);
    if (w.ammo !== before) throw new Error('musou consumed ammo');
    const res = await G.playerAction(g, 'reload', 0);
    if (res) throw new Error('musou reload should be refused');
    console.log('musou infinite ammo OK');
  }

  /* ---- sniper mode: one weapon, infinite range, high damage ---- */
  {
    const g = G.newGame('sniper');
    G.spawnFloor(g);
    if (g.weapons.length !== 1 || g.weapons[0].id !== 'sniper') throw new Error('sniper mode weapon loadout wrong');
    const eff = G.effectiveWeapon(g, g.weapons[0]);
    if (eff.range < 90) throw new Error('sniper should be infinite range');
    const k = G.whiteKing(g);
    g.player.x = 0; g.player.y = 7;
    const ang = Math.atan2(k.y - 7, k.x - 0) * 180 / Math.PI;
    for (let i = 0; i < 4 && !g.floorCleared && !g.over; i++) await fireAt(g, ang);
    if (!g.floorCleared) throw new Error('sniper failed to kill king from corner');
    console.log('sniper mode OK');
  }

  /* ---- enemy capture / insurance / thorns / explosion (regression) ---- */
  {
    const g = G.newGame();
    G.spawnFloor(g);
    g.pieces.length = 0;
    g.pieces.push({ id: 2, type: 'rook', x: 0, y: 7, hp: 5, maxHp: 5, dmg: 2, boss: false, burned: false, slowed: false, moving: null });
    g.player.x = 4; g.player.y = 7;
    await G.enemyPhase(g);
    invariant(g, 'after attack');
    if (g.player.hp !== 1) throw new Error('rook attack should deal 2');
    const rook = g.pieces.find(p => p.type === 'rook');
    if (!rook || rook.x !== 0 || rook.y !== 7) throw new Error('rook should return to origin');

    const g2 = G.newGame();
    G.spawnFloor(g2);
    g2.pieces.length = 0;
    g2.stats.thorns = true; g2.stats.insurance = true;
    g2.player.hp = 1;
    g2.pieces.push({ id: 3, type: 'pawn', x: 3, y: 6, hp: 1, maxHp: 1, dmg: 5, boss: false, burned: false, slowed: false, moving: null });
    g2.player.x = 4; g2.player.y = 7;
    await G.enemyPhase(g2);
    if (g2.over || g2.player.hp !== 1) throw new Error('insurance should save');
    if (g2.pieces.find(p => p.type === 'pawn')) throw new Error('thorns should kill pawn');
    console.log('enemy capture / insurance / thorns OK');
  }

  /* ---- random simulation over modes ---- */
  let games = 0;
  for (const mode of ['classic', 'musou', 'obstacle']) {
    for (let seed = 0; seed < 15; seed++) {
      let s = seed + 7;
      const origRandom = Math.random;
      Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
      const g = G.newGame(mode);
      g.turbo = true;
      g.autoPick = true;
      G.spawnFloor(g);
      let steps = 0;
      while (!g.over && g.floor <= 3 && steps < 250) {
        invariant(g, 'sim ' + mode + ' seed=' + seed + ' step=' + steps);
        const w = g.weapons[g.weapon];
        const roll = Math.random();
        if (roll < 0.45 && w.ammo > 0) {
          await fireAt(g, Math.floor(Math.random() * 360) - 180);
        } else if (roll < 0.75) {
          const moves = G.legalPlayerMoves(g);
          if (moves.length) {
            const m = moves[Math.floor(Math.random() * moves.length)];
            await G.playerAction(g, 'move', m);
          } else await G.playerAction(g, 'reload', 0);
        } else {
          g.weapon = Math.floor(Math.random() * g.weapons.length);
          await G.playerAction(g, 'reload', 0);
        }
        steps++;
      }
      invariant(g, 'sim end ' + mode + ' seed=' + seed);
      games++;
      Math.random = origRandom;
    }
  }
  console.log('random simulation OK: ' + games + ' games');

  /* ---- all cards apply ---- */
  {
    const g = G.newGame();
    G.spawnFloor(g);
    for (const c of G.CARDS) {
      G.applyCard(g, c);
      invariant(g, 'card ' + c.id);
    }
    console.log('all ' + G.CARDS.length + ' cards apply OK');
  }
  console.log('ALL TESTS PASSED');
})().catch(e => { console.error('TEST FAILURE:', e); process.exit(1); });
