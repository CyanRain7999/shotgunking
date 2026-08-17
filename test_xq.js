'use strict';
/* Chapter 2 (xiangqi) + remnants + active item smoke tests. */
const dom = (() => {
  function makeClassList() {
    const set = new Set();
    return {
      add: (...cs) => cs.forEach(c => set.add(c)),
      remove: (...cs) => cs.forEach(c => set.delete(c)),
      contains: c => set.has(c)
    };
  }
  function makeEl(id) {
    return {
      id,
      classList: makeClassList(),
      innerHTML: '',
      textContent: '',
      style: {},
      dataset: {},
      onclick: null,
      listeners: {},
      addEventListener(ev, fn) { this.listeners[ev] = fn; },
      appendChild() {},
      getBoundingClientRect() { return { left: 0, top: 0, width: 960, height: 540 }; },
      getContext() { return { imageSmoothingEnabled: true, globalAlpha: 1, fillStyle: '', setTransform() {}, clearRect() {}, translate() {}, fillRect() {} }; }
    };
  }
  const els = {};
  const idList = ['game','cardOverlay','cards','cardStats','endOverlay','endTitle','endStats','endNote','btnEndless','btnStart','btnAgain','btnSkip','startOverlay','btnInstall','itemOverlay','itemCards','itemStats','btnItemSkip','chapterList','btnPlay','modeNote'];
  for (const id of idList) els[id] = makeEl(id);
  const docListeners = {};
  global.document = {
    getElementById: id => els[id],
    createElement: () => makeEl('created'),
    querySelectorAll: () => [],
    addEventListener: (ev, fn) => { docListeners[ev] = fn; }
  };
  global.window = { innerWidth: 1200, innerHeight: 700, devicePixelRatio: 1, addEventListener() {} };
  global.requestAnimationFrame = () => 1;
  global.performance = { now: () => Date.now() };
  return { els, docListeners };
})();
const G = require('./game.js');
dom.docListeners.DOMContentLoaded();

function invariant(g, label) {
  const seen = new Set();
  for (const p of g.pieces) {
    if (p.e) {
      // 精英覆盖 2×2（落点一圈：gx-1..gx × gy-1..gy）不与其他任何东西重叠
      for (let dy = 0; dy <= 1; dy++) {
        for (let dx = 0; dx <= 1; dx++) {
          const k = (p.x - 1 + dx) + ',' + (p.y - 1 + dy);
          if (seen.has(k)) throw new Error(label + ': elite overlap ' + k);
          seen.add(k);
          if (!G.inB(p.x - 1 + dx, p.y - 1 + dy)) throw new Error(label + ': elite off board');
        }
      }
    } else {
      const k = p.x + ',' + p.y;
      if (seen.has(k)) throw new Error(label + ': overlap ' + k);
      seen.add(k);
      if (!G.inB(p.x, p.y)) throw new Error(label + ': off board');
      if (p.hp <= 0) throw new Error(label + ': dead piece present');
    }
  }
  if (seen.has(g.player.x + ',' + g.player.y)) throw new Error(label + ': player overlap');
}

