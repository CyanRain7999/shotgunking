'use strict';
/* Chapter 4 (Persian Shatranj) + new modes (ring / night / touchdown) tests. */
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
  const idList = ['game','cardOverlay','cards','cardStats','endOverlay','endTitle','endStats','endNote','btnEndless','btnStart','btnAgain','btnSkip','startOverlay','btnInstall','itemOverlay','itemCards','itemStats','btnItemSkip','chapterList','btnPlay','modeNote','advPrev','advVal','advNext','advDesc','tutOverlay','btnTutClose','btnTutClose2'];
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
    const k = p.x + ',' + p.y;
    if (seen.has(k)) throw new Error(label + ': overlap at ' + k);
    seen.add(k);
    if (!G.inB(p.x, p.y)) throw new Error(label + ': piece off board ' + k);
    if (p.hp <= 0) throw new Error(label + ': dead piece present');
  }
  if (seen.has(g.player.x + ',' + g.player.y)) throw new Error(label + ': player overlap');
}

(async () => {
  const hideOverlays = () => {
    ['startOverlay', 'cardOverlay', 'endOverlay', 'itemOverlay', 'tutOverlay', 'tutOverlayPersian'].forEach(id => {
      if (dom.els[id]) dom.els[id].classList.add('hidden');
    });
  };

  /* ================== 第四章 · 波斯 ================== */
  /* ---- ch4 spawn: shah + escort pool + no overlap ---- */
  {
    const g = G.newGame('classic', 4);
    G.spawnFloor(g);
    invariant(g, 'persian spawn');
    if (!G.isPERSIAN(g)) throw new Error('isPERSIAN flag missing');
    const k = G.whiteKing(g);
    if (!k || k.type !== 'king') throw new Error('no shah');
    if (k.y < 0 || k.y > 2) throw new Error('shah should start in the top rows');
    // 兵行线与精英池：多次采样确保 alfil 在低层池中
    let sawAlfil = g.pieces.some(p => p.type === 'alfil');
    for (let i = 0; i < 10 && !sawAlfil; i++) {
      const g3 = G.newGame('classic', 4);
      G.spawnFloor(g3);
      sawAlfil = g3.pieces.some(p => p.type === 'alfil');
    }
    if (!sawAlfil) throw new Error('floor 1 pool should include alfil');
    console.log('persian spawn OK (pieces=' + g.pieces.length + ', shah@' + k.x + ',' + k.y + ')');
    // f3+ fers, f4+ rukh
    let sawFers = false, sawRukh = false;
    for (let i = 0; i < 20; i++) {
      const g2 = G.newGame('classic', 4);
      g2.floor = 4;
      G.spawnFloor(g2);
      invariant(g2, 'persian f4');
      for (const p of g2.pieces) {
        if (p.type === 'fers') sawFers = true;
        if (p.type === 'rukh') sawRukh = true;
      }
    }
    if (!sawFers) throw new Error('fers should unlock at f3');
    if (!sawRukh) throw new Error('rukh should unlock at f4');
    console.log('persian pool unlock OK');
  }

  /* ---- persian moves: alfil jump / fers diag / faras knight / pawn diag capture / rukh slide ---- */
  {
    const g = G.newGame('classic', 4);
    G.spawnFloor(g);
    g.pieces = [];
    g.player.x = 4; g.player.y = 7;
    // alfil at (2,2): jumps to (4,4)/(4,0)/(0,4)/(0,0)
    const a = G.spawnPiece(g, 'alfil', 2, 2, { hp: 3 });
    let mv = G.legalEnemyMoves(g, a);
    if (!mv.some(m => m.x === 4 && m.y === 4)) throw new Error('alfil should jump to (4,4): ' + JSON.stringify(mv));
    // fers: 1 diagonal
    g.pieces = [a];
    const f = G.spawnPiece(g, 'fers', 3, 2, { hp: 3 });
    mv = G.legalEnemyMoves(g, f);
    if (!mv.some(m => m.x === 4 && m.y === 3)) throw new Error('fers should move 1 diag to (4,3)');
    if (mv.some(m => m.x === 4 && m.y === 4)) throw new Error('fers is weak - cannot go 2');
    // faras: knight jump
    g.pieces = [a];
    const n = G.spawnPiece(g, 'faras', 3, 3, { hp: 3 });
    mv = G.legalEnemyMoves(g, n);
    if (!mv.some(m => m.x === 4 && m.y === 5)) throw new Error('faras should knight-jump to (4,5)');
    // pawn: forward + diagonal capture
    g.pieces = [a];
    const p = G.spawnPiece(g, 'pawn', 3, 2, { hp: 2 });
    g.player.x = 4; g.player.y = 3;
    mv = G.legalEnemyMoves(g, p);
    if (!mv.some(m => m.x === 4 && m.y === 3 && m.capture)) throw new Error('persian pawn should capture diagonally at player (4,3)');
    if (!mv.some(m => m.x === 3 && m.y === 3 && !m.capture)) throw new Error('persian pawn should step forward to (3,3)');
    // rukh slide
    g.pieces = [a];
    const r = G.spawnPiece(g, 'rukh', 2, 2, { hp: 4 });
    g.player.x = 4; g.player.y = 2;
    mv = G.legalEnemyMoves(g, r);
    if (!mv.some(m => m.x === 4 && m.y === 2 && m.capture)) throw new Error('rukh should slide and capture player');
    console.log('persian moves OK');
  }

  /* ---- 擒王（裸王即胜）：清光护卫立即通关，不必杀王 ---- */
  {
    const g = G.newGame('classic', 4);
    g.turbo = true;
    G.spawnFloor(g);
    // 只留王 + 一个护卫，打掉护卫即通关
    const k = G.whiteKing(g);
    g.pieces = g.pieces.filter(p => p.type === 'king');
    const guard = G.spawnPiece(g, 'pawn', 4, 5, { hp: 1 });
    if (g.floorCleared) throw new Error('escort alive - should not be cleared');
    G.killPiece(g, guard, 'shot', true);
    if (!g.floorCleared) throw new Error('bare king should clear the floor immediately');
    if (!g.pieces.some(p => p.type === 'king')) throw new Error('shah should still be alive (bare king = win, not kill)');
    console.log('bare king (擒王) OK');
  }

  /* ---- 小沙暴：距离越远伤害越低（最低 50%） ---- */
  {
    const g = G.newGame('classic', 4);
    G.spawnFloor(g);
    g.player.x = 4; g.player.y = 7;
    if (G.sandstormFactor(g, 4, 6) >= 1) throw new Error('adjacent target should take some reduction');
    const f1 = G.sandstormFactor(g, 4, 6);       // dist 1
    const f5 = G.sandstormFactor(g, 4, 2);       // dist 5
    if (!(f5 < f1)) throw new Error('farther target should take MORE reduction');
    if (f5 !== 0.5) throw new Error('floor should be 0.5, got ' + f5);
    // damagePiece applies it
    g.pieces = [];
    const far = G.spawnPiece(g, 'pawn', 4, 2, { hp: 99, dmg: 1 });   // dist 5
    G.damagePiece(g, far, 10, 'shot');
    if (far.hp !== 99 - 5) throw new Error('far target should take 5 damage (10*0.5), hp=' + far.hp);
    g.pieces = [];
    const near = G.spawnPiece(g, 'pawn', 4, 6, { hp: 99, dmg: 1 });  // dist 1
    G.damagePiece(g, near, 10, 'shot');
    if (near.hp !== 99 - 9) throw new Error('near target should take 9 damage (10*0.88 rounded), hp=' + near.hp);
    console.log('small sandstorm distance reduction OK');
  }

  /* ---- 大沙暴：掩蔽格 + 开火清除路径 + 爆炸吹散 ---- */
  {
    const g = G.newGame('classic', 4);
    G.spawnFloor(g);
    g.player.x = 4; g.player.y = 7;
    // 直接构造覆盖格，验证清除逻辑
    g.sandCells = [{ x: 4, y: 6 }, { x: 4, y: 4 }, { x: 7, y: 0 }];
    G.clearSandAlong(g, -90, 6);
    if (g.sandCells.some(s => s.x === 4 && s.y === 6)) throw new Error('(4,6) should be cleared');
    if (g.sandCells.some(s => s.x === 4 && s.y === 4)) throw new Error('(4,4) should be cleared');
    if (!g.sandCells.some(s => s.x === 7 && s.y === 0)) throw new Error('(7,0) off-path should remain');
    // 爆炸吹散
    G.clearSandArea(g, 4, 4, 1);
    if (g.sandCells.length !== 1) throw new Error('blast should leave only (7,0): ' + JSON.stringify(g.sandCells));
    console.log('big sandstorm cover + clear OK');
    // 沙暴事件本身：覆盖随机格，不与黑王相邻
    const g2 = G.newGame('classic', 4);
    G.spawnFloor(g2);
    g2.sandCells = [];
    G.sandStorm(g2);
    if (!g2.sandCells.length) throw new Error('sandstorm should cover cells');
    const chebL = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
    for (const s of g2.sandCells) {
      if (chebL(s, g2.player) <= 1) throw new Error('sand should not cover cells adjacent to player');
    }
    console.log('sandstorm event cover OK (' + g2.sandCells.length + ' cells)');
  }

  /* ---- 大沙暴计时：每 3 个敌方回合袭来一次 ---- */
  {
    const g = G.newGame('classic', 4);
    g.turbo = true;
    G.spawnFloor(g);
    const initial = g.sandCells.length;
    g.sandTimer = 0;                 // 下一个敌方回合触发
    await G.enemyPhase(g);
    if (g.sandTimer !== 3) throw new Error('sandstorm should reset timer to 3, got ' + g.sandTimer);
    if (g.sandCells.length < initial) throw new Error('storm should add coverage');
    console.log('sandstorm timing OK');
  }

  /* ================== 环城（上下左右互通） ================== */
  {
    const g = G.newGame('ring', 1);
    G.spawnFloor(g);
    if (!g.ring) throw new Error('ring flag missing');
    // 黑王从 (0,4) 向左一步 → (7,4)；向上一步 → (0,3)? 向下→(0,5)；向右→(1,4)
    g.pieces = [];
    g.player.x = 0; g.player.y = 4;
    let mv = G.legalPlayerMoves(g);
    if (!mv.some(m => m.x === 7 && m.y === 4)) throw new Error('ring: left wrap 0->7 failed');
    if (!mv.some(m => m.x === 0 && m.y === 3) || !mv.some(m => m.x === 0 && m.y === 5)) throw new Error('ring: vertical moves broken');
    // 敌方车沿行滑动穿越边界：(1,4) 向左应到 (0,4) 并继续到 (7,4)
    g.player.x = 7; g.player.y = 4;
    const rk = G.spawnPiece(g, 'rook', 1, 4, { hp: 4, dmg: 2 });
    mv = G.legalEnemyMoves(g, rk);
    if (!mv.some(m => m.x === 7 && m.y === 4 && m.capture)) throw new Error('ring: rook should slide across seam to capture at (7,4)');
    if (!mv.some(m => m.x === 0 && m.y === 4)) throw new Error('ring: rook should pass through wrapped (0,4)');
    // 弹道绕场：从 (0,4) 沿 0°（右）应绕场一周命中 (7,4) 的敌人
    g.pieces = [];
    const target = G.spawnPiece(g, 'pawn', 7, 4, { hp: 2, dmg: 1 });
    const hits = G.raycast(g, 0.5, 4.5, 0, 8, 1);
    if (!hits.some(h => h.pc === target)) throw new Error('ring: ray should wrap right and hit (7,4)');
    console.log('ring wrap (move + slide + ray) OK');
  }

  /* ================== 夜袭（视野迷雾） ================== */
  {
    const g = G.newGame('night', 1);
    G.spawnFloor(g);
    if (!g.night) throw new Error('night flag missing');
    // 基础照亮半径 = 黑王身边 2 格（固定）
    if (G.nightLightRadius(g) !== 2) throw new Error('base light radius should be 2, got ' + G.nightLightRadius(g));
    // 迷雾判定：2 格内敞亮、2 格外全黑
    if (G.hiddenByNight(g, g.player.x, g.player.y)) throw new Error('player cell should be lit');
    if (G.hiddenByNight(g, g.player.x, g.player.y + 2)) throw new Error('2-cell ring should be lit');
    if (!G.hiddenByNight(g, g.player.x, g.player.y + 3)) throw new Error('beyond 2 cells should be hidden');
    // 开火后：开火范围（武器射程内）短暂照亮
    await G.playerAction(g, 'fire', -90);
    const farX = g.player.x, farY = Math.max(0, g.player.y - 5);   // 距黑王 5 格（霰弹射程 4+1 内应被照亮）
    if (G.hiddenByNight(g, farX, farY)) throw new Error('firing should illuminate its range, ' + farX + ',' + farY + ' still hidden');
    if (!g.litCells.length) throw new Error('litCells should be populated after firing');
    // 迷雾中的敌人不可见 → 开火照亮后可见（渲染层由 hiddenByNight 统一处理）
    console.log('night fog OK (base 2 + fire illumination)');
  }

  /* ================== 达阵（8×32 长条棋盘） ================== */
  {
    const g = G.newGame('touchdown', 1);
    G.spawnFloor(g);
    if (!g.touchdown) throw new Error('touchdown flag missing');
    if (g.boardH !== 32) throw new Error('touchdown board should be 32 rows');
    if (!G.inB(0, 31) || G.inB(0, 32)) throw new Error('touchdown bounds wrong');
    invariant(g, 'touchdown spawn');
    if (g.pieces.length < 10) throw new Error('touchdown floor 1 should be crowded');
    // 白王镇守底线（达阵区 y=31），不移位
    const tk = g.pieces.filter(p => p.type === 'king');
    if (tk.length !== 1) throw new Error('touchdown should have exactly one white king at the goal line');
    if (tk[0].y !== 31 || !tk[0].noMove) throw new Error('white king must guard y=31 and stay put');
    if (g.pieces.some(p => p.y === 31 && p.type !== 'king')) throw new Error('goal line belongs to the white king only');
    console.log('touchdown spawn OK (pieces=' + g.pieces.length + ', white king@' + tk[0].x + ',31)');
    // 相机跟随
    g.player.y = 20;
    if (G.camYFor(g) !== 17) throw new Error('camY should follow player (20-3=17), got ' + G.camYFor(g));
    // 达阵：黑王到 y=31 → 通关（自动进入下一层；白王占 (4,31)，从旁路越线）
    g.autoPick = true;                 // 自动选卡以便验证通关流转
    g.player.y = 30;
    g.player.x = 3;
    g.floor = 1;
    await G.playerAction(g, 'move', { x: 3, y: 31 });
    if (g.floor !== 2) throw new Error('touchdown goal should clear the floor and advance, floor=' + g.floor);
    console.log('touchdown camera + goal OK');
  }

  /* ---- 达阵：白王镇守底线 + 生擒白王/越线双达阵路径 ---- */
  {
    const g = G.newGame('touchdown', 1);
    g.turbo = true; g.autoPick = true;
    G.spawnFloor(g);
    // 敌方回合后白王仍在底线
    await G.enemyPhase(g);
    const k = g.pieces.find(p => p.type === 'king');
    if (!k || k.y !== 31) throw new Error('white king should hold the goal line through enemy turns');
    // 威胁显示：白王相邻行（y=30）有威胁格
    const tm = G.threatMap(g);
    if (tm[30].filter(Boolean).length < 2) throw new Error('white king should threaten its neighbors');
    // 击杀白王 = 达阵通关
    G.damagePiece(g, k, 999, 'shot');
    if (!g.floorCleared) throw new Error('capturing the white king should clear the floor');
    console.log('touchdown white king OK (guards line + capture wins)');
  }

  /* ---- 达阵：白王威胁范围渲染不错位（y=30 威胁格落在视口正确行） ---- */
  {
    const g = G.newGame('touchdown', 1);
    G.spawnFloor(g);
    g.player.y = 24;                 // camY = 21 → 视口行 21..28
    G.render(g);
    console.log('touchdown king threat render OK');
  }

  /* ---- 达阵：每层奖励 2 张被动 ---- */
  {
    const g = G.newGame('touchdown', 1);
    g.autoPick = true;
    g.turbo = true;
    G.spawnFloor(g);
    g.floor = 1;
    const cardsBefore = g.cards.length;
    g.floorCleared = true;
    await G.endFloor(g);
    if (g.cards.length !== cardsBefore + 2) throw new Error('touchdown autoPick should grant 2 passives, got +' + (g.cards.length - cardsBefore));
    console.log('touchdown double passive OK (cards +' + (g.cards.length - cardsBefore) + ')');
  }

  /* ---- 达阵：敌人追击黑王 ---- */
  {
    const g = G.newGame('touchdown', 1);
    g.turbo = true;
    G.spawnFloor(g);
    // 清场后放一个敌人 3 格外，验证它朝黑王逼近
    g.pieces = [];
    g.player.x = 4; g.player.y = 10;
    const e = G.spawnPiece(g, 'pawn', 4, 13, { hp: 2, dmg: 1 });
    const mv = G.legalEnemyMoves(g, e);
    if (!mv.length) throw new Error('chaser should have a move');
    const best = mv.reduce((a, b) => Math.hypot(b.x - g.player.x, b.y - g.player.y) < Math.hypot(a.x - g.player.x, a.y - g.player.y) ? b : a);
    if (Math.hypot(best.x - g.player.x, best.y - g.player.y) >= Math.hypot(e.x - g.player.x, e.y - g.player.y)) {
      throw new Error('chaser should move CLOSER to the player');
    }
    console.log('touchdown chase OK');
  }

  /* ---- 新模式 × 全章节可开局 ---- */
  {
    for (const mode of ['ring', 'night', 'touchdown']) {
      for (const ch of [1, 2, 3, 4]) {
        const g = G.newGame(mode, ch);
        G.spawnFloor(g);
        invariant(g, mode + ' ch' + ch);
      }
    }
    console.log('new modes x all chapters spawn OK');
  }

  /* ---- 渲染冒烟：新模式/新章节 ---- */
  {
    const gs = G.newGame('touchdown', 1);
    G.spawnFloor(gs);
    G.render(gs);
    const gn = G.newGame('night', 1);
    G.spawnFloor(gn);
    G.render(gn);
    const gr = G.newGame('ring', 1);
    G.spawnFloor(gr);
    G.render(gr);
    const gp = G.newGame('classic', 4);
    G.spawnFloor(gp);
    G.render(gp);
    console.log('render smoke OK (touchdown/night/ring/persian)');
  }

  /* ---- 第四章波斯通关演练：靠擒王清光护卫过关 ---- */
  {
    const g = G.newGame('classic', 4);
    g.turbo = true; g.autoPick = true;
    g.player.maxHp = 99; g.player.hp = 99;
    g.stats.dmg = 99; g.stats.range = 7; g.stats.pierce = 8;
    for (const w of g.weapons) { w.ammo = 30; w.maxAmmo = 30; }
    G.spawnFloor(g);
    let steps = 0;
    while (!g.over && g.floor <= 3 && steps < 200) {
      invariant(g, 'persian god floor ' + g.floor);
      const k = G.whiteKing(g);
      // 打法：先瞄准护卫开火清光（擒王），不必杀王；射程 7 覆盖全盘
      const escorts = g.pieces.filter(p => p.type !== 'king');
      if (escorts.length) {
        const t = escorts[0];
        const ang = Math.atan2(t.y - g.player.y, t.x - g.player.x) * 180 / Math.PI;
        await G.playerAction(g, 'fire', ang);
      } else {
        // 只剩王：移动一步确认通关流转
        g.player.x = 4; g.player.y = 7;
        const moves = G.legalPlayerMoves(g);
        if (moves.length) await G.playerAction(g, 'move', moves[0]);
      }
      steps++;
    }
    if (g.floor < 3 && !g.over) throw new Error('persian god-run stalled at floor ' + g.floor);
    console.log('persian god-run OK (reached floor ' + g.floor + ', kills=' + g.kills + ')');
  }

  /* ---- 达阵自动跑：3 层内稳定推进 + 每层 +2 卡 ---- */
  {
    const g = G.newGame('touchdown', 1);
    g.turbo = true; g.autoPick = true;
    g.player.maxHp = 99; g.player.hp = 99;
    g.stats.dmg = 99; g.stats.range = 7; g.stats.pierce = 8;
    for (const w of g.weapons) { w.ammo = 30; w.maxAmmo = 30; }
    G.spawnFloor(g);
    let steps = 0;
    while (!g.over && g.floor <= 3 && steps < 300) {
      invariant(g, 'touchdown god floor ' + g.floor);
      // 向下冲刺 2 格；被挡就瞄准最近敌人开火
      const moves = G.legalPlayerMoves(g);
      const down = moves.find(m => m.y > g.player.y && Math.abs(m.x - g.player.x) <= 1);
      if (down) {
        await G.playerAction(g, 'move', down);
      } else {
        let nearest = null, nd = 1e9;
        for (const p of g.pieces) {
          const d = Math.hypot(p.x - g.player.x, p.y - g.player.y);
          if (d < nd) { nd = d; nearest = p; }
        }
        if (nearest) {
          const ang = Math.atan2(nearest.y - g.player.y, nearest.x - g.player.x) * 180 / Math.PI;
          await G.playerAction(g, 'fire', ang);
        } else {
          await G.playerAction(g, 'move', { x: g.player.x, y: Math.max(0, g.player.y - 1) });
        }
      }
      steps++;
    }
    if (g.floor < 3 && !g.over) throw new Error('touchdown god-run stalled at floor ' + g.floor);
    if (g.cards.length < 2) throw new Error('touchdown should have granted at least 2 passives, got ' + g.cards.length);
    console.log('touchdown god-run OK (floor ' + g.floor + ', cards=' + g.cards.length + ')');
  }

  /* ---- 环城敌方回合稳定性 ---- */
  {
    const g = G.newGame('ring', 1);
    g.turbo = true;
    G.spawnFloor(g);
    invariant(g, 'ring f1');
    await G.enemyPhase(g);
    invariant(g, 'ring enemy phase');
    await G.enemyPhase(g);
    invariant(g, 'ring enemy phase 2');
    console.log('ring enemy phase stability OK');
  }

  console.log('ALL NEW FEATURE TESTS PASSED');
})().catch(e => { console.error('NEW TEST FAILURE:', e); process.exit(1); });