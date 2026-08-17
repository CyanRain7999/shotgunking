'use strict';
/* Ascension (进阶难度) tests: stacked global difficulty 1..10 + compensations. */
const G = require('./game.js');

function invariant(g, label) {
  const seen = new Set();
  for (const p of g.pieces) {
    const k = p.x + ',' + p.y;
    if (seen.has(k)) throw new Error(label + ': overlap ' + k);
    seen.add(k);
    if (!G.inB(p.x, p.y)) throw new Error(label + ': off board');
  }
}

function countKings(g) { return g.pieces.filter(p => p.type === 'king').length; }

(async () => {
  /* ---- I: extra pawn ---- */
  {
    const origRandom = Math.random;
    const mk = (advance, chapter) => {
      let s = 424242;
      Math.random = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
      const g = G.newGame('classic', chapter, advance);
      G.spawnFloor(g);
      return g;
    };
    const base = mk(0, 1), g = mk(1, 1);
    if (g.pieces.length !== base.pieces.length + 1) throw new Error('asc I should add 1 pawn: ' + base.pieces.length + ' -> ' + g.pieces.length);
    const extra = g.pieces.filter(p => !base.pieces.some(b => b.type === p.type && b.x === p.x && b.y === p.y));
    if (extra.length !== 1 || extra[0].type !== 'pawn') throw new Error('asc I extra piece should be a pawn');
    // 第二章：额外兵在兵行线
    const bx = mk(0, 2), gx = mk(1, 2);
    const extraX = gx.pieces.filter(p => !bx.pieces.some(b => b.type === p.type && b.x === p.x && b.y === p.y));
    if (extraX.length !== 1 || extraX[0].type !== 'pawn' || extraX[0].y < 2) throw new Error('asc I ch2 extra pawn on soldier line');
    Math.random = origRandom;
    console.log('asc I extra pawn OK');
  }

  /* ---- II: two marked enemies +2 hp ---- */
  {
    const g = G.newGame('classic', 1, 2);
    G.spawnFloor(g);
    const marked = g.pieces.filter(p => p.marked);
    if (marked.length !== 2) throw new Error('asc II should mark 2, got ' + marked.length);
    for (const m of marked) {
      if (m.type === 'king') throw new Error('king should not be marked');
      // 血量比同类基础多 2（王除外比较麻烦，直接用 baseHp 推算）
      const baseHp = { pawn:1, knight:2, bishop:2, rook:3, queen:4 }[m.type];
      if (m.maxHp < baseHp + 2) throw new Error('marked hp should be base+2');
    }
    console.log('asc II marked elites OK');
  }

  /* ---- III: shotgun -1 ammo ---- */
  {
    const g = G.newGame('classic', 1, 3);
    G.spawnFloor(g);
    const sg = g.weapons.find(w => w.id === 'shotgun');
    if (sg.ammo !== 3) throw new Error('asc III shotgun ammo should be 3, got ' + sg.ammo);
    const gm = G.newGame('musou', 1, 3);
    G.spawnFloor(gm);
    const sgm = gm.weapons.find(w => w.id === 'shotgun');
    if (sgm.ammo !== 4) throw new Error('musou shotgun ammo untouched');
    console.log('asc III damp powder OK');
  }

  /* ---- IV: cone +20% ---- */
  {
    const g = G.newGame('classic', 1, 4);
    G.spawnFloor(g);
    const eff = G.effectiveWeapon(g, g.weapons[0]);
    if (eff.cone !== Math.round(45 * 1.2)) throw new Error('asc IV cone should be ' + Math.round(45 * 1.2) + ', got ' + eff.cone);
    const g0 = G.newGame('classic', 1, 0);
    G.spawnFloor(g0);
    if (G.effectiveWeapon(g0, g0.weapons[0]).cone !== 45) throw new Error('no asc cone unchanged');
    console.log('asc IV rusty sights OK');
  }

  /* ---- V: indestructible obstacle ---- */
  {
    const g = G.newGame('classic', 1, 5);
    G.spawnFloor(g);
    const u = g.obstacles.find(o => o.unbreakable);
    if (!u) throw new Error('asc V should spawn an indestructible obstacle');
    G.damageObstacle(g, u, 5);
    if (g.obstacles.indexOf(u) < 0 || u.hp !== 999) throw new Error('indestructible obstacle took damage');
    console.log('asc V falling sky OK');
  }

  /* ---- VI: all enemies +1 hp (stacked on top of II's +2) ---- */
  {
    const g = G.newGame('classic', 1, 6);
    G.spawnFloor(g);
    const plain = g.pieces.find(p => p.type === 'pawn' && !p.marked);
    if (!plain || plain.maxHp !== 2) throw new Error('asc VI plain pawn hp should be 2, got ' + (plain && plain.maxHp));
    const marked = g.pieces.find(p => p.type === 'pawn' && p.marked);
    if (marked && marked.maxHp !== 4) throw new Error('asc VI marked pawn hp should be 1+1+2=4 (II+VI stacked), got ' + marked.maxHp);
    console.log('asc VI last stand (stacked with II) OK');
  }

  /* ---- VII: max crowns -1 ---- */
  {
    const g = G.newGame('classic', 1, 7);
    if (g.player.maxHp !== 2) throw new Error('asc VII max crowns should be 2, got ' + g.player.maxHp);
    if (g.player.hp > 2) throw new Error('asc VII hp over cap');
    console.log('asc VII usurped throne OK');
  }

  /* ---- VIII: white king +2 hp (on top of VI +1) ---- */
  {
    const g = G.newGame('classic', 1, 8);
    G.spawnFloor(g);
    const k = G.whiteKing(g);
    // f1 王 hp = 2 + VI(+1) + VIII(+2) = 5
    if (k.maxHp !== 5) throw new Error('asc VIII king hp should be 5, got ' + k.maxHp);
    console.log('asc VIII iron general OK');
  }

  /* ---- IX: range -1 + dragon fury ---- */
  {
    const g = G.newGame('classic', 1, 9);
    G.spawnFloor(g);
    const eff = G.effectiveWeapon(g, g.weapons[0]);
    if (eff.range !== 3) throw new Error('asc IX shotgun range should be 3 (4-1), got ' + eff.range);
    // 龙怒：每层首次攻击 +1 伤害
    const w = g.weapons[0]; w.ammo = 9;
    g.pieces.length = 0;
    g.pieces.push({ id: 900, type: 'pawn', x: 4, y: 5, hp: 2, maxHp: 2, dmg: 1, boss: false, e: false, subtype: null, burned: false, slowed: false, moving: null });
    await G.playerAction(g, 'fire', -90);
    if (g.bonusDmg !== 1 || !g.dragonAtkUsed) throw new Error('dragon fury should set bonusDmg=1 on first shot');
    const pawn = g.pieces.find(p => p.id === 900);
    if (pawn && pawn.hp !== 0) throw new Error('first attack should deal 1 extra dmg (pawn hp 2 -> dead)');
    console.log('asc IX hair trigger + dragon fury OK');
  }

  /* ---- X: two kings, need to kill all ---- */
  {
    const g = G.newGame('classic', 1, 10);
    G.spawnFloor(g);
    if (countKings(g) !== 2) throw new Error('asc X should spawn 2 kings');
    invariant(g, 'asc X spawn');
    // 击杀第一个王不通关
    const k1 = G.whiteKing(g);
    G.killPiece(g, k1, 'test', true);
    if (g.floorCleared) throw new Error('floor should not clear with one king left');
    if (countKings(g) !== 1) throw new Error('one king should remain');
    // 击杀第二个王通关
    const k2 = G.whiteKing(g);
    G.killPiece(g, k2, 'test', true);
    if (!g.floorCleared) throw new Error('floor should clear after both kings');
    // 第二章双帅
    const gx = G.newGame('classic', 2, 10);
    G.spawnFloor(gx);
    invariant(gx, 'asc X xq');
    if (countKings(gx) !== 2) throw new Error('asc X ch2 should spawn 2 generals');
    for (const k of gx.pieces.filter(p => p.type === 'king')) {
      if (k.x < 3 || k.x > 5 || k.y > 2) throw new Error('general outside palace');
    }
    console.log('asc X two kings OK');
  }

  /* ---- compensation: dragon move free / dragon kill +1 crown ---- */
  {
    const g = G.newGame('classic', 1, 3);
    g.turbo = true;
    G.spawnFloor(g);
    const t0 = g.turn;
    const legal = G.legalPlayerMoves(g);
    if (!legal.length) throw new Error('no legal moves');
    await G.playerAction(g, 'move', legal[0]);
    if (g.turn !== t0) throw new Error('dragon move should be free (turn unchanged)');
    if (!g.dragonMoveUsed) throw new Error('dragonMoveUsed flag');
    // 第二次移动正常推进
    const legal2 = G.legalPlayerMoves(g);
    const t1 = g.turn;
    if (legal2.length) await G.playerAction(g, 'move', legal2[0]);
    if (g.turn !== t1 + 1) throw new Error('second move should advance turn');
    // 龙胆：首次击杀 +1 王冠
    const g2 = G.newGame('classic', 1, 6);
    g2.turbo = true;
    G.spawnFloor(g2);
    g2.pieces.length = 0;
    g2.weapons = [{ ...G.WEAPON_DEFS.warbow, ammo: 9, cone: 0 }];
    g2.weapon = 0;
    g2.player.x = 4; g2.player.y = 7;
    g2.player.hp = 1;
    g2.pieces.push({ id: 901, type: 'pawn', x: 4, y: 5, hp: 1, maxHp: 1, dmg: 1, boss: false, e: false, subtype: null, burned: false, slowed: false, moving: null });
    await G.playerAction(g2, 'fire', -90);
    if (g2.player.hp !== 2) throw new Error('dragon gall should heal +1 on first kill, got hp ' + g2.player.hp);
    if (!g2.dragonKillUsed) throw new Error('dragonKillUsed flag');
    console.log('compensations dragon move/kill OK');
  }

  console.log('ALL ASCENSION TESTS PASSED');
})().catch(e => { console.error('ASC TEST FAILURE:', e); process.exit(1); });