(async () => {
  const hideOverlays = () => {
    ['startOverlay', 'cardOverlay', 'endOverlay', 'itemOverlay'].forEach(id => dom.els[id].classList.add('hidden'));
  };

  /* ---- xiangqi spawn: random generation, general, elite, no overlap ---- */
  {
    const g = G.newGame('xiangqi');
    G.spawnFloor(g);
    invariant(g, 'xq spawn');
    const k = G.whiteKing(g);
    if (!k || k.type !== 'king') throw new Error('no red general');
    if (k.x < 3 || k.x > 5 || k.y < 0 || k.y > 2) throw new Error('general outside palace');
    // 精英：每层 1 个，2×2 覆盖区与所有棋子无重叠（invariant 已验）
    const e = g.pieces.find(p => p.e);
    if (!e) throw new Error('no elite piece');
    if (e.x > 7 || e.y > 7) throw new Error('elite 2x2 out of board');
    // 兵只出现在兵行线 y 2..3；仕/帅只在九宫
    for (const p of g.pieces) {
      if (p.type === 'pawn' && p.y < 2) throw new Error('pawn spawned off the soldier line');
      if (p.type === 'advisor' && (p.x < 3 || p.x > 5 || p.y > 2)) throw new Error('advisor outside palace');
    }
    console.log('xiangqi random spawn OK (pieces=' + g.pieces.length + ', elite=' + e.subtype + '@' + e.x + ',' + e.y + ')');
    // 高楼层：解锁炮/车（随机生成，多次采样验证类型池）
    let sawCannon = false, sawRook = false;
    for (let i = 0; i < 25; i++) {
      const g2 = G.newGame('xiangqi');
      g2.floor = 3;
      G.spawnFloor(g2);
      invariant(g2, 'xq spawn f3');
      for (const p of g2.pieces) {
        if (p.type === 'cannon') sawCannon = true;
        if (p.type === 'rook') sawRook = true;
      }
    }
    if (!sawCannon) throw new Error('cannon should unlock at f3');
    if (!sawRook) throw new Error('rook should unlock at f3');
    // 10 层满规模
    const g10 = G.newGame('xiangqi');
    g10.floor = 10;
    G.spawnFloor(g10);
    invariant(g10, 'xq spawn f10');
    if (g10.pieces.length < 6) throw new Error('floor 10 should be crowded');
    console.log('xiangqi unlock + f10 OK (' + g10.pieces.length + ' pieces)');
  }

  /* ---- elite moves sanity: chariot slides, cannon needs screen ---- */
  {
    const g = G.newGame('classic', 2);
    G.spawnFloor(g);
    g.pieces.length = 0;
    const e = G.spawnPiece(g, 'elite', 3, 3, { hp: 10, dmg: 2 });
    e.e = true; e.subtype = 'rook';
    g.player.x = 7; g.player.y = 3;
    const mv = G.eliteMoves(g, e);
    // 精英落点在交点，2×2 覆盖 = 落点一圈（gx-1..gx × gy-1..gy）：
    // 车滑到格点 (7,3) 时覆盖 (6,3)(7,3) 已含玩家 → capture
    const cap = mv.find(m => m.capture);
    if (!cap || cap.ex !== 7 || cap.ey !== 3) throw new Error('elite rook should capture player via (7,3): ' + JSON.stringify(mv));
    if (mv.some(m => m.ex === 3 && m.ey === 4 && m.capture)) throw new Error('no capture at (3,4) (player not covered)');
    console.log('elite rook moves OK');
  }

  /* ---- elite cannon remote attack ---- */
  {
    const g = G.newGame('classic', 2);
    G.spawnFloor(g);
    g.pieces.length = 0;
    const e = G.spawnPiece(g, 'elite', 2, 3, { hp: 10, dmg: 2 });
    e.e = true; e.subtype = 'cannon';
    g.player.x = 6; g.player.y = 3;
    // 炮架（红子）放在 (5,3)：炮身覆盖 (1..2, 2..3)，炮架需留出空隙
    const screen = G.spawnPiece(g, 'pawn', 5, 3, { hp: 1 });
    const mv = G.eliteMoves(g, e);
    const remote = mv.find(m => m.remote);
    if (!remote || remote.ex !== 6 || remote.ey !== 3) throw new Error('elite cannon should fire over screen: ' + JSON.stringify(mv));
    // 没有炮架时不能远程
    g.pieces = [e];
    const mv2 = G.eliteMoves(g, e);
    if (mv2.some(m => m.remote)) throw new Error('no screen -> no remote shot');
    console.log('elite cannon remote OK');
  }

  /* ---- 60% rule holds in xiangqi ---- */
  {
    const g = G.newGame('xiangqi');
    g.turbo = true;
    G.spawnFloor(g);
    const before = {};
    g.pieces.forEach(p => { before[p.id] = p.x + ',' + p.y; });
    await G.enemyPhase(g);
    const movedIds = g.pieces.filter(p => !p.e && before[p.id] !== (p.x + ',' + p.y)).length;
    if (movedIds > Math.floor(g.pieces.length * 0.6)) throw new Error('too many movers: ' + movedIds);
    if (movedIds > 0 && movedIds < 2 && g.pieces.length > 2) throw new Error('too few movers: ' + movedIds);
    invariant(g, 'xq enemy phase');
    console.log('xiangqi 60% batch OK (moved ' + movedIds + ')');
  }

  /* ---- remnants: drop on kill, cap 2, devour ---- */
  {
    const g = G.newGame('classic');
    g.turbo = true;
    G.spawnFloor(g);
    g.pieces.length = 0;
    g.weapons = [{ ...G.WEAPON_DEFS.warbow, ammo: 9 }];
    g.weapon = 0;
    g.player.x = 4; g.player.y = 7;
    for (let i = 0; i < 3; i++) {
      g.pieces.push({ id: 100 + i, type: 'pawn', x: 4, y: 5 - i, hp: 1, maxHp: 1, dmg: 1, boss: false, e: false, subtype: null, burned: false, slowed: false, moving: null });
    }
    await G.playerAction(g, 'fire', -90);
    if (g.remnants.length !== 2) throw new Error('remnant cap 2 expected, got ' + g.remnants.length);
    if (g.remnants[0].type !== 'pawn') throw new Error('remnant type should be pawn');
    // 再造一个敌人放在兵残躯可达格 (4,6)（玩家在 (4,7)，兵只能向前一格）
    g.pieces.push({ id: 200, type: 'knight', x: 4, y: 6, hp: 2, maxHp: 2, dmg: 2, boss: false, e: false, subtype: null, burned: false, slowed: false, moving: null });
    // 使用残躯吃子
    hideOverlays();
    G.useRemnantSlot(g, 0);
    if (!g.relicMode) throw new Error('relic mode not entered');
    const moves = G.relicMoves(g);
    if (!moves.some(m => m.x === 4 && m.y === 6)) throw new Error('pawn remnant should reach (4,6)');
    // 吃 (4,6) 上的敌人
    const target = g.pieces.find(p => p.x === 4 && p.y === 6);
    if (!target) throw new Error('expected enemy at (4,6)');
    const beforeCount = g.pieces.length;
    await G.chooseRemnant(g, 4, 6);
    if (g.pieces.length !== beforeCount - 1) throw new Error('devour should kill target');
    if (g.remnants.length !== 1) throw new Error('remnant consumed');
    if (g.relicMode) throw new Error('relic mode should clear');
    console.log('remnant drop + devour OK');
  }

  /* ---- active item: charge on kill, bomb use, 3-floor select ---- */
  {
    const g = G.newGame('classic');
    g.turbo = true;
    G.spawnFloor(g);
    g.activeItem = { id: 'bomb', charge: 0 };
    g.pieces.length = 0;
    g.weapons = [{ ...G.WEAPON_DEFS.warbow, ammo: 9 }];
    g.weapon = 0;
    g.player.x = 4; g.player.y = 7;
    g.pieces.push({ id: 200, type: 'pawn', x: 4, y: 5, hp: 1, maxHp: 1, dmg: 1, boss: false, e: false, subtype: null, burned: false, slowed: false, moving: null });
    await G.playerAction(g, 'fire', -90);
    if (g.activeItem.charge !== 1) throw new Error('kill should charge +1, got ' + g.activeItem.charge);
    // 3 层结束：endFloor 应触发 itemOverlay
    g.floor = 3;
    g.floorCleared = true;
    await G.endFloor(g);
    if (dom.els.itemOverlay.classList.contains('hidden')) throw new Error('item overlay should open at floor 3');
    // 选择道具（假 DOM 的 appendChild 为空操作，overlay 已可见即证明渲染入口执行）
    G.chooseItem(g, 'heal');
    if (!g.activeItem || g.activeItem.id !== 'heal') throw new Error('chooseItem failed');
    if (!dom.els.cardOverlay.classList.contains('hidden') === false) throw new Error('card overlay should follow item overlay');
    // 充能满后使用 heal
    hideOverlays();
    g.phase = 'player';
    g.activeItem.charge = 3;
    g.player.hp = 1;
    G.useItem(g);
    if (g.player.hp !== 3) throw new Error('heal should restore 2');
    if (g.activeItem.charge !== 0) throw new Error('item should drain charge');
    console.log('active item charge/use/select OK');
  }

  /* ---- xiangqi god-run: shoot the general ---- */
  {
    const g = G.newGame('xiangqi');
    g.turbo = true; g.autoPick = true;
    g.player.maxHp = 99; g.player.hp = 99;
    g.stats.dmg = 99; g.stats.range = 7; g.stats.pierce = 8;
    for (const w of g.weapons) { w.ammo = 30; w.maxAmmo = 30; }
    G.spawnFloor(g);
    let steps = 0;
    while (!g.over && g.floor <= 3 && steps < 200) {
      invariant(g, 'xq god floor ' + g.floor);
      const k = G.whiteKing(g);
      if (!k) break;
      g.player.x = k.x; g.player.y = 7;
      await G.playerAction(g, 'fire', -90);
      steps++;
    }
    if (g.floor < 3 && !g.over) throw new Error('xiangqi god-run stalled at floor ' + g.floor);
    console.log('xiangqi god-run OK (reached floor ' + g.floor + ')');
  }

  /* ---- freeze item skips enemy phase ---- */
  {
    const g = G.newGame('classic');
    g.turbo = true;
    G.spawnFloor(g);
    g.activeItem = { id: 'freeze', charge: 3 };
    const before = g.pieces.map(p => p.x + ',' + p.y);
    hideOverlays();
    G.useItem(g);
    if (!g.frozen) throw new Error('freeze should set frozen');
    await G.enemyPhase(g);
    const after = g.pieces.map(p => p.x + ',' + p.y);
    if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error('frozen enemies should not move');
    if (g.frozen) throw new Error('frozen should reset');
    console.log('freeze item OK');
  }

  /* ---- ch2 supports all 4 modes ---- */
  {
    // 经典
    const g = G.newGame('classic', 2);
    G.spawnFloor(g);
    if (g.musou || g.obstacleMode) throw new Error('classic flags wrong');
    if (g.weapons.length !== 5) throw new Error('classic ch2 should have 5 weapons');
    // 无双：弹药无限
    const gm = G.newGame('musou', 2);
    G.spawnFloor(gm);
    if (!gm.musou) throw new Error('musou flag missing for ch2');
    // 障碍：生成砖墙且与精英不重叠
    const go = G.newGame('obstacle', 2);
    G.spawnFloor(go);
    invariant(go, 'xq obstacle');
    if (go.obstacles.length === 0) throw new Error('obstacle ch2 spawned no walls');
    // 狙击：单武器狙击枪
    const gs = G.newGame('sniper', 2);
    G.spawnFloor(gs);
    if (gs.weapons.length !== 1 || gs.weapons[0].id !== 'sniper') throw new Error('sniper ch2 weapon wrong');
    invariant(gs, 'xq sniper');
    console.log('ch2 all modes OK');
  }

  /* ---- elite hitbox is the 4 cells around the lattice point ---- */
  {
    const g = G.newGame('classic', 2);
    G.spawnFloor(g);
    g.pieces.length = 0;
    const e = G.spawnPiece(g, 'elite', 3, 3, { hp: 10, dmg: 2 });
    e.e = true; e.subtype = 'pawn';
    // 落点 (3,3) 的一圈格子：覆盖 (2..3, 2..3)
    const inArea = (x, y) => G.pieceAt(g, x, y) === e;
    if (!inArea(2, 2) || !inArea(3, 2) || !inArea(2, 3) || !inArea(3, 3)) throw new Error('elite should cover 4 cells around point');
    if (inArea(1, 1) || inArea(4, 3) || inArea(3, 4) || inArea(1, 2)) throw new Error('elite hitbox too wide');
    // 玩家踏入落点一圈 = 被攻击判定
    g.player.x = 3; g.player.y = 2;
    if (!G.playerInElite(g, e)) throw new Error('player in elite circle should be attacked');
    g.player.x = 4; g.player.y = 3;
    if (G.playerInElite(g, e)) throw new Error('player outside circle should be safe');
    console.log('elite centered hitbox OK');
  }

  /* ---- endless loop mode: 10-floor cycles, +1 enemy hp per cycle ---- */
  {
    // 独立模式：newGame('endless') 从第 1 层起就是无尽（循环规则自动生效）
    const ge = G.newGame('endless');
    if (!ge.endless) throw new Error('endless mode flag missing');
    ge.turbo = true; ge.autoPick = true;
    G.spawnFloor(ge);
    invariant(ge, 'endless f1');
    if (ge.pieces.some(p => p.type === 'queen')) throw new Error('endless f1 should be a normal floor 1');
    if (G.cycleBonus(ge) !== 0) throw new Error('cycle 1 should have no hp bonus');
    ge.floor = 11;
    G.spawnFloor(ge);
    invariant(ge, 'endless f11');
    if (G.cycleBonus(ge) !== 1) throw new Error('cycle 2 should add +1 hp');
    console.log('endless standalone mode OK');
    const spawnUntilPawn = (mode, chapter, floor) => {
      for (let i = 0; i < 25; i++) {
        const g = G.newGame(mode, chapter);
        g.turbo = true; g.autoPick = true;
        g.endless = true; g.floor = floor;
        G.spawnFloor(g);
        const pawn = g.pieces.find(p => p.type === 'pawn');
        if (pawn) return { g, pawn };
      }
      throw new Error('no pawn spawned after 25 tries (floor ' + floor + ')');
    };
    // 11 层 = 循环 2 第 1 层：按 5 层基础出怪（无 queen），敌人 +1 生命
    const r11 = spawnUntilPawn('classic', 1, 11);
    if (r11.g.pieces.some(p => p.type === 'queen')) throw new Error('floor 11 should spawn like floor 5 (no queen)');
    if (r11.pawn.maxHp !== 3) throw new Error('floor 11 pawn hp should be 2+1=3, got ' + r11.pawn.maxHp);
    const k = G.whiteKing(r11.g);
    if (k.maxHp !== 5) throw new Error('floor 11 king hp should be 4+1=5, got ' + k.maxHp);
    // 15 层 = 循环第 5 位：10 层最大出怪（有 queen），敌人 +1
    const r15 = spawnUntilPawn('classic', 1, 15);
    if (!r15.g.pieces.some(p => p.type === 'queen')) throw new Error('floor 15 should spawn like floor 10 (queen unlocked)');
    if (r15.pawn.maxHp !== 4) throw new Error('floor 15 pawn hp should be 3+1=4, got ' + r15.pawn.maxHp);
    // 21 层 = 循环 3 第 1 层：重置为 5 层基础 + 2 生命加成
    const r21 = spawnUntilPawn('classic', 1, 21);
    if (r21.g.pieces.some(p => p.type === 'queen')) throw new Error('floor 21 should reset to 5-base (no queen)');
    if (r21.pawn.maxHp !== 4) throw new Error('floor 21 pawn hp should be 2+2=4, got ' + r21.pawn.maxHp);
    // 第二章循环：精英 hp 同步 +1
    const gx = G.newGame('classic', 2);
    gx.turbo = true; gx.autoPick = true;
    gx.endless = true; gx.floor = 11;
    G.spawnFloor(gx);
    invariant(gx, 'xq endless 11');
    const ex = gx.pieces.find(p => p.e);
    if (ex && ex.maxHp !== 11) throw new Error('floor 11 elite hp should be 3+5+2+1=11, got ' + ex.maxHp);
    console.log('endless loop mode OK');
  }

  /* ---- ch2 chapters unlocked ---- */
  {
    const ch2 = G.CHAPTERS.find(c => c.id === 2);
    if (!ch2 || !ch2.unlocked) throw new Error('chapter 2 should be unlocked');
    console.log('chapters OK');
  }

  console.log('ALL XQ TESTS PASSED');
})().catch(e => { console.error('XQ TEST FAILURE:', e); process.exit(1); });
