'use strict';
/* Chapter 3 (Shogi) + slab mechanism tests. */
function makeClassList(){ const s=new Set(); return { add:(...c)=>c.forEach(x=>s.add(x)), remove:(...c)=>c.forEach(x=>s.delete(x)), contains:c=>s.has(c) }; }
function makeEl(id){ return { id, classList:makeClassList(), innerHTML:'', textContent:'', style:{}, dataset:{}, listeners:{}, addEventListener(ev,fn){ this.listeners[ev]=fn; }, appendChild(){}, getBoundingClientRect(){ return {left:0,top:0,width:960,height:540}; }, getContext(){ return { imageSmoothingEnabled:true, globalAlpha:1, fillStyle:'', setTransform(){}, clearRect(){}, translate(){}, fillRect(){}, fillText(){} }; } }; }
const els={}; const idList=['game','cardOverlay','cards','cardStats','endOverlay','endTitle','endStats','endNote','btnEndless','btnStart','btnAgain','btnSkip','startOverlay','btnInstall','itemOverlay','itemCards','itemStats','btnItemSkip','chapterList','btnPlay','modeNote','advPrev','advVal','advNext','advDesc','tutOverlay','btnTutClose'];
for (const id of idList) els[id]=makeEl(id);
const docListeners={};
global.document={ getElementById:id=>els[id], createElement:()=>makeEl('x'), querySelectorAll:()=>[], querySelector:()=>null, addEventListener:(ev,fn)=>{ docListeners[ev]=fn; } };
global.window={ innerWidth:1200, innerHeight:700, devicePixelRatio:1, addEventListener(){} };
global.requestAnimationFrame=()=>1; global.performance={ now:()=>Date.now() };
const G = require('./game.js');
docListeners.DOMContentLoaded();

function invariant(g, label) {
  const seen = new Set();
  for (const p of g.pieces) {
    const k = p.x + ',' + p.y;
    if (seen.has(k)) throw new Error(label + ': overlap ' + k);
    seen.add(k);
    if (!G.inB(p.x, p.y)) throw new Error(label + ': off board');
  }
}
function mkPiece(g, type, x, y, extra) {
  const p = Object.assign({ id: 5000 + Math.floor(Math.random() * 1000), type, x, y, hp: 2, maxHp: 2, dmg: 2, boss: false, e: false, subtype: null, friendly: false, promoted: false, burned: false, slowed: false, moving: null }, extra || {});
  g.pieces.push(p);
  return p;
}

(async () => {
  /* ---- ch3 spawn: pieces, king, sakura trees, no overlap ---- */
  {
    const seenTypes = new Set();
    for (let i = 0; i < 25; i++) {
      const g = G.newGame('classic', 3);
      G.spawnFloor(g);
      invariant(g, 'shogi spawn');
      for (const p of g.pieces) seenTypes.add(p.type);
      if (i === 0) {
        const k = G.whiteKing(g);
        if (!k) throw new Error('no shogi king');
        const trees = g.obstacles.filter(o => o.sakura);
        if (trees.length < 2) throw new Error('sakura trees should spawn, got ' + trees.length);
      }
    }
    for (const t of ['pawn', 'lance', 'knight', 'silver', 'gold']) {
      if (!seenTypes.has(t)) throw new Error('basic shogi type missing over 25 runs: ' + t);
    }
    console.log('shogi spawn OK (types: ' + [...seenTypes].join(',') + ')');
  }

  /* ---- shogi moves ---- */
  {
    const g = G.newGame('classic', 3);
    G.spawnFloor(g);
    g.obstacles = [];
    g.player.x = 4; g.player.y = 7;
    // 歩：前 1
    g.pieces.length = 0;
    const p1 = mkPiece(g, 'pawn', 1, 2);
    const m1 = G.legalEnemyMoves(g, p1);
    if (!m1.some(m => m.x === 1 && m.y === 3)) throw new Error('pawn should move forward 1');
    if (m1.some(m => m.x === 2 && m.y === 3)) throw new Error('pawn no side move');
    // 桂：前跳
    g.pieces.length = 0;
    const n1 = mkPiece(g, 'knight', 3, 2);
    const m2 = G.legalEnemyMoves(g, n1);
    if (!m2.some(m => m.x === 4 && m.y === 4) || !m2.some(m => m.x === 2 && m.y === 4)) throw new Error('knight should jump forward');
    if (m2.some(m => m.y < 2)) throw new Error('knight cannot go backward');
    // 金：不能斜后
    g.pieces.length = 0;
    const g1 = mkPiece(g, 'gold', 3, 3);
    const m3 = G.legalEnemyMoves(g, g1);
    if (!m3.some(m => m.x === 3 && m.y === 4) || !m3.some(m => m.x === 4 && m.y === 3) || !m3.some(m => m.x === 3 && m.y === 2)) throw new Error('gold should move fwd/side/back');
    if (m3.some(m => m.x === 4 && m.y === 2) || m3.some(m => m.x === 2 && m.y === 2)) throw new Error('gold cannot move diagonally backward');
    // 香：前直线
    g.pieces.length = 0;
    const l1 = mkPiece(g, 'lance', 5, 1);
    const m4 = G.legalEnemyMoves(g, l1);
    if (!m4.some(m => m.x === 5 && m.y === 5)) throw new Error('lance should run forward');
    if (m4.some(m => m.x === 6 && m.y === 3)) throw new Error('lance no diagonal');
    // 銀：5 向（无横/直后）
    g.pieces.length = 0;
    const s1 = mkPiece(g, 'silver', 4, 3);
    const m5 = G.legalEnemyMoves(g, s1);
    if (!m5.some(m => m.x === 4 && m.y === 4)) throw new Error('silver forward');
    if (m5.some(m => m.x === 5 && m.y === 3)) throw new Error('silver no side step');
    if (m5.some(m => m.x === 4 && m.y === 2)) throw new Error('silver no straight back');
    console.log('shogi moves OK');
  }

  /* ---- promotion: entering black half ---- */
  {
    const g = G.newGame('classic', 3);
    G.spawnFloor(g);
    g.obstacles = [];
    g.pieces.length = 0;
    g.player.x = 4; g.player.y = 7;
    const p = mkPiece(g, 'silver', 4, 3);
    p.promoted = true;   // 模拟成金
    const m = G.legalEnemyMoves(g, p);
    if (!m.some(mm => mm.x === 4 && mm.y === 2)) throw new Error('promoted silver should move like gold (back)');
    if (!m.some(mm => mm.x === 5 && mm.y === 3)) throw new Error('promoted silver should move like gold (side)');
    // 龙马：角+王步
    const b = mkPiece(g, 'bishop', 4, 4);
    b.promoted = true;
    const mb = G.legalEnemyMoves(g, b);
    if (!mb.some(mm => mm.x === 5 && mm.y === 4)) throw new Error('dragon horse should have king step');
    // 龙王：飛+王步
    const r = mkPiece(g, 'rook', 4, 4);
    r.promoted = true;
    const mr = G.legalEnemyMoves(g, r);
    if (!mr.some(mm => mm.x === 5 && mm.y === 5)) throw new Error('dragon king should have king step');
    console.log('shogi promotion OK');
  }

  /* ---- player drop: kill -> hand -> drop ally; enemy eats ally -> enemyHand ---- */
  {
    const g = G.newGame('classic', 3);
    g.turbo = true;
    G.spawnFloor(g);
    g.pieces.length = 0;
    g.weapons = [{ ...G.WEAPON_DEFS.warbow, ammo: 9, cone: 0 }];
    g.weapon = 0;
    g.player.x = 4; g.player.y = 7;
    g.pieces.push({ id: 6001, type: 'pawn', x: 4, y: 5, hp: 1, maxHp: 1, dmg: 1, boss: false, e: false, subtype: null, friendly: false, promoted: false, burned: false, slowed: false, moving: null });
    await G.playerAction(g, 'fire', -90);
    if (g.hand.length !== 1 || g.hand[0].type !== 'pawn') throw new Error('kill should grant hand pawn');
    // 打入放置
    g.obstacles = [];   // 清掉樱花树避免占用放置格
    ['startOverlay', 'cardOverlay', 'endOverlay', 'itemOverlay', 'tutOverlay'].forEach(id => els[id].classList.add('hidden'));
    G.useDrop(g, 0);
    if (!g.dropMode) throw new Error('drop mode not entered');
    await G.chooseDrop(g, 3, 6);
    const ally0 = g.pieces.find(p => p.friendly);
    if (!ally0 || ally0.x !== 3 || ally0.y !== 6) throw new Error('ally not placed');
    if (g.hand.length !== 0) throw new Error('hand consumed');
    // chooseDrop 已推进敌方回合（保护期内无敌人，棋子存活；保护已解除）
    if (ally0.protected) throw new Error('protection should clear after the enemy phase');
    // 手动放置一只带保护期的打入棋，验证吸引回合免疫被吃
    g.pieces = g.pieces.filter(p => !p.friendly);
    const ally = G.spawnAlly(g, 'pawn', 3, 6);
    const enemy = mkPiece(g, 'gold', 3, 5);
    if (!ally.protected) throw new Error('fresh ally should be protected');
    const me = G.legalEnemyMoves(g, enemy);
    if (me.some(m => m.capture && m.ally)) throw new Error('protected ally must not be capturable: ' + JSON.stringify(me));
    await G.enemyPhase(g);
    if (!g.pieces.some(p => p.friendly)) throw new Error('ally should survive the attraction turn');
    // 吸引回合结束：保护解除，未被引爆则会被吃掉
    const ally2 = g.pieces.find(p => p.friendly);
    if (ally2.protected) throw new Error('protection should clear after the attraction turn');
    const enemy2 = mkPiece(g, 'gold', 3, 5);   // 重新放一只紧邻的敌人
    const me2 = G.legalEnemyMoves(g, enemy2);
    if (!me2.some(m => m.capture && m.ally)) throw new Error('unprotected ally should be capturable: ' + JSON.stringify(me2));
    await G.enemyPhase(g);
    if (g.enemyHand !== 1) throw new Error('enemy should gain hand after eating ally, got ' + g.enemyHand);
    if (g.pieces.some(p => p.friendly)) throw new Error('ally should be eaten after protection ends');
    console.log('shogi drop mechanics + protection OK');
  }

  /* ---- enemy drop: puts pieces back ---- */
  {
    const g = G.newGame('classic', 3);
    g.turbo = true;
    G.spawnFloor(g);
    g.enemyHand = 2;
    const before = g.pieces.length;
    for (let i = 0; i < 10 && g.enemyHand > 0; i++) await G.enemyPhase(g);
    if (g.pieces.length < before) throw new Error('enemy drop should not remove pieces');
    if (g.enemyHand > 1) throw new Error('enemy drop should consume hand over phases');
    invariant(g, 'enemy drop');
    console.log('enemy drop OK');
  }

  /* ---- ch2 slabs: player and general move +1 ---- */
  {
    const g = G.newGame('classic', 2);
    g.turbo = true;
    G.spawnFloor(g);
    if (!g.slabs || g.slabs.length < 2) throw new Error('slabs should spawn, got ' + (g.slabs && g.slabs.length));
    // 玩家站石板：2 格移动
    const s = g.slabs[0];
    g.player.x = s.x; g.player.y = s.y;
    g.pieces.length = 0;   // 清场便于验证
    const moves = G.legalPlayerMoves(g);
    if (!moves.some(m => Math.abs(m.x - s.x) + Math.abs(m.y - s.y) === 2)) throw new Error('player on slab should reach 2 away');
    // 帅站石板（九宫内手动铺一块 (3,0)）：一次可走 2 格直达 (5,0)
    g.slabs.push({ x: 3, y: 0 });
    const k = mkPiece(g, 'king', 3, 0);
    k.hp = 10; k.maxHp = 10; k.dmg = 1;
    const km = G.legalEnemyMoves(g, k);
    if (!km.some(m => m.x === 5 && m.y === 0)) throw new Error('general on slab should reach (5,0) in one move: ' + JSON.stringify(km));
    // 中间格被占则不能跳 2 格
    mkPiece(g, 'pawn', 4, 0);
    const km2 = G.legalEnemyMoves(g, k);
    if (km2.some(m => m.x === 5 && m.y === 0)) throw new Error('slab 2-move must be blocked by intermediate piece');
    console.log('slabs OK (player2 + general2)');
  }

  /* ---- ally detonation: shooting your piece = AoE ---- */
  {
    const g = G.newGame('classic', 3);
    g.turbo = true;
    G.spawnFloor(g);
    g.obstacles = [];
    g.pieces.length = 0;
    g.weapons = [{ ...G.WEAPON_DEFS.warbow, ammo: 9, cone: 0 }];
    g.weapon = 0;
    g.player.x = 4; g.player.y = 7;
    const ally = G.spawnAlly(g, 'pawn', 4, 5);
    const e1 = mkPiece(g, 'gold', 3, 4);       // 爆炸范围内（r=2，且不在射线路径上）
    const e2 = mkPiece(g, 'silver', 7, 5);     // 范围外
    e1.hp = 3; e1.maxHp = 3;
    e2.hp = 3; e2.maxHp = 3;
    const killsBefore = g.kills;
    await G.playerAction(g, 'fire', -90);       // 射击 ally 引爆
    if (g.pieces.some(p => p.friendly)) throw new Error('ally should be consumed by detonation');
    if (g.kills !== killsBefore) throw new Error('detonation should not count as a kill');
    const e1after = g.pieces.find(p => p === e1);
    const e2after = g.pieces.find(p => p === e2);
    if (e1after && e1after.hp !== 1) throw new Error('enemy in blast should take 2 dmg, hp=' + e1after.hp);
    if (e2after && e2after.hp !== 3) throw new Error('enemy outside blast should be untouched');
    console.log('ally detonation AoE OK');
  }

  /* ---- ally attracts nearby enemies ---- */
  {
    const g = G.newGame('classic', 3);
    g.turbo = true;
    G.spawnFloor(g);
    g.obstacles = [];
    g.pieces.length = 0;
    g.player.x = 0; g.player.y = 7;            // 玩家很远
    const ally = G.spawnAlly(g, 'pawn', 4, 4);
    const e = mkPiece(g, 'gold', 4, 2);        // 敌人在 ally 正上方 2 格（比玩家近）
    e.hp = 3; e.maxHp = 3;
    const before = e.y;
    await G.enemyPhase(g);
    const after = g.pieces.find(p => p === e);
    if (!after) throw new Error('enemy should survive');
    const dAlly = Math.max(Math.abs(after.x - ally.x), Math.abs(after.y - ally.y));
    const dBefore = Math.max(Math.abs(4 - ally.x), Math.abs(before - ally.y));
    console.log('enemy cheb distance to ally:', dBefore, '->', dAlly);
    if (dAlly >= dBefore) throw new Error('enemy should approach the ally bait, not the player');
    console.log('ally bait attraction OK');
  }

  /* ---- ch3 god-run ---- */
  {
    const g = G.newGame('classic', 3);
    g.turbo = true; g.autoPick = true;
    g.player.maxHp = 99; g.player.hp = 99;
    g.stats.dmg = 99; g.stats.range = 7; g.stats.pierce = 8;
    for (const w of g.weapons) { w.ammo = 30; w.maxAmmo = 30; }
    G.spawnFloor(g);
    let steps = 0;
    while (!g.over && g.floor <= 3 && steps < 200) {
      invariant(g, 'shogi god floor ' + g.floor);
      const k = G.whiteKing(g);
      if (!k) break;
      g.player.x = k.x; g.player.y = 7;
      await G.playerAction(g, 'fire', -90);
      steps++;
    }
    if (g.floor < 3 && !g.over) throw new Error('shogi god-run stalled at floor ' + g.floor);
    console.log('shogi god-run OK (floor ' + g.floor + ')');
  }

  /* ---- tutorial overlay + chapter unlocked ---- */
  {
    const ch3 = G.CHAPTERS.find(c => c.id === 3);
    if (!ch3 || !ch3.unlocked) throw new Error('chapter 3 should be unlocked');
    G.showTutOverlay();
    if (els.tutOverlay.classList.contains('hidden')) throw new Error('tut overlay should show');
    G.hideTutOverlay();
    if (!els.tutOverlay.classList.contains('hidden')) throw new Error('tut overlay should hide');
    console.log('tutorial + chapters OK');
  }

  console.log('ALL SHOGI TESTS PASSED');
})().catch(e => { console.error('SHOGI TEST FAILURE:', e); process.exit(1); });
